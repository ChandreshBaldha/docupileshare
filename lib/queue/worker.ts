import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, renderTemplate } from '@/lib/email'
import { sendOtpEmail } from '@/lib/email'
import { sendOtpSms } from '@/lib/sms'
import { generateOtp, hashOtp } from '@/lib/otp'
import { getRedisConnection, QUEUE_NAMES } from '@/lib/queue/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Docupile Share'

async function processShareEmail(job: Job) {
  const { shareLinkId, batchId } = job.data

  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: {
      recipient: true,
      file: true,
      shareBatch: {
        include: { brandingAsset: true },
      },
    },
  })

  if (!shareLink) throw new Error(`ShareLink ${shareLinkId} not found`)
  if (shareLink.emailSent) return // already sent, skip

  const batch = shareLink.shareBatch
  const recipient = shareLink.recipient
  const shareUrl = `${APP_URL}/share/${shareLink.token}`

  // ─── Handle OTP ─────────────────────────────────────────────
  let otpCode: string | null = null
  if (batch.otpEnabled) {
    otpCode = generateOtp()
    const otpHash = await hashOtp(otpCode)
    await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: { otpCodeHash: otpHash, otpSentAt: new Date() },
    })
  }

  // ─── Render email ────────────────────────────────────────────
  const expiryText = batch.linkExpiryLabel ?? 'No expiry'
  const variables: Record<string, string> = {
    name: recipient.name,
    email: recipient.email,
    fileName: shareLink.file.originalName,
    shareLink: shareUrl,
    expiryDate: expiryText,
    appName: APP_NAME,
  }

  const renderedBody = renderTemplate(batch.emailBodyHtml, variables)
  const fullHtml = buildEmailHtml({
    logoUrl: batch.brandingLogoUrl ?? batch.brandingAsset?.publicUrl,
    bodyHtml: renderedBody,
    appName: APP_NAME,
  })

  const renderedSubject = renderTemplate(batch.emailSubject, variables)

  // ─── Send email ──────────────────────────────────────────────
  const emailResult = await sendEmail({
    to: recipient.email,
    subject: renderedSubject,
    html: fullHtml,
    text: `${recipient.name}, access your document: ${shareUrl}`,
    fromName: APP_NAME,
  })

  // ─── Send OTP if needed ──────────────────────────────────────
  if (otpCode && batch.otpEnabled) {
    if (batch.otpChannel === 'PHONE' && recipient.phone) {
      await sendOtpSms({ to: recipient.phone, name: recipient.name, otp: otpCode, appName: APP_NAME })
    } else {
      await sendOtpEmail({
        to: recipient.email,
        name: recipient.name,
        otp: otpCode,
        logoUrl: batch.brandingLogoUrl ?? batch.brandingAsset?.publicUrl,
        appName: APP_NAME,
      })
    }
  }

  // ─── Update share link record ────────────────────────────────
  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      emailSent: emailResult.success,
      emailSentAt: emailResult.success ? new Date() : null,
      emailError: emailResult.error ?? null,
      sendAttempts: { increment: 1 },
      status: emailResult.success ? 'ACTIVE' : 'ACTIVE',
    },
  })

  // ─── Update job log ──────────────────────────────────────────
  await prisma.jobQueueLog.create({
    data: {
      shareBatchId: batchId,
      shareLinkId,
      jobId: job.id,
      queueName: QUEUE_NAMES.SHARE_EMAIL,
      status: emailResult.success ? 'completed' : 'failed',
      errorMessage: emailResult.error,
      startedAt: new Date(job.processedOn ?? Date.now()),
      completedAt: new Date(),
    },
  })

  if (!emailResult.success) throw new Error(emailResult.error)
}

// ─── Check if batch is fully processed ───────────────────────

async function checkBatchCompletion(batchId: string) {
  const batch = await prisma.shareBatch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { shareLinks: true } } },
  })
  if (!batch) return

  const processed = await prisma.shareLink.count({
    where: {
      shareBatchId: batchId,
      OR: [{ emailSent: true }, { emailError: { not: null } }],
    },
  })

  if (processed >= batch.totalRecipients) {
    const failed = await prisma.shareLink.count({
      where: { shareBatchId: batchId, emailError: { not: null } },
    })
    await prisma.shareBatch.update({
      where: { id: batchId },
      data: {
        status: failed === 0 ? 'COMPLETED' : failed === batch.totalRecipients ? 'FAILED' : 'PARTIALLY_FAILED',
        completedAt: new Date(),
      },
    })
    // Notify batch creator
    const b = await prisma.shareBatch.findUnique({ where: { id: batchId } })
    if (b) {
      await prisma.notification.create({
        data: {
          userId: b.createdById,
          type: 'BATCH_COMPLETE',
          title: 'Bulk share completed',
          message: `Share batch completed: ${processed - failed} sent, ${failed} failed.`,
          entityType: 'share_batch',
          entityId: batchId,
        },
      })
    }
  }
}

// ─── Start worker ─────────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAMES.SHARE_EMAIL,
  processShareEmail,
  {
    connection: getRedisConnection(),
    concurrency: 20,
  }
)

worker.on('completed', async (job: Job) => {
  console.log(`[Worker] Job ${job.id} completed`)
  await checkBatchCompletion(job.data.batchId)
})

worker.on('failed', async (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
  if (job) await checkBatchCompletion(job.data.batchId)
})

console.log(`[Worker] Share email worker started`)

export default worker

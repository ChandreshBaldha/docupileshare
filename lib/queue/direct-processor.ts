/**
 * Direct email processor — used when Redis/BullMQ is not available.
 * Sends share emails synchronously, in batches of 10 to avoid timeouts.
 */
import { prisma } from '@/lib/db'
import { sendEmail, buildEmailHtml, renderTemplate, sendOtpEmail } from '@/lib/email'
import { sendOtpSms } from '@/lib/sms'
import { generateOtp, hashOtp } from '@/lib/otp'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Docupile Share'

async function sendOneEmail(shareLinkId: string, batchId: string): Promise<void> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { id: shareLinkId },
    include: {
      recipient: true,
      file: true,
      shareBatch: { include: { brandingAsset: true } },
    },
  })

  if (!shareLink || shareLink.emailSent) return

  const batch = shareLink.shareBatch
  const recipient = shareLink.recipient
  const shareUrl = `${APP_URL}/share/${shareLink.token}`

  // Generate OTP if needed
  let otpCode: string | null = null
  if (batch.otpEnabled) {
    otpCode = generateOtp()
    const otpHash = await hashOtp(otpCode)
    await prisma.shareLink.update({
      where: { id: shareLinkId },
      data: { otpCodeHash: otpHash, otpSentAt: new Date() },
    })
  }

  // Build email
  const variables: Record<string, string> = {
    name: recipient.name,
    email: recipient.email,
    fileName: shareLink.file.originalName,
    shareLink: shareUrl,
    expiryDate: batch.linkExpiryLabel ?? 'No expiry',
    appName: APP_NAME,
  }

  const renderedBody = renderTemplate(batch.emailBodyHtml, variables)
  const fullHtml = buildEmailHtml({
    logoUrl: batch.brandingLogoUrl ?? batch.brandingAsset?.publicUrl,
    bodyHtml: renderedBody,
    appName: APP_NAME,
  })
  const renderedSubject = renderTemplate(batch.emailSubject, variables)

  // Send email
  const emailResult = await sendEmail({
    to: recipient.email,
    subject: renderedSubject,
    html: fullHtml,
    text: `${recipient.name}, access your document: ${shareUrl}`,
    fromName: APP_NAME,
  })

  // Send OTP via SMS or email
  if (otpCode && batch.otpEnabled) {
    if (batch.otpChannel === 'PHONE' && recipient.phone) {
      await sendOtpSms({ to: recipient.phone, name: recipient.name, otp: otpCode, appName: APP_NAME }).catch(() => {})
    } else {
      await sendOtpEmail({
        to: recipient.email,
        name: recipient.name,
        otp: otpCode,
        logoUrl: batch.brandingLogoUrl ?? batch.brandingAsset?.publicUrl,
        appName: APP_NAME,
      }).catch(() => {})
    }
  }

  // Update share link
  await prisma.shareLink.update({
    where: { id: shareLinkId },
    data: {
      emailSent: emailResult.success,
      emailSentAt: emailResult.success ? new Date() : null,
      emailError: emailResult.error ?? null,
      sendAttempts: { increment: 1 },
      status: 'ACTIVE',
    },
  })
}

async function finaliseBatch(batchId: string, total: number): Promise<void> {
  const failed = await prisma.shareLink.count({
    where: { shareBatchId: batchId, emailError: { not: null } },
  })
  const sent = await prisma.shareLink.count({
    where: { shareBatchId: batchId, emailSent: true },
  })

  const status =
    failed === 0 ? 'COMPLETED' :
    sent === 0   ? 'FAILED' :
                   'PARTIALLY_FAILED'

  await prisma.shareBatch.update({
    where: { id: batchId },
    data: { status, completedAt: new Date(), sentCount: sent, failedCount: failed },
  })

  // Notify creator
  const batch = await prisma.shareBatch.findUnique({ where: { id: batchId } })
  if (batch) {
    await prisma.notification.create({
      data: {
        userId: batch.createdById,
        type: 'BATCH_COMPLETE',
        title: 'Bulk share completed',
        message: `Share batch completed: ${sent} sent, ${failed} failed out of ${total}.`,
        entityType: 'share_batch',
        entityId: batchId,
      },
    }).catch(() => {})
  }
}

export async function processShareEmailDirect(
  shareLinkIds: string[],
  batchId: string
): Promise<void> {
  const BATCH_SIZE = 10
  let processed = 0

  for (let i = 0; i < shareLinkIds.length; i += BATCH_SIZE) {
    const chunk = shareLinkIds.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(chunk.map(id => sendOneEmail(id, batchId)))
    processed += chunk.length
    console.log(`[direct-processor] Processed ${processed}/${shareLinkIds.length} emails for batch ${batchId}`)
  }

  await finaliseBatch(batchId, shareLinkIds.length)
}

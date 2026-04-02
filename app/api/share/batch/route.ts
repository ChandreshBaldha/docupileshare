import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError, generateShareToken, computeExpiresAt } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  folderId: z.string().uuid(),
  csvUploadId: z.string().uuid(),
  emailSubject: z.string().min(1).max(500),
  emailBodyHtml: z.string().min(1),
  emailBodyText: z.string().optional(),
  brandingAssetId: z.string().uuid().nullable().optional(),
  otpEnabled: z.boolean().default(false),
  otpChannel: z.enum(['EMAIL', 'PHONE']).nullable().optional(),
  linkExpiryHours: z.number().int().positive().nullable().optional(),
  linkExpiryLabel: z.string().optional(),
  emailTemplateId: z.string().uuid().nullable().optional(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

    const data = parsed.data

    // Verify CSV exists (accept both MAPPED and PENDING — auto-mapping may not have run)
    const csvUpload = await prisma.csvUpload.findUnique({ where: { id: data.csvUploadId } })
    if (!csvUpload) return apiError('CSV upload not found', 404)
    if (!['MAPPED', 'PENDING'].includes(csvUpload.mappingStatus)) {
      return apiError(`CSV mapping status is "${csvUpload.mappingStatus}". Please complete file mapping first.`, 400)
    }

    // Get branding logo URL if selected
    let brandingLogoUrl: string | null = null
    if (data.brandingAssetId) {
      const asset = await prisma.brandingAsset.findUnique({ where: { id: data.brandingAssetId } })
      brandingLogoUrl = asset?.publicUrl ?? null
    }

    // Get all matched recipients (matched to a file)
    const recipients = await prisma.recipient.findMany({
      where: { csvUploadId: data.csvUploadId, matchedFileId: { not: null } },
    })

    if (recipients.length === 0) {
      // Check if there are ANY recipients
      const totalRecipients = await prisma.recipient.count({ where: { csvUploadId: data.csvUploadId } })
      if (totalRecipients === 0) return apiError('No recipients found in this CSV upload.', 400)
      return apiError(
        `No recipients have been matched to files yet. Please go back and complete the file mapping step (${totalRecipients} recipients need to be matched).`,
        400
      )
    }

    // Create share batch
    const batch = await prisma.shareBatch.create({
      data: {
        folderId: data.folderId,
        csvUploadId: data.csvUploadId,
        createdById: session.user.id,
        emailTemplateId: data.emailTemplateId ?? null,
        emailSubject: data.emailSubject,
        emailBodyHtml: data.emailBodyHtml,
        emailBodyText: data.emailBodyText,
        brandingAssetId: data.brandingAssetId ?? null,
        brandingLogoUrl,
        otpEnabled: data.otpEnabled,
        otpChannel: data.otpEnabled ? (data.otpChannel ?? 'EMAIL') : null,
        linkExpiryHours: data.linkExpiryHours ?? null,
        linkExpiryLabel: data.linkExpiryLabel ?? null,
        totalRecipients: recipients.length,
        status: 'PENDING',
      },
    })

    // Create share links for each recipient
    const expiresAt = computeExpiresAt(data.linkExpiryHours ?? null)
    const shareLinksData = recipients.map(r => ({
      shareBatchId: batch.id,
      recipientId: r.id,
      fileId: r.matchedFileId!,
      token: generateShareToken(),
      expiresAt,
    }))

    await prisma.shareLink.createMany({ data: shareLinksData })

    // Get created share link IDs
    const shareLinks = await prisma.shareLink.findMany({
      where: { shareBatchId: batch.id },
      select: { id: true },
    })

    // Try to enqueue via Redis/BullMQ — fall back gracefully if Redis is not running
    let queueMode: 'redis' | 'direct' | 'pending' = 'pending'

    try {
      const { enqueueShareEmails } = await import('@/lib/queue/client')
      await prisma.shareBatch.update({ where: { id: batch.id }, data: { status: 'PROCESSING', startedAt: new Date() } })
      await enqueueShareEmails(shareLinks.map(l => l.id), batch.id)
      queueMode = 'redis'
    } catch (redisErr: any) {
      console.warn('[share/batch] Redis not available, falling back to direct send:', redisErr.message)

      // Direct fallback — send emails synchronously (works for small batches)
      try {
        await prisma.shareBatch.update({ where: { id: batch.id }, data: { status: 'PROCESSING', startedAt: new Date() } })
        const { processShareEmailDirect } = await import('@/lib/queue/direct-processor')
        // Fire and forget — don't block the response
        processShareEmailDirect(shareLinks.map(l => l.id), batch.id).catch(e =>
          console.error('[direct-processor] Error:', e.message)
        )
        queueMode = 'direct'
      } catch (directErr: any) {
        console.error('[share/batch] Direct send also failed:', directErr.message)
        // Still return success — batch is created, user can retry sending
        await prisma.shareBatch.update({ where: { id: batch.id }, data: { status: 'PENDING' } })
      }
    }

    // Update CSV status
    await prisma.csvUpload.update({ where: { id: data.csvUploadId }, data: { mappingStatus: 'SHARED' } })

    // Audit log (best-effort)
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SHARE_BATCH_CREATED',
        entityType: 'share_batch',
        entityId: batch.id,
        newValues: JSON.parse(JSON.stringify({ totalRecipients: recipients.length, otpEnabled: data.otpEnabled, queueMode })),
      },
    }).catch(() => {})

    return apiSuccess({
      id: batch.id,
      totalRecipients: recipients.length,
      queueMode,
    }, 201)

  } catch (err: any) {
    console.error('[POST /api/share/batch]', err)
    return apiError(err.message ?? 'Failed to create share batch', 500)
  }
}

import { prisma } from '@/lib/db'
import { getPresignedDownloadUrl } from '@/lib/s3'
import { apiSuccess, apiError, getClientIp } from '@/lib/utils'

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  const shareLink = await prisma.shareLink.findUnique({
    where: { token: params.token },
    include: {
      file: { select: { storageKey: true, originalName: true } },
      shareBatch: { select: { otpEnabled: true } },
    },
  })

  if (!shareLink) return apiError('Invalid link', 404)
  if (shareLink.status === 'REVOKED') return apiError('Link revoked', 403)
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) return apiError('Link expired', 410)

  // If OTP enabled, must be verified
  if (shareLink.shareBatch.otpEnabled && !shareLink.otpVerifiedAt) {
    return apiError('OTP verification required', 403)
  }

  // Generate presigned URL (valid for 15 minutes)
  const url = await getPresignedDownloadUrl(
    shareLink.file.storageKey,
    15 * 60,
    shareLink.file.originalName
  )

  // Track access
  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
      firstAccessedAt: shareLink.firstAccessedAt ?? new Date(),
      lastAccessedIp: ip,
      lastUserAgent: ua,
      status: 'ACCESSED',
    },
  })

  await prisma.shareAccessLog.create({
    data: {
      shareLinkId: shareLink.id,
      eventType: 'FILE_DOWNLOADED',
      ipAddress: ip,
      userAgent: ua,
    },
  })

  return apiSuccess({ url, fileName: shareLink.file.originalName })
}

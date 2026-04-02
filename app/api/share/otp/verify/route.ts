import { prisma } from '@/lib/db'
import { verifyOtp, isOtpExpired, MAX_OTP_ATTEMPTS } from '@/lib/otp'
import { apiSuccess, apiError, getClientIp } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  token: z.string().min(1),
  otp: z.string().length(6),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400)

  const { token, otp } = parsed.data
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent') ?? ''

  const shareLink = await prisma.shareLink.findUnique({ where: { token } })

  if (!shareLink) return apiError('Invalid link', 404)
  if (shareLink.status === 'REVOKED') return apiError('This link has been revoked', 403)
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) return apiError('This link has expired', 410)
  if (shareLink.otpVerifiedAt) return apiSuccess({ alreadyVerified: true })
  if (shareLink.otpAttempts >= MAX_OTP_ATTEMPTS) return apiError('Too many OTP attempts. Contact the sender.', 429)
  if (!shareLink.otpCodeHash) return apiError('No OTP found for this link', 400)

  if (isOtpExpired(shareLink.otpSentAt, 10)) {
    return apiError('OTP has expired. Use the resend option to get a new one.', 410)
  }

  const isValid = await verifyOtp(otp, shareLink.otpCodeHash)

  if (!isValid) {
    await prisma.shareLink.update({
      where: { id: shareLink.id },
      data: { otpAttempts: { increment: 1 } },
    })
    await prisma.shareAccessLog.create({
      data: { shareLinkId: shareLink.id, eventType: 'OTP_FAILED', ipAddress: ip, userAgent: ua },
    })
    const remaining = MAX_OTP_ATTEMPTS - shareLink.otpAttempts - 1
    return apiError(`Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 400)
  }

  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: {
      otpVerifiedAt: new Date(),
      otpAttempts: { increment: 1 },
      status: 'ACCESSED',
      accessCount: { increment: 1 },
      firstAccessedAt: shareLink.firstAccessedAt ?? new Date(),
      lastAccessedAt: new Date(),
      lastAccessedIp: ip,
      lastUserAgent: ua,
    },
  })

  await prisma.shareAccessLog.create({
    data: { shareLinkId: shareLink.id, eventType: 'OTP_VERIFIED', ipAddress: ip, userAgent: ua },
  })

  return apiSuccess({ verified: true })
}

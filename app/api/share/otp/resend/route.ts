import { prisma } from '@/lib/db'
import { generateOtp, hashOtp } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { sendOtpSms } from '@/lib/sms'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({ token: z.string().min(1) })

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400)

  const shareLink = await prisma.shareLink.findUnique({
    where: { token: parsed.data.token },
    include: {
      recipient: { select: { name: true, email: true, phone: true } },
      shareBatch: {
        select: {
          otpEnabled: true, otpChannel: true,
          brandingLogoUrl: true, brandingAsset: { select: { publicUrl: true } },
        },
      },
    },
  })

  if (!shareLink) return apiError('Invalid link', 404)
  if (!shareLink.shareBatch.otpEnabled) return apiError('OTP not enabled for this link', 400)
  if (shareLink.otpVerifiedAt) return apiError('Already verified', 400)
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) return apiError('Link expired', 410)

  const newOtp = generateOtp()
  const otpHash = await hashOtp(newOtp)
  const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Docupile Share'
  const logoUrl = shareLink.shareBatch.brandingLogoUrl ?? shareLink.shareBatch.brandingAsset?.publicUrl ?? null

  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { otpCodeHash: otpHash, otpSentAt: new Date(), otpAttempts: 0 },
  })

  const channel = shareLink.shareBatch.otpChannel
  if (channel === 'PHONE' && shareLink.recipient.phone) {
    await sendOtpSms({ to: shareLink.recipient.phone, name: shareLink.recipient.name, otp: newOtp, appName: APP_NAME })
  } else {
    await sendOtpEmail({ to: shareLink.recipient.email, name: shareLink.recipient.name, otp: newOtp, logoUrl, appName: APP_NAME })
  }

  return apiSuccess({ sent: true })
}

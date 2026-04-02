import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getPresignedDownloadUrl } from '@/lib/s3'
import { ShareAccessClient } from '@/components/share/share-access-client'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Access Secure Document' }

export default async function ShareLinkPage({ params }: { params: { token: string } }) {
  const headersList = headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const ua = headersList.get('user-agent') ?? ''

  const shareLink = await prisma.shareLink.findUnique({
    where: { token: params.token },
    include: {
      recipient: { select: { name: true, email: true } },
      file: { select: { originalName: true, storageKey: true } },
      shareBatch: {
        select: {
          otpEnabled: true,
          otpChannel: true,
          brandingLogoUrl: true,
          brandingAsset: { select: { publicUrl: true } },
          emailSubject: true,
          folder: { select: { name: true } },
        },
      },
    },
  })

  if (!shareLink) notFound()

  // Check expiry
  const isExpired = shareLink.expiresAt ? shareLink.expiresAt < new Date() : false

  if (isExpired && shareLink.status !== 'REVOKED') {
    await prisma.shareLink.update({ where: { id: shareLink.id }, data: { status: 'EXPIRED' } })
  }

  const logoUrl = shareLink.shareBatch.brandingLogoUrl ?? shareLink.shareBatch.brandingAsset?.publicUrl ?? null
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Docupile Share'

  // Log access
  await prisma.shareAccessLog.create({
    data: {
      shareLinkId: shareLink.id,
      eventType: 'LINK_OPENED',
      ipAddress: ip,
      userAgent: ua,
    },
  })

  return (
    <ShareAccessClient
      token={params.token}
      recipientName={shareLink.recipient.name}
      fileName={shareLink.file.originalName}
      folderName={shareLink.shareBatch.folder.name}
      logoUrl={logoUrl}
      appName={appName}
      otpEnabled={shareLink.shareBatch.otpEnabled}
      otpChannel={shareLink.shareBatch.otpChannel ?? 'EMAIL'}
      otpVerifiedAt={shareLink.otpVerifiedAt?.toISOString() ?? null}
      isExpired={isExpired}
      isRevoked={shareLink.status === 'REVOKED'}
      linkId={shareLink.id}
    />
  )
}

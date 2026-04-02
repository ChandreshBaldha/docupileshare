import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildShareLogExcel, ShareLogRow } from '@/lib/excel'
import { apiError } from '@/lib/utils'
import { format } from 'date-fns'

export async function GET(_: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const batch = await prisma.shareBatch.findUnique({
    where: { id: params.batchId },
    include: {
      folder: { select: { name: true } },
      createdBy: { select: { name: true } },
      shareLinks: {
        include: {
          recipient: { select: { name: true, email: true, phone: true } },
          file: { select: { originalName: true } },
        },
      },
    },
  })

  if (!batch) return apiError('Not found', 404)

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const rows: ShareLogRow[] = batch.shareLinks.map(sl => {
    const now = new Date()
    const expiresAt = sl.expiresAt
    let expiryStatus = 'Never'
    if (expiresAt) {
      expiryStatus = expiresAt < now ? 'Expired' : 'Active'
    }

    return {
      recipientName: sl.recipient.name,
      recipientEmail: sl.recipient.email,
      recipientPhone: sl.recipient.phone,
      fileName: sl.file.originalName,
      shareUrl: `${APP_URL}/share/${sl.token}`,
      linkStatus: sl.status,
      emailSent: sl.emailSent,
      emailSentAt: sl.emailSentAt,
      emailError: sl.emailError,
      otpEnabled: batch.otpEnabled,
      otpChannel: batch.otpChannel,
      otpVerifiedAt: sl.otpVerifiedAt,
      expiresAt: sl.expiresAt,
      expiryStatus,
      accessCount: sl.accessCount,
      firstAccessedAt: sl.firstAccessedAt,
      lastAccessedAt: sl.lastAccessedAt,
      sharedAt: sl.createdAt,
      sentBy: batch.createdBy.name,
    }
  })

  const buffer = await buildShareLogExcel(rows, batch.folder.name)

  // Log export
  await prisma.shareExportLog.create({
    data: {
      shareBatchId: params.batchId,
      exportedById: session.user.id,
      fileName: `share-log-${batch.folder.name}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`,
      rowCount: rows.length,
    },
  })

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="share-log-${batch.folder.name.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
    },
  })
}

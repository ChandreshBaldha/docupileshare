import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { matchRecipientsToFiles, MIN_MATCH_SCORE } from '@/lib/matching'
import { apiSuccess, apiError } from '@/lib/utils'

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const csvUpload = await prisma.csvUpload.findUnique({
    where: { id: params.id },
    include: {
      recipients: { select: { id: true, name: true, normalizedName: true } },
      folder: {
        include: {
          files: {
            where: { isDeleted: false },
            select: { id: true, originalName: true, normalizedName: true },
          },
        },
      },
    },
  })

  if (!csvUpload) return apiError('CSV upload not found', 404)

  const matches = matchRecipientsToFiles(csvUpload.recipients, csvUpload.folder.files)

  // Update recipients in DB
  await Promise.all(
    matches.map(m => {
      const isGoodMatch = m.score >= MIN_MATCH_SCORE && m.fileId
      return prisma.recipient.update({
        where: { id: m.recipientId },
        data: {
          matchedFileId: isGoodMatch ? m.fileId : null,
          matchScore: m.score,
          matchStatus: isGoodMatch ? 'MATCHED' : 'UNMATCHED',
        },
      })
    })
  )

  // Return updated recipients
  const updated = await prisma.recipient.findMany({
    where: { csvUploadId: params.id },
    include: { matchedFile: { select: { originalName: true } } },
  })

  return apiSuccess(updated.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    matchedFileId: r.matchedFileId,
    matchedFileName: r.matchedFile?.originalName ?? null,
    matchScore: r.matchScore ? Number(r.matchScore) : null,
    matchStatus: r.matchStatus,
  })))
}

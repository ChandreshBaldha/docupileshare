import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const url = new URL(req.url)
  const countOnly = url.searchParams.get('countOnly') === 'true'

  if (countOnly) {
    const count = await prisma.recipient.count({ where: { csvUploadId: params.id } })
    return apiSuccess({ count })
  }

  const recipients = await prisma.recipient.findMany({
    where: { csvUploadId: params.id },
    orderBy: { name: 'asc' },
    include: { matchedFile: { select: { id: true, originalName: true } } },
  })

  const mapped = recipients.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    extraData: r.extraData,
    matchedFileId: r.matchedFileId,
    matchedFileName: r.matchedFile?.originalName ?? null,
    matchScore: r.matchScore ? Number(r.matchScore) : null,
    matchStatus: r.matchStatus,
  }))

  return apiSuccess(mapped)
}

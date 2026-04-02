import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const files = await prisma.file.findMany({
    where: { folderId: params.id, isDeleted: false },
    orderBy: { originalName: 'asc' },
    select: { id: true, originalName: true, normalizedName: true, sizeBytes: true, uploadedAt: true },
  })
  return apiSuccess(files)
}

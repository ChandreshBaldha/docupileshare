import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  const folders = await prisma.folder.findMany({
    where: isAdmin
      ? { isArchived: true }
      : { createdById: session.user.id, isArchived: true },
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { csvUploads: true, shareBatches: true } },
    },
  })
  return apiSuccess(folders)
}

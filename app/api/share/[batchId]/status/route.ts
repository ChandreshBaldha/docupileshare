import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(_: Request, { params }: { params: { batchId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const batch = await prisma.shareBatch.findUnique({
    where: { id: params.batchId },
    select: { status: true, sentCount: true, failedCount: true, totalRecipients: true, accessedCount: true, completedAt: true },
  })

  if (!batch) return apiError('Not found', 404)
  return apiSuccess(batch)
}

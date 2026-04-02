import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const assets = await prisma.brandingAsset.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, publicUrl: true, fileType: true, createdAt: true },
  })
  return apiSuccess(assets)
}

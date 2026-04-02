import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) return apiError('Forbidden', 403)

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400)

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  return apiSuccess(user)
}

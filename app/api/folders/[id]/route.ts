import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const folder = await prisma.folder.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { name: true } } },
  })
  if (!folder) return apiError('Not found', 404)
  return apiSuccess(folder)
}

const updateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
  isArchived: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

  const folder = await prisma.folder.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return apiSuccess(folder)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const folder = await prisma.folder.findUnique({ where: { id: params.id } })
  if (!folder) return apiError('Folder not found', 404)

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  const isOwner = folder.createdById === session.user.id

  if (!isAdmin && !isOwner) return apiError('You do not have permission to delete this folder', 403)

  await prisma.folder.update({ where: { id: params.id }, data: { isArchived: true } })
  return apiSuccess({ deleted: true })
}

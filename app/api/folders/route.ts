import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  const folders = await prisma.folder.findMany({
    where: isAdmin ? { isArchived: false } : { createdById: session.user.id, isArchived: false },
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { csvUploads: true, shareBatches: true } },
    },
  })
  return apiSuccess(folders)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

    const folder = await prisma.folder.create({
      data: { name: parsed.data.name, description: parsed.data.description, createdById: session.user.id },
    })

    // Audit log is best-effort — never block the response
    prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FOLDER_CREATED',
        entityType: 'folder',
        entityId: folder.id,
        newValues: JSON.parse(JSON.stringify({ name: folder.name })),
      },
    }).catch(() => {})

    return apiSuccess(folder, 201)
  } catch (err: any) {
    console.error('[POST /api/folders]', err)
    return apiError(err.message ?? 'Internal server error', 500)
  }
}

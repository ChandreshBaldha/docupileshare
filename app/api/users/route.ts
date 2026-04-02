import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(320),
  password: z.string().min(8).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER']).default('MANAGER'),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) return apiError('Forbidden', 403)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
  if (exists) return apiError('Email already in use', 409)

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
  })

  return apiSuccess(user, 201)
}

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  isDefault: z.boolean().default(false),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, subject: true, bodyHtml: true, variablesUsed: true, isDefault: true, createdAt: true },
  })
  return apiSuccess(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

  // Extract variables used
  const variablesUsed = [...new Set([...(parsed.data.bodyHtml + parsed.data.subject).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]

  const template = await prisma.emailTemplate.create({
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      bodyText: parsed.data.bodyText,
      variablesUsed,
      isDefault: parsed.data.isDefault,
      createdById: session.user.id,
    },
  })
  return apiSuccess(template, 201)
}

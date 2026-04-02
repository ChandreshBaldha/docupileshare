import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  manualOverrides: z.array(z.object({
    recipientId: z.string().uuid(),
    fileId: z.string().uuid(),
  })).default([]),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400)

  const { manualOverrides } = parsed.data

  // Apply manual overrides
  if (manualOverrides.length > 0) {
    await Promise.all(
      manualOverrides.map(o =>
        prisma.recipient.update({
          where: { id: o.recipientId },
          data: { matchedFileId: o.fileId, matchStatus: 'MANUAL', matchScore: 100 },
        })
      )
    )
  }

  // Verify all recipients have matches
  const unmatched = await prisma.recipient.count({
    where: { csvUploadId: params.id, matchedFileId: null },
  })

  if (unmatched > 0) {
    return apiError(`${unmatched} recipients still have no assigned file. Please assign all files.`, 400)
  }

  // Mark CSV as mapped
  await prisma.csvUpload.update({
    where: { id: params.id },
    data: { mappingStatus: 'MAPPED' },
  })

  return apiSuccess({ mapped: true })
}

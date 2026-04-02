import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { S3_BUCKET } from '@/lib/s3'
import { S3_CONFIGURED } from '@/lib/storage'
import { normalizeName } from '@/lib/matching'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  folderId: z.string().uuid(),
  fileName: z.string().min(1),
  storageKey: z.string().min(1),
  sizeBytes: z.number(),
  contentType: z.string().default('application/pdf'),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

  const { folderId, fileName, storageKey, sizeBytes, contentType } = parsed.data

  try {
    const file = await prisma.file.upsert({
      where: { folderId_originalName: { folderId, originalName: fileName } },
      create: {
        folderId,
        originalName: fileName,
        normalizedName: normalizeName(fileName),
        storageKey,
        storageBucket: S3_CONFIGURED ? S3_BUCKET : 'local',
        mimeType: contentType,
        sizeBytes,
        uploadedById: session.user.id,
      },
      update: {
        storageKey,
        sizeBytes,
        normalizedName: normalizeName(fileName),
        isDeleted: false,
      },
    })
    return apiSuccess(file, 201)
  } catch (err: any) {
    return apiError('Failed to record file: ' + err.message, 500)
  }
}

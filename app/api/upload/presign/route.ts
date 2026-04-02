import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildStorageKey, getPresignedUploadUrl, S3_BUCKET } from '@/lib/s3'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'
import { S3_CONFIGURED } from '@/lib/storage'

const schema = z.object({
  folderId: z.string().uuid(),
  fileName: z.string().min(1).max(500),
  contentType: z.string().default('application/pdf'),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten())

  const { folderId, fileName, contentType } = parsed.data
  const storageKey = buildStorageKey(`folders/${folderId}/files`, fileName)

  // If S3 is not configured → tell the client to use the local upload endpoint
  if (!S3_CONFIGURED) {
    return apiSuccess({
      mode: 'local',
      storageKey,
      bucket: 'local',
      uploadUrl: null,
    })
  }

  try {
    const uploadUrl = await getPresignedUploadUrl(storageKey, contentType)
    return apiSuccess({ mode: 's3', uploadUrl, storageKey, bucket: S3_BUCKET })
  } catch (err: any) {
    console.error('[presign]', err)
    return apiError('Could not generate upload URL: ' + err.message, 500)
  }
}

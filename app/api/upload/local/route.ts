/**
 * Local filesystem upload endpoint.
 * Used automatically when S3 / MinIO is not configured.
 * Files are stored in  public/uploads/files/<storageKey>  and served as static assets.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const storageKey = formData.get('storageKey') as string | null

    if (!file) return apiError('No file provided', 400)
    if (!storageKey) return apiError('storageKey is required', 400)

    const buffer = Buffer.from(await file.arrayBuffer())

    // Save under public/uploads/files/<storageKey>
    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'files', storageKey)
    await mkdir(path.dirname(fullPath), { recursive: true })
    await writeFile(fullPath, buffer)

    const publicUrl = `/uploads/files/${storageKey}`
    return apiSuccess({ publicUrl, storageKey, size: buffer.length })
  } catch (err: any) {
    console.error('[POST /api/upload/local]', err)
    return apiError(err.message ?? 'Upload failed', 500)
  }
}

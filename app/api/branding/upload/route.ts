import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStorageKey, uploadToS3, getPublicUrl, S3_BUCKET } from '@/lib/s3'
import { apiSuccess, apiError } from '@/lib/utils'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { S3_CONFIGURED } from '@/lib/storage'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null

    if (!file) return apiError('No file provided', 400)

    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return apiError('Only image files allowed (PNG, JPG, SVG, WebP)', 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError('File size must be under 5MB', 400)
    }

    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
    const safeFilename = `logo_${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    let publicUrl: string
    let storageKey: string
    let storageBucket: string

    if (S3_CONFIGURED) {
      // ── Use S3 / MinIO ──────────────────────────────────────
      storageKey = buildStorageKey('branding', safeFilename)
      await uploadToS3({ key: storageKey, body: buffer, contentType: file.type })
      publicUrl = getPublicUrl(storageKey)
      storageBucket = S3_BUCKET
    } else {
      // ── Local filesystem fallback ───────────────────────────
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'branding')
      await mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, safeFilename)
      await writeFile(filePath, buffer)
      storageKey = `uploads/branding/${safeFilename}`
      publicUrl = `/uploads/branding/${safeFilename}`
      storageBucket = 'local'
    }

    const asset = await prisma.brandingAsset.create({
      data: {
        name: name ?? file.name,
        storageKey,
        storageBucket,
        publicUrl,
        fileType: ext,
        sizeBytes: file.size,
        uploadedById: session.user.id,
      },
    })

    return apiSuccess(asset, 201)
  } catch (err: any) {
    console.error('[POST /api/branding/upload]', err)
    return apiError(err.message ?? 'Upload failed', 500)
  }
}

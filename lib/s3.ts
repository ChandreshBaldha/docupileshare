import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Config: any = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}

if (process.env.AWS_S3_ENDPOINT) {
  s3Config.endpoint = process.env.AWS_S3_ENDPOINT
  s3Config.forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true'
}

export const s3 = new S3Client(s3Config)
export const S3_BUCKET = process.env.AWS_S3_BUCKET!

// ─── Generate unique S3 key ───────────────────────────────────

export function buildStorageKey(prefix: string, filename: string): string {
  const ts = Date.now()
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${prefix}/${ts}_${safe}`
}

// ─── Upload a buffer or stream to S3 ─────────────────────────

export async function uploadToS3(params: {
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
  metadata?: Record<string, string>
}) {
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    Metadata: params.metadata,
  })
  await s3.send(cmd)
  return { key: params.key, bucket: S3_BUCKET }
}

// ─── Generate a pre-signed download URL ──────────────────────

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
  filename?: string
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ...(filename
      ? { ResponseContentDisposition: `inline; filename="${filename}"` }
      : {}),
  })
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds })
}

// ─── Generate a pre-signed upload URL (direct browser upload) ─

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds })
}

// ─── Delete an object from S3 ────────────────────────────────

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

// ─── Check if object exists ───────────────────────────────────

export async function s3ObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// ─── Build a public CDN URL (if bucket is public) ────────────

export function getPublicUrl(key: string): string {
  if (process.env.AWS_S3_ENDPOINT) {
    return `${process.env.AWS_S3_ENDPOINT}/${S3_BUCKET}/${key}`
  }
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}

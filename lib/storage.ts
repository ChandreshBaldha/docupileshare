/**
 * Central helper to determine whether real S3/MinIO credentials are configured.
 * Returns false if keys are missing, empty, or still set to placeholder values.
 */

const PLACEHOLDER_PATTERNS = ['your-', 'xxx', 'example', 'changeme', 'dummy']

function isPlaceholder(value: string | undefined): boolean {
  if (!value || value.trim() === '') return true
  const lower = value.toLowerCase()
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p))
}

export const S3_CONFIGURED =
  !isPlaceholder(process.env.AWS_ACCESS_KEY_ID) &&
  !isPlaceholder(process.env.AWS_SECRET_ACCESS_KEY) &&
  !isPlaceholder(process.env.AWS_S3_BUCKET)

// ─────────────────────────────────────────────
// Shared TypeScript types across the application
// ─────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'VIEWER'
export type OtpChannel = 'EMAIL' | 'PHONE'
export type ShareBatchStatus = 'DRAFT' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED'
export type ShareLinkStatus = 'ACTIVE' | 'ACCESSED' | 'EXPIRED' | 'REVOKED'
export type FileMatchStatus = 'MATCHED' | 'UNMATCHED' | 'MANUAL' | 'SKIPPED'

// ─── API Response wrapper ─────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ─── Folder types ─────────────────────────────────────────────

export interface FolderSummary {
  id: string
  name: string
  description: string | null
  fileCount: number
  totalSizeBytes: bigint
  isArchived: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  csvUploadCount: number
  shareBatchCount: number
  lastSharedAt: string | null
}

// ─── File types ───────────────────────────────────────────────

export interface FileRecord {
  id: string
  originalName: string
  normalizedName: string
  mimeType: string
  sizeBytes: bigint
  uploadedAt: string
  uploadedBy: string
}

// ─── CSV / Recipient types ────────────────────────────────────

export interface RecipientRow {
  id: string
  name: string
  email: string
  phone: string | null
  extraData: Record<string, unknown> | null
  matchedFileId: string | null
  matchedFileName: string | null
  matchScore: number | null
  matchStatus: FileMatchStatus
}

// ─── Share batch types ────────────────────────────────────────

export interface ShareBatchConfig {
  folderId: string
  csvUploadId: string
  emailSubject: string
  emailBodyHtml: string
  emailBodyText?: string
  brandingAssetId?: string | null
  otpEnabled: boolean
  otpChannel?: OtpChannel | null
  linkExpiryHours?: number | null
  linkExpiryLabel?: string | null
  emailTemplateId?: string | null
}

export interface ShareBatchSummary {
  id: string
  folderName: string
  csvFileName: string
  status: ShareBatchStatus
  totalRecipients: number
  sentCount: number
  failedCount: number
  accessedCount: number
  otpEnabled: boolean
  otpChannel: OtpChannel | null
  linkExpiryLabel: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  sentBy: string
}

// ─── Share link types ─────────────────────────────────────────

export interface ShareLinkDetail {
  id: string
  token: string
  status: ShareLinkStatus
  recipientName: string
  recipientEmail: string
  recipientPhone: string | null
  fileName: string
  expiresAt: string | null
  accessCount: number
  emailSent: boolean
  emailSentAt: string | null
  emailError: string | null
  otpVerifiedAt: string | null
}

// ─── Email template types ─────────────────────────────────────

export interface EmailTemplateData {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyText?: string
  variablesUsed: string[]
  isDefault: boolean
  createdAt: string
}

// ─── Upload progress ──────────────────────────────────────────

export interface UploadProgress {
  fileName: string
  progress: number   // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

// ─── Template variables ───────────────────────────────────────

export const TEMPLATE_VARIABLES = [
  { key: 'name', label: 'Recipient Name', example: 'John Doe' },
  { key: 'email', label: 'Recipient Email', example: 'john@example.com' },
  { key: 'fileName', label: 'File Name', example: 'Certificate_John_Doe.pdf' },
  { key: 'shareLink', label: 'Share Link', example: 'https://app.com/share/abc123' },
  { key: 'expiryDate', label: 'Expiry Date', example: '31 Dec 2024, 23:59' },
  { key: 'appName', label: 'App Name', example: 'Docupile Share' },
]

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { nanoid } from 'nanoid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Generate secure share token ─────────────────────────────

export function generateShareToken(): string {
  return nanoid(48)
}

// ─── Format bytes to human-readable ──────────────────────────

export function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// ─── Date formatters ──────────────────────────────────────────

export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function formatRelative(date: Date | string | null): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

// ─── Compute link expiry from hours ──────────────────────────

export function computeExpiresAt(linkExpiryHours: number | null): Date | null {
  if (!linkExpiryHours) return null
  const d = new Date()
  d.setHours(d.getHours() + linkExpiryHours)
  return d
}

// ─── Expiry presets ───────────────────────────────────────────

export const EXPIRY_PRESETS = [
  { label: '1 Hour', hours: 1 },
  { label: '6 Hours', hours: 6 },
  { label: '12 Hours', hours: 12 },
  { label: '1 Day', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '1 Week', hours: 168 },
  { label: '2 Weeks', hours: 336 },
  { label: '1 Month', hours: 720 },
  { label: 'Never', hours: 0 },
]

// ─── Pagination helpers ───────────────────────────────────────

export function getPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit)
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

// ─── BigInt-safe JSON serialiser ─────────────────────────────
// PostgreSQL BIGINT fields come back as BigInt from Prisma.
// JSON.stringify can't handle BigInt — convert to Number safely.

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value)
  return value
}

function safeSerialize(obj: unknown): string {
  return JSON.stringify(obj, bigIntReplacer)
}

// ─── API response helpers ─────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200) {
  return new Response(safeSerialize({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function apiError(message: string, status = 400, details?: unknown) {
  return new Response(safeSerialize({ success: false, error: message, details }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Get request IP ──────────────────────────────────────────

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ─── Truncate text ────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength)}...` : str
}

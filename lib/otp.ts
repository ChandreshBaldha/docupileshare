import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// ─── Generate a 6-digit numeric OTP ──────────────────────────

export function generateOtp(): string {
  const digits = crypto.randomInt(0, 1_000_000)
  return String(digits).padStart(6, '0')
}

// ─── Hash OTP with bcrypt ─────────────────────────────────────

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

// ─── Verify OTP against stored hash ──────────────────────────

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}

// ─── Check if OTP is still valid (within expiry window) ──────

export function isOtpExpired(sentAt: Date | null, expiryMinutes = 10): boolean {
  if (!sentAt) return true
  const expiryMs = expiryMinutes * 60 * 1000
  return Date.now() - sentAt.getTime() > expiryMs
}

// ─── Max OTP attempts ─────────────────────────────────────────

export const MAX_OTP_ATTEMPTS = 5

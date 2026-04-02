/**
 * Persistent app settings stored in data/smtp-settings.json
 * Survives server restarts without requiring .env changes.
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'smtp-settings.json')

export interface SmtpSettings {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

const DEFAULTS: SmtpSettings = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  fromEmail: '',
  fromName: 'Docupile Share',
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  // Environment variables always take priority (works on Railway, Docker, etc.)
  const fromEnv: Partial<SmtpSettings> = {
    host:      process.env.SMTP_HOST      || undefined,
    port:      process.env.SMTP_PORT      ? Number(process.env.SMTP_PORT) : undefined,
    secure:    process.env.SMTP_SECURE    ? process.env.SMTP_SECURE === 'true' : undefined,
    user:      process.env.SMTP_USER      || undefined,
    pass:      process.env.SMTP_PASS      || undefined,
    fromEmail: process.env.EMAIL_FROM     || undefined,
    fromName:  process.env.EMAIL_FROM_NAME || undefined,
  }
  // Remove undefined keys so they don't override file values
  Object.keys(fromEnv).forEach(k => fromEnv[k as keyof SmtpSettings] === undefined && delete fromEnv[k as keyof SmtpSettings])

  // Then layer on top: file-saved settings (from Settings UI)
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8')
    const fromFile = JSON.parse(raw)
    return { ...DEFAULTS, ...fromEnv, ...fromFile }
  } catch {
    return { ...DEFAULTS, ...fromEnv }
  }
}

export async function saveSmtpSettings(settings: Partial<SmtpSettings>): Promise<SmtpSettings> {
  const current = await getSmtpSettings()
  const updated = { ...current, ...settings }
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  // Reset cached transporter so next email uses new settings
  resetSmtpCache()
  return updated
}

// Called by email.ts to reset cached transport when settings change
let _resetCallback: (() => void) | null = null
export function onSmtpReset(cb: () => void) { _resetCallback = cb }
export function resetSmtpCache() { _resetCallback?.() }

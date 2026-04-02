import nodemailer from 'nodemailer'
import { getSmtpSettings, onSmtpReset } from '@/lib/app-settings'

// ─── Types ────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
  replyTo?: string
}

// ─── Nodemailer transport (lazy, reset-able) ──────────────────

let smtpTransport: any = null

onSmtpReset(() => {
  smtpTransport = null
  console.log('[email] SMTP transport reset — will reconnect on next send')
})

async function getSMTP() {
  if (!smtpTransport) {
    const s = await getSmtpSettings()

    // Fallback to .env values if saved settings are empty
    const host = s.host || process.env.SMTP_HOST || ''
    const port = s.port || Number(process.env.SMTP_PORT || 587)
    const user = s.user || process.env.SMTP_USER || ''
    const pass = s.pass || process.env.SMTP_PASS || ''

    // Port 465 → direct SSL  |  Port 587 / 25 → STARTTLS (secure must be FALSE)
    // Forcing secure=true on port 587 causes "wrong version number" SSL error
    const secure = port === 465

    smtpTransport = nodemailer.createTransport({
      host,
      port,
      secure,                      // true only for port 465
      requireTLS: port === 587,    // force STARTTLS upgrade on port 587
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        // Allow self-signed certs in dev; set to true in strict production
        rejectUnauthorized: false,
      },
    })
  }
  return smtpTransport
}

// ─── Main send function ───────────────────────────────────────

export async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const s = await getSmtpSettings()
    const fromEmail = params.from
      ?? s.fromEmail
      ?? process.env.EMAIL_FROM
      ?? ''

    const from = params.fromName
      ? `"${params.fromName}" <${fromEmail}>`
      : fromEmail

    const transport = await getSMTP()
    const info = await transport.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    })
    return { success: true, id: info.messageId }
  } catch (err: any) {
    console.error('[sendEmail]', err?.message)
    return { success: false, error: err?.message ?? 'Unknown email error' }
  }
}

// ─── Render template with {{variable}} substitution ──────────

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

// ─── Build full branded HTML email ───────────────────────────

export function buildEmailHtml(params: {
  logoUrl?: string | null
  bodyHtml: string
  appName?: string
}): string {
  const appName = params.appName ?? 'Docupile Share'
  const logo = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="${appName}" style="max-height:60px;max-width:200px;object-fit:contain;" />`
    : `<span style="font-size:22px;font-weight:700;color:#1e40af;">${appName}</span>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
          <tr>
            <td style="background:#1e40af;padding:24px 32px;text-align:center;">${logo}</td>
          </tr>
          <tr>
            <td style="padding:36px 32px;color:#111827;font-size:15px;line-height:1.7;">${params.bodyHtml}</td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Automated email from ${appName}.<br/>If you did not expect this, please ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── OTP email ────────────────────────────────────────────────

export async function sendOtpEmail(params: {
  to: string
  name: string
  otp: string
  logoUrl?: string | null
  appName?: string
}) {
  const bodyHtml = `
    <p>Hello <strong>${params.name}</strong>,</p>
    <p>Use the OTP below to access your secure document:</p>
    <div style="text-align:center;margin:30px 0;">
      <span style="display:inline-block;background:#1e40af;color:#fff;font-size:32px;font-weight:700;
                   letter-spacing:8px;padding:16px 32px;border-radius:8px;">${params.otp}</span>
    </div>
    <p style="color:#6b7280;font-size:13px;">Valid for <strong>10 minutes</strong>. Do not share this code.</p>
  `
  return sendEmail({
    to: params.to,
    subject: 'Your OTP for Secure Document Access',
    html: buildEmailHtml({ logoUrl: params.logoUrl, bodyHtml, appName: params.appName }),
    text: `Hello ${params.name}, your OTP is: ${params.otp}. Valid for 10 minutes.`,
  })
}

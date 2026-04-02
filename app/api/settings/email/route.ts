import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSmtpSettings, saveSmtpSettings } from '@/lib/app-settings'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  host:      z.string().min(1, 'SMTP host is required'),
  port:      z.number().int().min(1).max(65535).default(587),
  secure:    z.boolean().default(false),
  user:      z.string().min(1, 'Username is required'),
  pass:      z.string().min(1, 'Password is required'),
  fromEmail: z.string().email('Must be a valid email address'),
  fromName:  z.string().default('Docupile Share'),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const settings = await getSmtpSettings()
  // Never expose the password in GET response
  return apiSuccess({
    host:      settings.host,
    port:      settings.port,
    secure:    settings.secure,
    user:      settings.user,
    pass:      settings.pass ? '••••••••' : '',   // masked
    fromEmail: settings.fromEmail,
    fromName:  settings.fromName,
    configured: !!(settings.host && settings.user && settings.pass),
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return apiError('Only admins can update SMTP settings', 403)
  }

  const body = await req.json()

  // If pass is masked (user didn't change it), keep existing password
  if (body.pass === '••••••••') {
    const current = await getSmtpSettings()
    body.pass = current.pass
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('Validation error: ' + JSON.stringify(parsed.error.flatten().fieldErrors), 400)

  const saved = await saveSmtpSettings(parsed.data)
  return apiSuccess({
    ...saved,
    pass: saved.pass ? '••••••••' : '',
    configured: !!(saved.host && saved.user && saved.pass),
  })
}

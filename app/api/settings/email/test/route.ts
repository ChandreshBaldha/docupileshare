import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { apiSuccess, apiError } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { to } = await req.json()
  if (!to) return apiError('Recipient email is required', 400)

  const result = await sendEmail({
    to,
    subject: 'Test Email from Docupile Share',
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;">
        <h2 style="color:#1a1a1a;">✅ Email Configuration Working!</h2>
        <p style="color:#555;">This is a test email from <strong>Docupile Share</strong>.</p>
        <p style="color:#555;">Your email settings are configured correctly.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#999;font-size:12px;">Sent by ${session.user.email}</p>
      </div>
    `,
    text: 'Test email from Docupile Share. Your email configuration is working correctly.',
    fromName: process.env.NEXT_PUBLIC_APP_NAME || 'Docupile Share',
  })

  if (!result.success) return apiError(result.error || 'Failed to send test email', 500)
  return apiSuccess({ message: 'Test email sent successfully' })
}

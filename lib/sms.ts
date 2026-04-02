import twilio from 'twilio'

let twilioClient: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return twilioClient
}

export async function sendSms(params: {
  to: string
  body: string
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const msg = await getClient().messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: params.to,
      body: params.body,
    })
    return { success: true, sid: msg.sid }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'SMS send failed' }
  }
}

export async function sendOtpSms(params: {
  to: string
  name: string
  otp: string
  appName?: string
}) {
  const body = `${params.appName ?? 'Docupile Share'}: Hello ${params.name}, your OTP for secure document access is ${params.otp}. Valid for 10 minutes. Do not share this code.`
  return sendSms({ to: params.to, body })
}

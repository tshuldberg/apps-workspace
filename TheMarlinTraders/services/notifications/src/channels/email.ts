export interface EmailNotification {
  to: string
  subject: string
  body: string
}

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = process.env.FROM_EMAIL ?? 'alerts@marlintraders.com'

/**
 * Sends an email notification via the Resend API.
 * Falls back to logging when the API key is not configured.
 */
export async function sendEmailNotification(notification: EmailNotification): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[email] (dry-run) To: ${notification.to} | Subject: ${notification.subject}`)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: notification.to,
      subject: notification.subject,
      html: notification.body,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[email] Failed to send: ${response.status} ${text}`)
  }
}

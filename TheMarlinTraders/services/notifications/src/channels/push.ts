export interface PushNotification {
  expoPushTokens: string[]
  title: string
  body: string
  data?: Record<string, unknown>
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/**
 * Sends push notifications via the Expo Push API.
 * Batches multiple tokens into a single request.
 */
export async function sendPushNotification(notification: PushNotification): Promise<void> {
  if (notification.expoPushTokens.length === 0) {
    return
  }

  const messages = notification.expoPushTokens.map((token) => ({
    to: token,
    sound: 'default' as const,
    title: notification.title,
    body: notification.body,
    data: notification.data,
  }))

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[push] Expo push failed: ${response.status} ${text}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[push] Expo push error: ${message}`)
  }
}

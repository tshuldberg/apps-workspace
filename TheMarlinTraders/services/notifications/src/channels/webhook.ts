export interface WebhookPayload {
  alertId: string
  symbol: string
  conditionType: string
  threshold: string
  priceAtTrigger: string
  message: string
  triggeredAt: string
}

/**
 * Delivers an alert notification via HTTP POST to the configured webhook URL.
 * Includes a 10-second timeout to prevent hanging on unresponsive endpoints.
 */
export async function sendWebhookNotification(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[webhook] POST ${url} returned ${response.status}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[webhook] POST ${url} failed: ${message}`)
  } finally {
    clearTimeout(timeout)
  }
}

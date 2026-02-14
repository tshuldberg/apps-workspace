export interface InAppNotification {
  userId: string
  alertId: string
  symbol: string
  message: string
  triggeredAt: string
}

/**
 * Delivers an in-app notification by publishing to a Redis channel
 * that the WebSocket gateway subscribes to, which then pushes to
 * connected clients for the target user.
 */
export async function sendInAppNotification(
  redis: { publish: (channel: string, message: string) => Promise<number> },
  notification: InAppNotification,
): Promise<void> {
  const payload = JSON.stringify({
    type: 'alert_triggered',
    userId: notification.userId,
    alertId: notification.alertId,
    symbol: notification.symbol,
    message: notification.message,
    triggeredAt: notification.triggeredAt,
  })

  await redis.publish(`user:${notification.userId}:notifications`, payload)
}

import { z } from 'zod'
import Redis from 'ioredis'
import type WebSocket from 'ws'
import type { ConnectionRegistry, ClientConnection } from './connection-registry.js'

const SubscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  channels: z.array(z.string().regex(/^(bars|quotes):[A-Z]+/)),
})

const UnsubscribeMessageSchema = z.object({
  type: z.literal('unsubscribe'),
  channels: z.array(z.string().regex(/^(bars|quotes):[A-Z]+/)),
})

const ClientMessageSchema = z.discriminatedUnion('type', [
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  z.object({ type: z.literal('ping') }),
])

export type ClientMessage = z.infer<typeof ClientMessageSchema>

export class SubscriptionManager {
  private redisSub: Redis
  private subscribedChannels = new Set<string>()

  constructor(
    redisUrl: string,
    private readonly registry: ConnectionRegistry,
  ) {
    this.redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }

  async start(): Promise<void> {
    await this.redisSub.connect()

    this.redisSub.on('message', (channel: string, message: string) => {
      const subscribers = this.registry.getSubscribers(channel)
      for (const conn of subscribers) {
        if (conn.ws.readyState === 1) {
          conn.ws.send(JSON.stringify({ type: 'data', channel, payload: JSON.parse(message) }))
        }
      }
    })
  }

  handleMessage(ws: WebSocket, raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
      return
    }

    const result = ClientMessageSchema.safeParse(parsed)
    if (!result.success) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
      return
    }

    const msg = result.data
    const conn = this.registry.get(ws)
    if (!conn) return

    switch (msg.type) {
      case 'subscribe':
        this.subscribe(conn, msg.channels)
        break
      case 'unsubscribe':
        this.unsubscribe(conn, msg.channels)
        break
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
        break
    }
  }

  private subscribe(conn: ClientConnection, channels: string[]): void {
    for (const channel of channels) {
      conn.subscriptions.add(channel)

      if (!this.subscribedChannels.has(channel)) {
        this.subscribedChannels.add(channel)
        this.redisSub.subscribe(channel).catch((err) => {
          console.error(`[ws] Failed to subscribe to Redis channel ${channel}:`, err)
        })
      }
    }

    conn.ws.send(JSON.stringify({ type: 'subscribed', channels }))
  }

  private unsubscribe(conn: ClientConnection, channels: string[]): void {
    for (const channel of channels) {
      conn.subscriptions.delete(channel)

      // Unsubscribe from Redis if no clients remain on this channel
      const remaining = this.registry.getSubscribers(channel)
      if (remaining.length === 0 && this.subscribedChannels.has(channel)) {
        this.subscribedChannels.delete(channel)
        this.redisSub.unsubscribe(channel).catch((err) => {
          console.error(`[ws] Failed to unsubscribe from Redis channel ${channel}:`, err)
        })
      }
    }

    conn.ws.send(JSON.stringify({ type: 'unsubscribed', channels }))
  }

  /** Clean up subscriptions when a client disconnects */
  handleDisconnect(ws: WebSocket): void {
    const conn = this.registry.get(ws)
    if (!conn) return

    for (const channel of conn.subscriptions) {
      // Check if any other client is subscribed before unsubscribing from Redis
      const subscribers = this.registry.getSubscribers(channel)
      const othersSubscribed = subscribers.some((s) => s.ws !== ws)
      if (!othersSubscribed && this.subscribedChannels.has(channel)) {
        this.subscribedChannels.delete(channel)
        this.redisSub.unsubscribe(channel).catch(() => {})
      }
    }
  }

  async stop(): Promise<void> {
    await this.redisSub.quit()
  }
}

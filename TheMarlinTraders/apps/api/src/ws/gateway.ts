import { WebSocketServer } from 'ws'
import type WebSocket from 'ws'
import type { IncomingMessage } from 'node:http'
import { ConnectionRegistry } from './connection-registry.js'
import { SubscriptionManager } from './subscriptions.js'
import { HeartbeatManager } from './heartbeat.js'
import { authenticateWsConnection } from './auth.js'

const WS_PORT = Number(process.env.WS_PORT ?? 4001)
const REDIS_URL = process.env.REDIS_URL ?? ''

export class WebSocketGateway {
  private wss: WebSocketServer | null = null
  private registry = new ConnectionRegistry()
  private subscriptions: SubscriptionManager
  private heartbeat: HeartbeatManager

  constructor() {
    this.subscriptions = new SubscriptionManager(REDIS_URL, this.registry)
    this.heartbeat = new HeartbeatManager(this.registry)
  }

  async start(): Promise<void> {
    await this.subscriptions.start()

    this.wss = new WebSocketServer({ port: WS_PORT })

    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const userId = await authenticateWsConnection(req)
      if (!userId) {
        ws.close(4001, 'Unauthorized')
        return
      }

      const conn = this.registry.add(ws, userId)
      console.log(`[ws] Client connected: ${userId} (${this.registry.size} total)`)

      ws.send(JSON.stringify({ type: 'connected', userId }))

      ws.on('message', (data: Buffer) => {
        this.subscriptions.handleMessage(ws, data.toString())
      })

      ws.on('pong', () => {
        this.heartbeat.handlePong(ws)
      })

      ws.on('close', () => {
        this.subscriptions.handleDisconnect(ws)
        this.registry.remove(ws)
        console.log(`[ws] Client disconnected: ${userId} (${this.registry.size} total)`)
      })

      ws.on('error', (err) => {
        console.error(`[ws] Client error (${userId}):`, err.message)
      })
    })

    this.heartbeat.start()
    console.log(`[ws] WebSocket gateway listening on port ${WS_PORT}`)
  }

  async stop(): Promise<void> {
    this.heartbeat.stop()
    await this.subscriptions.stop()

    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close(1001, 'Server shutting down')
      }
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve())
      })
    }
  }
}

// Start gateway when run directly
const gateway = new WebSocketGateway()
gateway.start().catch((err) => {
  console.error('[ws] Failed to start gateway:', err)
  process.exit(1)
})

process.on('SIGINT', () => {
  gateway.stop().then(() => process.exit(0))
})
process.on('SIGTERM', () => {
  gateway.stop().then(() => process.exit(0))
})

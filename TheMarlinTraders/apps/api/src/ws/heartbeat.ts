import type WebSocket from 'ws'
import type { ConnectionRegistry } from './connection-registry.js'

const PING_INTERVAL = 25_000
const DEAD_TIMEOUT = 35_000

export class HeartbeatManager {
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(private readonly registry: ConnectionRegistry) {}

  start(): void {
    this.interval = setInterval(() => {
      const now = Date.now()

      for (const conn of this.registry.all()) {
        if (now - conn.lastPong > DEAD_TIMEOUT) {
          conn.ws.terminate()
          continue
        }

        if (conn.ws.readyState === 1) {
          conn.isAlive = false
          conn.ws.ping()
        }
      }
    }, PING_INTERVAL)
  }

  handlePong(ws: WebSocket): void {
    const conn = this.registry.get(ws)
    if (conn) {
      conn.isAlive = true
      conn.lastPong = Date.now()
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}

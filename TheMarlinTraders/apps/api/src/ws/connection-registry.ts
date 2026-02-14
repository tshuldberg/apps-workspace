import type WebSocket from 'ws'

export interface ClientConnection {
  ws: WebSocket
  userId: string
  subscriptions: Set<string>
  lastPong: number
  isAlive: boolean
}

export class ConnectionRegistry {
  private connections = new Map<WebSocket, ClientConnection>()
  private userConnections = new Map<string, Set<WebSocket>>()

  add(ws: WebSocket, userId: string): ClientConnection {
    const conn: ClientConnection = {
      ws,
      userId,
      subscriptions: new Set(),
      lastPong: Date.now(),
      isAlive: true,
    }
    this.connections.set(ws, conn)

    let userSet = this.userConnections.get(userId)
    if (!userSet) {
      userSet = new Set()
      this.userConnections.set(userId, userSet)
    }
    userSet.add(ws)

    return conn
  }

  remove(ws: WebSocket): void {
    const conn = this.connections.get(ws)
    if (!conn) return

    this.connections.delete(ws)

    const userSet = this.userConnections.get(conn.userId)
    if (userSet) {
      userSet.delete(ws)
      if (userSet.size === 0) {
        this.userConnections.delete(conn.userId)
      }
    }
  }

  get(ws: WebSocket): ClientConnection | undefined {
    return this.connections.get(ws)
  }

  getByUser(userId: string): Set<WebSocket> | undefined {
    return this.userConnections.get(userId)
  }

  /** Get all connections subscribed to a channel */
  getSubscribers(channel: string): ClientConnection[] {
    const subscribers: ClientConnection[] = []
    for (const conn of this.connections.values()) {
      if (conn.subscriptions.has(channel)) {
        subscribers.push(conn)
      }
    }
    return subscribers
  }

  /** Get all active connections */
  all(): IterableIterator<ClientConnection> {
    return this.connections.values()
  }

  get size(): number {
    return this.connections.size
  }
}

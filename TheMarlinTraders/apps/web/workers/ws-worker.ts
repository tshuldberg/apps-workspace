/** WebSocket Worker — maintains connection to gateway, handles reconnection.
 *  Runs in a dedicated Web Worker to avoid blocking the main thread. */

interface ConnectMessage {
  type: 'connect'
  url: string
  token: string
}

interface SubscribeMessage {
  type: 'subscribe'
  channels: string[]
}

interface UnsubscribeMessage {
  type: 'unsubscribe'
  channels: string[]
}

interface DisconnectMessage {
  type: 'disconnect'
}

type InboundMessage = ConnectMessage | SubscribeMessage | UnsubscribeMessage | DisconnectMessage

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let currentUrl = ''
let currentToken = ''
let pendingSubscriptions: string[] = []
let isDisconnecting = false

const BASE_DELAY = 100
const MAX_DELAY = 30_000

function connect(url: string, token: string): void {
  isDisconnecting = false
  currentUrl = url
  currentToken = token
  const wsUrl = `${url}?token=${encodeURIComponent(token)}`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    reconnectAttempt = 0
    self.postMessage({ type: 'status', status: 'connected' })

    // Re-subscribe to any pending channels
    if (pendingSubscriptions.length > 0) {
      ws!.send(JSON.stringify({ type: 'subscribe', channels: pendingSubscriptions }))
    }
  }

  ws.onmessage = (event: MessageEvent) => {
    const data: unknown = JSON.parse(event.data as string)
    self.postMessage({ type: 'message', data })
  }

  ws.onclose = () => {
    self.postMessage({ type: 'status', status: 'disconnected' })
    if (!isDisconnecting) {
      scheduleReconnect()
    }
  }

  ws.onerror = () => {
    self.postMessage({ type: 'status', status: 'error' })
  }
}

function scheduleReconnect(): void {
  const jitter = Math.random() * 100
  const delay = Math.min(BASE_DELAY * 2 ** reconnectAttempt + jitter, MAX_DELAY)
  reconnectAttempt++

  self.postMessage({ type: 'status', status: 'reconnecting', attempt: reconnectAttempt, delay })

  reconnectTimer = setTimeout(() => {
    connect(currentUrl, currentToken)
  }, delay)
}

function disconnect(): void {
  isDisconnecting = true
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
}

self.onmessage = (event: MessageEvent<InboundMessage>) => {
  const msg = event.data

  switch (msg.type) {
    case 'connect':
      disconnect()
      connect(msg.url, msg.token)
      break

    case 'subscribe':
      pendingSubscriptions.push(...msg.channels)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', channels: msg.channels }))
      }
      break

    case 'unsubscribe':
      pendingSubscriptions = pendingSubscriptions.filter((ch) => !msg.channels.includes(ch))
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', channels: msg.channels }))
      }
      break

    case 'disconnect':
      disconnect()
      break
  }
}

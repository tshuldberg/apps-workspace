import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConnectionRegistry } from '../../src/ws/connection-registry.js'
import { HeartbeatManager } from '../../src/ws/heartbeat.js'

function mockWs(readyState = 1) {
  return {
    readyState,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  } as unknown as import('ws').WebSocket
}

describe('ConnectionRegistry', () => {
  let registry: ConnectionRegistry

  beforeEach(() => {
    registry = new ConnectionRegistry()
  })

  it('adds and retrieves a connection', () => {
    const ws = mockWs()
    const conn = registry.add(ws, 'user-1')

    expect(conn.userId).toBe('user-1')
    expect(conn.subscriptions.size).toBe(0)
    expect(registry.size).toBe(1)
    expect(registry.get(ws)).toBe(conn)
  })

  it('removes a connection', () => {
    const ws = mockWs()
    registry.add(ws, 'user-1')
    registry.remove(ws)

    expect(registry.size).toBe(0)
    expect(registry.get(ws)).toBeUndefined()
  })

  it('tracks user connections', () => {
    const ws1 = mockWs()
    const ws2 = mockWs()
    registry.add(ws1, 'user-1')
    registry.add(ws2, 'user-1')

    const userConns = registry.getByUser('user-1')
    expect(userConns?.size).toBe(2)
  })

  it('cleans up user set when last connection is removed', () => {
    const ws = mockWs()
    registry.add(ws, 'user-1')
    registry.remove(ws)

    expect(registry.getByUser('user-1')).toBeUndefined()
  })

  it('finds subscribers for a channel', () => {
    const ws1 = mockWs()
    const ws2 = mockWs()
    const ws3 = mockWs()

    const conn1 = registry.add(ws1, 'user-1')
    const conn2 = registry.add(ws2, 'user-2')
    registry.add(ws3, 'user-3')

    conn1.subscriptions.add('bars:AAPL:1m')
    conn2.subscriptions.add('bars:AAPL:1m')

    const subs = registry.getSubscribers('bars:AAPL:1m')
    expect(subs).toHaveLength(2)
    expect(subs.map((s) => s.userId).sort()).toEqual(['user-1', 'user-2'])
  })

  it('returns empty array when no subscribers', () => {
    expect(registry.getSubscribers('bars:TSLA:1m')).toHaveLength(0)
  })
})

describe('HeartbeatManager', () => {
  it('terminates dead connections', () => {
    vi.useFakeTimers()
    const registry = new ConnectionRegistry()
    const heartbeat = new HeartbeatManager(registry)

    const ws = mockWs()
    const conn = registry.add(ws, 'user-1')
    conn.lastPong = Date.now() - 40_000 // 40s ago, exceeds 35s timeout

    heartbeat.start()
    vi.advanceTimersByTime(25_000) // trigger first interval

    expect(ws.terminate).toHaveBeenCalled()

    heartbeat.stop()
    vi.useRealTimers()
  })

  it('pings alive connections', () => {
    vi.useFakeTimers()
    const registry = new ConnectionRegistry()
    const heartbeat = new HeartbeatManager(registry)

    const ws = mockWs()
    registry.add(ws, 'user-1')

    heartbeat.start()
    vi.advanceTimersByTime(25_000)

    expect(ws.ping).toHaveBeenCalled()

    heartbeat.stop()
    vi.useRealTimers()
  })

  it('updates lastPong on handlePong', () => {
    const registry = new ConnectionRegistry()
    const heartbeat = new HeartbeatManager(registry)

    const ws = mockWs()
    const conn = registry.add(ws, 'user-1')
    conn.lastPong = 0

    heartbeat.handlePong(ws)

    expect(conn.lastPong).toBeGreaterThan(0)
    expect(conn.isAlive).toBe(true)
  })
})

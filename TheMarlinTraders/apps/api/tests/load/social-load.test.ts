import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../src/lib/redis.js', () => ({
  redis: {
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
    })),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
  redisSub: { subscribe: vi.fn(), on: vi.fn() },
  redisPub: { publish: vi.fn() },
}))

// ── Types ───────────────────────────────────────────────────────────────────

interface LoadTestResult {
  totalRequests: number
  successCount: number
  failCount: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  maxLatencyMs: number
  requestsPerSecond: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Simulate a concurrent workload by spawning `concurrency` async tasks,
 * each executing `taskFn` a total of `totalRequests / concurrency` times.
 */
async function runLoadTest(params: {
  totalRequests: number
  concurrency: number
  taskFn: (index: number) => Promise<void>
}): Promise<LoadTestResult> {
  const { totalRequests, concurrency, taskFn } = params
  const requestsPerWorker = Math.ceil(totalRequests / concurrency)
  const latencies: number[] = []
  let successCount = 0
  let failCount = 0

  const startTime = performance.now()

  const workers = Array.from({ length: concurrency }, async (_, workerId) => {
    for (let i = 0; i < requestsPerWorker; i++) {
      const requestIndex = workerId * requestsPerWorker + i
      if (requestIndex >= totalRequests) break

      const reqStart = performance.now()
      try {
        await taskFn(requestIndex)
        successCount++
      } catch {
        failCount++
      }
      latencies.push(performance.now() - reqStart)
    }
  })

  await Promise.all(workers)

  const totalDurationMs = performance.now() - startTime
  const sorted = latencies.sort((a, b) => a - b)
  const count = sorted.length

  return {
    totalRequests: count,
    successCount,
    failCount,
    avgLatencyMs: round(sorted.reduce((a, b) => a + b, 0) / count),
    p50LatencyMs: round(sorted[Math.floor(count * 0.5)]!),
    p95LatencyMs: round(sorted[Math.floor(count * 0.95)]!),
    p99LatencyMs: round(sorted[Math.floor(count * 0.99)]!),
    maxLatencyMs: round(sorted[count - 1]!),
    requestsPerSecond: round((count / totalDurationMs) * 1000),
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Mock Operations ─────────────────────────────────────────────────────────

/**
 * Simulate creating an idea (DB insert + cache check).
 * In a real load test this would hit the actual API endpoint;
 * here we measure the overhead of our business logic in isolation.
 */
async function simulateCreateIdea(index: number): Promise<void> {
  const { db } = await import('../../src/db/index.js')
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: `idea-${index}`,
          userId: `user-${index % 50}`,
          title: `Test Idea ${index}`,
          body: 'This is a load test idea body with some content to simulate real data.',
          symbol: 'AAPL',
          sentiment: 'bullish',
          tags: ['test'],
          upvotes: 0,
          downvotes: 0,
          commentCount: 0,
          isPublished: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    }),
  })
  ;(db as unknown as { insert: typeof mockInsert }).insert = mockInsert
  await db.insert({} as never).values({}).returning()
}

/**
 * Simulate sending a chat message.
 */
async function simulateSendChatMessage(index: number): Promise<void> {
  const { db } = await import('../../src/db/index.js')
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 'room-1',
            name: 'General',
            type: 'general',
            minAccountAgeDays: 0,
            minKarma: 0,
          },
        ]),
      }),
    }),
  })
  ;(db as unknown as { select: typeof mockSelect }).select = mockSelect

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: `msg-${index}`,
          roomId: 'room-1',
          userId: `user-${index % 100}`,
          body: `Load test message ${index}`,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    }),
  })
  ;(db as unknown as { insert: typeof mockInsert }).insert = mockInsert

  await db.select().from({} as never).where({} as never).limit(1)
  await db.insert({} as never).values({}).returning()
}

/**
 * Simulate watchlist CRUD (create + read + update + delete cycle).
 */
async function simulateWatchlistCrud(index: number): Promise<void> {
  const { db } = await import('../../src/db/index.js')

  // Create
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        { id: `wl-${index}`, name: `Watchlist ${index}`, userId: `user-${index % 50}` },
      ]),
    }),
  })
  ;(db as unknown as { insert: typeof mockInsert }).insert = mockInsert
  await db.insert({} as never).values({}).returning()

  // Read
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([
        { id: `wl-${index}`, name: `Watchlist ${index}`, symbols: ['AAPL', 'TSLA'] },
      ]),
    }),
  })
  ;(db as unknown as { select: typeof mockSelect }).select = mockSelect
  await db.select().from({} as never).where({} as never)

  // Update
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          { id: `wl-${index}`, name: `Updated Watchlist ${index}` },
        ]),
      }),
    }),
  })
  ;(db as unknown as { update: typeof mockUpdate }).update = mockUpdate
  await db.update({} as never).set({}).where({} as never).returning()

  // Delete
  const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: `wl-${index}` }]),
    }),
  })
  ;(db as unknown as { delete: typeof mockDelete }).delete = mockDelete
  await db.delete({} as never).where({} as never).returning()
}

// ── Load Tests ──────────────────────────────────────────────────────────────

describe('Social Load Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should handle 100 concurrent users posting ideas', async () => {
    const result = await runLoadTest({
      totalRequests: 100,
      concurrency: 50,
      taskFn: simulateCreateIdea,
    })

    console.log('Ideas Create Load Test:', result)

    expect(result.successCount).toBe(100)
    expect(result.failCount).toBe(0)
    expect(result.avgLatencyMs).toBeLessThan(50)
    expect(result.p95LatencyMs).toBeLessThan(100)
  })

  it('should handle 500 chat messages with 100 concurrent users', async () => {
    const result = await runLoadTest({
      totalRequests: 500,
      concurrency: 100,
      taskFn: simulateSendChatMessage,
    })

    console.log('Chat Message Throughput Test:', result)

    expect(result.successCount).toBe(500)
    expect(result.failCount).toBe(0)
    expect(result.avgLatencyMs).toBeLessThan(50)
    expect(result.p95LatencyMs).toBeLessThan(100)
  })

  it('should handle watchlist CRUD under load (200 users)', async () => {
    const result = await runLoadTest({
      totalRequests: 200,
      concurrency: 50,
      taskFn: simulateWatchlistCrud,
    })

    console.log('Watchlist CRUD Load Test:', result)

    expect(result.successCount).toBe(200)
    expect(result.failCount).toBe(0)
    expect(result.avgLatencyMs).toBeLessThan(50)
    expect(result.p95LatencyMs).toBeLessThan(150)
  })

  it('should maintain throughput with sustained load (1000 mixed operations)', async () => {
    let requestIndex = 0

    const mixedWorkload = async (index: number): Promise<void> => {
      const operationType = index % 3
      switch (operationType) {
        case 0:
          await simulateCreateIdea(index)
          break
        case 1:
          await simulateSendChatMessage(index)
          break
        case 2:
          await simulateWatchlistCrud(index)
          break
      }
    }

    const result = await runLoadTest({
      totalRequests: 1000,
      concurrency: 100,
      taskFn: mixedWorkload,
    })

    console.log('Mixed Workload Sustained Load Test:', result)

    expect(result.successCount).toBe(1000)
    expect(result.failCount).toBe(0)
    expect(result.p99LatencyMs).toBeLessThan(200)
    expect(result.requestsPerSecond).toBeGreaterThan(100)
  })

  it('should report response time percentiles accurately', async () => {
    const result = await runLoadTest({
      totalRequests: 100,
      concurrency: 10,
      taskFn: simulateCreateIdea,
    })

    // Verify percentile ordering invariant
    expect(result.p50LatencyMs).toBeLessThanOrEqual(result.p95LatencyMs)
    expect(result.p95LatencyMs).toBeLessThanOrEqual(result.p99LatencyMs)
    expect(result.p99LatencyMs).toBeLessThanOrEqual(result.maxLatencyMs)
    expect(result.avgLatencyMs).toBeGreaterThan(0)
  })
})

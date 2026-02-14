// ── Types ───────────────────────────────────────────────────────────────────

type AnyFunction = (...args: unknown[]) => unknown

// ── Debounce ────────────────────────────────────────────────────────────────

/**
 * Create a debounced version of a function that delays invocation until
 * after `waitMs` milliseconds have elapsed since the last call.
 *
 * @param fn - The function to debounce
 * @param waitMs - Milliseconds to wait before invoking
 * @returns A debounced function with a `.cancel()` method
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce(searchSymbols, 300)
 * input.addEventListener('input', () => debouncedSearch(input.value))
 * ```
 */
export function debounce<T extends AnyFunction>(
  fn: T,
  waitMs: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn(...args)
    }, waitMs)
  }

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

// ── Throttle ────────────────────────────────────────────────────────────────

/**
 * Create a throttled version of a function that invokes at most once
 * per `intervalMs` milliseconds. Uses leading-edge invocation (fires
 * immediately on first call, then suppresses until the interval elapses).
 *
 * @param fn - The function to throttle
 * @param intervalMs - Minimum milliseconds between invocations
 * @returns A throttled function with a `.cancel()` method
 *
 * @example
 * ```ts
 * const throttledScroll = throttle(handleScroll, 100)
 * window.addEventListener('scroll', throttledScroll)
 * ```
 */
export function throttle<T extends AnyFunction>(
  fn: T,
  intervalMs: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastCallTime = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = (...args: Parameters<T>): void => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall >= intervalMs) {
      lastCallTime = now
      fn(...args)
    } else {
      // Schedule a trailing call
      lastArgs = args
      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          lastCallTime = Date.now()
          timeoutId = null
          if (lastArgs) {
            fn(...lastArgs)
            lastArgs = null
          }
        }, intervalMs - timeSinceLastCall)
      }
    }
  }

  throttled.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  return throttled
}

// ── Memoize with TTL + LRU ─────────────────────────────────────────────────

interface MemoizeOptions {
  /** Time-to-live in milliseconds. Entries expire after this duration. Default: 60000 (1 min) */
  ttlMs?: number
  /** Maximum number of cached entries. Oldest entries are evicted when exceeded. Default: 100 */
  maxSize?: number
}

interface CacheEntry<V> {
  value: V
  expiresAt: number
}

/**
 * Create a memoized version of a function with TTL expiration and LRU eviction.
 * The cache key is derived from JSON-serializing the arguments.
 *
 * @param fn - The function to memoize (sync or async)
 * @param options - Cache configuration (TTL, max size)
 * @returns A memoized function with `.cache` access and `.clear()` method
 *
 * @example
 * ```ts
 * const cachedFetch = memoize(fetchQuote, { ttlMs: 5000, maxSize: 50 })
 * const quote = await cachedFetch('AAPL')  // fetches
 * const quote2 = await cachedFetch('AAPL') // returns cached
 * ```
 */
export function memoize<T extends AnyFunction>(
  fn: T,
  options: MemoizeOptions = {},
): ((...args: Parameters<T>) => ReturnType<T>) & {
  cache: Map<string, CacheEntry<ReturnType<T>>>
  clear: () => void
} {
  const { ttlMs = 60_000, maxSize = 100 } = options
  const cache = new Map<string, CacheEntry<ReturnType<T>>>()

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args)
    const now = Date.now()

    // Check cache hit
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      // Move to end (most recently used) by deleting and re-inserting
      cache.delete(key)
      cache.set(key, cached)
      return cached.value
    }

    // Cache miss or expired — evict stale entry
    if (cached) {
      cache.delete(key)
    }

    // Evict oldest entries if at capacity
    while (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value
      if (oldestKey !== undefined) {
        cache.delete(oldestKey)
      }
    }

    const value = fn(...args) as ReturnType<T>
    cache.set(key, { value, expiresAt: now + ttlMs })

    return value
  }

  memoized.cache = cache
  memoized.clear = (): void => {
    cache.clear()
  }

  return memoized
}

// ── Batch Requests ──────────────────────────────────────────────────────────

interface BatchOptions {
  /** Maximum number of items to batch before flushing. Default: 10 */
  maxBatchSize?: number
  /** Maximum milliseconds to wait before flushing an incomplete batch. Default: 50 */
  maxWaitMs?: number
}

/**
 * Batch multiple individual calls into a single bulk operation.
 * Collects calls within a time window or until the batch is full,
 * then executes the batch function once with all collected items.
 *
 * @param batchFn - Function that processes an array of inputs and returns an array of outputs
 * @param options - Batching configuration
 * @returns A function that accepts a single input and returns a Promise for its output
 *
 * @example
 * ```ts
 * // Instead of N individual DB queries, batch them into one
 * const getUser = batchRequests(
 *   async (ids: string[]) => {
 *     const users = await db.select().from(users).where(inArray(users.id, ids))
 *     return ids.map(id => users.find(u => u.id === id) ?? null)
 *   },
 *   { maxBatchSize: 25, maxWaitMs: 10 }
 * )
 *
 * // These three calls are batched into a single query
 * const [user1, user2, user3] = await Promise.all([
 *   getUser('id-1'), getUser('id-2'), getUser('id-3'),
 * ])
 * ```
 */
export function batchRequests<TInput, TOutput>(
  batchFn: (inputs: TInput[]) => Promise<TOutput[]>,
  options: BatchOptions = {},
): (input: TInput) => Promise<TOutput> {
  const { maxBatchSize = 10, maxWaitMs = 50 } = options

  let pendingBatch: Array<{
    input: TInput
    resolve: (value: TOutput) => void
    reject: (error: unknown) => void
  }> = []

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  async function flush(): Promise<void> {
    const batch = pendingBatch
    pendingBatch = []

    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (batch.length === 0) return

    try {
      const inputs = batch.map((item) => item.input)
      const results = await batchFn(inputs)

      for (let i = 0; i < batch.length; i++) {
        batch[i]!.resolve(results[i]!)
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error)
      }
    }
  }

  return (input: TInput): Promise<TOutput> => {
    return new Promise<TOutput>((resolve, reject) => {
      pendingBatch.push({ input, resolve, reject })

      if (pendingBatch.length >= maxBatchSize) {
        void flush()
      } else if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          void flush()
        }, maxWaitMs)
      }
    })
  }
}

// ── Performance Measurement ─────────────────────────────────────────────────

interface PerformanceEntry {
  name: string
  durationMs: number
  timestamp: number
  metadata?: Record<string, unknown>
}

/** In-memory ring buffer for performance entries */
const performanceLog: PerformanceEntry[] = []
const MAX_LOG_SIZE = 1000

/**
 * Measure the execution time of a function and log it.
 * Works with both sync and async functions.
 *
 * @param name - A label for this measurement (e.g. "fetchQuote", "computeRSI")
 * @param fn - The function to measure
 * @param metadata - Optional metadata to attach to the log entry
 * @returns The function's return value
 *
 * @example
 * ```ts
 * const bars = await measurePerformance('getBars', () =>
 *   service.getBars('AAPL', '1D', '2024-01-01', '2024-12-31')
 * )
 * ```
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now()

  try {
    const result = await fn()
    const durationMs = performance.now() - start

    const entry: PerformanceEntry = {
      name,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
      metadata,
    }

    // Ring buffer: evict oldest when full
    if (performanceLog.length >= MAX_LOG_SIZE) {
      performanceLog.shift()
    }
    performanceLog.push(entry)

    return result
  } catch (error) {
    const durationMs = performance.now() - start

    const entry: PerformanceEntry = {
      name: `${name} [ERROR]`,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
      metadata: { ...metadata, error: String(error) },
    }

    if (performanceLog.length >= MAX_LOG_SIZE) {
      performanceLog.shift()
    }
    performanceLog.push(entry)

    throw error
  }
}

/**
 * Get recent performance entries, optionally filtered by name.
 */
export function getPerformanceLog(filter?: {
  name?: string
  limit?: number
}): PerformanceEntry[] {
  let entries = [...performanceLog]

  if (filter?.name) {
    entries = entries.filter((e) => e.name.includes(filter.name!))
  }

  if (filter?.limit) {
    entries = entries.slice(-filter.limit)
  }

  return entries
}

/**
 * Get aggregate performance statistics for a named operation.
 */
export function getPerformanceStats(name: string): {
  count: number
  avgMs: number
  minMs: number
  maxMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
} | null {
  const entries = performanceLog.filter((e) => e.name === name)
  if (entries.length === 0) return null

  const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b)
  const count = durations.length
  const sum = durations.reduce((a, b) => a + b, 0)

  return {
    count,
    avgMs: Math.round((sum / count) * 100) / 100,
    minMs: durations[0]!,
    maxMs: durations[count - 1]!,
    p50Ms: durations[Math.floor(count * 0.5)]!,
    p95Ms: durations[Math.floor(count * 0.95)]!,
    p99Ms: durations[Math.floor(count * 0.99)]!,
  }
}

/**
 * Clear the performance log.
 */
export function clearPerformanceLog(): void {
  performanceLog.length = 0
}

import { redis } from '../lib/redis.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttlSeconds: number
  /** Key prefix for namespacing (e.g. "leaderboard", "top-ideas") */
  prefix: string
}

export interface StaleWhileRevalidateOptions extends CacheOptions {
  /** How many extra seconds a stale entry is still servable while revalidating. Default: ttlSeconds */
  staleTtlSeconds?: number
}

// ── Core Cache Operations ───────────────────────────────────────────────────

/**
 * Get a value from Redis cache.
 * Returns null if the key does not exist or has expired.
 */
export async function cacheGet<T>(key: string, prefix: string): Promise<T | null> {
  try {
    const fullKey = `cache:${prefix}:${key}`
    const data = await redis.get(fullKey)
    if (!data) return null
    return JSON.parse(data) as T
  } catch {
    return null
  }
}

/**
 * Set a value in Redis cache with a TTL.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions,
): Promise<void> {
  try {
    const fullKey = `cache:${options.prefix}:${key}`
    await redis.set(fullKey, JSON.stringify(value), 'EX', options.ttlSeconds)
  } catch {
    // Silently fail — cache is a performance optimization, not a requirement
  }
}

/**
 * Delete a specific cache entry.
 */
export async function cacheDelete(key: string, prefix: string): Promise<void> {
  try {
    const fullKey = `cache:${prefix}:${key}`
    await redis.del(fullKey)
  } catch {
    // Silently fail
  }
}

/**
 * Delete all cache entries matching a prefix pattern.
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<number> {
  try {
    const pattern = `cache:${prefix}:*`
    let cursor = '0'
    let deletedCount = 0

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor

      if (keys.length > 0) {
        await redis.del(...keys)
        deletedCount += keys.length
      }
    } while (cursor !== '0')

    return deletedCount
  } catch {
    return 0
  }
}

// ── Cached Query Wrapper ────────────────────────────────────────────────────

/**
 * Execute a query with cache-aside pattern:
 * 1. Check cache → return if hit
 * 2. Execute query → cache result → return
 *
 * @param key - Cache key (unique per query + params)
 * @param queryFn - The database query to execute on cache miss
 * @param options - Cache TTL and prefix
 *
 * @example
 * ```ts
 * const topIdeas = await cachedQuery(
 *   'top-ideas:7d',
 *   () => db.select().from(ideas).orderBy(desc(ideas.upvotes)).limit(20),
 *   { ttlSeconds: 300, prefix: 'ideas' }
 * )
 * ```
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  // 1. Try cache
  const cached = await cacheGet<T>(key, options.prefix)
  if (cached !== null) {
    return cached
  }

  // 2. Execute query
  const result = await queryFn()

  // 3. Cache the result
  await cacheSet(key, result, options)

  return result
}

// ── Stale-While-Revalidate ──────────────────────────────────────────────────

/**
 * Stale-while-revalidate cache pattern:
 * - Returns cached data immediately if fresh.
 * - If stale (past TTL but within stale window), returns stale data AND
 *   triggers a background revalidation.
 * - If no cache or past stale window, fetches fresh data synchronously.
 *
 * This ensures fast reads even when cache is slightly stale, which is ideal
 * for leaderboards, heatmaps, and aggregated feeds.
 *
 * @example
 * ```ts
 * const leaderboard = await staleWhileRevalidate(
 *   'rankings:30d:totalPnl',
 *   () => computeLeaderboardRankings('30d', 'totalPnl'),
 *   { ttlSeconds: 60, staleTtlSeconds: 300, prefix: 'leaderboard' }
 * )
 * ```
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: StaleWhileRevalidateOptions,
): Promise<T> {
  const fullKey = `cache:${options.prefix}:${key}`
  const metaKey = `cache:${options.prefix}:${key}:meta`
  const staleTtl = options.staleTtlSeconds ?? options.ttlSeconds

  try {
    // Read data and metadata atomically
    const [dataRaw, metaRaw] = await redis.mget(fullKey, metaKey)

    if (dataRaw) {
      const data = JSON.parse(dataRaw) as T

      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as { setAt: number }
        const ageSeconds = (Date.now() - meta.setAt) / 1000

        if (ageSeconds <= options.ttlSeconds) {
          // Fresh — return immediately
          return data
        }

        if (ageSeconds <= options.ttlSeconds + staleTtl) {
          // Stale but within grace period — return stale and revalidate in background
          void revalidateInBackground(key, fetchFn, options)
          return data
        }
      } else {
        // No metadata but data exists — treat as fresh
        return data
      }
    }
  } catch {
    // Cache read failed — fall through to fresh fetch
  }

  // No cache or expired past stale window — fetch synchronously
  const freshData = await fetchFn()
  await setCacheWithMeta(key, freshData, options)
  return freshData
}

/**
 * Internal: set cache data along with a metadata key that records when
 * the data was cached (for stale-while-revalidate age checks).
 */
async function setCacheWithMeta<T>(
  key: string,
  value: T,
  options: StaleWhileRevalidateOptions,
): Promise<void> {
  const fullKey = `cache:${options.prefix}:${key}`
  const metaKey = `cache:${options.prefix}:${key}:meta`
  const totalTtl = options.ttlSeconds + (options.staleTtlSeconds ?? options.ttlSeconds)

  try {
    const pipeline = redis.pipeline()
    pipeline.set(fullKey, JSON.stringify(value), 'EX', totalTtl)
    pipeline.set(metaKey, JSON.stringify({ setAt: Date.now() }), 'EX', totalTtl)
    await pipeline.exec()
  } catch {
    // Silently fail
  }
}

/**
 * Internal: background revalidation. Runs the fetch function and updates
 * the cache without blocking the caller.
 */
async function revalidateInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: StaleWhileRevalidateOptions,
): Promise<void> {
  // Use a lock to prevent thundering herd
  const lockKey = `cache:${options.prefix}:${key}:revalidating`

  try {
    const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX')
    if (!acquired) return // Another process is already revalidating

    const freshData = await fetchFn()
    await setCacheWithMeta(key, freshData, options)
  } catch {
    // Revalidation failed — stale data continues to be served
  } finally {
    try {
      await redis.del(lockKey)
    } catch {
      // Ignore lock cleanup failure
    }
  }
}

// ── Invalidation Helpers ────────────────────────────────────────────────────

/** Invalidate all cached leaderboard rankings. */
export async function invalidateLeaderboardCache(): Promise<void> {
  await cacheInvalidatePrefix('leaderboard')
}

/** Invalidate all cached top ideas. */
export async function invalidateIdeasCache(): Promise<void> {
  await cacheInvalidatePrefix('ideas')
}

/** Invalidate all cached heatmap data. */
export async function invalidateHeatmapCache(): Promise<void> {
  await cacheInvalidatePrefix('heatmap')
}

/** Invalidate a specific user's cached data. */
export async function invalidateUserCache(userId: string): Promise<void> {
  await cacheDelete(userId, 'user')
}

// ── Cache Presets ───────────────────────────────────────────────────────────

/** Common cache configurations for frequently-accessed data */
export const CACHE_PRESETS = {
  /** Leaderboard rankings: 60s fresh, 5min stale */
  leaderboard: { ttlSeconds: 60, staleTtlSeconds: 300, prefix: 'leaderboard' },
  /** Top ideas feed: 30s fresh, 2min stale */
  topIdeas: { ttlSeconds: 30, staleTtlSeconds: 120, prefix: 'ideas' },
  /** Heatmap data: 15s fresh, 60s stale */
  heatmap: { ttlSeconds: 15, staleTtlSeconds: 60, prefix: 'heatmap' },
  /** User profile: 5min fresh, 15min stale */
  userProfile: { ttlSeconds: 300, staleTtlSeconds: 900, prefix: 'user' },
  /** Symbol search results: 10min fresh */
  symbolSearch: { ttlSeconds: 600, prefix: 'search' },
  /** News articles: 2min fresh, 5min stale */
  news: { ttlSeconds: 120, staleTtlSeconds: 300, prefix: 'news' },
} as const satisfies Record<string, CacheOptions | StaleWhileRevalidateOptions>

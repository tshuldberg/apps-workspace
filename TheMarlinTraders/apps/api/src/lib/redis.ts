import Redis from 'ioredis'

const redisUrl =
  process.env.REDIS_URL ??
  (process.env.NODE_ENV !== 'production' ? 'redis://localhost:6379' : undefined)

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required')
}

if (!process.env.REDIS_URL) {
  console.warn('[redis] REDIS_URL not set; defaulting to redis://localhost:6379')
}

let warnedRedisUnavailable = false

function reportRedisUnavailable(err: unknown): void {
  if (warnedRedisUnavailable) return
  warnedRedisUnavailable = true
  const message = err instanceof Error ? err.message : String(err)
  console.warn(`[redis] Redis unavailable; continuing without cache/pubsub. (${message})`)
}

function retryStrategy(times: number): number | null {
  if (times > 5) return null
  return Math.min(times * 200, 2000)
}

const REDIS_CLIENT_OPTIONS = {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy,
} as const

/** Primary Redis client for general commands (get, set, hget, etc.) */
export const redis = new Redis(redisUrl, REDIS_CLIENT_OPTIONS)

/** Dedicated Redis client for Pub/Sub subscribers (cannot share with command client) */
export const redisSub = new Redis(redisUrl, REDIS_CLIENT_OPTIONS)

/** Dedicated Redis client for Pub/Sub publishers */
export const redisPub = new Redis(redisUrl, REDIS_CLIENT_OPTIONS)

redis.on('error', reportRedisUnavailable)
redisSub.on('error', reportRedisUnavailable)
redisPub.on('error', reportRedisUnavailable)

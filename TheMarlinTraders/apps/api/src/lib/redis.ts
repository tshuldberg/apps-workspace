import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is required')
}

/** Primary Redis client for general commands (get, set, hget, etc.) */
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

/** Dedicated Redis client for Pub/Sub subscribers (cannot share with command client) */
export const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

/** Dedicated Redis client for Pub/Sub publishers */
export const redisPub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

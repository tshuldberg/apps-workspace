/**
 * In-memory token bucket rate limiter for API routes.
 *
 * Each unique key (typically an IP address) gets a bucket that refills at
 * `refillRate` tokens per `refillIntervalMs`. Requests that exceed the
 * bucket capacity are rejected with 429.
 *
 * Designed for self-hosted Next.js where the process is long-lived.
 * Not suitable for serverless edge deployments where memory is ephemeral.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum tokens (burst capacity). */
  capacity: number;
  /** Tokens added per refill interval. */
  refillRate: number;
  /** Refill interval in milliseconds. */
  refillIntervalMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  capacity: 60,
  refillRate: 60,
  refillIntervalMs: 60_000, // 60 requests per minute
};

const buckets = new Map<string, Bucket>();

/** Prune stale buckets every 5 minutes to prevent unbounded growth. */
const PRUNE_INTERVAL_MS = 5 * 60_000;
const STALE_THRESHOLD_MS = 10 * 60_000;
let lastPrune = Date.now();

function pruneIfNeeded(now: number): void {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_THRESHOLD_MS) {
      buckets.delete(key);
    }
  }
}

/**
 * Attempt to consume one token for the given key.
 * Returns `true` if the request is allowed, `false` if rate-limited.
 */
export function consumeToken(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): boolean {
  const now = Date.now();
  pruneIfNeeded(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refillCount = Math.floor(elapsed / config.refillIntervalMs) * config.refillRate;
    if (refillCount > 0) {
      bucket.tokens = Math.min(config.capacity, bucket.tokens + refillCount);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}

/**
 * Extract a rate-limit key from a request.
 * Uses x-forwarded-for (reverse proxy) or falls back to a default key.
 */
export function getRateLimitKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (client IP before any proxies)
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

/** Visible for testing. */
export function _resetBuckets(): void {
  buckets.clear();
}

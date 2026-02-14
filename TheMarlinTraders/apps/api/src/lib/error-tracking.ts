import { redis } from './redis.js'
import { db } from '../db/connection.js'
import { sql } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

export interface ErrorContext {
  userId?: string | null
  route?: string
  method?: string
  statusCode?: number
  metadata?: Record<string, unknown>
}

export interface TrackedError {
  id: string
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  timestamp: string
  fingerprint: string
}

export interface ErrorAggregate {
  fingerprint: string
  message: string
  severity: ErrorSeverity
  count: number
  firstSeen: string
  lastSeen: string
  lastContext: ErrorContext
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: ComponentHealth
    redis: ComponentHealth
    uptime: ComponentHealth
  }
}

interface ComponentHealth {
  status: 'up' | 'down'
  latencyMs: number
  error?: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const ERROR_LOG_PREFIX = 'errors:'
const ERROR_AGGREGATE_PREFIX = 'error-agg:'
const MAX_ERROR_LOG_SIZE = 500
const ERROR_AGGREGATE_TTL_SECONDS = 86400 * 7 // 7 days

const startTime = Date.now()

// ── In-Memory Error Buffer ──────────────────────────────────────────────────

const errorBuffer: TrackedError[] = []

// ── Error Fingerprinting ────────────────────────────────────────────────────

/**
 * Generate a fingerprint for an error to group repeated occurrences.
 * Uses the error message and the first line of the stack trace.
 */
function generateFingerprint(message: string, stack?: string): string {
  const stackFirstLine = stack?.split('\n')[1]?.trim() ?? ''
  const raw = `${message}::${stackFirstLine}`

  // Simple hash — good enough for grouping, not for crypto
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }

  return `fp_${Math.abs(hash).toString(36)}`
}

// ── Core Tracking ───────────────────────────────────────────────────────────

/**
 * Track an error with structured context and severity.
 * Logs to the in-memory buffer and (best-effort) to Redis for aggregation.
 */
export async function trackError(
  error: Error | string,
  severity: ErrorSeverity,
  context: ErrorContext = {},
): Promise<TrackedError> {
  const message = typeof error === 'string' ? error : error.message
  const stack = typeof error === 'string' ? undefined : error.stack
  const fingerprint = generateFingerprint(message, stack)
  const timestamp = new Date().toISOString()

  const tracked: TrackedError = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    severity,
    message,
    stack,
    context,
    timestamp,
    fingerprint,
  }

  // In-memory ring buffer
  if (errorBuffer.length >= MAX_ERROR_LOG_SIZE) {
    errorBuffer.shift()
  }
  errorBuffer.push(tracked)

  // Structured console logging
  const logLine = {
    level: severity,
    message,
    fingerprint,
    userId: context.userId,
    route: context.route,
    timestamp,
  }

  switch (severity) {
    case 'critical':
    case 'error':
      console.error('[ERROR]', JSON.stringify(logLine))
      break
    case 'warning':
      console.warn('[WARN]', JSON.stringify(logLine))
      break
    case 'info':
      console.info('[INFO]', JSON.stringify(logLine))
      break
    case 'debug':
      console.debug('[DEBUG]', JSON.stringify(logLine))
      break
  }

  // Best-effort Redis aggregation
  try {
    await updateErrorAggregate(tracked)
  } catch {
    // Redis unavailable — in-memory buffer is the fallback
  }

  return tracked
}

/**
 * Track an error from an Express/Bun request handler.
 * Convenience wrapper that extracts context from the request.
 */
export async function trackRequestError(
  error: Error | string,
  severity: ErrorSeverity,
  req: Request,
  userId?: string | null,
): Promise<TrackedError> {
  const url = new URL(req.url)

  return trackError(error, severity, {
    userId,
    route: url.pathname,
    method: req.method,
    metadata: {
      userAgent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
    },
  })
}

// ── Error Aggregation ───────────────────────────────────────────────────────

/**
 * Update the aggregate count for an error fingerprint in Redis.
 */
async function updateErrorAggregate(tracked: TrackedError): Promise<void> {
  const key = `${ERROR_AGGREGATE_PREFIX}${tracked.fingerprint}`

  const existing = await redis.get(key)

  if (existing) {
    const agg = JSON.parse(existing) as ErrorAggregate
    agg.count += 1
    agg.lastSeen = tracked.timestamp
    agg.lastContext = tracked.context
    await redis.set(key, JSON.stringify(agg), 'EX', ERROR_AGGREGATE_TTL_SECONDS)
  } else {
    const agg: ErrorAggregate = {
      fingerprint: tracked.fingerprint,
      message: tracked.message,
      severity: tracked.severity,
      count: 1,
      firstSeen: tracked.timestamp,
      lastSeen: tracked.timestamp,
      lastContext: tracked.context,
    }
    await redis.set(key, JSON.stringify(agg), 'EX', ERROR_AGGREGATE_TTL_SECONDS)
  }
}

/**
 * Get aggregated error statistics from Redis.
 * Returns the top errors by count.
 */
export async function getErrorAggregates(limit = 50): Promise<ErrorAggregate[]> {
  try {
    const pattern = `${ERROR_AGGREGATE_PREFIX}*`
    const aggregates: ErrorAggregate[] = []
    let cursor = '0'

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor

      if (keys.length > 0) {
        const values = await redis.mget(...keys)
        for (const val of values) {
          if (val) {
            aggregates.push(JSON.parse(val) as ErrorAggregate)
          }
        }
      }
    } while (cursor !== '0')

    // Sort by count descending and limit
    return aggregates
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  } catch {
    return []
  }
}

// ── Error Log Access ────────────────────────────────────────────────────────

/**
 * Get recent errors from the in-memory buffer.
 */
export function getRecentErrors(options?: {
  severity?: ErrorSeverity
  limit?: number
}): TrackedError[] {
  let entries = [...errorBuffer]

  if (options?.severity) {
    entries = entries.filter((e) => e.severity === options.severity)
  }

  const limit = options?.limit ?? 100
  return entries.slice(-limit)
}

/**
 * Clear the in-memory error buffer.
 */
export function clearErrorBuffer(): void {
  errorBuffer.length = 0
}

// ── Health Check ────────────────────────────────────────────────────────────

/**
 * Run a comprehensive health check against all backend dependencies.
 * Returns component-level status with latency measurements.
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    uptime: checkUptime(),
  }

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status)
  let status: 'healthy' | 'degraded' | 'unhealthy'

  if (statuses.every((s) => s === 'up')) {
    status = 'healthy'
  } else if (statuses.some((s) => s === 'up')) {
    status = 'degraded'
  } else {
    status = 'unhealthy'
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
  }
}

/**
 * Check database connectivity by executing a lightweight query.
 */
async function checkDatabase(): Promise<ComponentHealth> {
  const start = performance.now()
  try {
    await db.execute(sql`SELECT 1`)
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - start),
    }
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check Redis connectivity by pinging the server.
 */
async function checkRedis(): Promise<ComponentHealth> {
  const start = performance.now()
  try {
    const result = await redis.ping()
    return {
      status: result === 'PONG' ? 'up' : 'down',
      latencyMs: Math.round(performance.now() - start),
    }
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check process uptime.
 */
function checkUptime(): ComponentHealth {
  const uptimeMs = Date.now() - startTime
  return {
    status: 'up',
    latencyMs: 0,
    error: undefined,
  }
}

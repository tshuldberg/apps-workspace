import { redis } from '../lib/redis.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Key prefix for Redis (e.g. "api:global" or "api:ideas:create") */
  keyPrefix: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export interface SecurityHeaders {
  'Content-Security-Policy': string
  'X-Content-Type-Options': string
  'X-Frame-Options': string
  'X-XSS-Protection': string
  'Referrer-Policy': string
  'Strict-Transport-Security': string
  'Permissions-Policy': string
}

// ── XSS Sanitization ───────────────────────────────────────────────────────

/**
 * HTML entity map for XSS prevention.
 * Encodes characters that can be used to inject scripts or break out of
 * HTML attributes.
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
}

const HTML_ENTITY_PATTERN = /[&<>"'`/]/g

/**
 * Sanitize a string by encoding HTML entities.
 * Use this for any user-generated content that will be rendered in HTML.
 */
export function sanitizeHtml(input: string): string {
  return input.replace(HTML_ENTITY_PATTERN, (char) => HTML_ENTITIES[char] ?? char)
}

/**
 * Strip all HTML tags from a string. More aggressive than entity encoding —
 * use for contexts where no HTML is ever appropriate (e.g. display names).
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Remove dangerous patterns commonly used in XSS attacks.
 * Strips javascript: URIs, event handlers, data: URIs, and script tags.
 */
export function removeXssPatterns(input: string): string {
  let clean = input

  // Remove javascript: protocol URIs
  clean = clean.replace(/javascript\s*:/gi, '')

  // Remove data: URIs that could contain scripts
  clean = clean.replace(/data\s*:\s*text\/html/gi, '')

  // Remove on* event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\bon\w+\s*=\s*(['"]?)[^'"]*\1/gi, '')

  // Remove script tags and their content
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove style tags with expressions (IE-specific but still relevant)
  clean = clean.replace(/expression\s*\([^)]*\)/gi, '')

  return clean
}

/**
 * Full sanitization pipeline for user-generated content.
 * Applies XSS pattern removal, HTML entity encoding, and trims whitespace.
 */
export function sanitizeUserContent(input: string): string {
  let sanitized = input.trim()
  sanitized = removeXssPatterns(sanitized)
  sanitized = sanitizeHtml(sanitized)
  return sanitized
}

// ── SQL Injection Protection ────────────────────────────────────────────────

/**
 * Patterns that indicate potential SQL injection attempts.
 * Note: With Drizzle ORM's parameterized queries, SQL injection through the
 * ORM is already prevented. This validation catches suspicious input early
 * for defense-in-depth and logging.
 */
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\b(union|select|insert|update|delete|drop|alter|create|exec|execute)\b\s+)/i,
  /(--|;)\s*(union|select|drop|alter|delete|update)/i,
  /'\s*(or|and)\s+\d+\s*=\s*\d+/i,
  /'\s*(or|and)\s+'[^']*'\s*=\s*'[^']*'/i,
  /(\bor\b|\band\b)\s+\d+\s*=\s*\d+/i,
  /;\s*drop\b/i,
  /xp_cmdshell/i,
  /INFORMATION_SCHEMA/i,
]

/**
 * Check if a string contains patterns that resemble SQL injection.
 * Returns true if suspicious patterns are found.
 */
export function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input))
}

/**
 * Validate user input for SQL injection patterns.
 * Throws an error if suspicious input is detected.
 */
export function validateNoSqlInjection(input: string, fieldName: string): void {
  if (detectSqlInjection(input)) {
    throw new Error(`Invalid characters detected in ${fieldName}`)
  }
}

// ── Rate Limiting Middleware ─────────────────────────────────────────────────

/**
 * Redis-backed sliding window rate limiter.
 * Returns whether the request is allowed and the remaining quota.
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${options.keyPrefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - options.windowSeconds * 1000

  try {
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zadd(key, now, `${now}:${Math.random()}`)
    pipeline.zcard(key)
    pipeline.expire(key, options.windowSeconds)

    const results = await pipeline.exec()
    const count = (results?.[2]?.[1] as number) ?? 0
    const remaining = Math.max(0, options.maxRequests - count)

    return {
      allowed: count <= options.maxRequests,
      remaining,
      resetInSeconds: options.windowSeconds,
    }
  } catch {
    // Fail open if Redis is unavailable
    return {
      allowed: true,
      remaining: options.maxRequests,
      resetInSeconds: 0,
    }
  }
}

/** Common rate limit presets */
export const RATE_LIMIT_PRESETS = {
  /** General API: 100 requests per minute */
  api: { maxRequests: 100, windowSeconds: 60, keyPrefix: 'rl:api' },
  /** Auth endpoints: 10 requests per minute */
  auth: { maxRequests: 10, windowSeconds: 60, keyPrefix: 'rl:auth' },
  /** Content creation: 30 per 10 minutes */
  contentCreate: { maxRequests: 30, windowSeconds: 600, keyPrefix: 'rl:create' },
  /** Search: 60 per minute */
  search: { maxRequests: 60, windowSeconds: 60, keyPrefix: 'rl:search' },
  /** Heavy operations (export, backtest): 5 per hour */
  heavy: { maxRequests: 5, windowSeconds: 3600, keyPrefix: 'rl:heavy' },
} as const satisfies Record<string, RateLimitOptions>

// ── CSRF Token Validation ───────────────────────────────────────────────────

/**
 * Validate a CSRF token from request headers.
 * The token should be set as a cookie and also sent in a custom header.
 * This double-submit cookie pattern prevents CSRF attacks.
 */
export function validateCsrfToken(
  headerToken: string | null,
  cookieToken: string | null,
): boolean {
  if (!headerToken || !cookieToken) return false
  if (headerToken.length < 16) return false

  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) return false

  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Content-Security-Policy Headers ─────────────────────────────────────────

/**
 * Generate security headers for HTTP responses.
 * These should be applied at the reverse proxy / CDN level (Vercel, Cloudflare)
 * as well as on the API server.
 */
export function getSecurityHeaders(): SecurityHeaders {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.clerk.dev https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.clerk.com https://*.r2.cloudflarestorage.com",
      "font-src 'self'",
      "connect-src 'self' https://api.clerk.dev https://*.polygon.io wss://*.fly.dev",
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

/**
 * Apply security headers to a Response object.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = getSecurityHeaders()
  const newHeaders = new Headers(response.headers)

  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

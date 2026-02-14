import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import {
  contentReports,
  moderationQueue,
  userModerationState,
} from '../db/schema/moderation.js'
import { redis } from '../lib/redis.js'

// ── Types ───────────────────────────────────────────────────────────────────

export type ContentType = 'idea' | 'comment' | 'chat_message' | 'profile'

export interface ModerationResult {
  allowed: boolean
  flagged: boolean
  reasons: string[]
  sanitizedText: string
}

export interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Report count threshold before auto-escalation to moderation queue */
const AUTO_ESCALATION_THRESHOLD = 3

/** Warnings before automatic mute */
const WARN_BEFORE_MUTE = 3

/** Rate limits per content type */
const RATE_LIMITS: Record<ContentType, RateLimitConfig> = {
  idea: { windowSeconds: 3600, maxRequests: 10 },
  comment: { windowSeconds: 600, maxRequests: 30 },
  chat_message: { windowSeconds: 60, maxRequests: 20 },
  profile: { windowSeconds: 3600, maxRequests: 5 },
}

// ── Profanity / Spam Detection ──────────────────────────────────────────────

/**
 * Common profanity patterns. In production these would load from a
 * configurable wordlist; this inline set covers the most egregious terms.
 */
const PROFANITY_PATTERNS: RegExp[] = [
  /\b(f+u+c+k+|sh+i+t+|a+ss+h+o+l+e+|b+i+t+c+h+|d+a+m+n+|c+u+n+t+)\b/i,
  /\b(n+i+g+g+[ae]+r?|f+a+g+g?o+t+|r+e+t+a+r+d+)\b/i,
]

/** URL spam: more than 3 URLs in a single message */
const URL_PATTERN = /https?:\/\/[^\s]+/gi

/** Repeated character spam (e.g. "aaaaaaaaa") */
const REPEATED_CHAR_PATTERN = /(.)\1{9,}/

/** All-caps spam: >80% uppercase when text is longer than 20 chars */
function isAllCapSpam(text: string): boolean {
  if (text.length < 20) return false
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length === 0) return false
  const uppercase = letters.replace(/[^A-Z]/g, '')
  return uppercase.length / letters.length > 0.8
}

// ── Core Moderation ─────────────────────────────────────────────────────────

/**
 * Run content through all moderation filters.
 * Returns whether the content is allowed, whether it was flagged,
 * the reasons it was flagged (if any), and the sanitized text.
 */
export async function moderateContent(
  text: string,
  userId: string,
  contentType: ContentType = 'chat_message',
): Promise<ModerationResult> {
  const reasons: string[] = []
  let sanitizedText = text.trim()

  // 1. Check if user is banned or muted
  const userState = await getUserModerationState(userId)
  if (userState?.isBanned) {
    return {
      allowed: false,
      flagged: true,
      reasons: ['User is banned'],
      sanitizedText: '',
    }
  }
  if (userState?.isMuted) {
    if (userState.mutedUntil && new Date(userState.mutedUntil) > new Date()) {
      return {
        allowed: false,
        flagged: true,
        reasons: ['User is muted'],
        sanitizedText: '',
      }
    }
  }

  // 2. Rate limiting
  const rateLimitOk = await checkRateLimit(userId, contentType)
  if (!rateLimitOk) {
    return {
      allowed: false,
      flagged: false,
      reasons: ['Rate limit exceeded'],
      sanitizedText: '',
    }
  }

  // 3. Profanity filter
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      reasons.push('profanity')
      // Censor the match
      sanitizedText = sanitizedText.replace(pattern, (match) =>
        match[0] + '*'.repeat(match.length - 1),
      )
    }
  }

  // 4. URL spam detection (>3 URLs)
  const urls = sanitizedText.match(URL_PATTERN) ?? []
  if (urls.length > 3) {
    reasons.push('url_spam')
  }

  // 5. Repeated character spam
  if (REPEATED_CHAR_PATTERN.test(sanitizedText)) {
    reasons.push('character_spam')
  }

  // 6. All-caps spam
  if (isAllCapSpam(sanitizedText)) {
    reasons.push('caps_spam')
  }

  // 7. Empty content after trim
  if (sanitizedText.length === 0) {
    return {
      allowed: false,
      flagged: false,
      reasons: ['Empty content'],
      sanitizedText: '',
    }
  }

  const flagged = reasons.length > 0

  return {
    allowed: !flagged || reasons.every((r) => r === 'caps_spam'),
    flagged,
    reasons,
    sanitizedText,
  }
}

// ── Rate Limiting ───────────────────────────────────────────────────────────

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns true if the request is within limits.
 */
export async function checkRateLimit(
  userId: string,
  contentType: ContentType,
): Promise<boolean> {
  const config = RATE_LIMITS[contentType]
  const key = `ratelimit:${contentType}:${userId}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  try {
    // Remove entries outside the window, add current, count
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zadd(key, now, `${now}:${Math.random()}`)
    pipeline.zcard(key)
    pipeline.expire(key, config.windowSeconds)

    const results = await pipeline.exec()
    const count = results?.[2]?.[1] as number ?? 0

    return count <= config.maxRequests
  } catch {
    // If Redis is down, allow the request (fail open for rate limiting)
    return true
  }
}

/**
 * Get the current rate limit status for a user+contentType.
 */
export async function getRateLimitStatus(
  userId: string,
  contentType: ContentType,
): Promise<{ remaining: number; resetInSeconds: number }> {
  const config = RATE_LIMITS[contentType]
  const key = `ratelimit:${contentType}:${userId}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  try {
    await redis.zremrangebyscore(key, 0, windowStart)
    const count = await redis.zcard(key)
    const remaining = Math.max(0, config.maxRequests - count)

    // Oldest entry determines when the window resets
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
    const resetInSeconds =
      oldest.length >= 2
        ? Math.max(0, Math.ceil((Number(oldest[1]) + config.windowSeconds * 1000 - now) / 1000))
        : 0

    return { remaining, resetInSeconds }
  } catch {
    return { remaining: config.maxRequests, resetInSeconds: 0 }
  }
}

// ── Report / Flag System ────────────────────────────────────────────────────

/**
 * Submit a content report. If the content crosses the escalation threshold,
 * it is automatically added to the moderation queue.
 */
export async function reportContent(params: {
  reporterId: string
  contentType: ContentType
  contentId: string
  authorId: string
  reason: string
  description?: string
}): Promise<{ reportId: string; escalated: boolean }> {
  // Upsert the report (one per reporter per content item)
  const [report] = await db
    .insert(contentReports)
    .values({
      reporterId: params.reporterId,
      contentType: params.contentType,
      contentId: params.contentId,
      reason: params.reason as 'spam' | 'harassment' | 'hate_speech' | 'misinformation' | 'inappropriate' | 'self_harm' | 'other',
      description: params.description,
    })
    .onConflictDoNothing()
    .returning()

  if (!report) {
    // Already reported by this user
    return { reportId: '', escalated: false }
  }

  // Count total reports for this content
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.contentType, params.contentType),
        eq(contentReports.contentId, params.contentId),
      ),
    )

  const totalReports = countResult?.count ?? 0
  let escalated = false

  // Auto-escalate if threshold is met
  if (totalReports >= AUTO_ESCALATION_THRESHOLD) {
    // Check if already in moderation queue
    const [existing] = await db
      .select({ id: moderationQueue.id })
      .from(moderationQueue)
      .where(
        and(
          eq(moderationQueue.contentType, params.contentType),
          eq(moderationQueue.contentId, params.contentId),
        ),
      )
      .limit(1)

    if (existing) {
      // Update report count
      await db
        .update(moderationQueue)
        .set({
          reportCount: totalReports,
          status: 'escalated',
          updatedAt: new Date(),
        })
        .where(eq(moderationQueue.id, existing.id))
    } else {
      // Add to moderation queue
      await db.insert(moderationQueue).values({
        contentType: params.contentType,
        contentId: params.contentId,
        authorId: params.authorId,
        reason: `Auto-escalated: ${totalReports} reports received`,
        reportCount: totalReports,
        status: 'escalated',
      })
    }

    escalated = true
  }

  return { reportId: report.id, escalated }
}

// ── Moderation Queue Management ─────────────────────────────────────────────

/**
 * Get pending items in the moderation queue (for admin UI).
 */
export async function getModerationQueueItems(params: {
  status?: string
  limit?: number
  offset?: number
}) {
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0

  const conditions = []
  if (params.status) {
    conditions.push(
      eq(moderationQueue.status, params.status as 'pending' | 'approved' | 'rejected' | 'auto_flagged' | 'escalated'),
    )
  }

  const items = await db
    .select()
    .from(moderationQueue)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(moderationQueue.createdAt)
    .limit(limit)
    .offset(offset)

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationQueue)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return {
    items,
    totalCount: countResult?.count ?? 0,
  }
}

/**
 * Take a moderation action on a queued item.
 */
export async function moderateItem(params: {
  queueItemId: string
  moderatorId: string
  action: 'approve' | 'reject' | 'warn' | 'mute' | 'ban'
  note?: string
}) {
  const [item] = await db
    .select()
    .from(moderationQueue)
    .where(eq(moderationQueue.id, params.queueItemId))
    .limit(1)

  if (!item) {
    throw new Error('Moderation queue item not found')
  }

  // Update queue item
  const newStatus = params.action === 'approve' ? 'approved' : 'rejected'

  await db
    .update(moderationQueue)
    .set({
      status: newStatus as 'approved' | 'rejected',
      moderatorId: params.moderatorId,
      moderatorAction: params.action,
      moderatorNote: params.note,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(moderationQueue.id, params.queueItemId))

  // Update all related reports
  await db
    .update(contentReports)
    .set({
      status: newStatus as 'approved' | 'rejected',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contentReports.contentType, item.contentType),
        eq(contentReports.contentId, item.contentId),
      ),
    )

  // Apply user-level action if needed
  if (params.action === 'warn' || params.action === 'mute' || params.action === 'ban') {
    await applyUserAction(item.authorId, params.action, params.note)
  }

  return { status: newStatus, action: params.action }
}

// ── User Moderation State ───────────────────────────────────────────────────

/**
 * Get or create the moderation state for a user.
 */
async function getUserModerationState(userId: string) {
  const [state] = await db
    .select()
    .from(userModerationState)
    .where(eq(userModerationState.userId, userId))
    .limit(1)

  return state
}

/**
 * Apply a moderation action to a user (warn, mute, or ban).
 */
async function applyUserAction(
  userId: string,
  action: 'warn' | 'mute' | 'ban',
  reason?: string,
) {
  const existing = await getUserModerationState(userId)

  if (!existing) {
    // Create initial state
    const values: Record<string, unknown> = { userId }

    if (action === 'warn') {
      values.warnings = 1
      // Auto-mute after threshold
      if (1 >= WARN_BEFORE_MUTE) {
        values.isMuted = true
        values.mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h mute
      }
    } else if (action === 'mute') {
      values.isMuted = true
      values.mutedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h mute
    } else if (action === 'ban') {
      values.isBanned = true
      values.bannedAt = new Date()
      values.banReason = reason
    }

    await db.insert(userModerationState).values(values as typeof userModerationState.$inferInsert)
    return
  }

  if (action === 'warn') {
    const newWarnings = existing.warnings + 1
    const shouldMute = newWarnings >= WARN_BEFORE_MUTE

    await db
      .update(userModerationState)
      .set({
        warnings: newWarnings,
        isMuted: shouldMute || existing.isMuted,
        mutedUntil: shouldMute
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : existing.mutedUntil,
        updatedAt: new Date(),
      })
      .where(eq(userModerationState.userId, userId))
  } else if (action === 'mute') {
    await db
      .update(userModerationState)
      .set({
        isMuted: true,
        mutedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(userModerationState.userId, userId))
  } else if (action === 'ban') {
    await db
      .update(userModerationState)
      .set({
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(userModerationState.userId, userId))
  }
}

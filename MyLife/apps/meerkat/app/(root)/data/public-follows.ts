// Public-tier follows (Plan 39 P10, screens S8/S9). The device's OWN choice of which public
// personas and Commons topics to surface in its Following feed. Backed by cm_public_follows, which
// is DEVICE-LOCAL by policy (never replicates): a follow is a private viewing preference, not a
// shared or published signal. The host aggregates public follower counts from a separate
// registration, never from this table, so nothing here fabricates a public count (NC-P6).

import type { DatabaseAdapter } from '@mylife/db';
import { CM_PUBLIC_FOLLOWS_TABLE } from './community-core';

export type FollowKind = 'persona' | 'topic';

export interface PublicFollow {
  kind: FollowKind;
  /** Persona pubkey (lowercased hex) for 'persona', or Commons channel id for 'topic'. */
  targetId: string;
  /** Cached alias/title for list rendering without a network round-trip. */
  displayHint: string;
  createdAt: string;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

/** Normalize a follow target: persona pubkeys are case-folded hex; topic ids pass through trimmed. */
function normalizeTarget(kind: FollowKind, targetId: string): string {
  const trimmed = targetId.trim();
  return kind === 'persona' ? trimmed.toLowerCase() : trimmed;
}

/** True when a target is a well-formed follow subject (a hex persona key, or a non-empty topic id). */
function isValidTarget(kind: FollowKind, targetId: string): boolean {
  if (targetId.length === 0) return false;
  return kind === 'persona' ? HEX_64.test(targetId) : true;
}

/** Follow a persona or topic. Idempotent (PRIMARY KEY on kind+target). No-op on a malformed target. */
export function followPublic(db: DatabaseAdapter, kind: FollowKind, targetId: string, displayHint = ''): void {
  const target = normalizeTarget(kind, targetId);
  if (!isValidTarget(kind, target)) return;
  // Upsert that PRESERVES created_at on a re-follow (only display_hint refreshes), so following an
  // already-followed target is truly idempotent and never reorders the newest-first Following list.
  db.execute(
    `INSERT INTO ${CM_PUBLIC_FOLLOWS_TABLE} (follow_kind, target_id, display_hint, created_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(follow_kind, target_id) DO UPDATE SET display_hint = excluded.display_hint`,
    [kind, target, displayHint.slice(0, 64)],
  );
}

/** Unfollow a persona or topic. Idempotent. */
export function unfollowPublic(db: DatabaseAdapter, kind: FollowKind, targetId: string): void {
  const target = normalizeTarget(kind, targetId);
  db.execute(
    `DELETE FROM ${CM_PUBLIC_FOLLOWS_TABLE} WHERE follow_kind = ? AND target_id = ?`,
    [kind, target],
  );
}

/** Whether this device currently follows the target. */
export function isFollowingPublic(db: DatabaseAdapter, kind: FollowKind, targetId: string): boolean {
  const target = normalizeTarget(kind, targetId);
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${CM_PUBLIC_FOLLOWS_TABLE} WHERE follow_kind = ? AND target_id = ?`,
    [kind, target],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/** Toggle follow state; returns the NEW state (true = now following). No-op returns false on bad target. */
export function toggleFollowPublic(db: DatabaseAdapter, kind: FollowKind, targetId: string, displayHint = ''): boolean {
  const target = normalizeTarget(kind, targetId);
  if (!isValidTarget(kind, target)) return false;
  if (isFollowingPublic(db, kind, target)) {
    unfollowPublic(db, kind, target);
    return false;
  }
  followPublic(db, kind, target, displayHint);
  return true;
}

/** List the device's follows, newest first, optionally filtered to one kind. */
export function listPublicFollows(db: DatabaseAdapter, kind?: FollowKind): PublicFollow[] {
  const where = kind ? 'WHERE follow_kind = ?' : '';
  const params = kind ? [kind] : [];
  const rows = db.query<{ follow_kind: string; target_id: string; display_hint: string; created_at: string }>(
    `SELECT follow_kind, target_id, display_hint, created_at FROM ${CM_PUBLIC_FOLLOWS_TABLE} ${where} ORDER BY created_at DESC`,
    params,
  );
  return rows
    .filter((r) => r.follow_kind === 'persona' || r.follow_kind === 'topic')
    .map((r) => ({
      kind: r.follow_kind as FollowKind,
      targetId: r.target_id,
      displayHint: r.display_hint ?? '',
      createdAt: r.created_at,
    }));
}

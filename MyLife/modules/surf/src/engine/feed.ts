import type { DatabaseAdapter } from '@mylife/db';
import type { SharedSession } from '../types';
import { getFeedForUser, getSharedSessionsByUser } from '../db/crud';

/**
 * Build a paginated activity feed for a user, combining sessions from
 * followed surfers. Supports cursor-based pagination via createdBefore.
 */
export function buildFeed(
  db: DatabaseAdapter,
  userId: string,
  options?: { limit?: number; createdBefore?: string },
): SharedSession[] {
  const limit = options?.limit ?? 30;

  return getFeedForUser(db, userId, limit, options?.createdBefore);
}

/**
 * Build a user's own session timeline (their profile).
 */
export function buildProfileTimeline(
  db: DatabaseAdapter,
  userId: string,
  limit: number = 30,
): SharedSession[] {
  return getSharedSessionsByUser(db, userId, limit);
}

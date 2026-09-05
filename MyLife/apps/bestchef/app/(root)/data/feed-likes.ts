import type { DatabaseAdapter } from '@mylife/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSubmissionLikeState,
  setSubmissionLike,
} from '@mylife/bestchef';

const LIKES_TABLE = 'rc_bestchef_submission_likes';
const QUEUE_TABLE = 'rc_bestchef_submission_like_queue';
const LOCAL_VIEWER_ID = 'local-viewer';

interface LikeRow {
  target_id: string;
  viewer_id: string;
  cloud_submission_id: string | null;
  liked: number;
  like_count: number;
  pending: number;
  updated_at: string;
}

interface QueueRow {
  id: string;
  target_id: string;
  viewer_id: string;
  cloud_submission_id: string | null;
  desired_liked: number;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionLikeState {
  targetId: string;
  viewerId: string;
  cloudSubmissionId: string | null;
  liked: boolean;
  likeCount: number;
  pending: boolean;
  updatedAt: string;
}

export interface SubmissionLikeTarget {
  localTargetId: string;
  viewerId: string;
  fallbackCount: number;
  cloudSubmissionId?: string | null;
}

export interface SubmissionLikeCloudOptions {
  supabase?: SupabaseClient | null;
}

interface BestChefSyncDatabaseAdapter extends DatabaseAdapter {
  syncDeviceId?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function boolInt(value: boolean): number {
  return value ? 1 : 0;
}

function rowToState(row: LikeRow): SubmissionLikeState {
  return {
    targetId: row.target_id,
    viewerId: row.viewer_id,
    cloudSubmissionId: row.cloud_submission_id,
    liked: row.liked === 1,
    likeCount: Math.max(0, row.like_count),
    pending: row.pending === 1,
    updatedAt: row.updated_at,
  };
}

function fallbackState(target: SubmissionLikeTarget): SubmissionLikeState {
  return {
    targetId: target.localTargetId,
    viewerId: target.viewerId,
    cloudSubmissionId: target.cloudSubmissionId ?? null,
    liked: false,
    likeCount: Math.max(0, target.fallbackCount),
    pending: false,
    updatedAt: nowIso(),
  };
}

export function getSubmissionLikeViewerId(
  db: DatabaseAdapter,
  profile: { id?: string | null } | null | undefined,
): string {
  return profile?.id ?? (db as BestChefSyncDatabaseAdapter).syncDeviceId ?? LOCAL_VIEWER_ID;
}

export function ensureSubmissionLikeTables(db: DatabaseAdapter): void {
  db.execute(
    `CREATE TABLE IF NOT EXISTS ${LIKES_TABLE} (
      target_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      cloud_submission_id TEXT,
      liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1)),
      like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
      pending INTEGER NOT NULL DEFAULT 0 CHECK (pending IN (0, 1)),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (target_id, viewer_id)
    )`,
  );
  db.execute(
    `CREATE TABLE IF NOT EXISTS ${QUEUE_TABLE} (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      viewer_id TEXT NOT NULL,
      cloud_submission_id TEXT,
      desired_liked INTEGER NOT NULL CHECK (desired_liked IN (0, 1)),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (target_id, viewer_id)
    )`,
  );
  db.execute(
    `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_likes_target_idx
     ON ${LIKES_TABLE}(target_id, updated_at DESC)`,
  );
  db.execute(
    `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_like_queue_target_idx
     ON ${QUEUE_TABLE}(target_id, updated_at DESC)`,
  );
  db.execute(
    `CREATE INDEX IF NOT EXISTS rc_bestchef_submission_like_queue_cloud_idx
     ON ${QUEUE_TABLE}(cloud_submission_id, updated_at DESC)`,
  );
}

export function getCachedSubmissionLikeState(
  db: DatabaseAdapter,
  target: SubmissionLikeTarget,
): SubmissionLikeState {
  ensureSubmissionLikeTables(db);
  const rows = db.query<LikeRow>(
    `SELECT * FROM ${LIKES_TABLE}
     WHERE target_id = ? AND viewer_id = ?
     LIMIT 1`,
    [target.localTargetId, target.viewerId],
  );
  const row = rows[0];
  if (!row) return fallbackState(target);
  return rowToState({
    ...row,
    cloud_submission_id: row.cloud_submission_id ?? target.cloudSubmissionId ?? null,
  });
}

function saveSubmissionLikeState(
  db: DatabaseAdapter,
  state: SubmissionLikeState,
): void {
  ensureSubmissionLikeTables(db);
  db.execute(
    `INSERT INTO ${LIKES_TABLE} (
      target_id, viewer_id, cloud_submission_id, liked, like_count, pending, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(target_id, viewer_id) DO UPDATE SET
      cloud_submission_id = excluded.cloud_submission_id,
      liked = excluded.liked,
      like_count = excluded.like_count,
      pending = excluded.pending,
      updated_at = excluded.updated_at`,
    [
      state.targetId,
      state.viewerId,
      state.cloudSubmissionId,
      boolInt(state.liked),
      Math.max(0, state.likeCount),
      boolInt(state.pending),
      state.updatedAt,
    ],
  );
}

function queueSubmissionLikeSync(
  db: DatabaseAdapter,
  state: SubmissionLikeState,
  lastError: string | null = null,
): string {
  ensureSubmissionLikeTables(db);
  const timestamp = nowIso();
  const id = createId('submission-like');
  db.execute(
    `INSERT INTO ${QUEUE_TABLE} (
      id, target_id, viewer_id, cloud_submission_id, desired_liked,
      attempt_count, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    ON CONFLICT(target_id, viewer_id) DO UPDATE SET
      cloud_submission_id = excluded.cloud_submission_id,
      desired_liked = excluded.desired_liked,
      last_error = excluded.last_error,
      id = excluded.id,
      updated_at = excluded.updated_at`,
    [
      id,
      state.targetId,
      state.viewerId,
      state.cloudSubmissionId,
      boolInt(state.liked),
      lastError,
      timestamp,
      timestamp,
    ],
  );
  return id;
}

function deleteQueueRow(
  db: DatabaseAdapter,
  targetId: string,
  viewerId: string,
  queueId?: string,
): void {
  if (queueId) {
    db.execute(
      `DELETE FROM ${QUEUE_TABLE} WHERE target_id = ? AND viewer_id = ? AND id = ?`,
      [targetId, viewerId, queueId],
    );
    return;
  }
  db.execute(
    `DELETE FROM ${QUEUE_TABLE} WHERE target_id = ? AND viewer_id = ?`,
    [targetId, viewerId],
  );
}

function updateQueueError(
  db: DatabaseAdapter,
  row: QueueRow,
  message: string,
): void {
  db.execute(
    `UPDATE ${QUEUE_TABLE}
     SET attempt_count = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [row.attempt_count + 1, message, nowIso(), row.id],
  );
}

function getPendingQueueRow(
  db: DatabaseAdapter,
  targetId: string,
  viewerId: string,
): QueueRow | null {
  const rows = db.query<QueueRow>(
    `SELECT * FROM ${QUEUE_TABLE}
     WHERE target_id = ? AND viewer_id = ?
     LIMIT 1`,
    [targetId, viewerId],
  );
  return rows[0] ?? null;
}

function attachCloudSubmissionId(
  db: DatabaseAdapter,
  target: SubmissionLikeTarget,
  cloudSubmissionId: string,
): void {
  db.execute(
    `UPDATE ${LIKES_TABLE}
     SET cloud_submission_id = ?, updated_at = ?
     WHERE target_id = ? AND viewer_id = ?`,
    [cloudSubmissionId, nowIso(), target.localTargetId, target.viewerId],
  );
  db.execute(
    `UPDATE ${QUEUE_TABLE}
     SET cloud_submission_id = ?, updated_at = ?
     WHERE target_id = ? AND viewer_id = ?`,
    [cloudSubmissionId, nowIso(), target.localTargetId, target.viewerId],
  );
}

export function buildOptimisticSubmissionLikeState(
  current: SubmissionLikeState,
  liked: boolean,
  cloudSubmissionId: string | null = current.cloudSubmissionId,
): SubmissionLikeState {
  const delta = current.liked === liked ? 0 : liked ? 1 : -1;
  return {
    ...current,
    cloudSubmissionId,
    liked,
    likeCount: Math.max(0, current.likeCount + delta),
    pending: true,
    updatedAt: nowIso(),
  };
}

export async function setSubmissionLikeDesired(
  db: DatabaseAdapter,
  target: SubmissionLikeTarget,
  liked: boolean,
  options: SubmissionLikeCloudOptions = {},
): Promise<SubmissionLikeState> {
  const current = getCachedSubmissionLikeState(db, target);
  const optimistic = buildOptimisticSubmissionLikeState(
    current,
    liked,
    target.cloudSubmissionId ?? current.cloudSubmissionId,
  );
  saveSubmissionLikeState(db, optimistic);
  const queueId = queueSubmissionLikeSync(db, optimistic);

  if (!options.supabase || !optimistic.cloudSubmissionId) return optimistic;

  const result = await setSubmissionLike({
    submissionId: optimistic.cloudSubmissionId,
    liked,
  }, options.supabase);
  if (!result.ok) {
    const pending = getPendingQueueRow(db, target.localTargetId, target.viewerId);
    if (pending?.id === queueId) updateQueueError(db, pending, result.error);
    return getCachedSubmissionLikeState(db, target);
  }

  const pending = getPendingQueueRow(db, target.localTargetId, target.viewerId);
  if (pending?.id !== queueId || pending.desired_liked !== boolInt(liked)) {
    return getCachedSubmissionLikeState(db, target);
  }

  const synced: SubmissionLikeState = {
    ...optimistic,
    liked: result.data.liked,
    likeCount: result.data.likeCount,
    pending: false,
    updatedAt: nowIso(),
  };
  saveSubmissionLikeState(db, synced);
  deleteQueueRow(db, target.localTargetId, target.viewerId, queueId);
  return synced;
}

export async function drainPendingSubmissionLikes(
  db: DatabaseAdapter,
  options: SubmissionLikeCloudOptions & {
    viewerId: string;
    targetId?: string;
    limit?: number;
  },
): Promise<SubmissionLikeState[]> {
  ensureSubmissionLikeTables(db);
  if (!options.supabase) return [];

  const params: unknown[] = [options.viewerId];
  const targetFilter = options.targetId ? 'AND target_id = ?' : '';
  if (options.targetId) params.push(options.targetId);
  params.push(Math.max(1, options.limit ?? 20));

  const rows = db.query<QueueRow>(
    `SELECT * FROM ${QUEUE_TABLE}
     WHERE viewer_id = ?
       AND cloud_submission_id IS NOT NULL
       ${targetFilter}
     ORDER BY updated_at ASC
     LIMIT ?`,
    params,
  );

  const syncedStates: SubmissionLikeState[] = [];
  for (const row of rows) {
    const cloudSubmissionId = row.cloud_submission_id;
    if (!cloudSubmissionId) continue;
    const liked = row.desired_liked === 1;
    const result = await setSubmissionLike({
      submissionId: cloudSubmissionId,
      liked,
    }, options.supabase);

    if (!result.ok) {
      const pending = getPendingQueueRow(db, row.target_id, row.viewer_id);
      if (pending?.id === row.id) updateQueueError(db, pending, result.error);
      continue;
    }

    const pending = getPendingQueueRow(db, row.target_id, row.viewer_id);
    if (pending?.id !== row.id || pending.desired_liked !== row.desired_liked) continue;

    const state: SubmissionLikeState = {
      targetId: row.target_id,
      viewerId: row.viewer_id,
      cloudSubmissionId,
      liked: result.data.liked,
      likeCount: result.data.likeCount,
      pending: false,
      updatedAt: nowIso(),
    };
    saveSubmissionLikeState(db, state);
    deleteQueueRow(db, row.target_id, row.viewer_id, row.id);
    syncedStates.push(state);
  }

  return syncedStates;
}

export async function syncSubmissionLikeState(
  db: DatabaseAdapter,
  target: SubmissionLikeTarget,
  options: SubmissionLikeCloudOptions = {},
): Promise<SubmissionLikeState> {
  ensureSubmissionLikeTables(db);
  const cached = getCachedSubmissionLikeState(db, target);
  const cloudSubmissionId = target.cloudSubmissionId ?? cached.cloudSubmissionId;
  if (!options.supabase || !cloudSubmissionId) return cached;

  attachCloudSubmissionId(db, target, cloudSubmissionId);
  await drainPendingSubmissionLikes(db, {
    supabase: options.supabase,
    viewerId: target.viewerId,
    targetId: target.localTargetId,
    limit: 1,
  });

  const pending = getPendingQueueRow(db, target.localTargetId, target.viewerId);
  if (pending) {
    return getCachedSubmissionLikeState(db, {
      ...target,
      cloudSubmissionId,
    });
  }

  const result = await getSubmissionLikeState({ submissionId: cloudSubmissionId }, options.supabase);
  if (!result.ok) return cached;

  const synced: SubmissionLikeState = {
    targetId: target.localTargetId,
    viewerId: target.viewerId,
    cloudSubmissionId,
    liked: result.data.liked,
    likeCount: result.data.likeCount,
    pending: false,
    updatedAt: nowIso(),
  };
  saveSubmissionLikeState(db, synced);
  return synced;
}

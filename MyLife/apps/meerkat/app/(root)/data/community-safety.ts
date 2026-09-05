import type { DatabaseAdapter } from '@mylife/db';

export type CommunitySafetyTargetKind = 'community' | 'channel' | 'person' | 'message' | 'post' | 'file';
export type CommunitySafetyActionKind = 'mute' | 'block' | 'report';
export type CommunitySafetyStatus = 'active' | 'reviewed' | 'dismissed';

export interface CommunitySafetyActionRow {
  id: string;
  community_id: string;
  channel_id: string | null;
  target_kind: CommunitySafetyTargetKind;
  target_id: string;
  target_author_device_id: string | null;
  action: CommunitySafetyActionKind;
  status: CommunitySafetyStatus;
  reason: string | null;
  target_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunitySafetyIndex {
  communityId: string;
  blockedPersonIds: ReadonlySet<string>;
  hiddenMessageIds: ReadonlySet<string>;
  hiddenPostIds: ReadonlySet<string>;
  hiddenFileIds: ReadonlySet<string>;
}

export interface RecordCommunitySafetyActionInput {
  communityId: string;
  channelId?: string | null;
  targetKind: CommunitySafetyTargetKind;
  targetId: string;
  targetAuthorDeviceId?: string | null;
  action: CommunitySafetyActionKind;
  reason?: string | null;
  targetLabel?: string | null;
  now?: string;
}

function safetyActionId(
  communityId: string,
  targetKind: CommunitySafetyTargetKind,
  targetId: string,
  action: CommunitySafetyActionKind,
): string {
  return `${communityId}:${targetKind}:${targetId}:${action}`;
}

function nowIso(input?: string): string {
  return input ?? new Date().toISOString();
}

function activeTargetActionExists(
  db: DatabaseAdapter,
  communityId: string,
  targetKind: CommunitySafetyTargetKind,
  targetId: string,
  action: CommunitySafetyActionKind,
): boolean {
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM cm_safety_actions
     WHERE community_id = ?
       AND target_kind = ?
       AND target_id = ?
       AND action = ?
       AND status = 'active'`,
    [communityId, targetKind, targetId, action],
  );
  return (rows[0]?.n ?? 0) > 0;
}

export function recordCommunitySafetyAction(
  db: DatabaseAdapter,
  input: RecordCommunitySafetyActionInput,
): CommunitySafetyActionRow {
  const id = safetyActionId(input.communityId, input.targetKind, input.targetId, input.action);
  const now = nowIso(input.now);
  const previous = db.query<{ created_at: string }>(
    'SELECT created_at FROM cm_safety_actions WHERE id = ? LIMIT 1',
    [id],
  )[0];
  const row: CommunitySafetyActionRow = {
    id,
    community_id: input.communityId,
    channel_id: input.channelId ?? null,
    target_kind: input.targetKind,
    target_id: input.targetId,
    target_author_device_id: input.targetAuthorDeviceId ?? null,
    action: input.action,
    status: 'active',
    reason: input.reason ?? null,
    target_label: input.targetLabel ?? null,
    created_at: previous?.created_at ?? now,
    updated_at: now,
  };
  db.execute(
    `INSERT OR REPLACE INTO cm_safety_actions (
      id, community_id, channel_id, target_kind, target_id,
      target_author_device_id, action, status, reason, target_label,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.community_id,
      row.channel_id,
      row.target_kind,
      row.target_id,
      row.target_author_device_id,
      row.action,
      row.status,
      row.reason,
      row.target_label,
      row.created_at,
      row.updated_at,
    ],
  );
  return row;
}

export function clearCommunitySafetyAction(
  db: DatabaseAdapter,
  communityId: string,
  targetKind: CommunitySafetyTargetKind,
  targetId: string,
  action: CommunitySafetyActionKind,
): void {
  db.execute(
    `DELETE FROM cm_safety_actions
     WHERE id = ?`,
    [safetyActionId(communityId, targetKind, targetId, action)],
  );
}

export function setCommunityMuted(
  db: DatabaseAdapter,
  communityId: string,
  muted: boolean,
  targetLabel?: string,
): void {
  if (muted) {
    recordCommunitySafetyAction(db, {
      communityId,
      targetKind: 'community',
      targetId: communityId,
      action: 'mute',
      targetLabel,
    });
    return;
  }
  clearCommunitySafetyAction(db, communityId, 'community', communityId, 'mute');
}

export function isCommunityMuted(db: DatabaseAdapter, communityId: string): boolean {
  return activeTargetActionExists(db, communityId, 'community', communityId, 'mute');
}

export function setChannelMuted(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  muted: boolean,
  targetLabel?: string,
): void {
  const id = `${communityId}:${channelId}`;
  const now = new Date().toISOString();
  const existing = db.query<{ id: string }>('SELECT id FROM cm_read_state WHERE id = ? LIMIT 1', [id])[0];
  if (existing) {
    db.execute(
      `UPDATE cm_read_state
       SET mute = ?, snooze_until = NULL, updated_at = ?
       WHERE id = ?`,
      [muted ? 1 : 0, now, id],
    );
  } else {
    db.execute(
      `INSERT INTO cm_read_state (
        id, community_id, channel_id, last_read_wall, last_read_counter, updated_at, mute
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, communityId, channelId, null, null, now, muted ? 1 : 0],
    );
  }

  if (muted) {
    recordCommunitySafetyAction(db, {
      communityId,
      channelId,
      targetKind: 'channel',
      targetId: channelId,
      action: 'mute',
      targetLabel,
    });
    return;
  }
  clearCommunitySafetyAction(db, communityId, 'channel', channelId, 'mute');
}

export function isChannelMuted(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): boolean {
  const id = `${communityId}:${channelId}`;
  const readState = db.query<{ mute: number | null; snooze_until: string | null }>(
    `SELECT mute, snooze_until
     FROM cm_read_state
     WHERE id = ?
     LIMIT 1`,
    [id],
  )[0];
  if (readState?.mute === 1) return true;
  if (readState?.snooze_until) {
    const until = new Date(readState.snooze_until);
    if (Number.isFinite(until.getTime()) && until > new Date()) return true;
  }
  return activeTargetActionExists(db, communityId, 'channel', channelId, 'mute');
}

export function blockCommunityPerson(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
  targetLabel?: string,
): void {
  recordCommunitySafetyAction(db, {
    communityId,
    targetKind: 'person',
    targetId: deviceId,
    targetAuthorDeviceId: deviceId,
    action: 'block',
    targetLabel,
  });
}

export function isCommunityPersonBlocked(
  db: DatabaseAdapter,
  communityId: string,
  deviceId: string,
): boolean {
  return activeTargetActionExists(db, communityId, 'person', deviceId, 'block');
}

/**
 * Load the person-block and content-report state needed by a community read model
 * in one query. Feed and reaction renderers use this immutable snapshot instead
 * of issuing two safety queries for every verified event.
 */
export function createCommunitySafetyIndex(
  db: DatabaseAdapter,
  communityId: string,
): CommunitySafetyIndex {
  const rows = db.query<Pick<CommunitySafetyActionRow, 'target_kind' | 'target_id' | 'action' | 'status'>>(
    `SELECT target_kind, target_id, action, status
     FROM cm_safety_actions
     WHERE community_id = ?
       AND (
         (target_kind = 'person' AND action = 'block' AND status = 'active')
         OR
         (target_kind IN ('message', 'post', 'file')
           AND action = 'report'
           AND status IN ('active', 'reviewed'))
       )`,
    [communityId],
  );
  const blockedPersonIds = new Set<string>();
  const hiddenMessageIds = new Set<string>();
  const hiddenPostIds = new Set<string>();
  const hiddenFileIds = new Set<string>();

  for (const row of rows) {
    if (row.target_kind === 'person' && row.action === 'block' && row.status === 'active') {
      blockedPersonIds.add(row.target_id);
    } else if (row.target_kind === 'message') {
      hiddenMessageIds.add(row.target_id);
    } else if (row.target_kind === 'post') {
      hiddenPostIds.add(row.target_id);
    } else if (row.target_kind === 'file') {
      hiddenFileIds.add(row.target_id);
    }
  }

  return {
    communityId,
    blockedPersonIds,
    hiddenMessageIds,
    hiddenPostIds,
    hiddenFileIds,
  };
}

export function reportCommunityContent(
  db: DatabaseAdapter,
  input: Omit<RecordCommunitySafetyActionInput, 'action'>,
): CommunitySafetyActionRow {
  return recordCommunitySafetyAction(db, { ...input, action: 'report' });
}

/**
 * A reported item stays hidden while its report is `active` OR `reviewed`.
 * "Reviewed" means "the owner looked and is keeping it hidden"; only an explicit
 * `dismissed` (Un-hide) shows it again. Decoupling hidden-ness from review status
 * is the D.2 fix: marking Reviewed must NOT un-hide moderated content.
 */
export function isCommunityContentReportHidden(
  db: DatabaseAdapter,
  communityId: string,
  targetKind: 'message' | 'post' | 'file',
  targetId: string,
): boolean {
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM cm_safety_actions
     WHERE community_id = ?
       AND target_kind = ?
       AND target_id = ?
       AND action = 'report'
       AND status IN ('active', 'reviewed')`,
    [communityId, targetKind, targetId],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * The owner review queue keeps `active` and `reviewed` reports so a reviewed
 * item stays visible (with a "Reviewed - still hidden" pill) and the owner can
 * still Un-hide it. Only `dismissed` leaves the queue.
 */
export function listOwnerReviewItems(
  db: DatabaseAdapter,
  communityId: string,
): CommunitySafetyActionRow[] {
  return db.query<CommunitySafetyActionRow>(
    `SELECT id, community_id, channel_id, target_kind, target_id,
       target_author_device_id, action, status, reason, target_label,
       created_at, updated_at
     FROM cm_safety_actions
     WHERE community_id = ?
       AND action = 'report'
       AND status IN ('active', 'reviewed')
     ORDER BY updated_at DESC, id ASC`,
    [communityId],
  );
}

/**
 * The ONE canonical report target id for a community file/attachment, used by
 * BOTH the in-chat AttachmentCard and the Files index so a report from either
 * surface hides the same row everywhere. Format: `${channelId}:${attachmentId}`.
 */
export function communityFileReportTarget(input: {
  channelId: string;
  attachmentId: string;
}): string {
  return `${input.channelId}:${input.attachmentId}`;
}

/**
 * One-time local reconciliation (D.3): rewrite any pre-existing `file`-kind
 * report rows whose `target_id` is NOT already the canonical
 * `${channel_id}:${attachmentId}` form to the canonical id, so files reported
 * before the helper existed stay hidden and match the new report target. Idempotent
 * and a no-op once every file row is canonical. Returns the number of rows migrated.
 */
export function reconcileCommunityFileReportTargets(db: DatabaseAdapter): number {
  const rows = db.query<{ id: string; community_id: string; channel_id: string | null; target_id: string; status: CommunitySafetyStatus }>(
    `SELECT id, community_id, channel_id, target_id, status
     FROM cm_safety_actions
     WHERE target_kind = 'file' AND action = 'report'`,
  );
  let migrated = 0;
  for (const row of rows) {
    if (!row.channel_id) continue;
    const prefix = `${row.channel_id}:`;
    if (row.target_id.startsWith(prefix)) continue;
    const newTargetId = communityFileReportTarget({ channelId: row.channel_id, attachmentId: row.target_id });
    const newId = safetyActionId(row.community_id, 'file', newTargetId, 'report');
    if (newId === row.id) continue;
    const canonical = db.query<{ status: CommunitySafetyStatus }>(
      'SELECT status FROM cm_safety_actions WHERE id = ? LIMIT 1',
      [newId],
    )[0];
    if (canonical) {
      // A canonical row already exists; merge to the MOST HIDDEN status before
      // dropping the legacy duplicate, so a legacy active/reviewed (hidden) report
      // is never un-hidden by a canonical 'dismissed' row.
      const merged = mostHiddenSafetyStatus(row.status, canonical.status);
      if (merged !== canonical.status) {
        db.execute('UPDATE cm_safety_actions SET status = ? WHERE id = ?', [merged, newId]);
      }
      db.execute('DELETE FROM cm_safety_actions WHERE id = ?', [row.id]);
      migrated += 1;
      continue;
    }
    db.execute(
      'UPDATE cm_safety_actions SET id = ?, target_id = ? WHERE id = ?',
      [newId, newTargetId, row.id],
    );
    migrated += 1;
  }
  return migrated;
}

/**
 * Pick the more-hidden of two report statuses: `active` and `reviewed` hide,
 * `dismissed` does not. Reconciliation merges to this so a duplicate can never
 * un-hide content that a legacy row kept hidden.
 */
function mostHiddenSafetyStatus(
  a: CommunitySafetyStatus,
  b: CommunitySafetyStatus,
): CommunitySafetyStatus {
  if (a === 'active' || b === 'active') return 'active';
  if (a === 'reviewed' || b === 'reviewed') return 'reviewed';
  return 'dismissed';
}

export function markSafetyActionReviewed(
  db: DatabaseAdapter,
  id: string,
  status: Exclude<CommunitySafetyStatus, 'active'> = 'reviewed',
  now: string = new Date().toISOString(),
): void {
  db.execute(
    `UPDATE cm_safety_actions
     SET status = ?, updated_at = ?
     WHERE id = ?`,
    [status, now, id],
  );
}

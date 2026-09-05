/**
 * CRUD operations for hub-level tables.
 *
 * All queries use parameterized SQL (no string interpolation).
 */

import type { DatabaseAdapter } from './adapter';

export type HubPlanMode = 'hosted' | 'self_host' | 'local_only';

// ---------------------------------------------------------------------------
// hub_enabled_modules
// ---------------------------------------------------------------------------

export interface EnabledModule {
  module_id: string;
  enabled_at: string;
}

/** Get all enabled modules, ordered by enabled_at. */
export function getEnabledModules(db: DatabaseAdapter): EnabledModule[] {
  return db.query<EnabledModule>(
    `SELECT module_id, enabled_at FROM hub_enabled_modules ORDER BY enabled_at ASC`,
  );
}

/** Check if a specific module is enabled. */
export function isModuleEnabled(
  db: DatabaseAdapter,
  moduleId: string,
): boolean {
  const rows = db.query<{ module_id: string }>(
    `SELECT module_id FROM hub_enabled_modules WHERE module_id = ?`,
    [moduleId],
  );
  return rows.length > 0;
}

/** Enable a module. No-op if already enabled (INSERT OR IGNORE). */
export function enableModule(db: DatabaseAdapter, moduleId: string): void {
  db.execute(
    `INSERT OR IGNORE INTO hub_enabled_modules (module_id) VALUES (?)`,
    [moduleId],
  );
}

/** Disable a module by removing it from the enabled list. */
export function disableModule(db: DatabaseAdapter, moduleId: string): void {
  db.execute(`DELETE FROM hub_enabled_modules WHERE module_id = ?`, [moduleId]);
}

// ---------------------------------------------------------------------------
// hub_aggregate_event_counters
// ---------------------------------------------------------------------------

export interface AggregateEventCounter {
  event_key: string;
  bucket_date: string;
  count: number;
  updated_at: string;
}

function currentDateBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increment an aggregate event counter bucket.
 * No user-level identifiers are stored in this table.
 */
export function incrementAggregateEventCounter(
  db: DatabaseAdapter,
  eventKey: string,
  bucketDate: string = currentDateBucket(),
  delta = 1,
): void {
  db.execute(
    `INSERT INTO hub_aggregate_event_counters (
       event_key,
       bucket_date,
       count,
       updated_at
     )
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(event_key, bucket_date)
     DO UPDATE SET
       count = hub_aggregate_event_counters.count + excluded.count,
       updated_at = datetime('now')`,
    [eventKey, bucketDate, delta],
  );
}

/** Get a single aggregate event counter bucket. */
export function getAggregateEventCounter(
  db: DatabaseAdapter,
  eventKey: string,
  bucketDate: string = currentDateBucket(),
): AggregateEventCounter | undefined {
  const rows = db.query<AggregateEventCounter>(
    `SELECT event_key, bucket_date, count, updated_at
     FROM hub_aggregate_event_counters
     WHERE event_key = ?
       AND bucket_date = ?
     LIMIT 1`,
    [eventKey, bucketDate],
  );
  return rows[0];
}

/** List aggregate event counters for diagnostics and operational reporting. */
export function listAggregateEventCounters(
  db: DatabaseAdapter,
  filters?: {
    eventKeyPrefix?: string;
    bucketDate?: string;
    limit?: number;
  },
): AggregateEventCounter[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.eventKeyPrefix) {
    clauses.push(`event_key LIKE ?`);
    params.push(`${filters.eventKeyPrefix}%`);
  }

  if (filters?.bucketDate) {
    clauses.push(`bucket_date = ?`);
    params.push(filters.bucketDate);
  }

  let sql = `SELECT event_key, bucket_date, count, updated_at
             FROM hub_aggregate_event_counters`;

  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }

  sql += ` ORDER BY bucket_date DESC, event_key ASC`;

  if (filters?.limit !== undefined) {
    sql += ` LIMIT ?`;
    params.push(filters.limit);
  }

  return db.query<AggregateEventCounter>(sql, params);
}

// ---------------------------------------------------------------------------
// hub_preferences
// ---------------------------------------------------------------------------

/** Get a preference value by key. Returns undefined if not set. */
export function getPreference(
  db: DatabaseAdapter,
  key: string,
): string | undefined {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM hub_preferences WHERE key = ?`,
    [key],
  );
  return rows[0]?.value;
}

/** Set a preference value. Creates or updates. */
export function setPreference(
  db: DatabaseAdapter,
  key: string,
  value: string,
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_preferences (key, value) VALUES (?, ?)`,
    [key, value],
  );
}

/** Delete a preference by key. */
export function deletePreference(db: DatabaseAdapter, key: string): void {
  db.execute(`DELETE FROM hub_preferences WHERE key = ?`, [key]);
}

/** Get all preferences as key-value pairs. */
export function getAllPreferences(
  db: DatabaseAdapter,
): Record<string, string> {
  const rows = db.query<{ key: string; value: string }>(
    `SELECT key, value FROM hub_preferences ORDER BY key ASC`,
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// hub_mode
// ---------------------------------------------------------------------------

export interface HubMode {
  mode: HubPlanMode;
  server_url: string | null;
  updated_at: string;
}

/** Get the current runtime mode configuration. */
export function getHubMode(db: DatabaseAdapter): HubMode | undefined {
  const rows = db.query<HubMode>(
    `SELECT mode, server_url, updated_at FROM hub_mode WHERE id = 'current' LIMIT 1`,
  );
  return rows[0];
}

/** Upsert the current runtime mode configuration. */
export function setHubMode(
  db: DatabaseAdapter,
  mode: HubPlanMode,
  serverUrl?: string | null,
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_mode (id, mode, server_url, updated_at)
     VALUES ('current', ?, ?, datetime('now'))`,
    [mode, serverUrl ?? null],
  );
}

// ---------------------------------------------------------------------------
// hub_entitlements
// ---------------------------------------------------------------------------

interface HubEntitlementRow {
  raw_token: string;
  app_id: string;
  mode: HubPlanMode;
  hosted_active: number;
  self_host_license: number;
  update_pack_year: number | null;
  features_json: string;
  issued_at: string;
  expires_at: string | null;
  signature: string;
  updated_at: string;
}

export interface HubEntitlement {
  raw_token: string;
  app_id: string;
  mode: HubPlanMode;
  hosted_active: boolean;
  self_host_license: boolean;
  update_pack_year: number | null;
  features: string[];
  issued_at: string;
  expires_at: string | null;
  signature: string;
  updated_at: string;
}

/** Get the cached entitlement payload from local storage. */
export function getHubEntitlement(
  db: DatabaseAdapter,
): HubEntitlement | undefined {
  const rows = db.query<HubEntitlementRow>(
    `SELECT raw_token, app_id, mode, hosted_active, self_host_license, update_pack_year,
            features_json, issued_at, expires_at, signature, updated_at
     FROM hub_entitlements
     WHERE id = 'current'
     LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return undefined;

  let parsedFeatures: string[] = [];
  try {
    const candidate = JSON.parse(row.features_json) as unknown;
    if (Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')) {
      parsedFeatures = candidate;
    }
  } catch {
    // Ignore malformed JSON and fall back to empty features.
  }

  return {
    ...row,
    hosted_active: row.hosted_active === 1,
    self_host_license: row.self_host_license === 1,
    features: parsedFeatures,
  };
}

/** Upsert a cached entitlement payload. */
export function setHubEntitlement(
  db: DatabaseAdapter,
  entitlement: {
    raw_token: string;
    app_id: string;
    mode: HubPlanMode;
    hosted_active: boolean;
    self_host_license: boolean;
    update_pack_year?: number | null;
    features: string[];
    issued_at: string;
    expires_at?: string | null;
    signature: string;
  },
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_entitlements (
       id, raw_token, app_id, mode, hosted_active, self_host_license,
       update_pack_year, features_json, issued_at, expires_at, signature, updated_at
     )
     VALUES (
       'current', ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, datetime('now')
     )`,
    [
      entitlement.raw_token,
      entitlement.app_id,
      entitlement.mode,
      entitlement.hosted_active ? 1 : 0,
      entitlement.self_host_license ? 1 : 0,
      entitlement.update_pack_year ?? null,
      JSON.stringify(entitlement.features),
      entitlement.issued_at,
      entitlement.expires_at ?? null,
      entitlement.signature,
    ],
  );
}

/** Delete any cached entitlement payload. */
export function clearHubEntitlement(db: DatabaseAdapter): void {
  db.execute(`DELETE FROM hub_entitlements WHERE id = 'current'`);
}

// ---------------------------------------------------------------------------
// hub_friend_profiles, hub_friend_invites, hub_friendships
// ---------------------------------------------------------------------------

export type FriendInviteStatus = 'pending' | 'accepted' | 'revoked' | 'declined';
export type FriendshipStatus = 'accepted' | 'blocked';

export interface FriendProfile {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendInvite {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendInviteStatus;
  message: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
}

export interface Friendship {
  user_id: string;
  friend_user_id: string;
  status: FriendshipStatus;
  source_invite_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendConnection extends Friendship {
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

export type FriendMessageContentType = 'text/plain' | 'application/e2ee+ciphertext';
export type FriendMessageSource = 'local' | 'remote';
export type FriendMessageSyncState = 'pending' | 'synced' | 'failed';
export type FriendMessageOutboxStatus = 'pending' | 'retry' | 'failed' | 'sent';

interface FriendMessageRow {
  id: string;
  client_message_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  content_type: FriendMessageContentType;
  content: string;
  source: FriendMessageSource;
  sync_state: FriendMessageSyncState;
  server_message_id: string | null;
  created_at: string;
  read_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface FriendMessage {
  id: string;
  client_message_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  content_type: FriendMessageContentType;
  content: string;
  source: FriendMessageSource;
  sync_state: FriendMessageSyncState;
  server_message_id: string | null;
  created_at: string;
  read_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface FriendInboxItem {
  friend_user_id: string;
  last_message_at: string;
  last_message_content: string;
  last_message_content_type: FriendMessageContentType;
  unread_count: number;
}

export interface FriendMessageOutboxEntry {
  client_message_id: string;
  from_user_id: string;
  to_user_id: string;
  content_type: FriendMessageContentType;
  content: string;
  status: FriendMessageOutboxStatus;
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface FriendInboxItemRow {
  friend_user_id: string;
  last_message_at: string;
  last_message_content: string;
  last_message_content_type: FriendMessageContentType;
  unread_count: number | string;
}

function toFriendMessage(row: FriendMessageRow): FriendMessage {
  return {
    id: row.id,
    client_message_id: row.client_message_id,
    sender_user_id: row.sender_user_id,
    recipient_user_id: row.recipient_user_id,
    content_type: row.content_type,
    content: row.content,
    source: row.source,
    sync_state: row.sync_state,
    server_message_id: row.server_message_id,
    created_at: row.created_at,
    read_at: row.read_at,
    last_error: row.last_error,
    updated_at: row.updated_at,
  };
}

function normalizeIso(value: string | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

/** Insert or update a friend profile by user_id. */
export function upsertFriendProfile(
  db: DatabaseAdapter,
  profile: {
    user_id: string;
    display_name: string;
    handle?: string | null;
    avatar_url?: string | null;
  },
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_friend_profiles (
       user_id,
       display_name,
       handle,
       avatar_url,
       created_at,
       updated_at
     )
     VALUES (
       ?,
       ?,
       ?,
       ?,
       COALESCE((SELECT created_at FROM hub_friend_profiles WHERE user_id = ?), datetime('now')),
       datetime('now')
     )`,
    [
      profile.user_id,
      profile.display_name,
      profile.handle ?? null,
      profile.avatar_url ?? null,
      profile.user_id,
    ],
  );
}

/** Get a friend profile by user_id. */
export function getFriendProfile(
  db: DatabaseAdapter,
  userId: string,
): FriendProfile | undefined {
  const rows = db.query<FriendProfile>(
    `SELECT user_id, display_name, handle, avatar_url, created_at, updated_at
     FROM hub_friend_profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0];
}

/** List friend profiles ordered by display name. */
export function listFriendProfiles(db: DatabaseAdapter): FriendProfile[] {
  return db.query<FriendProfile>(
    `SELECT user_id, display_name, handle, avatar_url, created_at, updated_at
     FROM hub_friend_profiles
     ORDER BY display_name COLLATE NOCASE ASC`,
  );
}

/** Create a pending friend invite. */
export function createFriendInvite(
  db: DatabaseAdapter,
  invite: {
    id: string;
    from_user_id: string;
    to_user_id: string;
    message?: string | null;
  },
): void {
  db.execute(
    `INSERT INTO hub_friend_invites (
       id, from_user_id, to_user_id, status, message, created_at, updated_at
     )
     VALUES (?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
    [
      invite.id,
      invite.from_user_id,
      invite.to_user_id,
      invite.message ?? null,
    ],
  );
}

/** Get a friend invite by id. */
export function getFriendInvite(
  db: DatabaseAdapter,
  inviteId: string,
): FriendInvite | undefined {
  const rows = db.query<FriendInvite>(
    `SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
     FROM hub_friend_invites
     WHERE id = ?
     LIMIT 1`,
    [inviteId],
  );
  return rows[0];
}

/** List incoming invites for a user. Defaults to pending invites only. */
export function listIncomingFriendInvites(
  db: DatabaseAdapter,
  toUserId: string,
  statuses: FriendInviteStatus[] = ['pending'],
): FriendInvite[] {
  if (statuses.length === 0) return [];

  const placeholders = statuses.map(() => '?').join(', ');
  return db.query<FriendInvite>(
    `SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
     FROM hub_friend_invites
     WHERE to_user_id = ?
       AND status IN (${placeholders})
     ORDER BY created_at DESC`,
    [toUserId, ...statuses],
  );
}

/** List outgoing invites for a user. Defaults to pending invites only. */
export function listOutgoingFriendInvites(
  db: DatabaseAdapter,
  fromUserId: string,
  statuses: FriendInviteStatus[] = ['pending'],
): FriendInvite[] {
  if (statuses.length === 0) return [];

  const placeholders = statuses.map(() => '?').join(', ');
  return db.query<FriendInvite>(
    `SELECT id, from_user_id, to_user_id, status, message, created_at, updated_at, responded_at
     FROM hub_friend_invites
     WHERE from_user_id = ?
       AND status IN (${placeholders})
     ORDER BY created_at DESC`,
    [fromUserId, ...statuses],
  );
}

/**
 * Accept a pending invite and create reciprocal friendships.
 * Returns false if invite is missing, not pending, or actor validation fails.
 */
export function acceptFriendInvite(
  db: DatabaseAdapter,
  inviteId: string,
  actedByUserId?: string,
): boolean {
  let accepted = false;

  db.transaction(() => {
    const invite = getFriendInvite(db, inviteId);
    if (!invite || invite.status !== 'pending') return;
    if (actedByUserId && invite.to_user_id !== actedByUserId) return;

    db.execute(
      `UPDATE hub_friend_invites
       SET status = 'accepted',
           updated_at = datetime('now'),
           responded_at = datetime('now')
       WHERE id = ?`,
      [inviteId],
    );

    db.execute(
      `INSERT OR REPLACE INTO hub_friendships (
         user_id, friend_user_id, status, source_invite_id, created_at, updated_at
       )
       VALUES (
         ?, ?, 'accepted', ?,
         COALESCE((SELECT created_at FROM hub_friendships WHERE user_id = ? AND friend_user_id = ?), datetime('now')),
         datetime('now')
       )`,
      [invite.from_user_id, invite.to_user_id, invite.id, invite.from_user_id, invite.to_user_id],
    );

    db.execute(
      `INSERT OR REPLACE INTO hub_friendships (
         user_id, friend_user_id, status, source_invite_id, created_at, updated_at
       )
       VALUES (
         ?, ?, 'accepted', ?,
         COALESCE((SELECT created_at FROM hub_friendships WHERE user_id = ? AND friend_user_id = ?), datetime('now')),
         datetime('now')
       )`,
      [invite.to_user_id, invite.from_user_id, invite.id, invite.to_user_id, invite.from_user_id],
    );

    accepted = true;
  });

  return accepted;
}

/**
 * Revoke a pending invite.
 * Returns false if invite is missing, not pending, or actor validation fails.
 */
export function revokeFriendInvite(
  db: DatabaseAdapter,
  inviteId: string,
  actedByUserId?: string,
): boolean {
  const invite = getFriendInvite(db, inviteId);
  if (!invite || invite.status !== 'pending') return false;
  if (actedByUserId && invite.from_user_id !== actedByUserId) return false;

  db.execute(
    `UPDATE hub_friend_invites
     SET status = 'revoked',
         updated_at = datetime('now'),
         responded_at = datetime('now')
     WHERE id = ?`,
    [inviteId],
  );

  return true;
}

/**
 * Decline a pending invite.
 * Returns false if invite is missing, not pending, or actor validation fails.
 */
export function declineFriendInvite(
  db: DatabaseAdapter,
  inviteId: string,
  actedByUserId?: string,
): boolean {
  const invite = getFriendInvite(db, inviteId);
  if (!invite || invite.status !== 'pending') return false;
  if (actedByUserId && invite.to_user_id !== actedByUserId) return false;

  db.execute(
    `UPDATE hub_friend_invites
     SET status = 'declined',
         updated_at = datetime('now'),
         responded_at = datetime('now')
     WHERE id = ?`,
    [inviteId],
  );

  return true;
}

/** Remove reciprocal accepted friendships for both users. */
export function removeFriendship(
  db: DatabaseAdapter,
  userId: string,
  friendUserId: string,
): void {
  db.transaction(() => {
    db.execute(
      `DELETE FROM hub_friendships WHERE user_id = ? AND friend_user_id = ?`,
      [userId, friendUserId],
    );
    db.execute(
      `DELETE FROM hub_friendships WHERE user_id = ? AND friend_user_id = ?`,
      [friendUserId, userId],
    );
  });
}

/** Check whether two users are mutually accepted friends. */
export function areUsersFriends(
  db: DatabaseAdapter,
  userId: string,
  friendUserId: string,
): boolean {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM hub_friendships
     WHERE status = 'accepted'
       AND (
         (user_id = ? AND friend_user_id = ?)
         OR (user_id = ? AND friend_user_id = ?)
       )`,
    [userId, friendUserId, friendUserId, userId],
  );

  return (rows[0]?.count ?? 0) >= 2;
}

/** List accepted friends for a user with optional profile details. */
export function listFriendsForUser(
  db: DatabaseAdapter,
  userId: string,
): FriendConnection[] {
  return db.query<FriendConnection>(
    `SELECT
       f.user_id,
       f.friend_user_id,
       f.status,
       f.source_invite_id,
       f.created_at,
       f.updated_at,
       p.display_name,
       p.handle,
       p.avatar_url
     FROM hub_friendships f
     LEFT JOIN hub_friend_profiles p ON p.user_id = f.friend_user_id
     WHERE f.user_id = ?
       AND f.status = 'accepted'
     ORDER BY COALESCE(p.display_name, f.friend_user_id) COLLATE NOCASE ASC`,
    [userId],
  );
}

// ---------------------------------------------------------------------------
// hub_friend_messages, hub_friend_message_outbox
// ---------------------------------------------------------------------------

/** Create a local friend message row. */
export function createFriendMessage(
  db: DatabaseAdapter,
  message: {
    id: string;
    client_message_id: string;
    sender_user_id: string;
    recipient_user_id: string;
    content_type?: FriendMessageContentType;
    content: string;
    source?: FriendMessageSource;
    sync_state?: FriendMessageSyncState;
    server_message_id?: string | null;
    created_at?: string;
    read_at?: string | null;
    last_error?: string | null;
  },
): void {
  db.execute(
    `INSERT INTO hub_friend_messages (
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       source,
       sync_state,
       server_message_id,
       created_at,
       read_at,
       last_error,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      message.id,
      message.client_message_id,
      message.sender_user_id,
      message.recipient_user_id,
      message.content_type ?? 'text/plain',
      message.content,
      message.source ?? 'local',
      message.sync_state ?? 'pending',
      message.server_message_id ?? null,
      normalizeIso(message.created_at),
      message.read_at ?? null,
      message.last_error ?? null,
    ],
  );
}

/** Insert/update a message from server sync by client_message_id. */
export function upsertFriendMessageFromServer(
  db: DatabaseAdapter,
  message: {
    id: string;
    client_message_id: string;
    sender_user_id: string;
    recipient_user_id: string;
    content_type: FriendMessageContentType;
    content: string;
    created_at: string;
    read_at?: string | null;
  },
): FriendMessage {
  const normalizedCreatedAt = normalizeIso(message.created_at);
  const normalizedReadAt = message.read_at ? normalizeIso(message.read_at) : null;

  db.execute(
    `INSERT INTO hub_friend_messages (
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       source,
       sync_state,
       server_message_id,
       created_at,
       read_at,
       last_error,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, 'remote', 'synced', ?, ?, ?, NULL, datetime('now'))
     ON CONFLICT(client_message_id) DO UPDATE SET
       sender_user_id = excluded.sender_user_id,
       recipient_user_id = excluded.recipient_user_id,
       content_type = excluded.content_type,
       content = excluded.content,
       source = CASE
         WHEN hub_friend_messages.source = 'local' THEN 'local'
         ELSE 'remote'
       END,
       sync_state = 'synced',
       server_message_id = COALESCE(excluded.server_message_id, hub_friend_messages.server_message_id),
       created_at = excluded.created_at,
       read_at = CASE
         WHEN excluded.read_at IS NOT NULL THEN excluded.read_at
         ELSE hub_friend_messages.read_at
       END,
       last_error = NULL,
       updated_at = datetime('now')`,
    [
      message.id,
      message.client_message_id,
      message.sender_user_id,
      message.recipient_user_id,
      message.content_type,
      message.content,
      message.id,
      normalizedCreatedAt,
      normalizedReadAt,
    ],
  );

  const row = getFriendMessageByClientMessageId(db, message.client_message_id);
  if (!row) {
    throw new Error('Failed to upsert friend message.');
  }
  return row;
}

/** Get a single message by local id. */
export function getFriendMessageById(
  db: DatabaseAdapter,
  messageId: string,
): FriendMessage | undefined {
  const rows = db.query<FriendMessageRow>(
    `SELECT
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       source,
       sync_state,
       server_message_id,
       created_at,
       read_at,
       last_error,
       updated_at
     FROM hub_friend_messages
     WHERE id = ?
     LIMIT 1`,
    [messageId],
  );

  const row = rows[0];
  return row ? toFriendMessage(row) : undefined;
}

/** Get a single message by client_message_id. */
export function getFriendMessageByClientMessageId(
  db: DatabaseAdapter,
  clientMessageId: string,
): FriendMessage | undefined {
  const rows = db.query<FriendMessageRow>(
    `SELECT
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       source,
       sync_state,
       server_message_id,
       created_at,
       read_at,
       last_error,
       updated_at
     FROM hub_friend_messages
     WHERE client_message_id = ?
     LIMIT 1`,
    [clientMessageId],
  );

  const row = rows[0];
  return row ? toFriendMessage(row) : undefined;
}

/** Queue an outbound message and ensure local cache row exists. */
export function queueFriendMessageOutbox(
  db: DatabaseAdapter,
  input: {
    id: string;
    client_message_id: string;
    from_user_id: string;
    to_user_id: string;
    content_type?: FriendMessageContentType;
    content: string;
    created_at?: string;
  },
): FriendMessage {
  const nowIso = normalizeIso(undefined);
  const createdAt = normalizeIso(input.created_at);
  const contentType = input.content_type ?? 'text/plain';

  db.transaction(() => {
    db.execute(
      `INSERT INTO hub_friend_messages (
         id,
         client_message_id,
         sender_user_id,
         recipient_user_id,
         content_type,
         content,
         source,
         sync_state,
         server_message_id,
         created_at,
         read_at,
         last_error,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, 'local', 'pending', NULL, ?, NULL, NULL, datetime('now'))
       ON CONFLICT(client_message_id) DO NOTHING`,
      [
        input.id,
        input.client_message_id,
        input.from_user_id,
        input.to_user_id,
        contentType,
        input.content,
        createdAt,
      ],
    );

    db.execute(
      `INSERT INTO hub_friend_message_outbox (
         client_message_id,
         from_user_id,
         to_user_id,
         content_type,
         content,
         status,
         attempts,
         next_attempt_at,
         last_error,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, NULL, ?, ?)
       ON CONFLICT(client_message_id) DO UPDATE SET
         from_user_id = excluded.from_user_id,
         to_user_id = excluded.to_user_id,
         content_type = excluded.content_type,
         content = excluded.content,
         status = 'pending',
         attempts = 0,
         next_attempt_at = excluded.next_attempt_at,
         last_error = NULL,
         updated_at = excluded.updated_at`,
      [
        input.client_message_id,
        input.from_user_id,
        input.to_user_id,
        contentType,
        input.content,
        nowIso,
        nowIso,
        nowIso,
      ],
    );
  });

  const message = getFriendMessageByClientMessageId(db, input.client_message_id);
  if (!message) {
    throw new Error('Failed to queue outbound friend message.');
  }
  return message;
}

/** List due outbound queue entries for one sender user. */
export function listFriendMessageOutboxDue(
  db: DatabaseAdapter,
  fromUserId: string,
  options?: {
    now?: string;
    limit?: number;
  },
): FriendMessageOutboxEntry[] {
  const nowIso = normalizeIso(options?.now);
  const limit = options?.limit ?? 50;

  return db.query<FriendMessageOutboxEntry>(
    `SELECT
       client_message_id,
       from_user_id,
       to_user_id,
       content_type,
       content,
       status,
       attempts,
       next_attempt_at,
       last_error,
       created_at,
       updated_at
     FROM hub_friend_message_outbox
     WHERE from_user_id = ?
       AND status IN ('pending', 'retry')
       AND julianday(next_attempt_at) <= julianday(?)
     ORDER BY julianday(next_attempt_at) ASC, julianday(created_at) ASC
     LIMIT ?`,
    [fromUserId, nowIso, limit],
  );
}

/** Mark a queued outbound message as successfully sent and synced. */
export function markFriendMessageOutboxSent(
  db: DatabaseAdapter,
  clientMessageId: string,
  options?: {
    server_message_id?: string | null;
    created_at?: string;
    read_at?: string | null;
  },
): void {
  const normalizedCreatedAt = options?.created_at ? normalizeIso(options.created_at) : null;
  const normalizedReadAt = options?.read_at ? normalizeIso(options.read_at) : null;

  db.transaction(() => {
    db.execute(
      `UPDATE hub_friend_messages
       SET sync_state = 'synced',
           server_message_id = COALESCE(?, server_message_id),
           created_at = COALESCE(?, created_at),
           read_at = COALESCE(?, read_at),
           last_error = NULL,
           updated_at = datetime('now')
       WHERE client_message_id = ?`,
      [
        options?.server_message_id ?? null,
        normalizedCreatedAt,
        normalizedReadAt,
        clientMessageId,
      ],
    );

    db.execute(
      `DELETE FROM hub_friend_message_outbox
       WHERE client_message_id = ?`,
      [clientMessageId],
    );
  });
}

/** Mark a queued outbound message for retry with incremented attempts. */
export function markFriendMessageOutboxRetry(
  db: DatabaseAdapter,
  clientMessageId: string,
  nextAttemptAt: string,
  errorMessage?: string | null,
): void {
  const normalizedNextAttemptAt = normalizeIso(nextAttemptAt);

  db.transaction(() => {
    db.execute(
      `UPDATE hub_friend_message_outbox
       SET status = 'retry',
           attempts = attempts + 1,
           next_attempt_at = ?,
           last_error = ?,
           updated_at = datetime('now')
       WHERE client_message_id = ?`,
      [normalizedNextAttemptAt, errorMessage ?? null, clientMessageId],
    );

    db.execute(
      `UPDATE hub_friend_messages
       SET sync_state = 'failed',
           last_error = ?,
           updated_at = datetime('now')
       WHERE client_message_id = ?`,
      [errorMessage ?? null, clientMessageId],
    );
  });
}

/** Mark a queued outbound message as permanently failed. */
export function markFriendMessageOutboxFailed(
  db: DatabaseAdapter,
  clientMessageId: string,
  errorMessage?: string | null,
): void {
  db.transaction(() => {
    db.execute(
      `UPDATE hub_friend_message_outbox
       SET status = 'failed',
           attempts = attempts + 1,
           next_attempt_at = datetime('now'),
           last_error = ?,
           updated_at = datetime('now')
       WHERE client_message_id = ?`,
      [errorMessage ?? null, clientMessageId],
    );

    db.execute(
      `UPDATE hub_friend_messages
       SET sync_state = 'failed',
           last_error = ?,
           updated_at = datetime('now')
       WHERE client_message_id = ?`,
      [errorMessage ?? null, clientMessageId],
    );
  });
}

/** Return count of outbox rows by status for diagnostics/UI badges. */
export function countFriendMessageOutboxByStatus(
  db: DatabaseAdapter,
  fromUserId: string,
): Record<FriendMessageOutboxStatus, number> {
  const rows = db.query<{ status: FriendMessageOutboxStatus; count: number | string }>(
    `SELECT status, COUNT(*) AS count
     FROM hub_friend_message_outbox
     WHERE from_user_id = ?
     GROUP BY status`,
    [fromUserId],
  );

  const result: Record<FriendMessageOutboxStatus, number> = {
    pending: 0,
    retry: 0,
    failed: 0,
    sent: 0,
  };

  for (const row of rows) {
    result[row.status] =
      typeof row.count === 'number'
        ? row.count
        : Number(row.count) || 0;
  }

  return result;
}

/** List conversation messages visible to a local viewer. */
export function listFriendConversationMessages(
  db: DatabaseAdapter,
  viewerUserId: string,
  friendUserId: string,
  options?: {
    since?: string;
    limit?: number;
  },
): FriendMessage[] {
  const params: unknown[] = [viewerUserId, friendUserId, friendUserId, viewerUserId];
  let sinceClause = '';
  if (options?.since) {
    params.push(normalizeIso(options.since));
    sinceClause = `AND julianday(created_at) > julianday(?)`;
  }
  const limit = options?.limit ?? 200;
  params.push(limit);

  const rows = db.query<FriendMessageRow>(
    `SELECT
       id,
       client_message_id,
       sender_user_id,
       recipient_user_id,
       content_type,
       content,
       source,
       sync_state,
       server_message_id,
       created_at,
       read_at,
       last_error,
       updated_at
     FROM hub_friend_messages
     WHERE (
       (sender_user_id = ? AND recipient_user_id = ?)
       OR
       (sender_user_id = ? AND recipient_user_id = ?)
     )
       ${sinceClause}
     ORDER BY julianday(created_at) ASC
     LIMIT ?`,
    params,
  );

  return rows.map((row) => toFriendMessage(row));
}

/** Get the latest known created_at for a conversation. */
export function getLatestFriendMessageCreatedAt(
  db: DatabaseAdapter,
  viewerUserId: string,
  friendUserId: string,
): string | undefined {
  const rows = db.query<{ created_at: string | null }>(
    `SELECT MAX(created_at) AS created_at
     FROM hub_friend_messages
     WHERE (
       (sender_user_id = ? AND recipient_user_id = ?)
       OR
       (sender_user_id = ? AND recipient_user_id = ?)
     )`,
    [viewerUserId, friendUserId, friendUserId, viewerUserId],
  );
  return rows[0]?.created_at ?? undefined;
}

/** Mark a message as read if the given user is the recipient. */
export function markFriendMessageRead(
  db: DatabaseAdapter,
  messageId: string,
  viewerUserId: string,
  readAt?: string,
): FriendMessage | undefined {
  const normalizedReadAt = normalizeIso(readAt);

  db.execute(
    `UPDATE hub_friend_messages
     SET read_at = COALESCE(read_at, ?),
         updated_at = datetime('now')
     WHERE id = ?
       AND recipient_user_id = ?`,
    [normalizedReadAt, messageId, viewerUserId],
  );

  return getFriendMessageById(db, messageId);
}

/** List inbox conversation summaries for a user. */
export function listFriendMessageInbox(
  db: DatabaseAdapter,
  viewerUserId: string,
  limit = 50,
): FriendInboxItem[] {
  const rows = db.query<FriendInboxItemRow>(
    `WITH scoped AS (
       SELECT
         id,
         sender_user_id,
         recipient_user_id,
         content_type,
         content,
         created_at,
         read_at,
         CASE
           WHEN sender_user_id = ? THEN recipient_user_id
           ELSE sender_user_id
         END AS friend_user_id
       FROM hub_friend_messages
       WHERE sender_user_id = ?
          OR recipient_user_id = ?
     ),
     ranked AS (
       SELECT
         friend_user_id,
         content,
         content_type,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY friend_user_id
           ORDER BY julianday(created_at) DESC
         ) AS row_num
       FROM scoped
     ),
     unread AS (
       SELECT
         friend_user_id,
         SUM(
           CASE
             WHEN recipient_user_id = ? AND read_at IS NULL THEN 1
             ELSE 0
           END
         ) AS unread_count
       FROM scoped
       GROUP BY friend_user_id
     )
     SELECT
       r.friend_user_id,
       r.created_at AS last_message_at,
       r.content AS last_message_content,
       r.content_type AS last_message_content_type,
       COALESCE(u.unread_count, 0) AS unread_count
     FROM ranked r
     LEFT JOIN unread u ON u.friend_user_id = r.friend_user_id
     WHERE r.row_num = 1
     ORDER BY julianday(r.created_at) DESC
     LIMIT ?`,
    [viewerUserId, viewerUserId, viewerUserId, viewerUserId, limit],
  );

  return rows.map((row) => ({
    friend_user_id: row.friend_user_id,
    last_message_at: row.last_message_at,
    last_message_content: row.last_message_content,
    last_message_content_type: row.last_message_content_type,
    unread_count:
      typeof row.unread_count === 'number'
        ? row.unread_count
        : Number(row.unread_count) || 0,
  }));
}

// ---------------------------------------------------------------------------
// hub_revoked_entitlements
// ---------------------------------------------------------------------------

export interface RevokedEntitlement {
  signature: string;
  reason: string | null;
  source_event_id: string | null;
  revoked_at: string;
}

/** Mark an entitlement signature as revoked. */
export function revokeHubEntitlement(
  db: DatabaseAdapter,
  signature: string,
  reason?: string | null,
  sourceEventId?: string | null,
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_revoked_entitlements (
       signature,
       reason,
       source_event_id,
       revoked_at
     )
     VALUES (?, ?, ?, datetime('now'))`,
    [signature, reason ?? null, sourceEventId ?? null],
  );
}

/** Remove a signature from revocation storage. */
export function unrevokeHubEntitlement(
  db: DatabaseAdapter,
  signature: string,
): void {
  db.execute(`DELETE FROM hub_revoked_entitlements WHERE signature = ?`, [signature]);
}

/** Check whether a signature is currently revoked. */
export function isHubEntitlementRevoked(
  db: DatabaseAdapter,
  signature: string,
): boolean {
  const rows = db.query<{ signature: string }>(
    `SELECT signature
     FROM hub_revoked_entitlements
     WHERE signature = ?
     LIMIT 1`,
    [signature],
  );

  return rows.length > 0;
}

/** List all revoked signatures for diagnostics or policy audits. */
export function listRevokedHubEntitlements(
  db: DatabaseAdapter,
): RevokedEntitlement[] {
  return db.query<RevokedEntitlement>(
    `SELECT signature, reason, source_event_id, revoked_at
     FROM hub_revoked_entitlements
     ORDER BY revoked_at DESC`,
  );
}

// ---------------------------------------------------------------------------
// hub_subscription
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  tier: 'free' | 'premium';
  provider: 'revenueCat' | 'stripe' | null;
  external_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Get the current subscription (there should be at most one row). */
export function getSubscription(
  db: DatabaseAdapter,
): Subscription | undefined {
  const rows = db.query<Subscription>(
    `SELECT id, tier, provider, external_id, expires_at, created_at, updated_at
     FROM hub_subscription LIMIT 1`,
  );
  return rows[0];
}

/** Upsert the subscription record. */
export function setSubscription(
  db: DatabaseAdapter,
  sub: {
    id: string;
    tier: 'free' | 'premium';
    provider?: 'revenueCat' | 'stripe' | null;
    external_id?: string | null;
    expires_at?: string | null;
  },
): void {
  db.execute(
    `INSERT OR REPLACE INTO hub_subscription
       (id, tier, provider, external_id, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [
      sub.id,
      sub.tier,
      sub.provider ?? null,
      sub.external_id ?? null,
      sub.expires_at ?? null,
    ],
  );
}

// ---------------------------------------------------------------------------
// hub_human_verification
// ---------------------------------------------------------------------------

export type VerificationMethod = 'faceid' | 'touchid' | 'biometric' | 'passkey';

export interface HumanVerification {
  id: string;
  user_id: string;
  verified_at: string;
  method: VerificationMethod;
  device_attestation: string | null;
  revoked_at: string | null;
}

/** Check whether a user has an active (non-revoked) human verification. */
export function isHumanVerified(
  db: DatabaseAdapter,
  userId: string,
): boolean {
  const rows = db.query<{ id: string }>(
    `SELECT id FROM hub_human_verification
     WHERE user_id = ? AND revoked_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

/** Get the most recent active verification for a user. */
export function getHumanVerification(
  db: DatabaseAdapter,
  userId: string,
): HumanVerification | undefined {
  const rows = db.query<HumanVerification>(
    `SELECT id, user_id, verified_at, method, device_attestation, revoked_at
     FROM hub_human_verification
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY verified_at DESC, ROWID DESC
     LIMIT 1`,
    [userId],
  );
  return rows[0];
}

/**
 * Record a successful human verification.
 * The app receives ONLY a boolean from the OS Secure Enclave.
 * We never receive or store biometric data.
 */
export function recordHumanVerification(
  db: DatabaseAdapter,
  input: {
    id: string;
    userId: string;
    method: VerificationMethod;
    deviceAttestation?: string | null;
  },
): HumanVerification {
  db.execute(
    `INSERT INTO hub_human_verification
       (id, user_id, verified_at, method, device_attestation, revoked_at)
     VALUES (?, ?, datetime('now'), ?, ?, NULL)`,
    [input.id, input.userId, input.method, input.deviceAttestation ?? null],
  );

  const rows = db.query<HumanVerification>(
    `SELECT id, user_id, verified_at, method, device_attestation, revoked_at
     FROM hub_human_verification WHERE id = ?`,
    [input.id],
  );

  return rows[0];
}

/** Revoke a user's human verification (e.g. for abuse, account reset). */
export function revokeHumanVerification(
  db: DatabaseAdapter,
  userId: string,
): void {
  db.execute(
    `UPDATE hub_human_verification
     SET revoked_at = datetime('now')
     WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  );
}

// ---------------------------------------------------------------------------
// hub_sharing_preferences
// ---------------------------------------------------------------------------

export interface SharingPreference {
  id: string;
  module_id: string;
  data_type: string;
  shared: number;
  anonymized: number;
  created_at: string;
  updated_at: string;
}

export interface SharingPreferenceView {
  id: string;
  moduleId: string;
  dataType: string;
  shared: boolean;
  anonymized: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToSharingPref(row: SharingPreference): SharingPreferenceView {
  return {
    id: row.id,
    moduleId: row.module_id,
    dataType: row.data_type,
    shared: row.shared === 1,
    anonymized: row.anonymized === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Get all sharing preferences for a specific module. */
export function getSharingPreferences(
  db: DatabaseAdapter,
  moduleId: string,
): SharingPreferenceView[] {
  const rows = db.query<SharingPreference>(
    `SELECT * FROM hub_sharing_preferences WHERE module_id = ? ORDER BY data_type ASC`,
    [moduleId],
  );
  return rows.map(rowToSharingPref);
}

/** Get all sharing preferences across all modules. */
export function getAllSharingPreferences(
  db: DatabaseAdapter,
): SharingPreferenceView[] {
  const rows = db.query<SharingPreference>(
    `SELECT * FROM hub_sharing_preferences ORDER BY module_id ASC, data_type ASC`,
  );
  return rows.map(rowToSharingPref);
}

/** Get only the preferences where sharing is enabled. */
export function getActiveSharingPreferences(
  db: DatabaseAdapter,
): SharingPreferenceView[] {
  const rows = db.query<SharingPreference>(
    `SELECT * FROM hub_sharing_preferences WHERE shared = 1 ORDER BY module_id ASC`,
  );
  return rows.map(rowToSharingPref);
}

/**
 * Set sharing preference for a module + data type combination.
 * Creates the row if it doesn't exist, updates if it does.
 */
export function updateSharingPreference(
  db: DatabaseAdapter,
  input: {
    moduleId: string;
    dataType: string;
    shared: boolean;
    anonymized?: boolean;
  },
): SharingPreferenceView {
  const id = `${input.moduleId}:${input.dataType}`;
  const anonymized = input.anonymized ?? true;

  db.execute(
    `INSERT INTO hub_sharing_preferences (id, module_id, data_type, shared, anonymized, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(module_id, data_type) DO UPDATE SET
       shared = excluded.shared,
       anonymized = excluded.anonymized,
       updated_at = excluded.updated_at`,
    [id, input.moduleId, input.dataType, input.shared ? 1 : 0, anonymized ? 1 : 0],
  );

  const rows = db.query<SharingPreference>(
    `SELECT * FROM hub_sharing_preferences WHERE id = ?`,
    [id],
  );
  return rowToSharingPref(rows[0]!);
}

/** Revoke all sharing across all modules. Sets shared = 0 for every row. */
export function revokeAllSharing(db: DatabaseAdapter): number {
  const result = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hub_sharing_preferences WHERE shared = 1`,
  );
  const count = result[0]?.count ?? 0;

  db.execute(
    `UPDATE hub_sharing_preferences SET shared = 0, updated_at = datetime('now') WHERE shared = 1`,
  );

  return count;
}

/** Delete all sharing preference records. Used for full data deletion. */
export function deleteAllSharingPreferences(db: DatabaseAdapter): number {
  const result = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM hub_sharing_preferences`,
  );
  const count = result[0]?.count ?? 0;

  db.execute(`DELETE FROM hub_sharing_preferences`);
  return count;
}

// ---------------------------------------------------------------------------
// hub_sharing_consent
// ---------------------------------------------------------------------------

export interface SharingConsent {
  consented: boolean;
  consentedAt: string | null;
}

/** Check if the user has given initial sharing consent. */
export function getSharingConsent(db: DatabaseAdapter): SharingConsent {
  const rows = db.query<{ consented: number; consented_at: string | null }>(
    `SELECT consented, consented_at FROM hub_sharing_consent WHERE id = 'current'`,
  );

  if (rows.length === 0) {
    return { consented: false, consentedAt: null };
  }

  return {
    consented: rows[0]!.consented === 1,
    consentedAt: rows[0]!.consented_at,
  };
}

/** Record that the user has reviewed and accepted the sharing consent flow. */
export function recordSharingConsent(db: DatabaseAdapter): void {
  db.execute(
    `INSERT INTO hub_sharing_consent (id, consented, consented_at, updated_at)
     VALUES ('current', 1, datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       consented = 1,
       consented_at = datetime('now'),
       updated_at = datetime('now')`,
  );
}

/** Revoke sharing consent and disable all sharing. */
export function revokeSharingConsent(db: DatabaseAdapter): void {
  db.execute(
    `INSERT INTO hub_sharing_consent (id, consented, consented_at, updated_at)
     VALUES ('current', 0, NULL, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       consented = 0,
       consented_at = NULL,
       updated_at = datetime('now')`,
  );

  // Also revoke all individual sharing preferences
  revokeAllSharing(db);
}

// ---------------------------------------------------------------------------
// hub_health_consent
// ---------------------------------------------------------------------------

export interface HealthConsent {
  moduleId: string;
  dataTypes: string[];
  consentedAt: string;
  withdrawnAt: string | null;
}

/** Get health data consent status for a specific module. */
export function getHealthConsent(
  db: DatabaseAdapter,
  moduleId: string,
): HealthConsent | undefined {
  const rows = db.query<{
    module_id: string;
    data_types: string;
    consented_at: string;
    withdrawn_at: string | null;
  }>(
    `SELECT module_id, data_types, consented_at, withdrawn_at
     FROM hub_health_consent
     WHERE module_id = ?
     LIMIT 1`,
    [moduleId],
  );
  const row = rows[0];
  if (!row) return undefined;

  let dataTypes: string[] = [];
  try {
    const parsed = JSON.parse(row.data_types) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      dataTypes = parsed;
    }
  } catch {
    // fall back to empty
  }

  return {
    moduleId: row.module_id,
    dataTypes,
    consentedAt: row.consented_at,
    withdrawnAt: row.withdrawn_at,
  };
}

/** Check if a module has active (non-withdrawn) health data consent. */
export function hasActiveHealthConsent(
  db: DatabaseAdapter,
  moduleId: string,
): boolean {
  const consent = getHealthConsent(db, moduleId);
  return consent !== undefined && consent.withdrawnAt === null;
}

/** List all health consent records. */
export function listAllHealthConsents(
  db: DatabaseAdapter,
): HealthConsent[] {
  const rows = db.query<{
    module_id: string;
    data_types: string;
    consented_at: string;
    withdrawn_at: string | null;
  }>(
    `SELECT module_id, data_types, consented_at, withdrawn_at
     FROM hub_health_consent
     ORDER BY consented_at ASC`,
  );

  return rows.map((row) => {
    let dataTypes: string[] = [];
    try {
      const parsed = JSON.parse(row.data_types) as unknown;
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        dataTypes = parsed;
      }
    } catch {
      // fall back to empty
    }
    return {
      moduleId: row.module_id,
      dataTypes,
      consentedAt: row.consented_at,
      withdrawnAt: row.withdrawn_at,
    };
  });
}

/** Record affirmative health data consent for a module. */
export function recordHealthConsent(
  db: DatabaseAdapter,
  moduleId: string,
  dataTypes: string[],
): void {
  db.execute(
    `INSERT INTO hub_health_consent (module_id, data_types, consented_at, withdrawn_at)
     VALUES (?, ?, datetime('now'), NULL)
     ON CONFLICT(module_id) DO UPDATE SET
       data_types = excluded.data_types,
       consented_at = datetime('now'),
       withdrawn_at = NULL`,
    [moduleId, JSON.stringify(dataTypes)],
  );
}

/** Withdraw health data consent for a module. */
export function withdrawHealthConsent(
  db: DatabaseAdapter,
  moduleId: string,
): void {
  db.execute(
    `UPDATE hub_health_consent
     SET withdrawn_at = datetime('now')
     WHERE module_id = ? AND withdrawn_at IS NULL`,
    [moduleId],
  );
}

// ---------------------------------------------------------------------------
// hub_schema_versions (read-only queries -- writes handled by migration-runner)
// ---------------------------------------------------------------------------

export interface SchemaVersion {
  module_id: string;
  version: number;
  applied_at: string;
}

/** Get the latest schema version for a module. Returns 0 if none applied. */
export function getModuleSchemaVersion(
  db: DatabaseAdapter,
  moduleId: string,
): number {
  const rows = db.query<{ version: number }>(
    `SELECT MAX(version) as version FROM hub_schema_versions WHERE module_id = ?`,
    [moduleId],
  );
  return rows[0]?.version ?? 0;
}

/** Get the full migration history for a module. */
export function getModuleMigrationHistory(
  db: DatabaseAdapter,
  moduleId: string,
): SchemaVersion[] {
  return db.query<SchemaVersion>(
    `SELECT module_id, version, applied_at
     FROM hub_schema_versions
     WHERE module_id = ?
     ORDER BY version ASC`,
    [moduleId],
  );
}

/** Get the latest schema version for all modules. */
export function getAllSchemaVersions(
  db: DatabaseAdapter,
): SchemaVersion[] {
  return db.query<SchemaVersion>(
    `SELECT module_id, MAX(version) as version, MAX(applied_at) as applied_at
     FROM hub_schema_versions
     GROUP BY module_id
     ORDER BY module_id ASC`,
  );
}

// ---------------------------------------------------------------------------
// hub_dashboard_layout
// ---------------------------------------------------------------------------

export type DashboardCardSize = 'standard' | 'compact';

export interface DashboardCard {
  module_id: string;
  position: number;
  visible: number;
  card_size: DashboardCardSize;
  created_at: string;
  updated_at: string;
}

/** Get the full dashboard layout ordered by position. */
export function getDashboardLayout(db: DatabaseAdapter): DashboardCard[] {
  return db.query<DashboardCard>(
    `SELECT module_id, position, visible, card_size, created_at, updated_at
     FROM hub_dashboard_layout
     ORDER BY position ASC`,
  );
}

/** Get only visible dashboard cards ordered by position. */
export function getVisibleDashboardCards(db: DatabaseAdapter): DashboardCard[] {
  return db.query<DashboardCard>(
    `SELECT module_id, position, visible, card_size, created_at, updated_at
     FROM hub_dashboard_layout
     WHERE visible = 1
     ORDER BY position ASC`,
  );
}

/** Upsert a card into the dashboard layout. */
export function upsertDashboardCard(
  db: DatabaseAdapter,
  moduleId: string,
  input: { position: number; visible?: number; card_size?: DashboardCardSize },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO hub_dashboard_layout (module_id, position, visible, card_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(module_id) DO UPDATE SET
       position = excluded.position,
       visible = COALESCE(excluded.visible, hub_dashboard_layout.visible),
       card_size = COALESCE(excluded.card_size, hub_dashboard_layout.card_size),
       updated_at = excluded.updated_at`,
    [moduleId, input.position, input.visible ?? 1, input.card_size ?? 'standard', now, now],
  );
}

/** Update the position of a single dashboard card. */
export function updateCardPosition(
  db: DatabaseAdapter,
  moduleId: string,
  position: number,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE hub_dashboard_layout SET position = ?, updated_at = ? WHERE module_id = ?`,
    [position, now, moduleId],
  );
}

/** Toggle visibility of a dashboard card. */
export function toggleCardVisibility(
  db: DatabaseAdapter,
  moduleId: string,
  visible: boolean,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE hub_dashboard_layout SET visible = ?, updated_at = ? WHERE module_id = ?`,
    [visible ? 1 : 0, now, moduleId],
  );
}

/** Update the card size (standard or compact). */
export function updateCardSize(
  db: DatabaseAdapter,
  moduleId: string,
  cardSize: DashboardCardSize,
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE hub_dashboard_layout SET card_size = ?, updated_at = ? WHERE module_id = ?`,
    [cardSize, now, moduleId],
  );
}

/**
 * Delete ALL user data across all modules and reset the hub to fresh state.
 * Drops every table whose name starts with a known module prefix,
 * clears hub data tables, and resets preferences.
 *
 * Does NOT drop hub schema tables themselves (they are re-created on next launch).
 */
export function deleteAllData(db: DatabaseAdapter): { tablesDropped: number } {
  // Enumerate all user-created tables from sqlite_master
  const allTables = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  );

  // Hub tables we clear (delete rows) but don't drop
  const hubTablesToClear = [
    'hub_enabled_modules',
    'hub_preferences',
    'hub_aggregate_event_counters',
    'hub_subscription',
    'hub_sharing_preferences',
    'hub_sharing_consent',
    'hub_health_consent',
    'hub_dashboard_layout',
    'hub_onboarding',
    'hub_schema_versions',
    'hub_friend_profiles',
    'hub_friend_invites',
    'hub_friendships',
    'hub_friend_messages',
    'hub_friend_message_outbox',
    'hub_human_verification',
    'hub_revoked_entitlements',
  ];

  // Tables that are hub infrastructure (don't touch)
  const hubInfrastructure = new Set([
    ...hubTablesToClear,
    'hub_mode',
    'hub_entitlements',
    'hub_backups',
    'hub_backup_config',
  ]);

  let tablesDropped = 0;

  db.transaction(() => {
    // Drop all non-hub tables (module tables like bk_books, bg_accounts, etc.)
    for (const { name } of allTables) {
      if (!hubInfrastructure.has(name)) {
        db.execute(`DROP TABLE IF EXISTS "${name}"`);
        tablesDropped++;
      }
    }

    // Clear hub data tables
    for (const table of hubTablesToClear) {
      db.execute(`DELETE FROM "${table}"`);
    }
  });

  return { tablesDropped };
}

/**
 * Get row counts for all tables matching a given prefix.
 * Used by the Privacy Dashboard to show per-module data summary.
 */
export function getModuleTableStats(
  db: DatabaseAdapter,
  tablePrefix: string,
): { tableName: string; rowCount: number }[] {
  const tables = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
    [`${tablePrefix}%`],
  );

  return tables.map(({ name }) => {
    const rows = db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM "${name}"`);
    return { tableName: name, rowCount: rows[0]?.cnt ?? 0 };
  });
}

/**
 * Get the total size of the SQLite database in bytes.
 * Uses PRAGMA page_count * page_size for an accurate file-level estimate.
 */
export function getDatabaseSize(db: DatabaseAdapter): number {
  const pages = db.query<{ page_count: number }>(
    `PRAGMA page_count`,
  );
  const size = db.query<{ page_size: number }>(
    `PRAGMA page_size`,
  );
  const pageCount = pages[0]?.page_count ?? 0;
  const pageSize = size[0]?.page_size ?? 0;
  return pageCount * pageSize;
}

/** Module IDs that store data in a cloud backend (Supabase or Drizzle). */
export const CLOUD_STORAGE_MODULES = new Set([
  'forums',
  'market',
  'payments',
  'surf',
  'workouts',
  'homes',
]);

export interface ModuleDeletionResult {
  moduleId: string;
  tablesDropped: number;
  schemaVersionsCleared: number;
  hasCloudData: boolean;
}

/**
 * Delete all data for a specific module by dropping its prefixed tables,
 * resetting its schema version, and cleaning up related hub records.
 *
 * For cloud modules (forums, market, surf, workouts, homes), sets
 * hasCloudData=true so callers can trigger server-side deletion.
 *
 * R17.1: Delete all local data for the module.
 * R17.3: Reset schema version so migrations re-run on next enable.
 * R17.4: Flag cloud modules for additional server-side deletion.
 */
export function deleteModuleData(
  db: DatabaseAdapter,
  moduleId: string,
  tablePrefix: string,
): ModuleDeletionResult {
  const tables = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
    [`${tablePrefix}%`],
  );

  let tablesDropped = 0;
  let schemaVersionsCleared = 0;

  db.transaction(() => {
    // Drop all module-prefixed tables
    for (const { name } of tables) {
      db.execute(`DROP TABLE IF EXISTS "${name}"`);
      tablesDropped++;
    }

    // Count schema versions before deletion
    const versions = db.query<{ version: number }>(
      `SELECT version FROM hub_schema_versions WHERE module_id = ?`,
      [moduleId],
    );
    schemaVersionsCleared = versions.length;

    // Reset schema version so migrations re-run on next enable
    db.execute(
      `DELETE FROM hub_schema_versions WHERE module_id = ?`,
      [moduleId],
    );

    // Remove module from enabled list
    db.execute(
      `DELETE FROM hub_enabled_modules WHERE module_id = ?`,
      [moduleId],
    );

    // Clean up related hub records
    db.execute(
      `DELETE FROM hub_health_consent WHERE module_id = ?`,
      [moduleId],
    );
    db.execute(
      `DELETE FROM hub_dashboard_layout WHERE module_id = ?`,
      [moduleId],
    );
    db.execute(
      `DELETE FROM hub_entitlement_cache WHERE module_id = ?`,
      [moduleId],
    );
    db.execute(
      `DELETE FROM hub_sharing_preferences WHERE module_id = ?`,
      [moduleId],
    );
  });

  return {
    moduleId,
    tablesDropped,
    schemaVersionsCleared,
    hasCloudData: CLOUD_STORAGE_MODULES.has(moduleId),
  };
}

/**
 * Remove all migration version records for a module from hub_schema_versions.
 * This ensures migrations re-run when the module is next enabled.
 * Returns the number of version records removed.
 */
export function resetModuleSchemaVersion(
  db: DatabaseAdapter,
  moduleId: string,
): number {
  const existing = db.query<{ version: number }>(
    `SELECT version FROM hub_schema_versions WHERE module_id = ?`,
    [moduleId],
  );

  if (existing.length > 0) {
    db.execute(
      `DELETE FROM hub_schema_versions WHERE module_id = ?`,
      [moduleId],
    );
  }

  return existing.length;
}

/**
 * Reset dashboard layout to smart defaults based on enabled modules.
 * Clears all existing layout rows and inserts one row per enabled module
 * ordered alphabetically by module_id.
 */
export function resetDashboardLayout(
  db: DatabaseAdapter,
  enabledModuleIds: string[],
): DashboardCard[] {
  const now = new Date().toISOString();
  db.execute(`DELETE FROM hub_dashboard_layout`);
  const sorted = [...enabledModuleIds].sort();
  for (let i = 0; i < sorted.length; i++) {
    db.execute(
      `INSERT INTO hub_dashboard_layout (module_id, position, visible, card_size, created_at, updated_at)
       VALUES (?, ?, 1, 'standard', ?, ?)`,
      [sorted[i], i, now, now],
    );
  }
  return getDashboardLayout(db);
}

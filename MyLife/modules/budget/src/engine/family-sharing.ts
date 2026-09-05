/**
 * Family sharing engine.
 *
 * Invite code generation, conflict resolution for sync,
 * permission checks for envelope sharing modes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncPayload {
  operation: 'create' | 'update' | 'delete';
  tableName: string;
  recordId: string;
  record: Record<string, unknown>;
  timestamp: string;
  deviceId: string;
}

export interface ConflictResult {
  winner: SyncPayload;
  loser: SyncPayload;
}

// ---------------------------------------------------------------------------
// Invite code generation
// ---------------------------------------------------------------------------

const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 for clarity
const INVITE_LENGTH = 8;
const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

export function isInviteExpired(createdAt: string, now?: Date): boolean {
  const created = new Date(createdAt).getTime();
  const current = (now ?? new Date()).getTime();
  return current - created > INVITE_EXPIRY_MS;
}

// ---------------------------------------------------------------------------
// Sync conflict resolution (last-write-wins)
// ---------------------------------------------------------------------------

/**
 * Resolve a sync conflict using last-write-wins.
 * For equal timestamps, the record with lexically later device_id wins.
 */
export function resolveConflict(a: SyncPayload, b: SyncPayload): ConflictResult {
  const cmp = a.timestamp.localeCompare(b.timestamp);
  if (cmp > 0) return { winner: a, loser: b };
  if (cmp < 0) return { winner: b, loser: a };
  // Equal timestamp: tiebreak by device ID
  return a.deviceId > b.deviceId
    ? { winner: a, loser: b }
    : { winner: b, loser: a };
}

/**
 * Build a sync payload from changed records since a timestamp.
 */
export function buildSyncPayload(
  changes: Array<{ operation: 'create' | 'update' | 'delete'; tableName: string; recordId: string; record: Record<string, unknown>; timestamp: string }>,
  deviceId: string,
): SyncPayload[] {
  return changes.map(c => ({ ...c, deviceId }));
}

/**
 * Apply sync payloads to determine final state.
 * Returns payloads sorted by timestamp (oldest first) for sequential application.
 */
export function orderPayloadsForApplication(payloads: SyncPayload[]): SyncPayload[] {
  return [...payloads].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ---------------------------------------------------------------------------
// Sharing permissions
// ---------------------------------------------------------------------------

export type SharingMode = 'shared' | 'visible' | 'private';
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Check if a member can perform a write operation on a shared envelope.
 */
export function canWriteToEnvelope(
  sharingMode: SharingMode,
  role: MemberRole,
  isOwner: boolean,
): boolean {
  if (sharingMode === 'private') return isOwner;
  if (sharingMode === 'visible') return isOwner;
  // 'shared' mode
  if (role === 'viewer') return false;
  return true;
}

/**
 * Check if a member can view an envelope.
 */
export function canViewEnvelope(
  sharingMode: SharingMode,
  isOwner: boolean,
): boolean {
  if (sharingMode === 'private') return isOwner;
  return true; // 'shared' and 'visible' are viewable by all
}

/**
 * Maximum family size.
 */
export const MAX_FAMILY_SIZE = 6;

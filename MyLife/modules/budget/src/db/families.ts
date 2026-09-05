/**
 * CRUD operations for Family Sharing.
 * Tables: bg_families, bg_family_members, bg_envelope_sharing, bg_sync_log
 *
 * Families group household members who share budget envelopes.
 * Invite codes enable device-to-device family joining.
 * Sync log tracks changes for eventual consistency across devices.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Family,
  FamilyInsert,
  FamilyMember,
  FamilyMemberInsert,
  FamilyMemberUpdate,
  EnvelopeSharingRecord,
  EnvelopeSharingInsert,
  SyncLogEntry,
  SyncLogInsert,
} from '../types';

const FAMILY_MEMBER_COLUMNS = new Set([
  'display_name', 'avatar_emoji', 'role', 'last_sync_at', 'is_active',
]);

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

export function createFamily(
  db: DatabaseAdapter,
  id: string,
  input: FamilyInsert,
): Family {
  const now = new Date().toISOString();
  const family: Family = {
    id,
    name: input.name ?? 'My Family',
    created_by_device_id: input.created_by_device_id,
    invite_code: input.invite_code,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_families
      (id, name, created_by_device_id, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      family.id, family.name, family.created_by_device_id,
      family.invite_code, family.created_at, family.updated_at,
    ],
  );

  return family;
}

export function getFamilyById(
  db: DatabaseAdapter,
  id: string,
): Family | null {
  const rows = db.query<Family>(
    `SELECT * FROM bg_families WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getFamilyByInviteCode(
  db: DatabaseAdapter,
  inviteCode: string,
): Family | null {
  const rows = db.query<Family>(
    `SELECT * FROM bg_families WHERE invite_code = ?`,
    [inviteCode],
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Family Members
// ---------------------------------------------------------------------------

export function createFamilyMember(
  db: DatabaseAdapter,
  id: string,
  input: FamilyMemberInsert,
): FamilyMember {
  const now = new Date().toISOString();
  const member: FamilyMember = {
    id,
    family_id: input.family_id,
    device_id: input.device_id,
    display_name: input.display_name,
    avatar_emoji: input.avatar_emoji ?? '\u{1F464}',
    role: input.role ?? 'member',
    joined_at: now,
    last_sync_at: input.last_sync_at ?? null,
    is_active: input.is_active ?? 1,
  };

  db.execute(
    `INSERT INTO bg_family_members
      (id, family_id, device_id, display_name, avatar_emoji, role,
       joined_at, last_sync_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      member.id, member.family_id, member.device_id, member.display_name,
      member.avatar_emoji, member.role, member.joined_at,
      member.last_sync_at, member.is_active,
    ],
  );

  return member;
}

export function getFamilyMembers(
  db: DatabaseAdapter,
  familyId: string,
): FamilyMember[] {
  return db.query<FamilyMember>(
    `SELECT * FROM bg_family_members WHERE family_id = ? AND is_active = 1 ORDER BY joined_at ASC`,
    [familyId],
  );
}

export function updateFamilyMember(
  db: DatabaseAdapter,
  id: string,
  updates: FamilyMemberUpdate,
): FamilyMember | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && FAMILY_MEMBER_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    const rows = db.query<FamilyMember>(
      `SELECT * FROM bg_family_members WHERE id = ?`,
      [id],
    );
    return rows[0] ?? null;
  }

  values.push(id);

  db.execute(
    `UPDATE bg_family_members SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  const rows = db.query<FamilyMember>(
    `SELECT * FROM bg_family_members WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function removeFamilyMember(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE bg_family_members SET is_active = 0 WHERE id = ?`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Envelope Sharing
// ---------------------------------------------------------------------------

export function setEnvelopeSharingMode(
  db: DatabaseAdapter,
  id: string,
  input: EnvelopeSharingInsert,
): EnvelopeSharingRecord {
  const now = new Date().toISOString();
  const record: EnvelopeSharingRecord = {
    id,
    envelope_id: input.envelope_id,
    family_id: input.family_id,
    sharing_mode: input.sharing_mode ?? 'shared',
    created_at: now,
  };

  db.execute(
    `INSERT OR REPLACE INTO bg_envelope_sharing
      (id, envelope_id, family_id, sharing_mode, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      record.id, record.envelope_id, record.family_id,
      record.sharing_mode, record.created_at,
    ],
  );

  return record;
}

export function getEnvelopeSharingModes(
  db: DatabaseAdapter,
  familyId: string,
): EnvelopeSharingRecord[] {
  return db.query<EnvelopeSharingRecord>(
    `SELECT * FROM bg_envelope_sharing WHERE family_id = ? ORDER BY envelope_id ASC`,
    [familyId],
  );
}

// ---------------------------------------------------------------------------
// Sync Log
// ---------------------------------------------------------------------------

export function createSyncLogEntry(
  db: DatabaseAdapter,
  id: string,
  input: SyncLogInsert,
): SyncLogEntry {
  const now = new Date().toISOString();
  const entry: SyncLogEntry = {
    id,
    family_id: input.family_id,
    device_id: input.device_id,
    operation: input.operation,
    table_name: input.table_name,
    record_id: input.record_id,
    payload: input.payload,
    timestamp: input.timestamp,
    applied: input.applied ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_sync_log
      (id, family_id, device_id, operation, table_name, record_id,
       payload, timestamp, applied, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id, entry.family_id, entry.device_id, entry.operation,
      entry.table_name, entry.record_id, entry.payload, entry.timestamp,
      entry.applied, entry.created_at,
    ],
  );

  return entry;
}

export function getSyncLogSince(
  db: DatabaseAdapter,
  familyId: string,
  sinceTimestamp: string,
): SyncLogEntry[] {
  return db.query<SyncLogEntry>(
    `SELECT * FROM bg_sync_log
     WHERE family_id = ? AND timestamp > ?
     ORDER BY timestamp ASC`,
    [familyId, sinceTimestamp],
  );
}

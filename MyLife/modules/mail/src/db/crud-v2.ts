import type { DatabaseAdapter } from '@mylife/db';
import type {
  MailAttachment,
  CreateAttachmentInput,
  MailFilter,
  MailContact,
  CreateMailContactInput,
  UpdateMailContactInput,
  MailThread,
  CreateMailThreadInput,
  CalendarEvent,
  CreateCalendarEventInput,
  RSVPStatus,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  EncryptionKey,
  CreateEncryptionKeyInput,
  SyncState,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

// ── Attachments ──────────────────────────────────────────────────────

export function createAttachment(
  db: DatabaseAdapter,
  id: string,
  input: CreateAttachmentInput,
): MailAttachment {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_attachments (id, message_id, draft_id, filename, mime_type, size_bytes, local_path, is_inline, content_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.messageId ?? null,
      input.draftId ?? null,
      input.filename,
      input.mimeType,
      input.sizeBytes,
      input.localPath ?? null,
      input.isInline ? 1 : 0,
      input.contentId ?? null,
      now,
    ],
  );
  return {
    id,
    messageId: input.messageId ?? null,
    draftId: input.draftId ?? null,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    localPath: input.localPath ?? null,
    isInline: input.isInline ?? false,
    contentId: input.contentId ?? null,
    createdAt: now,
  };
}

export function getAttachmentsByMessage(db: DatabaseAdapter, messageId: string): MailAttachment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_attachments WHERE message_id = ? ORDER BY created_at ASC`,
    [messageId],
  );
  return rows.map(rowToAttachment);
}

export function getAttachmentsByDraft(db: DatabaseAdapter, draftId: string): MailAttachment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_attachments WHERE draft_id = ? ORDER BY created_at ASC`,
    [draftId],
  );
  return rows.map(rowToAttachment);
}

export function deleteAttachment(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_attachments WHERE id = ?`, [id]);
  return true;
}

function rowToAttachment(row: Record<string, unknown>): MailAttachment {
  return {
    id: row.id as string,
    messageId: (row.message_id as string) ?? null,
    draftId: (row.draft_id as string) ?? null,
    filename: row.filename as string,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    localPath: (row.local_path as string) ?? null,
    isInline: (row.is_inline as number) === 1,
    contentId: (row.content_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── Filters ──────────────────────────────────────────────────────────

export function createFilter(
  db: DatabaseAdapter,
  id: string,
  input: {
    accountId: string;
    name: string;
    field: string;
    pattern: string;
    action: string;
    actionValue?: string;
    priority?: number;
  },
): MailFilter {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_filters (id, account_id, name, field, pattern, action, action_value, is_active, priority, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, input.accountId, input.name, input.field, input.pattern, input.action, input.actionValue ?? null, input.priority ?? 0, now],
  );
  return {
    id,
    accountId: input.accountId,
    name: input.name,
    field: input.field as MailFilter['field'],
    pattern: input.pattern,
    action: input.action as MailFilter['action'],
    actionValue: input.actionValue ?? null,
    isActive: true,
    priority: input.priority ?? 0,
    createdAt: now,
  };
}

export function getFilters(db: DatabaseAdapter, accountId: string): MailFilter[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_filters WHERE account_id = ? ORDER BY priority ASC, created_at ASC`,
    [accountId],
  );
  return rows.map(rowToFilter);
}

export function toggleFilter(db: DatabaseAdapter, id: string): MailFilter | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_filters WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;
  const current = (rows[0].is_active as number) === 1;
  db.execute(`UPDATE ml_filters SET is_active = ? WHERE id = ?`, [current ? 0 : 1, id]);
  const updated = db.query<Record<string, unknown>>(`SELECT * FROM ml_filters WHERE id = ?`, [id]);
  return updated.length > 0 ? rowToFilter(updated[0]) : null;
}

export function deleteFilter(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_filters WHERE id = ?`, [id]);
  return true;
}

function rowToFilter(row: Record<string, unknown>): MailFilter {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    name: row.name as string,
    field: row.field as MailFilter['field'],
    pattern: row.pattern as string,
    action: row.action as MailFilter['action'],
    actionValue: (row.action_value as string) ?? null,
    isActive: (row.is_active as number) === 1,
    priority: (row.priority as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

// ── Contacts ─────────────────────────────────────────────────────────

export function createContact(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailContactInput,
): MailContact {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_contacts (id, account_id, email, display_name, avatar_url, company, phone, notes, is_vip, source, frequency, last_contacted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [
      id, input.accountId, input.email,
      input.displayName ?? null, input.avatarUrl ?? null,
      input.company ?? null, input.phone ?? null, input.notes ?? null,
      input.isVip ? 1 : 0, input.source ?? 'manual',
      now, now,
    ],
  );
  return {
    id,
    accountId: input.accountId,
    email: input.email,
    displayName: input.displayName ?? null,
    avatarUrl: input.avatarUrl ?? null,
    company: input.company ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    isVip: input.isVip ?? false,
    source: input.source ?? 'manual',
    frequency: 0,
    lastContactedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getContactByEmail(db: DatabaseAdapter, accountId: string, email: string): MailContact | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_contacts WHERE account_id = ? AND email = ?`,
    [accountId, email],
  );
  return rows.length > 0 ? rowToContact(rows[0]) : null;
}

export function getContacts(db: DatabaseAdapter, accountId: string): MailContact[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_contacts WHERE account_id = ? ORDER BY frequency DESC, display_name ASC`,
    [accountId],
  );
  return rows.map(rowToContact);
}

export function searchContacts(db: DatabaseAdapter, accountId: string, query: string): MailContact[] {
  const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
  const like = `%${escaped}%`;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_contacts WHERE account_id = ? AND (email LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
     ORDER BY is_vip DESC, frequency DESC LIMIT 10`,
    [accountId, like, like],
  );
  return rows.map(rowToContact);
}

export function updateContact(
  db: DatabaseAdapter,
  id: string,
  input: UpdateMailContactInput,
): MailContact | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM ml_contacts WHERE id = ?`, [id]);
  if (rows.length === 0) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.displayName !== undefined) { updates.push('display_name = ?'); params.push(input.displayName); }
  if (input.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(input.avatarUrl); }
  if (input.company !== undefined) { updates.push('company = ?'); params.push(input.company); }
  if (input.phone !== undefined) { updates.push('phone = ?'); params.push(input.phone); }
  if (input.notes !== undefined) { updates.push('notes = ?'); params.push(input.notes); }
  if (input.isVip !== undefined) { updates.push('is_vip = ?'); params.push(input.isVip ? 1 : 0); }

  if (updates.length === 0) return rowToContact(rows[0]);

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE ml_contacts SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = db.query<Record<string, unknown>>(`SELECT * FROM ml_contacts WHERE id = ?`, [id]);
  return updated.length > 0 ? rowToContact(updated[0]) : null;
}

export function incrementContactFrequency(db: DatabaseAdapter, accountId: string, email: string): void {
  db.execute(
    `UPDATE ml_contacts SET frequency = frequency + 1, last_contacted_at = ? WHERE account_id = ? AND email = ?`,
    [nowIso(), accountId, email],
  );
}

export function toggleContactVip(db: DatabaseAdapter, id: string): MailContact | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM ml_contacts WHERE id = ?`, [id]);
  if (rows.length === 0) return null;
  const current = (rows[0].is_vip as number) === 1;
  db.execute(`UPDATE ml_contacts SET is_vip = ?, updated_at = ? WHERE id = ?`, [current ? 0 : 1, nowIso(), id]);
  const updated = db.query<Record<string, unknown>>(`SELECT * FROM ml_contacts WHERE id = ?`, [id]);
  return updated.length > 0 ? rowToContact(updated[0]) : null;
}

export function deleteContact(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_contacts WHERE id = ?`, [id]);
  return true;
}

function rowToContact(row: Record<string, unknown>): MailContact {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    email: row.email as string,
    displayName: (row.display_name as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    company: (row.company as string) ?? null,
    phone: (row.phone as string) ?? null,
    notes: (row.notes as string) ?? null,
    isVip: (row.is_vip as number) === 1,
    source: (row.source as MailContact['source']) ?? 'manual',
    frequency: (row.frequency as number) ?? 0,
    lastContactedAt: (row.last_contacted_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Threads ──────────────────────────────────────────────────────────

export function createThread(
  db: DatabaseAdapter,
  id: string,
  input: CreateMailThreadInput,
): MailThread {
  const now = nowIso();
  const participants = JSON.stringify(input.participantEmails ?? []);
  db.execute(
    `INSERT INTO ml_threads (id, account_id, subject, participant_emails, message_count, unread_count, latest_message_at, is_muted, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 1, ?, 0, ?, ?)`,
    [id, input.accountId, input.subject, participants, input.latestMessageAt, now, now],
  );
  return {
    id,
    accountId: input.accountId,
    subject: input.subject,
    participantEmails: input.participantEmails ?? [],
    messageCount: 1,
    unreadCount: 1,
    latestMessageAt: input.latestMessageAt,
    isMuted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getMessagesByThread(db: DatabaseAdapter, threadId: string): import('../types').MailMessage[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_messages WHERE thread_id = ? ORDER BY received_at ASC`,
    [threadId],
  );
  // Re-use the same row mapping as crud.ts
  return rows.map((row) => {
    let to: string[];
    try { to = JSON.parse(row.to as string); } catch { to = []; }
    return {
      id: row.id as string,
      accountId: row.account_id as string,
      subject: row.subject as string,
      from: row.from as string,
      to,
      body: row.body as string,
      isRead: (row.is_read as number) === 1,
      isStarred: (row.is_starred as number) === 1,
      folder: row.folder as string,
      receivedAt: row.received_at as string,
      createdAt: row.created_at as string,
    };
  });
}

export function getThread(db: DatabaseAdapter, id: string): MailThread | null {
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM ml_threads WHERE id = ?`, [id]);
  return rows.length > 0 ? rowToThread(rows[0]) : null;
}

export function getThreads(db: DatabaseAdapter, accountId: string, limit = 50, offset = 0): MailThread[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_threads WHERE account_id = ? ORDER BY latest_message_at DESC LIMIT ? OFFSET ?`,
    [accountId, limit, offset],
  );
  return rows.map(rowToThread);
}

export function updateThreadMetadata(
  db: DatabaseAdapter,
  threadId: string,
  data: { messageCount: number; unreadCount: number; latestMessageAt: string; participantEmails: string[] },
): void {
  db.execute(
    `UPDATE ml_threads SET message_count = ?, unread_count = ?, latest_message_at = ?, participant_emails = ?, updated_at = ? WHERE id = ?`,
    [data.messageCount, data.unreadCount, data.latestMessageAt, JSON.stringify(data.participantEmails), nowIso(), threadId],
  );
}

export function muteThread(db: DatabaseAdapter, id: string, muted: boolean): void {
  db.execute(`UPDATE ml_threads SET is_muted = ?, updated_at = ? WHERE id = ?`, [muted ? 1 : 0, nowIso(), id]);
}

export function deleteThread(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_threads WHERE id = ?`, [id]);
  return true;
}

function rowToThread(row: Record<string, unknown>): MailThread {
  let participants: string[];
  try {
    participants = JSON.parse(row.participant_emails as string);
  } catch {
    participants = [];
  }
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    subject: row.subject as string,
    participantEmails: participants,
    messageCount: row.message_count as number,
    unreadCount: row.unread_count as number,
    latestMessageAt: row.latest_message_at as string,
    isMuted: (row.is_muted as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Calendar Events ─────────────────────────────────────────────────

export function createCalendarEvent(
  db: DatabaseAdapter,
  id: string,
  input: CreateCalendarEventInput,
): CalendarEvent {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_calendar_events (id, message_id, account_id, title, description, location, start_time, end_time, organizer, attendees, ics_uid, rsvp_status, is_all_day, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      id, input.messageId, input.accountId, input.title,
      input.description ?? null, input.location ?? null,
      input.startTime, input.endTime,
      input.organizer ?? null,
      JSON.stringify(input.attendees ?? []),
      input.icsUid ?? null,
      input.isAllDay ? 1 : 0,
      now,
    ],
  );
  return {
    id,
    messageId: input.messageId,
    accountId: input.accountId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    organizer: input.organizer ?? null,
    attendees: input.attendees ?? [],
    icsUid: input.icsUid ?? null,
    rsvpStatus: 'pending',
    isAllDay: input.isAllDay ?? false,
    createdAt: now,
  };
}

export function getCalendarEventsByMessage(db: DatabaseAdapter, messageId: string): CalendarEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_calendar_events WHERE message_id = ? ORDER BY start_time ASC`,
    [messageId],
  );
  return rows.map(rowToCalendarEvent);
}

export function getCalendarEventsByAccount(db: DatabaseAdapter, accountId: string): CalendarEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_calendar_events WHERE account_id = ? ORDER BY start_time ASC`,
    [accountId],
  );
  return rows.map(rowToCalendarEvent);
}

export function getCalendarEventByIcsUid(db: DatabaseAdapter, icsUid: string): CalendarEvent | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_calendar_events WHERE ics_uid = ?`,
    [icsUid],
  );
  return rows.length > 0 ? rowToCalendarEvent(rows[0]) : null;
}

export function updateRsvpStatus(db: DatabaseAdapter, eventId: string, status: RSVPStatus): void {
  db.execute(`UPDATE ml_calendar_events SET rsvp_status = ? WHERE id = ?`, [status, eventId]);
}

function rowToCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  let attendees: string[];
  try {
    attendees = JSON.parse(row.attendees as string);
  } catch {
    attendees = [];
  }
  return {
    id: row.id as string,
    messageId: row.message_id as string,
    accountId: row.account_id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    location: (row.location as string) ?? null,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    organizer: (row.organizer as string) ?? null,
    attendees,
    icsUid: (row.ics_uid as string) ?? null,
    rsvpStatus: (row.rsvp_status as CalendarEvent['rsvpStatus']) ?? 'pending',
    isAllDay: (row.is_all_day as number) === 1,
    createdAt: row.created_at as string,
  };
}

// ── Notification Preferences ────────────────────────────────────────

export function getNotificationPreferences(db: DatabaseAdapter, accountId: string): NotificationPreferences | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_notification_preferences WHERE account_id = ?`,
    [accountId],
  );
  return rows.length > 0 ? rowToNotifPrefs(rows[0]) : null;
}

export function upsertNotificationPreferences(
  db: DatabaseAdapter,
  id: string,
  accountId: string,
  input: UpdateNotificationPreferencesInput,
): NotificationPreferences {
  const existing = getNotificationPreferences(db, accountId);
  const now = nowIso();

  if (existing) {
    const updates: string[] = [];
    const params: unknown[] = [];
    if (input.enabled !== undefined) { updates.push('enabled = ?'); params.push(input.enabled ? 1 : 0); }
    if (input.quietStart !== undefined) { updates.push('quiet_start = ?'); params.push(input.quietStart); }
    if (input.quietEnd !== undefined) { updates.push('quiet_end = ?'); params.push(input.quietEnd); }
    if (input.vipOnly !== undefined) { updates.push('vip_only = ?'); params.push(input.vipOnly ? 1 : 0); }
    if (input.showPreview !== undefined) { updates.push('show_preview = ?'); params.push(input.showPreview ? 1 : 0); }
    if (input.sound !== undefined) { updates.push('sound = ?'); params.push(input.sound); }
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(existing.id);
      db.execute(`UPDATE ml_notification_preferences SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    return getNotificationPreferences(db, accountId)!;
  }

  db.execute(
    `INSERT INTO ml_notification_preferences (id, account_id, enabled, quiet_start, quiet_end, vip_only, show_preview, sound, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, accountId,
      input.enabled !== false ? 1 : 0,
      input.quietStart ?? null,
      input.quietEnd ?? null,
      input.vipOnly ? 1 : 0,
      input.showPreview !== false ? 1 : 0,
      input.sound ?? 'default',
      now, now,
    ],
  );
  return getNotificationPreferences(db, accountId)!;
}

function rowToNotifPrefs(row: Record<string, unknown>): NotificationPreferences {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    enabled: (row.enabled as number) === 1,
    quietStart: (row.quiet_start as string) ?? null,
    quietEnd: (row.quiet_end as string) ?? null,
    vipOnly: (row.vip_only as number) === 1,
    showPreview: (row.show_preview as number) === 1,
    sound: (row.sound as string) ?? 'default',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Encryption Keys ─────────────────────────────────────────────────

export function createEncryptionKey(
  db: DatabaseAdapter,
  id: string,
  input: CreateEncryptionKeyInput,
): EncryptionKey {
  const now = nowIso();
  db.execute(
    `INSERT INTO ml_encryption_keys (id, account_id, key_type, public_key, private_key_encrypted, fingerprint, contact_email, is_own_key, is_revoked, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id, input.accountId, input.keyType, input.publicKey,
      input.privateKeyEncrypted ?? null, input.fingerprint,
      input.contactEmail ?? null, input.isOwnKey ? 1 : 0,
      input.expiresAt ?? null, now,
    ],
  );
  return {
    id,
    accountId: input.accountId,
    keyType: input.keyType,
    publicKey: input.publicKey,
    privateKeyEncrypted: input.privateKeyEncrypted ?? null,
    fingerprint: input.fingerprint,
    contactEmail: input.contactEmail ?? null,
    isOwnKey: input.isOwnKey ?? false,
    isRevoked: false,
    expiresAt: input.expiresAt ?? null,
    createdAt: now,
  };
}

export function getEncryptionKeys(db: DatabaseAdapter, accountId: string): EncryptionKey[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_encryption_keys WHERE account_id = ? ORDER BY created_at DESC`,
    [accountId],
  );
  return rows.map(rowToEncryptionKey);
}

export function getKeyByFingerprint(db: DatabaseAdapter, fingerprint: string): EncryptionKey | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_encryption_keys WHERE fingerprint = ?`,
    [fingerprint],
  );
  return rows.length > 0 ? rowToEncryptionKey(rows[0]) : null;
}

export function revokeKey(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE ml_encryption_keys SET is_revoked = 1 WHERE id = ?`, [id]);
}

export function deleteEncryptionKey(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM ml_encryption_keys WHERE id = ?`, [id]);
  return true;
}

function rowToEncryptionKey(row: Record<string, unknown>): EncryptionKey {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    keyType: row.key_type as EncryptionKey['keyType'],
    publicKey: row.public_key as string,
    privateKeyEncrypted: (row.private_key_encrypted as string) ?? null,
    fingerprint: row.fingerprint as string,
    contactEmail: (row.contact_email as string) ?? null,
    isOwnKey: (row.is_own_key as number) === 1,
    isRevoked: (row.is_revoked as number) === 1,
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── Sync State ──────────────────────────────────────────────────────

export function upsertSyncState(
  db: DatabaseAdapter,
  id: string,
  accountId: string,
  folder: string,
  data: { lastUid?: string; uidvalidity?: string; status?: string; errorMessage?: string },
): SyncState {
  const now = nowIso();
  const existing = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_sync_state WHERE account_id = ? AND folder = ?`,
    [accountId, folder],
  );

  if (existing.length > 0) {
    const updates: string[] = [];
    const params: unknown[] = [];
    if (data.lastUid !== undefined) { updates.push('last_uid = ?'); params.push(data.lastUid); }
    if (data.uidvalidity !== undefined) { updates.push('uidvalidity = ?'); params.push(data.uidvalidity); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.errorMessage !== undefined) { updates.push('error_message = ?'); params.push(data.errorMessage); }
    updates.push('last_sync_at = ?');
    params.push(now);
    params.push(existing[0].id as string);
    db.execute(`UPDATE ml_sync_state SET ${updates.join(', ')} WHERE id = ?`, params);
    return getSyncState(db, accountId, folder)!;
  }

  db.execute(
    `INSERT INTO ml_sync_state (id, account_id, folder, last_uid, last_sync_at, uidvalidity, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, accountId, folder, data.lastUid ?? null, now, data.uidvalidity ?? null, data.status ?? 'idle', data.errorMessage ?? null],
  );
  return getSyncState(db, accountId, folder)!;
}

export function getSyncState(db: DatabaseAdapter, accountId: string, folder: string): SyncState | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_sync_state WHERE account_id = ? AND folder = ?`,
    [accountId, folder],
  );
  return rows.length > 0 ? rowToSyncState(rows[0]) : null;
}

export function getSyncStates(db: DatabaseAdapter, accountId: string): SyncState[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ml_sync_state WHERE account_id = ? ORDER BY folder ASC`,
    [accountId],
  );
  return rows.map(rowToSyncState);
}

function rowToSyncState(row: Record<string, unknown>): SyncState {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    folder: row.folder as string,
    lastUid: (row.last_uid as string) ?? null,
    lastSyncAt: (row.last_sync_at as string) ?? null,
    uidvalidity: (row.uidvalidity as string) ?? null,
    status: (row.status as SyncState['status']) ?? 'idle',
    errorMessage: (row.error_message as string) ?? null,
  };
}

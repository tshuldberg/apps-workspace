import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MAIL_MODULE } from '../definition';
import {
  createAccount,
  createMessage,
  deleteAccount,
} from '../db/crud';
import {
  createAttachment,
  getAttachmentsByMessage,
  getAttachmentsByDraft,
  deleteAttachment,
  createFilter,
  getFilters,
  toggleFilter,
  deleteFilter,
  createContact,
  getContactByEmail,
  getContacts,
  searchContacts,
  updateContact,
  incrementContactFrequency,
  toggleContactVip,
  createThread,
  getThread,
  getThreads,
  updateThreadMetadata,
  muteThread,
  deleteThread,
  createCalendarEvent,
  getCalendarEventsByMessage,
  getCalendarEventByIcsUid,
  updateRsvpStatus,
  getNotificationPreferences,
  upsertNotificationPreferences,
  createEncryptionKey,
  getEncryptionKeys,
  getKeyByFingerprint,
  revokeKey,
  deleteEncryptionKey,
  upsertSyncState,
  getSyncState,
  getSyncStates,
} from '../db/crud-v2';
import { createDraft } from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mail', MAIL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function seedAccount(id = 'acc-1') {
  return createAccount(testDb.adapter, id, {
    email: 'user@example.com',
    displayName: 'Test User',
    serverHost: 'mail.example.com',
    serverPort: 993,
  });
}

function seedMessage(id = 'm1', accountId = 'acc-1') {
  return createMessage(testDb.adapter, id, {
    accountId,
    subject: 'Test Subject',
    from: 'sender@test.com',
    to: ['user@example.com'],
    body: 'Test body',
  });
}

// ── Attachments ──────────────────────────────────────────────────────

describe('Attachments', () => {
  it('creates an attachment for a message', () => {
    seedAccount();
    seedMessage();
    const att = createAttachment(testDb.adapter, 'att-1', {
      messageId: 'm1',
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024000,
    });
    expect(att.id).toBe('att-1');
    expect(att.filename).toBe('report.pdf');
    expect(att.sizeBytes).toBe(1024000);
    expect(att.messageId).toBe('m1');
  });

  it('gets attachments by message', () => {
    seedAccount();
    seedMessage();
    createAttachment(testDb.adapter, 'att-1', { messageId: 'm1', filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 100 });
    createAttachment(testDb.adapter, 'att-2', { messageId: 'm1', filename: 'b.jpg', mimeType: 'image/jpeg', sizeBytes: 200 });
    const list = getAttachmentsByMessage(testDb.adapter, 'm1');
    expect(list).toHaveLength(2);
  });

  it('gets attachments by draft', () => {
    seedAccount();
    createDraft(testDb.adapter, 'd1', { accountId: 'acc-1' });
    createAttachment(testDb.adapter, 'att-3', { draftId: 'd1', filename: 'c.txt', mimeType: 'text/plain', sizeBytes: 50 });
    const list = getAttachmentsByDraft(testDb.adapter, 'd1');
    expect(list).toHaveLength(1);
  });

  it('deletes an attachment', () => {
    seedAccount();
    seedMessage();
    createAttachment(testDb.adapter, 'att-4', { messageId: 'm1', filename: 'd.png', mimeType: 'image/png', sizeBytes: 300 });
    deleteAttachment(testDb.adapter, 'att-4');
    expect(getAttachmentsByMessage(testDb.adapter, 'm1')).toHaveLength(0);
  });

  it('cascade deletes attachments when message deleted', () => {
    seedAccount();
    seedMessage();
    createAttachment(testDb.adapter, 'att-5', { messageId: 'm1', filename: 'e.doc', mimeType: 'application/msword', sizeBytes: 400 });
    expect(getAttachmentsByMessage(testDb.adapter, 'm1')).toHaveLength(1);
    testDb.adapter.execute(`DELETE FROM ml_messages WHERE id = 'm1'`);
    expect(getAttachmentsByMessage(testDb.adapter, 'm1')).toHaveLength(0);
  });
});

// ── Filters ──────────────────────────────────────────────────────────

describe('Filters', () => {
  it('creates a filter', () => {
    seedAccount();
    const f = createFilter(testDb.adapter, 'f-1', {
      accountId: 'acc-1',
      name: 'Newsletter auto-read',
      field: 'from',
      pattern: 'newsletter@',
      action: 'mark_read',
      priority: 0,
    });
    expect(f.id).toBe('f-1');
    expect(f.isActive).toBe(true);
    expect(f.field).toBe('from');
  });

  it('lists filters by account sorted by priority', () => {
    seedAccount();
    createFilter(testDb.adapter, 'f-2', { accountId: 'acc-1', name: 'Low', field: 'from', pattern: 'x', action: 'star', priority: 5 });
    createFilter(testDb.adapter, 'f-3', { accountId: 'acc-1', name: 'High', field: 'from', pattern: 'y', action: 'move', actionValue: 'Spam', priority: 1 });
    const list = getFilters(testDb.adapter, 'acc-1');
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('High');
  });

  it('toggles filter active state', () => {
    seedAccount();
    createFilter(testDb.adapter, 'f-4', { accountId: 'acc-1', name: 'T', field: 'subject', pattern: 'test', action: 'delete' });
    const toggled = toggleFilter(testDb.adapter, 'f-4');
    expect(toggled?.isActive).toBe(false);
    const toggled2 = toggleFilter(testDb.adapter, 'f-4');
    expect(toggled2?.isActive).toBe(true);
  });

  it('deletes a filter', () => {
    seedAccount();
    createFilter(testDb.adapter, 'f-5', { accountId: 'acc-1', name: 'D', field: 'body', pattern: 'spam', action: 'delete' });
    deleteFilter(testDb.adapter, 'f-5');
    expect(getFilters(testDb.adapter, 'acc-1')).toHaveLength(0);
  });

  it('cascade deletes filters with account', () => {
    seedAccount();
    createFilter(testDb.adapter, 'f-6', { accountId: 'acc-1', name: 'C', field: 'from', pattern: 'a', action: 'star' });
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getFilters(testDb.adapter, 'acc-1')).toHaveLength(0);
  });
});

// ── Contacts ─────────────────────────────────────────────────────────

describe('Contacts', () => {
  it('creates a contact', () => {
    seedAccount();
    const c = createContact(testDb.adapter, 'c-1', {
      accountId: 'acc-1',
      email: 'friend@example.com',
      displayName: 'Friend',
    });
    expect(c.email).toBe('friend@example.com');
    expect(c.displayName).toBe('Friend');
    expect(c.frequency).toBe(0);
  });

  it('gets contact by email', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-2', { accountId: 'acc-1', email: 'a@b.com' });
    const found = getContactByEmail(testDb.adapter, 'acc-1', 'a@b.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('a@b.com');
    expect(getContactByEmail(testDb.adapter, 'acc-1', 'nope@b.com')).toBeNull();
  });

  it('enforces unique account+email', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-3', { accountId: 'acc-1', email: 'dup@test.com' });
    expect(() => {
      createContact(testDb.adapter, 'c-4', { accountId: 'acc-1', email: 'dup@test.com' });
    }).toThrow();
  });

  it('searches contacts by email and name', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-5', { accountId: 'acc-1', email: 'john@work.com', displayName: 'John Doe' });
    createContact(testDb.adapter, 'c-6', { accountId: 'acc-1', email: 'jane@work.com', displayName: 'Jane Smith' });
    expect(searchContacts(testDb.adapter, 'acc-1', 'john')).toHaveLength(1);
    expect(searchContacts(testDb.adapter, 'acc-1', 'work.com')).toHaveLength(2);
  });

  it('increments frequency', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-7', { accountId: 'acc-1', email: 'freq@test.com' });
    incrementContactFrequency(testDb.adapter, 'acc-1', 'freq@test.com');
    incrementContactFrequency(testDb.adapter, 'acc-1', 'freq@test.com');
    const c = getContactByEmail(testDb.adapter, 'acc-1', 'freq@test.com');
    expect(c!.frequency).toBe(2);
    expect(c!.lastContactedAt).not.toBeNull();
  });

  it('toggles VIP status', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-8', { accountId: 'acc-1', email: 'vip@test.com' });
    const toggled = toggleContactVip(testDb.adapter, 'c-8');
    expect(toggled!.isVip).toBe(true);
    const toggled2 = toggleContactVip(testDb.adapter, 'c-8');
    expect(toggled2!.isVip).toBe(false);
  });

  it('updates contact fields', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-9', { accountId: 'acc-1', email: 'up@test.com' });
    const updated = updateContact(testDb.adapter, 'c-9', { displayName: 'Updated', company: 'Acme' });
    expect(updated!.displayName).toBe('Updated');
    expect(updated!.company).toBe('Acme');
  });

  it('cascade deletes contacts with account', () => {
    seedAccount();
    createContact(testDb.adapter, 'c-10', { accountId: 'acc-1', email: 'del@test.com' });
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getContacts(testDb.adapter, 'acc-1')).toHaveLength(0);
  });
});

// ── Threads ──────────────────────────────────────────────────────────

describe('Threads', () => {
  it('creates a thread', () => {
    seedAccount();
    const t = createThread(testDb.adapter, 't-1', {
      accountId: 'acc-1',
      subject: 'Project Update',
      participantEmails: ['a@b.com', 'c@d.com'],
      latestMessageAt: '2026-03-22T10:00:00Z',
    });
    expect(t.subject).toBe('Project Update');
    expect(t.participantEmails).toEqual(['a@b.com', 'c@d.com']);
    expect(t.messageCount).toBe(1);
  });

  it('gets thread by id', () => {
    seedAccount();
    createThread(testDb.adapter, 't-2', { accountId: 'acc-1', subject: 'S', latestMessageAt: '2026-03-22T10:00:00Z' });
    expect(getThread(testDb.adapter, 't-2')).not.toBeNull();
    expect(getThread(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists threads sorted by latest message', () => {
    seedAccount();
    createThread(testDb.adapter, 't-3', { accountId: 'acc-1', subject: 'Old', latestMessageAt: '2026-03-20T10:00:00Z' });
    createThread(testDb.adapter, 't-4', { accountId: 'acc-1', subject: 'New', latestMessageAt: '2026-03-22T10:00:00Z' });
    const list = getThreads(testDb.adapter, 'acc-1');
    expect(list[0].subject).toBe('New');
  });

  it('updates thread metadata', () => {
    seedAccount();
    createThread(testDb.adapter, 't-5', { accountId: 'acc-1', subject: 'Up', latestMessageAt: '2026-03-22T10:00:00Z' });
    updateThreadMetadata(testDb.adapter, 't-5', {
      messageCount: 5,
      unreadCount: 2,
      latestMessageAt: '2026-03-22T15:00:00Z',
      participantEmails: ['a@b.com', 'c@d.com', 'e@f.com'],
    });
    const t = getThread(testDb.adapter, 't-5');
    expect(t!.messageCount).toBe(5);
    expect(t!.unreadCount).toBe(2);
    expect(t!.participantEmails).toHaveLength(3);
  });

  it('mutes and unmutes a thread', () => {
    seedAccount();
    createThread(testDb.adapter, 't-6', { accountId: 'acc-1', subject: 'Mute', latestMessageAt: '2026-03-22T10:00:00Z' });
    muteThread(testDb.adapter, 't-6', true);
    expect(getThread(testDb.adapter, 't-6')!.isMuted).toBe(true);
    muteThread(testDb.adapter, 't-6', false);
    expect(getThread(testDb.adapter, 't-6')!.isMuted).toBe(false);
  });

  it('deletes a thread', () => {
    seedAccount();
    createThread(testDb.adapter, 't-7', { accountId: 'acc-1', subject: 'Del', latestMessageAt: '2026-03-22T10:00:00Z' });
    deleteThread(testDb.adapter, 't-7');
    expect(getThread(testDb.adapter, 't-7')).toBeNull();
  });
});

// ── Calendar Events ─────────────────────────────────────────────────

describe('Calendar Events', () => {
  it('creates a calendar event', () => {
    seedAccount();
    seedMessage();
    const e = createCalendarEvent(testDb.adapter, 'ev-1', {
      messageId: 'm1',
      accountId: 'acc-1',
      title: 'Team Meeting',
      startTime: '2026-03-25T14:00:00Z',
      endTime: '2026-03-25T15:00:00Z',
      location: 'Room 101',
      organizer: 'boss@work.com',
      attendees: ['user@example.com', 'other@work.com'],
      icsUid: 'uid-123@example.com',
    });
    expect(e.title).toBe('Team Meeting');
    expect(e.rsvpStatus).toBe('pending');
    expect(e.attendees).toHaveLength(2);
  });

  it('gets events by message', () => {
    seedAccount();
    seedMessage();
    createCalendarEvent(testDb.adapter, 'ev-2', { messageId: 'm1', accountId: 'acc-1', title: 'A', startTime: '2026-03-25T14:00:00Z', endTime: '2026-03-25T15:00:00Z' });
    createCalendarEvent(testDb.adapter, 'ev-3', { messageId: 'm1', accountId: 'acc-1', title: 'B', startTime: '2026-03-26T14:00:00Z', endTime: '2026-03-26T15:00:00Z' });
    expect(getCalendarEventsByMessage(testDb.adapter, 'm1')).toHaveLength(2);
  });

  it('finds event by ICS UID', () => {
    seedAccount();
    seedMessage();
    createCalendarEvent(testDb.adapter, 'ev-4', { messageId: 'm1', accountId: 'acc-1', title: 'Find Me', startTime: '2026-03-25T14:00:00Z', endTime: '2026-03-25T15:00:00Z', icsUid: 'unique@cal' });
    expect(getCalendarEventByIcsUid(testDb.adapter, 'unique@cal')).not.toBeNull();
    expect(getCalendarEventByIcsUid(testDb.adapter, 'nope')).toBeNull();
  });

  it('updates RSVP status', () => {
    seedAccount();
    seedMessage();
    createCalendarEvent(testDb.adapter, 'ev-5', { messageId: 'm1', accountId: 'acc-1', title: 'RSVP', startTime: '2026-03-25T14:00:00Z', endTime: '2026-03-25T15:00:00Z' });
    updateRsvpStatus(testDb.adapter, 'ev-5', 'accepted');
    const events = getCalendarEventsByMessage(testDb.adapter, 'm1');
    expect(events[0].rsvpStatus).toBe('accepted');
  });

  it('cascade deletes events when message deleted', () => {
    seedAccount();
    seedMessage();
    createCalendarEvent(testDb.adapter, 'ev-6', { messageId: 'm1', accountId: 'acc-1', title: 'Gone', startTime: '2026-03-25T14:00:00Z', endTime: '2026-03-25T15:00:00Z' });
    testDb.adapter.execute(`DELETE FROM ml_messages WHERE id = 'm1'`);
    expect(getCalendarEventsByMessage(testDb.adapter, 'm1')).toHaveLength(0);
  });
});

// ── Notification Preferences ────────────────────────────────────────

describe('Notification Preferences', () => {
  it('creates default preferences via upsert', () => {
    seedAccount();
    const prefs = upsertNotificationPreferences(testDb.adapter, 'np-1', 'acc-1', {});
    expect(prefs.enabled).toBe(true);
    expect(prefs.vipOnly).toBe(false);
    expect(prefs.sound).toBe('default');
  });

  it('updates existing preferences', () => {
    seedAccount();
    upsertNotificationPreferences(testDb.adapter, 'np-2', 'acc-1', {});
    const updated = upsertNotificationPreferences(testDb.adapter, 'np-3', 'acc-1', {
      enabled: false,
      quietStart: '22:00',
      quietEnd: '07:00',
      vipOnly: true,
    });
    expect(updated.enabled).toBe(false);
    expect(updated.quietStart).toBe('22:00');
    expect(updated.quietEnd).toBe('07:00');
    expect(updated.vipOnly).toBe(true);
  });

  it('returns null when no preferences exist', () => {
    seedAccount();
    expect(getNotificationPreferences(testDb.adapter, 'acc-1')).toBeNull();
  });

  it('cascade deletes preferences with account', () => {
    seedAccount();
    upsertNotificationPreferences(testDb.adapter, 'np-4', 'acc-1', {});
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getNotificationPreferences(testDb.adapter, 'acc-1')).toBeNull();
  });
});

// ── Encryption Keys ─────────────────────────────────────────────────

describe('Encryption Keys', () => {
  it('creates an encryption key', () => {
    seedAccount();
    const key = createEncryptionKey(testDb.adapter, 'ek-1', {
      accountId: 'acc-1',
      keyType: 'pgp',
      publicKey: '-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----',
      fingerprint: 'ABCD:1234:5678',
      isOwnKey: true,
    });
    expect(key.keyType).toBe('pgp');
    expect(key.isOwnKey).toBe(true);
    expect(key.isRevoked).toBe(false);
  });

  it('lists keys by account', () => {
    seedAccount();
    createEncryptionKey(testDb.adapter, 'ek-2', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k1', fingerprint: 'fp1', isOwnKey: true });
    createEncryptionKey(testDb.adapter, 'ek-3', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k2', fingerprint: 'fp2', contactEmail: 'other@test.com' });
    expect(getEncryptionKeys(testDb.adapter, 'acc-1')).toHaveLength(2);
  });

  it('finds key by fingerprint', () => {
    seedAccount();
    createEncryptionKey(testDb.adapter, 'ek-4', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k3', fingerprint: 'unique-fp' });
    expect(getKeyByFingerprint(testDb.adapter, 'unique-fp')).not.toBeNull();
    expect(getKeyByFingerprint(testDb.adapter, 'nope')).toBeNull();
  });

  it('revokes a key', () => {
    seedAccount();
    createEncryptionKey(testDb.adapter, 'ek-5', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k4', fingerprint: 'rev-fp' });
    revokeKey(testDb.adapter, 'ek-5');
    const key = getKeyByFingerprint(testDb.adapter, 'rev-fp');
    expect(key!.isRevoked).toBe(true);
  });

  it('deletes a key', () => {
    seedAccount();
    createEncryptionKey(testDb.adapter, 'ek-6', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k5', fingerprint: 'del-fp' });
    deleteEncryptionKey(testDb.adapter, 'ek-6');
    expect(getKeyByFingerprint(testDb.adapter, 'del-fp')).toBeNull();
  });

  it('cascade deletes keys with account', () => {
    seedAccount();
    createEncryptionKey(testDb.adapter, 'ek-7', { accountId: 'acc-1', keyType: 'pgp', publicKey: 'k6', fingerprint: 'cas-fp' });
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getEncryptionKeys(testDb.adapter, 'acc-1')).toHaveLength(0);
  });
});

// ── Sync State ──────────────────────────────────────────────────────

describe('Sync State', () => {
  it('creates sync state via upsert', () => {
    seedAccount();
    const state = upsertSyncState(testDb.adapter, 'ss-1', 'acc-1', 'INBOX', {
      lastUid: '100',
      uidvalidity: '12345',
      status: 'idle',
    });
    expect(state.folder).toBe('INBOX');
    expect(state.lastUid).toBe('100');
    expect(state.status).toBe('idle');
  });

  it('updates existing sync state via upsert', () => {
    seedAccount();
    upsertSyncState(testDb.adapter, 'ss-2', 'acc-1', 'INBOX', { lastUid: '50', status: 'idle' });
    const updated = upsertSyncState(testDb.adapter, 'ss-3', 'acc-1', 'INBOX', { lastUid: '100', status: 'syncing' });
    expect(updated.lastUid).toBe('100');
    expect(updated.status).toBe('syncing');
  });

  it('gets sync state for specific folder', () => {
    seedAccount();
    upsertSyncState(testDb.adapter, 'ss-4', 'acc-1', 'INBOX', { status: 'idle' });
    upsertSyncState(testDb.adapter, 'ss-5', 'acc-1', 'Sent', { status: 'idle' });
    expect(getSyncState(testDb.adapter, 'acc-1', 'INBOX')).not.toBeNull();
    expect(getSyncState(testDb.adapter, 'acc-1', 'Missing')).toBeNull();
  });

  it('lists all sync states for account', () => {
    seedAccount();
    upsertSyncState(testDb.adapter, 'ss-6', 'acc-1', 'INBOX', { status: 'idle' });
    upsertSyncState(testDb.adapter, 'ss-7', 'acc-1', 'Sent', { status: 'idle' });
    expect(getSyncStates(testDb.adapter, 'acc-1')).toHaveLength(2);
  });

  it('cascade deletes sync states with account', () => {
    seedAccount();
    upsertSyncState(testDb.adapter, 'ss-8', 'acc-1', 'INBOX', { status: 'idle' });
    deleteAccount(testDb.adapter, 'acc-1');
    expect(getSyncStates(testDb.adapter, 'acc-1')).toHaveLength(0);
  });
});

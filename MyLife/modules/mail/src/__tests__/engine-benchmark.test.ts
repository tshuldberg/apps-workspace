/**
 * Mail Engine Benchmark Tests
 *
 * Comprehensive edge case and boundary condition coverage for all 8 mail engines.
 * Targets gaps not covered by engine.test.ts and engine-v2.test.ts.
 */
import { describe, it, expect } from 'vitest';
import type {
  MailMessage,
  MailFilter,
  MailContact,
  MailThread,
  EncryptionKey,
  NotificationPreferences,
  MailAttachment,
} from '../types';
import { MAX_ATTACHMENT_SIZE } from '../types';

// Search engine
import { searchMessages, filterByDateRange, groupByThread, getUnreadCount } from '../engine/search';

// Threading engine
import { normalizeSubject, resolveThread, buildThreadMetadata, sortThreadMessages } from '../engine/threading';

// Contacts engine
import { generateInitials, getAvatarColor, autoComplete, resolveContact, nameFromEmail } from '../engine/contacts';

// Filters engine
import { applyFilters, matchesFilter, countMatches } from '../engine/filters';

// Attachments engine
import { getMimeType, getExtension, isBlockedExtension, validateFileSize, validateTotalSize, formatFileSize } from '../engine/attachments';

// Calendar engine
import { parseIcs, normalizeIcsDate, detectDatesInBody, generateRsvpReply } from '../engine/calendar';

// Notifications engine
import { isQuietHours, shouldNotify, batchNotification, buildNotification } from '../engine/notifications';

// Encryption engine
import { computeFingerprint, findKeyForContact, findOwnKey, canEncrypt, isPgpEncrypted } from '../engine/encryption';

// ── Fixtures ──────────────────────────────────────────────────────────

function msg(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1', accountId: 'acc-1', subject: 'Test Subject',
    from: 'sender@example.com', to: ['recipient@example.com'],
    body: 'Body text', isRead: false, isStarred: false,
    folder: 'Inbox', receivedAt: '2026-03-15T10:00:00Z',
    createdAt: '2026-03-15T10:00:00Z', ...overrides,
  };
}

function filter_(overrides: Partial<MailFilter> = {}): MailFilter {
  return {
    id: 'f-1', accountId: 'acc-1', name: 'Filter', field: 'from',
    pattern: 'test', action: 'mark_read', actionValue: null,
    isActive: true, priority: 0, createdAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

function contact_(overrides: Partial<MailContact> = {}): MailContact {
  return {
    id: 'c-1', accountId: 'acc-1', email: 'user@test.com',
    displayName: 'Test User', avatarUrl: null, company: null,
    phone: null, notes: null, isVip: false, source: 'manual',
    frequency: 5, lastContactedAt: null,
    createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

function prefs_(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    id: 'np-1', accountId: 'acc-1', enabled: true,
    quietStart: null, quietEnd: null, vipOnly: false,
    showPreview: true, sound: 'default',
    createdAt: '', updatedAt: '', ...overrides,
  };
}

function encKey_(overrides: Partial<EncryptionKey> = {}): EncryptionKey {
  return {
    id: 'k-1', accountId: 'acc-1', keyType: 'pgp', publicKey: 'pk-data',
    privateKeyEncrypted: null, fingerprint: 'fp-1',
    contactEmail: 'friend@test.com', isOwnKey: false,
    isRevoked: false, expiresAt: null, createdAt: '', ...overrides,
  };
}

// ── Search Engine Boundaries ──────────────────────────────────────────

describe('Search Engine (boundaries)', () => {
  it('filterByDateRange: same-day range returns messages on that day', () => {
    const messages = [
      msg({ id: '1', receivedAt: '2026-03-15T08:00:00Z' }),
      msg({ id: '2', receivedAt: '2026-03-15T23:59:59Z' }),
      msg({ id: '3', receivedAt: '2026-03-16T00:00:00Z' }),
    ];
    const result = filterByDateRange(messages, '2026-03-15T00:00:00Z', '2026-03-15T23:59:59Z');
    expect(result.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('filterByDateRange: empty array returns empty', () => {
    expect(filterByDateRange([], '2026-01-01', '2026-12-31')).toEqual([]);
  });

  it('filterByDateRange: reversed range returns empty', () => {
    const messages = [msg({ receivedAt: '2026-03-15T10:00:00Z' })];
    expect(filterByDateRange(messages, '2026-12-31', '2026-01-01')).toEqual([]);
  });

  it('searchMessages: whitespace-only query returns all messages', () => {
    const messages = [msg({ id: '1' }), msg({ id: '2' })];
    expect(searchMessages(messages, '   ')).toHaveLength(2);
  });

  it('searchMessages: empty input array returns empty', () => {
    expect(searchMessages([], 'test')).toEqual([]);
  });

  it('searchMessages: matches partial words', () => {
    const messages = [msg({ subject: 'Meeting tomorrow' })];
    expect(searchMessages(messages, 'meet')).toHaveLength(1);
  });

  it('groupByThread: empty input returns empty map', () => {
    expect(groupByThread([]).size).toBe(0);
  });

  it('groupByThread: nested Re:Fwd: collapses to same thread', () => {
    const messages = [
      msg({ id: '1', subject: 'Project' }),
      msg({ id: '2', subject: 'Re: Fwd: Re: Project' }),
      msg({ id: '3', subject: 'FW: Project' }),
    ];
    const threads = groupByThread(messages);
    expect(threads.size).toBe(1);
    expect(threads.get('project')?.length).toBe(3);
  });

  it('getUnreadCount: empty array returns 0', () => {
    expect(getUnreadCount([])).toBe(0);
  });

  it('getUnreadCount: all read returns 0', () => {
    expect(getUnreadCount([msg({ isRead: true })])).toBe(0);
  });
});

// ── Threading Engine Boundaries ───────────────────────────────────────

describe('Threading Engine (boundaries)', () => {
  it('normalizeSubject: empty string stays empty', () => {
    expect(normalizeSubject('')).toBe('');
  });

  it('normalizeSubject: subject with no prefix stays unchanged', () => {
    expect(normalizeSubject('Plain Subject')).toBe('Plain Subject');
  });

  it('resolveThread: prefers last Reference over earlier ones', () => {
    const headerMap = new Map<string, { threadId: string | null }>([
      ['<old@mail.com>', { threadId: 't-old' }],
      ['<new@mail.com>', { threadId: 't-new' }],
    ]);
    const result = resolveThread(
      { references: ['<old@mail.com>', '<new@mail.com>'], subject: 'Test', accountId: 'acc-1' },
      [], headerMap,
    );
    expect(result).toBe('t-new');
  });

  it('resolveThread: does not match across different accounts', () => {
    const threads: MailThread[] = [{
      id: 't-1', accountId: 'acc-2', subject: 'Shared Topic',
      participantEmails: [], messageCount: 1, unreadCount: 0,
      latestMessageAt: '2026-03-15T10:00:00Z', isMuted: false,
      createdAt: '', updatedAt: '',
    }];
    const result = resolveThread(
      { subject: 'Re: Shared Topic', accountId: 'acc-1' },
      threads, new Map(),
    );
    expect(result).toBeNull();
  });

  it('buildThreadMetadata: empty messages returns defaults', () => {
    const meta = buildThreadMetadata([]);
    expect(meta.messageCount).toBe(0);
    expect(meta.unreadCount).toBe(0);
    expect(meta.participantEmails).toEqual([]);
  });

  it('sortThreadMessages: single message returns same message', () => {
    const m = msg();
    const sorted = sortThreadMessages([m]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe(m.id);
  });

  it('sortThreadMessages: already sorted stays sorted', () => {
    const messages = [
      msg({ id: '1', receivedAt: '2026-03-10T10:00:00Z' }),
      msg({ id: '2', receivedAt: '2026-03-15T10:00:00Z' }),
    ];
    const sorted = sortThreadMessages(messages);
    expect(sorted[0].id).toBe('1');
  });
});

// ── Contacts Engine Boundaries ────────────────────────────────────────

describe('Contacts Engine (boundaries)', () => {
  it('generateInitials: single character returns just that char uppercased', () => {
    expect(generateInitials('A')).toBe('A');
    expect(generateInitials('z')).toBe('Z');
  });

  it('generateInitials: email with dots and hyphens', () => {
    expect(generateInitials('mary-jane.watson@email.com')).toBe('MW');
  });

  it('generateInitials: three-part name uses first and last', () => {
    expect(generateInitials('John Michael Doe')).toBe('JD');
  });

  it('getAvatarColor: different emails produce different colors (probabilistic)', () => {
    const colors = new Set(
      ['a@b.com', 'x@y.com', 'test@mail.com', 'hello@world.org', 'foo@bar.net']
        .map(getAvatarColor),
    );
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it('autoComplete: respects limit parameter', () => {
    const contacts = Array.from({ length: 20 }, (_, i) =>
      contact_({ id: `c-${i}`, email: `user${i}@domain.com`, frequency: i }),
    );
    const results = autoComplete('domain', contacts, 5);
    expect(results).toHaveLength(5);
  });

  it('autoComplete: matches display name', () => {
    const contacts = [contact_({ displayName: 'Alice Wonder', email: 'x@y.com' })];
    expect(autoComplete('alice', contacts)).toHaveLength(1);
  });

  it('resolveContact: case-insensitive email matching', () => {
    const contacts = [contact_({ email: 'BOSS@Work.com' })];
    expect(resolveContact('boss@work.com', contacts)).not.toBeNull();
  });

  it('nameFromEmail: handles underscores', () => {
    expect(nameFromEmail('first_last@test.com')).toBe('first last');
  });
});

// ── Filters Engine Boundaries ─────────────────────────────────────────

describe('Filters Engine (boundaries)', () => {
  it('applyFilters: no active filters returns no match', () => {
    const result = applyFilters(msg(), []);
    expect(result.matched).toBe(false);
  });

  it('applyFilters: all filters inactive returns no match', () => {
    const filters = [filter_({ isActive: false }), filter_({ id: 'f-2', isActive: false })];
    expect(applyFilters(msg(), filters).matched).toBe(false);
  });

  it('applyFilters: first match wins, stops processing', () => {
    const m = msg({ from: 'test@example.com', subject: 'Test Subject' });
    const filters = [
      filter_({ id: 'f-1', field: 'from', pattern: 'test', action: 'mark_read', priority: 1 }),
      filter_({ id: 'f-2', field: 'subject', pattern: 'test', action: 'star', priority: 2 }),
    ];
    const result = applyFilters(m, filters);
    expect(result.filterId).toBe('f-1');
    expect(result.action).toBe('mark_read');
  });

  it('matchesFilter: handles unknown field gracefully', () => {
    const f = filter_({ field: 'cc' as any, pattern: 'test' });
    expect(matchesFilter(msg(), f)).toBe(false);
  });

  it('countMatches: zero when no messages match', () => {
    const messages = [msg({ from: 'alice@a.com' }), msg({ from: 'bob@b.com' })];
    const f = filter_({ pattern: 'nobody' });
    expect(countMatches(messages, f)).toBe(0);
  });

  it('countMatches: counts all matching messages', () => {
    const messages = [
      msg({ id: '1', from: 'test@a.com' }),
      msg({ id: '2', from: 'test@b.com' }),
      msg({ id: '3', from: 'other@c.com' }),
    ];
    expect(countMatches(messages, filter_({ pattern: 'test' }))).toBe(2);
  });
});

// ── Attachments Engine Boundaries ─────────────────────────────────────

describe('Attachments Engine (boundaries)', () => {
  it('validateFileSize: exactly at max is valid', () => {
    expect(validateFileSize(MAX_ATTACHMENT_SIZE).valid).toBe(true);
  });

  it('validateFileSize: one byte over max is invalid', () => {
    expect(validateFileSize(MAX_ATTACHMENT_SIZE + 1).valid).toBe(false);
  });

  it('validateFileSize: negative size is invalid', () => {
    expect(validateFileSize(-1).valid).toBe(false);
  });

  it('getExtension: multiple dots returns last extension', () => {
    expect(getExtension('archive.tar.gz')).toBe('.gz');
  });

  it('getExtension: hidden files with extension', () => {
    expect(getExtension('.gitignore')).toBe('.gitignore');
  });

  it('getMimeType: case insensitive extension', () => {
    expect(getMimeType('photo.JPG')).toBe('image/jpeg');
    expect(getMimeType('DOC.PDF')).toBe('application/pdf');
  });

  it('isBlockedExtension: case insensitive blocking', () => {
    expect(isBlockedExtension('virus.EXE')).toBe(true);
    expect(isBlockedExtension('SCRIPT.BAT')).toBe(true);
  });

  it('formatFileSize: GB range', () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('validateTotalSize: exactly at total limit is valid', () => {
    const existing = [{ sizeBytes: 40 * 1024 * 1024 }] as MailAttachment[];
    expect(validateTotalSize(existing, 10 * 1024 * 1024).valid).toBe(true);
  });
});

// ── Calendar Engine Boundaries ────────────────────────────────────────

describe('Calendar Engine (boundaries)', () => {
  it('parseIcs: multiple events in one calendar', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Morning Meeting
DTSTART:20260325T090000Z
DTEND:20260325T100000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Afternoon Meeting
DTSTART:20260325T140000Z
DTEND:20260325T150000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Morning Meeting');
    expect(events[1].summary).toBe('Afternoon Meeting');
  });

  it('parseIcs: extracts attendees', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Team Sync
DTSTART:20260325T140000Z
DTEND:20260325T150000Z
ORGANIZER:mailto:boss@work.com
ATTENDEE:mailto:alice@work.com
ATTENDEE:mailto:bob@work.com
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].attendees).toContain('alice@work.com');
    expect(events[0].attendees).toContain('bob@work.com');
    expect(events[0].organizer).toBe('boss@work.com');
  });

  it('parseIcs: empty content returns empty array', () => {
    expect(parseIcs('')).toEqual([]);
    expect(parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
  });

  it('parseIcs: event without DTEND gets 1-hour default', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Quick Chat
DTSTART:20260325T140000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].dtend).toBe('2026-03-25T15:00:00.000Z');
  });

  it('normalizeIcsDate: unparseable date returns as-is', () => {
    expect(normalizeIcsDate('not-a-date')).toBe('not-a-date');
  });

  it('detectDatesInBody: ISO format detection', () => {
    const body = 'Please join at 2026-03-25T15:00 in the conference room.';
    const dates = detectDatesInBody(body);
    expect(dates).toContain('2026-03-25T15:00');
  });

  it('detectDatesInBody: US format detection', () => {
    const body = 'Meeting scheduled for 03/25/2026 3:00 PM';
    const dates = detectDatesInBody(body);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('generateRsvpReply: declined status', () => {
    const reply = generateRsvpReply(
      { uid: 'uid-456', organizer: 'host@test.com' },
      'user@example.com', 'declined',
    );
    expect(reply).toContain('PARTSTAT=DECLINED');
    expect(reply).toContain('uid-456');
  });

  it('generateRsvpReply: tentative status', () => {
    const reply = generateRsvpReply(
      { uid: 'uid-789', organizer: 'host@test.com' },
      'user@example.com', 'tentative',
    );
    expect(reply).toContain('PARTSTAT=TENTATIVE');
  });
});

// ── Notifications Engine Boundaries ───────────────────────────────────

describe('Notifications Engine (boundaries)', () => {
  it('shouldNotify: blocked during quiet hours', () => {
    const p = prefs_({ enabled: true, quietStart: '22:00', quietEnd: '07:00' });
    expect(shouldNotify(msg(), p, [], '23:30')).toBe(false);
    expect(shouldNotify(msg(), p, [], '03:00')).toBe(false);
    expect(shouldNotify(msg(), p, [], '12:00')).toBe(true);
  });

  it('shouldNotify: VIP sender passes VIP-only filter', () => {
    const p = prefs_({ vipOnly: true });
    const vipContacts = [contact_({ email: 'sender@example.com', isVip: true })];
    expect(shouldNotify(msg(), p, vipContacts)).toBe(true);
  });

  it('shouldNotify: non-VIP sender blocked by VIP-only filter', () => {
    const p = prefs_({ vipOnly: true });
    const nonVip = [contact_({ email: 'sender@example.com', isVip: false })];
    expect(shouldNotify(msg(), p, nonVip)).toBe(false);
  });

  it('batchNotification: single message uses sender and subject', () => {
    const batch = batchNotification([msg({ from: 'alice@test.com', subject: 'Hello' })], 'me@test.com');
    expect(batch.title).toBe('alice@test.com');
    expect(batch.body).toBe('Hello');
  });

  it('buildNotification: uses contact display name when available', () => {
    const m = msg({ from: 'alice@test.com', subject: 'Hi' });
    const c = contact_({ email: 'alice@test.com', displayName: 'Alice' });
    const notif = buildNotification(m, prefs_(), c);
    expect(notif.title).toBe('Alice');
  });

  it('buildNotification: falls back to email when no contact', () => {
    const m = msg({ from: 'unknown@test.com' });
    const notif = buildNotification(m, prefs_(), null);
    expect(notif.title).toBe('unknown@test.com');
  });

  it('isQuietHours: boundary at exact start time', () => {
    expect(isQuietHours('22:00', '07:00', '22:00')).toBe(true);
  });

  it('isQuietHours: boundary at exact end time', () => {
    expect(isQuietHours('22:00', '07:00', '07:00')).toBe(false);
  });
});

// ── Encryption Engine Boundaries ──────────────────────────────────────

describe('Encryption Engine (boundaries)', () => {
  it('findKeyForContact: skips expired keys', () => {
    const keys = [encKey_({ expiresAt: '2020-01-01T00:00:00Z' })];
    expect(findKeyForContact('friend@test.com', keys)).toBeNull();
  });

  it('findKeyForContact: non-expired key is returned', () => {
    const keys = [encKey_({ expiresAt: '2099-12-31T00:00:00Z' })];
    expect(findKeyForContact('friend@test.com', keys)).not.toBeNull();
  });

  it('findKeyForContact: null expiresAt means no expiry', () => {
    const keys = [encKey_({ expiresAt: null })];
    expect(findKeyForContact('friend@test.com', keys)).not.toBeNull();
  });

  it('findKeyForContact: skips own keys', () => {
    const keys = [encKey_({ isOwnKey: true })];
    expect(findKeyForContact('friend@test.com', keys)).toBeNull();
  });

  it('canEncrypt: empty recipients list can always encrypt', () => {
    const result = canEncrypt([], []);
    expect(result.canEncrypt).toBe(true);
    expect(result.missingKeys).toEqual([]);
  });

  it('canEncrypt: all recipients have keys', () => {
    const keys = [
      encKey_({ id: 'k-1', contactEmail: 'a@test.com' }),
      encKey_({ id: 'k-2', contactEmail: 'b@test.com' }),
    ];
    const result = canEncrypt(['a@test.com', 'b@test.com'], keys);
    expect(result.canEncrypt).toBe(true);
  });

  it('canEncrypt: partial key coverage lists missing', () => {
    const keys = [encKey_({ contactEmail: 'a@test.com' })];
    const result = canEncrypt(['a@test.com', 'b@test.com', 'c@test.com'], keys);
    expect(result.canEncrypt).toBe(false);
    expect(result.missingKeys).toEqual(['b@test.com', 'c@test.com']);
  });

  it('computeFingerprint: different keys produce different fingerprints', () => {
    const fp1 = computeFingerprint('key-data-alpha');
    const fp2 = computeFingerprint('key-data-beta');
    expect(fp1).not.toBe(fp2);
  });

  it('findOwnKey: ignores revoked own key', () => {
    const keys = [encKey_({ isOwnKey: true, isRevoked: true })];
    expect(findOwnKey('acc-1', keys)).toBeNull();
  });

  it('isPgpEncrypted: partial PGP block is not detected', () => {
    expect(isPgpEncrypted('-----BEGIN PGP MESSAGE---')).toBe(false);
  });
});

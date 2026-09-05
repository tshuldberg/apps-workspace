import { describe, it, expect } from 'vitest';
import type { MailMessage, MailFilter, MailContact, MailThread, EncryptionKey, NotificationPreferences } from '../types';

// Attachments engine
import {
  getMimeType,
  getExtension,
  isBlockedExtension,
  validateFileSize,
  validateTotalSize,
  formatFileSize,
  isPreviewableImage,
  isPdf,
} from '../engine/attachments';

// Filters engine
import { applyFilters, matchesFilter, countMatches } from '../engine/filters';

// Contacts engine
import { generateInitials, getAvatarColor, resolveContact, autoComplete, nameFromEmail, gravatarUrl } from '../engine/contacts';

// Threading engine
import { normalizeSubject, resolveThread, buildThreadMetadata, sortThreadMessages } from '../engine/threading';

// Calendar engine
import { parseIcs, normalizeIcsDate, detectDatesInBody, generateRsvpReply, eventToInput } from '../engine/calendar';

// Notifications engine
import { isQuietHours, shouldNotify, batchNotification, buildNotification } from '../engine/notifications';

// Encryption engine
import { computeFingerprint, findKeyForContact, findOwnKey, canEncrypt, isPgpEncrypted, hasPgpSignature, isPgpPublicKey } from '../engine/encryption';

// IMAP engine
import { autoDiscoverConfig, getSupportedProviders, guessConfig, parseReferences, parseHeader } from '../engine/imap';

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: 'msg-1', accountId: 'acc-1', subject: 'Test', from: 'sender@example.com',
    to: ['recipient@example.com'], body: 'Body text', isRead: false, isStarred: false,
    folder: 'Inbox', receivedAt: '2026-03-22T10:00:00Z', createdAt: '2026-03-22T10:00:00Z',
    ...overrides,
  };
}

function makeFilter(overrides: Partial<MailFilter> = {}): MailFilter {
  return {
    id: 'f-1', accountId: 'acc-1', name: 'Test Filter', field: 'from',
    pattern: 'test', action: 'mark_read', actionValue: null, isActive: true,
    priority: 0, createdAt: '2026-03-22T10:00:00Z',
    ...overrides,
  };
}

function makeContact(overrides: Partial<MailContact> = {}): MailContact {
  return {
    id: 'c-1', accountId: 'acc-1', email: 'contact@example.com', displayName: 'Contact',
    avatarUrl: null, company: null, phone: null, notes: null, isVip: false,
    source: 'manual', frequency: 5, lastContactedAt: null,
    createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-03-22T10:00:00Z',
    ...overrides,
  };
}

// ── Attachments Engine ──────────────────────────────────────────────

describe('Attachments Engine', () => {
  it('gets MIME type from extension', () => {
    expect(getMimeType('report.pdf')).toBe('application/pdf');
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('data.unknown')).toBe('application/octet-stream');
  });

  it('extracts file extension', () => {
    expect(getExtension('file.pdf')).toBe('.pdf');
    expect(getExtension('archive.tar.gz')).toBe('.gz');
    expect(getExtension('noext')).toBe('');
  });

  it('blocks dangerous extensions', () => {
    expect(isBlockedExtension('virus.exe')).toBe(true);
    expect(isBlockedExtension('script.bat')).toBe(true);
    expect(isBlockedExtension('safe.pdf')).toBe(false);
  });

  it('validates file size', () => {
    expect(validateFileSize(1024)).toEqual({ valid: true });
    expect(validateFileSize(26 * 1024 * 1024)).toEqual({ valid: false, error: 'File too large (max 25 MB)' });
    expect(validateFileSize(0)).toEqual({ valid: false, error: 'Empty file cannot be attached' });
  });

  it('validates total size', () => {
    const existing = [{ sizeBytes: 40 * 1024 * 1024 }] as any;
    expect(validateTotalSize(existing, 11 * 1024 * 1024)).toEqual({ valid: false, error: 'Total attachment size exceeds 50 MB' });
    expect(validateTotalSize([], 1024)).toEqual({ valid: true });
  });

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1500)).toBe('1.5 KB');
    expect(formatFileSize(2.3 * 1024 * 1024)).toBe('2.3 MB');
  });

  it('detects previewable images', () => {
    expect(isPreviewableImage('image/jpeg')).toBe(true);
    expect(isPreviewableImage('image/png')).toBe(true);
    expect(isPreviewableImage('image/svg+xml')).toBe(false);
    expect(isPreviewableImage('application/pdf')).toBe(false);
  });

  it('detects PDFs', () => {
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('image/png')).toBe(false);
  });
});

// ── Filters Engine ──────────────────────────────────────────────────

describe('Filters Engine', () => {
  it('matches from field case-insensitively', () => {
    const msg = makeMessage({ from: 'Newsletter@Updates.com' });
    const filter = makeFilter({ field: 'from', pattern: 'newsletter@' });
    expect(matchesFilter(msg, filter)).toBe(true);
  });

  it('matches subject field', () => {
    const msg = makeMessage({ subject: 'Invoice #1234' });
    const filter = makeFilter({ field: 'subject', pattern: 'invoice' });
    expect(matchesFilter(msg, filter)).toBe(true);
  });

  it('matches body field', () => {
    const msg = makeMessage({ body: 'Please see attached report' });
    const filter = makeFilter({ field: 'body', pattern: 'attached' });
    expect(matchesFilter(msg, filter)).toBe(true);
  });

  it('matches to field', () => {
    const msg = makeMessage({ to: ['team@company.com', 'all@company.com'] });
    const filter = makeFilter({ field: 'to', pattern: 'team@' });
    expect(matchesFilter(msg, filter)).toBe(true);
  });

  it('returns false for empty pattern', () => {
    const msg = makeMessage();
    const filter = makeFilter({ pattern: '' });
    expect(matchesFilter(msg, filter)).toBe(false);
  });

  it('applies filters with priority ordering', () => {
    const msg = makeMessage({ from: 'test@example.com', subject: 'Test Subject' });
    const filters = [
      makeFilter({ id: 'f-2', field: 'subject', pattern: 'test', action: 'star', priority: 5 }),
      makeFilter({ id: 'f-1', field: 'from', pattern: 'test', action: 'mark_read', priority: 1 }),
    ];
    const result = applyFilters(msg, filters);
    expect(result.matched).toBe(true);
    expect(result.filterId).toBe('f-1'); // Lower priority number wins
    expect(result.action).toBe('mark_read');
  });

  it('skips inactive filters', () => {
    const msg = makeMessage({ from: 'test@example.com' });
    const filters = [makeFilter({ isActive: false })];
    expect(applyFilters(msg, filters).matched).toBe(false);
  });

  it('counts matches in test mode', () => {
    const messages = [
      makeMessage({ id: '1', from: 'newsletter@test.com' }),
      makeMessage({ id: '2', from: 'boss@work.com' }),
      makeMessage({ id: '3', from: 'newsletter@other.com' }),
    ];
    const filter = makeFilter({ field: 'from', pattern: 'newsletter' });
    expect(countMatches(messages, filter)).toBe(2);
  });
});

// ── Contacts Engine ─────────────────────────────────────────────────

describe('Contacts Engine', () => {
  it('generates initials from name', () => {
    expect(generateInitials('John Doe')).toBe('JD');
    expect(generateInitials('Alice')).toBe('AL');
  });

  it('generates initials from email', () => {
    expect(generateInitials('john.doe@example.com')).toBe('JD');
    expect(generateInitials('support@example.com')).toBe('SU');
  });

  it('produces deterministic avatar colors', () => {
    const c1 = getAvatarColor('a@b.com');
    const c2 = getAvatarColor('a@b.com');
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('resolves contact by email', () => {
    const contacts = [makeContact({ email: 'boss@work.com', displayName: 'Boss' })];
    expect(resolveContact('boss@work.com', contacts)?.displayName).toBe('Boss');
    expect(resolveContact('unknown@test.com', contacts)).toBeNull();
  });

  it('auto-completes with VIP first then frequency', () => {
    const contacts = [
      makeContact({ id: '1', email: 'john@work.com', displayName: 'John', frequency: 10, isVip: false }),
      makeContact({ id: '2', email: 'jane@work.com', displayName: 'Jane', frequency: 5, isVip: true }),
    ];
    const results = autoComplete('work', contacts);
    expect(results[0].displayName).toBe('Jane'); // VIP first
  });

  it('requires 2+ characters for auto-complete', () => {
    const contacts = [makeContact()];
    expect(autoComplete('a', contacts)).toHaveLength(0);
  });

  it('extracts name from email', () => {
    expect(nameFromEmail('john.doe@example.com')).toBe('john doe');
    expect(nameFromEmail('support@test.com')).toBe('support');
  });

  it('generates deterministic gravatar URLs', () => {
    const url1 = gravatarUrl('user@example.com');
    const url2 = gravatarUrl('user@example.com');
    expect(url1).toBe(url2);
    expect(url1).toContain('gravatar.com/avatar/');
    expect(url1).toContain('d=404');
    expect(url1).toContain('s=72');
  });

  it('respects custom gravatar size', () => {
    const url = gravatarUrl('user@example.com', 128);
    expect(url).toContain('s=128');
  });

  it('normalizes email case for gravatar', () => {
    expect(gravatarUrl('User@Example.com')).toBe(gravatarUrl('user@example.com'));
  });
});

// ── Threading Engine ────────────────────────────────────────────────

describe('Threading Engine', () => {
  it('normalizes subjects by stripping prefixes', () => {
    expect(normalizeSubject('Re: Meeting')).toBe('Meeting');
    expect(normalizeSubject('Fwd: Re: Meeting')).toBe('Meeting');
    expect(normalizeSubject('FW: Important')).toBe('Important');
    expect(normalizeSubject('Re: Re: Re: Topic')).toBe('Topic');
  });

  it('resolves thread by In-Reply-To header', () => {
    const threads: MailThread[] = [];
    const headerMap = new Map([['<abc@mail.com>', { threadId: 't-1' }]]);
    const result = resolveThread(
      { inReplyTo: '<abc@mail.com>', subject: 'Re: Test', accountId: 'acc-1' },
      threads,
      headerMap,
    );
    expect(result).toBe('t-1');
  });

  it('resolves thread by References header', () => {
    const headerMap = new Map([['<ref1@mail.com>', { threadId: 't-2' }]]);
    const result = resolveThread(
      { references: ['<ref1@mail.com>'], subject: 'Test', accountId: 'acc-1' },
      [],
      headerMap,
    );
    expect(result).toBe('t-2');
  });

  it('falls back to subject matching', () => {
    const threads: MailThread[] = [{
      id: 't-3', accountId: 'acc-1', subject: 'Project Update',
      participantEmails: [], messageCount: 1, unreadCount: 0,
      latestMessageAt: '2026-03-22T10:00:00Z', isMuted: false,
      createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-03-22T10:00:00Z',
    }];
    const result = resolveThread(
      { subject: 'Re: Project Update', accountId: 'acc-1' },
      threads,
      new Map(),
    );
    expect(result).toBe('t-3');
  });

  it('returns null for no match', () => {
    const result = resolveThread(
      { subject: 'Brand New Topic', accountId: 'acc-1' },
      [],
      new Map(),
    );
    expect(result).toBeNull();
  });

  it('builds thread metadata', () => {
    const messages = [
      makeMessage({ id: '1', from: 'a@b.com', to: ['c@d.com'], isRead: true, receivedAt: '2026-03-20T10:00:00Z' }),
      makeMessage({ id: '2', from: 'c@d.com', to: ['a@b.com'], isRead: false, receivedAt: '2026-03-22T10:00:00Z' }),
    ];
    const meta = buildThreadMetadata(messages);
    expect(meta.messageCount).toBe(2);
    expect(meta.unreadCount).toBe(1);
    expect(meta.participantEmails).toContain('a@b.com');
    expect(meta.participantEmails).toContain('c@d.com');
    expect(meta.latestMessageAt).toBe('2026-03-22T10:00:00Z');
  });

  it('sorts thread messages chronologically', () => {
    const messages = [
      makeMessage({ id: '2', receivedAt: '2026-03-22T10:00:00Z' }),
      makeMessage({ id: '1', receivedAt: '2026-03-20T10:00:00Z' }),
    ];
    const sorted = sortThreadMessages(messages);
    expect(sorted[0].id).toBe('1');
    expect(sorted[1].id).toBe('2');
  });
});

// ── Calendar Engine ─────────────────────────────────────────────────

describe('Calendar Engine', () => {
  it('parses simple ICS event', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Team Meeting
DTSTART:20260325T140000Z
DTEND:20260325T150000Z
LOCATION:Room 101
UID:uid-123@example.com
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Team Meeting');
    expect(events[0].location).toBe('Room 101');
    expect(events[0].uid).toBe('uid-123@example.com');
  });

  it('detects all-day events', () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Holiday
DTSTART:20260325
DTEND:20260326
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].isAllDay).toBe(true);
  });

  it('detects cancelled events', () => {
    const ics = `BEGIN:VCALENDAR
METHOD:CANCEL
BEGIN:VEVENT
SUMMARY:Cancelled Meeting
DTSTART:20260325T140000Z
DTEND:20260325T150000Z
END:VEVENT
END:VCALENDAR`;
    const events = parseIcs(ics);
    expect(events[0].isCancelled).toBe(true);
  });

  it('normalizes ICS dates', () => {
    expect(normalizeIcsDate('20260325')).toBe('2026-03-25T00:00:00Z');
    expect(normalizeIcsDate('20260325T140000Z')).toBe('2026-03-25T14:00:00Z');
  });

  it('detects dates in email body', () => {
    const body = 'Meeting on March 15, 2026 at 3pm at Coffee Shop';
    const dates = detectDatesInBody(body);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('returns empty for body without dates', () => {
    expect(detectDatesInBody('No dates here')).toHaveLength(0);
  });

  it('generates RSVP reply', () => {
    const reply = generateRsvpReply(
      { uid: 'uid-123', organizer: 'boss@work.com' },
      'user@example.com',
      'accepted',
    );
    expect(reply).toContain('METHOD:REPLY');
    expect(reply).toContain('PARTSTAT=ACCEPTED');
    expect(reply).toContain('uid-123');
  });
});

// ── Notifications Engine ────────────────────────────────────────────

describe('Notifications Engine', () => {
  it('checks quiet hours (simple range)', () => {
    expect(isQuietHours('09:00', '17:00', '12:00')).toBe(true);
    expect(isQuietHours('09:00', '17:00', '20:00')).toBe(false);
  });

  it('checks quiet hours (midnight wrap)', () => {
    expect(isQuietHours('22:00', '07:00', '23:00')).toBe(true);
    expect(isQuietHours('22:00', '07:00', '03:00')).toBe(true);
    expect(isQuietHours('22:00', '07:00', '12:00')).toBe(false);
  });

  it('returns false when no quiet hours set', () => {
    expect(isQuietHours(null, null, '12:00')).toBe(false);
  });

  it('shouldNotify returns false when disabled', () => {
    const msg = makeMessage();
    const prefs: NotificationPreferences = {
      id: 'np-1', accountId: 'acc-1', enabled: false, quietStart: null, quietEnd: null,
      vipOnly: false, showPreview: true, sound: 'default',
      createdAt: '', updatedAt: '',
    };
    expect(shouldNotify(msg, prefs, [])).toBe(false);
  });

  it('shouldNotify respects VIP only mode', () => {
    const msg = makeMessage({ from: 'nobody@test.com' });
    const prefs: NotificationPreferences = {
      id: 'np-1', accountId: 'acc-1', enabled: true, quietStart: null, quietEnd: null,
      vipOnly: true, showPreview: true, sound: 'default',
      createdAt: '', updatedAt: '',
    };
    const nonVipContacts = [makeContact({ email: 'nobody@test.com', isVip: false })];
    expect(shouldNotify(msg, prefs, nonVipContacts)).toBe(false);

    const vipContacts = [makeContact({ email: 'nobody@test.com', isVip: true })];
    expect(shouldNotify(msg, prefs, vipContacts)).toBe(true);
  });

  it('builds notification with preview', () => {
    const msg = makeMessage({ subject: 'Hello World' });
    const prefs: NotificationPreferences = {
      id: 'np-1', accountId: 'acc-1', enabled: true, quietStart: null, quietEnd: null,
      vipOnly: false, showPreview: true, sound: 'default',
      createdAt: '', updatedAt: '',
    };
    const notif = buildNotification(msg, prefs);
    expect(notif.body).toBe('Hello World');
  });

  it('builds notification without preview', () => {
    const msg = makeMessage({ subject: 'Secret' });
    const prefs: NotificationPreferences = {
      id: 'np-1', accountId: 'acc-1', enabled: true, quietStart: null, quietEnd: null,
      vipOnly: false, showPreview: false, sound: 'default',
      createdAt: '', updatedAt: '',
    };
    const notif = buildNotification(msg, prefs);
    expect(notif.body).toBe('New message');
  });

  it('batches multiple messages', () => {
    const messages = [makeMessage({ id: '1' }), makeMessage({ id: '2' }), makeMessage({ id: '3' })];
    const batch = batchNotification(messages, 'user@example.com');
    expect(batch.title).toBe('3 new messages');
  });
});

// ── Encryption Engine ───────────────────────────────────────────────

describe('Encryption Engine', () => {
  it('computes deterministic fingerprint', () => {
    const fp1 = computeFingerprint('public-key-data');
    const fp2 = computeFingerprint('public-key-data');
    expect(fp1).toBe(fp2);
    expect(fp1).toContain(':');
  });

  it('finds key for contact', () => {
    const keys: EncryptionKey[] = [
      { id: 'k1', accountId: 'acc-1', keyType: 'pgp', publicKey: 'pk', privateKeyEncrypted: null,
        fingerprint: 'fp1', contactEmail: 'friend@test.com', isOwnKey: false, isRevoked: false,
        expiresAt: null, createdAt: '' },
    ];
    expect(findKeyForContact('friend@test.com', keys)).not.toBeNull();
    expect(findKeyForContact('unknown@test.com', keys)).toBeNull();
  });

  it('skips revoked keys', () => {
    const keys: EncryptionKey[] = [
      { id: 'k1', accountId: 'acc-1', keyType: 'pgp', publicKey: 'pk', privateKeyEncrypted: null,
        fingerprint: 'fp1', contactEmail: 'revoked@test.com', isOwnKey: false, isRevoked: true,
        expiresAt: null, createdAt: '' },
    ];
    expect(findKeyForContact('revoked@test.com', keys)).toBeNull();
  });

  it('finds own key for account', () => {
    const keys: EncryptionKey[] = [
      { id: 'k1', accountId: 'acc-1', keyType: 'pgp', publicKey: 'pk', privateKeyEncrypted: 'epk',
        fingerprint: 'fp1', contactEmail: null, isOwnKey: true, isRevoked: false,
        expiresAt: null, createdAt: '' },
    ];
    expect(findOwnKey('acc-1', keys)).not.toBeNull();
    expect(findOwnKey('acc-2', keys)).toBeNull();
  });

  it('checks if all recipients have keys', () => {
    const keys: EncryptionKey[] = [
      { id: 'k1', accountId: 'acc-1', keyType: 'pgp', publicKey: 'pk', privateKeyEncrypted: null,
        fingerprint: 'fp1', contactEmail: 'has-key@test.com', isOwnKey: false, isRevoked: false,
        expiresAt: null, createdAt: '' },
    ];
    const result1 = canEncrypt(['has-key@test.com'], keys);
    expect(result1.canEncrypt).toBe(true);

    const result2 = canEncrypt(['has-key@test.com', 'no-key@test.com'], keys);
    expect(result2.canEncrypt).toBe(false);
    expect(result2.missingKeys).toEqual(['no-key@test.com']);
  });

  it('detects PGP encrypted content', () => {
    expect(isPgpEncrypted('-----BEGIN PGP MESSAGE-----\ndata\n-----END PGP MESSAGE-----')).toBe(true);
    expect(isPgpEncrypted('plain text')).toBe(false);
  });

  it('detects PGP signatures', () => {
    expect(hasPgpSignature('text\n-----BEGIN PGP SIGNATURE-----\ndata')).toBe(true);
    expect(hasPgpSignature('no sig')).toBe(false);
  });

  it('detects PGP public key blocks', () => {
    expect(isPgpPublicKey('-----BEGIN PGP PUBLIC KEY BLOCK-----\ndata\n-----END PGP PUBLIC KEY BLOCK-----')).toBe(true);
    expect(isPgpPublicKey('not a key')).toBe(false);
  });
});

// ── IMAP Engine ─────────────────────────────────────────────────────

describe('IMAP Engine', () => {
  it('auto-discovers Gmail config', () => {
    const config = autoDiscoverConfig('user@gmail.com');
    expect(config).not.toBeNull();
    expect(config!.imapHost).toBe('imap.gmail.com');
    expect(config!.imapPort).toBe(993);
    expect(config!.smtpHost).toBe('smtp.gmail.com');
  });

  it('auto-discovers Outlook config', () => {
    const config = autoDiscoverConfig('user@outlook.com');
    expect(config).not.toBeNull();
    expect(config!.imapHost).toBe('outlook.office365.com');
  });

  it('auto-discovers Yahoo config', () => {
    const config = autoDiscoverConfig('user@yahoo.com');
    expect(config).not.toBeNull();
    expect(config!.imapHost).toBe('imap.mail.yahoo.com');
  });

  it('auto-discovers iCloud config', () => {
    const config = autoDiscoverConfig('user@icloud.com');
    expect(config).not.toBeNull();
    expect(config!.imapHost).toBe('imap.mail.me.com');
  });

  it('returns null for unknown provider', () => {
    expect(autoDiscoverConfig('user@random-domain.xyz')).toBeNull();
  });

  it('lists supported providers', () => {
    const providers = getSupportedProviders();
    expect(providers).toContain('gmail.com');
    expect(providers).toContain('outlook.com');
  });

  it('guesses config from domain', () => {
    const config = guessConfig('company.com');
    expect(config.imapHost).toBe('imap.company.com');
    expect(config.smtpHost).toBe('smtp.company.com');
  });

  it('parses References header', () => {
    expect(parseReferences('<abc@mail.com> <def@mail.com>')).toEqual(['abc@mail.com', 'def@mail.com']);
    expect(parseReferences(null)).toEqual([]);
    expect(parseReferences('')).toEqual([]);
  });

  it('parses raw email headers by field name', () => {
    const raw = 'From: alice@example.com\r\nTo: bob@example.com\r\nSubject: Hello World\r\n';
    expect(parseHeader(raw, 'From')).toBe('alice@example.com');
    expect(parseHeader(raw, 'Subject')).toBe('Hello World');
  });

  it('returns null for missing header field', () => {
    const raw = 'From: alice@example.com\r\n';
    expect(parseHeader(raw, 'X-Custom')).toBeNull();
  });

  it('handles case-insensitive header matching', () => {
    const raw = 'from: alice@example.com\r\n';
    expect(parseHeader(raw, 'From')).toBe('alice@example.com');
  });
});

// ── Contacts: gravatarUrl ──

describe('contacts engine (gravatarUrl)', () => {
  it('generates a gravatar URL with default size', () => {
    const url = gravatarUrl('alice@example.com');
    expect(url).toContain('https://gravatar.com/avatar/');
    expect(url).toContain('?d=404&s=72');
  });

  it('generates a gravatar URL with custom size', () => {
    const url = gravatarUrl('alice@example.com', 256);
    expect(url).toContain('?d=404&s=256');
  });

  it('produces deterministic URLs for the same email', () => {
    expect(gravatarUrl('test@example.com')).toBe(gravatarUrl('test@example.com'));
  });

  it('normalizes email case and whitespace', () => {
    expect(gravatarUrl('Alice@Example.COM')).toBe(gravatarUrl('alice@example.com'));
    expect(gravatarUrl('  alice@example.com  ')).toBe(gravatarUrl('alice@example.com'));
  });

  it('produces different URLs for different emails', () => {
    expect(gravatarUrl('alice@example.com')).not.toBe(gravatarUrl('bob@example.com'));
  });
});

// ── Calendar: eventToInput ──

describe('calendar engine (eventToInput)', () => {
  it('maps a ParsedEvent to CreateCalendarEventInput', () => {
    const event = {
      uid: 'uid-123',
      summary: 'Team Meeting',
      description: 'Weekly sync',
      location: 'Room A',
      dtstart: '2026-04-01T10:00:00Z',
      dtend: '2026-04-01T11:00:00Z',
      organizer: 'boss@company.com',
      attendees: ['alice@company.com', 'bob@company.com'],
      status: 'CONFIRMED' as const,
      isAllDay: false,
      isCancelled: false,
    };
    const result = eventToInput(event, 'msg-1', 'acc-1');
    expect(result.title).toBe('Team Meeting');
    expect(result.messageId).toBe('msg-1');
    expect(result.accountId).toBe('acc-1');
    expect(result.icsUid).toBe('uid-123');
    expect(result.isAllDay).toBe(false);
    expect(result.organizer).toBe('boss@company.com');
    expect(result.attendees).toEqual(['alice@company.com', 'bob@company.com']);
  });

  it('handles events with missing optional fields', () => {
    const event = {
      uid: 'uid-456',
      summary: 'Quick Call',
      dtstart: '2026-04-01T14:00:00Z',
      dtend: '2026-04-01T14:30:00Z',
      attendees: [],
      isAllDay: false,
      isCancelled: false,
    };
    const result = eventToInput(event, 'msg-2', 'acc-1');
    expect(result.title).toBe('Quick Call');
    expect(result.description).toBeUndefined();
    expect(result.location).toBeUndefined();
    expect(result.organizer).toBeUndefined();
    expect(result.attendees).toEqual([]);
  });

  it('maps all-day events correctly', () => {
    const event = {
      uid: 'uid-789',
      summary: 'Company Holiday',
      dtstart: '2026-12-25',
      dtend: '2026-12-26',
      attendees: [],
      isAllDay: true,
      isCancelled: false,
    };
    const result = eventToInput(event, 'msg-3', 'acc-1');
    expect(result.isAllDay).toBe(true);
    expect(result.startTime).toBe('2026-12-25');
  });
});

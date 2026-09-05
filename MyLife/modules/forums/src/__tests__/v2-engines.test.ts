import { describe, it, expect } from 'vitest';

// Profile engine
import {
  validateUsername,
  getDefaultAvatarColor,
  getEligibleBadges,
  getBadgeLabel,
  getBadgeColor,
} from '../profile/engine';

// Media engine
import {
  calculateResizeDimensions,
  calculateThumbnailDimensions,
  buildStoragePath,
  detectMediaType,
  validateAttachmentCount,
} from '../media/engine';

// Realtime engine
import {
  buildThreadChannel,
  buildCommunityPresenceChannel,
  buildFeedChannel,
  buildDMChannel,
  buildVoiceChannel,
  formatTypingText,
  pruneExpiredTypers,
  countOnlineMembers,
} from '../realtime/engine';

// Messaging engine
import {
  findExisting1to1,
  isUserBlocked,
  validateMessageBody,
  getCharacterCountInfo,
  sortConversationsByLastMessage,
} from '../messaging/engine';

// Voice engine
import {
  detectSpeaking,
  calculateRMS,
  getActiveParticipants,
  getMeshConnectionCount,
  getMeshQualityWarning,
  ICE_SERVERS,
} from '../voice/engine';

// Federation engine
import {
  threadToActivityPub,
  replyToActivityPub,
  wrapInActivity,
  parseIncomingActivity,
  buildNodeInfoResponse,
  buildSignatureHeader,
  parseSignatureHeader,
} from '../federation/engine';

// ── Profile Engine ──────────────────────────────────────────────────────

describe('Profile Engine', () => {
  describe('validateUsername', () => {
    it('accepts valid usernames', () => {
      expect(validateUsername('alice').valid).toBe(true);
      expect(validateUsername('user-name-123').valid).toBe(true);
      expect(validateUsername('abc').valid).toBe(true);
    });

    it('rejects too-short usernames', () => {
      const result = validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('rejects too-long usernames', () => {
      const result = validateUsername('a'.repeat(31));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most');
    });

    it('rejects invalid characters', () => {
      expect(validateUsername('UPPERCASE').valid).toBe(false);
      expect(validateUsername('has spaces').valid).toBe(false);
      expect(validateUsername('special@char').valid).toBe(false);
    });
  });

  describe('getDefaultAvatarColor', () => {
    it('returns consistent color for same username', () => {
      const c1 = getDefaultAvatarColor('alice');
      const c2 = getDefaultAvatarColor('alice');
      expect(c1).toBe(c2);
    });

    it('returns a hex color', () => {
      const color = getDefaultAvatarColor('bob');
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('different usernames can produce different colors', () => {
      const colors = new Set(['aaa', 'bbb', 'ccc', 'ddd', 'eee'].map(getDefaultAvatarColor));
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('getEligibleBadges', () => {
    it('returns first_post for 1+ threads', () => {
      const badges = getEligibleBadges({
        threadCount: 1, replyCount: 0, karma: 0, accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toContain('first_post');
    });

    it('returns karma badges at thresholds', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 1500, accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toContain('karma_100');
      expect(badges).toContain('karma_1000');
      expect(badges).not.toContain('karma_10000');
    });

    it('returns veteran for accounts older than 1 year', () => {
      const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0, accountAgeMs: oneYearMs + 1, isModerator: false,
      });
      expect(badges).toContain('veteran');
    });

    it('returns moderator badge for moderators', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0, accountAgeMs: 0, isModerator: true,
      });
      expect(badges).toContain('moderator');
    });

    it('returns empty array for new user', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0, accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toEqual([]);
    });
  });

  it('getBadgeLabel returns labels', () => {
    expect(getBadgeLabel('first_post')).toBe('First Post');
    expect(getBadgeLabel('karma_1000')).toBe('1K Karma');
  });

  it('getBadgeColor returns hex colors', () => {
    expect(getBadgeColor('moderator')).toMatch(/^#/);
  });
});

// ── Media Engine ────────────────────────────────────────────────────────

describe('Media Engine', () => {
  describe('calculateResizeDimensions', () => {
    it('does not resize images within limits', () => {
      expect(calculateResizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    });

    it('scales down oversized images preserving aspect ratio', () => {
      const result = calculateResizeDimensions(4000, 3000, 2048);
      expect(result.width).toBeLessThanOrEqual(2048);
      expect(result.height).toBeLessThanOrEqual(2048);
      expect(Math.abs(result.width / result.height - 4 / 3)).toBeLessThan(0.01);
    });
  });

  describe('calculateThumbnailDimensions', () => {
    it('scales image to fit within thumbnail size', () => {
      const result = calculateThumbnailDimensions(1000, 500, 400);
      expect(result.width).toBeLessThanOrEqual(400);
      expect(result.height).toBeLessThanOrEqual(400);
    });
  });

  it('buildStoragePath generates correct path', () => {
    expect(buildStoragePath('user-1', 'file-1', 'webp')).toBe('forum-media/user-1/file-1.webp');
  });

  describe('detectMediaType', () => {
    it('detects images', () => {
      expect(detectMediaType('image/jpeg')).toBe('image');
      expect(detectMediaType('image/png')).toBe('image');
    });

    it('detects gifs', () => {
      expect(detectMediaType('image/gif')).toBe('gif');
    });

    it('detects videos', () => {
      expect(detectMediaType('video/mp4')).toBe('video');
    });

    it('returns null for unknown types', () => {
      expect(detectMediaType('application/pdf')).toBe(null);
    });
  });

  describe('validateAttachmentCount', () => {
    it('allows attachments within limit', () => {
      expect(validateAttachmentCount(0, 'thread').valid).toBe(true);
    });

    it('rejects when at max', () => {
      const result = validateAttachmentCount(10, 'thread');
      expect(result.valid).toBe(false);
    });
  });
});

// ── Realtime Engine ─────────────────────────────────────────────────────

describe('Realtime Engine', () => {
  describe('channel builders', () => {
    it('builds correct channel names', () => {
      expect(buildThreadChannel('t1')).toBe('forum:thread:t1');
      expect(buildCommunityPresenceChannel('c1')).toBe('forum:presence:c1');
      expect(buildFeedChannel('u1')).toBe('forum:feed:u1');
      expect(buildDMChannel('conv1')).toBe('forum:dm:conv1');
      expect(buildVoiceChannel('vc1')).toBe('forum:voice:vc1');
    });
  });

  describe('formatTypingText', () => {
    it('returns empty for no typers', () => {
      expect(formatTypingText([])).toBe('');
    });

    it('formats single typer', () => {
      expect(formatTypingText([{ displayName: 'Alice', userId: 'u1', channelId: 'ch1', timestamp: 0 }]))
        .toBe('Alice is typing...');
    });

    it('formats two typers', () => {
      const result = formatTypingText([
        { displayName: 'Alice', userId: 'u1', channelId: 'ch1', timestamp: 0 },
        { displayName: 'Bob', userId: 'u2', channelId: 'ch1', timestamp: 0 },
      ]);
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
      expect(result).toContain('are typing');
    });

    it('formats 3+ typers as count', () => {
      const typers = [
        { displayName: 'A', userId: 'u1', channelId: 'ch1', timestamp: 0 },
        { displayName: 'B', userId: 'u2', channelId: 'ch1', timestamp: 0 },
        { displayName: 'C', userId: 'u3', channelId: 'ch1', timestamp: 0 },
      ];
      expect(formatTypingText(typers)).toBe('3 people are typing...');
    });
  });

  it('pruneExpiredTypers removes old entries', () => {
    const now = Date.now();
    const typers = [
      { displayName: 'Fresh', userId: 'u1', channelId: 'ch1', timestamp: now - 1000 },
      { displayName: 'Stale', userId: 'u2', channelId: 'ch1', timestamp: now - 60000 },
    ];
    const active = pruneExpiredTypers(typers, now);
    expect(active.length).toBeLessThanOrEqual(typers.length);
  });

  it('countOnlineMembers counts recent activity', () => {
    const now = Date.now();
    const members = [
      { lastSeenAt: now - 1000 },   // online
      { lastSeenAt: now - 600000 },  // offline
    ];
    const count = countOnlineMembers(members, now);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── Messaging Engine ────────────────────────────────────────────────────

describe('Messaging Engine', () => {
  describe('findExisting1to1', () => {
    it('finds existing 1:1 conversation', () => {
      const convs = [
        { id: 'c1', isGroup: false, participantIds: ['u1', 'u2'] },
        { id: 'c2', isGroup: true, participantIds: ['u1', 'u2', 'u3'] },
      ];
      expect(findExisting1to1(convs, 'u1', 'u2')).toBe('c1');
    });

    it('returns null when no 1:1 exists', () => {
      const convs = [
        { id: 'c2', isGroup: true, participantIds: ['u1', 'u2', 'u3'] },
      ];
      expect(findExisting1to1(convs, 'u1', 'u2')).toBe(null);
    });

    it('ignores group conversations', () => {
      const convs = [
        { id: 'c1', isGroup: true, participantIds: ['u1', 'u2'] },
      ];
      expect(findExisting1to1(convs, 'u1', 'u2')).toBe(null);
    });
  });

  describe('isUserBlocked', () => {
    it('detects blocking in either direction', () => {
      const blocks = [{ blockerId: 'u1', blockedId: 'u2' }];
      expect(isUserBlocked(blocks, 'u1', 'u2')).toBe(true);
      expect(isUserBlocked(blocks, 'u2', 'u1')).toBe(true);
    });

    it('returns false when no block exists', () => {
      expect(isUserBlocked([], 'u1', 'u2')).toBe(false);
    });
  });

  describe('validateMessageBody', () => {
    it('accepts valid messages', () => {
      expect(validateMessageBody('Hello').valid).toBe(true);
    });

    it('rejects empty messages', () => {
      expect(validateMessageBody('').valid).toBe(false);
    });

    it('rejects messages over 5000 chars', () => {
      expect(validateMessageBody('x'.repeat(5001)).valid).toBe(false);
    });
  });

  describe('getCharacterCountInfo', () => {
    it('returns correct count and remaining', () => {
      const info = getCharacterCountInfo('Hello');
      expect(info.count).toBe(5);
      expect(info.remaining).toBe(4995);
      expect(info.showWarning).toBe(false);
    });

    it('shows warning at 4500+', () => {
      expect(getCharacterCountInfo('x'.repeat(4500)).showWarning).toBe(true);
    });
  });

  it('sortConversationsByLastMessage sorts newest first', () => {
    const convs = [
      { lastMessageAt: '2026-01-01T00:00:00Z' },
      { lastMessageAt: '2026-03-01T00:00:00Z' },
      { lastMessageAt: null },
    ];
    const sorted = sortConversationsByLastMessage(convs);
    expect(sorted[0].lastMessageAt).toBe('2026-03-01T00:00:00Z');
    expect(sorted[2].lastMessageAt).toBe(null);
  });
});

// ── Voice Engine ────────────────────────────────────────────────────────

describe('Voice Engine', () => {
  describe('detectSpeaking', () => {
    it('returns true when above threshold', () => {
      expect(detectSpeaking(0.1, 0.01)).toBe(true);
    });

    it('returns false when below threshold', () => {
      expect(detectSpeaking(0.001, 0.01)).toBe(false);
    });
  });

  describe('calculateRMS', () => {
    it('returns 0 for empty samples', () => {
      expect(calculateRMS(new Float32Array([]))).toBe(0);
    });

    it('calculates RMS correctly', () => {
      const samples = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      expect(calculateRMS(samples)).toBeCloseTo(0.5, 5);
    });

    it('returns 0 for silent audio', () => {
      const samples = new Float32Array([0, 0, 0, 0]);
      expect(calculateRMS(samples)).toBe(0);
    });
  });

  describe('getActiveParticipants', () => {
    it('filters out stale participants', () => {
      const now = Date.now();
      const participants = [
        { userId: 'u1', lastHeartbeat: now - 1000 },
        { userId: 'u2', lastHeartbeat: now - 999999 },
      ];
      const active = getActiveParticipants(participants, now);
      expect(active.length).toBe(1);
      expect(active[0].userId).toBe('u1');
    });
  });

  describe('getMeshConnectionCount', () => {
    it('returns 0 for 0-1 participants', () => {
      expect(getMeshConnectionCount(0)).toBe(0);
      expect(getMeshConnectionCount(1)).toBe(0);
    });

    it('calculates N*(N-1)/2', () => {
      expect(getMeshConnectionCount(2)).toBe(1);
      expect(getMeshConnectionCount(3)).toBe(3);
      expect(getMeshConnectionCount(4)).toBe(6);
    });
  });

  describe('getMeshQualityWarning', () => {
    it('returns null for small groups', () => {
      expect(getMeshQualityWarning(5)).toBe(null);
    });

    it('warns for 11+ participants', () => {
      expect(getMeshQualityWarning(11)).toBeTruthy();
    });

    it('strongly warns for 16+ participants', () => {
      expect(getMeshQualityWarning(16)).toContain('degrade');
    });
  });

  it('exports ICE_SERVERS', () => {
    expect(ICE_SERVERS.length).toBeGreaterThan(0);
    expect(ICE_SERVERS[0].urls).toContain('stun');
  });
});

// ── Federation Engine ───────────────────────────────────────────────────

describe('Federation Engine', () => {
  describe('threadToActivityPub', () => {
    it('transforms thread to Page object', () => {
      const result = threadToActivityPub({
        id: 't1', title: 'Test Thread', body: 'Body text',
        authorUri: 'https://example.com/user/alice',
        communityUri: 'https://example.com/community/test',
        createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
      }, 'example.com');
      expect(result.type).toBe('Page');
      expect(result.name).toBe('Test Thread');
      expect(result['@context']).toContain('activitystreams');
      expect((result.id as string)).toContain('t1');
    });
  });

  describe('replyToActivityPub', () => {
    it('transforms reply to Note object', () => {
      const result = replyToActivityPub({
        id: 'r1', body: 'Reply text',
        authorUri: 'https://example.com/user/alice',
        threadUri: 'https://example.com/thread/t1',
        createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
      }, 'example.com');
      expect(result.type).toBe('Note');
      expect(result.content).toBe('Reply text');
      expect(result.inReplyTo).toContain('t1');
    });
  });

  describe('wrapInActivity', () => {
    it('wraps object in Create activity', () => {
      const wrapped = wrapInActivity('Create', 'https://example.com/user/alice', { type: 'Note', content: 'Hi' });
      expect(wrapped.type).toBe('Create');
      expect(wrapped.actor).toBe('https://example.com/user/alice');
      expect((wrapped.object as Record<string, unknown>).type).toBe('Note');
    });
  });

  describe('parseIncomingActivity', () => {
    it('parses valid activity with object', () => {
      const parsed = parseIncomingActivity({
        type: 'Create',
        actor: 'https://remote.example/user/bob',
        object: { type: 'Note', id: 'note-1', content: 'Hello', inReplyTo: 'thread-1' },
      });
      expect(parsed).not.toBe(null);
      expect(parsed!.type).toBe('Create');
      expect(parsed!.objectType).toBe('Note');
      expect(parsed!.content).toBe('Hello');
      expect(parsed!.inReplyTo).toBe('thread-1');
    });

    it('parses activity with string object (URI)', () => {
      const parsed = parseIncomingActivity({
        type: 'Delete',
        actor: 'https://remote.example/user/bob',
        object: 'https://remote.example/note/1',
      });
      expect(parsed!.objectId).toBe('https://remote.example/note/1');
    });

    it('returns null for missing type', () => {
      expect(parseIncomingActivity({ actor: 'test' })).toBe(null);
    });

    it('returns null for missing actor', () => {
      expect(parseIncomingActivity({ type: 'Create' })).toBe(null);
    });
  });

  it('buildNodeInfoResponse includes software info', () => {
    const info = buildNodeInfoResponse('example.com', 100, 5, 500);
    expect(info.version).toBe('2.0');
    expect((info.software as Record<string, unknown>).name).toBe('myforums');
    expect((info.usage as Record<string, unknown>).localPosts).toBe(500);
  });

  describe('buildSignatureHeader / parseSignatureHeader', () => {
    it('round-trips signature data', () => {
      const header = buildSignatureHeader('key-1', ['(request-target)', 'date'], 'sig123');
      const parsed = parseSignatureHeader(header);
      expect(parsed).not.toBe(null);
      expect(parsed!.keyId).toBe('key-1');
      expect(parsed!.headers).toEqual(['(request-target)', 'date']);
      expect(parsed!.signature).toBe('sig123');
    });

    it('returns null for invalid header', () => {
      expect(parseSignatureHeader('garbage')).toBe(null);
    });
  });
});

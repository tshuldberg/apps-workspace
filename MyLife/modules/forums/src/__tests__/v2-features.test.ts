import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// 1. User Profiles
// ═══════════════════════════════════════════════════════════════════

import { validateUsername, getDefaultAvatarColor, getEligibleBadges, getBadgeLabel, getBadgeColor } from '../profile/engine';

describe('profile/engine', () => {
  describe('validateUsername', () => {
    it('accepts valid usernames', () => {
      expect(validateUsername('test-user').valid).toBe(true);
      expect(validateUsername('abc').valid).toBe(true);
      expect(validateUsername('user123').valid).toBe(true);
      expect(validateUsername('a-b-c-d').valid).toBe(true);
    });

    it('rejects too short', () => {
      expect(validateUsername('ab').valid).toBe(false);
      expect(validateUsername('a').valid).toBe(false);
    });

    it('rejects too long', () => {
      expect(validateUsername('a'.repeat(31)).valid).toBe(false);
    });

    it('rejects uppercase', () => {
      expect(validateUsername('TestUser').valid).toBe(false);
    });

    it('rejects spaces', () => {
      expect(validateUsername('test user').valid).toBe(false);
    });

    it('rejects special chars', () => {
      expect(validateUsername('test_user').valid).toBe(false);
      expect(validateUsername('test@user').valid).toBe(false);
    });

    it('rejects leading/trailing hyphens', () => {
      expect(validateUsername('-test').valid).toBe(false);
      expect(validateUsername('test-').valid).toBe(false);
    });
  });

  describe('getDefaultAvatarColor', () => {
    it('returns deterministic color for same username', () => {
      const color1 = getDefaultAvatarColor('alice');
      const color2 = getDefaultAvatarColor('alice');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different usernames', () => {
      const c1 = getDefaultAvatarColor('alice');
      const c2 = getDefaultAvatarColor('bob');
      // Not guaranteed to be different but very likely with different hashes
      expect(typeof c1).toBe('string');
      expect(typeof c2).toBe('string');
      expect(c1).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe('getEligibleBadges', () => {
    it('returns first_post for 1+ threads', () => {
      const badges = getEligibleBadges({
        threadCount: 1, replyCount: 0, karma: 0,
        accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toContain('first_post');
      expect(badges).not.toContain('first_reply');
    });

    it('returns karma badges at thresholds', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 1000,
        accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toContain('karma_100');
      expect(badges).toContain('karma_1000');
      expect(badges).not.toContain('karma_10000');
    });

    it('returns veteran for 1+ year', () => {
      const oneYear = 366 * 24 * 60 * 60 * 1000;
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0,
        accountAgeMs: oneYear, isModerator: false,
      });
      expect(badges).toContain('veteran');
    });

    it('returns moderator when isModerator', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0,
        accountAgeMs: 0, isModerator: true,
      });
      expect(badges).toContain('moderator');
    });

    it('returns prolific for 100+ threads', () => {
      const badges = getEligibleBadges({
        threadCount: 100, replyCount: 0, karma: 0,
        accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toContain('prolific');
      expect(badges).toContain('first_post');
    });

    it('returns empty for no milestones', () => {
      const badges = getEligibleBadges({
        threadCount: 0, replyCount: 0, karma: 0,
        accountAgeMs: 0, isModerator: false,
      });
      expect(badges).toEqual([]);
    });
  });

  describe('getBadgeLabel', () => {
    it('returns label for each badge type', () => {
      expect(getBadgeLabel('first_post')).toBe('First Post');
      expect(getBadgeLabel('karma_1000')).toBe('1K Karma');
      expect(getBadgeLabel('veteran')).toBe('Veteran');
    });
  });

  describe('getBadgeColor', () => {
    it('returns color for each badge type', () => {
      expect(getBadgeColor('moderator')).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Media Sharing
// ═══════════════════════════════════════════════════════════════════

import {
  calculateResizeDimensions, calculateThumbnailDimensions,
  buildStoragePath, detectMediaType, validateAttachmentCount,
} from '../media/engine';
import { validateMediaFile, extractUrls } from '../models/media';

describe('media/engine', () => {
  describe('calculateResizeDimensions', () => {
    it('preserves dimensions within limit', () => {
      expect(calculateResizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    });

    it('resizes to max dimension', () => {
      const result = calculateResizeDimensions(4000, 3000, 2048);
      expect(result.width).toBeLessThanOrEqual(2048);
      expect(result.height).toBeLessThanOrEqual(2048);
    });

    it('preserves aspect ratio', () => {
      const result = calculateResizeDimensions(4000, 2000, 2048);
      expect(result.width).toBe(2048);
      expect(result.height).toBe(1024);
    });
  });

  describe('calculateThumbnailDimensions', () => {
    it('resizes for thumbnail', () => {
      const result = calculateThumbnailDimensions(2048, 1024, 400);
      expect(result.width).toBeLessThanOrEqual(400);
      expect(result.height).toBeLessThanOrEqual(400);
    });
  });

  describe('buildStoragePath', () => {
    it('builds correct path', () => {
      const path = buildStoragePath('user-123', 'file-456', 'webp');
      expect(path).toBe('forum-media/user-123/file-456.webp');
    });
  });

  describe('detectMediaType', () => {
    it('detects image types', () => {
      expect(detectMediaType('image/jpeg')).toBe('image');
      expect(detectMediaType('image/png')).toBe('image');
      expect(detectMediaType('image/webp')).toBe('image');
    });

    it('detects gif', () => {
      expect(detectMediaType('image/gif')).toBe('gif');
    });

    it('detects video', () => {
      expect(detectMediaType('video/mp4')).toBe('video');
      expect(detectMediaType('video/quicktime')).toBe('video');
    });

    it('returns null for unsupported', () => {
      expect(detectMediaType('application/pdf')).toBeNull();
      expect(detectMediaType('audio/mp3')).toBeNull();
    });
  });

  describe('validateAttachmentCount', () => {
    it('allows attachments within limit', () => {
      expect(validateAttachmentCount(5, 'thread').valid).toBe(true);
    });

    it('rejects at thread limit', () => {
      expect(validateAttachmentCount(10, 'thread').valid).toBe(false);
    });

    it('rejects at reply limit', () => {
      expect(validateAttachmentCount(1, 'reply').valid).toBe(false);
    });

    it('allows first reply attachment', () => {
      expect(validateAttachmentCount(0, 'reply').valid).toBe(true);
    });
  });
});

describe('media/models', () => {
  describe('validateMediaFile', () => {
    it('accepts valid image', () => {
      expect(validateMediaFile('image/jpeg', 5 * 1024 * 1024, 'image').valid).toBe(true);
    });

    it('rejects oversized image', () => {
      const result = validateMediaFile('image/jpeg', 11 * 1024 * 1024, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('rejects unsupported type', () => {
      const result = validateMediaFile('application/pdf', 1024, 'image');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('accepts valid video', () => {
      expect(validateMediaFile('video/mp4', 30 * 1024 * 1024, 'video').valid).toBe(true);
    });

    it('rejects oversized video', () => {
      expect(validateMediaFile('video/mp4', 51 * 1024 * 1024, 'video').valid).toBe(false);
    });
  });

  describe('extractUrls', () => {
    it('extracts URLs from text', () => {
      const urls = extractUrls('Check out https://example.com and http://test.org/page');
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe('https://example.com');
    });

    it('returns empty for no URLs', () => {
      expect(extractUrls('no links here')).toEqual([]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Real-time Updates
// ═══════════════════════════════════════════════════════════════════

import {
  buildThreadChannel, buildCommunityPresenceChannel,
  formatTypingText, pruneExpiredTypers, countOnlineMembers,
} from '../realtime/engine';
import {
  getReconnectDelay, shouldDebounceTyping, isTypingExpired,
  getPresenceStatus, shouldBatchUpdate,
} from '../models/realtime';

describe('realtime/engine', () => {
  describe('buildThreadChannel', () => {
    it('builds correct channel name', () => {
      expect(buildThreadChannel('abc-123')).toBe('forum:thread:abc-123');
    });
  });

  describe('buildCommunityPresenceChannel', () => {
    it('builds correct channel name', () => {
      expect(buildCommunityPresenceChannel('comm-1')).toBe('forum:presence:comm-1');
    });
  });

  describe('formatTypingText', () => {
    it('returns empty for no typers', () => {
      expect(formatTypingText([])).toBe('');
    });

    it('formats single typer', () => {
      expect(formatTypingText([{ userId: '1', displayName: 'Alice', channelId: 'c', timestamp: 0 }]))
        .toBe('Alice is typing...');
    });

    it('formats two typers', () => {
      const typers = [
        { userId: '1', displayName: 'Alice', channelId: 'c', timestamp: 0 },
        { userId: '2', displayName: 'Bob', channelId: 'c', timestamp: 0 },
      ];
      expect(formatTypingText(typers)).toBe('Alice and Bob are typing...');
    });

    it('formats 3+ typers', () => {
      const typers = [
        { userId: '1', displayName: 'Alice', channelId: 'c', timestamp: 0 },
        { userId: '2', displayName: 'Bob', channelId: 'c', timestamp: 0 },
        { userId: '3', displayName: 'Carol', channelId: 'c', timestamp: 0 },
      ];
      expect(formatTypingText(typers)).toBe('3 people are typing...');
    });
  });

  describe('pruneExpiredTypers', () => {
    it('removes expired typers', () => {
      const now = Date.now();
      const typers = [
        { userId: '1', displayName: 'Alice', channelId: 'c', timestamp: now - 5000 }, // expired
        { userId: '2', displayName: 'Bob', channelId: 'c', timestamp: now - 1000 }, // active
      ];
      const result = pruneExpiredTypers(typers, now);
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Bob');
    });
  });

  describe('countOnlineMembers', () => {
    it('counts only online members', () => {
      const now = Date.now();
      const members = [
        { lastSeenAt: now - 10_000 },  // online (<60s)
        { lastSeenAt: now - 100_000 }, // idle (>60s, <5min)
        { lastSeenAt: now - 400_000 }, // offline (>5min)
      ];
      expect(countOnlineMembers(members, now)).toBe(1);
    });
  });
});

describe('realtime/models', () => {
  describe('getReconnectDelay', () => {
    it('follows exponential backoff', () => {
      expect(getReconnectDelay(0)).toBe(1000);
      expect(getReconnectDelay(1)).toBe(2000);
      expect(getReconnectDelay(2)).toBe(4000);
      expect(getReconnectDelay(3)).toBe(8000);
      expect(getReconnectDelay(4)).toBe(16000);
      expect(getReconnectDelay(5)).toBe(30000);
    });

    it('caps at 30s', () => {
      expect(getReconnectDelay(10)).toBe(30000);
      expect(getReconnectDelay(100)).toBe(30000);
    });
  });

  describe('shouldDebounceTyping', () => {
    it('debounces within window', () => {
      expect(shouldDebounceTyping(1000, 2500)).toBe(true);
    });

    it('allows after window', () => {
      expect(shouldDebounceTyping(1000, 3500)).toBe(false);
    });
  });

  describe('isTypingExpired', () => {
    it('expires after 3 seconds', () => {
      const now = Date.now();
      expect(isTypingExpired(now - 4000, now)).toBe(true);
      expect(isTypingExpired(now - 2000, now)).toBe(false);
    });
  });

  describe('getPresenceStatus', () => {
    it('returns online within 60s', () => {
      const now = Date.now();
      expect(getPresenceStatus(now - 30_000, now)).toBe('online');
    });

    it('returns idle between 60s and 5min', () => {
      const now = Date.now();
      expect(getPresenceStatus(now - 120_000, now)).toBe('idle');
    });

    it('returns offline after 5min', () => {
      const now = Date.now();
      expect(getPresenceStatus(now - 400_000, now)).toBe('offline');
    });
  });

  describe('shouldBatchUpdate', () => {
    it('allows after 500ms', () => {
      expect(shouldBatchUpdate(1000, 1600)).toBe(true);
    });

    it('blocks within 500ms', () => {
      expect(shouldBatchUpdate(1000, 1300)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Direct Messaging
// ═══════════════════════════════════════════════════════════════════

import {
  findExisting1to1, isUserBlocked, validateMessageBody,
  getCharacterCountInfo, sortConversationsByLastMessage,
} from '../messaging/engine';
import { getUnreadCount, isReadByRecipient, formatMessagePreview } from '../models/messaging';

describe('messaging/engine', () => {
  describe('findExisting1to1', () => {
    it('finds existing 1:1', () => {
      const convs = [
        { id: 'c1', isGroup: false, participantIds: ['user-a', 'user-b'] },
        { id: 'c2', isGroup: true, participantIds: ['user-a', 'user-b', 'user-c'] },
      ];
      expect(findExisting1to1(convs, 'user-a', 'user-b')).toBe('c1');
    });

    it('returns null when no match', () => {
      expect(findExisting1to1([], 'a', 'b')).toBeNull();
    });

    it('skips groups', () => {
      const convs = [
        { id: 'c2', isGroup: true, participantIds: ['user-a', 'user-b'] },
      ];
      expect(findExisting1to1(convs, 'user-a', 'user-b')).toBeNull();
    });
  });

  describe('isUserBlocked', () => {
    it('detects block in either direction', () => {
      const blocks = [{ blockerId: 'a', blockedId: 'b' }];
      expect(isUserBlocked(blocks, 'a', 'b')).toBe(true);
      expect(isUserBlocked(blocks, 'b', 'a')).toBe(true);
    });

    it('returns false when not blocked', () => {
      expect(isUserBlocked([], 'a', 'b')).toBe(false);
    });
  });

  describe('validateMessageBody', () => {
    it('accepts valid message', () => {
      expect(validateMessageBody('Hello').valid).toBe(true);
    });

    it('rejects empty message', () => {
      expect(validateMessageBody('').valid).toBe(false);
    });

    it('rejects message over 5000 chars', () => {
      expect(validateMessageBody('x'.repeat(5001)).valid).toBe(false);
    });
  });

  describe('getCharacterCountInfo', () => {
    it('shows warning near limit', () => {
      const info = getCharacterCountInfo('x'.repeat(4600));
      expect(info.showWarning).toBe(true);
      expect(info.remaining).toBe(400);
    });

    it('no warning for short messages', () => {
      expect(getCharacterCountInfo('hello').showWarning).toBe(false);
    });
  });

  describe('sortConversationsByLastMessage', () => {
    it('sorts newest first', () => {
      const convs = [
        { lastMessageAt: '2026-03-01T10:00:00Z' },
        { lastMessageAt: '2026-03-02T10:00:00Z' },
        { lastMessageAt: null },
      ];
      const sorted = sortConversationsByLastMessage(convs);
      expect(sorted[0].lastMessageAt).toBe('2026-03-02T10:00:00Z');
      expect(sorted[2].lastMessageAt).toBeNull();
    });
  });
});

describe('messaging/models', () => {
  describe('getUnreadCount', () => {
    it('counts messages after lastReadAt', () => {
      const msgs = [
        { createdAt: '2026-03-01T10:00:00Z' },
        { createdAt: '2026-03-02T10:00:00Z' },
        { createdAt: '2026-03-03T10:00:00Z' },
      ];
      expect(getUnreadCount(msgs, '2026-03-01T12:00:00Z')).toBe(2);
    });
  });

  describe('isReadByRecipient', () => {
    it('returns true when read', () => {
      expect(isReadByRecipient('2026-03-01T10:00:00Z', '2026-03-01T12:00:00Z')).toBe(true);
    });

    it('returns false when not yet read', () => {
      expect(isReadByRecipient('2026-03-02T10:00:00Z', '2026-03-01T12:00:00Z')).toBe(false);
    });
  });

  describe('formatMessagePreview', () => {
    it('returns full body when short', () => {
      expect(formatMessagePreview('Hello')).toBe('Hello');
    });

    it('truncates long messages', () => {
      const long = 'x'.repeat(300);
      const preview = formatMessagePreview(long, 200);
      expect(preview.length).toBe(200);
      expect(preview.endsWith('...')).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Voice Channels
// ═══════════════════════════════════════════════════════════════════

import {
  detectSpeaking, calculateRMS, getActiveParticipants,
  getMeshConnectionCount, getMeshQualityWarning,
} from '../voice/engine';
import { isChannelFull, getGridLayout, isParticipantStale } from '../models/voice';

describe('voice/engine', () => {
  describe('detectSpeaking', () => {
    it('detects speech above threshold', () => {
      expect(detectSpeaking(0.05)).toBe(true);
    });

    it('does not detect silence', () => {
      expect(detectSpeaking(0.005)).toBe(false);
    });
  });

  describe('calculateRMS', () => {
    it('returns 0 for empty samples', () => {
      expect(calculateRMS(new Float32Array(0))).toBe(0);
    });

    it('computes correct RMS', () => {
      const samples = new Float32Array([0.5, -0.5, 0.5, -0.5]);
      expect(calculateRMS(samples)).toBeCloseTo(0.5, 5);
    });
  });

  describe('getActiveParticipants', () => {
    it('filters stale participants', () => {
      const now = Date.now();
      const participants = [
        { userId: 'a', lastHeartbeat: now - 10_000 }, // active
        { userId: 'b', lastHeartbeat: now - 70_000 }, // stale
      ];
      const active = getActiveParticipants(participants, now);
      expect(active).toHaveLength(1);
      expect(active[0].userId).toBe('a');
    });
  });

  describe('getMeshConnectionCount', () => {
    it('returns 0 for 1 participant', () => {
      expect(getMeshConnectionCount(1)).toBe(0);
    });

    it('returns correct count', () => {
      expect(getMeshConnectionCount(2)).toBe(1);
      expect(getMeshConnectionCount(3)).toBe(3);
      expect(getMeshConnectionCount(4)).toBe(6);
      expect(getMeshConnectionCount(10)).toBe(45);
    });
  });

  describe('getMeshQualityWarning', () => {
    it('returns null for small groups', () => {
      expect(getMeshQualityWarning(5)).toBeNull();
    });

    it('warns for 11-15 participants', () => {
      expect(getMeshQualityWarning(12)).toContain('limiting');
    });

    it('warns for 16+ participants', () => {
      expect(getMeshQualityWarning(20)).toContain('degrade');
    });
  });
});

describe('voice/models', () => {
  describe('isChannelFull', () => {
    it('returns true at capacity', () => {
      expect(isChannelFull(25, 25)).toBe(true);
    });

    it('returns false below capacity', () => {
      expect(isChannelFull(10, 25)).toBe(false);
    });
  });

  describe('getGridLayout', () => {
    it('returns 1x1 for single participant', () => {
      expect(getGridLayout(1)).toEqual({ cols: 1, rows: 1 });
    });

    it('returns 2x2 for 2-4 participants', () => {
      expect(getGridLayout(4)).toEqual({ cols: 2, rows: 2 });
    });

    it('returns 3x3 for 5-9 participants', () => {
      expect(getGridLayout(9)).toEqual({ cols: 3, rows: 3 });
    });

    it('returns 3xN for 10+ participants', () => {
      const layout = getGridLayout(12);
      expect(layout.cols).toBe(3);
      expect(layout.rows).toBe(4);
    });
  });

  describe('isParticipantStale', () => {
    it('returns true after timeout', () => {
      const now = Date.now();
      expect(isParticipantStale(now - 70_000, now)).toBe(true);
    });

    it('returns false within timeout', () => {
      const now = Date.now();
      expect(isParticipantStale(now - 30_000, now)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Federation
// ═══════════════════════════════════════════════════════════════════

import {
  threadToActivityPub, replyToActivityPub, wrapInActivity,
  parseIncomingActivity, buildNodeInfoResponse,
  buildSignatureHeader, parseSignatureHeader,
} from '../federation/engine';
import {
  getRetryDelay, isDeadActivity, shouldRateLimit,
  buildActorUri, buildCommunityUri,
  parseWebFingerResource, buildWebFingerResponse,
} from '../models/federation';

describe('federation/engine', () => {
  describe('threadToActivityPub', () => {
    it('transforms thread to ActivityPub Page', () => {
      const result = threadToActivityPub({
        id: 't-1', title: 'Hello', body: 'World',
        authorUri: 'https://example.com/ap/user/alice',
        communityUri: 'https://example.com/ap/community/general',
        createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
      }, 'example.com');
      expect(result.type).toBe('Page');
      expect(result.name).toBe('Hello');
      expect(result.content).toBe('World');
      expect(result.id).toContain('t-1');
    });
  });

  describe('replyToActivityPub', () => {
    it('transforms reply to ActivityPub Note', () => {
      const result = replyToActivityPub({
        id: 'r-1', body: 'Reply text',
        authorUri: 'https://example.com/ap/user/bob',
        threadUri: 'https://example.com/ap/thread/t-1',
        createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
      }, 'example.com');
      expect(result.type).toBe('Note');
      expect(result.content).toBe('Reply text');
      expect(result.inReplyTo).toContain('t-1');
    });
  });

  describe('wrapInActivity', () => {
    it('wraps object in Create activity', () => {
      const result = wrapInActivity('Create', 'https://example.com/ap/user/alice', { type: 'Page', id: 'p-1' });
      expect(result.type).toBe('Create');
      expect(result.actor).toContain('alice');
    });
  });

  describe('parseIncomingActivity', () => {
    it('parses valid activity', () => {
      const parsed = parseIncomingActivity({
        type: 'Create',
        actor: 'https://remote.com/user/bob',
        object: { type: 'Note', id: 'note-1', content: 'Hello', inReplyTo: 'thread-1' },
      });
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('Create');
      expect(parsed!.objectType).toBe('Note');
      expect(parsed!.content).toBe('Hello');
      expect(parsed!.inReplyTo).toBe('thread-1');
    });

    it('returns null for missing type', () => {
      expect(parseIncomingActivity({ actor: 'test' })).toBeNull();
    });

    it('handles string object (like Delete)', () => {
      const parsed = parseIncomingActivity({
        type: 'Delete',
        actor: 'https://remote.com/user/bob',
        object: 'https://remote.com/note/1',
      });
      expect(parsed!.objectId).toBe('https://remote.com/note/1');
    });
  });

  describe('buildNodeInfoResponse', () => {
    it('builds correct structure', () => {
      const info = buildNodeInfoResponse('example.com', 100, 10, 500);
      expect(info.version).toBe('2.0');
      expect((info.software as Record<string, string>).name).toBe('myforums');
      expect((info.usage as Record<string, unknown>).localPosts).toBe(500);
    });
  });

  describe('buildSignatureHeader', () => {
    it('builds valid header', () => {
      const header = buildSignatureHeader('key-1', ['(request-target)', 'host', 'date'], 'abc123');
      expect(header).toContain('keyId="key-1"');
      expect(header).toContain('signature="abc123"');
    });
  });

  describe('parseSignatureHeader', () => {
    it('parses valid header', () => {
      const header = 'keyId="key-1",headers="(request-target) host date",signature="abc123"';
      const result = parseSignatureHeader(header);
      expect(result).not.toBeNull();
      expect(result!.keyId).toBe('key-1');
      expect(result!.headers).toEqual(['(request-target)', 'host', 'date']);
      expect(result!.signature).toBe('abc123');
    });

    it('returns null for invalid header', () => {
      expect(parseSignatureHeader('invalid')).toBeNull();
    });
  });
});

describe('federation/models', () => {
  describe('getRetryDelay', () => {
    it('returns exponential delays', () => {
      expect(getRetryDelay(0)).toBe(60_000);
      expect(getRetryDelay(1)).toBe(300_000);
      expect(getRetryDelay(2)).toBe(1_800_000);
    });

    it('caps at max interval', () => {
      expect(getRetryDelay(10)).toBe(43_200_000);
    });
  });

  describe('isDeadActivity', () => {
    it('returns true at max attempts', () => {
      expect(isDeadActivity(5, 5)).toBe(true);
    });

    it('returns false below max', () => {
      expect(isDeadActivity(3, 5)).toBe(false);
    });
  });

  describe('shouldRateLimit', () => {
    it('limits at threshold', () => {
      expect(shouldRateLimit(100)).toBe(true);
      expect(shouldRateLimit(99)).toBe(false);
    });
  });

  describe('buildActorUri', () => {
    it('builds correct URI', () => {
      expect(buildActorUri('example.com', 'alice')).toBe('https://example.com/ap/user/alice');
    });
  });

  describe('buildCommunityUri', () => {
    it('builds correct URI', () => {
      expect(buildCommunityUri('example.com', 'general')).toBe('https://example.com/ap/community/general');
    });
  });

  describe('parseWebFingerResource', () => {
    it('parses valid resource', () => {
      const result = parseWebFingerResource('acct:alice@example.com');
      expect(result).toEqual({ username: 'alice', domain: 'example.com' });
    });

    it('returns null for invalid', () => {
      expect(parseWebFingerResource('invalid')).toBeNull();
    });
  });

  describe('buildWebFingerResponse', () => {
    it('builds correct structure', () => {
      const response = buildWebFingerResponse('alice', 'example.com');
      expect(response.subject).toBe('acct:alice@example.com');
      expect((response.links as Array<Record<string, string>>)[0].href).toContain('alice');
    });
  });
});

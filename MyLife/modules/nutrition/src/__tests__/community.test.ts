import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  generateShareCode,
  createProfile,
  getProfile,
  getProfileById,
  updateProfile,
  deleteProfile,
} from '../community/profiles';
import {
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  blockConnection,
  getAcceptedConnections,
  getPendingRequests,
  getAcceptedProfileIds,
  isBlocked,
} from '../community/connections';
import {
  createFeedItem,
  getFeed,
  getOwnFeed,
  cheerFeedItem,
} from '../community/feed';
import {
  createChallenge,
  joinChallenge,
  updateChallengeProgress,
  getChallengeById,
  getActiveChallenges,
  getChallengeLeaderboard,
  getChallengeMember,
} from '../community/challenges';
import { isActivityVisible } from '../community/sharing';
import type { CommunityProfile } from '../community/types';

describe('community', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // -- V5 schema tests -------------------------------------------------------

  describe('schema', () => {
    it('creates V5 community tables', () => {
      const tables = db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nu_community%' ORDER BY name",
      );
      const names = tables.map((t) => t.name);
      expect(names).toContain('nu_community_profiles');
      expect(names).toContain('nu_community_connections');
      expect(names).toContain('nu_community_feed');
      expect(names).toContain('nu_community_challenges');
      expect(names).toContain('nu_community_challenge_members');
    });

    it('creates V5 indexes', () => {
      const indexes = db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND (name LIKE 'nu_cc_%' OR name LIKE 'nu_cf_%' OR name LIKE 'nu_cch_%' OR name LIKE 'nu_ccm_%')",
      );
      expect(indexes.length).toBeGreaterThanOrEqual(10);
    });
  });

  // -- Share code generation -------------------------------------------------

  describe('generateShareCode', () => {
    it('produces NUTR-XXXX format', () => {
      const code = generateShareCode();
      expect(code).toMatch(/^NUTR-[A-Z2-9]{4}$/);
    });

    it('produces unique codes across 100 iterations', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateShareCode());
      }
      expect(codes.size).toBeGreaterThanOrEqual(90);
    });
  });

  // -- Profile CRUD ----------------------------------------------------------

  describe('profiles', () => {
    it('creates a profile with valid input', () => {
      const profile = createProfile(db, { displayName: 'TestUser' });
      expect(profile.displayName).toBe('TestUser');
      expect(profile.avatarEmoji).toBe('\u{1F966}');
      expect(profile.shareStreaks).toBe(true);
      expect(profile.shareCalories).toBe(false);
      expect(profile.id).toMatch(/^NUTR-[A-Z2-9]{4}$/);
    });

    it('rejects empty display name', () => {
      expect(() => createProfile(db, { displayName: '' })).toThrow('Display name is required');
    });

    it('rejects display name over 30 characters', () => {
      expect(() => createProfile(db, { displayName: 'A'.repeat(31) })).toThrow('30 characters');
    });

    it('gets profile after creation', () => {
      createProfile(db, { displayName: 'GetTest' });
      const profile = getProfile(db);
      expect(profile).not.toBeNull();
      expect(profile!.displayName).toBe('GetTest');
    });

    it('updates profile fields', () => {
      const profile = createProfile(db, { displayName: 'Original' });
      const updated = updateProfile(db, profile.id, { displayName: 'Updated', shareCalories: true });
      expect(updated.displayName).toBe('Updated');
      expect(updated.shareCalories).toBe(true);
    });

    it('deletes profile', () => {
      const profile = createProfile(db, { displayName: 'ToDelete' });
      deleteProfile(db, profile.id);
      expect(getProfile(db)).toBeNull();
    });
  });

  // -- Connections -----------------------------------------------------------

  describe('connections', () => {
    let profileA: CommunityProfile;
    let profileB: CommunityProfile;

    beforeEach(() => {
      // Create two profiles manually via SQL since createProfile enforces single-profile
      const nowA = new Date().toISOString();
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-AAAA', 'UserA', '\u{1F34E}', 1, 'connections', ?, ?)`,
        [nowA, nowA],
      );
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-BBBB', 'UserB', '\u{1F34C}', 1, 'connections', ?, ?)`,
        [nowA, nowA],
      );
      profileA = getProfileById(db, 'NUTR-AAAA')!;
      profileB = getProfileById(db, 'NUTR-BBBB')!;
    });

    it('sends a connection request', () => {
      const conn = sendConnectionRequest(db, profileA.id, profileB.id);
      expect(conn.status).toBe('pending');
      expect(conn.fromProfileId).toBe(profileA.id);
    });

    it('rejects self-connection', () => {
      expect(() => sendConnectionRequest(db, profileA.id, profileA.id)).toThrow("That's your own code!");
    });

    it('rejects duplicate request', () => {
      sendConnectionRequest(db, profileA.id, profileB.id);
      expect(() => sendConnectionRequest(db, profileA.id, profileB.id)).toThrow('already pending');
    });

    it('accepts connection', () => {
      const conn = sendConnectionRequest(db, profileA.id, profileB.id);
      const accepted = acceptConnection(db, conn.id);
      expect(accepted.status).toBe('accepted');
    });

    it('declines connection', () => {
      const conn = sendConnectionRequest(db, profileA.id, profileB.id);
      declineConnection(db, conn.id);
      const pending = getPendingRequests(db, profileB.id);
      expect(pending).toHaveLength(0);
    });

    it('blocks connection', () => {
      sendConnectionRequest(db, profileA.id, profileB.id);
      blockConnection(db, profileB.id, profileA.id);
      expect(isBlocked(db, profileB.id, profileA.id)).toBe(true);
    });

    it('blocks prevent future requests', () => {
      blockConnection(db, profileB.id, profileA.id);
      expect(() => sendConnectionRequest(db, profileA.id, profileB.id)).toThrow('Unable to send request');
    });

    it('gets accepted connections', () => {
      const conn = sendConnectionRequest(db, profileA.id, profileB.id);
      acceptConnection(db, conn.id);
      const connections = getAcceptedConnections(db, profileA.id);
      expect(connections).toHaveLength(1);
      expect(connections[0].profile.displayName).toBe('UserB');
    });

    it('gets accepted profile IDs', () => {
      const conn = sendConnectionRequest(db, profileA.id, profileB.id);
      acceptConnection(db, conn.id);
      const ids = getAcceptedProfileIds(db, profileA.id);
      expect(ids).toContain(profileB.id);
    });
  });

  // -- Feed ------------------------------------------------------------------

  describe('feed', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, share_calories, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-AAAA', 'UserA', '\u{1F34E}', 1, 0, 'connections', ?, ?)`,
        [now, now],
      );
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, share_calories, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-BBBB', 'UserB', '\u{1F34C}', 1, 1, 'connections', ?, ?)`,
        [now, now],
      );
      // Connect them
      db.execute(
        `INSERT INTO nu_community_connections (id, from_profile_id, to_profile_id, status, created_at, updated_at)
         VALUES ('conn-1', 'NUTR-AAAA', 'NUTR-BBBB', 'accepted', ?, ?)`,
        [now, now],
      );
    });

    it('returns feed items from accepted connections', () => {
      createFeedItem(db, { profileId: 'NUTR-BBBB', activityType: 'streak', title: '7-day streak!' });
      const feed = getFeed(db, 'NUTR-AAAA');
      expect(feed).toHaveLength(1);
      expect(feed[0].title).toBe('7-day streak!');
      expect(feed[0].displayName).toBe('UserB');
    });

    it('respects sharing preferences', () => {
      // UserA has share_calories = 0
      createFeedItem(db, { profileId: 'NUTR-AAAA', activityType: 'goal_hit', title: 'Hit calorie goal' });
      const feed = getFeed(db, 'NUTR-BBBB');
      // goal_hit maps to shareCalories which is off for UserA
      expect(feed).toHaveLength(0);
    });

    it('always shows challenge-related items regardless of sharing', () => {
      createFeedItem(db, { profileId: 'NUTR-AAAA', activityType: 'challenge_joined', title: 'Joined challenge' });
      const feed = getFeed(db, 'NUTR-BBBB');
      expect(feed).toHaveLength(1);
    });

    it('returns own feed items', () => {
      createFeedItem(db, { profileId: 'NUTR-AAAA', activityType: 'streak', title: 'My streak' });
      const feed = getOwnFeed(db, 'NUTR-AAAA');
      expect(feed).toHaveLength(1);
    });

    it('returns items in reverse chronological order', () => {
      // Insert with explicit timestamps to guarantee ordering
      db.execute(
        `INSERT INTO nu_community_feed (id, profile_id, activity_type, title, visibility, created_at)
         VALUES ('f1', 'NUTR-BBBB', 'streak', 'First', 'connections', '2026-01-01T10:00:00Z')`,
      );
      db.execute(
        `INSERT INTO nu_community_feed (id, profile_id, activity_type, title, visibility, created_at)
         VALUES ('f2', 'NUTR-BBBB', 'streak', 'Second', 'connections', '2026-01-01T11:00:00Z')`,
      );
      const feed = getFeed(db, 'NUTR-AAAA');
      expect(feed[0].title).toBe('Second');
      expect(feed[1].title).toBe('First');
    });
  });

  // -- Challenges ------------------------------------------------------------

  describe('challenges', () => {
    beforeEach(() => {
      const now = new Date().toISOString();
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-AAAA', 'UserA', '\u{1F34E}', 1, 'connections', ?, ?)`,
        [now, now],
      );
      db.execute(
        `INSERT INTO nu_community_profiles (id, display_name, avatar_emoji, share_streaks, profile_visibility, created_at, updated_at)
         VALUES ('NUTR-BBBB', 'UserB', '\u{1F34C}', 1, 'connections', ?, ?)`,
        [now, now],
      );
    });

    it('creates challenge with valid input', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const challenge = createChallenge(db, 'NUTR-AAAA', {
        title: '7-Day Protein',
        challengeType: 'protein_target',
        targetValue: 150,
        targetUnit: 'g',
        startDate: today,
        endDate: nextWeek,
      });
      expect(challenge.title).toBe('7-Day Protein');
      expect(challenge.status).toBe('active');
    });

    it('rejects end date in the past', () => {
      expect(() => createChallenge(db, 'NUTR-AAAA', {
        title: 'Past',
        challengeType: 'streak',
        startDate: '2020-01-01',
        endDate: '2020-01-07',
      })).toThrow('past');
    });

    it('rejects start after end', () => {
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      expect(() => createChallenge(db, 'NUTR-AAAA', {
        title: 'Backwards',
        challengeType: 'streak',
        startDate: nextMonth,
        endDate: nextWeek,
      })).toThrow('after end');
    });

    it('joins challenge', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ch = createChallenge(db, 'NUTR-AAAA', {
        title: 'Join Test',
        challengeType: 'streak',
        startDate: today,
        endDate: nextWeek,
      });
      const member = joinChallenge(db, ch.id, 'NUTR-BBBB');
      expect(member.role).toBe('member');
      expect(member.currentValue).toBe(0);
    });

    it('rejects duplicate join', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ch = createChallenge(db, 'NUTR-AAAA', {
        title: 'Dup Test',
        challengeType: 'streak',
        startDate: today,
        endDate: nextWeek,
      });
      joinChallenge(db, ch.id, 'NUTR-BBBB');
      expect(() => joinChallenge(db, ch.id, 'NUTR-BBBB')).toThrow('Already a member');
    });

    it('rejects when max participants reached', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ch = createChallenge(db, 'NUTR-AAAA', {
        title: 'Full Test',
        challengeType: 'streak',
        startDate: today,
        endDate: nextWeek,
        maxParticipants: 1,
      });
      // Creator is already member (1/1)
      expect(() => joinChallenge(db, ch.id, 'NUTR-BBBB')).toThrow('full');
    });

    it('updates challenge progress', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ch = createChallenge(db, 'NUTR-AAAA', {
        title: 'Progress Test',
        challengeType: 'protein_target',
        targetValue: 150,
        startDate: today,
        endDate: nextWeek,
      });
      updateChallengeProgress(db, ch.id, 'NUTR-AAAA', 50);
      const member = getChallengeMember(db, ch.id, 'NUTR-AAAA');
      expect(member!.currentValue).toBe(50);
    });

    it('leaderboard sorted by current value desc', () => {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const ch = createChallenge(db, 'NUTR-AAAA', {
        title: 'Leaderboard Test',
        challengeType: 'protein_target',
        startDate: today,
        endDate: nextWeek,
      });
      joinChallenge(db, ch.id, 'NUTR-BBBB');
      updateChallengeProgress(db, ch.id, 'NUTR-BBBB', 100);
      updateChallengeProgress(db, ch.id, 'NUTR-AAAA', 50);
      const lb = getChallengeLeaderboard(db, ch.id);
      expect(lb[0].displayName).toBe('UserB');
      expect(lb[0].rank).toBe(1);
      expect(lb[1].displayName).toBe('UserA');
      expect(lb[1].rank).toBe(2);
    });
  });

  // -- Sharing ---------------------------------------------------------------

  describe('sharing', () => {
    it('streak is visible when shareStreaks is true', () => {
      const profile = { shareStreaks: true, shareGoals: false, shareCalories: false, shareMacros: false, shareWeight: false } as CommunityProfile;
      expect(isActivityVisible(profile, 'streak')).toBe(true);
    });

    it('goal_hit is hidden when shareCalories is false', () => {
      const profile = { shareStreaks: true, shareGoals: false, shareCalories: false, shareMacros: false, shareWeight: false } as CommunityProfile;
      expect(isActivityVisible(profile, 'goal_hit')).toBe(false);
    });

    it('challenge_joined is always visible', () => {
      const profile = { shareStreaks: false, shareGoals: false, shareCalories: false, shareMacros: false, shareWeight: false } as CommunityProfile;
      expect(isActivityVisible(profile, 'challenge_joined')).toBe(true);
    });
  });
});

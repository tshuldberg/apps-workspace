import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../definition';
import {
  createSpot,
  createSession,
  // Zones
  createZone,
  getZones,
  getZoneBySlug,
  getSpotsByZone,
  updateZoneSpotCount,
  // Profiles
  createSurfProfile,
  getSurfProfile,
  updateSurfProfile,
  incrementProfileStats,
  // Follows
  createFollow,
  deleteFollow,
  getFollowers,
  getFollowing,
  isFollowing,
  // Shared sessions
  createSharedSession,
  getSharedSessionsByUser,
  getSharedSessionsBySpot,
  getFeedForUser,
  deleteSharedSession,
  // Comments + likes
  createSessionComment,
  getSessionComments,
  deleteSessionComment,
  toggleSessionLike,
  getSessionLikes,
  // Crews
  createCrew,
  getCrew,
  getUserCrews,
  addCrewMember,
  removeCrewMember,
  getCrewMembers,
  deleteCrew,
} from '../db/crud';
import { buildFeed, buildProfileTimeline } from '../engine/feed';

describe('@mylife/surf -- V4 features (zones + social)', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    // Seed a zone + spot + session for reuse
    createZone(adapter, 'zone-ca', { name: 'California', slug: 'california', timezone: 'America/Los_Angeles' });
    createSpot(adapter, 'spot-ob', { name: 'Ocean Beach', region: 'san_francisco', breakType: 'beach' });
    // Link spot to zone
    adapter.execute('UPDATE sf_spots SET zone_id = ? WHERE id = ?', ['zone-ca', 'spot-ob']);
    createSession(adapter, 'sess-1', { spotId: 'spot-ob', sessionDate: '2026-03-20', durationMin: 90, rating: 4 });
  });

  afterEach(() => {
    closeDb();
  });

  // ── Zones ──

  describe('zones', () => {
    it('creates and lists zones', () => {
      createZone(adapter, 'zone-pnw', { name: 'Pacific Northwest', slug: 'pacific-nw', country: 'US', sortOrder: 1 });
      const zones = getZones(adapter);
      expect(zones.length).toBeGreaterThanOrEqual(2);
      expect(zones.find((z) => z.slug === 'pacific-nw')).toBeTruthy();
    });

    it('gets zone by slug', () => {
      const zone = getZoneBySlug(adapter, 'california');
      expect(zone).toBeDefined();
      expect(zone!.name).toBe('California');
    });

    it('queries spots by zone', () => {
      const spots = getSpotsByZone(adapter, 'zone-ca');
      expect(spots).toHaveLength(1);
      expect(spots[0]!.name).toBe('Ocean Beach');
    });

    it('updates zone spot count', () => {
      updateZoneSpotCount(adapter, 'zone-ca');
      const zone = getZoneBySlug(adapter, 'california');
      expect(zone!.spotCount).toBe(1);
    });
  });

  // ── Profiles ──

  describe('surf profiles', () => {
    it('creates and retrieves a profile', () => {
      createSurfProfile(adapter, 'prof-1', {
        userId: 'user-1',
        displayName: 'JohnSurf',
        bio: 'Dawn patrol every day',
        skillLevel: 'advanced',
      });
      const profile = getSurfProfile(adapter, 'user-1');
      expect(profile).toBeDefined();
      expect(profile!.displayName).toBe('JohnSurf');
      expect(profile!.skillLevel).toBe('advanced');
      expect(profile!.sessionCount).toBe(0);
    });

    it('updates profile fields', () => {
      createSurfProfile(adapter, 'prof-1', { userId: 'user-1', displayName: 'JohnSurf' });
      updateSurfProfile(adapter, 'user-1', { bio: 'Updated bio', boardQuiver: ['6\'2 shortboard', '9\'0 longboard'] });
      const profile = getSurfProfile(adapter, 'user-1');
      expect(profile!.bio).toBe('Updated bio');
      expect(profile!.boardQuiver).toEqual(['6\'2 shortboard', '9\'0 longboard']);
    });

    it('increments profile stats', () => {
      createSurfProfile(adapter, 'prof-1', { userId: 'user-1', displayName: 'JohnSurf' });
      incrementProfileStats(adapter, 'user-1', { sessions: 1, waves: 12, hours: 1.5 });
      const profile = getSurfProfile(adapter, 'user-1');
      expect(profile!.sessionCount).toBe(1);
      expect(profile!.totalWaves).toBe(12);
      expect(profile!.totalHours).toBe(1.5);
    });

    it('defaults to private profile', () => {
      createSurfProfile(adapter, 'prof-1', { userId: 'user-1', displayName: 'PrivateSurfer' });
      const profile = getSurfProfile(adapter, 'user-1');
      expect(profile!.isPublic).toBe(false);
    });
  });

  // ── Follows ──

  describe('follows', () => {
    it('creates and checks follow relationship', () => {
      expect(isFollowing(adapter, 'user-1', 'user-2')).toBe(false);
      createFollow(adapter, 'follow-1', 'user-1', 'user-2');
      expect(isFollowing(adapter, 'user-1', 'user-2')).toBe(true);
    });

    it('lists followers and following', () => {
      createFollow(adapter, 'follow-1', 'user-1', 'user-2');
      createFollow(adapter, 'follow-2', 'user-3', 'user-2');
      const followers = getFollowers(adapter, 'user-2');
      expect(followers).toHaveLength(2);
      const following = getFollowing(adapter, 'user-1');
      expect(following).toHaveLength(1);
    });

    it('deletes a follow', () => {
      createFollow(adapter, 'follow-1', 'user-1', 'user-2');
      deleteFollow(adapter, 'user-1', 'user-2');
      expect(isFollowing(adapter, 'user-1', 'user-2')).toBe(false);
    });
  });

  // ── Shared Sessions ──

  describe('shared sessions', () => {
    it('shares and retrieves a session', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
        caption: 'Epic morning session!',
        waveCount: 15,
        stokeLevel: 5,
        photoUrls: ['https://cdn.example.com/photo1.jpg'],
      });
      const sessions = getSharedSessionsByUser(adapter, 'user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.caption).toBe('Epic morning session!');
      expect(sessions[0]!.stokeLevel).toBe(5);
      expect(sessions[0]!.photoUrls).toEqual(['https://cdn.example.com/photo1.jpg']);
    });

    it('defaults shared sessions to private', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
      });
      const sessions = getSharedSessionsByUser(adapter, 'user-1');
      expect(sessions[0]!.isPublic).toBe(false);
    });

    it('lists shared sessions by spot', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
        isPublic: true,
      });
      const sessions = getSharedSessionsBySpot(adapter, 'spot-ob');
      expect(sessions).toHaveLength(1);
    });

    it('builds feed from followed users', () => {
      createFollow(adapter, 'follow-1', 'user-viewer', 'user-1');
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
        isPublic: true,
      });
      const feed = getFeedForUser(adapter, 'user-viewer');
      expect(feed).toHaveLength(1);
    });

    it('feed excludes non-followed users', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
      });
      const feed = getFeedForUser(adapter, 'user-stranger');
      expect(feed).toHaveLength(0);
    });

    it('deletes shared session', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
      });
      deleteSharedSession(adapter, 'share-1', 'user-1');
      expect(getSharedSessionsByUser(adapter, 'user-1')).toHaveLength(0);
    });
  });

  // ── Comments + Likes ──

  describe('comments and likes', () => {
    beforeEach(() => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
      });
    });

    it('creates and lists comments', () => {
      createSessionComment(adapter, 'comment-1', {
        sharedSessionId: 'share-1',
        userId: 'user-2',
        body: 'Looks fun!',
      });
      const comments = getSessionComments(adapter, 'share-1');
      expect(comments).toHaveLength(1);
      expect(comments[0]!.body).toBe('Looks fun!');
    });

    it('increments comments_count on shared session', () => {
      createSessionComment(adapter, 'comment-1', { sharedSessionId: 'share-1', userId: 'user-2', body: 'Nice!' });
      const sessions = getSharedSessionsByUser(adapter, 'user-1');
      expect(sessions[0]!.commentsCount).toBe(1);
    });

    it('deletes a comment and decrements count', () => {
      createSessionComment(adapter, 'comment-1', { sharedSessionId: 'share-1', userId: 'user-2', body: 'Cool' });
      deleteSessionComment(adapter, 'comment-1', 'share-1');
      const comments = getSessionComments(adapter, 'share-1');
      expect(comments).toHaveLength(0);
      const sessions = getSharedSessionsByUser(adapter, 'user-1');
      expect(sessions[0]!.commentsCount).toBe(0);
    });

    it('toggles like on and off', () => {
      const result1 = toggleSessionLike(adapter, 'like-1', 'share-1', 'user-2');
      expect(result1.liked).toBe(true);
      const likes = getSessionLikes(adapter, 'share-1');
      expect(likes).toHaveLength(1);

      const result2 = toggleSessionLike(adapter, 'like-2', 'share-1', 'user-2');
      expect(result2.liked).toBe(false);
      expect(getSessionLikes(adapter, 'share-1')).toHaveLength(0);
    });

    it('updates likes_count on shared session', () => {
      toggleSessionLike(adapter, 'like-1', 'share-1', 'user-2');
      const sessions = getSharedSessionsByUser(adapter, 'user-1');
      expect(sessions[0]!.likesCount).toBe(1);
    });
  });

  // ── Crews ──

  describe('crews', () => {
    it('creates a crew with creator as first member', () => {
      createCrew(adapter, 'crew-1', { name: 'Dawn Patrol', creatorId: 'user-1' });
      const crew = getCrew(adapter, 'crew-1');
      expect(crew).toBeDefined();
      expect(crew!.name).toBe('Dawn Patrol');
      const members = getCrewMembers(adapter, 'crew-1');
      expect(members).toHaveLength(1);
      expect(members[0]!.role).toBe('creator');
    });

    it('adds and removes crew members', () => {
      createCrew(adapter, 'crew-1', { name: 'Dawn Patrol', creatorId: 'user-1' });
      addCrewMember(adapter, 'cm-2', 'crew-1', 'user-2');
      const crew = getCrew(adapter, 'crew-1');
      expect(crew!.memberCount).toBe(2);

      removeCrewMember(adapter, 'crew-1', 'user-2');
      const updated = getCrew(adapter, 'crew-1');
      expect(updated!.memberCount).toBe(1);
    });

    it('lists crews for a user', () => {
      createCrew(adapter, 'crew-1', { name: 'Dawn Patrol', creatorId: 'user-1' });
      createCrew(adapter, 'crew-2', { name: 'Sunset Crew', creatorId: 'user-2' });
      addCrewMember(adapter, 'cm-user1', 'crew-2', 'user-1');
      const crews = getUserCrews(adapter, 'user-1');
      expect(crews).toHaveLength(2);
    });

    it('deletes a crew and cascades members', () => {
      createCrew(adapter, 'crew-1', { name: 'Dawn Patrol', creatorId: 'user-1' });
      addCrewMember(adapter, 'cm-2', 'crew-1', 'user-2');
      deleteCrew(adapter, 'crew-1');
      expect(getCrew(adapter, 'crew-1')).toBeUndefined();
      expect(getCrewMembers(adapter, 'crew-1')).toHaveLength(0);
    });
  });

  // ── Feed Engine ──

  describe('feed engine', () => {
    it('builds feed from followed users', () => {
      createFollow(adapter, 'f-1', 'viewer', 'user-1');
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
        caption: 'Great waves',
        isPublic: true,
      });
      const feed = buildFeed(adapter, 'viewer');
      expect(feed).toHaveLength(1);
      expect(feed[0]!.caption).toBe('Great waves');
    });

    it('builds empty feed for user with no follows', () => {
      const feed = buildFeed(adapter, 'loner');
      expect(feed).toHaveLength(0);
    });

    it('builds profile timeline', () => {
      createSharedSession(adapter, 'share-1', {
        sessionId: 'sess-1',
        userId: 'user-1',
        spotId: 'spot-ob',
      });
      const timeline = buildProfileTimeline(adapter, 'user-1');
      expect(timeline).toHaveLength(1);
    });
  });
});

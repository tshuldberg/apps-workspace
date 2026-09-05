/**
 * Community feed P4 liveness primitives (unit layer). Proves on real values:
 *  - the notify token is DERIVABLE by any descriptor-holder (deterministic +
 *    agreed across two holders of the same descriptor), and differs per
 *    community / per genesisNonce.
 *  - the notify ping round-trips, is opaque to a non-holder (wrong secret -> null),
 *    and carries NO message body (only {communityId, ts}).
 *  - normalizeFeedPollInterval: manual stays manual; numbers snap to the nearest
 *    allowed step; sub-minute is floored to 1m WITHOUT the dev flag and honored
 *    WITH it; junk -> manual.
 *  - shouldEmitMessageNotification(0) === false; (n>0) === true.
 *  - drainCommunityNotifyPings enqueues one pull per distinct valid ping, and
 *    fail-closed-drops a foreign ping.
 */

import { describe, it, expect } from 'vitest';
import {
  FEED_POLL_INTERVALS,
  FEED_POLL_PRODUCTION_FLOOR_MS,
  buildCommunityNotifyPing,
  deriveCommunityNotifyToken,
  drainCommunityNotifyPings,
  feedPollIntervalLabel,
  normalizeFeedPollInterval,
  readCommunityNotifyPing,
  shouldEmitMessageNotification,
} from '../protocol/community-notify';

// A genesisNonce-shaped secret (bytesToHex of randomBytes(16) = 32 hex chars).
const SECRET_A = 'ab'.repeat(16);
const SECRET_B = 'cd'.repeat(16);
const COMMUNITY_A = 'community-aaaa0000';
const COMMUNITY_B = 'community-bbbb1111';
const NOW = '2026-06-16T00:00:00.000Z';

describe('deriveCommunityNotifyToken', () => {
  it('is deterministic and shaped like a 64-hex mailbox token', () => {
    const a = deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A);
    const b = deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two descriptor-holders (same genesisNonce + id) derive the SAME token', () => {
    // Both a member and the zero-knowledge node hold the signed descriptor, so
    // both pass the descriptor genesisNonce as the community secret and agree.
    const memberToken = deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A);
    const nodeToken = deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A);
    expect(memberToken).toBe(nodeToken);
  });

  it('differs per community id and per genesisNonce', () => {
    expect(deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A))
      .not.toBe(deriveCommunityNotifyToken(SECRET_A, COMMUNITY_B));
    expect(deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A))
      .not.toBe(deriveCommunityNotifyToken(SECRET_B, COMMUNITY_A));
    // The token never embeds the community id (no leak to the relay).
    const token = deriveCommunityNotifyToken(SECRET_A, COMMUNITY_A);
    expect(token).not.toContain(COMMUNITY_A);
  });
});

describe('buildCommunityNotifyPing / readCommunityNotifyPing', () => {
  it('round-trips: a descriptor-holder reads {communityId, ts} back', () => {
    const ping = buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW);
    const read = readCommunityNotifyPing(SECRET_A, ping);
    expect(read).toEqual({ communityId: COMMUNITY_A, ts: NOW });
  });

  it('is opaque: a wrong community secret reads null (fail-closed)', () => {
    const ping = buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW);
    expect(readCommunityNotifyPing(SECRET_B, ping)).toBeNull();
  });

  it('fails closed on tampered bytes and on too-short bytes', () => {
    const ping = buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW);
    const tampered = new Uint8Array(ping);
    tampered[tampered.length - 1] ^= 0xff;
    expect(readCommunityNotifyPing(SECRET_A, tampered)).toBeNull();
    expect(readCommunityNotifyPing(SECRET_A, new Uint8Array(4))).toBeNull();
  });

  it('the ping carries NO message body: only id + ts, nothing else', () => {
    const ping = buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW);
    const read = readCommunityNotifyPing(SECRET_A, ping);
    expect(read).not.toBeNull();
    // The decoded shape is exactly {communityId, ts}. No body/message/payload key.
    expect(Object.keys(read!).sort()).toEqual(['communityId', 'ts']);
    // And the wire bytes never contain a plaintext community id or a body marker.
    const wire = new TextDecoder().decode(ping);
    expect(wire).not.toContain(COMMUNITY_A);
    expect(wire.toLowerCase()).not.toContain('body');
  });
});

describe('normalizeFeedPollInterval', () => {
  it('keeps manual as manual', () => {
    expect(normalizeFeedPollInterval('manual')).toBe('manual');
    expect(normalizeFeedPollInterval('MANUAL')).toBe('manual');
  });

  it('snaps a number to the nearest allowed step', () => {
    expect(normalizeFeedPollInterval(290_000)).toBe(300_000); // ~5m -> 5m
    expect(normalizeFeedPollInterval(610_000)).toBe(600_000); // ~10m -> 10m
    expect(normalizeFeedPollInterval(3_500_000)).toBe(3_600_000); // ~1h -> 1h
    // 13m is closer to 15m than 10m.
    expect(normalizeFeedPollInterval(13 * 60_000)).toBe(15 * 60_000);
  });

  it('floors a sub-minute value to the 1m production floor WITHOUT the dev flag', () => {
    expect(normalizeFeedPollInterval(5_000)).toBe(FEED_POLL_PRODUCTION_FLOOR_MS);
    expect(normalizeFeedPollInterval(59_999)).toBe(FEED_POLL_PRODUCTION_FLOOR_MS);
    expect(FEED_POLL_PRODUCTION_FLOOR_MS).toBe(60_000);
  });

  it('honors a sub-minute value WITH the dev flag (allowSubMinute)', () => {
    expect(normalizeFeedPollInterval(5_000, { allowSubMinute: true })).toBe(5_000);
    expect(normalizeFeedPollInterval(30_000, { allowSubMinute: true })).toBe(30_000);
  });

  it('maps junk / non-positive / NaN to manual', () => {
    expect(normalizeFeedPollInterval('nonsense')).toBe('manual');
    expect(normalizeFeedPollInterval(undefined)).toBe('manual');
    expect(normalizeFeedPollInterval(null)).toBe('manual');
    expect(normalizeFeedPollInterval(-1)).toBe('manual');
    expect(normalizeFeedPollInterval(0)).toBe('manual');
    expect(normalizeFeedPollInterval(Number.NaN)).toBe('manual');
    expect(normalizeFeedPollInterval({})).toBe('manual');
  });

  it('FEED_POLL_INTERVALS is ordered with manual first and labels present', () => {
    expect(FEED_POLL_INTERVALS[0]).toEqual({ value: 'manual', label: 'Manual' });
    expect(feedPollIntervalLabel('manual')).toBe('Manual');
    expect(feedPollIntervalLabel(60_000)).toBe('1m');
    expect(feedPollIntervalLabel(3_600_000)).toBe('1h');
  });
});

describe('shouldEmitMessageNotification', () => {
  it('is false at 0 and true for any positive applied count', () => {
    expect(shouldEmitMessageNotification(0)).toBe(false);
    expect(shouldEmitMessageNotification(-3)).toBe(false);
    expect(shouldEmitMessageNotification(1)).toBe(true);
    expect(shouldEmitMessageNotification(42)).toBe(true);
  });
});

describe('drainCommunityNotifyPings', () => {
  it('enqueues one pull per distinct valid ping; the ping delivers nothing', async () => {
    const pings = [
      buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW),
      buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, '2026-06-16T00:01:00.000Z'), // same community
    ];
    const enqueued: string[] = [];
    const result = await drainCommunityNotifyPings({
      communitySecret: SECRET_A,
      pings,
      enqueuePull: (id) => { enqueued.push(id); },
    });
    expect(result.read).toBe(2);
    expect(result.enqueued).toBe(1); // distinct community
    expect(result.communityIds).toEqual([COMMUNITY_A]);
    expect(enqueued).toEqual([COMMUNITY_A]);
  });

  it('fail-closed drops a foreign ping (wrong secret) and never enqueues it', async () => {
    const pings = [
      buildCommunityNotifyPing(SECRET_A, COMMUNITY_A, NOW),
      buildCommunityNotifyPing(SECRET_B, COMMUNITY_B, NOW), // foreign: not readable with SECRET_A
    ];
    const enqueued: string[] = [];
    const result = await drainCommunityNotifyPings({
      communitySecret: SECRET_A,
      pings,
      enqueuePull: (id) => { enqueued.push(id); },
    });
    expect(result.read).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(enqueued).toEqual([COMMUNITY_A]);
  });
});

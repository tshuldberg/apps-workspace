/**
 * Automatic community-history discovery + verify-then-commit import loop (Plan 43
 * WP-43D) tests, over injected fetch/verify/commit mocks. Proves the ORDER and
 * the all-or-nothing commit discipline the loop owns:
 *  - happy path: a valid sealed host resolves, verifies, pulls, and COMMITS.
 *  - any single verification failure aborts with NOTHING committed.
 *  - a pull failure commits nothing and moves to the next candidate; every host
 *    failing yields all_hosts_failed (manual fallback).
 *  - an expired host is rejected before any pull.
 *  - a non-https host is rejected before any pull (requireTls default).
 *  - no host announced -> manual fallback (no_host_announced).
 *  - a wrong-secret / cross-community sealed record is dropped (no_valid_host).
 *  - the verified-host cache is honored: a cached host skips the resolve round-trip,
 *    and a cached host that fails re-verify is evicted and the loop re-resolves.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runAutomaticHistorySync,
  type HistoryPullResult,
  type RunAutomaticHistorySyncInput,
} from '../community-history-sync';
import {
  HISTORY_HOST_SNAPSHOT_VERSION,
  sealCommunityHistoryHost,
  type HistoryHostRecord,
} from '../../protocol/community-history-host';
import { createCommunity, type SignedCommunityDescriptor } from '../../protocol/community';
import { generateDeviceIdentity } from '../../identity/device-identity';

const SECRET = 'ab'.repeat(16);
const NOW = '2026-07-11T00:00:00.000Z';
const LATER = '2026-07-12T00:00:00.000Z';
const EARLIER = '2026-07-10T00:00:00.000Z';

function descriptorFixture(): SignedCommunityDescriptor {
  return createCommunity(generateDeviceIdentity('Owner'), { name: 'C', now: EARLIER });
}

function record(descriptor: SignedCommunityDescriptor, over: Partial<HistoryHostRecord> = {}): HistoryHostRecord {
  return {
    communityId: descriptor.descriptor.communityId,
    hostUrl: 'https://seed.example',
    descriptorRevision: descriptor.descriptor.revision,
    snapshotVersion: HISTORY_HOST_SNAPSHOT_VERSION,
    maxObjectBytes: 8 * 1024 * 1024,
    expiresAt: LATER,
    ...over,
  };
}

const okPull: HistoryPullResult = {
  ok: true,
  channels: [{ channelId: 'general', events: [], newEvents: [] }],
};

/** Build a full input with sensible defaults + spies the test can inspect. */
function makeInput(
  descriptor: SignedCommunityDescriptor,
  over: Partial<RunAutomaticHistorySyncInput> = {},
): RunAutomaticHistorySyncInput & {
  commit: ReturnType<typeof vi.fn>;
  pullHost: ReturnType<typeof vi.fn>;
} {
  const base = {
    communitySecret: SECRET,
    descriptor,
    resolveHosts: async () => [sealCommunityHistoryHost(SECRET, record(descriptor))],
    pullHost: vi.fn(async (): Promise<HistoryPullResult> => okPull),
    commit: vi.fn(async () => {}),
    now: NOW,
  };
  return { ...base, ...over } as RunAutomaticHistorySyncInput & {
    commit: ReturnType<typeof vi.fn>;
    pullHost: ReturnType<typeof vi.fn>;
  };
}

describe('runAutomaticHistorySync happy path', () => {
  it('resolves, verifies, pulls, and COMMITS a valid host', async () => {
    const descriptor = descriptorFixture();
    const input = makeInput(descriptor);
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.hostUrl).toBe('https://seed.example');
    expect(result.fromCache).toBe(false);
    expect(input.pullHost).toHaveBeenCalledTimes(1);
    expect(input.commit).toHaveBeenCalledTimes(1);
  });
});

describe('all-or-nothing: a pull failure commits NOTHING', () => {
  it('a single failing pull aborts that host with no commit and falls back', async () => {
    const descriptor = descriptorFixture();
    const input = makeInput(descriptor, {
      pullHost: vi.fn(async (): Promise<HistoryPullResult> => ({ ok: false, reason: 'piece_hash_mismatch' })),
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('all_hosts_failed');
    expect(input.commit).not.toHaveBeenCalled();
  });

  it('tries the next candidate after a failure and commits the first that verifies', async () => {
    const descriptor = descriptorFixture();
    const bad = record(descriptor, { hostUrl: 'https://bad.example' });
    const good = record(descriptor, { hostUrl: 'https://good.example' });
    const pullHost = vi.fn(async ({ hostUrl }: { hostUrl: string }): Promise<HistoryPullResult> =>
      hostUrl === 'https://good.example' ? okPull : { ok: false, reason: 'auth_rejected' });
    const input = makeInput(descriptor, {
      resolveHosts: async () => [
        sealCommunityHistoryHost(SECRET, bad),
        sealCommunityHistoryHost(SECRET, good),
      ],
      pullHost,
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.hostUrl).toBe('https://good.example');
    expect(pullHost).toHaveBeenCalledTimes(2);
    expect(input.commit).toHaveBeenCalledTimes(1);
  });
});

describe('pre-pull gates reject before any network pull', () => {
  it('an expired host is rejected before pull (no_valid_host)', async () => {
    const descriptor = descriptorFixture();
    const expired = record(descriptor, { expiresAt: EARLIER });
    const input = makeInput(descriptor, {
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, expired)],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('no_valid_host');
    expect(input.pullHost).not.toHaveBeenCalled();
  });

  it('a non-https host is rejected before pull (requireTls default)', async () => {
    const descriptor = descriptorFixture();
    const plaintext = record(descriptor, { hostUrl: 'http://seed.example' });
    const input = makeInput(descriptor, {
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, plaintext)],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('no_valid_host');
    expect(input.pullHost).not.toHaveBeenCalled();
  });

  it('a cross-community sealed record is dropped (no_valid_host)', async () => {
    const descriptor = descriptorFixture();
    const foreign = record(descriptor, { communityId: 'community-other-9999' });
    const input = makeInput(descriptor, {
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, foreign)],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('no_valid_host');
    expect(input.pullHost).not.toHaveBeenCalled();
  });

  it('a record sealed under the WRONG secret cannot be opened (no_valid_host)', async () => {
    const descriptor = descriptorFixture();
    const wrongSecretSeal = sealCommunityHistoryHost('cd'.repeat(16), record(descriptor));
    const input = makeInput(descriptor, {
      resolveHosts: async () => [wrongSecretSeal],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('no_valid_host');
    expect(input.pullHost).not.toHaveBeenCalled();
  });
});

describe('THROWING injected wiring degrades, never rejects the pass', () => {
  it('a throwing pullHost is a failed candidate: next candidate still commits', async () => {
    const descriptor = descriptorFixture();
    const bad = record(descriptor, { hostUrl: 'https://throws.example' });
    const good = record(descriptor, { hostUrl: 'https://good.example' });
    const pullHost = vi.fn(async ({ hostUrl }: { hostUrl: string }): Promise<HistoryPullResult> => {
      if (hostUrl === 'https://throws.example') throw new Error('ECONNRESET');
      return okPull;
    });
    const input = makeInput(descriptor, {
      resolveHosts: async () => [
        sealCommunityHistoryHost(SECRET, bad),
        sealCommunityHistoryHost(SECRET, good),
      ],
      pullHost,
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.hostUrl).toBe('https://good.example');
    expect(input.commit).toHaveBeenCalledTimes(1);
  });

  it('every candidate throwing yields all_hosts_failed with nothing committed', async () => {
    const descriptor = descriptorFixture();
    const input = makeInput(descriptor, {
      pullHost: vi.fn(async (): Promise<HistoryPullResult> => { throw new Error('ETIMEDOUT'); }),
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('all_hosts_failed');
    expect(input.commit).not.toHaveBeenCalled();
  });

  it('a throwing resolveHosts degrades to resolve_failed (manual fallback)', async () => {
    const descriptor = descriptorFixture();
    const input = makeInput(descriptor, {
      resolveHosts: async () => { throw new Error('relay unreachable'); },
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('resolve_failed');
    expect(input.pullHost).not.toHaveBeenCalled();
    expect(input.commit).not.toHaveBeenCalled();
  });

  it('a throwing commit moves on without caching the host', async () => {
    const descriptor = descriptorFixture();
    const only = record(descriptor);
    const cacheHost = vi.fn();
    const input = makeInput(descriptor, {
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, only)],
      commit: vi.fn(async () => { throw new Error('db write failed'); }),
      cacheHost,
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('all_hosts_failed');
    expect(cacheHost).not.toHaveBeenCalled(); // never cached after a failed commit
  });

  it('a throwing cached-host pull evicts the cache and re-resolves', async () => {
    const descriptor = descriptorFixture();
    const cached = record(descriptor, { hostUrl: 'https://stale.example' });
    const fresh = record(descriptor, { hostUrl: 'https://fresh.example' });
    const cacheHost = vi.fn();
    const pullHost = vi.fn(async ({ hostUrl }: { hostUrl: string }): Promise<HistoryPullResult> => {
      if (hostUrl === 'https://stale.example') throw new Error('ECONNREFUSED');
      return okPull;
    });
    const input = makeInput(descriptor, {
      readCachedHost: () => cached,
      cacheHost,
      pullHost,
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, fresh)],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.hostUrl).toBe('https://fresh.example');
    expect(cacheHost).toHaveBeenNthCalledWith(1, null);
    expect(cacheHost).toHaveBeenNthCalledWith(2, fresh);
  });
});

describe('manual fallback when nothing announced', () => {
  it('no sealed records -> no_host_announced', async () => {
    const descriptor = descriptorFixture();
    const input = makeInput(descriptor, { resolveHosts: async () => [] });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('manual_fallback');
    if (result.outcome !== 'manual_fallback') return;
    expect(result.reason).toBe('no_host_announced');
    expect(input.pullHost).not.toHaveBeenCalled();
  });
});

describe('verified-host cache', () => {
  it('a cached host skips the resolve round-trip and commits (fromCache)', async () => {
    const descriptor = descriptorFixture();
    const cached = record(descriptor);
    const resolveHosts = vi.fn(async () => [] as string[]);
    const cacheHost = vi.fn();
    const input = makeInput(descriptor, {
      resolveHosts,
      readCachedHost: () => cached,
      cacheHost,
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.fromCache).toBe(true);
    expect(resolveHosts).not.toHaveBeenCalled(); // round-trip skipped
    expect(cacheHost).toHaveBeenCalledWith(cached);
    expect(input.commit).toHaveBeenCalledTimes(1);
  });

  it('a cached host that fails re-verify is EVICTED and the loop re-resolves', async () => {
    const descriptor = descriptorFixture();
    const cached = record(descriptor, { hostUrl: 'https://stale.example' });
    const fresh = record(descriptor, { hostUrl: 'https://fresh.example' });
    const cacheHost = vi.fn();
    const pullHost = vi.fn(async ({ hostUrl }: { hostUrl: string }): Promise<HistoryPullResult> =>
      hostUrl === 'https://fresh.example' ? okPull : { ok: false, reason: 'auth_rejected' });
    const input = makeInput(descriptor, {
      readCachedHost: () => cached,
      cacheHost,
      pullHost,
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, fresh)],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.hostUrl).toBe('https://fresh.example');
    expect(result.fromCache).toBe(false);
    // Evicted (null) after the cached pull failed, then re-cached with the fresh host.
    expect(cacheHost).toHaveBeenNthCalledWith(1, null);
    expect(cacheHost).toHaveBeenNthCalledWith(2, fresh);
  });

  it('an expired cached host is ignored (re-resolves without a wasted pull)', async () => {
    const descriptor = descriptorFixture();
    const expiredCached = record(descriptor, { expiresAt: EARLIER, hostUrl: 'https://old.example' });
    const pullHost = vi.fn(async (): Promise<HistoryPullResult> => okPull);
    const input = makeInput(descriptor, {
      readCachedHost: () => expiredCached,
      pullHost,
      resolveHosts: async () => [sealCommunityHistoryHost(SECRET, record(descriptor))],
    });
    const result = await runAutomaticHistorySync(input);

    expect(result.outcome).toBe('imported');
    if (result.outcome !== 'imported') return;
    expect(result.fromCache).toBe(false);
    // The expired cached host is never pulled; only the resolved fresh host is.
    expect(pullHost).toHaveBeenCalledTimes(1);
    expect(pullHost).toHaveBeenCalledWith(expect.objectContaining({ hostUrl: 'https://seed.example' }));
  });
});

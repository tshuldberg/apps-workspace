import { describe, expect, it, vi } from 'vitest';
import { CachedYearnRepository } from '../cachedYearnRepository';
import { MemoryYearnOfflineCache } from '../offlineCache';
import {
  YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  YEARN_INTRO_MESSAGE_KIND,
  type YearnIntroMessageCiphertext,
} from '../yearnIntroMessage';
import type { YearnDiscoverProfile, YearnMatch } from '../yearnRepository';

const profile: YearnDiscoverProfile = {
  id: '11111111-1111-1111-1111-111111111111',
  displayName: 'Iris',
  age: 28,
  pronouns: 'she/her',
  intention: 'Long-term, open to slow',
  relationshipStructure: 'Monogamous',
  photos: [{ symbol: 'book.closed.fill', tint_hex: '#E8856B', path: null }],
  prompts: [{ question: 'A letter', answer: 'A first paragraph.' }],
  interests: ['Poetry'],
  isVerified: true,
};

const otherProfile: YearnDiscoverProfile = {
  ...profile,
  id: '22222222-2222-2222-2222-222222222222',
  displayName: 'Mara',
};

const match: YearnMatch = {
  id: '33333333-3333-3333-3333-333333333333',
  matchedAt: '2026-05-31T12:00:00.000Z',
  isPending: false,
  profile,
};

const fixedNow = () => new Date('2026-05-31T12:00:00.000Z');
const fixedId = (type: string, targetId: string) => `${type}:${targetId}:fixed`;
const encryptedIntro: YearnIntroMessageCiphertext = {
  version: YEARN_INTRO_MESSAGE_ENVELOPE_VERSION,
  kind: YEARN_INTRO_MESSAGE_KIND,
  algorithm: 'xchacha20poly1305-double-ratchet',
  senderDeviceId: 'sender-device-1',
  recipientDeviceId: 'recipient-device-1',
  ciphertext: 'base64-ciphertext',
  nonce: 'base64-nonce',
};

describe('CachedYearnRepository', () => {
  it('stores successful deck reads in the offline cache', async () => {
    const remote = {
      fetchDeck: vi.fn().mockResolvedValue([profile]),
      fetchMatches: vi.fn(),
    };
    const cache = new MemoryYearnOfflineCache();
    const repository = new CachedYearnRepository(remote, cache, fixedNow, fixedId);

    await expect(repository.fetchDeck(12)).resolves.toEqual({
      data: [profile],
      source: 'remote',
      error: null,
    });
    await expect(cache.readDeck()).resolves.toEqual([profile]);
    expect(remote.fetchDeck).toHaveBeenCalledWith(12);
  });

  it('returns cached deck data when the remote deck read fails', async () => {
    const remote = {
      fetchDeck: vi.fn().mockRejectedValue(new Error('offline')),
      fetchMatches: vi.fn(),
    };
    const cache = new MemoryYearnOfflineCache();
    await cache.writeDeck([profile]);
    const repository = new CachedYearnRepository(remote, cache, fixedNow, fixedId);

    await expect(repository.fetchDeck()).resolves.toEqual({
      data: [profile],
      source: 'cache',
      error: 'offline',
    });
  });

  it('stores successful match reads in the offline cache', async () => {
    const remote = {
      fetchDeck: vi.fn(),
      fetchMatches: vi.fn().mockResolvedValue([match]),
    };
    const cache = new MemoryYearnOfflineCache();
    const repository = new CachedYearnRepository(remote, cache, fixedNow, fixedId);

    await expect(repository.fetchMatches()).resolves.toEqual({
      data: [match],
      source: 'remote',
      error: null,
    });
    await expect(cache.readMatches()).resolves.toEqual([match]);
  });

  it('queues optimistic likes and removes the profile from the cached deck', async () => {
    const remote = {
      fetchDeck: vi.fn(),
      fetchMatches: vi.fn(),
    };
    const cache = new MemoryYearnOfflineCache();
    await cache.writeDeck([profile, otherProfile]);
    const repository = new CachedYearnRepository(remote, cache, fixedNow, fixedId);

    await expect(repository.optimisticLike(profile.id, encryptedIntro))
      .resolves.toEqual([otherProfile]);
    await expect(cache.readPendingMutations()).resolves.toEqual([
      {
        id: `like:${profile.id}:fixed`,
        type: 'like',
        profileId: profile.id,
        introCiphertext: encryptedIntro,
        createdAt: '2026-05-31T12:00:00.000Z',
      },
    ]);
  });

  it('queues optimistic archive actions and removes the match from cache', async () => {
    const remote = {
      fetchDeck: vi.fn(),
      fetchMatches: vi.fn(),
    };
    const cache = new MemoryYearnOfflineCache();
    await cache.writeMatches([match]);
    const repository = new CachedYearnRepository(remote, cache, fixedNow, fixedId);

    await expect(repository.optimisticArchiveMatch(match.id)).resolves.toEqual([]);
    await expect(cache.readPendingMutations()).resolves.toEqual([
      {
        id: `archive_match:${match.id}:fixed`,
        type: 'archive_match',
        matchId: match.id,
        createdAt: '2026-05-31T12:00:00.000Z',
      },
    ]);
  });
});

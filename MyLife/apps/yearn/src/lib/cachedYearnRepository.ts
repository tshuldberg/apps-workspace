import type { YearnDiscoverProfile, YearnMatch, YearnRepository } from './yearnRepository';
import type { YearnIntroMessageCiphertext } from './yearnIntroMessage';
import type { YearnOfflineCache, YearnPendingMutation } from './offlineCache';

export type YearnCacheSource = 'remote' | 'cache';

export interface YearnCachedResult<Data> {
  data: Data;
  source: YearnCacheSource;
  error: string | null;
}

type YearnRemoteRepository = Pick<YearnRepository, 'fetchDeck' | 'fetchMatches'>;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function defaultMutationId(type: YearnPendingMutation['type'], targetId: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${type}:${targetId}:${Date.now()}:${randomPart}`;
}

export class CachedYearnRepository {
  constructor(
    private readonly remote: YearnRemoteRepository,
    private readonly cache: YearnOfflineCache,
    private readonly now: () => Date = () => new Date(),
    private readonly createMutationId = defaultMutationId,
  ) {}

  async fetchDeck(limit = 30): Promise<YearnCachedResult<YearnDiscoverProfile[]>> {
    try {
      const deck = await this.remote.fetchDeck(limit);
      await this.cache.writeDeck(deck);
      return { data: deck, source: 'remote', error: null };
    } catch (err) {
      const cachedDeck = await this.cache.readDeck();
      return { data: cachedDeck, source: 'cache', error: errorMessage(err) };
    }
  }

  async fetchMatches(): Promise<YearnCachedResult<YearnMatch[]>> {
    try {
      const matches = await this.remote.fetchMatches();
      await this.cache.writeMatches(matches);
      return { data: matches, source: 'remote', error: null };
    } catch (err) {
      const cachedMatches = await this.cache.readMatches();
      return { data: cachedMatches, source: 'cache', error: errorMessage(err) };
    }
  }

  async optimisticLike(
    profileId: string,
    introCiphertext: YearnIntroMessageCiphertext | null = null,
  ): Promise<YearnDiscoverProfile[]> {
    await this.cache.enqueueMutation({
      id: this.createMutationId('like', profileId),
      type: 'like',
      profileId,
      introCiphertext,
      createdAt: this.now().toISOString(),
    });
    await this.cache.removeDeckProfile(profileId);
    return this.cache.readDeck();
  }

  async optimisticPass(profileId: string): Promise<YearnDiscoverProfile[]> {
    await this.cache.enqueueMutation({
      id: this.createMutationId('pass', profileId),
      type: 'pass',
      profileId,
      createdAt: this.now().toISOString(),
    });
    await this.cache.removeDeckProfile(profileId);
    return this.cache.readDeck();
  }

  async optimisticArchiveMatch(matchId: string): Promise<YearnMatch[]> {
    await this.cache.enqueueMutation({
      id: this.createMutationId('archive_match', matchId),
      type: 'archive_match',
      matchId,
      createdAt: this.now().toISOString(),
    });
    await this.cache.removeMatch(matchId);
    return this.cache.readMatches();
  }
}

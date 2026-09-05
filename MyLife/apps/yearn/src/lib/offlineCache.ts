import type { YearnIntroMessageCiphertext } from './yearnIntroMessage';
import type { YearnDiscoverProfile, YearnMatch } from './yearnRepository';

export type YearnPendingMutation =
  | {
      id: string;
      type: 'like';
      profileId: string;
      introCiphertext: YearnIntroMessageCiphertext | null;
      createdAt: string;
    }
  | {
      id: string;
      type: 'pass';
      profileId: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'archive_match';
      matchId: string;
      createdAt: string;
    };

export interface YearnCacheSnapshot {
  deckCount: number;
  matchCount: number;
  pendingMutationCount: number;
}

export interface YearnOfflineCache {
  readDeck(): Promise<YearnDiscoverProfile[]>;
  writeDeck(profiles: YearnDiscoverProfile[]): Promise<void>;
  removeDeckProfile(profileId: string): Promise<void>;
  readMatches(): Promise<YearnMatch[]>;
  writeMatches(matches: YearnMatch[]): Promise<void>;
  removeMatch(matchId: string): Promise<void>;
  enqueueMutation(mutation: YearnPendingMutation): Promise<void>;
  readPendingMutations(): Promise<YearnPendingMutation[]>;
  clearPendingMutation(mutationId: string): Promise<void>;
}

function cloneJsonValue<T>(value: T): T {
  const structuredCloneFn = (
    globalThis as { structuredClone?: <Value>(input: Value) => Value }
  ).structuredClone;
  if (structuredCloneFn) return structuredCloneFn(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MemoryYearnOfflineCache implements YearnOfflineCache {
  private deck: YearnDiscoverProfile[] = [];
  private matches: YearnMatch[] = [];
  private pendingMutations = new Map<string, YearnPendingMutation>();

  async readDeck(): Promise<YearnDiscoverProfile[]> {
    return cloneJsonValue(this.deck);
  }

  async writeDeck(profiles: YearnDiscoverProfile[]): Promise<void> {
    this.deck = cloneJsonValue(profiles);
  }

  async removeDeckProfile(profileId: string): Promise<void> {
    this.deck = this.deck.filter((profile) => profile.id !== profileId);
  }

  async readMatches(): Promise<YearnMatch[]> {
    return cloneJsonValue(this.matches);
  }

  async writeMatches(matches: YearnMatch[]): Promise<void> {
    this.matches = cloneJsonValue(matches);
  }

  async removeMatch(matchId: string): Promise<void> {
    this.matches = this.matches.filter((match) => match.id !== matchId);
  }

  async enqueueMutation(mutation: YearnPendingMutation): Promise<void> {
    this.pendingMutations.set(mutation.id, cloneJsonValue(mutation));
  }

  async readPendingMutations(): Promise<YearnPendingMutation[]> {
    return Array.from(this.pendingMutations.values())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((mutation) => cloneJsonValue(mutation));
  }

  async clearPendingMutation(mutationId: string): Promise<void> {
    this.pendingMutations.delete(mutationId);
  }
}

export async function readYearnCacheSnapshot(
  cache: YearnOfflineCache,
): Promise<YearnCacheSnapshot> {
  const [deck, matches, pendingMutations] = await Promise.all([
    cache.readDeck(),
    cache.readMatches(),
    cache.readPendingMutations(),
  ]);
  return {
    deckCount: deck.length,
    matchCount: matches.length,
    pendingMutationCount: pendingMutations.length,
  };
}

import { YearnRepository } from '../lib/yearnRepository';
import {
  readYearnCacheSnapshot,
  type YearnOfflineCache,
} from '../lib/offlineCache';
import type { AnySupabaseClient } from '../lib/supabase';

export type YearnRepositoryHarnessStatus =
  | 'not_configured'
  | 'no_session'
  | 'passed'
  | 'failed';

export interface YearnRepositoryHarnessCheck {
  id:
    | 'session'
    | 'current_membership'
    | 'discover_profiles'
    | 'incoming_likes'
    | 'my_matches'
    | 'offline_deck_cache'
    | 'offline_match_cache'
    | 'pending_mutation_queue';
  label: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
}

export interface YearnRepositoryHarnessResult {
  status: YearnRepositoryHarnessStatus;
  checks: YearnRepositoryHarnessCheck[];
  ranAt: string;
}

interface YearnHarnessAuthClient {
  auth: {
    getSession: () => Promise<{
      data: { session: { user: { id: string } } | null };
      error: { message: string } | null;
    }>;
  };
}

export interface YearnRepositoryHarnessOptions {
  now?: () => Date;
  cache?: YearnOfflineCache | null;
}

function pass(
  id: YearnRepositoryHarnessCheck['id'],
  label: string,
  detail: string,
): YearnRepositoryHarnessCheck {
  return { id, label, status: 'pass', detail };
}

function fail(
  id: YearnRepositoryHarnessCheck['id'],
  label: string,
  detail: string,
): YearnRepositoryHarnessCheck {
  return { id, label, status: 'fail', detail };
}

function skip(
  id: YearnRepositoryHarnessCheck['id'],
  label: string,
  detail: string,
): YearnRepositoryHarnessCheck {
  return { id, label, status: 'skip', detail };
}

async function runCheck(
  id: YearnRepositoryHarnessCheck['id'],
  label: string,
  load: () => Promise<number | string | boolean | null>,
): Promise<YearnRepositoryHarnessCheck> {
  try {
    const value = await load();
    const detail = typeof value === 'number'
      ? `${value} rows`
      : value === null
        ? 'No row returned'
        : String(value);
    return pass(id, label, detail);
  } catch (err) {
    return fail(id, label, err instanceof Error ? err.message : String(err));
  }
}

function resolveOptions(
  optionsOrNow: YearnRepositoryHarnessOptions | (() => Date),
): Required<YearnRepositoryHarnessOptions> {
  if (typeof optionsOrNow === 'function') {
    return { now: optionsOrNow, cache: null };
  }
  return {
    now: optionsOrNow.now ?? (() => new Date()),
    cache: optionsOrNow.cache ?? null,
  };
}

async function runCacheChecks(
  cache: YearnOfflineCache | null,
): Promise<YearnRepositoryHarnessCheck[]> {
  if (!cache) return [];

  try {
    const snapshot = await readYearnCacheSnapshot(cache);
    return [
      pass('offline_deck_cache', 'offline deck cache', `${snapshot.deckCount} cached profiles`),
      pass('offline_match_cache', 'offline match cache', `${snapshot.matchCount} cached matches`),
      pass(
        'pending_mutation_queue',
        'pending mutation queue',
        `${snapshot.pendingMutationCount} queued mutations`,
      ),
    ];
  } catch (err) {
    return [
      fail(
        'offline_deck_cache',
        'offline deck cache',
        err instanceof Error ? err.message : String(err),
      ),
      skip('offline_match_cache', 'offline match cache', 'Skipped after cache failure.'),
      skip('pending_mutation_queue', 'pending mutation queue', 'Skipped after cache failure.'),
    ];
  }
}

export async function runYearnRepositoryHarness(
  client: (AnySupabaseClient & YearnHarnessAuthClient) | null,
  optionsOrNow: YearnRepositoryHarnessOptions | (() => Date) = {},
): Promise<YearnRepositoryHarnessResult> {
  const { now, cache } = resolveOptions(optionsOrNow);
  const ranAt = now().toISOString();
  const cacheChecks = await runCacheChecks(cache);

  if (!client) {
    return {
      status: 'not_configured',
      ranAt,
      checks: [
        skip('session', 'Supabase session', 'Yearn Supabase environment is not configured.'),
        skip('current_membership', 'current_membership', 'Skipped without Supabase.'),
        skip('discover_profiles', 'discover_profiles', 'Skipped without Supabase.'),
        skip('incoming_likes', 'incoming_likes', 'Skipped without Supabase.'),
        skip('my_matches', 'my_matches', 'Skipped without Supabase.'),
        ...cacheChecks,
      ],
    };
  }

  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) {
    return {
      status: 'failed',
      ranAt,
      checks: [
        fail('session', 'Supabase session', sessionResult.error.message),
        skip('current_membership', 'current_membership', 'Skipped after session failure.'),
        skip('discover_profiles', 'discover_profiles', 'Skipped after session failure.'),
        skip('incoming_likes', 'incoming_likes', 'Skipped after session failure.'),
        skip('my_matches', 'my_matches', 'Skipped after session failure.'),
        ...cacheChecks,
      ],
    };
  }

  const userId = sessionResult.data.session?.user.id ?? null;
  if (!userId) {
    return {
      status: 'no_session',
      ranAt,
      checks: [
        fail('session', 'Supabase session', 'No authenticated Yearn session is restored.'),
        skip('current_membership', 'current_membership', 'Requires authenticated user.'),
        skip('discover_profiles', 'discover_profiles', 'Requires authenticated user.'),
        skip('incoming_likes', 'incoming_likes', 'Requires authenticated user.'),
        skip('my_matches', 'my_matches', 'Requires authenticated user.'),
        ...cacheChecks,
      ],
    };
  }

  const repository = new YearnRepository(client);
  const checks: YearnRepositoryHarnessCheck[] = [
    pass('session', 'Supabase session', `Restored user ${userId}`),
    await runCheck('current_membership', 'current_membership', async () => {
      const membership = await repository.currentMembership();
      return membership ? `${membership.status}:${membership.isMember}` : null;
    }),
    await runCheck('discover_profiles', 'discover_profiles', async () => {
      const deck = await repository.fetchDeck(12);
      return deck.length;
    }),
    await runCheck('incoming_likes', 'incoming_likes', async () => {
      const likes = await repository.fetchIncomingLikes();
      return likes.length;
    }),
    await runCheck('my_matches', 'my_matches', async () => {
      const matches = await repository.fetchMatches();
      return matches.length;
    }),
    ...cacheChecks,
  ];

  return {
    status: checks.some((check) => check.status === 'fail') ? 'failed' : 'passed',
    ranAt,
    checks,
  };
}

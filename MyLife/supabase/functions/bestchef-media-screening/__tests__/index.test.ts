import { describe, expect, it, vi } from 'vitest';
import {
  handleMediaScreeningRequest,
  NEEDS_HUMAN_REVIEW_REASON,
  resolveMediaScreeningProviders,
  screenMediaQueueItem,
  type MediaQueueItem,
  type MediaScreeningDeps,
  type MediaScreeningProviders,
  type MediaScreeningStore,
} from '../index.ts';
import type {
  ChildSafetyHashMatchProvider,
  NsfwImageClassifierProvider,
} from '../../_shared/bestchef-moderation-providers.ts';

const NOW = '2026-07-11T12:00:00.000Z';
const SECRET = 'media-worker-secret';

function makeRequest(
  body: unknown = {},
  opts: { secret?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.secret !== null) {
    headers.set('X-BestChef-Worker-Secret', opts.secret ?? SECRET);
  }
  return new Request('http://localhost/functions/bestchef-media-screening', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function queueRow(overrides: Partial<MediaQueueItem> = {}): MediaQueueItem {
  return {
    id: 'queue-1',
    kind: 'media_asset',
    target_id: 'asset-1',
    profile_id: 'profile-1',
    status: 'queued',
    attempts: 0,
    failure_reason: null,
    metadata: { owner_kind: 'submission', media_kind: 'image' },
    ...overrides,
  };
}

function makeStore(batch: MediaQueueItem[]): MediaScreeningStore & {
  routed: Array<{ queue: MediaQueueItem; metadata: Record<string, unknown> }>;
  childSafetyHits: Array<{ queue: MediaQueueItem; matchRef: string | null; detectedAt: string }>;
} {
  const routed: Array<{ queue: MediaQueueItem; metadata: Record<string, unknown> }> = [];
  const childSafetyHits: Array<{ queue: MediaQueueItem; matchRef: string | null; detectedAt: string }> = [];
  return {
    routed,
    childSafetyHits,
    claimQueueBatch: vi.fn(async () => batch),
    routeToHumanReview: vi.fn(async (queue, metadata) => {
      routed.push({ queue, metadata });
    }),
    recordChildSafetyHit: vi.fn(async (input) => {
      childSafetyHits.push(input);
    }),
  };
}

function fakeChildSafetyProvider(
  verdict: 'hit' | 'no_match' | 'provider_unavailable',
  matchRef?: string,
): ChildSafetyHashMatchProvider {
  return {
    capability: {
      name: 'fake-child-safety',
      kind: 'child_safety_hash',
      description: 'test',
      supportedMediaKinds: ['image', 'video'],
      productionReady: false,
    },
    screen: vi.fn(async () => ({ verdict, matchRef })),
  };
}

function fakeNsfwProvider(verdict: 'flagged' | 'clear'): NsfwImageClassifierProvider {
  return {
    capability: {
      name: 'fake-nsfw',
      kind: 'nsfw_image',
      description: 'test',
      supportedMediaKinds: ['image', 'video'],
      productionReady: false,
    },
    screen: vi.fn(async () => ({ verdict, score: verdict === 'flagged' ? 0.9 : 0.01 })),
  };
}

function withProviders(
  deps: MediaScreeningDeps,
  providers: MediaScreeningProviders,
): MediaScreeningDeps {
  return { ...deps, providers };
}

function makeDeps(store: MediaScreeningStore, env: Record<string, string> = {}): MediaScreeningDeps {
  return {
    env: (key: string) => ({ BESTCHEF_MEDIA_SCREENING_WORKER_SECRET: SECRET, ...env })[key],
    now: () => NOW,
    store,
  };
}

describe('bestchef-media-screening auth', () => {
  it('rejects a missing worker secret with 401', async () => {
    const store = makeStore([]);
    const res = await handleMediaScreeningRequest(makeRequest({}, { secret: null }), makeDeps(store));
    expect(res.status).toBe(401);
    expect(store.claimQueueBatch).not.toHaveBeenCalled();
  });

  it('503s when the worker secret is not configured', async () => {
    const store = makeStore([]);
    const deps: MediaScreeningDeps = { env: () => undefined, now: () => NOW, store };
    const res = await handleMediaScreeningRequest(makeRequest(), deps);
    expect(res.status).toBe(503);
  });

  it('rejects non-POST methods', async () => {
    const store = makeStore([]);
    const res = await handleMediaScreeningRequest(makeRequest({}, { method: 'GET' }), makeDeps(store));
    expect(res.status).toBe(405);
  });
});

describe('bestchef-media-screening fail-closed routing', () => {
  it('routes every claimed media row to human review and NEVER auto-approves', async () => {
    const batch = [queueRow({ id: 'q1', target_id: 'a1' }), queueRow({ id: 'q2', target_id: 'a2' })];
    const store = makeStore(batch);
    const res = await handleMediaScreeningRequest(makeRequest({ limit: 10 }), makeDeps(store));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.claimed).toBe(2);
    expect(json.routedToHumanReview).toBe(2);
    expect(json.autoApproved).toBe(0);
    expect(json.screeningStatus).toBe(NEEDS_HUMAN_REVIEW_REASON);
    expect(store.routed).toHaveLength(2);
    for (const { metadata } of store.routed) {
      expect(metadata.screening_status).toBe(NEEDS_HUMAN_REVIEW_REASON);
      expect(metadata.classifier).toBe('none_configured');
      // There must be no field that could read as an approval.
      expect(metadata.decision).toBeUndefined();
      expect(JSON.stringify(metadata)).not.toContain('approved');
      expect(JSON.stringify(metadata)).not.toContain('"safe"');
    }
  });

  it('screenMediaQueueItem preserves existing metadata and stamps review fields', async () => {
    const store = makeStore([]);
    await screenMediaQueueItem(
      queueRow({ metadata: { owner_kind: 'comment', owner_id: 'c1', media_kind: 'image' } }),
      makeDeps(store),
    );
    expect(store.routed).toHaveLength(1);
    const { metadata } = store.routed[0]!;
    expect(metadata.owner_kind).toBe('comment');
    expect(metadata.worker).toBe('bestchef-media-screening');
    expect(metadata.routed_to_human_at).toBe(NOW);
  });

  it('skips non-media_asset rows defensively', async () => {
    const batch = [queueRow({ kind: 'vote_proof' as MediaQueueItem['kind'] })];
    const store = makeStore(batch);
    const res = await handleMediaScreeningRequest(makeRequest(), makeDeps(store));
    const json = await res.json();
    expect(json.routedToHumanReview).toBe(0);
    expect(store.routeToHumanReview).not.toHaveBeenCalled();
  });
});

describe('bestchef-media-screening provider dispatch skeleton (test-injected providers)', () => {
  it('dispatches to a configured child-safety provider and records a hit, still routing to human review', async () => {
    const store = makeStore([]);
    const provider = fakeChildSafetyProvider('hit', 'hash-ref-1');
    await screenMediaQueueItem(
      queueRow({ target_id: 'asset-9' }),
      withProviders(makeDeps(store), { nsfw: null, childSafety: provider }),
    );

    // The asset was blocked + reported via the seam, then routed to human review.
    expect(store.childSafetyHits).toHaveLength(1);
    expect(store.childSafetyHits[0]!.matchRef).toBe('hash-ref-1');
    expect(store.routed).toHaveLength(1);
    const { metadata } = store.routed[0]!;
    expect(metadata.classifier).toBe('fake-child-safety');
    // Never an approval, even on the provider path.
    expect(JSON.stringify(metadata)).not.toContain('approved');
    expect(metadata.screening_status).toBe(NEEDS_HUMAN_REVIEW_REASON);
  });

  it('does NOT record a hit when the child-safety provider returns no_match, and still routes to review', async () => {
    const store = makeStore([]);
    const provider = fakeChildSafetyProvider('no_match');
    await screenMediaQueueItem(
      queueRow(),
      withProviders(makeDeps(store), { nsfw: null, childSafety: provider }),
    );
    expect(store.childSafetyHits).toHaveLength(0);
    expect(store.routed).toHaveLength(1);
  });

  it('dispatches to a configured NSFW provider and never auto-approves', async () => {
    const store = makeStore([]);
    const provider = fakeNsfwProvider('flagged');
    await screenMediaQueueItem(
      queueRow(),
      withProviders(makeDeps(store), { nsfw: provider, childSafety: null }),
    );
    expect(provider.screen).toHaveBeenCalledTimes(1);
    expect(store.routed).toHaveLength(1);
    expect(JSON.stringify(store.routed[0]!.metadata)).not.toContain('approved');
  });

  it('resolveMediaScreeningProviders fails closed to null when nothing configured', () => {
    expect(resolveMediaScreeningProviders(() => undefined)).toBeNull();
  });

  it('resolveMediaScreeningProviders refuses stubs in production (config error)', () => {
    expect(() =>
      resolveMediaScreeningProviders((key) => ({
        BESTCHEF_MODERATION_TEST_STUBS: '1',
        NODE_ENV: 'production',
      })[key]),
    ).toThrow(/non-production/i);
  });
});

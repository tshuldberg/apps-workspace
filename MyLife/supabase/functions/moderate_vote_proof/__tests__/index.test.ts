import { describe, expect, it, vi } from 'vitest';
import {
  createStubVoteProofModerationProviders,
  handleModerateVoteProofRequest,
  NEEDS_HUMAN_REVIEW_REASON,
  resolveVoteProofProviders,
  type ApplyVoteProofDecisionResult,
  type ClassifierResult,
  type FaceBlurResult,
  type ModerationQueueItem,
  type VoteProofForModeration,
  type VoteProofModerationDeps,
  type VoteProofModerationProviders,
  type VoteProofModerationStore,
} from '../index.ts';

const NOW = '2026-04-27T12:00:00.000Z';
const SECRET = 'worker-secret';

function makeRequest(
  body: unknown = {},
  opts: { secret?: string | null; method?: string } = {},
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (opts.secret !== null) {
    headers.set('X-BestChef-Worker-Secret', opts.secret ?? SECRET);
  }
  return new Request('http://localhost/functions/moderate_vote_proof', {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function queueRow(overrides: Partial<ModerationQueueItem> = {}): ModerationQueueItem {
  return {
    id: 'queue-1',
    kind: 'vote_proof',
    target_id: 'proof-1',
    profile_id: 'profile-1',
    status: 'queued',
    attempts: 0,
    failure_reason: null,
    metadata: {},
    ...overrides,
  };
}

function proofRow(overrides: Partial<VoteProofForModeration> = {}): VoteProofForModeration {
  return {
    id: 'proof-1',
    vote_id: 'vote-1',
    submission_id: 'submission-1',
    profile_id: 'profile-1',
    media_asset_id: 'asset-1',
    status: 'pending',
    mediaAsset: {
      id: 'asset-1',
      owner_profile_id: 'profile-1',
      owner_kind: 'vote_proof',
      owner_id: 'submission-1',
      media_kind: 'image',
      storage_bucket: 'bestchef-submission-images',
      storage_key: 'user-1/vote_proof/submission-1/upload-1.jpg',
      remote_url: null,
      upload_status: 'uploaded',
      moderation_status: 'pending',
      visibility: 'private',
      metadata: {},
    },
    ...overrides,
  };
}

class FakeVoteProofStore implements VoteProofModerationStore {
  queue: ModerationQueueItem | null = queueRow();
  proof: VoteProofForModeration | null = proofRow();
  imageUrl: string | null = 'https://storage.example/signed-proof.jpg';
  processing: Array<Record<string, unknown>> = [];
  failed: Array<{ reason: string; metadata: Record<string, unknown> }> = [];
  faceBlurred: FaceBlurResult[] = [];
  decisions: Array<{ proofId: string; decision: string; reason: string | null }> = [];
  humanReview: Array<Record<string, unknown>> = [];
  decisionError: string | null = null;

  async getQueueItem(input: { queueId: string | null; proofId: string | null }): Promise<ModerationQueueItem | null> {
    if (!this.queue) return null;
    if (input.queueId && input.queueId !== this.queue.id) return null;
    if (input.proofId && input.proofId !== this.queue.target_id) return null;
    return this.queue;
  }

  async markQueueProcessing(_queue: ModerationQueueItem, metadata: Record<string, unknown>): Promise<void> {
    this.processing.push(metadata);
  }

  async markQueueFailed(
    _queue: ModerationQueueItem,
    reason: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.failed.push({ reason, metadata });
  }

  async getProof(proofId: string): Promise<VoteProofForModeration | null> {
    return this.proof?.id === proofId ? this.proof : null;
  }

  async routeToHumanReview(
    _queue: ModerationQueueItem,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    this.humanReview.push(metadata);
  }

  async getModerationImageUrl(): Promise<string | null> {
    return this.imageUrl;
  }

  async recordFaceBlur(
    _asset: VoteProofForModeration['mediaAsset'],
    result: FaceBlurResult,
  ): Promise<void> {
    this.faceBlurred.push(result);
  }

  async applyDecision(input: {
    proofId: string;
    decision: 'approved' | 'rejected';
    reason: string | null;
  }): Promise<ApplyVoteProofDecisionResult> {
    this.decisions.push(input);
    return {
      proof_id: input.proofId,
      vote_id: 'vote-1',
      proof_status: input.decision,
      vote_status: input.decision === 'approved' ? 'active' : 'proof_rejected',
      error_code: this.decisionError,
    };
  }
}

function classifier(score: number, label: string, available = true): ClassifierResult {
  return {
    provider: `test-${label}`,
    source: 'unit-test',
    score,
    label,
    available,
    reason: available ? undefined : `${label}_unavailable`,
  };
}

function makeProviders(overrides: {
  nsfw?: ClassifierResult;
  food?: ClassifierResult;
  faceBlur?: FaceBlurResult | null;
} = {}): VoteProofModerationProviders {
  return {
    nsfw: { classify: vi.fn(async () => overrides.nsfw ?? classifier(0.01, 'safe')) },
    food: { classify: vi.fn(async () => overrides.food ?? classifier(0.9, 'food')) },
    faceBlur: overrides.faceBlur === null
      ? undefined
      : { blur: vi.fn(async (): Promise<FaceBlurResult> => overrides.faceBlur ?? {
          provider: 'test-face-blur',
          source: 'unit-test',
          status: 'not_needed',
          faceDetected: false,
        }) },
  };
}

function makeDeps(
  store = new FakeVoteProofStore(),
  providers: VoteProofModerationProviders | null = makeProviders(),
  env: Record<string, string | undefined> = {},
): VoteProofModerationDeps {
  return {
    env: (key: string) => ({ BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET: SECRET, ...env })[key],
    now: () => NOW,
    store,
    providers,
  };
}

describe('moderate_vote_proof worker', () => {
  it('rejects requests when the worker secret is not configured', async () => {
    const res = await handleModerateVoteProofRequest(
      makeRequest({}, { secret: SECRET }),
      {
        env: () => undefined,
        now: () => NOW,
        store: new FakeVoteProofStore(),
        providers: makeProviders(),
      },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, error: { kind: 'config' } });
  });

  it('rejects calls without the private worker secret', async () => {
    const res = await handleModerateVoteProofRequest(
      makeRequest({}, { secret: null }),
      makeDeps(),
    );

    expect(res.status).toBe(401);
  });

  it('fails closed: with no configured provider, routes to human review and never approves', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ queueId: 'queue-1' }),
      makeDeps(store, null),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      routedToHumanReview: true,
      screeningStatus: NEEDS_HUMAN_REVIEW_REASON,
      classifier: 'none_configured',
      autoApproved: 0,
      proofStatus: 'pending',
    });
    // Never decided: the vote stays inactive, media unpublished.
    expect(store.decisions).toEqual([]);
    expect(store.humanReview).toHaveLength(1);
    const review = store.humanReview[0]!;
    expect(review.screening_status).toBe(NEEDS_HUMAN_REVIEW_REASON);
    expect(JSON.stringify(review)).not.toContain('approved');
  });

  it('resolveVoteProofProviders returns null (fail closed) when nothing is configured', () => {
    expect(resolveVoteProofProviders(() => undefined)).toBeNull();
  });

  it('resolveVoteProofProviders wires stubs only under the env-gated non-production path', () => {
    const providers = resolveVoteProofProviders((key) => ({
      BESTCHEF_MODERATION_TEST_STUBS: '1',
      NODE_ENV: 'test',
    })[key]);
    expect(providers).not.toBeNull();
  });

  it('resolveVoteProofProviders refuses stubs in production (config error, fail closed)', () => {
    expect(() =>
      resolveVoteProofProviders((key) => ({
        BESTCHEF_MODERATION_TEST_STUBS: '1',
        NODE_ENV: 'production',
      })[key]),
    ).toThrow(/non-production/i);
  });

  it('approves a safe food proof and records the decision through the RPC store', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ queueId: 'queue-1' }),
      makeDeps(store),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      queueId: 'queue-1',
      proofId: 'proof-1',
      decision: 'approved',
      voteStatus: 'active',
      recompute: { helper: 'bc_rebuild_rankings(p_dish_id uuid default null)' },
    });
    expect(store.decisions).toEqual([{ proofId: 'proof-1', decision: 'approved', reason: null }]);
    expect(store.processing.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects proofs above the NSFW threshold', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ proofId: 'proof-1' }),
      makeDeps(store, makeProviders({ nsfw: classifier(0.94, 'nsfw') })),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, decision: 'rejected', voteStatus: 'proof_rejected' });
    expect(store.decisions[0]).toMatchObject({ decision: 'rejected', reason: 'nsfw_score_0.94' });
  });

  it('rejects proofs below the food-likeness threshold', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ proofId: 'proof-1' }),
      makeDeps(store, makeProviders({ food: classifier(0.22, 'not_food') })),
    );

    expect(res.status).toBe(200);
    expect(store.decisions[0]).toMatchObject({ decision: 'rejected', reason: 'food_likeness_0.22' });
  });

  it('leaves the proof pending when a classifier is unavailable', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ proofId: 'proof-1' }),
      makeDeps(store, makeProviders({ food: classifier(Number.NaN, 'food', false) })),
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toMatchObject({
      ok: false,
      error: { kind: 'provider_outage' },
      proofStatus: 'pending',
    });
    expect(store.decisions).toEqual([]);
    expect(store.failed[0]).toMatchObject({ reason: 'food_unavailable' });
  });

  it('records face blur metadata when the face-blur provider transforms the image', async () => {
    const store = new FakeVoteProofStore();
    const res = await handleModerateVoteProofRequest(
      makeRequest({ proofId: 'proof-1' }),
      makeDeps(store, makeProviders({
        faceBlur: {
          provider: 'test-face-blur',
          source: 'unit-test',
          status: 'blurred',
          faceDetected: true,
          reason: 'face_detected',
        },
      })),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ faceBlur: { status: 'blurred', faceDetected: true } });
    expect(store.faceBlurred).toHaveLength(1);
  });

  it('does not auto-approve when the decision RPC returns an error code', async () => {
    const store = new FakeVoteProofStore();
    store.decisionError = 'not_authorized';

    const res = await handleModerateVoteProofRequest(
      makeRequest({ proofId: 'proof-1' }),
      makeDeps(store),
    );

    expect(res.status).toBe(409);
    expect(store.failed[0]).toMatchObject({ reason: 'not_authorized' });
  });

  it('uses local stub providers with env-overridable scores', async () => {
    const providers = createStubVoteProofModerationProviders((key) => ({
      BESTCHEF_VOTE_PROOF_STUB_NSFW_SCORE: '0.03',
      BESTCHEF_VOTE_PROOF_STUB_FOOD_SCORE: '0.88',
      BESTCHEF_VOTE_PROOF_STUB_FACE_DETECTED: '1',
    })[key]);

    await expect(providers.nsfw.classify({ proof: proofRow(), imageUrl: null }))
      .resolves.toMatchObject({ provider: 'stub-nsfw', score: 0.03 });
    await expect(providers.food.classify({ proof: proofRow(), imageUrl: null }))
      .resolves.toMatchObject({ provider: 'stub-food-likeness', score: 0.88 });
    await expect(providers.faceBlur?.blur({ proof: proofRow(), imageUrl: null }))
      .resolves.toMatchObject({ status: 'blurred', faceDetected: true });
  });
});

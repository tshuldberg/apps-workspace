/**
 * BestChef vote-proof moderation worker.
 *
 * This Edge Function is server-only. It is invoked by an operator, cron, or
 * queue worker with a private worker secret, evaluates one `vote_proof`
 * moderation queue item, and records the final decision through
 * `bc_apply_vote_proof_decision`.
 */

import {
  ModerationConfigError,
  resolveModerationProviders,
  type AssetRef,
  type ClassifierScreenResult,
  type NsfwImageClassifierProvider,
  type FoodImageClassifierProvider,
} from '../_shared/bestchef-moderation-providers.ts';
import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export type VoteProofDecision = 'approved' | 'rejected';
export type FaceBlurStatus = 'not_needed' | 'blurred' | 'recommended' | 'skipped';

export interface ModerationQueueItem {
  id: string;
  kind: 'vote_proof';
  target_id: string;
  profile_id: string | null;
  status: 'queued' | 'processing' | 'decided' | 'failed';
  attempts: number;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
}

export interface VoteProofMediaAsset {
  id: string;
  owner_profile_id: string;
  owner_kind: string;
  owner_id: string;
  media_kind: string;
  storage_bucket: string | null;
  storage_key: string | null;
  remote_url: string | null;
  upload_status: string;
  moderation_status: string;
  visibility: string;
  metadata: Record<string, unknown>;
}

export interface VoteProofForModeration {
  id: string;
  vote_id: string;
  submission_id: string;
  profile_id: string;
  media_asset_id: string;
  status: 'pending' | 'approved' | 'rejected';
  mediaAsset: VoteProofMediaAsset;
}

export interface ClassifierResult {
  provider: string;
  source: string;
  score: number;
  label: string;
  available: boolean;
  reason?: string;
}

export interface FaceBlurResult {
  provider: string;
  source: string;
  status: FaceBlurStatus;
  faceDetected: boolean;
  reason?: string;
}

export interface VoteProofClassifierInput {
  proof: VoteProofForModeration;
  imageUrl: string | null;
}

export interface VoteProofModerationProviders {
  nsfw: { classify(input: VoteProofClassifierInput): Promise<ClassifierResult> };
  food: { classify(input: VoteProofClassifierInput): Promise<ClassifierResult> };
  faceBlur?: { blur(input: VoteProofClassifierInput): Promise<FaceBlurResult> };
}

export interface ApplyVoteProofDecisionResult {
  proof_id: string;
  vote_id: string | null;
  proof_status: string | null;
  vote_status: string | null;
  error_code: string | null;
}

export interface VoteProofModerationStore {
  getQueueItem(input: { queueId: string | null; proofId: string | null }): Promise<ModerationQueueItem | null>;
  markQueueProcessing(queue: ModerationQueueItem, metadata: Record<string, unknown>): Promise<void>;
  markQueueFailed(queue: ModerationQueueItem, reason: string, metadata: Record<string, unknown>): Promise<void>;
  getProof(proofId: string): Promise<VoteProofForModeration | null>;
  /**
   * Fail-closed routing: mark the queue row for human review without deciding
   * the proof. The proof stays `pending`, the vote stays inactive, and the media
   * stays unpublished until a moderator acts. Mirrors the media-screening
   * worker's needs_human_review contract.
   */
  routeToHumanReview(
    queue: ModerationQueueItem,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  getModerationImageUrl(asset: VoteProofMediaAsset): Promise<string | null>;
  recordFaceBlur(asset: VoteProofMediaAsset, result: FaceBlurResult, now: string): Promise<void>;
  applyDecision(input: {
    proofId: string;
    decision: VoteProofDecision;
    reason: string | null;
  }): Promise<ApplyVoteProofDecisionResult>;
}

export interface VoteProofModerationDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: VoteProofModerationStore;
  /**
   * Configured classifier providers, or null when no provider is wired. Null is
   * the fail-closed default in production: the proof is routed to human review
   * instead of being auto-approved (audit C3). Populated only by the env-gated
   * test stubs or a future vendor adapter behind the provider seam.
   */
  providers: VoteProofModerationProviders | null;
}

interface WorkerBody {
  queueId?: string;
  queue_id?: string;
  proofId?: string;
  proof_id?: string;
}

interface DecisionPlan {
  decision: VoteProofDecision;
  reason: string | null;
  nsfw: ClassifierResult;
  food: ClassifierResult;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const NSFW_REJECT_THRESHOLD = 0.72;
const FOOD_APPROVE_THRESHOLD = 0.55;

/** Fail-closed routing reason shared with bestchef-media-screening. */
export const NEEDS_HUMAN_REVIEW_REASON = 'needs_human_review';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function jsonError(
  kind: string,
  message: string,
  status: number,
  params?: Record<string, unknown>,
): Response {
  // `kind` (+ `params`) is the machine contract; `message` stays ops detail
  // (plan 33 Phase 2.2).
  return jsonResponse(
    { ok: false, error: params ? { kind, message, params } : { kind, message } },
    status,
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberFromEnv(env: VoteProofModerationDeps['env'], key: string, fallback: number): number {
  const raw = env(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function expectedWorkerSecret(env: VoteProofModerationDeps['env']): string | null {
  return (
    stringOrNull(env('BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET')) ??
    stringOrNull(env('BESTCHEF_MODERATION_WORKER_SECRET'))
  );
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-BestChef-Worker-Secret'));
  if (explicit) return explicit;

  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

async function workerAuthorizationError(req: Request, env: VoteProofModerationDeps['env']): Promise<Response | null> {
  const expected = expectedWorkerSecret(env);
  if (!expected) {
    return jsonError(
      'config',
      'BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET is not configured.',
      503,
    );
  }

  if (!(await timingSafeEqual(suppliedWorkerSecret(req), expected))) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  return null;
}

async function readWorkerBody(req: Request): Promise<WorkerBody> {
  if (!req.body) return {};
  const text = await req.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as WorkerBody;
}

function providerOutage(result: ClassifierResult): boolean {
  return !result.available || !Number.isFinite(result.score);
}

function buildDecisionPlan(input: {
  nsfw: ClassifierResult;
  food: ClassifierResult;
  nsfwThreshold: number;
  foodThreshold: number;
}): DecisionPlan | { outage: string } {
  if (providerOutage(input.nsfw)) {
    return { outage: input.nsfw.reason ?? 'NSFW classifier unavailable.' };
  }
  if (providerOutage(input.food)) {
    return { outage: input.food.reason ?? 'Food-likeness classifier unavailable.' };
  }

  if (input.nsfw.score >= input.nsfwThreshold) {
    return {
      decision: 'rejected',
      reason: `nsfw_score_${input.nsfw.score.toFixed(2)}`,
      nsfw: input.nsfw,
      food: input.food,
    };
  }

  if (input.food.score < input.foodThreshold) {
    return {
      decision: 'rejected',
      reason: `food_likeness_${input.food.score.toFixed(2)}`,
      nsfw: input.nsfw,
      food: input.food,
    };
  }

  return {
    decision: 'approved',
    reason: null,
    nsfw: input.nsfw,
    food: input.food,
  };
}

function moderationMetadata(input: {
  proof: VoteProofForModeration;
  nsfw: ClassifierResult;
  food: ClassifierResult;
  faceBlur: FaceBlurResult | null;
  now: string;
}): Record<string, unknown> {
  return {
    worker: 'moderate_vote_proof',
    moderated_at: input.now,
    proof_id: input.proof.id,
    vote_id: input.proof.vote_id,
    submission_id: input.proof.submission_id,
    media_asset_id: input.proof.media_asset_id,
    nsfw: {
      provider: input.nsfw.provider,
      source: input.nsfw.source,
      score: input.nsfw.score,
      label: input.nsfw.label,
    },
    food: {
      provider: input.food.provider,
      source: input.food.source,
      score: input.food.score,
      label: input.food.label,
    },
    face_blur: input.faceBlur
      ? {
          provider: input.faceBlur.provider,
          source: input.faceBlur.source,
          status: input.faceBlur.status,
          face_detected: input.faceBlur.faceDetected,
          reason: input.faceBlur.reason ?? null,
        }
      : null,
    recompute: {
      mode: 'manual_helper_until_hosted_cron',
      helper: 'bc_rebuild_rankings(p_dish_id uuid default null)',
    },
  };
}

export async function moderateVoteProofQueueItem(
  queue: ModerationQueueItem,
  deps: VoteProofModerationDeps,
): Promise<Response> {
  if (queue.kind !== 'vote_proof') {
    return jsonError('invalid_input', 'Queue item must be kind vote_proof.', 400);
  }

  await deps.store.markQueueProcessing(queue, {
    ...objectRecord(queue.metadata),
    processing_started_at: deps.now(),
    worker: 'moderate_vote_proof',
  });

  const proof = await deps.store.getProof(queue.target_id);
  if (!proof) {
    await deps.store.markQueueFailed(queue, 'proof_not_found', {
      ...objectRecord(queue.metadata),
      failed_at: deps.now(),
      worker: 'moderate_vote_proof',
    });
    return jsonError('not_found', 'Vote proof was not found.', 404);
  }

  if (proof.status !== 'pending') {
    return jsonResponse({
      ok: true,
      skipped: true,
      queueId: queue.id,
      proofId: proof.id,
      proofStatus: proof.status,
    });
  }

  // FAIL-CLOSED DEFAULT (audit C3): with no configured classifier provider, this
  // worker NEVER approves. It routes the proof to human review, leaving the proof
  // pending, the vote inactive, and the media unpublished until a moderator acts.
  // Providers are non-null only via the env-gated test stubs or a future vendor
  // adapter behind the provider seam.
  if (!deps.providers) {
    const reviewMetadata = {
      ...objectRecord(queue.metadata),
      worker: 'moderate_vote_proof',
      screening_status: NEEDS_HUMAN_REVIEW_REASON,
      classifier: 'none_configured',
      proof_id: proof.id,
      vote_id: proof.vote_id,
      media_asset_id: proof.media_asset_id,
      routed_to_human_at: deps.now(),
    };
    await deps.store.routeToHumanReview(queue, reviewMetadata);
    return jsonResponse({
      ok: true,
      queueId: queue.id,
      proofId: proof.id,
      routedToHumanReview: true,
      screeningStatus: NEEDS_HUMAN_REVIEW_REASON,
      classifier: 'none_configured',
      // Explicit so callers cannot misread this as an approval.
      autoApproved: 0,
      proofStatus: 'pending',
    });
  }

  const imageUrl = await deps.store.getModerationImageUrl(proof.mediaAsset);
  const input: VoteProofClassifierInput = { proof, imageUrl };
  const nsfw = await deps.providers.nsfw.classify(input);
  const food = await deps.providers.food.classify(input);
  const plan = buildDecisionPlan({
    nsfw,
    food,
    nsfwThreshold: numberFromEnv(deps.env, 'BESTCHEF_VOTE_PROOF_NSFW_REJECT_THRESHOLD', NSFW_REJECT_THRESHOLD),
    foodThreshold: numberFromEnv(deps.env, 'BESTCHEF_VOTE_PROOF_FOOD_APPROVE_THRESHOLD', FOOD_APPROVE_THRESHOLD),
  });

  if ('outage' in plan) {
    await deps.store.markQueueFailed(queue, plan.outage, {
      ...objectRecord(queue.metadata),
      failed_at: deps.now(),
      worker: 'moderate_vote_proof',
      provider_outage: true,
    });
    return jsonResponse({
      ok: false,
      error: { kind: 'provider_outage', message: plan.outage },
      queueId: queue.id,
      proofId: proof.id,
      proofStatus: 'pending',
    }, 503);
  }

  const faceBlur = deps.providers.faceBlur
    ? await deps.providers.faceBlur.blur(input)
    : null;
  if (faceBlur && faceBlur.status !== 'skipped') {
    await deps.store.recordFaceBlur(proof.mediaAsset, faceBlur, deps.now());
  }

  const metadata = moderationMetadata({
    proof,
    nsfw: plan.nsfw,
    food: plan.food,
    faceBlur,
    now: deps.now(),
  });
  await deps.store.markQueueProcessing(queue, {
    ...objectRecord(queue.metadata),
    ...metadata,
  });

  const decision = await deps.store.applyDecision({
    proofId: proof.id,
    decision: plan.decision,
    reason: plan.reason,
  });
  if (decision.error_code) {
    await deps.store.markQueueFailed(queue, decision.error_code, {
      ...objectRecord(queue.metadata),
      ...metadata,
      failed_at: deps.now(),
      decision_error_code: decision.error_code,
    });
    return jsonError('decision_failed', decision.error_code, 409, {
      code: decision.error_code,
    });
  }

  return jsonResponse({
    ok: true,
    queueId: queue.id,
    proofId: proof.id,
    decision: plan.decision,
    reason: plan.reason,
    proofStatus: decision.proof_status,
    voteStatus: decision.vote_status,
    classifiers: {
      nsfw: { provider: plan.nsfw.provider, score: plan.nsfw.score, label: plan.nsfw.label },
      food: { provider: plan.food.provider, score: plan.food.score, label: plan.food.label },
    },
    faceBlur: faceBlur
      ? { status: faceBlur.status, faceDetected: faceBlur.faceDetected }
      : { status: 'skipped', faceDetected: false },
    recompute: {
      mode: 'manual_helper_until_hosted_cron',
      helper: 'bc_rebuild_rankings(p_dish_id uuid default null)',
    },
  });
}

export async function handleModerateVoteProofRequest(
  req: Request,
  deps: VoteProofModerationDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST for vote-proof moderation.', 405);
  }

  const authError = await workerAuthorizationError(req, deps.env);
  if (authError) return authError;

  let body: WorkerBody;
  try {
    body = await readWorkerBody(req);
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const queueId = stringOrNull(body.queueId ?? body.queue_id);
  const proofId = stringOrNull(body.proofId ?? body.proof_id);
  const queue = await deps.store.getQueueItem({ queueId, proofId });
  if (!queue) {
    return jsonError('not_found', 'No queued vote proof moderation item was found.', 404);
  }

  try {
    return await moderateVoteProofQueueItem(queue, deps);
  } catch (err) {
    captureError({ fn: 'moderate_vote_proof', op: 'moderateVoteProofQueueItem', extra: { queueId: queue.id } }, err);
    await deps.store.markQueueFailed(queue, errorMessage(err), {
      ...objectRecord(queue.metadata),
      failed_at: deps.now(),
      worker: 'moderate_vote_proof',
      last_error: errorMessage(err),
    });
    return jsonError('worker_failed', errorMessage(err), 500);
  }
}

function stubClassifierResult(env: VoteProofModerationDeps['env'], input: {
  provider: string;
  scoreKey: string;
  defaultScore: number;
  label: string;
}): ClassifierResult {
  return {
    provider: input.provider,
    source: 'local-stub',
    score: numberFromEnv(env, input.scoreKey, input.defaultScore),
    label: input.label,
    available: true,
  };
}

export function createStubVoteProofModerationProviders(
  env: VoteProofModerationDeps['env'],
): VoteProofModerationProviders {
  return {
    nsfw: {
      async classify() {
        return stubClassifierResult(env, {
          provider: 'stub-nsfw',
          scoreKey: 'BESTCHEF_VOTE_PROOF_STUB_NSFW_SCORE',
          defaultScore: 0.02,
          label: 'safe',
        });
      },
    },
    food: {
      async classify() {
        return stubClassifierResult(env, {
          provider: 'stub-food-likeness',
          scoreKey: 'BESTCHEF_VOTE_PROOF_STUB_FOOD_SCORE',
          defaultScore: 0.91,
          label: 'food',
        });
      },
    },
    faceBlur: {
      async blur() {
        const detected = env('BESTCHEF_VOTE_PROOF_STUB_FACE_DETECTED') === '1';
        return {
          provider: 'stub-face-blur',
          source: 'local-stub',
          status: detected ? 'blurred' : 'not_needed',
          faceDetected: detected,
          reason: detected ? 'stub_face_detected' : undefined,
        };
      },
    },
  };
}

function ensureServiceConfig(env: VoteProofModerationDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

function encodeObjectPath(key: string): string {
  return key
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

class SupabaseVoteProofModerationStore implements VoteProofModerationStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
    private readonly now: () => string,
  ) {}

  async getQueueItem(input: { queueId: string | null; proofId: string | null }): Promise<ModerationQueueItem | null> {
    let filter = 'kind=eq.vote_proof&status=in.(queued,failed)&order=created_at.asc&limit=1';
    if (input.queueId) {
      filter = `id=eq.${encodeURIComponent(input.queueId)}&kind=eq.vote_proof&limit=1`;
    } else if (input.proofId) {
      filter = `target_id=eq.${encodeURIComponent(input.proofId)}&kind=eq.vote_proof&limit=1`;
    }
    const rows = await this.restJson<ModerationQueueItem[]>(
      `/rest/v1/bc_moderation_queue?select=*&${filter}`,
    );
    return rows[0] ?? null;
  }

  async markQueueProcessing(queue: ModerationQueueItem, metadata: Record<string, unknown>): Promise<void> {
    await this.patchQueue(queue.id, {
      status: 'processing',
      attempts: queue.attempts + 1,
      failure_reason: null,
      metadata,
      updated_at: this.now(),
    });
  }

  async markQueueFailed(queue: ModerationQueueItem, reason: string, metadata: Record<string, unknown>): Promise<void> {
    await this.patchQueue(queue.id, {
      status: 'failed',
      failure_reason: reason,
      metadata,
      updated_at: this.now(),
    });
  }

  async getProof(proofId: string): Promise<VoteProofForModeration | null> {
    const proofs = await this.restJson<Array<Omit<VoteProofForModeration, 'mediaAsset'>>>(
      `/rest/v1/bc_vote_proofs?select=id,vote_id,submission_id,profile_id,media_asset_id,status&id=eq.${encodeURIComponent(proofId)}&limit=1`,
    );
    const proof = proofs[0];
    if (!proof) return null;

    const assets = await this.restJson<VoteProofMediaAsset[]>(
      `/rest/v1/bc_media_assets?select=id,owner_profile_id,owner_kind,owner_id,media_kind,storage_bucket,storage_key,remote_url,upload_status,moderation_status,visibility,metadata&id=eq.${encodeURIComponent(proof.media_asset_id)}&limit=1`,
    );
    const mediaAsset = assets[0];
    if (!mediaAsset) return null;

    return {
      ...proof,
      mediaAsset: {
        ...mediaAsset,
        metadata: objectRecord(mediaAsset.metadata),
      },
    };
  }

  async routeToHumanReview(queue: ModerationQueueItem, metadata: Record<string, unknown>): Promise<void> {
    // Status 'failed' + a needs_human_review reason keeps the row in the
    // console's open set WITHOUT marking it decided, mirroring the
    // bestchef-media-screening worker. The proof and its media are untouched:
    // the proof stays pending, the vote inactive, the media unpublished until a
    // human decides through bc_apply_vote_proof_decision.
    await this.patchQueue(queue.id, {
      status: 'failed',
      failure_reason: NEEDS_HUMAN_REVIEW_REASON,
      metadata,
      updated_at: this.now(),
    });
  }

  async getModerationImageUrl(asset: VoteProofMediaAsset): Promise<string | null> {
    if (asset.remote_url) return asset.remote_url;
    if (!asset.storage_bucket || !asset.storage_key) return null;
    const body = await this.restJson<Record<string, unknown>>(
      `/storage/v1/object/sign/${encodeURIComponent(asset.storage_bucket)}/${encodeObjectPath(asset.storage_key)}`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresIn: 300 }),
      },
    );
    return (
      stringOrNull(body.signedURL) ??
      stringOrNull(body.signedUrl) ??
      stringOrNull(body.url)
    );
  }

  async recordFaceBlur(asset: VoteProofMediaAsset, result: FaceBlurResult, now: string): Promise<void> {
    await this.restText(`/rest/v1/bc_media_assets?id=eq.${encodeURIComponent(asset.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        metadata: {
          ...objectRecord(asset.metadata),
          face_blur: {
            provider: result.provider,
            source: result.source,
            status: result.status,
            face_detected: result.faceDetected,
            reason: result.reason ?? null,
            updated_at: now,
          },
        },
        updated_at: now,
      }),
    }, [200, 204]);
  }

  async applyDecision(input: {
    proofId: string;
    decision: VoteProofDecision;
    reason: string | null;
  }): Promise<ApplyVoteProofDecisionResult> {
    const rows = await this.restJson<ApplyVoteProofDecisionResult[]>(
      '/rest/v1/rpc/bc_apply_vote_proof_decision',
      {
        method: 'POST',
        body: JSON.stringify({
          p_proof_id: input.proofId,
          p_decision: input.decision,
          p_reason: input.reason,
        }),
      },
    );
    const result = rows[0];
    if (!result) throw new Error('Decision RPC returned no rows.');
    return result;
  }

  private async patchQueue(queueId: string, body: Record<string, unknown>): Promise<void> {
    await this.restText(`/rest/v1/bc_moderation_queue?id=eq.${encodeURIComponent(queueId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    }, [200, 204]);
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const text = await this.restText(path, init, okStatuses);
    return text ? JSON.parse(text) as T : ([] as T);
  }

  private async restText(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201, 204],
  ): Promise<string> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.key,
        Authorization: `Bearer ${this.config.key}`,
        ...JSON_HEADERS,
        ...(init.headers ?? {}),
      },
    });

    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }

    return res.text();
  }
}

export function createSupabaseVoteProofModerationStore(
  env: VoteProofModerationDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): VoteProofModerationStore {
  return new SupabaseVoteProofModerationStore(ensureServiceConfig(env), fetchImpl, now);
}

/**
 * Resolve the vote-proof classifier providers for a production run.
 *
 * FAIL-CLOSED (audit C3): with no configured vendor and no env-gated test stubs,
 * this returns null and the worker routes proofs to human review instead of
 * approving. Test stubs are wired ONLY when BESTCHEF_MODERATION_TEST_STUBS=1 in a
 * non-production environment; the seam throws a ModerationConfigError for a
 * production deploy that requests stubs, or for an unknown provider name, so the
 * worker refuses to run rather than silently auto-approving.
 */
export function resolveVoteProofProviders(
  env: VoteProofModerationDeps['env'],
): VoteProofModerationProviders | null {
  const resolved = resolveModerationProviders(env);
  if (resolved.usingTestStubs) {
    // Non-production stub path only: reuse the always-safe local stubs behind the
    // env gate the seam already enforced.
    return createStubVoteProofModerationProviders(env);
  }
  if (!resolved.nsfw || !resolved.food) {
    // No configured NSFW/food classifier: fail closed, no provider set.
    return null;
  }
  // A configured vendor adapter would be bridged onto the vote-proof classifier
  // shape here. Unreachable until an adapter exists (founder item F3); the seam
  // throws before this point today.
  return bridgeVendorClassifiers(resolved.nsfw, resolved.food);
}

/**
 * Bridge a resolved vendor classifier pair onto the vote-proof classifier shape.
 * Each vendor `ClassifierScreenResult` maps to a `ClassifierResult`
 * (verdict 'provider_unavailable' -> available:false so buildDecisionPlan treats
 * it as an outage, never as "safe"). Unreachable until a vendor adapter exists
 * (founder item F3); the seam throws before this point today.
 */
function bridgeVendorClassifiers(
  nsfw: NsfwImageClassifierProvider,
  food: FoodImageClassifierProvider,
): VoteProofModerationProviders {
  const toClassifier = (
    provider: string,
    result: ClassifierScreenResult,
  ): ClassifierResult => {
    const available = result.verdict !== 'provider_unavailable';
    return {
      provider,
      source: 'vendor-seam',
      score: typeof result.score === 'number' ? result.score : Number.NaN,
      label: result.label ?? result.verdict,
      available,
      reason: available ? undefined : result.reason ?? 'provider_unavailable',
    };
  };
  const toAssetRef = (input: VoteProofClassifierInput): AssetRef => ({
    assetId: input.proof.media_asset_id,
    mediaKind: input.proof.mediaAsset.media_kind,
    ownerKind: input.proof.mediaAsset.owner_kind,
    ownerId: input.proof.mediaAsset.owner_id,
    ownerProfileId: input.proof.mediaAsset.owner_profile_id,
    storageBucket: input.proof.mediaAsset.storage_bucket,
    storageKey: input.proof.mediaAsset.storage_key,
    signedUrl: input.imageUrl,
  });
  return {
    nsfw: {
      async classify(input) {
        return toClassifier(nsfw.capability.name, await nsfw.screen(toAssetRef(input)));
      },
    },
    food: {
      async classify(input) {
        return toClassifier(food.capability.name, await food.screen(toAssetRef(input)));
      },
    },
  };
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    const now = () => new Date().toISOString();

    let store: VoteProofModerationStore;
    try {
      store = createSupabaseVoteProofModerationStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    let providers: VoteProofModerationProviders | null;
    try {
      providers = resolveVoteProofProviders(env);
    } catch (err) {
      // A stubs-in-production or unknown-provider config error is fatal: refuse
      // to run (loud, structured) rather than auto-approving anything.
      const detail =
        err instanceof ModerationConfigError
          ? { kind: 'moderation_config_error', detail: err.detail }
          : {};
      captureError(
        {
          fn: 'moderate_vote_proof',
          op: 'resolveVoteProofProviders',
          extra: { fatal: 'moderation_provider_config', ...detail },
        },
        err,
      );
      return jsonError('config', errorMessage(err), 503);
    }

    return handleModerateVoteProofRequest(req, { env, now, store, providers });
  });
}

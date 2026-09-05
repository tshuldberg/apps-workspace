/**
 * BestChef media-screening worker (audit finding C4).
 *
 * Drains `bc_moderation_queue` rows of kind='media_asset' for every owner kind
 * (submission, comment, post, avatar, ...) and BOTH media kinds (image, video).
 *
 * FAIL-CLOSED CORE RULE: this worker NEVER auto-approves. No classifier provider
 * is wired yet (a later task adds the provider seam). Its entire job today is to
 * claim queued media rows and route them to HUMAN review with structured
 * metadata, then surface them in the moderator console. Content stays non-public
 * (bc_media_assets.moderation_status='pending', private/unpromoted) until a human
 * approves it through bc_apply_moderation_decision. There is deliberately no code
 * path that returns "safe" or writes an approved decision.
 *
 * Structurally mirrors moderate_vote_proof: server-only, worker-secret gated,
 * deployed --no-verify-jwt (see scripts/deploy-functions.sh + config.toml).
 */

import {
  ModerationConfigError,
  resolveModerationProviders,
  type AssetRef,
  type ChildSafetyHashMatchProvider,
  type NsfwImageClassifierProvider,
} from '../_shared/bestchef-moderation-providers.ts';
import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export interface MediaQueueItem {
  id: string;
  kind: 'media_asset';
  target_id: string;
  profile_id: string | null;
  status: 'queued' | 'processing' | 'decided' | 'failed';
  attempts: number;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
}

/** The queue row is routed to human review; the worker records why. */
export const NEEDS_HUMAN_REVIEW_REASON = 'needs_human_review';

export interface MediaScreeningStore {
  claimQueueBatch(limit: number): Promise<MediaQueueItem[]>;
  routeToHumanReview(
    queue: MediaQueueItem,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  /**
   * Record a confirmed child-safety hash hit: block the asset and create the
   * pending_registration report row via bc_record_child_safety_hit. Present only
   * so a configured child-safety provider can dispatch through the seam; the
   * default (no provider) path never calls it.
   */
  recordChildSafetyHit?(input: {
    queue: MediaQueueItem;
    matchRef: string | null;
    detectedAt: string;
  }): Promise<void>;
}

/**
 * The classifier providers a media-screening run may use. Null (the default in
 * production today) means no provider is wired: the worker routes every claimed
 * row to human review. A configured child-safety provider blocks assets and
 * files reports on a hash hit; a configured NSFW provider flags for review. Even
 * with providers wired, this worker NEVER auto-approves: a non-hit / non-flag
 * result still routes to human review.
 */
export interface MediaScreeningProviders {
  nsfw: NsfwImageClassifierProvider | null;
  childSafety: ChildSafetyHashMatchProvider | null;
}

export interface MediaScreeningDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: MediaScreeningStore;
  /** Resolved providers, or null when nothing is configured (fail-closed default). */
  providers?: MediaScreeningProviders | null;
}

interface WorkerBody {
  limit?: number;
  batchSize?: number;
  batch_size?: number;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DEFAULT_BATCH = 25;
const MAX_BATCH = 100;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(kind: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { kind, message } }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function clampBatch(raw: unknown): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH;
  return Math.min(Math.floor(parsed), MAX_BATCH);
}

function expectedWorkerSecret(env: MediaScreeningDeps['env']): string | null {
  return (
    stringOrNull(env('BESTCHEF_MEDIA_SCREENING_WORKER_SECRET')) ??
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

async function workerAuthorizationError(req: Request, env: MediaScreeningDeps['env']): Promise<Response | null> {
  const expected = expectedWorkerSecret(env);
  if (!expected) {
    return jsonError('config', 'BESTCHEF_MEDIA_SCREENING_WORKER_SECRET is not configured.', 503);
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

function assetRefFromQueue(queue: MediaQueueItem): AssetRef {
  const meta = objectRecord(queue.metadata);
  const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;
  return {
    assetId: queue.target_id,
    mediaKind: asString(meta.media_kind) ?? 'unknown',
    ownerKind: asString(meta.owner_kind),
    ownerId: asString(meta.owner_id),
    ownerProfileId: queue.profile_id,
  };
}

/**
 * Screen a single queued media asset. Fail-closed at every branch:
 *
 *   - No provider configured (default today): route to human review, no approval.
 *   - Child-safety provider configured and returns a HIT: block the asset and
 *     file a pending_registration report via the store, then route to human
 *     review so a moderator confirms. NEVER approves.
 *   - Any other configured-provider outcome (no_match, flagged, clear,
 *     provider_unavailable): still route to human review. This worker has no
 *     auto-approve branch by design.
 *
 * The dispatch skeleton is exercised in tests via injected fake providers; there
 * is no vendor adapter yet, so production resolution yields null providers and
 * only the human-review path runs.
 */
export async function screenMediaQueueItem(
  queue: MediaQueueItem,
  deps: MediaScreeningDeps,
): Promise<void> {
  const meta = objectRecord(queue.metadata);
  const providers = deps.providers ?? null;

  let classifierRecord = 'none_configured';
  let childSafety: { verdict: string; matchRef?: string | null; reason?: string } | null = null;

  if (providers?.childSafety) {
    const asset = assetRefFromQueue(queue);
    const result = await providers.childSafety.screen(asset);
    childSafety = { verdict: result.verdict, matchRef: result.matchRef ?? null, reason: result.reason };
    classifierRecord = providers.childSafety.capability.name;
    if (result.verdict === 'hit' && deps.store.recordChildSafetyHit) {
      // Block the asset + file the pending_registration report via the seam RPC.
      await deps.store.recordChildSafetyHit({
        queue,
        matchRef: result.matchRef ?? null,
        detectedAt: deps.now(),
      });
    }
  }

  let nsfwRecord: { verdict: string; score?: number; label?: string } | null = null;
  if (providers?.nsfw) {
    const result = await providers.nsfw.screen(assetRefFromQueue(queue));
    nsfwRecord = { verdict: result.verdict, score: result.score, label: result.label };
    classifierRecord = classifierRecord === 'none_configured'
      ? providers.nsfw.capability.name
      : `${classifierRecord}+${providers.nsfw.capability.name}`;
  }

  await deps.store.routeToHumanReview(queue, {
    ...meta,
    worker: 'bestchef-media-screening',
    screening_status: NEEDS_HUMAN_REVIEW_REASON,
    // Records which classifiers ran (or 'none_configured'). A human MUST decide.
    // There is no automated approval on any branch.
    classifier: classifierRecord,
    child_safety: childSafety,
    nsfw: nsfwRecord,
    routed_to_human_at: deps.now(),
  });
}

export async function handleMediaScreeningRequest(
  req: Request,
  deps: MediaScreeningDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST for media screening.', 405);
  }

  const authError = await workerAuthorizationError(req, deps.env);
  if (authError) return authError;

  let body: WorkerBody;
  try {
    body = await readWorkerBody(req);
  } catch {
    return jsonError('invalid_input', 'Request body must be valid JSON.', 400);
  }

  const limit = clampBatch(body.limit ?? body.batchSize ?? body.batch_size ?? DEFAULT_BATCH);

  let batch: MediaQueueItem[];
  try {
    batch = await deps.store.claimQueueBatch(limit);
  } catch (err) {
    captureError({ fn: 'bestchef-media-screening', op: 'claimQueueBatch' }, err);
    return jsonError('worker_failed', errorMessage(err), 500);
  }

  const routed: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const queue of batch) {
    if (queue.kind !== 'media_asset') continue;
    try {
      await screenMediaQueueItem(queue, deps);
      routed.push(queue.id);
    } catch (err) {
      failed.push({ id: queue.id, error: errorMessage(err) });
    }
  }

  return jsonResponse({
    ok: true,
    claimed: batch.length,
    routedToHumanReview: routed.length,
    failed,
    // Explicit contract so callers cannot misread this as an approval worker.
    autoApproved: 0,
    screeningStatus: NEEDS_HUMAN_REVIEW_REASON,
  });
}

// ── Supabase-backed store ──────────────────────────────────────────────

function ensureServiceConfig(env: MediaScreeningDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

class SupabaseMediaScreeningStore implements MediaScreeningStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
    private readonly now: () => string,
  ) {}

  async claimQueueBatch(limit: number): Promise<MediaQueueItem[]> {
    // Oldest queued media rows first. `failed` rows already carry a human-review
    // reason from a prior pass, so we only pick up untouched `queued` rows to
    // avoid re-stamping the same item on every cron tick.
    const rows = await this.restJson<MediaQueueItem[]>(
      `/rest/v1/bc_moderation_queue?select=*&kind=eq.media_asset&status=eq.queued&order=created_at.asc&limit=${limit}`,
    );
    return rows;
  }

  async recordChildSafetyHit(input: {
    queue: MediaQueueItem;
    matchRef: string | null;
    detectedAt: string;
  }): Promise<void> {
    // Definer-only RPC blocks the asset and files the pending_registration
    // report. No transmission happens here: NCMEC registration is founder item
    // F3, so the report stays pending_registration until that lands.
    await this.restText('/rest/v1/rpc/bc_record_child_safety_hit', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        p_media_asset_id: input.queue.target_id,
        p_owner_profile_id: input.queue.profile_id,
        p_match_ref: input.matchRef,
        p_provider: 'child_safety_hash',
        p_detected_at: input.detectedAt,
      }),
    }, [200, 201, 204]);
  }

  async routeToHumanReview(queue: MediaQueueItem, metadata: Record<string, unknown>): Promise<void> {
    // Status 'failed' + a needs_human_review reason keeps the row in the
    // console's open set (PROOF_QUEUE_OPEN_STATUSES includes 'failed') WITHOUT
    // marking it decided. The media asset itself is untouched: it stays
    // moderation_status='pending' and non-public until a human decides.
    await this.restText(
      `/rest/v1/bc_moderation_queue?id=eq.${encodeURIComponent(queue.id)}&status=eq.queued`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          failure_reason: NEEDS_HUMAN_REVIEW_REASON,
          metadata,
          updated_at: this.now(),
        }),
      },
      [200, 204],
    );
  }

  private async restJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const text = await this.restText(path, init, [200, 201]);
    return text ? (JSON.parse(text) as T) : ([] as unknown as T);
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

export function createSupabaseMediaScreeningStore(
  env: MediaScreeningDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): MediaScreeningStore {
  return new SupabaseMediaScreeningStore(ensureServiceConfig(env), fetchImpl, now);
}

/**
 * Resolve media-screening providers for a production run.
 *
 * FAIL-CLOSED: with no configured vendor and no env-gated test stubs, returns
 * null and only the human-review path runs. There is no vendor adapter yet
 * (founder item F3), so the seam resolves to no provider today. A config error
 * (stubs in production, unknown provider name) is fatal: the worker refuses to
 * run rather than screen with an unknown pipeline.
 */
export function resolveMediaScreeningProviders(
  env: MediaScreeningDeps['env'],
): MediaScreeningProviders | null {
  const resolved = resolveModerationProviders(env);
  if (resolved.usingTestStubs) {
    return { nsfw: resolved.nsfw, childSafety: resolved.childSafety };
  }
  if (!resolved.nsfw && !resolved.childSafety) return null;
  return { nsfw: resolved.nsfw, childSafety: resolved.childSafety };
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    const now = () => new Date().toISOString();

    let store: MediaScreeningStore;
    try {
      store = createSupabaseMediaScreeningStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    let providers: MediaScreeningProviders | null;
    try {
      providers = resolveMediaScreeningProviders(env);
    } catch (err) {
      const detail =
        err instanceof ModerationConfigError
          ? { kind: 'moderation_config_error', detail: err.detail }
          : {};
      captureError(
        {
          fn: 'bestchef-media-screening',
          op: 'resolveMediaScreeningProviders',
          extra: { fatal: 'moderation_provider_config', ...detail },
        },
        err,
      );
      return jsonError('config', errorMessage(err), 503);
    }

    return handleMediaScreeningRequest(req, { env, now, store, providers });
  });
}

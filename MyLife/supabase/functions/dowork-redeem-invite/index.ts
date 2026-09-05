/**
 * DoWork redeem-invite Edge Function.
 *
 * The ONLY path that creates a dw_trainers row. An authenticated user posts an
 * invite code; the function (service role) validates it is unclaimed and
 * unexpired, ensures the caller is not already a trainer, mints the trainer row
 * with a handle slugged from the display name (collision retry with a numeric
 * suffix, mirroring the lifter_xxxxxx approach in cloud-profiles.ts), and marks
 * the invite claimed.
 *
 *   POST { code: string, displayName?: string } with user JWT
 *     -> 200 { trainer: <row> }
 *     -> 404 { error: 'invalid_code' }      (unknown code)
 *     -> 409 { error: 'already_claimed' }   (code already redeemed)
 *     -> 409 { error: 'expired' }           (past expires_at)
 *     -> 409 { error: 'already_trainer' }   (caller already owns a trainer row)
 *     -> 429 { error: 'rate_limited' }      (too many attempts this hour)
 *     -> 500 { error: 'server_error' }      (claim failed; trainer row compensated)
 *
 * Compensation: if the trainer insert succeeds but claiming the invite fails,
 * the freshly created trainer row is deleted so a failed redemption leaves no
 * orphan trainer.
 *
 * Rate limit (BK-3): logs every attempt to the durable dw_invite_attempts
 * ledger (20260711000013_dowork_moderation_hardening.sql) via the same
 * dw_consume_invite_attempt() RPC dw_redeem_client_invite uses, so a scripted
 * attacker cannot burn through the trainer-invite code space at unlimited
 * speed. Checked before the code lookup so failed guesses count too.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const HANDLE_MAX_LENGTH = 24;
const MAX_HANDLE_ATTEMPTS = 8;

export interface DoWorkTrainerRow {
  id: string;
  user_id: string;
  display_name: string;
  handle: string | null;
  headline: string | null;
  specialties: string[];
  is_verified: boolean;
  is_active: boolean;
  price_tier: number;
  subscriber_count: number;
  created_at: string;
}

export interface DoWorkInviteRow {
  id: string;
  code: string;
  claimed_by: string | null;
  claimed_at: string | null;
  expires_at: string;
}

export type InsertTrainerResult =
  | { ok: true; row: DoWorkTrainerRow }
  | { ok: false; conflict: 'handle' | 'user' | 'other' };

export interface RedeemInviteStore {
  /** Durable rate check (dw_consume_invite_attempt). Returns false when the
   *  caller has exceeded the window budget; still logs the attempt either way. */
  consumeInviteAttempt(userId: string): Promise<boolean>;
  getInviteByCode(code: string): Promise<DoWorkInviteRow | null>;
  getTrainerForUser(userId: string): Promise<{ id: string } | null>;
  getProfileDisplayName(userId: string): Promise<string | null>;
  insertTrainer(input: {
    userId: string;
    displayName: string;
    handle: string;
  }): Promise<InsertTrainerResult>;
  claimInvite(inviteId: string, userId: string, nowIso: string): Promise<boolean>;
  deleteTrainer(trainerId: string): Promise<void>;
}

const INVITE_ATTEMPT_MAX = 10;
const INVITE_ATTEMPT_WINDOW_SECONDS = 3600;

export interface RedeemInviteDeps {
  store: RedeemInviteStore;
  now: () => number;
  randomSuffix: () => string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorJson(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Lowercase alphanumeric-and-hyphen slug for a trainer handle. */
export function slugifyHandle(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HANDLE_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'trainer';
}

/**
 * Deterministic first attempt (the bare slug), then a numeric suffix on
 * collision, falling back to a random suffix once sequential attempts run out.
 */
export function generateTrainerHandle(
  displayName: string,
  attempt: number,
  randomSuffix: () => string,
): string {
  const base = slugifyHandle(displayName);
  if (attempt <= 0) return base;
  if (attempt < MAX_HANDLE_ATTEMPTS - 1) return `${base}-${attempt + 1}`;
  return `${base}-${randomSuffix()}`;
}

export async function handleDoWorkRedeemInviteRequest(
  req: Request,
  deps: RedeemInviteDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return errorJson('method_not_allowed', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return errorJson('unauthorized', 401);
  }

  const withinBudget = await deps.store.consumeInviteAttempt(userId);
  if (!withinBudget) {
    return errorJson('rate_limited', 429);
  }

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return errorJson('invalid_code', 400);
  }

  const code = stringOrNull(body.code);
  if (!code) {
    return errorJson('invalid_code', 400);
  }

  const invite = await deps.store.getInviteByCode(code);
  if (!invite) {
    return errorJson('invalid_code', 404);
  }
  if (invite.claimed_by) {
    return errorJson('already_claimed', 409);
  }
  if (Date.parse(invite.expires_at) < deps.now()) {
    return errorJson('expired', 409);
  }

  const existingTrainer = await deps.store.getTrainerForUser(userId);
  if (existingTrainer) {
    return errorJson('already_trainer', 409);
  }

  const requestedName = stringOrNull(body.displayName);
  const profileName = requestedName ? null : await deps.store.getProfileDisplayName(userId);
  const displayName = requestedName ?? profileName ?? 'Trainer';

  let created: DoWorkTrainerRow | null = null;
  for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS; attempt += 1) {
    const handle = generateTrainerHandle(displayName, attempt, deps.randomSuffix);
    const result = await deps.store.insertTrainer({ userId, displayName, handle });
    if (result.ok) {
      created = result.row;
      break;
    }
    if (result.conflict === 'user') {
      return errorJson('already_trainer', 409);
    }
    if (result.conflict === 'handle') {
      continue;
    }
    return errorJson('server_error', 500);
  }

  if (!created) {
    return errorJson('server_error', 500);
  }

  const nowIso = new Date(deps.now()).toISOString();
  let claimed = false;
  try {
    claimed = await deps.store.claimInvite(invite.id, userId, nowIso);
  } catch {
    await safeDeleteTrainer(deps.store, created.id);
    return errorJson('server_error', 500);
  }

  if (!claimed) {
    // Lost a redemption race: another caller claimed the code first.
    await safeDeleteTrainer(deps.store, created.id);
    return errorJson('already_claimed', 409);
  }

  return jsonResponse({ trainer: created });
}

async function safeDeleteTrainer(store: RedeemInviteStore, trainerId: string): Promise<void> {
  try {
    await store.deleteTrainer(trainerId);
  } catch {
    // Best-effort compensation; the trainer row is unreachable without a claim.
  }
}

// ── Supabase-backed store (service role, REST) ─────────────────────────────

function ensureServiceConfig(env: (key: string) => string | undefined): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

class SupabaseRedeemInviteStore implements RedeemInviteStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async consumeInviteAttempt(userId: string): Promise<boolean> {
    const allowed = await this.restJson<boolean>(
      '/rest/v1/rpc/dw_consume_invite_attempt',
      {
        method: 'POST',
        body: JSON.stringify({
          p_user_id: userId,
          p_kind: 'trainer_invite',
          p_max: INVITE_ATTEMPT_MAX,
          p_window_seconds: INVITE_ATTEMPT_WINDOW_SECONDS,
        }),
      },
      [200],
    );
    return allowed === true;
  }

  async getInviteByCode(code: string): Promise<DoWorkInviteRow | null> {
    const rows = await this.restJson<DoWorkInviteRow[]>(
      `/rest/v1/dw_trainer_invites?select=id,code,claimed_by,claimed_at,expires_at&code=eq.${encodeURIComponent(code)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getTrainerForUser(userId: string): Promise<{ id: string } | null> {
    const rows = await this.restJson<Array<{ id: string }>>(
      `/rest/v1/dw_trainers?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getProfileDisplayName(userId: string): Promise<string | null> {
    const rows = await this.restJson<Array<{ display_name: string | null }>>(
      `/rest/v1/dw_user_profiles?select=display_name&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return stringOrNull(rows[0]?.display_name ?? null);
  }

  async insertTrainer(input: {
    userId: string;
    displayName: string;
    handle: string;
  }): Promise<InsertTrainerResult> {
    const res = await this.fetchImpl(`${this.config.url}/rest/v1/dw_trainers`, {
      method: 'POST',
      headers: { ...this.authHeaders(), ...JSON_HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: input.userId,
        display_name: input.displayName,
        handle: input.handle,
        is_verified: true,
        is_active: true,
      }),
    });
    if (res.status === 200 || res.status === 201) {
      const rows = (await res.json()) as DoWorkTrainerRow[];
      const row = rows[0];
      if (!row) return { ok: false, conflict: 'other' };
      return { ok: true, row };
    }
    if (res.status === 409) {
      const detail = (await res.text().catch(() => '')).toLowerCase();
      if (detail.includes('user_id')) return { ok: false, conflict: 'user' };
      if (detail.includes('handle')) return { ok: false, conflict: 'handle' };
      return { ok: false, conflict: 'other' };
    }
    await res.text().catch(() => '');
    return { ok: false, conflict: 'other' };
  }

  async claimInvite(inviteId: string, userId: string, nowIso: string): Promise<boolean> {
    // Conditional update: only claims when still unclaimed, so a redemption race
    // resolves to exactly one winner.
    const rows = await this.restJson<Array<{ id: string }>>(
      `/rest/v1/dw_trainer_invites?id=eq.${encodeURIComponent(inviteId)}&claimed_by=is.null`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ claimed_by: userId, claimed_at: nowIso }),
      },
      [200],
    );
    return rows.length > 0;
  }

  async deleteTrainer(trainerId: string): Promise<void> {
    await this.restJson<unknown>(
      `/rest/v1/dw_trainers?id=eq.${encodeURIComponent(trainerId)}`,
      { method: 'DELETE' },
      [200, 204],
    );
  }

  private authHeaders(): Record<string, string> {
    return { apikey: this.config.key, Authorization: `Bearer ${this.config.key}` };
  }

  private async restJson<T>(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [200, 201],
  ): Promise<T> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: { ...this.authHeaders(), ...JSON_HEADERS, ...(init.headers ?? {}) },
    });
    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

export function createSupabaseRedeemInviteStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): RedeemInviteStore {
  return new SupabaseRedeemInviteStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    let store: RedeemInviteStore;
    try {
      store = createSupabaseRedeemInviteStore((key) => Deno!.env.get(key), fetch);
    } catch (err) {
      return errorJson(err instanceof Error ? 'config_error' : 'config_error', 503);
    }
    return handleDoWorkRedeemInviteRequest(req, {
      store,
      now: () => Date.now(),
      randomSuffix: () => Math.random().toString(36).slice(2, 8),
    });
  });
}

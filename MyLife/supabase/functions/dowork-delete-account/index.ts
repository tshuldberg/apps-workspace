/**
 * DoWork delete-account Edge Function.
 *
 * Authenticated users invoke this for a full server-side wipe:
 *   1. Verify the bearer token resolves to a user (gateway-verified JWT)
 *   2. Delete all dw_* rows owned by that user, FK-safe order
 *   3. Remove every Storage object under the user's folder in all three
 *      DoWork buckets (keys are always `<user_id>/...`)
 *   4. Delete the auth user via the admin API
 *
 * Local SQLite wipe is the client's responsibility (the DoWork settings
 * screen deletes dowork.db after this returns ok).
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export interface DoWorkDeleteStore {
  getTrainerIdForUser(userId: string): Promise<string | null>;
  /** Client link ids where the user is the client or (via trainerId) the trainer. */
  getFormCheckLinkIds(userId: string, trainerId: string | null): Promise<string[]>;
  deleteRows(table: string, filterColumn: string, value: string): Promise<void>;
  /** PATCH matching rows with the given column values (financial-ledger anonymization). */
  updateRows(
    table: string,
    filterColumn: string,
    value: string,
    patch: Record<string, unknown>,
  ): Promise<void>;
  listObjects(bucket: string, prefix: string, limit: number): Promise<string[]>;
  removeObjects(bucket: string, keys: string[]): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
}

// dw_purchase_events is the append-only financial ledger behind
// dw_get_trainer_earnings (trainer-side aggregates). Deleting rows would
// silently rewrite trainer earnings history, so account deletion anonymizes
// instead: user_id is nulled and the raw RevenueCat payload (app user ids,
// aliases, attributes) is replaced with a scrub marker. event_type,
// product_id, price_usd, trainer_id, and created_at stay for aggregate math
// and contain no personal data. App Review notes state this retention.
export const PURCHASE_EVENT_SCRUB: Record<string, unknown> = {
  user_id: null,
  raw: { scrubbed: true, reason: 'account_deleted' },
};

export const DOWORK_BUCKETS = [
  'dowork-avatars',
  'dowork-share-media',
  'dowork-trainer-videos',
] as const;

export const DOWORK_FORM_CHECK_BUCKET = 'dowork-form-checks';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(kind: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { kind, message } }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function handleDoWorkDeleteAccountRequest(
  req: Request,
  store: DoWorkDeleteStore,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST.', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return jsonError('auth', 'Missing or invalid Authorization header.', 401);
  }

  try {
    // Resolve trainer + client-link ids up front, before any deletes remove the
    // rows we need to enumerate form-check storage prefixes.
    const trainerId = await store.getTrainerIdForUser(userId);
    const formCheckLinkIds = await store.getFormCheckLinkIds(userId, trainerId);

    // Rows. dw_workout_shares cascades its dw_likes/dw_comments children,
    // but the user's likes/comments on OTHER people's shares need explicit
    // deletes. dw_trainer_videos cascades from dw_trainers. Deleting the
    // client-side dw_client_links cascades that link's dw_form_checks and
    // dw_form_feedback; deleting dw_trainers cascades the trainer-side links.
    await store.deleteRows('dw_likes', 'user_id', userId);
    await store.deleteRows('dw_comments', 'user_id', userId);
    await store.deleteRows('dw_workout_shares', 'user_id', userId);
    await store.deleteRows('dw_reports', 'reporter_user_id', userId);
    await store.deleteRows('dw_client_links', 'client_user_id', userId);
    await store.deleteRows('dw_trainer_subscriptions', 'user_id', userId);
    await store.updateRows('dw_purchase_events', 'user_id', userId, PURCHASE_EVENT_SCRUB);
    await store.deleteRows('dw_video_view_marks', 'user_id', userId);
    await store.deleteRows('dw_push_tokens', 'user_id', userId);

    if (trainerId) {
      await store.deleteRows('dw_trainer_videos', 'trainer_id', trainerId);
      await store.deleteRows('dw_trainers', 'user_id', userId);
    }

    await store.deleteRows('dw_user_blocks', 'user_id', userId);
    await store.deleteRows('dw_user_blocks', 'blocked_user_id', userId);
    await store.deleteRows('dw_user_profiles', 'user_id', userId);

    // Storage: DoWork media keys start with the owner's user id...
    let objectsRemoved = 0;
    for (const bucket of DOWORK_BUCKETS) {
      // Bounded loop: 50 pages x 200 keys per bucket.
      for (let page = 0; page < 50; page += 1) {
        const keys = await store.listObjects(bucket, `${userId}/`, 200);
        if (keys.length === 0) break;
        await store.removeObjects(bucket, keys);
        objectsRemoved += keys.length;
        if (keys.length < 200) break;
      }
    }

    // ...except form-check media, keyed by `<client_link_id>/`; remove every
    // link prefix the user participated in on either side.
    for (const linkId of formCheckLinkIds) {
      for (let page = 0; page < 50; page += 1) {
        const keys = await store.listObjects(DOWORK_FORM_CHECK_BUCKET, `${linkId}/`, 200);
        if (keys.length === 0) break;
        await store.removeObjects(DOWORK_FORM_CHECK_BUCKET, keys);
        objectsRemoved += keys.length;
        if (keys.length < 200) break;
      }
    }

    await store.deleteAuthUser(userId);

    return jsonResponse({
      ok: true,
      objectsRemoved,
      revenuecat: `Subscriptions must also be revoked in RevenueCat dashboard for app user id ${userId}`,
    });
  } catch (err) {
    return jsonError(
      'server',
      err instanceof Error ? err.message : 'Account deletion failed.',
      500,
    );
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

class SupabaseDoWorkDeleteStore implements DoWorkDeleteStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getTrainerIdForUser(userId: string): Promise<string | null> {
    const res = await this.request(
      `/rest/v1/dw_trainers?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      {},
      [200],
    );
    const rows = (await res.json()) as Array<{ id?: string }>;
    return rows[0]?.id ?? null;
  }

  async getFormCheckLinkIds(userId: string, trainerId: string | null): Promise<string[]> {
    const ids = new Set<string>();

    const clientRes = await this.request(
      `/rest/v1/dw_client_links?select=id&client_user_id=eq.${encodeURIComponent(userId)}`,
      {},
      [200],
    );
    for (const row of (await clientRes.json()) as Array<{ id?: string }>) {
      if (row.id) ids.add(row.id);
    }

    if (trainerId) {
      const trainerRes = await this.request(
        `/rest/v1/dw_client_links?select=id&trainer_id=eq.${encodeURIComponent(trainerId)}`,
        {},
        [200],
      );
      for (const row of (await trainerRes.json()) as Array<{ id?: string }>) {
        if (row.id) ids.add(row.id);
      }
    }

    return [...ids];
  }

  async deleteRows(table: string, filterColumn: string, value: string): Promise<void> {
    await this.request(
      `/rest/v1/${table}?${filterColumn}=eq.${encodeURIComponent(value)}`,
      { method: 'DELETE' },
      // 404 tolerated: dw_user_blocks may not exist until its migration runs.
      [200, 204, 404],
    );
  }

  async updateRows(
    table: string,
    filterColumn: string,
    value: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    await this.request(
      `/rest/v1/${table}?${filterColumn}=eq.${encodeURIComponent(value)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      },
      [200, 204, 404],
    );
  }

  async listObjects(bucket: string, prefix: string, limit: number): Promise<string[]> {
    const res = await this.request(
      `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: 'POST',
        body: JSON.stringify({ prefix, limit, offset: 0 }),
      },
      [200],
    );
    const rows = (await res.json()) as Array<{ name?: string }>;
    return rows
      .map((row) => stringOrNull(row.name))
      .filter((name): name is string => name !== null)
      .map((name) => `${prefix}${name}`);
  }

  async removeObjects(bucket: string, keys: string[]): Promise<void> {
    await this.request(
      `/storage/v1/object/${encodeURIComponent(bucket)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ prefixes: keys }),
      },
      [200],
    );
  }

  async deleteAuthUser(userId: string): Promise<void> {
    await this.request(
      `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
      [200, 204],
    );
  }

  private async request(
    path: string,
    init: RequestInit = {},
    okStatuses: number[],
  ): Promise<Response> {
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
    return res;
  }
}

export function createSupabaseDoWorkDeleteStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): DoWorkDeleteStore {
  return new SupabaseDoWorkDeleteStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    let store: DoWorkDeleteStore;
    try {
      store = createSupabaseDoWorkDeleteStore((key) => Deno!.env.get(key), fetch);
    } catch (err) {
      return jsonError('config', err instanceof Error ? err.message : String(err), 503);
    }
    return handleDoWorkDeleteAccountRequest(req, store);
  });
}

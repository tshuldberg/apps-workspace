/**
 * BestChef GDPR Art. 20 account data export (audit H3).
 *
 * User-facing Edge Function: an authenticated user requests a structured,
 * machine-readable export of THEIR own account data (profile, submissions,
 * votes, comments, follows, flags they filed, media metadata + storage paths,
 * creator application status, appeals, notifications). This is the portability
 * copy (Art. 20), distinct from the on-device kitchen export in the Expo app.
 * Notification preferences and other device-local settings are not stored
 * server-side; they are covered by the on-device kitchen export instead.
 *
 * Auth invariant (OPS-04): this function keeps gateway JWT verification. It is
 * NOT a worker and must NOT be deployed with --no-verify-jwt. getUserIdFromAuth
 * reads the `sub` claim of the gateway-verified JWT; every query is scoped to
 * that user's rows only (definer service-role queries filtered by the
 * authenticated uid / their profile id).
 *
 * Pure and free of Deno imports except the entry point at the bottom, so the
 * core logic is unit-testable under Vitest.
 */

import { getUserIdFromAuth } from '../_shared/broker.ts';
import { captureError } from '../_shared/observability.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Long tables are truncated so an abusive or enormous account can never make
// the export unbounded. Each truncated collection carries a count + marker.
const MAX_ROWS_PER_TABLE = 5000;

export interface ExportCollection {
  count: number;
  truncated: boolean;
  rows: Record<string, unknown>[];
}

export interface BestChefAccountExport {
  _meta: {
    app: 'BestChef';
    exportedAt: string;
    scope: 'account';
    format: 'gdpr-art-20';
    userId: string;
    profileId: string | null;
    note: string;
    maxRowsPerTable: number;
  };
  profile: Record<string, unknown> | null;
  creatorStatus: Record<string, unknown> | null;
  submissions: ExportCollection;
  votes: ExportCollection;
  comments: ExportCollection;
  following: ExportCollection;
  followers: ExportCollection;
  flagsFiled: ExportCollection;
  mediaAssets: ExportCollection;
  appeals: ExportCollection;
  notifications: ExportCollection;
}

export interface AccountExportStore {
  /** The requesting user's BestChef social profile id, or null if none yet. */
  getProfileId(userId: string): Promise<string | null>;
  getProfile(profileId: string): Promise<Record<string, unknown> | null>;
  getCreatorStatus(profileId: string): Promise<Record<string, unknown> | null>;
  listSubmissions(profileId: string, limit: number): Promise<ExportCollection>;
  listVotes(profileId: string, limit: number): Promise<ExportCollection>;
  listComments(profileId: string, limit: number): Promise<ExportCollection>;
  listFollowing(profileId: string, limit: number): Promise<ExportCollection>;
  listFollowers(profileId: string, limit: number): Promise<ExportCollection>;
  listFlagsFiled(profileId: string, limit: number): Promise<ExportCollection>;
  listMediaAssets(profileId: string, limit: number): Promise<ExportCollection>;
  listAppeals(profileId: string, limit: number): Promise<ExportCollection>;
  listNotifications(userId: string, limit: number): Promise<ExportCollection>;
}

export interface AccountExportDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: AccountExportStore;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(kind: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: { kind, message } }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const EXPORT_NOTE =
  'A machine-readable copy of your BestChef account data (GDPR Art. 20). ' +
  'Long lists are capped; a truncated collection reports its full count. ' +
  'This is the server-side account copy; the on-device kitchen export is ' +
  'available separately in the app.';

/**
 * Assemble the full account export for a user. Every collection is scoped to
 * the requesting user's own rows by the store implementation.
 */
export async function buildBestChefAccountExport(
  userId: string,
  deps: AccountExportDeps,
): Promise<BestChefAccountExport> {
  const profileId = await deps.store.getProfileId(userId);

  const emptyCollection: ExportCollection = { count: 0, truncated: false, rows: [] };

  const [
    profile,
    creatorStatus,
    submissions,
    votes,
    comments,
    following,
    followers,
    flagsFiled,
    mediaAssets,
    appeals,
    notifications,
  ] = await Promise.all([
    profileId ? deps.store.getProfile(profileId) : Promise.resolve(null),
    profileId ? deps.store.getCreatorStatus(profileId) : Promise.resolve(null),
    profileId ? deps.store.listSubmissions(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listVotes(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listComments(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listFollowing(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listFollowers(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listFlagsFiled(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listMediaAssets(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    profileId ? deps.store.listAppeals(profileId, MAX_ROWS_PER_TABLE) : Promise.resolve(emptyCollection),
    deps.store.listNotifications(userId, MAX_ROWS_PER_TABLE),
  ]);

  return {
    _meta: {
      app: 'BestChef',
      exportedAt: deps.now(),
      scope: 'account',
      format: 'gdpr-art-20',
      userId,
      profileId,
      note: EXPORT_NOTE,
      maxRowsPerTable: MAX_ROWS_PER_TABLE,
    },
    profile,
    creatorStatus,
    submissions,
    votes,
    comments,
    following,
    followers,
    flagsFiled,
    mediaAssets,
    appeals,
    notifications,
  };
}

export async function handleAccountExportRequest(
  req: Request,
  deps: AccountExportDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('invalid_input', 'Use POST to request an account export.', 405);
  }

  const userId = getUserIdFromAuth(req.headers.get('Authorization'));
  if (!userId) {
    return jsonError('auth', 'Missing or invalid Authorization header.', 401);
  }

  try {
    const data = await buildBestChefAccountExport(userId, deps);
    return jsonResponse({ ok: true, export: data });
  } catch (err) {
    // Do not attach userId: identity is never forwarded from the edge tier.
    captureError({ fn: 'bestchef-export-account', op: 'buildBestChefAccountExport' }, err);
    return jsonError('export_failed', errorMessage(err), 500);
  }
}

// ── Service-role store (PostgREST, the house pattern; no supabase-js dep) ──

function ensureServiceConfig(env: AccountExportDeps['env']): { url: string; key: string } {
  const url = stringOrNull(env('SUPABASE_URL'));
  const key = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
  }
  return { url: url.replace(/\/+$/, ''), key };
}

class SupabaseAccountExportStore implements AccountExportStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getProfileId(userId: string): Promise<string | null> {
    const rows = await this.restJson<Array<{ id?: string }>>(
      `/rest/v1/social_profiles?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    return rows[0]?.id ?? null;
  }

  async getProfile(profileId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.restJson<Record<string, unknown>[]>(
      `/rest/v1/social_profiles?select=*&id=eq.${encodeURIComponent(profileId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getCreatorStatus(profileId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.restJson<Record<string, unknown>[]>(
      `/rest/v1/bc_creator_applications?select=*&profile_id=eq.${encodeURIComponent(profileId)}&order=created_at.desc&limit=1`,
    );
    return rows[0] ?? null;
  }

  listSubmissions(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_submissions', profileId, limit, 'profile_id');
  }

  listVotes(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_votes', profileId, limit, 'voter_profile_id');
  }

  listComments(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_comments', profileId, limit, 'profile_id');
  }

  listFollowing(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_followers', profileId, limit, 'follower_id');
  }

  listFollowers(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_followers', profileId, limit, 'chef_id');
  }

  listFlagsFiled(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_flags', profileId, limit, 'flagger_id');
  }

  listMediaAssets(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_media_assets', profileId, limit, 'owner_profile_id');
  }

  listAppeals(profileId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_appeals', profileId, limit, 'profile_id');
  }

  listNotifications(userId: string, limit: number): Promise<ExportCollection> {
    return this.collect('bc_notifications', userId, limit, 'user_id');
  }

  /**
   * Page a single table scoped to one owner column, returning at most `limit`
   * rows plus the exact total count (via the PostgREST count header) so a
   * truncated collection can advertise how much was withheld.
   */
  private async collect(
    table: string,
    ownerId: string,
    limit: number,
    ownerColumn: string,
  ): Promise<ExportCollection> {
    const { rows, total } = await this.restJsonWithCount<Record<string, unknown>>(
      `/rest/v1/${table}?select=*&${ownerColumn}=eq.${encodeURIComponent(ownerId)}&order=created_at.desc&limit=${limit}`,
    );
    return {
      count: total,
      truncated: total > rows.length,
      rows,
    };
  }

  private async restJson<T>(path: string): Promise<T> {
    const res = await this.request(path, {});
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ([] as unknown as T);
  }

  private async restJsonWithCount<T>(
    path: string,
  ): Promise<{ rows: T[]; total: number }> {
    const res = await this.request(path, {
      headers: { Prefer: 'count=exact' },
    });
    const text = await res.text();
    const rows = (text ? JSON.parse(text) : []) as T[];
    const total = parseContentRangeTotal(res.headers.get('content-range'), rows.length);
    return { rows, total };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchImpl(`${this.config.url}${path}`, {
      ...init,
      headers: {
        apikey: this.config.key,
        Authorization: `Bearer ${this.config.key}`,
        ...JSON_HEADERS,
        ...(init.headers ?? {}),
      },
    });
    if (res.status !== 200 && res.status !== 206) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase request failed with HTTP ${res.status}${body ? `: ${body}` : ''}`);
    }
    return res;
  }
}

/** Parse the total row count from a PostgREST `Content-Range: 0-24/137` header. */
export function parseContentRangeTotal(header: string | null, fallback: number): number {
  if (!header) return fallback;
  const slash = header.indexOf('/');
  if (slash < 0) return fallback;
  const total = Number.parseInt(header.slice(slash + 1), 10);
  return Number.isFinite(total) ? total : fallback;
}

export function createSupabaseAccountExportStore(
  env: AccountExportDeps['env'],
  fetchImpl: typeof fetch,
): AccountExportStore {
  return new SupabaseAccountExportStore(ensureServiceConfig(env), fetchImpl);
}

if (typeof Deno !== 'undefined' && Deno?.serve) {
  Deno.serve((req) => {
    const env = (key: string) => Deno.env.get(key);
    const now = () => new Date().toISOString();

    let store: AccountExportStore;
    try {
      store = createSupabaseAccountExportStore(env, fetch);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    return handleAccountExportRequest(req, { env, now, store });
  });
}

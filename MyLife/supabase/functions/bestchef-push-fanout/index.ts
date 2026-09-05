/**
 * BestChef push-fanout worker (audit H13).
 *
 * BestChef ships a full in-app typed-notification system (bc_notifications rows
 * carrying kind + params, localized on the client from the i18n catalogs) but
 * no push. This worker is the server-side delivery half: it drains
 * bc_push_outbox (populated by a definer trigger on bc_notifications for the
 * flagship kinds), renders localized title/body SERVER-SIDE from kind + params,
 * and sends via the Expo push service. Every recipient device's token carries
 * the locale captured at registration, so copy is rendered in the user's
 * language even though the device is not reachable at send time.
 *
 * LOCALIZATION: render-at-send (server-side), not silent data pushes. The whole
 * point of push is that the user learns something actionable with the app
 * closed, so the visible text must already be localized when it leaves the
 * server. The compact copy map below covers the flagship kinds across all 21
 * BestChef locales, reusing the same wording as the client i18n catalogs; any
 * other enqueued kind falls back to a localized generic title. See the
 * migration header (20260711000010) for the full decision record.
 *
 * FLAGSHIP KINDS: rank_up, rank_milestone, moderation_decision, appeal_resolved.
 *
 * Server-only per OPS-04: deployed with --no-verify-jwt and gated by the
 * BESTCHEF_PUSH_FANOUT_WORKER_SECRET (gateway JWT verification would 401
 * cron/operator calls before the secret check runs). Structurally mirrors
 * bestchef-url-resign / dowork-notify: invoked by pg_net cron or an operator,
 * never by the app.
 */

import { timingSafeEqual } from '../_shared/worker-secret.ts';
import { captureError } from '../_shared/observability.ts';
import {
  DEFAULT_PUSH_LOCALE,
  renderPushCopy,
  type PushLocale,
} from './copy.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo caps a push request at 100 messages. */
const EXPO_CHUNK_SIZE = 100;
const DEFAULT_BATCH_LIMIT = 200;
const MAX_BATCH_LIMIT = 500;
/** Outbox rows past this many attempts are abandoned (permanent-failure guard). */
const MAX_ATTEMPTS = 5;

// ── Wire types ─────────────────────────────────────────────────────────────

export interface OutboxRow {
  id: string;
  notification_id: string;
  user_id: string;
  kind: string;
  params: Record<string, unknown> | null;
  target_type: string | null;
  target_id: string | null;
  attempts: number;
}

export interface PushTokenRow {
  user_id: string;
  token: string;
  locale: string | null;
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound?: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string } | null;
}

export interface PushFanoutStore {
  /** Oldest queued/failed rows first, bounded by attempts. */
  claimOutbox(limit: number): Promise<OutboxRow[]>;
  /** Tokens for the given recipient user ids. */
  getTokensForUsers(userIds: string[]): Promise<PushTokenRow[]>;
  markSent(outboxIds: string[]): Promise<void>;
  markFailed(outboxId: string, error: string): Promise<void>;
  markSkipped(outboxIds: string[]): Promise<void>;
  deleteTokens(tokens: string[]): Promise<void>;
}

export interface PushFanoutDeps {
  env: (key: string) => string | undefined;
  now: () => string;
  store: PushFanoutStore;
  sendPushChunk: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;
}

export interface PushFanoutResult {
  ok: boolean;
  claimed: number;
  sent: number;
  skipped: number;
  pruned: number;
  failures: { outboxId: string; error: string }[];
}

// ── Small helpers ───────────────────────────────────────────────────────────

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function jsonError(code: string, message: string, status: number): Response {
  return jsonResponse({ ok: false, error: code, message }, status);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Deep-link route for the push tap, matching the client's buildTargetRoute
 * mapping (@mylife/bestchef cloud/notifications). Kept in sync by hand: the
 * flagship kinds only ever target 'chef' (rank) or 'submission'/'appeal'
 * (moderation), so this small map covers them. The client re-derives the route
 * from data.targetType/targetId too, so this is a convenience, not the contract.
 */
function buildTargetRoute(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) return null;
  switch (targetType) {
    case 'submission':
      return `/recipe/${targetId}`;
    case 'chef':
      return `/chef/${targetId}`;
    case 'dish':
      return `/dish/${targetId}`;
    case 'challenge':
      return `/challenge/${targetId}`;
    case 'comment':
    case 'appeal':
      return `/my-reports`;
    case 'badge':
      return `/(tabs)/profile`;
    default:
      return null;
  }
}

// ── Worker-secret gate ──────────────────────────────────────────────────────

function expectedWorkerSecret(env: PushFanoutDeps['env']): string | null {
  return stringOrNull(env('BESTCHEF_PUSH_FANOUT_WORKER_SECRET'));
}

function suppliedWorkerSecret(req: Request): string | null {
  const explicit = stringOrNull(req.headers.get('X-BestChef-Worker-Secret'));
  if (explicit) return explicit;
  const auth = req.headers.get('Authorization');
  const match = auth ? /^Bearer\s+(.+)$/i.exec(auth.trim()) : null;
  return match?.[1]?.trim() ?? null;
}

// ── Core drain ───────────────────────────────────────────────────────────────

/**
 * Drain the outbox once. Each outbox row is handled independently: one row's
 * failure (missing recipient, Expo error) never stops the batch. A row with no
 * live tokens is 'skipped' (recipient has push off or no device), not failed.
 */
export async function runPushFanout(
  deps: PushFanoutDeps,
  limit: number = DEFAULT_BATCH_LIMIT,
): Promise<PushFanoutResult> {
  const batch = Math.max(1, Math.min(MAX_BATCH_LIMIT, Math.floor(limit)));
  const rows = await deps.store.claimOutbox(batch);

  const result: PushFanoutResult = {
    ok: true,
    claimed: rows.length,
    sent: 0,
    skipped: 0,
    pruned: 0,
    failures: [],
  };
  if (rows.length === 0) return result;

  // Resolve every recipient's tokens in one round-trip.
  const recipientIds = unique(rows.map((r) => r.user_id));
  let tokenRows: PushTokenRow[] = [];
  try {
    tokenRows = await deps.store.getTokensForUsers(recipientIds);
  } catch (err) {
    // Token fetch is the one shared dependency; if it fails, fail the whole
    // batch cleanly (rows stay queued for the next run) rather than marking
    // individual rows.
    result.ok = false;
    for (const row of rows) result.failures.push({ outboxId: row.id, error: errorMessage(err) });
    return result;
  }

  const tokensByUser = new Map<string, PushTokenRow[]>();
  for (const tokenRow of tokenRows) {
    const list = tokensByUser.get(tokenRow.user_id) ?? [];
    list.push(tokenRow);
    tokensByUser.set(tokenRow.user_id, list);
  }

  // Build one Expo message per (outbox row, recipient token), each localized to
  // that token's stored locale. Track token -> owning outbox rows so a
  // DeviceNotRegistered ticket prunes the token and, if that was the row's only
  // token, the row can still be marked sent (delivery was attempted honestly).
  interface Entry {
    outboxId: string;
    token: string;
    message: ExpoPushMessage;
  }
  const entries: Entry[] = [];
  const sentOutboxIds = new Set<string>();
  const skippedOutboxIds: string[] = [];

  for (const row of rows) {
    const tokens = tokensByUser.get(row.user_id) ?? [];
    if (tokens.length === 0) {
      // No device / push disabled: nothing to deliver. Not a failure.
      skippedOutboxIds.push(row.id);
      continue;
    }
    const params = objectRecord(row.params);
    const route = buildTargetRoute(row.target_type, row.target_id);
    for (const tokenRow of tokens) {
      const locale = normalizeLocale(tokenRow.locale);
      const { title, body } = renderPushCopy(row.kind, params, locale);
      entries.push({
        outboxId: row.id,
        token: tokenRow.token,
        message: {
          to: tokenRow.token,
          title,
          body,
          sound: 'default',
          data: {
            kind: row.kind,
            notificationId: row.notification_id,
            targetType: row.target_type,
            targetId: row.target_id,
            ...(route ? { targetRoute: route } : {}),
          },
        },
      });
    }
  }

  const toPrune: string[] = [];
  const failedOutbox = new Map<string, string>();

  for (const group of chunk(entries, EXPO_CHUNK_SIZE)) {
    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await deps.sendPushChunk(group.map((e) => e.message));
    } catch (err) {
      // Chunk-level send failure: mark each row in this chunk failed so it
      // retries next run.
      for (const entry of group) failedOutbox.set(entry.outboxId, errorMessage(err));
      continue;
    }
    group.forEach((entry, index) => {
      const ticket = tickets[index];
      if (!ticket) {
        failedOutbox.set(entry.outboxId, 'no_ticket');
        return;
      }
      if (ticket.status === 'ok') {
        sentOutboxIds.add(entry.outboxId);
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        // The token is dead; prune it. Delivery to a dead device still counts
        // as an honest attempt for the row (marked sent unless another token
        // failed differently), so we do not fail the row for this alone.
        toPrune.push(entry.token);
        sentOutboxIds.add(entry.outboxId);
      } else {
        failedOutbox.set(entry.outboxId, ticket.details?.error ?? ticket.message ?? 'expo_error');
      }
    });
  }

  // A row that had at least one hard failure is failed even if another token
  // succeeded, so the failure is visible and retried; sent wins only when no
  // token for the row failed.
  for (const failedId of failedOutbox.keys()) sentOutboxIds.delete(failedId);

  const sentIds = [...sentOutboxIds];
  if (sentIds.length > 0) {
    try {
      await deps.store.markSent(sentIds);
      result.sent += sentIds.length;
    } catch (err) {
      result.ok = false;
      for (const id of sentIds) result.failures.push({ outboxId: id, error: errorMessage(err) });
    }
  }

  if (skippedOutboxIds.length > 0) {
    try {
      await deps.store.markSkipped(skippedOutboxIds);
      result.skipped += skippedOutboxIds.length;
    } catch {
      // best-effort; a skipped row left queued is harmless (retried, re-skipped)
    }
  }

  for (const [outboxId, error] of failedOutbox) {
    try {
      await deps.store.markFailed(outboxId, error);
    } catch {
      // best-effort
    }
    result.failures.push({ outboxId, error });
  }

  const pruneTokens = unique(toPrune);
  if (pruneTokens.length > 0) {
    try {
      await deps.store.deleteTokens(pruneTokens);
      result.pruned = pruneTokens.length;
    } catch {
      // best-effort prune
    }
  }

  if (result.failures.length > 0) result.ok = false;
  return result;
}

function normalizeLocale(value: string | null | undefined): PushLocale {
  const raw = stringOrNull(value ?? null);
  return (raw as PushLocale | null) ?? DEFAULT_PUSH_LOCALE;
}

// ── Request handler ──────────────────────────────────────────────────────────

export async function handlePushFanoutRequest(req: Request, deps: PushFanoutDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 'POST only.', 405);
  }

  const expected = expectedWorkerSecret(deps.env);
  if (!expected) {
    return jsonError('config', 'BESTCHEF_PUSH_FANOUT_WORKER_SECRET is not configured.', 503);
  }
  if (!(await timingSafeEqual(suppliedWorkerSecret(req), expected))) {
    return jsonError('auth', 'Missing or invalid worker secret.', 401);
  }

  let limit = DEFAULT_BATCH_LIMIT;
  try {
    if (req.body) {
      const text = await req.text();
      if (text.trim()) {
        const body = JSON.parse(text) as { limit?: unknown };
        if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
          limit = body.limit;
        }
      }
    }
  } catch {
    return jsonError('invalid_body', 'Body must be JSON.', 400);
  }

  try {
    const result = await runPushFanout(deps, limit);
    return jsonResponse(result as unknown as Record<string, unknown>, result.ok ? 200 : 207);
  } catch (err) {
    captureError({ fn: 'bestchef-push-fanout', op: 'runPushFanout' }, err);
    return jsonError('fanout_failed', errorMessage(err), 500);
  }
}

// ── Supabase REST store ──────────────────────────────────────────────────────

function inList(values: string[]): string {
  return `(${values.map((v) => `"${encodeURIComponent(v)}"`).join(',')})`;
}

export function createSupabasePushFanoutStore(
  env: PushFanoutDeps['env'],
  fetchImpl: typeof fetch,
  now: () => string,
): PushFanoutStore {
  const baseUrl = stringOrNull(env('SUPABASE_URL'));
  const serviceKey = stringOrNull(env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!baseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  const url = baseUrl.replace(/\/+$/, '');

  async function rest(path: string, init: RequestInit, okStatuses: number[]): Promise<string> {
    const response = await fetchImpl(`${url}${path}`, {
      ...init,
      headers: {
        apikey: serviceKey!,
        Authorization: `Bearer ${serviceKey}`,
        ...JSON_HEADERS,
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!okStatuses.includes(response.status)) {
      throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}: ${text.slice(0, 200)}`);
    }
    return text;
  }

  return {
    async claimOutbox(limit: number): Promise<OutboxRow[]> {
      const select = 'id,notification_id,user_id,kind,params,target_type,target_id,attempts';
      const text = await rest(
        `/rest/v1/bc_push_outbox?select=${select}` +
          `&status=in.(queued,failed)&attempts=lt.${MAX_ATTEMPTS}` +
          `&order=created_at.asc&limit=${Math.floor(limit)}`,
        { method: 'GET' },
        [200],
      );
      return JSON.parse(text) as OutboxRow[];
    },

    async getTokensForUsers(userIds: string[]): Promise<PushTokenRow[]> {
      if (userIds.length === 0) return [];
      const text = await rest(
        `/rest/v1/bc_push_tokens?select=user_id,token,locale&user_id=in.${inList(userIds)}`,
        { method: 'GET' },
        [200],
      );
      return JSON.parse(text) as PushTokenRow[];
    },

    async markSent(outboxIds: string[]): Promise<void> {
      if (outboxIds.length === 0) return;
      await rest(
        `/rest/v1/bc_push_outbox?id=in.${inList(outboxIds)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'sent', sent_at: now(), updated_at: now() }),
        },
        [200, 204],
      );
    },

    async markSkipped(outboxIds: string[]): Promise<void> {
      if (outboxIds.length === 0) return;
      await rest(
        `/rest/v1/bc_push_outbox?id=in.${inList(outboxIds)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'skipped', updated_at: now() }),
        },
        [200, 204],
      );
    },

    async markFailed(outboxId: string, error: string): Promise<void> {
      // Read-modify-write on attempts would race; PostgREST cannot ++ a column,
      // so we fetch the current attempts then write attempts+1. The claim filter
      // (attempts < MAX_ATTEMPTS) plus the small batch size makes contention on
      // a single row unlikely, and a lost increment only costs one extra retry.
      const text = await rest(
        `/rest/v1/bc_push_outbox?select=attempts&id=eq.${encodeURIComponent(outboxId)}&limit=1`,
        { method: 'GET' },
        [200],
      );
      const current = (JSON.parse(text) as Array<{ attempts: number }>)[0]?.attempts ?? 0;
      await rest(
        `/rest/v1/bc_push_outbox?id=eq.${encodeURIComponent(outboxId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'failed',
            attempts: current + 1,
            last_error: error.slice(0, 500),
            updated_at: now(),
          }),
        },
        [200, 204],
      );
    },

    async deleteTokens(tokens: string[]): Promise<void> {
      if (tokens.length === 0) return;
      await rest(
        `/rest/v1/bc_push_tokens?token=in.${inList(tokens)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
        [200, 204],
      );
    },
  };
}

export function createExpoPushSender(fetchImpl: typeof fetch) {
  return async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
    const res = await fetchImpl(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      throw new Error(`Expo push failed with HTTP ${res.status}`);
    }
    const parsed = objectRecord(await res.json());
    const data = parsed.data;
    return Array.isArray(data) ? (data as ExpoPushTicket[]) : [];
  };
}

// ── Deno entrypoint ──────────────────────────────────────────────────────────

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    const now = () => new Date().toISOString();

    let store: PushFanoutStore;
    try {
      store = createSupabasePushFanoutStore(env, fetch, now);
    } catch (err) {
      return jsonError('config', errorMessage(err), 503);
    }

    return handlePushFanoutRequest(req, {
      env,
      now,
      store,
      sendPushChunk: createExpoPushSender(fetch),
    });
  });
}

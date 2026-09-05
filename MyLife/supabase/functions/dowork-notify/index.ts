/**
 * DoWork notify Edge Function (internal push fan-out).
 *
 * Authentication is the shared internal secret DOWORK_INTERNAL_SECRET, sent as
 * the x-dowork-internal header. Callers are other DoWork edge functions
 * (dowork-upload-finalize) and Supabase Database Webhooks configured on
 * dw_form_checks / dw_form_feedback inserts with that header. There is no
 * end-user path to this function.
 *
 *   POST { type, record } with x-dowork-internal
 *     new_video     record is a dw_trainer_videos row -> notifies active
 *                   subscribers + active clients of record.trainer_id.
 *     form_check    record is a dw_form_checks row -> notifies the link trainer.
 *     form_feedback record is a dw_form_feedback row -> notifies the other
 *                   participant (client or trainer, whichever is not the author).
 *     marketing     record is { title, body } -> notifies only the users who
 *                   opted into marketing (dw_notification_prefs.marketing = true).
 *
 * Preferences are enforced HERE, not on the device: Expo pushes cannot be
 * filtered after delivery, so per-type opt-outs are applied before the send.
 * For the three transactional types a recipient is dropped only if they have a
 * dw_notification_prefs row that turns that type off; a missing row means the
 * defaults (transactional on, marketing off). Marketing is opt-in, so its
 * audience is resolved from the prefs table directly.
 *
 * Expo push tickets are parsed; tokens whose ticket reports DeviceNotRegistered
 * are pruned from dw_push_tokens. Every send is best-effort per 100-message
 * chunk. Returns { ok, sent, pruned }.
 */

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;

export type NotifyType = 'new_video' | 'form_check' | 'form_feedback';
export type NotifySendType = NotifyType | 'marketing';

export interface NotificationPrefRow {
  user_id: string;
  new_video: boolean;
  form_check: boolean;
  form_feedback: boolean;
  marketing: boolean;
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

export interface NotifyStore {
  getTrainerName(trainerId: string): Promise<string | null>;
  getTrainerUserId(trainerId: string): Promise<string | null>;
  getActiveSubscriberUserIds(trainerId: string, nowIso: string): Promise<string[]>;
  getActiveClientUserIds(trainerId: string): Promise<string[]>;
  getClientLink(linkId: string): Promise<{ trainer_id: string; client_user_id: string | null } | null>;
  getFormCheck(formCheckId: string): Promise<{ client_link_id: string; author_user_id: string } | null>;
  getExpoTokens(userIds: string[]): Promise<Array<{ user_id: string; expo_token: string }>>;
  deleteExpoTokens(tokens: string[]): Promise<void>;
  getNotificationPrefs(userIds: string[]): Promise<NotificationPrefRow[]>;
  getMarketingRecipients(): Promise<string[]>;
}

// Coarse rate limiter. dowork-notify's only auth is the shared internal secret,
// so a leaked secret would otherwise drive unlimited push fan-out. This caps
// accepted requests per window; over the cap returns 429 (BK-2).
export interface RateLimiter {
  // Returns true if this request is within the cap, false if it should be
  // rejected. Called once per authenticated request.
  check: (now: number) => boolean;
}

export interface NotifyDeps {
  store: NotifyStore;
  internalSecret: string;
  sendPushChunk: (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;
  now: () => number;
  // Optional so existing callers/tests that do not care about throttling are
  // unaffected; the Deno entrypoint always supplies one.
  rateLimiter?: RateLimiter;
}

// Fixed-window counter. Scope is a SINGLE edge-function isolate: Supabase may
// run several isolates concurrently, so the effective global cap is
// (maxRequests * live isolates), not a hard cluster-wide number. That is an
// honest, deliberately coarse backstop against a leaked-secret fan-out flood,
// not a precise quota. The window resets in place rather than tracking
// individual timestamps, which keeps it allocation-free per request.
export function createFixedWindowRateLimiter(
  maxRequests: number,
  windowMs: number,
): RateLimiter {
  let windowStart = 0;
  let count = 0;
  return {
    check: (now: number): boolean => {
      if (now - windowStart >= windowMs) {
        windowStart = now;
        count = 0;
      }
      count += 1;
      return count <= maxRequests;
    },
  };
}

export const DEFAULT_RATE_LIMIT_MAX = 120;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

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

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

// Constant-time string compare (BK-2). A plain `!==` short-circuits on the
// first mismatched byte, so its timing leaks how many leading characters of
// the internal secret an attacker has guessed. Always compares every
// character of both strings and folds the length check into the same
// constant-time accumulation instead of returning early on a length mismatch.
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    diff |= charA ^ charB;
  }
  return diff === 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

interface ResolvedNotification {
  recipients: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
}

async function resolveNotification(
  type: NotifySendType,
  record: Record<string, unknown>,
  deps: NotifyDeps,
): Promise<ResolvedNotification | null> {
  const author = stringOrNull(record.author_user_id);

  if (type === 'marketing') {
    const body = stringOrNull(record.body);
    if (!body) return null;
    const recipients = await deps.store.getMarketingRecipients();
    return {
      recipients: unique(recipients),
      title: stringOrNull(record.title) ?? 'DoWork',
      body,
      data: { type },
    };
  }

  if (type === 'new_video') {
    const trainerId = stringOrNull(record.trainer_id);
    if (!trainerId) return null;
    const nowIso = new Date(deps.now()).toISOString();
    const [subscribers, clients, trainerName] = await Promise.all([
      deps.store.getActiveSubscriberUserIds(trainerId, nowIso),
      deps.store.getActiveClientUserIds(trainerId),
      deps.store.getTrainerName(trainerId),
    ]);
    return {
      recipients: unique([...subscribers, ...clients]),
      title: `New workout from ${trainerName ?? 'your trainer'}`,
      body: stringOrNull(record.title) ?? 'A new video is available.',
      data: { type, videoId: stringOrNull(record.id), trainerId },
    };
  }

  if (type === 'form_check') {
    const linkId = stringOrNull(record.client_link_id);
    if (!linkId) return null;
    const link = await deps.store.getClientLink(linkId);
    if (!link) return { recipients: [], title: '', body: '', data: {} };
    const trainerUserId = await deps.store.getTrainerUserId(link.trainer_id);
    const recipients = unique([trainerUserId ?? '']).filter((id) => id !== author);
    return {
      recipients,
      title: 'New form check',
      body: 'New form check from your client',
      data: { type, formCheckId: stringOrNull(record.id) },
    };
  }

  if (type === 'form_feedback') {
    const formCheckId = stringOrNull(record.form_check_id);
    if (!formCheckId) return null;
    const formCheck = await deps.store.getFormCheck(formCheckId);
    if (!formCheck) return { recipients: [], title: '', body: '', data: {} };
    const link = await deps.store.getClientLink(formCheck.client_link_id);
    if (!link) return { recipients: [], title: '', body: '', data: {} };
    const trainerUserId = await deps.store.getTrainerUserId(link.trainer_id);
    const recipients = unique([link.client_user_id ?? '', trainerUserId ?? '']).filter(
      (id) => id !== author,
    );
    return {
      recipients,
      title: 'New feedback',
      body: 'Your trainer left feedback',
      data: { type, formCheckId, feedbackId: stringOrNull(record.id) },
    };
  }

  return null;
}

// Drop recipients who opted out of this transactional type. A missing prefs row
// means the defaults (the type is on), so only an explicit `false` removes a
// recipient. Marketing is opt-in and already scoped, so it passes through.
async function filterByPreference(
  type: NotifySendType,
  recipients: string[],
  store: NotifyStore,
): Promise<string[]> {
  if (type === 'marketing' || recipients.length === 0) return recipients;
  const prefs = await store.getNotificationPrefs(recipients);
  const disabled = new Set<string>();
  for (const row of prefs) {
    if (row[type] === false) disabled.add(row.user_id);
  }
  if (disabled.size === 0) return recipients;
  return recipients.filter((id) => !disabled.has(id));
}

export async function handleDoWorkNotifyRequest(req: Request, deps: NotifyDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return errorJson('method_not_allowed', 405);
  }

  const secret = req.headers.get('x-dowork-internal');
  if (!deps.internalSecret || !secret || !timingSafeEqual(secret, deps.internalSecret)) {
    return errorJson('unauthorized', 401);
  }

  // Throttle only authenticated requests: an unauthenticated flood is already
  // rejected at 401 above without touching the store or Expo (BK-2).
  if (deps.rateLimiter && !deps.rateLimiter.check(deps.now())) {
    return errorJson('rate_limited', 429);
  }

  let body: Record<string, unknown>;
  try {
    body = objectRecord(await req.json());
  } catch {
    return errorJson('invalid_input', 400);
  }

  const type = stringOrNull(body.type) as NotifySendType | null;
  if (
    type !== 'new_video' &&
    type !== 'form_check' &&
    type !== 'form_feedback' &&
    type !== 'marketing'
  ) {
    return errorJson('invalid_input', 400);
  }

  const record = objectRecord(body.record);
  const resolved = await resolveNotification(type, record, deps);
  if (!resolved) {
    return errorJson('invalid_input', 400);
  }

  const recipients = await filterByPreference(type, resolved.recipients, deps.store);
  if (recipients.length === 0) {
    return jsonResponse({ ok: true, sent: 0, pruned: 0 });
  }

  const tokenRows = await deps.store.getExpoTokens(recipients);
  if (tokenRows.length === 0) {
    return jsonResponse({ ok: true, sent: 0, pruned: 0 });
  }

  const entries = tokenRows.map((row) => ({
    token: row.expo_token,
    message: {
      to: row.expo_token,
      title: resolved.title,
      body: resolved.body,
      sound: 'default',
      data: resolved.data,
    } satisfies ExpoPushMessage,
  }));

  let sent = 0;
  const toPrune: string[] = [];
  for (const group of chunk(entries, CHUNK_SIZE)) {
    let tickets: ExpoPushTicket[] = [];
    try {
      tickets = await deps.sendPushChunk(group.map((e) => e.message));
    } catch {
      continue;
    }
    group.forEach((entry, index) => {
      const ticket = tickets[index];
      if (!ticket) return;
      if (ticket.status === 'ok') {
        sent += 1;
      } else if (ticket.details?.error === 'DeviceNotRegistered') {
        toPrune.push(entry.token);
      }
    });
  }

  const pruneTokens = unique(toPrune);
  if (pruneTokens.length > 0) {
    try {
      await deps.store.deleteExpoTokens(pruneTokens);
    } catch {
      // best-effort prune
    }
  }

  return jsonResponse({ ok: true, sent, pruned: pruneTokens.length });
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

function inList(values: string[]): string {
  return `(${values.map((v) => `"${encodeURIComponent(v)}"`).join(',')})`;
}

class SupabaseNotifyStore implements NotifyStore {
  constructor(
    private readonly config: { url: string; key: string },
    private readonly fetchImpl: typeof fetch,
  ) {}

  async getTrainerName(trainerId: string): Promise<string | null> {
    const rows = await this.restJson<Array<{ display_name: string | null }>>(
      `/rest/v1/dw_trainers?select=display_name&id=eq.${encodeURIComponent(trainerId)}&limit=1`,
    );
    return stringOrNull(rows[0]?.display_name ?? null);
  }

  async getTrainerUserId(trainerId: string): Promise<string | null> {
    const rows = await this.restJson<Array<{ user_id: string }>>(
      `/rest/v1/dw_trainers?select=user_id&id=eq.${encodeURIComponent(trainerId)}&limit=1`,
    );
    return rows[0]?.user_id ?? null;
  }

  async getActiveSubscriberUserIds(trainerId: string, nowIso: string): Promise<string[]> {
    const rows = await this.restJson<Array<{ user_id: string }>>(
      `/rest/v1/dw_trainer_subscriptions?select=user_id&trainer_id=eq.${encodeURIComponent(trainerId)}` +
        `&status=eq.active&or=(current_period_end.is.null,current_period_end.gt.${encodeURIComponent(nowIso)})`,
    );
    return rows.map((r) => r.user_id);
  }

  async getActiveClientUserIds(trainerId: string): Promise<string[]> {
    const rows = await this.restJson<Array<{ client_user_id: string | null }>>(
      `/rest/v1/dw_client_links?select=client_user_id&trainer_id=eq.${encodeURIComponent(trainerId)}&status=eq.active`,
    );
    return rows.map((r) => r.client_user_id).filter((id): id is string => Boolean(id));
  }

  async getClientLink(
    linkId: string,
  ): Promise<{ trainer_id: string; client_user_id: string | null } | null> {
    const rows = await this.restJson<Array<{ trainer_id: string; client_user_id: string | null }>>(
      `/rest/v1/dw_client_links?select=trainer_id,client_user_id&id=eq.${encodeURIComponent(linkId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getFormCheck(
    formCheckId: string,
  ): Promise<{ client_link_id: string; author_user_id: string } | null> {
    const rows = await this.restJson<Array<{ client_link_id: string; author_user_id: string }>>(
      `/rest/v1/dw_form_checks?select=client_link_id,author_user_id&id=eq.${encodeURIComponent(formCheckId)}&limit=1`,
    );
    return rows[0] ?? null;
  }

  async getExpoTokens(userIds: string[]): Promise<Array<{ user_id: string; expo_token: string }>> {
    if (userIds.length === 0) return [];
    return this.restJson<Array<{ user_id: string; expo_token: string }>>(
      `/rest/v1/dw_push_tokens?select=user_id,expo_token&user_id=in.${inList(userIds)}`,
    );
  }

  async deleteExpoTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.restJson<unknown>(
      `/rest/v1/dw_push_tokens?expo_token=in.${inList(tokens)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      [200, 204],
    );
  }

  async getNotificationPrefs(userIds: string[]): Promise<NotificationPrefRow[]> {
    if (userIds.length === 0) return [];
    return this.restJson<NotificationPrefRow[]>(
      `/rest/v1/dw_notification_prefs` +
        `?select=user_id,new_video,form_check,form_feedback,marketing&user_id=in.${inList(userIds)}`,
    );
  }

  async getMarketingRecipients(): Promise<string[]> {
    const rows = await this.restJson<Array<{ user_id: string }>>(
      `/rest/v1/dw_notification_prefs?select=user_id&marketing=eq.true`,
    );
    return rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));
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

export function createSupabaseNotifyStore(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): NotifyStore {
  return new SupabaseNotifyStore(ensureServiceConfig(env), fetchImpl);
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

if (typeof Deno !== 'undefined' && Deno?.serve) {
  // One limiter per isolate, created once at module load so its window persists
  // across requests handled by the same isolate (BK-2).
  const rateLimiter = createFixedWindowRateLimiter(
    DEFAULT_RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  Deno.serve((req) => {
    const env = (key: string) => Deno!.env.get(key);
    const internalSecret = stringOrNull(env('DOWORK_INTERNAL_SECRET'));
    if (!internalSecret) {
      return errorJson('config_error', 503);
    }
    let store: NotifyStore;
    try {
      store = createSupabaseNotifyStore(env, fetch);
    } catch {
      return errorJson('config_error', 503);
    }
    return handleDoWorkNotifyRequest(req, {
      store,
      internalSecret,
      sendPushChunk: createExpoPushSender(fetch),
      now: () => Date.now(),
      rateLimiter,
    });
  });
}

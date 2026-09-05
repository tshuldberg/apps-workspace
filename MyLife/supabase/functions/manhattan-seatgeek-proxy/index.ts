/**
 * Manhattan SeatGeek discovery proxy.
 *
 * The standalone Manhattan app is local-first with no login, so this proxy is
 * public (deploy with --no-verify-jwt) and exists for exactly one reason: the
 * SeatGeek client_id must never ship inside the Expo bundle. The credential
 * lives in `Deno.env.SEATGEEK_CLIENT_ID`.
 *
 * Client contract (modules/manhattan/src/sources/seatgeek.ts):
 *   GET {EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL}/sources/seatgeek/events
 *       ?city=<name>&limit=<n>
 *   -> 200 with SeatGeek's raw `{ events: [...] }` JSON, which the adapter
 *      maps on-device. Errors return `{ events: [] }` with a non-200 status;
 *      the adapter treats any !ok response as an empty result.
 *
 * Deploy:
 *   supabase secrets set SEATGEEK_CLIENT_ID=<id>
 *   supabase functions deploy manhattan-seatgeek-proxy --no-verify-jwt
 *   then set EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL to
 *   https://<project-ref>.functions.supabase.co/manhattan-seatgeek-proxy
 */

import { createInMemoryRateLimiter } from '../_shared/broker.ts';

declare const Deno:
  | {
      env: { get(key: string): string | undefined };
      serve?: (handler: (req: Request) => Response | Promise<Response>) => void;
    }
  | undefined;

const SEATGEEK_ENDPOINT = 'https://api.seatgeek.com/2/events';
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_LIMIT = 50;
// Public endpoint: keep the per-caller budget tight. Discovery refresh is a
// single user-initiated request, so 30/min per IP is generous.
const RATE_LIMIT = { max: 30, windowMs: 60_000 };

const limiter = createInMemoryRateLimiter();

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function callerKey(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'anonymous'
  );
}

export async function handleRequest(
  req: Request,
  clientId: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return json({ events: [], error: 'method_not_allowed' }, 405);
  }

  const url = new URL(req.url);
  if (!url.pathname.endsWith('/sources/seatgeek/events')) {
    return json({ events: [], error: 'not_found' }, 404);
  }

  if (!limiter.consume(callerKey(req), 'seatgeek_events', RATE_LIMIT.max, RATE_LIMIT.windowMs)) {
    return json({ events: [], error: 'rate_limited' }, 429);
  }

  if (!clientId) {
    return json({ events: [], error: 'proxy_not_configured' }, 503);
  }

  const city = (url.searchParams.get('city') ?? 'New York').slice(0, 80);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : MAX_LIMIT;

  const upstream =
    `${SEATGEEK_ENDPOINT}?client_id=${encodeURIComponent(clientId)}` +
    `&venue.city=${encodeURIComponent(city)}&per_page=${limit}`;

  try {
    const res = await fetchImpl(upstream, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Never leak upstream auth details; the adapter only needs !ok.
      const status = res.status === 429 ? 429 : 502;
      return json({ events: [], error: 'upstream_error' }, status);
    }
    const body = (await res.json()) as { events?: unknown[] };
    return json({ events: Array.isArray(body.events) ? body.events : [] }, 200);
  } catch {
    return json({ events: [], error: 'upstream_timeout' }, 504);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve((req) => handleRequest(req, Deno?.env.get('SEATGEEK_CLIENT_ID')));
}

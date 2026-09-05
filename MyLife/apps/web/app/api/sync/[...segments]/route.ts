import { NextRequest, NextResponse } from 'next/server';
import { getModeConfig } from '@/lib/entitlements';
import { resolveApiBaseUrl } from '@/lib/server-endpoint';

export const runtime = 'nodejs';

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
}

function getAllowedHosts(): string[] | null {
  const envValue = process.env.MYLIFE_SYNC_ALLOWED_HOSTS;
  if (!envValue) return null;
  return envValue.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function isHostAllowed(hostname: string, configuredHost: string | null): boolean {
  const allowedHosts = getAllowedHosts();
  if (allowedHosts) {
    return allowedHosts.includes(hostname.toLowerCase());
  }
  if (configuredHost) {
    return hostname.toLowerCase() === configuredHost.toLowerCase();
  }
  return false;
}

/**
 * Build the server's own base URL from trusted server-side sources.
 *
 * Historically this read `x-forwarded-host` / `x-forwarded-proto` from the
 * request, which opened an SSRF window: when the allowlist env was unset and
 * hosted mode fell back to this helper, an attacker who could set those
 * headers (missing ingress scrubbing, direct-access edge cases) could trick
 * the proxy into forwarding the actor's identity token to an attacker-
 * controlled host that the self-match check then approved.
 *
 * We now prefer `MYLIFE_PUBLIC_BASE_URL` (trusted env), fall back to
 * `NEXT_PUBLIC_APP_URL`, and only as a last resort use `request.nextUrl`
 * (never the forwarded headers). If none of those resolve to a usable URL
 * we return null so the caller fails closed.
 */
function buildCurrentBaseUrl(request: NextRequest): string | null {
  const envBase = (process.env.MYLIFE_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (envBase) return envBase;

  // Fallback uses `request.nextUrl` (origin reported by Next.js) instead of
  // the forwarded headers. This is safe because `request.nextUrl` reflects
  // the host the Node server actually bound to, not an attacker-controlled
  // header value.
  const host = request.nextUrl.host;
  if (!host) return null;
  const protocol = request.nextUrl.protocol.replace(':', '') || 'http';
  return `${protocol}://${host}`;
}

function resolveTargetBaseUrl(request: NextRequest): string | null {
  const mode = getModeConfig();
  if (mode.mode === 'local_only') {
    return buildCurrentBaseUrl(request);
  }

  const resolved = resolveApiBaseUrl(mode.mode, mode.serverUrl);
  if (resolved.ok && resolved.url) {
    return resolved.url;
  }

  if (mode.mode === 'hosted') {
    // Hosted fallback: only allowed when an explicit allowlist is configured
    // via MYLIFE_SYNC_ALLOWED_HOSTS. Without that, fail closed instead of
    // trusting the request's reported host (see SSRF finding).
    const allowlist = process.env.MYLIFE_SYNC_ALLOWED_HOSTS?.trim();
    if (!allowlist) return null;
    return buildCurrentBaseUrl(request);
  }

  return null;
}

function validateTargetUrl(target: URL, configuredHost: string | null): string | null {
  if (target.protocol !== 'https:') {
    const isLocalDev = process.env.NODE_ENV === 'development';
    if (!isLocalDev) {
      return 'Sync proxy requires HTTPS target.';
    }
  }

  if (isPrivateHost(target.hostname)) {
    const isLocalDev = process.env.NODE_ENV === 'development';
    if (!isLocalDev) {
      return 'Sync proxy target resolves to a private address.';
    }
  }

  if (!isHostAllowed(target.hostname, configuredHost)) {
    const isSelfProxy = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    const isLocalDev = process.env.NODE_ENV === 'development';
    if (!(isSelfProxy && isLocalDev)) {
      return 'Sync proxy target host is not in the allowed list.';
    }
  }

  return null;
}

async function proxy(request: NextRequest, method: 'GET' | 'POST' | 'DELETE') {
  const segments = request.nextUrl.pathname
    .replace(/^\/api\/sync\/?/, '')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) {
    return NextResponse.json({ error: 'Sync path is required.' }, { status: 400 });
  }

  if (segments[0] === 'sync') {
    return NextResponse.json({ error: 'Recursive sync route is not allowed.' }, { status: 400 });
  }

  const baseUrl = resolveTargetBaseUrl(request);
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'No remote sync endpoint is configured for current mode.' },
      { status: 400 },
    );
  }

  const target = new URL(`/api/${segments.join('/')}`, `${baseUrl}/`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  let configuredHost: string | null = null;
  try {
    configuredHost = new URL(baseUrl).hostname;
  } catch { /* use null */ }

  const validationError = validateTargetUrl(target, configuredHost);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 403 });
  }

  const outboundHeaders = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) outboundHeaders.set('content-type', contentType);
  const actorToken = request.headers.get('x-actor-identity-token');
  if (actorToken) outboundHeaders.set('x-actor-identity-token', actorToken);
  const entitlementSyncKey = request.headers.get('x-entitlement-sync-key');
  if (entitlementSyncKey) outboundHeaders.set('x-entitlement-sync-key', entitlementSyncKey);

  const body = method === 'GET' ? undefined : await request.text();
  const response = await fetch(target.toString(), {
    method,
    headers: outboundHeaders,
    body: method === 'GET' ? undefined : body,
    cache: 'no-store',
  });

  const raw = await response.text();
  const responseHeaders = new Headers();
  const responseContentType = response.headers.get('content-type');
  if (responseContentType) {
    responseHeaders.set('content-type', responseContentType);
  }

  return new NextResponse(raw, {
    status: response.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST');
}

export async function DELETE(request: NextRequest) {
  return proxy(request, 'DELETE');
}

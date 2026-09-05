import { NextResponse } from 'next/server';
import { readCloudEnv } from '@/lib/env';
import { CLOUD_WRITE_TIMEOUT_MS, createBoundedFetch } from '@/lib/http';
import { isSameOriginRequest } from '@/lib/request-origin';
import { platformClientIp, signDmcaClientIp } from './rate-security';

export const dynamic = 'force-dynamic';

// Anonymous legal intake still needs a trustworthy client-risk signal. The web
// server reads the ONE trusted client-IP header this deployment declares (see
// rate-security.ts), signs the IP and timestamp with the server-only rate salt,
// and forwards that proof to the edge function. The edge verifies it before
// deriving durable IP and email HMAC buckets. Missing trusted-header config, IP,
// salt, signature capability, or edge availability fails closed.

const dmcaEdgeFetch = createBoundedFetch(CLOUD_WRITE_TIMEOUT_MS);

export async function POST(request: Request) {
  // Cross-site POSTs to a state-changing legal-intake endpoint are rejected: a
  // forged cross-origin submission is never a legitimate notice.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const env = readCloudEnv();
  const rateSalt = (process.env.MYNEWS_DMCA_RATE_SALT ?? '').trim();
  const clientIp = platformClientIp(
    request.headers,
    process.env.MYNEWS_TRUSTED_CLIENT_IP_HEADER,
  );
  if (!env || rateSalt.length < 32) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }
  if (!clientIp) {
    return NextResponse.json(
      { ok: false, error: 'temporarily-unavailable' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
  }

  try {
    const timestamp = Date.now();
    const signature = await signDmcaClientIp(rateSalt, clientIp, timestamp);
    const response = await dmcaEdgeFetch(`${env.baseUrl}/functions/v1/mynews-dmca`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
        'X-MyNews-Client-IP': clientIp,
        'X-MyNews-Proxy-Timestamp': String(timestamp),
        'X-MyNews-Proxy-Signature': signature,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok: boolean; error?: string; data?: unknown }
      | null;
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      return NextResponse.json(payload, { status: response.status });
    }
    return NextResponse.json(
      { ok: false, error: 'temporarily-unavailable' },
      { status: 502 },
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'network' }, { status: 502 });
  }
}

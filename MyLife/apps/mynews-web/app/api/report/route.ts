import { NextResponse } from 'next/server';
import {
  REPORT_REASONS,
  REPORT_TARGET_KINDS,
  type ReportReason,
  type ReportTargetKind,
} from '@mylife/mynews/cloud-fetch';
import { readCloudEnv } from '@/lib/env';
import { CLOUD_WRITE_TIMEOUT_MS, createBoundedFetch } from '@/lib/http';
import { isSameOriginRequest } from '@/lib/request-origin';
import { readReaderSession } from '@/lib/reader-auth';

export const dynamic = 'force-dynamic';

// Route handler that forwards a report to the mynews-report edge function, which
// requires an authenticated session (verify_jwt ON) and attributes the report to
// a profile so the WP1 intake RPC's abuse controls have an identity to work with.
//
// Plan 48 WP10: the token now comes from the reader's own cookie session, read
// and VERIFIED server-side (`readReaderSession` calls getUser() before handing
// the token over). The browser never holds the JWT in JavaScript, so a stolen
// XSS foothold cannot exfiltrate it, and the site does not have to trust a bearer
// the caller supplied. With no session the anon key goes out instead and the
// function honestly answers 'not-signed-in', which the client renders as the
// sign-in sheet.
//
// Never fabricates success: the typed envelope from the function is returned
// verbatim (or an honest error when unconfigured/unreachable).

const boundedFetch = createBoundedFetch(CLOUD_WRITE_TIMEOUT_MS);

const TARGET_KINDS = new Set<string>(REPORT_TARGET_KINDS);
const REASONS = new Set<string>(REPORT_REASONS);

interface Body {
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail: string;
}

function parseBody(raw: unknown): Body | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.targetKind !== 'string' || !TARGET_KINDS.has(b.targetKind)) return null;
  if (typeof b.targetId !== 'string' || b.targetId.trim() === '') return null;
  if (typeof b.reason !== 'string' || !REASONS.has(b.reason)) return null;
  const detail = typeof b.detail === 'string' ? b.detail : '';
  if (detail.length > 2000) return null;
  return {
    targetKind: b.targetKind as ReportTargetKind,
    targetId: b.targetId,
    reason: b.reason as ReportReason,
    detail,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const env = readCloudEnv();
  if (!env) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }

  let body: Body | null = null;
  try {
    body = parseBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  // The reader's verified session token, or the anon key when there is no
  // session (the function answers 'not-signed-in', which is the honest state).
  const session = await readReaderSession();
  const bearer = session?.accessToken ?? env.anonKey;

  try {
    const res = await boundedFetch(`${env.baseUrl}/functions/v1/mynews-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.anonKey,
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const payload = (await res.json().catch(() => null)) as
      | { ok: boolean; error?: string; data?: unknown }
      | null;
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      return NextResponse.json(payload, { status: res.ok ? 200 : res.status });
    }
    return NextResponse.json({ ok: false, error: `function-${res.status}` }, { status: 502 });
  } catch {
    // Configured but unreachable: honest network error, never a fake success.
    return NextResponse.json({ ok: false, error: 'network' }, { status: 502 });
  }
}

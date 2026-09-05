import { NextResponse } from 'next/server';
import { isCompleteCode, normalizeCode, normalizeEmail } from '@/lib/otp-flow';
import { createReaderSupabase, isReaderAuthConfigured } from '@/lib/reader-auth';
import { isSameOriginRequest } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * Verifies an email OTP and establishes the reader's cookie session (plan 48
 * WP10, C10).
 *
 * A route handler rather than a server action because the reader is mid-report:
 * the client posts here with `fetch`, so nothing navigates and the reason and
 * detail they already typed stay in the form. Route handlers can write cookies,
 * which is what makes the session stick.
 *
 * Verification attempts are bounded by Supabase Auth's own per-address limits.
 * Every failure returns the same `invalid-code`, so the response never
 * distinguishes "wrong code" from "expired code" from "no such user", which
 * would otherwise be an enumeration signal.
 */
export async function POST(request: Request): Promise<Response> {
  // Session fixation guard: this endpoint CREATES a session, so a cross-site
  // POST that plants the attacker's email+code would sign the victim in as the
  // attacker. Reject anything not same-origin before touching auth.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (!isReaderAuthConfigured()) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }

  let email = '';
  let token = '';
  try {
    const raw = (await request.json()) as unknown;
    if (typeof raw === 'object' && raw !== null) {
      const body = raw as Record<string, unknown>;
      email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
      token = normalizeCode(typeof body.code === 'string' ? body.code : '');
    }
  } catch {
    email = '';
  }

  if (!email || !isCompleteCode(token)) {
    return NextResponse.json({ ok: false, error: 'invalid-code' }, { status: 400 });
  }

  const supabase = await createReaderSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.user) {
      return NextResponse.json({ ok: false, error: 'invalid-code' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'network' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

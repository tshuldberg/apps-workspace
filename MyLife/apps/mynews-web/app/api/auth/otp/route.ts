import { NextResponse, after } from 'next/server';
import { isPlausibleEmail, normalizeEmail } from '@/lib/otp-flow';
import { publicOrigin } from '@/lib/origin';
import { safeNextPath } from '@/lib/next-path';
import { createReaderSupabase, isReaderAuthConfigured } from '@/lib/reader-auth';
import { isSameOriginRequest } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * Sends a reader an email OTP (plan 48 WP10, C10).
 *
 * Two properties this route holds deliberately:
 *
 * 1. **It does not reveal whether an account exists.** A successful send and a
 *    "no such user" both return `{ ok: true }`, and both take at least
 *    `MIN_RESPONSE_MS`, so neither the body nor the latency turns this endpoint
 *    into an account-existence oracle for arbitrary email addresses. Real send
 *    failures are logged server-side.
 * 2. **It never creates an account.** `shouldCreateUser: false`. A reader without
 *    a MyNews account has no profile, and a report needs one; minting an auth-only
 *    user here would produce a session that authenticates and then fails, which
 *    reads as a broken site instead of "sign up in the app".
 *
 * Send-rate abuse is bounded by Supabase Auth's own per-address and per-IP email
 * limits. This route adds no second bucket of its own: a per-instance counter
 * would be neither durable nor shared across instances, so it would report a
 * protection it does not provide.
 */

const MIN_RESPONSE_MS = 700;

async function floorDelay(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  if (!isReaderAuthConfigured()) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }

  let email = '';
  let nextPath = '/';
  try {
    const raw = (await request.json()) as unknown;
    if (typeof raw === 'object' && raw !== null) {
      const body = raw as Record<string, unknown>;
      email = normalizeEmail(typeof body.email === 'string' ? body.email : '');
      nextPath = safeNextPath(typeof body.next === 'string' ? body.next : null);
    }
  } catch {
    email = '';
  }

  if (!isPlausibleEmail(email)) {
    await floorDelay(startedAt);
    return NextResponse.json({ ok: false, error: 'invalid-email' }, { status: 400 });
  }

  const supabase = await createReaderSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 503 });
  }

  const redirectTo = `${publicOrigin()}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  // The send runs AFTER the response flushes (next/server `after`), so the
  // response latency no longer depends on whether the address exists. Padding
  // only bounded the negative path: an existing address made GoTrue send mail
  // inline, spreading the response between 700ms and the auth timeout, while a
  // non-existent one was rejected without SMTP and clustered at exactly the
  // floor. Both are now indistinguishable: every reply lands at the fixed floor,
  // and the mail work happens off the response path where its duration cannot be
  // measured. `after` keeps the invocation alive until the send completes.
  after(async () => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (error) {
        // Logged, not returned: the message distinguishes "no such user" from a
        // transport failure, and handing that to the caller is the oracle this
        // route exists to avoid.
        console.error(`mynews-web: OTP send failed: ${error.message}`);
      }
    } catch (cause) {
      console.error(`mynews-web: OTP send threw: ${String(cause)}`);
    }
  });

  await floorDelay(startedAt);
  return NextResponse.json({ ok: true });
}

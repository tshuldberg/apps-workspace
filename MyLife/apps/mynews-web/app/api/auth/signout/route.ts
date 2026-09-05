import { NextResponse } from 'next/server';
import { createReaderSupabase } from '@/lib/reader-auth';
import { isSameOriginRequest } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

/**
 * Ends the reader's website session (plan 48 WP10).
 *
 * `scope: 'local'` matters: this Supabase project is shared with the MyNews app,
 * and a reader signing out of the website must not be signed out of their phone.
 * Returns ok even when there was no session, so the button is idempotent.
 */
export async function POST(request: Request): Promise<Response> {
  // Forced-logout CSRF guard: a cross-site POST should not be able to sign a
  // reader out mid-report.
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  const supabase = await createReaderSupabase();
  if (!supabase) return NextResponse.json({ ok: true });
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Auth unreachable. The local cookies are cleared by the SDK before the
    // network call, so the reader is signed out here regardless.
  }
  return NextResponse.json({ ok: true });
}

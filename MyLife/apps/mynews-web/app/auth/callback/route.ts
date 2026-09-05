import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/next-path';
import { createReaderSupabase } from '@/lib/reader-auth';

export const dynamic = 'force-dynamic';

/**
 * Magic-link landing for the reader sign-in email (plan 48 WP10).
 *
 * The code path (paste the six digits back into the report card) is the primary
 * flow because it keeps the reader on the page they were reporting. This exists
 * for the reader who clicks the link in the email instead: it exchanges the code
 * for a session and returns them to the page they started from, which arrives as
 * `?next=`.
 *
 * `next` comes from a URL, so it goes through `safeNextPath` before any redirect.
 * Without that guard, a MyNews sign-in link would double as an open redirector.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const destination = safeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');

  const failure = new URL(destination, url.origin);
  failure.searchParams.set('signin', 'failed');

  if (!code) return NextResponse.redirect(failure);

  const supabase = await createReaderSupabase();
  if (!supabase) return NextResponse.redirect(failure);

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
  } catch {
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}

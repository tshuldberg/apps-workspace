/**
 * Reader sign-in for the public site (plan 48 WP10, finding C10).
 *
 * Reporting requires an authenticated account: `mynews-report` runs with
 * `verify_jwt` on, and the intake RPC attributes the report to a profile so the
 * abuse controls (per-reporter throttle, open-report dedupe, severity
 * escalation) have an identity to work with. Until now the website had no way to
 * produce one, so the report form could only ever render "not signed in" and
 * send the reader to the app.
 *
 * This wires cookie-session email OTP against the SAME Supabase auth project the
 * app uses, so a reader's MyNews account signs in on the web with no second
 * identity and no second account system.
 *
 * Deliberate constraints:
 *
 *  - `shouldCreateUser: false`. The website never creates accounts. Reporting
 *    needs a profile row, which is created during app onboarding; an account
 *    minted here would authenticate and then fail with `no-profile`, which reads
 *    as a broken site rather than the honest "sign up in the app".
 *  - Sign-out uses `scope: 'local'`. The Supabase project is shared with the
 *    app, and signing out of the website must not revoke the reader's session on
 *    their phone.
 *  - Session reads are skipped entirely when the request carries no `sb-` cookie.
 *    Most readers are anonymous, and every article render would otherwise pay an
 *    auth round trip to learn something the cookie jar already proves.
 *  - Every auth call goes through a bounded fetch, so a slow auth service
 *    degrades the report card rather than the article behind it.
 */
import 'server-only';

import { cache } from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readCloudEnv } from './env';
import { AUTH_TIMEOUT_MS, createBoundedFetch } from './http';

const boundedFetch = createBoundedFetch(AUTH_TIMEOUT_MS);

/**
 * Reader auth rides the same project as the reads, so one env pair configures
 * both. There is no separate flag: if the site can read the record, it can
 * authenticate against the record's project.
 */
export function isReaderAuthConfigured(): boolean {
  return readCloudEnv() !== null;
}

type SupabaseServerClient = ReturnType<typeof createServerClient>;

/**
 * Cookie-session Supabase client, or null when this deployment has no cloud.
 *
 * Cookie writes are attempted and swallowed on failure: a Server Component
 * cannot write cookies, which is the documented `@supabase/ssr` shape. Route
 * handlers, server actions, and middleware CAN, and those are where every write
 * in this app happens (OTP verify, sign-out, and the middleware refresh).
 */
export async function createReaderSupabase(): Promise<SupabaseServerClient | null> {
  const env = readCloudEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient(env.baseUrl, env.anonKey, {
    global: { fetch: boundedFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Read-only cookie store (Server Component render). Middleware
          // refreshes the session, so dropping the write here loses nothing.
        }
      },
    },
  });
}

export interface ReaderSession {
  userId: string;
  email: string | null;
  /** Verified access token, forwarded to the report edge function. */
  accessToken: string;
}

/** True when the request carries a Supabase auth cookie at all. */
async function hasAuthCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.getAll().some((cookie) => cookie.name.startsWith('sb-'));
}

/**
 * The signed-in reader, or null.
 *
 * `getUser()` before the token is used: it validates the JWT against the auth
 * server rather than trusting the cookie's contents, which is the difference
 * between a session check and a decoded claim. The token is only read from the
 * session AFTER that check passes.
 *
 * Returns null (never throws) when auth is unreachable: an auth outage must
 * degrade the report card to its signed-out state, not take down the article.
 *
 * Memoized per request. The layout (to decide whether to offer sign-out) and the
 * page (to decide what the report card shows) both ask, and one render must not
 * cost two auth round trips.
 */
export const readReaderSession = cache(async (): Promise<ReaderSession | null> => {
  if (!isReaderAuthConfigured()) return null;
  if (!(await hasAuthCookie())) return null;

  const supabase = await createReaderSupabase();
  if (!supabase) return null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    return { userId: user.id, email: user.email ?? null, accessToken: session.access_token };
  } catch {
    return null;
  }
});

/** Whether a reader is signed in, without needing the token. */
export async function isReaderSignedIn(): Promise<boolean> {
  return (await readReaderSession()) !== null;
}

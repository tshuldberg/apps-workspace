import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isModeratorEmail, parseModeratorAllowlist } from './lib/allowlist';
import { ENV_MODERATOR_EMAILS, ENV_SUPABASE_ANON_KEY, ENV_SUPABASE_URL } from './lib/env-names';
import { buildConsoleCsp, createNonce, supabaseConnectOrigin } from './lib/security-headers';

/**
 * Session refresh + first authorization gate + Content-Security-Policy.
 *
 * requireModerator() re-checks inside every page and server action; the auth work
 * here exists to refresh auth cookies and keep unauthorized traffic off the app
 * entirely.
 *
 * The CSP lives here (plan 48 WP10) rather than in `next.config.ts` because it
 * carries a per-response nonce, which a static config cannot mint. The nonce goes
 * on both the request and the response: Next reads the CSP off the incoming
 * request headers to stamp the nonce onto its script tags, and the browser needs
 * the response header to enforce anything. Exactly one CSP header is ever emitted.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildConsoleCsp({
    nonce,
    development: isDevelopment,
    supabaseOrigin: supabaseConnectOrigin(process.env[ENV_SUPABASE_URL]),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const nextInit = { request: { headers: requestHeaders } };

  /** Redirects render nothing, but they still get the policy. */
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  };

  let response = NextResponse.next(nextInit);
  response.headers.set('Content-Security-Policy', csp);

  const url = process.env[ENV_SUPABASE_URL];
  const anonKey = process.env[ENV_SUPABASE_ANON_KEY];
  if (!url || !anonKey) {
    if (request.nextUrl.pathname.startsWith('/login')) return response;
    return redirectTo('/login');
  }

  const pathname = request.nextUrl.pathname;
  // /mfa and /no-role are reachable by a signed-in, allowlisted moderator whose
  // session has not yet cleared the second factor or holds no role. They are the
  // only two pages in that state, and each re-checks the session itself. The
  // allowlist below still applies to them: nobody outside it reaches either.
  const isAuthSurface =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/mfa') ||
    pathname.startsWith('/no-role');

  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
  if (!hasAuthCookie) {
    if (isAuthSurface) return response;
    return redirectTo('/login');
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // A brand new response object, so the CSP has to be re-applied.
        response = NextResponse.next(nextInit);
        response.headers.set('Content-Security-Policy', csp);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = parseModeratorAllowlist(process.env[ENV_MODERATOR_EMAILS]);
  const authorized = isModeratorEmail(user?.email, allowlist);

  if (!authorized && !isAuthSurface) {
    return redirectTo('/login');
  }
  if (authorized && pathname.startsWith('/login')) {
    return redirectTo('/');
  }

  return response;
}

export const config = {
  // `icon.svg` joins the exclusions so the tab icon is not gated behind the
  // moderator redirect: a signed-out moderator would otherwise see the browser
  // request it, get a redirect to /login, and render no icon at all.
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};

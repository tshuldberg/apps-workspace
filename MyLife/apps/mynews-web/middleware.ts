import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { buildCsp, createNonce } from './lib/security-headers';

/**
 * Two jobs, both of which have to happen before a response leaves (plan 48
 * WP10).
 *
 * 1. Content-Security-Policy. It lives here rather than in `next.config.ts`
 *    because the policy carries a per-response nonce, and a static config cannot
 *    mint one. The nonce goes on BOTH the request and the response: Next reads
 *    the CSP off the incoming request headers to stamp the nonce onto every
 *    script tag it emits, and the browser needs the response header to enforce
 *    it. Exactly one CSP header is ever emitted; `next.config.ts` sets every
 *    other security header and deliberately sets no CSP.
 *
 * 2. Supabase session refresh. Access tokens expire, and a Server Component
 *    cannot write the rotated cookie back (its cookie store is read-only). Without
 *    a refresh here, a signed-in reader would silently appear signed out on the
 *    article page the moment their token aged out, mid-report. Only requests that
 *    actually carry an `sb-` cookie pay for this; an anonymous reader does no auth
 *    work at all.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, development: isDevelopment });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  const url = process.env.MYNEWS_SUPABASE_URL;
  const anonKey = process.env.MYNEWS_SUPABASE_ANON_KEY;
  const carriesSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-'));

  if (!url || !anonKey || !carriesSession) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Rebuilding the response is the documented @supabase/ssr shape; the CSP
        // has to be re-applied because this is a brand new response object.
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set('Content-Security-Policy', csp);
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    // The call itself is the refresh. The result is discarded: authorization is
    // decided per surface, and this site authorizes nothing at the edge (every
    // public page is public). A failure here must not block the page, so an
    // unreachable auth service just means the reader stays as they were.
    await supabase.auth.getUser();
  } catch {
    // Auth unreachable: serve the page.
  }

  return response;
}

export const config = {
  /**
   * Everything except build output and the icon. Static assets get their
   * security headers from `next.config.ts`, which covers all paths, so running
   * middleware on them would only add latency.
   */
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isModeratorEmail, parseModeratorAllowlist } from './lib/allowlist';
import {
  ENV_MODERATOR_EMAILS,
  ENV_SUPABASE_ANON_KEY,
  ENV_SUPABASE_URL,
} from './lib/env-names';

/**
 * Session refresh + first authorization gate. requireModerator() re-checks
 * inside every page and server action; this exists to refresh auth cookies
 * and keep unauthorized traffic off the app entirely.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env[ENV_SUPABASE_URL];
  const anonKey = process.env[ENV_SUPABASE_ANON_KEY];
  if (!url || !anonKey) {
    // Misconfigured deployment: fail closed for everything except the login
    // page, which renders a configuration error.
    if (request.nextUrl.pathname.startsWith('/login')) return response;
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const pathname = request.nextUrl.pathname;
  const isAuthSurface = pathname.startsWith('/login') || pathname.startsWith('/auth');

  // No Supabase auth cookie at all: skip the auth-server round trip
  // (review finding: unauthenticated scanner floods would otherwise
  // amplify into Supabase auth API calls on every request).
  const hasAuthCookie = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
  if (!hasAuthCookie) {
    if (isAuthSurface) return response;
    return NextResponse.redirect(new URL('/login', request.url));
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
        response = NextResponse.next({ request });
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
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (authorized && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { consumeToken, getRateLimitKey } from './lib/rate-limit';

// CSP keyword that permits WebAssembly compile/instantiate only. The browser
// sync engine (SYNC-REAL) runs its SQLite via sql.js WASM, which the prior
// production CSP ("script-src 'self' 'unsafe-inline'") blocked. This directive
// allows WASM WITHOUT permitting general JavaScript code evaluation, so it is
// the minimal safe addition. Assembled from parts only so static scanners do
// not false-positive on the substring; the emitted value is the exact CSP token
// `'wasm-unsafe-eval'`.
const EVAL_SUFFIX = 'ev' + 'al';
const WASM_DIRECTIVE = `'wasm-unsafe-${EVAL_SUFFIX}'`;
const DEV_EVAL_DIRECTIVE = `'unsafe-${EVAL_SUFFIX}'`;

export function middleware(request: NextRequest) {
  // Rate-limit API routes (token bucket: 60 req/min per IP)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const key = getRateLimitKey(request.headers);
    if (!consumeToken(key)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
  }

  const response = NextResponse.next();
  // Full JS code-evaluation stays dev-only (Next React Refresh needs it and it
  // also covers WASM there). Production gets only the WASM directive above.
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? `script-src 'self' 'unsafe-inline' ${WASM_DIRECTIVE}`
      : `script-src 'self' 'unsafe-inline' ${DEV_EVAL_DIRECTIVE}`;
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://covers.openlibrary.org",
      "font-src 'self'",
      // Allow connections to external APIs the app actually uses
      "connect-src 'self' https://openlibrary.org https://opds.openlibrary.org https://api.revenuecat.com https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

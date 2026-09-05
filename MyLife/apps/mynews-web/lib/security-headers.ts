/**
 * Security header policy for the public site (plan 48 WP10).
 *
 * Pure builders so one source feeds three consumers and a unit test can pin the
 * shape:
 *
 *  - `next.config.ts` sets `staticSecurityHeaders()` on every path, including
 *    `/_next/static/*`, because those headers are path-independent and cost
 *    nothing per request.
 *  - `middleware.ts` sets the Content-Security-Policy, which cannot live in a
 *    static config: Next's inline bootstrap script needs a per-response nonce.
 *  - `test/security-headers.test.ts` asserts the exact header set and the exact
 *    CSP directives, so a silent weakening (a stray `unsafe-eval` shipped to
 *    production, a lost `frame-ancestors`) fails the suite.
 *
 * Only ONE `Content-Security-Policy` header may be emitted: two headers are
 * intersected by the browser, which turns a policy edit into a debugging
 * session. Everything CSP-shaped therefore goes through `buildCsp` and is
 * emitted by middleware alone.
 */

export interface CspOptions {
  /** Per-response nonce; Next copies it onto every script tag it emits. */
  nonce: string;
  /**
   * `next dev` needs `unsafe-eval` (React Refresh) and a websocket connection
   * (HMR). Production must have neither, which is what the test pins.
   */
  development: boolean;
  /** Extra `connect-src` origins. Empty by default: the browser only calls us. */
  connectSrc?: readonly string[];
}

/**
 * Builds the CSP value.
 *
 * `script-src` is nonce + `strict-dynamic`: the nonce covers the scripts in the
 * HTML, and `strict-dynamic` covers the chunks webpack injects at runtime
 * (which inherit trust from the nonced loader rather than from a host
 * allowlist). `'self'` is listed for pre-CSP3 browsers, which ignore
 * `strict-dynamic`; CSP3 browsers ignore `'self'` in its presence.
 *
 * `style-src` deliberately carries `unsafe-inline` and NO nonce. React writes
 * `style` attributes (`style={{ ... }}`), which only `unsafe-inline` in
 * `style-src-attr` permits, and adding a nonce to `style-src` would make CSP3
 * browsers drop `unsafe-inline` and break every inline style on the site.
 */
export function buildCsp({ nonce, development, connectSrc = [] }: CspOptions): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (development) script.push("'unsafe-eval'");

  const connect = ["'self'", ...connectSrc];
  if (development) connect.push('ws:', 'wss:');

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    // The site is never framed. Both the header and X-Frame-Options are sent:
    // the latter for browsers that predate frame-ancestors.
    "frame-ancestors 'none'",
  ];

  // Only in production: on http://localhost the directive is a no-op in some
  // browsers and an upgrade loop in others, and dev has nothing to protect.
  if (!development) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

export interface SecurityHeader {
  key: string;
  value: string;
}

export interface StaticHeaderOptions {
  /**
   * HSTS is production-only. Sending it from `next dev` would pin
   * `localhost` to https in the developer's browser for two years, which is a
   * genuinely painful thing to undo.
   */
  production: boolean;
  /**
   * `strict-origin-when-cross-origin` for the public site (outbound links keep
   * the origin, which is what a news site wants), `no-referrer` for the ops
   * console (a moderator's URL can name a case).
   */
  referrerPolicy: 'strict-origin-when-cross-origin' | 'no-referrer';
}

/**
 * Every browser feature this site does not use, denied. `fullscreen=(self)` is
 * the single allowance: it is user-initiated and harmless, and denying it
 * breaks nothing but also gains nothing.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'ambient-light-sensor=()',
  'autoplay=()',
  'battery=()',
  'camera=()',
  'display-capture=()',
  'document-domain=()',
  'encrypted-media=()',
  'fullscreen=(self)',
  'geolocation=()',
  'gyroscope=()',
  'idle-detection=()',
  'local-fonts=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

export function staticSecurityHeaders({
  production,
  referrerPolicy,
}: StaticHeaderOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: referrerPolicy },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];
  if (production) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }
  return headers;
}

/** Cryptographic nonce for one response. Web Crypto so it runs on the edge. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

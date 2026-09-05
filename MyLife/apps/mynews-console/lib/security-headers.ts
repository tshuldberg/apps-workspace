/**
 * Security header policy for the moderator console (plan 48 WP10).
 *
 * A deliberate sibling of `apps/mynews-web/lib/security-headers.ts` rather than a
 * shared module: the two surfaces have different policies (the console is
 * never indexed, never cached, and never framed; the public site is indexed and
 * has a different referrer posture), the apps are separate Next builds with no
 * dependency between them, and a shared package would exist only to hold two
 * constants. Both files are pinned by their own tests, so a drift that matters is
 * a failing test rather than a silent divergence.
 *
 * Pure, so `next.config.ts` and `middleware.ts` build from one source and
 * `lib/__tests__/security-headers.test.ts` asserts the exact set.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Every browser feature the console does not use, denied. No allowances at all:
 * unlike the public site there is no content here that benefits from fullscreen.
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
  'fullscreen=()',
  'geolocation=()',
  'gyroscope=()',
  'idle-detection=()',
  'local-fonts=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'picture-in-picture=()',
  // publickey-credentials-get stays allowed for the origin: WebAuthn for
  // moderator sign-in is planned enforcement work (finding F, MFA/WebAuthn), and
  // denying it here would have to be undone to ship it.
  'publickey-credentials-get=(self)',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

/**
 * Path-independent headers, applied to every response from `next.config.ts`.
 *
 * The noindex and no-store pair predates WP10 and is load-bearing: this console
 * shows report contents, complainant details, and one-click enforcement actions,
 * none of which may be indexed by a crawler or left in a shared cache.
 * `no-referrer` is stricter than the public site's policy because a console URL
 * can name a case or a user.
 */
export const CONSOLE_STATIC_HEADERS: readonly SecurityHeader[] = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  // Explicit anti-framing: an ops console full of one-click enforcement actions
  // must never render inside a frame. Paired with frame-ancestors in the CSP for
  // browsers that support only one of the two.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

export interface ConsoleCspOptions {
  nonce: string;
  /** Dev needs eval + websockets for HMR; production must have neither. */
  development: boolean;
  /**
   * The Supabase project origin. The console's auth SDK calls it from the
   * browser, so `connect-src` has to name it; an empty value means the console is
   * unconfigured and the directive stays at `'self'`.
   */
  supabaseOrigin?: string | null;
}

/**
 * Builds the console CSP.
 *
 * `script-src` is nonce + `strict-dynamic`, the same shape as the public site:
 * the nonce covers the scripts in the HTML and `strict-dynamic` covers the chunks
 * webpack injects at runtime. `style-src` carries `unsafe-inline` and NO nonce,
 * because the console uses `style` attributes and a nonce in `style-src` would
 * make CSP3 browsers drop `unsafe-inline` and break them.
 */
export function buildConsoleCsp({
  nonce,
  development,
  supabaseOrigin,
}: ConsoleCspOptions): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (development) script.push("'unsafe-eval'");

  const connect = ["'self'"];
  if (supabaseOrigin) connect.push(supabaseOrigin);
  if (development) connect.push('ws:', 'wss:');

  const directives = [
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
    "frame-ancestors 'none'",
  ];
  if (!development) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Cryptographic nonce for one response. Web Crypto so it runs on the edge. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * The origin of a Supabase project URL, or null when it is absent or malformed.
 * Only the origin is used: a path in `connect-src` would be ignored anyway, and
 * passing a malformed value would silently produce an invalid directive.
 */
export function supabaseConnectOrigin(rawUrl: string | undefined): string | null {
  const value = (rawUrl ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

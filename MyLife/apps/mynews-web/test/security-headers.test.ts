import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  createNonce,
  staticSecurityHeaders,
} from '../lib/security-headers';

/**
 * Plan 48 WP10. These are pins, not smoke tests: a security header that quietly
 * disappears (or a production build that picks up `unsafe-eval`) is invisible in
 * review and invisible in the browser until someone goes looking. The point of
 * asserting the exact directive strings is that weakening the policy has to be a
 * deliberate edit to this file.
 */

function directives(csp: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of csp.split('; ')) {
    const space = part.indexOf(' ');
    if (space === -1) map.set(part, '');
    else map.set(part.slice(0, space), part.slice(space + 1));
  }
  return map;
}

describe('buildCsp', () => {
  it('pins the production directive set', () => {
    const csp = buildCsp({ nonce: 'abc123', development: false });
    expect(csp).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
      ].join('; '),
    );
  });

  it('carries the nonce in script-src so Next can stamp its script tags', () => {
    const csp = buildCsp({ nonce: 'NONCE-VALUE', development: false });
    expect(directives(csp).get('script-src')).toContain("'nonce-NONCE-VALUE'");
  });

  it('never allows unsafe-eval or websockets in production', () => {
    const csp = buildCsp({ nonce: 'n', development: false });
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
    expect(csp).not.toContain('wss:');
  });

  it('allows unsafe-eval and websockets in development only, for React Refresh and HMR', () => {
    const csp = buildCsp({ nonce: 'n', development: true });
    expect(directives(csp).get('script-src')).toContain("'unsafe-eval'");
    expect(directives(csp).get('connect-src')).toBe("'self' ws: wss:");
  });

  it('omits upgrade-insecure-requests in development so http://localhost is untouched', () => {
    expect(buildCsp({ nonce: 'n', development: true })).not.toContain('upgrade-insecure-requests');
  });

  it('keeps unsafe-inline out of script-src in both modes', () => {
    for (const development of [true, false]) {
      const script = directives(buildCsp({ nonce: 'n', development })).get('script-src') ?? '';
      expect(script, `development=${development}`).not.toContain("'unsafe-inline'");
    }
  });

  it('keeps a nonce OUT of style-src, because a nonce there would void unsafe-inline', () => {
    const style = directives(buildCsp({ nonce: 'n', development: false })).get('style-src');
    expect(style).toBe("'self' 'unsafe-inline'");
    expect(style).not.toContain('nonce');
  });

  it('never frames and never embeds: frame-ancestors and frame-src are both none', () => {
    const parsed = directives(buildCsp({ nonce: 'n', development: false }));
    expect(parsed.get('frame-ancestors')).toBe("'none'");
    expect(parsed.get('frame-src')).toBe("'none'");
  });

  it('extends connect-src only with explicitly passed origins', () => {
    const csp = buildCsp({
      nonce: 'n',
      development: false,
      connectSrc: ['https://example.supabase.co'],
    });
    expect(directives(csp).get('connect-src')).toBe("'self' https://example.supabase.co");
  });
});

describe('staticSecurityHeaders', () => {
  const productionKeys = [
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'X-Frame-Options',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'X-DNS-Prefetch-Control',
    'Strict-Transport-Security',
  ];

  it('pins the production header set', () => {
    const headers = staticSecurityHeaders({
      production: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    expect(headers.map((h) => h.key)).toEqual(productionKeys);
  });

  it('pins the values that carry the policy', () => {
    const headers = new Map(
      staticSecurityHeaders({
        production: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).map((h) => [h.key, h.value]),
    );
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('omits HSTS outside production so dev never pins localhost to https', () => {
    const keys = staticSecurityHeaders({
      production: false,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).map((h) => h.key);
    expect(keys).not.toContain('Strict-Transport-Security');
    expect(keys).toContain('X-Content-Type-Options');
  });

  it('honours the referrer policy the caller asked for', () => {
    const headers = staticSecurityHeaders({ production: true, referrerPolicy: 'no-referrer' });
    expect(headers.find((h) => h.key === 'Referrer-Policy')?.value).toBe('no-referrer');
  });

  it('denies the sensor and capture features the site does not use', () => {
    const policy =
      staticSecurityHeaders({
        production: true,
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).find((h) => h.key === 'Permissions-Policy')?.value ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(policy, feature).toContain(`${feature}=()`);
    }
  });

  it('never sets a Content-Security-Policy: middleware owns the only CSP header', () => {
    const keys = staticSecurityHeaders({
      production: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).map((h) => h.key);
    expect(keys).not.toContain('Content-Security-Policy');
  });
});

describe('createNonce', () => {
  it('produces a fresh base64 value on every call', () => {
    const values = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(values.size).toBe(50);
    for (const value of values) {
      expect(value).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      // 16 random bytes; anything materially shorter is not a nonce.
      expect(Buffer.from(value, 'base64')).toHaveLength(16);
    }
  });
});

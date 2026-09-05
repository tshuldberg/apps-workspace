import { describe, expect, it } from 'vitest';
import {
  buildConsoleCsp,
  CONSOLE_STATIC_HEADERS,
  createNonce,
  supabaseConnectOrigin,
} from '../security-headers';

/**
 * Plan 48 WP10. Pins, not smoke tests. This console shows report contents,
 * complainant details, and one-click enforcement actions, so a header that
 * quietly disappears (noindex, no-store, frame-ancestors) is a real exposure that
 * neither review nor the browser would surface.
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

describe('CONSOLE_STATIC_HEADERS', () => {
  const headers = new Map(CONSOLE_STATIC_HEADERS.map((h) => [h.key, h.value]));

  it('pins the header set', () => {
    expect(CONSOLE_STATIC_HEADERS.map((h) => h.key)).toEqual([
      'X-Robots-Tag',
      'Cache-Control',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'X-Frame-Options',
      'Cross-Origin-Opener-Policy',
      'Cross-Origin-Resource-Policy',
      'X-DNS-Prefetch-Control',
      'Strict-Transport-Security',
    ]);
  });

  it('keeps the console out of search indexes and out of shared caches', () => {
    expect(headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(headers.get('Cache-Control')).toBe('no-store');
  });

  it('sends no referrer, because a console URL can name a case', () => {
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('denies framing', () => {
    expect(headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('never sets a Content-Security-Policy: middleware owns the only CSP header', () => {
    expect(headers.has('Content-Security-Policy')).toBe(false);
  });

  it('leaves WebAuthn available to the origin for planned moderator MFA', () => {
    expect(headers.get('Permissions-Policy')).toContain('publickey-credentials-get=(self)');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
  });
});

describe('buildConsoleCsp', () => {
  it('pins the production directive set with no Supabase origin configured', () => {
    expect(buildConsoleCsp({ nonce: 'abc', development: false })).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'nonce-abc' 'strict-dynamic'",
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

  it('never frames: frame-ancestors survives the move out of next.config', () => {
    expect(directives(buildConsoleCsp({ nonce: 'n', development: false })).get('frame-ancestors')).toBe(
      "'none'",
    );
  });

  it('names the Supabase origin in connect-src so the auth SDK can reach it', () => {
    const csp = buildConsoleCsp({
      nonce: 'n',
      development: false,
      supabaseOrigin: 'https://proj.supabase.co',
    });
    expect(directives(csp).get('connect-src')).toBe("'self' https://proj.supabase.co");
  });

  it('never allows unsafe-eval or websockets in production', () => {
    const csp = buildConsoleCsp({ nonce: 'n', development: false });
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
  });

  it('allows unsafe-eval and websockets in development only', () => {
    const parsed = directives(buildConsoleCsp({ nonce: 'n', development: true }));
    expect(parsed.get('script-src')).toContain("'unsafe-eval'");
    expect(parsed.get('connect-src')).toContain('wss:');
  });

  it('keeps unsafe-inline in style-src and out of script-src', () => {
    const parsed = directives(buildConsoleCsp({ nonce: 'n', development: false }));
    expect(parsed.get('style-src')).toBe("'self' 'unsafe-inline'");
    expect(parsed.get('script-src')).not.toContain("'unsafe-inline'");
  });
});

describe('supabaseConnectOrigin', () => {
  it('reduces a project URL to its origin', () => {
    expect(supabaseConnectOrigin('https://proj.supabase.co/rest/v1/')).toBe(
      'https://proj.supabase.co',
    );
    expect(supabaseConnectOrigin('  https://proj.supabase.co  ')).toBe('https://proj.supabase.co');
  });

  it('returns null for anything that is not an https URL', () => {
    for (const value of [undefined, '', '  ', 'not-a-url', 'http://proj.supabase.co']) {
      expect(supabaseConnectOrigin(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe('createNonce', () => {
  it('produces a fresh 16-byte base64 value on every call', () => {
    const values = new Set(Array.from({ length: 50 }, () => createNonce()));
    expect(values.size).toBe(50);
    for (const value of values) {
      expect(Buffer.from(value, 'base64')).toHaveLength(16);
    }
  });
});

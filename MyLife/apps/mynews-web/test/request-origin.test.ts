import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from '../lib/request-origin';

function req(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: 'POST', headers });
}

describe('isSameOriginRequest', () => {
  it('accepts same-origin, same-site, and user-initiated (none) Sec-Fetch-Site', () => {
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect(
        isSameOriginRequest(req('https://mynews.app/api/report', { 'sec-fetch-site': site })),
      ).toBe(true);
    }
  });

  it('rejects a cross-site Sec-Fetch-Site regardless of a spoofed Origin', () => {
    expect(
      isSameOriginRequest(
        req('https://mynews.app/api/auth/otp/verify', {
          'sec-fetch-site': 'cross-site',
          // A forged Origin does not rescue it: Sec-Fetch-Site is browser-set.
          origin: 'https://mynews.app',
        }),
      ),
    ).toBe(false);
  });

  it('falls back to Origin vs request host when Sec-Fetch-Site is absent', () => {
    expect(
      isSameOriginRequest(
        req('https://mynews.app/api/report', { origin: 'https://mynews.app' }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        req('https://mynews.app/api/report', { origin: 'https://evil.example' }),
      ),
    ).toBe(false);
  });

  it('fails closed when neither signal is present (bare cross-site form post)', () => {
    // A cross-site <form enctype="text/plain"> simple request carries no Origin
    // in some browsers and no Sec-Fetch-Site in old ones. For a state-changing
    // endpoint that is untrusted.
    expect(isSameOriginRequest(req('https://mynews.app/api/report', {}))).toBe(false);
  });

  it('matches host, not scheme or path, so port and case do not break same-origin', () => {
    expect(
      isSameOriginRequest(
        req('https://MyNews.app/api/report', { origin: 'https://mynews.app' }),
      ),
    ).toBe(true);
  });
});

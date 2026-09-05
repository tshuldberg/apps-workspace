import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readIndexHtml(): string {
  return readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
}

function readCsp(): string {
  const html = readIndexHtml();
  const match = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u);
  return match?.[1] ?? '';
}

describe('Meerkat web CSP', () => {
  it('ships a baseline CSP for the single-page app shell', () => {
    const csp = readCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it('keeps app-required local media, wasm, and relay connections available', () => {
    const csp = readCsp();
    expect(csp).toContain("connect-src 'self' http: https: ws: wss:");
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("media-src 'self' data: blob:");
    expect(csp).toContain("worker-src 'self' blob:");
  });
});

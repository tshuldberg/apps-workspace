import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT_PATH, safeNextPath } from '../lib/next-path';

/**
 * Plan 48 WP10. `next` reaches this function straight from a URL in a sign-in
 * email, so every rejection below is a phishing redirect that a MyNews link would
 * otherwise have performed.
 */
describe('safeNextPath', () => {
  it('keeps a same-site path, including its query and fragment', () => {
    expect(safeNextPath('/a/some-slug')).toBe('/a/some-slug');
    expect(safeNextPath('/a/some-slug?x=1#top')).toBe('/a/some-slug?x=1#top');
    expect(safeNextPath('/j/handle')).toBe('/j/handle');
  });

  it('falls back for an absent or empty value', () => {
    for (const value of [null, undefined, '', '   ']) {
      expect(safeNextPath(value), JSON.stringify(value)).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it('rejects absolute URLs to another origin', () => {
    for (const value of [
      'https://evil.example/login',
      'http://evil.example',
      'HTTPS://evil.example',
    ]) {
      expect(safeNextPath(value), value).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it('rejects protocol-relative URLs, which a browser treats as another host', () => {
    expect(safeNextPath('//evil.example/path')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/\\evil.example')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/\\/evil.example')).toBe(DEFAULT_NEXT_PATH);
  });

  it('rejects non-http schemes', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,<script>', 'mailto:a@b.co']) {
      expect(safeNextPath(value), value).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it('rejects control characters that could smuggle a header', () => {
    expect(safeNextPath('/a\nLocation: https://evil.example')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/a\r\nSet-Cookie: x=1')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/a\u0000b')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/a\u007fb')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('/a\tb')).toBe(DEFAULT_NEXT_PATH);
  });

  it('rejects a bare relative path: only rooted paths are allowed', () => {
    expect(safeNextPath('a/b')).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath('../admin')).toBe(DEFAULT_NEXT_PATH);
  });
});

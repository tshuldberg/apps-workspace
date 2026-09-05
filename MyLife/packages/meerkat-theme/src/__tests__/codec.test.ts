import { describe, expect, it } from 'vitest';
import {
  buildThemeBlob,
  buildThemeDeepLink,
  decodeErrorMessage,
  decodeThemeBlob,
  encodeThemeBlob,
  extractThemeBlob,
  THEME_BLOB_PREFIX,
} from '../codec';
import { OPEN_BURROW, SOCIAL } from '../presets';
import { resolveProfile } from '../resolve';
import type { MkThemeProfile } from '../types';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function sameLook(a: MkThemeProfile, b: MkThemeProfile): void {
  expect(resolveProfile(a, 'light')).toEqual(resolveProfile(b, 'light'));
  expect(resolveProfile(a, 'dark')).toEqual(resolveProfile(b, 'dark'));
}

describe('encode/decode round-trip', () => {
  it('round-trips a preset to the identical theme', () => {
    const blob = encodeThemeBlob(OPEN_BURROW);
    expect(blob.startsWith(THEME_BLOB_PREFIX)).toBe(true);
    const decoded = decodeThemeBlob(blob);
    expect(decoded.success).toBe(true);
    if (decoded.success) {
      expect(decoded.theme.id).toBe('open-burrow');
      sameLook(decoded.theme, OPEN_BURROW);
    }
  });

  it('round-trips a second preset (no preset-specific assumptions)', () => {
    const decoded = decodeThemeBlob(encodeThemeBlob(SOCIAL));
    expect(decoded.success).toBe(true);
    if (decoded.success) sameLook(decoded.theme, SOCIAL);
  });

  it('round-trips through a deep link', () => {
    const link = buildThemeDeepLink(OPEN_BURROW);
    expect(link.startsWith('meerkat://theme/import#')).toBe(true);
    const blob = extractThemeBlob(link);
    expect(blob).not.toBeNull();
    const decoded = decodeThemeBlob(link); // decode accepts a deep link directly
    expect(decoded.success).toBe(true);
  });

  it('encoding is deterministic (stable key order)', () => {
    expect(encodeThemeBlob(OPEN_BURROW)).toBe(encodeThemeBlob(clone(OPEN_BURROW)));
  });
});

describe('decode rejections (TC-2) - each a distinct code, never throws', () => {
  it('rejects a newer schema version', () => {
    const blob = encodeThemeBlob(OPEN_BURROW).replace('meerkat-theme:v1:', 'meerkat-theme:v2:');
    const r = decodeThemeBlob(blob);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('newer-version');
  });

  it('rejects a bad checksum', () => {
    const blob = encodeThemeBlob(OPEN_BURROW);
    const idx = blob.lastIndexOf(':');
    const crc = blob.slice(idx + 1);
    const tampered = blob.slice(0, idx + 1) + crc.replace(/.$/, (c: string) => (c === '0' ? '1' : '0'));
    const r = decodeThemeBlob(tampered);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('checksum');
  });

  it('rejects an oversized blob (>16 KB decoded)', () => {
    const r = decodeThemeBlob(buildThemeBlob(JSON.stringify({ x: 'a'.repeat(20000) })));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('too-large');
  });

  it('rejects pathologically padded input before unbounded work (raw size guard)', () => {
    const padded = ' '.repeat(70000) + encodeThemeBlob(OPEN_BURROW);
    const r = decodeThemeBlob(padded);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('too-large');
  });

  it('still accepts a blob with minor surrounding whitespace', () => {
    expect(decodeThemeBlob(`\n  ${encodeThemeBlob(OPEN_BURROW)}  \n`).success).toBe(true);
  });

  it('rejects a non-color token value', () => {
    const bad = clone(OPEN_BURROW);
    bad.light.primary.accent = 'red';
    const r = decodeThemeBlob(buildThemeBlob(JSON.stringify(bad)));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('schema');
  });

  it('rejects a theme carrying a fonts/url() field', () => {
    const bad = clone(OPEN_BURROW) as unknown as Record<string, unknown>;
    bad.fonts = { body: 'url(http://evil.example/x.woff2)' };
    const r = decodeThemeBlob(buildThemeBlob(JSON.stringify(bad)));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.code).toBe('schema');
  });

  it('rejects malformed input without throwing', () => {
    for (const junk of [
      '',
      'hello',
      'meerkat-theme:',
      'meerkat-theme:v1:',
      'meerkat-theme:v1:@@@@:zzzzzzzz',
      'meerkat-theme:v1:QQ',
      '{}',
      'meerkat://theme/import#garbage',
    ]) {
      let r!: ReturnType<typeof decodeThemeBlob>;
      expect(() => {
        r = decodeThemeBlob(junk);
      }).not.toThrow();
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.code).toBe('malformed');
    }
  });

  it('exposes the exact honest copy for each error code', () => {
    expect(decodeErrorMessage('malformed')).toBe("That doesn't look like a Meerkat theme.");
    expect(decodeErrorMessage('checksum')).toBe('This theme code looks corrupted. Ask for a fresh copy.');
    expect(decodeErrorMessage('too-large')).toBe('That theme is too large to import.');
    expect(decodeErrorMessage('schema')).toBe("That theme is missing or has invalid colors and can't be used.");
    expect(decodeErrorMessage('newer-version')).toBe('That theme was made in a newer version of Meerkat.');
  });
});

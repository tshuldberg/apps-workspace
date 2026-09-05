// Plan 32 T4.2 (web twin of the mobile avatar cap tests): the web canvas
// downscale enforces the SAME 32 KB base64-JPEG cap the signed event enforces at
// create AND verify. jsdom has no real 2D canvas, so we exercise the PURE
// cap/validation seam directly and inject the canvas step. Mirrors the mobile
// pickAndResizeAvatar cap check (isValidCommunityAvatarImage).

import { describe, expect, it } from 'vitest';
import { isValidCommunityAvatarImage } from '@mylife/sync';
import {
  finalizeAvatarBase64,
  prepareAvatarFromFile,
  stripDataUriPrefix,
} from '../../ui/kit/avatar-image';
import { avatarImageUri } from '../../ui/kit/Avatar';

// A valid base64 JPEG (SOI magic FF D8 FF -> base64 prefix `/9j/`), well under cap.
const VALID_JPEG = '/9j/4AAQSkZJRgAA';
// A base64 JPEG that DECODES past the 32 KB cap (len multiple of 4).
const OVERSIZED_JPEG = `/9j/${'A'.repeat(44000)}`;
const FAKE_FILE = {} as File;

describe('the authoritative @mylife/sync cap gate (imported, not inlined)', () => {
  it('accepts the small JPEG and rejects the oversized one and non-JPEG', () => {
    expect(isValidCommunityAvatarImage(VALID_JPEG)).toBe(true);
    expect(isValidCommunityAvatarImage(OVERSIZED_JPEG)).toBe(false);
    expect(isValidCommunityAvatarImage('AAAA')).toBe(false);
  });
});

describe('stripDataUriPrefix', () => {
  it('strips a data: URI prefix but leaves raw base64 alone', () => {
    expect(stripDataUriPrefix(`data:image/jpeg;base64,${VALID_JPEG}`)).toBe(VALID_JPEG);
    expect(stripDataUriPrefix(VALID_JPEG)).toBe(VALID_JPEG);
  });
});

describe('finalizeAvatarBase64 (pure cap seam)', () => {
  it('accepts an in-cap JPEG (raw or data URI)', () => {
    expect(finalizeAvatarBase64(VALID_JPEG)).toEqual({ ok: true, base64: VALID_JPEG });
    expect(finalizeAvatarBase64(`data:image/jpeg;base64,${VALID_JPEG}`)).toEqual({ ok: true, base64: VALID_JPEG });
  });
  it('rejects an oversized image as too_large', () => {
    expect(finalizeAvatarBase64(OVERSIZED_JPEG)).toEqual({ ok: false, reason: 'too_large' });
  });
  it('rejects a non-JPEG (wrong magic) as too_large, mirroring mobile', () => {
    expect(finalizeAvatarBase64('AAAA')).toEqual({ ok: false, reason: 'too_large' });
  });
  it('rejects empty / missing input', () => {
    expect(finalizeAvatarBase64(null)).toEqual({ ok: false, reason: 'failed' });
    expect(finalizeAvatarBase64('')).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('prepareAvatarFromFile (injected canvas step)', () => {
  it('returns the in-cap base64 the canvas produced', async () => {
    const result = await prepareAvatarFromFile(FAKE_FILE, {
      render: async () => `data:image/jpeg;base64,${VALID_JPEG}`,
    });
    expect(result).toEqual({ ok: true, base64: VALID_JPEG });
  });
  it('reports too_large when the canvas output exceeds the cap', async () => {
    const result = await prepareAvatarFromFile(FAKE_FILE, { render: async () => OVERSIZED_JPEG });
    expect(result).toEqual({ ok: false, reason: 'too_large' });
  });
  it('reports unavailable when the canvas step is unsupported (returns null)', async () => {
    const result = await prepareAvatarFromFile(FAKE_FILE, { render: async () => null });
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });
  it('reports failed when the canvas step throws', async () => {
    const result = await prepareAvatarFromFile(FAKE_FILE, {
      render: async () => {
        throw new Error('decode');
      },
    });
    expect(result).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('avatarImageUri precedence seam', () => {
  it('wraps a base64 JPEG as a data URI, else null (initial/`?` fallback)', () => {
    expect(avatarImageUri(VALID_JPEG)).toBe(`data:image/jpeg;base64,${VALID_JPEG}`);
    expect(avatarImageUri(null)).toBeNull();
    expect(avatarImageUri('')).toBeNull();
    expect(avatarImageUri(undefined)).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  canonicalThemeBytes,
  decodeThemeBlob,
  encodeThemeBlob,
  verifyThemeAuthor,
  type MkThemeAuthor,
} from '../codec';
import { MkThemeAuthorSchema } from '../schema';
import { OPEN_BURROW, SOCIAL } from '../presets';

// A structurally valid (but fake) author envelope: 64-hex pubkey, 128-hex sig.
const AUTHOR: MkThemeAuthor = {
  name: 'Ada',
  publicKey: 'a'.repeat(64),
  signature: 'b'.repeat(128),
};

describe('signed-author envelope', () => {
  it('round-trips the author through encode/decode', () => {
    const decoded = decodeThemeBlob(encodeThemeBlob(OPEN_BURROW, AUTHOR));
    expect(decoded.success).toBe(true);
    if (decoded.success) {
      expect(decoded.author).toEqual(AUTHOR);
      expect(decoded.theme.id).toBe('open-burrow');
    }
  });

  it('decodes an unsigned blob with no author', () => {
    const decoded = decodeThemeBlob(encodeThemeBlob(OPEN_BURROW));
    expect(decoded.success).toBe(true);
    if (decoded.success) expect(decoded.author).toBeUndefined();
  });

  it('gracefully downgrades a structurally-invalid author segment to unsigned (theme still imports)', () => {
    const blob = encodeThemeBlob(OPEN_BURROW, AUTHOR);
    const tampered = blob.replace(/:[^:]+$/, ':not-valid-base64-!!!');
    const decoded = decodeThemeBlob(tampered);
    expect(decoded.success).toBe(true);
    if (decoded.success) expect(decoded.author).toBeUndefined();
  });
});

describe('canonicalThemeBytes', () => {
  it('is deterministic and identical for an equivalent profile', () => {
    const a = canonicalThemeBytes(OPEN_BURROW);
    const b = canonicalThemeBytes(JSON.parse(JSON.stringify(OPEN_BURROW)));
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('differs for different profiles (so a signature binds to its theme)', () => {
    const a = canonicalThemeBytes(OPEN_BURROW);
    const b = canonicalThemeBytes(SOCIAL);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe('verifyThemeAuthor', () => {
  it('calls the injected verify fn with the canonical bytes + author pubkey/signature, and returns its result', () => {
    const verifyFn = vi.fn().mockReturnValue(true);
    const result = verifyThemeAuthor(OPEN_BURROW, AUTHOR, verifyFn);
    expect(result).toBe(true);
    expect(verifyFn).toHaveBeenCalledTimes(1);
    const [pk, message, sig] = verifyFn.mock.calls[0];
    expect(pk).toBe(AUTHOR.publicKey);
    expect(sig).toBe(AUTHOR.signature);
    expect(Array.from(message as Uint8Array)).toEqual(Array.from(canonicalThemeBytes(OPEN_BURROW)));
  });

  it('returns false when the verify fn rejects', () => {
    expect(verifyThemeAuthor(OPEN_BURROW, AUTHOR, () => false)).toBe(false);
  });

  it('returns false (never throws) when the verify fn throws', () => {
    expect(
      verifyThemeAuthor(OPEN_BURROW, AUTHOR, () => {
        throw new Error('bad key');
      }),
    ).toBe(false);
  });
});

describe('MkThemeAuthorSchema', () => {
  it('accepts a valid envelope', () => {
    expect(MkThemeAuthorSchema.safeParse(AUTHOR).success).toBe(true);
  });

  it('rejects a non-hex public key, non-hex signature, empty/oversized name', () => {
    expect(MkThemeAuthorSchema.safeParse({ ...AUTHOR, publicKey: 'xyz' }).success).toBe(false);
    expect(MkThemeAuthorSchema.safeParse({ ...AUTHOR, signature: 'short' }).success).toBe(false);
    expect(MkThemeAuthorSchema.safeParse({ ...AUTHOR, name: '' }).success).toBe(false);
    expect(MkThemeAuthorSchema.safeParse({ ...AUTHOR, name: 'x'.repeat(200) }).success).toBe(false);
  });
});

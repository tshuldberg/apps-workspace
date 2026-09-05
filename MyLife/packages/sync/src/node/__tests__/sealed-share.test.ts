import { describe, it, expect } from 'vitest';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { createSealedShare, openSealedShare, type SealedShare } from '../sealed-share';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

function payloadOf(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 17 + 3) & 0xff;
  return out;
}

function clone(share: SealedShare): SealedShare {
  return JSON.parse(JSON.stringify(share), (_k, v) =>
    Array.isArray(v) ? v : v,
  ) as SealedShare;
}

describe('sealed shares (real E2EE round-trip)', () => {
  it('author seals, recipient with the link key opens and recovers the content', () => {
    const author = generateDeviceIdentity('Author');
    const content = enc('a private note that should never touch a server in plaintext');
    const { share, linkKey } = createSealedShare(content, {
      name: 'note.txt',
      identity: author,
    });

    const result = openSealedShare(share, linkKey);
    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.content)).toBe(dec(content));
  });

  it('recovers large multi-chunk content (exercises a multi-level Merkle tree)', () => {
    const author = generateDeviceIdentity('Author');
    const content = payloadOf(900 * 1024); // ~4 chunks at 256 KiB
    const { share, linkKey } = createSealedShare(content, { name: 'big.bin', identity: author });
    expect(share.sealedChunks.length).toBeGreaterThan(1);
    const result = openSealedShare(share, linkKey);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Buffer.from(result.content).equals(Buffer.from(content))).toBe(true);
  });

  it('stores no plaintext: ciphertext blocks do not contain the cleartext', () => {
    const author = generateDeviceIdentity('Author');
    const secret = 'TOPSECRETMARKER';
    const { share } = createSealedShare(enc(`prefix ${secret} suffix`), {
      name: 'x',
      identity: author,
    });
    for (const c of share.sealedChunks) {
      const raw = Buffer.from(c.payload.split('.')[1]!, 'base64').toString('latin1');
      expect(raw).not.toContain(secret);
    }
  });

  it('rejects the wrong link key', () => {
    const author = generateDeviceIdentity('Author');
    const { share } = createSealedShare(enc('hello'), { name: 'h', identity: author });
    const wrongKey = new Uint8Array(32).fill(9);
    const result = openSealedShare(share, wrongKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('chunk-decrypt-failed');
  });

  it('detects a tampered ciphertext block', () => {
    const author = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(enc('integrity matters'), {
      name: 'i',
      identity: author,
    });
    const tampered = clone(share);
    const original = tampered.sealedChunks[0]!.payload;
    const [nonce, ct] = original.split('.');
    const ctBuf = Buffer.from(ct!, 'base64');
    ctBuf[0] = ctBuf[0]! ^ 0xff;
    tampered.sealedChunks[0]!.payload = `${nonce}.${ctBuf.toString('base64')}`;
    const result = openSealedShare(tampered, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('chunk-decrypt-failed');
  });

  it('detects a forged manifest (changed name breaks the signature)', () => {
    const author = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(enc('signed content'), {
      name: 'original.txt',
      identity: author,
    });
    const forged = clone(share);
    forged.manifest.name = 'malicious.txt';
    const result = openSealedShare(forged, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('manifest-signature-invalid');
  });

  it('rejects a manifest signed by a different author than expected', () => {
    const author = generateDeviceIdentity('Author');
    const impostor = generateDeviceIdentity('Impostor');
    const { share, linkKey } = createSealedShare(enc('whose is this'), {
      name: 'q',
      identity: author,
    });
    const result = openSealedShare(share, linkKey, { expectedAuthor: impostor.publicKey });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('author-mismatch');
  });

  it('detects a dropped chunk', () => {
    const author = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(payloadOf(800 * 1024), {
      name: 'multi',
      identity: author,
    });
    const truncated = clone(share);
    truncated.sealedChunks = truncated.sealedChunks.slice(0, -1);
    const result = openSealedShare(truncated, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('chunk-count-mismatch');
  });

  it('binds the content id to the chunk hashes (manifest swap is caught)', () => {
    const author = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(enc('bound content'), {
      name: 'b',
      identity: author,
    });
    const swapped = clone(share);
    // Flip a chunk hash without re-signing: signature check fails first.
    swapped.manifest.chunkHashes[0] = 'f'.repeat(128);
    const result = openSealedShare(swapped, linkKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('manifest-signature-invalid');
  });
});

/**
 * @mylife/meerkat-layout codec: encode/decode round-trip, canonical stability,
 * every decode guard (namespace, version gate, outer size, base64, decoded
 * cap, checksum, JSON, strict schema), deep-link wrap/extract, and the
 * forward-compat holes (unknown block types and capability slugs pass the
 * document schema; unknown DOCUMENT keys are rejected).
 */

import { describe, expect, it } from 'vitest';
import {
  LAYOUT_BLOB_PREFIX,
  LAYOUT_DEEP_LINK_PREFIX,
  MAX_LAYOUT_BLOB_BYTES,
  buildLayoutDeepLink,
  canonicalLayoutBytes,
  decodeLayoutBlob,
  encodeLayoutBlob,
  extractLayoutBlob,
  layoutDecodeErrorMessage,
  type MkLayoutDocument,
} from '../index';

const DOC: MkLayoutDocument = {
  capabilities: ['video', 'embeds'],
  tiers: [
    { id: 'supporter', name: 'Supporter', priceRef: 'tier_supporter_v1', perks: ['Early drops'], channelIds: ['backstage'] },
  ],
  home: [
    { type: 'hero', config: { title: 'Welcome' } },
    { type: 'chat', config: { channelId: 'general' } },
  ],
  channels: {
    general: [{ type: 'chat', config: {} }],
  },
};

describe('encode/decode round trip', () => {
  it('round-trips a document and is canonically stable across key order', () => {
    const blob = encodeLayoutBlob(DOC);
    expect(blob.startsWith(LAYOUT_BLOB_PREFIX)).toBe(true);
    const decoded = decodeLayoutBlob(blob);
    expect(decoded.success).toBe(true);
    if (!decoded.success) throw new Error('expected success');
    expect(decoded.layout).toEqual(DOC);

    const reordered = JSON.parse(JSON.stringify(DOC)) as MkLayoutDocument;
    // Rebuild home[0] with reversed key order; canonical bytes must not care.
    reordered.home[0] = { config: { title: 'Welcome' }, type: 'hero' } as never;
    expect(encodeLayoutBlob(reordered)).toBe(blob);
    expect(Buffer.from(canonicalLayoutBytes(reordered))).toEqual(Buffer.from(canonicalLayoutBytes(DOC)));
  });

  it('wraps and extracts the deep link form', () => {
    const link = buildLayoutDeepLink(DOC);
    expect(link.startsWith(LAYOUT_DEEP_LINK_PREFIX)).toBe(true);
    const blob = extractLayoutBlob(link);
    expect(blob).toBe(encodeLayoutBlob(DOC));
    expect(extractLayoutBlob('https://example.com/nope')).toBeNull();
    const decoded = decodeLayoutBlob(link);
    expect(decoded.success).toBe(true);
  });
});

describe('decode guards (untrusted input, never throws)', () => {
  it('rejects a non-namespace string as malformed', () => {
    expect(decodeLayoutBlob('meerkat-theme:v1:abc:00000000')).toMatchObject({
      success: false,
      error: { code: 'malformed' },
    });
  });

  it('gates newer versions honestly', () => {
    const result = decodeLayoutBlob('meerkat-layout:v2:abc:00000000');
    expect(result).toMatchObject({ success: false, error: { code: 'newer-version' } });
    if (!result.success) {
      expect(result.error.message).toBe(layoutDecodeErrorMessage('newer-version'));
    }
  });

  it('rejects an oversized raw input before any decoding work', () => {
    const huge = LAYOUT_BLOB_PREFIX + 'A'.repeat(200 * 1024);
    expect(decodeLayoutBlob(huge)).toMatchObject({ success: false, error: { code: 'too-large' } });
  });

  it('rejects a decoded payload over the 32 KB cap', () => {
    const bigDoc: MkLayoutDocument = {
      capabilities: [],
      tiers: [],
      home: Array.from({ length: 64 }, (_, i) => ({
        type: 'hero',
        config: { title: `t${i}`, body: 'x'.repeat(700) },
      })),
      channels: {},
    };
    expect(() => encodeLayoutBlob(bigDoc)).toThrow(/32 KB/);
  });

  it('rejects a corrupted checksum', () => {
    const blob = encodeLayoutBlob(DOC);
    const flipped = blob.slice(0, -1) + (blob.endsWith('0') ? '1' : '0');
    expect(decodeLayoutBlob(flipped)).toMatchObject({ success: false, error: { code: 'checksum' } });
  });

  it('rejects tampered base64 bytes via the checksum', () => {
    const blob = encodeLayoutBlob(DOC);
    const body = blob.slice(LAYOUT_BLOB_PREFIX.length);
    const [b64, crc] = body.split(':');
    const tamperedB64 = (b64[0] === 'A' ? 'B' : 'A') + b64.slice(1);
    expect(decodeLayoutBlob(`${LAYOUT_BLOB_PREFIX}${tamperedB64}:${crc}`)).toMatchObject({
      success: false,
      error: { code: 'checksum' },
    });
  });

  it('rejects a schema-invalid document with field details', () => {
    // Valid JSON + checksum, wrong shape: an extra top-level key.
    const bad = { ...DOC, extra: true } as unknown as MkLayoutDocument;
    // encodeLayoutBlob would throw on parse, so hand-build the blob.
    const json = JSON.stringify(bad);
    const bytes = new TextEncoder().encode(json);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    const crcHex = ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
    const b64 = Buffer.from(bytes).toString('base64url');
    const result = decodeLayoutBlob(`${LAYOUT_BLOB_PREFIX}${b64}:${crcHex}`);
    expect(result).toMatchObject({ success: false, error: { code: 'schema' } });
    if (!result.success) expect(result.error.details?.length).toBeGreaterThan(0);
  });
});

describe('forward-compat holes are exactly the two intended ones', () => {
  it('accepts unknown block types and unknown capability slugs', () => {
    const doc: MkLayoutDocument = {
      capabilities: ['holograms'],
      tiers: [],
      home: [{ type: 'future_block', config: { anything: [1, 2, 3] } }],
      channels: {},
    };
    const decoded = decodeLayoutBlob(encodeLayoutBlob(doc));
    expect(decoded.success).toBe(true);
  });

  it('still rejects unknown keys on nodes and tiers (type-exact boundary)', () => {
    const badNode = {
      capabilities: [],
      tiers: [],
      home: [{ type: 'hero', config: {}, onClick: 'evil' }],
      channels: {},
    } as unknown as MkLayoutDocument;
    expect(() => encodeLayoutBlob(badNode)).toThrow();
  });

  it('caps document size limits: 32 capabilities, 64 home blocks', () => {
    const overCaps: MkLayoutDocument = {
      capabilities: Array.from({ length: 33 }, (_, i) => `cap_${i}`),
      tiers: [],
      home: [],
      channels: {},
    };
    expect(() => encodeLayoutBlob(overCaps)).toThrow();
    const overHome: MkLayoutDocument = {
      capabilities: [],
      tiers: [],
      home: Array.from({ length: 65 }, () => ({ type: 'hero', config: {} })),
      channels: {},
    };
    expect(() => encodeLayoutBlob(overHome)).toThrow();
  });

  it('rejects duplicate tier ids', () => {
    const dupTiers: MkLayoutDocument = {
      capabilities: [],
      tiers: [
        { id: 'a', name: 'A', priceRef: null, perks: [], channelIds: [] },
        { id: 'a', name: 'A2', priceRef: null, perks: [], channelIds: [] },
      ],
      home: [],
      channels: {},
    };
    expect(() => encodeLayoutBlob(dupTiers)).toThrow();
  });
});

describe('blob cap constant', () => {
  it('exposes the 32 KB cap for consumers (sync-side event validation)', () => {
    expect(MAX_LAYOUT_BLOB_BYTES).toBe(32 * 1024);
  });
});

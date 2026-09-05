/**
 * OS share-intake model (Plan 20, Phase 8). TC-12.
 *
 * Pure, platform-agnostic normalization of an incoming OS-shared item into a
 * payload the app stages device-locally (mk_share_*) and content-addresses into
 * the EXISTING blob store. The model: classifies url vs text, sniffs the real
 * type from magic bytes (NEVER trusts the sender-declared MIME), enforces a size
 * guard, supports multi-item. The DB rows + blob storage are app glue; this core
 * is unit-testable and never emits a sync row (device-local by construction).
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHARE_MAX_BYTES,
  normalizeSharedItem,
  normalizeSharedItems,
  sniffMime,
} from '../share/share-intake';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

describe('sniffMime (magic bytes, sender MIME ignored)', () => {
  it('detects png, jpeg, pdf, gif', () => {
    expect(sniffMime(png)).toBe('image/png');
    expect(sniffMime(jpeg)).toBe('image/jpeg');
    expect(sniffMime(pdf)).toBe('application/pdf');
    expect(sniffMime(gif)).toBe('image/gif');
  });
  it('returns undefined for unknown bytes', () => {
    expect(sniffMime(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeUndefined();
  });
});

describe('normalizeSharedItem', () => {
  it('classifies an http(s) string as a url', () => {
    const r = normalizeSharedItem({ text: '  https://example.com/x  ' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.kind).toBe('url');
      expect(r.payload.textValue).toBe('https://example.com/x');
    }
  });

  it('classifies a plain string as text', () => {
    const r = normalizeSharedItem({ text: 'just a note' });
    expect(r.ok && r.payload.kind).toBe('text');
  });

  it('SNIFFS the real type and ignores a lying declared MIME', () => {
    // sender claims text/plain but the bytes are a PNG
    const r = normalizeSharedItem({ bytes: png, declaredMime: 'text/plain', filename: 'evil.txt' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.kind).toBe('image');
      expect(r.payload.mime).toBe('image/png');
    }
  });

  it('maps a pdf to kind pdf and a sniffed file to kind file', () => {
    expect((normalizeSharedItem({ bytes: pdf }) as { payload: { kind: string } }).payload.kind).toBe('pdf');
    const unknown = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect((normalizeSharedItem({ bytes: unknown, filename: 'data.bin' }) as { payload: { kind: string } }).payload.kind).toBe('file');
  });

  it('enforces the size guard (rejects oversized, never silently drops)', () => {
    const r = normalizeSharedItem({ byteLength: DEFAULT_SHARE_MAX_BYTES + 1, filename: 'big.bin' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.toLowerCase()).toContain('too large');
  });

  it('rejects an empty item', () => {
    expect(normalizeSharedItem({}).ok).toBe(false);
    expect(normalizeSharedItem({ text: '   ' }).ok).toBe(false);
  });

  it('falls back to declared mime/uti for classification when no bytes are in hand yet (iOS provider)', () => {
    const r = normalizeSharedItem({ byteLength: 1000, declaredMime: 'video/mp4', filename: 'clip.mp4', uti: 'public.mpeg-4' });
    expect(r.ok && r.payload.kind).toBe('video');
  });
});

describe('normalizeSharedItems (multi-item)', () => {
  it('normalizes a mixed multi-item share and collects per-item errors', () => {
    const { payloads, errors } = normalizeSharedItems([
      { text: 'https://a.example' },
      { bytes: jpeg, declaredMime: 'application/octet-stream' },
      { byteLength: DEFAULT_SHARE_MAX_BYTES + 1, filename: 'huge.bin' },
      {},
    ]);
    expect(payloads.map((p) => p.kind)).toEqual(['url', 'image']);
    expect(errors).toHaveLength(2);
  });
});

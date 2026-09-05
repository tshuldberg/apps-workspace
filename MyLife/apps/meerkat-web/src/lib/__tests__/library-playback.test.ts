// Plan 38 Phase 6 (WEB): the honest container matrix. Every branch of
// playbackPlan is pinned here with a fake codec probe (Node has no MediaSource),
// and the unsupported copy is asserted VERBATIM.

import { describe, expect, it } from 'vitest';
import {
  OBJECT_URL_MAX_BYTES,
  UNSUPPORTED_PLAYBACK_COPY,
  playbackPlan,
  sniffContainer,
} from '../library-playback';

const supportAll = { isTypeSupported: () => true };
const supportNone = { isTypeSupported: () => false };

function bytes(...parts: (string | number[])[]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') for (const c of p) out.push(c.charCodeAt(0));
    else out.push(...p);
  }
  return new Uint8Array(out);
}

// A minimal ISO-BMFF header: [size][ftyp][major brand][...compatible brands].
function ftyp(major: string, ...boxes: string[]): Uint8Array {
  const parts: number[] = [];
  const box = (type: string, payload: number[]): void => {
    const size = 8 + payload.length;
    parts.push((size >>> 24) & 0xff, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff);
    for (const c of type) parts.push(c.charCodeAt(0));
    parts.push(...payload);
  };
  const brandBytes = major.split('').map((c) => c.charCodeAt(0));
  box('ftyp', brandBytes);
  for (const b of boxes) box(b, [0, 0, 0, 0]);
  return new Uint8Array(parts);
}

describe('sniffContainer', () => {
  it('detects fragmented vs plain MP4', () => {
    expect(sniffContainer(ftyp('isom', 'moov', 'mdat'), null)).toBe('mp4-plain');
    expect(sniffContainer(ftyp('isom', 'moov', 'moof'), null)).toBe('mp4-fragmented');
    expect(sniffContainer(ftyp('dash', 'moov'), null)).toBe('mp4-fragmented');
    expect(sniffContainer(ftyp('isom', 'styp'), null)).toBe('mp4-fragmented');
  });

  it('distinguishes webm from mkv by EBML doctype', () => {
    expect(sniffContainer(bytes([0x1a, 0x45, 0xdf, 0xa3], 'xxxxwebmxxxx'), null)).toBe('webm');
    expect(sniffContainer(bytes([0x1a, 0x45, 0xdf, 0xa3], 'xxmatroskaxx'), null)).toBe('mkv');
  });

  it('detects audio magics', () => {
    expect(sniffContainer(bytes('ID3', [0, 0]), null)).toBe('mp3');
    expect(sniffContainer(bytes([0xff, 0xfb, 0x90]), null)).toBe('mp3');
    expect(sniffContainer(bytes('fLaC', [0, 0]), null)).toBe('flac');
    expect(sniffContainer(bytes('OggS', [0, 0]), null)).toBe('ogg');
    expect(sniffContainer(bytes('RIFF', [0, 0, 0, 0], 'WAVE'), null)).toBe('wav');
  });

  it('falls back to the mime hint only when magic is inconclusive', () => {
    expect(sniffContainer(bytes([1, 2, 3, 4]), 'audio/mpeg')).toBe('mp3');
    expect(sniffContainer(bytes([1, 2, 3, 4]), 'video/x-matroska')).toBe('mkv');
    expect(sniffContainer(bytes([1, 2, 3, 4]), null)).toBe('unknown');
  });
});

describe('playbackPlan honest matrix', () => {
  it('fragmented MP4 -> MSE with a concrete codec string', () => {
    const plan = playbackPlan(
      { header: ftyp('isom', 'moof'), mimeType: 'video/mp4', sizeBytes: 900 * 1024 * 1024 },
      supportAll,
    );
    expect(plan.mode).toBe('mse');
    expect(plan.element).toBe('video');
    expect(plan.mseMimeType).toMatch(/^video\/mp4/);
  });

  it('WebM -> MSE', () => {
    const plan = playbackPlan(
      { header: bytes([0x1a, 0x45, 0xdf, 0xa3], 'xxxxwebmxxxx'), mimeType: 'video/webm', sizeBytes: null },
      supportAll,
    );
    expect(plan.mode).toBe('mse');
    expect(plan.mseMimeType).toMatch(/^video\/webm/);
  });

  it('plain MP4 (small) -> object URL', () => {
    const plan = playbackPlan(
      { header: ftyp('isom', 'moov', 'mdat'), mimeType: 'video/mp4', sizeBytes: 12 * 1024 * 1024 },
      supportAll,
    );
    expect(plan.mode).toBe('object_url');
    expect(plan.element).toBe('video');
  });

  it('MKV -> unsupported with the exact honest copy', () => {
    const plan = playbackPlan(
      { header: bytes([0x1a, 0x45, 0xdf, 0xa3], 'xxmatroskaxx'), mimeType: 'video/x-matroska', sizeBytes: 700 * 1024 * 1024 },
      supportAll,
    );
    expect(plan.mode).toBe('unsupported');
    expect(plan.reason).toBe(UNSUPPORTED_PLAYBACK_COPY);
    expect(plan.reason).toBe('Not playable in the browser. Download it or play it on mobile.');
  });

  it('audio -> object URL on an <audio> element', () => {
    const plan = playbackPlan(
      { header: bytes('ID3', [0, 0]), mimeType: 'audio/mpeg', sizeBytes: 8 * 1024 * 1024 },
      supportAll,
    );
    expect(plan.mode).toBe('object_url');
    expect(plan.element).toBe('audio');
  });

  it('fragmented MP4 with unsupported codec falls back to object URL when small', () => {
    const plan = playbackPlan(
      { header: ftyp('isom', 'moof'), mimeType: 'video/mp4', sizeBytes: 10 * 1024 * 1024 },
      supportNone,
    );
    expect(plan.mode).toBe('object_url');
  });

  it('plain MP4 over the object-URL cap -> unsupported', () => {
    const plan = playbackPlan(
      { header: ftyp('isom', 'moov', 'mdat'), mimeType: 'video/mp4', sizeBytes: OBJECT_URL_MAX_BYTES + 1 },
      supportAll,
    );
    expect(plan.mode).toBe('unsupported');
    expect(plan.reason).toBe(UNSUPPORTED_PLAYBACK_COPY);
  });

  it('oversized audio -> unsupported', () => {
    const plan = playbackPlan(
      { header: bytes('fLaC', [0, 0]), mimeType: 'audio/flac', sizeBytes: OBJECT_URL_MAX_BYTES + 1 },
      supportAll,
    );
    expect(plan.mode).toBe('unsupported');
  });
});

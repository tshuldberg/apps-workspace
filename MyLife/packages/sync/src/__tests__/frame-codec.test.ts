/**
 * MK-007 -- length-prefix framing. TCP is a byte stream: frames arrive split,
 * glued, or byte-at-a-time. The decoder must reassemble all of it exactly.
 */

import { describe, it, expect } from 'vitest';
import { encodeFrame, FrameDecoder, MAX_FRAME_BYTES } from '../transport/frame-codec';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe('frame codec (MK-007)', () => {
  it('round-trips a frame', () => {
    const decoder = new FrameDecoder();
    const frames = decoder.push(encodeFrame(enc('hello')));
    expect(frames.map(dec)).toEqual(['hello']);
    expect(decoder.pendingBytes).toBe(0);
  });

  it('round-trips an empty payload', () => {
    const decoder = new FrameDecoder();
    expect(decoder.push(encodeFrame(new Uint8Array(0)))).toEqual([new Uint8Array(0)]);
  });

  it('reassembles a frame delivered byte by byte', () => {
    const decoder = new FrameDecoder();
    const wire = encodeFrame(enc('split across many chunks'));
    const got: string[] = [];
    for (let i = 0; i < wire.length; i++) {
      for (const frame of decoder.push(wire.slice(i, i + 1))) got.push(dec(frame));
    }
    expect(got).toEqual(['split across many chunks']);
  });

  it('separates multiple frames glued into one chunk', () => {
    const decoder = new FrameDecoder();
    const a = encodeFrame(enc('first'));
    const b = encodeFrame(enc('second'));
    const glued = new Uint8Array(a.length + b.length);
    glued.set(a, 0);
    glued.set(b, a.length);
    expect(decoder.push(glued).map(dec)).toEqual(['first', 'second']);
  });

  it('handles a chunk boundary inside the 4-byte header', () => {
    const decoder = new FrameDecoder();
    const wire = encodeFrame(enc('boundary'));
    expect(decoder.push(wire.slice(0, 2))).toEqual([]);
    expect(decoder.push(wire.slice(2)).map(dec)).toEqual(['boundary']);
  });

  it('rejects encoding a frame over the limit', () => {
    expect(() => encodeFrame(new Uint8Array(MAX_FRAME_BYTES + 1))).toThrow(/exceeds/);
  });

  it('throws on an incoming frame that declares an oversized length', () => {
    const decoder = new FrameDecoder();
    const evil = new Uint8Array(4);
    new DataView(evil.buffer).setUint32(0, MAX_FRAME_BYTES + 1, false);
    expect(() => decoder.push(evil)).toThrow(/limit/);
    expect(decoder.pendingBytes).toBe(0); // stream poisoned and reset
  });

  it('round-trips binary payloads exactly', () => {
    const payload = new Uint8Array(1000);
    for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 0xff;
    const decoder = new FrameDecoder();
    const frames = decoder.push(encodeFrame(payload));
    expect(frames).toHaveLength(1);
    expect(Array.from(frames[0]!)).toEqual(Array.from(payload));
  });
});

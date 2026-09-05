import { describe, it, expect } from 'vitest';
import {
  chunkContent,
  merkleRoot,
  computeContentId,
  reassemble,
} from '../content';

function bytes(n: number): Uint8Array {
  // The extra (i/97) term breaks the period-256 pattern so that fixed-size
  // chunks are genuinely distinct (a pure i*k mod 256 repeats every chunk).
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + 7 + ((i / 97) | 0) * 13) & 0xff;
  return out;
}

describe('content addressing', () => {
  it('chunks to the requested size with a hashed tail', () => {
    const data = bytes(1000);
    const chunks = chunkContent(data, 256);
    expect(chunks.length).toBe(4); // 256*3 + 232
    expect(chunks[0]!.bytes.length).toBe(256);
    expect(chunks[3]!.bytes.length).toBe(232);
    for (const c of chunks) expect(c.hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it('produces a single empty chunk for empty content', () => {
    const chunks = chunkContent(new Uint8Array(0));
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.bytes.length).toBe(0);
  });

  it('computes a deterministic content id', () => {
    const data = bytes(5000);
    expect(computeContentId(chunkContent(data, 256))).toBe(
      computeContentId(chunkContent(data, 256)),
    );
  });

  it('changes the content id when any byte changes', () => {
    const a = bytes(5000);
    const b = bytes(5000);
    b[2500] = (b[2500]! + 1) & 0xff;
    expect(computeContentId(chunkContent(a, 256))).not.toBe(
      computeContentId(chunkContent(b, 256)),
    );
  });

  it('reassembles chunks back into the original bytes', () => {
    const data = bytes(3333);
    const chunks = chunkContent(data, 500);
    const back = reassemble(chunks.map((c) => ({ index: c.index, bytes: c.bytes })));
    expect(Buffer.from(back).equals(Buffer.from(data))).toBe(true);
  });

  it('reassembles correctly even if chunks arrive out of order', () => {
    const data = bytes(2048);
    const chunks = chunkContent(data, 512).map((c) => ({ index: c.index, bytes: c.bytes }));
    const shuffled = [chunks[3]!, chunks[0]!, chunks[2]!, chunks[1]!];
    const back = reassemble(shuffled);
    expect(Buffer.from(back).equals(Buffer.from(data))).toBe(true);
  });

  it('merkle root differs by ordering of distinct leaves', () => {
    const h = chunkContent(bytes(2048), 512).map((c) => c.hash);
    const reversed = [...h].reverse();
    expect(merkleRoot(h)).not.toBe(merkleRoot(reversed));
  });
});

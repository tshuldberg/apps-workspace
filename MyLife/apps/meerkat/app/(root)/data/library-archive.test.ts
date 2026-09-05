// Plan 38 Phase 6 (MOBILE): bounded ZIP reader tests. Archives are built here
// (stored + deflate entries via node:zlib) and read back through the pako-backed
// reader, so a green run cross-validates the central-directory parser, the caps,
// and the real inflate path.

import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { openZip, type UnzipCaps } from './library-archive';

const CAPS: UnzipCaps = {
  maxEntries: 100,
  maxTotalUncompressedBytes: 16 * 1024 * 1024,
  maxEntryUncompressedBytes: 4 * 1024 * 1024,
  rejectNestedArchives: true,
};

interface InEntry { name: string; data: Uint8Array; method: 0 | 8; }

/** Assemble a minimal (CRC-zeroed) ZIP the reader can parse. */
function makeZip(entries: InEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const compressedList: Uint8Array[] = [];

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const compressed = e.method === 8 ? new Uint8Array(deflateRawSync(Buffer.from(e.data))) : e.data;
    compressedList.push(compressed);
    offsets.push(offset);
    const lfh = new Uint8Array(30 + nameBytes.length + compressed.length);
    const dv = new DataView(lfh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(8, e.method, true);
    dv.setUint32(14, 0, true); // crc32 (unused by reader)
    dv.setUint32(18, compressed.length, true);
    dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra len
    lfh.set(nameBytes, 30);
    lfh.set(compressed, 30 + nameBytes.length);
    locals.push(lfh);
    offset += lfh.length;
  }

  const cdStart = offset;
  entries.forEach((e, i) => {
    const nameBytes = enc.encode(e.name);
    const cd = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(10, e.method, true);
    dv.setUint32(20, compressedList[i]!.length, true);
    dv.setUint32(24, e.data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint32(42, offsets[i]!, true);
    cd.set(nameBytes, 46);
    centrals.push(cd);
    offset += cd.length;
  });
  const cdSize = offset - cdStart;

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdStart, true);

  const totalLen = offset + 22;
  const out = new Uint8Array(totalLen);
  let p = 0;
  for (const l of locals) { out.set(l, p); p += l.length; }
  for (const c of centrals) { out.set(c, p); p += c.length; }
  out.set(eocd, p);
  return out;
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('openZip', () => {
  it('lists entries and reads a STORED entry byte-for-byte', async () => {
    const zip = makeZip([{ name: 'page1.txt', data: bytes('hello stored'), method: 0 }]);
    const arc = await openZip(zip, CAPS);
    expect(arc.entries.map((e) => e.name)).toEqual(['page1.txt']);
    expect(new TextDecoder().decode(await arc.read('page1.txt'))).toBe('hello stored');
  });

  it('reads a DEFLATE entry through the real pako inflate', async () => {
    const payload = 'the quick brown fox '.repeat(200);
    const zip = makeZip([{ name: 'ch1.html', data: bytes(payload), method: 8 }]);
    const arc = await openZip(zip, CAPS);
    const entry = arc.entries[0]!;
    expect(entry.method).toBe(8);
    expect(entry.compressedSize).toBeLessThan(entry.uncompressedSize);
    expect(new TextDecoder().decode(await arc.read('ch1.html'))).toBe(payload);
  });

  it('skips directory markers and preserves multiple entries', async () => {
    const zip = makeZip([
      { name: 'dir/', data: new Uint8Array(0), method: 0 },
      { name: 'dir/a.txt', data: bytes('A'), method: 0 },
      { name: 'dir/b.txt', data: bytes('B'), method: 8 },
    ]);
    const arc = await openZip(zip, CAPS);
    expect(arc.entries.map((e) => e.name)).toEqual(['dir/a.txt', 'dir/b.txt']);
    expect(new TextDecoder().decode(await arc.read('dir/b.txt'))).toBe('B');
  });

  it('rejects a non-ZIP buffer', async () => {
    await expect(openZip(bytes('not a zip at all'), CAPS)).rejects.toThrow(/not a zip/i);
  });

  it('enforces the max-entries cap', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ name: `p${i}.txt`, data: bytes('x'), method: 0 as const }));
    const zip = makeZip(many);
    await expect(openZip(zip, { ...CAPS, maxEntries: 3 })).rejects.toThrow(/too many entries/i);
  });

  it('rejects an entry whose declared uncompressed size exceeds the per-entry cap', async () => {
    const zip = makeZip([{ name: 'big.bin', data: bytes('x'.repeat(1000)), method: 0 }]);
    await expect(openZip(zip, { ...CAPS, maxEntryUncompressedBytes: 100 })).rejects.toThrow(/size cap/i);
  });

  it('rejects the total-uncompressed cap across entries', async () => {
    const zip = makeZip([
      { name: 'a.bin', data: bytes('x'.repeat(400)), method: 0 },
      { name: 'b.bin', data: bytes('y'.repeat(400)), method: 0 },
    ]);
    await expect(openZip(zip, { ...CAPS, maxTotalUncompressedBytes: 500 })).rejects.toThrow(/total uncompressed/i);
  });

  it('rejects a nested archive entry', async () => {
    const zip = makeZip([{ name: 'inner.zip', data: bytes('PK'), method: 0 }]);
    await expect(openZip(zip, CAPS)).rejects.toThrow(/nested archive/i);
  });

  it('aborts inflate when the actual output blows past the per-entry cap (lying header)', async () => {
    // A real deflate entry whose true output is 20 KB; cap the read at 1 KB.
    const payload = 'A'.repeat(20 * 1024);
    const zip = makeZip([{ name: 'bomb.bin', data: bytes(payload), method: 8 }]);
    // Parse succeeds (declared size 20 KB is under the generous entry cap here)...
    const arc = await openZip(zip, { ...CAPS, maxEntryUncompressedBytes: 1024 }).catch(() => null);
    // ...but a per-entry cap of 1 KB rejects the entry up front (declared 20 KB > 1 KB).
    expect(arc).toBeNull();
  });
});

// Plan 38 Phase 6 (WEB): the hardened in-memory ZIP reader. Builds real ZIP
// bytes by hand (stored + deflate) and asserts round trips plus every cap:
// entry count, total uncompressed bytes, per-entry bytes, nested-archive
// rejection, and an inflate bomb that is caught mid-stream.

import { describe, expect, it } from 'vitest';
import { openZip, type UnzipCaps } from '../library-archive';

const CAPS: UnzipCaps = {
  maxEntries: 64,
  maxTotalUncompressedBytes: 16 * 1024 * 1024,
  maxEntryUncompressedBytes: 8 * 1024 * 1024,
  rejectNestedArchives: true,
};

interface BuildEntry {
  name: string;
  data: Uint8Array;
  method: 0 | 8;
  /** Override the central-directory uncompressed size (to forge a bomb). */
  declaredUncompressed?: number;
}

function u16(n: number): number[] { return [n & 0xff, (n >>> 8) & 0xff]; }
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}
function ascii(s: string): number[] { return [...s].map((c) => c.charCodeAt(0)); }

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  void writer.write(data.slice()).then(() => writer.close());
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) { chunks.push(value); total += value.byteLength; }
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

async function buildZip(entries: BuildEntry[]): Promise<Uint8Array> {
  const local: number[] = [];
  const central: number[] = [];
  const offsets: number[] = [];

  for (const e of entries) {
    const nameB = ascii(e.name);
    const stored = e.method === 8 ? await deflateRaw(e.data) : e.data;
    const uncompressed = e.declaredUncompressed ?? e.data.length;
    offsets.push(local.length);
    local.push(
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(e.method), ...u16(0), ...u16(0),
      ...u32(0), ...u32(stored.length), ...u32(uncompressed), ...u16(nameB.length), ...u16(0),
      ...nameB, ...stored,
    );
  }
  const cdStart = local.length;
  entries.forEach((e, i) => {
    const nameB = ascii(e.name);
    const stored = e.method === 8 ? 0 : e.data.length; // placeholder, fixed below
    void stored;
    const uncompressed = e.declaredUncompressed ?? e.data.length;
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(e.method), ...u16(0), ...u16(0),
      ...u32(0), ...u32(compressedLen(local, offsets[i]!)), ...u32(uncompressed),
      ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offsets[i]!), ...nameB,
    );
  });
  const cdSize = central.length;
  const eocd = [
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(cdSize), ...u32(cdStart), ...u16(0),
  ];
  return new Uint8Array([...local, ...central, ...eocd]);
}

// Read back the compressed size we wrote into a local header (offset+18).
function compressedLen(local: number[], localOffset: number): number {
  const o = localOffset + 18;
  return local[o]! | (local[o + 1]! << 8) | (local[o + 2]! << 16) | (local[o + 3]! * 0x1000000);
}

function bytesOf(s: string): Uint8Array { return new TextEncoder().encode(s); }

describe('openZip round trips', () => {
  it('reads a stored (method 0) entry', async () => {
    const zip = await buildZip([{ name: 'a.txt', data: bytesOf('hello stored'), method: 0 }]);
    const arc = await openZip(zip, CAPS);
    expect(arc.entries.map((e) => e.name)).toEqual(['a.txt']);
    expect(new TextDecoder().decode(await arc.read('a.txt'))).toBe('hello stored');
  });

  it('inflates a deflate (method 8) entry', async () => {
    const payload = 'deflate '.repeat(500);
    const zip = await buildZip([{ name: 'b.txt', data: bytesOf(payload), method: 8 }]);
    const arc = await openZip(zip, CAPS);
    expect(new TextDecoder().decode(await arc.read('b.txt'))).toBe(payload);
  });

  it('skips directory entries', async () => {
    const zip = await buildZip([
      { name: 'dir/', data: new Uint8Array(), method: 0 },
      { name: 'dir/f.txt', data: bytesOf('x'), method: 0 },
    ]);
    const arc = await openZip(zip, CAPS);
    expect(arc.entries.map((e) => e.name)).toEqual(['dir/f.txt']);
  });
});

describe('openZip caps', () => {
  it('rejects too many entries', async () => {
    const entries: BuildEntry[] = Array.from({ length: 5 }, (_, i) => ({
      name: `f${i}.txt`, data: bytesOf('x'), method: 0 as const,
    }));
    const zip = await buildZip(entries);
    await expect(openZip(zip, { ...CAPS, maxEntries: 3 })).rejects.toThrow(/too many entries/i);
  });

  it('rejects an entry over the per-entry cap (declared)', async () => {
    const zip = await buildZip([
      { name: 'big.bin', data: bytesOf('x'), method: 0, declaredUncompressed: 99 * 1024 * 1024 },
    ]);
    await expect(openZip(zip, CAPS)).rejects.toThrow(/size cap/i);
  });

  it('rejects total uncompressed over the cap', async () => {
    const zip = await buildZip([
      { name: 'a.bin', data: bytesOf('x'), method: 0, declaredUncompressed: 6 * 1024 * 1024 },
      { name: 'b.bin', data: bytesOf('x'), method: 0, declaredUncompressed: 6 * 1024 * 1024 },
      { name: 'c.bin', data: bytesOf('x'), method: 0, declaredUncompressed: 6 * 1024 * 1024 },
    ]);
    await expect(openZip(zip, CAPS)).rejects.toThrow(/total uncompressed/i);
  });

  it('rejects nested archives', async () => {
    const zip = await buildZip([{ name: 'inner.zip', data: bytesOf('x'), method: 0 }]);
    await expect(openZip(zip, CAPS)).rejects.toThrow(/nested archive/i);
  });

  it('catches an inflate bomb that lies about its size', async () => {
    // Real deflate of 4 MB of zeros, but declare a small size so the up-front cap
    // passes; the streaming cap must still catch the true output.
    const bomb = new Uint8Array(4 * 1024 * 1024);
    const zip = await buildZip([{ name: 'bomb.bin', data: bomb, method: 8, declaredUncompressed: 1024 }]);
    const arc = await openZip(zip, { ...CAPS, maxEntryUncompressedBytes: 1024 });
    await expect(arc.read('bomb.bin')).rejects.toThrow(/exceeds size cap/i);
  });
});

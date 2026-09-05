import { describe, expect, it } from 'vitest';

import {
  __blockInfo,
  __byteCountBits,
  __dataModuleOrder,
  __formatBits,
  __formatCoords,
  __maskBit,
  __reservedMap,
  __rsEncode,
  encodeQrMatrix,
  qrByteCeiling,
  qrCanEncode,
  QrTooLargeError,
  type QrEcLevel,
  type QrMatrix,
} from '../qr';

// ---------------------------------------------------------------------------
// Independent reference matrices (known-answer vectors).
//
// These three grids were produced by quickchart.io/qr, which renders with the
// widely used node-qrcode library (a Nayuki-derived, ISO/IEC 18004 spec-faithful
// implementation). They are an authoritative external oracle wholly independent
// of this encoder. Each was requested in byte mode at EC level M with no margin,
// then the SVG stroke path was transcribed to 1 = dark, 0 = light. Lowercase
// inputs guarantee BYTE mode (alphanumeric mode cannot represent lowercase
// letters), so they exercise the public byte-mode path directly. The three
// versions (1, 3, 11) cover finder/timing/format, a single alignment pattern, a
// full alignment grid plus version information (v >= 7), multi-block
// Reed-Solomon interleaving, and spec mask selection.
//
// The v1 and v11 grids are byte-identical to those emitted by a second
// independent generator (api.qrserver.com / goQR.me). The two generators
// disagreed only on v3: goQR.me emitted a non-minimal mask (mask 2, penalty
// 1512) while node-qrcode and this encoder both select the spec-mandated
// lowest-penalty mask (mask 3, penalty 1300). The spec-faithful result is used.
//
// Source: https://quickchart.io/qr?text=...&ecLevel=M&margin=0&format=svg
// ---------------------------------------------------------------------------

const REF_V1_HELLO_M: string[] = [
  '111111100101101111111',
  '100000100010001000001',
  '101110101111001011101',
  '101110101110101011101',
  '101110101010101011101',
  '100000101001001000001',
  '111111101010101111111',
  '000000001010000000000',
  '101111100101001111100',
  '011011010101111111101',
  '101011110110111001110',
  '101001000101110011100',
  '000101111100111000001',
  '000000001010100011001',
  '111111100001001000110',
  '100000101000010101111',
  '101110101001001100001',
  '101110101100111111000',
  '101110101100100100100',
  '100000100110110011100',
  '111111101101101010010',
];

const REF_V3_M: string[] = [
  '11111110101010101011101111111',
  '10000010110001101110001000001',
  '10111010010111001011101011101',
  '10111010111011011101001011101',
  '10111010011010111101001011101',
  '10000010010111001011001000001',
  '11111110101010101010101111111',
  '00000000101100100110100000000',
  '10110111000000101111001001011',
  '00110001000010100001011011111',
  '10100011101100001000000100110',
  '11111001101101000000001110001',
  '11001111001011110100100000101',
  '10001100111000111001011101001',
  '10001010110101100101111000111',
  '01111001111100111000010110000',
  '00001110110001010011110110010',
  '01000101100111110000100101000',
  '10100011111101011010011010000',
  '00000000110010001110100011100',
  '01111010101110101111111110100',
  '00000000100000101000100011011',
  '11111110100010000111101011010',
  '10000010110111001001100010000',
  '10111010011000000110111110111',
  '10111010110011111101010111001',
  '10111010110001001001000100101',
  '10000010000010111011111001010',
  '11111110111111101011110101010',
];

const REF_V11_M: string[] = [
  '1111111000101101110000011000100100010001111010001001101111111',
  '1000001001011010101010001111111001100010110011111001101000001',
  '1011101010011001001110110010101100100110111010000011101011101',
  '1011101011000110010110001000100001101010011100011110101011101',
  '1011101011101011001000001010111110100111111000001111001011101',
  '1000001010100010101011100001100011010001100101101110001000001',
  '1111111010101010101010101010101010101010101010101010101111111',
  '0000000011110010001100011000100010010101111011000001000000000',
  '1011111000111001010111011100111110011010011101011001101111100',
  '0011100110001001100010111111010011000101011000001100011000010',
  '0011101000100001010011101001100101100010000001101011000001111',
  '0000010000101100011011101001001001100010110111100111001110000',
  '1111001101011101001100111100100010011000010101101011101101101',
  '0110100110011000010010001011101111001100111010000000011101010',
  '1011011001010101011001011011111101100010110010110011000001111',
  '0111100000100111001110100101011001011011000010100011011011011',
  '1101101111000100001010011100010001001101001100111011111101101',
  '1110100010001110000001010110011010011001111010000100011110010',
  '0010001101011001100011001001111000101010100100101110100001011',
  '1111100101111110101111110101011111000001100111110110010110011',
  '1010101011100000100111110000100100011001011101011111110101111',
  '1110010011011011100000101100010110000100101100001101011010010',
  '1000101101110001100111100000000100101010000001101110100010011',
  '1100000000110100101100000001010011000000101110100001111010011',
  '1101111001000111111011111100001010001100010101101011111001101',
  '0001010001001011101000101111001001010000011000010101011011000',
  '1100001110100111010110011000101110011101010001101011100111111',
  '0111100011111110010000101100011011010100110010000001001010001',
  '1101111110101111001111000101111111011100011001101011111111101',
  '0111100011111010010011001111100010011101011110001100100010100',
  '1000101010010111010110011001101011101111010001100111101010111',
  '1110100010000001011101110011100011000101111010000001100010001',
  '1101111110000110000000000101111111011100000100011000111110101',
  '0000100001011110010011111110100110001001011000010100000001010',
  '1101111100110101001011110001101011111011000001111011011111011',
  '0001100101000011001010011110001100001001111110010100010010001',
  '1001101110001000110101000101011001010001011101111101011111101',
  '0110010010101011100010011110110100000101101000011101000101100',
  '0110111110001100010110110111011011110011000001111010111001010',
  '0101110011111000011111001011011000010111101010000100100000001',
  '0001101100001000100011001110011101011100001100001011110011101',
  '1100000110101111100011010000100101011100111001000100111101110',
  '1100111111000011010011000101110011111010100111101010011010011',
  '1000100011011010000111010000111100100111111011010100110110001',
  '1101011000010011000010000100011111111010001000111101111011101',
  '1110010001101111110101111011100110110111011010001100001100100',
  '0100101111000110000000111100001111010000100001101011111000101',
  '0100010001000000010010011100111100100001101110110000100000000',
  '1011111010100001000010110100001101011011001100111011100010110',
  '0100110000111001101001111010011000001001111000010101111101100',
  '0011111011000011010011110001111101110011010000110011111111001',
  '1110100100100010010101010011101000010001111010110100100101010',
  '1111001111111111100101100101111111011001011000011011111111100',
  '0000000011001111101101011011100010001100111000010101100010000',
  '1111111001101100010110111100101011101011010010110011101010001',
  '1000001011001101111001000000100011111100101010000111100010011',
  '1011101011100101111100100101111111001000001000011101111111111',
  '1011101011000011101010011010011100011100111100000100101010001',
  '1011101010100001111011001001100001101010100100111110000100001',
  '1000001000011101011100000101111111000101111011010100111111001',
  '1111111011100101101101011000001101011100001101011100100001111',
];

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function matrixToRows(m: QrMatrix): string[] {
  return m.matrix.map((row) => row.map((b) => (b ? '1' : '0')).join(''));
}

/** Independent UTF-8 decoder, so the round-trip catches a wrong UTF-8 encoder. */
function utf8Decode(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++]!;
    let cp: number;
    if (b0 < 0x80) {
      cp = b0;
    } else if (b0 < 0xe0) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i++]! & 0x3f);
    } else if (b0 < 0xf0) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i++]! & 0x3f) << 6) | (bytes[i++]! & 0x3f);
    } else {
      cp =
        ((b0 & 0x07) << 18) |
        ((bytes[i++]! & 0x3f) << 12) |
        ((bytes[i++]! & 0x3f) << 6) |
        (bytes[i++]! & 0x3f);
    }
    out += String.fromCodePoint(cp);
  }
  return out;
}

/**
 * Test-only reverse pipeline. Operates on a perfect boolean matrix: no image
 * processing and no Reed-Solomon error correction. Reads the format info to
 * recover EC level + mask, unmasks, reads codewords in the zigzag order,
 * de-interleaves to data codewords, and decodes the byte-mode segment.
 */
function readQrMatrix(m: QrMatrix): string {
  const { size, version } = m;
  const grid = m.matrix;

  // 1. Recover format info from copy 1 and resolve (ecLevel, mask).
  const { copy1 } = __formatCoords(size);
  let fmt = 0;
  for (let i = 0; i < 15; i++) {
    const [r, c] = copy1[i]!;
    if (grid[r]![c]) fmt |= 1 << i;
  }
  const levels: QrEcLevel[] = ['L', 'M', 'Q', 'H'];
  let ecLevel: QrEcLevel | null = null;
  let mask = -1;
  for (const lvl of levels) {
    for (let mk = 0; mk < 8; mk++) {
      if (__formatBits(lvl, mk) === fmt) {
        ecLevel = lvl;
        mask = mk;
      }
    }
  }
  if (ecLevel === null) throw new Error(`unresolved format info: ${fmt}`);

  // 2. Read codeword bits in zigzag order, unmasking as we go.
  const order = __dataModuleOrder(version);
  const bits: number[] = [];
  for (const [r, c] of order) {
    let v = grid[r]![c]!;
    if (__maskBit(mask, r, c)) v = !v;
    bits.push(v ? 1 : 0);
  }

  // 3. Group into codewords (the matrix may carry remainder bits we ignore).
  const info = __blockInfo(version, ecLevel);
  const numBlocks = info.dataBlocks.length;
  const totalData = info.dataBlocks.reduce((a, b) => a + b, 0);
  const totalCodewords = totalData + numBlocks * info.ecPerBlock;
  const codewords: number[] = [];
  for (let i = 0; i < totalCodewords; i++) {
    let cw = 0;
    for (let b = 0; b < 8; b++) cw = (cw << 1) | bits[i * 8 + b]!;
    codewords.push(cw);
  }

  // 4. De-interleave the data codewords back into per-block order.
  const interleavedData = codewords.slice(0, totalData);
  const maxData = Math.max(...info.dataBlocks);
  const blockData: number[][] = info.dataBlocks.map(() => []);
  let idx = 0;
  for (let col = 0; col < maxData; col++) {
    for (let b = 0; b < numBlocks; b++) {
      if (col < info.dataBlocks[b]!) blockData[b]!.push(interleavedData[idx++]!);
    }
  }
  const dataCodewords: number[] = [];
  for (const bd of blockData) dataCodewords.push(...bd);

  // 5. Decode the byte-mode segment.
  const dataBits: number[] = [];
  for (const cw of dataCodewords) for (let b = 7; b >= 0; b--) dataBits.push((cw >> b) & 1);
  let p = 0;
  const readBits = (n: number): number => {
    let v = 0;
    for (let k = 0; k < n; k++) v = (v << 1) | dataBits[p++]!;
    return v;
  };
  const mode = readBits(4);
  if (mode !== 0b0100) throw new Error(`expected byte mode, got ${mode}`);
  const len = readBits(__byteCountBits(version));
  const out: number[] = [];
  for (let k = 0; k < len; k++) out.push(readBits(8));
  return utf8Decode(out);
}

// ---------------------------------------------------------------------------
// 1. Independent known-answer vectors
// ---------------------------------------------------------------------------

describe('known-answer: full module grids (qrserver reference)', () => {
  it('reproduces the version-1-M byte-mode matrix for "hello world"', () => {
    const m = encodeQrMatrix('hello world', { ecLevel: 'M' });
    expect(m.version).toBe(1);
    expect(m.size).toBe(21);
    expect(matrixToRows(m)).toEqual(REF_V1_HELLO_M);
  });

  it('reproduces the version-3-M matrix (single alignment pattern)', () => {
    const m = encodeQrMatrix('hello world, this is meerkat theme qr test', {
      ecLevel: 'M',
    });
    expect(m.version).toBe(3);
    expect(m.size).toBe(29);
    expect(matrixToRows(m)).toEqual(REF_V3_M);
  });

  it('reproduces the version-11-M matrix (alignment grid + version info)', () => {
    const data =
      'the quick brown fox jumps over the lazy dog. '.repeat(4) +
      'meerkat theme system qr encoder reference vector.';
    const m = encodeQrMatrix(data, { ecLevel: 'M' });
    expect(m.version).toBe(11);
    expect(m.size).toBe(61);
    expect(matrixToRows(m)).toEqual(REF_V11_M);
  });
});

describe('known-answer: Reed-Solomon EC codewords (GF(256))', () => {
  it('matches the published HELLO WORLD version-1-M vector (10 EC codewords)', () => {
    // Source: thonky.com QR tutorial worked example (fetch-confirmed).
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(__rsEncode(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it('matches the published HELLO WORLD version-1-Q vector (13 EC codewords)', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
    expect(__rsEncode(data, 13)).toEqual([
      168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16,
    ]);
  });
});

describe('known-answer: format information BCH(15,5)', () => {
  it('encodes (M, mask 0) to the spec value 0b101010000010010', () => {
    // M = 00, mask 0 = 000 -> BCH remainder 0, XOR 0x5412 = 0x5412.
    expect(__formatBits('M', 0)).toBe(0b101010000010010);
    expect(__formatBits('M', 0)).toBe(0x5412);
  });

  it('produces 32 distinct 15-bit format strings', () => {
    const seen = new Set<number>();
    for (const lvl of ['L', 'M', 'Q', 'H'] as QrEcLevel[]) {
      for (let mk = 0; mk < 8; mk++) {
        const v = __formatBits(lvl, mk);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1 << 15);
        seen.add(v);
      }
    }
    expect(seen.size).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// 2. Clean-matrix round-trip
// ---------------------------------------------------------------------------

describe('round-trip on a perfect matrix', () => {
  const mixed1600 = Array.from(
    { length: 1600 },
    (_, i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'[i % 63],
  ).join('');

  const cases: Array<[string, string]> = [
    ['short string', 'hi'],
    ['version boundary (14 bytes, max v1-M)', 'abcdefghijklmn'],
    ['just over the v1 boundary (15 bytes)', 'abcdefghijklmno'],
    ['1600 identical chars', 'A'.repeat(1600)],
    ['1600 mixed base64url-like chars', mixed1600],
    ['utf-8 multibyte', 'café ☕ 日本語 🦦 €99'],
  ];

  for (const [label, input] of cases) {
    for (const ecLevel of ['L', 'M', 'Q', 'H'] as QrEcLevel[]) {
      it(`${label} @ ${ecLevel}`, () => {
        if (!qrCanEncode(input, ecLevel)) {
          // Too large for this level (e.g. 1600 bytes at H); it must reject.
          expect(() => encodeQrMatrix(input, { ecLevel })).toThrow(QrTooLargeError);
          return;
        }
        const m = encodeQrMatrix(input, { ecLevel });
        expect(readQrMatrix(m)).toBe(input);
      });
    }
  }

  it('selects version 1 for the 14-byte boundary string and 2 for 15 bytes (M)', () => {
    expect(encodeQrMatrix('abcdefghijklmn', { ecLevel: 'M' }).version).toBe(1);
    expect(encodeQrMatrix('abcdefghijklmno', { ecLevel: 'M' }).version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Structural assertions
// ---------------------------------------------------------------------------

describe('structural', () => {
  const finder = [
    '1111111',
    '1000001',
    '1011101',
    '1011101',
    '1011101',
    '1000001',
    '1111111',
  ];

  function block(m: QrMatrix, top: number, left: number, h: number, w: number): string[] {
    const rows: string[] = [];
    for (let r = 0; r < h; r++) {
      let s = '';
      for (let c = 0; c < w; c++) s += m.matrix[top + r]![left + c] ? '1' : '0';
      rows.push(s);
    }
    return rows;
  }

  it('size === 17 + 4 * version across a range of versions', () => {
    for (const [input, ec] of [
      ['hi', 'M'],
      ['A'.repeat(40), 'M'],
      ['A'.repeat(400), 'M'],
      ['A'.repeat(1200), 'H'],
      ['A'.repeat(1600), 'L'],
    ] as Array<[string, QrEcLevel]>) {
      const m = encodeQrMatrix(input, { ecLevel: ec });
      expect(m.size).toBe(17 + 4 * m.version);
      expect(m.matrix.length).toBe(m.size);
      expect(m.matrix.every((row) => row.length === m.size)).toBe(true);
    }
  });

  it('has the three finder patterns at the correct corners', () => {
    const m = encodeQrMatrix('hi', { ecLevel: 'M' });
    const n = m.size;
    expect(block(m, 0, 0, 7, 7)).toEqual(finder); // top-left
    expect(block(m, 0, n - 7, 7, 7)).toEqual(finder); // top-right
    expect(block(m, n - 7, 0, 7, 7)).toEqual(finder); // bottom-left
  });

  it('has alternating timing patterns on row 6 and column 6', () => {
    const m = encodeQrMatrix('A'.repeat(60), { ecLevel: 'M' });
    const n = m.size;
    for (let c = 8; c <= n - 9; c++) {
      expect(m.matrix[6]![c]).toBe(c % 2 === 0);
    }
    for (let r = 8; r <= n - 9; r++) {
      expect(m.matrix[r]![6]).toBe(r % 2 === 0);
    }
  });

  it('always sets the dark module at (4*version + 9, 8)', () => {
    const m = encodeQrMatrix('hello', { ecLevel: 'Q' });
    expect(m.matrix[4 * m.version + 9]![8]).toBe(true);
  });

  it('is deterministic (same input -> identical matrix)', () => {
    const a = encodeQrMatrix('determinism check 123', { ecLevel: 'M' });
    const b = encodeQrMatrix('determinism check 123', { ecLevel: 'M' });
    expect(matrixToRows(a)).toEqual(matrixToRows(b));
  });
});

// ---------------------------------------------------------------------------
// 4. Byte ceiling
// ---------------------------------------------------------------------------

describe('byte ceiling', () => {
  it('defaults to M and exposes the strict ordering L > M > Q > H', () => {
    expect(qrByteCeiling()).toBe(qrByteCeiling('M'));
    expect(qrByteCeiling('L')).toBeGreaterThan(qrByteCeiling('M'));
    expect(qrByteCeiling('M')).toBeGreaterThan(qrByteCeiling('Q'));
    expect(qrByteCeiling('Q')).toBeGreaterThan(qrByteCeiling('H'));
  });

  it('matches the published version-40 byte capacities', () => {
    expect(qrByteCeiling('L')).toBe(2953);
    expect(qrByteCeiling('M')).toBe(2331);
    expect(qrByteCeiling('Q')).toBe(1663);
    expect(qrByteCeiling('H')).toBe(1273);
  });

  it('encodes a string exactly at the ceiling and rejects one byte more', () => {
    for (const ec of ['L', 'M', 'Q', 'H'] as QrEcLevel[]) {
      const ceiling = qrByteCeiling(ec);
      const atCeiling = 'A'.repeat(ceiling);
      const overCeiling = 'A'.repeat(ceiling + 1);

      expect(qrCanEncode(atCeiling, ec)).toBe(true);
      const m = encodeQrMatrix(atCeiling, { ecLevel: ec });
      expect(m.version).toBe(40);

      expect(qrCanEncode(overCeiling, ec)).toBe(false);
      expect(() => encodeQrMatrix(overCeiling, { ecLevel: ec })).toThrow(QrTooLargeError);
    }
  });

  it('qrCanEncode never throws on oversize input', () => {
    expect(() => qrCanEncode('A'.repeat(100000), 'H')).not.toThrow();
    expect(qrCanEncode('A'.repeat(100000), 'H')).toBe(false);
  });

  it('counts UTF-8 bytes, not code points, against the ceiling', () => {
    // Each '€' is 3 UTF-8 bytes; default level M.
    const justOver = '€'.repeat(qrByteCeiling('M'));
    expect(qrCanEncode(justOver)).toBe(false);
  });
});

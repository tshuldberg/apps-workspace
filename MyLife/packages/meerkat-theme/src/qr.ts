// Pure-TypeScript QR Code encoder (ISO/IEC 18004), byte mode.
//
// Zero dependencies, no React/React Native/DOM globals, and fully
// deterministic (no Date.now / Math.random / argless new Date). Safe to run in
// Node, Hermes (React Native), and browsers. Encodes an ASCII/UTF-8 string in
// BYTE mode, auto-selecting the smallest version (1-40) that fits at the chosen
// error-correction level. The matrix is a boolean grid where true = dark.
//
// The exported `__`-prefixed helpers expose internal pieces (Reed-Solomon,
// masks, reserved map, zigzag order, format/block tables) so the test suite can
// implement an inverse reader and known-answer checks. They are intentionally
// not re-exported from the package barrel.

export type QrEcLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  matrix: boolean[][]; // true = dark module
  version: number;
  size: number;
}

export class QrTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrTooLargeError';
    Object.setPrototypeOf(this, QrTooLargeError.prototype);
  }
}

const LEVEL_INDEX: Record<QrEcLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };

// Error-correction characteristics per version (rows 1..40), per level [L,M,Q,H].
// Tuple: [ecCodewordsPerBlock, group1Blocks, group1DataCount, group2Blocks, group2DataCount].
// Source: ISO/IEC 18004 EC characteristics table (transcribed via thonky.com).
const EC_TABLE: ReadonlyArray<readonly [number, number, number, number, number][]> = [
  [[7,1,19,0,0], [10,1,16,0,0], [13,1,13,0,0], [17,1,9,0,0]], // v1
  [[10,1,34,0,0], [16,1,28,0,0], [22,1,22,0,0], [28,1,16,0,0]], // v2
  [[15,1,55,0,0], [26,1,44,0,0], [18,2,17,0,0], [22,2,13,0,0]], // v3
  [[20,1,80,0,0], [18,2,32,0,0], [26,2,24,0,0], [16,4,9,0,0]], // v4
  [[26,1,108,0,0], [24,2,43,0,0], [18,2,15,2,16], [22,2,11,2,12]], // v5
  [[18,2,68,0,0], [16,4,27,0,0], [24,4,19,0,0], [28,4,15,0,0]], // v6
  [[20,2,78,0,0], [18,4,31,0,0], [18,2,14,4,15], [26,4,13,1,14]], // v7
  [[24,2,97,0,0], [22,2,38,2,39], [22,4,18,2,19], [26,4,14,2,15]], // v8
  [[30,2,116,0,0], [22,3,36,2,37], [20,4,16,4,17], [24,4,12,4,13]], // v9
  [[18,2,68,2,69], [26,4,43,1,44], [24,6,19,2,20], [28,6,15,2,16]], // v10
  [[20,4,81,0,0], [30,1,50,4,51], [28,4,22,4,23], [24,3,12,8,13]], // v11
  [[24,2,92,2,93], [22,6,36,2,37], [26,4,20,6,21], [28,7,14,4,15]], // v12
  [[26,4,107,0,0], [22,8,37,1,38], [24,8,20,4,21], [22,12,11,4,12]], // v13
  [[30,3,115,1,116], [24,4,40,5,41], [20,11,16,5,17], [24,11,12,5,13]], // v14
  [[22,5,87,1,88], [24,5,41,5,42], [30,5,24,7,25], [24,11,12,7,13]], // v15
  [[24,5,98,1,99], [28,7,45,3,46], [24,15,19,2,20], [30,3,15,13,16]], // v16
  [[28,1,107,5,108], [28,10,46,1,47], [28,1,22,15,23], [28,2,14,17,15]], // v17
  [[30,5,120,1,121], [26,9,43,4,44], [28,17,22,1,23], [28,2,14,19,15]], // v18
  [[28,3,113,4,114], [26,3,44,11,45], [26,17,21,4,22], [26,9,13,16,14]], // v19
  [[28,3,107,5,108], [26,3,41,13,42], [30,15,24,5,25], [28,15,15,10,16]], // v20
  [[28,4,116,4,117], [26,17,42,0,0], [28,17,22,6,23], [30,19,16,6,17]], // v21
  [[28,2,111,7,112], [28,17,46,0,0], [30,7,24,16,25], [24,34,13,0,0]], // v22
  [[30,4,121,5,122], [28,4,47,14,48], [30,11,24,14,25], [30,16,15,14,16]], // v23
  [[30,6,117,4,118], [28,6,45,14,46], [30,11,24,16,25], [30,30,16,2,17]], // v24
  [[26,8,106,4,107], [28,8,47,13,48], [30,7,24,22,25], [30,22,15,13,16]], // v25
  [[28,10,114,2,115], [28,19,46,4,47], [28,28,22,6,23], [30,33,16,4,17]], // v26
  [[30,8,122,4,123], [28,22,45,3,46], [30,8,23,26,24], [30,12,15,28,16]], // v27
  [[30,3,117,10,118], [28,3,45,23,46], [30,4,24,31,25], [30,11,15,31,16]], // v28
  [[30,7,116,7,117], [28,21,45,7,46], [30,1,23,37,24], [30,19,15,26,16]], // v29
  [[30,5,115,10,116], [28,19,47,10,48], [30,15,24,25,25], [30,23,15,25,16]], // v30
  [[30,13,115,3,116], [28,2,46,29,47], [30,42,24,1,25], [30,23,15,28,16]], // v31
  [[30,17,115,0,0], [28,10,46,23,47], [30,10,24,35,25], [30,19,15,35,16]], // v32
  [[30,17,115,1,116], [28,14,46,21,47], [30,29,24,19,25], [30,11,15,46,16]], // v33
  [[30,13,115,6,116], [28,14,46,23,47], [30,44,24,7,25], [30,59,16,1,17]], // v34
  [[30,12,121,7,122], [28,12,47,26,48], [30,39,24,14,25], [30,22,15,41,16]], // v35
  [[30,6,121,14,122], [28,6,47,34,48], [30,46,24,10,25], [30,2,15,64,16]], // v36
  [[30,17,122,4,123], [28,29,46,14,47], [30,49,24,10,25], [30,24,15,46,16]], // v37
  [[30,4,122,18,123], [28,13,46,32,47], [30,48,24,14,25], [30,42,15,32,16]], // v38
  [[30,20,117,4,118], [28,40,47,7,48], [30,43,24,22,25], [30,10,15,67,16]], // v39
  [[30,19,118,6,119], [28,18,47,31,48], [30,34,24,34,25], [30,20,15,61,16]], // v40
];

// Alignment-pattern center coordinates per version (v1 has none).
const ALIGN_POSITIONS: ReadonlyArray<readonly number[]> = [
  [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46],
  [6,28,50], [6,30,54], [6,32,58], [6,34,62], [6,26,46,66], [6,26,48,70],
  [6,26,50,74], [6,30,54,78], [6,30,56,82], [6,30,58,86], [6,34,62,90],
  [6,28,50,72,94], [6,26,50,74,98], [6,30,54,78,102], [6,28,54,80,106],
  [6,32,58,84,110], [6,30,58,86,114], [6,34,62,90,118], [6,26,50,74,98,122],
  [6,30,54,78,102,126], [6,26,52,78,104,130], [6,30,56,82,108,134],
  [6,34,60,86,112,138], [6,30,58,86,114,142], [6,34,62,90,118,146],
  [6,30,54,78,102,126,150], [6,24,50,76,102,128,154], [6,28,54,80,106,132,158],
  [6,32,58,84,110,136,162], [6,26,54,82,110,138,166], [6,30,58,86,114,142,170],
];

// --------------------------------------------------------------------------
// GF(256) and Reed-Solomon
// --------------------------------------------------------------------------

const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Generator polynomial coefficients for the given EC codeword count. */
function rsComputeDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const degree = divisor.length;
  const result = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < degree; i++) result[i] ^= gfMul(divisor[i], factor);
  }
  return result;
}

export function __rsEncode(data: number[], ecCount: number): number[] {
  return rsRemainder(data, rsComputeDivisor(ecCount));
}

// --------------------------------------------------------------------------
// UTF-8 + capacity
// --------------------------------------------------------------------------

function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return out;
}

export function __byteCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

function totalDataCodewords(version: number, level: number): number {
  const [, g1b, g1d, g2b, g2d] = EC_TABLE[version - 1][level];
  return g1b * g1d + g2b * g2d;
}

/** Smallest version (1..40) whose data capacity fits the byte payload, else -1. */
function selectVersion(byteLen: number, level: number): number {
  for (let v = 1; v <= 40; v++) {
    const need = 4 + __byteCountBits(v) + 8 * byteLen;
    if (need <= totalDataCodewords(v, level) * 8) return v;
  }
  return -1;
}

export function qrByteCeiling(ecLevel: QrEcLevel = 'M'): number {
  // floor((D40*8 - 4 - 16) / 8) === D40 - 3 (count indicator is 16 bits at v40).
  return totalDataCodewords(40, LEVEL_INDEX[ecLevel]) - 3;
}

export function qrCanEncode(data: string, ecLevel: QrEcLevel = 'M'): boolean {
  return selectVersion(utf8Encode(data).length, LEVEL_INDEX[ecLevel]) >= 0;
}

// --------------------------------------------------------------------------
// Data codewords + interleaving
// --------------------------------------------------------------------------

function buildDataCodewords(bytes: number[], version: number, level: number): number[] {
  const capacityBits = totalDataCodewords(version, level) * 8;
  const bits: number[] = [];
  const append = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  append(0b0100, 4); // byte mode indicator
  append(bytes.length, __byteCountBits(version));
  for (const b of bytes) append(b, 8);

  append(0, Math.min(4, capacityBits - bits.length)); // terminator
  while (bits.length % 8 !== 0) bits.push(0); // pad to byte boundary

  const pad = [0xec, 0x11];
  let p = 0;
  while (bits.length < capacityBits) {
    append(pad[p % 2], 8);
    p++;
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    codewords.push(v);
  }
  return codewords;
}

export function __blockInfo(
  version: number,
  ecLevel: QrEcLevel,
): { ecPerBlock: number; dataBlocks: number[] } {
  const [ecPerBlock, g1b, g1d, g2b, g2d] = EC_TABLE[version - 1][LEVEL_INDEX[ecLevel]];
  const dataBlocks: number[] = [];
  for (let i = 0; i < g1b; i++) dataBlocks.push(g1d);
  for (let i = 0; i < g2b; i++) dataBlocks.push(g2d);
  return { ecPerBlock, dataBlocks };
}

/** Split data into blocks, compute EC, then interleave data then EC codewords. */
function buildFinalCodewords(dataCw: number[], version: number, level: number): number[] {
  const [ecPerBlock, g1b, g1d, g2b, g2d] = EC_TABLE[version - 1][level];
  const divisor = rsComputeDivisor(ecPerBlock);
  const blocks: { data: number[]; ec: number[] }[] = [];

  let pos = 0;
  const pushBlocks = (count: number, dataLen: number): void => {
    for (let i = 0; i < count; i++) {
      const d = dataCw.slice(pos, pos + dataLen);
      pos += dataLen;
      blocks.push({ data: d, ec: rsRemainder(d, divisor) });
    }
  };
  pushBlocks(g1b, g1d);
  pushBlocks(g2b, g2d);

  const result: number[] = [];
  const maxData = Math.max(g1d, g2d);
  for (let col = 0; col < maxData; col++) {
    for (const blk of blocks) if (col < blk.data.length) result.push(blk.data[col]);
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (const blk of blocks) result.push(blk.ec[col]);
  }
  return result;
}

// --------------------------------------------------------------------------
// Format + version information (BCH)
// --------------------------------------------------------------------------

export function __formatBits(ecLevel: QrEcLevel, mask: number): number {
  const ecBits: Record<QrEcLevel, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  const data = (ecBits[ecLevel] << 3) | mask; // 5 data bits
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (((data << 10) | rem) ^ 0x5412) & 0x7fff;
}

function versionInfoBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem; // 18 bits
}

export function __formatCoords(size: number): {
  copy1: Array<[number, number]>;
  copy2: Array<[number, number]>;
} {
  const copy1: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i++) copy1.push([i, 8]);
  copy1.push([7, 8]); // i=6
  copy1.push([8, 8]); // i=7
  copy1.push([8, 7]); // i=8
  for (let i = 9; i < 15; i++) copy1.push([8, 14 - i]); // i=9..14

  const copy2: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) copy2.push([8, size - 1 - i]); // i=0..7
  for (let i = 8; i < 15; i++) copy2.push([size - 15 + i, 8]); // i=8..14
  return { copy1, copy2 };
}

// --------------------------------------------------------------------------
// Function patterns + reserved map
// --------------------------------------------------------------------------

function sizeForVersion(version: number): number {
  return 17 + 4 * version;
}

function newGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

interface FunctionLayout {
  matrix: boolean[][];
  reserved: boolean[][];
}

function buildFunction(version: number): FunctionLayout {
  const size = sizeForVersion(version);
  const matrix = newGrid(size);
  const reserved = newGrid(size);
  const set = (r: number, c: number, v: boolean): void => {
    matrix[r][c] = v;
    reserved[r][c] = true;
  };

  // Finder patterns + 1-module separators at the three corners.
  const drawFinder = (top: number, left: number): void => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const dark =
          r >= 0 &&
          r <= 6 &&
          c >= 0 &&
          c <= 6 &&
          (r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(rr, cc, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Alignment patterns (skip the ones overlapping finder patterns).
  const pos = ALIGN_POSITIONS[version - 1];
  for (const ar of pos) {
    for (const ac of pos) {
      if (
        (ar <= 7 && ac <= 7) ||
        (ar <= 7 && ac >= size - 8) ||
        (ar >= size - 8 && ac <= 7)
      ) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Dark module.
  set(size - 8, 8, true);

  // Reserve format-information areas (values written per-mask later).
  for (let i = 0; i <= 8; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Version information (versions 7+), independent of mask.
  if (version >= 7) {
    const vb = versionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vb >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, bit);
      set(a, b, bit);
    }
  }

  return { matrix, reserved };
}

export function __reservedMap(version: number): boolean[][] {
  return buildFunction(version).reserved;
}

export function __dataModuleOrder(version: number): Array<[number, number]> {
  const size = sizeForVersion(version);
  const { reserved } = buildFunction(version);
  const order: Array<[number, number]> = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let v = 0; v < size; v++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const row = upward ? size - 1 - v : v;
        if (!reserved[row][col]) order.push([row, col]);
      }
    }
    upward = !upward;
  }
  return order;
}

// --------------------------------------------------------------------------
// Masking + penalty scoring
// --------------------------------------------------------------------------

export function __maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return false;
  }
}

// Penalty scoring per ISO/IEC 18004. Rules 1 and 3 are evaluated together using
// the run-history method so that finder-like patterns adjacent to the symbol
// border (where the required 4-module light margin is the virtual quiet zone)
// are counted, matching reference encoders. Penalty constants: N1=3, N2=3,
// N3=40, N4=10.
function penalty(m: boolean[][]): number {
  const n = m.length;
  let result = 0;

  const countPatterns = (h: number[]): number => {
    const a = h[1];
    const core = a > 0 && h[2] === a && h[3] === a * 3 && h[4] === a && h[5] === a;
    return (
      (core && h[0] >= a * 4 && h[6] >= a ? 1 : 0) +
      (core && h[6] >= a * 4 && h[0] >= a ? 1 : 0)
    );
  };
  const addHistory = (runLen: number, h: number[]): void => {
    if (h[0] === 0) runLen += n; // add light border to the initial run
    h.copyWithin(1, 0, h.length - 1);
    h[0] = runLen;
  };
  const terminate = (color: boolean, runLen: number, h: number[]): number => {
    let len = runLen;
    if (color) {
      addHistory(len, h);
      len = 0;
    }
    len += n; // add light border to the final run
    addHistory(len, h);
    return countPatterns(h);
  };

  const scanLine = (get: (i: number) => boolean): void => {
    let runColor = false;
    let runLen = 0;
    const h = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      if (get(i) === runColor) {
        runLen++;
        if (runLen === 5) result += 3;
        else if (runLen > 5) result++;
      } else {
        addHistory(runLen, h);
        if (!runColor) result += countPatterns(h) * 40;
        runColor = get(i);
        runLen = 1;
      }
    }
    result += terminate(runColor, runLen, h) * 40;
  };
  for (let r = 0; r < n; r++) scanLine((c) => m[r][c]);
  for (let c = 0; c < n; c++) scanLine((r) => m[r][c]);

  // Rule 2: 2x2 blocks of a single color.
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) result += 3;
    }
  }

  // Rule 4: deviation of the dark-module proportion from 50%.
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) dark++;
  const total = n * n;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * 10;

  return result;
}

// --------------------------------------------------------------------------
// Public encoder
// --------------------------------------------------------------------------

export function encodeQrMatrix(data: string, opts?: { ecLevel?: QrEcLevel }): QrMatrix {
  const ecLevel = opts?.ecLevel ?? 'M';
  const level = LEVEL_INDEX[ecLevel];
  const bytes = utf8Encode(data);

  const version = selectVersion(bytes.length, level);
  if (version < 0) {
    throw new QrTooLargeError(
      `data of ${bytes.length} UTF-8 bytes exceeds version-40 ${ecLevel} capacity`,
    );
  }

  const dataCw = buildDataCodewords(bytes, version, level);
  const finalCw = buildFinalCodewords(dataCw, version, level);

  const stream: number[] = [];
  for (const cw of finalCw) for (let b = 7; b >= 0; b--) stream.push((cw >> b) & 1);

  const size = sizeForVersion(version);
  const { matrix: base, reserved } = buildFunction(version);
  const order = __dataModuleOrder(version);

  // Place data bits (remaining modules stay light).
  const template = base.map((row) => row.slice());
  for (let i = 0; i < order.length; i++) {
    const [r, c] = order[i];
    template[r][c] = i < stream.length && stream[i] === 1;
  }

  const { copy1, copy2 } = __formatCoords(size);
  let bestMatrix: boolean[][] | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const cand = template.map((row) => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!reserved[r][c] && __maskBit(mask, r, c)) cand[r][c] = !cand[r][c];
      }
    }
    const fmt = __formatBits(ecLevel, mask);
    for (let i = 0; i < 15; i++) {
      const bit = ((fmt >> i) & 1) === 1;
      const [r1, c1] = copy1[i];
      const [r2, c2] = copy2[i];
      cand[r1][c1] = bit;
      cand[r2][c2] = bit;
    }
    cand[size - 8][8] = true; // dark module

    const score = penalty(cand);
    if (score < bestScore) {
      bestScore = score;
      bestMatrix = cand;
    }
  }

  return { matrix: bestMatrix as boolean[][], version, size };
}

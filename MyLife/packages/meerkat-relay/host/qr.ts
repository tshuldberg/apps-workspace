/**
 * Connection-card QR encoder (Plan 20, Phase 6.2). Pure, dependency-free.
 *
 * The desktop host companion prints a scannable QR of its `buildHostConnectionCard()`
 * MKSERVER1: string so a member can point their phone at a laptop and adopt the
 * server. Honesty: the QR carries a TRANSPORT ADDRESS ONLY -- exactly the same
 * non-secret, non-authenticating connection card `@mylife/sync` already defines
 * (`parseConnectionCard`). Pairing, the 5-emoji SAS, and the signed-nonce
 * handshake still happen out of band, so a scanned card can cause a denial of
 * service (a useless relay) but can never read messages or impersonate. This file
 * owns NO cryptography; it only reshapes an already-built card string into a grid.
 *
 * The encoder is an inline pure-JS QR generator (byte mode, ISO/IEC 18004) so the
 * ws+zod-lean relay package gains zero new dependencies. It mirrors the standard
 * reference tables (nayuki QR-Code-generator) for versions 1-40 and every EC
 * level. A symmetric `decodeConnectionCardQr` reverses the data path (format ->
 * mask -> zigzag -> de-interleave -> byte segment) so the QR proves it round-trips
 * to the exact string it was handed -- the codec never claims a card it cannot
 * reproduce.
 */

import { parseConnectionCard } from '@mylife/sync';

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

interface EclInfo {
  /** Index into the standard EC tables. */
  ordinal: number;
  /** 2-bit field baked into the 15-bit format information. */
  formatBits: number;
}

const ECL: Record<EccLevel, EclInfo> = {
  L: { ordinal: 0, formatBits: 1 },
  M: { ordinal: 1, formatBits: 0 },
  Q: { ordinal: 2, formatBits: 3 },
  H: { ordinal: 3, formatBits: 2 },
};

// Standard ISO/IEC 18004 tables, indexed [ecl.ordinal][version] with a -1 pad at
// index 0 so `version` is a direct subscript (1..40).
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // Low
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // Medium
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  // Quartile
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  // High
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  // Low
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  // Medium
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  // Quartile
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  // High
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const BYTE_MODE = 0b0100;

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

/** Total data + EC 8-bit codewords a version holds (raw data modules / 8). */
function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(version: number, ecl: EclInfo): number {
  const raw = Math.floor(getNumRawDataModules(version) / 8);
  return raw - NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version] * ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
}

/** Byte-mode character-count indicator width for the version tier. */
const charCountBits = (version: number): number => (version <= 9 ? 8 : 16);

// --- Reed-Solomon over GF(256), primitive polynomial 0x11D ---

function reedSolomonMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function reedSolomonComputeDivisor(degree: number): number[] {
  const result: number[] = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    for (let i = 0; i < result.length; i++) result[i] ^= reedSolomonMultiply(divisor[i], factor);
  }
  return result;
}

// --- Matrix scaffolding shared by encode + decode ---

interface QrMatrix {
  size: number;
  version: number;
  modules: boolean[][];
  isFunction: boolean[][];
}

function newMatrix(version: number): QrMatrix {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, version, modules, isFunction };
}

function setFunctionModule(m: QrMatrix, x: number, y: number, dark: boolean): void {
  m.modules[y][x] = dark;
  m.isFunction[y][x] = true;
}

function getAlignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = version === 32 ? 26 : Math.ceil((size - 13) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFinderPattern(m: QrMatrix, x: number, y: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && xx < m.size && yy >= 0 && yy < m.size) {
        setFunctionModule(m, xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawAlignmentPattern(m: QrMatrix, x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunctionModule(m, x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(m: QrMatrix, ecl: EclInfo, mask: number): void {
  const data = (ecl.formatBits << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunctionModule(m, 8, i, getBit(bits, i));
  setFunctionModule(m, 8, 7, getBit(bits, 6));
  setFunctionModule(m, 8, 8, getBit(bits, 7));
  setFunctionModule(m, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunctionModule(m, 14 - i, 8, getBit(bits, i));

  for (let i = 0; i < 8; i++) setFunctionModule(m, m.size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunctionModule(m, 8, m.size - 15 + i, getBit(bits, i));
  setFunctionModule(m, 8, m.size - 8, true); // the always-dark module
}

function drawVersion(m: QrMatrix): void {
  if (m.version < 7) return;
  let rem = m.version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (m.version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const color = getBit(bits, i);
    const a = m.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunctionModule(m, a, b, color);
    setFunctionModule(m, b, a, color);
  }
}

function drawFunctionPatterns(m: QrMatrix, ecl: EclInfo): void {
  for (let i = 0; i < m.size; i++) {
    setFunctionModule(m, 6, i, i % 2 === 0);
    setFunctionModule(m, i, 6, i % 2 === 0);
  }
  drawFinderPattern(m, 3, 3);
  drawFinderPattern(m, m.size - 4, 3);
  drawFinderPattern(m, 3, m.size - 4);

  const align = getAlignmentPatternPositions(m.version);
  const n = align.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
        drawAlignmentPattern(m, align[i], align[j]);
      }
    }
  }

  drawFormatBits(m, ecl, 0); // reserve the format area (real bits drawn after masking)
  drawVersion(m);
}

/** The funny zigzag scan, yielding every non-function [x,y] in placement order. */
function* dataModuleOrder(m: QrMatrix): Generator<[number, number]> {
  for (let right = m.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < m.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? m.size - 1 - vert : vert;
        if (!m.isFunction[y][x]) yield [x, y];
      }
    }
  }
}

function drawCodewords(m: QrMatrix, data: number[]): void {
  let i = 0;
  const totalBits = data.length * 8;
  for (const [x, y] of dataModuleOrder(m)) {
    if (i < totalBits) {
      m.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
      i++;
    }
  }
}

function maskCondition(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new Error('mask out of range');
  }
}

function applyMask(m: QrMatrix, mask: number): void {
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.isFunction[y][x] && maskCondition(mask, x, y)) m.modules[y][x] = !m.modules[y][x];
    }
  }
}

// --- Penalty scoring (mask selection), ISO rules 1-4 ---

function finderPenaltyCountPatterns(runHistory: number[]): number {
  const n = runHistory[1];
  const core =
    n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
  return (
    (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
    (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
  );
}

function finderPenaltyAddHistory(size: number, runLength: number, runHistory: number[]): void {
  if (runHistory[0] === 0) runLength += size; // add light border to the initial run
  runHistory.pop();
  runHistory.unshift(runLength);
}

function finderPenaltyTerminateAndCount(
  size: number,
  currentRunColor: boolean,
  currentRunLength: number,
  runHistory: number[],
): number {
  if (currentRunColor) {
    finderPenaltyAddHistory(size, currentRunLength, runHistory);
    currentRunLength = 0;
  }
  currentRunLength += size; // add light border to the final run
  finderPenaltyAddHistory(size, currentRunLength, runHistory);
  return finderPenaltyCountPatterns(runHistory);
}

function getPenaltyScore(m: QrMatrix): number {
  let result = 0;
  const size = m.size;
  const mod = m.modules;

  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runX = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (mod[y][x] === runColor) {
        runX++;
        if (runX === 5) result += PENALTY_N1;
        else if (runX > 5) result++;
      } else {
        finderPenaltyAddHistory(size, runX, runHistory);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = mod[y][x];
        runX = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(size, runColor, runX, runHistory) * PENALTY_N3;
  }

  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runY = 0;
    const runHistory = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (mod[y][x] === runColor) {
        runY++;
        if (runY === 5) result += PENALTY_N1;
        else if (runY > 5) result++;
      } else {
        finderPenaltyAddHistory(size, runY, runHistory);
        if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
        runColor = mod[y][x];
        runY = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(size, runColor, runY, runHistory) * PENALTY_N3;
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = mod[y][x];
      if (color === mod[y][x + 1] && color === mod[y + 1][x] && color === mod[y + 1][x + 1]) {
        result += PENALTY_N2;
      }
    }
  }

  let dark = 0;
  for (const row of mod) for (const c of row) if (c) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * PENALTY_N4;
  return result;
}

// --- Block interleave (encode) + de-interleave (decode) ---

function addEccAndInterleave(data: number[], version: number, ecl: EclInfo): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = reedSolomonComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0); // pad so every block is the same width
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j][i]);
    }
  }
  return result;
}

function deinterleave(codewords: number[], version: number, ecl: EclInfo): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
  const rawCodewords = codewords.length;
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const blockLen = shortBlockLen + 1;

  const blocks: number[][] = Array.from({ length: numBlocks }, () => new Array<number>(blockLen).fill(0));
  let idx = 0;
  for (let i = 0; i < blockLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) blocks[j][i] = codewords[idx++];
    }
  }

  const dataCodewords: number[] = [];
  for (let j = 0; j < numBlocks; j++) {
    const datLen = shortBlockLen - blockEccLen + (j < numShortBlocks ? 0 : 1);
    for (let i = 0; i < datLen; i++) dataCodewords.push(blocks[j][i]);
  }
  return dataCodewords;
}

// --- Byte-mode segment: pack (encode) + read (decode) ---

function buildDataCodewords(bytes: Uint8Array, version: number, ecl: EclInfo): number[] {
  const bits: number[] = [];
  const appendBits = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  appendBits(BYTE_MODE, 4);
  appendBits(bytes.length, charCountBits(version));
  for (const b of bytes) appendBits(b, 8);

  const capacityBits = getNumDataCodewords(version, ecl) * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length)); // terminator
  appendBits(0, (8 - (bits.length % 8)) % 8); // pad to a byte boundary
  for (let padByte = 0xec; bits.length < capacityBits; padByte = padByte === 0xec ? 0x11 : 0xec) {
    appendBits(padByte, 8);
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

function readByteSegment(dataCodewords: number[], version: number): string | null {
  const bits: number[] = [];
  for (const b of dataCodewords) for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1);
  let pos = 0;
  const read = (n: number): number => {
    let value = 0;
    for (let i = 0; i < n; i++) value = (value << 1) | (bits[pos++] ?? 0);
    return value;
  };

  if (read(4) !== BYTE_MODE) return null; // this codec only emits/accepts byte mode
  const cci = charCountBits(version);
  const len = read(cci);
  if (pos + len * 8 > bits.length) return null;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = read(8);
  return new TextDecoder().decode(out);
}

// --- Public API ---

export interface QrOptions {
  /** Error-correction level. Default 'M' (~15% recovery), a good fit for URLs. */
  ecc?: EccLevel;
  /** Quiet-zone border in modules for the SVG. Default 4 (the spec minimum). */
  border?: number;
  /** SVG pixel size of a single module. Default 8. */
  scale?: number;
  /** Dark-module fill (default Meerkat ink). */
  dark?: string;
  /** Light background fill (default white for maximum scanner contrast). */
  light?: string;
}

export interface QrResult {
  /** The exact string encoded into the QR (an MKSERVER1 connection card). */
  text: string;
  /** QR version, 1..40. */
  version: number;
  /** Module count per side (`version * 4 + 17`). */
  size: number;
  /** Error-correction level used. */
  ecc: EccLevel;
  /** Row-major module grid (`modules[y][x]`); true = dark. No quiet zone. */
  modules: boolean[][];
  /** Standalone, scalable SVG with a quiet-zone border. */
  svg: string;
}

/**
 * Encode an MKSERVER1 connection-card string into a scannable QR. Throws if the
 * input is not a valid connection card (a QR is never built from a non-address),
 * mirroring `encodeConnectionCard`'s "never a bad address" guarantee, or if the
 * card is too large to fit any QR version.
 */
export function encodeConnectionCardQr(card: string, opts: QrOptions = {}): QrResult {
  if (parseConnectionCard(card) === null) {
    throw new Error('encodeConnectionCardQr: input is not a valid connection card');
  }
  const eccLevel: EccLevel = opts.ecc ?? 'M';
  const ecl = ECL[eccLevel];
  const bytes = new TextEncoder().encode(card);

  let version = -1;
  for (let v = 1; v <= 40; v++) {
    const need = 4 + charCountBits(v) + bytes.length * 8;
    if (need <= getNumDataCodewords(v, ecl) * 8) {
      version = v;
      break;
    }
  }
  if (version === -1) {
    throw new Error('encodeConnectionCardQr: connection card is too large to encode as a QR');
  }

  const dataCodewords = buildDataCodewords(bytes, version, ecl);
  const allCodewords = addEccAndInterleave(dataCodewords, version, ecl);

  const m = newMatrix(version);
  drawFunctionPatterns(m, ecl);
  drawCodewords(m, allCodewords);

  let bestMask = 0;
  let minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, mask);
    drawFormatBits(m, ecl, mask);
    const penalty = getPenaltyScore(m);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
    applyMask(m, mask); // undo (XOR is its own inverse)
  }
  applyMask(m, bestMask);
  drawFormatBits(m, ecl, bestMask);

  return {
    text: card,
    version,
    size: m.size,
    ecc: eccLevel,
    modules: m.modules,
    svg: qrModulesToSvg(m.modules, opts),
  };
}

function eclFromFormatBits(formatBits: number): EclInfo | null {
  for (const info of Object.values(ECL)) if (info.formatBits === formatBits) return info;
  return null;
}

/**
 * Reverse a module grid produced by `encodeConnectionCardQr` back to its exact
 * string (format -> mask -> zigzag -> de-interleave -> byte segment). Clean-input
 * only: it drops the EC codewords rather than running RS correction, which is all
 * the round-trip verification needs. Returns null on any malformed grid.
 */
export function decodeConnectionCardQr(modules: boolean[][]): string | null {
  try {
    const size = modules.length;
    if (size < 21 || (size - 17) % 4 !== 0) return null;
    const version = (size - 17) / 4;
    if (version < 1 || version > 40) return null;
    for (const row of modules) if (row.length !== size) return null;

    const rd = (x: number, y: number): number => (modules[y][x] ? 1 : 0);
    let format = 0;
    for (let i = 0; i <= 5; i++) format |= rd(8, i) << i;
    format |= rd(8, 7) << 6;
    format |= rd(8, 8) << 7;
    format |= rd(7, 8) << 8;
    for (let i = 9; i < 15; i++) format |= rd(14 - i, 8) << i;
    format ^= 0x5412;
    const dataField = (format >> 10) & 0x1f;
    const ecl = eclFromFormatBits((dataField >> 3) & 3);
    if (!ecl) return null;
    const mask = dataField & 7;

    const skeleton = newMatrix(version);
    drawFunctionPatterns(skeleton, ecl);

    const grid = modules.map((row) => row.slice());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!skeleton.isFunction[y][x] && maskCondition(mask, x, y)) grid[y][x] = !grid[y][x];
      }
    }

    const bitStream: number[] = [];
    for (const [x, y] of dataModuleOrder(skeleton)) bitStream.push(grid[y][x] ? 1 : 0);
    const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
    const codewords: number[] = [];
    for (let i = 0; i < rawCodewords; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | (bitStream[i * 8 + j] ?? 0);
      codewords.push(byte);
    }

    const dataCodewords = deinterleave(codewords, version, ecl);
    return readByteSegment(dataCodewords, version);
  } catch {
    return null;
  }
}

/** Render a module grid to a standalone SVG with a quiet-zone border. */
export function qrModulesToSvg(modules: boolean[][], opts: QrOptions = {}): string {
  const border = opts.border ?? 4;
  const scale = opts.scale ?? 8;
  const dark = opts.dark ?? '#20302B';
  const light = opts.light ?? '#FFFFFF';
  const size = modules.length;
  const dim = size + border * 2;

  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) path += `M${x + border},${y + border}h1v1h-1z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim * scale}" height="${dim * scale}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Meerkat server connection card QR code">` +
    `<rect width="${dim}" height="${dim}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}

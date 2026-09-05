/** Pure-JS MD5 for provider checksum comparison. Never use it for security decisions. */

const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
] as const;

const CONSTANTS = Array.from(
  { length: 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x1_0000_0000) >>> 0,
);

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function padded(input: Uint8Array): Uint8Array {
  const total = Math.ceil((input.byteLength + 9) / 64) * 64;
  const output = new Uint8Array(total);
  output.set(input);
  output[input.byteLength] = 0x80;
  const lowBits = (input.byteLength * 8) >>> 0;
  const highBits = Math.floor(input.byteLength / 0x2000_0000) >>> 0;
  for (let index = 0; index < 4; index += 1) {
    output[total - 8 + index] = (lowBits >>> (index * 8)) & 0xff;
    output[total - 4 + index] = (highBits >>> (index * 8)) & 0xff;
  }
  return output;
}

export function md5Bytes(input: Uint8Array): Uint8Array {
  const message = padded(input);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let offset = 0; offset < message.byteLength; offset += 64) {
    const words = new Uint32Array(16);
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = (
        (message[start] ?? 0)
        | ((message[start + 1] ?? 0) << 8)
        | ((message[start + 2] ?? 0) << 16)
        | ((message[start + 3] ?? 0) << 24)
      ) >>> 0;
    }
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let index = 0; index < 64; index += 1) {
      let f: number;
      let wordIndex: number;
      if (index < 16) {
        f = (b & c) | (~b & d);
        wordIndex = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        wordIndex = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        wordIndex = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        wordIndex = (7 * index) % 16;
      }
      const previousD = d;
      d = c;
      c = b;
      const sum = (a + f + CONSTANTS[index]! + words[wordIndex]!) >>> 0;
      b = (b + rotateLeft(sum, SHIFTS[index]!)) >>> 0;
      a = previousD;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const output = new Uint8Array(16);
  const state = [a0, b0, c0, d0];
  for (let word = 0; word < state.length; word += 1) {
    const value = state[word]!;
    for (let byte = 0; byte < 4; byte += 1) {
      output[word * 4 + byte] = (value >>> (byte * 8)) & 0xff;
    }
  }
  return output;
}

export function md5Hex(input: Uint8Array): string {
  let output = '';
  for (const byte of md5Bytes(input)) output += byte.toString(16).padStart(2, '0');
  return output;
}

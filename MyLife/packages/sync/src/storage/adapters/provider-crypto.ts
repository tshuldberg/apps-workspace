import { sha256Bytes, sha256Hex } from '../../encryption/sha256';
import { bytesToBase64, concatBytes } from './http';

const DROPBOX_BLOCK_BYTES = 4 * 1024 * 1024;
const QUICK_XOR_WIDTH_BITS = 160;
const QUICK_XOR_SHIFT = 11;

/** Dropbox's SHA-256 over the binary SHA-256 digests of each 4 MiB block. */
export function dropboxContentHash(input: Uint8Array): string {
  const blockHashes: Uint8Array[] = [];
  for (let offset = 0; offset < input.byteLength; offset += DROPBOX_BLOCK_BYTES) {
    blockHashes.push(sha256Bytes(input.subarray(offset, offset + DROPBOX_BLOCK_BYTES)));
  }
  return sha256Hex(concatBytes(...blockHashes));
}

/** Microsoft QuickXorHash, returned by Graph as a 20-byte Base64 value. */
export function quickXorHashBytes(input: Uint8Array): Uint8Array {
  const output = new Uint8Array(QUICK_XOR_WIDTH_BITS / 8);
  for (let index = 0; index < input.byteLength; index += 1) {
    const value = input[index] ?? 0;
    const shift = (index * QUICK_XOR_SHIFT) % QUICK_XOR_WIDTH_BITS;
    const byteOffset = Math.floor(shift / 8);
    const bitOffset = shift % 8;
    output[byteOffset] ^= (value << bitOffset) & 0xff;
    if (bitOffset > 0) {
      output[(byteOffset + 1) % output.byteLength] ^= value >>> (8 - bitOffset);
    }
  }
  let length = input.byteLength;
  for (let index = 0; index < 8; index += 1) {
    output[output.byteLength - 8 + index] ^= length & 0xff;
    length = Math.floor(length / 256);
  }
  return output;
}

export function quickXorHashBase64(input: Uint8Array): string {
  return bytesToBase64(quickXorHashBytes(input));
}

const SHA1_ROUNDS = 80;

/**
 * Pure TypeScript SHA-1 for provider digest comparison only (Box validates the
 * digest server-side). Never use it for a security decision; backup integrity
 * rides the client-side sha512 + secretbox authentication.
 */
export function sha1Bytes(input: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const bitLength = input.byteLength * 8;
  const bitLengthHigh = Math.floor(bitLength / 0x1_0000_0000);
  const bitLengthLow = bitLength >>> 0;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(SHA1_ROUNDS);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      let word = 0;
      for (let byte = 0; byte < 4; byte += 1) {
        const position = offset + index * 4 + byte;
        let value = 0;
        if (position < input.byteLength) value = input[position] ?? 0;
        else if (position === input.byteLength) value = 0x80;
        else if (position >= paddedLength - 8) {
          const lengthByte = position - (paddedLength - 8);
          value = lengthByte < 4
            ? (bitLengthHigh >>> ((3 - lengthByte) * 8)) & 0xff
            : (bitLengthLow >>> ((7 - lengthByte) * 8)) & 0xff;
        }
        word = (word << 8) | value;
      }
      words[index] = word >>> 0;
    }
    for (let index = 16; index < SHA1_ROUNDS; index += 1) {
      words[index] = rotateLeft(
        (words[index - 3] ?? 0) ^ (words[index - 8] ?? 0)
          ^ (words[index - 14] ?? 0) ^ (words[index - 16] ?? 0),
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < SHA1_ROUNDS; index += 1) {
      let f: number;
      let constant: number;
      if (index < 20) {
        f = (b & c) | (~b & d);
        constant = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        constant = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        constant = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        constant = 0xca62c1d6;
      }
      const next = (rotateLeft(a, 5) + f + e + constant + (words[index] ?? 0)) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const output = new Uint8Array(20);
  const outputView = new DataView(output.buffer);
  for (const [index, value] of [h0, h1, h2, h3, h4].entries()) outputView.setUint32(index * 4, value);
  return output;
}

export function sha1Hex(input: Uint8Array): string {
  let output = '';
  for (const byte of sha1Bytes(input)) output += byte.toString(16).padStart(2, '0');
  return output;
}

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

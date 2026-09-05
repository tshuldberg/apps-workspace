/**
 * Pure-JS SHA-256 (RN-safe).
 *
 * tweetnacl only ships SHA-512, but the torrent manifest and community catalog
 * are SHA-256 by spec. node:crypto's `createHash('sha256')` is unavailable on
 * Hermes, which is exactly why channel history + catalogs could not be fetched
 * from the React Native app (the report's gap: "fetchChannelHistory is
 * Node-oriented"). This implementation is byte-identical to node:crypto's
 * sha256 -- proven by a parity test over known vectors and random buffers -- so
 * a Node host and an RN client compute the SAME content hashes and every
 * existing manifest/catalog hash value (and test) is unchanged.
 */

// Round constants (first 32 bits of the fractional parts of the cube roots of
// the first 64 primes).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** SHA-256 of the input bytes, as 32 raw bytes. */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const len = data.length;
  // 0x80 byte + 8-byte length, padded to a multiple of 64.
  const padded = new Uint8Array(Math.ceil((len + 9) / 64) * 64);
  padded.set(data);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLen = len * 8;
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!;
    let e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i]!);
  return out;
}

const HEX = '0123456789abcdef';

/** SHA-256 of the input bytes, as a lowercase hex string. */
export function sha256Hex(data: Uint8Array): string {
  const bytes = sha256Bytes(data);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    out += HEX[byte >> 4]! + HEX[byte & 0x0f]!;
  }
  return out;
}

const SHA256_BLOCK_BYTES = 64;

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

/** HMAC-SHA256 (RFC 2104), implemented over the RN-safe SHA-256 primitive. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const keyMaterial = key.length > SHA256_BLOCK_BYTES ? sha256Bytes(key) : key;
  const keyBlock = new Uint8Array(SHA256_BLOCK_BYTES);
  keyBlock.set(keyMaterial);

  const innerPad = new Uint8Array(SHA256_BLOCK_BYTES);
  const outerPad = new Uint8Array(SHA256_BLOCK_BYTES);
  for (let index = 0; index < SHA256_BLOCK_BYTES; index += 1) {
    innerPad[index] = keyBlock[index]! ^ 0x36;
    outerPad[index] = keyBlock[index]! ^ 0x5c;
  }

  const innerHash = sha256Bytes(concatBytes(innerPad, message));
  const output = sha256Bytes(concatBytes(outerPad, innerHash));
  keyBlock.fill(0);
  innerPad.fill(0);
  outerPad.fill(0);
  innerHash.fill(0);
  if (keyMaterial !== key) keyMaterial.fill(0);
  return output;
}

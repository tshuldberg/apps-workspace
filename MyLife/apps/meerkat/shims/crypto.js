/**
 * React Native Metro shim for Node-style `require('crypto')` calls.
 *
 * Workspace packages (notably @mylife/sync) import Node's `crypto` for
 * `randomBytes`. React Native / Hermes has no Node `crypto` module, but
 * does expose Web Crypto's `globalThis.crypto.getRandomValues`. Metro's
 * `resolver.extraNodeModules.crypto` is pointed at this file so those
 * imports resolve to a thin, secure-random-only polyfill instead of
 * pulling in the full Node `crypto` API (which would fail at runtime).
 *
 * Only `randomBytes` is polyfilled. Higher-level primitives (hashing,
 * HMAC, ciphers) should come from platform libraries such as
 * `expo-crypto`, `tweetnacl`, or the host's Web Crypto `subtle` API.
 */
function randomBytes(size) {
  const crypto = globalThis.crypto;

  if (!crypto?.getRandomValues) {
    throw new Error('Secure random bytes are unavailable in this runtime.');
  }

  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

module.exports = {
  randomBytes,
};

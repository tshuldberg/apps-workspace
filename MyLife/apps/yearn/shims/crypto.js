// Metro aliases the Node `crypto` module to this shim for tweetnacl. tweetnacl's
// bootstrap uses globalThis.crypto.getRandomValues when present and otherwise
// falls back to require('crypto').randomBytes (this file). On Hermes the global
// may be absent, so we fall back to expo-crypto's native CSPRNG rather than
// throwing, which would break all E2EE at first use.
function randomBytes(size) {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.getRandomValues) {
    const bytes = new Uint8Array(size);
    globalCrypto.getRandomValues(bytes);
    return bytes;
  }

  try {
    // eslint-disable-next-line global-require
    const ExpoCrypto = require('expo-crypto');
    if (typeof ExpoCrypto.getRandomBytes === 'function') {
      return ExpoCrypto.getRandomBytes(size);
    }
  } catch {
    // fall through to the explicit error below
  }

  throw new Error('Secure random bytes are unavailable in this runtime.');
}

module.exports = {
  randomBytes,
};

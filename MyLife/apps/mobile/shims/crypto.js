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

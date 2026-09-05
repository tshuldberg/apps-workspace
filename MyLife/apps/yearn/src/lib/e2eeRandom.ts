import nacl from 'tweetnacl';
import * as ExpoCrypto from 'expo-crypto';

let installed = false;

/**
 * Guarantees a native CSPRNG for all tweetnacl operations, independent of
 * tweetnacl's load-time auto-detection. On Hermes globalThis.crypto may be
 * absent, in which case tweetnacl would otherwise throw on first keypair /
 * encrypt. Installing an explicit PRNG backed by expo-crypto's native RNG
 * makes E2EE deterministic to bootstrap on device.
 *
 * Call once, as early as possible, from the app entry.
 */
export function installYearnSecureRandom(): void {
  if (installed) return;
  installed = true;

  // expo-crypto.getRandomBytes is synchronous and native-backed, which is what
  // nacl.setPRNG requires.
  nacl.setPRNG((buffer, length) => {
    const bytes = ExpoCrypto.getRandomBytes(length);
    for (let i = 0; i < length; i += 1) {
      buffer[i] = bytes[i];
    }
  });
}

import nacl from 'tweetnacl';

export type SyncRandomBytes = (byteCount: number) => Uint8Array | ArrayLike<number>;

let configured = false;

function copyRandomBytes(target: Uint8Array, bytes: Uint8Array | ArrayLike<number>, count: number): void {
  if (bytes.length < count) {
    throw new Error(`Sync PRNG returned ${bytes.length} bytes for ${count} requested bytes`);
  }

  for (let index = 0; index < count; index += 1) {
    target[index] = bytes[index] ?? 0;
  }
}

export function configureSyncPrng(randomBytes: SyncRandomBytes): void {
  nacl.setPRNG((target, count) => {
    copyRandomBytes(target, randomBytes(count), count);
  });
  configured = true;
}

export function configureSyncPrngFromGlobalCrypto(): boolean {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    return false;
  }

  configureSyncPrng((byteCount) => cryptoApi.getRandomValues(new Uint8Array(byteCount)));
  return true;
}

export function hasConfiguredSyncPrng(): boolean {
  return configured;
}

/** Read bytes from the package PRNG after the host has configured its platform source. */
export function generateSyncRandomBytes(byteCount: number): Uint8Array {
  if (!Number.isSafeInteger(byteCount) || byteCount < 1) {
    throw new Error('Sync random byte count must be a positive safe integer');
  }
  return nacl.randomBytes(byteCount);
}

/** Generate an unbiased integer in [0, maxExclusive) from the package PRNG. */
export function generateSyncRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x1_0000_0000) {
    throw new Error('Sync random integer bound must be between 1 and 2^32');
  }
  const range = 0x1_0000_0000;
  const acceptedLimit = Math.floor(range / maxExclusive) * maxExclusive;

  let value = acceptedLimit;
  while (value >= acceptedLimit) {
    const bytes = generateSyncRandomBytes(4);
    value = (
      bytes[0]! * 0x1_000000
      + bytes[1]! * 0x1_0000
      + bytes[2]! * 0x100
      + bytes[3]!
    );
  }
  return value % maxExclusive;
}

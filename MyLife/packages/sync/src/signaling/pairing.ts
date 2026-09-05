/**
 * Pairing code generation and validation for P2P device sync.
 *
 * Device A generates a 6-digit numeric pairing code and advertises it.
 * Device B enters the code to initiate a WebRTC connection.
 */

/** A pairing code is a 6-digit numeric string. */
export type PairingCode = string;

/** How long a pairing code remains valid (in milliseconds). */
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface PairingSession {
  code: PairingCode;
  createdAt: Date;
  expiresAt: Date;
  deviceId: string;
}

/**
 * Generate a cryptographically random 6-digit pairing code.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 */
export function generatePairingCode(): PairingCode {
  let value: number;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    value = buf[0]! % 1_000_000;
  } else {
    value = Math.floor(Math.random() * 1_000_000);
  }
  return value.toString().padStart(6, '0');
}

/**
 * Validate that a string is a well-formed 6-digit pairing code.
 */
export function isValidPairingCode(code: string): code is PairingCode {
  return /^\d{6}$/.test(code);
}

/**
 * Create a new pairing session for the local device.
 */
export function createPairingSession(deviceId: string): PairingSession {
  const now = new Date();
  return {
    code: generatePairingCode(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MS),
    deviceId,
  };
}

/**
 * Check whether a pairing session has expired.
 */
export function isPairingSessionExpired(
  session: PairingSession,
  now: Date = new Date(),
): boolean {
  return now >= session.expiresAt;
}

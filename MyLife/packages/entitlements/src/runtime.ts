import type { UnsignedEntitlements } from './types';

export function isEntitlementExpired(
  input: Pick<UnsignedEntitlements, 'expiresAt'>,
  nowMs = Date.now(),
): boolean {
  if (!input.expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(input.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= nowMs;
}

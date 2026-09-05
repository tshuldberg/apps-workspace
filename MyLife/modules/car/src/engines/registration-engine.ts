export type RegExpirationStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

/**
 * Determine the expiration status of a vehicle registration.
 * - expired: expiration date is in the past
 * - expiring_soon: expiration date is within 30 days
 * - valid: expiration date is more than 30 days away
 * - unknown: no expiration date provided
 */
export function getRegExpirationStatus(expirationDate: string | null, currentDate: string): RegExpirationStatus {
  if (expirationDate === null) return 'unknown';

  const expMs = new Date(expirationDate + 'T00:00:00Z').getTime();
  const currentMs = new Date(currentDate + 'T00:00:00Z').getTime();
  const dayMs = 86400000;

  if (currentMs > expMs) return 'expired';
  if (expMs - currentMs <= 30 * dayMs) return 'expiring_soon';
  return 'valid';
}

/**
 * Determine the expiration status of a vehicle inspection.
 * Uses the same 30-day window logic as registration expiration.
 */
export function getInspectionExpirationStatus(expirationDate: string | null, currentDate: string): RegExpirationStatus {
  return getRegExpirationStatus(expirationDate, currentDate);
}

/**
 * Calculate the number of days until expiration.
 * Returns a negative number if the date has already passed.
 */
export function getDaysUntilExpiration(expirationDate: string, currentDate: string): number {
  const expMs = new Date(expirationDate + 'T00:00:00Z').getTime();
  const currentMs = new Date(currentDate + 'T00:00:00Z').getTime();
  const dayMs = 86400000;
  return Math.round((expMs - currentMs) / dayMs);
}

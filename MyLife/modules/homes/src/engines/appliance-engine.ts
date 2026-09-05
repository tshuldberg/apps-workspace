import type { Appliance } from '../types';

/**
 * Determine warranty status for an appliance.
 *
 * - "active": warranty expiry is more than 30 days in the future
 * - "expiring_soon": warranty expiry is within 30 days (inclusive of today)
 * - "expired": warranty expiry is in the past
 * - "unknown": no warranty expiry date set
 */
export function getWarrantyStatus(
  appliance: { warrantyExpiry: string | null },
  today?: string,
): 'active' | 'expiring_soon' | 'expired' | 'unknown' {
  if (!appliance.warrantyExpiry) return 'unknown';

  const now = today
    ? new Date(today + 'T00:00:00Z')
    : new Date();
  now.setUTCHours(0, 0, 0, 0);

  const expiry = new Date(appliance.warrantyExpiry + 'T00:00:00Z');
  expiry.setUTCHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring_soon';
  return 'active';
}

/**
 * Find appliances that need attention: expired or expiring warranty, or poor condition.
 */
export function getAppliancesNeedingAttention(
  appliances: Appliance[],
  today?: string,
): Appliance[] {
  return appliances.filter((a) => {
    const warrantyStatus = getWarrantyStatus(a, today);
    if (warrantyStatus === 'expired' || warrantyStatus === 'expiring_soon') {
      return true;
    }
    if (a.condition === 'poor') {
      return true;
    }
    return false;
  });
}

/**
 * Search appliances by name, brand, model number, or serial number.
 * Case-insensitive substring match.
 */
export function searchAppliances(
  appliances: Appliance[],
  query: string,
): Appliance[] {
  const q = query.toLowerCase();
  return appliances.filter((a) => {
    if (a.name.toLowerCase().includes(q)) return true;
    if (a.brand && a.brand.toLowerCase().includes(q)) return true;
    if (a.modelNumber && a.modelNumber.toLowerCase().includes(q)) return true;
    if (a.serialNumber && a.serialNumber.toLowerCase().includes(q)) return true;
    return false;
  });
}

/**
 * Group appliances by their category.
 */
export function getAppliancesByCategory(
  appliances: Appliance[],
): Map<string, Appliance[]> {
  const result = new Map<string, Appliance[]>();
  for (const appliance of appliances) {
    const existing = result.get(appliance.category);
    if (existing) {
      existing.push(appliance);
    } else {
      result.set(appliance.category, [appliance]);
    }
  }
  return result;
}

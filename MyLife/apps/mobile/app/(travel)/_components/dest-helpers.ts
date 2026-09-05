/**
 * Shared helpers for P2-B destinations + map screens.
 * Keep pure — no React, no RN imports.
 */

import type { DestinationRecord } from '@mylife/travel';

export type FilterKey = 'all' | 'visited' | 'wishlist' | string;
// `string` covers region keys from REGION_DEFINITIONS.

export const TRAVEL_ACCENT = '#0EA5E9';
export const WISHLIST_GOLD = '#FFB877';
export const BOTH_GREEN = '#30D158';

export function isVisited(d: DestinationRecord): boolean {
  return d.visit_count > 0;
}

export function pinColor(d: DestinationRecord): string {
  const visited = isVisited(d);
  if (visited && d.bucket_list) return BOTH_GREEN;
  if (visited) return TRAVEL_ACCENT;
  return WISHLIST_GOLD;
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '\u{1F5FA}\u{FE0F}'; // map emoji
  const cc = code.toUpperCase();
  const A = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  const c1 = String.fromCodePoint(A + (cc.charCodeAt(0) - a));
  const c2 = String.fromCodePoint(A + (cc.charCodeAt(1) - a));
  return c1 + c2;
}

export interface DestinationStats {
  countriesVisited: number;
  wishlistCount: number;
  totalDestinations: number;
}

export function computeStats(rows: DestinationRecord[]): DestinationStats {
  const visitedCountries = new Set<string>();
  let wishlist = 0;
  for (const r of rows) {
    if (r.visit_count > 0 && r.country_code) {
      visitedCountries.add(r.country_code.toUpperCase());
    }
    if (r.bucket_list) wishlist += 1;
  }
  return {
    countriesVisited: visitedCountries.size,
    wishlistCount: wishlist,
    totalDestinations: rows.length,
  };
}

export function applyFilter(
  rows: DestinationRecord[],
  filter: FilterKey,
  regionCodes?: readonly string[],
): DestinationRecord[] {
  if (filter === 'all') return rows;
  if (filter === 'visited') return rows.filter(isVisited);
  if (filter === 'wishlist') return rows.filter((d) => d.bucket_list);
  if (regionCodes && regionCodes.length > 0) {
    const set = new Set(regionCodes.map((c) => c.toUpperCase()));
    return rows.filter(
      (d) => d.country_code && set.has(d.country_code.toUpperCase()),
    );
  }
  return rows;
}

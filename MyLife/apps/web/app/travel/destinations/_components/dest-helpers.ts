/**
 * Shared helpers for the web destinations + map pages.
 * Pure — no React, no server imports.
 */

import type { DestinationRecord } from '@mylife/travel';

export const TRAVEL_ACCENT = '#0EA5E9';
export const WISHLIST_GOLD = '#FFB877';
export const BOTH_GREEN = '#30D158';

export type FilterKey = 'all' | 'visited' | 'wishlist' | string;

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
  if (!code || code.length !== 2) return '\u{1F5FA}\u{FE0F}';
  const cc = code.toUpperCase();
  const A = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  return (
    String.fromCodePoint(A + (cc.charCodeAt(0) - a)) +
    String.fromCodePoint(A + (cc.charCodeAt(1) - a))
  );
}

export function computeStats(rows: DestinationRecord[]) {
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

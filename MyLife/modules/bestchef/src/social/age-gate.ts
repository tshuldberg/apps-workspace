/**
 * Per-country minimum-age gate (plan 33 Phase 1.7, P0-08).
 *
 * BestChef hosts user-generated content, so onboarding must enforce the
 * digital-consent age of the user's market, not a flat 13. The table below
 * covers the GDPR Article 8 derogations for the launch storefronts plus the
 * well-documented EU set; everywhere else uses the 13+ floor (COPPA / App
 * Store 4.8 baseline). Each market wave re-verifies its row before launch
 * (waves gate on evidence, plan 33 Phase 6).
 */

export const DEFAULT_MINIMUM_AGE = 13;

export const REGION_MINIMUM_AGES: Readonly<Record<string, number>> = {
  // 16: GDPR default retained (no national derogation below 16).
  DE: 16,
  IE: 16,
  NL: 16,
  HU: 16,
  LT: 16,
  LU: 16,
  SK: 16,
  HR: 16,
  PL: 16,
  RO: 16,
  // 15.
  FR: 15,
  CZ: 15,
  GR: 15,
  // 14.
  IT: 14,
  ES: 14,
  AT: 14,
  BG: 14,
  CY: 14,
};

/**
 * Minimum age required in a given ISO 3166-1 alpha-2 region. Unknown, empty,
 * or missing regions fall back to the 13+ floor.
 */
export function minimumAgeForRegion(regionCode: string | null | undefined): number {
  if (!regionCode) return DEFAULT_MINIMUM_AGE;
  const normalized = regionCode.trim().toUpperCase();
  if (!normalized) return DEFAULT_MINIMUM_AGE;
  return REGION_MINIMUM_AGES[normalized] ?? DEFAULT_MINIMUM_AGE;
}

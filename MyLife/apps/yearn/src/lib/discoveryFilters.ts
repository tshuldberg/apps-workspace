// Pure parsing/validation for the Discover filters form (plan 47 Phase 4).
// Kept free of React Native imports so it is unit-testable in the node suite.

import type { YearnDiscoveryPrefs } from './yearnRepository';

export interface DiscoveryFilterFormInput {
  minAgeText: string;
  maxAgeText: string;
  maxDistanceText: string;
  intentionFilter: string | null;
}

/**
 * Parses the free-text filter form into validated prefs. Returns a string
 * error for the first violation so the UI never submits silently-coerced
 * values (blank max fields mean "no cap").
 */
export function parseDiscoveryFilterInput(
  input: DiscoveryFilterFormInput,
): YearnDiscoveryPrefs | string {
  const minAge = Number.parseInt(input.minAgeText.trim(), 10);
  if (!Number.isInteger(minAge) || minAge < 18 || minAge > 100) {
    return 'Minimum age must be between 18 and 100.';
  }

  let maxAge: number | null = null;
  if (input.maxAgeText.trim().length > 0) {
    maxAge = Number.parseInt(input.maxAgeText.trim(), 10);
    if (!Number.isInteger(maxAge) || maxAge < 18 || maxAge > 100) {
      return 'Maximum age must be between 18 and 100, or blank for no cap.';
    }
    if (maxAge < minAge) {
      return 'Maximum age cannot be below the minimum age.';
    }
  }

  let maxDistanceMiles: number | null = null;
  if (input.maxDistanceText.trim().length > 0) {
    maxDistanceMiles = Number.parseInt(input.maxDistanceText.trim(), 10);
    if (!Number.isInteger(maxDistanceMiles) || maxDistanceMiles < 1 || maxDistanceMiles > 500) {
      return 'Max distance must be between 1 and 500 miles, or blank for anywhere.';
    }
  }

  return {
    minAge,
    maxAge,
    maxDistanceMiles,
    intentionFilter: input.intentionFilter,
  };
}

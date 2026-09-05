import type { SpotProfile, ForecastInput, ConditionColor } from '../types';
import { computeSpotRating } from './rating';

export type GlanceVerdict = 'go' | 'maybe' | 'no';

export interface QuickGlanceResult {
  verdict: GlanceVerdict;
  stars: number;
  color: ConditionColor;
}

/**
 * Quick-glance scoring: wraps the full rating engine into a simple
 * Go / Maybe / No verdict for one-glance forecast cards.
 *
 * Thresholds (1-5 integer star scale from computeSpotRating):
 *   >= 4 = "go"    (green badge)
 *   3    = "maybe" (amber badge)
 *   < 3  = "no"    (gray badge)
 */
export function quickGlance(spot: SpotProfile, forecast: ForecastInput): QuickGlanceResult {
  const rating = computeSpotRating(spot, forecast);

  let verdict: GlanceVerdict;
  if (rating.stars >= 4) {
    verdict = 'go';
  } else if (rating.stars >= 3) {
    verdict = 'maybe';
  } else {
    verdict = 'no';
  }

  return {
    verdict,
    stars: rating.stars,
    color: rating.color,
  };
}

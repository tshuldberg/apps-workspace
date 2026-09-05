import type { ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export type TransitSignificance = 'major' | 'minor';
export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface TransitEvent {
  id: string;
  profileId: string;
  transitingBody: string;
  natalBody: string;
  aspectType: AspectType;
  significance: TransitSignificance;
  currentOrb: number;
  exactDate: string;
  isApplying: boolean;
  interpretationBrief: string;
}

// ── Constants ────────────────────────────────────────────────────────

const ASPECT_ANGLES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

const ASPECT_MAX_ORBS: Record<AspectType, number> = {
  conjunction: 8,
  sextile: 6,
  square: 7,
  trine: 8,
  opposition: 8,
};

const MAJOR_BODIES = ['saturn', 'uranus', 'neptune', 'pluto'];

const TRANSIT_DESCRIPTIONS: Record<AspectType, string> = {
  conjunction: 'intensifies and merges energy with',
  sextile: 'offers harmonious opportunities with',
  square: 'creates tension and growth challenges with',
  trine: 'flows naturally and supports',
  opposition: 'creates awareness and balance with',
};

// ── Helpers ──────────────────────────────────────────────────────────

const ZODIAC_DEGREES: Record<ZodiacSign, number> = {
  aries: 15, taurus: 45, gemini: 75, cancer: 105,
  leo: 135, virgo: 165, libra: 195, scorpio: 225,
  sagittarius: 255, capricorn: 285, aquarius: 315, pisces: 345,
};

function signToApproxDegree(sign: ZodiacSign): number {
  return ZODIAC_DEGREES[sign];
}

function computeOrb(transitDeg: number, natalDeg: number, targetAngle: number): number {
  let diff = Math.abs(transitDeg - natalDeg);
  if (diff > 180) diff = 360 - diff;
  return Math.abs(diff - targetAngle);
}

// ── Public API ───────────────────────────────────────────────────────

export function classifySignificance(body: string): TransitSignificance {
  return MAJOR_BODIES.includes(body.toLowerCase()) ? 'major' : 'minor';
}

export function detectTransitsForDate(
  profileId: string,
  transitingBodies: Array<{ body: string; sign: ZodiacSign }>,
  natalPlacements: Array<{ body: string; sign: ZodiacSign }>,
  date: string,
): TransitEvent[] {
  const events: TransitEvent[] = [];

  for (const transiting of transitingBodies) {
    const transitDeg = signToApproxDegree(transiting.sign);

    for (const natal of natalPlacements) {
      if (transiting.body.toLowerCase() === natal.body.toLowerCase()) continue;

      const natalDeg = signToApproxDegree(natal.sign);

      for (const [aspectType, targetAngle] of Object.entries(ASPECT_ANGLES) as Array<[AspectType, number]>) {
        const orb = computeOrb(transitDeg, natalDeg, targetAngle);
        const maxOrb = ASPECT_MAX_ORBS[aspectType];

        if (orb <= maxOrb) {
          const significance = classifySignificance(transiting.body);
          const desc = TRANSIT_DESCRIPTIONS[aspectType];
          events.push({
            id: `transit-${date}-${transiting.body}-${natal.body}-${aspectType}`,
            profileId,
            transitingBody: transiting.body,
            natalBody: natal.body,
            aspectType,
            significance,
            currentOrb: Math.round(orb * 10) / 10,
            exactDate: date,
            isApplying: orb > 0,
            interpretationBrief: `${capitalize(transiting.body)} ${desc} your natal ${capitalize(natal.body)}.`,
          });
        }
      }
    }
  }

  return events;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function filterBySignificance(events: TransitEvent[], significance: TransitSignificance): TransitEvent[] {
  return events.filter((e) => e.significance === significance);
}

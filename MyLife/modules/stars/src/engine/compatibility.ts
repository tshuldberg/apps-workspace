import { calculateCompatibility, getZodiacElement } from './astro';
import { ELEMENT_COMPATIBILITY_DESCRIPTIONS } from './interpretations';
import type { ZodiacSign, ZodiacElement } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface CompatibilityAnalysis {
  profileAId: string;
  profileBId: string;
  sign1: ZodiacSign;
  sign2: ZodiacSign;
  element1: ZodiacElement;
  element2: ZodiacElement;
  overallScore: number;
  elementDescription: string;
  analysisType: 'quick_match';
}

// ── Helpers ──────────────────────────────────────────────────────────

export function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// ── Public API ───────────────────────────────────────────────────────

export function computeQuickMatch(
  profileAId: string,
  profileBId: string,
  sign1: ZodiacSign,
  sign2: ZodiacSign,
): CompatibilityAnalysis {
  const [canonA, canonB] = canonicalPair(profileAId, profileBId);
  const element1 = getZodiacElement(sign1);
  const element2 = getZodiacElement(sign2);
  const overallScore = calculateCompatibility(sign1, sign2);

  const key = `${element1}+${element2}`;
  const elementDescription = ELEMENT_COMPATIBILITY_DESCRIPTIONS[key]
    ?? `${element1} and ${element2}: A unique combination with its own dynamic.`;

  return {
    profileAId: canonA,
    profileBId: canonB,
    sign1,
    sign2,
    element1,
    element2,
    overallScore,
    elementDescription,
    analysisType: 'quick_match',
  };
}

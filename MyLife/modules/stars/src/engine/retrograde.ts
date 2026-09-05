import { RETROGRADE_TIPS, RETROGRADE_INTERPRETATIONS } from './interpretations';
import type { Planet } from './interpretations';
import type { BirthProfile, ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface RetrogradeStatus {
  body: Planet;
  isRetrograde: boolean;
  retrogradeStart: string | null;
  retrogradeEnd: string | null;
  retrogradeSign: ZodiacSign | null;
  progress: number | null;
  survivalTips: string[];
  interpretation: string;
  daysUntilStart: number | null;
}

export type BannerColor = 'red' | 'amber' | 'yellow' | 'green';

export interface RetrogradeBanner {
  color: BannerColor;
  text: string;
}

export interface RetrogradePeriod {
  body: Planet;
  start: string;
  end: string;
  sign: ZodiacSign;
}

export interface RetrogradePersonalImpact {
  body: Planet;
  sign: ZodiacSign;
  level: 'high' | 'medium' | 'low';
  houseNumber: number | null;
  affectedPlacements: string[];
  aspectNotes: string[];
  summary: string;
}

type SignAspect = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition' | null;

// ── Pre-computed Retrograde Dates (2025-2027) ────────────────────────

const RETROGRADE_PERIODS: RetrogradePeriod[] = [
  // Mercury 2025
  { body: 'mercury', start: '2025-03-15', end: '2025-04-07', sign: 'aries' },
  { body: 'mercury', start: '2025-07-18', end: '2025-08-11', sign: 'leo' },
  { body: 'mercury', start: '2025-11-09', end: '2025-11-29', sign: 'sagittarius' },
  // Mercury 2026
  { body: 'mercury', start: '2026-02-25', end: '2026-03-18', sign: 'pisces' },
  { body: 'mercury', start: '2026-06-29', end: '2026-07-23', sign: 'cancer' },
  { body: 'mercury', start: '2026-10-24', end: '2026-11-13', sign: 'scorpio' },
  // Mercury 2027
  { body: 'mercury', start: '2027-02-09', end: '2027-03-03', sign: 'aquarius' },
  { body: 'mercury', start: '2027-06-10', end: '2027-07-04', sign: 'gemini' },
  { body: 'mercury', start: '2027-10-07', end: '2027-10-28', sign: 'libra' },
  // Venus 2025-2027
  { body: 'venus', start: '2025-03-02', end: '2025-04-13', sign: 'aries' },
  { body: 'venus', start: '2026-12-16', end: '2027-01-27', sign: 'capricorn' },
  // Mars 2025-2027
  { body: 'mars', start: '2024-12-06', end: '2025-02-24', sign: 'leo' },
  { body: 'mars', start: '2027-01-10', end: '2027-04-01', sign: 'leo' },
  // Jupiter 2025-2027
  { body: 'jupiter', start: '2025-11-11', end: '2026-03-11', sign: 'cancer' },
  { body: 'jupiter', start: '2026-12-07', end: '2027-04-07', sign: 'leo' },
  // Saturn 2025-2027
  { body: 'saturn', start: '2025-07-13', end: '2025-11-28', sign: 'aries' },
  { body: 'saturn', start: '2026-07-27', end: '2026-12-11', sign: 'taurus' },
  // Uranus, Neptune, Pluto (approx half year each)
  { body: 'uranus', start: '2025-09-06', end: '2026-02-04', sign: 'taurus' },
  { body: 'uranus', start: '2026-09-11', end: '2027-02-08', sign: 'gemini' },
  { body: 'neptune', start: '2025-07-04', end: '2025-12-10', sign: 'aries' },
  { body: 'neptune', start: '2026-07-09', end: '2026-12-14', sign: 'aries' },
  { body: 'pluto', start: '2025-05-04', end: '2025-10-13', sign: 'aquarius' },
  { body: 'pluto', start: '2026-05-08', end: '2026-10-17', sign: 'aquarius' },
];

const ZODIAC_ORDER: ZodiacSign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

// ── Helpers ──────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

function overlaps(rangeStart: string, rangeEnd: string, targetStart: string, targetEnd: string): boolean {
  return rangeStart <= targetEnd && rangeEnd >= targetStart;
}

function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function getWholeSignHouse(risingSign: ZodiacSign, targetSign: ZodiacSign): number {
  const risingIndex = ZODIAC_ORDER.indexOf(risingSign);
  const targetIndex = ZODIAC_ORDER.indexOf(targetSign);
  return ((targetIndex - risingIndex + 12) % 12) + 1;
}

function getSignAspect(referenceSign: ZodiacSign, targetSign: ZodiacSign): SignAspect {
  const referenceIndex = ZODIAC_ORDER.indexOf(referenceSign);
  const targetIndex = ZODIAC_ORDER.indexOf(targetSign);
  const distance = (targetIndex - referenceIndex + 12) % 12;

  switch (distance) {
    case 0:
      return 'conjunction';
    case 2:
    case 10:
      return 'sextile';
    case 3:
    case 9:
      return 'square';
    case 4:
    case 8:
      return 'trine';
    case 6:
      return 'opposition';
    default:
      return null;
  }
}

function ordinal(value: number): string {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;

  if (remainderTen === 1 && remainderHundred !== 11) return `${value}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${value}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${value}rd`;
  return `${value}th`;
}

function formatPlacementLabel(label: 'Sun' | 'Moon' | 'Rising'): string {
  return label === 'Rising' ? 'rising sign' : `${label.toLowerCase()} sign`;
}

function buildImpactSummary(
  body: Planet,
  sign: ZodiacSign,
  exactPlacements: string[],
  aspectNotes: string[],
  houseNumber: number | null,
): string {
  const parts: string[] = [];

  if (exactPlacements.length > 0) {
    parts.push(`moves through your ${exactPlacements.map((placement) => placement.toLowerCase()).join(' and ')} sign`);
  } else if (aspectNotes.length > 0) {
    parts.push(`forms ${aspectNotes[0].replace(/^a /, 'a ')}`);
  } else {
    parts.push(`spotlights ${capitalize(sign)} themes for review`);
  }

  if (houseNumber != null) {
    parts.push(`activates your ${ordinal(houseNumber)} house`);
  }

  return `${capitalize(body)} retrograde in ${capitalize(sign)} ${parts.join(' and ')}.`;
}

// ── Public API ───────────────────────────────────────────────────────

export function getRetrogradeTips(body: Planet): string[] {
  return RETROGRADE_TIPS[body] ?? [
    'Take things slowly.',
    'Double-check important decisions.',
    'Use this time for reflection.',
  ];
}

export function computeRetrogradeStatuses(today: string): RetrogradeStatus[] {
  const allBodies: Planet[] = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const statuses: RetrogradeStatus[] = [];

  for (const body of allBodies) {
    // Find current or next retrograde for this body
    const current = RETROGRADE_PERIODS.find(
      (p) => p.body === body && daysBetween(p.start, today) >= 0 && daysBetween(today, p.end) >= 0,
    );

    if (current) {
      const totalDays = daysBetween(current.start, current.end);
      const elapsed = daysBetween(current.start, today);
      const progress = totalDays > 0 ? Math.min(1, Math.max(0, elapsed / totalDays)) : 0;

      statuses.push({
        body,
        isRetrograde: true,
        retrogradeStart: current.start,
        retrogradeEnd: current.end,
        retrogradeSign: current.sign,
        progress,
        survivalTips: getRetrogradeTips(body),
        interpretation: RETROGRADE_INTERPRETATIONS[body],
        daysUntilStart: 0,
      });
    } else {
      // Find next upcoming retrograde within 90 days
      const upcoming = RETROGRADE_PERIODS.find(
        (p) => p.body === body && daysBetween(today, p.start) > 0 && daysBetween(today, p.start) <= 90,
      );

      statuses.push({
        body,
        isRetrograde: false,
        retrogradeStart: upcoming?.start ?? null,
        retrogradeEnd: upcoming?.end ?? null,
        retrogradeSign: upcoming?.sign ?? null,
        progress: null,
        survivalTips: getRetrogradeTips(body),
        interpretation: RETROGRADE_INTERPRETATIONS[body],
        daysUntilStart: upcoming ? daysBetween(today, upcoming.start) : null,
      });
    }
  }

  return statuses;
}

export function getRetrogradePeriodsInRange(startDate: string, endDate: string): RetrogradePeriod[] {
  return RETROGRADE_PERIODS.filter((period) => overlaps(startDate, endDate, period.start, period.end)).sort(
    (left, right) => left.start.localeCompare(right.start),
  );
}

export function getYearRetrogrades(year: number): RetrogradePeriod[] {
  return getRetrogradePeriodsInRange(`${year}-01-01`, `${year}-12-31`);
}

export function computeRetrogradeBanner(statuses: RetrogradeStatus[]): RetrogradeBanner {
  const activeCount = statuses.filter((s) => s.isRetrograde).length;

  // Red banner for 3+ simultaneous retrogrades
  if (activeCount >= 3) {
    return {
      color: 'red',
      text: `${activeCount} planets retrograde simultaneously`,
    };
  }

  const mercury = statuses.find((s) => s.body === 'mercury');

  if (mercury?.isRetrograde) {
    return {
      color: 'amber',
      text: `Mercury Retrograde in ${capitalize(mercury.retrogradeSign ?? 'unknown')} until ${mercury.retrogradeEnd}`,
    };
  }

  if (mercury && mercury.daysUntilStart !== null && mercury.daysUntilStart <= 7) {
    return {
      color: 'yellow',
      text: `Mercury goes retrograde in ${mercury.daysUntilStart} day${mercury.daysUntilStart === 1 ? '' : 's'}`,
    };
  }

  const innerRetrograde = statuses.find(
    (s) => (s.body === 'venus' || s.body === 'mars') && s.isRetrograde,
  );

  if (innerRetrograde) {
    return {
      color: 'amber',
      text: `${capitalize(innerRetrograde.body)} Retrograde in ${capitalize(innerRetrograde.retrogradeSign ?? 'unknown')} until ${innerRetrograde.retrogradeEnd}`,
    };
  }

  return {
    color: 'green',
    text: 'All Clear -- No Inner Planet Retrogrades Active',
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getActiveRetrogrades(statuses: RetrogradeStatus[]): RetrogradeStatus[] {
  return statuses.filter((s) => s.isRetrograde);
}

export function getUpcomingRetrogrades(statuses: RetrogradeStatus[]): RetrogradeStatus[] {
  return statuses.filter((s) => !s.isRetrograde && s.daysUntilStart !== null).sort(
    (a, b) => (a.daysUntilStart ?? 999) - (b.daysUntilStart ?? 999),
  );
}

export function getRetrogradePersonalImpact(
  statuses: RetrogradeStatus[],
  birthProfile: Pick<BirthProfile, 'sunSign' | 'moonSign' | 'risingSign'> | null | undefined,
): RetrogradePersonalImpact[] {
  if (!birthProfile) {
    return [];
  }

  const placements = [
    { label: 'Sun' as const, sign: birthProfile.sunSign },
    { label: 'Moon' as const, sign: birthProfile.moonSign },
    { label: 'Rising' as const, sign: birthProfile.risingSign },
  ].filter((placement): placement is { label: 'Sun' | 'Moon' | 'Rising'; sign: ZodiacSign } => placement.sign != null);

  return getActiveRetrogrades(statuses)
    .filter((status): status is RetrogradeStatus & { retrogradeSign: ZodiacSign } => status.retrogradeSign != null)
    .map((status) => {
      const affectedPlacements = placements
        .filter((placement) => placement.sign === status.retrogradeSign)
        .map((placement) => formatPlacementLabel(placement.label));

      const aspectNotes = placements
        .map((placement) => {
          const aspect = getSignAspect(placement.sign, status.retrogradeSign);
          if (!aspect || aspect === 'conjunction') {
            return null;
          }

          return `${aspect} your ${formatPlacementLabel(placement.label)}`;
        })
        .filter((note): note is string => note != null);

      const houseNumber = birthProfile.risingSign
        ? getWholeSignHouse(birthProfile.risingSign, status.retrogradeSign)
        : null;

      const level: RetrogradePersonalImpact['level'] =
        affectedPlacements.length > 0
          ? 'high'
          : aspectNotes.length > 0 || houseNumber != null
            ? 'medium'
            : 'low';

      return {
        body: status.body,
        sign: status.retrogradeSign,
        level,
        houseNumber,
        affectedPlacements,
        aspectNotes,
        summary: buildImpactSummary(
          status.body,
          status.retrogradeSign,
          affectedPlacements,
          aspectNotes,
          houseNumber,
        ),
      };
    })
    .sort((left, right) => {
      const priority = { high: 0, medium: 1, low: 2 } as const;
      return priority[left.level] - priority[right.level];
    });
}

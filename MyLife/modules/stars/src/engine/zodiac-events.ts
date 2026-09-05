import { getMoonPhase, getMoonSign, getZodiacSign } from './astro';
import {
  MOON_PHASE_INTERPRETATIONS,
  MOON_SIGN_INTERPRETATIONS,
  RETROGRADE_INTERPRETATIONS,
  ZODIAC_SEASON_DESCRIPTIONS,
} from './interpretations';
import { getRetrogradePeriodsInRange } from './retrograde';
import type { BirthProfile, ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export type EventType =
  | 'sun_ingress'
  | 'planet_ingress'
  | 'new_moon'
  | 'full_moon'
  | 'eclipse'
  | 'retrograde_station'
  | 'direct_station';
export type EventCategory = 'season' | 'major' | 'minor';

export interface ZodiacEvent {
  id: string;
  eventType: EventType;
  category: EventCategory;
  eventDate: string;
  body: string;
  fromSign: ZodiacSign | null;
  toSign: ZodiacSign | null;
  title: string;
  descriptionBrief: string;
  descriptionFull: string | null;
}

export interface ZodiacEventPersonalImpact {
  level: 'high' | 'medium' | 'low' | 'none';
  badge: string;
  summary: string;
  houseNumber: number | null;
  affectedPlacements: string[];
  aspect: string | null;
}

type SignAspect = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition' | null;

interface EclipseReference {
  date: string;
  kind: 'solar' | 'lunar';
  subtype: 'total' | 'partial' | 'annular' | 'penumbral';
}

// ── Constants ────────────────────────────────────────────────────────

const ZODIAC_ORDER: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const ECLIPSE_EVENTS: EclipseReference[] = [
  { date: '2025-03-14', kind: 'lunar', subtype: 'total' },
  { date: '2025-03-29', kind: 'solar', subtype: 'partial' },
  { date: '2025-09-07', kind: 'lunar', subtype: 'total' },
  { date: '2025-09-21', kind: 'solar', subtype: 'partial' },
  { date: '2026-02-17', kind: 'solar', subtype: 'annular' },
  { date: '2026-03-03', kind: 'lunar', subtype: 'total' },
  { date: '2026-08-12', kind: 'solar', subtype: 'total' },
  { date: '2026-08-28', kind: 'lunar', subtype: 'partial' },
  { date: '2027-02-06', kind: 'solar', subtype: 'annular' },
  { date: '2027-02-20', kind: 'lunar', subtype: 'penumbral' },
  { date: '2027-07-18', kind: 'lunar', subtype: 'penumbral' },
  { date: '2027-08-02', kind: 'solar', subtype: 'total' },
  { date: '2027-08-17', kind: 'lunar', subtype: 'penumbral' },
] as const;

function prevSign(sign: ZodiacSign): ZodiacSign {
  const idx = ZODIAC_ORDER.indexOf(sign);
  return ZODIAC_ORDER[(idx - 1 + 12) % 12];
}

// ── Helpers ──────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPlacement(label: 'Sun' | 'Moon' | 'Rising'): string {
  return label === 'Rising' ? 'rising sign' : `${label.toLowerCase()} sign`;
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

function getWholeSignHouse(risingSign: ZodiacSign, targetSign: ZodiacSign): number {
  const risingIndex = ZODIAC_ORDER.indexOf(risingSign);
  const targetIndex = ZODIAC_ORDER.indexOf(targetSign);
  return ((targetIndex - risingIndex + 12) % 12) + 1;
}

function isWithin(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function buildMoonEvent(
  date: string,
  moonPhase: 'new_moon' | 'full_moon',
): ZodiacEvent {
  const moonSign = getMoonSign(date);
  const phaseLabel = moonPhase === 'new_moon' ? 'New Moon' : 'Full Moon';
  const lead =
    moonPhase === 'new_moon'
      ? 'Set intentions and clear space for what wants to begin.'
      : 'Illuminate what is ripening and release what has reached completion.';

  return {
    id: `${moonPhase}-${date}`,
    eventType: moonPhase,
    category: moonPhase === 'full_moon' ? 'major' : 'minor',
    eventDate: date,
    body: 'moon',
    fromSign: null,
    toSign: moonSign,
    title: `${phaseLabel} in ${capitalize(moonSign)}`,
    descriptionBrief: `${lead} ${capitalize(moonSign)} flavors the mood with a distinct emotional tone.`,
    descriptionFull: `${MOON_PHASE_INTERPRETATIONS[moonPhase]} ${MOON_SIGN_INTERPRETATIONS[moonSign]}`,
  };
}

function computeLunarEvents(startDate: string, endDate: string): ZodiacEvent[] {
  const eclipsesByDate = new Set(ECLIPSE_EVENTS.map((event) => event.date));
  const events: ZodiacEvent[] = [];
  let previousPhase = getMoonPhase(addDays(startDate, -1));

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    const currentPhase = getMoonPhase(cursor);

    if (
      currentPhase !== previousPhase &&
      (currentPhase === 'new_moon' || currentPhase === 'full_moon') &&
      !eclipsesByDate.has(cursor)
    ) {
      events.push(buildMoonEvent(cursor, currentPhase));
    }

    previousPhase = currentPhase;
  }

  return events;
}

function computeEclipseEvents(startDate: string, endDate: string): ZodiacEvent[] {
  return ECLIPSE_EVENTS.filter((event) => isWithin(event.date, startDate, endDate)).map((event) => {
    const sign = getMoonSign(event.date);
    const phaseLabel = event.kind === 'solar' ? 'Solar Eclipse' : 'Lunar Eclipse';
    const phase = event.kind === 'solar' ? 'new_moon' : 'full_moon';
    const subtypeLabel = capitalize(event.subtype);

    return {
      id: `eclipse-${event.kind}-${event.date}`,
      eventType: 'eclipse',
      category: 'major',
      eventDate: event.date,
      body: 'moon',
      fromSign: null,
      toSign: sign,
      title: `${phaseLabel} in ${capitalize(sign)}`,
      descriptionBrief: `${subtypeLabel} ${phaseLabel.toLowerCase()} amplifies ${capitalize(sign)} themes and can accelerate endings or beginnings.`,
      descriptionFull: `${phaseLabel} events act like cosmic accelerants. ${MOON_PHASE_INTERPRETATIONS[phase]} ${MOON_SIGN_INTERPRETATIONS[sign]}`,
    };
  });
}

function computeRetrogradeStationEvents(startDate: string, endDate: string): ZodiacEvent[] {
  const events: ZodiacEvent[] = [];
  const periods = getRetrogradePeriodsInRange(startDate, endDate);

  for (const period of periods) {
    if (isWithin(period.start, startDate, endDate)) {
      events.push({
        id: `retrograde-station-${period.body}-${period.start}`,
        eventType: 'retrograde_station',
        category: 'major',
        eventDate: period.start,
        body: period.body,
        fromSign: null,
        toSign: period.sign,
        title: `${capitalize(period.body)} stations retrograde`,
        descriptionBrief: `${capitalize(period.body)} begins a reflective cycle in ${capitalize(period.sign)}. Slow down and revisit what is unfinished.`,
        descriptionFull: RETROGRADE_INTERPRETATIONS[period.body],
      });
    }

    if (isWithin(period.end, startDate, endDate)) {
      events.push({
        id: `direct-station-${period.body}-${period.end}`,
        eventType: 'direct_station',
        category: 'minor',
        eventDate: period.end,
        body: period.body,
        fromSign: period.sign,
        toSign: period.sign,
        title: `${capitalize(period.body)} goes direct`,
        descriptionBrief: `${capitalize(period.body)} regains forward momentum in ${capitalize(period.sign)}. Integrate the lessons and move ahead with more clarity.`,
        descriptionFull: `The review cycle for ${capitalize(period.body)} is ending. ${RETROGRADE_INTERPRETATIONS[period.body]}`,
      });
    }
  }

  return events;
}

// ── Public API ───────────────────────────────────────────────────────

export function computeSunIngresses(startDate: string, days: number): ZodiacEvent[] {
  const events: ZodiacEvent[] = [];
  let prevSignVal = getZodiacSign(startDate);

  for (let i = 1; i <= days; i++) {
    const date = addDays(startDate, i);
    const currentSign = getZodiacSign(date);

    if (currentSign !== prevSignVal) {
      const desc = ZODIAC_SEASON_DESCRIPTIONS[currentSign];
      events.push({
        id: `sun-ingress-${date}`,
        eventType: 'sun_ingress',
        category: 'season',
        eventDate: date,
        body: 'sun',
        fromSign: prevSign(currentSign),
        toSign: currentSign,
        title: desc.title,
        descriptionBrief: desc.brief,
        descriptionFull: desc.full,
      });
    }
    prevSignVal = currentSign;
  }

  return events;
}

export function getEventsForRange(startDate: string, endDate: string): ZodiacEvent[] {
  const totalDays = Math.max(daysBetween(startDate, endDate), 0);
  const combined = [
    ...computeSunIngresses(startDate, totalDays),
    ...computeLunarEvents(startDate, endDate),
    ...computeEclipseEvents(startDate, endDate),
    ...computeRetrogradeStationEvents(startDate, endDate),
  ];

  const priority: Record<EventType, number> = {
    eclipse: 0,
    retrograde_station: 1,
    sun_ingress: 2,
    full_moon: 3,
    new_moon: 4,
    direct_station: 5,
    planet_ingress: 6,
  };

  return combined.sort((left, right) => {
    if (left.eventDate !== right.eventDate) {
      return left.eventDate.localeCompare(right.eventDate);
    }

    return priority[left.eventType] - priority[right.eventType];
  });
}

export function computeZodiacEvents(startDate: string, pastDays: number = 7, futureDays: number = 90): ZodiacEvent[] {
  const rangeStart = addDays(startDate, -pastDays);
  const rangeEnd = addDays(startDate, futureDays);
  return getEventsForRange(rangeStart, rangeEnd);
}

export function filterEventsByCategory(events: ZodiacEvent[], category: EventCategory): ZodiacEvent[] {
  return events.filter((e) => e.category === category);
}

export function isEventPast(event: ZodiacEvent, today: string): boolean {
  return daysBetween(event.eventDate, today) > 0;
}

export function getEventPersonalImpact(
  event: ZodiacEvent,
  birthProfile: Pick<BirthProfile, 'sunSign' | 'moonSign' | 'risingSign'> | null | undefined,
): ZodiacEventPersonalImpact {
  const eventSign = event.toSign ?? event.fromSign;

  if (!birthProfile || !eventSign) {
    return {
      level: 'none',
      badge: 'General',
      summary: 'This event applies broadly rather than targeting a known natal placement.',
      houseNumber: null,
      affectedPlacements: [],
      aspect: null,
    };
  }

  const placements = [
    { label: 'Sun' as const, sign: birthProfile.sunSign },
    { label: 'Moon' as const, sign: birthProfile.moonSign },
    { label: 'Rising' as const, sign: birthProfile.risingSign },
  ].filter((placement): placement is { label: 'Sun' | 'Moon' | 'Rising'; sign: ZodiacSign } => placement.sign != null);

  const affectedPlacements = placements
    .filter((placement) => placement.sign === eventSign)
    .map((placement) => formatPlacement(placement.label));

  const aspectPlacement = placements.find((placement) => {
    const aspect = getSignAspect(placement.sign, eventSign);
    return aspect != null && aspect !== 'conjunction';
  });

  const aspect = aspectPlacement
    ? `${getSignAspect(aspectPlacement.sign, eventSign)} your ${formatPlacement(aspectPlacement.label)}`
    : null;

  const houseNumber = birthProfile.risingSign
    ? getWholeSignHouse(birthProfile.risingSign, eventSign)
    : null;

  const level: ZodiacEventPersonalImpact['level'] =
    affectedPlacements.length > 0
      ? 'high'
      : aspect != null || houseNumber != null
        ? 'medium'
        : 'low';

  const badge = affectedPlacements.length > 0
    ? affectedPlacements[0]
    : houseNumber != null
      ? `House ${houseNumber}`
      : 'Ambient';

  const summaryParts: string[] = [];
  if (affectedPlacements.length > 0) {
    summaryParts.push(`lands directly on your ${affectedPlacements.join(' and ')}`);
  } else if (aspect != null) {
    summaryParts.push(`forms ${aspect}`);
  } else {
    summaryParts.push(`echoes through ${capitalize(eventSign)} themes`);
  }

  if (houseNumber != null) {
    summaryParts.push(`activates your ${houseNumber} house`);
  }

  return {
    level,
    badge,
    summary: `${event.title} ${summaryParts.join(' and ')}.`,
    houseNumber,
    affectedPlacements,
    aspect,
  };
}

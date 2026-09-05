import {
  calculateCompatibility,
  computeQuickMatch,
  drawRandomCards,
  getDeterministicTarotOrientation,
  getMoonSign,
  getSkyPositions,
  getTarotCardById,
  getTarotCardByName,
  getTarotCardOfDay,
  getTarotSpreadDefinition,
  getZodiacElement,
  getZodiacSign,
  type Aspect,
  type BirthProfile,
  type DailyReading,
  type JournalEntryRow,
  type ProgressedChartResult,
  type SolarReturnResult,
  type TarotCard,
  type TarotReading,
  type TarotReadingCard,
  type TarotSpreadDefinition,
  type TarotSpreadType,
  type TransitEvent,
  type ZodiacElement,
  type ZodiacSign,
} from '@mylife/stars';
import { capitalize, formatLongDate, formatMonthLabel, formatShortDate, STARS_ZODIAC_LABELS } from './ui';

type Modality = 'cardinal' | 'fixed' | 'mutable';

export interface WebAstroPlanetPlacement {
  id?: string;
  body: string;
  label: string;
  sign: ZodiacSign;
  degree: number;
  degreeLabel: string;
  house?: number;
  retrograde?: boolean;
  tone?: string;
  orbit?: number;
  interpretation: string;
}

export interface WebAstroHousePlacement {
  house: number;
  sign: ZodiacSign;
  degree: number;
  rulingPlanet: string;
  interpretation: string;
}

export interface WebAstroAspectLine {
  fromBody: string;
  toBody: string;
  type: Aspect;
  orb: number;
  label: string;
  interpretation: string;
}

export interface WebAstroChart {
  planets: WebAstroPlanetPlacement[];
  houses: WebAstroHousePlacement[];
  aspects: WebAstroAspectLine[];
}

export interface BirthChartViewModel {
  chart: WebAstroChart;
  profile: BirthProfile;
  core: {
    sun: ZodiacSign;
    moon: ZodiacSign;
    rising: ZodiacSign;
  };
  planets: WebAstroPlanetPlacement[];
  houses: WebAstroHousePlacement[];
  aspects: WebAstroAspectLine[];
  elementBalance: Record<ZodiacElement, number>;
  modalityBalance: Record<Modality, number>;
  dominantPlanets: Array<{ body: string; reason: string }>;
  dominantBlend: string;
}

export interface SynastryViewModel {
  analysis: ReturnType<typeof computeQuickMatch>;
  chart: WebAstroChart;
  categories: Array<{ label: string; score: number; tone: string }>;
  highlights: WebAstroAspectLine[];
  overallTheme: string;
  strengths: string;
  challenges: string;
}

export interface TarotDraftReading {
  spread: TarotSpreadDefinition;
  title: string;
  question: string;
  cards: TarotReadingCard[];
  narrative: string;
}

export interface TimelineMonthGroup<T> {
  label: string;
  items: T[];
}

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
];

const PLANET_LABELS: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

const PLANET_PURPOSES: Record<string, string> = {
  sun: 'identity and vitality',
  moon: 'emotion and instinct',
  mercury: 'speech and cognition',
  venus: 'attraction and aesthetics',
  mars: 'drive and boundary',
  jupiter: 'growth and belief',
  saturn: 'structure and responsibility',
  uranus: 'change and liberation',
  neptune: 'dreams and intuition',
  pluto: 'depth and transformation',
};

const SIGN_DESCRIPTIONS: Record<ZodiacSign, string> = {
  aries: 'bold, fast, and instinctive',
  taurus: 'grounded, sensual, and enduring',
  gemini: 'curious, connective, and nimble',
  cancer: 'protective, intuitive, and feeling-led',
  leo: 'radiant, creative, and heart-forward',
  virgo: 'precise, devoted, and service-minded',
  libra: 'relational, aesthetic, and balancing',
  scorpio: 'intense, private, and transformative',
  sagittarius: 'expansive, truth-seeking, and adventurous',
  capricorn: 'strategic, durable, and disciplined',
  aquarius: 'inventive, systemic, and future-facing',
  pisces: 'imaginative, porous, and mystical',
};

const SIGN_RULERS: Record<ZodiacSign, string> = {
  aries: 'Mars',
  taurus: 'Venus',
  gemini: 'Mercury',
  cancer: 'Moon',
  leo: 'Sun',
  virgo: 'Mercury',
  libra: 'Venus',
  scorpio: 'Pluto',
  sagittarius: 'Jupiter',
  capricorn: 'Saturn',
  aquarius: 'Uranus',
  pisces: 'Neptune',
};

const MODALITY_BY_SIGN: Record<ZodiacSign, Modality> = {
  aries: 'cardinal',
  taurus: 'fixed',
  gemini: 'mutable',
  cancer: 'cardinal',
  leo: 'fixed',
  virgo: 'mutable',
  libra: 'cardinal',
  scorpio: 'fixed',
  sagittarius: 'mutable',
  capricorn: 'cardinal',
  aquarius: 'fixed',
  pisces: 'mutable',
};

const HOUSE_TOPICS = [
  'identity, body, and first impression',
  'resources, safety, and self-worth',
  'voice, siblings, and daily signals',
  'roots, home, and emotional foundation',
  'play, romance, and creative courage',
  'work, rituals, and repair',
  'partnership, mirrors, and contracts',
  'trust, depth, and shared resources',
  'belief, travel, and the larger story',
  'career, legacy, and public role',
  'community, future visions, and networks',
  'rest, closure, and the inner world',
] as const;

const ASPECT_TARGETS: Array<{ type: Aspect; angle: number }> = [
  { type: 'conjunction', angle: 0 },
  { type: 'sextile', angle: 60 },
  { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 },
  { type: 'opposition', angle: 180 },
];

function hashValue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function signIndex(sign: ZodiacSign): number {
  return ZODIAC_ORDER.indexOf(sign);
}

function moveSign(sign: ZodiacSign, offset: number): ZodiacSign {
  const nextIndex = (signIndex(sign) + offset + ZODIAC_ORDER.length * 4) % ZODIAC_ORDER.length;
  return ZODIAC_ORDER[nextIndex];
}

function seededDegree(seed: number, salt: number): number {
  return (seed * (salt * 7 + 3) + salt * 19) % 30;
}

function totalDegrees(sign: ZodiacSign, degree: number): number {
  return signIndex(sign) * 30 + degree;
}

function angularDifference(left: number, right: number): number {
  const raw = Math.abs(left - right) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function resolveAspect(diff: number): { type: Aspect; orb: number } {
  return ASPECT_TARGETS.reduce(
    (closest, target) => {
      const orb = Math.abs(diff - target.angle);
      return orb < closest.orb ? { type: target.type, orb } : closest;
    },
    { type: 'conjunction' as Aspect, orb: Number.POSITIVE_INFINITY },
  );
}

function scoreDescriptor(score: number): string {
  if (score >= 85) return 'Highly soul-bonded';
  if (score >= 70) return 'Strong celestial harmony';
  if (score >= 55) return 'Dynamic growth match';
  return 'Challenging but catalytic';
}

function getCoreSigns(profile: BirthProfile): {
  sun: ZodiacSign;
  moon: ZodiacSign;
  rising: ZodiacSign;
} {
  const sun = profile.sunSign ?? getZodiacSign(profile.birthDate);
  const moon = profile.moonSign ?? getMoonSign(profile.birthDate);
  const risingOffset = (hashValue(`${profile.name}-${profile.birthTime ?? 'unknown'}`) % 5) + 1;
  const rising = profile.risingSign ?? moveSign(sun, risingOffset);
  return { sun, moon, rising };
}

function describePlanet(body: string, sign: ZodiacSign, house: number): string {
  return `${PLANET_LABELS[body]} in ${STARS_ZODIAC_LABELS[sign]} channels ${PLANET_PURPOSES[body]} through house ${house}, emphasizing ${HOUSE_TOPICS[house - 1]}.`;
}

function describeHouse(house: number, sign: ZodiacSign): string {
  return `House ${house} begins in ${STARS_ZODIAC_LABELS[sign]}, so ${HOUSE_TOPICS[house - 1]} feel ${SIGN_DESCRIPTIONS[sign]}.`;
}

function describeAspect(fromBody: string, toBody: string, type: Aspect, orb: number): string {
  const base = `${PLANET_LABELS[fromBody]} ${type} ${PLANET_LABELS[toBody]}`;
  if (type === 'trine') {
    return `${base} flows easily with an orb of ${orb.toFixed(1)}°. Trust the natural chemistry here.`;
  }
  if (type === 'sextile') {
    return `${base} opens a supportive lane with an orb of ${orb.toFixed(1)}°. Small actions pay off quickly.`;
  }
  if (type === 'square') {
    return `${base} creates productive tension with an orb of ${orb.toFixed(1)}°. Friction becomes growth.`;
  }
  if (type === 'opposition') {
    return `${base} pulls two poles into awareness with an orb of ${orb.toFixed(1)}°. Balance matters more than control.`;
  }
  return `${base} is tightly fused with an orb of ${orb.toFixed(1)}°. This energy is impossible to ignore.`;
}

function buildPlanetSuite(input: {
  sun: ZodiacSign;
  moon: ZodiacSign;
  rising: ZodiacSign;
  seed: number;
  idPrefix?: string;
  tone?: string;
  orbit?: number;
}): {
  chart: WebAstroChart;
  planets: WebAstroPlanetPlacement[];
  houses: WebAstroHousePlacement[];
  aspects: WebAstroAspectLine[];
} {
  const spec = [
    { body: 'sun', sign: input.sun, offset: 0 },
    { body: 'moon', sign: input.moon, offset: 0 },
    { body: 'mercury', sign: moveSign(input.sun, (input.seed % 3) - 1), offset: 1 },
    { body: 'venus', sign: moveSign(input.sun, input.seed % 2 === 0 ? 1 : -1), offset: 2 },
    { body: 'mars', sign: moveSign(input.moon, 2 + (input.seed % 2)), offset: 3 },
    { body: 'jupiter', sign: moveSign(input.sun, 4), offset: 4 },
    { body: 'saturn', sign: moveSign(input.rising, 5), offset: 5 },
    { body: 'uranus', sign: moveSign(input.sun, 7), offset: 6 },
    { body: 'neptune', sign: moveSign(input.moon, 8), offset: 7 },
    { body: 'pluto', sign: moveSign(input.rising, 9), offset: 8 },
  ] as const;

  const houses: WebAstroHousePlacement[] = Array.from({ length: 12 }, (_, index) => {
    const sign = moveSign(input.rising, index);
    return {
      house: index + 1,
      sign,
      degree: index * 30,
      rulingPlanet: SIGN_RULERS[sign],
      interpretation: describeHouse(index + 1, sign),
    };
  });

  const planets: WebAstroPlanetPlacement[] = spec.map((entry, index) => {
    const degree = seededDegree(input.seed, index + 1);
    const house = ((signIndex(entry.sign) - signIndex(input.rising) + 12) % 12) + 1;
    return {
      id: input.idPrefix ? `${input.idPrefix}${entry.body}` : undefined,
      body: entry.body,
      label: PLANET_LABELS[entry.body],
      sign: entry.sign,
      degree,
      degreeLabel: `${degree}°`,
      house,
      tone: input.tone,
      orbit: input.orbit == null ? undefined : input.orbit + ((index % 3) - 1) * 7,
      retrograde: ['mercury', 'venus', 'mars', 'saturn'].includes(entry.body) && (input.seed + entry.offset) % 5 === 0,
      interpretation: describePlanet(entry.body, entry.sign, house),
    };
  });

  const aspects: WebAstroAspectLine[] = [];
  for (let left = 0; left < planets.length; left += 1) {
    for (let right = left + 1; right < planets.length; right += 1) {
      const first = planets[left];
      const second = planets[right];
      const diff = angularDifference(
        totalDegrees(first.sign, first.degree),
        totalDegrees(second.sign, second.degree),
      );
      const match = resolveAspect(diff);
      if (match.orb > 8.5) {
        continue;
      }
      aspects.push({
        fromBody: first.id ?? first.body,
        toBody: second.id ?? second.body,
        type: match.type,
        orb: Math.round(match.orb * 10) / 10,
        label: `${PLANET_LABELS[first.body]} ${match.type} ${PLANET_LABELS[second.body]}`,
        interpretation: describeAspect(first.body, second.body, match.type, match.orb),
      });
    }
  }

  aspects.sort((left, right) => left.orb - right.orb);

  return {
    chart: {
      planets,
      houses,
      aspects,
    },
    planets,
    houses,
    aspects,
  };
}

function buildCrossAspect(left: WebAstroPlanetPlacement, right: WebAstroPlanetPlacement): WebAstroAspectLine {
  const diff = angularDifference(
    totalDegrees(left.sign, left.degree),
    totalDegrees(right.sign, right.degree),
  );
  const match = resolveAspect(diff);
  return {
    fromBody: left.id ?? left.body,
    toBody: right.id ?? right.body,
    type: match.type,
    orb: Math.round(match.orb * 10) / 10,
    label: `Your ${PLANET_LABELS[left.body]} ${match.type} their ${PLANET_LABELS[right.body]}`,
    interpretation: describeAspect(left.body, right.body, match.type, match.orb),
  };
}

export function createBirthChartView(profile: BirthProfile): BirthChartViewModel {
  const core = getCoreSigns(profile);
  const suite = buildPlanetSuite({
    ...core,
    seed: hashValue(`${profile.id}-${profile.birthDate}-${profile.birthTime ?? 'unknown'}`),
  });

  const elementBalance: Record<ZodiacElement, number> = {
    fire: 0,
    earth: 0,
    air: 0,
    water: 0,
  };
  const modalityBalance: Record<Modality, number> = {
    cardinal: 0,
    fixed: 0,
    mutable: 0,
  };

  for (const planet of suite.planets) {
    const element = getZodiacElement(planet.sign);
    elementBalance[element] += 1;
    modalityBalance[MODALITY_BY_SIGN[planet.sign]] += 1;
  }

  const dominantPlanets = suite.planets
    .map((planet) => ({
      body: planet.body,
      weight:
        suite.aspects.filter((aspect) => aspect.fromBody.endsWith(planet.body) || aspect.toBody.endsWith(planet.body)).length +
        (planet.body === 'sun' || planet.body === 'moon' ? 2 : 0),
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3)
    .map((planet) => ({
      body: planet.body,
      reason: `${PLANET_LABELS[planet.body]} stands out through repeated aspects and strong house emphasis.`,
    }));

  const dominantBlend = Object.entries(elementBalance)
    .sort((left, right) => right[1] - left[1])
    .filter((entry) => entry[1] > 0)
    .slice(0, 2)
    .map(([element]) => capitalize(element))
    .join(' & ');

  return {
    chart: suite.chart,
    profile,
    core,
    planets: suite.planets,
    houses: suite.houses,
    aspects: suite.aspects,
    elementBalance,
    modalityBalance,
    dominantPlanets,
    dominantBlend,
  };
}

export function createSynastryView(leftProfile: BirthProfile, rightProfile: BirthProfile): SynastryViewModel {
  const left = createBirthChartView(leftProfile);
  const right = createBirthChartView(rightProfile);
  const analysis = computeQuickMatch(leftProfile.id, rightProfile.id, left.core.sun, right.core.sun);

  const leftPlanet = (body: string) => left.planets.find((planet) => planet.body === body)!;
  const rightPlanet = (body: string) => right.planets.find((planet) => planet.body === body)!;

  const highlights = [
    buildCrossAspect(leftPlanet('sun'), rightPlanet('moon')),
    buildCrossAspect(leftPlanet('moon'), rightPlanet('sun')),
    buildCrossAspect(leftPlanet('venus'), rightPlanet('mars')),
    buildCrossAspect(leftPlanet('mercury'), rightPlanet('mercury')),
    buildCrossAspect(leftPlanet('jupiter'), rightPlanet('sun')),
  ]
    .sort((first, second) => first.orb - second.orb)
    .slice(0, 5);

  const romance = Math.round(
    (calculateCompatibility(left.core.sun, right.core.moon) + calculateCompatibility(left.core.moon, right.core.sun)) / 2,
  );
  const communication = Math.round(
    (calculateCompatibility(leftPlanet('mercury').sign, rightPlanet('mercury').sign) +
      calculateCompatibility(left.core.sun, right.core.rising)) /
      2,
  );
  const growth = Math.round(
    (analysis.overallScore +
      calculateCompatibility(left.core.rising, right.core.rising) +
      calculateCompatibility(leftPlanet('jupiter').sign, rightPlanet('sun').sign)) /
      3,
  );

  const leftOverlay = buildPlanetSuite({
    ...left.core,
    seed: hashValue(`${leftProfile.id}-${leftProfile.birthDate}`),
    idPrefix: 'self-',
    tone: '#C4B5FD',
    orbit: 94,
  });
  const rightOverlay = buildPlanetSuite({
    ...right.core,
    seed: hashValue(`${rightProfile.id}-${rightProfile.birthDate}`),
    idPrefix: 'friend-',
    tone: '#FFB877',
    orbit: 122,
  });

  return {
    analysis,
    chart: {
      planets: [...leftOverlay.planets, ...rightOverlay.planets],
      houses: left.chart.houses,
      aspects: highlights,
    },
    categories: [
      { label: 'Romance', score: romance, tone: '#FFB4AB' },
      { label: 'Communication', score: communication, tone: '#8BCFF0' },
      { label: 'Growth', score: growth, tone: '#84CC16' },
      { label: 'Overall', score: analysis.overallScore, tone: '#C4B5FD' },
    ],
    highlights,
    overallTheme: `${scoreDescriptor(analysis.overallScore)}. ${analysis.elementDescription}`,
    strengths:
      analysis.overallScore >= 75
        ? 'This pairing has natural warmth, fast repair after tension, and an easy sense of momentum when you move toward shared goals.'
        : 'There is enough resonance here to make the connection memorable when you stay explicit about needs and pacing.',
    challenges:
      analysis.overallScore >= 75
        ? 'Blind spots show up as assumptions. Similar styles can skip needed clarity if you rely only on chemistry.'
        : 'Mismatch usually shows up around timing, emotional expression, and how each person pushes for change.',
  };
}

export function createTransitFocusChart(profile: BirthProfile, event: TransitEvent): WebAstroChart {
  const base = createBirthChartView(profile);
  const transits = getSkyPositions(event.exactDate)
    .filter((position) => ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(position.body))
    .map((position, index) => ({
      id: `transit-${position.body}`,
      body: position.body,
      label: PLANET_LABELS[position.body] ?? capitalize(position.body),
      sign: position.sign,
      degree: position.degree,
      degreeLabel: `${position.degree}°`,
      house: ((signIndex(position.sign) - signIndex(base.core.rising) + 12) % 12) + 1,
      tone: '#C4B5FD',
      orbit: 122 + ((index % 2) - 0.5) * 8,
      interpretation: `${capitalize(position.body)} is traveling through ${STARS_ZODIAC_LABELS[position.sign]} on ${formatLongDate(event.exactDate).toLowerCase()}.`,
    }));

  const highlighted = base.planets
    .filter((planet) => [event.natalBody].includes(planet.body))
    .map((planet) => ({ ...planet, id: `natal-${planet.body}`, tone: '#FFB877', orbit: 88 }));

  const focusAspects: WebAstroAspectLine[] = [
    {
      fromBody: `transit-${event.transitingBody}`,
      toBody: `natal-${event.natalBody}`,
      type: event.aspectType,
      orb: event.currentOrb,
      label: `${capitalize(event.transitingBody)} ${event.aspectType} ${capitalize(event.natalBody)}`,
      interpretation: event.interpretationBrief,
    },
  ];

  return {
    planets: [...highlighted, ...transits],
    houses: base.houses,
    aspects: focusAspects,
  };
}

export function createSolarReturnSummary(result: SolarReturnResult, previous: SolarReturnResult | null) {
  return {
    title: `${result.returnYear} Solar Return`,
    returnMoment: formatLongDate(result.returnDate),
    comparisonCopy: previous
      ? `${previous.returnYear} leaned toward ${STARS_ZODIAC_LABELS[previous.sunSign]}; ${result.returnYear} shifts toward ${STARS_ZODIAC_LABELS[result.sunSign]}.`
      : `${result.returnYear} centers ${STARS_ZODIAC_LABELS[result.sunSign]} priorities with a ${STARS_ZODIAC_LABELS[result.moonSign]} emotional climate.`,
  };
}

export function createProgressionSummary(result: ProgressedChartResult) {
  return {
    currentAge: `${result.currentAgeYears.toFixed(1)} years`,
    progressedSun: `${STARS_ZODIAC_LABELS[result.sunSign]} · ${result.sunDegreeApprox}°`,
    progressedMoon: `${STARS_ZODIAC_LABELS[result.moonSign]} · ${result.moonDegreeApprox}°`,
    nextThreshold: `${result.moonNextSignChangeYears.toFixed(1)} years until ${STARS_ZODIAC_LABELS[result.moonNextSign]}.`,
    moonInterpretation: result.moonInterpretation,
  };
}

export function deriveJournalTitle(entry: JournalEntryRow): string {
  if (entry.title?.trim()) {
    return entry.title.trim();
  }
  const firstSentence = entry.content
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstSentence ?? 'Untitled Reflection';
}

export function groupByMonth<T extends { date?: string; readingDate?: string }>(items: T[]): TimelineMonthGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = item.date ?? item.readingDate;
    if (!value) {
      continue;
    }
    const label = formatMonthLabel(value);
    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }
  return Array.from(groups.entries()).map(([label, groupedItems]) => ({
    label,
    items: groupedItems,
  }));
}

export function resolveDailyTarotCard(reading: DailyReading | null | undefined, date: string): TarotCard {
  const storedCard =
    getTarotCardById(reading?.tarotCardId ?? '') ??
    getTarotCardByName(reading?.tarotCard ?? null);
  return storedCard ?? getTarotCardOfDay(date);
}

export function buildDailySummary(card: TarotCard, reversed: boolean): string {
  const base = reversed ? card.reversedMeaning : card.uprightMeaning;
  return `${base} Focus on ${card.keywords.slice(0, 2).join(' and ')} today.`;
}

export function buildPositionInterpretation(card: TarotCard, positionMeaning: string, reversed: boolean): string {
  return `${positionMeaning} ${reversed ? card.reversedMeaning : card.uprightMeaning}`.trim();
}

export function buildReadingNarrative(cards: TarotReadingCard[]): string {
  if (cards.length === 0) {
    return 'The archive is quiet for now. Draw when the question feels ready.';
  }
  if (cards.length === 1) {
    return `${cards[0].cardName} is the single thread running through this question. ${cards[0].interpretation}`;
  }
  const opening = cards[0];
  const middle = cards[Math.floor(cards.length / 2)];
  const closing = cards[cards.length - 1];
  return `${opening.cardName} opens the reading through ${opening.positionLabel.toLowerCase()}, ${middle.cardName} describes the living tension at ${middle.positionLabel.toLowerCase()}, and ${closing.cardName} points toward ${closing.positionLabel.toLowerCase()}.`;
}

export function createTarotTitle(spreadType: TarotSpreadType, question: string): string {
  if (question.trim()) {
    return question.trim().slice(0, 72);
  }
  return `${getTarotSpreadDefinition(spreadType).name} Reading`;
}

export function createTarotDraftReading(
  spreadType: TarotSpreadType,
  question: string,
  date: string,
): TarotDraftReading {
  const spread = getTarotSpreadDefinition(spreadType);
  const cards = drawRandomCards(spread.cardCount).map((card, index) => {
    const reversed = getDeterministicTarotOrientation(`${date}-${card.id}-${index}-${question}`);
    return {
      cardId: card.id,
      cardName: card.name,
      positionLabel: spread.positions[index].label,
      positionMeaning: spread.positions[index].meaning,
      reversed,
      interpretation: buildPositionInterpretation(card, spread.positions[index].meaning, reversed),
    };
  });

  return {
    spread,
    title: createTarotTitle(spreadType, question),
    question: question.trim(),
    cards,
    narrative: buildReadingNarrative(cards),
  };
}

export function tarotReadingPreview(reading: TarotReading): string {
  const firstCard = reading.cards[0];
  if (!firstCard) {
    return 'No cards saved in this reading.';
  }
  return `${firstCard.cardName} · ${firstCard.positionLabel}`;
}

export function transitSummary(event: TransitEvent): string {
  return `${capitalize(event.transitingBody)} ${event.aspectType} ${capitalize(event.natalBody)} · ${formatShortDate(event.exactDate)}`;
}

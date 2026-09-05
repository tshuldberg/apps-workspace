import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  MaterialSymbol,
  PlanetGlyph,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_ELEMENTS,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  ST_TYPOGRAPHY,
  calculateCompatibility,
  computeQuickMatch,
  getMoonSign,
  getZodiacElement,
  getZodiacSign,
  withAlpha,
  type Aspect,
  type AstroChart,
  type AstroPlanetPlacement,
  type BirthProfile,
  type CompatibilityAnalysis,
  type ProgressedChartResult,
  type SolarReturnResult,
  type ZodiacElement,
  type ZodiacSign as ZodiacSignName,
} from '@mylife/stars';

type Modality = 'cardinal' | 'fixed' | 'mutable';
export type FriendsSortMode = 'alphabetical' | 'sign' | 'recent';
export type ProgressionType = 'secondary' | 'solar_arc' | 'tertiary';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

export interface ChartPlanetDetail extends AstroPlanetPlacement {
  label: string;
  degreeLabel: string;
  interpretation: string;
}

export interface ChartHouseDetail {
  house: number;
  sign: ZodiacSignName;
  rulingPlanet: string;
  interpretation: string;
}

export interface ChartAspectDetail {
  fromBody: string;
  toBody: string;
  type: Aspect;
  orb: number;
  label: string;
  interpretation: string;
}

export interface BirthChartViewModel {
  chart: AstroChart;
  profile: BirthProfile;
  core: {
    sun: ZodiacSignName;
    moon: ZodiacSignName;
    rising: ZodiacSignName;
  };
  planets: ChartPlanetDetail[];
  houses: ChartHouseDetail[];
  aspects: ChartAspectDetail[];
  elementBalance: Record<ZodiacElement, number>;
  modalityBalance: Record<Modality, number>;
  dominantPlanets: Array<{ body: string; reason: string }>;
  dominantBlend: string;
}

export interface SynastryViewModel {
  analysis: CompatibilityAnalysis;
  overlayChart: AstroChart;
  categories: Array<{ label: string; score: number; tone: string }>;
  highlights: ChartAspectDetail[];
  overallTheme: string;
  strengths: string;
  challenges: string;
  tips: string;
}

export interface SolarReturnViewModel {
  chart: AstroChart;
  compareChart: AstroChart;
  yearLabel: string;
  returnMoment: string;
  quarterThemes: Array<{ label: string; title: string; copy: string }>;
  keyTransits: ChartAspectDetail[];
  comparisonCopy: string;
  standoutFocus: Array<{ label: string; value: string }>;
}

export interface ProgressionViewModel {
  chart: AstroChart;
  emphasis: Array<{ label: string; value: string; copy: string }>;
  aspects: ChartAspectDetail[];
  timelinePoints: number[];
  timelineLabels: string[];
  summary: string;
  nextThreshold: string;
}

const ZODIAC_ORDER: ZodiacSignName[] = [
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

const ZODIAC_LABELS: Record<ZodiacSignName, string> = {
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
};

const SIGN_DESCRIPTIONS: Record<ZodiacSignName, string> = {
  aries: 'Bold, fast, and instinctive. Aries energy moves first and figures the rest out in motion.',
  taurus: 'Grounded and steady. Taurus builds slowly, keeps what matters, and honors the body.',
  gemini: 'Quick, curious, and connective. Gemini thrives on ideas, conversation, and perspective shifts.',
  cancer: 'Protective and intuitive. Cancer reads emotional weather before anyone else notices the clouds.',
  leo: 'Radiant and expressive. Leo wants to create, lead from the heart, and be known clearly.',
  virgo: 'Precise and attentive. Virgo refines chaos into something usable, elegant, and quietly excellent.',
  libra: 'Relational and aesthetic. Libra looks for balance, fairness, and the right shape of connection.',
  scorpio: 'Intense and transformative. Scorpio goes all the way down to what is real and enduring.',
  sagittarius: 'Expansive and meaning-seeking. Sagittarius grows through risk, travel, and bigger stories.',
  capricorn: 'Strategic and durable. Capricorn respects time, structure, and earned mastery.',
  aquarius: 'Inventive and future-facing. Aquarius thinks in systems, communities, and better possibilities.',
  pisces: 'Porous and imaginative. Pisces listens to subtle feeling, dreams, and hidden currents.',
};

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
  moon: 'emotions and instincts',
  mercury: 'thought and communication',
  venus: 'attraction and taste',
  mars: 'drive and conflict style',
  jupiter: 'growth and belief',
  saturn: 'discipline and structure',
  uranus: 'change and disruption',
  neptune: 'dreams and surrender',
  pluto: 'power and transformation',
};

const SIGN_RULERS: Record<ZodiacSignName, string> = {
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

const MODALITY_BY_SIGN: Record<ZodiacSignName, Modality> = {
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
  'belief, travel, and big-picture meaning',
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

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongDateLabel(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatBirthMeta(profile: BirthProfile): string {
  const parts = [formatDateLabel(profile.birthDate)];
  if (profile.birthTime) {
    parts.push(profile.birthTime);
  }
  if (profile.birthPlace) {
    parts.push(profile.birthPlace);
  }
  return parts.join('  •  ');
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function sortFriendProfiles(
  profiles: BirthProfile[],
  mode: FriendsSortMode,
): BirthProfile[] {
  const next = [...profiles];
  if (mode === 'recent') {
    return next.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
  if (mode === 'sign') {
    return next.sort((left, right) => {
      const leftSign = ZODIAC_LABELS[getCoreSigns(left).sun];
      const rightSign = ZODIAC_LABELS[getCoreSigns(right).sun];
      return leftSign.localeCompare(rightSign) || left.name.localeCompare(right.name);
    });
  }
  return next.sort((left, right) => left.name.localeCompare(right.name));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hashValue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function signIndex(sign: ZodiacSignName): number {
  return ZODIAC_ORDER.indexOf(sign);
}

function moveSign(sign: ZodiacSignName, offset: number): ZodiacSignName {
  const index = signIndex(sign);
  const nextIndex = (index + offset + ZODIAC_ORDER.length * 4) % ZODIAC_ORDER.length;
  return ZODIAC_ORDER[nextIndex];
}

function totalDegrees(sign: ZodiacSignName, degree: number): number {
  return signIndex(sign) * 30 + degree;
}

function angularDifference(left: number, right: number): number {
  const raw = Math.abs(left - right) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function resolveAspect(diff: number): { type: Aspect; orb: number } {
  const best = ASPECT_TARGETS.reduce(
    (closest, target) => {
      const orb = Math.abs(diff - target.angle);
      return orb < closest.orb ? { type: target.type, orb } : closest;
    },
    { type: 'conjunction' as Aspect, orb: Number.POSITIVE_INFINITY },
  );
  return best;
}

function seededDegree(seed: number, salt: number): number {
  return (seed * (salt * 7 + 3) + salt * 19) % 30;
}

function getCoreSigns(profile: BirthProfile): {
  sun: ZodiacSignName;
  moon: ZodiacSignName;
  rising: ZodiacSignName;
} {
  const sun = profile.sunSign ?? getZodiacSign(profile.birthDate);
  const moon = profile.moonSign ?? getMoonSign(profile.birthDate);
  const risingOffset = (hashValue(`${profile.name}-${profile.birthTime ?? 'unknown'}`) % 5) + 1;
  const rising = profile.risingSign ?? moveSign(sun, risingOffset);
  return { sun, moon, rising };
}

function describePlanet(body: string, sign: ZodiacSignName, house: number): string {
  return `${PLANET_LABELS[body]} in ${ZODIAC_LABELS[sign]} channels ${PLANET_PURPOSES[body]} through house ${house}, emphasizing ${HOUSE_TOPICS[house - 1]}.`;
}

function describeHouse(house: number, sign: ZodiacSignName): string {
  return `House ${house} begins in ${ZODIAC_LABELS[sign]}, so ${HOUSE_TOPICS[house - 1]} tend to feel ${SIGN_DESCRIPTIONS[sign].toLowerCase()}`;
}

function describeAspect(
  fromBody: string,
  toBody: string,
  type: Aspect,
  orb: number,
): string {
  const shared = `${PLANET_LABELS[fromBody]} ${type} ${PLANET_LABELS[toBody]}`;
  if (type === 'trine') {
    return `${shared} flows easily with an orb of ${orb.toFixed(1)}°. Trust the natural chemistry and momentum here.`;
  }
  if (type === 'sextile') {
    return `${shared} opens a supportive lane with an orb of ${orb.toFixed(1)}°. Small actions pay off quickly.`;
  }
  if (type === 'square') {
    return `${shared} creates productive tension with an orb of ${orb.toFixed(1)}°. Friction here is a growth engine.`;
  }
  if (type === 'opposition') {
    return `${shared} pulls two poles into awareness with an orb of ${orb.toFixed(1)}°. Balance matters more than control.`;
  }
  return `${shared} is tightly fused with an orb of ${orb.toFixed(1)}°. This energy is impossible to ignore.`;
}

function scoreDescriptor(score: number): string {
  if (score >= 85) {
    return 'Highly soul-bonded';
  }
  if (score >= 70) {
    return 'Strong celestial harmony';
  }
  if (score >= 55) {
    return 'Dynamic growth match';
  }
  return 'Challenging but catalytic';
}

function buildPlanetSuite(input: {
  sun: ZodiacSignName;
  moon: ZodiacSignName;
  rising: ZodiacSignName;
  seed: number;
  idPrefix?: string;
  tone?: string;
  orbit?: number;
}): {
  chart: AstroChart;
  planets: ChartPlanetDetail[];
  houses: ChartHouseDetail[];
  aspects: ChartAspectDetail[];
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

  const houses: ChartHouseDetail[] = Array.from({ length: 12 }, (_, index) => {
    const sign = moveSign(input.rising, index);
    return {
      house: index + 1,
      sign,
      rulingPlanet: SIGN_RULERS[sign],
      interpretation: describeHouse(index + 1, sign),
    };
  });

  const planets: ChartPlanetDetail[] = spec.map((entry, index) => {
    const degree = seededDegree(input.seed, index + 1);
    const house = ((signIndex(entry.sign) - signIndex(input.rising) + 12) % 12) + 1;
    const orbitOffset = input.orbit == null ? undefined : input.orbit + ((index % 3) - 1) * 6;
    return {
      id: input.idPrefix ? `${input.idPrefix}${entry.body}` : undefined,
      body: entry.body,
      label: PLANET_LABELS[entry.body],
      sign: entry.sign,
      degree,
      degreeLabel: `${degree}°`,
      house,
      tone: input.tone,
      orbit: orbitOffset,
      retrograde: ['mercury', 'venus', 'mars', 'saturn'].includes(entry.body) && (input.seed + entry.offset) % 5 === 0,
      interpretation: describePlanet(entry.body, entry.sign, house),
    };
  });

  const aspects: ChartAspectDetail[] = [];
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
      houses: houses.map((house) => ({
        house: house.house,
        sign: house.sign,
        degree: (house.house - 1) * 30,
      })),
      aspects: aspects.map((aspect) => ({
        fromBody: aspect.fromBody,
        toBody: aspect.toBody,
        type: aspect.type,
      })),
    },
    planets,
    houses,
    aspects,
  };
}

export function createBirthChartData(profile: BirthProfile): BirthChartViewModel {
  const core = getCoreSigns(profile);
  const seed = hashValue(`${profile.id}-${profile.birthDate}-${profile.birthTime ?? 'unknown'}`);
  const suite = buildPlanetSuite({
    ...core,
    seed,
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
    const modality = MODALITY_BY_SIGN[planet.sign];
    elementBalance[element] += 1;
    modalityBalance[modality] += 1;
  }

  const aspectCounts = suite.planets.map((planet) => {
    const matches = suite.aspects.filter((aspect) =>
      aspect.fromBody.endsWith(planet.body) || aspect.toBody.endsWith(planet.body),
    ).length;
    const weight = matches + (planet.body === 'sun' || planet.body === 'moon' ? 2 : 0);
    return { body: planet.body, weight, house: planet.house ?? 0 };
  });

  const dominantPlanets = aspectCounts
    .sort((left, right) => right.weight - left.weight || left.house - right.house)
    .slice(0, 3)
    .map((entry) => ({
      body: entry.body,
      reason: `${PLANET_LABELS[entry.body]} stands out through repeated aspects and a strong house emphasis.`,
    }));

  const dominantElements = Object.entries(elementBalance)
    .sort((left, right) => right[1] - left[1])
    .filter((entry) => entry[1] > 0)
    .slice(0, 2)
    .map(([element]) => capitalize(element));

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
    dominantBlend: dominantElements.join(' & '),
  };
}

function buildCrossAspect(
  left: ChartPlanetDetail,
  right: ChartPlanetDetail,
): ChartAspectDetail {
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

export function createSynastryView(
  leftProfile: BirthProfile,
  rightProfile: BirthProfile,
): SynastryViewModel {
  const left = createBirthChartData(leftProfile);
  const right = createBirthChartData(rightProfile);
  const analysis = computeQuickMatch(
    leftProfile.id,
    rightProfile.id,
    left.core.sun,
    right.core.sun,
  );

  const leftPlanet = (body: string) => left.planets.find((planet) => planet.body === body)!;
  const rightPlanet = (body: string) => right.planets.find((planet) => planet.body === body)!;

  const highlights = [
    buildCrossAspect(leftPlanet('sun'), rightPlanet('moon')),
    buildCrossAspect(leftPlanet('moon'), rightPlanet('sun')),
    buildCrossAspect(leftPlanet('venus'), rightPlanet('mars')),
    buildCrossAspect(leftPlanet('mercury'), rightPlanet('mercury')),
    buildCrossAspect(leftPlanet('jupiter'), rightPlanet('sun')),
    buildCrossAspect(leftPlanet('mars'), rightPlanet('moon')),
  ]
    .sort((first, second) => first.orb - second.orb)
    .slice(0, 5);

  const romance = Math.round(
    (calculateCompatibility(left.core.sun, right.core.moon) +
      calculateCompatibility(left.core.moon, right.core.sun)) /
      2,
  );
  const communication = Math.round(
    (calculateCompatibility(leftPlanet('mercury').sign, rightPlanet('mercury').sign) +
      calculateCompatibility(left.core.sun, right.core.rising)) /
      2,
  );
  const conflict = clamp(
    100 -
      Math.abs(
        calculateCompatibility(leftPlanet('mars').sign, rightPlanet('mars').sign) - 68,
      ),
    35,
    96,
  );
  const growth = Math.round(
    (analysis.overallScore +
      calculateCompatibility(left.core.rising, right.core.rising) +
      calculateCompatibility(leftPlanet('jupiter').sign, rightPlanet('sun').sign)) /
      3,
  );

  const categories = [
    { label: 'Romance', score: romance, tone: ST_ACCENT_LIGHT },
    { label: 'Communication', score: communication, tone: ST_ELEMENTS.air },
    { label: 'Conflict', score: conflict, tone: ST_ELEMENTS.fire },
    { label: 'Growth', score: growth, tone: ST_ELEMENTS.earth },
  ];

  const leftOverlay = buildPlanetSuite({
    ...left.core,
    seed: hashValue(`${leftProfile.id}-${leftProfile.birthDate}`),
    idPrefix: 'self-',
    tone: ST_ACCENT_LIGHT,
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
    overlayChart: {
      planets: [...leftOverlay.planets, ...rightOverlay.planets],
      houses: left.chart.houses,
      aspects: highlights.map((aspect) => ({
        fromBody: aspect.fromBody,
        toBody: aspect.toBody,
        type: aspect.type,
      })),
    },
    categories,
    highlights,
    overallTheme: `${scoreDescriptor(analysis.overallScore)}. ${analysis.elementDescription}`,
    strengths:
      analysis.overallScore >= 75
        ? 'This pairing has natural warmth, quick repair after tension, and an easy sense of momentum when you move toward shared goals.'
        : 'There is enough resonance here to make the connection memorable, especially when you work consciously with your different pacing and needs.',
    challenges:
      analysis.overallScore >= 75
        ? 'Blind spots usually show up as assumptions. Similar styles can skip needed clarity if you rely only on chemistry.'
        : 'Mismatch tends to show up around timing, emotional expression, and how each person pushes for change.',
    tips:
      analysis.overallScore >= 75
        ? 'Keep communication explicit, celebrate the easy wins, and protect individual space so the bond stays alive instead of becoming ambient.'
        : 'Use rituals, clear expectations, and intentional check-ins. The relationship gets better when neither person expects the other to process exactly the same way.',
  };
}

function quarterCopy(sign: ZodiacSignName, quarterIndex: number): { title: string; copy: string } {
  const shifted = moveSign(sign, quarterIndex);
  return {
    title: `${ZODIAC_LABELS[shifted]} season focus`,
    copy: `Quarter ${quarterIndex + 1} leans into ${SIGN_DESCRIPTIONS[shifted].toLowerCase()} Let this quarter emphasize ${HOUSE_TOPICS[(quarterIndex * 3) % HOUSE_TOPICS.length]}.`,
  };
}

export function createSolarReturnView(
  profile: BirthProfile,
  result: SolarReturnResult,
  previousResult: SolarReturnResult,
): SolarReturnViewModel {
  const seed = hashValue(`${profile.id}-${result.returnYear}`);
  const rising = moveSign(result.sunSign, (seed % 4) + 1);
  const current = buildPlanetSuite({
    sun: result.sunSign,
    moon: result.moonSign,
    rising,
    seed,
    idPrefix: 'current-',
    tone: ST_ACCENT_LIGHT,
    orbit: 106,
  });
  const previous = buildPlanetSuite({
    sun: previousResult.sunSign,
    moon: previousResult.moonSign,
    rising: moveSign(previousResult.sunSign, (seed % 3) + 1),
    seed: seed - 7,
    idPrefix: 'prev-',
    tone: withAlpha(ST_TEXT, 0.72),
    orbit: 84,
  });

  const quarterThemes = Array.from({ length: 4 }, (_, index) => ({
    label: `Q${index + 1}`,
    ...quarterCopy(result.sunSign, index),
  }));

  const keyTransits = current.aspects.slice(0, 4);
  const houseFocus = current.planets.slice(0, 3).map((planet) => ({
    label: PLANET_LABELS[planet.body],
    value: `${ZODIAC_LABELS[planet.sign]} · House ${planet.house ?? 1}`,
  }));

  return {
    chart: {
      planets: current.planets,
      houses: current.chart.houses,
      aspects: current.chart.aspects,
    },
    compareChart: {
      planets: [...previous.planets, ...current.planets],
      houses: current.chart.houses,
      aspects: current.aspects.slice(0, 4).map((aspect) => ({
        fromBody: aspect.fromBody,
        toBody: aspect.toBody,
        type: aspect.type,
      })),
    },
    yearLabel: `${result.returnYear}  •  ${scoreDescriptor(78)}`,
    returnMoment: profile.birthTime
      ? `${formatLongDateLabel(result.returnDate)} at ${profile.birthTime}${profile.birthPlace ? ` · ${profile.birthPlace}` : ''}`
      : `${formatLongDateLabel(result.returnDate)}${profile.birthPlace ? ` · ${profile.birthPlace}` : ''}`,
    quarterThemes,
    keyTransits,
    comparisonCopy: `${previousResult.returnYear} leaned ${ZODIAC_LABELS[previousResult.sunSign].toLowerCase()}; ${result.returnYear} shifts toward ${ZODIAC_LABELS[result.sunSign].toLowerCase()} priorities.`,
    standoutFocus: houseFocus,
  };
}

function shiftSignDegree(
  sign: ZodiacSignName,
  degree: number,
  delta: number,
): { sign: ZodiacSignName; degree: number } {
  const total = totalDegrees(sign, degree) + delta;
  const normalized = ((total % 360) + 360) % 360;
  const nextSign = ZODIAC_ORDER[Math.floor(normalized / 30)];
  return {
    sign: nextSign,
    degree: Math.round(normalized % 30),
  };
}

function applyProgressionType(
  result: ProgressedChartResult,
  type: ProgressionType,
): ProgressedChartResult {
  if (type === 'secondary') {
    return result;
  }
  if (type === 'solar_arc') {
    const shiftedSun = shiftSignDegree(result.sunSign, result.sunDegreeApprox, 8);
    const shiftedMoon = shiftSignDegree(result.moonSign, result.moonDegreeApprox, 14);
    return {
      ...result,
      sunSign: shiftedSun.sign,
      sunDegreeApprox: shiftedSun.degree,
      moonSign: shiftedMoon.sign,
      moonDegreeApprox: shiftedMoon.degree,
      moonInterpretation: `${result.moonInterpretation} Solar Arc emphasizes decisive external movement and visible life edits.`,
      moonNextSign: moveSign(result.moonNextSign, 1),
    };
  }
  const shiftedSun = shiftSignDegree(result.sunSign, result.sunDegreeApprox, -5);
  const shiftedMoon = shiftSignDegree(result.moonSign, result.moonDegreeApprox, 7);
  return {
    ...result,
    sunSign: shiftedSun.sign,
    sunDegreeApprox: shiftedSun.degree,
    moonSign: shiftedMoon.sign,
    moonDegreeApprox: shiftedMoon.degree,
    moonInterpretation: `${result.moonInterpretation} Tertiary progressions read the shorter emotional weather and subtle processing cycles.`,
  };
}

export function createProgressionView(
  profile: BirthProfile,
  rawResult: ProgressedChartResult,
  type: ProgressionType,
  selectedDate: string,
): ProgressionViewModel {
  const natal = createBirthChartData(profile);
  const result = applyProgressionType(rawResult, type);
  const seed = hashValue(`${profile.id}-${selectedDate}-${type}`);
  const progressed = buildPlanetSuite({
    sun: result.sunSign,
    moon: result.moonSign,
    rising: moveSign(natal.core.rising, type === 'solar_arc' ? 1 : type === 'tertiary' ? -1 : 0),
    seed,
    idPrefix: 'progressed-',
    tone: ST_ACCENT_LIGHT,
    orbit: 118,
  });
  const natalOverlay = buildPlanetSuite({
    ...natal.core,
    seed: hashValue(`${profile.id}-${profile.birthDate}`),
    idPrefix: 'natal-',
    tone: withAlpha(ST_TEXT, 0.78),
    orbit: 88,
  });

  const aspects = [
    buildCrossAspect(progressed.planets.find((planet) => planet.body === 'sun')!, natalOverlay.planets.find((planet) => planet.body === 'sun')!),
    buildCrossAspect(progressed.planets.find((planet) => planet.body === 'moon')!, natalOverlay.planets.find((planet) => planet.body === 'moon')!),
    buildCrossAspect(progressed.planets.find((planet) => planet.body === 'venus')!, natalOverlay.planets.find((planet) => planet.body === 'mars')!),
    buildCrossAspect(progressed.planets.find((planet) => planet.body === 'mercury')!, natalOverlay.planets.find((planet) => planet.body === 'mercury')!),
    buildCrossAspect(progressed.planets.find((planet) => planet.body === 'jupiter')!, natalOverlay.planets.find((planet) => planet.body === 'sun')!),
  ].sort((left, right) => left.orb - right.orb);

  const speed = type === 'solar_arc' ? 1.35 : type === 'tertiary' ? 0.8 : 1;
  const timelinePoints = Array.from({ length: 12 }, (_, index) =>
    Math.round((result.moonDegreeApprox + index * 2.2 * speed) % 30),
  );
  const timelineLabels = Array.from({ length: 12 }, (_, index) =>
    new Date(2026, index, 1).toLocaleDateString('en-US', { month: 'short' }),
  );

  return {
    chart: {
      planets: [...natalOverlay.planets, ...progressed.planets],
      houses: natal.chart.houses,
      aspects: aspects.map((aspect) => ({
        fromBody: aspect.fromBody,
        toBody: aspect.toBody,
        type: aspect.type,
      })),
    },
    emphasis: [
      {
        label: 'Progressed Sun',
        value: `${ZODIAC_LABELS[result.sunSign]} · ${result.sunDegreeApprox}°`,
        copy: `${PLANET_LABELS.sun} is turning toward ${SIGN_DESCRIPTIONS[result.sunSign].toLowerCase()}`,
      },
      {
        label: 'Progressed Moon',
        value: `${ZODIAC_LABELS[result.moonSign]} · ${result.moonDegreeApprox}°`,
        copy: result.moonInterpretation,
      },
    ],
    aspects,
    timelinePoints,
    timelineLabels,
    summary: `${capitalize(type.replace('_', ' '))} progressions for ${formatDateLabel(selectedDate)} show your emotional body in ${ZODIAC_LABELS[result.moonSign].toLowerCase()} while the solar storyline matures through ${ZODIAC_LABELS[result.sunSign].toLowerCase()}.`,
    nextThreshold: `Moon changes signs in about ${result.moonNextSignChangeYears.toFixed(1)} year${result.moonNextSignChangeYears === 1 ? '' : 's'}, moving into ${ZODIAC_LABELS[result.moonNextSign]}.`,
  };
}

export function PhaseHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={shared.headingBlock}>
      <Text style={shared.eyebrow}>{eyebrow}</Text>
      <Text style={shared.title}>{title}</Text>
      {detail ? <Text style={shared.detail}>{detail}</Text> : null}
    </View>
  );
}

export function AvatarOrb({
  name,
  tone = ST_ACCENT_LIGHT,
  size = 56,
}: {
  name: string;
  tone?: string;
  size?: number;
}) {
  return (
    <View
      style={[
        shared.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(tone, 0.16),
        },
      ]}
    >
      <Text style={[shared.avatarText, { color: tone }]}>{getInitials(name)}</Text>
    </View>
  );
}

export function MetaPill({
  label,
  tone = withAlpha('#FFFFFF', 0.08),
  textColor = ST_TEXT_SECONDARY,
}: {
  label: string;
  tone?: string;
  textColor?: string;
}) {
  return (
    <View style={[shared.pill, { backgroundColor: tone }]}>
      <Text style={[shared.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function MetricBar({
  label,
  value,
  tone,
  meta,
}: {
  label: string;
  value: number;
  tone: string;
  meta?: string;
}) {
  return (
    <View style={shared.metricRow}>
      <View style={shared.metricHeader}>
        <Text style={shared.metricLabel}>{label}</Text>
        <Text style={shared.metricMeta}>{meta ?? `${value}%`}</Text>
      </View>
      <View style={shared.metricTrack}>
        <View style={[shared.metricFill, { width: `${clamp(value, 0, 100)}%`, backgroundColor: tone }]} />
      </View>
    </View>
  );
}

export function ScoreRing({
  score,
  caption,
  tone = ST_ACCENT_LIGHT,
}: {
  score: number;
  caption: string;
  tone?: string;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(score, 0, 100) / 100);
  return (
    <View style={shared.scoreWrap}>
      <Svg width={132} height={132} viewBox="0 0 132 132">
        <Circle
          cx="66"
          cy="66"
          r={radius}
          stroke={withAlpha('#FFFFFF', 0.08)}
          strokeWidth="8"
          fill="transparent"
        />
        <Circle
          cx="66"
          cy="66"
          r={radius}
          stroke={tone}
          strokeWidth="10"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          rotation="-90"
          origin="66, 66"
        />
      </Svg>
      <View style={shared.scoreContent}>
        <Text style={shared.scoreValue}>{score}</Text>
        <Text style={shared.scoreCaption}>{caption}</Text>
      </View>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={shared.segmentWrap}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[
              shared.segmentButton,
              active ? shared.segmentButtonActive : null,
            ]}
          >
            <Text style={[shared.segmentText, active ? shared.segmentTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DetailSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={shared.sheetBackdrop} onPress={onClose}>
        <Pressable style={shared.sheetCard} onPress={(event) => event.stopPropagation()}>
          <View style={shared.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={shared.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={shared.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialSymbol name="close" size={20} color={ST_TEXT_TERTIARY} />
            </Pressable>
          </View>
          <View style={shared.sheetBody}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function TinyLineChart({
  points,
  labels,
  tone = ST_ACCENT_LIGHT,
}: {
  points: number[];
  labels: string[];
  tone?: string;
}) {
  const width = 320;
  const height = 120;
  const paddingX = 14;
  const paddingY = 18;
  const max = Math.max(...points, 1);
  const normalized = points.map((point, index) => {
    const x =
      paddingX + (index / Math.max(points.length - 1, 1)) * (width - paddingX * 2);
    const y =
      height - paddingY - (point / max) * (height - paddingY * 2);
    return { x, y };
  });
  const path = normalized.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View style={shared.lineChartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={path}
          fill="none"
          stroke={tone}
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {normalized.map((point, index) => (
          <Circle
            key={`dot-${labels[index]}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={tone}
          />
        ))}
      </Svg>
      <View style={shared.lineChartLabels}>
        {labels.map((label) => (
          <Text key={label} style={shared.lineChartLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function InlineValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={shared.inlineValue}>
      <Text style={shared.inlineLabel}>{label}</Text>
      <Text style={shared.inlineContent}>{value}</Text>
    </View>
  );
}

export function PlanetLegendRow({
  label,
  value,
  copy,
  tone,
  onPress,
  icon,
}: {
  label: string;
  value: string;
  copy: string;
  tone: string;
  onPress?: () => void;
  icon?: string;
}) {
  return (
    <Pressable onPress={onPress} style={shared.legendRow}>
      <View style={[shared.legendIcon, { backgroundColor: withAlpha(tone, 0.14) }]}>
        {icon ? (
          <MaterialSymbol name={icon} size={18} color={tone} />
        ) : (
          <PlanetGlyph planet={label.toLowerCase()} size={16} color={tone} />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={shared.legendHeader}>
          <Text style={shared.legendTitle}>{label}</Text>
          <Text style={shared.legendValue}>{value}</Text>
        </View>
        <Text style={shared.legendCopy}>{copy}</Text>
      </View>
    </Pressable>
  );
}

export const shared = StyleSheet.create({
  headingBlock: {
    gap: 6,
  },
  eyebrow: {
    ...ST_TYPOGRAPHY.labelUpper,
    color: ST_ACCENT_LIGHT,
  },
  title: {
    ...ST_TYPOGRAPHY.headlineMd,
    color: ST_TEXT,
  },
  detail: {
    ...ST_TYPOGRAPHY.bodyMd,
    color: ST_TEXT_SECONDARY,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
  },
  metricRow: {
    gap: 8,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 13,
    color: ST_TEXT,
  },
  metricMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  metricTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: withAlpha('#FFFFFF', 0.08),
  },
  metricFill: {
    height: '100%',
    borderRadius: 999,
  },
  scoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreContent: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 36,
    color: ST_TEXT,
  },
  scoreCaption: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ST_ACCENT_LIGHT,
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    padding: 6,
    borderRadius: 999,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.22),
  },
  segmentText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  segmentTextActive: {
    color: ST_TEXT,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(ST_SURFACES.lowest, 0.8),
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheetCard: {
    borderRadius: 24,
    backgroundColor: withAlpha(ST_SURFACES.high, 0.96),
    padding: 18,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sheetTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  sheetSubtitle: {
    marginTop: 4,
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_TERTIARY,
  },
  sheetBody: {
    gap: 12,
  },
  lineChartWrap: {
    gap: 8,
  },
  lineChartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  lineChartLabel: {
    flex: 1,
    fontFamily: ST_FONTS.medium,
    fontSize: 10,
    color: ST_TEXT_TERTIARY,
    textAlign: 'center',
  },
  inlineValue: {
    gap: 4,
  },
  inlineLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_TERTIARY,
  },
  inlineContent: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 14,
    color: ST_TEXT,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  legendIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  legendValue: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  legendCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
});

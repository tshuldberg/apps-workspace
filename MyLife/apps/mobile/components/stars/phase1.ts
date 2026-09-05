import {
  MOON_PHASE_INTERPRETATIONS,
  MOON_SIGN_INTERPRETATIONS,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_ELEMENTS,
  computeIllumination,
  computeRetrogradeStatuses,
  computeZodiacEvents,
  detectTransitsForDate,
  getActiveRetrogrades,
  getBirthProfiles,
  getDailyReading,
  getMoonPhase,
  getMoonSign,
  getSkyPositions,
  getTarotCardOfDay,
  getTransitEventsByProfile,
  getZodiacElement,
  getZodiacSign,
  type AstroChart,
  type BirthProfile,
  type DailyReading,
  type JournalEntryRow,
  type MoonPhase,
  type SkyPosition,
  type TransitEvent,
  type ZodiacEvent,
  type ZodiacSign,
} from '@mylife/stars';

export type StarsDatabase = Parameters<typeof getBirthProfiles>[0];

export type JournalFilterKey =
  | 'all'
  | 'this_month'
  | 'full_moons'
  | 'new_moons'
  | 'transits'
  | 'tagged'
  | 'intentions';

export interface DailyReadingModel {
  dateLabel: string;
  shortDateLabel: string;
  celestialSummary: string;
  summaryPreview: string;
  overallTheme: string;
  love: string;
  career: string;
  health: string;
  luckyNumbers: number[];
  luckyColors: Array<{ label: string; tone: string }>;
  keywords: string[];
  journalPrompt: string;
  storedReading: DailyReading | null;
  tarotCard: ReturnType<typeof getTarotCardOfDay>;
  transits: TransitEvent[];
}

export interface MoonWeekDay {
  date: string;
  label: string;
  dayOfMonth: string;
  phase: MoonPhase;
  illumination: number;
  isToday: boolean;
}

export interface JournalMonthGroup {
  id: string;
  label: string;
  entries: JournalEntryRow[];
}

export interface MoodSummaryItem {
  mood: string;
  count: number;
}

const MOON_PHASE_LABELS: Record<MoonPhase, string> = {
  new_moon: 'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter: 'First Quarter',
  waxing_gibbous: 'Waxing Gibbous',
  full_moon: 'Full Moon',
  waning_gibbous: 'Waning Gibbous',
  last_quarter: 'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const PHASE_SEQUENCE: MoonPhase[] = [
  'new_moon',
  'waxing_crescent',
  'first_quarter',
  'waxing_gibbous',
  'full_moon',
  'waning_gibbous',
  'last_quarter',
  'waning_crescent',
];

const PHASE_KEYWORDS: Record<MoonPhase, string[]> = {
  new_moon: ['intention', 'renewal', 'clarity'],
  waxing_crescent: ['momentum', 'building', 'curiosity'],
  first_quarter: ['decision', 'action', 'courage'],
  waxing_gibbous: ['editing', 'devotion', 'focus'],
  full_moon: ['illumination', 'release', 'truth'],
  waning_gibbous: ['gratitude', 'wisdom', 'sharing'],
  last_quarter: ['clearing', 'recalibration', 'discipline'],
  waning_crescent: ['rest', 'dreaming', 'repair'],
};

const INTENTION_PATTERN = /\b(intent|intention|goal|manifest|vision|wish|focus|plan)\b/i;

export const STARS_MOOD_OPTIONS = [
  'hopeful',
  'inspired',
  'calm',
  'anxious',
  'frustrated',
  'joyful',
  'contemplative',
  'reflective',
  'energized',
  'grateful',
  'drained',
] as const;

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shiftIsoDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function hashValue(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function uniqueNumbers(seed: string, count: number, max: number): number[] {
  const seen = new Set<number>();
  let cursor = hashValue(seed);
  while (seen.size < count) {
    cursor = Math.imul(cursor ^ 0x9e3779b9, 1664525) + 1013904223;
    seen.add((Math.abs(cursor) % max) + 1);
  }
  return Array.from(seen).sort((left, right) => left - right);
}

function dedupeKeywords(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const item of items) {
    if (!item) {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    keywords.push(titleCase(normalized));
  }
  return keywords;
}

function getMoonCycleAge(date: string): number {
  const value = new Date(`${date}T00:00:00Z`).getTime();
  const reference = new Date('2000-01-06T18:14:00Z').getTime();
  const synodicMillis = 29.53059 * 86400000;
  const elapsed = ((value - reference) % synodicMillis + synodicMillis) % synodicMillis;
  return elapsed / 86400000;
}

export function formatStarsLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatStarsShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatMonthLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getMoonCycleDetails(date: string) {
  const ageDays = getMoonCycleAge(date);
  const segmentLength = 29.53059 / PHASE_SEQUENCE.length;
  const phaseIndex = Math.min(
    PHASE_SEQUENCE.length - 1,
    Math.floor(ageDays / segmentLength),
  );
  const nextIndex = (phaseIndex + 1) % PHASE_SEQUENCE.length;
  const nextBoundary = phaseIndex === PHASE_SEQUENCE.length - 1
    ? 29.53059
    : (phaseIndex + 1) * segmentLength;
  const daysUntilNext = phaseIndex === PHASE_SEQUENCE.length - 1
    ? 29.53059 - ageDays
    : nextBoundary - ageDays;

  return {
    ageDays: Math.round(ageDays * 10) / 10,
    nextPhase: PHASE_SEQUENCE[nextIndex],
    daysUntilNext: Math.max(0.1, Math.round(daysUntilNext * 10) / 10),
    isVoidOfCourse: daysUntilNext <= 0.4,
  };
}

export function buildMoonWeek(date: string): MoonWeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const value = shiftIsoDate(date, index);
    return {
      date: value,
      label: new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      }),
      dayOfMonth: new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
        day: 'numeric',
        timeZone: 'UTC',
      }),
      phase: getMoonPhase(value),
      illumination: Math.round(computeIllumination(value)),
      isToday: index === 0,
    };
  });
}

export function buildTimelineDates(date: string, radius: number = 7): string[] {
  return Array.from({ length: radius * 2 + 1 }, (_, index) =>
    shiftIsoDate(date, index - radius),
  );
}

export function getPrimaryProfile(db: StarsDatabase): BirthProfile | null {
  const profiles = getBirthProfiles(db);
  return profiles[0] ?? null;
}

function buildNatalPlacements(profile: BirthProfile) {
  return [
    profile.sunSign ? { body: 'sun', sign: profile.sunSign } : null,
    profile.moonSign ? { body: 'moon', sign: profile.moonSign } : null,
    profile.risingSign ? { body: 'ascendant', sign: profile.risingSign } : null,
  ].filter(Boolean) as Array<{ body: string; sign: ZodiacSign }>;
}

function dedupeSkyAspects(events: TransitEvent[]): TransitEvent[] {
  const seen = new Set<string>();
  const deduped: TransitEvent[] = [];
  for (const event of events.sort((left, right) => left.currentOrb - right.currentOrb)) {
    const pair = [event.transitingBody, event.natalBody].sort().join(':');
    const key = `${pair}:${event.aspectType}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

export function getSkyAspects(date: string): TransitEvent[] {
  const skyPositions = getSkyPositions(date);
  return dedupeSkyAspects(
    detectTransitsForDate(
      'sky',
      skyPositions.map((position) => ({ body: position.body, sign: position.sign })),
      skyPositions.map((position) => ({ body: position.body, sign: position.sign })),
      date,
    ),
  );
}

export function getPersonalTransits(
  db: StarsDatabase,
  profile: BirthProfile | null,
  date: string,
): TransitEvent[] {
  if (!profile) {
    return [];
  }

  const stored = getTransitEventsByProfile(db, profile.id, date, date);
  if (stored.length > 0) {
    return stored;
  }

  const natalPlacements = buildNatalPlacements(profile);
  if (natalPlacements.length === 0) {
    return [];
  }

  const skyPositions = getSkyPositions(date);
  return detectTransitsForDate(
    profile.id,
    skyPositions.map((position) => ({ body: position.body, sign: position.sign })),
    natalPlacements,
    date,
  ).sort((left, right) => left.currentOrb - right.currentOrb);
}

export function buildSkyChart(date: string, compareToNatal: boolean, profile?: BirthProfile | null): AstroChart {
  const retrogradeBodies = new Set(
    getActiveRetrogrades(computeRetrogradeStatuses(date)).map((item) => item.body.toLowerCase()),
  );
  const skyPositions = getSkyPositions(date);

  const planets = skyPositions.map((position) => ({
    body: position.body,
    sign: position.sign,
    degree: position.degree,
    retrograde: retrogradeBodies.has(position.body.toLowerCase()),
  }));

  const aspects = compareToNatal && profile
    ? getPersonalTransitsFromPlacements(profile, date)
    : getSkyAspects(date);

  return {
    planets,
    aspects: aspects.slice(0, 10).map((event) => ({
      fromBody: event.transitingBody,
      toBody: event.natalBody,
      type: event.aspectType,
    })),
  };
}

function getPersonalTransitsFromPlacements(profile: BirthProfile, date: string): TransitEvent[] {
  const natalPlacements = buildNatalPlacements(profile);
  if (natalPlacements.length === 0) {
    return [];
  }
  const skyPositions = getSkyPositions(date);
  return detectTransitsForDate(
    profile.id,
    skyPositions.map((position) => ({ body: position.body, sign: position.sign })),
    natalPlacements,
    date,
  ).sort((left, right) => left.currentOrb - right.currentOrb);
}

export function getUpcomingSkyEvents(date: string): ZodiacEvent[] {
  return computeZodiacEvents(date, 14, 120).slice(0, 8);
}

function getTransitFocus(transits: TransitEvent[]): string {
  const primary = transits[0];
  if (!primary) {
    return 'The chart is quieter today, which makes it easier to hear your own instincts.';
  }
  return `${titleCase(primary.transitingBody)} ${titleCase(primary.aspectType)} ${titleCase(primary.natalBody)} is the strongest thread moving through your day.`;
}

function buildLuckyColors(moonSign: ZodiacSign, sunSign: ZodiacSign) {
  const moonElement = getZodiacElement(moonSign);
  const sunElement = getZodiacElement(sunSign);
  return [
    { label: `${titleCase(moonElement)} Flow`, tone: ST_ELEMENTS[moonElement] },
    { label: `${titleCase(sunElement)} Light`, tone: ST_ELEMENTS[sunElement] },
    { label: 'Cosmic Violet', tone: ST_ACCENT_LIGHT },
    { label: 'Deep Night', tone: ST_ACCENT },
  ].slice(0, 3);
}

export function buildDailyReadingModel(
  db: StarsDatabase,
  profile: BirthProfile | null,
  date: string,
  refreshSeed: number = 0,
): DailyReadingModel {
  const moonPhase = getMoonPhase(date);
  const moonSign = getMoonSign(date);
  const sunSign = getZodiacSign(date);
  const storedReading = profile ? getDailyReading(db, profile.id, date) : null;
  const tarotCard = getTarotCardOfDay(date);
  const transits = profile ? getPersonalTransits(db, profile, date) : getSkyAspects(date);
  const seed = `${profile?.id ?? 'guest'}:${date}:${refreshSeed}`;
  const luckyNumbers = uniqueNumbers(seed, 3, 78);
  const keywords = dedupeKeywords([
    ...PHASE_KEYWORDS[moonPhase],
    moonSign,
    sunSign,
    tarotCard.suit ?? 'major arcana',
    transits[0]?.transitingBody,
    transits[1]?.transitingBody,
  ]).slice(0, 6);
  const summaryPreview = storedReading?.summary
    ? storedReading.summary
    : `${MOON_PHASE_INTERPRETATIONS[moonPhase]} ${MOON_SIGN_INTERPRETATIONS[moonSign]}`;
  const transitFocus = getTransitFocus(transits);

  return {
    dateLabel: formatStarsLongDate(date),
    shortDateLabel: formatStarsShortDate(date),
    celestialSummary: `${MOON_PHASE_LABELS[moonPhase]} moon in ${titleCase(moonSign)} · Sun in ${titleCase(sunSign)}`,
    summaryPreview,
    overallTheme: `${summaryPreview} ${transitFocus}`,
    love: `${titleCase(moonSign)} emotions want honesty over performance. Lead with softness, and let the ${titleCase(moonPhase)} pace set the tempo of your conversations.`,
    career: `${titleCase(sunSign)} season rewards conviction, but the chart asks for refinement before force. Choose the one meaningful task that deserves your best attention.`,
    health: `${titleCase(moonPhase)} energy is ideal for regulating your nervous system. Hydrate, reduce background noise, and notice where your body is asking for more spaciousness.`,
    luckyNumbers,
    luckyColors: buildLuckyColors(moonSign, sunSign),
    keywords,
    journalPrompt: profile
      ? `Where do you feel ${keywords[0]?.toLowerCase() ?? 'clarity'} in your chart today, and what would honoring it look like before nightfall?`
      : 'What part of today feels most magnetic, and what does it want you to notice?',
    storedReading,
    tarotCard,
    transits,
  };
}

export function filterJournalEntries(
  entries: JournalEntryRow[],
  query: string,
  filter: JournalFilterKey,
  referenceDate: string,
): JournalEntryRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const thisMonth = referenceDate.slice(0, 7);

  return entries.filter((entry) => {
    const tagText = [
      entry.title,
      entry.intention,
      entry.mood,
      entry.moonPhase,
      entry.moonSign,
      entry.sunSign,
      entry.tarotCardName,
      entry.retrogradePlanets,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesQuery = normalizedQuery.length === 0
      || (entry.title?.toLowerCase().includes(normalizedQuery) ?? false)
      || entry.content.toLowerCase().includes(normalizedQuery)
      || tagText.includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    switch (filter) {
      case 'this_month':
        return entry.date.startsWith(thisMonth);
      case 'full_moons':
        return entry.moonPhase === 'full_moon';
      case 'new_moons':
        return entry.moonPhase === 'new_moon';
      case 'transits':
        return Boolean(entry.retrogradePlanets && entry.retrogradePlanets !== '[]');
      case 'tagged':
        return Boolean(entry.mood || entry.tarotCardName || entry.retrogradePlanets);
      case 'intentions':
        return Boolean(entry.intention) || INTENTION_PATTERN.test(entry.content);
      case 'all':
      default:
        return true;
    }
  });
}

export function groupJournalEntriesByMonth(entries: JournalEntryRow[]): JournalMonthGroup[] {
  const groups = new Map<string, JournalEntryRow[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupedEntries]) => ({
    id: key,
    label: formatMonthLabel(`${key}-01`),
    entries: groupedEntries,
  }));
}

export function deriveEntryTitle(content: string): string {
  const firstSentence = content
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);
  return firstSentence ? titleCase(firstSentence.slice(0, 64)) : 'Untitled Reflection';
}

export function getMoodSummary(entries: JournalEntryRow[]): MoodSummaryItem[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.mood) {
      continue;
    }
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([mood, count]) => ({ mood, count }))
    .sort((left, right) => right.count - left.count);
}

export function findRelatedEntries(
  entries: JournalEntryRow[],
  currentEntry: JournalEntryRow,
  limit: number = 3,
): JournalEntryRow[] {
  return entries
    .filter((entry) => entry.id !== currentEntry.id)
    .filter((entry) =>
      entry.mood === currentEntry.mood
      || entry.moonPhase === currentEntry.moonPhase
      || entry.moonSign === currentEntry.moonSign,
    )
    .slice(0, limit);
}

export function getPlanetaryElement(position: SkyPosition): string {
  return titleCase(getZodiacElement(position.sign));
}

export function formatPhaseLabel(phase: string): string {
  return MOON_PHASE_LABELS[phase as MoonPhase] ?? titleCase(phase);
}

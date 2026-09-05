import type { Factor, PreSleepActivity } from '../models/factor-schemas';
import {
  SLEEP_HYGIENE_PRACTICE_IDS,
  type SleepHygieneCheck,
  type SleepHygienePracticeId,
} from '../models/hygiene-schemas';
import type { SleepEntry as SleepEntryRecord } from '../models/schemas';

export type SleepHygieneStatus = 'met' | 'missed' | 'unknown';
export type SleepHygieneChecklistSource = 'manual' | 'auto' | 'unavailable';
export type SleepHygieneCorrelationStatus =
  | 'reportable'
  | 'insufficient_data';
export type SleepHygieneCorrelationDirection =
  | 'positive'
  | 'negative'
  | 'neutral';

export interface SleepHygienePractice {
  id: SleepHygienePracticeId;
  label: string;
  detail: string;
}

export interface SleepHygieneChecklistItem {
  practice: SleepHygienePractice;
  status: SleepHygieneStatus;
  source: SleepHygieneChecklistSource;
  reason: string;
  autoFilled: boolean;
}

export interface SleepHygieneDailyChecklist {
  date: string;
  items: SleepHygieneChecklistItem[];
  metCount: number;
  knownCount: number;
  totalCount: number;
  score: number | null;
  sleepQuality: number | null;
}

export interface SleepHygieneQualityCorrelation {
  status: SleepHygieneCorrelationStatus;
  direction: SleepHygieneCorrelationDirection;
  sampleSize: number;
  highAdherenceSampleSize: number;
  lowAdherenceSampleSize: number;
  averageQualityHighAdherence: number | null;
  averageQualityLowAdherence: number | null;
  qualityDelta: number | null;
  insight: string;
}

export interface SleepHygieneDashboard {
  referenceDate: string;
  enabledPracticeIds: SleepHygienePracticeId[];
  today: SleepHygieneDailyChecklist;
  daily: SleepHygieneDailyChecklist[];
  weeklyScore: number | null;
  correlation: SleepHygieneQualityCorrelation;
}

export interface SleepHygieneDashboardInput {
  entries: readonly SleepEntryRecord[];
  factors: readonly Factor[];
  checks?: readonly SleepHygieneCheck[];
  referenceDate?: string;
  enabledPracticeIds?: readonly SleepHygienePracticeId[];
  targetBedtime?: string;
}

interface EvaluationContext {
  date: string;
  entry: SleepEntryRecord | null;
  factor: Factor | null;
  targetBedtime: string;
}

interface AutoEvaluation {
  status: SleepHygieneStatus;
  reason: string;
}

const TARGET_BEDTIME_DEFAULT = '22:30';
const MIN_CORRELATION_GROUP_SIZE = 3;
const REPORTABLE_QUALITY_DELTA = 0.25;
const HIGH_ADHERENCE_THRESHOLD = 75;

const SCREEN_ACTIVITIES: PreSleepActivity[] = [
  'screen_time',
  'social_media',
  'gaming',
  'tv_show',
  'movie',
];

const RELAXATION_ACTIVITIES: PreSleepActivity[] = [
  'reading',
  'meditation',
  'journaling',
  'shower',
  'bath',
  'music',
];

export const SLEEP_HYGIENE_PRACTICES: SleepHygienePractice[] = [
  {
    id: 'no_caffeine_after_2pm',
    label: 'No caffeine after 2pm',
    detail: 'Late caffeine can push sleep onset later.',
  },
  {
    id: 'no_screens_1h',
    label: 'No screens 1 hour before bed',
    detail: 'A screen cutoff gives your brain a clearer wind-down signal.',
  },
  {
    id: 'consistent_bedtime_30m',
    label: 'Same bedtime within 30 minutes',
    detail: 'A steady bedtime strengthens circadian timing.',
  },
  {
    id: 'cool_dark_room',
    label: 'Cool, dark room',
    detail: 'Temperature and light are two high-leverage sleep cues.',
  },
  {
    id: 'no_alcohol_3h',
    label: 'No alcohol within 3 hours of bed',
    detail: 'Alcohol can fragment later sleep cycles.',
  },
  {
    id: 'exercise_timing',
    label: 'Exercise, not within 2 hours of bed',
    detail: 'Movement helps sleep when it does not crowd bedtime.',
  },
  {
    id: 'relaxation_routine',
    label: 'Relaxation routine',
    detail: 'Reading, meditation, journaling, or a warm rinse counts.',
  },
  {
    id: 'no_heavy_meals_2h',
    label: 'No heavy meals within 2 hours of bed',
    detail: 'A meal buffer helps digestion settle before sleep.',
  },
];

export const DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS = [
  ...SLEEP_HYGIENE_PRACTICE_IDS,
];

function round(value: number, places = 1): number {
  return Number(value.toFixed(places));
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getDateRange(endDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    addDays(endDate, index - (days - 1)),
  );
}

function clockToMinutes(value: string | null | undefined): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

function dateTimeToClockMinutes(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return (date.getUTCHours() * 60) + date.getUTCMinutes();
}

function minutesBeforeBed(
  clockTime: string | null | undefined,
  bedtime: string | null | undefined,
): number | null {
  const factorMinutes = clockToMinutes(clockTime);
  const bedtimeMinutes = dateTimeToClockMinutes(bedtime);
  if (factorMinutes === null || bedtimeMinutes === null) {
    return null;
  }

  let delta = bedtimeMinutes - factorMinutes;
  if (delta < 0) {
    delta += 24 * 60;
  }
  return delta;
}

function clockDistanceMinutes(
  first: number,
  second: number,
): number {
  const raw = Math.abs(first - second);
  return Math.min(raw, (24 * 60) - raw);
}

function hasAnyActivity(
  factor: Factor,
  activities: readonly PreSleepActivity[],
): boolean {
  return factor.pre_sleep_activities.some((activity) =>
    activities.includes(activity),
  );
}

function getManualOverride(
  checks: readonly SleepHygieneCheck[],
  date: string,
  practiceId: SleepHygienePracticeId,
): SleepHygieneCheck | null {
  return (
    checks.find(
      (check) =>
        check.date === date &&
        check.practice_id === practiceId &&
        check.source === 'manual',
    ) ?? null
  );
}

function getPractice(
  practiceId: SleepHygienePracticeId,
): SleepHygienePractice {
  const practice = SLEEP_HYGIENE_PRACTICES.find(
    (candidate) => candidate.id === practiceId,
  );
  if (!practice) {
    throw new Error(`Unknown sleep hygiene practice: ${practiceId}`);
  }
  return practice;
}

function evaluateAutoPractice(
  practiceId: SleepHygienePracticeId,
  context: EvaluationContext,
): AutoEvaluation {
  const { entry, factor, targetBedtime } = context;

  if (practiceId === 'consistent_bedtime_30m') {
    const bedtime = dateTimeToClockMinutes(entry?.bedtime);
    const target = clockToMinutes(targetBedtime);
    if (bedtime === null || target === null) {
      return {
        status: 'unknown',
        reason: 'Log a bedtime to evaluate consistency.',
      };
    }

    const distance = clockDistanceMinutes(bedtime, target);
    return {
      status: distance <= 30 ? 'met' : 'missed',
      reason:
        distance <= 30
          ? 'Bedtime landed within 30 minutes of target.'
          : `Bedtime was ${distance} minutes away from target.`,
    };
  }

  if (!factor) {
    return {
      status: 'unknown',
      reason: 'Log sleep factors to auto-fill this item.',
    };
  }

  if (practiceId === 'no_caffeine_after_2pm') {
    const caffeineMinutes = clockToMinutes(factor.last_caffeine_time);
    if (factor.pre_sleep_activities.includes('caffeine')) {
      return {
        status: 'missed',
        reason: 'Caffeine was logged as a pre-sleep activity.',
      };
    }
    if (caffeineMinutes === null) {
      return {
        status: 'met',
        reason: 'No late caffeine was logged.',
      };
    }

    return {
      status: caffeineMinutes <= 14 * 60 ? 'met' : 'missed',
      reason:
        caffeineMinutes <= 14 * 60
          ? 'Last caffeine was at or before 2pm.'
          : 'Caffeine was logged after 2pm.',
    };
  }

  if (practiceId === 'no_screens_1h') {
    const screenBuffer = minutesBeforeBed(
      factor.screen_cutoff_time,
      entry?.bedtime,
    );
    if (screenBuffer !== null) {
      return {
        status: screenBuffer >= 60 ? 'met' : 'missed',
        reason:
          screenBuffer >= 60
            ? 'Screen cutoff was at least 1 hour before bed.'
            : 'Screen cutoff was within 1 hour of bed.',
      };
    }

    if (hasAnyActivity(factor, SCREEN_ACTIVITIES)) {
      return {
        status: 'missed',
        reason: 'Screen activity was logged before bed.',
      };
    }

    return {
      status: 'met',
      reason: 'No screen activity was logged before bed.',
    };
  }

  if (practiceId === 'cool_dark_room') {
    if (!factor.room_temp || !factor.room_light) {
      return {
        status: 'unknown',
        reason: 'Log room temperature and light to evaluate the room.',
      };
    }

    const temperatureOk =
      factor.room_temp === 'cool' || factor.room_temp === 'comfortable';
    const lightOk = factor.room_light === 'dark' || factor.room_light === 'dim';
    return {
      status: temperatureOk && lightOk ? 'met' : 'missed',
      reason:
        temperatureOk && lightOk
          ? 'Room was logged as cool and dark enough.'
          : 'Room conditions were not both cool and dark.',
    };
  }

  if (practiceId === 'no_alcohol_3h') {
    if (
      factor.alcohol_drinks > 0 ||
      factor.pre_sleep_activities.includes('alcohol')
    ) {
      return {
        status: 'missed',
        reason: 'Alcohol was logged before bed.',
      };
    }

    return {
      status: 'met',
      reason: 'No alcohol was logged before bed.',
    };
  }

  if (practiceId === 'exercise_timing') {
    if (!factor.exercise_today) {
      return {
        status: 'missed',
        reason: 'No exercise was logged for the day.',
      };
    }

    const exerciseBuffer = minutesBeforeBed(
      factor.exercise_time,
      entry?.bedtime,
    );
    if (exerciseBuffer === null) {
      return {
        status: 'unknown',
        reason: 'Exercise was logged, but the time was not available.',
      };
    }

    return {
      status: exerciseBuffer >= 120 ? 'met' : 'missed',
      reason:
        exerciseBuffer >= 120
          ? 'Exercise ended at least 2 hours before bed.'
          : 'Exercise was within 2 hours of bed.',
    };
  }

  if (practiceId === 'relaxation_routine') {
    const relaxed = hasAnyActivity(factor, RELAXATION_ACTIVITIES);
    return {
      status: relaxed ? 'met' : 'missed',
      reason: relaxed
        ? 'A wind-down activity was logged.'
        : 'No wind-down routine was logged.',
    };
  }

  const mealBuffer = minutesBeforeBed(factor.last_meal_time, entry?.bedtime);
  if (mealBuffer !== null) {
    return {
      status: mealBuffer >= 120 ? 'met' : 'missed',
      reason:
        mealBuffer >= 120
          ? 'Last meal was at least 2 hours before bed.'
          : 'Last meal was within 2 hours of bed.',
    };
  }
  if (factor.pre_sleep_activities.includes('eating')) {
    return {
      status: 'missed',
      reason: 'Eating was logged as a pre-sleep activity.',
    };
  }
  return {
    status: 'met',
    reason: 'No late eating was logged before bed.',
  };
}

export function getEnabledHygienePracticeIds(
  rawValue: string | null | undefined,
): SleepHygienePracticeId[] {
  if (!rawValue) {
    return [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
    }

    const allowed = new Set<string>(SLEEP_HYGIENE_PRACTICE_IDS);
    const selected = parsed.filter(
      (value): value is SleepHygienePracticeId =>
        typeof value === 'string' && allowed.has(value),
    );
    return selected.length > 0
      ? [...new Set(selected)]
      : [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
  } catch {
    return [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
  }
}

export function serializeEnabledHygienePracticeIds(
  practiceIds: readonly SleepHygienePracticeId[],
): string {
  const allowed = new Set<string>(SLEEP_HYGIENE_PRACTICE_IDS);
  const normalized = practiceIds.filter((practiceId, index) =>
    allowed.has(practiceId) && practiceIds.indexOf(practiceId) === index,
  );

  return JSON.stringify(
    normalized.length > 0 ? normalized : DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS,
  );
}

export function buildSleepHygieneChecklist(
  date: string,
  input: SleepHygieneDashboardInput,
): SleepHygieneDailyChecklist {
  const enabledPracticeIds = input.enabledPracticeIds?.length
    ? [...input.enabledPracticeIds]
    : [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
  const entry =
    input.entries.find((candidate) => candidate.date === date) ?? null;
  const factor =
    input.factors.find((candidate) => candidate.date === date) ?? null;
  const checks = input.checks ?? [];
  const targetBedtime = input.targetBedtime ?? TARGET_BEDTIME_DEFAULT;

  const items = enabledPracticeIds.map((practiceId) => {
    const manual = getManualOverride(checks, date, practiceId);
    if (manual) {
      return {
        practice: getPractice(practiceId),
        status: manual.met ? 'met' : 'missed',
        source: 'manual',
        reason: manual.met
          ? 'Checked off manually.'
          : 'Marked missed manually.',
        autoFilled: false,
      } satisfies SleepHygieneChecklistItem;
    }

    const evaluation = evaluateAutoPractice(practiceId, {
      date,
      entry,
      factor,
      targetBedtime,
    });

    return {
      practice: getPractice(practiceId),
      status: evaluation.status,
      source: evaluation.status === 'unknown' ? 'unavailable' : 'auto',
      reason: evaluation.reason,
      autoFilled: evaluation.status !== 'unknown',
    } satisfies SleepHygieneChecklistItem;
  });

  const knownItems = items.filter((item) => item.status !== 'unknown');
  const metCount = knownItems.filter((item) => item.status === 'met').length;
  const score =
    knownItems.length > 0 ? round((metCount / knownItems.length) * 100) : null;

  return {
    date,
    items,
    metCount,
    knownCount: knownItems.length,
    totalCount: items.length,
    score,
    sleepQuality: entry?.quality_rating ?? null,
  };
}

function correlateHygieneWithQuality(
  daily: readonly SleepHygieneDailyChecklist[],
): SleepHygieneQualityCorrelation {
  const scoredDays = daily.filter(
    (day): day is SleepHygieneDailyChecklist & {
      score: number;
      sleepQuality: number;
    } =>
      typeof day.score === 'number' &&
      typeof day.sleepQuality === 'number',
  );
  const high = scoredDays
    .filter((day) => day.score >= HIGH_ADHERENCE_THRESHOLD)
    .map((day) => day.sleepQuality);
  const low = scoredDays
    .filter((day) => day.score < HIGH_ADHERENCE_THRESHOLD)
    .map((day) => day.sleepQuality);

  const averageHigh = average(high);
  const averageLow = average(low);

  if (
    high.length < MIN_CORRELATION_GROUP_SIZE ||
    low.length < MIN_CORRELATION_GROUP_SIZE ||
    averageHigh === null ||
    averageLow === null
  ) {
    return {
      status: 'insufficient_data',
      direction: 'neutral',
      sampleSize: scoredDays.length,
      highAdherenceSampleSize: high.length,
      lowAdherenceSampleSize: low.length,
      averageQualityHighAdherence: averageHigh,
      averageQualityLowAdherence: averageLow,
      qualityDelta: null,
      insight: 'Log several high-adherence and low-adherence nights to compare sleep quality.',
    };
  }

  const qualityDelta = round(averageHigh - averageLow);
  const direction =
    Math.abs(qualityDelta) < REPORTABLE_QUALITY_DELTA
      ? 'neutral'
      : qualityDelta > 0
        ? 'positive'
        : 'negative';

  return {
    status: 'reportable',
    direction,
    sampleSize: scoredDays.length,
    highAdherenceSampleSize: high.length,
    lowAdherenceSampleSize: low.length,
    averageQualityHighAdherence: averageHigh,
    averageQualityLowAdherence: averageLow,
    qualityDelta,
    insight:
      direction === 'neutral'
        ? 'High-adherence and low-adherence nights have similar quality so far.'
        : direction === 'positive'
          ? `High-adherence nights average ${qualityDelta.toFixed(1)} quality points higher.`
          : `High-adherence nights average ${Math.abs(qualityDelta).toFixed(1)} quality points lower.`,
  };
}

export function getSleepHygieneDashboard(
  input: SleepHygieneDashboardInput,
): SleepHygieneDashboard {
  const referenceDate =
    input.referenceDate ??
    input.entries[0]?.date ??
    new Date().toISOString().slice(0, 10);
  const enabledPracticeIds = input.enabledPracticeIds?.length
    ? [...input.enabledPracticeIds]
    : [...DEFAULT_SLEEP_HYGIENE_PRACTICE_IDS];
  const dates = getDateRange(referenceDate, 7);
  const daily = dates.map((date) =>
    buildSleepHygieneChecklist(date, {
      ...input,
      enabledPracticeIds,
      referenceDate,
    }),
  );
  const knownScores = daily
    .map((day) => day.score)
    .filter((score): score is number => typeof score === 'number');

  return {
    referenceDate,
    enabledPracticeIds,
    today:
      daily.find((day) => day.date === referenceDate) ??
      buildSleepHygieneChecklist(referenceDate, {
        ...input,
        enabledPracticeIds,
      }),
    daily,
    weeklyScore: average(knownScores),
    correlation: correlateHygieneWithQuality(daily),
  };
}

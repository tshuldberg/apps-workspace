import {
  PRE_SLEEP_ACTIVITY_TAXONOMY,
  SLEEP_SUPPLEMENT_TAXONOMY,
  type Factor,
  type FactorCreateInput,
  type FactorRoomLight,
  type FactorRoomNoise,
  type FactorRoomTemp,
  type PreSleepActivity,
  type SleepSupplement,
} from '../models/factor-schemas';

export type FactorLogMode = 'tonight' | 'last_night';

export interface FactorOptionMeta<TValue extends string> {
  value: TValue;
  label: string;
  detail: string;
}

export interface StressLevelMeta {
  value: number;
  emoji: string;
  label: string;
  detail: string;
}

export interface FactorLogDraft {
  lastCaffeineTime: string;
  lastMealTime: string;
  alcoholDrinks: number;
  exerciseToday: boolean;
  exerciseTime: string;
  screenCutoffTime: string;
  roomTemp: FactorRoomTemp | null;
  roomLight: FactorRoomLight | null;
  roomNoise: FactorRoomNoise | null;
  supplements: SleepSupplement[];
  stressLevel: number | null;
  preSleepActivities: PreSleepActivity[];
  disturbancesNote: string;
}

const PRE_SLEEP_ACTIVITY_META: Record<
  PreSleepActivity,
  Omit<FactorOptionMeta<PreSleepActivity>, 'value'>
> = {
  screen_time: {
    label: 'Screen time',
    detail: 'Phone, tablet, or laptop close to bed.',
  },
  reading: {
    label: 'Reading',
    detail: 'Books, Kindle, or longer-form reading.',
  },
  meditation: {
    label: 'Meditation',
    detail: 'Breathing, mindfulness, or prayer.',
  },
  exercise: {
    label: 'Exercise',
    detail: 'A workout, walk, or movement session.',
  },
  eating: {
    label: 'Eating',
    detail: 'A meal or snack late in the evening.',
  },
  alcohol: {
    label: 'Alcohol',
    detail: 'Wine, beer, or spirits before bed.',
  },
  caffeine: {
    label: 'Caffeine',
    detail: 'Coffee, tea, soda, or energy drinks.',
  },
  shower: {
    label: 'Shower',
    detail: 'A warm rinse before winding down.',
  },
  bath: {
    label: 'Bath',
    detail: 'A longer soak before bed.',
  },
  music: {
    label: 'Music',
    detail: 'Music, sleep audio, or soundscapes.',
  },
  podcast: {
    label: 'Podcast',
    detail: 'Listening in bed or close to bedtime.',
  },
  tv_show: {
    label: 'TV show',
    detail: 'An episode or series before sleep.',
  },
  movie: {
    label: 'Movie',
    detail: 'A full film or longer video session.',
  },
  sex: {
    label: 'Sex',
    detail: 'Physical intimacy before sleep.',
  },
  argument: {
    label: 'Argument',
    detail: 'Conflict or emotional friction at night.',
  },
  work: {
    label: 'Work',
    detail: 'Emails, planning, or late-night tasks.',
  },
  study: {
    label: 'Study',
    detail: 'Homework, review, or focused learning.',
  },
  social_media: {
    label: 'Social media',
    detail: 'Scrolling feeds or messages before bed.',
  },
  gaming: {
    label: 'Gaming',
    detail: 'Console, mobile, or desktop play.',
  },
  journaling: {
    label: 'Journaling',
    detail: 'Writing or reflection before sleep.',
  },
};

const SLEEP_SUPPLEMENT_META: Record<
  SleepSupplement,
  Omit<FactorOptionMeta<SleepSupplement>, 'value'>
> = {
  melatonin: {
    label: 'Melatonin',
    detail: 'Hormone support for sleep timing.',
  },
  magnesium: {
    label: 'Magnesium',
    detail: 'Mineral support for relaxation.',
  },
  valerian: {
    label: 'Valerian',
    detail: 'Herbal calming support.',
  },
  cbd: {
    label: 'CBD',
    detail: 'Cannabidiol used for wind-down.',
  },
  chamomile: {
    label: 'Chamomile',
    detail: 'Tea or extract for a calmer bedtime.',
  },
  lavender: {
    label: 'Lavender',
    detail: 'Lavender oil, tea, or capsule.',
  },
  zinc: {
    label: 'Zinc',
    detail: 'Mineral supplement taken at night.',
  },
  l_theanine: {
    label: 'L-theanine',
    detail: 'Amino acid used for calmer focus.',
  },
  gaba: {
    label: 'GABA',
    detail: 'Supplement used for relaxation.',
  },
  tryptophan: {
    label: 'Tryptophan',
    detail: 'Amino acid used for sleep support.',
  },
};

const ROOM_TEMP_META: Record<
  FactorRoomTemp,
  Omit<FactorOptionMeta<FactorRoomTemp>, 'value'>
> = {
  cold: {
    label: 'Cold',
    detail: 'Cold enough to feel distracting.',
  },
  cool: {
    label: 'Cool',
    detail: 'A touch cool in a good way.',
  },
  comfortable: {
    label: 'Comfortable',
    detail: 'Neutral and easy to forget about.',
  },
  warm: {
    label: 'Warm',
    detail: 'A little stuffy or heavy.',
  },
  hot: {
    label: 'Hot',
    detail: 'Warm enough to affect sleep.',
  },
};

const ROOM_LIGHT_META: Record<
  FactorRoomLight,
  Omit<FactorOptionMeta<FactorRoomLight>, 'value'>
> = {
  dark: {
    label: 'Dark',
    detail: 'Very low light or blackout dark.',
  },
  dim: {
    label: 'Dim',
    detail: 'Some light, but still restful.',
  },
  moderate: {
    label: 'Moderate',
    detail: 'A noticeable amount of room light.',
  },
  bright: {
    label: 'Bright',
    detail: 'Bright enough to feel disruptive.',
  },
};

const ROOM_NOISE_META: Record<
  FactorRoomNoise,
  Omit<FactorOptionMeta<FactorRoomNoise>, 'value'>
> = {
  silent: {
    label: 'Silent',
    detail: 'Almost no background noise.',
  },
  quiet: {
    label: 'Quiet',
    detail: 'Low, easy-to-ignore sound.',
  },
  moderate: {
    label: 'Moderate',
    detail: 'Noticeable but manageable noise.',
  },
  loud: {
    label: 'Loud',
    detail: 'Noise felt intrusive or disruptive.',
  },
};

export const FACTOR_LOG_MODES = ['tonight', 'last_night'] as const;

export const PRE_SLEEP_ACTIVITY_OPTIONS: FactorOptionMeta<PreSleepActivity>[] =
  PRE_SLEEP_ACTIVITY_TAXONOMY.map((value) => ({
    value,
    ...PRE_SLEEP_ACTIVITY_META[value],
  }));

export const SLEEP_SUPPLEMENT_OPTIONS: FactorOptionMeta<SleepSupplement>[] =
  SLEEP_SUPPLEMENT_TAXONOMY.map((value) => ({
    value,
    ...SLEEP_SUPPLEMENT_META[value],
  }));

const FACTOR_ROOM_TEMP_VALUES = [
  'cold',
  'cool',
  'comfortable',
  'warm',
  'hot',
] as const;

const FACTOR_ROOM_LIGHT_VALUES = [
  'dark',
  'dim',
  'moderate',
  'bright',
] as const;

const FACTOR_ROOM_NOISE_VALUES = [
  'silent',
  'quiet',
  'moderate',
  'loud',
] as const;

export const FACTOR_ROOM_TEMP_OPTIONS: FactorOptionMeta<FactorRoomTemp>[] =
  FACTOR_ROOM_TEMP_VALUES.map((value) => ({
  value,
  ...ROOM_TEMP_META[value],
  }));

export const FACTOR_ROOM_LIGHT_OPTIONS: FactorOptionMeta<FactorRoomLight>[] =
  FACTOR_ROOM_LIGHT_VALUES.map((value) => ({
    value,
    ...ROOM_LIGHT_META[value],
  }));

export const FACTOR_ROOM_NOISE_OPTIONS: FactorOptionMeta<FactorRoomNoise>[] =
  FACTOR_ROOM_NOISE_VALUES.map((value) => ({
    value,
    ...ROOM_NOISE_META[value],
  }));

export const STRESS_LEVEL_OPTIONS: StressLevelMeta[] = [
  {
    value: 1,
    emoji: '😌',
    label: 'Low',
    detail: 'Calm and settled.',
  },
  {
    value: 2,
    emoji: '🙂',
    label: 'Light',
    detail: 'A little tension, still manageable.',
  },
  {
    value: 3,
    emoji: '😐',
    label: 'Medium',
    detail: 'A normal, noticeable stress load.',
  },
  {
    value: 4,
    emoji: '😣',
    label: 'High',
    detail: 'Stress was active in the background.',
  },
  {
    value: 5,
    emoji: '😵',
    label: 'Very high',
    detail: 'Stress felt hard to shut off.',
  },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function normalizeClockTime(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNote(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed : null;
}

export function isFactorLogMode(value: string): value is FactorLogMode {
  return FACTOR_LOG_MODES.includes(value as FactorLogMode);
}

export function getDefaultFactorLogMode(
  now = new Date(),
): FactorLogMode {
  return now.getHours() >= 15 ? 'tonight' : 'last_night';
}

export function resolveFactorLogDate(
  mode: FactorLogMode,
  now = new Date(),
): string {
  const target = new Date(now);
  target.setHours(12, 0, 0, 0);

  if (mode === 'tonight') {
    target.setDate(target.getDate() + 1);
  }

  return formatLocalDate(target);
}

export function createEmptyFactorLogDraft(): FactorLogDraft {
  return {
    lastCaffeineTime: '',
    lastMealTime: '',
    alcoholDrinks: 0,
    exerciseToday: false,
    exerciseTime: '',
    screenCutoffTime: '',
    roomTemp: null,
    roomLight: null,
    roomNoise: null,
    supplements: [],
    stressLevel: null,
    preSleepActivities: [],
    disturbancesNote: '',
  };
}

export function getFactorLogDraftFromFactor(
  factor: Factor | null | undefined,
): FactorLogDraft {
  if (!factor) {
    return createEmptyFactorLogDraft();
  }

  return {
    lastCaffeineTime: factor.last_caffeine_time ?? '',
    lastMealTime: factor.last_meal_time ?? '',
    alcoholDrinks: factor.alcohol_drinks,
    exerciseToday: factor.exercise_today,
    exerciseTime: factor.exercise_time ?? '',
    screenCutoffTime: factor.screen_cutoff_time ?? '',
    roomTemp: factor.room_temp,
    roomLight: factor.room_light,
    roomNoise: factor.room_noise,
    supplements: factor.supplements,
    stressLevel: factor.stress_level,
    preSleepActivities: factor.pre_sleep_activities,
    disturbancesNote: factor.notes ?? '',
  };
}

export function buildFactorCreateInput(
  draft: FactorLogDraft,
  options: {
    date?: string;
    mode?: FactorLogMode;
    now?: Date;
    sleepEntryId?: string | null;
  } = {},
): FactorCreateInput {
  const date = options.date
    ?? resolveFactorLogDate(options.mode ?? 'last_night', options.now);

  return {
    ...(options.sleepEntryId ? { sleep_entry_id: options.sleepEntryId } : {}),
    date,
    last_caffeine_time: normalizeClockTime(draft.lastCaffeineTime),
    last_meal_time: normalizeClockTime(draft.lastMealTime),
    alcohol_drinks: draft.alcoholDrinks,
    exercise_today: draft.exerciseToday,
    exercise_time: draft.exerciseToday
      ? normalizeClockTime(draft.exerciseTime)
      : null,
    screen_cutoff_time: normalizeClockTime(draft.screenCutoffTime),
    room_temp: draft.roomTemp,
    room_light: draft.roomLight,
    room_noise: draft.roomNoise,
    supplements: draft.supplements,
    stress_level: draft.stressLevel,
    pre_sleep_activities: draft.preSleepActivities,
    notes: normalizeNote(draft.disturbancesNote),
  };
}

export function formatFactorClockTime(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const [rawHours, rawMinutes] = value.split(':').map(Number);
  const period = rawHours >= 12 ? 'PM' : 'AM';
  const hours12 = rawHours % 12 || 12;
  return `${hours12}:${pad(rawMinutes)} ${period}`;
}

export function getPreSleepActivityMeta(
  value: PreSleepActivity,
): FactorOptionMeta<PreSleepActivity> {
  return {
    value,
    ...PRE_SLEEP_ACTIVITY_META[value],
  };
}

export function getSleepSupplementMeta(
  value: SleepSupplement,
): FactorOptionMeta<SleepSupplement> {
  return {
    value,
    ...SLEEP_SUPPLEMENT_META[value],
  };
}

export function getFactorRoomTempMeta(
  value: FactorRoomTemp,
): FactorOptionMeta<FactorRoomTemp> {
  return {
    value,
    ...ROOM_TEMP_META[value],
  };
}

export function getFactorRoomLightMeta(
  value: FactorRoomLight,
): FactorOptionMeta<FactorRoomLight> {
  return {
    value,
    ...ROOM_LIGHT_META[value],
  };
}

export function getFactorRoomNoiseMeta(
  value: FactorRoomNoise,
): FactorOptionMeta<FactorRoomNoise> {
  return {
    value,
    ...ROOM_NOISE_META[value],
  };
}

export function getStressLevelMeta(
  value: number | null | undefined,
): StressLevelMeta | null {
  if (value == null) {
    return null;
  }

  return STRESS_LEVEL_OPTIONS.find((option) => option.value === value) ?? null;
}

import {
  ADDITIONAL_INTERACTIONS,
  type DiaryEntryDetail,
  type InteractionWarning,
} from '@mylife/meds';

export type WizardStepKey =
  | 'drug'
  | 'schedule'
  | 'reminders'
  | 'refills'
  | 'interactions'
  | 'review';

export type FrequencyPresetKey =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'every_x_hours'
  | 'as_needed'
  | 'weekly';

export type DiaryFilterKey =
  | 'all'
  | 'side_effects'
  | 'missed_doses'
  | 'high_rated'
  | 'low_rated';

export const WIZARD_STEPS: Array<{ key: WizardStepKey; label: string }> = [
  { key: 'drug', label: 'Drug' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'refills', label: 'Refills' },
  { key: 'interactions', label: 'Safety' },
  { key: 'review', label: 'Review' },
];

export const FORM_OPTIONS = [
  'Tablet',
  'Capsule',
  'Liquid',
  'Injection',
  'Patch',
  'Inhaler',
  'Drops',
] as const;

export const ROUTE_OPTIONS = [
  'Oral',
  'Injectable',
  'Topical',
  'Inhaled',
  'Sublingual',
] as const;

export const REMINDER_OFFSETS = ['On time', '15 min before', '30 min before', '1 hour before'];
export const REMINDER_SOUNDS = ['Soft chime', 'Clinical pulse', 'Warm bell', 'Silent'];
export const SNOOZE_OPTIONS = ['5 min', '10 min', '15 min', '30 min'];
export const SIDE_EFFECT_LIBRARY = [
  'Dry mouth',
  'Headache',
  'Nausea',
  'Fatigue',
  'Dizziness',
  'Brain fog',
  'Stomach pain',
  'Appetite change',
];

const COMMON_DRUG_LIBRARY = [
  'Lisinopril',
  'Atorvastatin',
  'Metformin',
  'Warfarin',
  'Aspirin',
  'Ibuprofen',
  'Sertraline',
  'Fluoxetine',
  'Levothyroxine',
  'Amiodarone',
  'Spironolactone',
  'Losartan',
  'Amlodipine',
  'Clopidogrel',
  'Omeprazole',
  'Prednisone',
  'Insulin',
  'Gabapentin',
  'Tramadol',
  'Hydrochlorothiazide',
] as const;

function titleCaseWord(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export const DRUG_AUTOCOMPLETE_OPTIONS = Array.from(
  new Set([
    ...COMMON_DRUG_LIBRARY,
    ...ADDITIONAL_INTERACTIONS.flatMap((entry) => [
      titleCaseWord(entry.drugA),
      titleCaseWord(entry.drugB),
    ]),
  ]),
).sort((a, b) => a.localeCompare(b));

export const FREQUENCY_PRESETS: Record<
  FrequencyPresetKey,
  { label: string; medFrequency: 'daily' | 'twice_daily' | 'weekly' | 'as_needed' | 'custom'; slots: number }
> = {
  once_daily: { label: 'Once Daily', medFrequency: 'daily', slots: 1 },
  twice_daily: { label: 'Twice Daily', medFrequency: 'twice_daily', slots: 2 },
  three_times_daily: { label: '3x Daily', medFrequency: 'custom', slots: 3 },
  four_times_daily: { label: '4x Daily', medFrequency: 'custom', slots: 4 },
  every_x_hours: { label: 'Every X Hours', medFrequency: 'custom', slots: 4 },
  as_needed: { label: 'As Needed', medFrequency: 'as_needed', slots: 0 },
  weekly: { label: 'Weekly', medFrequency: 'weekly', slots: 1 },
};

export function getAutocompleteSuggestions(query: string, selectedName?: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return DRUG_AUTOCOMPLETE_OPTIONS.slice(0, 8);
  }

  return DRUG_AUTOCOMPLETE_OPTIONS
    .filter((option) => option.toLowerCase().includes(normalized))
    .filter((option) => option !== selectedName)
    .slice(0, 8);
}

export function buildTimeSlots(
  preset: FrequencyPresetKey,
  intervalHours: number,
  existingSlots: string[],
): string[] {
  const config = FREQUENCY_PRESETS[preset];
  if (config.slots === 0) {
    return [];
  }

  if (existingSlots.length === config.slots && existingSlots.every(Boolean)) {
    return existingSlots;
  }

  if (preset === 'every_x_hours') {
    const safeInterval = Math.max(2, Math.min(12, intervalHours));
    return Array.from({ length: config.slots }, (_, index) => {
      const hour = (8 + index * safeInterval) % 24;
      return `${String(hour).padStart(2, '0')}:00`;
    });
  }

  const defaults: Record<FrequencyPresetKey, string[]> = {
    once_daily: ['08:00'],
    twice_daily: ['08:00', '20:00'],
    three_times_daily: ['08:00', '13:00', '20:00'],
    four_times_daily: ['06:00', '12:00', '18:00', '22:00'],
    every_x_hours: ['08:00', '12:00', '16:00', '20:00'],
    as_needed: [],
    weekly: ['09:00'],
  };

  return defaults[preset];
}

export function normalizeTimeLabel(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const [hours, minutes] = trimmed.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function getRefillStatusMeta(daysRemaining: number | null): {
  label: string;
  color: string;
  progress: number;
} {
  if (daysRemaining === null) {
    return { label: 'Untracked', color: '#9F8E81', progress: 0.12 };
  }
  if (!Number.isFinite(daysRemaining)) {
    return { label: 'As Needed', color: '#8BCFF0', progress: 0.82 };
  }
  if (daysRemaining <= 0) {
    return { label: 'Overdue', color: '#FF453A', progress: 1 };
  }
  if (daysRemaining <= 3) {
    return { label: 'Due', color: '#FFB4AB', progress: 0.92 };
  }
  if (daysRemaining <= 7) {
    return { label: 'Low', color: '#FFB877', progress: 0.7 };
  }

  return {
    label: 'OK',
    color: '#30D158',
    progress: Math.min(0.55, daysRemaining / 60),
  };
}

export function buildSeverityRecommendation(severity: InteractionWarning['severity']): string {
  switch (severity) {
    case 'severe':
      return 'Contact your pharmacist or prescriber before combining these medications.';
    case 'moderate':
      return 'Monitor symptoms closely and confirm the plan with your care team.';
    default:
      return 'Keep the combination on your radar and review it during the next refill.';
  }
}

export function groupInteractionsBySeverity<
  T extends { severity: InteractionWarning['severity'] }
>(
  warnings: T[],
): Record<InteractionWarning['severity'], T[]> {
  return {
    severe: warnings.filter((warning) => warning.severity === 'severe'),
    moderate: warnings.filter((warning) => warning.severity === 'moderate'),
    mild: warnings.filter((warning) => warning.severity === 'mild'),
  };
}

export function filterDiaryEntries(
  entries: DiaryEntryDetail[],
  filter: DiaryFilterKey,
  query: string,
): DiaryEntryDetail[] {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filter === 'side_effects' && entry.sideEffects.length === 0) {
      return false;
    }
    if (filter === 'missed_doses' && entry.doseStatus !== 'skipped') {
      return false;
    }
    if (filter === 'high_rated' && entry.effectiveness < 4) {
      return false;
    }
    if (filter === 'low_rated' && entry.effectiveness > 2) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    const haystack = [
      entry.medicationName,
      entry.notes ?? '',
      entry.mood ?? '',
      ...entry.sideEffects,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function groupDiaryEntriesByDate(entries: DiaryEntryDetail[]): Array<{
  key: string;
  label: string;
  entries: DiaryEntryDetail[];
}> {
  const byDate = new Map<string, DiaryEntryDetail[]>();

  for (const entry of entries) {
    const key = entry.recordedAt.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(entry);
    byDate.set(key, list);
  }

  return Array.from(byDate.entries()).map(([key, grouped]) => ({
    key,
    label: new Date(`${key}T12:00:00`).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }),
    entries: grouped.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
  }));
}

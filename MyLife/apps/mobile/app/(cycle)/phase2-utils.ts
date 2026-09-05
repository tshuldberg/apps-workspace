import type { DatabaseAdapter } from '@mylife/db';
import {
  getCycleDaysByCycle,
  getCurrentPhase,
  getSymptomsForDay,
  type Cycle,
  type CyclePhase,
  type FlowLevel,
  type SymptomPhaseEntry,
} from '@mylife/cycle';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const FEELING_TAG = /^\[\[mylife-feeling:(\d)\]\]\n?/;

export const PHASE_ORDER: CyclePhase[] = [
  'menstrual',
  'follicular',
  'ovulation',
  'luteal',
];

export const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
};

export const FEELING_OPTIONS = [
  { value: 1, emoji: '😣', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Steady' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😊', label: 'Great' },
] as const;

export type FeelingValue = (typeof FEELING_OPTIONS)[number]['value'];

export function isIsoDateParam(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addIsoDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetweenIso(start: string, end: string): number {
  return Math.round(
    (parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) /
      86400000,
  );
}

export function formatMonthDay(iso: string | null | undefined): string {
  if (!iso) return '--';
  const date = parseIsoDate(iso);
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatMonthDayYear(iso: string | null | undefined): string {
  if (!iso) return '--';
  const date = parseIsoDate(iso);
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatLongDate(iso: string): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAYS_LONG[date.getUTCDay()]}, ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatSymptomLabel(symptom: string): string {
  return symptom.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatPhaseLabel(phase: CyclePhase): string {
  return PHASE_LABELS[phase];
}

export function formatFlowLabel(
  flow: FlowLevel | 'none' | null | undefined,
): string {
  if (!flow || flow === 'none') return 'None';
  return formatSymptomLabel(flow);
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function buildSymptomPhaseEntries(
  db: DatabaseAdapter,
  cycles: Cycle[],
  fallbackCycleLength: number,
): SymptomPhaseEntry[] {
  const entries: SymptomPhaseEntry[] = [];

  for (const cycle of cycles) {
    const cycleDays = getCycleDaysByCycle(db, cycle.id, 400);
    const cycleLength = cycle.lengthDays ?? fallbackCycleLength;

    for (const cycleDay of cycleDays) {
      const phase =
        cycleDay.phase ??
        getCurrentPhase(cycle.startDate, cycleDay.date, cycleLength);
      const symptoms = getSymptomsForDay(db, cycleDay.id, 100);

      for (const symptom of symptoms) {
        if (symptom.category === 'other') continue;
        entries.push({
          symptom: symptom.symptom,
          category: symptom.category,
          phase,
        });
      }
    }
  }

  return entries;
}

export function decodeCycleLogNotes(notes: string | null | undefined): {
  journal: string;
  overallFeeling: FeelingValue | null;
} {
  if (!notes) {
    return { journal: '', overallFeeling: null };
  }

  const match = notes.match(FEELING_TAG);
  if (!match) {
    return { journal: notes, overallFeeling: null };
  }

  const parsed = Number(match[1]);
  const overallFeeling =
    parsed >= 1 && parsed <= 5 ? (parsed as FeelingValue) : null;

  return {
    journal: notes.replace(FEELING_TAG, ''),
    overallFeeling,
  };
}

export function encodeCycleLogNotes(
  journal: string,
  overallFeeling: FeelingValue | null,
): string | undefined {
  const normalizedJournal = journal.trim();

  if (overallFeeling == null) {
    return normalizedJournal || undefined;
  }

  const prefix = `[[mylife-feeling:${overallFeeling}]]`;
  return normalizedJournal ? `${prefix}\n${normalizedJournal}` : prefix;
}

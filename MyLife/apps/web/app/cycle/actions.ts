'use server';

import { getPreference, setPreference } from '@mylife/db';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  PHYSICAL_SYMPTOMS,
  MOOD_SYMPTOMS,
  addSymptom,
  analyzeSymptomsByPhase,
  analyzeTemperatures,
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  completeAppointment,
  createAppointment,
  createCycle,
  createCycleDay,
  createPartnerLink,
  createPregnancyConfig,
  deleteAppointment,
  deleteCycle,
  deleteCycleDay,
  deleteSymptom,
  deleteTemperature,
  detectCycleTrend,
  endCycle,
  endPregnancy,
  formatWeekDisplay,
  generateCycleInsights,
  generateSharedView,
  getActivePartnerLink,
  getActivePregnancy,
  getAppointmentsByPregnancy,
  getCurrentPhase,
  getCurrentTrimester,
  getCurrentWeek,
  getCycleDayByDate,
  getCycleDaysByCycle,
  getCycleStats,
  getCycles,
  getDaysUntilDue,
  getPregnancyHistory,
  getPregnancyWeekInfo,
  getSymptomsForDay,
  getSymptomFrequencies,
  getTemperatureByDate,
  getTemperaturesByDateRange,
  getUpcomingAppointments,
  isLateByDays,
  predictNextPeriod,
  revokePartnerLink,
  updateAppointment,
  updateCycleDay,
  updateDueDate,
  updatePartnerLink,
  upsertTemperature,
  type CreateAppointmentInput,
  type CreateCycleDayRawInput,
  type CreateCycleInput,
  type CreatePartnerLinkRawInput,
  type CreatePregnancyInput,
  type CreateTemperatureRawInput,
  type Cycle,
  type CycleDay,
  type CyclePhase,
  type FlowLevel,
  type TemperatureUnit,
  type UpdateAppointmentInput,
  type UpdateCycleDayInput,
  type UpdatePartnerLinkInput,
} from '@mylife/cycle';
import {
  addIsoDays,
  clampPercent,
  daysBetweenIso,
  decodeCycleLogNotes,
  encodeCycleLogNotes,
  formatLongDate,
  formatMonthDay,
  formatMonthDayYear,
  formatPhaseLabel,
  formatSymptomLabel,
  parseIsoDate,
} from './utils';

type CalendarMark = 'menstrual' | 'fertile' | 'ovulation' | 'predicted' | null;
type TrackingMode = 'adaptive' | 'manual';

const DEFAULT_CYCLE_LENGTH = 28;
const DEFAULT_PERIOD_LENGTH = 5;
const MAX_HISTORY_ROWS = 50;

const PREFERENCE_KEYS = {
  defaultCycleLength: 'cycle.default_cycle_length',
  defaultPeriodLength: 'cycle.default_period_length',
  trackingMode: 'cycle.tracking_mode',
  temperatureUnit: 'cycle.temperature_unit',
  predictionsEnabled: 'cycle.predictions_enabled',
  periodReminder: 'cycle.period_reminder',
  fertileAlerts: 'cycle.fertile_alerts',
} as const;

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('cycle');
  return adapter;
}

function readBooleanPreference(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function readNumberPreference(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readTrackingModePreference(raw: string | undefined): TrackingMode {
  return raw === 'manual' ? 'manual' : 'adaptive';
}

function readTemperatureUnitPreference(adapter: ReturnType<typeof db>): TemperatureUnit {
  const raw = getPreference(adapter, PREFERENCE_KEYS.temperatureUnit);
  return raw === 'celsius' ? 'celsius' : 'fahrenheit';
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function createSymptomPhaseEntries(
  adapter: ReturnType<typeof db>,
  cycles: Cycle[],
  fallbackCycleLength: number,
) {
  const entries: Array<{ symptom: string; category: string; phase: CyclePhase }> = [];

  for (const cycle of cycles) {
    const cycleDays = getCycleDaysByCycle(adapter, cycle.id, 400);
    const cycleLength = cycle.lengthDays ?? fallbackCycleLength;

    for (const cycleDay of cycleDays) {
      const phase =
        cycleDay.phase ??
        getCurrentPhase(cycle.startDate, cycleDay.date, cycleLength);
      const symptoms = getSymptomsForDay(adapter, cycleDay.id, 120);

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

function formatHistoryRange(start: string, end: string | null): string {
  if (!end) {
    return `${formatLongDate(start)} – ongoing`;
  }

  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  return `${startDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })} – ${endDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })}`;
}

function getUpcomingPhase(
  today: string,
  prediction: Awaited<ReturnType<typeof fetchPrediction>>,
  currentPhase: CyclePhase | null,
): CyclePhase {
  if (!prediction) return currentPhase ?? 'menstrual';

  const daysToPeriod = prediction.daysUntilNextPeriod;
  const daysToFertile = prediction.fertileWindowStart
    ? daysBetweenIso(today, prediction.fertileWindowStart)
    : Number.POSITIVE_INFINITY;

  if (daysToFertile >= 0 && daysToFertile < daysToPeriod) {
    return 'ovulation';
  }
  if (daysToPeriod <= 5) {
    return 'menstrual';
  }
  return currentPhase ?? 'luteal';
}

function buildFertileBars(prediction: NonNullable<Awaited<ReturnType<typeof fetchPrediction>>>) {
  if (!prediction.fertileWindowStart) return [];
  return [0, 1, 2, 3, 4].map((offset) => ({
    date: addIsoDays(prediction.fertileWindowStart!, offset),
    intensity: [0.35, 0.62, 0.9, 1, 0.55][offset] ?? 0.4,
    isPeak: offset === 3,
  }));
}

function buildHeroLabel(
  prediction: NonNullable<Awaited<ReturnType<typeof fetchPrediction>>>,
  lateByDays: number,
): string {
  if (lateByDays > 0) {
    return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • ${lateByDays} day${lateByDays === 1 ? '' : 's'} late`;
  }
  if (prediction.daysUntilNextPeriod <= 0) {
    return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • expected now`;
  }
  return `Estimated ${formatMonthDayYear(prediction.predictedStartDate)} • in ${prediction.daysUntilNextPeriod} day${prediction.daysUntilNextPeriod === 1 ? '' : 's'}`;
}

function celsiusToDisplay(valueCelsius: number, unit: TemperatureUnit): number {
  if (unit === 'celsius') {
    return Math.round(valueCelsius * 10) / 10;
  }
  return Math.round((valueCelsius * 9 / 5 + 32) * 10) / 10;
}

function isoDate(year: number, month: number, day: number): string {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1));
}

function classifyCalendarDate(
  iso: string,
  cycles: Cycle[],
  averageCycleLength: number,
  averagePeriodLength: number,
  lastCycle: Cycle | null,
  cycleLengths: number[],
  periodLengths: number[],
  today: string,
): CalendarMark {
  const target = parseIsoDate(iso).getTime();

  for (const cycle of cycles) {
    const start = parseIsoDate(cycle.startDate).getTime();
    const end = cycle.endDate ? parseIsoDate(cycle.endDate).getTime() : null;

    const periodLength = cycle.periodLength ?? Math.round(averagePeriodLength);
    const menstrualEnd = parseIsoDate(cycle.startDate);
    menstrualEnd.setUTCDate(menstrualEnd.getUTCDate() + Math.max(0, periodLength - 1));

    if (target >= start && target <= menstrualEnd.getTime()) {
      return 'menstrual';
    }

    const cycleLength = cycle.lengthDays ?? Math.round(averageCycleLength);
    const ovulationDay = addIsoDays(cycle.startDate, cycleLength - 14);
    const fertileStart = addIsoDays(ovulationDay, -3);
    const fertileEnd = addIsoDays(ovulationDay, 1);

    if (end !== null && target > end) continue;

    const ovulationTime = parseIsoDate(ovulationDay).getTime();
    const fertileStartTime = parseIsoDate(fertileStart).getTime();
    const fertileEndTime = parseIsoDate(fertileEnd).getTime();

    if (target === ovulationTime) return 'ovulation';
    if (target >= fertileStartTime && target <= fertileEndTime) return 'fertile';
  }

  if (lastCycle && cycleLengths.length >= 2) {
    const prediction = predictNextPeriod(
      lastCycle.startDate,
      cycleLengths,
      periodLengths,
      today,
    );

    if (prediction) {
      const predictedStart = parseIsoDate(prediction.predictedStartDate).getTime();
      const predictedEnd = parseIsoDate(prediction.predictedEndDate).getTime();

      if (target >= predictedStart && target <= predictedEnd) {
        return 'predicted';
      }

      if (prediction.fertileWindowStart && prediction.fertileWindowEnd) {
        const fertileStart = parseIsoDate(prediction.fertileWindowStart).getTime();
        const fertileEnd = parseIsoDate(prediction.fertileWindowEnd).getTime();
        const ovulationDay = addIsoDays(lastCycle.startDate, Math.round(averageCycleLength) - 14);
        const ovulationTime = parseIsoDate(ovulationDay).getTime();

        if (target === ovulationTime && target > parseIsoDate(lastCycle.startDate).getTime()) {
          return 'ovulation';
        }
        if (target >= fertileStart && target <= fertileEnd) {
          return 'fertile';
        }
      }
    }
  }

  return null;
}

function summarizeLoggedDay(
  adapter: ReturnType<typeof db>,
  cycleDay: CycleDay | null,
) {
  if (!cycleDay) return null;
  const symptoms = getSymptomsForDay(adapter, cycleDay.id, 80);
  const decoded = decodeCycleLogNotes(cycleDay.notes);

  return {
    id: cycleDay.id,
    date: cycleDay.date,
    phase: cycleDay.phase,
    flowLevel: cycleDay.flowLevel,
    journal: decoded.journal,
    overallFeeling: decoded.overallFeeling,
    symptoms: symptoms.map((symptom) => ({
      id: symptom.id,
      symptom: symptom.symptom,
      category: symptom.category,
      intensity: symptom.intensity,
    })),
  };
}

// ── Cycles ───────────────────────────────────────────────────────────

export async function fetchCycles(limit = 50, offset = 0) {
  return getCycles(db(), limit, offset);
}

export async function doCreateCycle(input: CreateCycleInput) {
  return createCycle(db(), crypto.randomUUID(), input);
}

export async function doEndCycle(cycleId: string, nextStartDate: string) {
  return endCycle(db(), cycleId, nextStartDate);
}

export async function doDeleteCycle(id: string) {
  return deleteCycle(db(), id);
}

// ── Cycle Days ───────────────────────────────────────────────────────

export async function fetchCycleDayByDate(date: string) {
  return getCycleDayByDate(db(), date);
}

export async function fetchCycleDaysByCycle(cycleId: string) {
  return getCycleDaysByCycle(db(), cycleId);
}

export async function doCreateCycleDay(input: CreateCycleDayRawInput) {
  return createCycleDay(db(), crypto.randomUUID(), input);
}

export async function doUpdateCycleDay(id: string, input: UpdateCycleDayInput) {
  return updateCycleDay(db(), id, input);
}

export async function doDeleteCycleDay(id: string) {
  return deleteCycleDay(db(), id);
}

export async function fetchCycleDayBundle(date: string) {
  const adapter = db();
  const cycleDay = getCycleDayByDate(adapter, date);
  const daySummary = summarizeLoggedDay(adapter, cycleDay);
  const temperature = getTemperatureByDate(adapter, date);
  return {
    date,
    day: daySummary,
    temperature,
    temperatureUnit: readTemperatureUnitPreference(adapter),
  };
}

export async function saveCycleLogEntry(input: {
  date: string;
  flowLevel?: FlowLevel | null;
  journal?: string;
  overallFeeling?: number | null;
  symptoms: string[];
}) {
  const adapter = db();
  const current = getCycleDayByDate(adapter, input.date);
  const encodedNotes = encodeCycleLogNotes(
    input.journal ?? '',
    input.overallFeeling != null && input.overallFeeling >= 1 && input.overallFeeling <= 5
      ? (input.overallFeeling as 1 | 2 | 3 | 4 | 5)
      : null,
  );

  const physicalSet = new Set(PHYSICAL_SYMPTOMS as readonly string[]);
  const moodSet = new Set(MOOD_SYMPTOMS as readonly string[]);

  let saved = current;
  if (!saved) {
    saved = createCycleDay(adapter, crypto.randomUUID(), {
      date: input.date,
      flowLevel: input.flowLevel ?? undefined,
      notes: encodedNotes,
      symptoms: [],
    });
  } else {
    saved = updateCycleDay(adapter, saved.id, {
      flowLevel: input.flowLevel ?? null,
      notes: encodedNotes ?? null,
    });
  }

  if (!saved) {
    throw new Error('Unable to save cycle log entry');
  }

  const existingSymptoms = getSymptomsForDay(adapter, saved.id, 120);
  const incoming = new Set(input.symptoms);

  for (const symptom of existingSymptoms) {
    if (!incoming.has(symptom.symptom)) {
      deleteSymptom(adapter, symptom.id);
    }
  }

  for (const symptom of incoming) {
    if (existingSymptoms.some((entry) => entry.symptom === symptom)) {
      continue;
    }

    const category = physicalSet.has(symptom)
      ? 'physical'
      : moodSet.has(symptom)
        ? 'mood'
        : 'other';

    addSymptom(
      adapter,
      crypto.randomUUID(),
      saved.id,
      category,
      symptom,
      'moderate',
    );
  }

  return fetchCycleDayBundle(input.date);
}

// ── Symptoms ─────────────────────────────────────────────────────────

export async function fetchSymptomsForDay(cycleDayId: string) {
  return getSymptomsForDay(db(), cycleDayId);
}

export async function doAddSymptom(
  cycleDayId: string,
  category: string,
  symptom: string,
  intensity = 'moderate',
) {
  return addSymptom(db(), crypto.randomUUID(), cycleDayId, category, symptom, intensity);
}

export async function doDeleteSymptom(id: string) {
  return deleteSymptom(db(), id);
}

// ── Analytics ────────────────────────────────────────────────────────

export async function fetchCycleStats() {
  return getCycleStats(db());
}

export async function fetchSymptomFrequencies(limit = 20) {
  return getSymptomFrequencies(db(), limit);
}

export async function fetchCycleHistoryBundle() {
  const adapter = db();
  const stats = getCycleStats(adapter);
  const cycles = getCycles(adapter, MAX_HISTORY_ROWS);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null)
    .reverse();
  const trend = detectCycleTrend(cycleLengths);

  const rows = cycles.map((cycle, index) => {
    const symptomCount = getCycleDaysByCycle(adapter, cycle.id, 60).reduce(
      (count, cycleDay) => count + getSymptomsForDay(adapter, cycleDay.id).length,
      0,
    );

    const startDate = parseIsoDate(cycle.startDate);
    const regularityLabel =
      cycle.lengthDays != null && stats.averageCycleLength != null
        ? Math.abs(cycle.lengthDays - stats.averageCycleLength) <= 2
          ? 'Regular'
          : cycle.lengthDays > stats.averageCycleLength
            ? 'Long'
            : 'Short'
        : 'New';

    return {
      id: cycle.id,
      index: cycles.length - index,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      lengthDays: cycle.lengthDays,
      periodLength: cycle.periodLength,
      symptomCount,
      dateRange: formatHistoryRange(cycle.startDate, cycle.endDate),
      monthLabel: startDate.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      }).toUpperCase(),
      dayLabel: String(startDate.getUTCDate()),
      lengthLabel: cycle.lengthDays ? `${cycle.lengthDays} DAYS` : 'ONGOING',
      flowLabel: cycle.periodLength ? `${cycle.periodLength} days period` : 'Period open',
      regularityLabel,
    };
  });

  return {
    stats,
    regularity: trend.regularity,
    trend,
    totalCycles: cycles.length,
    rows,
  };
}

export async function fetchCycleAnalyticsBundle() {
  const adapter = db();
  const cycles = getCycles(adapter, MAX_HISTORY_ROWS);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const averageLength = calculateAverageCycleLength(cycleLengths);
  const stats = getCycleStats(adapter);
  const entries = createSymptomPhaseEntries(
    adapter,
    cycles,
    Math.round(averageLength ?? DEFAULT_CYCLE_LENGTH),
  );
  const patterns = analyzeSymptomsByPhase(entries, 2);
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));
  const frequencies = getSymptomFrequencies(adapter, 16);
  const maxCount = frequencies[0]?.count ?? 1;

  const symptomRows = frequencies.slice(0, 8).map((item) => ({
    symptom: item.symptom,
    count: item.count,
    percentage: Math.round((item.count / maxCount) * 100),
    color:
      {
        menstrual: '#EF4444',
        follicular: '#FBCFE8',
        ovulation: '#F472B6',
        luteal: '#FDA4AF',
      }[patternMap.get(item.symptom)?.dominantPhase ?? 'ovulation'],
  }));

  const buckets = new Map<number, number>();
  for (let day = 21; day <= 40; day += 1) {
    buckets.set(day, 0);
  }
  for (const length of cycleLengths) {
    const clamped = Math.max(21, Math.min(40, Math.round(length)));
    buckets.set(clamped, (buckets.get(clamped) ?? 0) + 1);
  }

  const flowCounts: Record<FlowLevel, number> = {
    spotting: 0,
    light: 0,
    medium: 0,
    heavy: 0,
  };

  for (const cycle of cycles) {
    const days = getCycleDaysByCycle(adapter, cycle.id, 400);
    for (const day of days) {
      if (!day.flowLevel) continue;
      flowCounts[day.flowLevel] += 1;
    }
  }

  const totalFlowDays = Object.values(flowCounts).reduce((sum, count) => sum + count, 0);
  const flowRows = [
    {
      key: 'spotting',
      label: 'Spotting',
      count: flowCounts.spotting,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.spotting / totalFlowDays) * 100),
      color: '#FCA5A5',
    },
    {
      key: 'light',
      label: 'Light',
      count: flowCounts.light,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.light / totalFlowDays) * 100),
      color: '#FDA4AF',
    },
    {
      key: 'medium',
      label: 'Medium',
      count: flowCounts.medium,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.medium / totalFlowDays) * 100),
      color: '#F472B6',
    },
    {
      key: 'heavy',
      label: 'Heavy',
      count: flowCounts.heavy,
      percentage: totalFlowDays === 0 ? 0 : Math.round((flowCounts.heavy / totalFlowDays) * 100),
      color: '#EF4444',
    },
  ];

  const statusLabel =
    stats.cycleLengthStdDev == null
      ? 'Building your baseline'
      : stats.cycleLengthStdDev <= 2
        ? 'Highly regular'
        : stats.cycleLengthStdDev <= 4
          ? 'Moderately variable'
          : 'Wide variation';

  return {
    trackedCycles: cycles.length,
    averageLength,
    stdDev: stats.cycleLengthStdDev,
    statusLabel,
    symptomRows,
    histogram: [...buckets.entries()].map(([label, count]) => ({
      label: String(label),
      count,
    })),
    flowRows,
  };
}

// ── Prediction ───────────────────────────────────────────────────────

export async function fetchPrediction() {
  const adapter = db();
  const cycles = getCycles(adapter, 12);
  if (cycles.length < 2) return null;

  const today = getTodayIso();
  const lastCycle = cycles[0];

  const completedCycles = cycles.filter((cycle) => cycle.lengthDays !== null);
  const cycleLengths = completedCycles.map((cycle) => cycle.lengthDays!);
  const periodLengths = completedCycles
    .filter((cycle) => cycle.periodLength !== null)
    .map((cycle) => cycle.periodLength!);

  const startDate = lastCycle.endDate ? lastCycle.endDate : lastCycle.startDate;
  return predictNextPeriod(startDate, cycleLengths, periodLengths, today);
}

export async function fetchCurrentPhase() {
  const adapter = db();
  const cycles = getCycles(adapter, 1);
  if (cycles.length === 0) return null;

  const current = cycles[0];
  if (current.endDate) return null;

  const today = getTodayIso();
  const stats = getCycleStats(adapter);
  const averageCycleLength = stats.averageCycleLength ?? DEFAULT_CYCLE_LENGTH;
  const phase = getCurrentPhase(current.startDate, today, averageCycleLength);

  const dayOfCycle =
    Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() -
        new Date(`${current.startDate}T00:00:00Z`).getTime()) /
        86400000,
    ) + 1;

  const lateDays = isLateByDays(current.startDate, averageCycleLength, today);

  return {
    phase,
    dayOfCycle,
    startDate: current.startDate,
    cycleId: current.id,
    lateDays,
    avgLength: averageCycleLength,
  };
}

export async function fetchCycleHomeDashboard() {
  const adapter = db();
  const today = getTodayIso();
  const stats = getCycleStats(adapter);
  const cycles = getCycles(adapter, 12);
  const current = cycles[0] && !cycles[0].endDate ? cycles[0] : null;
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);

  const cycleLength =
    calculateAverageCycleLength(cycleLengths) ??
    stats.averageCycleLength ??
    DEFAULT_CYCLE_LENGTH;
  const periodLength =
    calculateAveragePeriodLength(periodLengths) ??
    stats.averagePeriodLength ??
    DEFAULT_PERIOD_LENGTH;

  const prediction =
    cycles.length >= 2
      ? predictNextPeriod(
          cycles[0].endDate ? cycles[0].endDate : cycles[0].startDate,
          cycleLengths,
          periodLengths,
          today,
        )
      : null;

  const currentPhase = current
    ? getCurrentPhase(current.startDate, today, Math.round(cycleLength))
    : null;
  const dayOfCycle = current
    ? Math.max(1, daysBetweenIso(current.startDate, today) + 1)
    : null;

  return {
    today,
    stats,
    currentPhase,
    dayOfCycle,
    currentCycle: current,
    prediction,
    cycleLength: Math.round(cycleLength),
    periodLength: Math.round(periodLength),
    recentCycles: cycles.slice(0, 4),
  };
}

export async function fetchCycleInsightsBundle() {
  const adapter = db();
  const today = getTodayIso();
  const stats = getCycleStats(adapter);
  const cycles = getCycles(adapter, 24);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);

  const chronologicalLengths = [...cycleLengths].reverse();
  const trend = detectCycleTrend(chronologicalLengths);
  const current = cycles[0] ?? null;
  const prediction = current
    ? predictNextPeriod(current.startDate, cycleLengths, periodLengths, today)
    : null;
  const insights = generateCycleInsights(stats, prediction, trend, [], today);

  return {
    stats,
    trend,
    insights,
    recentLengths: chronologicalLengths.slice(-6),
    hasData: stats.totalCycles >= 1,
  };
}

export async function fetchCyclePredictionBundle() {
  const adapter = db();
  const today = getTodayIso();
  const cycles = getCycles(adapter, 24);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);
  const averageCycleLength = calculateAverageCycleLength(cycleLengths) ?? DEFAULT_CYCLE_LENGTH;
  const latestCycle = cycles[0] ?? null;
  const prediction = latestCycle
    ? predictNextPeriod(latestCycle.startDate, cycleLengths, periodLengths, today)
    : null;

  if (!latestCycle || !prediction) {
    return {
      cycleCount: cycles.length,
      predictionAvailable: false,
      heroLabel: 'Log at least 2 complete cycles to unlock your next-period forecast.',
      confidencePct: 0,
      symptomRows: [] as Array<{ symptom: string; percentage: number; phase: CyclePhase }>,
      fertileBars: [] as Array<{ date: string; intensity: number; isPeak: boolean }>,
      fertileRange: '--',
      peakLabel: '--',
    };
  }

  const lateByDays = isLateByDays(latestCycle.startDate, averageCycleLength, today);
  const currentPhase = getCurrentPhase(
    latestCycle.startDate,
    today,
    Math.round(averageCycleLength),
  );
  const symptomEntries = createSymptomPhaseEntries(
    adapter,
    cycles,
    Math.round(averageCycleLength),
  );
  const patterns = analyzeSymptomsByPhase(symptomEntries, 2);
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));
  const upcomingPhase = getUpcomingPhase(today, prediction, currentPhase);
  const frequencies = getSymptomFrequencies(adapter, 16);
  const maxCount = frequencies[0]?.count ?? 1;

  const dominantRows = patterns
    .filter((pattern) => pattern.dominantPhase === upcomingPhase)
    .map((pattern) => ({
      symptom: pattern.symptom,
      percentage: clampPercent(Math.round(pattern.phaseConcentration * 100)),
      phase: pattern.dominantPhase,
    }));

  const fallbackRows = frequencies.map((item) => ({
    symptom: item.symptom,
    percentage: clampPercent(Math.round((item.count / maxCount) * 100)),
    phase: patternMap.get(item.symptom)?.dominantPhase ?? upcomingPhase,
  }));

  const symptomRows = [...dominantRows, ...fallbackRows]
    .filter(
      (row, index, rows) =>
        rows.findIndex((candidate) => candidate.symptom === row.symptom) === index,
    )
    .slice(0, 4);

  const fertileBars = buildFertileBars(prediction);
  const peakDate = fertileBars.find((bar) => bar.isPeak)?.date ?? null;

  return {
    cycleCount: cycles.length,
    predictionAvailable: true,
    heroLabel: buildHeroLabel(prediction, lateByDays),
    confidencePct: Math.round(prediction.confidence * 100),
    symptomRows,
    fertileBars,
    fertileRange: `${formatMonthDay(prediction.fertileWindowStart)} – ${formatMonthDay(prediction.fertileWindowEnd)}`,
    peakLabel: peakDate ? `Peak ovulation · ${formatMonthDay(peakDate)}` : '--',
  };
}

export async function fetchCycleSymptomAnalysisBundle() {
  const adapter = db();
  const today = getTodayIso();
  const cycles = getCycles(adapter, 24);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);
  const averageCycleLength = calculateAverageCycleLength(cycleLengths) ?? DEFAULT_CYCLE_LENGTH;
  const entries = createSymptomPhaseEntries(adapter, cycles, Math.round(averageCycleLength));
  const patterns = analyzeSymptomsByPhase(entries, 2);
  const physicalPatterns = patterns.filter((pattern) => pattern.category === 'physical');
  const moodPatterns = patterns.filter((pattern) => pattern.category === 'mood');
  const topPhysical = physicalPatterns[0] ?? null;
  const topMood = moodPatterns[0] ?? null;
  const frequencies = getSymptomFrequencies(adapter, 20);
  const physicalFrequencies = frequencies.filter((item) => item.category === 'physical');
  const maxCount = physicalFrequencies[0]?.count ?? 1;
  const patternMap = new Map(patterns.map((pattern) => [pattern.symptom, pattern]));

  const physicalTiles = physicalFrequencies.slice(0, 6).map((item) => ({
    symptom: item.symptom,
    count: item.count,
    intensityPct: Math.round((item.count / maxCount) * 100),
    phase: patternMap.get(item.symptom)?.dominantPhase ?? 'luteal',
  }));

  const stats = getCycleStats(adapter);
  const prediction =
    cycles[0] != null
      ? predictNextPeriod(cycles[0].startDate, cycleLengths, periodLengths, today)
      : null;
  const trend =
    cycleLengths.length >= 4 ? detectCycleTrend([...cycleLengths].reverse()) : null;

  const insightRows = generateCycleInsights(stats, prediction, trend, patterns, today)
    .filter((insight) => insight.key.startsWith('symptom_pattern_'))
    .map((insight) => insight.text);

  const fallbackInsightRows =
    insightRows.length > 0
      ? insightRows
      : patterns.slice(0, 3).map((pattern) => {
          const pct = Math.round(pattern.phaseConcentration * 100);
          return `${formatSymptomLabel(pattern.symptom)} shows up in your ${formatPhaseLabel(pattern.dominantPhase).toLowerCase()} phase ${pct}% of the time.`;
        });

  return {
    hasSymptoms: entries.length > 0,
    topPhysical,
    topMood,
    topMoodPatterns: moodPatterns.slice(0, 3),
    physicalTiles,
    insightRows: fallbackInsightRows,
  };
}

export async function fetchCalendarMonthView(year: number, month: number) {
  const adapter = db();
  const today = getTodayIso();
  const cycles = getCycles(adapter, 24);
  const completed = cycles.filter((cycle) => cycle.endDate !== null);
  const cycleLengths = completed
    .map((cycle) => cycle.lengthDays)
    .filter((length): length is number => length !== null);
  const periodLengths = completed
    .map((cycle) => cycle.periodLength)
    .filter((length): length is number => length !== null);

  const averageCycleLength =
    calculateAverageCycleLength(cycleLengths) ?? DEFAULT_CYCLE_LENGTH;
  const averagePeriodLength =
    calculateAveragePeriodLength(periodLengths) ?? DEFAULT_PERIOD_LENGTH;
  const lastCycle = cycles[0] ?? null;

  const firstOfMonth = startOfMonth(year, month);
  const jsWeekday = firstOfMonth.getUTCDay();
  const mondayOffset = (jsWeekday + 6) % 7;
  const previousMonthDays = daysInMonth(
    month === 0 ? year - 1 : year,
    month === 0 ? 11 : month - 1,
  );

  const cells: Array<{
    date: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    mark: CalendarMark;
    log: ReturnType<typeof summarizeLoggedDay>;
  }> = [];

  for (let index = mondayOffset; index > 0; index -= 1) {
    const day = previousMonthDays - index + 1;
    const date = isoDate(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, day);
    const cycleDay = getCycleDayByDate(adapter, date);
    cells.push({
      date,
      day,
      inMonth: false,
      isToday: date === today,
      mark: classifyCalendarDate(
        date,
        cycles,
        averageCycleLength,
        averagePeriodLength,
        lastCycle,
        cycleLengths,
        periodLengths,
        today,
      ),
      log: summarizeLoggedDay(adapter, cycleDay),
    });
  }

  const totalDays = daysInMonth(year, month);
  for (let day = 1; day <= totalDays; day += 1) {
    const date = isoDate(year, month, day);
    const cycleDay = getCycleDayByDate(adapter, date);
    cells.push({
      date,
      day,
      inMonth: true,
      isToday: date === today,
      mark: classifyCalendarDate(
        date,
        cycles,
        averageCycleLength,
        averagePeriodLength,
        lastCycle,
        cycleLengths,
        periodLengths,
        today,
      ),
      log: summarizeLoggedDay(adapter, cycleDay),
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextDate = addIsoDays(cells[cells.length - 1].date, 1);
    const next = parseIsoDate(nextDate);
    const cycleDay = getCycleDayByDate(adapter, nextDate);
    cells.push({
      date: nextDate,
      day: next.getUTCDate(),
      inMonth: next.getUTCMonth() === month && next.getUTCFullYear() === year,
      isToday: nextDate === today,
      mark: classifyCalendarDate(
        nextDate,
        cycles,
        averageCycleLength,
        averagePeriodLength,
        lastCycle,
        cycleLengths,
        periodLengths,
        today,
      ),
      log: summarizeLoggedDay(adapter, cycleDay),
    });
  }

  return {
    today,
    year,
    month,
    monthLabel: firstOfMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    cycleCount: cycles.length,
    cells,
  };
}

// ── Temperature ──────────────────────────────────────────────────────

export async function fetchTemperatureByDate(date: string) {
  return getTemperatureByDate(db(), date);
}

export async function fetchTemperaturesByDateRange(startDate: string, endDate: string) {
  return getTemperaturesByDateRange(db(), startDate, endDate);
}

export async function doUpsertTemperature(input: CreateTemperatureRawInput) {
  return upsertTemperature(db(), crypto.randomUUID(), input);
}

export async function doDeleteTemperature(id: string) {
  return deleteTemperature(db(), id);
}

export async function fetchTemperatureAnalysis(startDate: string, endDate: string) {
  const temperatures = getTemperaturesByDateRange(db(), startDate, endDate);
  if (temperatures.length < 6) return { temperatures, analysis: null };
  const analysis = analyzeTemperatures(temperatures.map((temperature) => temperature.valueCelsius));
  return { temperatures, analysis };
}

export async function fetchCycleTemperatureBundle() {
  const adapter = db();
  const today = getTodayIso();
  const cycles = getCycles(adapter, 12);
  const currentCycleStart = cycles[0]?.startDate ?? addIsoDays(today, -27);
  const stats = getCycleStats(adapter);
  const averageCycleLength = Math.round(stats.averageCycleLength ?? DEFAULT_CYCLE_LENGTH);
  const currentPhase = cycles[0]
    ? getCurrentPhase(cycles[0].startDate, today, averageCycleLength)
    : null;
  const currentCycleDay = Math.max(1, daysBetweenIso(currentCycleStart, today) + 1);
  const temperatures = getTemperaturesByDateRange(adapter, currentCycleStart, today, 180);
  const analysis = temperatures.length >= 6
    ? analyzeTemperatures(temperatures.map((temperature) => temperature.valueCelsius))
    : null;
  const temperatureUnit = readTemperatureUnitPreference(adapter);

  const recentRows = Array.from({ length: 14 }, (_, index) => {
    const date = addIsoDays(today, -(13 - index));
    const entry = temperatures.find((temperature) => temperature.date === date) ?? null;
    return {
      date,
      cycleDay: Math.max(1, daysBetweenIso(currentCycleStart, date) + 1),
      entry,
      displayValue: entry ? celsiusToDisplay(entry.valueCelsius, temperatureUnit) : null,
    };
  });

  const summaryText = analysis?.shiftDetected
    ? `Your temperature rose after cycle day ${analysis.shiftStartIndex != null ? analysis.shiftStartIndex + 1 : '--'}, suggesting ovulation has likely occurred.`
    : 'Keep logging a few more mornings in a row to reveal a clearer coverline and thermal shift.';

  return {
    today,
    temperatureUnit,
    currentCycleStart,
    currentCycleDay,
    currentPhase,
    temperatures,
    analysis,
    recentRows,
    summaryText,
  };
}

// ── Pregnancy ────────────────────────────────────────────────────────

export async function fetchActivePregnancy() {
  return getActivePregnancy(db());
}

export async function fetchPregnancyHistory() {
  return getPregnancyHistory(db());
}

export async function doCreatePregnancy(input: CreatePregnancyInput) {
  return createPregnancyConfig(db(), crypto.randomUUID(), input);
}

export async function doEndPregnancy(id: string, status: 'completed' | 'loss') {
  return endPregnancy(db(), id, status);
}

export async function doUpdateDueDate(id: string, newDueDate: string) {
  return updateDueDate(db(), id, newDueDate);
}

export async function fetchPregnancyWeekInfo(dueDate: string, lastPeriodDate?: string) {
  const today = getTodayIso();
  const week = getCurrentWeek(dueDate, today, lastPeriodDate);
  const trimester = getCurrentTrimester(week);
  const daysUntil = getDaysUntilDue(dueDate, today);
  const weekInfo = getPregnancyWeekInfo(week);
  const display = formatWeekDisplay(week);
  return { week, trimester, daysUntil, weekInfo, display };
}

export async function fetchCyclePregnancyDashboard() {
  const adapter = db();
  const pregnancy = getActivePregnancy(adapter);
  if (!pregnancy) return null;

  const today = getTodayIso();
  const week = getCurrentWeek(pregnancy.dueDate, today, pregnancy.lastPeriodDate ?? undefined);
  const trimester = getCurrentTrimester(week);
  const daysUntil = getDaysUntilDue(pregnancy.dueDate, today);
  const weekInfo = getPregnancyWeekInfo(week);
  const display = formatWeekDisplay(week);
  const appointments = getAppointmentsByPregnancy(adapter, pregnancy.id, 40);

  return {
    pregnancy,
    week,
    trimester,
    daysUntil,
    weekInfo,
    display,
    appointments,
  };
}

// ── Appointments ─────────────────────────────────────────────────────

export async function fetchAppointmentsByPregnancy(pregnancyId: string) {
  return getAppointmentsByPregnancy(db(), pregnancyId);
}

export async function fetchUpcomingAppointmentsAction(pregnancyId: string) {
  const today = getTodayIso();
  return getUpcomingAppointments(db(), pregnancyId, today);
}

export async function doCreateAppointment(input: CreateAppointmentInput) {
  return createAppointment(db(), crypto.randomUUID(), input);
}

export async function doUpdateAppointment(id: string, input: UpdateAppointmentInput) {
  return updateAppointment(db(), id, input);
}

export async function doCompleteAppointment(id: string) {
  return completeAppointment(db(), id);
}

export async function doDeleteAppointment(id: string) {
  return deleteAppointment(db(), id);
}

// ── Partner Sharing ──────────────────────────────────────────────────

export async function fetchActivePartnerLink() {
  return getActivePartnerLink(db());
}

export async function doCreatePartnerLink(input?: CreatePartnerLinkRawInput) {
  return createPartnerLink(db(), crypto.randomUUID(), input);
}

export async function doUpdatePartnerLink(id: string, input: UpdatePartnerLinkInput) {
  return updatePartnerLink(db(), id, input);
}

export async function doRevokePartnerLink(id: string) {
  return revokePartnerLink(db(), id);
}

export async function fetchSharedView() {
  const adapter = db();
  const link = getActivePartnerLink(adapter);
  if (!link) return null;

  const cycles = getCycles(adapter, 1);
  const current = cycles.length > 0 && !cycles[0].endDate ? cycles[0] : null;
  const today = getTodayIso();
  const stats = getCycleStats(adapter);

  let currentPhase: CyclePhase | null = null;
  let cycleDay: number | null = null;

  if (current) {
    currentPhase = getCurrentPhase(current.startDate, today, stats.averageCycleLength ?? DEFAULT_CYCLE_LENGTH);
    cycleDay = Math.round(
      (new Date(`${today}T00:00:00Z`).getTime() -
        new Date(`${current.startDate}T00:00:00Z`).getTime()) /
        86400000,
    ) + 1;
  }

  const todaysLog = getCycleDayByDate(adapter, today);
  const symptomCount = todaysLog ? getSymptomsForDay(adapter, todaysLog.id, 120).length : 0;

  const prediction = await fetchPrediction();
  const pregnancy = getActivePregnancy(adapter);
  let pregnancyWeek = null;
  if (pregnancy) {
    pregnancyWeek = getCurrentWeek(pregnancy.dueDate, today, pregnancy.lastPeriodDate);
  }

  return generateSharedView(link, {
    currentPhase,
    cycleDay,
    predictedNextPeriod: prediction?.predictedStartDate ?? null,
    fertileWindowStart: prediction?.fertileWindowStart ?? null,
    fertileWindowEnd: prediction?.fertileWindowEnd ?? null,
    symptomCount,
    pregnancyWeek,
    pregnancyDueDate: pregnancy?.dueDate ?? null,
    displayName: link.partnerName,
  });
}

// ── Settings / Preferences ───────────────────────────────────────────

export async function fetchCycleSettings() {
  const adapter = db();
  const stats = getCycleStats(adapter);
  const cycleCount = getCycles(adapter, 200).length;
  const activePregnancy = getActivePregnancy(adapter);
  const activePartnerLink = getActivePartnerLink(adapter);

  return {
    defaultCycleLength: readNumberPreference(
      getPreference(adapter, PREFERENCE_KEYS.defaultCycleLength),
      Math.round(stats.averageCycleLength ?? DEFAULT_CYCLE_LENGTH),
    ),
    defaultPeriodLength: readNumberPreference(
      getPreference(adapter, PREFERENCE_KEYS.defaultPeriodLength),
      Math.round(stats.averagePeriodLength ?? DEFAULT_PERIOD_LENGTH),
    ),
    trackingMode: readTrackingModePreference(
      getPreference(adapter, PREFERENCE_KEYS.trackingMode),
    ),
    temperatureUnit: readTemperatureUnitPreference(adapter),
    predictionsEnabled: readBooleanPreference(
      getPreference(adapter, PREFERENCE_KEYS.predictionsEnabled),
      true,
    ),
    periodReminder: readBooleanPreference(
      getPreference(adapter, PREFERENCE_KEYS.periodReminder),
      true,
    ),
    fertileAlerts: readBooleanPreference(
      getPreference(adapter, PREFERENCE_KEYS.fertileAlerts),
      false,
    ),
    cycleCount,
    activePregnancy: activePregnancy != null,
    activePartnerLink: activePartnerLink != null,
  };
}

export async function saveCycleSettings(input: {
  defaultCycleLength: number;
  defaultPeriodLength: number;
  trackingMode: TrackingMode;
  temperatureUnit: TemperatureUnit;
  predictionsEnabled: boolean;
  periodReminder: boolean;
  fertileAlerts: boolean;
}) {
  const adapter = db();

  setPreference(
    adapter,
    PREFERENCE_KEYS.defaultCycleLength,
    String(Math.max(18, Math.min(60, Math.round(input.defaultCycleLength)))),
  );
  setPreference(
    adapter,
    PREFERENCE_KEYS.defaultPeriodLength,
    String(Math.max(2, Math.min(12, Math.round(input.defaultPeriodLength)))),
  );
  setPreference(adapter, PREFERENCE_KEYS.trackingMode, input.trackingMode);
  setPreference(adapter, PREFERENCE_KEYS.temperatureUnit, input.temperatureUnit);
  setPreference(adapter, PREFERENCE_KEYS.predictionsEnabled, String(input.predictionsEnabled));
  setPreference(adapter, PREFERENCE_KEYS.periodReminder, String(input.periodReminder));
  setPreference(adapter, PREFERENCE_KEYS.fertileAlerts, String(input.fertileAlerts));

  return fetchCycleSettings();
}

'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  createA1cRecord,
  createCaregiver,
  createMedication,
  createMedicationExtended,
  decrementPillCount,
  deleteCaregiver,
  deleteDose,
  deleteMedication,
  getActiveMedications,
  getAdherenceCalendar,
  getAdherenceRate,
  getAdherenceStats,
  getAlertConfig,
  getCaregivers,
  getDayDetail,
  getDoseLogsForDate,
  getGlucoseReadings,
  getInjectionSites,
  getInteractionsForMedication,
  getMeasurementTrend,
  getMeasurements,
  getMedicationById,
  getMedicationExtended,
  getMedications,
  getMoodCalendarMonth,
  getMoodEntries,
  getRefillHistory,
  getSetting,
  getStreak,
  logBPReading,
  logDose,
  logGlucoseReading,
  logInsulinEntry,
  logMeasurement,
  recordDose,
  recordRefill,
  searchFodmapFoods,
  setSetting,
  updateAlertConfig,
  updateMedication,
  updatePillCount,
  countMedications,
  calculateBPAverages,
  getBPReadings,
  getCategoryDistribution,
  calculateAverageGlucose,
  calculateTimeInRange,
  estimateA1c,
  analyzeGlucosePatterns,
  getInsulinEntries,
  calculateIOB,
  getDailyInsulinTotals,
  calculateDailyAverage,
  createMoodEntry,
  getOverallStats,
  getMoodMedicationCorrelation,
  checkInteractions,
  generateDoctorReport,
  generateTherapyReport,
} from '@mylife/meds';
import type {
  CreateA1cRecordInput,
  CreateBPReadingInput,
  CreateCaregiverInput,
  CreateDoseLogInput,
  CreateGlucoseReadingInput,
  CreateInsulinEntryInput,
  CreateMeasurementInput,
  CreateMedicationInput,
  CreateMoodEntryInput,
  CreateRefillInput,
} from '@mylife/meds';
import {
  getA1cPageData,
  getBPAnalyticsData,
  getCGMPageData,
  getCaregiverPageData,
  getDashboardData,
  getDigestivePageData,
  getGlucosePageData,
  getHistoryPageData,
  getInsulinPageData,
  getMoodPageData,
  getPainPageData,
  getPrescriptionListData,
  getSettingsPageData,
  getVitalsHubData,
  getWeatherPageData,
} from './data';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('meds');
  return adapter;
}

function withActionError<TArgs extends unknown[], TResult>(
  label: string,
  action: (...args: TArgs) => TResult | Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await action(...args);
    } catch (error) {
      console.error(`[meds/actions] ${label} failed`, error);
      throw new Error(`Unable to ${label}.`);
    }
  };
}

export const fetchDashboardData = withActionError('load the dashboard', async () => getDashboardData());
export const fetchPrescriptionListData = withActionError('load prescriptions', async () => getPrescriptionListData());
export const fetchVitalsHubData = withActionError('load vitals', async () => getVitalsHubData());
export const fetchBPAnalyticsData = withActionError('load blood pressure analytics', async () => getBPAnalyticsData());
export const fetchGlucosePageData = withActionError('load glucose analytics', async () => getGlucosePageData());
export const fetchInsulinPageData = withActionError('load insulin analytics', async () => getInsulinPageData());
export const fetchA1cPageData = withActionError('load A1c analytics', async () => getA1cPageData());
export const fetchCGMPageData = withActionError('load CGM analytics', async () => getCGMPageData());
export const fetchPainPageData = withActionError('load pain analytics', async () => getPainPageData());
export const fetchMoodPageData = withActionError('load mood analytics', async () => getMoodPageData());
export const fetchDigestivePageData = withActionError('load digestive analytics', async () => getDigestivePageData());
export const fetchCaregiverPageData = withActionError('load caregiver data', async () => getCaregiverPageData());
export const fetchWeatherPageData = withActionError('load weather analytics', async () => getWeatherPageData());
export const fetchSettingsPageData = withActionError('load settings', async () => getSettingsPageData());
export const fetchHistoryPageData = withActionError('load adherence history', async (month?: string) => getHistoryPageData(month));

export const fetchMedications = withActionError('load medications', async (opts?: { isActive?: boolean }) =>
  getMedications(db(), opts),
);

export const fetchMedicationById = withActionError('load medication details', async (id: string) =>
  getMedicationById(db(), id),
);

export const doCreateMedication = withActionError(
  'create a medication',
  async (id: string, input: { name: string; dosage?: string; unit?: string; frequency?: string }) =>
    createMedication(db(), id, input),
);

export const doUpdateMedication = withActionError(
  'update a medication',
  async (
    id: string,
    updates: Partial<{
      name: string;
      dosage: string;
      unit: string;
      frequency: string;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) => updateMedication(db(), id, updates),
);

export const doDeleteMedication = withActionError('delete a medication', async (id: string) =>
  deleteMedication(db(), id),
);

export const fetchMedicationCount = withActionError('count medications', async () =>
  countMedications(db()),
);

export const doRecordDose = withActionError(
  'record a dose',
  async (id: string, medicationId: string, takenAt: string, skipped?: boolean) =>
    recordDose(db(), id, medicationId, takenAt, skipped),
);

export const fetchDosesForDate = withActionError('load doses for the day', async (date: string) =>
  getDoseLogsForDate(db(), date),
);

export const doDeleteDose = withActionError('delete a dose entry', async (id: string) =>
  deleteDose(db(), id),
);

export const fetchAdherenceRate = withActionError(
  'load adherence rate',
  async (medicationId: string, from: string, to: string) => getAdherenceRate(db(), medicationId, from, to),
);

export const fetchActiveMedications = withActionError('load active medications', async () =>
  getActiveMedications(db()),
);

export const fetchMedicationExtended = withActionError('load a prescription profile', async (id: string) =>
  getMedicationExtended(db(), id),
);

export const doCreateMedicationExtended = withActionError(
  'create a prescription',
  async (id: string, input: CreateMedicationInput) => createMedicationExtended(db(), id, input),
);

export const doUpdatePillCount = withActionError('update remaining pills', async (id: string, count: number) =>
  updatePillCount(db(), id, count),
);

export const doRecordRefill = withActionError('record a refill', async (id: string, input: CreateRefillInput) =>
  recordRefill(db(), id, input),
);

export const fetchRefillHistory = withActionError('load refill history', async (medicationId: string) =>
  getRefillHistory(db(), medicationId),
);

export const fetchInteractions = withActionError('load interaction warnings', async (medicationId: string) =>
  getInteractionsForMedication(db(), medicationId),
);

export const doCheckInteractions = withActionError(
  'check medication interactions',
  async (drugName: string, activeMedNames: string[]) => checkInteractions(db(), drugName, activeMedNames),
);

export const doLogDoseV2 = withActionError('log dose adherence', async (id: string, input: CreateDoseLogInput) => {
  const adapter = db();
  logDose(adapter, id, input);
  // Mirror the mobile take handlers: a consumed dose (taken/late) decrements
  // remaining supply exactly once. Skipped/snoozed doses leave supply alone.
  if (input.status === 'taken' || input.status === 'late') {
    decrementPillCount(adapter, input.medicationId);
  }
});

export const fetchAdherenceStats = withActionError('load adherence statistics', async (medicationId: string, days: number = 30) =>
  getAdherenceStats(db(), medicationId, days),
);

export const fetchAdherenceCalendar = withActionError('load adherence calendar', async (month: string) =>
  getAdherenceCalendar(db(), month),
);

export const fetchStreak = withActionError('load streak data', async (medicationId: string) =>
  getStreak(db(), medicationId),
);

export const doLogMeasurement = withActionError('log a measurement', async (id: string, input: CreateMeasurementInput) =>
  logMeasurement(db(), id, input),
);

export const fetchMeasurements = withActionError(
  'load measurements',
  async (opts?: { type?: string; from?: string; to?: string }) => getMeasurements(db(), opts),
);

export const fetchMeasurementTrend = withActionError(
  'load measurement trend',
  async (type: string, from: string, to: string) => getMeasurementTrend(db(), type, from, to),
);

export const doCreateMoodEntry = withActionError(
  'create a mood entry',
  async (id: string, input: CreateMoodEntryInput) => createMoodEntry(db(), id, input),
);

export const fetchMoodEntries = withActionError('load mood entries', async (from?: string, to?: string) =>
  getMoodEntries(db(), from, to),
);

export const fetchMoodCalendarMonth = withActionError('load the mood calendar', async (year: number, month: number) =>
  getMoodCalendarMonth(db(), year, month),
);

export const fetchDayDetail = withActionError('load mood day detail', async (date: string) =>
  getDayDetail(db(), date),
);

export const fetchCorrelation = withActionError('load mood correlation', async (medicationId: string) =>
  getMoodMedicationCorrelation(db(), medicationId),
);

export const fetchOverallStats = withActionError('load overall stats', async () =>
  getOverallStats(db()),
);

export const generateReport = withActionError(
  'generate an export report',
  async (type: 'doctor' | 'therapy', from: string, to: string) => {
    if (type === 'therapy') {
      return generateTherapyReport(db(), from, to);
    }
    return generateDoctorReport(db(), from, to);
  },
);

export const doLogBPReading = withActionError('log a blood pressure reading', async (input: CreateBPReadingInput) => {
  const id = `bp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return logBPReading(db(), id, input);
});

export const fetchBPReadings = withActionError(
  'load blood pressure readings',
  async (opts?: { from?: string; to?: string; context?: string }) => getBPReadings(db(), opts),
);

export const fetchBPAverages = withActionError('load blood pressure averages', async (from?: string, to?: string) => {
  const readings = getBPReadings(db(), { from, to });
  return calculateBPAverages(readings);
});

export const fetchBPCategoryDistribution = withActionError(
  'load blood pressure distribution',
  async (from?: string, to?: string) => {
    const readings = getBPReadings(db(), { from, to });
    return getCategoryDistribution(readings);
  },
);

export const doLogGlucoseReading = withActionError('log a glucose reading', async (input: CreateGlucoseReadingInput) => {
  const id = `glu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return logGlucoseReading(db(), id, input);
});

export const fetchGlucoseReadings = withActionError(
  'load glucose readings',
  async (opts?: { from?: string; to?: string; mealContext?: string }) => getGlucoseReadings(db(), opts),
);

export const fetchGlucoseStats = withActionError('load glucose statistics', async (from?: string, to?: string) => {
  const readings = getGlucoseReadings(db(), { from, to });
  const average = calculateAverageGlucose(readings);
  return {
    tir: calculateTimeInRange(readings),
    average,
    estimatedA1c: average > 0 ? estimateA1c(average) : null,
    patterns: analyzeGlucosePatterns(readings),
    count: readings.length,
  };
});

export const doLogInsulinEntry = withActionError('log an insulin entry', async (input: CreateInsulinEntryInput) => {
  const id = `ins-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return logInsulinEntry(db(), id, input);
});

export const fetchInsulinEntries = withActionError(
  'load insulin entries',
  async (opts?: { from?: string; to?: string }) => getInsulinEntries(db(), opts),
);

export const fetchIOB = withActionError('load insulin on board', async () =>
  calculateIOB(getInsulinEntries(db())),
);

export const fetchInsulinStats = withActionError('load insulin statistics', async () => {
  const entries = getInsulinEntries(db());
  const dailyTotals = getDailyInsulinTotals(entries);
  return {
    iob: calculateIOB(entries),
    dailyAverage: calculateDailyAverage(dailyTotals),
    dailyTotals,
  };
});

export const fetchInjectionSites = withActionError('load injection sites', async () =>
  getInjectionSites(db()),
);

export const searchDigestiveFoods = withActionError('search FODMAP foods', async (query: string) =>
  searchFodmapFoods(db(), query),
);

export const fetchModuleSetting = withActionError('load a module setting', async (key: string) =>
  getSetting(db(), key),
);

export const doSetModuleSetting = withActionError(
  'save a module setting',
  async (key: string, value: string) => setSetting(db(), key, value),
);

export const doCreateA1cLabRecord = withActionError(
  'save a lab A1c result',
  async (input: CreateA1cRecordInput) => {
    const id = `a1c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return createA1cRecord(db(), id, input);
  },
);

export const fetchCaregiverConfig = withActionError('load caregiver rules', async () =>
  getAlertConfig(db()),
);

export const fetchCaregivers = withActionError('load caregivers', async () =>
  getCaregivers(db()),
);

export const doCreateCaregiverLink = withActionError(
  'create a caregiver',
  async (input: CreateCaregiverInput) => createCaregiver(db(), input),
);

export const doDeleteCaregiverLink = withActionError('remove a caregiver', async (caregiverId: string) =>
  deleteCaregiver(db(), caregiverId),
);

export const doUpdateCaregiverRules = withActionError(
  'save caregiver rules',
  async (nextState: Awaited<ReturnType<typeof getAlertConfig>>) => updateAlertConfig(db(), nextState),
);

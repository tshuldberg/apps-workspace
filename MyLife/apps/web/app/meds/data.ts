import 'server-only';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  calculateAGP,
  calculateAverageGlucose,
  calculateCV,
  calculateGMI,
  calculateIOB,
  calculateTIRBreakdown,
  comparePeriods,
  getA1cConfidence,
  getA1cRecords,
  getActiveMedications,
  getAdherenceCalendar,
  getAdherenceStats,
  getAlertConfig,
  getAlertHistory,
  getAppointments,
  getBPPeriodStats,
  getBPReadings,
  getBPTrendData,
  getCaregivers,
  getCGMReadings,
  getCGMStats,
  getCGMSyncState,
  getContacts,
  getCurrentWeather,
  getDaysRemaining,
  getDoseLogsForMedication,
  getFoodDiary,
  getFodmapFoods,
  getFodmapInsights,
  getGlucoseReadings,
  getInjectionSites,
  getInsulinEntries,
  getInteractionsForMedication,
  getLowSupplyAlerts,
  getMedications,
  getMedicationInsights,
  getMoodCalendar,
  getMoodCorrelations,
  getMoodEntries,
  getMoodTrends,
  getOverallStats,
  getPainByRegion,
  getPainEntries,
  getPainInsights,
  getRegimenSummary,
  getSetting,
  getStoolLogs,
  getTriggerAlerts,
  getUpcomingAppointments,
  getWeatherSymptomLinks,
  getWeatherTriggerInsights,
  getWellnessScore,
  getMeasurements,
  getDailyInsulinTotals,
  getWeatherHistory,
  interpretA1c,
  estimateA1c,
  calculateTrendArrow,
} from '@mylife/meds';

const DAY_MS = 24 * 60 * 60 * 1000;

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('meds');
  return adapter;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function startOfToday(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function endOfToday(): string {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentYear() {
  return new Date().getFullYear();
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

function groupByDate<T>(
  items: T[],
  getDate: (item: T) => string,
) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getDate(item).slice(0, 10);
    const bucket = acc[key] ?? [];
    bucket.push(item);
    acc[key] = bucket;
    return acc;
  }, {});
}

function parseSettingBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) {
    return fallback;
  }

  return value === 'true';
}

function parseSettingString(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function nearestNumericPoint(
  targetIso: string,
  entries: Array<{ measuredAt?: string; administeredAt?: string; value?: number }>,
) {
  const target = new Date(targetIso).getTime();
  let best: { value: number; distance: number } | null = null;

  for (const entry of entries) {
    const iso = entry.measuredAt ?? entry.administeredAt;
    if (!iso || entry.value == null) {
      continue;
    }

    const distance = Math.abs(new Date(iso).getTime() - target);
    if (!best || distance < best.distance) {
      best = { value: entry.value, distance };
    }
  }

  return best?.value ?? null;
}

export interface PrescriptionRecord {
  id: string;
  name: string;
  dosage: string | null;
  unit: string | null;
  frequency: string | null;
  prescriber: string | null;
  pharmacy: string | null;
  refillDate: string | null;
  pillCount: number | null;
  daysRemaining: number | null;
  adherenceRate: number;
  interactionCount: number;
  nextDoseAt: string | null;
  timeSlots: string[];
  notes: string | null;
  sortOrder: number;
  isActive: boolean;
}

function buildPrescriptionRecords() {
  const adapter = db();
  const summary = getRegimenSummary(adapter);
  const scheduleByMedication = summary.todaySchedule.reduce<Record<string, string | null>>((acc, item) => {
    if (!(item.medicationId in acc)) {
      acc[item.medicationId] = item.scheduledTime;
    }
    return acc;
  }, {});

  return getMedications(adapter).map((medication) => {
    const adherence = getAdherenceStats(adapter, medication.id, 30);
    return {
      id: medication.id,
      name: medication.name,
      dosage: medication.dosage,
      unit: medication.unit,
      frequency: medication.frequency,
      prescriber: medication.prescriber,
      pharmacy: medication.pharmacy,
      refillDate: medication.refillDate,
      pillCount: medication.pillCount,
      daysRemaining: getDaysRemaining(adapter, medication.id),
      adherenceRate: adherence.rate,
      interactionCount: getInteractionsForMedication(adapter, medication.id).length,
      nextDoseAt: scheduleByMedication[medication.id] ?? null,
      timeSlots: medication.timeSlots,
      notes: medication.notes,
      sortOrder: medication.sortOrder,
      isActive: medication.isActive,
    } satisfies PrescriptionRecord;
  });
}

export function getDashboardData() {
  const adapter = db();
  const summary = getRegimenSummary(adapter);
  const wellness = getWellnessScore(adapter);
  const overall = getOverallStats(adapter);
  const lowSupply = getLowSupplyAlerts(adapter);
  const appointments = getUpcomingAppointments(adapter).slice(0, 5);
  const insights = getMedicationInsights(adapter).slice(0, 6);
  const prescriptions = buildPrescriptionRecords().filter((item) => item.isActive).slice(0, 6);
  const measurements = getMeasurements(adapter, { from: isoDaysAgo(45) });

  const measurementByType = measurements.reduce<Record<string, Array<{ measuredAt: string; value: string; unit: string }>>>(
    (acc, item) => {
      const bucket = acc[item.type] ?? [];
      bucket.push(item);
      acc[item.type] = bucket;
      return acc;
    },
    {},
  );

  const heartRateSeries = (measurementByType.heart_rate ?? []).slice(0, 10).reverse();
  const weightSeries = (measurementByType.weight ?? []).slice(0, 10).reverse();
  const temperatureSeries = (measurementByType.temperature ?? []).slice(0, 10).reverse();
  const bpReadings = getBPReadings(adapter, { from: isoDaysAgo(30) }).slice(0, 14).reverse();
  const glucoseReadings = getGlucoseReadings(adapter, { from: isoDaysAgo(30) }).slice(0, 14).reverse();

  return {
    generatedAt: new Date().toISOString(),
    summary,
    wellness,
    overall,
    lowSupply,
    appointments,
    insights,
    prescriptions,
    vitalsGrid: [
      {
        id: 'bp',
        label: 'Blood Pressure',
        href: '/meds/bp',
        value: summary.vitals.latestBP
          ? `${summary.vitals.latestBP.systolic}/${summary.vitals.latestBP.diastolic}`
          : 'No data',
        unit: summary.vitals.latestBP ? 'mmHg' : '',
        tone: summary.vitals.latestBP?.category ?? null,
        trend: bpReadings.map((item) => ({
          label: item.measuredAt,
          value: item.systolic,
          secondary: item.diastolic,
        })),
      },
      {
        id: 'glucose',
        label: 'Glucose',
        href: '/meds/glucose',
        value: summary.vitals.latestGlucose ? String(summary.vitals.latestGlucose.value) : 'No data',
        unit: summary.vitals.latestGlucose?.unit ?? '',
        tone: summary.vitals.latestGlucose?.rangeStatus ?? null,
        trend: glucoseReadings.map((item) => ({
          label: item.measuredAt,
          value: item.value,
        })),
      },
      {
        id: 'heart-rate',
        label: 'Heart Rate',
        href: '/meds/measurements',
        value: heartRateSeries[heartRateSeries.length - 1]?.value ?? 'No data',
        unit: heartRateSeries[heartRateSeries.length - 1]?.unit ?? '',
        tone: 'monitor_heart',
        trend: heartRateSeries.map((item) => ({
          label: item.measuredAt,
          value: Number(item.value),
        })),
      },
      {
        id: 'weight',
        label: 'Weight',
        href: '/meds/measurements',
        value: weightSeries[weightSeries.length - 1]?.value ?? 'No data',
        unit: weightSeries[weightSeries.length - 1]?.unit ?? '',
        tone: 'scale',
        trend: weightSeries.map((item) => ({
          label: item.measuredAt,
          value: Number(item.value),
        })),
      },
      {
        id: 'temperature',
        label: 'Temperature',
        href: '/meds/measurements',
        value: temperatureSeries[temperatureSeries.length - 1]?.value ?? 'No data',
        unit: temperatureSeries[temperatureSeries.length - 1]?.unit ?? '',
        tone: 'thermometer',
        trend: temperatureSeries.map((item) => ({
          label: item.measuredAt,
          value: Number(item.value),
        })),
      },
    ],
  };
}

export function getPrescriptionListData() {
  const prescriptions = buildPrescriptionRecords();
  const adapter = db();

  return {
    generatedAt: new Date().toISOString(),
    prescriptions,
    activeCount: prescriptions.filter((item) => item.isActive).length,
    lowSupply: getLowSupplyAlerts(adapter),
    selections: prescriptions.slice(0, 3).map((item) => item.id),
  };
}

export function getVitalsHubData() {
  const adapter = db();
  const now = new Date().toISOString();
  const bpReadings = getBPReadings(adapter, { from: isoDaysAgo(90) });
  const glucoseReadings = getGlucoseReadings(adapter, { from: isoDaysAgo(90) });
  const insulinEntries = getInsulinEntries(adapter, { from: isoDaysAgo(90) });
  const measurements = getMeasurements(adapter, { from: isoDaysAgo(90) });
  const wellness = getWellnessScore(adapter);

  const measurementMap = measurements.reduce<Record<string, typeof measurements>>((acc, entry) => {
    const bucket = acc[entry.type] ?? [];
    bucket.push(entry);
    acc[entry.type] = bucket;
    return acc;
  }, {});

  const dailyInsulinTotals = getDailyInsulinTotals(insulinEntries).slice(-14);
  const glucoseStats = glucoseReadings.length > 0
    ? calculateTIRBreakdown(glucoseReadings.map((reading) => ({
        ...reading,
        source: 'manual',
        deviceName: null,
      })))
    : { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0 };

  const events = [
    ...bpReadings.slice(0, 8).map((reading) => ({
      id: `bp-${reading.id}`,
      type: 'Blood Pressure',
      title: `${reading.systolic}/${reading.diastolic} ${reading.category.replace(/_/g, ' ')}`,
      at: reading.measuredAt,
      href: '/meds/bp',
    })),
    ...glucoseReadings.slice(0, 8).map((reading) => ({
      id: `glucose-${reading.id}`,
      type: 'Glucose',
      title: `${reading.value} ${reading.unit} ${reading.rangeStatus.replace(/_/g, ' ')}`,
      at: reading.measuredAt,
      href: '/meds/glucose',
    })),
    ...insulinEntries.slice(0, 8).map((entry) => ({
      id: `insulin-${entry.id}`,
      type: 'Insulin',
      title: `${entry.units} IU ${entry.doseCategory}`,
      at: entry.administeredAt,
      href: '/meds/insulin',
    })),
    ...measurements.slice(0, 8).map((entry) => ({
      id: `measurement-${entry.id}`,
      type: entry.type.replace(/_/g, ' '),
      title: `${entry.value} ${entry.unit}`,
      at: entry.measuredAt,
      href: '/meds/measurements',
    })),
  ]
    .sort((left, right) => right.at.localeCompare(left.at))
    .slice(0, 16);

  return {
    generatedAt: now,
    wellness,
    tiles: {
      bp: bpReadings,
      glucose: glucoseReadings,
      insulin: insulinEntries,
      weight: measurementMap.weight ?? [],
      heartRate: measurementMap.heart_rate ?? [],
      temperature: measurementMap.temperature ?? [],
      glucoseStats,
      dailyInsulinTotals,
    },
    events,
  };
}

export function getBPAnalyticsData() {
  const adapter = db();
  const allReadings = getBPReadings(adapter, { from: isoDaysAgo(90) });
  const currentReadings = getBPReadings(adapter, { from: isoDaysAgo(30) });
  const previousReadings = getBPReadings(adapter, { from: isoDaysAgo(60), to: isoDaysAgo(30) });
  const periodComparison = comparePeriods(currentReadings, previousReadings);
  const trend = getBPTrendData(allReadings);
  const categoryStats = getBPPeriodStats(currentReadings).categoryDistribution;
  const heatmapBuckets = new Map<string, { count: number; systolic: number }>();

  for (const reading of currentReadings) {
    const date = new Date(reading.measuredAt);
    const day = date.getDay();
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    const bucket = heatmapBuckets.get(key) ?? { count: 0, systolic: 0 };
    bucket.count += 1;
    bucket.systolic += reading.systolic;
    heatmapBuckets.set(key, bucket);
  }

  const medicationImpact = getActiveMedications(adapter)
    .map((medication) => {
      const start = new Date(medication.createdAt).getTime();
      const before = allReadings.filter((reading) => {
        const measured = new Date(reading.measuredAt).getTime();
        return measured >= start - 14 * DAY_MS && measured < start;
      });
      const after = allReadings.filter((reading) => {
        const measured = new Date(reading.measuredAt).getTime();
        return measured >= start && measured <= start + 14 * DAY_MS;
      });

      if (before.length < 2 || after.length < 2) {
        return null;
      }

      const beforeAverage = average(before.map((reading) => reading.systolic));
      const afterAverage = average(after.map((reading) => reading.systolic));

      return {
        medicationId: medication.id,
        medicationName: medication.name,
        beforeAverage,
        afterAverage,
        delta: Math.round((afterAverage - beforeAverage) * 10) / 10,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    readings: allReadings,
    trend,
    currentReadings,
    currentStats: getBPPeriodStats(currentReadings),
    previousStats: getBPPeriodStats(previousReadings),
    periodComparison,
    distribution: Object.entries(categoryStats).map(([name, value]) => ({ name, value })),
    heatmap: Array.from(heatmapBuckets.entries()).map(([key, value]) => {
      const [day, hour] = key.split('-').map(Number);
      return {
        day,
        hour,
        count: value.count,
        averageSystolic: Math.round(value.systolic / value.count),
      };
    }),
    medicationImpact,
  };
}

export function getGlucosePageData() {
  const adapter = db();
  const readings = getGlucoseReadings(adapter, { from: isoDaysAgo(90) }).reverse();
  const recentEntries = readings.slice(-24).reverse();
  const byContext = Object.entries(
    readings.reduce<Record<string, number[]>>((acc, reading) => {
      const key = reading.mealContext ?? 'unspecified';
      const bucket = acc[key] ?? [];
      bucket.push(reading.value);
      acc[key] = bucket;
      return acc;
    }, {}),
  ).map(([context, values]) => ({
    context,
    average: average(values),
    count: values.length,
  }));

  const insulinEntries = getInsulinEntries(adapter, { from: isoDaysAgo(90) });
  const mealEntries = getFoodDiary(adapter, { from: isoDaysAgo(30) });
  const medicationInsights = getMedicationInsights(adapter).slice(0, 6);
  const averageGlucose = readings.length > 0 ? calculateAverageGlucose(readings) : 0;

  return {
    generatedAt: new Date().toISOString(),
    readings,
    recentEntries,
    stats: {
      average: averageGlucose,
      tir: readings.length > 0 ? Math.round((readings.filter((reading) => reading.inRange).length / readings.length) * 100) : 0,
      cv: readings.length > 1 ? calculateCV(readings.map((reading) => ({
        id: reading.id,
        value: reading.value,
        unit: reading.unit,
        rangeStatus: reading.rangeStatus,
        source: 'manual',
        deviceName: null,
        measuredAt: reading.measuredAt,
        createdAt: reading.createdAt,
      }))) : 0,
      estimatedA1c: averageGlucose > 0 ? estimateA1c(averageGlucose) : null,
    },
    byContext,
    insulinCorrelation: insulinEntries.slice(-24).reverse().map((entry) => ({
      id: entry.id,
      insulinType: entry.insulinType,
      units: entry.units,
      doseCategory: entry.doseCategory,
      glucoseBefore: nearestNumericPoint(entry.administeredAt, readings),
      administeredAt: entry.administeredAt,
    })),
    mealCorrelation: mealEntries.slice(0, 12).map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      foodItems: meal.foodItems,
      fodmapRating: meal.fodmapRating,
      eatenAt: meal.eatenAt,
    })),
    medicationInsights,
  };
}

export function getInsulinPageData() {
  const adapter = db();
  const entries = getInsulinEntries(adapter, { from: isoDaysAgo(90) }).reverse();
  const injectionSites = getInjectionSites(adapter);
  const dailyTotals = getDailyInsulinTotals(entries);
  const glucoseReadings = getGlucoseReadings(adapter, { from: isoDaysAgo(90) });
  const doseDistribution = countBy(entries.map((entry) => entry.doseCategory));
  const typeDistribution = countBy(entries.map((entry) => entry.insulinType));

  return {
    generatedAt: new Date().toISOString(),
    entries,
    stats: {
      iob: calculateIOB(entries),
      dailyAverage: average(dailyTotals.map((item) => item.total)),
      dailyTotals,
    },
    injectionSites,
    scatter: entries
      .map((entry) => ({
        id: entry.id,
        insulin: entry.units,
        glucose: nearestNumericPoint(entry.administeredAt, glucoseReadings),
        doseCategory: entry.doseCategory,
        insulinType: entry.insulinType,
        administeredAt: entry.administeredAt,
      }))
      .filter((item) => item.glucose != null),
    doseDistribution: Object.entries(doseDistribution).map(([name, value]) => ({ name, value })),
    typeDistribution: Object.entries(typeDistribution).map(([name, value]) => ({ name, value })),
  };
}

export function getA1cPageData() {
  const adapter = db();
  const records = getA1cRecords(adapter).reverse();
  const glucoseReadings = getGlucoseReadings(adapter, { from: isoDaysAgo(90) });
  const averageGlucose = glucoseReadings.length > 0 ? calculateAverageGlucose(glucoseReadings) : null;
  const estimated = averageGlucose ? estimateA1c(averageGlucose) : null;
  const readingCount = glucoseReadings.length;
  const conversionCurve = Array.from({ length: 11 }, (_, index) => {
    const value = 90 + index * 20;
    return {
      averageGlucose: value,
      estimatedA1c: estimateA1c(value),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    records,
    estimated,
    interpretation: estimated ? interpretA1c(estimated) : null,
    confidence: getA1cConfidence(readingCount),
    averageGlucose,
    tir: readingCount > 0 ? Math.round((glucoseReadings.filter((reading) => reading.inRange).length / readingCount) * 100) : 0,
    readingCount,
    conversionCurve,
  };
}

export function getCGMPageData() {
  const adapter = db();
  const readings = getCGMReadings(adapter, { from: isoDaysAgo(7) }).reverse();
  const stats = getCGMStats(readings);
  const tir = calculateTIRBreakdown(readings);
  const eventMeals = getFoodDiary(adapter, { from: isoDaysAgo(7), limit: 24 }).map((entry) => ({
    id: entry.id,
    kind: 'meal',
    label: entry.foodItems,
    at: entry.eatenAt,
  }));
  const eventInsulin = getInsulinEntries(adapter, { from: isoDaysAgo(7) }).map((entry) => ({
    id: entry.id,
    kind: 'insulin',
    label: `${entry.units} IU`,
    at: entry.administeredAt,
  }));

  return {
    generatedAt: new Date().toISOString(),
    readings,
    stats,
    tir,
    trendArrow: calculateTrendArrow(readings),
    currentReading: readings.at(-1) ?? null,
    syncState: getCGMSyncState(adapter),
    agp: calculateAGP(readings),
    events: [...eventMeals, ...eventInsulin]
      .sort((left, right) => left.at.localeCompare(right.at))
      .slice(-24),
    sensorStatus: {
      latestWeather: getCurrentWeather(adapter),
      lastAlerts: getTriggerAlerts(adapter).slice(0, 3),
    },
  };
}

export function getPainPageData() {
  const adapter = db();
  const entries = getPainEntries(adapter, isoDaysAgo(180));
  const byRegion = getPainByRegion(adapter, isoDaysAgo(180));
  const insights = getPainInsights(adapter, isoDaysAgo(180));
  const painTypeDistribution = Object.entries(
    countBy(
      entries
        .map((entry) => entry.painType)
        .filter((entry): entry is NonNullable<typeof entry> => entry != null),
    ),
  ).map(([name, value]) => ({ name, value }));

  return {
    generatedAt: new Date().toISOString(),
    entries,
    byRegion,
    insights,
    painTypeDistribution,
    groupedEntries: groupByDate(entries, (entry) => entry.startedAt),
  };
}

export function getMoodPageData() {
  const adapter = db();
  const year = currentYear();
  const from = `${year}-01-01`;
  const trends = getMoodTrends(adapter, from);
  const correlations = getMoodCorrelations(adapter, isoDaysAgo(180));
  const entries = getMoodEntries(adapter, isoDaysAgo(180));

  return {
    generatedAt: new Date().toISOString(),
    year,
    calendar: getMoodCalendar(adapter, year),
    trends,
    correlations,
    entries,
  };
}

export function getDigestivePageData() {
  const adapter = db();
  return {
    generatedAt: new Date().toISOString(),
    insights: getFodmapInsights(adapter),
    foodDiary: getFoodDiary(adapter, { limit: 60 }),
    stoolLogs: getStoolLogs(adapter, { limit: 30 }),
    foods: getFodmapFoods(adapter, { limit: 100 }),
  };
}

export function getCaregiverPageData() {
  const adapter = db();
  return {
    generatedAt: new Date().toISOString(),
    caregivers: getCaregivers(adapter),
    alertConfig: getAlertConfig(adapter),
    alertHistory: getAlertHistory(adapter),
    contacts: getContacts(adapter),
    appointments: getUpcomingAppointments(adapter).slice(0, 6),
    medications: getActiveMedications(adapter),
  };
}

export function getWeatherPageData() {
  const adapter = db();
  return {
    generatedAt: new Date().toISOString(),
    insights: getWeatherTriggerInsights(adapter, isoDaysAgo(180)),
    weatherHistory: getWeatherHistory(adapter, 60),
    links: getWeatherSymptomLinks(adapter),
  };
}

export function getSettingsPageData() {
  const adapter = db();

  return {
    generatedAt: new Date().toISOString(),
    settings: {
      glucoseUnit: parseSettingString(getSetting(adapter, 'glucose.unit'), 'mg/dL'),
      weightUnit: parseSettingString(getSetting(adapter, 'weight.unit'), 'kg'),
      medicationReminders: parseSettingBoolean(getSetting(adapter, 'notifications.medication_reminders'), true),
      caregiverAlerts: parseSettingBoolean(getSetting(adapter, 'notifications.caregiver_alerts'), false),
      biometricLock: parseSettingBoolean(getSetting(adapter, 'security.biometric_lock'), false),
      dataRetention: parseSettingString(getSetting(adapter, 'data.retention_policy'), '7_years'),
      cgmIntegration: parseSettingBoolean(getSetting(adapter, 'integrations.cgm_sync'), true),
      exportFormat: parseSettingString(getSetting(adapter, 'data.default_export_format'), 'pdf'),
      researchMode: parseSettingBoolean(getSetting(adapter, 'general.research_mode'), false),
    },
    caregivers: getCaregivers(adapter),
    alertConfig: getAlertConfig(adapter),
  };
}

export function getHistoryPageData(month: string = currentMonthKey()) {
  const adapter = db();
  const medications = getActiveMedications(adapter);
  const calendar = getAdherenceCalendar(adapter, month);
  const medicationBreakdown = medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    stats: getAdherenceStats(adapter, medication.id, 30),
    recentLogs: getDoseLogsForMedication(adapter, medication.id, {
      from: isoDaysAgo(30),
    }).slice(0, 8),
  }));

  const allLogs = medicationBreakdown.flatMap((item) =>
    item.recentLogs.map((log) => ({
      ...log,
      medicationName: item.name,
    })),
  );

  return {
    generatedAt: new Date().toISOString(),
    month,
    calendar,
    medications: medicationBreakdown,
    overall: getOverallStats(adapter),
    recentLogs: allLogs.sort((left, right) => right.scheduledTime.localeCompare(left.scheduledTime)).slice(0, 40),
  };
}

export function getTodayWindow() {
  return {
    from: startOfToday(),
    to: endOfToday(),
  };
}

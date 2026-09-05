'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  // Vitals
  logVital,
  getVitalsByType,
  getLatestVital,
  // Sleep
  getSleepSessions,
  getLastNightSleep,
  // Goals
  createGoal,
  getActiveGoals,
  deactivateGoal,
  // Emergency
  getEmergencyInfo,
  updateEmergencyInfo,
  // Documents
  createDocument,
  getDocuments,
  getDocumentsByType,
  getStarredDocuments,
  deleteDocument,
  // Settings
  getHealthSetting,
  setHealthSetting,
  getSleepJournalContext,
  getManualSleepBridgeStatus,
  setManualSleepBridgeEnabled,
  // Absorbed: Meds
  getActiveMedications,
  getDoseLogsForDate,
  getOverallStats,
  getMoodEntriesForDate,
  getMoodCalendarMonth,
  getOverallWellnessTimeline,
  getLowSupplyAlerts,
  generateDoctorReport,
  generateTherapyReport,
  // Migration
  detectAbsorbedModuleData,
  isAbsorptionMigrated,
  migrateAbsorbedSettings,
  disableAbsorbedModules,
} from '@mylife/health';
import { getActiveFast, getStreaks } from '@mylife/fast';
import type {
  VitalType,
  GoalDomain,
  GoalPeriod,
  GoalDirection,
  BloodType,
  DocumentType,
} from '@mylife/health';

function db() {
  ensureModuleMigrations('health');
  return getAdapter();
}

function bridgeDb() {
  ensureModuleMigrations('health');
  ensureModuleMigrations('sleep');
  return getAdapter();
}

// --- Dashboard ---

export async function fetchDashboard() {
  const d = db();
  const today = new Date().toISOString().slice(0, 10);

  const medications = (() => { try { return getActiveMedications(d); } catch { return []; } })();
  const todayDoses = (() => { try { return getDoseLogsForDate(d, today); } catch { return []; } })();
  const activeFast = (() => { try { return getActiveFast(d); } catch { return null; } })();
  const streaks = (() => { try { return getStreaks(d); } catch { return { currentStreak: 0, longestStreak: 0, totalFasts: 0 }; } })();
  const lastSleep = (() => { try { return getLastNightSleep(d); } catch { return null; } })();
  const latestSteps = (() => { try { return getLatestVital(d, 'steps'); } catch { return null; } })();
  const latestHR = (() => { try { return getLatestVital(d, 'heart_rate'); } catch { return null; } })();
  const todayMood = (() => {
    try {
      const entries = getMoodEntriesForDate(d, today);
      return entries.length > 0 ? entries[entries.length - 1] : null;
    } catch { return null; }
  })();
  const goals = (() => { try { return getActiveGoals(d); } catch { return []; } })();
  const supplyAlerts = (() => { try { return getLowSupplyAlerts(d); } catch { return []; } })();

  return {
    medications: medications.map((m) => ({ id: m.id, name: m.name, dosage: m.dosage, unit: m.unit })),
    todayDoseCount: todayDoses.length,
    activeFast: activeFast ? { protocol: activeFast.protocol, targetHours: activeFast.targetHours, startedAt: activeFast.startedAt } : null,
    streaks,
    lastSleep: lastSleep ? { durationMinutes: lastSleep.duration_minutes, qualityScore: lastSleep.quality_score } : null,
    latestSteps: latestSteps ? Math.round(latestSteps.value) : null,
    latestHR: latestHR ? Math.round(latestHR.value) : null,
    todayMood: todayMood ? { mood: todayMood.mood, pleasantness: todayMood.pleasantness } : null,
    goals: goals.slice(0, 5).map((g) => ({ id: g.id, domain: g.domain, metric: g.metric, targetValue: g.target_value, label: g.label, unit: g.unit })),
    supplyAlertCount: supplyAlerts.length,
  };
}

// --- Vitals ---

export async function fetchVitals(vitalType: VitalType, limit = 50) {
  return getVitalsByType(db(), vitalType, limit);
}

export async function fetchLatestVitals() {
  const d = db();
  const types: VitalType[] = ['heart_rate', 'resting_heart_rate', 'hrv', 'blood_oxygen', 'blood_pressure', 'body_temperature', 'steps', 'active_energy'];
  const results: Record<string, ReturnType<typeof getLatestVital>> = {};
  for (const t of types) {
    try { results[t] = getLatestVital(d, t); } catch { results[t] = null; }
  }
  return results;
}

export async function doLogVital(vitalType: VitalType, value: number, unit: string, valueSecondary?: number) {
  logVital(db(), { vital_type: vitalType, value, unit, value_secondary: valueSecondary, source: 'manual' });
}

// --- Sleep ---

export async function fetchSleepSessions(limit = 30) {
  return getSleepSessions(db(), limit);
}

export async function fetchSleepJournalContext() {
  try {
    return getSleepJournalContext(bridgeDb());
  } catch {
    return null;
  }
}

export async function fetchManualSleepBridgeStatus() {
  return getManualSleepBridgeStatus(bridgeDb());
}

export async function doSetManualSleepBridgeEnabled(enabled: boolean) {
  setManualSleepBridgeEnabled(bridgeDb(), enabled);
}

// --- Goals ---

export async function fetchActiveGoals() {
  return getActiveGoals(db());
}

export async function doCreateGoal(input: {
  domain: GoalDomain;
  metric: string;
  target_value: number;
  unit?: string;
  period?: GoalPeriod;
  direction?: GoalDirection;
  label?: string;
}) {
  return createGoal(db(), input);
}

export async function doDeactivateGoal(goalId: string) {
  deactivateGoal(db(), goalId);
}

// --- Emergency ---

export async function fetchEmergencyInfo() {
  return getEmergencyInfo(db());
}

export async function doUpdateEmergencyInfo(input: {
  full_name?: string;
  date_of_birth?: string;
  blood_type?: BloodType;
  allergies?: string;
  conditions?: string;
  emergency_contacts?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  primary_physician?: string;
  physician_phone?: string;
  notes?: string;
}) {
  updateEmergencyInfo(db(), input);
}

// --- Documents ---

export async function fetchDocuments() {
  return getDocuments(db());
}

export async function fetchDocumentsByType(type: DocumentType) {
  return getDocumentsByType(db(), type);
}

export async function fetchStarredDocuments() {
  return getStarredDocuments(db());
}

export async function doCreateDocument(input: {
  title: string;
  type: DocumentType;
  mime_type: string;
  content: Uint8Array;
  notes?: string;
  document_date?: string;
  tags?: string[];
}) {
  return createDocument(db(), input);
}

export async function doDeleteDocument(documentId: string) {
  deleteDocument(db(), documentId);
}

// --- Analytics ---

export async function fetchOverallStats() {
  try { return getOverallStats(db()); } catch { return null; }
}

export async function fetchWellnessTimeline(days = 14) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  try {
    return getOverallWellnessTimeline(db(), from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
  } catch { return []; }
}

export async function fetchMoodCalendar(year: number, month: number) {
  try { return getMoodCalendarMonth(db(), year, month); } catch { return []; }
}

// --- Reports ---

export async function doGenerateDoctorReport() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return generateDoctorReport(db(), from.toISOString().slice(0, 10), to);
}

export async function doGenerateTherapyReport() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return generateTherapyReport(db(), from.toISOString().slice(0, 10), to);
}

// --- Settings ---

export async function fetchHealthSetting(key: string) {
  try { return getHealthSetting(db(), key); } catch { return null; }
}

export async function doSetHealthSetting(key: string, value: string) {
  setHealthSetting(db(), key, value);
}

// --- Migration ---

export async function fetchMigrationStatus() {
  const d = db();
  return {
    alreadyMigrated: isAbsorptionMigrated(d),
    data: detectAbsorbedModuleData(d),
  };
}

export async function doAbsorptionMigration() {
  const d = db();
  migrateAbsorbedSettings(d);
  disableAbsorbedModules(d);
}

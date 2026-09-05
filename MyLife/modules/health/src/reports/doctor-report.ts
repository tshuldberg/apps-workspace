/**
 * Comprehensive doctor visit report generator.
 * Extends the meds doctor report with vitals, sleep, activity,
 * breathing, emergency info, and cross-domain correlations.
 *
 * Takes a DatabaseAdapter and queries all health-domain tables.
 * Output is Markdown suitable for printing or PDF conversion.
 */

import type { DatabaseAdapter } from '@mylife/db';

interface VitalRow {
  vital_type: string;
  value: number;
  value_secondary: number | null;
  unit: string;
  recorded_at: string;
}

interface SleepRow {
  start_time: string;
  duration_minutes: number;
  quality_score: number | null;
  deep_minutes: number | null;
  rem_minutes: number | null;
}

interface ActivityRow {
  date: string;
  steps: number;
  active_energy_cal: number;
  move_minutes: number;
}

interface EmergencyRow {
  full_name: string | null;
  date_of_birth: string | null;
  blood_type: string | null;
  allergies: string | null;
  conditions: string | null;
  emergency_contacts: string | null;
  primary_physician: string | null;
  physician_phone: string | null;
  organ_donor: number | null;
}

interface MedRow {
  name: string;
  dosage: string | null;
  frequency: string;
  created_at: string;
  is_active: number;
}

interface DoseStatsRow {
  total: number;
  taken: number;
}

interface MoodRow {
  pleasantness: string;
  mood: string;
}

interface SymptomRow {
  name: string;
  count: number;
}

interface MeasurementRow {
  type: string;
  value: string;
  unit: string;
  measured_at: string;
}

function safeQuery<T>(db: DatabaseAdapter, sql: string, params?: unknown[]): T[] {
  try {
    return db.query<T>(sql, params);
  } catch {
    return [];
  }
}

/**
 * Generate a comprehensive health report for doctor visits.
 * Combines medication data with vitals, sleep, activity, and emergency info.
 */
export function generateComprehensiveDoctorReport(
  db: DatabaseAdapter,
  from: string,
  to: string,
): string {
  const lines: string[] = [];

  lines.push(`# Comprehensive Health Report`);
  lines.push(`**Period:** ${from} to ${to}`);
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Emergency / patient info
  const emergency = db.query<EmergencyRow>(
    `SELECT full_name, date_of_birth, blood_type, allergies, conditions,
            emergency_contacts, primary_physician, physician_phone, organ_donor
     FROM hl_emergency_info LIMIT 1`,
  );
  if (emergency.length > 0) {
    const e = emergency[0];
    lines.push('## Patient Information');
    if (e.full_name) lines.push(`**Name:** ${e.full_name}`);
    if (e.date_of_birth) lines.push(`**DOB:** ${e.date_of_birth}`);
    if (e.blood_type) lines.push(`**Blood Type:** ${e.blood_type}`);
    if (e.allergies) lines.push(`**Allergies:** ${e.allergies}`);
    if (e.conditions) lines.push(`**Conditions:** ${e.conditions}`);
    if (e.primary_physician) lines.push(`**Physician:** ${e.primary_physician} ${e.physician_phone ?? ''}`);
    if (e.organ_donor !== null) lines.push(`**Organ Donor:** ${e.organ_donor ? 'Yes' : 'No'}`);
    lines.push('');
  }

  // Medications (md_* tables may not exist if meds module not installed)
  lines.push('## Medications');
  const meds = safeQuery<MedRow>(db,
    'SELECT name, dosage, frequency, created_at, is_active FROM md_medications ORDER BY is_active DESC, name ASC LIMIT 100',
  );
  if (meds.length === 0) {
    lines.push('No medications recorded.');
  } else {
    lines.push('| Medication | Dosage | Frequency | Started | Status |');
    lines.push('|------------|--------|-----------|---------|--------|');
    for (const med of meds) {
      const status = med.is_active ? 'Active' : 'Inactive';
      lines.push(`| ${med.name} | ${med.dosage ?? '-'} | ${med.frequency} | ${med.created_at.slice(0, 10)} | ${status} |`);
    }
  }
  lines.push('');

  // Adherence
  lines.push('## Medication Adherence');
  const doseStats = safeQuery<DoseStatsRow>(db,
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs WHERE scheduled_time >= ? AND scheduled_time <= ?`,
    [from, to],
  );
  if (doseStats.length > 0 && doseStats[0].total > 0) {
    const rate = Math.round((doseStats[0].taken / doseStats[0].total) * 100);
    lines.push(`Overall adherence: **${rate}%** (${doseStats[0].taken}/${doseStats[0].total} doses taken)`);
  } else {
    lines.push('No dose records in this period.');
  }
  lines.push('');

  // Vitals
  lines.push('## Vitals');
  const vitals = db.query<VitalRow>(
    `SELECT vital_type, value, value_secondary, unit, recorded_at
     FROM hl_vitals WHERE recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at DESC LIMIT 50`,
    [from, to],
  );
  if (vitals.length === 0) {
    lines.push('No vitals recorded in this period.');
  } else {
    // Group by type and show latest + average
    const byType = new Map<string, VitalRow[]>();
    for (const v of vitals) {
      const arr = byType.get(v.vital_type) ?? [];
      arr.push(v);
      byType.set(v.vital_type, arr);
    }
    lines.push('| Vital | Latest | Average | Readings | Unit |');
    lines.push('|-------|--------|---------|----------|------|');
    for (const [type, readings] of byType) {
      const latest = readings[0].value;
      const avg = Math.round((readings.reduce((s, r) => s + r.value, 0) / readings.length) * 10) / 10;
      const bpSuffix = type === 'blood_pressure' && readings[0].value_secondary
        ? `/${readings[0].value_secondary}` : '';
      lines.push(`| ${formatVitalType(type)} | ${latest}${bpSuffix} | ${avg} | ${readings.length} | ${readings[0].unit} |`);
    }
  }
  lines.push('');

  // Sleep
  lines.push('## Sleep');
  const sleep = db.query<SleepRow>(
    `SELECT start_time, duration_minutes, quality_score, deep_minutes, rem_minutes
     FROM hl_sleep_sessions WHERE start_time >= ? AND start_time <= ?
     ORDER BY start_time DESC LIMIT 400`,
    [from, to],
  );
  if (sleep.length === 0) {
    lines.push('No sleep sessions recorded in this period.');
  } else {
    const avgDuration = Math.round(sleep.reduce((s, r) => s + r.duration_minutes, 0) / sleep.length);
    const avgQuality = sleep.filter((s) => s.quality_score !== null);
    const qualityStr = avgQuality.length > 0
      ? `${Math.round(avgQuality.reduce((s, r) => s + (r.quality_score ?? 0), 0) / avgQuality.length)}%`
      : 'N/A';
    lines.push(`- **Average duration:** ${Math.floor(avgDuration / 60)}h ${avgDuration % 60}m`);
    lines.push(`- **Average quality:** ${qualityStr}`);
    lines.push(`- **Sessions recorded:** ${sleep.length}`);
  }
  lines.push('');

  // Activity
  lines.push('## Activity');
  const activity = db.query<ActivityRow>(
    `SELECT date, steps, active_energy_cal, move_minutes
     FROM hl_activity_summaries WHERE date >= ? AND date <= ?
     ORDER BY date DESC LIMIT 400`,
    [from, to],
  );
  if (activity.length === 0) {
    lines.push('No activity data recorded in this period.');
  } else {
    const avgSteps = Math.round(activity.reduce((s, r) => s + r.steps, 0) / activity.length);
    const avgEnergy = Math.round(activity.reduce((s, r) => s + r.active_energy_cal, 0) / activity.length);
    lines.push(`- **Average daily steps:** ${avgSteps.toLocaleString()}`);
    lines.push(`- **Average active energy:** ${avgEnergy} cal`);
    lines.push(`- **Days tracked:** ${activity.length}`);
  }
  lines.push('');

  // Health measurements (from meds)
  lines.push('## Health Measurements');
  const measurements = safeQuery<MeasurementRow>(db,
    `SELECT type, value, unit, measured_at FROM md_measurements
     WHERE measured_at >= ? AND measured_at <= ?
     ORDER BY measured_at DESC LIMIT 20`,
    [from, to],
  );
  if (measurements.length === 0) {
    lines.push('No measurements recorded in this period.');
  } else {
    lines.push('| Date | Type | Value | Unit |');
    lines.push('|------|------|-------|------|');
    for (const m of measurements) {
      lines.push(`| ${m.measured_at.slice(0, 10)} | ${m.type} | ${m.value} | ${m.unit} |`);
    }
  }
  lines.push('');

  // Mood summary
  lines.push('## Mood Summary');
  const moodEntries = safeQuery<MoodRow>(db,
    `SELECT pleasantness, mood FROM md_mood_entries
     WHERE recorded_at >= ? AND recorded_at <= ?`,
    [from, to],
  );
  if (moodEntries.length === 0) {
    lines.push('No mood entries recorded in this period.');
  } else {
    const pleasant = moodEntries.filter((m) => m.pleasantness === 'pleasant').length;
    const unpleasant = moodEntries.filter((m) => m.pleasantness === 'unpleasant').length;
    lines.push(`Total entries: ${moodEntries.length}`);
    lines.push(`- Pleasant: ${pleasant} (${Math.round((pleasant / moodEntries.length) * 100)}%)`);
    lines.push(`- Unpleasant: ${unpleasant} (${Math.round((unpleasant / moodEntries.length) * 100)}%)`);
    lines.push(`- Neutral: ${moodEntries.length - pleasant - unpleasant}`);
  }
  lines.push('');

  // Symptoms
  lines.push('## Symptom Log');
  const symptoms = safeQuery<SymptomRow>(db,
    `SELECT s.name, COUNT(*) as count FROM md_symptom_logs sl
     JOIN md_symptoms s ON s.id = sl.symptom_id
     WHERE sl.logged_at >= ? AND sl.logged_at <= ?
     GROUP BY s.name ORDER BY count DESC`,
    [from, to],
  );
  if (symptoms.length === 0) {
    lines.push('No symptoms logged in this period.');
  } else {
    lines.push('| Symptom | Occurrences |');
    lines.push('|---------|-------------|');
    for (const s of symptoms) {
      lines.push(`| ${s.name} | ${s.count} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('*Generated by MyHealth. All data stored locally on your device.*');

  return lines.join('\n');
}

function formatVitalType(type: string): string {
  const labels: Record<string, string> = {
    heart_rate: 'Heart Rate',
    resting_heart_rate: 'Resting HR',
    hrv: 'HRV',
    blood_oxygen: 'Blood Oxygen',
    blood_pressure: 'Blood Pressure',
    body_temperature: 'Temperature',
    steps: 'Steps',
    active_energy: 'Active Energy',
    respiratory_rate: 'Respiratory Rate',
    vo2_max: 'VO2 Max',
  };
  return labels[type] ?? type;
}

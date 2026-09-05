import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { getMedicationInsights } from '../engine/medication-insights';
import { getRegimenSummary } from '../engine/regimen-summary';
import { getWellnessScore } from '../engine/wellness-score';

function uuid(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoDate(daysAgo: number, hour = 8): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

describe('Intelligence Engines', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ── Medication Insights Engine ───────────────────────────────────────────

  describe('getMedicationInsights', () => {
    it('returns empty array with no data', () => {
      const insights = getMedicationInsights(adapter);
      expect(insights).toEqual([]);
    });

    it('detects weekend adherence dip', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Aspirin', 'daily', 1)`,
        [medId],
      );

      // Seed 30 days of dose logs: weekdays taken, weekends skipped
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const day = date.getDay();
        const isWeekend = day === 0 || day === 6;
        const status = isWeekend ? 'skipped' : 'taken';

        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, ?)`,
          [uuid(), medId, date.toISOString(), status],
        );
      }

      const insights = getMedicationInsights(adapter);
      const weekendInsight = insights.find((i) => i.id === 'weekend-adherence-dip');
      expect(weekendInsight).toBeDefined();
      expect(weekendInsight!.category).toBe('adherence_pattern');
      expect(weekendInsight!.value).toBeLessThan(weekendInsight!.referenceValue!);
    });

    it('detects low per-medication adherence', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Metformin', 'daily', 1)`,
        [medId],
      );

      // Seed 20 days: only 5 taken
      for (let i = 0; i < 20; i++) {
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, ?)`,
          [uuid(), medId, isoDate(i), i < 5 ? 'taken' : 'skipped'],
        );
      }

      const insights = getMedicationInsights(adapter);
      const lowAdherence = insights.find((i) => i.id === `low-adherence-${medId}`);
      expect(lowAdherence).toBeDefined();
      expect(lowAdherence!.severity).toBe('alert');
    });

    it('detects refill alerts for low supply', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active, pill_count, pills_per_dose)
         VALUES (?, 'Lisinopril', 'daily', 1, 5, 1)`,
        [medId],
      );

      const insights = getMedicationInsights(adapter);
      const refillAlert = insights.find((i) => i.id === `refill-${medId}`);
      expect(refillAlert).toBeDefined();
      expect(refillAlert!.category).toBe('refill_alert');
      expect(refillAlert!.severity).toBe('warning'); // 5 days left = warning (<=3 is alert)
    });

    it('sorts insights by severity (alert > warning > info)', () => {
      const med1 = uuid();
      const med2 = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active, pill_count, pills_per_dose)
         VALUES (?, 'Med1', 'daily', 1, 2, 1)`,
        [med1],
      );
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active, pill_count, pills_per_dose)
         VALUES (?, 'Med2', 'daily', 1, 10, 1)`,
        [med2],
      );

      const insights = getMedicationInsights(adapter);
      if (insights.length >= 2) {
        const severities = insights.map((i) => i.severity);
        const alertIdx = severities.indexOf('alert');
        const infoIdx = severities.indexOf('info');
        if (alertIdx !== -1 && infoIdx !== -1) {
          expect(alertIdx).toBeLessThan(infoIdx);
        }
      }
    });
  });

  // ── Regimen Summary Engine ─────────────────────────────────────────────

  describe('getRegimenSummary', () => {
    it('returns a valid summary with no data', () => {
      const summary = getRegimenSummary(adapter);
      expect(summary.date).toBeDefined();
      expect(summary.adherenceStreak).toBe(0);
      expect(summary.adherence7d).toBe(100); // no data = 100%
      expect(summary.todaySchedule).toEqual([]);
      expect(summary.todayProgress).toEqual({ taken: 0, total: 0 });
      expect(summary.vitals.latestBP).toBeNull();
      expect(summary.vitals.latestGlucose).toBeNull();
      expect(summary.vitals.latestA1c).toBeNull();
      expect(summary.activeMedicationCount).toBe(0);
    });

    it('includes today schedule from active reminders', () => {
      const medId = uuid();
      const remId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Aspirin', 'daily', 1)`,
        [medId],
      );
      adapter.execute(
        `INSERT INTO md_reminders (id, medication_id, time, days_of_week, is_active)
         VALUES (?, ?, '08:00', '[0,1,2,3,4,5,6]', 1)`,
        [remId, medId],
      );

      const summary = getRegimenSummary(adapter);
      expect(summary.todaySchedule.length).toBe(1);
      expect(summary.todaySchedule[0].medicationName).toBe('Aspirin');
      expect(summary.activeMedicationCount).toBe(1);
    });

    it('includes latest vitals', () => {
      adapter.execute(
        `INSERT INTO md_bp_readings (id, systolic, diastolic, pulse, category, measured_at)
         VALUES (?, 120, 80, 72, 'normal', ?)`,
        [uuid(), new Date().toISOString()],
      );

      const summary = getRegimenSummary(adapter);
      expect(summary.vitals.latestBP).not.toBeNull();
      expect(summary.vitals.latestBP!.systolic).toBe(120);
      expect(summary.vitals.latestBP!.category).toBe('normal');
    });

    it('generates BP crisis alert', () => {
      adapter.execute(
        `INSERT INTO md_bp_readings (id, systolic, diastolic, category, measured_at)
         VALUES (?, 190, 120, 'crisis', ?)`,
        [uuid(), new Date().toISOString()],
      );

      const summary = getRegimenSummary(adapter);
      const crisisAlert = summary.alerts.find((a) => a.type === 'bp_crisis');
      expect(crisisAlert).toBeDefined();
      expect(crisisAlert!.severity).toBe('alert');
    });

    it('calculates adherence streak', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Test', 'daily', 1)`,
        [medId],
      );

      // 5 consecutive days of perfect adherence
      for (let i = 0; i < 5; i++) {
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'taken')`,
          [uuid(), medId, isoDate(i)],
        );
      }
      // Day 6 has a skip (breaks streak)
      adapter.execute(
        `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
         VALUES (?, ?, ?, 'skipped')`,
        [uuid(), medId, isoDate(5)],
      );

      const summary = getRegimenSummary(adapter);
      expect(summary.adherenceStreak).toBe(5);
    });

    // ── todaySchedule fallback status-matching ───────────────────────────────
    // Covers the slotKeys / fallbackByMedication logic: a take logged ad hoc
    // (with the moment it was taken, not the slot's canonical scheduled_time)
    // must still mark exactly one pending slot done, and a skipped ad-hoc log
    // must land on a pending slot too. Without this, ad-hoc takes leave the
    // checklist stuck on pending or double-count.
    describe('todaySchedule fallback status-matching', () => {
      // Fixed target date so dateStr and dayOfWeek are deterministic. days_of_week
      // is all 7 days, so the slot is always due regardless of which day this is.
      const targetDate = new Date('2026-06-15T12:00:00Z');
      const dateStr = targetDate.toISOString().slice(0, 10); // 2026-06-15

      function seedMedWithSlot(medId: string, remId: string, time: string): void {
        adapter.execute(
          `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Aspirin', 'daily', 1)`,
          [medId],
        );
        adapter.execute(
          `INSERT INTO md_reminders (id, medication_id, time, days_of_week, is_active)
           VALUES (?, ?, ?, '[0,1,2,3,4,5,6]', 1)`,
          [remId, medId, time],
        );
      }

      it('marks the slot done from an exact canonical-time taken log', () => {
        const medId = uuid();
        seedMedWithSlot(medId, uuid(), '08:00');

        // Logged against the slot's canonical time -> exact slotKeys match.
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'taken')`,
          [uuid(), medId, `${dateStr}T08:00`],
        );

        const summary = getRegimenSummary(adapter, targetDate);
        expect(summary.todaySchedule).toHaveLength(1);
        expect(summary.todaySchedule[0].status).toBe('taken');
        expect(summary.todayProgress).toEqual({ taken: 1, total: 1 });
      });

      it('marks one pending slot done from an ad-hoc taken log with a NON-canonical timestamp', () => {
        const medId = uuid();
        seedMedWithSlot(medId, uuid(), '08:00');

        // Logged with the exact moment taken (seconds + ms), NOT the slot's
        // canonical time, so it lands in the per-medication fallback queue.
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'taken')`,
          [uuid(), medId, `${dateStr}T08:07:33.000Z`],
        );

        const summary = getRegimenSummary(adapter, targetDate);
        expect(summary.todaySchedule).toHaveLength(1);
        expect(summary.todaySchedule[0].status).toBe('taken');
        // Exactly one slot consumed the fallback log: not double-counted.
        expect(summary.todayProgress).toEqual({ taken: 1, total: 1 });
      });

      it('lands a skipped ad-hoc log on a pending slot', () => {
        const medId = uuid();
        seedMedWithSlot(medId, uuid(), '08:00');

        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'skipped')`,
          [uuid(), medId, `${dateStr}T08:07:33.000Z`],
        );

        const summary = getRegimenSummary(adapter, targetDate);
        expect(summary.todaySchedule).toHaveLength(1);
        expect(summary.todaySchedule[0].status).toBe('skipped');
        // Skipped does not count toward taken progress.
        expect(summary.todayProgress).toEqual({ taken: 0, total: 1 });
      });

      it('consumes one fallback log per slot without double-counting across two slots', () => {
        const medId = uuid();
        // Two canonical slots for the same medication today.
        adapter.execute(
          `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Aspirin', 'twice_daily', 1)`,
          [medId],
        );
        adapter.execute(
          `INSERT INTO md_reminders (id, medication_id, time, days_of_week, is_active)
           VALUES (?, ?, '08:00', '[0,1,2,3,4,5,6]', 1)`,
          [uuid(), medId],
        );
        adapter.execute(
          `INSERT INTO md_reminders (id, medication_id, time, days_of_week, is_active)
           VALUES (?, ?, '20:00', '[0,1,2,3,4,5,6]', 1)`,
          [uuid(), medId],
        );

        // A single ad-hoc taken log: only ONE of the two slots should flip.
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'taken')`,
          [uuid(), medId, `${dateStr}T09:15:00.000Z`],
        );

        const summary = getRegimenSummary(adapter, targetDate);
        expect(summary.todaySchedule).toHaveLength(2);
        const takenCount = summary.todaySchedule.filter((d) => d.status === 'taken').length;
        const pendingCount = summary.todaySchedule.filter((d) => d.status === 'pending').length;
        expect(takenCount).toBe(1);
        expect(pendingCount).toBe(1);
        expect(summary.todayProgress).toEqual({ taken: 1, total: 2 });
      });
    });
  });

  // ── Wellness Score Engine ──────────────────────────────────────────────

  describe('getWellnessScore', () => {
    it('returns a valid score with no data', () => {
      const score = getWellnessScore(adapter);
      expect(score.composite).toBeGreaterThanOrEqual(0);
      expect(score.composite).toBeLessThanOrEqual(100);
      expect(score.components).toHaveLength(4);
      expect(score.trend).toMatch(/^(improving|stable|declining)$/);
      expect(score.isConfident).toBe(false); // no data = not confident
    });

    it('returns high score with perfect adherence and good vitals', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Test', 'daily', 1)`,
        [medId],
      );

      // 7 days of perfect adherence
      for (let i = 0; i < 7; i++) {
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, 'taken')`,
          [uuid(), medId, isoDate(i)],
        );
      }

      // Good BP readings
      for (let i = 0; i < 3; i++) {
        adapter.execute(
          `INSERT INTO md_bp_readings (id, systolic, diastolic, category, measured_at)
           VALUES (?, 118, 78, 'normal', ?)`,
          [uuid(), isoDate(i)],
        );
      }

      const score = getWellnessScore(adapter);
      expect(score.composite).toBeGreaterThanOrEqual(70);
      expect(score.isConfident).toBe(true); // 7 doses + 3 BP = 10 data points
    });

    it('returns lower score with poor adherence', () => {
      const medId = uuid();
      adapter.execute(
        `INSERT INTO md_medications (id, name, frequency, is_active) VALUES (?, 'Test', 'daily', 1)`,
        [medId],
      );

      // 7 days, only 2 taken
      for (let i = 0; i < 7; i++) {
        adapter.execute(
          `INSERT INTO md_dose_logs (id, medication_id, scheduled_time, status)
           VALUES (?, ?, ?, ?)`,
          [uuid(), medId, isoDate(i), i < 2 ? 'taken' : 'skipped'],
        );
      }

      const score = getWellnessScore(adapter);
      expect(score.composite).toBeLessThan(70);
    });

    it('includes all four components', () => {
      const score = getWellnessScore(adapter);
      const names = score.components.map((c) => c.name);
      expect(names).toContain('Adherence');
      expect(names).toContain('Vitals');
      expect(names).toContain('Mood Stability');
      expect(names).toContain('Symptom Burden');
    });

    it('weights sum to 1.0', () => {
      const score = getWellnessScore(adapter);
      const totalWeight = score.components.reduce((s, c) => s + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('factors in symptom burden', () => {
      // Seed high-severity symptoms
      const symptomId = uuid();
      adapter.execute(
        `INSERT INTO md_symptoms (id, name) VALUES (?, 'Headache')`,
        [symptomId],
      );
      for (let i = 0; i < 14; i++) {
        adapter.execute(
          `INSERT INTO md_symptom_logs (id, symptom_id, severity, logged_at)
           VALUES (?, ?, 5, ?)`,
          [uuid(), symptomId, isoDate(i % 7)],
        );
      }

      const score = getWellnessScore(adapter);
      const symptomComponent = score.components.find((c) => c.name === 'Symptom Burden');
      expect(symptomComponent).toBeDefined();
      expect(symptomComponent!.score).toBeLessThan(50); // High burden = low score
    });
  });
});

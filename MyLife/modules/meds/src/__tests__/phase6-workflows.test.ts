import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import {
  createFoodDiaryEntry,
  createStoolLog,
  getFoodDiary,
  getFodmapFoods,
  getFodmapInsights,
  getStoolLogs,
  searchFodmapFoods,
} from '../fodmap/records';
import {
  createCaregiver,
  getAlertConfig,
  getAlertHistory,
  getCaregivers,
  recordCaregiverAlert,
  updateAlertConfig,
  updateCaregiver,
} from '../caregiver/crud';

describe('phase 6 workflows', () => {
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

  describe('fodmap records', () => {
    it('seeds foods and supports search, diary, and stool logs', () => {
      const foods = getFodmapFoods(adapter, { limit: 10 });
      expect(foods.length).toBeGreaterThan(0);

      const matches = searchFodmapFoods(adapter, 'garlic');
      expect(matches[0]?.name).toBe('garlic');

      createFoodDiaryEntry(adapter, {
        mealType: 'dinner',
        foodItems: 'garlic, rice',
        portionSize: '1 bowl',
        eatenAt: '2026-04-07T18:30:00.000Z',
      });
      createStoolLog(adapter, {
        bristolType: 4,
        urgency: 2,
        painLevel: 1,
        loggedAt: '2026-04-07T20:00:00.000Z',
      });

      const diary = getFoodDiary(adapter);
      const stools = getStoolLogs(adapter);
      expect(diary).toHaveLength(1);
      expect(diary[0].fodmapRating).toBe('high');
      expect(stools).toHaveLength(1);
      expect(stools[0].bristolType).toBe(4);
    });

    it('builds trigger and safe-food insights from diary plus symptoms', () => {
      adapter.execute(
        `INSERT INTO md_symptoms (id, name, is_custom, created_at)
         VALUES (?, ?, 0, datetime('now'))`,
        ['symptom-gas', 'gas'],
      );

      for (let index = 0; index < 6; index += 1) {
        const date = `2026-04-${String(index + 1).padStart(2, '0')}`;
        createFoodDiaryEntry(adapter, {
          mealType: 'dinner',
          foodItems: 'garlic, rice',
          eatenAt: `${date}T18:00:00.000Z`,
        });
        createFoodDiaryEntry(adapter, {
          mealType: 'lunch',
          foodItems: 'banana',
          eatenAt: `${date}T20:30:00.000Z`,
        });
        adapter.execute(
          `INSERT INTO md_symptom_logs (id, symptom_id, severity, notes, logged_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `sym-log-${index}`,
            'symptom-gas',
            4,
            'post meal',
            `${date}T21:00:00.000Z`,
            `${date}T21:00:00.000Z`,
          ],
        );
      }

      const insights = getFodmapInsights(adapter, { today: '2026-04-06' });
      expect(insights.todayLoad.mealCount).toBeGreaterThan(0);
      expect(insights.triggerFoods.some((item) => item.foodName === 'garlic')).toBe(true);
      expect(insights.recentSymptoms[0]?.name).toBe('gas');
      expect(insights.recentSymptoms[0]?.relatedMeals.length).toBeGreaterThan(0);
    });
  });

  describe('caregiver records', () => {
    it('creates caregivers, updates rules, and records alert history', () => {
      const caregiver = createCaregiver(adapter, {
        name: 'Taylor Rivera',
        phone: '555-000-1111',
        relationship: 'friend',
      });

      expect(getCaregivers(adapter)).toHaveLength(1);

      const updated = updateCaregiver(adapter, caregiver.id, {
        email: 'taylor@example.com',
        isActive: false,
      });
      expect(updated?.email).toBe('taylor@example.com');
      expect(updated?.isActive).toBe(false);

      const nextConfig = updateAlertConfig(adapter, {
        alertMethod: 'sms',
        updatedAt: '2026-04-07T10:00:00.000Z',
        rules: [
          { key: 'missed_dose', enabled: true, threshold: 45, unit: 'min' },
          { key: 'abnormal_bp', enabled: true, threshold: 150, unit: 'systolic' },
          { key: 'glucose_low', enabled: true, threshold: 72, unit: 'mg/dL' },
          { key: 'glucose_high', enabled: false, threshold: 180, unit: 'mg/dL' },
          { key: 'missed_check_in', enabled: true, threshold: 8, unit: 'hr' },
        ],
      });

      expect(getAlertConfig(adapter).alertMethod).toBe('sms');
      expect(nextConfig.rules.find((rule) => rule.key === 'missed_dose')?.threshold).toBe(45);

      recordCaregiverAlert(adapter, {
        caregiverId: caregiver.id,
        alertType: 'missed_dose',
        message: 'Missed morning dose',
        deliveryMethod: 'sms',
        status: 'sent',
        sentAt: '2026-04-07T11:00:00.000Z',
      });

      const history = getAlertHistory(adapter);
      expect(history).toHaveLength(1);
      expect(history[0].caregiverName).toBe('Taylor Rivera');
      expect(history[0].status).toBe('sent');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  computeRefillRisk,
  getMedicationsForTrip,
  type MedicationLink,
} from '../integrations/meds-link';

function createMedsTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE md_medications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      dosage TEXT,
      unit TEXT,
      frequency TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);
  adapter.execute(`
    CREATE TABLE md_refills (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL,
      quantity INTEGER NOT NULL
    )
  `);
}

function insertMed(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    name: string;
    dosage?: string;
    unit?: string;
    frequency?: string;
    isActive?: number;
    sortOrder?: number;
  },
): void {
  adapter.execute(
    `INSERT INTO md_medications (id, name, dosage, unit, frequency, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.name,
      params.dosage ?? null,
      params.unit ?? null,
      params.frequency ?? null,
      params.isActive ?? 1,
      params.sortOrder ?? 0,
    ],
  );
}

function insertRefill(
  adapter: DatabaseAdapter,
  id: string,
  medicationId: string,
  quantity: number,
): void {
  adapter.execute(
    `INSERT INTO md_refills (id, medication_id, quantity) VALUES (?, ?, ?)`,
    [id, medicationId, quantity],
  );
}

describe('@mylife/travel meds-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns [] when md_medications is missing (Meds not installed)', () => {
    expect(getMedicationsForTrip(adapter, 'trip_1')).toEqual([]);
  });

  it('returns active medications with dose summary and refill totals', () => {
    createMedsTables(adapter);
    insertMed(adapter, {
      id: 'med_1',
      name: 'Metformin',
      dosage: '500',
      unit: 'mg',
      frequency: 'daily',
    });
    insertMed(adapter, {
      id: 'med_2',
      name: 'Old Med',
      dosage: '10',
      unit: 'mg',
      isActive: 0,
    });
    insertRefill(adapter, 'r1', 'med_1', 2);
    insertRefill(adapter, 'r2', 'med_1', 1);

    const result = getMedicationsForTrip(adapter, 'trip_1');
    expect(result).toHaveLength(1);
    expect(result[0]!.medicationId).toBe('med_1');
    expect(result[0]!.name).toBe('Metformin');
    expect(result[0]!.doseSummary).toBe('500 mg daily');
    expect(result[0]!.refillsRemaining).toBe(3);
  });

  it('omits refillsRemaining when no refills are recorded', () => {
    createMedsTables(adapter);
    insertMed(adapter, { id: 'med_x', name: 'Aspirin' });
    const result = getMedicationsForTrip(adapter, 'trip_1');
    expect(result).toHaveLength(1);
    expect(result[0]!.refillsRemaining).toBeUndefined();
  });

  it('computeRefillRisk returns ok when no refill info is available', () => {
    const med: MedicationLink = { medicationId: 'm', name: 'x' };
    expect(computeRefillRisk(med, 10)).toBe('ok');
    expect(computeRefillRisk(med, 400)).toBe('ok');
  });

  it('computeRefillRisk boundary cases: risk / tight / ok', () => {
    const med = (remaining: number): MedicationLink => ({
      medicationId: 'm',
      name: 'x',
      refillsRemaining: remaining,
    });
    // 30 days -> needed = 1
    expect(computeRefillRisk(med(0), 30)).toBe('risk');
    expect(computeRefillRisk(med(1), 30)).toBe('tight');
    expect(computeRefillRisk(med(2), 30)).toBe('ok');
    // 45 days -> needed = 2 (ceil(45/30))
    expect(computeRefillRisk(med(1), 45)).toBe('risk');
    expect(computeRefillRisk(med(2), 45)).toBe('tight');
    expect(computeRefillRisk(med(3), 45)).toBe('ok');
    // 0 days -> needed = 0, always ok
    expect(computeRefillRisk(med(0), 0)).toBe('tight');
  });
});

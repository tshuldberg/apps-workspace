import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createMedicationExtended } from '../medication';
import {
  seedAdditionalInteractions,
  checkInteractions,
  getInteractionsForMedication,
} from '../interactions';

describe('drug interaction checker', () => {
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

  describe('checkInteractions', () => {
    it('CRITICAL: Warfarin + Aspirin returns interaction warning', () => {
      // The migration seeds 50 interactions including Warfarin + Aspirin
      const warnings = checkInteractions(adapter, 'Warfarin', ['Aspirin']);
      expect(warnings.length).toBeGreaterThanOrEqual(1);

      const warfarinAspirin = warnings.find(
        (w) => w.drug.toLowerCase() === 'aspirin',
      );
      expect(warfarinAspirin).toBeDefined();
      expect(warfarinAspirin!.severity).toBeTruthy();
      expect(warfarinAspirin!.description).toBeTruthy();
    });

    it('returns empty array when no interactions found', () => {
      const warnings = checkInteractions(adapter, 'VitaminC', ['VitaminD']);
      expect(warnings).toEqual([]);
    });

    it('returns empty array with empty active meds list', () => {
      const warnings = checkInteractions(adapter, 'Warfarin', []);
      expect(warnings).toEqual([]);
    });

    it('is case insensitive', () => {
      const warnings1 = checkInteractions(adapter, 'warfarin', ['aspirin']);
      const warnings2 = checkInteractions(adapter, 'WARFARIN', ['ASPIRIN']);
      expect(warnings1.length).toBe(warnings2.length);
    });

    it('checks reverse direction (drug_b checked against drug_a)', () => {
      const warnings = checkInteractions(adapter, 'Aspirin', ['Warfarin']);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getInteractionsForMedication', () => {
    it('returns interactions for a medication by ID', () => {
      createMedicationExtended(adapter, 'm1', { name: 'Warfarin' });

      const interactions = getInteractionsForMedication(adapter, 'm1');
      expect(interactions.length).toBeGreaterThanOrEqual(1);

      // Warfarin has multiple known interactions
      const drugNames = interactions.map((i) => i.drug.toLowerCase());
      expect(drugNames).toContain('aspirin');
    });

    it('returns empty array for medication with no interactions', () => {
      createMedicationExtended(adapter, 'm1', { name: 'UniqueVitaminXYZ' });

      const interactions = getInteractionsForMedication(adapter, 'm1');
      expect(interactions).toEqual([]);
    });

    it('returns empty array for non-existent medication', () => {
      const interactions = getInteractionsForMedication(adapter, 'nope');
      expect(interactions).toEqual([]);
    });
  });

  describe('seedAdditionalInteractions', () => {
    it('populates additional interactions table', () => {
      const beforeCount = adapter.query<{ c: number }>(
        'SELECT COUNT(*) as c FROM md_interactions',
      )[0].c;

      seedAdditionalInteractions(adapter);

      const afterCount = adapter.query<{ c: number }>(
        'SELECT COUNT(*) as c FROM md_interactions',
      )[0].c;

      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    });

    it('is idempotent (can be called multiple times)', () => {
      seedAdditionalInteractions(adapter);
      const count1 = adapter.query<{ c: number }>(
        'SELECT COUNT(*) as c FROM md_interactions',
      )[0].c;

      seedAdditionalInteractions(adapter);
      const count2 = adapter.query<{ c: number }>(
        'SELECT COUNT(*) as c FROM md_interactions',
      )[0].c;

      expect(count2).toBe(count1);
    });
  });
});

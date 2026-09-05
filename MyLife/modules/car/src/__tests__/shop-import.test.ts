import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CAR_MODULE } from '../definition';
import {
  importMaintenanceFromPurchase,
  getPendingCarImports,
  type MaintenanceLogEntry,
} from '../integrations/shop-import';
import { createVehicle, getMaintenanceByVehicle, createMaintenance } from '../db';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('car', CAR_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function entry(overrides: Partial<MaintenanceLogEntry> = {}): MaintenanceLogEntry {
  return {
    description: 'Brake pads',
    partType: 'other',
    costCents: 8500,
    occurredAt: '2026-04-10',
    sourcePurchaseId: 'p1',
    ...overrides,
  };
}

describe('importMaintenanceFromPurchase', () => {
  it('returns null and inserts nothing when vehicleId is empty', () => {
    const result = importMaintenanceFromPurchase(testDb.adapter, '', entry());
    expect(result).toBeNull();
  });

  it('inserts a maintenance row with shop provenance in description', () => {
    createVehicle(testDb.adapter, 'v1', {
      name: 'My Car',
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
    });
    const result = importMaintenanceFromPurchase(testDb.adapter, 'v1', entry({ sourcePurchaseId: 'p1' }));
    expect(result).not.toBeNull();
    expect(result?.id).toBe('cr_shop_p1');
    expect(result?.vehicleId).toBe('v1');
    expect(result?.description).toContain('Brake pads');
    expect(result?.description).toContain('[shop:p1]');
    expect(result?.costCents).toBe(8500);
    expect(result?.performedAt).toBe('2026-04-10');
  });

  it('persists the imported row so it shows up under getMaintenanceByVehicle', () => {
    createVehicle(testDb.adapter, 'v1', { name: 'My Car', make: 'Toyota', model: 'Camry', year: 2020 });
    importMaintenanceFromPurchase(testDb.adapter, 'v1', entry({ sourcePurchaseId: 'p2' }));
    const all = getMaintenanceByVehicle(testDb.adapter, 'v1');
    expect(all.find((m) => m.id === 'cr_shop_p2')).toBeTruthy();
  });
});

describe('getPendingCarImports', () => {
  it('returns [] for empty input', () => {
    expect(getPendingCarImports([], [])).toEqual([]);
  });

  it('returns all entries when no maintenance exists', () => {
    const entries = [entry({ sourcePurchaseId: 'p1' }), entry({ sourcePurchaseId: 'p2' })];
    expect(getPendingCarImports(entries, []).length).toBe(2);
  });

  it('skips entries whose source purchase id appears in an existing description', () => {
    createVehicle(testDb.adapter, 'v1', { name: 'My Car', make: 'Toyota', model: 'Camry', year: 2020 });
    importMaintenanceFromPurchase(testDb.adapter, 'v1', entry({ sourcePurchaseId: 'p1' }));
    const existing = getMaintenanceByVehicle(testDb.adapter, 'v1');
    const entries = [
      entry({ sourcePurchaseId: 'p1' }),
      entry({ sourcePurchaseId: 'p2' }),
    ];
    const pending = getPendingCarImports(entries, existing);
    expect(pending.map((e) => e.sourcePurchaseId)).toEqual(['p2']);
  });

  it('ignores maintenance rows whose description does not contain the shop marker', () => {
    createVehicle(testDb.adapter, 'v1', { name: 'My Car', make: 'Toyota', model: 'Camry', year: 2020 });
    createMaintenance(testDb.adapter, 'manual-1', 'v1', {
      type: 'oil_change',
      performedAt: '2026-04-01',
      description: 'manual oil change',
    });
    const existing = getMaintenanceByVehicle(testDb.adapter, 'v1');
    const entries = [entry({ sourcePurchaseId: 'p1' })];
    expect(getPendingCarImports(entries, existing)).toEqual(entries);
  });
});

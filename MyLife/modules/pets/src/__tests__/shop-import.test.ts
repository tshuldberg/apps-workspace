import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { PETS_MODULE } from '../definition';
import {
  importPetSupplyFromPurchase,
  getPendingPetImports,
  type PetSupplyEntry,
} from '../integrations/shop-import';
import { createPet, listExpensesForPet, createPetExpense } from '../db';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('pets', PETS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function entry(overrides: Partial<PetSupplyEntry> = {}): PetSupplyEntry {
  return {
    description: 'Dog food 25lb',
    costCents: 4500,
    occurredAt: '2026-04-10',
    sourcePurchaseId: 'p1',
    isVetProduct: false,
    ...overrides,
  };
}

describe('importPetSupplyFromPurchase', () => {
  it('returns null and inserts nothing when petId is empty', () => {
    const result = importPetSupplyFromPurchase(testDb.adapter, '', entry());
    expect(result).toBeNull();
  });

  it('inserts a supplies expense and encodes shop marker in notes', () => {
    createPet(testDb.adapter, 'pet1', { name: 'Rex', species: 'dog' });
    const result = importPetSupplyFromPurchase(testDb.adapter, 'pet1', entry({ sourcePurchaseId: 'p1' }));
    expect(result).not.toBeNull();
    expect(result?.id).toBe('pt_shop_p1');
    expect(result?.petId).toBe('pet1');
    expect(result?.category).toBe('supplies');
    expect(result?.label).toBe('Dog food 25lb');
    expect(result?.amountCents).toBe(4500);
    expect(result?.spentOn).toBe('2026-04-10');
    expect(result?.notes).toBe('[shop:p1]');
  });

  it('routes vet-flagged entries into the medication category', () => {
    createPet(testDb.adapter, 'pet1', { name: 'Rex', species: 'dog' });
    const result = importPetSupplyFromPurchase(
      testDb.adapter,
      'pet1',
      entry({ sourcePurchaseId: 'p2', isVetProduct: true, description: 'Vet rx' }),
    );
    expect(result?.category).toBe('medication');
  });

  it('persists the imported row so it shows up under listExpensesForPet', () => {
    createPet(testDb.adapter, 'pet1', { name: 'Rex', species: 'dog' });
    importPetSupplyFromPurchase(testDb.adapter, 'pet1', entry({ sourcePurchaseId: 'p3' }));
    const all = listExpensesForPet(testDb.adapter, 'pet1');
    expect(all.find((e) => e.id === 'pt_shop_p3')).toBeTruthy();
  });
});

describe('getPendingPetImports', () => {
  it('returns [] for empty input', () => {
    expect(getPendingPetImports([], [])).toEqual([]);
  });

  it('returns all entries when no supplies exist', () => {
    const entries = [entry({ sourcePurchaseId: 'p1' }), entry({ sourcePurchaseId: 'p2' })];
    expect(getPendingPetImports(entries, []).length).toBe(2);
  });

  it('skips entries whose source purchase id appears in an existing notes', () => {
    createPet(testDb.adapter, 'pet1', { name: 'Rex', species: 'dog' });
    importPetSupplyFromPurchase(testDb.adapter, 'pet1', entry({ sourcePurchaseId: 'p1' }));
    const existing = listExpensesForPet(testDb.adapter, 'pet1');
    const entries = [
      entry({ sourcePurchaseId: 'p1' }),
      entry({ sourcePurchaseId: 'p2' }),
    ];
    const pending = getPendingPetImports(entries, existing);
    expect(pending.map((e) => e.sourcePurchaseId)).toEqual(['p2']);
  });

  it('ignores expense rows whose notes do not contain the shop marker', () => {
    createPet(testDb.adapter, 'pet1', { name: 'Rex', species: 'dog' });
    createPetExpense(testDb.adapter, 'manual-1', {
      petId: 'pet1',
      category: 'food',
      label: 'manual',
      amountCents: 1000,
      spentOn: '2026-04-01',
      notes: 'just a memo',
    });
    const existing = listExpensesForPet(testDb.adapter, 'pet1');
    const entries = [entry({ sourcePurchaseId: 'p1' })];
    expect(getPendingPetImports(entries, existing)).toEqual(entries);
  });
});

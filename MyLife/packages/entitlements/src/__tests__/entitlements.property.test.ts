import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { MODULE_IDS, FREE_MODULES } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import { isModuleUnlocked, getUnlockedModules } from '../gates';
import { setTestMode } from '../test-mode';
import type { EntitlementState, StorageTier } from '../types';

beforeEach(() => setTestMode(false));
afterEach(() => setTestMode(true));

const FREE_SET = new Set<ModuleId>(FREE_MODULES);

/** Arbitrary for any registered ModuleId. */
const moduleIdArb = fc.constantFrom(...MODULE_IDS) as fc.Arbitrary<ModuleId>;

/** Arbitrary for a subset of module IDs (for unlockedModules set). */
const moduleIdSubsetArb = fc
  .subarray([...MODULE_IDS], { minLength: 0 })
  .map((ids) => new Set(ids as ModuleId[]));

/** Arbitrary for storage tier. */
const storageTierArb = fc.constantFrom('free', 'starter', 'power') as fc.Arbitrary<StorageTier>;

/** Arbitrary for a full EntitlementState. */
const entitlementStateArb = fc.record({
  hubUnlocked: fc.boolean(),
  unlockedModules: moduleIdSubsetArb,
  storageTier: storageTierArb,
  updateEntitled: fc.boolean(),
  purchaseDate: fc.constant(null) as fc.Arbitrary<Date | null>,
});

describe('Property 6: Entitlement gating matches module tier and subscription state', () => {
  it('free modules are always unlocked regardless of subscription state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FREE_MODULES) as fc.Arbitrary<ModuleId>,
        entitlementStateArb,
        (moduleId, state) => {
          expect(isModuleUnlocked(moduleId, state)).toBe(true);
        },
      ),
    );
  });

  it('hub unlock grants access to every module', () => {
    fc.assert(
      fc.property(moduleIdArb, (moduleId) => {
        const state: EntitlementState = {
          hubUnlocked: true,
          unlockedModules: new Set(),
          storageTier: 'free',
          updateEntitled: false,
          purchaseDate: null,
        };
        expect(isModuleUnlocked(moduleId, state)).toBe(true);
      }),
    );
  });

  it('standalone unlock grants access only to that module (plus free modules)', () => {
    fc.assert(
      fc.property(moduleIdArb, moduleIdArb, (unlockedId, queriedId) => {
        const state: EntitlementState = {
          hubUnlocked: false,
          unlockedModules: new Set([unlockedId]),
          storageTier: 'free',
          updateEntitled: false,
          purchaseDate: null,
        };
        const expected =
          FREE_SET.has(queriedId) || queriedId === unlockedId;
        expect(isModuleUnlocked(queriedId, state)).toBe(expected);
      }),
    );
  });

  it('premium module with no purchases and no hub unlock is locked', () => {
    const premiumModules = MODULE_IDS.filter((id) => !FREE_SET.has(id));
    if (premiumModules.length === 0) return;

    fc.assert(
      fc.property(
        fc.constantFrom(...premiumModules) as fc.Arbitrary<ModuleId>,
        (moduleId) => {
          const state: EntitlementState = {
            hubUnlocked: false,
            unlockedModules: new Set(),
            storageTier: 'free',
            updateEntitled: false,
            purchaseDate: null,
          };
          expect(isModuleUnlocked(moduleId, state)).toBe(false);
        },
      ),
    );
  });

  it('getUnlockedModules with hub unlock returns all modules', () => {
    fc.assert(
      fc.property(entitlementStateArb, (baseState) => {
        const state = { ...baseState, hubUnlocked: true };
        const unlocked = getUnlockedModules(MODULE_IDS, state);
        expect(unlocked.length).toBe(MODULE_IDS.length);
      }),
    );
  });

  it('getUnlockedModules without hub unlock includes at least all free modules', () => {
    fc.assert(
      fc.property(entitlementStateArb, (baseState) => {
        const state = { ...baseState, hubUnlocked: false };
        const unlocked = new Set(getUnlockedModules(MODULE_IDS, state));
        for (const freeId of FREE_MODULES) {
          expect(unlocked.has(freeId)).toBe(true);
        }
      }),
    );
  });
});

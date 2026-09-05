import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { MODULE_IDS } from '../constants';
import type { ModuleId } from '../types';
import {
  GA_MODULE_IDS,
  HIDDEN_MODULE_IDS,
  MERGED_MODULE_IDS,
  MODULE_RELEASE_STATES,
  PUBLIC_BETA_MODULE_IDS,
  getModuleReleaseLabel,
  getModuleReleaseState,
  isUserVisibleModule,
} from '../release-states';

/** Arbitrary that produces any registered ModuleId. */
const moduleIdArb = fc.constantFrom(...MODULE_IDS) as fc.Arbitrary<ModuleId>;

describe('Property 14: Release state completeness and visibility filtering', () => {
  it('every ModuleId has a defined release state', () => {
    fc.assert(
      fc.property(moduleIdArb, (id) => {
        const state = MODULE_RELEASE_STATES[id];
        expect(state).toBeDefined();
        expect(['ga', 'public_beta', 'hidden', 'merged']).toContain(state);
      }),
    );
  });

  it('hidden and merged modules are never user-visible', () => {
    fc.assert(
      fc.property(moduleIdArb, (id) => {
        const state = getModuleReleaseState(id);
        if (state === 'hidden' || state === 'merged') {
          expect(isUserVisibleModule(id)).toBe(false);
        }
      }),
    );
  });

  it('ga and public_beta modules are always user-visible', () => {
    fc.assert(
      fc.property(moduleIdArb, (id) => {
        const state = getModuleReleaseState(id);
        if (state === 'ga' || state === 'public_beta') {
          expect(isUserVisibleModule(id)).toBe(true);
        }
      }),
    );
  });

  it('public_beta modules get "BETA" label', () => {
    fc.assert(
      fc.property(moduleIdArb, (id) => {
        if (getModuleReleaseState(id) === 'public_beta') {
          expect(getModuleReleaseLabel(id)).toBe('BETA');
        }
      }),
    );
  });

  it('release ID arrays partition all MODULE_IDS with no overlap', () => {
    const allArrayIds = [
      ...GA_MODULE_IDS,
      ...PUBLIC_BETA_MODULE_IDS,
      ...HIDDEN_MODULE_IDS,
      ...MERGED_MODULE_IDS,
    ];
    const unique = new Set(allArrayIds);
    expect(unique.size).toBe(allArrayIds.length);
    expect(unique.size).toBe(MODULE_IDS.length);
    for (const id of MODULE_IDS) {
      expect(unique.has(id)).toBe(true);
    }
  });
});

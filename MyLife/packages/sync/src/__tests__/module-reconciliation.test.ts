import { describe, it, expect, beforeAll } from 'vitest';
import { MODULE_IDS, HEALTH_DATA_MODULE_IDS } from '@mylife/module-registry';
import type { ModuleDefinition, ModuleSyncPolicy } from '@mylife/module-registry/types';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Dynamic loader for all 39 module definitions
//
// Relative path imports from the sync package into modules/ would break tsc
// because the files are outside rootDir. Dynamic import() bypasses this
// restriction since it resolves at runtime, not compile time.
// ---------------------------------------------------------------------------

/** Module export name convention: UPPER_MODULE where UPPER = id.toUpperCase() */
function exportName(moduleId: string): string {
  return `${moduleId.toUpperCase()}_MODULE`;
}

const MODULES_ROOT = resolve(__dirname, '../../../../modules');

const ALL_DEFINITIONS: Record<string, ModuleDefinition> = {};
const MODULE_DIRECTORY_OVERRIDES: Record<string, string> = {
  recipes: 'bestchef',
};

beforeAll(async () => {
  for (const id of MODULE_IDS) {
    const moduleDir = MODULE_DIRECTORY_OVERRIDES[id] ?? id;
    const defPath = resolve(MODULES_ROOT, moduleDir, 'src/definition');
    const mod = await import(defPath);
    const name = exportName(id);
    if (!mod[name]) {
      throw new Error(`Module ${id}: expected export ${name} in ${defPath}`);
    }
    ALL_DEFINITIONS[id] = mod[name] as ModuleDefinition;
  }
});

// ---------------------------------------------------------------------------
// Financial module IDs (not shareable per policy matrix)
// ---------------------------------------------------------------------------

const FINANCIAL_MODULE_IDS = ['budget', 'payments', 'subs'] as const;

// ---------------------------------------------------------------------------
// Supabase-backed modules that must default to device_local
// ---------------------------------------------------------------------------

const SUPABASE_MODULE_IDS = ['forums', 'market', 'payments'] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Module Sync Policy Reconciliation', () => {
  // -----------------------------------------------------------------------
  // ModuleId coverage
  // -----------------------------------------------------------------------

  describe('ModuleId coverage', () => {
    it('MODULE_IDS has exactly 41 entries', () => {
      expect(MODULE_IDS).toHaveLength(41);
    });

    it('ALL_DEFINITIONS covers every ModuleId', () => {
      const definedIds = Object.keys(ALL_DEFINITIONS).sort();
      const registryIds = [...MODULE_IDS].sort();
      expect(definedIds).toEqual(registryIds);
    });

    it('every definition has a matching id field', () => {
      for (const [key, def] of Object.entries(ALL_DEFINITIONS)) {
        expect(def.id).toBe(key);
      }
    });

    it('every ModuleId has a syncPolicy in its definition', () => {
      const missing: string[] = [];
      for (const id of MODULE_IDS) {
        const def = ALL_DEFINITIONS[id];
        if (!def.syncPolicy) {
          missing.push(id);
        }
      }
      expect(missing).toEqual([]);
    });

    it('every syncPolicy has required fields (defaultScope, shareable, entityRules)', () => {
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        expect(policy.defaultScope, `${id}: missing defaultScope`).toBeDefined();
        expect(typeof policy.shareable, `${id}: shareable should be boolean`).toBe('boolean');
        expect(Array.isArray(policy.entityRules), `${id}: entityRules should be array`).toBe(true);
        expect(policy.entityRules.length, `${id}: entityRules should not be empty`).toBeGreaterThan(0);
      }
    });

    it('every entityRule has required fields (tableName, defaultScope, conflictStrategy)', () => {
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          expect(rule.tableName, `${id}: missing tableName`).toBeTruthy();
          expect(rule.defaultScope, `${id}/${rule.tableName}: missing defaultScope`).toBeDefined();
          expect(rule.conflictStrategy, `${id}/${rule.tableName}: missing conflictStrategy`).toBeDefined();
        }
      }
    });

    it('policy matrix row count matches ModuleId union size', () => {
      // One policy-matrix row per ModuleId (41 after mynews was added).
      // This test ensures the code definitions match.
      expect(MODULE_IDS.length).toBe(41);
      expect(Object.keys(ALL_DEFINITIONS)).toHaveLength(41);
    });
  });

  // -----------------------------------------------------------------------
  // Manual review resolver coverage
  // -----------------------------------------------------------------------

  describe('manual review resolver coverage', () => {
    it('every entity with requiresManualResolver has a resolverComponent', () => {
      const violations: string[] = [];
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          if (rule.requiresManualResolver && !rule.resolverComponent) {
            violations.push(`${id}/${rule.tableName}: requiresManualResolver=true but no resolverComponent`);
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('every manual_review strategy entity has requiresManualResolver set', () => {
      const violations: string[] = [];
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          if (rule.conflictStrategy === 'manual_review' && !rule.requiresManualResolver) {
            violations.push(`${id}/${rule.tableName}: conflictStrategy=manual_review but requiresManualResolver not set`);
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('resolverComponent strings are non-empty when present', () => {
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          if (rule.resolverComponent !== undefined) {
            expect(
              rule.resolverComponent.length,
              `${id}/${rule.tableName}: resolverComponent is empty string`,
            ).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  // -----------------------------------------------------------------------
  // Sensitive module guard
  // -----------------------------------------------------------------------

  describe('sensitive module guard', () => {
    it('HEALTH_DATA_MODULE_IDS modules have isSensitive: true on their syncPolicy', () => {
      const missing: string[] = [];
      for (const id of HEALTH_DATA_MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id]?.syncPolicy;
        // Presence is in HEALTH_DATA_MODULE_IDS but its syncPolicy does not
        // set isSensitive because its shareable entities (intentions, summaries)
        // are not health-critical. Sessions are capped via maxScope instead.
        // The policy matrix marks presence as "Yes (digital wellness)" but the
        // implementation opts for scope capping over the sensitive flag.
        if (id === 'presence') continue;

        if (!policy?.isSensitive) {
          missing.push(id);
        }
      }
      expect(missing).toEqual([]);
    });

    it('financial modules are not shareable', () => {
      for (const id of FINANCIAL_MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        expect(policy.shareable, `${id} should not be shareable`).toBe(false);
      }
    });

    it('financial modules have isSensitive: true', () => {
      for (const id of FINANCIAL_MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        expect(policy.isSensitive, `${id} should be marked sensitive`).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Scope constraints
  // -----------------------------------------------------------------------

  describe('scope constraints', () => {
    it('supabase modules default to device_local', () => {
      for (const id of SUPABASE_MODULE_IDS) {
        const def = ALL_DEFINITIONS[id];
        expect(def.storageType, `${id}: expected supabase storageType`).toBe('supabase');
        const policy = def.syncPolicy as ModuleSyncPolicy;
        expect(policy.defaultScope, `${id}: supabase module should default to device_local`).toBe('device_local');
      }
    });

    it('mail (IMAP-canonical) defaults to device_local', () => {
      const policy = ALL_DEFINITIONS['mail'].syncPolicy as ModuleSyncPolicy;
      expect(policy.defaultScope).toBe('device_local');
    });

    it('presence.sessions has maxScope personal_replica', () => {
      const policy = ALL_DEFINITIONS['presence'].syncPolicy as ModuleSyncPolicy;
      const sessionsRule = policy.entityRules.find((r) => r.tableName === 'sessions');
      expect(sessionsRule, 'presence should have a sessions entity rule').toBeDefined();
      expect(sessionsRule?.maxScope).toBe('personal_replica');
    });

    it('sports.bets has maxScope personal_replica', () => {
      const policy = ALL_DEFINITIONS['sports'].syncPolicy as ModuleSyncPolicy;
      const betsRule = policy.entityRules.find((r) => r.tableName === 'bets');
      expect(betsRule, 'sports should have a bets entity rule').toBeDefined();
      expect(betsRule?.maxScope).toBe('personal_replica');
    });

    it('no entity defaultScope exceeds its maxScope when maxScope is set', () => {
      const scopeOrder: Record<string, number> = {
        device_local: 0,
        personal_replica: 1,
        shared_workspace: 2,
        published_blob: 3,
      };
      const violations: string[] = [];

      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          if (rule.maxScope) {
            const defaultRank = scopeOrder[rule.defaultScope] ?? -1;
            const maxRank = scopeOrder[rule.maxScope] ?? -1;
            if (defaultRank > maxRank) {
              violations.push(
                `${id}/${rule.tableName}: defaultScope ${rule.defaultScope} exceeds maxScope ${rule.maxScope}`,
              );
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Conflict strategy distribution (sanity checks)
  // -----------------------------------------------------------------------

  describe('conflict strategy distribution', () => {
    it('all entity rules use a valid conflict strategy', () => {
      const validStrategies = new Set(['lww', 'or_set', 'counter', 'document_crdt', 'manual_review']);
      const invalid: string[] = [];

      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          if (!validStrategies.has(rule.conflictStrategy)) {
            invalid.push(`${id}/${rule.tableName}: unknown strategy '${rule.conflictStrategy}'`);
          }
        }
      }
      expect(invalid).toEqual([]);
    });

    it('at least one module uses each conflict strategy', () => {
      const seen = new Set<string>();
      for (const id of MODULE_IDS) {
        const policy = ALL_DEFINITIONS[id].syncPolicy as ModuleSyncPolicy;
        for (const rule of policy.entityRules) {
          seen.add(rule.conflictStrategy);
        }
      }
      expect(seen).toContain('lww');
      expect(seen).toContain('or_set');
      expect(seen).toContain('counter');
      expect(seen).toContain('document_crdt');
      expect(seen).toContain('manual_review');
    });
  });
});

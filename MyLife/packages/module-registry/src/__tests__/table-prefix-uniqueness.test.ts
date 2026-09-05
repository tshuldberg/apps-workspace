import { describe, it, expect } from 'vitest';
import { MODULE_METADATA } from '../constants';

describe('module table prefix uniqueness', () => {
  it('all module table prefixes are unique across the registry', () => {
    const prefixes: string[] = [];
    const duplicates: string[] = [];

    for (const [moduleId, def] of Object.entries(MODULE_METADATA)) {
      if (!def.tablePrefix) continue;

      const existingEntry = prefixes.find((p) => p === def.tablePrefix);
      if (existingEntry) {
        duplicates.push(`${moduleId} reuses prefix "${def.tablePrefix}"`);
      }
      prefixes.push(def.tablePrefix);
    }

    expect(duplicates).toEqual([]);
  });

  it('all table prefixes follow the <2-3 chars>_ naming convention', () => {
    const violations: string[] = [];

    for (const [moduleId, def] of Object.entries(MODULE_METADATA)) {
      if (!def.tablePrefix) continue;

      if (!/^[a-z]{2,3}_$/.test(def.tablePrefix)) {
        violations.push(`${moduleId} has invalid prefix format: "${def.tablePrefix}" (expected 2-3 lowercase letters + underscore)`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('hub prefix hub_ is reserved and not used by any module', () => {
    for (const def of Object.values(MODULE_METADATA)) {
      expect(def.tablePrefix).not.toBe('hub_');
    }
  });
});

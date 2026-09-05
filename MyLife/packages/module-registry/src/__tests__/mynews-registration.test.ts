import { describe, expect, it } from 'vitest';
import { MODULE_IDS, MODULE_METADATA } from '../constants';
import { HIDDEN_MODULE_IDS } from '../release-states';
import { ModuleIdSchema } from '../types';

describe('mynews registration', () => {
  it('is a known module id', () => {
    expect(MODULE_IDS).toContain('mynews');
    expect(ModuleIdSchema.safeParse('mynews').success).toBe(true);
  });

  it('has standalone-first metadata with the nw_ prefix', () => {
    const def = MODULE_METADATA.mynews;
    expect(def.id).toBe('mynews');
    expect(def.name).toBe('MyNews');
    expect(def.tablePrefix).toBe('nw_');
    expect(def.tier).toBe('premium');
    expect(def.storageType).toBe('supabase');
    expect(def.accentColor).toBe('#8BCFF0');
    expect(def.requiresAuth).toBe(false);
    expect(def.requiresNetwork).toBe(true);
    expect(def.navigation.tabs.map((t) => t.key)).toEqual([
      'today',
      'discover',
      'desk',
      'support',
      'me',
    ]);
  });

  it('launches hidden', () => {
    expect(HIDDEN_MODULE_IDS).toContain('mynews');
  });
});

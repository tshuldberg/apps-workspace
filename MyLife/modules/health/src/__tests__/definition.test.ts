import { describe, it, expect } from 'vitest';
import { ModuleDefinitionSchema } from '@mylife/module-registry';
import { HEALTH_MODULE } from '../definition';

describe('HEALTH_MODULE definition', () => {
  it('passes Zod validation', () => {
    const result = ModuleDefinitionSchema.safeParse(HEALTH_MODULE);
    expect(result.success).toBe(true);
  });

  it('has correct id and prefix', () => {
    expect(HEALTH_MODULE.id).toBe('health');
    expect(HEALTH_MODULE.tablePrefix).toBe('hl_');
  });

  it('has 5 navigation tabs', () => {
    expect(HEALTH_MODULE.navigation.tabs).toHaveLength(5);
    const tabKeys = HEALTH_MODULE.navigation.tabs.map((t) => t.key);
    expect(tabKeys).toEqual(['today', 'vitals', 'activity', 'sleep', 'mind']);
  });

  it('has correct schema version and migrations', () => {
    expect(HEALTH_MODULE.schemaVersion).toBe(3);
    expect(HEALTH_MODULE.migrations).toHaveLength(3);
  });

  it('has 26 navigation screens', () => {
    expect(HEALTH_MODULE.navigation.screens).toHaveLength(26);
  });

  it('marks fasting as a free section', () => {
    expect(HEALTH_MODULE.freeSections).toEqual(['fasting']);
  });

  it('uses red accent color', () => {
    expect(HEALTH_MODULE.accentColor).toBe('#EF4444');
  });
});

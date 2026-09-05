import { describe, expect, it } from 'vitest';
import { SLEEP_MODULE } from '../definition';

describe('SLEEP_MODULE', () => {
  it('defines the expected module contract', () => {
    expect(SLEEP_MODULE.id).toBe('sleep');
    expect(SLEEP_MODULE.tablePrefix).toBe('sl_');
    expect(SLEEP_MODULE.accentColor).toBe('#A78BFA');
    expect(SLEEP_MODULE.schemaVersion).toBe(4);
    expect(SLEEP_MODULE.tier).toBe('premium');
    expect(SLEEP_MODULE.navigation.tabs.map((tab) => tab.key)).toEqual([
      'log',
      'dreams',
      'insights',
      'settings',
    ]);
  });

  it('ships the foundation, dream FTS, streak history, and hygiene migrations', () => {
    expect(SLEEP_MODULE.migrations).toHaveLength(4);
    expect(SLEEP_MODULE.migrations?.[0]?.version).toBe(1);
    expect(SLEEP_MODULE.migrations?.[1]?.version).toBe(2);
    expect(SLEEP_MODULE.migrations?.[2]?.version).toBe(3);
    expect(SLEEP_MODULE.migrations?.[3]?.version).toBe(4);
  });
});

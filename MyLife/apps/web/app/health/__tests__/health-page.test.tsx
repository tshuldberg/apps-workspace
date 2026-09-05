import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const thisDir = dirname(fileURLToPath(import.meta.url));

describe('Health hub page sleep bridge', () => {
  it('renders MySleep journal bridge context from server actions', () => {
    const pageSource = readFileSync(resolve(thisDir, '../page.tsx'), 'utf8');
    const actionsSource = readFileSync(resolve(thisDir, '../actions.ts'), 'utf8');
    const settingsSource = readFileSync(resolve(thisDir, '../settings/page.tsx'), 'utf8');

    expect(pageSource).toContain('fetchSleepJournalContext');
    expect(pageSource).toContain('MySleep Journal');
    expect(actionsSource).toContain('getSleepJournalContext');
    expect(actionsSource).toContain('setManualSleepBridgeEnabled');
    expect(settingsSource).toContain('MySleep Journal Bridge');
    expect(settingsSource).toContain('bridge.sleepJournal.enabled');
  });
});

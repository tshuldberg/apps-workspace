import { describe, expect, it } from 'vitest';

import { Ui } from './ui.js';

describe('Ui', () => {
  it('rewrites status with a carriage return and clears the previous width', () => {
    const writes: string[] = [];
    const ui = new Ui({ write: (value) => writes.push(value) });

    ui.status({ phase: 'listening', detail: 'MyLife session' });
    ui.status({ phase: 'muted' });

    expect(writes[0]).toBe('\r  🎤 listening — MyLife session');
    expect(writes[1]?.startsWith('\r  ⏸ muted')).toBe(true);
    expect(writes[1]?.endsWith(' '.repeat(19))).toBe(true);
  });

  it('prints logs above and then reprints the sticky status', () => {
    const writes: string[] = [];
    const ui = new Ui({ write: (value) => writes.push(value) });
    ui.status({ phase: 'thinking', detail: 'routing' });
    writes.splice(0);

    ui.log('Codex replied');

    expect(writes.join('')).toContain('Codex replied\n');
    expect(writes.at(-1)).toBe('\r  ⚙ thinking — routing');
  });

  it.each([
    ['listening', '🎤'],
    ['muted', '⏸'],
    ['speaking', '🔊'],
    ['thinking', '⚙'],
    ['read-back', '📨'],
    ['error', '✖'],
  ])('uses the %s icon', (phase, icon) => {
    const writes: string[] = [];
    new Ui({ write: (value) => writes.push(value) }).status({ phase });
    expect(writes[0]).toContain(icon);
  });
});

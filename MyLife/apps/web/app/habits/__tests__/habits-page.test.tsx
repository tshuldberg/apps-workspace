import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const thisDir = dirname(fileURLToPath(import.meta.url));

describe('Habits hub page', () => {
  it('renders a functional habits dashboard (not a stub)', () => {
    const source = readFileSync(resolve(thisDir, '../page.tsx'), 'utf8');
    // After W15-2, this is a real functional page with server action calls
    expect(source).toContain("'use client'");
    expect(source).toContain('fetchHabits');
    expect(source).toContain('fetchCompletionsForDate');
    expect(source).toContain('fetchSleepRoutineContext');
    expect(source).toContain('Sleep routine context');
    expect(source).not.toContain('ModuleWebFallback');
  });
});

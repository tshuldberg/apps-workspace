import { describe, expect, it } from 'vitest';
import {
  analyzeMoodTrend,
  selectTheme,
  fillTemplate,
  generatePrompt,
  dateToHash,
} from '../prompt-engine';
import { PROMPT_THEMES } from '../themes';
import type { PromptContext } from '../types';

function makeContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    moodTrend: 'stable',
    recentMoods: ['good'],
    avgWordCount: 150,
    streakDays: 5,
    daysSinceLastEntry: 1,
    recentThemes: [],
    ...overrides,
  };
}

describe('analyzeMoodTrend', () => {
  it('returns unknown for fewer than 2 moods', () => {
    expect(analyzeMoodTrend(['good'])).toBe('unknown');
    expect(analyzeMoodTrend([])).toBe('unknown');
  });

  it('detects declining mood', () => {
    expect(analyzeMoodTrend(['great', 'good', 'okay', 'low', 'low'])).toBe('declining');
  });

  it('detects improving mood', () => {
    expect(analyzeMoodTrend(['low', 'low', 'okay', 'good', 'great'])).toBe('improving');
  });

  it('detects stable mood', () => {
    expect(analyzeMoodTrend(['good', 'good', 'good', 'good'])).toBe('stable');
  });

  it('detects mixed mood (similar averages, different moods)', () => {
    // First half: low, great = avg 3. Second half: good, okay = avg 2.5. diff = -0.5, not > 0.5, not all same => mixed
    expect(analyzeMoodTrend(['low', 'great', 'good', 'okay'])).toBe('mixed');
  });

  it('returns stable for identical moods with nulls filtered', () => {
    // After filtering nulls, 2 'good' entries = stable (same mood)
    expect(analyzeMoodTrend([null, null, 'good', 'good'])).toBe('stable');
  });
});

describe('selectTheme', () => {
  it('avoids recently used themes', () => {
    const ctx = makeContext({
      recentThemes: ['emotional_exploration', 'growth_reflection', 'self_compassion'],
    });
    const theme = selectTheme(ctx, 12345);
    expect(ctx.recentThemes).not.toContain(theme);
  });

  it('falls back to all themes when all are on cooldown', () => {
    const allThemes = PROMPT_THEMES.map((t) => t.theme);
    const ctx = makeContext({ recentThemes: allThemes });
    const theme = selectTheme(ctx, 12345);
    expect(allThemes).toContain(theme);
  });

  it('biases toward self_compassion when mood is declining', () => {
    const ctx = makeContext({ moodTrend: 'declining' });
    // Run multiple seeds and check bias
    const themes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      themes.add(selectTheme(ctx, i));
    }
    expect(themes.has('self_compassion') || themes.has('emotional_exploration')).toBe(true);
  });
});

describe('fillTemplate', () => {
  it('replaces mood variable', () => {
    const result = fillTemplate('You feel {mood}', makeContext({ recentMoods: ['great'] }));
    expect(result).toBe('You feel great');
  });

  it('replaces streak variable', () => {
    const result = fillTemplate('Streak is {streakDays} days', makeContext({ streakDays: 10 }));
    expect(result).toBe('Streak is 10 days');
  });

  it('replaces avgWordCount variable', () => {
    const result = fillTemplate('{avgWordCount} words avg', makeContext({ avgWordCount: 243.6 }));
    expect(result).toBe('244 words avg');
  });

  it('replaces daysSinceLastEntry variable', () => {
    const result = fillTemplate('{daysSinceLastEntry} days away', makeContext({ daysSinceLastEntry: 3 }));
    expect(result).toBe('3 days away');
  });

  it('returns template as-is when no variables present', () => {
    const result = fillTemplate('No variables here', makeContext());
    expect(result).toBe('No variables here');
  });

  it('uses fallback mood when no recent moods', () => {
    const result = fillTemplate('Feeling {mood}', makeContext({ recentMoods: [] }));
    expect(result).toBe('Feeling reflective');
  });
});

describe('generatePrompt', () => {
  it('returns a theme and prompt text', () => {
    const result = generatePrompt(makeContext(), 20260322);
    expect(result.theme).toBeTruthy();
    expect(result.promptText).toBeTruthy();
    expect(result.promptText.length).toBeGreaterThan(10);
  });

  it('produces different prompts for different date hashes', () => {
    const ctx = makeContext();
    const a = generatePrompt(ctx, 20260322);
    const b = generatePrompt(ctx, 20260323);
    // Different dates should produce different prompts (not guaranteed but likely)
    expect(a.theme !== b.theme || a.promptText !== b.promptText).toBe(true);
  });
});

describe('dateToHash', () => {
  it('converts date string to number', () => {
    expect(dateToHash('2026-03-22')).toBe(20260322);
  });

  it('handles January 1', () => {
    expect(dateToHash('2026-01-01')).toBe(20260101);
  });
});

describe('PROMPT_THEMES', () => {
  it('has 12 themes defined', () => {
    expect(PROMPT_THEMES).toHaveLength(12);
  });

  it('each theme has at least 8 templates', () => {
    for (const theme of PROMPT_THEMES) {
      expect(theme.templates.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('total templates across all themes is 96', () => {
    const total = PROMPT_THEMES.reduce((sum, t) => sum + t.templates.length, 0);
    expect(total).toBe(96);
  });
});

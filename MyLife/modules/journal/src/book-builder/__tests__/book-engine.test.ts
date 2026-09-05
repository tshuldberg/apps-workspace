import { describe, expect, it } from 'vitest';
import {
  getPageDimensions,
  getPageMargins,
  estimatePageCount,
  moodToEmoji,
  formatEntryForPage,
  generateTOC,
  validateBookConfig,
} from '../page-layout';

describe('getPageDimensions', () => {
  it('returns correct dimensions for 6x9', () => {
    expect(getPageDimensions('6x9')).toEqual({ widthPt: 432, heightPt: 648 });
  });

  it('returns correct dimensions for 5.5x8.5', () => {
    expect(getPageDimensions('5.5x8.5')).toEqual({ widthPt: 396, heightPt: 612 });
  });

  it('returns correct dimensions for 8.5x11', () => {
    expect(getPageDimensions('8.5x11')).toEqual({ widthPt: 612, heightPt: 792 });
  });
});

describe('getPageMargins', () => {
  it('returns larger inner margin for 6x9 (binding side)', () => {
    const margins = getPageMargins('6x9');
    expect(margins.innerPt).toBeGreaterThan(margins.outerPt);
    expect(margins.innerPt).toBe(54); // 0.75"
    expect(margins.outerPt).toBe(36); // 0.5"
  });

  it('returns equal inner/outer for 8.5x11', () => {
    const margins = getPageMargins('8.5x11');
    expect(margins.innerPt).toBe(margins.outerPt);
  });
});

describe('estimatePageCount', () => {
  it('estimates pages from word count', () => {
    const result = estimatePageCount(1000, 0);
    expect(result.estimatedTextPages).toBe(4); // 1000/250 = 4
    expect(result.estimatedImagePages).toBe(0);
    expect(result.estimatedPages).toBe(7); // 4 + 3 fixed
  });

  it('adds pages for images', () => {
    const result = estimatePageCount(500, 5);
    expect(result.estimatedTextPages).toBe(2);
    expect(result.estimatedImagePages).toBe(5);
    expect(result.estimatedPages).toBe(10); // 2 + 5 + 3
  });

  it('returns minimum 1 text page for 0 words', () => {
    const result = estimatePageCount(0, 0);
    expect(result.estimatedTextPages).toBe(1);
    expect(result.estimatedPages).toBe(4); // 1 + 3
  });
});

describe('moodToEmoji', () => {
  it('maps all mood levels', () => {
    expect(moodToEmoji('low')).toBe('😔');
    expect(moodToEmoji('okay')).toBe('😐');
    expect(moodToEmoji('good')).toBe('🙂');
    expect(moodToEmoji('great')).toBe('😄');
    expect(moodToEmoji('grateful')).toBe('💛');
  });

  it('returns empty string for null', () => {
    expect(moodToEmoji(null)).toBe('');
  });
});

describe('formatEntryForPage', () => {
  it('formats entry with date and body', () => {
    const result = formatEntryForPage(
      '2026-03-22', null, 'Today was good.', null, false, null, null, false,
    );
    expect(result).toContain('## 2026-03-22');
    expect(result).toContain('Today was good.');
  });

  it('includes title when present', () => {
    const result = formatEntryForPage(
      '2026-03-22', 'My Day', 'Content here.', null, false, null, null, false,
    );
    expect(result).toContain('### My Day');
  });

  it('includes mood emoji when enabled', () => {
    const result = formatEntryForPage(
      '2026-03-22', null, 'Content.', 'great', true, null, null, false,
    );
    expect(result).toContain('😄');
  });

  it('excludes mood emoji when disabled', () => {
    const result = formatEntryForPage(
      '2026-03-22', null, 'Content.', 'great', false, null, null, false,
    );
    expect(result).not.toContain('😄');
  });

  it('includes metadata footer when enabled', () => {
    const result = formatEntryForPage(
      '2026-03-22', null, 'Content.', null, false,
      'San Francisco, CA', 'Partly cloudy', true,
    );
    expect(result).toContain('San Francisco, CA');
    expect(result).toContain('Partly cloudy');
  });
});

describe('generateTOC', () => {
  it('generates TOC with entries', () => {
    const toc = generateTOC([
      { date: '2026-03-01', title: 'First Entry', pageNumber: 4 },
      { date: '2026-03-02', title: null, pageNumber: 6 },
    ]);
    expect(toc).toContain('Table of Contents');
    expect(toc).toContain('First Entry ........ 4');
    expect(toc).toContain('2026-03-02 ........ 6');
  });
});

describe('validateBookConfig', () => {
  it('accepts valid config', () => {
    expect(validateBookConfig({ title: 'My Book', author: 'Trey', entryCount: 50 })).toBeNull();
  });

  it('rejects empty title', () => {
    expect(validateBookConfig({ title: '', author: 'Trey', entryCount: 50 })).toBe('Book title is required');
  });

  it('rejects empty author', () => {
    expect(validateBookConfig({ title: 'Book', author: '', entryCount: 50 })).toBe('Author name is required');
  });

  it('rejects title over 100 chars', () => {
    expect(validateBookConfig({ title: 'x'.repeat(101), author: 'Trey', entryCount: 50 })).toBe(
      'Book title cannot exceed 100 characters',
    );
  });

  it('rejects 0 entries', () => {
    expect(validateBookConfig({ title: 'Book', author: 'Trey', entryCount: 0 })).toBe('Select at least 1 entry');
  });

  it('rejects over 500 entries', () => {
    expect(validateBookConfig({ title: 'Book', author: 'Trey', entryCount: 501 })).toBe(
      'Maximum 500 entries per book',
    );
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../../definition';
import {
  validateGridSize,
  assembleGridToMarkdown,
  calculateGridWordCount,
  parseGridConfig,
  BUILT_IN_LAYOUTS,
} from '../grid-engine';
import type { GridCell } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function makeCell(overrides: Partial<GridCell> = {}): GridCell {
  return {
    id: 'cell-1',
    entryId: 'entry-1',
    cellRow: 0,
    cellCol: 0,
    prompt: 'How are you?',
    content: 'I am doing well',
    createdAt: '2026-03-22T00:00:00Z',
    updatedAt: '2026-03-22T00:00:00Z',
    ...overrides,
  };
}

describe('validateGridSize', () => {
  it('accepts valid 2x2 grid', () => {
    expect(validateGridSize(2, 2)).toBeNull();
  });

  it('accepts 4x4 grid (maximum)', () => {
    expect(validateGridSize(4, 4)).toBeNull();
  });

  it('accepts 2x1 grid (minimum 2 cells)', () => {
    expect(validateGridSize(2, 1)).toBeNull();
  });

  it('rejects 1x1 grid (only 1 cell)', () => {
    expect(validateGridSize(1, 1)).toBe('Grid must have at least 2 cells');
  });

  it('rejects rows > 4', () => {
    expect(validateGridSize(5, 2)).toBe('Rows must be between 1 and 4');
  });

  it('rejects cols > 4', () => {
    expect(validateGridSize(2, 5)).toBe('Columns must be between 1 and 4');
  });

  it('rejects rows < 1', () => {
    expect(validateGridSize(0, 2)).toBe('Rows must be between 1 and 4');
  });
});

describe('assembleGridToMarkdown', () => {
  it('assembles 4 cells into Markdown with headings', () => {
    const cells = [
      makeCell({ cellRow: 0, cellCol: 0, prompt: 'Q1', content: 'A1' }),
      makeCell({ cellRow: 0, cellCol: 1, prompt: 'Q2', content: 'A2' }),
      makeCell({ cellRow: 1, cellCol: 0, prompt: 'Q3', content: 'A3' }),
      makeCell({ cellRow: 1, cellCol: 1, prompt: 'Q4', content: 'A4' }),
    ];
    const md = assembleGridToMarkdown(cells);
    expect(md).toContain('### Q1');
    expect(md).toContain('A1');
    expect(md).toContain('### Q4');
    expect(md).toContain('A4');
  });

  it('handles empty cells (null content)', () => {
    const cells = [
      makeCell({ cellRow: 0, cellCol: 0, prompt: 'Filled', content: 'Yes' }),
      makeCell({ cellRow: 0, cellCol: 1, prompt: 'Empty', content: null }),
    ];
    const md = assembleGridToMarkdown(cells);
    expect(md).toContain('### Filled');
    expect(md).toContain('### Empty');
    expect(md).toContain('Yes');
  });

  it('orders cells row-first, col-second', () => {
    const cells = [
      makeCell({ cellRow: 1, cellCol: 0, prompt: 'Second Row' }),
      makeCell({ cellRow: 0, cellCol: 0, prompt: 'First Row' }),
    ];
    const md = assembleGridToMarkdown(cells);
    const firstRowIdx = md.indexOf('First Row');
    const secondRowIdx = md.indexOf('Second Row');
    expect(firstRowIdx).toBeLessThan(secondRowIdx);
  });
});

describe('calculateGridWordCount', () => {
  it('counts words across all cells', () => {
    const cells = [
      makeCell({ content: 'hello world' }),
      makeCell({ content: 'foo bar baz' }),
    ];
    expect(calculateGridWordCount(cells)).toBe(5);
  });

  it('returns 0 for all empty cells', () => {
    const cells = [
      makeCell({ content: null }),
      makeCell({ content: '' }),
    ];
    expect(calculateGridWordCount(cells)).toBe(0);
  });
});

describe('parseGridConfig', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({
      rows: 2,
      cols: 2,
      cells: [
        { row: 0, col: 0, prompt: 'Q1' },
        { row: 0, col: 1, prompt: 'Q2' },
      ],
    });
    const result = parseGridConfig(json);
    expect(result?.rows).toBe(2);
    expect(result?.cells).toHaveLength(2);
  });

  it('returns null for invalid JSON', () => {
    expect(parseGridConfig('not json')).toBeNull();
  });

  it('returns null for missing cells array', () => {
    expect(parseGridConfig('{"rows":2,"cols":2}')).toBeNull();
  });
});

describe('BUILT_IN_LAYOUTS', () => {
  it('has 5 built-in layouts', () => {
    expect(BUILT_IN_LAYOUTS).toHaveLength(5);
  });

  it('Morning Check-In is 2x2 with 4 cells', () => {
    const morning = BUILT_IN_LAYOUTS.find((l) => l.name === 'Morning Check-In');
    expect(morning?.rows).toBe(2);
    expect(morning?.cols).toBe(2);
    expect(morning?.cells).toHaveLength(4);
  });

  it('Weekly Review is 3x3 with 9 cells', () => {
    const weekly = BUILT_IN_LAYOUTS.find((l) => l.name === 'Weekly Review');
    expect(weekly?.rows).toBe(3);
    expect(weekly?.cols).toBe(3);
    expect(weekly?.cells).toHaveLength(9);
  });
});

describe('V4 migration creates grid tables', () => {
  it('jn_grid_cells table exists', () => {
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='jn_grid_cells'`,
    );
    expect(tables).toHaveLength(1);
  });

  it('jn_grid_layouts table exists', () => {
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='jn_grid_layouts'`,
    );
    expect(tables).toHaveLength(1);
  });
});

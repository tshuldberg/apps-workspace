import type { GridCell, GridConfig } from './types';

/**
 * Validate grid size: minimum 2 total cells, max 4x4.
 */
export function validateGridSize(rows: number, cols: number): string | null {
  if (rows < 1 || rows > 4) return 'Rows must be between 1 and 4';
  if (cols < 1 || cols > 4) return 'Columns must be between 1 and 4';
  if (rows * cols < 2) return 'Grid must have at least 2 cells';
  return null;
}

/**
 * Assemble grid cells into a single Markdown document.
 * Each cell becomes ### {prompt}\n\n{content}\n\n
 * Ordered by row ASC, col ASC.
 */
export function assembleGridToMarkdown(cells: GridCell[]): string {
  const sorted = [...cells].sort((a, b) => {
    if (a.cellRow !== b.cellRow) return a.cellRow - b.cellRow;
    return a.cellCol - b.cellCol;
  });

  return sorted
    .map((cell) => `### ${cell.prompt}\n\n${cell.content ?? ''}\n`)
    .join('\n');
}

/**
 * Calculate total word count from grid cells.
 */
export function calculateGridWordCount(cells: GridCell[]): number {
  let total = 0;
  for (const cell of cells) {
    if (cell.content) {
      const trimmed = cell.content.trim();
      if (trimmed) total += trimmed.split(/\s+/).length;
    }
  }
  return total;
}

/**
 * Parse a grid_config JSON string into a GridConfig object.
 */
export function parseGridConfig(json: string): GridConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.cells)) return null;
    return parsed as GridConfig;
  } catch {
    return null;
  }
}

/**
 * Built-in grid layout definitions.
 */
export const BUILT_IN_LAYOUTS: Array<{ name: string; rows: number; cols: number; cells: Array<{ row: number; col: number; prompt: string }> }> = [
  {
    name: 'Morning Check-In',
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, prompt: 'How am I feeling?' },
      { row: 0, col: 1, prompt: 'What is my top priority today?' },
      { row: 1, col: 0, prompt: 'What am I grateful for?' },
      { row: 1, col: 1, prompt: 'What would make today great?' },
    ],
  },
  {
    name: 'Evening Reflection',
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, prompt: 'What went well today?' },
      { row: 0, col: 1, prompt: 'What could I improve?' },
      { row: 1, col: 0, prompt: 'What did I learn?' },
      { row: 1, col: 1, prompt: 'How am I feeling now?' },
    ],
  },
  {
    name: 'Weekly Review',
    rows: 3,
    cols: 3,
    cells: [
      { row: 0, col: 0, prompt: 'Accomplishments' },
      { row: 0, col: 1, prompt: 'Challenges' },
      { row: 0, col: 2, prompt: 'Lessons' },
      { row: 1, col: 0, prompt: 'Health & Energy' },
      { row: 1, col: 1, prompt: 'Relationships' },
      { row: 1, col: 2, prompt: 'Work & Career' },
      { row: 2, col: 0, prompt: 'Personal Growth' },
      { row: 2, col: 1, prompt: 'Fun & Recreation' },
      { row: 2, col: 2, prompt: 'Goals for Next Week' },
    ],
  },
  {
    name: 'Mindfulness Check',
    rows: 2,
    cols: 3,
    cells: [
      { row: 0, col: 0, prompt: 'Body Scan' },
      { row: 0, col: 1, prompt: 'Current Emotion' },
      { row: 0, col: 2, prompt: 'Stressors' },
      { row: 1, col: 0, prompt: 'Coping Strategy' },
      { row: 1, col: 1, prompt: 'Gratitude' },
      { row: 1, col: 2, prompt: 'Intention' },
    ],
  },
  {
    name: 'Decision Matrix',
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, prompt: 'Situation' },
      { row: 0, col: 1, prompt: 'Pros' },
      { row: 1, col: 0, prompt: 'Cons' },
      { row: 1, col: 1, prompt: 'Decision' },
    ],
  },
];

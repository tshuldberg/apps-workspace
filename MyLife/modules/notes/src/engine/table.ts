/**
 * GFM (GitHub Flavored Markdown) table parsing, generation, and manipulation.
 * Operates on pipe-syntax markdown tables stored in the note body.
 */

export type ColumnAlignment = 'left' | 'center' | 'right';

export interface TableData {
  headers: string[];
  alignments: ColumnAlignment[];
  rows: string[][];
}

/**
 * Escape pipe characters in cell content for GFM table syntax.
 */
export function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/**
 * Unescape pipe characters in cell content.
 */
function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, '|');
}

/**
 * Parse a GFM pipe-syntax table from markdown text.
 * Returns null if the text is not a valid table.
 */
export function parseTable(markdown: string): TableData | null {
  const lines = markdown.trim().split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const parseLine = (line: string): string[] => {
    const trimmed = line.trim();
    const stripped = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const end = stripped.endsWith('|') ? stripped.slice(0, -1) : stripped;
    return end.split(/(?<!\\)\|/).map((cell) => unescapeCell(cell.trim()));
  };

  const headers = parseLine(lines[0]);
  if (headers.length === 0) return null;

  // Parse separator row for alignments
  const sepCells = parseLine(lines[1]);
  const isSeparator = sepCells.every((cell) => /^:?-+:?$/.test(cell.trim()));
  if (!isSeparator) return null;

  const alignments: ColumnAlignment[] = sepCells.map((cell) => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(':');
    const right = trimmed.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    // Pad or trim to match header count
    while (cells.length < headers.length) cells.push('');
    if (cells.length > headers.length) cells.length = headers.length;
    rows.push(cells);
  }

  return { headers, alignments, rows };
}

/**
 * Generate aligned GFM pipe-syntax markdown from structured table data.
 */
export function generateTable(table: TableData): string {
  const colCount = table.headers.length;
  // Calculate max width per column
  const widths: number[] = new Array(colCount).fill(0);
  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(widths[c], escapeCell(table.headers[c]).length);
    for (const row of table.rows) {
      const val = c < row.length ? escapeCell(row[c]) : '';
      widths[c] = Math.max(widths[c], val.length);
    }
    widths[c] = Math.max(widths[c], 3); // Minimum width for separator
  }

  const pad = (text: string, width: number, align: ColumnAlignment): string => {
    const diff = width - text.length;
    if (diff <= 0) return text;
    if (align === 'center') {
      const left = Math.floor(diff / 2);
      return ' '.repeat(left) + text + ' '.repeat(diff - left);
    }
    if (align === 'right') return ' '.repeat(diff) + text;
    return text + ' '.repeat(diff);
  };

  const formatRow = (cells: string[]): string => {
    const formatted = cells.map((cell, i) => {
      const escaped = escapeCell(cell);
      return pad(escaped, widths[i], table.alignments[i] ?? 'left');
    });
    return '| ' + formatted.join(' | ') + ' |';
  };

  const headerLine = formatRow(table.headers);

  const sepLine = '| ' + table.alignments.map((align, i) => {
    const w = widths[i];
    const dashes = '-'.repeat(w);
    if (align === 'center') return ':' + dashes.slice(1, -1) + ':';
    if (align === 'right') return dashes.slice(0, -1) + ':';
    return dashes;
  }).join(' | ') + ' |';

  const dataLines = table.rows.map((row) => {
    const cells: string[] = [];
    for (let c = 0; c < colCount; c++) {
      cells.push(c < row.length ? row[c] : '');
    }
    return formatRow(cells);
  });

  return [headerLine, sepLine, ...dataLines].join('\n');
}

/**
 * Add a row to the table at the specified index (default: end).
 */
export function addRow(table: TableData, atIndex?: number): TableData {
  const newRow = new Array(table.headers.length).fill('');
  const rows = [...table.rows];
  const idx = atIndex ?? rows.length;
  rows.splice(idx, 0, newRow);
  return { ...table, rows };
}

/**
 * Add a column to the table at the specified index (default: end).
 */
export function addColumn(
  table: TableData,
  header = '',
  atIndex?: number,
): TableData {
  const idx = atIndex ?? table.headers.length;
  const headers = [...table.headers];
  headers.splice(idx, 0, header);
  const alignments = [...table.alignments];
  alignments.splice(idx, 0, 'left');
  const rows = table.rows.map((row) => {
    const newRow = [...row];
    newRow.splice(idx, 0, '');
    return newRow;
  });
  return { headers, alignments, rows };
}

/**
 * Delete a row by index. Returns null if table would have no rows.
 */
export function deleteRow(table: TableData, rowIndex: number): TableData | null {
  if (rowIndex < 0 || rowIndex >= table.rows.length) return table;
  const rows = table.rows.filter((_, i) => i !== rowIndex);
  return { ...table, rows };
}

/**
 * Delete a column by index. Returns null if table would have no columns.
 */
export function deleteColumn(table: TableData, colIndex: number): TableData | null {
  if (table.headers.length <= 1) return null;
  if (colIndex < 0 || colIndex >= table.headers.length) return table;
  const headers = table.headers.filter((_, i) => i !== colIndex);
  const alignments = table.alignments.filter((_, i) => i !== colIndex);
  const rows = table.rows.map((row) => row.filter((_, i) => i !== colIndex));
  return { headers, alignments, rows };
}

/**
 * Update a single cell's value.
 */
export function updateCell(
  table: TableData,
  rowIndex: number,
  colIndex: number,
  value: string,
): TableData {
  if (rowIndex < 0 || rowIndex >= table.rows.length) return table;
  if (colIndex < 0 || colIndex >= table.headers.length) return table;
  const rows = table.rows.map((row, ri) => {
    if (ri !== rowIndex) return row;
    const newRow = [...row];
    newRow[colIndex] = value;
    return newRow;
  });
  return { ...table, rows };
}

/**
 * Set the alignment for a column.
 */
export function setAlignment(
  table: TableData,
  colIndex: number,
  alignment: ColumnAlignment,
): TableData {
  if (colIndex < 0 || colIndex >= table.headers.length) return table;
  const alignments = [...table.alignments];
  alignments[colIndex] = alignment;
  return { ...table, alignments };
}

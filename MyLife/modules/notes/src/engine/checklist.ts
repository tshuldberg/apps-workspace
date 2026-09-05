/**
 * Checklist engine for MyNotes.
 * Pure functions for toggling, sorting, and inserting checklist items
 * in markdown note bodies. No I/O dependencies.
 */

/** Regex to match a checklist line: optional indent, dash, space, [ ] or [x], optional text */
const CHECKLIST_REGEX = /^(\s*)-\s+\[([ xX])\]\s*(.*)$/;

/** Regex for fenced code block delimiters */
const CODE_FENCE_REGEX = /^(\s*)(`{3,}|~{3,})/;

/**
 * Check if a line is a valid checklist item (not inside a code block).
 * Returns match groups or null.
 */
export function parseChecklistLine(
  line: string,
): { indent: string; checked: boolean; text: string } | null {
  const match = line.match(CHECKLIST_REGEX);
  if (!match) return null;
  return {
    indent: match[1],
    checked: match[2].toLowerCase() === 'x',
    text: match[3],
  };
}

/**
 * Determine whether a given line index is inside a fenced code block.
 * Scans from the top of the document to the target line.
 */
function isInsideCodeBlock(lines: string[], lineIndex: number): boolean {
  let insideCode = false;
  let fencePattern: string | null = null;

  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    const fenceMatch = lines[i].match(CODE_FENCE_REGEX);
    if (fenceMatch) {
      if (!insideCode) {
        insideCode = true;
        fencePattern = fenceMatch[2].charAt(0);
      } else if (fencePattern && lines[i].trim().startsWith(fencePattern.repeat(3))) {
        insideCode = false;
        fencePattern = null;
      }
    }
  }

  return insideCode;
}

/**
 * Check if a line is a checklist line (accounting for code blocks).
 */
export function isChecklistLine(body: string, lineIndex: number): boolean {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return false;
  if (isInsideCodeBlock(lines, lineIndex)) return false;
  return CHECKLIST_REGEX.test(lines[lineIndex]);
}

/**
 * Toggle a checklist item at a specific line index.
 * Swaps `[ ]` with `[x]` (or vice versa) at the target line.
 * Returns the updated body string. If the line is not a checklist item
 * or the index is out of bounds, returns the body unchanged.
 */
export function toggleChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return body;
  if (isInsideCodeBlock(lines, lineIndex)) return body;

  const line = lines[lineIndex];
  const match = line.match(CHECKLIST_REGEX);
  if (!match) return body;

  const isChecked = match[2].toLowerCase() === 'x';
  if (isChecked) {
    // Uncheck: replace [x] or [X] with [ ]
    lines[lineIndex] = line.replace(/\[([xX])\]/, '[ ]');
  } else {
    // Check: replace [ ] with [x]
    lines[lineIndex] = line.replace(/\[\s\]/, '[x]');
  }

  return lines.join('\n');
}

/**
 * Insert a checklist prefix at the given cursor position.
 * Returns the updated body with `- [ ] ` inserted.
 */
export function insertChecklist(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex > lines.length) return body;

  if (lineIndex === lines.length) {
    lines.push('- [ ] ');
  } else {
    const currentLine = lines[lineIndex];
    if (currentLine.trim() === '') {
      lines[lineIndex] = '- [ ] ';
    } else {
      lines.splice(lineIndex, 0, '- [ ] ');
    }
  }

  return lines.join('\n');
}

/**
 * Handle Enter key on a checklist line.
 * - If the line has text after the checkbox, insert a new unchecked item on the next line.
 * - If the line is empty (just `- [ ] ` with no text), remove the checklist prefix and exit checklist mode.
 * Returns { body, cursorLine } with the updated body and the line the cursor should move to.
 */
export function handleChecklistEnter(
  body: string,
  lineIndex: number,
): { body: string; cursorLine: number; exitedChecklistMode: boolean } {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { body, cursorLine: lineIndex + 1, exitedChecklistMode: false };
  }

  const line = lines[lineIndex];
  const match = line.match(CHECKLIST_REGEX);
  if (!match) {
    return { body, cursorLine: lineIndex + 1, exitedChecklistMode: false };
  }

  const indent = match[1];
  const text = match[3].trim();

  if (text.length === 0) {
    // Empty checklist line: remove the prefix and exit checklist mode
    lines[lineIndex] = '';
    return {
      body: lines.join('\n'),
      cursorLine: lineIndex,
      exitedChecklistMode: true,
    };
  }

  // Non-empty: insert new checklist item on next line with same indent
  lines.splice(lineIndex + 1, 0, `${indent}- [ ] `);
  return {
    body: lines.join('\n'),
    cursorLine: lineIndex + 1,
    exitedChecklistMode: false,
  };
}

/**
 * Indent a checklist line (Tab key). Adds 2 spaces of indent.
 * Returns updated body or unchanged if not a checklist line.
 */
export function indentChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return body;

  const line = lines[lineIndex];
  if (!CHECKLIST_REGEX.test(line)) return body;

  lines[lineIndex] = '  ' + line;
  return lines.join('\n');
}

/**
 * Outdent a checklist line (Shift+Tab). Removes up to 2 spaces of indent.
 * Returns updated body or unchanged if not a checklist line or not indented.
 */
export function outdentChecklistItem(body: string, lineIndex: number): string {
  const lines = body.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return body;

  const line = lines[lineIndex];
  if (!CHECKLIST_REGEX.test(line)) return body;

  // Remove up to 2 leading spaces
  if (line.startsWith('  ')) {
    lines[lineIndex] = line.slice(2);
  } else if (line.startsWith(' ')) {
    lines[lineIndex] = line.slice(1);
  } else {
    return body; // Not indented
  }

  return lines.join('\n');
}

/**
 * Sort checked items to the bottom of each contiguous checklist group.
 * Preserves the order of unchecked items and the order of checked items
 * within each group. Non-checklist lines act as group boundaries.
 */
export function autoSortChecked(body: string): string {
  const lines = body.split('\n');
  const result: string[] = [];
  let group: string[] = [];
  let inCodeBlock = false;

  function flushGroup() {
    if (group.length === 0) return;

    const unchecked: string[] = [];
    const checked: string[] = [];

    for (const item of group) {
      const match = item.match(CHECKLIST_REGEX);
      if (match && match[2].toLowerCase() === 'x') {
        checked.push(item);
      } else {
        unchecked.push(item);
      }
    }

    result.push(...unchecked, ...checked);
    group = [];
  }

  for (const line of lines) {
    const fenceMatch = line.match(CODE_FENCE_REGEX);
    if (fenceMatch) {
      inCodeBlock = !inCodeBlock;
      flushGroup();
      result.push(line);
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    if (CHECKLIST_REGEX.test(line)) {
      group.push(line);
    } else {
      flushGroup();
      result.push(line);
    }
  }

  flushGroup();
  return result.join('\n');
}

/**
 * Get checklist progress for a note body.
 * Returns null if no checklist items exist.
 */
export function getChecklistProgress(
  body: string,
): { checked: number; total: number; percent: number } | null {
  const lines = body.split('\n');
  let total = 0;
  let checked = 0;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = lines[i].match(CODE_FENCE_REGEX);
    if (fenceMatch) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = lines[i].match(CHECKLIST_REGEX);
    if (match) {
      total++;
      if (match[2].toLowerCase() === 'x') checked++;
    }
  }

  if (total === 0) return null;
  return { checked, total, percent: Math.round((checked / total) * 100) };
}

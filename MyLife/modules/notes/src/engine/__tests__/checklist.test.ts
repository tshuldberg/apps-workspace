import { describe, it, expect } from 'vitest';
import {
  toggleChecklistItem,
  isChecklistLine,
  parseChecklistLine,
  insertChecklist,
  handleChecklistEnter,
  indentChecklistItem,
  outdentChecklistItem,
  autoSortChecked,
  getChecklistProgress,
} from '../checklist';

describe('parseChecklistLine', () => {
  it('parses unchecked item', () => {
    const result = parseChecklistLine('- [ ] Buy milk');
    expect(result).toEqual({ indent: '', checked: false, text: 'Buy milk' });
  });

  it('parses checked item', () => {
    const result = parseChecklistLine('- [x] Done task');
    expect(result).toEqual({ indent: '', checked: true, text: 'Done task' });
  });

  it('parses checked item with uppercase X', () => {
    const result = parseChecklistLine('- [X] Done task');
    expect(result).toEqual({ indent: '', checked: true, text: 'Done task' });
  });

  it('parses indented item', () => {
    const result = parseChecklistLine('  - [ ] Nested');
    expect(result).toEqual({ indent: '  ', checked: false, text: 'Nested' });
  });

  it('returns null for non-checklist line', () => {
    expect(parseChecklistLine('Just text')).toBeNull();
    expect(parseChecklistLine('- Regular list item')).toBeNull();
    expect(parseChecklistLine('# Heading')).toBeNull();
  });

  it('returns null for partial syntax', () => {
    expect(parseChecklistLine('- [ incomplete')).toBeNull();
    expect(parseChecklistLine('- [x')).toBeNull();
  });

  it('parses empty checklist item', () => {
    const result = parseChecklistLine('- [ ] ');
    expect(result).toEqual({ indent: '', checked: false, text: '' });
  });
});

describe('isChecklistLine', () => {
  it('identifies checklist lines', () => {
    const body = '- [ ] First\n- [x] Second\nPlain text';
    expect(isChecklistLine(body, 0)).toBe(true);
    expect(isChecklistLine(body, 1)).toBe(true);
    expect(isChecklistLine(body, 2)).toBe(false);
  });

  it('rejects checklist syntax inside code blocks', () => {
    const body = '```\n- [ ] Not a checklist\n```';
    expect(isChecklistLine(body, 1)).toBe(false);
  });

  it('handles out of bounds index', () => {
    expect(isChecklistLine('test', -1)).toBe(false);
    expect(isChecklistLine('test', 5)).toBe(false);
  });
});

describe('toggleChecklistItem', () => {
  it('toggles unchecked to checked', () => {
    const body = '- [ ] Todo item';
    const result = toggleChecklistItem(body, 0);
    expect(result).toBe('- [x] Todo item');
  });

  it('toggles checked to unchecked', () => {
    const body = '- [x] Done item';
    const result = toggleChecklistItem(body, 0);
    expect(result).toBe('- [ ] Done item');
  });

  it('toggles uppercase X to unchecked', () => {
    const body = '- [X] Done item';
    const result = toggleChecklistItem(body, 0);
    expect(result).toBe('- [ ] Done item');
  });

  it('returns body unchanged for non-checklist line', () => {
    const body = 'Just plain text';
    expect(toggleChecklistItem(body, 0)).toBe(body);
  });

  it('returns body unchanged for out of bounds index', () => {
    const body = '- [ ] Item';
    expect(toggleChecklistItem(body, -1)).toBe(body);
    expect(toggleChecklistItem(body, 5)).toBe(body);
  });

  it('toggles nested checklist item', () => {
    const body = '- [ ] Parent\n  - [ ] Child';
    const result = toggleChecklistItem(body, 1);
    expect(result).toBe('- [ ] Parent\n  - [x] Child');
  });

  it('only modifies the target line', () => {
    const body = '- [ ] First\n- [ ] Second\n- [ ] Third';
    const result = toggleChecklistItem(body, 1);
    expect(result).toBe('- [ ] First\n- [x] Second\n- [ ] Third');
  });

  it('does not toggle checklist inside code block', () => {
    const body = '```\n- [ ] Inside code\n```';
    expect(toggleChecklistItem(body, 1)).toBe(body);
  });

  it('handles checklist after code block', () => {
    const body = '```\ncode\n```\n- [ ] After code';
    const result = toggleChecklistItem(body, 3);
    expect(result).toBe('```\ncode\n```\n- [x] After code');
  });

  it('handles mixed content with multiple checklists', () => {
    const body = '# Title\n- [ ] Task 1\nSome text\n- [x] Task 2\n- [ ] Task 3';
    const result = toggleChecklistItem(body, 3);
    expect(result).toBe('# Title\n- [ ] Task 1\nSome text\n- [ ] Task 2\n- [ ] Task 3');
  });
});

describe('insertChecklist', () => {
  it('inserts checklist prefix on empty line', () => {
    const body = 'Line 1\n\nLine 3';
    const result = insertChecklist(body, 1);
    expect(result).toBe('Line 1\n- [ ] \nLine 3');
  });

  it('inserts checklist before existing content', () => {
    const body = 'Line 1\nLine 2';
    const result = insertChecklist(body, 1);
    expect(result).toBe('Line 1\n- [ ] \nLine 2');
  });

  it('appends checklist at end of body', () => {
    const body = 'Line 1';
    const result = insertChecklist(body, 1);
    expect(result).toBe('Line 1\n- [ ] ');
  });

  it('returns body unchanged for negative index', () => {
    expect(insertChecklist('test', -1)).toBe('test');
  });
});

describe('handleChecklistEnter', () => {
  it('continues checklist on non-empty item', () => {
    const body = '- [ ] First item';
    const result = handleChecklistEnter(body, 0);
    expect(result.body).toBe('- [ ] First item\n- [ ] ');
    expect(result.cursorLine).toBe(1);
    expect(result.exitedChecklistMode).toBe(false);
  });

  it('exits checklist mode on empty item', () => {
    const body = '- [ ] First item\n- [ ] ';
    const result = handleChecklistEnter(body, 1);
    expect(result.body).toBe('- [ ] First item\n');
    expect(result.cursorLine).toBe(1);
    expect(result.exitedChecklistMode).toBe(true);
  });

  it('preserves indent level on continuation', () => {
    const body = '  - [ ] Nested item';
    const result = handleChecklistEnter(body, 0);
    expect(result.body).toBe('  - [ ] Nested item\n  - [ ] ');
    expect(result.cursorLine).toBe(1);
  });

  it('returns unchanged for non-checklist line', () => {
    const body = 'Regular text';
    const result = handleChecklistEnter(body, 0);
    expect(result.body).toBe(body);
    expect(result.cursorLine).toBe(1);
    expect(result.exitedChecklistMode).toBe(false);
  });

  it('handles out of bounds', () => {
    const body = '- [ ] Item';
    const result = handleChecklistEnter(body, 5);
    expect(result.body).toBe(body);
  });
});

describe('indentChecklistItem', () => {
  it('adds 2 spaces of indent', () => {
    const body = '- [ ] Item';
    const result = indentChecklistItem(body, 0);
    expect(result).toBe('  - [ ] Item');
  });

  it('adds to existing indent', () => {
    const body = '  - [ ] Item';
    const result = indentChecklistItem(body, 0);
    expect(result).toBe('    - [ ] Item');
  });

  it('returns unchanged for non-checklist line', () => {
    const body = 'Plain text';
    expect(indentChecklistItem(body, 0)).toBe(body);
  });

  it('returns unchanged for out of bounds', () => {
    const body = '- [ ] Item';
    expect(indentChecklistItem(body, 5)).toBe(body);
  });
});

describe('outdentChecklistItem', () => {
  it('removes 2 spaces of indent', () => {
    const body = '  - [ ] Item';
    const result = outdentChecklistItem(body, 0);
    expect(result).toBe('- [ ] Item');
  });

  it('removes 1 space if only 1 exists', () => {
    const body = ' - [ ] Item';
    const result = outdentChecklistItem(body, 0);
    expect(result).toBe('- [ ] Item');
  });

  it('returns unchanged if not indented', () => {
    const body = '- [ ] Item';
    expect(outdentChecklistItem(body, 0)).toBe(body);
  });

  it('returns unchanged for non-checklist line', () => {
    const body = '  Plain text';
    expect(outdentChecklistItem(body, 0)).toBe(body);
  });
});

describe('autoSortChecked', () => {
  it('sorts checked items to bottom of contiguous group', () => {
    const body = '- [x] Done\n- [ ] Todo\n- [x] Also done\n- [ ] Still todo';
    const result = autoSortChecked(body);
    expect(result).toBe('- [ ] Todo\n- [ ] Still todo\n- [x] Done\n- [x] Also done');
  });

  it('treats non-checklist lines as group boundaries', () => {
    const body = '- [x] Group1 done\n- [ ] Group1 todo\n\nSome text\n\n- [ ] Group2 todo\n- [x] Group2 done';
    const result = autoSortChecked(body);
    const lines = result.split('\n');
    // Group 1
    expect(lines[0]).toBe('- [ ] Group1 todo');
    expect(lines[1]).toBe('- [x] Group1 done');
    // Separator
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('Some text');
    expect(lines[4]).toBe('');
    // Group 2
    expect(lines[5]).toBe('- [ ] Group2 todo');
    expect(lines[6]).toBe('- [x] Group2 done');
  });

  it('preserves body with no checklists', () => {
    const body = '# Heading\nSome text\nMore text';
    expect(autoSortChecked(body)).toBe(body);
  });

  it('handles all checked items', () => {
    const body = '- [x] A\n- [x] B';
    expect(autoSortChecked(body)).toBe(body);
  });

  it('handles all unchecked items', () => {
    const body = '- [ ] A\n- [ ] B';
    expect(autoSortChecked(body)).toBe(body);
  });

  it('does not sort inside code blocks', () => {
    const body = '```\n- [x] Done\n- [ ] Todo\n```';
    expect(autoSortChecked(body)).toBe(body);
  });
});

describe('getChecklistProgress', () => {
  it('returns progress for mixed checklist', () => {
    const body = '- [ ] First\n- [x] Second\n- [x] Third\n- [ ] Fourth';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 2, total: 4, percent: 50 });
  });

  it('returns null for no checklist items', () => {
    expect(getChecklistProgress('No checklists here')).toBeNull();
    expect(getChecklistProgress('')).toBeNull();
  });

  it('returns 100% when all checked', () => {
    const body = '- [x] A\n- [x] B\n- [x] C';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 3, total: 3, percent: 100 });
  });

  it('returns 0% when none checked', () => {
    const body = '- [ ] A\n- [ ] B';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 0, total: 2, percent: 0 });
  });

  it('excludes checklist items inside code blocks', () => {
    const body = '- [ ] Real item\n```\n- [ ] Not real\n```\n- [x] Another real';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 1, total: 2, percent: 50 });
  });

  it('handles nested checklists', () => {
    const body = '- [ ] Parent\n  - [x] Child 1\n  - [ ] Child 2';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 1, total: 3, percent: 33 });
  });

  it('rounds percentage correctly', () => {
    const body = '- [x] A\n- [ ] B\n- [ ] C';
    const result = getChecklistProgress(body);
    expect(result).toEqual({ checked: 1, total: 3, percent: 33 });
  });
});

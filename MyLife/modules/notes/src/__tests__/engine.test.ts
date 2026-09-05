import { describe, it, expect } from 'vitest';
import {
  extractBacklinks,
  countWords,
  extractHeadings,
  countChecklistItems,
  generateSnippet,
} from '../engine/markdown';
import {
  parseCodeBlocks,
  resolveLanguage,
  countCodeBlocks,
  extractCodeContent,
  SUPPORTED_LANGUAGES,
} from '../engine/code-highlight';
import {
  parseTable,
  generateTable,
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  updateCell,
  setAlignment,
  escapeCell,
} from '../engine/table';

describe('extractBacklinks', () => {
  it('extracts single backlink', () => {
    expect(extractBacklinks('See [[My Note]] for more')).toEqual(['My Note']);
  });

  it('extracts multiple backlinks', () => {
    expect(extractBacklinks('Link to [[Note A]] and [[Note B]]')).toEqual(['Note A', 'Note B']);
  });

  it('deduplicates repeated links', () => {
    expect(extractBacklinks('[[Same]] and [[Same]] again')).toEqual(['Same']);
  });

  it('returns empty for no backlinks', () => {
    expect(extractBacklinks('No links here')).toEqual([]);
  });

  it('handles empty brackets', () => {
    expect(extractBacklinks('Empty [[]] here')).toEqual([]);
  });

  it('trims whitespace in link titles', () => {
    expect(extractBacklinks('[[ Spaced Title  ]]')).toEqual(['Spaced Title']);
  });
});

describe('countWords', () => {
  it('counts words in plain text', () => {
    expect(countWords('Hello world foo bar')).toBe(4);
  });

  it('strips markdown headings', () => {
    expect(countWords('# Heading\n\nSome text here')).toBe(4);
  });

  it('strips markdown formatting', () => {
    expect(countWords('**bold** and *italic* text')).toBe(4);
  });

  it('strips markdown links', () => {
    expect(countWords('[click here](http://example.com) for more')).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace only', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });
});

describe('extractHeadings', () => {
  it('extracts headings with levels', () => {
    const md = '# Title\n## Section\n### Subsection\nRegular text';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 1, text: 'Title' });
    expect(headings[1]).toEqual({ level: 2, text: 'Section' });
    expect(headings[2]).toEqual({ level: 3, text: 'Subsection' });
  });

  it('returns empty for no headings', () => {
    expect(extractHeadings('Just text')).toHaveLength(0);
  });
});

describe('countChecklistItems', () => {
  it('counts checked and unchecked items', () => {
    const md = '- [ ] Todo 1\n- [x] Done 1\n- [ ] Todo 2\n- [x] Done 2';
    const result = countChecklistItems(md);
    expect(result.total).toBe(4);
    expect(result.checked).toBe(2);
  });

  it('returns zero for no checklists', () => {
    expect(countChecklistItems('No checklists')).toEqual({ total: 0, checked: 0 });
  });
});

describe('generateSnippet', () => {
  it('generates short snippet from body', () => {
    const snippet = generateSnippet('# Title\n\nSome **bold** content here', 50);
    expect(snippet).not.toContain('#');
    expect(snippet).not.toContain('**');
    expect(snippet.length).toBeLessThanOrEqual(53); // 50 + "..."
  });

  it('returns full text if under maxLength', () => {
    expect(generateSnippet('Short text')).toBe('Short text');
  });

  it('truncates long text with ellipsis', () => {
    const long = 'word '.repeat(100);
    const snippet = generateSnippet(long, 30);
    expect(snippet.endsWith('...')).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(33);
  });
});

// ── Code Blocks ───────────────────────────────────────────────────────

describe('parseCodeBlocks', () => {
  it('parses a single code block with language', () => {
    const md = '# Hello\n```javascript\nconst x = 1;\n```\nDone';
    const blocks = parseCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('const x = 1;');
  });

  it('parses a code block without language', () => {
    const md = '```\nplain text\n```';
    const blocks = parseCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBeNull();
    expect(blocks[0].code).toBe('plain text');
  });

  it('parses multiple code blocks', () => {
    const md = '```python\nprint("hi")\n```\nText\n```sql\nSELECT 1;\n```';
    const blocks = parseCodeBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('python');
    expect(blocks[1].language).toBe('sql');
  });

  it('handles empty code block', () => {
    const md = '```js\n```';
    const blocks = parseCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('');
  });

  it('preserves multiline code', () => {
    const md = '```\nline1\nline2\nline3\n```';
    const blocks = parseCodeBlocks(md);
    expect(blocks[0].code).toBe('line1\nline2\nline3');
  });

  it('returns empty for no code blocks', () => {
    expect(parseCodeBlocks('Just text')).toHaveLength(0);
  });
});

describe('resolveLanguage', () => {
  it('resolves a supported language', () => {
    expect(resolveLanguage('python')).toBe('python');
    expect(resolveLanguage('JavaScript')).toBe('javascript');
  });

  it('resolves aliases', () => {
    expect(resolveLanguage('js')).toBe('javascript');
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('py')).toBe('python');
    expect(resolveLanguage('sh')).toBe('bash');
    expect(resolveLanguage('yml')).toBe('yaml');
  });

  it('returns null for unknown language', () => {
    expect(resolveLanguage('brainfuck')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(resolveLanguage(null)).toBeNull();
  });
});

describe('countCodeBlocks', () => {
  it('counts code blocks in markdown', () => {
    const md = '```js\nfoo\n```\ntext\n```py\nbar\n```';
    expect(countCodeBlocks(md)).toBe(2);
  });

  it('returns 0 for no code blocks', () => {
    expect(countCodeBlocks('no code here')).toBe(0);
  });
});

describe('extractCodeContent', () => {
  it('extracts code content from blocks', () => {
    const md = '```js\nconst x = 1;\n```\n```py\nprint("hi")\n```';
    expect(extractCodeContent(md)).toEqual(['const x = 1;', 'print("hi")']);
  });
});

describe('SUPPORTED_LANGUAGES', () => {
  it('includes essential languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('javascript');
    expect(SUPPORTED_LANGUAGES).toContain('typescript');
    expect(SUPPORTED_LANGUAGES).toContain('python');
    expect(SUPPORTED_LANGUAGES).toContain('sql');
    expect(SUPPORTED_LANGUAGES).toContain('bash');
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(30);
  });
});

// ── Table Support ─────────────────────────────────────────────────────

describe('parseTable', () => {
  it('parses a valid GFM table', () => {
    const md = '| Feature | Status |\n|---------|--------|\n| Search  | Done   |\n| Export  | WIP    |';
    const table = parseTable(md);
    expect(table).not.toBeNull();
    expect(table!.headers).toEqual(['Feature', 'Status']);
    expect(table!.rows).toHaveLength(2);
    expect(table!.rows[0]).toEqual(['Search', 'Done']);
    expect(table!.rows[1]).toEqual(['Export', 'WIP']);
  });

  it('parses alignments', () => {
    const md = '| L | C | R |\n|:---|:---:|---:|\n| a | b | c |';
    const table = parseTable(md);
    expect(table!.alignments).toEqual(['left', 'center', 'right']);
  });

  it('returns null for malformed table', () => {
    expect(parseTable('not a table')).toBeNull();
    expect(parseTable('| just | headers |')).toBeNull();
  });

  it('handles escaped pipes in cells', () => {
    const md = '| Name |\n|------|\n| a\\|b |';
    const table = parseTable(md);
    expect(table!.rows[0][0]).toBe('a|b');
  });
});

describe('generateTable', () => {
  it('generates aligned GFM table', () => {
    const table = { headers: ['A', 'B'], alignments: ['left' as const, 'left' as const], rows: [['1', '22'], ['333', '4']] };
    const md = generateTable(table);
    expect(md).toContain('| A   | B');
    expect(md).toContain('| 333 | 4');
  });

  it('round-trips parse and generate', () => {
    const original = '| X | Y |\n|---|---|\n| a | b |';
    const table = parseTable(original)!;
    const regenerated = generateTable(table);
    const reparsed = parseTable(regenerated)!;
    expect(reparsed.headers).toEqual(table.headers);
    expect(reparsed.rows).toEqual(table.rows);
  });
});

describe('addRow', () => {
  it('adds a row at the end', () => {
    const table = { headers: ['A', 'B'], alignments: ['left' as const, 'left' as const], rows: [['1', '2']] };
    const result = addRow(table);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toEqual(['', '']);
  });
});

describe('addColumn', () => {
  it('adds a column at the end', () => {
    const table = { headers: ['A'], alignments: ['left' as const], rows: [['1']] };
    const result = addColumn(table, 'B');
    expect(result.headers).toEqual(['A', 'B']);
    expect(result.rows[0]).toEqual(['1', '']);
  });
});

describe('deleteRow', () => {
  it('deletes a specific row', () => {
    const table = { headers: ['A'], alignments: ['left' as const], rows: [['1'], ['2'], ['3']] };
    const result = deleteRow(table, 1)!;
    expect(result.rows).toEqual([['1'], ['3']]);
  });
});

describe('deleteColumn', () => {
  it('deletes a specific column', () => {
    const table = { headers: ['A', 'B', 'C'], alignments: ['left' as const, 'left' as const, 'left' as const], rows: [['1', '2', '3']] };
    const result = deleteColumn(table, 1)!;
    expect(result.headers).toEqual(['A', 'C']);
    expect(result.rows[0]).toEqual(['1', '3']);
  });

  it('returns null when deleting last column', () => {
    const table = { headers: ['A'], alignments: ['left' as const], rows: [['1']] };
    expect(deleteColumn(table, 0)).toBeNull();
  });
});

describe('updateCell', () => {
  it('updates a single cell', () => {
    const table = { headers: ['A', 'B'], alignments: ['left' as const, 'left' as const], rows: [['old', 'val']] };
    const result = updateCell(table, 0, 0, 'new');
    expect(result.rows[0][0]).toBe('new');
    expect(result.rows[0][1]).toBe('val');
  });
});

describe('setAlignment', () => {
  it('sets column alignment', () => {
    const table = { headers: ['A', 'B'], alignments: ['left' as const, 'left' as const], rows: [] };
    const result = setAlignment(table, 1, 'center');
    expect(result.alignments).toEqual(['left', 'center']);
  });
});

describe('escapeCell', () => {
  it('escapes pipe characters', () => {
    expect(escapeCell('a|b|c')).toBe('a\\|b\\|c');
  });

  it('leaves text without pipes unchanged', () => {
    expect(escapeCell('no pipes')).toBe('no pipes');
  });
});

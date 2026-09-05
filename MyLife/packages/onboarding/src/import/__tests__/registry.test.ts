import { describe, it, expect, beforeEach } from 'vitest';
import type { ImportAdapter, ParsedRecord } from '../types';
import {
  registerAdapter,
  getAdaptersForModule,
  getAdapterByName,
  getAllAdapters,
  detectAdapter,
  clearRegistry,
} from '../registry';

function makeAdapter(overrides: Partial<ImportAdapter> = {}): ImportAdapter {
  return {
    name: 'test-adapter',
    sourceApp: 'TestApp',
    targetModule: 'books',
    supportedExtensions: ['.csv'],
    detectFormat: () => ({ detected: true, confidence: 0.9, reason: 'test' }),
    parse: () => [],
    validate: (records) => ({ valid: records, errors: [] }),
    transform: (records) => records as ParsedRecord[],
    import: (_db, records) => ({
      adapterName: 'test-adapter',
      targetModule: 'books',
      totalRows: records.length,
      imported: records.length,
      skipped: 0,
      failed: 0,
      errors: [],
      durationMs: 0,
    }),
    ...overrides,
  };
}

beforeEach(() => {
  clearRegistry();
});

describe('registerAdapter', () => {
  it('registers an adapter', () => {
    registerAdapter(makeAdapter());
    expect(getAllAdapters()).toHaveLength(1);
  });

  it('ignores duplicate registrations (same name)', () => {
    registerAdapter(makeAdapter({ name: 'dup' }));
    registerAdapter(makeAdapter({ name: 'dup' }));
    expect(getAllAdapters()).toHaveLength(1);
  });

  it('allows different adapters with different names', () => {
    registerAdapter(makeAdapter({ name: 'a' }));
    registerAdapter(makeAdapter({ name: 'b' }));
    expect(getAllAdapters()).toHaveLength(2);
  });
});

describe('getAdaptersForModule', () => {
  it('returns adapters targeting the given module', () => {
    registerAdapter(makeAdapter({ name: 'books-goodreads', targetModule: 'books' }));
    registerAdapter(makeAdapter({ name: 'budget-ynab', targetModule: 'budget' }));

    const booksAdapters = getAdaptersForModule('books');
    expect(booksAdapters).toHaveLength(1);
    expect(booksAdapters[0].name).toBe('books-goodreads');
  });

  it('returns empty array for modules with no adapters', () => {
    registerAdapter(makeAdapter({ name: 'a', targetModule: 'books' }));
    expect(getAdaptersForModule('budget')).toEqual([]);
  });

  it('returns multiple adapters for same module', () => {
    registerAdapter(makeAdapter({ name: 'goodreads', targetModule: 'books' }));
    registerAdapter(makeAdapter({ name: 'storygraph', targetModule: 'books' }));
    expect(getAdaptersForModule('books')).toHaveLength(2);
  });
});

describe('getAdapterByName', () => {
  it('finds an adapter by name', () => {
    registerAdapter(makeAdapter({ name: 'my-adapter' }));
    const found = getAdapterByName('my-adapter');
    expect(found).toBeDefined();
    expect(found!.name).toBe('my-adapter');
  });

  it('returns undefined for unknown name', () => {
    expect(getAdapterByName('nonexistent')).toBeUndefined();
  });
});

describe('detectAdapter', () => {
  it('returns matching adapters sorted by confidence', () => {
    registerAdapter(makeAdapter({
      name: 'low-conf',
      detectFormat: () => ({ detected: true, confidence: 0.5, reason: 'maybe' }),
    }));
    registerAdapter(makeAdapter({
      name: 'high-conf',
      detectFormat: () => ({ detected: true, confidence: 0.95, reason: 'header match' }),
    }));

    const results = detectAdapter('some,csv,content');
    expect(results).toHaveLength(2);
    expect(results[0].adapter.name).toBe('high-conf');
    expect(results[0].detection.confidence).toBe(0.95);
    expect(results[1].adapter.name).toBe('low-conf');
  });

  it('excludes adapters that do not detect the format', () => {
    registerAdapter(makeAdapter({
      name: 'yes',
      detectFormat: () => ({ detected: true, confidence: 0.9, reason: 'match' }),
    }));
    registerAdapter(makeAdapter({
      name: 'no',
      detectFormat: () => ({ detected: false, confidence: 0, reason: 'no match' }),
    }));

    const results = detectAdapter('content');
    expect(results).toHaveLength(1);
    expect(results[0].adapter.name).toBe('yes');
  });

  it('returns empty array when no adapters match', () => {
    registerAdapter(makeAdapter({
      name: 'nope',
      detectFormat: () => ({ detected: false, confidence: 0, reason: 'wrong format' }),
    }));

    expect(detectAdapter('random content')).toEqual([]);
  });

  it('returns empty array when registry is empty', () => {
    expect(detectAdapter('content')).toEqual([]);
  });

  it('passes fileName to detectFormat', () => {
    let receivedFileName: string | undefined;
    registerAdapter(makeAdapter({
      name: 'filename-checker',
      detectFormat: (_content, fileName) => {
        receivedFileName = fileName;
        return { detected: true, confidence: 1, reason: 'ok' };
      },
    }));

    detectAdapter('content', 'export.csv');
    expect(receivedFileName).toBe('export.csv');
  });
});

describe('clearRegistry', () => {
  it('removes all adapters', () => {
    registerAdapter(makeAdapter({ name: 'a' }));
    registerAdapter(makeAdapter({ name: 'b' }));
    expect(getAllAdapters()).toHaveLength(2);

    clearRegistry();
    expect(getAllAdapters()).toHaveLength(0);
  });
});

describe('ImportAdapter interface contract', () => {
  it('full pipeline: detect -> parse -> validate -> transform -> import', () => {
    const adapter = makeAdapter({
      name: 'pipeline-test',
      detectFormat: (content) => ({
        detected: content.includes('Title'),
        confidence: 0.8,
        reason: 'has Title header',
      }),
      parse: (content) => {
        const lines = content.split('\n').slice(1);
        return lines
          .filter((l) => l.trim())
          .map((line, i) => ({
            rowNumber: i + 2,
            data: { title: line.trim() },
            warnings: [],
          }));
      },
      validate: (records) => {
        const valid = records.filter((r) => (r.data as { title: string }).title.length > 0);
        const errors = records
          .filter((r) => (r.data as { title: string }).title.length === 0)
          .map((r) => ({ row: r.rowNumber, field: 'title', message: 'Title is required' }));
        return { valid, errors };
      },
      transform: (records) => records.map((r) => ({
        ...r,
        data: { title: (r.data as { title: string }).title, authors: '["Unknown"]' },
      })),
      import: (_db, records) => ({
        adapterName: 'pipeline-test',
        targetModule: 'books',
        totalRows: records.length,
        imported: records.length,
        skipped: 0,
        failed: 0,
        errors: [],
        durationMs: 42,
      }),
    });

    const content = 'Title\nThe Great Gatsby\n1984\n';

    // Step 1: detect
    const detection = adapter.detectFormat(content);
    expect(detection.detected).toBe(true);

    // Step 2: parse
    const parsed = adapter.parse(content);
    expect(parsed).toHaveLength(2);
    expect((parsed[0].data as { title: string }).title).toBe('The Great Gatsby');

    // Step 3: validate
    const { valid, errors } = adapter.validate(parsed);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);

    // Step 4: transform
    const transformed = adapter.transform(valid);
    expect(transformed).toHaveLength(2);
    expect((transformed[0].data as { authors: string }).authors).toBe('["Unknown"]');

    // Step 5: import
    const result = adapter.import(null, transformed);
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.durationMs).toBe(42);
  });
});

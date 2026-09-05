import { describe, it, expect } from 'vitest';
import { dayOneAdapter } from '../adapters/dayone';
import type { DayOneSourceRecord } from '../adapters/dayone';
import type { ParsedRecord } from '../types';

// -- Sample Day One JSON fixtures ----------------------------------------

const FULL_EXPORT = JSON.stringify({
  entries: [
    {
      creationDate: '2024-06-15T08:30:00Z',
      modifiedDate: '2024-06-15T09:00:00Z',
      text: '# Morning Walk\n\nTook the dog out early. The fog was burning off over the bay.',
      tags: ['morning', 'outdoors'],
      photos: [
        { identifier: 'abc123', md5: 'def456', type: 'jpeg', filename: 'IMG_0001.jpeg' },
      ],
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        placeName: 'Baker Beach',
        localityName: 'San Francisco',
        country: 'United States',
      },
      weather: {
        conditionsDescription: 'Partly Cloudy',
        temperatureCelsius: 14,
      },
      starred: false,
      uuid: '11111111-1111-1111-1111-111111111111',
    },
    {
      creationDate: '2024-06-16T22:00:00Z',
      modifiedDate: null,
      text: 'Rough day at work. Storms rolled in.',
      tags: ['work'],
      photos: [],
      location: null,
      weather: {
        conditionsDescription: 'Rain and Thunderstorms',
        temperatureCelsius: 11,
      },
      starred: true,
      uuid: '22222222-2222-2222-2222-222222222222',
    },
    {
      creationDate: '2024-06-17T12:00:00Z',
      modifiedDate: null,
      text: 'Clear skies, went for a run.',
      tags: [],
      photos: [
        { identifier: 'xyz789', md5: 'aaa111', type: 'png', filename: null },
      ],
      location: null,
      weather: {
        conditionsDescription: 'Clear and Sunny',
        temperatureCelsius: 22,
      },
      starred: false,
      uuid: '33333333-3333-3333-3333-333333333333',
    },
  ],
});

const EMPTY_ENTRIES = JSON.stringify({ entries: [] });

const MINIMAL_ENTRY = JSON.stringify({
  entries: [
    {
      creationDate: '2024-01-01T00:00:00Z',
      text: 'Happy new year!',
      uuid: 'min-uuid',
    },
  ],
});

const NON_DAYONE_JSON = JSON.stringify({ users: [{ name: 'Alice' }] });

// -- detectFormat tests ---------------------------------------------------

describe('detectFormat', () => {
  it('detects full Day One export with high confidence', () => {
    const result = dayOneAdapter.detectFormat(FULL_EXPORT);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects empty entries array with low confidence', () => {
    const result = dayOneAdapter.detectFormat(EMPTY_ENTRIES);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeLessThan(0.6);
  });

  it('detects minimal entry (creationDate + text + uuid)', () => {
    const result = dayOneAdapter.detectFormat(MINIMAL_ENTRY);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('boosts confidence for filename containing "dayone"', () => {
    const base = dayOneAdapter.detectFormat(EMPTY_ENTRIES);
    const boosted = dayOneAdapter.detectFormat(EMPTY_ENTRIES, 'DayOne-export.json');
    expect(boosted.confidence).toBeGreaterThan(base.confidence);
  });

  it('rejects non-Day One JSON', () => {
    const result = dayOneAdapter.detectFormat(NON_DAYONE_JSON);
    expect(result.detected).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const result = dayOneAdapter.detectFormat('not json at all');
    expect(result.detected).toBe(false);
    expect(result.reason).toBe('Invalid JSON');
  });

  it('rejects JSON missing entries array', () => {
    const result = dayOneAdapter.detectFormat(JSON.stringify({ data: [] }));
    expect(result.detected).toBe(false);
  });

  it('rejects entries without creationDate', () => {
    const noDate = JSON.stringify({ entries: [{ text: 'no date', uuid: 'x' }] });
    const result = dayOneAdapter.detectFormat(noDate);
    expect(result.detected).toBe(false);
  });
});

// -- parse tests ----------------------------------------------------------

describe('parse', () => {
  it('parses full export into 3 records', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records).toHaveLength(3);
  });

  it('extracts text, tags, and uuid correctly', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[0].data.text).toContain('Morning Walk');
    expect(records[0].data.tags).toEqual(['morning', 'outdoors']);
    expect(records[0].data.uuid).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('parses location data', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const loc = records[0].data.location;
    expect(loc).not.toBeNull();
    expect(loc!.placeName).toBe('Baker Beach');
    expect(loc!.latitude).toBe(37.7749);
  });

  it('parses null location', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[1].data.location).toBeNull();
  });

  it('parses weather data', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const weather = records[0].data.weather;
    expect(weather).not.toBeNull();
    expect(weather!.conditionsDescription).toBe('Partly Cloudy');
    expect(weather!.temperatureCelsius).toBe(14);
  });

  it('parses photos with filename', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[0].data.photos).toHaveLength(1);
    expect(records[0].data.photos[0].filename).toBe('IMG_0001.jpeg');
  });

  it('parses photos without filename', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[2].data.photos[0].filename).toBeNull();
    expect(records[2].data.photos[0].identifier).toBe('xyz789');
  });

  it('parses starred flag', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[0].data.starred).toBe(false);
    expect(records[1].data.starred).toBe(true);
  });

  it('assigns correct row numbers (1-indexed)', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    expect(records[0].rowNumber).toBe(1);
    expect(records[1].rowNumber).toBe(2);
    expect(records[2].rowNumber).toBe(3);
  });

  it('handles minimal entry with missing optional fields', () => {
    const records = dayOneAdapter.parse(MINIMAL_ENTRY);
    expect(records).toHaveLength(1);
    expect(records[0].data.tags).toEqual([]);
    expect(records[0].data.photos).toEqual([]);
    expect(records[0].data.location).toBeNull();
    expect(records[0].data.weather).toBeNull();
    expect(records[0].data.starred).toBe(false);
  });

  it('warns on empty text', () => {
    const emptyText = JSON.stringify({
      entries: [{ creationDate: '2024-01-01T00:00:00Z', text: '', uuid: 'e' }],
    });
    const records = dayOneAdapter.parse(emptyText);
    expect(records[0].warnings).toContain('Entry has empty text');
  });

  it('returns empty array for invalid JSON', () => {
    expect(dayOneAdapter.parse('bad json')).toEqual([]);
  });

  it('returns empty array for missing entries', () => {
    expect(dayOneAdapter.parse(JSON.stringify({ data: [] }))).toEqual([]);
  });
});

// -- validate tests -------------------------------------------------------

describe('validate', () => {
  it('passes valid entries', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid, errors } = dayOneAdapter.validate(records);
    expect(valid).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('rejects entries with empty text', () => {
    const records: ParsedRecord<DayOneSourceRecord>[] = [
      {
        rowNumber: 1,
        data: {
          creationDate: '2024-01-01T00:00:00Z',
          modifiedDate: null,
          text: '',
          tags: [],
          photos: [],
          location: null,
          weather: null,
          starred: false,
          uuid: 'empty-text',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = dayOneAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('text');
  });

  it('rejects entries with whitespace-only text', () => {
    const records: ParsedRecord<DayOneSourceRecord>[] = [
      {
        rowNumber: 1,
        data: {
          creationDate: '2024-01-01T00:00:00Z',
          modifiedDate: null,
          text: '   \n\t  ',
          tags: [],
          photos: [],
          location: null,
          weather: null,
          starred: false,
          uuid: 'ws-text',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = dayOneAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors[0].field).toBe('text');
  });

  it('rejects entries with missing creationDate', () => {
    const records: ParsedRecord<DayOneSourceRecord>[] = [
      {
        rowNumber: 1,
        data: {
          creationDate: '',
          modifiedDate: null,
          text: 'Has text',
          tags: [],
          photos: [],
          location: null,
          weather: null,
          starred: false,
          uuid: 'no-date',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = dayOneAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors[0].field).toBe('creationDate');
  });

  it('rejects entries with invalid date format', () => {
    const records: ParsedRecord<DayOneSourceRecord>[] = [
      {
        rowNumber: 1,
        data: {
          creationDate: 'not-a-date',
          modifiedDate: null,
          text: 'Has text',
          tags: [],
          photos: [],
          location: null,
          weather: null,
          starred: false,
          uuid: 'bad-date',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = dayOneAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors[0].field).toBe('creationDate');
    expect(errors[0].value).toBe('not-a-date');
  });
});

// -- transform tests ------------------------------------------------------

describe('transform', () => {
  it('extracts title from markdown heading', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.title).toBe('Morning Walk');
    expect(transformed[0].data.body).toContain('Took the dog out early');
    expect(transformed[0].data.body).not.toContain('# Morning Walk');
  });

  it('returns null title when no heading', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[1].data.title).toBeNull();
  });

  it('normalizes dates to YYYY-MM-DD', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.entryDate).toBe('2024-06-15');
    expect(transformed[1].data.entryDate).toBe('2024-06-16');
  });

  it('appends location metadata to body', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.body).toContain('Location: Baker Beach, San Francisco, United States');
  });

  it('appends weather metadata to body', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.body).toContain('Weather: Partly Cloudy (14\u00B0C)');
  });

  it('infers mood from weather', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    // Partly Cloudy -> good
    expect(transformed[0].data.mood).toBe('good');
    // Rain and Thunderstorms -> low
    expect(transformed[1].data.mood).toBe('low');
    // Clear and Sunny -> great
    expect(transformed[2].data.mood).toBe('great');
  });

  it('adds "starred" tag for starred entries', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.tags).not.toContain('starred');
    expect(transformed[1].data.tags).toContain('starred');
  });

  it('preserves original tags', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.tags).toContain('morning');
    expect(transformed[0].data.tags).toContain('outdoors');
  });

  it('builds photo URIs with filename', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.imageUris).toEqual(['dayone://photos/IMG_0001.jpeg']);
  });

  it('builds photo URIs from identifier when no filename', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[2].data.imageUris).toEqual(['dayone://photos/xyz789.png']);
  });

  it('counts words', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.wordCount).toBeGreaterThan(5);
  });

  it('preserves source UUID', () => {
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    expect(transformed[0].data.sourceId).toBe('11111111-1111-1111-1111-111111111111');
  });
});

// -- import tests ---------------------------------------------------------

describe('import', () => {
  function makeMockDb() {
    const tables: Record<string, Record<string, unknown>[]> = {
      jn_journals: [],
      jn_entries: [],
      jn_tags: [],
      jn_entry_tags: [],
    };

    return {
      execute(sql: string, params?: unknown[]) {
        if (sql.includes('INSERT INTO jn_journals')) {
          tables.jn_journals.push({
            id: params?.[0],
            name: params?.[3] ?? 'Journal',
          });
        }
        if (sql.includes('INSERT INTO jn_entries')) {
          tables.jn_entries.push({
            id: params?.[0],
            journal_id: params?.[1],
            entry_date: params?.[2],
            title: params?.[3],
            body: params?.[4],
            mood: params?.[5],
          });
        }
        if (sql.includes('INSERT INTO jn_tags')) {
          tables.jn_tags.push({
            id: params?.[0],
            name: params?.[1],
          });
        }
        if (sql.includes('INSERT') && sql.includes('jn_entry_tags')) {
          tables.jn_entry_tags.push({
            entry_id: params?.[0],
            tag_id: params?.[1],
          });
        }
      },
      query<T>(sql: string, params?: unknown[]): T[] {
        if (sql.includes('FROM jn_journals') && sql.includes('is_default')) {
          return tables.jn_journals as T[];
        }
        if (sql.includes('FROM jn_tags') && sql.includes('name = ?')) {
          const name = params?.[0];
          return tables.jn_tags.filter((t) => t.name === name) as T[];
        }
        if (sql.includes('FROM jn_entries') && sql.includes('title = ?')) {
          const date = params?.[0];
          const title = params?.[1];
          return tables.jn_entries.filter(
            (e) => e.entry_date === date && e.title === title,
          ) as T[];
        }
        if (sql.includes('FROM jn_entries') && sql.includes('LIKE')) {
          const date = params?.[0];
          return tables.jn_entries.filter((e) => e.entry_date === date) as T[];
        }
        return [] as T[];
      },
      tables,
    };
  }

  it('imports all entries from full export', () => {
    const db = makeMockDb();
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    const result = dayOneAdapter.import(db, transformed);

    expect(result.adapterName).toBe('dayone-json');
    expect(result.targetModule).toBe('journal');
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('creates default journal when none exists', () => {
    const db = makeMockDb();
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    dayOneAdapter.import(db, transformed);

    expect(db.tables.jn_journals).toHaveLength(1);
  });

  it('reuses existing default journal', () => {
    const db = makeMockDb();
    // Pre-populate a default journal
    db.tables.jn_journals.push({ id: 'existing-journal', name: 'My Journal' });

    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    dayOneAdapter.import(db, transformed);

    // Should not create another journal
    expect(db.tables.jn_journals).toHaveLength(1);
    // All entries should reference the existing journal
    for (const entry of db.tables.jn_entries) {
      expect(entry.journal_id).toBe('existing-journal');
    }
  });

  it('creates tags and entry-tag links', () => {
    const db = makeMockDb();
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    dayOneAdapter.import(db, transformed);

    // Tags: morning, outdoors, work, starred (from entry 2)
    expect(db.tables.jn_tags.length).toBeGreaterThanOrEqual(4);
    expect(db.tables.jn_entry_tags.length).toBeGreaterThanOrEqual(4);
  });

  it('deduplicates tags across entries', () => {
    const db = makeMockDb();
    // Export with two entries sharing the same tag
    const shared = JSON.stringify({
      entries: [
        { creationDate: '2024-01-01T00:00:00Z', text: 'Entry 1', tags: ['daily'], uuid: 'a', starred: false, photos: [] },
        { creationDate: '2024-01-02T00:00:00Z', text: 'Entry 2', tags: ['daily'], uuid: 'b', starred: false, photos: [] },
      ],
    });
    const records = dayOneAdapter.parse(shared);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    dayOneAdapter.import(db, transformed);

    // "daily" tag should be created once, reused for second entry
    const dailyTags = db.tables.jn_tags.filter((t) => t.name === 'daily');
    expect(dailyTags).toHaveLength(1);
    expect(db.tables.jn_entry_tags).toHaveLength(2);
  });

  it('reports progress via callback', () => {
    const db = makeMockDb();
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);

    const phases: string[] = [];
    dayOneAdapter.import(db, transformed, (p) => phases.push(p.phase));

    expect(phases.filter((p) => p === 'importing')).toHaveLength(3);
    expect(phases[phases.length - 1]).toBe('complete');
  });

  it('reports correct duration', () => {
    const db = makeMockDb();
    const records = dayOneAdapter.parse(FULL_EXPORT);
    const { valid } = dayOneAdapter.validate(records);
    const transformed = dayOneAdapter.transform(valid);
    const result = dayOneAdapter.import(db, transformed);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// -- Full pipeline integration test --------------------------------------

describe('full pipeline', () => {
  it('detect -> parse -> validate -> transform -> verify data', () => {
    const detection = dayOneAdapter.detectFormat(FULL_EXPORT);
    expect(detection.detected).toBe(true);

    const parsed = dayOneAdapter.parse(FULL_EXPORT);
    expect(parsed).toHaveLength(3);

    const { valid, errors } = dayOneAdapter.validate(parsed);
    expect(valid).toHaveLength(3);
    expect(errors).toHaveLength(0);

    const transformed = dayOneAdapter.transform(valid);
    expect(transformed).toHaveLength(3);

    // Verify first entry
    expect(transformed[0].data.title).toBe('Morning Walk');
    expect(transformed[0].data.entryDate).toBe('2024-06-15');
    expect(transformed[0].data.tags).toContain('morning');
    expect(transformed[0].data.imageUris).toHaveLength(1);

    // Verify starred entry
    expect(transformed[1].data.tags).toContain('starred');
    expect(transformed[1].data.tags).toContain('work');
  });

  it('adapter metadata is correct', () => {
    expect(dayOneAdapter.name).toBe('dayone-json');
    expect(dayOneAdapter.sourceApp).toBe('Day One');
    expect(dayOneAdapter.targetModule).toBe('journal');
    expect(dayOneAdapter.supportedExtensions).toEqual(['.json']);
  });
});

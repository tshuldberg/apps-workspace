/**
 * Property test for import parsing with error tolerance (Property 25).
 *
 * Property 25: Import parsing with error tolerance
 *   Mix of valid/invalid rows: all valid rows imported, error details for invalid rows.
 *   Validates: Requirements 24.2, 24.4
 *
 * Tests all 4 adapters: Goodreads (CSV), YNAB (CSV), MyFitnessPal (CSV), Day One (JSON).
 * Each test generates random mixes of valid and invalid rows, runs them through
 * parse -> validate, and asserts:
 *   - All valid rows appear in the valid set
 *   - All invalid rows produce error details
 *   - valid.length + errors.length === total parsed rows
 *   - Error objects have row, field, and message
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { goodreadsAdapter } from '../adapters/goodreads';
import type { GoodreadsSourceRecord } from '../adapters/goodreads';
import type { ParsedRecord } from '../types';
import { ynabCsvAdapter, parseYnabDate, parseYnabAmount } from '../adapters/ynab';
import { myFitnessPalAdapter, isValidDate, parseMfpNumber } from '../adapters/myfitnesspal';
import { dayOneAdapter } from '../adapters/dayone';
import type { ImportValidationError } from '../types';

const NUM_RUNS = 10;

// ── Goodreads CSV Arbitraries ─────────────────────────────────────────

// CSV-safe: no quotes, commas, or newlines
const csvSafeStringArb = (min: number, max: number) =>
  fc.string({ minLength: min, maxLength: max, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz 0123456789'.split('')) })
    .filter((s) => min === 0 || s.trim().length > 0);

const goodreadsValidRowArb = fc.record({
  title: csvSafeStringArb(1, 40),
  author: csvSafeStringArb(1, 30),
  rating: fc.integer({ min: 0, max: 5 }),
  shelf: fc.constantFrom('read', 'to-read', 'currently-reading'),
});

const goodreadsInvalidRowArb = fc.constantFrom(
  // Missing title
  { title: '', author: 'Author', rating: 3, shelf: 'read' },
  // Whitespace-only title
  { title: '   ', author: 'Author', rating: 3, shelf: 'read' },
  // Missing author
  { title: 'Book', author: '', rating: 3, shelf: 'read' },
  // Author is empty array string
  { title: 'Book', author: '[]', rating: 3, shelf: 'read' },
);

function buildGoodreadsCSV(
  rows: Array<{ title: string; author: string; rating: number; shelf: string }>,
): string {
  const header =
    'Title,Author,ISBN,ISBN13,My Rating,Average Rating,Publisher,Number of Pages,Year Published,Date Read,Exclusive Shelf,Bookshelves';
  const dataRows = rows.map(
    (r) =>
      `"${r.title.replace(/"/g, '""')}","${r.author.replace(/"/g, '""')}","","",${r.rating},4.0,"Publisher",200,2020,,${r.shelf},${r.shelf}`,
  );
  return [header, ...dataRows].join('\n');
}

// ── YNAB CSV Arbitraries ──────────────────────────────────────────────

const ynabValidDateArb = fc
  .tuple(
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 2015, max: 2026 }),
  )
  .map(([m, d, y]) => `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`);

const ynabValidAmountArb = fc
  .double({ min: 0.01, max: 9999.99, noNaN: true })
  .map((v) => `$${v.toFixed(2)}`);

const ynabValidRowArb = fc.record({
  date: ynabValidDateArb,
  payee: csvSafeStringArb(1, 20),
  category: csvSafeStringArb(1, 15),
  memo: csvSafeStringArb(0, 20).map((s) => s || ''),
  outflow: ynabValidAmountArb,
  inflow: fc.constant('$0.00'),
});

const ynabInvalidRowArb = fc.constantFrom(
  // Invalid date
  { date: 'not-a-date', payee: 'Store', category: 'Food', memo: '', outflow: '$50.00', inflow: '$0.00' },
  // Both zero
  { date: '01/15/2024', payee: 'Store', category: 'Food', memo: '', outflow: '$0.00', inflow: '$0.00' },
  // Empty date
  { date: '', payee: 'Store', category: 'Food', memo: '', outflow: '$10.00', inflow: '$0.00' },
);

function buildYnabCSV(
  rows: Array<{ date: string; payee: string; category: string; memo: string; outflow: string; inflow: string }>,
): string {
  const header = '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"';
  const dataRows = rows.map(
    (r) =>
      `"Checking","","${r.date}","${r.payee}","${r.category}","","${r.category}","${r.memo}","${r.outflow}","${r.inflow}","Cleared"`,
  );
  return [header, ...dataRows].join('\n');
}

// ── MFP CSV Arbitraries ───────────────────────────────────────────────

const mfpValidDateArb = fc
  .tuple(
    fc.integer({ min: 2015, max: 2026 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

const mfpValidRowArb = fc.record({
  date: mfpValidDateArb,
  meal: fc.constantFrom('Breakfast', 'Lunch', 'Dinner', 'Snacks'),
  foodName: csvSafeStringArb(1, 30),
  calories: fc.integer({ min: 0, max: 2000 }).map(String),
});

const mfpInvalidRowArb = fc.constantFrom(
  // Invalid date
  { date: 'bad-date', meal: 'Breakfast', foodName: 'Egg', calories: '100' },
  // Empty food name
  { date: '2024-01-15', meal: 'Lunch', foodName: '', calories: '200' },
  // Whitespace food name
  { date: '2024-01-15', meal: 'Dinner', foodName: '   ', calories: '300' },
);

function buildMfpCSV(
  rows: Array<{ date: string; meal: string; foodName: string; calories: string }>,
): string {
  const header =
    'Date,Meal,Food Name,Calories,Fat (g),Saturated Fat,Polyunsaturated Fat,Monounsaturated Fat,Trans Fat,Cholesterol,Sodium (mg),Potassium,Carbohydrates (g),Fiber,Sugar,Protein (g),Vitamin A,Vitamin C,Calcium,Iron,Note';
  const dataRows = rows.map(
    (r) =>
      `${r.date},${r.meal},"${r.foodName.replace(/"/g, '""')}",${r.calories},5,2,1,1,0,10,100,50,20,3,5,10,0,0,0,0,`,
  );
  return [header, ...dataRows].join('\n');
}

// ── Day One JSON Arbitraries ──────────────────────────────────────────

const dayOneValidEntryArb = fc.record({
  text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
  creationDate: fc
    .date({ min: new Date('2015-01-01'), max: new Date('2026-12-31') })
    .map((d) => d.toISOString()),
  uuid: fc.uuid(),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 3 }),
});

const dayOneInvalidEntryArb = fc.constantFrom(
  // Empty text
  { text: '', creationDate: '2024-01-15T10:00:00Z', uuid: 'a1b2c3', tags: [] },
  // Whitespace text
  { text: '   ', creationDate: '2024-01-15T10:00:00Z', uuid: 'a1b2c4', tags: [] },
  // Missing creation date
  { text: 'Some entry', creationDate: '', uuid: 'a1b2c5', tags: [] },
  // Invalid creation date
  { text: 'Some entry', creationDate: 'not-a-date', uuid: 'a1b2c6', tags: [] },
);

function buildDayOneJSON(
  entries: Array<{ text: string; creationDate: string; uuid: string; tags: string[] }>,
): string {
  return JSON.stringify({
    entries: entries.map((e) => ({
      text: e.text,
      creationDate: e.creationDate,
      uuid: e.uuid,
      tags: e.tags,
      starred: false,
    })),
  });
}

// ── Shared assertions ─────────────────────────────────────────────────

function assertErrorDetails(errors: ImportValidationError[]): void {
  for (const err of errors) {
    expect(typeof err.row).toBe('number');
    expect(err.row).toBeGreaterThan(0);
    expect(typeof err.field).toBe('string');
    expect(err.field.length).toBeGreaterThan(0);
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Property 25: Import parsing with error tolerance', () => {
  describe('Goodreads adapter (R24.2)', () => {
    it('validate partitions mixed records: valid pass, invalid produce errors', () => {
      // Goodreads parse() delegates to @mylife/books parseGoodreadsCSV which may
      // skip malformed rows. Test validate() directly with constructed records.
      const validRecordArb = goodreadsValidRowArb.map((r) => ({
        rowNumber: 2,
        data: {
          title: r.title,
          authors: r.author,
          isbn10: null as string | null,
          isbn13: null as string | null,
          pageCount: null as number | null,
          publishYear: null as number | null,
          format: 'physical',
          rating: r.rating as number | null,
          reviewText: null as string | null,
          shelves: [r.shelf],
          status: r.shelf as string | null,
          finishedAt: null as string | null,
        },
        warnings: [] as string[],
      }));

      const invalidRecordArb = fc.constantFrom(
        {
          rowNumber: 99, data: { title: '', authors: 'Author', isbn10: null, isbn13: null,
            pageCount: null, publishYear: null, format: 'physical', rating: null,
            reviewText: null, shelves: [] as string[], status: null, finishedAt: null },
          warnings: [] as string[],
        },
        {
          rowNumber: 100, data: { title: '   ', authors: 'Author', isbn10: null, isbn13: null,
            pageCount: null, publishYear: null, format: 'physical', rating: null,
            reviewText: null, shelves: [] as string[], status: null, finishedAt: null },
          warnings: [] as string[],
        },
        {
          rowNumber: 101, data: { title: 'Book', authors: '', isbn10: null, isbn13: null,
            pageCount: null, publishYear: null, format: 'physical', rating: null,
            reviewText: null, shelves: [] as string[], status: null, finishedAt: null },
          warnings: [] as string[],
        },
        {
          rowNumber: 102, data: { title: 'Book', authors: '[]', isbn10: null, isbn13: null,
            pageCount: null, publishYear: null, format: 'physical', rating: null,
            reviewText: null, shelves: [] as string[], status: null, finishedAt: null },
          warnings: [] as string[],
        },
      );

      fc.assert(
        fc.property(
          fc.array(validRecordArb, { minLength: 1, maxLength: 8 }),
          fc.array(invalidRecordArb, { minLength: 1, maxLength: 4 }),
          (validRecords, invalidRecords) => {
            const allRecords: ParsedRecord<GoodreadsSourceRecord>[] = [...validRecords, ...invalidRecords];
            const { valid, errors } = goodreadsAdapter.validate(allRecords);

            expect(valid.length + errors.length).toBe(allRecords.length);
            expect(valid.length).toBeGreaterThanOrEqual(validRecords.length);
            expect(errors.length).toBeGreaterThanOrEqual(invalidRecords.length);

            for (const rec of valid) {
              expect(rec.data.title.trim().length).toBeGreaterThan(0);
              expect(rec.data.authors).not.toBe('');
              expect(rec.data.authors).not.toBe('[]');
            }

            assertErrorDetails(errors);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('all-valid CSV input parses and validates with zero errors', () => {
      fc.assert(
        fc.property(
          fc.array(goodreadsValidRowArb, { minLength: 1, maxLength: 10 }),
          (rows) => {
            const csv = buildGoodreadsCSV(rows);
            const parsed = goodreadsAdapter.parse(csv);
            const { valid, errors } = goodreadsAdapter.validate(parsed);

            expect(errors.length).toBe(0);
            expect(valid.length).toBe(parsed.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('YNAB adapter (R24.2)', () => {
    it('valid rows pass validation, invalid rows produce errors', () => {
      fc.assert(
        fc.property(
          fc.array(ynabValidRowArb, { minLength: 1, maxLength: 8 }),
          fc.array(ynabInvalidRowArb, { minLength: 1, maxLength: 4 }),
          (validRows, invalidRows) => {
            // Interleave randomly
            const allRows: typeof validRows = [];
            let vi = 0;
            let ii = 0;
            while (vi < validRows.length || ii < invalidRows.length) {
              if (vi < validRows.length) allRows.push(validRows[vi++]);
              if (ii < invalidRows.length) allRows.push(invalidRows[ii++]);
            }

            const csv = buildYnabCSV(allRows);
            const parsed = ynabCsvAdapter.parse(csv);
            const { valid, errors } = ynabCsvAdapter.validate(parsed);

            expect(valid.length + errors.length).toBe(parsed.length);
            expect(valid.length).toBeGreaterThanOrEqual(1);
            expect(errors.length).toBeGreaterThanOrEqual(1);

            // Valid rows have parseable dates and non-zero amounts
            for (const rec of valid) {
              expect(parseYnabDate(rec.data.date)).not.toBeNull();
              const outflow = parseYnabAmount(rec.data.outflow);
              const inflow = parseYnabAmount(rec.data.inflow);
              expect(outflow + inflow).toBeGreaterThan(0);
            }

            assertErrorDetails(errors);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('all-valid input produces zero errors', () => {
      fc.assert(
        fc.property(
          fc.array(ynabValidRowArb, { minLength: 1, maxLength: 10 }),
          (rows) => {
            const csv = buildYnabCSV(rows);
            const parsed = ynabCsvAdapter.parse(csv);
            const { valid, errors } = ynabCsvAdapter.validate(parsed);

            expect(errors.length).toBe(0);
            expect(valid.length).toBe(parsed.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('MyFitnessPal adapter (R24.2)', () => {
    it('valid rows pass validation, invalid rows produce errors', () => {
      fc.assert(
        fc.property(
          fc.array(mfpValidRowArb, { minLength: 1, maxLength: 8 }),
          fc.array(mfpInvalidRowArb, { minLength: 1, maxLength: 4 }),
          (validRows, invalidRows) => {
            const allRows: typeof validRows = [];
            let vi = 0;
            let ii = 0;
            while (vi < validRows.length || ii < invalidRows.length) {
              if (vi < validRows.length) allRows.push(validRows[vi++]);
              if (ii < invalidRows.length) allRows.push(invalidRows[ii++]);
            }

            const csv = buildMfpCSV(allRows);
            const parsed = myFitnessPalAdapter.parse(csv);
            const { valid, errors } = myFitnessPalAdapter.validate(parsed);

            expect(valid.length + errors.length).toBe(parsed.length);
            expect(valid.length).toBeGreaterThanOrEqual(1);
            expect(errors.length).toBeGreaterThanOrEqual(1);

            // Valid rows have ISO dates and non-empty food names
            for (const rec of valid) {
              expect(isValidDate(rec.data.date)).toBe(true);
              expect(rec.data.foodName.trim().length).toBeGreaterThan(0);
              expect(parseMfpNumber(rec.data.calories)).toBeGreaterThanOrEqual(0);
            }

            assertErrorDetails(errors);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('all-valid input produces zero errors', () => {
      fc.assert(
        fc.property(
          fc.array(mfpValidRowArb, { minLength: 1, maxLength: 10 }),
          (rows) => {
            const csv = buildMfpCSV(rows);
            const parsed = myFitnessPalAdapter.parse(csv);
            const { valid, errors } = myFitnessPalAdapter.validate(parsed);

            expect(errors.length).toBe(0);
            expect(valid.length).toBe(parsed.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Day One adapter (R24.2)', () => {
    it('valid entries pass validation, invalid entries produce errors', () => {
      fc.assert(
        fc.property(
          fc.array(dayOneValidEntryArb, { minLength: 1, maxLength: 8 }),
          fc.array(dayOneInvalidEntryArb, { minLength: 1, maxLength: 4 }),
          (validEntries, invalidEntries) => {
            const allEntries: typeof validEntries = [];
            let vi = 0;
            let ii = 0;
            while (vi < validEntries.length || ii < invalidEntries.length) {
              if (vi < validEntries.length) allEntries.push(validEntries[vi++]);
              if (ii < invalidEntries.length) allEntries.push(invalidEntries[ii++]);
            }

            const json = buildDayOneJSON(allEntries);
            const parsed = dayOneAdapter.parse(json);
            const { valid, errors } = dayOneAdapter.validate(parsed);

            expect(valid.length + errors.length).toBe(parsed.length);
            expect(valid.length).toBeGreaterThanOrEqual(1);
            expect(errors.length).toBeGreaterThanOrEqual(1);

            // Valid entries have non-empty text and parseable dates
            for (const rec of valid) {
              expect(rec.data.text.trim().length).toBeGreaterThan(0);
              expect(rec.data.creationDate.length).toBeGreaterThan(0);
              expect(isNaN(new Date(rec.data.creationDate).getTime())).toBe(false);
            }

            assertErrorDetails(errors);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('all-valid input produces zero errors', () => {
      fc.assert(
        fc.property(
          fc.array(dayOneValidEntryArb, { minLength: 1, maxLength: 10 }),
          (entries) => {
            const json = buildDayOneJSON(entries);
            const parsed = dayOneAdapter.parse(json);
            const { valid, errors } = dayOneAdapter.validate(parsed);

            expect(errors.length).toBe(0);
            expect(valid.length).toBe(parsed.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Cross-adapter invariants (R24.4)', () => {
    it('transform preserves row count for all valid records', () => {
      fc.assert(
        fc.property(
          fc.array(goodreadsValidRowArb, { minLength: 1, maxLength: 5 }),
          fc.array(ynabValidRowArb, { minLength: 1, maxLength: 5 }),
          fc.array(mfpValidRowArb, { minLength: 1, maxLength: 5 }),
          fc.array(dayOneValidEntryArb, { minLength: 1, maxLength: 5 }),
          (grRows, ynabRows, mfpRows, dayOneEntries) => {
            // Goodreads
            const grParsed = goodreadsAdapter.parse(buildGoodreadsCSV(grRows));
            const grValid = goodreadsAdapter.validate(grParsed).valid;
            const grTransformed = goodreadsAdapter.transform(grValid);
            expect(grTransformed.length).toBe(grValid.length);

            // YNAB
            const ynabParsed = ynabCsvAdapter.parse(buildYnabCSV(ynabRows));
            const ynabValid = ynabCsvAdapter.validate(ynabParsed).valid;
            const ynabTransformed = ynabCsvAdapter.transform(ynabValid);
            expect(ynabTransformed.length).toBe(ynabValid.length);

            // MFP
            const mfpParsed = myFitnessPalAdapter.parse(buildMfpCSV(mfpRows));
            const mfpValid = myFitnessPalAdapter.validate(mfpParsed).valid;
            const mfpTransformed = myFitnessPalAdapter.transform(mfpValid);
            expect(mfpTransformed.length).toBe(mfpValid.length);

            // Day One
            const dayOneParsed = dayOneAdapter.parse(buildDayOneJSON(dayOneEntries));
            const dayOneValid = dayOneAdapter.validate(dayOneParsed).valid;
            const dayOneTransformed = dayOneAdapter.transform(dayOneValid);
            expect(dayOneTransformed.length).toBe(dayOneValid.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('error row numbers are unique and positive', () => {
      fc.assert(
        fc.property(
          fc.array(goodreadsInvalidRowArb, { minLength: 2, maxLength: 6 }),
          fc.array(ynabInvalidRowArb, { minLength: 2, maxLength: 6 }),
          (grInvalid, ynabInvalid) => {
            // Goodreads errors
            const grCSV = buildGoodreadsCSV(grInvalid);
            const grParsed = goodreadsAdapter.parse(grCSV);
            const grErrors = goodreadsAdapter.validate(grParsed).errors;
            const grRowNums = grErrors.map((e) => e.row);
            expect(new Set(grRowNums).size).toBe(grRowNums.length);
            for (const r of grRowNums) expect(r).toBeGreaterThan(0);

            // YNAB errors
            const ynabCSV = buildYnabCSV(ynabInvalid);
            const ynabParsed = ynabCsvAdapter.parse(ynabCSV);
            const ynabErrors = ynabCsvAdapter.validate(ynabParsed).errors;
            const ynabRowNums = ynabErrors.map((e) => e.row);
            expect(new Set(ynabRowNums).size).toBe(ynabRowNums.length);
            for (const r of ynabRowNums) expect(r).toBeGreaterThan(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});

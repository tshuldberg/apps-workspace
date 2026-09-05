import { describe, it, expect } from 'vitest';
import {
  ynabCsvAdapter,
  parseYnabAmount,
  parseYnabDate,
} from '../adapters/ynab';
import type { YnabTransactionRecord, BudgetImportRecord } from '../adapters/ynab';
import type { ParsedRecord } from '../types';

// ── Sample YNAB Register CSV fixtures ────────────────────────────────

const YNAB_FULL_CSV = `"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"
"Checking","","01/15/2026","Trader Joe's","Food/Groceries","Food","Groceries","Weekly haul","$85.42","$0.00","Cleared"
"Checking","","01/14/2026","Employer Inc","Income/Paycheck","Income","Paycheck","January salary","$0.00","$3,500.00","Cleared"
"Savings","Red","01/13/2026","Transfer : Checking","","","","Monthly transfer","$0.00","$500.00","Cleared"
"Checking","","01/12/2026","Starbucks","Food/Coffee","Food","Coffee","Morning latte","$6.75","$0.00","Uncleared"
"Checking","","01/11/2026","Amazon","Shopping/Electronics","Shopping","Electronics","USB cable","$12.99","$0.00","Cleared"
`;

const YNAB_SHORT_CSV = `"Date","Payee","Category","Memo","Outflow","Inflow"
"01/15/2026","Trader Joe's","Groceries","Weekly haul","$85.42","$0.00"
"01/14/2026","Employer Inc","Paycheck","January salary","$0.00","$3,500.00"
`;

const NON_YNAB_CSV = `Title,Author,Rating
The Great Gatsby,F. Scott Fitzgerald,5
1984,George Orwell,4
`;

// ── parseYnabAmount ──────────────────────────────────────────────────

describe('parseYnabAmount', () => {
  it('parses standard YNAB currency format', () => {
    expect(parseYnabAmount('$85.42')).toBe(8542);
    expect(parseYnabAmount('$3,500.00')).toBe(350000);
    expect(parseYnabAmount('$0.00')).toBe(0);
    expect(parseYnabAmount('$12.99')).toBe(1299);
  });

  it('handles amounts without dollar sign', () => {
    expect(parseYnabAmount('85.42')).toBe(8542);
    expect(parseYnabAmount('3500.00')).toBe(350000);
  });

  it('handles negative amounts', () => {
    expect(parseYnabAmount('-$50.00')).toBe(-5000);
    expect(parseYnabAmount('-12.50')).toBe(-1250);
  });

  it('handles empty and invalid strings', () => {
    expect(parseYnabAmount('')).toBe(0);
    expect(parseYnabAmount('  ')).toBe(0);
    expect(parseYnabAmount('abc')).toBe(0);
  });

  it('handles large amounts with commas', () => {
    expect(parseYnabAmount('$12,345.67')).toBe(1234567);
    expect(parseYnabAmount('$1,234,567.89')).toBe(123456789);
  });
});

// ── parseYnabDate ────────────────────────────────────────────────────

describe('parseYnabDate', () => {
  it('parses MM/DD/YYYY format', () => {
    expect(parseYnabDate('01/15/2026')).toBe('2026-01-15');
    expect(parseYnabDate('12/31/2025')).toBe('2025-12-31');
  });

  it('handles single-digit months and days', () => {
    expect(parseYnabDate('1/5/2026')).toBe('2026-01-05');
  });

  it('preserves ISO dates', () => {
    expect(parseYnabDate('2026-01-15')).toBe('2026-01-15');
  });

  it('returns null for invalid dates', () => {
    expect(parseYnabDate('')).toBeNull();
    expect(parseYnabDate('invalid')).toBeNull();
    expect(parseYnabDate('2026/01/15')).toBeNull();
  });
});

// ── detectFormat ─────────────────────────────────────────────────────

describe('ynabCsvAdapter.detectFormat', () => {
  it('detects full YNAB register CSV format', () => {
    const result = ynabCsvAdapter.detectFormat(YNAB_FULL_CSV);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it('detects short YNAB CSV format', () => {
    const result = ynabCsvAdapter.detectFormat(YNAB_SHORT_CSV);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.85);
  });

  it('rejects non-YNAB CSV', () => {
    const result = ynabCsvAdapter.detectFormat(NON_YNAB_CSV);
    expect(result.detected).toBe(false);
  });

  it('rejects empty content', () => {
    const result = ynabCsvAdapter.detectFormat('');
    expect(result.detected).toBe(false);
  });
});

// ── parse ────────────────────────────────────────────────────────────

describe('ynabCsvAdapter.parse', () => {
  it('parses full YNAB CSV into records', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    expect(records).toHaveLength(5);

    const first = records[0].data;
    expect(first.account).toBe('Checking');
    expect(first.date).toBe('01/15/2026');
    expect(first.payee).toBe("Trader Joe's");
    expect(first.category).toBe('Groceries');
    expect(first.categoryGroup).toBe('Food');
    expect(first.memo).toBe('Weekly haul');
    expect(first.outflow).toBe('$85.42');
    expect(first.inflow).toBe('$0.00');
  });

  it('parses short YNAB CSV format', () => {
    const records = ynabCsvAdapter.parse(YNAB_SHORT_CSV);
    expect(records).toHaveLength(2);
    expect(records[0].data.date).toBe('01/15/2026');
    expect(records[0].data.payee).toBe("Trader Joe's");
  });

  it('assigns correct row numbers (1-indexed, header is row 1)', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    expect(records[0].rowNumber).toBe(2);
    expect(records[1].rowNumber).toBe(3);
  });

  it('skips empty lines', () => {
    const csv = YNAB_SHORT_CSV + '\n\n\n';
    const records = ynabCsvAdapter.parse(csv);
    expect(records).toHaveLength(2);
  });

  it('returns empty array for header-only CSV', () => {
    const headerOnly = '"Date","Payee","Category","Memo","Outflow","Inflow"\n';
    const records = ynabCsvAdapter.parse(headerOnly);
    expect(records).toHaveLength(0);
  });
});

// ── validate ─────────────────────────────────────────────────────────

describe('ynabCsvAdapter.validate', () => {
  it('validates correct records', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid, errors } = ynabCsvAdapter.validate(records);
    expect(valid).toHaveLength(5);
    expect(errors).toHaveLength(0);
  });

  it('rejects records with invalid dates', () => {
    const records: ParsedRecord<YnabTransactionRecord>[] = [{
      rowNumber: 2,
      warnings: [],
      data: {
        account: 'Checking',
        flag: '',
        date: 'not-a-date',
        payee: 'Test',
        categoryGroupCategory: '',
        categoryGroup: '',
        category: 'Groceries',
        memo: '',
        outflow: '$10.00',
        inflow: '$0.00',
        cleared: 'Cleared',
      },
    }];

    const { valid, errors } = ynabCsvAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('date');
  });

  it('rejects records with zero outflow and inflow', () => {
    const records: ParsedRecord<YnabTransactionRecord>[] = [{
      rowNumber: 2,
      warnings: [],
      data: {
        account: 'Checking',
        flag: '',
        date: '01/15/2026',
        payee: 'Test',
        categoryGroupCategory: '',
        categoryGroup: '',
        category: '',
        memo: '',
        outflow: '$0.00',
        inflow: '$0.00',
        cleared: 'Cleared',
      },
    }];

    const { valid, errors } = ynabCsvAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('outflow/inflow');
  });
});

// ── transform ────────────────────────────────────────────────────────

describe('ynabCsvAdapter.transform', () => {
  it('transforms outflow transactions correctly', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid } = ynabCsvAdapter.validate(records);
    const transformed = ynabCsvAdapter.transform(valid);

    // First record: Trader Joe's $85.42 outflow
    const first = transformed[0].data;
    expect(first.amount).toBe(8542);
    expect(first.direction).toBe('outflow');
    expect(first.merchant).toBe("Trader Joe's");
    expect(first.note).toBe('Weekly haul');
    expect(first.occurred_on).toBe('2026-01-15');
    expect(first.envelope_name).toBe('Groceries');
    expect(first.account_name).toBe('Checking');
  });

  it('transforms inflow transactions correctly', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid } = ynabCsvAdapter.validate(records);
    const transformed = ynabCsvAdapter.transform(valid);

    // Second record: Employer Inc $3,500 inflow
    const paycheck = transformed[1].data;
    expect(paycheck.amount).toBe(350000);
    expect(paycheck.direction).toBe('inflow');
    expect(paycheck.merchant).toBe('Employer Inc');
    expect(paycheck.envelope_name).toBe('Paycheck');
    expect(paycheck.account_name).toBe('Checking');
  });

  it('preserves transfer payees', () => {
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid } = ynabCsvAdapter.validate(records);
    const transformed = ynabCsvAdapter.transform(valid);

    // Third record: Transfer
    const transfer = transformed[2].data;
    expect(transfer.merchant).toBe('Transfer : Checking');
    expect(transfer.envelope_name).toBeNull(); // Transfers have no category
    expect(transfer.account_name).toBe('Savings');
  });

  it('handles Uncategorized category as null envelope', () => {
    const records: ParsedRecord<YnabTransactionRecord>[] = [{
      rowNumber: 2,
      warnings: [],
      data: {
        account: 'Checking',
        flag: '',
        date: '01/15/2026',
        payee: 'Test',
        categoryGroupCategory: '',
        categoryGroup: '',
        category: 'Uncategorized',
        memo: '',
        outflow: '$10.00',
        inflow: '$0.00',
        cleared: '',
      },
    }];

    const transformed = ynabCsvAdapter.transform(records);
    expect(transformed[0].data.envelope_name).toBeNull();
  });

  it('falls back to categoryGroupCategory when category is empty', () => {
    const records: ParsedRecord<YnabTransactionRecord>[] = [{
      rowNumber: 2,
      warnings: [],
      data: {
        account: 'Checking',
        flag: '',
        date: '01/15/2026',
        payee: 'Test',
        categoryGroupCategory: 'Food/Dining Out',
        categoryGroup: '',
        category: '',
        memo: '',
        outflow: '$25.00',
        inflow: '$0.00',
        cleared: '',
      },
    }];

    const transformed = ynabCsvAdapter.transform(records);
    expect(transformed[0].data.envelope_name).toBe('Dining Out');
  });
});

// ── import (with mock DB) ────────────────────────────────────────────

describe('ynabCsvAdapter.import', () => {
  function createMockDb() {
    const tables: Record<string, Record<string, unknown>[]> = {
      bg_envelopes: [],
      bg_accounts: [],
      bg_transactions: [],
    };

    return {
      execute(sql: string, params?: unknown[]): void {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return;

        if (sql.includes('INSERT INTO bg_envelopes')) {
          tables.bg_envelopes.push({
            id: params?.[0],
            name: params?.[1],
            sort_order: params?.[2],
          });
          return;
        }
        if (sql.includes('INSERT INTO bg_accounts')) {
          tables.bg_accounts.push({
            id: params?.[0],
            name: params?.[1],
            sort_order: params?.[2],
          });
          return;
        }
        if (sql.includes('INSERT INTO bg_transactions')) {
          tables.bg_transactions.push({
            id: params?.[0],
            envelope_id: params?.[1],
            account_id: params?.[2],
            amount: params?.[3],
            direction: params?.[4],
            merchant: params?.[5],
            note: params?.[6],
            occurred_on: params?.[7],
          });
          return;
        }
      },
      query<T>(sql: string): T[] {
        if (sql.includes('bg_envelopes')) {
          return tables.bg_envelopes as T[];
        }
        if (sql.includes('bg_accounts')) {
          return tables.bg_accounts as T[];
        }
        return [];
      },
      tables,
    };
  }

  it('imports full YNAB CSV end-to-end', () => {
    const mockDb = createMockDb();
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid } = ynabCsvAdapter.validate(records);
    const transformed = ynabCsvAdapter.transform(valid);

    const result = ynabCsvAdapter.import(mockDb, transformed);

    expect(result.adapterName).toBe('ynab-csv');
    expect(result.targetModule).toBe('budget');
    expect(result.imported).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // 5 transactions inserted
    expect(mockDb.tables.bg_transactions).toHaveLength(5);

    // Envelopes created from categories: Groceries, Paycheck, Coffee, Electronics (Transfer has no category)
    expect(mockDb.tables.bg_envelopes).toHaveLength(4);
    const envelopeNames = mockDb.tables.bg_envelopes.map((e) => e.name);
    expect(envelopeNames).toContain('Groceries');
    expect(envelopeNames).toContain('Paycheck');
    expect(envelopeNames).toContain('Coffee');
    expect(envelopeNames).toContain('Electronics');

    // Accounts created: Checking, Savings
    expect(mockDb.tables.bg_accounts).toHaveLength(2);
    const accountNames = mockDb.tables.bg_accounts.map((a) => a.name);
    expect(accountNames).toContain('Checking');
    expect(accountNames).toContain('Savings');
  });

  it('deduplicates envelopes by name (case-insensitive)', () => {
    const mockDb = createMockDb();

    // Two transactions with same category should create only one envelope
    const records: ParsedRecord<BudgetImportRecord>[] = [
      {
        rowNumber: 2,
        warnings: [],
        data: {
          amount: 1000,
          direction: 'outflow',
          merchant: 'Store A',
          note: null,
          occurred_on: '2026-01-15',
          envelope_name: 'Groceries',
          account_name: 'Checking',
        },
      },
      {
        rowNumber: 3,
        warnings: [],
        data: {
          amount: 2000,
          direction: 'outflow',
          merchant: 'Store B',
          note: null,
          occurred_on: '2026-01-16',
          envelope_name: 'groceries', // different case
          account_name: 'Checking',
        },
      },
    ];

    ynabCsvAdapter.import(mockDb, records);
    expect(mockDb.tables.bg_envelopes).toHaveLength(1);
    expect(mockDb.tables.bg_accounts).toHaveLength(1);
  });

  it('calls onProgress callback', () => {
    const mockDb = createMockDb();
    const records = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    const { valid } = ynabCsvAdapter.validate(records);
    const transformed = ynabCsvAdapter.transform(valid);

    const progressCalls: string[] = [];
    ynabCsvAdapter.import(mockDb, transformed, (progress) => {
      progressCalls.push(progress.phase);
    });

    expect(progressCalls).toContain('importing');
    expect(progressCalls).toContain('complete');
  });

  it('handles null envelope_name (uncategorized transactions)', () => {
    const mockDb = createMockDb();
    const records: ParsedRecord<BudgetImportRecord>[] = [{
      rowNumber: 2,
      warnings: [],
      data: {
        amount: 5000,
        direction: 'outflow',
        merchant: 'ATM',
        note: null,
        occurred_on: '2026-01-15',
        envelope_name: null,
        account_name: 'Checking',
      },
    }];

    const result = ynabCsvAdapter.import(mockDb, records);
    expect(result.imported).toBe(1);
    expect(mockDb.tables.bg_envelopes).toHaveLength(0);
    expect(mockDb.tables.bg_transactions[0].envelope_id).toBeNull();
  });
});

// ── Adapter metadata ─────────────────────────────────────────────────

describe('ynabCsvAdapter metadata', () => {
  it('has correct adapter properties', () => {
    expect(ynabCsvAdapter.name).toBe('ynab-csv');
    expect(ynabCsvAdapter.sourceApp).toBe('YNAB (You Need A Budget)');
    expect(ynabCsvAdapter.targetModule).toBe('budget');
    expect(ynabCsvAdapter.supportedExtensions).toEqual(['.csv']);
  });
});

// ── Full pipeline integration ────────────────────────────────────────

describe('full pipeline: detect -> parse -> validate -> transform -> import', () => {
  it('processes YNAB CSV through the entire pipeline', () => {
    // 1. Detect
    const detection = ynabCsvAdapter.detectFormat(YNAB_FULL_CSV);
    expect(detection.detected).toBe(true);

    // 2. Parse
    const parsed = ynabCsvAdapter.parse(YNAB_FULL_CSV);
    expect(parsed).toHaveLength(5);

    // 3. Validate
    const { valid, errors } = ynabCsvAdapter.validate(parsed);
    expect(valid).toHaveLength(5);
    expect(errors).toHaveLength(0);

    // 4. Transform
    const transformed = ynabCsvAdapter.transform(valid);
    expect(transformed).toHaveLength(5);

    // Verify amounts sum correctly
    const totalOutflow = transformed
      .filter((r) => r.data.direction === 'outflow')
      .reduce((sum, r) => sum + r.data.amount, 0);
    // $85.42 + $6.75 + $12.99 = $105.16 = 10516 cents
    expect(totalOutflow).toBe(10516);

    const totalInflow = transformed
      .filter((r) => r.data.direction === 'inflow')
      .reduce((sum, r) => sum + r.data.amount, 0);
    // $3,500.00 + $500.00 = $4,000.00 = 400000 cents
    expect(totalInflow).toBe(400000);
  });
});

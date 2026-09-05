/**
 * YNAB CSV import adapter.
 *
 * Handles YNAB's Register Export format (transactions) and maps them
 * to MyBudget's bg_ tables. Creates envelopes from YNAB categories
 * and accounts from YNAB account names on-the-fly during import.
 *
 * YNAB Register CSV headers:
 *   "Account","Flag","Date","Payee","Category Group/Category",
 *   "Category Group","Category","Memo","Outflow","Inflow","Cleared"
 *
 * YNAB date format: MM/DD/YYYY
 * YNAB amounts: currency strings like "$1,234.56" or "$0.00"
 */

import type {
  ImportAdapter,
  FormatDetection,
  ParsedRecord,
  ImportValidationError,
  ImportResult,
  ImportProgress,
} from '../types';

// ── Source record shape (after CSV parsing) ──────────────────────────

export interface YnabTransactionRecord {
  account: string;
  flag: string;
  date: string;
  payee: string;
  categoryGroupCategory: string;
  categoryGroup: string;
  category: string;
  memo: string;
  outflow: string;
  inflow: string;
  cleared: string;
}

// ── Target record shape (ready for bg_ insertion) ────────────────────

export interface BudgetImportRecord {
  amount: number;
  direction: 'inflow' | 'outflow';
  merchant: string | null;
  note: string | null;
  occurred_on: string;
  envelope_name: string | null;
  account_name: string;
}

// ── CSV parsing helpers ──────────────────────────────────────────────

const YNAB_REGISTER_HEADERS = [
  'account', 'flag', 'date', 'payee',
  'category group/category', 'category group', 'category',
  'memo', 'outflow', 'inflow', 'cleared',
];

const YNAB_REGISTER_HEADERS_SHORT = [
  'date', 'payee', 'category', 'memo', 'outflow', 'inflow',
];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/^"|"$/g, '').trim();
}

/**
 * Parse YNAB currency string to integer cents.
 * Handles "$1,234.56", "1234.56", "$0.00", "-$50.00", etc.
 */
export function parseYnabAmount(raw: string): number {
  if (!raw || raw.trim() === '' || raw.trim() === '$0.00') return 0;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Parse YNAB date (MM/DD/YYYY) to ISO date (YYYY-MM-DD).
 */
export function parseYnabDate(raw: string): string | null {
  const trimmed = raw.trim();
  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, mm, dd, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Already ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  return null;
}

// ── The adapter ──────────────────────────────────────────────────────

function detectFormat(content: string, _fileName?: string): FormatDetection {
  const firstLine = content.split('\n')[0] ?? '';
  const headers = parseCSVLine(firstLine).map(normalizeHeader);

  // Full YNAB register format (11 columns)
  const fullMatch = YNAB_REGISTER_HEADERS.every((h) => headers.includes(h));
  if (fullMatch) {
    return { detected: true, confidence: 0.95, reason: 'YNAB Register CSV headers detected (full format)' };
  }

  // Short YNAB format (6 columns -- sometimes exported from YNAB web)
  const shortMatch = YNAB_REGISTER_HEADERS_SHORT.every((h) => headers.includes(h));
  if (shortMatch && (headers.includes('outflow') && headers.includes('inflow'))) {
    return { detected: true, confidence: 0.85, reason: 'YNAB Register CSV headers detected (short format)' };
  }

  return { detected: false, confidence: 0, reason: 'Headers do not match YNAB Register CSV format' };
}

function parse(content: string): ParsedRecord<YnabTransactionRecord>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(normalizeHeader);

  const colIndex = (name: string): number => headers.indexOf(name);
  const accountIdx = colIndex('account');
  const flagIdx = colIndex('flag');
  const dateIdx = colIndex('date');
  const payeeIdx = colIndex('payee');
  const catGroupCatIdx = colIndex('category group/category');
  const catGroupIdx = colIndex('category group');
  const catIdx = colIndex('category');
  const memoIdx = colIndex('memo');
  const outflowIdx = colIndex('outflow');
  const inflowIdx = colIndex('inflow');
  const clearedIdx = colIndex('cleared');

  const records: ParsedRecord<YnabTransactionRecord>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    const warnings: string[] = [];

    const record: YnabTransactionRecord = {
      account: accountIdx >= 0 ? (fields[accountIdx] ?? '') : '',
      flag: flagIdx >= 0 ? (fields[flagIdx] ?? '') : '',
      date: dateIdx >= 0 ? (fields[dateIdx] ?? '') : '',
      payee: payeeIdx >= 0 ? (fields[payeeIdx] ?? '') : '',
      categoryGroupCategory: catGroupCatIdx >= 0 ? (fields[catGroupCatIdx] ?? '') : '',
      categoryGroup: catGroupIdx >= 0 ? (fields[catGroupIdx] ?? '') : '',
      category: catIdx >= 0 ? (fields[catIdx] ?? '') : '',
      memo: memoIdx >= 0 ? (fields[memoIdx] ?? '') : '',
      outflow: outflowIdx >= 0 ? (fields[outflowIdx] ?? '') : '',
      inflow: inflowIdx >= 0 ? (fields[inflowIdx] ?? '') : '',
      cleared: clearedIdx >= 0 ? (fields[clearedIdx] ?? '') : '',
    };

    if (!record.date) {
      warnings.push('Missing date field');
    }

    records.push({ rowNumber: i + 1, data: record, warnings });
  }

  return records;
}

function validate(
  records: ParsedRecord<YnabTransactionRecord>[],
): { valid: ParsedRecord<YnabTransactionRecord>[]; errors: ImportValidationError[] } {
  const valid: ParsedRecord<YnabTransactionRecord>[] = [];
  const errors: ImportValidationError[] = [];

  for (const record of records) {
    const { data, rowNumber } = record;

    // Date is required and must be parseable
    const parsedDate = parseYnabDate(data.date);
    if (!parsedDate) {
      errors.push({ row: rowNumber, field: 'date', message: `Invalid date: "${data.date}"`, value: data.date });
      continue;
    }

    // At least one of outflow/inflow must have a non-zero amount
    const outflow = parseYnabAmount(data.outflow);
    const inflow = parseYnabAmount(data.inflow);
    if (outflow === 0 && inflow === 0) {
      errors.push({
        row: rowNumber,
        field: 'outflow/inflow',
        message: 'Both outflow and inflow are zero',
        value: `outflow="${data.outflow}", inflow="${data.inflow}"`,
      });
      continue;
    }

    valid.push(record);
  }

  return { valid, errors };
}

function transform(
  records: ParsedRecord<YnabTransactionRecord>[],
): ParsedRecord<BudgetImportRecord>[] {
  return records.map((record) => {
    const { data } = record;
    const outflow = parseYnabAmount(data.outflow);
    const inflow = parseYnabAmount(data.inflow);
    const isOutflow = outflow > 0;
    const amount = isOutflow ? outflow : inflow;

    // Resolve envelope name from YNAB category
    let envelopeName: string | null = null;
    if (data.category && data.category !== 'Uncategorized') {
      envelopeName = data.category;
    } else if (data.categoryGroupCategory) {
      // "Category Group/Category" format -- use the category part
      const parts = data.categoryGroupCategory.split('/');
      const cat = (parts[parts.length - 1] ?? '').trim();
      if (cat && cat !== 'Uncategorized') {
        envelopeName = cat;
      }
    }

    const merchant = data.payee.startsWith('Transfer :')
      ? data.payee
      : (data.payee || null);

    return {
      rowNumber: record.rowNumber,
      warnings: record.warnings,
      data: {
        amount,
        direction: isOutflow ? 'outflow' as const : 'inflow' as const,
        merchant,
        note: data.memo || null,
        occurred_on: parseYnabDate(data.date)!,
        envelope_name: envelopeName,
        account_name: data.account || 'YNAB Import',
      },
    };
  });
}

function importRecords(
  db: unknown,
  records: ParsedRecord<BudgetImportRecord>[],
  onProgress?: (progress: ImportProgress) => void,
): ImportResult {
  const startTime = Date.now();
  const adapter = db as {
    execute(sql: string, params?: unknown[]): void;
    query<T>(sql: string, params?: unknown[]): T[];
  };

  // Phase 1: Build envelope and account maps
  onProgress?.({ phase: 'importing', current: 0, total: records.length, message: 'Creating categories...' });

  const envelopeIdMap = new Map<string, string>();
  const accountIdMap = new Map<string, string>();

  // Load existing envelopes
  const existingEnvelopes = adapter.query<{ id: string; name: string }>(
    'SELECT id, name FROM bg_envelopes',
  );
  for (const env of existingEnvelopes) {
    envelopeIdMap.set(env.name.toLowerCase(), env.id);
  }

  // Load existing accounts
  const existingAccounts = adapter.query<{ id: string; name: string }>(
    'SELECT id, name FROM bg_accounts',
  );
  for (const acc of existingAccounts) {
    accountIdMap.set(acc.name.toLowerCase(), acc.id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: ImportValidationError[] = [];
  let envelopeSortOrder = existingEnvelopes.length;
  let accountSortOrder = existingAccounts.length;

  // Phase 2: Insert transactions
  adapter.execute('BEGIN');
  try {
    for (let i = 0; i < records.length; i++) {
      const { data, rowNumber } = records[i];

      try {
        // Ensure envelope exists
        let envelopeId: string | null = null;
        if (data.envelope_name) {
          const key = data.envelope_name.toLowerCase();
          if (envelopeIdMap.has(key)) {
            envelopeId = envelopeIdMap.get(key)!;
          } else {
            envelopeId = crypto.randomUUID();
            const now = new Date().toISOString();
            adapter.execute(
              `INSERT INTO bg_envelopes (id, name, monthly_budget, rollover_enabled, archived, sort_order, created_at, updated_at)
               VALUES (?, ?, 0, 1, 0, ?, ?, ?)`,
              [envelopeId, data.envelope_name, envelopeSortOrder++, now, now],
            );
            envelopeIdMap.set(key, envelopeId);
          }
        }

        // Ensure account exists
        let accountId: string | null = null;
        if (data.account_name) {
          const key = data.account_name.toLowerCase();
          if (accountIdMap.has(key)) {
            accountId = accountIdMap.get(key)!;
          } else {
            accountId = crypto.randomUUID();
            const now = new Date().toISOString();
            adapter.execute(
              `INSERT INTO bg_accounts (id, name, type, current_balance, currency, archived, sort_order, created_at, updated_at)
               VALUES (?, ?, 'checking', 0, 'USD', 0, ?, ?, ?)`,
              [accountId, data.account_name, accountSortOrder++, now, now],
            );
            accountIdMap.set(key, accountId);
          }
        }

        // Insert transaction
        const txId = crypto.randomUUID();
        const now = new Date().toISOString();
        adapter.execute(
          `INSERT INTO bg_transactions (id, envelope_id, account_id, amount, direction, merchant, note, occurred_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [txId, envelopeId, accountId, data.amount, data.direction, data.merchant, data.note, data.occurred_on, now, now],
        );

        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('UNIQUE')) {
          skipped++;
        } else {
          errors.push({ row: rowNumber, field: 'insert', message: msg });
        }
      }

      if (onProgress && (i % 100 === 0 || i === records.length - 1)) {
        onProgress({
          phase: 'importing',
          current: i + 1,
          total: records.length,
          message: `Imported ${imported} transactions...`,
        });
      }
    }
    adapter.execute('COMMIT');
  } catch {
    adapter.execute('ROLLBACK');
    throw new Error('Import failed during database insertion');
  }

  onProgress?.({ phase: 'complete', current: records.length, total: records.length, message: 'Import complete' });

  return {
    adapterName: 'ynab-csv',
    targetModule: 'budget',
    totalRows: records.length,
    imported,
    skipped,
    failed: errors.length,
    errors,
    durationMs: Date.now() - startTime,
  };
}

export const ynabCsvAdapter: ImportAdapter<YnabTransactionRecord, BudgetImportRecord> = {
  name: 'ynab-csv',
  sourceApp: 'YNAB (You Need A Budget)',
  targetModule: 'budget',
  supportedExtensions: ['.csv'],
  detectFormat,
  parse,
  validate,
  transform,
  import: importRecords,
};

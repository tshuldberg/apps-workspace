export type CsvFieldKey =
  | 'date'
  | 'amount'
  | 'payee'
  | 'category'
  | 'account'
  | 'notes'
  | 'type';

export type CsvAmountSign =
  | 'negative_is_outflow'
  | 'positive_is_outflow'
  | 'separate_columns';

export type CsvMapping = Partial<Record<CsvFieldKey, number>>;

export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
}

export interface CsvPreviewRow {
  date: string;
  amount: number;
  payee: string;
  notes: string | null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvText(text: string): ParsedCsvData {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines
    .slice(1)
    .map((line) => splitCsvLine(line))
    .filter((row) => row.some((cell) => cell.length > 0));

  return { headers, rows };
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function guessCsvMapping(headers: string[]): CsvMapping {
  const mapping: CsvMapping = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    if (mapping.date === undefined && /date|posted|transaction date/.test(normalized)) {
      mapping.date = index;
      return;
    }

    if (mapping.amount === undefined && /amount|total|value/.test(normalized)) {
      mapping.amount = index;
      return;
    }

    if (mapping.payee === undefined && /payee|merchant|description|name/.test(normalized)) {
      mapping.payee = index;
      return;
    }

    if (mapping.notes === undefined && /memo|notes|details/.test(normalized)) {
      mapping.notes = index;
      return;
    }

    if (mapping.category === undefined && /category/.test(normalized)) {
      mapping.category = index;
      return;
    }

    if (mapping.account === undefined && /account/.test(normalized)) {
      mapping.account = index;
      return;
    }

    if (mapping.type === undefined && /type|direction/.test(normalized)) {
      mapping.type = index;
    }
  });

  return mapping;
}

function parseAmountCell(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, '');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function normalizeImportedDate(value: string, dateFormat: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) {
    return null;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);

  let month = first;
  let day = second;
  if (dateFormat === 'DD/MM/YYYY') {
    day = first;
    month = second;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${third}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseImportedAmount(args: {
  row: string[];
  mapping: CsvMapping;
  amountSign: CsvAmountSign;
  debitColumn?: number | null;
  creditColumn?: number | null;
}): number | null {
  const { row, mapping, amountSign, debitColumn, creditColumn } = args;

  if (amountSign === 'separate_columns') {
    const debit = debitColumn === null || debitColumn === undefined ? null : parseAmountCell(row[debitColumn] ?? '');
    const credit = creditColumn === null || creditColumn === undefined ? null : parseAmountCell(row[creditColumn] ?? '');

    if (credit && credit > 0) {
      return credit;
    }
    if (debit && debit > 0) {
      return debit;
    }
    return null;
  }

  const amountIndex = mapping.amount;
  if (amountIndex === undefined) {
    return null;
  }

  const parsed = parseAmountCell(row[amountIndex] ?? '');
  if (parsed === null) {
    return null;
  }

  const absAmount = Math.abs(parsed);
  if (amountSign === 'negative_is_outflow') {
    return parsed < 0 ? absAmount : absAmount;
  }

  return parsed > 0 ? absAmount : absAmount;
}

export function inferDirectionFromAmount(rawValue: string, amountSign: CsvAmountSign): 'inflow' | 'outflow' {
  const parsed = Number(rawValue.replace(/[$,\s]/g, ''));
  if (!Number.isFinite(parsed)) {
    return 'outflow';
  }

  if (amountSign === 'negative_is_outflow') {
    return parsed < 0 ? 'outflow' : 'inflow';
  }

  if (amountSign === 'positive_is_outflow') {
    return parsed > 0 ? 'outflow' : 'inflow';
  }

  return parsed > 0 ? 'inflow' : 'outflow';
}

export function buildCsvPreviewRows(args: {
  parsed: ParsedCsvData;
  mapping: CsvMapping;
  dateFormat: string;
  amountSign: CsvAmountSign;
  debitColumn?: number | null;
  creditColumn?: number | null;
}): CsvPreviewRow[] {
  const { parsed, mapping, dateFormat, amountSign, debitColumn, creditColumn } = args;

  return parsed.rows
    .map((row) => {
      const dateValue =
        mapping.date === undefined ? null : normalizeImportedDate(row[mapping.date] ?? '', dateFormat);
      const amount = parseImportedAmount({
        row,
        mapping,
        amountSign,
        debitColumn,
        creditColumn,
      });
      const payeeValue = mapping.payee === undefined ? '' : (row[mapping.payee] ?? '').trim();

      if (!dateValue || amount === null || !payeeValue) {
        return null;
      }

      return {
        date: dateValue,
        amount,
        payee: payeeValue,
        notes: mapping.notes === undefined ? null : (row[mapping.notes] ?? '').trim() || null,
      };
    })
    .filter((row): row is CsvPreviewRow => row !== null);
}

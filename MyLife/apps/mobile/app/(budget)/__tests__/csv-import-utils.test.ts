import { describe, expect, it } from 'vitest';
import {
  buildCsvPreviewRows,
  guessCsvMapping,
  inferDirectionFromAmount,
  parseCsvText,
} from '../../../components/budget/csvImportUtils';

describe('csvImportUtils', () => {
  it('parses csv rows with quoted commas', () => {
    const parsed = parseCsvText(
      'Date,Description,Amount,Memo\n04/01/2026,"ACME, INC",-14.25,"Morning coffee"',
    );

    expect(parsed.headers).toEqual(['Date', 'Description', 'Amount', 'Memo']);
    expect(parsed.rows).toEqual([
      ['04/01/2026', 'ACME, INC', '-14.25', 'Morning coffee'],
    ]);
  });

  it('guesses common column mappings from headers', () => {
    const mapping = guessCsvMapping(['Posted Date', 'Merchant', 'Amount', 'Notes']);

    expect(mapping).toEqual({
      date: 0,
      payee: 1,
      amount: 2,
      notes: 3,
    });
  });

  it('builds preview rows using mapped values and date normalization', () => {
    const parsed = parseCsvText(
      'Date,Merchant,Amount,Notes\n04/02/2026,Corner Market,-56.21,Groceries\n04/03/2026,Payroll,2400.00,Deposit',
    );

    const rows = buildCsvPreviewRows({
      parsed,
      mapping: { date: 0, payee: 1, amount: 2, notes: 3 },
      dateFormat: 'MM/DD/YYYY',
      amountSign: 'negative_is_outflow',
    });

    expect(rows).toEqual([
      {
        date: '2026-04-02',
        payee: 'Corner Market',
        amount: 5621,
        notes: 'Groceries',
      },
      {
        date: '2026-04-03',
        payee: 'Payroll',
        amount: 240000,
        notes: 'Deposit',
      },
    ]);
  });

  it('infers direction from signed amount formats', () => {
    expect(inferDirectionFromAmount('-22.00', 'negative_is_outflow')).toBe('outflow');
    expect(inferDirectionFromAmount('1200.00', 'negative_is_outflow')).toBe('inflow');
    expect(inferDirectionFromAmount('44.50', 'positive_is_outflow')).toBe('outflow');
    expect(inferDirectionFromAmount('-12.10', 'positive_is_outflow')).toBe('inflow');
  });
});

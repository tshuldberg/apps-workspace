/**
 * CRUD operations for Loans and Loan Payments.
 * Tables: bg_loans, bg_loan_payments
 *
 * Interest rates in basis points (1800 = 18.00% APR).
 * All currency amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Loan,
  LoanInsert,
  LoanUpdate,
  LoanPayment,
  LoanPaymentInsert,
} from '../types';

const LOAN_COLUMNS = new Set([
  'account_id', 'name', 'loan_type', 'original_principal', 'current_balance',
  'interest_rate', 'term_months', 'start_date', 'monthly_payment', 'extra_payment',
  'compounding', 'lender', 'notes', 'is_active',
]);

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export function createLoan(
  db: DatabaseAdapter,
  id: string,
  input: LoanInsert,
): Loan {
  const now = new Date().toISOString();
  const loan: Loan = {
    id,
    account_id: input.account_id ?? null,
    name: input.name,
    loan_type: input.loan_type,
    original_principal: input.original_principal,
    current_balance: input.current_balance,
    interest_rate: input.interest_rate,
    term_months: input.term_months,
    start_date: input.start_date,
    monthly_payment: input.monthly_payment,
    extra_payment: input.extra_payment ?? 0,
    compounding: input.compounding ?? 'monthly',
    lender: input.lender ?? null,
    notes: input.notes ?? null,
    is_active: input.is_active ?? 1,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_loans
      (id, account_id, name, loan_type, original_principal, current_balance,
       interest_rate, term_months, start_date, monthly_payment, extra_payment,
       compounding, lender, notes, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loan.id, loan.account_id, loan.name, loan.loan_type,
      loan.original_principal, loan.current_balance, loan.interest_rate,
      loan.term_months, loan.start_date, loan.monthly_payment,
      loan.extra_payment, loan.compounding, loan.lender, loan.notes,
      loan.is_active, loan.created_at, loan.updated_at,
    ],
  );

  return loan;
}

export function getLoanById(
  db: DatabaseAdapter,
  id: string,
): Loan | null {
  const rows = db.query<Loan>(
    `SELECT * FROM bg_loans WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getActiveLoans(db: DatabaseAdapter): Loan[] {
  return db.query<Loan>(
    `SELECT * FROM bg_loans WHERE is_active = 1 ORDER BY name ASC`,
  );
}

export function updateLoan(
  db: DatabaseAdapter,
  id: string,
  updates: LoanUpdate,
): Loan | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && LOAN_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getLoanById(db, id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_loans SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  return getLoanById(db, id);
}

export function deleteLoan(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_loans WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Loan Payments
// ---------------------------------------------------------------------------

export function createLoanPayment(
  db: DatabaseAdapter,
  id: string,
  input: LoanPaymentInsert,
): LoanPayment {
  const now = new Date().toISOString();
  const payment: LoanPayment = {
    id,
    loan_id: input.loan_id,
    transaction_id: input.transaction_id ?? null,
    payment_date: input.payment_date,
    total_amount: input.total_amount,
    principal_amount: input.principal_amount,
    interest_amount: input.interest_amount,
    extra_amount: input.extra_amount ?? 0,
    remaining_balance: input.remaining_balance,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_loan_payments
      (id, loan_id, transaction_id, payment_date, total_amount, principal_amount,
       interest_amount, extra_amount, remaining_balance, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.id, payment.loan_id, payment.transaction_id,
      payment.payment_date, payment.total_amount, payment.principal_amount,
      payment.interest_amount, payment.extra_amount, payment.remaining_balance,
      payment.created_at,
    ],
  );

  return payment;
}

export function getLoanPaymentById(
  db: DatabaseAdapter,
  id: string,
): LoanPayment | null {
  const rows = db.query<LoanPayment>(
    `SELECT * FROM bg_loan_payments WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getLoanPayments(
  db: DatabaseAdapter,
  loanId: string,
): LoanPayment[] {
  return db.query<LoanPayment>(
    `SELECT * FROM bg_loan_payments WHERE loan_id = ? ORDER BY payment_date DESC`,
    [loanId],
  );
}

export function deleteLoanPayment(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_loan_payments WHERE id = ?`, [id]);
}

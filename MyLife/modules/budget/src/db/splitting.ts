/**
 * CRUD operations for Expense Splitting.
 * Tables: bg_contacts, bg_expense_splits, bg_split_participants, bg_settlements
 *
 * Tracks shared expenses between contacts, supports equal/unequal/percentage/shares
 * split types, and records settlements to track who owes what.
 * All currency amounts in integer cents.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  Contact,
  ContactInsert,
  ContactUpdate,
  ExpenseSplit,
  ExpenseSplitInsert,
  SplitParticipant,
  SplitParticipantInsert,
  Settlement,
  SettlementInsert,
} from '../types';

const CONTACT_COLUMNS = new Set(['name', 'email', 'phone', 'avatar_emoji', 'notes']);

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export function createContact(
  db: DatabaseAdapter,
  id: string,
  input: ContactInsert,
): Contact {
  const now = new Date().toISOString();
  const contact: Contact = {
    id,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    avatar_emoji: input.avatar_emoji ?? '\u{1F464}',
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_contacts
      (id, name, email, phone, avatar_emoji, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contact.id, contact.name, contact.email, contact.phone,
      contact.avatar_emoji, contact.notes, contact.created_at, contact.updated_at,
    ],
  );

  return contact;
}

export function getContactById(
  db: DatabaseAdapter,
  id: string,
): Contact | null {
  const rows = db.query<Contact>(
    `SELECT * FROM bg_contacts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getContacts(db: DatabaseAdapter): Contact[] {
  return db.query<Contact>(
    `SELECT * FROM bg_contacts ORDER BY name ASC`,
  );
}

export function updateContact(
  db: DatabaseAdapter,
  id: string,
  updates: ContactUpdate,
): Contact | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && CONTACT_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getContactById(db, id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_contacts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  return getContactById(db, id);
}

export function deleteContact(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_contacts WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Expense Splits
// ---------------------------------------------------------------------------

export function createExpenseSplit(
  db: DatabaseAdapter,
  id: string,
  input: ExpenseSplitInsert,
): ExpenseSplit {
  const now = new Date().toISOString();
  const split: ExpenseSplit = {
    id,
    transaction_id: input.transaction_id ?? null,
    description: input.description,
    total_amount: input.total_amount,
    currency: input.currency ?? 'USD',
    split_type: input.split_type ?? 'equal',
    paid_by: input.paid_by ?? 'self',
    date: input.date,
    group_name: input.group_name ?? null,
    is_settled: input.is_settled ?? 0,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_expense_splits
      (id, transaction_id, description, total_amount, currency, split_type,
       paid_by, date, group_name, is_settled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      split.id, split.transaction_id, split.description, split.total_amount,
      split.currency, split.split_type, split.paid_by, split.date,
      split.group_name, split.is_settled, split.created_at, split.updated_at,
    ],
  );

  return split;
}

export function getExpenseSplitById(
  db: DatabaseAdapter,
  id: string,
): ExpenseSplit | null {
  const rows = db.query<ExpenseSplit>(
    `SELECT * FROM bg_expense_splits WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getExpenseSplits(
  db: DatabaseAdapter,
  options?: { settled?: boolean },
): ExpenseSplit[] {
  if (options?.settled !== undefined) {
    return db.query<ExpenseSplit>(
      `SELECT * FROM bg_expense_splits WHERE is_settled = ? ORDER BY date DESC`,
      [options.settled ? 1 : 0],
    );
  }

  return db.query<ExpenseSplit>(
    `SELECT * FROM bg_expense_splits ORDER BY date DESC`,
  );
}

// ---------------------------------------------------------------------------
// Split Participants
// ---------------------------------------------------------------------------

export function createSplitParticipant(
  db: DatabaseAdapter,
  id: string,
  input: SplitParticipantInsert,
): SplitParticipant {
  const now = new Date().toISOString();
  const participant: SplitParticipant = {
    id,
    split_id: input.split_id,
    contact_id: input.contact_id ?? null,
    is_self: input.is_self ?? 0,
    share_amount: input.share_amount,
    share_value: input.share_value ?? null,
    is_paid: input.is_paid ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_split_participants
      (id, split_id, contact_id, is_self, share_amount, share_value, is_paid, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      participant.id, participant.split_id, participant.contact_id,
      participant.is_self, participant.share_amount, participant.share_value,
      participant.is_paid, participant.created_at,
    ],
  );

  return participant;
}

export function getSplitParticipants(
  db: DatabaseAdapter,
  splitId: string,
): SplitParticipant[] {
  return db.query<SplitParticipant>(
    `SELECT * FROM bg_split_participants WHERE split_id = ? ORDER BY is_self DESC, created_at ASC`,
    [splitId],
  );
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export function createSettlement(
  db: DatabaseAdapter,
  id: string,
  input: SettlementInsert,
): Settlement {
  const now = new Date().toISOString();
  const settlement: Settlement = {
    id,
    contact_id: input.contact_id,
    amount: input.amount,
    transaction_id: input.transaction_id ?? null,
    note: input.note ?? null,
    settled_at: input.settled_at ?? now,
    created_at: now,
  };

  db.execute(
    `INSERT INTO bg_settlements
      (id, contact_id, amount, transaction_id, note, settled_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      settlement.id, settlement.contact_id, settlement.amount,
      settlement.transaction_id, settlement.note, settlement.settled_at,
      settlement.created_at,
    ],
  );

  return settlement;
}

export function getSettlementsByContact(
  db: DatabaseAdapter,
  contactId: string,
): Settlement[] {
  return db.query<Settlement>(
    `SELECT * FROM bg_settlements WHERE contact_id = ? ORDER BY settled_at DESC`,
    [contactId],
  );
}

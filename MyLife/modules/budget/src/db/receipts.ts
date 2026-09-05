/**
 * CRUD operations for Receipts (OCR).
 * Table: bg_receipts
 *
 * Receipt images are stored by URI reference. OCR results populate
 * merchant_raw, total_raw, date_raw, and line_items (JSON).
 * Status tracks the receipt lifecycle: pending -> parsed -> reviewed -> linked.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Receipt, ReceiptInsert, ReceiptUpdate } from '../types';

const RECEIPT_COLUMNS = new Set([
  'transaction_id', 'image_uri', 'thumbnail_uri', 'merchant_raw', 'total_raw',
  'date_raw', 'currency_raw', 'tax_amount', 'subtotal', 'line_items',
  'ocr_confidence', 'ocr_provider', 'raw_ocr_text', 'status',
]);

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createReceipt(
  db: DatabaseAdapter,
  id: string,
  input: ReceiptInsert,
): Receipt {
  const now = new Date().toISOString();
  const receipt: Receipt = {
    id,
    transaction_id: input.transaction_id ?? null,
    image_uri: input.image_uri,
    thumbnail_uri: input.thumbnail_uri ?? null,
    merchant_raw: input.merchant_raw ?? null,
    total_raw: input.total_raw ?? null,
    date_raw: input.date_raw ?? null,
    currency_raw: input.currency_raw ?? null,
    tax_amount: input.tax_amount ?? null,
    subtotal: input.subtotal ?? null,
    line_items: input.line_items ?? null,
    ocr_confidence: input.ocr_confidence ?? null,
    ocr_provider: input.ocr_provider ?? 'on-device',
    raw_ocr_text: input.raw_ocr_text ?? null,
    status: input.status ?? 'pending',
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bg_receipts
      (id, transaction_id, image_uri, thumbnail_uri, merchant_raw, total_raw, date_raw,
       currency_raw, tax_amount, subtotal, line_items, ocr_confidence, ocr_provider,
       raw_ocr_text, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.id, receipt.transaction_id, receipt.image_uri, receipt.thumbnail_uri,
      receipt.merchant_raw, receipt.total_raw, receipt.date_raw, receipt.currency_raw,
      receipt.tax_amount, receipt.subtotal, receipt.line_items, receipt.ocr_confidence,
      receipt.ocr_provider, receipt.raw_ocr_text, receipt.status,
      receipt.created_at, receipt.updated_at,
    ],
  );

  return receipt;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function getReceiptById(
  db: DatabaseAdapter,
  id: string,
): Receipt | null {
  const rows = db.query<Receipt>(
    `SELECT * FROM bg_receipts WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export function getReceiptsByTransaction(
  db: DatabaseAdapter,
  transactionId: string,
): Receipt[] {
  return db.query<Receipt>(
    `SELECT * FROM bg_receipts WHERE transaction_id = ? ORDER BY created_at DESC`,
    [transactionId],
  );
}

export function getReceiptsByStatus(
  db: DatabaseAdapter,
  status: string,
): Receipt[] {
  return db.query<Receipt>(
    `SELECT * FROM bg_receipts WHERE status = ? ORDER BY created_at DESC`,
    [status],
  );
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function updateReceipt(
  db: DatabaseAdapter,
  id: string,
  updates: ReceiptUpdate,
): Receipt | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && RECEIPT_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getReceiptById(db, id);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bg_receipts SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );

  return getReceiptById(db, id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export function deleteReceipt(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bg_receipts WHERE id = ?`, [id]);
}

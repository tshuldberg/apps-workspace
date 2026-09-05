/**
 * receipt-to-budget — first automation rule (Phase 5-core POC).
 *
 * When a user attaches a photo to a new Budget transaction, this rule
 * atomically creates the bg_transactions row, stores the photo in the
 * hub_attachments layer, and binds them via hub_attachment_links with
 * role='receipt'. The same receipt can later surface on car, homes, pets,
 * RSVP, or closet modules via additional link rows.
 *
 * OCR is out of scope for this POC — the user types amount/payee/envelope
 * into the new-transaction form and the rule wires the photo into the hub
 * attachment layer atomically.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { createAttachment, linkAttachment } from '@mylife/db';
import type { AutomationRule } from '@mylife/automations';
import { logAutomationEvent } from '@mylife/automations';
import { createTransaction } from '../db/crud';
import type { BudgetTransaction, BudgetTransactionInsert } from '../types';

/** UUID v4-shaped id generator (no crypto dep, matches shared/attachments). */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}

export interface ReceiptToBudgetInput {
  photoUri: string;
  photoMime: string; // e.g. 'image/jpeg'
  transactionDraft: BudgetTransactionInsert;
}

export interface ReceiptToBudgetPreviewState {
  photoUri: string;
  photoMime: string;
  transactionDraft: BudgetTransactionInsert;
}

export interface ReceiptToBudgetResult {
  transaction: BudgetTransaction;
  transactionId: string;
  attachmentId: string;
  linkedAt: string;
  auditEntryId: string;
}

export const receiptToBudgetRule: AutomationRule<
  ReceiptToBudgetInput,
  ReceiptToBudgetPreviewState,
  ReceiptToBudgetResult
> = {
  id: 'receipt-to-budget',
  label: 'Attach receipts to budget transactions',
  description:
    'When you attach a photo to a new Budget transaction, also store it in the hub attachment layer so the same receipt can surface on the car, homes, pets, RSVP, or closet modules later.',
  clusters: ['money'],

  check(_db, input) {
    if (!input || typeof input !== 'object') return null;
    if (!input.photoUri || input.photoUri.length === 0) return null;
    if (!input.photoMime || !input.photoMime.startsWith('image/')) return null;
    if (!input.transactionDraft) return null;
    return {
      photoUri: input.photoUri,
      photoMime: input.photoMime,
      transactionDraft: input.transactionDraft,
    };
  },

  previewCard(state) {
    const amount = Math.abs(state.transactionDraft.amount ?? 0);
    const payee = state.transactionDraft.merchant ?? 'transaction';
    const dollars = (amount / 100).toFixed(2);
    return {
      title: 'Attach receipt to transaction?',
      subtitle: `$${dollars} at ${payee} — the photo will also appear wherever you link it later.`,
      cta: { apply: 'Attach + save', dismiss: 'Skip' },
    };
  },

  apply(db, state) {
    const adapter = db as DatabaseAdapter;

    // Note on idempotence: callers invoking apply() twice with the same
    // PreviewState will produce two independent transactions + attachments.
    // Phase 5-core accepts this — the rule has no natural dedup key (photo
    // SHA, transaction key, etc.). Preview-card debounce in the UI layer is
    // the primary guard against double-tap; see handoff.
    let result: ReceiptToBudgetResult | null = null;

    adapter.transaction(() => {
      // 1. Insert the bg_transactions row. Budget CRUD requires an explicit id.
      const txId = generateId();
      const tx = createTransaction(adapter, txId, state.transactionDraft);

      // 2. Store the photo in the hub attachment layer.
      const attachment = createAttachment(adapter, {
        uri: state.photoUri,
        mime: state.photoMime,
      });

      // 3. Bind the attachment to the new transaction with role='receipt'.
      const link = linkAttachment(adapter, {
        attachmentId: attachment.id,
        moduleId: 'budget',
        entityType: 'transaction',
        entityId: tx.id,
        role: 'receipt',
      });

      // 4. Audit log entry. Shares the same transaction so rollback is atomic.
      const audit = logAutomationEvent(adapter, {
        ruleId: 'receipt-to-budget',
        outcome: 'applied',
      });

      result = {
        transaction: tx,
        transactionId: tx.id,
        attachmentId: attachment.id,
        linkedAt: link.linkedAt,
        auditEntryId: audit.id,
      };
    });

    if (!result) {
      throw new Error(
        'receipt-to-budget apply failed: transaction rolled back',
      );
    }
    return result;
  },
};

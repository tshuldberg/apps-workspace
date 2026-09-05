/**
 * Integration tests for the receipt-to-budget automation rule (Phase 5-core).
 *
 * Verifies that apply() atomically creates all 4 artifacts
 * (bg_transactions, hub_attachments, hub_attachment_links, hub_automation_log)
 * inside a single db.transaction() and rolls back cleanly on failure.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BUDGET_MODULE } from '../../definition';
import type { BudgetTransactionInsert } from '../../types';
import {
  receiptToBudgetRule,
  type ReceiptToBudgetInput,
  type ReceiptToBudgetPreviewState,
} from '../receipt-to-budget';

function makeDraft(
  overrides: Partial<BudgetTransactionInsert> = {},
): BudgetTransactionInsert {
  return {
    amount: 2499,
    direction: 'outflow',
    merchant: 'Whole Foods',
    note: null,
    occurred_on: '2026-04-18',
    envelope_id: null,
    account_id: null,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<ReceiptToBudgetInput> = {},
): ReceiptToBudgetInput {
  return {
    photoUri: 'file:///tmp/receipt.jpg',
    photoMime: 'image/jpeg',
    transactionDraft: makeDraft(),
    ...overrides,
  };
}

describe('receiptToBudgetRule', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase(
      'budget',
      BUDGET_MODULE.migrations!,
    );
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ---------------------------------------------------------------------------
  // check()
  // ---------------------------------------------------------------------------

  describe('check()', () => {
    it('returns a preview state for a valid image + transaction draft', () => {
      const state = receiptToBudgetRule.check(adapter, makeInput());
      expect(state).not.toBeNull();
      expect(state?.photoUri).toBe('file:///tmp/receipt.jpg');
      expect(state?.photoMime).toBe('image/jpeg');
      expect(state?.transactionDraft.amount).toBe(2499);
    });

    it('returns null for non-image MIME types', () => {
      expect(
        receiptToBudgetRule.check(
          adapter,
          makeInput({ photoMime: 'application/pdf' }),
        ),
      ).toBeNull();
      expect(
        receiptToBudgetRule.check(
          adapter,
          makeInput({ photoMime: 'text/plain' }),
        ),
      ).toBeNull();
    });

    it('returns null when photoUri is empty', () => {
      expect(
        receiptToBudgetRule.check(adapter, makeInput({ photoUri: '' })),
      ).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // previewCard()
  // ---------------------------------------------------------------------------

  describe('previewCard()', () => {
    it('formats subtitle with $X.YY + merchant', () => {
      const state: ReceiptToBudgetPreviewState = {
        photoUri: 'file:///tmp/receipt.jpg',
        photoMime: 'image/jpeg',
        transactionDraft: makeDraft({ amount: 1234, merchant: 'Target' }),
      };
      const card = receiptToBudgetRule.previewCard(state);
      expect(card.title).toBe('Attach receipt to transaction?');
      expect(card.subtitle).toContain('$12.34');
      expect(card.subtitle).toContain('Target');
      expect(card.cta.apply).toBe('Attach + save');
      expect(card.cta.dismiss).toBe('Skip');
    });
  });

  // ---------------------------------------------------------------------------
  // apply()
  // ---------------------------------------------------------------------------

  describe('apply()', () => {
    it('creates all 4 artifacts atomically (txn + attachment + link + audit)', () => {
      const state = receiptToBudgetRule.check(adapter, makeInput())!;
      const result = receiptToBudgetRule.apply(adapter, state);

      // 1. bg_transactions row
      const txns = adapter.query<{ id: string; amount: number; merchant: string }>(
        `SELECT id, amount, merchant FROM bg_transactions WHERE id = ?`,
        [result.transactionId],
      );
      expect(txns).toHaveLength(1);
      expect(txns[0]!.amount).toBe(2499);
      expect(txns[0]!.merchant).toBe('Whole Foods');

      // 2. hub_attachments row
      const attachments = adapter.query<{ id: string; uri: string; mime: string }>(
        `SELECT id, uri, mime FROM hub_attachments WHERE id = ?`,
        [result.attachmentId],
      );
      expect(attachments).toHaveLength(1);
      expect(attachments[0]!.uri).toBe('file:///tmp/receipt.jpg');
      expect(attachments[0]!.mime).toBe('image/jpeg');

      // 3. hub_attachment_links row with role='receipt'
      const links = adapter.query<{
        attachment_id: string;
        module_id: string;
        entity_type: string;
        entity_id: string;
        role: string;
      }>(
        `SELECT * FROM hub_attachment_links
         WHERE attachment_id = ? AND entity_id = ?`,
        [result.attachmentId, result.transactionId],
      );
      expect(links).toHaveLength(1);
      expect(links[0]!.module_id).toBe('budget');
      expect(links[0]!.entity_type).toBe('transaction');
      expect(links[0]!.role).toBe('receipt');

      // 4. hub_automation_log row with outcome='applied'
      const logs = adapter.query<{
        id: string;
        rule_id: string;
        outcome: string;
      }>(
        `SELECT id, rule_id, outcome FROM hub_automation_log WHERE id = ?`,
        [result.auditEntryId],
      );
      expect(logs).toHaveLength(1);
      expect(logs[0]!.rule_id).toBe('receipt-to-budget');
      expect(logs[0]!.outcome).toBe('applied');
    });

    it('rolls back all writes when an inner write fails', () => {
      // Violate the NOT NULL CHECK on bg_transactions.direction by passing an
      // invalid enum. Zod doesn't run here (createTransaction trusts input);
      // instead we rely on the TransactionDirection CHECK constraint.
      const badState: ReceiptToBudgetPreviewState = {
        photoUri: 'file:///tmp/bad.jpg',
        photoMime: 'image/jpeg',
        transactionDraft: makeDraft({
          // cast to bypass TS — we want to hit the SQL CHECK
          direction: 'not-a-direction' as never,
        }),
      };

      expect(() =>
        receiptToBudgetRule.apply(adapter, badState),
      ).toThrow();

      // No rows in any of the 4 tables.
      const txnCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM bg_transactions`,
      )[0]!.c;
      const attachmentCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_attachments WHERE uri = ?`,
        ['file:///tmp/bad.jpg'],
      )[0]!.c;
      const linkCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_attachment_links`,
      )[0]!.c;
      const logCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ?`,
        ['receipt-to-budget'],
      )[0]!.c;

      expect(txnCount).toBe(0);
      expect(attachmentCount).toBe(0);
      expect(linkCount).toBe(0);
      expect(logCount).toBe(0);
    });

    it('allows the same PreviewState to be applied twice as separate transactions', () => {
      // Phase 5-core POC: no dedup key on the rule. Two applies = two
      // independent (txn, attachment, link, log) quadruples. UI-layer
      // debounce is the primary guard against double-tap.
      const state = receiptToBudgetRule.check(adapter, makeInput())!;
      const a = receiptToBudgetRule.apply(adapter, state);
      const b = receiptToBudgetRule.apply(adapter, state);

      expect(a.transactionId).not.toBe(b.transactionId);
      expect(a.attachmentId).not.toBe(b.attachmentId);

      const txnCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM bg_transactions`,
      )[0]!.c;
      expect(txnCount).toBe(2);

      const logCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_automation_log WHERE rule_id = ? AND outcome = 'applied'`,
        ['receipt-to-budget'],
      )[0]!.c;
      expect(logCount).toBe(2);
    });
  });
});

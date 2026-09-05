import { describe, expect, it } from 'vitest';

import {
  createInMemoryPaymentsAuditSink,
  createInMemoryPaymentsBreakQueue,
  createPaymentsAuditLogger,
  runPaymentsReconciliationJob,
} from '../index';
import type {
  PaymentsCachedBalanceSnapshot,
  PaymentsLedgerEntrySnapshot,
  PaymentsLocalTransferSnapshot,
  PaymentsProviderBalanceSnapshot,
  PaymentsProviderEventRecord,
  PaymentsRemoteTransferSnapshot,
} from '../types';

function makeTransfer(
  overrides: Partial<PaymentsLocalTransferSnapshot> = {},
): PaymentsLocalTransferSnapshot {
  return {
    transferId: 'transfer_default',
    providerName: 'unit',
    providerTransferId: 'provider_default',
    remittanceId: null,
    kind: 'fund_wallet',
    status: 'completed',
    amountCents: 1_000,
    currency: 'USD',
    updatedAt: '2026-04-21T10:00:00.000Z',
    ...overrides,
  };
}

function makeRemoteTransfer(
  overrides: Partial<PaymentsRemoteTransferSnapshot> = {},
): PaymentsRemoteTransferSnapshot {
  return {
    providerName: 'unit',
    providerTransferId: 'provider_default',
    transferId: 'transfer_default',
    remittanceId: null,
    status: 'completed',
    amountCents: 1_000,
    currency: 'USD',
    updatedAt: '2026-04-21T10:05:00.000Z',
    ...overrides,
  };
}

function makeProviderEvent(
  overrides: Partial<PaymentsProviderEventRecord> = {},
): PaymentsProviderEventRecord {
  return {
    id: 'provider_event_default',
    providerName: 'unit',
    providerEventId: 'evt_default',
    eventType: 'transfer.updated',
    status: 'applied',
    receivedAt: '2026-04-21T10:05:00.000Z',
    occurredAt: null,
    ownerUserId: null,
    walletId: null,
    transferId: 'transfer_default',
    remittanceId: null,
    objectType: 'transfer',
    objectReference: 'provider_default',
    payload: {},
    metadata: {},
    replayCount: 0,
    dedupedCount: 0,
    lastReplayAt: null,
    appliedAt: '2026-04-21T10:05:01.000Z',
    failureCode: null,
    failureMessage: null,
    ...overrides,
  };
}

describe('payments reconciliation', () => {
  it('produces a sandbox report with breaks for drift, stale transfers, and duplicate callbacks', async () => {
    const auditSink = createInMemoryPaymentsAuditSink();
    let idCounter = 0;
    const createId = (prefix: string) => `${prefix}_${String(++idCounter)}`;
    const breakQueue = createInMemoryPaymentsBreakQueue({
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId,
    });
    const logger = createPaymentsAuditLogger({
      sink: auditSink,
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId: (prefix) => `${prefix}_${auditSink.getEntries().length + 1}`,
    });

    const localTransfers: PaymentsLocalTransferSnapshot[] = [
      makeTransfer({
        transferId: 'transfer_ok',
        providerTransferId: 'provider_ok',
      }),
      makeTransfer({
        transferId: 'transfer_mismatch',
        providerTransferId: 'provider_mismatch',
      }),
      makeTransfer({
        transferId: 'transfer_pending',
        providerTransferId: 'provider_pending',
        status: 'pending_provider',
        updatedAt: '2026-04-20T08:00:00.000Z',
      }),
      makeTransfer({
        transferId: 'transfer_remit',
        providerTransferId: 'provider_remit',
        remittanceId: 'remittance_1',
        kind: 'remittance_send',
        status: 'processing',
        updatedAt: '2026-04-18T08:00:00.000Z',
      }),
    ];

    const remoteTransfers: PaymentsRemoteTransferSnapshot[] = [
      makeRemoteTransfer({
        providerTransferId: 'provider_ok',
        transferId: 'transfer_ok',
      }),
      makeRemoteTransfer({
        providerTransferId: 'provider_mismatch',
        transferId: 'transfer_mismatch',
        status: 'failed',
      }),
      makeRemoteTransfer({
        providerTransferId: 'provider_pending',
        transferId: 'transfer_pending',
        status: 'pending',
      }),
      makeRemoteTransfer({
        providerTransferId: 'provider_remit',
        transferId: 'transfer_remit',
        remittanceId: 'remittance_1',
        status: 'processing',
      }),
      makeRemoteTransfer({
        providerTransferId: 'provider_orphan',
        transferId: null,
      }),
    ];

    const providerEvents: PaymentsProviderEventRecord[] = [
      makeProviderEvent({
        id: 'provider_event_dup',
        providerEventId: 'evt_dup',
        transferId: 'transfer_pending',
        objectReference: 'provider_pending',
        dedupedCount: 2,
      }),
    ];

    const ledgerEntries: PaymentsLedgerEntrySnapshot[] = [
      {
        walletId: 'wallet_main',
        balanceBucket: 'available',
        direction: 'credit',
        entryKind: 'principal',
        amountCents: 1_000,
        currency: 'USD',
        createdAt: '2026-04-21T09:00:00.000Z',
      },
      {
        walletId: 'wallet_main',
        balanceBucket: 'available',
        direction: 'debit',
        entryKind: 'fee',
        amountCents: 200,
        currency: 'USD',
        createdAt: '2026-04-21T09:05:00.000Z',
      },
      {
        walletId: 'wallet_ok',
        balanceBucket: 'available',
        direction: 'credit',
        entryKind: 'principal',
        amountCents: 500,
        currency: 'USD',
        createdAt: '2026-04-21T09:10:00.000Z',
      },
    ];

    const cachedBalances: PaymentsCachedBalanceSnapshot[] = [
      {
        walletId: 'wallet_main',
        balanceBucket: 'available',
        currency: 'USD',
        amountCents: 700,
      },
      {
        walletId: 'wallet_ok',
        balanceBucket: 'available',
        currency: 'USD',
        amountCents: 500,
      },
    ];

    const providerBalances: PaymentsProviderBalanceSnapshot[] = [
      {
        providerName: 'unit',
        walletId: 'wallet_main',
        balanceBucket: 'available',
        currency: 'USD',
        amountCents: 800,
        updatedAt: '2026-04-21T11:00:00.000Z',
      },
      {
        providerName: 'unit',
        walletId: 'wallet_ok',
        balanceBucket: 'available',
        currency: 'USD',
        amountCents: 500,
        updatedAt: '2026-04-21T11:00:00.000Z',
      },
    ];

    const report = await runPaymentsReconciliationJob({
      environment: 'sandbox',
      providerProfile: 'unit',
      bundleKind: 'sandbox',
      localTransfers,
      remoteTransfers,
      providerEvents,
      ledgerEntries,
      cachedBalances,
      providerBalances,
      auditLogger: logger,
      breakQueue,
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId,
      thresholds: {
        pendingAgeMs: 60 * 60 * 1000,
        remittanceAgeMs: 24 * 60 * 60 * 1000,
      },
    });

    expect(report.sandboxReady).toBe(true);
    expect(report.launchBlocked).toBe(true);
    expect(report.summary.matchedTransfers).toBe(4);
    expect(report.checks.statusMismatches).toBe(1);
    expect(report.checks.missingLocalTransfers).toBe(1);
    expect(report.checks.duplicateCallbacks).toBe(1);
    expect(report.checks.stuckPendingTransfers).toBe(1);
    expect(report.checks.staleRemittanceDeliveries).toBe(1);
    expect(report.breaks.map((entry) => entry.type)).toEqual(
      expect.arrayContaining([
        'balance_mismatch',
        'status_mismatch',
        'missing_local_transfer',
        'duplicate_callback',
        'stuck_pending_transfer',
        'stale_remittance_delivery',
      ]),
    );
    expect(report.operatorLines[0]).toContain('Reconciliation run');
    expect(report.operatorLines[3]).toContain('Launch blocked');
    expect(breakQueue.list({ status: 'open' })).toHaveLength(report.breaks.length);
    expect(
      auditSink.getEntries().map((entry) => entry.action),
    ).toEqual(
      expect.arrayContaining([
        'reconciliation.started',
        'reconciliation.break_detected',
        'reconciliation.completed',
      ]),
    );
  });
});

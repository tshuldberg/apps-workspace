import { describe, expect, it } from 'vitest';

import {
  buildPaymentsTransactionTrace,
  createInMemoryPaymentsAuditSink,
  createPaymentsAuditLogger,
} from '../index';
import type {
  PaymentsBreakRecord,
  PaymentsLocalTransferSnapshot,
  PaymentsProviderEventRecord,
  PaymentsTransferEventRecord,
} from '../types';

function makeTransfer(
  overrides: Partial<PaymentsLocalTransferSnapshot> = {},
): PaymentsLocalTransferSnapshot {
  return {
    transferId: 'transfer_1',
    providerName: 'unit',
    providerTransferId: 'provider_transfer_1',
    remittanceId: null,
    kind: 'fund_wallet',
    status: 'completed',
    amountCents: 1_250,
    currency: 'USD',
    updatedAt: '2026-04-21T12:00:30.000Z',
    ...overrides,
  };
}

function makeProviderEvent(
  overrides: Partial<PaymentsProviderEventRecord> = {},
): PaymentsProviderEventRecord {
  return {
    id: 'provider_event_1',
    providerName: 'unit',
    providerEventId: 'evt_1',
    eventType: 'transfer.updated',
    status: 'applied',
    receivedAt: '2026-04-21T12:00:20.000Z',
    occurredAt: '2026-04-21T12:00:19.000Z',
    ownerUserId: null,
    walletId: null,
    transferId: 'transfer_1',
    remittanceId: null,
    objectType: 'transfer',
    objectReference: 'provider_transfer_1',
    payload: {},
    metadata: {},
    replayCount: 0,
    dedupedCount: 1,
    lastReplayAt: null,
    appliedAt: '2026-04-21T12:00:21.000Z',
    failureCode: null,
    failureMessage: null,
    ...overrides,
  };
}

function makeTransferEvent(
  overrides: Partial<PaymentsTransferEventRecord> = {},
): PaymentsTransferEventRecord {
  return {
    transferId: 'transfer_1',
    eventType: 'posted',
    occurredAt: '2026-04-21T12:00:10.000Z',
    actorType: 'system',
    actorUserId: null,
    providerEventRef: 'evt_1',
    note: 'Ledger posting completed.',
    metadata: {},
    ...overrides,
  };
}

function makeBreak(
  overrides: Partial<PaymentsBreakRecord> = {},
): PaymentsBreakRecord {
  return {
    id: 'break_1',
    fingerprint: 'duplicate_callback:transfer_1:evt_1',
    createdAt: '2026-04-21T12:00:22.000Z',
    updatedAt: '2026-04-21T12:00:22.000Z',
    status: 'open',
    type: 'duplicate_callback',
    severity: 'low',
    summary: 'Duplicate callback suppressed for unit:evt_1.',
    transferId: 'transfer_1',
    providerName: 'unit',
    providerEventId: 'evt_1',
    remittanceId: null,
    walletId: null,
    metadata: {
      duplicateCount: 1,
    },
    ...overrides,
  };
}

describe('payments ops audit', () => {
  it('writes structured audit entries to the sink', async () => {
    const sink = createInMemoryPaymentsAuditSink();
    const logger = createPaymentsAuditLogger({
      sink,
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId: () => 'audit_1',
    });

    const entry = await logger.log({
      level: 'info',
      action: 'command.applied',
      subjectType: 'transfer',
      transferId: 'transfer_1',
      commandIdempotencyKey: 'send_1',
      message: 'Posted transfer to the ledger.',
      metadata: {
        status: 'completed',
      },
    });

    expect(entry.id).toBe('audit_1');
    expect(entry.occurredAt).toBe('2026-04-21T12:00:00.000Z');
    expect(entry.transferId).toBe('transfer_1');
    expect(sink.getEntries()).toHaveLength(1);
    expect(sink.getEntries()[0]?.metadata.status).toBe('completed');
  });

  it('builds an operator trace that answers what happened for a transfer', () => {
    const trace = buildPaymentsTransactionTrace({
      transfer: makeTransfer(),
      auditEntries: [
        {
          id: 'audit_1',
          occurredAt: '2026-04-21T12:00:00.000Z',
          level: 'info',
          action: 'command.applied',
          subjectType: 'transfer',
          message: 'Posted transfer to the ledger.',
          commandIdempotencyKey: 'send_1',
          transferId: 'transfer_1',
          providerName: 'unit',
          providerEventId: 'evt_1',
          remittanceId: null,
          walletId: null,
          complianceCaseId: null,
          breakId: null,
          metadata: {},
        },
      ],
      transferEvents: [makeTransferEvent()],
      providerEvents: [makeProviderEvent()],
      breaks: [makeBreak()],
    });

    expect(trace.transferId).toBe('transfer_1');
    expect(trace.currentStatus).toBe('completed');
    expect(trace.providerEventCount).toBe(1);
    expect(trace.duplicateCallbackCount).toBe(1);
    expect(trace.openBreakCount).toBe(1);
    expect(trace.timeline).toHaveLength(4);
    expect(trace.timeline[0]?.category).toBe('audit');
    expect(trace.timeline[3]?.category).toBe('break');
    expect(trace.summary).toContain('Transfer is completed.');
    expect(trace.summary).toContain('1 provider event recorded.');
  });
});

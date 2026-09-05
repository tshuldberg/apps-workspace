import { describe, expect, it } from 'vitest';

import {
  acceptPaymentsProviderEvent,
  createInMemoryPaymentsAuditSink,
  createInMemoryPaymentsBreakQueue,
  createInMemoryPaymentsProviderEventStore,
  createPaymentsAuditLogger,
  createPaymentsWebhookReplayService,
} from '../index';
import type { PaymentsProviderEventRecord } from '../types';

function makeStoredProviderEvent(
  overrides: Partial<PaymentsProviderEventRecord> = {},
): PaymentsProviderEventRecord {
  return {
    id: 'provider_event_1',
    providerName: 'unit',
    providerEventId: 'evt_1',
    eventType: 'transfer.updated',
    status: 'failed',
    receivedAt: '2026-04-21T12:00:00.000Z',
    occurredAt: '2026-04-21T11:59:59.000Z',
    ownerUserId: null,
    walletId: null,
    transferId: 'transfer_1',
    remittanceId: null,
    objectType: 'transfer',
    objectReference: 'provider_transfer_1',
    payload: {},
    metadata: {},
    replayCount: 0,
    dedupedCount: 0,
    lastReplayAt: null,
    appliedAt: null,
    failureCode: 'provider_timeout',
    failureMessage: 'Timed out',
    ...overrides,
  };
}

describe('payments provider-event replay', () => {
  it('dedupes duplicate callbacks before replay', async () => {
    const sink = createInMemoryPaymentsAuditSink();
    const logger = createPaymentsAuditLogger({
      sink,
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId: (prefix) => `${prefix}_${sink.getEntries().length + 1}`,
    });
    const breakQueue = createInMemoryPaymentsBreakQueue({
      now: () => new Date('2026-04-21T12:00:00.000Z'),
      createId: (prefix) => `${prefix}_1`,
    });
    const store = createInMemoryPaymentsProviderEventStore();
    const normalizedEvent = {
      providerName: 'unit' as const,
      providerEventId: 'evt_1',
      eventType: 'transfer.updated',
      objectType: 'transfer',
      objectReference: 'provider_transfer_1',
      ownerUserId: null,
      walletId: null,
      transferId: 'transfer_1',
      remittanceId: null,
      occurredAt: '2026-04-21T11:59:59.000Z',
      payload: {},
      metadata: {},
    };

    const first = await acceptPaymentsProviderEvent(
      { normalizedEvent },
      {
        store,
        auditLogger: logger,
        breakQueue,
        now: () => new Date('2026-04-21T12:00:00.000Z'),
        createId: (prefix) => `${prefix}_1`,
      },
    );
    const second = await acceptPaymentsProviderEvent(
      { normalizedEvent },
      {
        store,
        auditLogger: logger,
        breakQueue,
        now: () => new Date('2026-04-21T12:01:00.000Z'),
        createId: (prefix) => `${prefix}_1`,
      },
    );

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(store.get('unit', 'evt_1')?.dedupedCount).toBe(1);
    expect(breakQueue.list({ type: 'duplicate_callback' })).toHaveLength(1);
    expect(
      sink.getEntries().map((entry) => entry.action),
    ).toContain('provider_event.duplicate_callback');
  });

  it('replays failed events and marks them applied once the handler succeeds', async () => {
    const store = createInMemoryPaymentsProviderEventStore([
      makeStoredProviderEvent(),
    ]);
    let applyCalls = 0;
    const service = createPaymentsWebhookReplayService({
      store,
      now: () => new Date('2026-04-21T12:10:00.000Z'),
      applyEvent: async ({ normalizedEvent }) => {
        applyCalls += 1;
        return {
          outcome: 'applied',
          transferId: normalizedEvent.transferId ?? null,
          message: 'Applied provider status update.',
        };
      },
    });

    const result = await service.replay({
      providerName: 'unit',
      providerEventId: 'evt_1',
      reason: 'manual_retry',
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('applied');
    expect(result.record.status).toBe('applied');
    expect(result.record.replayCount).toBe(1);
    expect(applyCalls).toBe(1);
  });

  it('skips replay for already applied events unless forced', async () => {
    const store = createInMemoryPaymentsProviderEventStore([
      makeStoredProviderEvent({
        status: 'applied',
        appliedAt: '2026-04-21T12:05:00.000Z',
      }),
    ]);
    let applyCalls = 0;
    const service = createPaymentsWebhookReplayService({
      store,
      now: () => new Date('2026-04-21T12:15:00.000Z'),
      applyEvent: async () => {
        applyCalls += 1;
        return {
          outcome: 'applied',
        };
      },
    });

    const result = await service.replay({
      providerName: 'unit',
      providerEventId: 'evt_1',
      reason: 'operator_drill',
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('skipped');
    expect(result.message).toBe('Event already applied.');
    expect(applyCalls).toBe(0);
  });
});

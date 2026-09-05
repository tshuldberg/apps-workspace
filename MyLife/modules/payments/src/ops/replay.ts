import type { NormalizedProviderEvent, PaymentsWebhookSource } from '../providers/types';
import type {
  AcceptPaymentsProviderEventInput,
  PaymentsAuditLogger,
  PaymentsBreakQueue,
  PaymentsProviderEventAcceptanceResult,
  PaymentsProviderEventApplyResult,
  PaymentsProviderEventRecord,
  PaymentsProviderEventStore,
  PaymentsWebhookReplayInput,
  PaymentsWebhookReplayResult,
  PaymentsWebhookReplayService,
} from './types';

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function providerEventKey(
  providerName: PaymentsWebhookSource,
  providerEventId: string,
): string {
  return `${providerName}:${providerEventId}`;
}

function toNormalizedEvent(
  record: PaymentsProviderEventRecord,
): NormalizedProviderEvent {
  return {
    providerName: record.providerName,
    providerEventId: record.providerEventId,
    eventType: record.eventType,
    objectType: record.objectType,
    objectReference: record.objectReference,
    ownerUserId: record.ownerUserId,
    walletId: record.walletId,
    transferId: record.transferId,
    remittanceId: record.remittanceId,
    occurredAt: record.occurredAt,
    payload: record.payload,
    metadata: record.metadata,
  };
}

export function createInMemoryPaymentsProviderEventStore(
  initialRecords: PaymentsProviderEventRecord[] = [],
): PaymentsProviderEventStore {
  const records = new Map<string, PaymentsProviderEventRecord>(
    initialRecords.map((record) => [
      providerEventKey(record.providerName, record.providerEventId),
      record,
    ]),
  );

  return {
    get(providerName, providerEventId): PaymentsProviderEventRecord | null {
      return records.get(providerEventKey(providerName, providerEventId)) ?? null;
    },

    upsert(record): PaymentsProviderEventRecord {
      records.set(providerEventKey(record.providerName, record.providerEventId), record);
      return record;
    },

    update(providerName, providerEventId, patch): PaymentsProviderEventRecord {
      const current = records.get(providerEventKey(providerName, providerEventId));
      if (!current) {
        throw new Error(
          `Unknown provider event ${providerName}:${providerEventId}`,
        );
      }
      const updated: PaymentsProviderEventRecord = {
        ...current,
        ...patch,
        metadata: {
          ...current.metadata,
          ...(patch.metadata ?? {}),
        },
      };
      records.set(providerEventKey(providerName, providerEventId), updated);
      return updated;
    },

    list(): PaymentsProviderEventRecord[] {
      return Array.from(records.values());
    },
  };
}

export async function acceptPaymentsProviderEvent(
  input: AcceptPaymentsProviderEventInput,
  options: {
    store: PaymentsProviderEventStore;
    auditLogger?: PaymentsAuditLogger;
    breakQueue?: PaymentsBreakQueue;
    now?: () => Date;
    createId?: (prefix: string) => string;
  },
): Promise<PaymentsProviderEventAcceptanceResult> {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;
  const receivedAt = input.receivedAt ?? now().toISOString();
  const existing = options.store.get(
    input.normalizedEvent.providerName,
    input.normalizedEvent.providerEventId,
  );

  if (existing) {
    const updated = options.store.update(
      input.normalizedEvent.providerName,
      input.normalizedEvent.providerEventId,
      {
        dedupedCount: existing.dedupedCount + 1,
        metadata: {
          lastDuplicateAt: receivedAt,
        },
      },
    );

    const breakRecord =
      options.breakQueue?.upsert({
        type: 'duplicate_callback',
        severity: 'low',
        summary: `Duplicate callback suppressed for ${updated.providerName}:${updated.providerEventId}.`,
        transferId: updated.transferId,
        providerName: updated.providerName,
        providerEventId: updated.providerEventId,
        remittanceId: updated.remittanceId,
        metadata: {
          duplicateCount: updated.dedupedCount,
        },
      }) ?? null;

    if (options.auditLogger) {
      await options.auditLogger.log({
        level: 'warning',
        action: 'provider_event.duplicate_callback',
        subjectType: 'provider_event',
        message: `Duplicate provider callback suppressed for ${updated.providerName}:${updated.providerEventId}.`,
        transferId: updated.transferId,
        providerName: updated.providerName,
        providerEventId: updated.providerEventId,
        remittanceId: updated.remittanceId,
        breakId: breakRecord?.id ?? null,
        metadata: {
          dedupedCount: updated.dedupedCount,
        },
      });
    }

    return {
      record: updated,
      deduped: true,
      breakRecord,
    };
  }

  const record: PaymentsProviderEventRecord = {
    id: createId('pay_provider_event'),
    providerName: input.normalizedEvent.providerName,
    providerEventId: input.normalizedEvent.providerEventId,
    eventType: input.normalizedEvent.eventType,
    status: input.initialStatus ?? 'received',
    receivedAt,
    occurredAt: input.normalizedEvent.occurredAt ?? null,
    ownerUserId: input.normalizedEvent.ownerUserId ?? null,
    walletId: input.normalizedEvent.walletId ?? null,
    transferId: input.normalizedEvent.transferId ?? null,
    remittanceId: input.normalizedEvent.remittanceId ?? null,
    objectType: input.normalizedEvent.objectType ?? null,
    objectReference: input.normalizedEvent.objectReference ?? null,
    payload: input.normalizedEvent.payload,
    metadata: input.normalizedEvent.metadata ?? {},
    replayCount: 0,
    dedupedCount: 0,
    lastReplayAt: null,
    appliedAt: null,
    failureCode: null,
    failureMessage: null,
  };
  options.store.upsert(record);

  if (options.auditLogger) {
    await options.auditLogger.log({
      level: 'info',
      action: 'provider_event.received',
      subjectType: 'provider_event',
      message: `Recorded provider event ${record.providerName}:${record.providerEventId}.`,
      transferId: record.transferId,
      providerName: record.providerName,
      providerEventId: record.providerEventId,
      remittanceId: record.remittanceId,
      metadata: {
        eventType: record.eventType,
      },
    });
  }

  return {
    record,
    deduped: false,
    breakRecord: null,
  };
}

export function createPaymentsWebhookReplayService(input: {
  store: PaymentsProviderEventStore;
  applyEvent: (payload: {
    normalizedEvent: NormalizedProviderEvent;
    reason: PaymentsWebhookReplayInput['reason'];
    operatorUserId: string | null;
    force: boolean;
  }) => Promise<PaymentsProviderEventApplyResult> | PaymentsProviderEventApplyResult;
  auditLogger?: PaymentsAuditLogger;
  breakQueue?: PaymentsBreakQueue;
  now?: () => Date;
}): PaymentsWebhookReplayService {
  const now = input.now ?? (() => new Date());

  return {
    async replay(request): Promise<PaymentsWebhookReplayResult> {
      const existing = input.store.get(request.providerName, request.providerEventId);
      if (!existing) {
        throw new Error(
          `Provider event ${request.providerName}:${request.providerEventId} not found`,
        );
      }

      if (existing.status === 'applied' && !request.force) {
        if (input.auditLogger) {
          await input.auditLogger.log({
            level: 'info',
            action: 'provider_event.replay_skipped',
            subjectType: 'provider_event',
            message: `Skipped replay for already applied event ${existing.providerName}:${existing.providerEventId}.`,
            transferId: existing.transferId,
            providerName: existing.providerName,
            providerEventId: existing.providerEventId,
            remittanceId: existing.remittanceId,
          });
        }

        return {
          ok: true,
          record: existing,
          outcome: 'skipped',
          breakRecord: null,
          message: 'Event already applied.',
        };
      }

      const replayedAt = now().toISOString();
      const processing = input.store.update(
        request.providerName,
        request.providerEventId,
        {
          status: 'processing',
          lastReplayAt: replayedAt,
          replayCount: existing.replayCount + 1,
          failureCode: null,
          failureMessage: null,
        },
      );

      if (input.auditLogger) {
        await input.auditLogger.log({
          level: 'info',
          action: 'provider_event.replay_started',
          subjectType: 'provider_event',
          message: `Started replay for ${processing.providerName}:${processing.providerEventId}.`,
          transferId: processing.transferId,
          providerName: processing.providerName,
          providerEventId: processing.providerEventId,
          remittanceId: processing.remittanceId,
          metadata: {
            reason: request.reason,
            force: request.force ?? false,
          },
        });
      }

      try {
        const result = await input.applyEvent({
          normalizedEvent: toNormalizedEvent(processing),
          reason: request.reason,
          operatorUserId: request.operatorUserId ?? null,
          force: request.force ?? false,
        });

        const status = result.outcome === 'ignored' ? 'ignored' : 'applied';
        const updated = input.store.update(
          request.providerName,
          request.providerEventId,
          {
            status,
            appliedAt: status === 'applied' ? replayedAt : processing.appliedAt,
            transferId: result.transferId ?? processing.transferId,
            metadata: result.metadata ?? {},
          },
        );

        if (input.auditLogger) {
          await input.auditLogger.log({
            level: 'info',
            action: 'provider_event.replay_succeeded',
            subjectType: 'provider_event',
            message:
              result.message ??
              `Replay ${result.outcome} for ${updated.providerName}:${updated.providerEventId}.`,
            transferId: updated.transferId,
            providerName: updated.providerName,
            providerEventId: updated.providerEventId,
            remittanceId: updated.remittanceId,
            metadata: {
              outcome: result.outcome,
            },
          });
        }

        return {
          ok: true,
          record: updated,
          outcome: result.outcome,
          breakRecord: null,
          message: result.message ?? null,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const failed = input.store.update(
          request.providerName,
          request.providerEventId,
          {
            status: 'failed',
            failureCode: 'replay_failed',
            failureMessage: reason,
          },
        );
        const breakRecord =
          input.breakQueue?.upsert({
            type: 'replay_failed',
            severity: 'high',
            summary: `Webhook replay failed for ${failed.providerName}:${failed.providerEventId}.`,
            transferId: failed.transferId,
            providerName: failed.providerName,
            providerEventId: failed.providerEventId,
            remittanceId: failed.remittanceId,
            metadata: {
              error: reason,
              operatorUserId: request.operatorUserId ?? null,
            },
          }) ?? null;

        if (input.auditLogger) {
          await input.auditLogger.log({
            level: 'error',
            action: 'provider_event.replay_failed',
            subjectType: 'provider_event',
            message: `Replay failed for ${failed.providerName}:${failed.providerEventId}.`,
            transferId: failed.transferId,
            providerName: failed.providerName,
            providerEventId: failed.providerEventId,
            remittanceId: failed.remittanceId,
            breakId: breakRecord?.id ?? null,
            metadata: {
              error: reason,
            },
          });
        }

        return {
          ok: false,
          record: failed,
          outcome: 'failed',
          breakRecord,
          message: reason,
        };
      }
    },
  };
}

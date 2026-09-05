import { createStableFingerprint } from '../engine/idempotency';
import type {
  PaymentsBreakInput,
  PaymentsBreakListFilter,
  PaymentsBreakQueue,
  PaymentsBreakRecord,
  PaymentsBreakSeverity,
} from './types';

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function severityWeight(value: PaymentsBreakSeverity): number {
  switch (value) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
  }
}

function coerceSeverity(
  current: PaymentsBreakSeverity,
  next: PaymentsBreakSeverity,
): PaymentsBreakSeverity {
  return severityWeight(next) > severityWeight(current) ? next : current;
}

export function createPaymentsBreakFingerprint(
  input: PaymentsBreakInput,
): string {
  return createStableFingerprint({
    type: input.type,
    transferId: input.transferId ?? null,
    providerName: input.providerName ?? null,
    providerEventId: input.providerEventId ?? null,
    remittanceId: input.remittanceId ?? null,
    walletId: input.walletId ?? null,
    summary: input.summary,
  });
}

export function createInMemoryPaymentsBreakQueue(input: {
  now?: () => Date;
  createId?: (prefix: string) => string;
} = {}): PaymentsBreakQueue {
  const now = input.now ?? (() => new Date());
  const createId = input.createId ?? defaultCreateId;
  const records = new Map<string, PaymentsBreakRecord>();
  const fingerprintIndex = new Map<string, string>();

  function getRecord(id: string): PaymentsBreakRecord {
    const record = records.get(id);
    if (!record) {
      throw new Error(`Unknown payments break ${id}`);
    }
    return record;
  }

  function matchesFilter(
    record: PaymentsBreakRecord,
    filter: PaymentsBreakListFilter,
  ): boolean {
    if (filter.status && record.status !== filter.status) {
      return false;
    }
    if (filter.type && record.type !== filter.type) {
      return false;
    }
    if (filter.transferId && record.transferId !== filter.transferId) {
      return false;
    }
    if (
      filter.providerEventId &&
      record.providerEventId !== filter.providerEventId
    ) {
      return false;
    }
    return true;
  }

  return {
    upsert(payload): PaymentsBreakRecord {
      const timestamp = now().toISOString();
      const fingerprint = createPaymentsBreakFingerprint(payload);
      const existingId = fingerprintIndex.get(fingerprint);

      if (existingId) {
        const existing = getRecord(existingId);
        const updated: PaymentsBreakRecord = {
          ...existing,
          updatedAt: timestamp,
          status: existing.status === 'resolved' ? 'open' : existing.status,
          severity: coerceSeverity(existing.severity, payload.severity),
          summary: payload.summary,
          transferId: payload.transferId ?? existing.transferId,
          providerName: payload.providerName ?? existing.providerName,
          providerEventId: payload.providerEventId ?? existing.providerEventId,
          remittanceId: payload.remittanceId ?? existing.remittanceId,
          walletId: payload.walletId ?? existing.walletId,
          metadata: {
            ...existing.metadata,
            ...(payload.metadata ?? {}),
          },
        };
        records.set(existingId, updated);
        return updated;
      }

      const record: PaymentsBreakRecord = {
        id: createId('pay_break'),
        fingerprint,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'open',
        type: payload.type,
        severity: payload.severity,
        summary: payload.summary,
        transferId: payload.transferId ?? null,
        providerName: payload.providerName ?? null,
        providerEventId: payload.providerEventId ?? null,
        remittanceId: payload.remittanceId ?? null,
        walletId: payload.walletId ?? null,
        metadata: payload.metadata ?? {},
      };

      records.set(record.id, record);
      fingerprintIndex.set(fingerprint, record.id);
      return record;
    },

    get(id): PaymentsBreakRecord | null {
      return records.get(id) ?? null;
    },

    list(filter = {}): PaymentsBreakRecord[] {
      return Array.from(records.values())
        .filter((record) => matchesFilter(record, filter))
        .sort((left, right) => {
          const timeDiff =
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
          if (timeDiff !== 0) {
            return timeDiff;
          }
          return left.id.localeCompare(right.id);
        });
    },

    acknowledge(id): PaymentsBreakRecord {
      const current = getRecord(id);
      const updated: PaymentsBreakRecord = {
        ...current,
        status: 'acknowledged',
        updatedAt: now().toISOString(),
      };
      records.set(id, updated);
      return updated;
    },

    resolve(id): PaymentsBreakRecord {
      const current = getRecord(id);
      const updated: PaymentsBreakRecord = {
        ...current,
        status: 'resolved',
        updatedAt: now().toISOString(),
      };
      records.set(id, updated);
      return updated;
    },
  };
}

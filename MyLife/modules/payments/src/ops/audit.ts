import type {
  PaymentsAuditEntry,
  PaymentsAuditLogInput,
  PaymentsAuditLogger,
  PaymentsAuditSink,
  PaymentsTimelineItem,
  PaymentsTransactionTrace,
  PaymentsTransactionTraceInput,
} from './types';

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createPaymentsAuditLogger(input: {
  sink: PaymentsAuditSink;
  now?: () => Date;
  createId?: (prefix: string) => string;
}): PaymentsAuditLogger {
  const {
    sink,
    now = () => new Date(),
    createId = defaultCreateId,
  } = input;

  return {
    async log(payload: PaymentsAuditLogInput): Promise<PaymentsAuditEntry> {
      const entry: PaymentsAuditEntry = {
        id: createId('pay_audit'),
        occurredAt: now().toISOString(),
        level: payload.level,
        action: payload.action,
        subjectType: payload.subjectType,
        message: payload.message,
        commandIdempotencyKey: payload.commandIdempotencyKey ?? null,
        transferId: payload.transferId ?? null,
        providerName: payload.providerName ?? null,
        providerEventId: payload.providerEventId ?? null,
        remittanceId: payload.remittanceId ?? null,
        walletId: payload.walletId ?? null,
        complianceCaseId: payload.complianceCaseId ?? null,
        breakId: payload.breakId ?? null,
        metadata: payload.metadata ?? {},
      };

      await Promise.resolve(sink.append(entry));
      return entry;
    },
  };
}

export function createInMemoryPaymentsAuditSink(): PaymentsAuditSink & {
  getEntries(): PaymentsAuditEntry[];
} {
  const entries: PaymentsAuditEntry[] = [];

  return {
    append(entry): void {
      entries.push(entry);
    },
    getEntries(): PaymentsAuditEntry[] {
      return [...entries];
    },
  };
}

function compareTimelineItems(
  left: PaymentsTimelineItem,
  right: PaymentsTimelineItem,
): number {
  const leftMs = new Date(left.occurredAt).getTime();
  const rightMs = new Date(right.occurredAt).getTime();

  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }

  return left.id.localeCompare(right.id);
}

export function buildPaymentsTransactionTrace(
  input: PaymentsTransactionTraceInput,
): PaymentsTransactionTrace {
  const { transfer } = input;
  const auditEntries = (input.auditEntries ?? []).filter(
    (entry) =>
      entry.transferId === transfer.transferId ||
      (transfer.remittanceId !== null && entry.remittanceId === transfer.remittanceId),
  );
  const transferEvents = (input.transferEvents ?? []).filter(
    (entry) => entry.transferId === transfer.transferId,
  );
  const providerEvents = (input.providerEvents ?? []).filter(
    (entry) =>
      entry.transferId === transfer.transferId ||
      (transfer.remittanceId !== null && entry.remittanceId === transfer.remittanceId),
  );
  const breaks = (input.breaks ?? []).filter(
    (entry) =>
      entry.transferId === transfer.transferId ||
      (transfer.remittanceId !== null && entry.remittanceId === transfer.remittanceId),
  );

  const timeline: PaymentsTimelineItem[] = [
    ...auditEntries.map((entry) => ({
      id: `audit:${entry.id}`,
      occurredAt: entry.occurredAt,
      category: 'audit' as const,
      action: entry.action,
      message: entry.message,
      status: null,
      metadata: entry.metadata,
    })),
    ...transferEvents.map((entry, index) => ({
      id: `transfer_event:${entry.transferId}:${entry.eventType}:${index}`,
      occurredAt: entry.occurredAt,
      category: 'transfer_event' as const,
      action: entry.eventType,
      message: entry.note ?? `Transfer ${entry.eventType}`,
      status: null,
      metadata: {
        actorType: entry.actorType ?? null,
        actorUserId: entry.actorUserId ?? null,
        providerEventRef: entry.providerEventRef ?? null,
        ...(entry.metadata ?? {}),
      },
    })),
    ...providerEvents.map((entry) => ({
      id: `provider_event:${entry.providerName}:${entry.providerEventId}`,
      occurredAt: entry.occurredAt ?? entry.receivedAt,
      category: 'provider_event' as const,
      action: entry.eventType,
      message: `${entry.providerName} ${entry.eventType}`,
      status: entry.status,
      metadata: {
        providerEventId: entry.providerEventId,
        replayCount: entry.replayCount,
        dedupedCount: entry.dedupedCount,
      },
    })),
    ...breaks.map((entry) => ({
      id: `break:${entry.id}`,
      occurredAt: entry.updatedAt,
      category: 'break' as const,
      action: `break.${entry.type}`,
      message: entry.summary,
      status: entry.status,
      metadata: {
        severity: entry.severity,
        ...entry.metadata,
      },
    })),
  ].sort(compareTimelineItems);

  const duplicateCallbackCount = providerEvents.reduce(
    (sum, entry) => sum + entry.dedupedCount,
    0,
  );
  const openBreakCount = breaks.filter((entry) => entry.status !== 'resolved').length;
  const latestItem = timeline[timeline.length - 1] ?? null;
  const providerEventCount = providerEvents.length;

  const summaryParts = [
    `Transfer is ${transfer.status}.`,
    providerEventCount === 0
      ? 'No provider callbacks recorded.'
      : `${providerEventCount} provider event${providerEventCount === 1 ? '' : 's'} recorded.`,
    duplicateCallbackCount === 0
      ? 'No duplicate callbacks suppressed.'
      : `${duplicateCallbackCount} duplicate callback${duplicateCallbackCount === 1 ? '' : 's'} suppressed.`,
    openBreakCount === 0
      ? 'No open operator breaks.'
      : `${openBreakCount} open operator break${openBreakCount === 1 ? '' : 's'}.`,
  ];

  if (latestItem) {
    summaryParts.push(`Last event: ${latestItem.message}.`);
  }

  return {
    transferId: transfer.transferId,
    currentStatus: transfer.status,
    summary: summaryParts.join(' '),
    duplicateCallbackCount,
    providerEventCount,
    openBreakCount,
    timeline,
  };
}

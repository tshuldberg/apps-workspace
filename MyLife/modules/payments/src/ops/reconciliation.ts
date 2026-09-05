import type {
  PaymentsAuditLogger,
  PaymentsBalanceProof,
  PaymentsBreakInput,
  PaymentsBreakQueue,
  PaymentsBreakRecord,
  PaymentsCachedBalanceSnapshot,
  PaymentsLedgerEntrySnapshot,
  PaymentsLocalTransferSnapshot,
  PaymentsProviderBalanceSnapshot,
  PaymentsProviderEventRecord,
  PaymentsReconciliationInput,
  PaymentsReconciliationReport,
  PaymentsRemoteTransferSnapshot,
} from './types';

const DEFAULT_PENDING_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMITTANCE_AGE_MS = 48 * 60 * 60 * 1000;

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTransferState(
  status: string,
): 'pending' | 'completed' | 'failed' | 'reversed' | 'canceled' | 'disputed' | 'unknown' {
  switch (status.trim().toLowerCase()) {
    case 'pending':
    case 'pending_review':
    case 'pending_provider':
    case 'processing':
    case 'queued':
    case 'review':
    case 'submitted':
    case 'in_transit':
      return 'pending';
    case 'completed':
    case 'settled':
    case 'succeeded':
    case 'posted':
    case 'paid':
      return 'completed';
    case 'failed':
    case 'returned':
    case 'rejected':
      return 'failed';
    case 'reversed':
    case 'refunded':
      return 'reversed';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'disputed':
    case 'chargeback':
      return 'disputed';
    default:
      return 'unknown';
  }
}

function ledgerDelta(entry: PaymentsLedgerEntrySnapshot): number {
  return entry.direction === 'credit' ? entry.amountCents : -entry.amountCents;
}

function balanceKey(input: {
  walletId: string;
  balanceBucket: string;
  currency: string;
}): string {
  return `${input.walletId}:${input.balanceBucket}:${input.currency}`;
}

function remoteTransferIdentity(transfer: PaymentsRemoteTransferSnapshot): string {
  return `${transfer.providerName}:${transfer.providerTransferId}`;
}

function localTransferRequiresProviderMatch(
  transfer: PaymentsLocalTransferSnapshot,
): boolean {
  return (
    transfer.providerName !== null ||
    transfer.providerTransferId !== null ||
    transfer.remittanceId !== null ||
    transfer.kind !== 'p2p'
  );
}

function localTransferKeys(transfer: PaymentsLocalTransferSnapshot): string[] {
  const keys = [`transfer:${transfer.transferId}`];

  if (transfer.providerName && transfer.providerTransferId) {
    keys.push(`provider:${transfer.providerName}:${transfer.providerTransferId}`);
  }

  if (transfer.remittanceId) {
    keys.push(`remittance:${transfer.remittanceId}`);
  }

  return keys;
}

function remoteTransferKeys(transfer: PaymentsRemoteTransferSnapshot): string[] {
  const keys = [`provider:${transfer.providerName}:${transfer.providerTransferId}`];

  if (transfer.transferId) {
    keys.push(`transfer:${transfer.transferId}`);
  }

  if (transfer.remittanceId) {
    keys.push(`remittance:${transfer.remittanceId}`);
  }

  return keys;
}

function buildBreakRecord(
  payload: PaymentsBreakInput,
  nowIso: string,
  createId: (prefix: string) => string,
): PaymentsBreakRecord {
  return {
    id: createId('pay_break'),
    fingerprint: `${payload.type}:${payload.transferId ?? ''}:${payload.providerEventId ?? ''}:${payload.walletId ?? ''}:${payload.summary}`,
    createdAt: nowIso,
    updatedAt: nowIso,
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
}

async function recordBreak(input: {
  payload: PaymentsBreakInput;
  nowIso: string;
  createId: (prefix: string) => string;
  breakQueue?: PaymentsBreakQueue;
  auditLogger?: PaymentsAuditLogger;
}): Promise<PaymentsBreakRecord> {
  const breakRecord = input.breakQueue
    ? input.breakQueue.upsert(input.payload)
    : buildBreakRecord(input.payload, input.nowIso, input.createId);

  if (input.auditLogger) {
    await input.auditLogger.log({
      level: breakRecord.severity === 'low' ? 'warning' : 'error',
      action: 'reconciliation.break_detected',
      subjectType: 'break',
      message: breakRecord.summary,
      transferId: breakRecord.transferId,
      providerName: breakRecord.providerName,
      providerEventId: breakRecord.providerEventId,
      remittanceId: breakRecord.remittanceId,
      walletId: breakRecord.walletId,
      breakId: breakRecord.id,
      metadata: {
        type: breakRecord.type,
        severity: breakRecord.severity,
        ...breakRecord.metadata,
      },
    });
  }

  return breakRecord;
}

export function buildPaymentsBalanceProofs(input: {
  ledgerEntries: PaymentsLedgerEntrySnapshot[];
  cachedBalances: PaymentsCachedBalanceSnapshot[];
  providerBalances?: PaymentsProviderBalanceSnapshot[];
}): PaymentsBalanceProof[] {
  const ledgerMap = new Map<string, number>();
  const cachedMap = new Map<string, PaymentsCachedBalanceSnapshot>();
  const providerMap = new Map<string, PaymentsProviderBalanceSnapshot>();
  const keyOrder = new Set<string>();

  for (const entry of input.ledgerEntries) {
    const key = balanceKey(entry);
    ledgerMap.set(key, (ledgerMap.get(key) ?? 0) + ledgerDelta(entry));
    keyOrder.add(key);
  }

  for (const balance of input.cachedBalances) {
    const key = balanceKey(balance);
    cachedMap.set(key, balance);
    keyOrder.add(key);
  }

  for (const balance of input.providerBalances ?? []) {
    const key = balanceKey(balance);
    providerMap.set(key, balance);
    keyOrder.add(key);
  }

  return Array.from(keyOrder)
    .map((key) => {
      const [walletId, balanceBucket, currency] = key.split(':');
      const ledgerNetCents = ledgerMap.get(key) ?? 0;
      const cached = cachedMap.get(key) ?? null;
      const provider = providerMap.get(key) ?? null;
      const cachedAmountCents = cached?.amountCents ?? null;
      const providerAmountCents = provider?.amountCents ?? null;
      const cachedDeltaCents =
        cachedAmountCents === null ? null : cachedAmountCents - ledgerNetCents;
      const providerDeltaCents =
        providerAmountCents === null ? null : providerAmountCents - ledgerNetCents;
      const cachedMatches =
        cachedAmountCents === null
          ? ledgerNetCents === 0
          : cachedAmountCents === ledgerNetCents;
      const providerMatches =
        providerAmountCents === null
          ? true
          : providerAmountCents === ledgerNetCents;

      return {
        walletId: walletId ?? '',
        balanceBucket: (balanceBucket ?? 'available') as PaymentsBalanceProof['balanceBucket'],
        currency: (currency ?? 'USD') as PaymentsBalanceProof['currency'],
        providerName: provider?.providerName ?? null,
        ledgerNetCents,
        cachedAmountCents,
        providerAmountCents,
        cachedDeltaCents,
        providerDeltaCents,
        ok: cachedMatches && providerMatches,
      };
    })
    .sort((left, right) => left.walletId.localeCompare(right.walletId));
}

export async function runPaymentsReconciliationJob(
  input: PaymentsReconciliationInput,
): Promise<PaymentsReconciliationReport> {
  const now = input.now ?? (() => new Date());
  const createId = input.createId ?? defaultCreateId;
  const checkedAt = now().toISOString();
  const runId = createId('pay_reconcile');
  const pendingAgeMs = input.thresholds?.pendingAgeMs ?? DEFAULT_PENDING_AGE_MS;
  const remittanceAgeMs =
    input.thresholds?.remittanceAgeMs ?? DEFAULT_REMITTANCE_AGE_MS;

  if (input.auditLogger) {
    await input.auditLogger.log({
      level: 'info',
      action: 'reconciliation.started',
      subjectType: 'reconciliation',
      message: `Started reconciliation run ${runId}.`,
      metadata: {
        environment: input.environment,
        providerProfile: input.providerProfile,
        bundleKind: input.bundleKind,
      },
    });
  }

  const localByKey = new Map<string, PaymentsLocalTransferSnapshot>();
  const remoteByKey = new Map<string, PaymentsRemoteTransferSnapshot>();

  for (const transfer of input.localTransfers) {
    for (const key of localTransferKeys(transfer)) {
      if (!localByKey.has(key)) {
        localByKey.set(key, transfer);
      }
    }
  }

  for (const transfer of input.remoteTransfers) {
    for (const key of remoteTransferKeys(transfer)) {
      if (!remoteByKey.has(key)) {
        remoteByKey.set(key, transfer);
      }
    }
  }

  const balanceProofs = buildPaymentsBalanceProofs({
    ledgerEntries: input.ledgerEntries,
    cachedBalances: input.cachedBalances,
    providerBalances: input.providerBalances,
  });

  const breaksById = new Map<string, PaymentsBreakRecord>();
  let matchedTransfers = 0;
  let statusMismatches = 0;
  let missingLocalTransfers = 0;
  let missingRemoteTransfers = 0;
  let duplicateCallbacks = 0;
  let stuckPendingTransfers = 0;
  let staleRemittanceDeliveries = 0;

  for (const proof of balanceProofs) {
    if (!proof.ok) {
      const breakRecord = await recordBreak({
        payload: {
          type: proof.providerAmountCents !== null ? 'balance_mismatch' : 'balance_proof_failed',
          severity: 'high',
          summary: `Balance proof failed for wallet ${proof.walletId} ${proof.balanceBucket} ${proof.currency}.`,
          walletId: proof.walletId,
          metadata: {
            ledgerNetCents: proof.ledgerNetCents,
            cachedAmountCents: proof.cachedAmountCents,
            providerAmountCents: proof.providerAmountCents,
          },
        },
        nowIso: checkedAt,
        createId,
        breakQueue: input.breakQueue,
        auditLogger: input.auditLogger,
      });
      breaksById.set(breakRecord.id, breakRecord);
    }
  }

  for (const transfer of input.localTransfers) {
    const remoteTransfer =
      localTransferKeys(transfer)
        .map((key) => remoteByKey.get(key) ?? null)
        .find((value) => value !== null) ?? null;

    if (remoteTransfer) {
      matchedTransfers += 1;
      if (
        normalizeTransferState(transfer.status) !==
        normalizeTransferState(remoteTransfer.status)
      ) {
        statusMismatches += 1;
        const breakRecord = await recordBreak({
          payload: {
            type: 'status_mismatch',
            severity: 'high',
            summary: `Transfer ${transfer.transferId} status drifted between ledger and provider.`,
            transferId: transfer.transferId,
            providerName: remoteTransfer.providerName,
            metadata: {
              localStatus: transfer.status,
              remoteStatus: remoteTransfer.status,
              providerTransferId: remoteTransfer.providerTransferId,
            },
          },
          nowIso: checkedAt,
          createId,
          breakQueue: input.breakQueue,
          auditLogger: input.auditLogger,
        });
        breaksById.set(breakRecord.id, breakRecord);
      }
    } else if (localTransferRequiresProviderMatch(transfer)) {
      missingRemoteTransfers += 1;
      const breakRecord = await recordBreak({
        payload: {
          type: 'missing_remote_transfer',
          severity:
            normalizeTransferState(transfer.status) === 'completed' ? 'high' : 'medium',
          summary: `Transfer ${transfer.transferId} is missing from provider reconciliation data.`,
          transferId: transfer.transferId,
          providerName: transfer.providerName,
          remittanceId: transfer.remittanceId,
          metadata: {
            providerTransferId: transfer.providerTransferId,
            status: transfer.status,
          },
        },
        nowIso: checkedAt,
        createId,
        breakQueue: input.breakQueue,
        auditLogger: input.auditLogger,
      });
      breaksById.set(breakRecord.id, breakRecord);
    }

    const ageMs = now().getTime() - new Date(transfer.updatedAt).getTime();
    const normalizedState = normalizeTransferState(transfer.status);

    if (normalizedState === 'pending') {
      const isRemittance =
        transfer.kind === 'remittance_send' || transfer.kind === 'remittance_refund';

      if (isRemittance && ageMs > remittanceAgeMs) {
        staleRemittanceDeliveries += 1;
        const breakRecord = await recordBreak({
          payload: {
            type: 'stale_remittance_delivery',
            severity: 'high',
            summary: `Remittance ${transfer.remittanceId ?? transfer.transferId} is stale.`,
            transferId: transfer.transferId,
            providerName: transfer.providerName,
            remittanceId: transfer.remittanceId,
            metadata: {
              ageMs,
              thresholdMs: remittanceAgeMs,
              status: transfer.status,
            },
          },
          nowIso: checkedAt,
          createId,
          breakQueue: input.breakQueue,
          auditLogger: input.auditLogger,
        });
        breaksById.set(breakRecord.id, breakRecord);
      } else if (!isRemittance && ageMs > pendingAgeMs) {
        stuckPendingTransfers += 1;
        const breakRecord = await recordBreak({
          payload: {
            type: 'stuck_pending_transfer',
            severity: 'medium',
            summary: `Transfer ${transfer.transferId} has been pending past the allowed window.`,
            transferId: transfer.transferId,
            providerName: transfer.providerName,
            metadata: {
              ageMs,
              thresholdMs: pendingAgeMs,
              status: transfer.status,
            },
          },
          nowIso: checkedAt,
          createId,
          breakQueue: input.breakQueue,
          auditLogger: input.auditLogger,
        });
        breaksById.set(breakRecord.id, breakRecord);
      }
    }
  }

  for (const transfer of input.remoteTransfers) {
    const localTransfer =
      remoteTransferKeys(transfer)
        .map((key) => localByKey.get(key) ?? null)
        .find((value) => value !== null) ?? null;

    if (!localTransfer) {
      missingLocalTransfers += 1;
      const breakRecord = await recordBreak({
        payload: {
          type: 'missing_local_transfer',
          severity: 'high',
          summary: `Provider transfer ${transfer.providerTransferId} is missing from the local ledger.`,
          providerName: transfer.providerName,
          remittanceId: transfer.remittanceId ?? null,
          metadata: {
            providerTransferId: transfer.providerTransferId,
            transferId: transfer.transferId ?? null,
            status: transfer.status,
          },
        },
        nowIso: checkedAt,
        createId,
        breakQueue: input.breakQueue,
        auditLogger: input.auditLogger,
      });
      breaksById.set(breakRecord.id, breakRecord);
    }
  }

  const duplicateGroups = new Map<string, PaymentsProviderEventRecord[]>();
  for (const event of input.providerEvents ?? []) {
    const key = `${event.providerName}:${event.providerEventId}`;
    const group = duplicateGroups.get(key) ?? [];
    group.push(event);
    duplicateGroups.set(key, group);
  }

  for (const group of duplicateGroups.values()) {
    const first = group[0];
    if (!first) {
      continue;
    }

    const duplicateCount =
      group.length - 1 + group.reduce((sum, event) => sum + event.dedupedCount, 0);
    if (duplicateCount <= 0) {
      continue;
    }

    duplicateCallbacks += 1;
    const breakRecord = await recordBreak({
      payload: {
        type: 'duplicate_callback',
        severity: 'low',
        summary: `Duplicate callback suppressed for ${first.providerName}:${first.providerEventId}.`,
        transferId: first.transferId,
        providerName: first.providerName,
        providerEventId: first.providerEventId,
        remittanceId: first.remittanceId,
        metadata: {
          duplicateCount,
        },
      },
      nowIso: checkedAt,
      createId,
      breakQueue: input.breakQueue,
      auditLogger: input.auditLogger,
    });
    breaksById.set(breakRecord.id, breakRecord);
  }

  const breaks = Array.from(breaksById.values()).sort((left, right) => {
    const timeDiff =
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return left.id.localeCompare(right.id);
  });
  const openBreaks = breaks.filter((entry) => entry.status !== 'resolved');
  const criticalBreaks = openBreaks.filter(
    (entry) => entry.severity === 'critical' || entry.severity === 'high',
  );
  const failedBalanceProofs = balanceProofs.filter((proof) => !proof.ok).length;
  const sandboxReady =
    input.environment === 'sandbox' &&
    input.bundleKind === 'sandbox' &&
    breaks.length >= 0;
  const launchBlocked =
    !sandboxReady || criticalBreaks.length > 0 || failedBalanceProofs > 0;

  const operatorLines = [
    `Reconciliation run ${runId} checked ${input.localTransfers.length} local transfer${input.localTransfers.length === 1 ? '' : 's'} and ${input.remoteTransfers.length} remote transfer${input.remoteTransfers.length === 1 ? '' : 's'}.`,
    `Balance proofs: ${balanceProofs.length - failedBalanceProofs}/${balanceProofs.length} passed.`,
    `Breaks: ${openBreaks.length} open, ${criticalBreaks.length} launch-blocking, ${duplicateCallbacks} duplicate callback group${duplicateCallbacks === 1 ? '' : 's'}.`,
    launchBlocked
      ? 'Launch blocked until the reported breaks are resolved and the sandbox report is clean.'
      : 'Launch checks passed for this sandbox reconciliation run.',
  ];

  if (input.auditLogger) {
    await input.auditLogger.log({
      level: launchBlocked ? 'warning' : 'info',
      action: 'reconciliation.completed',
      subjectType: 'reconciliation',
      message: `Completed reconciliation run ${runId}.`,
      metadata: {
        launchBlocked,
        openBreaks: openBreaks.length,
        failedBalanceProofs,
      },
    });
  }

  return {
    runId,
    checkedAt,
    environment: input.environment,
    providerProfile: input.providerProfile,
    bundleKind: input.bundleKind,
    sandboxReady,
    launchBlocked,
    summary: {
      localTransfers: input.localTransfers.length,
      remoteTransfers: input.remoteTransfers.length,
      matchedTransfers,
      balanceProofs: balanceProofs.length,
      failedBalanceProofs,
      openBreaks: openBreaks.length,
      criticalBreaks: criticalBreaks.length,
    },
    checks: {
      statusMismatches,
      missingLocalTransfers,
      missingRemoteTransfers,
      duplicateCallbacks,
      stuckPendingTransfers,
      staleRemittanceDeliveries,
    },
    balanceProofs,
    breaks,
    operatorLines,
  };
}

import {
  assertWalletCanReceive,
  assertWalletCanSend,
  resolveTransferBalanceBuckets,
  type PaymentsTransferFlow,
} from './availability';
import {
  assertPaymentsInvariant,
  createPaymentsDomainError,
} from './errors';
import { calculatePaymentsFee } from './fees';
import {
  canTransitionTransferStatus,
  resolveTransferEventType,
  transitionTransferStatus,
} from './fsm';
import {
  createMemoryPaymentsIdempotencyStore,
  createStableFingerprint,
  type PaymentsIdempotencyStore,
} from './idempotency';
import {
  buildPaymentsLedgerPlan,
  buildPaymentsReversalPlan,
} from './ledger';
import type {
  PaymentsCommand,
  PaymentsCommandResult,
  PaymentsExecutionContext,
  PaymentsFeeQuote,
  PaymentsFundCommand,
  PaymentsPostedTransfer,
  PaymentsRequestCommand,
  PaymentsRequestCommandResult,
  PaymentsReverseTransferCommand,
  PaymentsSendCommand,
  PaymentsTransferCommandResult,
  PaymentsTransferRecord,
  PaymentsPostableTransferStatus,
  PaymentsTransferStatusCommandResult,
  PaymentsTransferStatus,
  PaymentsWithdrawCommand,
} from './types';
import type { PaymentsFeeCalculationInput } from './fees';
import type {
  PaymentsRiskAssessment,
  PaymentsRiskGuard,
} from '../risk/types';

export interface PaymentsDomainEngineOptions {
  idempotencyStore?: PaymentsIdempotencyStore<PaymentsCommandResult>;
  now?: () => Date;
  createId?: (prefix: string) => string;
  riskGuard?: PaymentsRiskGuard;
}

export interface PaymentsDomainEngine {
  execute(
    command: PaymentsCommand,
    context: PaymentsExecutionContext,
  ): PaymentsCommandResult;
  quoteFee(input: PaymentsFeeCalculationInput): PaymentsFeeQuote;
}

type PaymentsResolvedDomainEngineOptions = {
  idempotencyStore: PaymentsIdempotencyStore<PaymentsCommandResult>;
  now: () => Date;
  createId: (prefix: string) => string;
  riskGuard?: PaymentsRiskGuard;
};

function defaultCreateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneReplay<TResult extends PaymentsCommandResult>(
  result: TResult,
): TResult {
  return {
    ...result,
    replayed: true,
  };
}

function getWallet(
  context: PaymentsExecutionContext,
  walletId: string,
  role: 'source' | 'destination' | 'requester' | 'payer' | 'settlement',
) {
  const wallet = context.wallets[walletId];
  assertPaymentsInvariant(
    wallet,
    'wallet_unavailable',
    `${role} wallet not found`,
    { walletId, role },
  );
  return wallet;
}

function assertIdempotencyKey(idempotencyKey: string): void {
  assertPaymentsInvariant(
    typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0,
    'invalid_command',
    'idempotencyKey is required',
  );
}

function assertCurrency(currency: string): void {
  assertPaymentsInvariant(
    /^[A-Z]{3}$/.test(currency),
    'invalid_command',
    'currency must be a 3-letter ISO code',
    { currency },
  );
}

function assertTransferWindow(command: {
  quoteExpiresAt?: string | null;
  providerDeadlineAt?: string | null;
}, now: Date): void {
  if (command.quoteExpiresAt && new Date(command.quoteExpiresAt).getTime() < now.getTime()) {
    throw createPaymentsDomainError(
      'stale_quote',
      'Quote expired before command execution',
      { quoteExpiresAt: command.quoteExpiresAt },
    );
  }

  if (
    command.providerDeadlineAt &&
    new Date(command.providerDeadlineAt).getTime() < now.getTime()
  ) {
    throw createPaymentsDomainError(
      'provider_timeout',
      'Provider deadline expired before command execution',
      { providerDeadlineAt: command.providerDeadlineAt },
    );
  }
}

function resolveTransferDefaults(
  command: PaymentsSendCommand | PaymentsFundCommand | PaymentsWithdrawCommand,
): {
  flow: PaymentsTransferFlow;
  kind: PaymentsFeeCalculationInput['kind'];
  sourceWalletId: string;
  destinationWalletId: string;
  sourceRail: NonNullable<PaymentsFeeCalculationInput['sourceRail']>;
  destinationRail: NonNullable<PaymentsFeeCalculationInput['destinationRail']>;
  status: PaymentsPostableTransferStatus;
} {
  switch (command.type) {
    case 'send':
      return {
        flow: 'internal',
        kind: 'p2p',
        sourceWalletId: command.sourceWalletId,
        destinationWalletId: command.destinationWalletId,
        sourceRail: command.sourceRail ?? 'wallet',
        destinationRail: command.destinationRail ?? 'wallet',
        status: command.desiredStatus ?? 'completed',
      };
    case 'fund':
      return {
        flow: 'fund',
        kind: 'fund_wallet',
        sourceWalletId: command.settlementWalletId,
        destinationWalletId: command.destinationWalletId,
        sourceRail: command.sourceRail ?? 'bank',
        destinationRail: command.destinationRail ?? 'wallet',
        status: command.desiredStatus ?? 'pending_provider',
      };
    case 'withdraw':
      return {
        flow: 'withdraw',
        kind: 'withdraw_wallet',
        sourceWalletId: command.sourceWalletId,
        destinationWalletId: command.settlementWalletId,
        sourceRail: command.sourceRail ?? 'wallet',
        destinationRail: command.destinationRail ?? 'bank',
        status: command.desiredStatus ?? 'pending_provider',
      };
  }
}

function executeTransferCommand(
  command: PaymentsSendCommand | PaymentsFundCommand | PaymentsWithdrawCommand,
  context: PaymentsExecutionContext,
  options: PaymentsResolvedDomainEngineOptions,
): PaymentsTransferCommandResult {
  assertIdempotencyKey(command.idempotencyKey);
  assertPaymentsInvariant(
    Number.isInteger(command.amountCents) && command.amountCents > 0,
    'invalid_command',
    'amountCents must be a positive integer',
    { amountCents: command.amountCents },
  );
  assertCurrency(command.currency);
  assertTransferWindow(command, options.now());

  const resolved = resolveTransferDefaults(command);
  const sourceWallet = getWallet(context, resolved.sourceWalletId, 'source');
  const destinationRole = command.type === 'fund' ? 'destination' : command.type === 'withdraw' ? 'settlement' : 'destination';
  const destinationWallet = getWallet(
    context,
    resolved.destinationWalletId,
    destinationRole,
  );
  const feeQuote = calculatePaymentsFee({
    kind: resolved.kind,
    amountCents: command.amountCents,
    sourceRail: resolved.sourceRail,
    destinationRail: resolved.destinationRail,
    speed: command.speed,
    feeProfile: command.feeProfile,
  });
  const transferId = options.createId('pay_transfer');
  const riskAssessment = options.riskGuard
    ? options.riskGuard({
        transferId,
        command,
        requestedStatus: resolved.status,
        sourceWallet,
        destinationWallet,
        feeQuote,
        now: options.now(),
      })
    : null;
  const finalStatus = (
    riskAssessment?.recommendedTransferStatus ?? resolved.status
  ) as Extract<
    PaymentsTransferStatus,
    'pending_review' | 'pending_provider' | 'processing' | 'completed'
  >;

  if (riskAssessment?.outcome === 'reject') {
    throw createPaymentsDomainError(
      riskAssessment.domainErrorCode ?? 'compliance_hold',
      riskAssessment.userSafeExplanation ??
        'This payment cannot proceed because it is blocked by a risk control.',
      {
        paymentType: riskAssessment.paymentType,
        machineReasonCodes: riskAssessment.metadata.machineReasonCodes,
        caseReferences: riskAssessment.caseReferences,
        userSafeExplanation: riskAssessment.userSafeExplanation,
      },
    );
  }

  const postingStatus = riskAssessment?.outcome === 'hold'
    ? resolved.status
    : finalStatus;
  const bucketPlan = resolveTransferBalanceBuckets({
    flow: resolved.flow as PaymentsTransferFlow,
    status: postingStatus as Extract<
      PaymentsTransferStatus,
      'pending_review' | 'pending_provider' | 'processing' | 'completed'
    >,
  });

  assertWalletCanSend({
    wallet: sourceWallet,
    amountCents: command.amountCents,
    feeCents: command.type === 'fund' ? 0 : feeQuote.feeCents,
    balanceBucket: bucketPlan.sourceBalanceBucket,
  });
  assertWalletCanReceive({
    wallet: destinationWallet,
    amountCents: command.amountCents,
  });
  if (command.type === 'fund' && feeQuote.feeCents > 0) {
    assertWalletCanSend({
      wallet: destinationWallet,
      amountCents: 0,
      feeCents: feeQuote.feeCents,
      balanceBucket: 'available',
    });
  }

  const ledgerPlan =
    riskAssessment?.outcome === 'hold'
      ? {
          postingGroupId: options.createId('pay_posting_group'),
          entries: [],
          perCurrencyNet: {},
          balanced: true,
        }
      : buildPaymentsLedgerPlan({
          transferId,
          sourceWalletId: resolved.sourceWalletId,
          destinationWalletId: resolved.destinationWalletId,
          sourceAmountCents: command.amountCents,
          sourceCurrency: command.currency,
          sourceBalanceBucket: bucketPlan.sourceBalanceBucket,
          destinationBalanceBucket: bucketPlan.destinationBalanceBucket,
          feeAmountCents: feeQuote.feeCents,
          feeWalletId: command.feeWalletId ?? null,
          feePayerWalletId:
            command.type === 'fund' ? resolved.destinationWalletId : resolved.sourceWalletId,
          memo: command.memo,
          metadata: command.metadata,
          createId: options.createId,
        });
  const transfer: PaymentsPostedTransfer = {
    transferId,
    idempotencyKey: command.idempotencyKey,
    kind: resolved.kind,
    status: finalStatus,
    sourceWalletId: resolved.sourceWalletId,
    destinationWalletId: resolved.destinationWalletId,
    sourceBalanceBucket: bucketPlan.sourceBalanceBucket,
    destinationBalanceBucket: bucketPlan.destinationBalanceBucket,
    sourceAmountCents: command.amountCents,
    sourceCurrency: command.currency,
    destinationAmountCents: command.amountCents,
    destinationCurrency: command.currency,
    feeAmountCents: feeQuote.feeCents,
    feeWalletId: command.feeWalletId ?? null,
    sourceRail: resolved.sourceRail,
    destinationRail: resolved.destinationRail,
    memo: command.memo,
    externalReference: command.externalReference,
    metadata: {
      ...(command.metadata ?? {}),
      ...(riskAssessment
        ? {
            risk: {
              ...riskAssessment.metadata,
              requestedStatus: resolved.status,
              reviewQueueItem: riskAssessment.reviewQueueItem,
            },
          }
        : {}),
    },
    ledgerPlan,
  };

  return {
    kind: 'transfer',
    replayed: false,
    eventType: resolveTransferEventType(null, finalStatus),
    transfer,
    feeQuote,
    ledgerPlan,
  };
}

function executeRequestCommand(
  command: PaymentsRequestCommand,
  context: PaymentsExecutionContext,
  options: PaymentsResolvedDomainEngineOptions,
): PaymentsRequestCommandResult {
  assertIdempotencyKey(command.idempotencyKey);
  assertPaymentsInvariant(
    Number.isInteger(command.amountCents) && command.amountCents > 0,
    'invalid_command',
    'amountCents must be a positive integer',
    { amountCents: command.amountCents },
  );
  assertCurrency(command.currency);
  getWallet(context, command.requesterWalletId, 'requester');
  if (command.payerWalletId) {
    getWallet(context, command.payerWalletId, 'payer');
  }

  return {
    kind: 'request',
    replayed: false,
    request: {
      requestId: command.requestId ?? options.createId('pay_request'),
      idempotencyKey: command.idempotencyKey,
      status: 'open',
      requesterWalletId: command.requesterWalletId,
      payerWalletId: command.payerWalletId ?? null,
      amountCents: command.amountCents,
      currency: command.currency,
      expiresAt: command.expiresAt ?? null,
      memo: command.memo,
      metadata: command.metadata ?? {},
    },
  };
}

function executeReverseCommand(
  command: PaymentsReverseTransferCommand,
  options: PaymentsResolvedDomainEngineOptions,
): PaymentsTransferCommandResult {
  assertIdempotencyKey(command.idempotencyKey);
  assertPaymentsInvariant(
    canTransitionTransferStatus(command.transfer.status, 'reversed'),
    'invalid_transition',
    `Transfer ${command.transfer.transferId} cannot be reversed from ${command.transfer.status}`,
    {
      transferId: command.transfer.transferId,
      status: command.transfer.status,
    },
  );

  const reversalPlan = buildPaymentsReversalPlan({
    originalPlan: command.transfer.ledgerPlan,
    originalTransferId: command.transfer.transferId,
    memo: command.reason ?? 'Transfer reversal',
    metadata: command.metadata,
    createId: options.createId,
  });
  const transition = transitionTransferStatus(
    command.transfer.status,
    'reversed',
  );
  const transferId = options.createId('pay_transfer');
  const transfer: PaymentsPostedTransfer = {
    transferId,
    idempotencyKey: command.idempotencyKey,
    kind: 'reversal',
    status: 'completed',
    sourceWalletId: command.transfer.destinationWalletId,
    destinationWalletId: command.transfer.sourceWalletId,
    sourceBalanceBucket: command.transfer.destinationBalanceBucket,
    destinationBalanceBucket: command.transfer.sourceBalanceBucket,
    sourceAmountCents:
      command.transfer.destinationAmountCents ?? command.transfer.sourceAmountCents,
    sourceCurrency:
      command.transfer.destinationCurrency ?? command.transfer.sourceCurrency,
    destinationAmountCents: command.transfer.sourceAmountCents,
    destinationCurrency: command.transfer.sourceCurrency,
    feeAmountCents: 0,
    feeWalletId: null,
    sourceRail: command.transfer.destinationRail,
    destinationRail: command.transfer.sourceRail,
    memo: command.reason ?? 'Transfer reversal',
    externalReference: command.transfer.transferId,
    metadata: {
      ...command.transfer.metadata,
      ...(command.metadata ?? {}),
      reversalOfTransferId: command.transfer.transferId,
    },
    ledgerPlan: reversalPlan,
  };

  return {
    kind: 'transfer',
    replayed: false,
    eventType: transition.eventType,
    transfer,
    feeQuote: {
      profile: 'p2p',
      rateBasisPoints: 0,
      fixedFeeCents: 0,
      minimumFeeCents: 0,
      maximumFeeCents: 0,
      feeCents: 0,
      totalDebitCents:
        command.transfer.destinationAmountCents ?? command.transfer.sourceAmountCents,
      destinationAmountCents: command.transfer.sourceAmountCents,
      adjusted: false,
    },
    ledgerPlan: reversalPlan,
  };
}

function executeDisputeOpenCommand(
  command: Extract<PaymentsCommand, { type: 'dispute_open' }>,
): PaymentsTransferStatusCommandResult {
  assertIdempotencyKey(command.idempotencyKey);
  const transition = transitionTransferStatus(command.transfer.status, 'disputed');

  return {
    kind: 'transfer_status',
    replayed: false,
    eventType: transition.eventType,
    transfer: {
      ...command.transfer,
      status: 'disputed',
      metadata: {
        ...command.transfer.metadata,
        ...(command.metadata ?? {}),
        disputeReason: command.reason,
      },
    },
    note: command.reason,
  };
}

function executeDisputeCloseCommand(
  command: Extract<PaymentsCommand, { type: 'dispute_close' }>,
): PaymentsTransferStatusCommandResult {
  assertIdempotencyKey(command.idempotencyKey);
  const targetStatus: PaymentsTransferStatus =
    command.resolution === 'reversed' ? 'reversed' : 'completed';
  const transition = transitionTransferStatus(command.transfer.status, targetStatus);

  return {
    kind: 'transfer_status',
    replayed: false,
    eventType: transition.eventType,
    transfer: {
      ...command.transfer,
      status: targetStatus,
      metadata: {
        ...command.transfer.metadata,
        ...(command.metadata ?? {}),
        disputeResolution: command.resolution,
      },
    },
    note: command.reason,
  };
}

export function createPaymentsDomainEngine(
  options: PaymentsDomainEngineOptions = {},
): PaymentsDomainEngine {
  const runtimeOptions: PaymentsResolvedDomainEngineOptions = {
    idempotencyStore:
      options.idempotencyStore ??
      createMemoryPaymentsIdempotencyStore<PaymentsCommandResult>(),
    now: options.now ?? (() => new Date()),
    createId: options.createId ?? defaultCreateId,
    riskGuard: options.riskGuard,
  };

  return {
    execute(command, context) {
      assertIdempotencyKey(command.idempotencyKey);
      const fingerprint = createStableFingerprint(command);
      const existing = runtimeOptions.idempotencyStore.get(command.idempotencyKey);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw createPaymentsDomainError(
            'idempotency_conflict',
            `Command replay for ${command.idempotencyKey} did not match the original payload`,
            {
              idempotencyKey: command.idempotencyKey,
            },
          );
        }

        return cloneReplay(existing.result);
      }

      let result: PaymentsCommandResult;
      switch (command.type) {
        case 'send':
        case 'fund':
        case 'withdraw':
          result = executeTransferCommand(command, context, runtimeOptions);
          break;
        case 'request':
          result = executeRequestCommand(command, context, runtimeOptions);
          break;
        case 'reverse':
          result = executeReverseCommand(command, runtimeOptions);
          break;
        case 'dispute_open':
          result = executeDisputeOpenCommand(command);
          break;
        case 'dispute_close':
          result = executeDisputeCloseCommand(command);
          break;
      }

      runtimeOptions.idempotencyStore.set({
        idempotencyKey: command.idempotencyKey,
        fingerprint,
        result,
      });

      return result;
    },

    quoteFee(input) {
      return calculatePaymentsFee(input);
    },
  };
}

export function executePaymentsCommand(
  command: PaymentsCommand,
  context: PaymentsExecutionContext,
  options?: PaymentsDomainEngineOptions,
): PaymentsCommandResult {
  return createPaymentsDomainEngine(options).execute(command, context);
}

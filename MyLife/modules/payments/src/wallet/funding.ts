import {
  createPaymentsDisclosureCallout,
  formatPaymentsAbsoluteDateTime,
  formatPaymentsMoney,
} from '../compliance/disclosures/content';
import {
  buildPaymentsLegalCopyBlocks,
} from '../compliance/disclosures/legal';
import type {
  PaymentsLegalCopyBlock,
} from '../compliance/disclosures/types';
import {
  createStableFingerprint,
} from '../engine/idempotency';
import type {
  PaymentsFundCommand,
  PaymentsTransferSpeed,
  PaymentsWalletSnapshot,
  PaymentsWithdrawCommand,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentDisclosure,
  PaymentTimelineStep,
  PaymentVerificationState,
} from '../types';
import {
  parsePaymentsSendAmount,
} from './send';
import type {
  PaymentsSendParsedAmount,
} from './send';

export type PaymentsMoneyMovementFlow = 'add_money' | 'withdraw';

export type PaymentsFundingIntentStatus =
  | 'initiated'
  | 'pending'
  | 'settled'
  | 'failed'
  | 'returned';

export type PaymentsLinkedExternalAccountAction = 'remove' | 'relink';

export interface PaymentsFundingLinkedAccount {
  id: string;
  institutionName: string;
  displayName: string;
  last4: string;
  verificationState: PaymentVerificationState | 'failed';
  supportsInstantFunding: boolean;
  supportsInstantPayout: boolean;
  removable: boolean;
  relinkRequired?: boolean;
}

export interface PaymentsFundingIntentRecord {
  intentId: string;
  flow: PaymentsMoneyMovementFlow;
  status: PaymentsFundingIntentStatus;
  linkedAccountId: string;
  amountCents: number;
  currency: CurrencyCode;
  speed: PaymentsTransferSpeed;
  feeCents: number;
  initiatedAt: string;
  updatedAt: string;
  settledAt?: string | null;
  failedReason?: string | null;
  returnedReason?: string | null;
  providerReference?: string | null;
}

export interface PaymentsFundingDraft {
  flow: PaymentsMoneyMovementFlow;
  selectedLinkedAccountId?: string | null;
  amountText?: string;
  speed?: PaymentsTransferSpeed;
  clientSubmissionId: string;
}

export interface PaymentsFundingFlowSnapshot {
  wallet: PaymentsWalletSnapshot | null;
  linkedAccounts: PaymentsFundingLinkedAccount[];
  intents: PaymentsFundingIntentRecord[];
  draft: PaymentsFundingDraft;
  serverNow: string;
  locale?: string;
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsFundingAction {
  id: PaymentsLinkedExternalAccountAction;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface PaymentsFundingIntentState {
  intentId: string;
  title: string;
  status: PaymentsFundingIntentStatus;
  statusLabel: string;
  amountLabel: string;
  speedLabel: string;
  timeline: PaymentTimelineStep[];
  disclosure: PaymentDisclosure;
}

export interface PaymentsFundingCommandPreview {
  idempotencyKey: string;
  fingerprint: string;
  command: PaymentsFundCommand | PaymentsWithdrawCommand;
}

export interface PaymentsFundingFlowViewModel {
  title: 'Add money' | 'Withdraw';
  flow: PaymentsMoneyMovementFlow;
  linkedAccounts: Array<PaymentsFundingLinkedAccount & {
    label: string;
    actions: PaymentsFundingAction[];
  }>;
  selectedAccount: PaymentsFundingLinkedAccount | null;
  amount: PaymentsSendParsedAmount;
  speed: {
    selected: PaymentsTransferSpeed;
    options: Array<{
      id: PaymentsTransferSpeed;
      label: string;
      enabled: boolean;
      feeLabel: string;
      etaLabel: string;
    }>;
  };
  previewLines: Array<{
    id: string;
    label: string;
    value: string;
    emphasis: 'neutral' | 'warning' | 'positive' | 'danger';
  }>;
  pendingNotice: PaymentDisclosure;
  blockReason: PaymentDisclosure | null;
  commandPreview: PaymentsFundingCommandPreview | null;
  canSubmit: boolean;
  recentIntents: PaymentsFundingIntentState[];
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

function balanceCents(
  wallet: PaymentsWalletSnapshot | null,
  bucket: 'available' | 'pending' | 'reserved' | 'escrow',
): number {
  return wallet?.balances[bucket] ?? 0;
}

function speedLabel(speed: PaymentsTransferSpeed): string {
  return speed === 'instant' ? 'Instant' : 'Standard';
}

function intentStatusLabel(status: PaymentsFundingIntentStatus): string {
  switch (status) {
    case 'initiated':
      return 'Initiated';
    case 'pending':
      return 'Pending';
    case 'settled':
      return 'Settled';
    case 'failed':
      return 'Failed';
    case 'returned':
      return 'Returned';
  }
}

function calculateFeeCents(
  flow: PaymentsMoneyMovementFlow,
  speed: PaymentsTransferSpeed,
  amountCents: number,
): number {
  if (speed === 'standard') {
    return 0;
  }
  if (flow === 'add_money') {
    return Math.max(25, Math.round(amountCents * 0.005));
  }
  return Math.max(50, Math.round(amountCents * 0.01));
}

function etaLabel(speed: PaymentsTransferSpeed): string {
  return speed === 'instant' ? 'Usually minutes' : '1 to 3 business days';
}

function accountActionState(account: PaymentsFundingLinkedAccount): PaymentsFundingAction[] {
  return [
    {
      id: 'relink',
      label: 'Relink',
      enabled: account.relinkRequired === true || account.verificationState === 'failed',
      reason:
        account.relinkRequired === true || account.verificationState === 'failed'
          ? null
          : 'Relink is only needed when provider verification expires.',
    },
    {
      id: 'remove',
      label: 'Remove',
      enabled: account.removable,
      reason: account.removable ? null : 'Primary settlement account cannot be removed yet.',
    },
  ];
}

function buildPendingNotice(flow: PaymentsMoneyMovementFlow): PaymentDisclosure {
  return createPaymentsDisclosureCallout({
    id: flow === 'add_money' ? 'funding_pending_notice' : 'payout_pending_notice',
    tone: 'info',
    title: flow === 'add_money' ? 'Pending is not spendable' : 'Withdrawal timing',
    body:
      flow === 'add_money'
        ? 'Added money becomes spendable only after the funding intent settles into available balance.'
        : 'Withdrawals reduce available balance when initiated and remain pending until provider settlement finishes.',
  });
}

function buildBlockReason(input: {
  snapshot: PaymentsFundingFlowSnapshot;
  amount: PaymentsSendParsedAmount;
  selectedAccount: PaymentsFundingLinkedAccount | null;
  speed: PaymentsTransferSpeed;
  feeCents: number;
}): PaymentDisclosure | null {
  if (!input.snapshot.wallet) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_no_wallet',
      tone: 'danger',
      title: 'Wallet unavailable',
      body: 'Create or restore a wallet before linking accounts or moving money.',
    });
  }
  if (input.snapshot.wallet.status !== 'active') {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_wallet_status',
      tone: 'warning',
      title: 'Wallet restricted',
      body: 'Funding and payout actions are paused until the wallet is active.',
    });
  }
  if (!input.selectedAccount) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_account',
      tone: 'warning',
      title: 'Link an account',
      body: 'Choose a verified bank account before creating a funding or payout intent.',
    });
  }
  if (input.selectedAccount.verificationState !== 'verified') {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_account_verification',
      tone: 'warning',
      title: 'Account verification needed',
      body: 'Relink or verify this account before using it for money movement.',
    });
  }
  if (!input.amount.valid) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_amount',
      tone: 'warning',
      title: 'Enter an amount',
      body: input.amount.error ?? 'Enter a positive amount before previewing the intent.',
    });
  }
  if (
    input.snapshot.draft.flow === 'withdraw' &&
    input.amount.amountCents + input.feeCents > balanceCents(input.snapshot.wallet, 'available')
  ) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_available_balance',
      tone: 'danger',
      title: 'Insufficient available balance',
      body: 'Withdrawals can use only available balance. Pending funds are not spendable.',
    });
  }
  if (
    input.speed === 'instant' &&
    input.snapshot.draft.flow === 'add_money' &&
    !input.selectedAccount.supportsInstantFunding
  ) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_instant_add',
      tone: 'warning',
      title: 'Instant add unavailable',
      body: 'This account supports standard funding only.',
    });
  }
  if (
    input.speed === 'instant' &&
    input.snapshot.draft.flow === 'withdraw' &&
    !input.selectedAccount.supportsInstantPayout
  ) {
    return createPaymentsDisclosureCallout({
      id: 'funding_block_instant_withdraw',
      tone: 'warning',
      title: 'Instant withdrawal unavailable',
      body: 'This account supports standard payout only.',
    });
  }
  return null;
}

function buildCommandPreview(input: {
  snapshot: PaymentsFundingFlowSnapshot;
  amount: PaymentsSendParsedAmount;
  selectedAccount: PaymentsFundingLinkedAccount | null;
  speed: PaymentsTransferSpeed;
  feeCents: number;
  blocked: boolean;
}): PaymentsFundingCommandPreview | null {
  const wallet = input.snapshot.wallet;
  if (!wallet || !input.selectedAccount || input.blocked || !input.amount.valid) {
    return null;
  }

  const idempotencyBase = {
    flow: input.snapshot.draft.flow,
    clientSubmissionId: input.snapshot.draft.clientSubmissionId,
    walletId: wallet.walletId,
    linkedAccountId: input.selectedAccount.id,
    amountCents: input.amount.amountCents,
    currency: wallet.defaultCurrency,
    speed: input.speed,
  };
  const fingerprint = createStableFingerprint(idempotencyBase);
  const idempotencyKey = `pay_${input.snapshot.draft.flow}_${input.snapshot.draft.clientSubmissionId}_${fingerprint.length}`;

  if (input.snapshot.draft.flow === 'add_money') {
    const command: PaymentsFundCommand = {
      type: 'fund',
      idempotencyKey,
      settlementWalletId: input.selectedAccount.id,
      destinationWalletId: wallet.walletId,
      amountCents: input.amount.amountCents,
      currency: wallet.defaultCurrency,
      desiredStatus: 'pending_provider',
      speed: input.speed,
      sourceRail: 'bank',
      destinationRail: 'wallet',
      feeProfile: 'p2p',
      feeWalletId: input.feeCents > 0 ? wallet.walletId : null,
      metadata: {
        intentTable: 'pay_funding_intents',
        linkedAccountLast4: input.selectedAccount.last4,
      },
    };
    return { idempotencyKey, fingerprint, command };
  }

  const command: PaymentsWithdrawCommand = {
    type: 'withdraw',
    idempotencyKey,
    sourceWalletId: wallet.walletId,
    settlementWalletId: input.selectedAccount.id,
    amountCents: input.amount.amountCents,
    currency: wallet.defaultCurrency,
    desiredStatus: 'pending_provider',
    speed: input.speed,
    sourceRail: 'wallet',
    destinationRail: 'bank',
    feeProfile: input.speed === 'instant' ? 'instant_payout' : 'p2p',
    feeWalletId: input.feeCents > 0 ? wallet.walletId : null,
    metadata: {
      intentTable: 'pay_payout_intents',
      linkedAccountLast4: input.selectedAccount.last4,
    },
  };
  return { idempotencyKey, fingerprint, command };
}

function buildIntentTimeline(
  intent: PaymentsFundingIntentRecord,
  locale?: string,
): PaymentTimelineStep[] {
  const terminal =
    intent.status === 'settled' ||
    intent.status === 'failed' ||
    intent.status === 'returned';

  return [
    {
      id: 'initiated',
      title: 'Intent initiated',
      detail: intent.flow === 'add_money' ? 'Funding intent created.' : 'Payout intent created.',
      timestamp: formatPaymentsAbsoluteDateTime(intent.initiatedAt, locale),
      state: 'complete',
    },
    {
      id: 'provider',
      title: 'Provider processing',
      detail: intent.providerReference
        ? `Provider reference ${intent.providerReference}`
        : 'Waiting for provider state.',
      timestamp: formatPaymentsAbsoluteDateTime(intent.updatedAt, locale),
      state: terminal ? 'complete' : 'current',
    },
    {
      id: 'terminal',
      title:
        intent.status === 'settled'
          ? 'Settled'
          : intent.status === 'failed'
            ? 'Failed'
            : intent.status === 'returned'
              ? 'Returned'
              : 'Settlement pending',
      detail: intent.returnedReason ?? intent.failedReason ?? 'Final availability is set by provider settlement.',
      timestamp: intent.settledAt ? formatPaymentsAbsoluteDateTime(intent.settledAt, locale) : undefined,
      state:
        intent.status === 'failed' || intent.status === 'returned'
          ? 'blocked'
          : intent.status === 'settled'
            ? 'complete'
            : 'upcoming',
    },
  ];
}

function mapIntentState(
  intent: PaymentsFundingIntentRecord,
  locale?: string,
): PaymentsFundingIntentState {
  return {
    intentId: intent.intentId,
    title: intent.flow === 'add_money' ? 'Add money' : 'Withdraw',
    status: intent.status,
    statusLabel: intentStatusLabel(intent.status),
    amountLabel: formatPaymentsMoney(intent.amountCents, intent.currency, locale),
    speedLabel: speedLabel(intent.speed),
    timeline: buildIntentTimeline(intent, locale),
    disclosure: createPaymentsDisclosureCallout({
      id: `funding_intent_${intent.status}`,
      tone:
        intent.status === 'settled'
          ? 'success'
          : intent.status === 'failed' || intent.status === 'returned'
            ? 'danger'
            : 'info',
      title: intentStatusLabel(intent.status),
      body:
        intent.status === 'settled'
          ? 'Funds have settled into their final balance bucket.'
          : intent.returnedReason ?? intent.failedReason ?? 'Provider settlement is still pending.',
    }),
  };
}

function buildLegalCopy(snapshot: PaymentsFundingFlowSnapshot): PaymentsLegalCopyBlock[] {
  return buildPaymentsLegalCopyBlocks({
    blockIds: ['stored_balance', 'partner_bank', 'custodial_account'],
    locale: snapshot.locale,
    generatedAt: snapshot.serverNow,
    surfaces: ['mobile'],
    productName: snapshot.productName,
    partnerBankName: snapshot.partnerBankName,
    custodialEntityName: snapshot.custodialEntityName,
    supportContact: snapshot.supportContact,
  });
}

export function buildPaymentsFundingFlowViewModel(
  snapshot: PaymentsFundingFlowSnapshot,
): PaymentsFundingFlowViewModel {
  const flow = snapshot.draft.flow;
  const amount = parsePaymentsSendAmount(snapshot.draft.amountText);
  const selectedSpeed = snapshot.draft.speed ?? 'standard';
  const selectedAccount =
    snapshot.linkedAccounts.find((account) => (
      account.id === snapshot.draft.selectedLinkedAccountId
    )) ??
    snapshot.linkedAccounts.find((account) => account.verificationState === 'verified') ??
    null;
  const feeCents = amount.valid
    ? calculateFeeCents(flow, selectedSpeed, amount.amountCents)
    : 0;
  const blockReason = buildBlockReason({
    snapshot,
    amount,
    selectedAccount,
    speed: selectedSpeed,
    feeCents,
  });
  const commandPreview = buildCommandPreview({
    snapshot,
    amount,
    selectedAccount,
    speed: selectedSpeed,
    feeCents,
    blocked: blockReason !== null,
  });
  const currency = snapshot.wallet?.defaultCurrency ?? 'USD';
  const pendingBalance = balanceCents(snapshot.wallet, 'pending');

  return {
    title: flow === 'add_money' ? 'Add money' : 'Withdraw',
    flow,
    linkedAccounts: snapshot.linkedAccounts.map((account) => ({
      ...account,
      label: `${account.institutionName} ending ${account.last4}`,
      actions: accountActionState(account),
    })),
    selectedAccount,
    amount,
    speed: {
      selected: selectedSpeed,
      options: (['standard', 'instant'] as const).map((speed) => ({
        id: speed,
        label: speedLabel(speed),
        enabled:
          speed === 'standard' ||
          (flow === 'add_money'
            ? selectedAccount?.supportsInstantFunding === true
            : selectedAccount?.supportsInstantPayout === true),
        feeLabel: formatPaymentsMoney(
          amount.valid ? calculateFeeCents(flow, speed, amount.amountCents) : 0,
          currency,
          snapshot.locale,
        ),
        etaLabel: etaLabel(speed),
      })),
    },
    previewLines: [
      {
        id: 'amount',
        label: flow === 'add_money' ? 'Funding amount' : 'Withdrawal amount',
        value: formatPaymentsMoney(amount.amountCents, currency, snapshot.locale),
        emphasis: 'neutral',
      },
      {
        id: 'fee',
        label: 'Fee',
        value: formatPaymentsMoney(feeCents, currency, snapshot.locale),
        emphasis: feeCents > 0 ? 'warning' : 'neutral',
      },
      {
        id: 'availability',
        label: flow === 'add_money' ? 'Spendable after' : 'Available balance impact',
        value:
          flow === 'add_money'
            ? 'Settlement'
            : formatPaymentsMoney(
                Math.max(0, balanceCents(snapshot.wallet, 'available') - amount.amountCents - feeCents),
                currency,
                snapshot.locale,
              ),
        emphasis: flow === 'add_money' ? 'warning' : 'neutral',
      },
      {
        id: 'pending',
        label: 'Already pending',
        value: formatPaymentsMoney(pendingBalance, currency, snapshot.locale),
        emphasis: pendingBalance > 0 ? 'warning' : 'neutral',
      },
    ],
    pendingNotice: buildPendingNotice(flow),
    blockReason,
    commandPreview,
    canSubmit: commandPreview !== null,
    recentIntents: snapshot.intents
      .filter((intent) => intent.flow === flow)
      .map((intent) => mapIntentState(intent, snapshot.locale)),
    legalCopyBlocks: buildLegalCopy(snapshot),
  };
}

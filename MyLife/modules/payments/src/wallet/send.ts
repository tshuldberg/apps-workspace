import type {
  PaymentsPaymentProfile,
  PaymentsTierAssessment,
} from '../compliance/types';
import {
  explainPaymentsLimitBlock,
} from '../compliance/tiers';
import {
  createPaymentsDisclosureCallout,
  formatPaymentsMoney,
} from '../compliance/disclosures/content';
import {
  buildPaymentsLegalCopyBlocks,
} from '../compliance/disclosures/legal';
import type {
  PaymentsLegalCopyBlock,
} from '../compliance/disclosures/types';
import {
  calculatePaymentsFee,
} from '../engine/fees';
import {
  createStableFingerprint,
} from '../engine/idempotency';
import {
  isPaymentsDomainError,
} from '../engine/errors';
import type {
  PaymentsCommandResult,
  PaymentsFeeQuote,
  PaymentsSendCommand,
  PaymentsTransferCommandResult,
  PaymentsTransferSpeed,
  PaymentsWalletSnapshot,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentDisclosure,
  PaymentVerificationState,
} from '../types';
import type {
  PaymentsDomainError,
  PaymentsDomainErrorCode,
} from '../engine/errors';

export type PaymentsSendRecipientSource =
  | 'handle'
  | 'phone'
  | 'email'
  | 'contact'
  | 'previous_counterparty';

export type PaymentsSendAuthPolicy =
  | 'none'
  | 'biometric'
  | 'strong_step_up';

export type PaymentsSendSystemMode = 'operational' | 'degraded';

export type PaymentsSendFlowState =
  | 'editing'
  | 'blocked'
  | 'awaiting_auth'
  | 'ready_to_confirm'
  | 'submitting'
  | 'succeeded'
  | 'pending_review'
  | 'failed'
  | 'replayed';

export interface PaymentsSendRecipientCandidate {
  id: string;
  walletId: string;
  displayName: string;
  source: PaymentsSendRecipientSource;
  verificationState: PaymentVerificationState;
  ownerUserId?: string | null;
  handle?: string | null;
  email?: string | null;
  phone?: string | null;
  descriptor?: string | null;
  lastInteractionAt?: string | null;
}

export interface PaymentsSendSenderProfile {
  ownerUserId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  tierAssessment: PaymentsTierAssessment;
}

export interface PaymentsSendDraft {
  recipientQuery?: string;
  selectedRecipientId?: string | null;
  amountText?: string;
  note?: string | null;
  speed?: PaymentsTransferSpeed;
  clientSubmissionId: string;
  authSatisfied?: boolean;
}

export interface PaymentsSendQuoteWindow {
  quotedAt?: string | null;
  expiresAt?: string | null;
  providerDeadlineAt?: string | null;
}

export interface PaymentsSendManualReviewPolicy {
  required: boolean;
  reason?: string | null;
}

export interface PaymentsSendSubmissionError {
  code: PaymentsDomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type PaymentsSendSubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'result'; result: PaymentsCommandResult }
  | { status: 'error'; error: PaymentsDomainError | PaymentsSendSubmissionError };

export interface PaymentsSendFlowSnapshot {
  senderProfile: PaymentsSendSenderProfile | PaymentsPaymentProfile | null;
  wallet: PaymentsWalletSnapshot | null;
  recipients: PaymentsSendRecipientCandidate[];
  draft: PaymentsSendDraft;
  serverNow: string;
  systemMode?: PaymentsSendSystemMode;
  quote?: PaymentsSendQuoteWindow | null;
  manualReview?: PaymentsSendManualReviewPolicy | null;
  authPolicy?: PaymentsSendAuthPolicy;
  submission?: PaymentsSendSubmissionState | null;
  locale?: string;
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsSendParsedAmount {
  rawText: string;
  amountCents: number;
  valid: boolean;
  error: string | null;
}

export interface PaymentsSendSpeedOption {
  id: PaymentsTransferSpeed;
  label: string;
  description: string;
}

export interface PaymentsSendPreviewLine {
  id: string;
  label: string;
  value: string;
  emphasis: 'neutral' | 'positive' | 'warning' | 'danger';
}

export interface PaymentsSendBlockReason {
  code: PaymentsDomainErrorCode;
  title: string;
  body: string;
}

export interface PaymentsSendPolicyNotice {
  code: PaymentsDomainErrorCode;
  blocking: boolean;
  disclosure: PaymentDisclosure;
}

export interface PaymentsSendCommandPreview {
  idempotencyKey: string;
  fingerprint: string;
  command: PaymentsSendCommand;
}

export interface PaymentsSendConfirmationState {
  policy: PaymentsSendAuthPolicy;
  required: boolean;
  satisfied: boolean;
  label: string;
  reason: string | null;
}

export interface PaymentsSendRecipientSearchState {
  query: string;
  selected: PaymentsSendRecipientCandidate | null;
  results: PaymentsSendRecipientCandidate[];
  emptyState: string;
}

export interface PaymentsSendPreviewState {
  availableCents: number;
  feeQuote: PaymentsFeeQuote | null;
  totalDebitCents: number;
  remainingAvailableCents: number | null;
  speedLabel: string;
  lines: PaymentsSendPreviewLine[];
  disclosure: PaymentDisclosure;
}

export interface PaymentsSendResultState {
  state: Extract<
    PaymentsSendFlowState,
    'succeeded' | 'pending_review' | 'failed' | 'replayed'
  >;
  title: string;
  body: string;
  tone: PaymentDisclosure['tone'];
  replayed: boolean;
  transferId: string | null;
  eventType: PaymentsTransferCommandResult['eventType'] | null;
  transferStatus: PaymentsTransferCommandResult['transfer']['status'] | null;
  code: PaymentsDomainErrorCode | null;
  disclosure: PaymentDisclosure;
}

export interface PaymentsSendFlowViewModel {
  title: 'Send';
  state: PaymentsSendFlowState;
  recipientSearch: PaymentsSendRecipientSearchState;
  amount: PaymentsSendParsedAmount;
  note: string;
  speed: {
    selected: PaymentsTransferSpeed;
    options: PaymentsSendSpeedOption[];
  };
  preview: PaymentsSendPreviewState;
  confirmation: PaymentsSendConfirmationState;
  policyNotice: PaymentsSendPolicyNotice | null;
  blockReason: PaymentsSendBlockReason | null;
  commandPreview: PaymentsSendCommandPreview | null;
  canSubmit: boolean;
  submitLabel: string;
  result: PaymentsSendResultState | null;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const SPEED_OPTIONS: PaymentsSendSpeedOption[] = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Wallet transfer with standard provider checks.',
  },
  {
    id: 'instant',
    label: 'Instant',
    description: 'Fastest available path when policy and provider health allow it.',
  },
];

const SOURCE_RANK: Record<PaymentsSendRecipientSource, number> = {
  previous_counterparty: 0,
  contact: 1,
  handle: 2,
  phone: 3,
  email: 4,
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s()-]/g, '').trim();
}

function normalizeNote(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDateTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function getBalanceCents(
  wallet: PaymentsWalletSnapshot | null,
  bucket: 'available' | 'pending' | 'reserved' | 'escrow',
): number {
  return wallet?.balances[bucket] ?? 0;
}

function sourceLabel(source: PaymentsSendRecipientSource): string {
  switch (source) {
    case 'previous_counterparty':
      return 'Previous';
    case 'contact':
      return 'Contact';
    case 'handle':
      return 'Handle';
    case 'phone':
      return 'Phone';
    case 'email':
      return 'Email';
  }
}

function speedLabel(speed: PaymentsTransferSpeed): string {
  return SPEED_OPTIONS.find((option) => option.id === speed)?.label ?? 'Standard';
}

function recipientMatchesQuery(
  candidate: PaymentsSendRecipientCandidate,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeText(query);
  const phoneQuery = normalizePhone(query);
  const tokens = [
    normalizeText(candidate.displayName),
    normalizeText(candidate.handle),
    normalizeText(candidate.email),
    normalizeText(candidate.descriptor),
    normalizeText(sourceLabel(candidate.source)),
  ];
  const phoneToken = normalizePhone(candidate.phone);

  return (
    tokens.some((token) => token.includes(normalizedQuery)) ||
    (phoneQuery.length > 0 && phoneToken.includes(phoneQuery))
  );
}

function sortRecipients(
  left: PaymentsSendRecipientCandidate,
  right: PaymentsSendRecipientCandidate,
): number {
  if (SOURCE_RANK[left.source] !== SOURCE_RANK[right.source]) {
    return SOURCE_RANK[left.source] - SOURCE_RANK[right.source];
  }
  return left.displayName.localeCompare(right.displayName);
}

function buildRecipientSearch(
  recipients: PaymentsSendRecipientCandidate[],
  draft: PaymentsSendDraft,
): PaymentsSendRecipientSearchState {
  const query = draft.recipientQuery?.trim() ?? '';
  const selected =
    recipients.find((candidate) => candidate.id === draft.selectedRecipientId) ??
    null;
  const filtered = recipients
    .filter((candidate) => recipientMatchesQuery(candidate, query))
    .sort(sortRecipients);
  const results =
    selected && !filtered.some((candidate) => candidate.id === selected.id)
      ? [selected, ...filtered].slice(0, 6)
      : filtered.slice(0, 6);

  return {
    query,
    selected,
    results,
    emptyState: query
      ? 'No verified recipient matched this lookup.'
      : 'Search by handle, phone, email, contact, or previous counterparty.',
  };
}

export function parsePaymentsSendAmount(rawText: string | null | undefined): PaymentsSendParsedAmount {
  const value = (rawText ?? '').trim();
  if (!value) {
    return {
      rawText: '',
      amountCents: 0,
      valid: false,
      error: 'Enter an amount to preview this payment.',
    };
  }

  const normalized = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return {
      rawText: value,
      amountCents: 0,
      valid: false,
      error: 'Use dollars and cents, with no more than two decimal places.',
    };
  }

  const [dollars = '0', cents = ''] = normalized.split('.');
  const amountCents =
    Number.parseInt(dollars, 10) * 100 +
    Number.parseInt(cents.padEnd(2, '0') || '0', 10);

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return {
      rawText: value,
      amountCents: 0,
      valid: false,
      error: 'Send amount must be greater than zero.',
    };
  }

  return {
    rawText: value,
    amountCents,
    valid: true,
    error: null,
  };
}

export function buildPaymentsSendIdempotencyKey(input: {
  clientSubmissionId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amountCents: number;
  currency: CurrencyCode;
}): string {
  const safeClientId =
    input.clientSubmissionId
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .slice(0, 48) || 'client_submission';
  const fingerprint = createStableFingerprint({
    amountCents: input.amountCents,
    currency: input.currency,
    destinationWalletId: input.destinationWalletId,
    sourceWalletId: input.sourceWalletId,
  })
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);

  return `pay_send_${safeClientId}_${fingerprint}`;
}

function buildLegalCopy(input: PaymentsSendFlowSnapshot): PaymentsLegalCopyBlock[] {
  return buildPaymentsLegalCopyBlocks({
    blockIds: ['stored_balance', 'partner_bank', 'error_resolution'],
    productName: input.productName ?? 'MyPay',
    partnerBankName: input.partnerBankName,
    custodialEntityName: input.custodialEntityName,
    supportContact: input.supportContact,
    locale: input.locale,
    surfaces: ['mobile', 'web'],
  });
}

function pickLegalCopyBlock(
  blocks: PaymentsLegalCopyBlock[],
  preferred: 'partner_bank' | 'error_resolution',
): PaymentsLegalCopyBlock {
  return (
    blocks.find((block) => block.blockId === preferred) ??
    blocks.find((block) => block.blockId === 'stored_balance') ??
    blocks[0]!
  );
}

function buildPreviewDisclosure(input: {
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  blocked: boolean;
}): PaymentDisclosure {
  const block = pickLegalCopyBlock(
    input.legalCopyBlocks,
    input.blocked ? 'error_resolution' : 'partner_bank',
  );

  return createPaymentsDisclosureCallout({
    id: `send_preview_${block.blockId}_${block.version}`,
    tone: input.blocked ? 'warning' : 'info',
    title: block.title,
    body: block.summary,
    footnote: block.footnote,
  });
}

function buildBlockReason(
  code: PaymentsDomainErrorCode,
  title: string,
  body: string,
): PaymentsSendBlockReason {
  return { code, title, body };
}

function resolvePolicyBlock(input: {
  snapshot: PaymentsSendFlowSnapshot;
  recipient: PaymentsSendRecipientCandidate | null;
  amount: PaymentsSendParsedAmount;
  feeQuote: PaymentsFeeQuote | null;
  serverNowMs: number;
}): PaymentsSendBlockReason | null {
  const { snapshot, recipient, amount, feeQuote, serverNowMs } = input;
  const { wallet, senderProfile } = snapshot;

  if (!wallet) {
    return buildBlockReason(
      'wallet_unavailable',
      'Wallet setup is required',
      'Create and activate a MyPay wallet before sending money.',
    );
  }

  if (snapshot.systemMode === 'degraded') {
    return buildBlockReason(
      'wallet_unavailable',
      'Payments are temporarily paused',
      'Balance and activity can refresh, but new sends are disabled until service health recovers.',
    );
  }

  if (!recipient) {
    return buildBlockReason(
      'invalid_command',
      'Choose a recipient',
      'Select a verified handle, phone, email, contact, or previous counterparty.',
    );
  }

  if (
    recipient.walletId === wallet.walletId ||
    (senderProfile?.ownerUserId && recipient.ownerUserId === senderProfile.ownerUserId)
  ) {
    return buildBlockReason(
      'invalid_command',
      'Choose a different recipient',
      'A wallet-to-wallet send cannot target the same wallet or owner.',
    );
  }

  if (!amount.valid) {
    return buildBlockReason(
      'invalid_command',
      'Enter a valid amount',
      amount.error ?? 'Send amount must be a positive amount.',
    );
  }

  const quoteExpiresAtMs = parseDateTime(snapshot.quote?.expiresAt);
  if (quoteExpiresAtMs !== null && quoteExpiresAtMs < serverNowMs) {
    return buildBlockReason(
      'stale_quote',
      'Quote expired',
      'Refresh the fee and delivery preview before submitting this payment.',
    );
  }

  const providerDeadlineMs = parseDateTime(snapshot.quote?.providerDeadlineAt);
  if (providerDeadlineMs !== null && providerDeadlineMs < serverNowMs) {
    return buildBlockReason(
      'provider_timeout',
      'Provider timed out',
      'The provider deadline passed before this payment could be submitted.',
    );
  }

  if (wallet.status !== 'active' && wallet.status !== 'restricted') {
    return buildBlockReason(
      'wallet_unavailable',
      'Source wallet is unavailable',
      `This wallet is ${wallet.status}. Money movement is not available in this state.`,
    );
  }

  if (wallet.complianceHold === 'send_only' || wallet.complianceHold === 'freeze') {
    return buildBlockReason(
      'compliance_hold',
      'Payment blocked by review',
      'Sending is paused while compliance review is open on this wallet.',
    );
  }

  const assessment = senderProfile?.tierAssessment;
  if (!assessment?.currentLimits.capabilities.canSend) {
    return buildBlockReason(
      'limit_blocked',
      'Identity tier is too low',
      assessment
        ? explainPaymentsLimitBlock({
            assessment,
            operation: 'send',
            requestedAmountCents: amount.amountCents,
          })
        : 'Complete basic verification before sending money.',
    );
  }

  if (amount.amountCents > assessment.currentLimits.sendSingleMaxCents) {
    return buildBlockReason(
      'limit_blocked',
      'Payment exceeds your tier limit',
      explainPaymentsLimitBlock({
        assessment,
        operation: 'send',
        requestedAmountCents: amount.amountCents,
      }),
    );
  }

  const totalDebitCents = feeQuote?.totalDebitCents ?? amount.amountCents;
  if (
    wallet.sendLimitRemainingCents !== null &&
    wallet.sendLimitRemainingCents !== undefined &&
    totalDebitCents > wallet.sendLimitRemainingCents
  ) {
    return buildBlockReason(
      'limit_blocked',
      'Payment exceeds remaining send room',
      `${formatPaymentsMoney(wallet.sendLimitRemainingCents, wallet.defaultCurrency)} remains available under the current send policy.`,
    );
  }

  if (getBalanceCents(wallet, 'available') < totalDebitCents) {
    return buildBlockReason(
      'insufficient_funds',
      'Insufficient available balance',
      `${formatPaymentsMoney(totalDebitCents, wallet.defaultCurrency)} is needed including fees. Only available balance can be sent.`,
    );
  }

  return null;
}

function buildManualReviewNotice(
  manualReview: PaymentsSendManualReviewPolicy | null | undefined,
): PaymentsSendPolicyNotice | null {
  if (!manualReview?.required) {
    return null;
  }

  return {
    code: 'compliance_hold',
    blocking: false,
    disclosure: createPaymentsDisclosureCallout({
      id: 'send_preview_manual_review',
      tone: 'warning',
      title: 'Manual review may apply',
      body:
        manualReview.reason ??
        'This payment can be submitted, but risk controls may hold it for manual review before funds move.',
    }),
  };
}

function buildBlockingNotice(
  blockReason: PaymentsSendBlockReason | null,
): PaymentsSendPolicyNotice | null {
  if (!blockReason) {
    return null;
  }

  return {
    code: blockReason.code,
    blocking: true,
    disclosure: createPaymentsDisclosureCallout({
      id: `send_block_${blockReason.code}`,
      tone:
        blockReason.code === 'insufficient_funds' ||
        blockReason.code === 'invalid_command'
          ? 'warning'
          : 'danger',
      title: blockReason.title,
      body: blockReason.body,
    }),
  };
}

function buildConfirmationState(
  policy: PaymentsSendAuthPolicy,
  authSatisfied: boolean | undefined,
): PaymentsSendConfirmationState {
  if (policy === 'none') {
    return {
      policy,
      required: false,
      satisfied: true,
      label: 'No step-up required',
      reason: null,
    };
  }

  const label =
    policy === 'biometric'
      ? 'Biometric confirmation'
      : 'Strong step-up confirmation';

  return {
    policy,
    required: true,
    satisfied: authSatisfied === true,
    label,
    reason:
      authSatisfied === true
        ? null
        : `${label} is required before this payment can be submitted.`,
  };
}

function buildCommandPreview(input: {
  snapshot: PaymentsSendFlowSnapshot;
  recipient: PaymentsSendRecipientCandidate | null;
  amount: PaymentsSendParsedAmount;
}): PaymentsSendCommandPreview | null {
  const { snapshot, recipient, amount } = input;
  const wallet = snapshot.wallet;

  if (!wallet || !recipient || !amount.valid) {
    return null;
  }

  const idempotencyKey = buildPaymentsSendIdempotencyKey({
    clientSubmissionId: snapshot.draft.clientSubmissionId,
    sourceWalletId: wallet.walletId,
    destinationWalletId: recipient.walletId,
    amountCents: amount.amountCents,
    currency: wallet.defaultCurrency,
  });
  const command: PaymentsSendCommand = {
    type: 'send',
    idempotencyKey,
    sourceWalletId: wallet.walletId,
    destinationWalletId: recipient.walletId,
    amountCents: amount.amountCents,
    currency: wallet.defaultCurrency,
    speed: snapshot.draft.speed ?? 'standard',
    memo: normalizeNote(snapshot.draft.note),
    quoteExpiresAt: snapshot.quote?.expiresAt ?? null,
    providerDeadlineAt: snapshot.quote?.providerDeadlineAt ?? null,
  };

  return {
    idempotencyKey,
    fingerprint: createStableFingerprint(command),
    command,
  };
}

function buildPreview(input: {
  snapshot: PaymentsSendFlowSnapshot;
  amount: PaymentsSendParsedAmount;
  feeQuote: PaymentsFeeQuote | null;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  blocked: boolean;
}): PaymentsSendPreviewState {
  const currency = input.snapshot.wallet?.defaultCurrency ?? DEFAULT_CURRENCY;
  const availableCents = getBalanceCents(input.snapshot.wallet, 'available');
  const totalDebitCents =
    input.feeQuote?.totalDebitCents ??
    (input.amount.valid ? input.amount.amountCents : 0);
  const remainingAvailableCents =
    input.amount.valid ? availableCents - totalDebitCents : null;
  const selectedSpeed = input.snapshot.draft.speed ?? 'standard';

  return {
    availableCents,
    feeQuote: input.feeQuote,
    totalDebitCents,
    remainingAvailableCents,
    speedLabel: speedLabel(selectedSpeed),
    lines: [
      {
        id: 'send_amount',
        label: 'Send amount',
        value: input.amount.valid
          ? formatPaymentsMoney(input.amount.amountCents, currency, input.snapshot.locale)
          : 'Not set',
        emphasis: 'neutral',
      },
      {
        id: 'fee',
        label: 'Fee',
        value: input.feeQuote
          ? formatPaymentsMoney(input.feeQuote.feeCents, currency, input.snapshot.locale)
          : 'Not ready',
        emphasis: input.feeQuote?.feeCents ? 'warning' : 'positive',
      },
      {
        id: 'speed',
        label: 'Speed',
        value: speedLabel(selectedSpeed),
        emphasis: 'neutral',
      },
      {
        id: 'balance_after',
        label: 'Available after',
        value:
          remainingAvailableCents === null
            ? 'Not ready'
            : formatPaymentsMoney(remainingAvailableCents, currency, input.snapshot.locale),
        emphasis:
          remainingAvailableCents === null
            ? 'neutral'
            : remainingAvailableCents < 0
              ? 'danger'
              : 'positive',
      },
    ],
    disclosure: buildPreviewDisclosure({
      legalCopyBlocks: input.legalCopyBlocks,
      blocked: input.blocked,
    }),
  };
}

function normalizeSubmissionError(
  error: PaymentsDomainError | PaymentsSendSubmissionError,
): PaymentsSendSubmissionError {
  if (isPaymentsDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  return error;
}

function isTransferResult(
  result: PaymentsCommandResult,
): result is PaymentsTransferCommandResult {
  return result.kind === 'transfer';
}

export function mapPaymentsSendSubmissionState(
  submission: PaymentsSendSubmissionState | null | undefined,
): PaymentsSendResultState | null {
  if (!submission || submission.status === 'idle' || submission.status === 'submitting') {
    return null;
  }

  if (submission.status === 'error') {
    const error = normalizeSubmissionError(submission.error);
    return {
      state: 'failed',
      title: 'Payment failed',
      body: error.message,
      tone: 'danger',
      replayed: false,
      transferId: null,
      eventType: null,
      transferStatus: null,
      code: error.code,
      disclosure: createPaymentsDisclosureCallout({
        id: `send_result_error_${error.code}`,
        tone: 'danger',
        title: error.code.replace(/_/g, ' '),
        body: error.message,
      }),
    };
  }

  if (!isTransferResult(submission.result)) {
    return {
      state: 'failed',
      title: 'Payment failed',
      body: 'The payments runtime returned a non-transfer result for this send command.',
      tone: 'danger',
      replayed: false,
      transferId: null,
      eventType: null,
      transferStatus: null,
      code: 'invalid_command',
      disclosure: createPaymentsDisclosureCallout({
        id: 'send_result_invalid_command',
        tone: 'danger',
        title: 'Invalid command result',
        body: 'The payments runtime returned a non-transfer result for this send command.',
      }),
    };
  }

  const { result } = submission;
  if (result.transfer.status === 'pending_review') {
    return {
      state: result.replayed ? 'replayed' : 'pending_review',
      title: result.replayed ? 'Payment already submitted' : 'Payment pending review',
      body: result.replayed
        ? 'This send command was safely replayed after reconnect and matched the original submission.'
        : 'Risk controls placed this payment in manual review before funds move.',
      tone: 'warning',
      replayed: result.replayed,
      transferId: result.transfer.transferId,
      eventType: result.eventType,
      transferStatus: result.transfer.status,
      code: null,
      disclosure: createPaymentsDisclosureCallout({
        id: result.replayed ? 'send_result_replayed_review' : 'send_result_pending_review',
        tone: 'warning',
        title: result.replayed ? 'Duplicate replay handled' : 'Manual review',
        body: result.replayed
          ? 'The original payment record is preserved and no duplicate debit is created.'
          : 'The transfer status matches the domain engine pending_review state.',
      }),
    };
  }

  return {
    state: result.replayed ? 'replayed' : 'succeeded',
    title: result.replayed ? 'Payment already sent' : 'Payment sent',
    body: result.replayed
      ? 'This duplicate submission replayed the original successful transfer without creating a second debit.'
      : 'The transfer posted through the payments domain engine.',
    tone: 'success',
    replayed: result.replayed,
    transferId: result.transfer.transferId,
    eventType: result.eventType,
    transferStatus: result.transfer.status,
    code: null,
    disclosure: createPaymentsDisclosureCallout({
      id: result.replayed ? 'send_result_replayed_success' : 'send_result_success',
      tone: 'success',
      title: result.replayed ? 'Duplicate replay handled' : 'Posted',
      body: result.replayed
        ? 'The idempotency key and command fingerprint matched the original submission.'
        : 'Ledger posting and fee preview are aligned with the domain transfer result.',
    }),
  };
}

function resolveFlowState(input: {
  submission: PaymentsSendSubmissionState | null | undefined;
  result: PaymentsSendResultState | null;
  blockReason: PaymentsSendBlockReason | null;
  confirmation: PaymentsSendConfirmationState;
  commandPreview: PaymentsSendCommandPreview | null;
}): PaymentsSendFlowState {
  if (input.submission?.status === 'submitting') {
    return 'submitting';
  }
  if (input.result) {
    return input.result.state;
  }
  if (input.blockReason) {
    return 'blocked';
  }
  if (input.commandPreview && !input.confirmation.satisfied) {
    return 'awaiting_auth';
  }
  if (input.commandPreview) {
    return 'ready_to_confirm';
  }
  return 'editing';
}

export function buildPaymentsSendFlowViewModel(
  snapshot: PaymentsSendFlowSnapshot,
): PaymentsSendFlowViewModel {
  const legalCopyBlocks = buildLegalCopy(snapshot);
  const recipientSearch = buildRecipientSearch(snapshot.recipients, snapshot.draft);
  const amount = parsePaymentsSendAmount(snapshot.draft.amountText);
  const selectedSpeed = snapshot.draft.speed ?? 'standard';
  const feeQuote =
    amount.valid
      ? calculatePaymentsFee({
          kind: 'p2p',
          amountCents: amount.amountCents,
          sourceRail: 'wallet',
          destinationRail: 'wallet',
          speed: selectedSpeed,
          feeProfile: 'p2p',
        })
      : null;
  const serverNowMs =
    parseDateTime(snapshot.serverNow) ?? new Date().getTime();
  const blockReason = resolvePolicyBlock({
    snapshot,
    recipient: recipientSearch.selected,
    amount,
    feeQuote,
    serverNowMs,
  });
  const confirmation = buildConfirmationState(
    snapshot.authPolicy ?? 'strong_step_up',
    snapshot.draft.authSatisfied,
  );
  const commandPreview = buildCommandPreview({
    snapshot,
    recipient: recipientSearch.selected,
    amount,
  });
  const preview = buildPreview({
    snapshot,
    amount,
    feeQuote,
    legalCopyBlocks,
    blocked: blockReason !== null,
  });
  const result = mapPaymentsSendSubmissionState(snapshot.submission);
  const policyNotice =
    buildBlockingNotice(blockReason) ??
    buildManualReviewNotice(snapshot.manualReview);
  const state = resolveFlowState({
    submission: snapshot.submission,
    result,
    blockReason,
    confirmation,
    commandPreview,
  });
  const canSubmit =
    state === 'ready_to_confirm' &&
    commandPreview !== null &&
    blockReason === null &&
    confirmation.satisfied;

  return {
    title: 'Send',
    state,
    recipientSearch,
    amount,
    note: snapshot.draft.note ?? '',
    speed: {
      selected: selectedSpeed,
      options: SPEED_OPTIONS,
    },
    preview,
    confirmation,
    policyNotice,
    blockReason,
    commandPreview,
    canSubmit,
    submitLabel:
      state === 'submitting'
        ? 'Submitting'
        : state === 'awaiting_auth'
          ? confirmation.label
          : 'Send payment',
    result,
    legalCopyBlocks,
  };
}

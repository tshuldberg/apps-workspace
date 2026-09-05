import type {
  PaymentsPaymentProfile,
  PaymentsTierAssessment,
} from '../compliance/types';
import {
  explainPaymentsLimitBlock,
} from '../compliance/tiers';
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
  canTransitionRequestStatus,
} from '../engine/fsm';
import {
  createStableFingerprint,
} from '../engine/idempotency';
import {
  isPaymentsDomainError,
} from '../engine/errors';
import type {
  PaymentsCommandResult,
  PaymentsPaymentRequestRecord,
  PaymentsRequestCommand,
  PaymentsRequestCommandResult,
  PaymentsRequestStatus,
  PaymentsSendCommand,
  PaymentsWalletSnapshot,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentDisclosure,
  PaymentTimelineStep,
  PaymentVerificationState,
} from '../types';
import type {
  PaymentsDomainError,
  PaymentsDomainErrorCode,
} from '../engine/errors';
import {
  buildPaymentsSendIdempotencyKey,
  parsePaymentsSendAmount,
} from './send';
import type {
  PaymentsSendParsedAmount,
} from './send';

export type PaymentsRequestTargetSource =
  | 'known_user'
  | 'contact'
  | 'previous_counterparty'
  | 'payment_link';

export type PaymentsRequestMode = 'known_user' | 'payment_link';

export type PaymentsRequestSystemMode = 'operational' | 'degraded';

export type PaymentsRequestLifecycleState =
  | 'pending'
  | 'paid'
  | 'declined'
  | 'expired'
  | 'canceled';

export type PaymentsRequestFlowState =
  | 'editing'
  | 'blocked'
  | 'ready_to_create'
  | 'submitting'
  | 'created'
  | 'failed'
  | 'replayed';

export type PaymentsRequestPerspective = 'requester' | 'payer';

export type PaymentsRequestActionId =
  | 'remind'
  | 'cancel'
  | 'accept'
  | 'decline';

export interface PaymentsRequestTargetCandidate {
  id: string;
  displayName: string;
  source: PaymentsRequestTargetSource;
  verificationState: PaymentVerificationState;
  walletId?: string | null;
  ownerUserId?: string | null;
  handle?: string | null;
  email?: string | null;
  phone?: string | null;
  descriptor?: string | null;
  lastInteractionAt?: string | null;
}

export interface PaymentsRequestRequesterProfile {
  ownerUserId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  tierAssessment: PaymentsTierAssessment;
}

export interface PaymentsRequestAntiAbuseConstraints {
  maxUses: number;
  maxAmountCents: number;
  expiresWithinHours: number;
  reminderCooldownHours: number;
  maxReminders: number;
  rateLimitKey: string;
}

export interface PaymentsRequestDraft {
  mode: PaymentsRequestMode;
  targetQuery?: string;
  selectedTargetId?: string | null;
  amountText?: string;
  note?: string | null;
  expiresAt?: string | null;
  clientSubmissionId: string;
}

export interface PaymentsRequestRecord extends PaymentsPaymentRequestRecord {
  createdAt: string;
  updatedAt?: string | null;
  paidAt?: string | null;
  declinedAt?: string | null;
  expiredAt?: string | null;
  canceledAt?: string | null;
  lastReminderAt?: string | null;
  reminderCount?: number;
  requesterDisplayName?: string | null;
  payerDisplayName?: string | null;
  paymentLinkId?: string | null;
  paymentLinkUrl?: string | null;
  acceptedTransferId?: string | null;
}

export interface PaymentsRequestSubmissionError {
  code: PaymentsDomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type PaymentsRequestSubmissionState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'result'; result: PaymentsCommandResult }
  | { status: 'error'; error: PaymentsDomainError | PaymentsRequestSubmissionError };

export interface PaymentsRequestFlowSnapshot {
  requesterProfile: PaymentsRequestRequesterProfile | PaymentsPaymentProfile | null;
  wallet: PaymentsWalletSnapshot | null;
  targets: PaymentsRequestTargetCandidate[];
  draft: PaymentsRequestDraft;
  serverNow: string;
  systemMode?: PaymentsRequestSystemMode;
  antiAbuse?: PaymentsRequestAntiAbuseConstraints | null;
  existingRequests?: PaymentsRequestRecord[];
  selectedRequestId?: string | null;
  acceptancePayerWalletId?: string | null;
  submission?: PaymentsRequestSubmissionState | null;
  locale?: string;
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsRequestTargetSearchState {
  mode: PaymentsRequestMode;
  query: string;
  selected: PaymentsRequestTargetCandidate | null;
  results: PaymentsRequestTargetCandidate[];
  emptyState: string;
}

export interface PaymentsRequestPreviewLine {
  id: string;
  label: string;
  value: string;
  emphasis: 'neutral' | 'positive' | 'warning' | 'danger';
}

export interface PaymentsRequestBlockReason {
  code: PaymentsDomainErrorCode;
  title: string;
  body: string;
}

export interface PaymentsRequestPolicyNotice {
  code: PaymentsDomainErrorCode;
  blocking: boolean;
  disclosure: PaymentDisclosure;
}

export interface PaymentsRequestCommandPreview {
  idempotencyKey: string;
  fingerprint: string;
  command: PaymentsRequestCommand;
}

export interface PaymentsRequestPreviewState {
  amountCents: number;
  currency: CurrencyCode;
  expiresAt: string | null;
  expirationLabel: string;
  lines: PaymentsRequestPreviewLine[];
  disclosure: PaymentDisclosure;
  guardrailDisclosure: PaymentDisclosure;
}

export interface PaymentsRequestAction {
  id: PaymentsRequestActionId;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface PaymentsRequestRelatedHook {
  id: 'reminders' | 'disputes' | 'rsvp' | 'dining';
  label: string;
  detail: string;
}

export interface PaymentsRequestDetailState {
  requestId: string;
  lifecycleState: PaymentsRequestLifecycleState;
  status: PaymentsRequestStatus;
  statusLabel: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  expiresAtLabel: string | null;
  timeline: PaymentTimelineStep[];
  requesterTimeline: PaymentTimelineStep[];
  payerTimeline: PaymentTimelineStep[];
  actions: PaymentsRequestAction[];
  acceptanceCommand: PaymentsSendCommand | null;
  disclosure: PaymentDisclosure;
  relatedHooks: PaymentsRequestRelatedHook[];
}

export interface PaymentsRequestResultState {
  state: Extract<PaymentsRequestFlowState, 'created' | 'failed' | 'replayed'>;
  title: string;
  body: string;
  tone: PaymentDisclosure['tone'];
  replayed: boolean;
  requestId: string | null;
  requestStatus: PaymentsRequestStatus | null;
  code: PaymentsDomainErrorCode | null;
  disclosure: PaymentDisclosure;
}

export interface PaymentsRequestFlowViewModel {
  title: 'Request';
  state: PaymentsRequestFlowState;
  targetSearch: PaymentsRequestTargetSearchState;
  amount: PaymentsSendParsedAmount;
  note: string;
  preview: PaymentsRequestPreviewState;
  policyNotice: PaymentsRequestPolicyNotice | null;
  blockReason: PaymentsRequestBlockReason | null;
  commandPreview: PaymentsRequestCommandPreview | null;
  canCreate: boolean;
  submitLabel: string;
  result: PaymentsRequestResultState | null;
  detail: PaymentsRequestDetailState | null;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

const DEFAULT_CURRENCY: CurrencyCode = 'USD';
const MAX_PAYMENT_LINK_EXPIRY_HOURS = 168;

const SOURCE_RANK: Record<PaymentsRequestTargetSource, number> = {
  previous_counterparty: 0,
  contact: 1,
  known_user: 2,
  payment_link: 3,
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

function targetSourceLabel(source: PaymentsRequestTargetSource): string {
  switch (source) {
    case 'previous_counterparty':
      return 'Previous';
    case 'contact':
      return 'Contact';
    case 'known_user':
      return 'MyLife';
    case 'payment_link':
      return 'Link';
  }
}

function requestStatusLabel(status: PaymentsRequestStatus): string {
  switch (status) {
    case 'open':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'paid':
      return 'Paid';
    case 'declined':
      return 'Declined';
    case 'expired':
      return 'Expired';
    case 'canceled':
      return 'Canceled';
  }
}

function lifecycleFromStatus(
  status: PaymentsRequestStatus,
): PaymentsRequestLifecycleState {
  if (status === 'open' || status === 'approved') {
    return 'pending';
  }
  return status;
}

function targetMatchesQuery(
  target: PaymentsRequestTargetCandidate,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeText(query);
  const phoneQuery = normalizePhone(query);
  const tokens = [
    normalizeText(target.displayName),
    normalizeText(target.handle),
    normalizeText(target.email),
    normalizeText(target.descriptor),
    normalizeText(targetSourceLabel(target.source)),
  ];
  const phoneToken = normalizePhone(target.phone);

  return (
    tokens.some((token) => token.includes(normalizedQuery)) ||
    (phoneQuery.length > 0 && phoneToken.includes(phoneQuery))
  );
}

function sortTargets(
  left: PaymentsRequestTargetCandidate,
  right: PaymentsRequestTargetCandidate,
): number {
  if (SOURCE_RANK[left.source] !== SOURCE_RANK[right.source]) {
    return SOURCE_RANK[left.source] - SOURCE_RANK[right.source];
  }
  return left.displayName.localeCompare(right.displayName);
}

function buildTargetSearch(
  targets: PaymentsRequestTargetCandidate[],
  draft: PaymentsRequestDraft,
): PaymentsRequestTargetSearchState {
  const query = draft.targetQuery?.trim() ?? '';
  const selected =
    targets.find((candidate) => candidate.id === draft.selectedTargetId) ??
    null;

  if (draft.mode === 'payment_link') {
    return {
      mode: draft.mode,
      query,
      selected: null,
      results: [],
      emptyState: 'Payment links can be shared with off-network contacts after expiry and anti-abuse rules are set.',
    };
  }

  const filtered = targets
    .filter((candidate) => targetMatchesQuery(candidate, query))
    .sort(sortTargets);
  const results =
    selected && !filtered.some((candidate) => candidate.id === selected.id)
      ? [selected, ...filtered].slice(0, 6)
      : filtered.slice(0, 6);

  return {
    mode: draft.mode,
    query,
    selected,
    results,
    emptyState: query
      ? 'No eligible MyLife payer matched this lookup.'
      : 'Search by handle, phone, email, contact, or previous counterparty.',
  };
}

export function buildPaymentsRequestIdempotencyKey(input: {
  clientSubmissionId: string;
  requesterWalletId: string;
  payerWalletId: string | null;
  amountCents: number;
  currency: CurrencyCode;
  expiresAt: string;
  mode: PaymentsRequestMode;
}): string {
  const safeClientId =
    input.clientSubmissionId
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .slice(0, 48) || 'client_submission';
  const fingerprint = createStableFingerprint({
    amountCents: input.amountCents,
    currency: input.currency,
    expiresAt: input.expiresAt,
    mode: input.mode,
    payerWalletId: input.payerWalletId ?? 'payment_link',
    requesterWalletId: input.requesterWalletId,
  })
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);

  return `pay_request_${safeClientId}_${fingerprint}`;
}

function buildLegalCopy(
  input: PaymentsRequestFlowSnapshot,
): PaymentsLegalCopyBlock[] {
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
    id: `request_preview_${block.blockId}_${block.version}`,
    tone: input.blocked ? 'warning' : 'info',
    title: block.title,
    body: block.summary,
    footnote: block.footnote,
  });
}

function buildNotGuaranteedDisclosure(): PaymentDisclosure {
  return createPaymentsDisclosureCallout({
    id: 'request_not_guaranteed_receivable',
    tone: 'info',
    title: 'Request, not a receivable',
    body:
      'A payment request does not guarantee funds. Money moves only after the payer accepts and the transfer posts through the send engine.',
  });
}

function buildBlockReason(
  code: PaymentsDomainErrorCode,
  title: string,
  body: string,
): PaymentsRequestBlockReason {
  return { code, title, body };
}

function resolvePolicyBlock(input: {
  snapshot: PaymentsRequestFlowSnapshot;
  target: PaymentsRequestTargetCandidate | null;
  amount: PaymentsSendParsedAmount;
  serverNowMs: number;
}): PaymentsRequestBlockReason | null {
  const { snapshot, target, amount, serverNowMs } = input;
  const wallet = snapshot.wallet;

  if (!wallet) {
    return buildBlockReason(
      'wallet_unavailable',
      'Wallet setup is required',
      'Create and activate a MyPay wallet before requesting money.',
    );
  }

  if (snapshot.systemMode === 'degraded') {
    return buildBlockReason(
      'wallet_unavailable',
      'Requests are temporarily paused',
      'Request creation is disabled until service health recovers.',
    );
  }

  if (wallet.status !== 'active' && wallet.status !== 'restricted') {
    return buildBlockReason(
      'wallet_unavailable',
      'Requester wallet is unavailable',
      `This wallet is ${wallet.status}. Payment requests are not available in this state.`,
    );
  }

  if (wallet.complianceHold === 'receive_only' || wallet.complianceHold === 'freeze') {
    return buildBlockReason(
      'compliance_hold',
      'Receiving is paused by review',
      'New payment requests are paused while compliance review limits receiving on this wallet.',
    );
  }

  if (snapshot.draft.mode === 'known_user') {
    if (!target) {
      return buildBlockReason(
        'invalid_command',
        'Choose who to request from',
        'Select a known MyLife user, contact, or previous counterparty.',
      );
    }

    if (!target.walletId) {
      return buildBlockReason(
        'wallet_unavailable',
        'Payer wallet is unavailable',
        'This payer cannot receive a direct request until a MyPay wallet is available.',
      );
    }
  }

  if (!amount.valid) {
    return buildBlockReason(
      'invalid_command',
      'Enter a valid amount',
      amount.error ?? 'Request amount must be a positive amount.',
    );
  }

  const assessment = snapshot.requesterProfile?.tierAssessment;
  if (!assessment?.currentLimits.capabilities.canReceive) {
    return buildBlockReason(
      'limit_blocked',
      'Identity tier is too low',
      assessment
        ? explainPaymentsLimitBlock({
            assessment,
            operation: 'receive',
            requestedAmountCents: amount.amountCents,
          })
        : 'Complete basic verification before requesting money.',
    );
  }

  if (
    wallet.receiveLimitRemainingCents !== null &&
    wallet.receiveLimitRemainingCents !== undefined &&
    amount.amountCents > wallet.receiveLimitRemainingCents
  ) {
    return buildBlockReason(
      'limit_blocked',
      'Request exceeds remaining receive room',
      `${formatPaymentsMoney(wallet.receiveLimitRemainingCents, wallet.defaultCurrency)} remains available under the current receive policy.`,
    );
  }

  const expiresAtMs = parseDateTime(snapshot.draft.expiresAt);
  if (expiresAtMs === null) {
    return buildBlockReason(
      'invalid_command',
      'Set an expiry',
      'Payment requests and links need an explicit expiry before they can be created.',
    );
  }

  if (expiresAtMs <= serverNowMs) {
    return buildBlockReason(
      'invalid_command',
      'Expiry is in the past',
      'Choose a future expiry so the payer sees a clear deadline.',
    );
  }

  const antiAbuse = snapshot.antiAbuse;
  if (snapshot.draft.mode === 'payment_link') {
    if (!antiAbuse) {
      return buildBlockReason(
        'invalid_command',
        'Add link constraints',
        'Payment links require explicit anti-abuse limits before sharing.',
      );
    }

    if (antiAbuse.maxUses !== 1) {
      return buildBlockReason(
        'invalid_command',
        'Use single-use links',
        'Payment links must be single-use in this phase to avoid accidental duplicate payments.',
      );
    }

    if (!antiAbuse.rateLimitKey.trim()) {
      return buildBlockReason(
        'invalid_command',
        'Add rate-limit scope',
        'Payment links need a stable rate-limit key for abuse controls.',
      );
    }

    if (amount.amountCents > antiAbuse.maxAmountCents) {
      return buildBlockReason(
        'limit_blocked',
        'Link amount exceeds policy',
        `${formatPaymentsMoney(antiAbuse.maxAmountCents, wallet.defaultCurrency)} is the maximum amount allowed for this payment link.`,
      );
    }

    if (
      antiAbuse.expiresWithinHours <= 0 ||
      antiAbuse.expiresWithinHours > MAX_PAYMENT_LINK_EXPIRY_HOURS
    ) {
      return buildBlockReason(
        'invalid_command',
        'Link expiry window is invalid',
        `Payment links must expire within ${MAX_PAYMENT_LINK_EXPIRY_HOURS} hours.`,
      );
    }

    const maxExpiryMs =
      serverNowMs + antiAbuse.expiresWithinHours * 60 * 60 * 1000;
    if (expiresAtMs > maxExpiryMs) {
      return buildBlockReason(
        'invalid_command',
        'Link expiry exceeds policy',
        `This link must expire within ${antiAbuse.expiresWithinHours} hours.`,
      );
    }
  }

  return null;
}

function buildBlockingNotice(
  blockReason: PaymentsRequestBlockReason | null,
): PaymentsRequestPolicyNotice | null {
  if (!blockReason) {
    return null;
  }

  return {
    code: blockReason.code,
    blocking: true,
    disclosure: createPaymentsDisclosureCallout({
      id: `request_block_${blockReason.code}`,
      tone:
        blockReason.code === 'invalid_command' ||
        blockReason.code === 'limit_blocked'
          ? 'warning'
          : 'danger',
      title: blockReason.title,
      body: blockReason.body,
    }),
  };
}

function buildCommandPreview(input: {
  snapshot: PaymentsRequestFlowSnapshot;
  target: PaymentsRequestTargetCandidate | null;
  amount: PaymentsSendParsedAmount;
}): PaymentsRequestCommandPreview | null {
  const wallet = input.snapshot.wallet;
  const expiresAt = input.snapshot.draft.expiresAt?.trim();

  if (!wallet || !input.amount.valid || !expiresAt) {
    return null;
  }

  const payerWalletId =
    input.snapshot.draft.mode === 'known_user'
      ? input.target?.walletId ?? null
      : null;

  if (input.snapshot.draft.mode === 'known_user' && !payerWalletId) {
    return null;
  }

  const idempotencyKey = buildPaymentsRequestIdempotencyKey({
    clientSubmissionId: input.snapshot.draft.clientSubmissionId,
    requesterWalletId: wallet.walletId,
    payerWalletId,
    amountCents: input.amount.amountCents,
    currency: wallet.defaultCurrency,
    expiresAt,
    mode: input.snapshot.draft.mode,
  });
  const command: PaymentsRequestCommand = {
    type: 'request',
    idempotencyKey,
    requesterWalletId: wallet.walletId,
    payerWalletId,
    amountCents: input.amount.amountCents,
    currency: wallet.defaultCurrency,
    expiresAt,
    memo: normalizeNote(input.snapshot.draft.note),
    metadata: {
      mode: input.snapshot.draft.mode,
      requesterOwnerUserId: wallet.ownerUserId ?? null,
      payerOwnerUserId: input.target?.ownerUserId ?? null,
      paymentLink: input.snapshot.draft.mode === 'payment_link',
      antiAbuse: input.snapshot.antiAbuse ?? null,
    },
  };

  return {
    idempotencyKey,
    fingerprint: createStableFingerprint(command),
    command,
  };
}

function buildPreview(input: {
  snapshot: PaymentsRequestFlowSnapshot;
  target: PaymentsRequestTargetCandidate | null;
  amount: PaymentsSendParsedAmount;
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  blocked: boolean;
}): PaymentsRequestPreviewState {
  const currency = input.snapshot.wallet?.defaultCurrency ?? DEFAULT_CURRENCY;
  const expiresAt = input.snapshot.draft.expiresAt?.trim() || null;
  const expirationLabel = expiresAt
    ? formatPaymentsAbsoluteDateTime(expiresAt, input.snapshot.locale)
    : 'Not set';
  const payerLabel =
    input.snapshot.draft.mode === 'payment_link'
      ? 'Payment link'
      : input.target?.displayName ?? 'Not selected';
  const guardrail =
    input.snapshot.draft.mode === 'payment_link'
      ? `Single-use link, ${input.snapshot.antiAbuse?.maxReminders ?? 0} reminder limit, ${input.snapshot.antiAbuse?.reminderCooldownHours ?? 0} hour reminder cooldown.`
      : 'Direct requests can be declined, canceled, or expire before any funds move.';

  return {
    amountCents: input.amount.valid ? input.amount.amountCents : 0,
    currency,
    expiresAt,
    expirationLabel,
    lines: [
      {
        id: 'request_amount',
        label: 'Request amount',
        value: input.amount.valid
          ? formatPaymentsMoney(input.amount.amountCents, currency, input.snapshot.locale)
          : 'Not set',
        emphasis: 'neutral',
      },
      {
        id: 'payer',
        label: 'Payer',
        value: payerLabel,
        emphasis:
          input.snapshot.draft.mode === 'known_user' && !input.target
            ? 'warning'
            : 'neutral',
      },
      {
        id: 'expiry',
        label: 'Expires',
        value: expirationLabel,
        emphasis: expiresAt ? 'neutral' : 'warning',
      },
      {
        id: 'receivable_status',
        label: 'Funds status',
        value: 'Not guaranteed',
        emphasis: 'warning',
      },
    ],
    disclosure: buildPreviewDisclosure({
      legalCopyBlocks: input.legalCopyBlocks,
      blocked: input.blocked,
    }),
    guardrailDisclosure: createPaymentsDisclosureCallout({
      id: 'request_guardrails',
      tone: 'info',
      title: 'Request guardrails',
      body: guardrail,
    }),
  };
}

function normalizeSubmissionError(
  error: PaymentsDomainError | PaymentsRequestSubmissionError,
): PaymentsRequestSubmissionError {
  if (isPaymentsDomainError(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }
  return error;
}

function isRequestResult(
  result: PaymentsCommandResult,
): result is PaymentsRequestCommandResult {
  return result.kind === 'request';
}

export function mapPaymentsRequestSubmissionState(
  submission: PaymentsRequestSubmissionState | null | undefined,
): PaymentsRequestResultState | null {
  if (!submission || submission.status === 'idle' || submission.status === 'submitting') {
    return null;
  }

  if (submission.status === 'error') {
    const error = normalizeSubmissionError(submission.error);
    return {
      state: 'failed',
      title: 'Request failed',
      body: error.message,
      tone: 'danger',
      replayed: false,
      requestId: null,
      requestStatus: null,
      code: error.code,
      disclosure: createPaymentsDisclosureCallout({
        id: `request_result_error_${error.code}`,
        tone: 'danger',
        title: error.code.replace(/_/g, ' '),
        body: error.message,
      }),
    };
  }

  if (!isRequestResult(submission.result)) {
    return {
      state: 'failed',
      title: 'Request failed',
      body: 'The payments runtime returned a non-request result for this request command.',
      tone: 'danger',
      replayed: false,
      requestId: null,
      requestStatus: null,
      code: 'invalid_command',
      disclosure: createPaymentsDisclosureCallout({
        id: 'request_result_invalid_command',
        tone: 'danger',
        title: 'Invalid command result',
        body: 'The payments runtime returned a non-request result for this request command.',
      }),
    };
  }

  return {
    state: submission.result.replayed ? 'replayed' : 'created',
    title: submission.result.replayed ? 'Request already created' : 'Request created',
    body: submission.result.replayed
      ? 'This duplicate submission replayed the original request without creating another payment link or payer notification.'
      : 'The request is open. Funds will only move if the payer accepts and the send transfer posts.',
    tone: submission.result.replayed ? 'warning' : 'success',
    replayed: submission.result.replayed,
    requestId: submission.result.request.requestId,
    requestStatus: submission.result.request.status,
    code: null,
    disclosure: createPaymentsDisclosureCallout({
      id: submission.result.replayed
        ? 'request_result_replayed'
        : 'request_result_created',
      tone: submission.result.replayed ? 'warning' : 'success',
      title: submission.result.replayed
        ? 'Duplicate replay handled'
        : 'Open request',
      body: submission.result.replayed
        ? 'The idempotency key and request fingerprint matched the original submission.'
        : 'Requester and payer will see the same timeline until the request is paid, declined, expired, or canceled.',
    }),
  };
}

function buildRequestTimeline(
  request: PaymentsRequestRecord,
  serverNow: string,
): PaymentTimelineStep[] {
  const lifecycle = lifecycleFromStatus(request.status);
  const terminalAt =
    request.paidAt ??
    request.declinedAt ??
    request.expiredAt ??
    request.canceledAt ??
    null;
  const expiryMs = parseDateTime(request.expiresAt);
  const serverNowMs = parseDateTime(serverNow) ?? Date.now();
  const expiredByClock =
    request.status === 'open' &&
    expiryMs !== null &&
    expiryMs <= serverNowMs;
  const currentStatus =
    expiredByClock ? 'expired' : lifecycle;

  return [
    {
      id: 'created',
      title: 'Request created',
      detail:
        request.payerWalletId === null
          ? 'Payment link created for an off-network payer.'
          : 'Direct request sent to a MyLife payer.',
      timestamp: request.createdAt,
      state: 'complete',
    },
    {
      id: 'payer_action',
      title: 'Payer action',
      detail:
        currentStatus === 'pending'
          ? 'Waiting for the payer to accept, decline, or let the request expire.'
          : `Payer state: ${requestStatusLabel(request.status)}.`,
      timestamp:
        request.status === 'declined'
          ? request.declinedAt ?? undefined
          : request.status === 'paid'
            ? request.paidAt ?? undefined
            : undefined,
      state:
        currentStatus === 'pending'
          ? 'current'
          : currentStatus === 'declined'
            ? 'blocked'
            : 'complete',
    },
    {
      id: 'funds_move',
      title: 'Funds move after send acceptance',
      detail:
        currentStatus === 'paid'
          ? `Accepted through send transfer ${request.acceptedTransferId ?? 'unknown'}.`
          : 'No debit or credit is created before payer acceptance.',
      timestamp: request.paidAt ?? undefined,
      state:
        currentStatus === 'paid'
          ? 'complete'
          : currentStatus === 'expired' || currentStatus === 'canceled' || currentStatus === 'declined'
            ? 'blocked'
            : 'upcoming',
    },
    {
      id: 'closed',
      title: 'Request closed',
      detail:
        currentStatus === 'pending'
          ? 'This request remains open until paid, declined, expired, or canceled.'
          : `Closed as ${currentStatus}.`,
      timestamp: terminalAt ?? undefined,
      state: currentStatus === 'pending' ? 'upcoming' : 'complete',
    },
  ];
}

function canRemind(input: {
  request: PaymentsRequestRecord;
  constraints: PaymentsRequestAntiAbuseConstraints | null | undefined;
  serverNowMs: number;
}): PaymentsRequestAction {
  const { request, constraints, serverNowMs } = input;
  if (request.status !== 'open' && request.status !== 'approved') {
    return {
      id: 'remind',
      label: 'Send reminder',
      enabled: false,
      reason: 'Only pending requests can be reminded.',
    };
  }

  const expiryMs = parseDateTime(request.expiresAt);
  if (expiryMs !== null && expiryMs <= serverNowMs) {
    return {
      id: 'remind',
      label: 'Send reminder',
      enabled: false,
      reason: 'Expired requests cannot be reminded.',
    };
  }

  const reminderCount = request.reminderCount ?? 0;
  if (constraints && reminderCount >= constraints.maxReminders) {
    return {
      id: 'remind',
      label: 'Send reminder',
      enabled: false,
      reason: 'Reminder limit reached for this request.',
    };
  }

  const lastReminderMs = parseDateTime(request.lastReminderAt);
  if (constraints && lastReminderMs !== null) {
    const cooldownMs = constraints.reminderCooldownHours * 60 * 60 * 1000;
    if (serverNowMs - lastReminderMs < cooldownMs) {
      return {
        id: 'remind',
        label: 'Send reminder',
        enabled: false,
        reason: `Wait ${constraints.reminderCooldownHours} hours between reminders.`,
      };
    }
  }

  return {
    id: 'remind',
    label: 'Send reminder',
    enabled: true,
    reason: null,
  };
}

function buildRequestActions(input: {
  request: PaymentsRequestRecord;
  acceptanceCommand: PaymentsSendCommand | null;
  constraints: PaymentsRequestAntiAbuseConstraints | null | undefined;
  serverNowMs: number;
}): PaymentsRequestAction[] {
  const { request, acceptanceCommand, serverNowMs } = input;
  const pending =
    request.status === 'open' || request.status === 'approved';
  const expired =
    request.expiresAt !== null &&
    parseDateTime(request.expiresAt) !== null &&
    parseDateTime(request.expiresAt)! <= serverNowMs;

  return [
    canRemind(input),
    {
      id: 'cancel',
      label: 'Cancel request',
      enabled: pending && !expired && canTransitionRequestStatus(request.status, 'canceled'),
      reason:
        pending && !expired
          ? null
          : 'Only pending, unexpired requests can be canceled.',
    },
    {
      id: 'accept',
      label: 'Accept and send',
      enabled: pending && !expired && acceptanceCommand !== null,
      reason:
        acceptanceCommand !== null
          ? null
          : 'Acceptance requires a payer wallet and routes through the send engine.',
    },
    {
      id: 'decline',
      label: 'Decline',
      enabled: pending && !expired && canTransitionRequestStatus(request.status, 'declined'),
      reason:
        pending && !expired
          ? null
          : 'Only pending, unexpired requests can be declined.',
    },
  ];
}

export function buildPaymentsRequestAcceptanceSendCommand(input: {
  request: PaymentsPaymentRequestRecord;
  payerWalletId: string;
  clientSubmissionId?: string | null;
  quoteExpiresAt?: string | null;
  providerDeadlineAt?: string | null;
}): PaymentsSendCommand | null {
  if (input.request.status !== 'open' && input.request.status !== 'approved') {
    return null;
  }

  if (!input.payerWalletId.trim()) {
    return null;
  }

  const idempotencyKey = buildPaymentsSendIdempotencyKey({
    clientSubmissionId:
      input.clientSubmissionId?.trim() ||
      `request_accept_${input.request.requestId}`,
    sourceWalletId: input.payerWalletId,
    destinationWalletId: input.request.requesterWalletId,
    amountCents: input.request.amountCents,
    currency: input.request.currency,
  });

  return {
    type: 'send',
    idempotencyKey,
    sourceWalletId: input.payerWalletId,
    destinationWalletId: input.request.requesterWalletId,
    amountCents: input.request.amountCents,
    currency: input.request.currency,
    speed: 'standard',
    memo: input.request.memo ?? `Payment request ${input.request.requestId}`,
    externalReference: input.request.requestId,
    quoteExpiresAt: input.quoteExpiresAt ?? null,
    providerDeadlineAt: input.providerDeadlineAt ?? null,
    metadata: {
      acceptedPaymentRequestId: input.request.requestId,
      requestIdempotencyKey: input.request.idempotencyKey,
    },
  };
}

function buildRelatedHooks(): PaymentsRequestRelatedHook[] {
  return [
    {
      id: 'reminders',
      label: 'Reminders',
      detail: 'Reminder actions can use this request timeline and cooldown state.',
    },
    {
      id: 'disputes',
      label: 'Disputes',
      detail: 'Paid request detail can attach to transaction issue reporting.',
    },
    {
      id: 'rsvp',
      label: 'RSVP',
      detail: 'Group event collections can link to request ids later.',
    },
    {
      id: 'dining',
      label: 'Dining',
      detail: 'Dining bill splits can reuse the same request lifecycle.',
    },
  ];
}

export function buildPaymentsRequestDetailState(input: {
  request: PaymentsRequestRecord;
  serverNow: string;
  constraints?: PaymentsRequestAntiAbuseConstraints | null;
  acceptancePayerWalletId?: string | null;
  locale?: string;
}): PaymentsRequestDetailState {
  const lifecycle = lifecycleFromStatus(input.request.status);
  const amountLabel = formatPaymentsMoney(
    input.request.amountCents,
    input.request.currency,
    input.locale,
  );
  const timeline = buildRequestTimeline(input.request, input.serverNow);
  const acceptanceCommand = input.acceptancePayerWalletId
    ? buildPaymentsRequestAcceptanceSendCommand({
        request: input.request,
        payerWalletId: input.acceptancePayerWalletId,
      })
    : null;
  const serverNowMs = parseDateTime(input.serverNow) ?? Date.now();

  return {
    requestId: input.request.requestId,
    lifecycleState: lifecycle,
    status: input.request.status,
    statusLabel: requestStatusLabel(input.request.status),
    title:
      input.request.status === 'paid'
        ? 'Request paid'
        : input.request.status === 'declined'
          ? 'Request declined'
          : input.request.status === 'expired'
            ? 'Request expired'
            : input.request.status === 'canceled'
              ? 'Request canceled'
              : 'Request pending',
    subtitle:
      input.request.payerWalletId === null
        ? 'Shareable payment link'
        : input.request.payerDisplayName ?? 'Direct MyLife request',
    amountLabel,
    expiresAtLabel: input.request.expiresAt
      ? formatPaymentsAbsoluteDateTime(input.request.expiresAt, input.locale)
      : null,
    timeline,
    requesterTimeline: timeline,
    payerTimeline: timeline,
    actions: buildRequestActions({
      request: input.request,
      acceptanceCommand,
      constraints: input.constraints,
      serverNowMs,
    }),
    acceptanceCommand,
    disclosure: buildNotGuaranteedDisclosure(),
    relatedHooks: buildRelatedHooks(),
  };
}

function resolveFlowState(input: {
  submission: PaymentsRequestSubmissionState | null | undefined;
  result: PaymentsRequestResultState | null;
  blockReason: PaymentsRequestBlockReason | null;
  commandPreview: PaymentsRequestCommandPreview | null;
}): PaymentsRequestFlowState {
  if (input.submission?.status === 'submitting') {
    return 'submitting';
  }
  if (input.result) {
    return input.result.state;
  }
  if (input.blockReason) {
    return 'blocked';
  }
  if (input.commandPreview) {
    return 'ready_to_create';
  }
  return 'editing';
}

export function buildPaymentsRequestFlowViewModel(
  snapshot: PaymentsRequestFlowSnapshot,
): PaymentsRequestFlowViewModel {
  const legalCopyBlocks = buildLegalCopy(snapshot);
  const targetSearch = buildTargetSearch(snapshot.targets, snapshot.draft);
  const amount = parsePaymentsSendAmount(snapshot.draft.amountText);
  const serverNowMs = parseDateTime(snapshot.serverNow) ?? new Date().getTime();
  const blockReason = resolvePolicyBlock({
    snapshot,
    target: targetSearch.selected,
    amount,
    serverNowMs,
  });
  const commandPreview = buildCommandPreview({
    snapshot,
    target: targetSearch.selected,
    amount,
  });
  const preview = buildPreview({
    snapshot,
    target: targetSearch.selected,
    amount,
    legalCopyBlocks,
    blocked: blockReason !== null,
  });
  const result = mapPaymentsRequestSubmissionState(snapshot.submission);
  const selectedRequest =
    snapshot.existingRequests?.find(
      (request) => request.requestId === snapshot.selectedRequestId,
    ) ??
    (result?.requestId
      ? snapshot.existingRequests?.find((request) => request.requestId === result.requestId)
      : null) ??
    null;
  const detail = selectedRequest
    ? buildPaymentsRequestDetailState({
        request: selectedRequest,
        serverNow: snapshot.serverNow,
        constraints: snapshot.antiAbuse,
        acceptancePayerWalletId: snapshot.acceptancePayerWalletId,
        locale: snapshot.locale,
      })
    : null;
  const policyNotice = buildBlockingNotice(blockReason);
  const state = resolveFlowState({
    submission: snapshot.submission,
    result,
    blockReason,
    commandPreview,
  });
  const canCreate =
    state === 'ready_to_create' &&
    commandPreview !== null &&
    blockReason === null;

  return {
    title: 'Request',
    state,
    targetSearch,
    amount,
    note: snapshot.draft.note ?? '',
    preview,
    policyNotice,
    blockReason,
    commandPreview,
    canCreate,
    submitLabel: state === 'submitting' ? 'Creating' : 'Create request',
    result,
    detail,
    legalCopyBlocks,
  };
}

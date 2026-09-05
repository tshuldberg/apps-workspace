import type {
  PaymentsRail,
  PaymentsTransferKind,
} from '../cloud/rpc';
import {
  buildPaymentsIssueReportDraft,
  buildPaymentsTransferDisputeSummary,
} from '../compliance/disputes';
import type {
  PaymentsDisputeCase,
  PaymentsIssueReportDraft,
  PaymentsMarketDisputeContext,
  PaymentsTransferDisputeSummary,
} from '../compliance/disputes';
import {
  buildPaymentsLegalCopyBlocks,
} from '../compliance/disclosures/legal';
import {
  buildPaymentsReceiptPayload,
} from '../compliance/disclosures/receipts';
import {
  createPaymentsDisclosureCallout,
  formatPaymentsAbsoluteDate,
  formatPaymentsAbsoluteDateTime,
  formatPaymentsMoney,
  getPaymentsRailLabel,
  getPaymentsTransferStatusLabel,
  resolvePrimaryRail,
} from '../compliance/disclosures/content';
import type {
  PaymentsLegalCopyBlock,
  PaymentsReceiptPayload,
  PaymentsReceiptRemittanceContext,
  PaymentsRemittanceCancellationWindowInput,
} from '../compliance/disclosures/types';
import type {
  PaymentsPaymentRequestRecord,
  PaymentsRequestStatus,
  PaymentsTransferRecord,
  PaymentsTransferStatus,
} from '../engine/types';
import type {
  CurrencyCode,
  PaymentActivityItem,
  PaymentCounterparty,
  PaymentDisclosure,
  PaymentRail as UiPaymentRail,
  PaymentStatus,
  PaymentTimelineStep,
} from '../types';
import {
  buildPaymentsRequestDetailState,
} from './request';
import type {
  PaymentsRequestAntiAbuseConstraints,
  PaymentsRequestDetailState,
  PaymentsRequestRecord,
} from './request';

export type PaymentsActivityFilter =
  | 'all'
  | 'sent'
  | 'received'
  | 'pending'
  | 'requests'
  | 'card'
  | 'remittance';

export type PaymentsActivityItemKind =
  | 'wallet_transfer'
  | 'payment_request'
  | 'card_purchase'
  | 'escrow_hold'
  | 'remittance'
  | 'payout'
  | 'funding'
  | 'adjustment';

export type PaymentsActivityRecordSource = 'transfer' | 'request';

export interface PaymentsActivityTransferRecord {
  source: 'transfer';
  transfer: PaymentsTransferRecord;
  occurredAt: string;
  counterparty?: PaymentCounterparty | null;
  sourceDisplayName?: string | null;
  destinationDisplayName?: string | null;
  providerName?: string | null;
  providerReference?: string | null;
  quoteId?: string | null;
  relatedRequestId?: string | null;
  cardTransactionId?: string | null;
  remittance?: PaymentsReceiptRemittanceContext | null;
  cancellationWindow?: PaymentsRemittanceCancellationWindowInput | null;
  market?: PaymentsMarketDisputeContext | null;
}

export interface PaymentsActivityRequestRecord {
  source: 'request';
  request: PaymentsRequestRecord;
  occurredAt?: string | null;
  counterparty?: PaymentCounterparty | null;
}

export type PaymentsActivityRecord =
  | PaymentsActivityTransferRecord
  | PaymentsActivityRequestRecord;

export interface PaymentsActivityFeedSnapshot {
  ownerUserId: string;
  walletId: string;
  items: PaymentsActivityRecord[];
  now: string;
  filter?: PaymentsActivityFilter;
  selectedActivityId?: string | null;
  locale?: string;
  requestConstraints?: PaymentsRequestAntiAbuseConstraints | null;
  existingDisputes?: PaymentsDisputeCase[];
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  supportContact?: string | null;
}

export interface PaymentsActivityFilterOption {
  id: PaymentsActivityFilter;
  label: string;
  count: number;
}

export interface PaymentsActivityFeedRow {
  id: string;
  source: PaymentsActivityRecordSource;
  kind: PaymentsActivityItemKind;
  kindLabel: string;
  railLabel: string;
  statusLabel: string;
  filterTags: PaymentsActivityFilter[];
  item: PaymentActivityItem;
}

export interface PaymentsActivityFeedGroup {
  id: string;
  title: string;
  rows: PaymentsActivityFeedRow[];
}

export interface PaymentsActivityFeedViewModel {
  title: 'Activity';
  filter: PaymentsActivityFilter;
  filters: PaymentsActivityFilterOption[];
  groups: PaymentsActivityFeedGroup[];
  rows: PaymentsActivityFeedRow[];
  selectedDetail: PaymentsTransactionDetailViewModel | null;
  emptyState: {
    title: string;
    body: string;
  };
}

export interface PaymentsTransactionDetailLine {
  id: string;
  label: string;
  value: string;
  emphasis: 'neutral' | 'positive' | 'warning' | 'danger';
}

export interface PaymentsTransactionPartyLine {
  id: string;
  label: string;
  value: string;
}

export interface PaymentsTransactionReferenceLine {
  id: string;
  label: string;
  value: string;
}

export interface PaymentsTransactionIssueEntryPoint {
  label: string;
  enabled: boolean;
  reason: string | null;
  draft: PaymentsIssueReportDraft | null;
  summary: PaymentsTransferDisputeSummary | null;
}

export interface PaymentsTransactionDetailViewModel {
  id: string;
  source: PaymentsActivityRecordSource;
  kind: PaymentsActivityItemKind;
  kindLabel: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  amountCents: number;
  currency: CurrencyCode;
  direction: PaymentActivityItem['direction'];
  status: PaymentStatus;
  statusLabel: string;
  railLabel: string;
  parties: PaymentsTransactionPartyLine[];
  feeBreakdown: PaymentsTransactionDetailLine[];
  references: PaymentsTransactionReferenceLine[];
  timeline: PaymentTimelineStep[];
  note: string | null;
  disclosures: PaymentDisclosure[];
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  receipt: PaymentsReceiptPayload | null;
  requestDetail: PaymentsRequestDetailState | null;
  issueEntryPoint: PaymentsTransactionIssueEntryPoint;
}

const ACTIVITY_FILTERS: Array<{
  id: PaymentsActivityFilter;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'sent', label: 'Sent' },
  { id: 'received', label: 'Received' },
  { id: 'pending', label: 'Pending' },
  { id: 'requests', label: 'Requests' },
  { id: 'card', label: 'Card' },
  { id: 'remittance', label: 'Remittance' },
];

function compareIsoDesc(left: string, right: string): number {
  return new Date(right).getTime() - new Date(left).getTime();
}

function formatGroupTitle(isoLike: string, now: string, locale = 'en-US'): string {
  const date = new Date(isoLike);
  const current = new Date(now);
  if (Number.isNaN(date.getTime()) || Number.isNaN(current.getTime())) {
    return formatPaymentsAbsoluteDate(isoLike, locale);
  }

  const day = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const currentKey = day.format(current);
  const itemKey = day.format(date);
  const yesterday = new Date(current.getTime());
  yesterday.setDate(current.getDate() - 1);
  const yesterdayKey = day.format(yesterday);

  if (itemKey === currentKey) {
    return 'Today';
  }
  if (itemKey === yesterdayKey) {
    return 'Yesterday';
  }
  return formatPaymentsAbsoluteDate(isoLike, locale);
}

function transferAmountCents(transfer: PaymentsTransferRecord): number {
  return Math.abs(transfer.sourceAmountCents);
}

function transferCurrency(transfer: PaymentsTransferRecord): CurrencyCode {
  return transfer.sourceCurrency;
}

function requestOccurredAt(request: PaymentsRequestRecord): string {
  return (
    request.paidAt ??
    request.declinedAt ??
    request.expiredAt ??
    request.canceledAt ??
    request.updatedAt ??
    request.createdAt
  );
}

function transferDirection(
  transfer: PaymentsTransferRecord,
  walletId: string,
): PaymentActivityItem['direction'] {
  if (transfer.sourceWalletId === walletId && transfer.destinationWalletId !== walletId) {
    return 'outgoing';
  }
  if (transfer.destinationWalletId === walletId && transfer.sourceWalletId !== walletId) {
    return 'incoming';
  }
  return 'neutral';
}

function requestDirection(
  request: PaymentsPaymentRequestRecord,
  walletId: string,
): PaymentActivityItem['direction'] {
  if (request.requesterWalletId === walletId) {
    return 'incoming';
  }
  if (request.payerWalletId === walletId) {
    return 'outgoing';
  }
  return 'neutral';
}

function mapTransferStatus(status: PaymentsTransferStatus): PaymentStatus {
  switch (status) {
    case 'pending_review':
      return 'held';
    case 'pending_provider':
    case 'processing':
      return 'pending';
    case 'completed':
      return 'posted';
    case 'failed':
      return 'failed';
    case 'reversed':
      return 'reversed';
    case 'canceled':
      return 'canceled';
    case 'disputed':
      return 'held';
  }
}

function mapRequestStatus(status: PaymentsRequestStatus): PaymentStatus {
  switch (status) {
    case 'open':
    case 'approved':
      return 'pending';
    case 'paid':
      return 'posted';
    case 'declined':
      return 'failed';
    case 'expired':
    case 'canceled':
      return 'canceled';
  }
}

function requestStatusLabel(status: PaymentsRequestStatus): string {
  switch (status) {
    case 'open':
      return 'Pending';
    case 'approved':
      return 'Accepted';
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

function uiRailFromPaymentsRail(rail: PaymentsRail): UiPaymentRail {
  switch (rail) {
    case 'wallet':
      return 'wallet';
    case 'card':
      return 'card';
    case 'internal':
      return 'internal';
    case 'remittance':
      return 'remittance';
    case 'bank':
    case 'ach':
    case 'wire':
      return 'bank';
    case 'merchant':
      return 'internal';
  }
}

function transferKindLabel(kind: PaymentsTransferKind): string {
  switch (kind) {
    case 'p2p':
    case 'request_payment':
      return 'Wallet transfer';
    case 'fund_wallet':
      return 'Funding';
    case 'withdraw_wallet':
      return 'Payout';
    case 'merchant_charge':
    case 'merchant_refund':
      return 'Merchant payment';
    case 'card_authorization':
    case 'card_capture':
    case 'card_refund':
      return 'Card purchase';
    case 'escrow_hold':
    case 'escrow_release':
      return 'Escrow hold';
    case 'remittance_send':
    case 'remittance_refund':
      return 'Remittance';
    case 'adjustment':
      return 'Adjustment';
    case 'reversal':
      return 'Reversal';
  }
}

function activityKindFromTransfer(
  transfer: PaymentsTransferRecord,
): PaymentsActivityItemKind {
  switch (transfer.kind) {
    case 'card_authorization':
    case 'card_capture':
    case 'card_refund':
      return 'card_purchase';
    case 'escrow_hold':
    case 'escrow_release':
      return 'escrow_hold';
    case 'remittance_send':
    case 'remittance_refund':
      return 'remittance';
    case 'withdraw_wallet':
      return 'payout';
    case 'fund_wallet':
      return 'funding';
    case 'adjustment':
    case 'reversal':
      return 'adjustment';
    case 'merchant_charge':
    case 'merchant_refund':
    case 'p2p':
    case 'request_payment':
      return 'wallet_transfer';
  }
}

function titleForTransfer(input: {
  transfer: PaymentsTransferRecord;
  kind: PaymentsActivityItemKind;
  direction: PaymentActivityItem['direction'];
  counterparty?: PaymentCounterparty | null;
}): string {
  if (input.counterparty?.displayName) {
    if (input.kind === 'card_purchase') {
      return input.counterparty.displayName;
    }
    return input.direction === 'incoming'
      ? `From ${input.counterparty.displayName}`
      : `To ${input.counterparty.displayName}`;
  }

  return transferKindLabel(input.transfer.kind);
}

function requestTitle(
  request: PaymentsRequestRecord,
  direction: PaymentActivityItem['direction'],
): string {
  if (request.status === 'paid') {
    return 'Request paid';
  }
  if (request.status === 'declined') {
    return 'Request declined';
  }
  if (request.status === 'expired') {
    return 'Request expired';
  }
  if (request.status === 'canceled') {
    return 'Request canceled';
  }
  return direction === 'outgoing' ? 'Payment request' : 'Request sent';
}

function tagsForTransfer(
  row: {
    direction: PaymentActivityItem['direction'];
    status: PaymentStatus;
    kind: PaymentsActivityItemKind;
  },
): PaymentsActivityFilter[] {
  const tags: PaymentsActivityFilter[] = ['all'];
  if (row.direction === 'outgoing') {
    tags.push('sent');
  }
  if (row.direction === 'incoming') {
    tags.push('received');
  }
  if (row.status === 'pending' || row.status === 'held') {
    tags.push('pending');
  }
  if (row.kind === 'card_purchase') {
    tags.push('card');
  }
  if (row.kind === 'remittance') {
    tags.push('remittance');
  }
  return tags;
}

function tagsForRequest(row: {
  direction: PaymentActivityItem['direction'];
  status: PaymentStatus;
}): PaymentsActivityFilter[] {
  const tags: PaymentsActivityFilter[] = ['all', 'requests'];
  if (row.direction === 'outgoing') {
    tags.push('sent');
  }
  if (row.direction === 'incoming') {
    tags.push('received');
  }
  if (row.status === 'pending') {
    tags.push('pending');
  }
  return tags;
}

function rowFromTransfer(
  record: PaymentsActivityTransferRecord,
  walletId: string,
): PaymentsActivityFeedRow {
  const transfer = record.transfer;
  const kind = activityKindFromTransfer(transfer);
  const direction = transferDirection(transfer, walletId);
  const status = mapTransferStatus(transfer.status);
  const rail = resolvePrimaryRail({
    sourceRail: transfer.sourceRail,
    destinationRail: transfer.destinationRail,
  });
  const item: PaymentActivityItem = {
    id: transfer.transferId,
    title: titleForTransfer({
      transfer,
      kind,
      direction,
      counterparty: record.counterparty,
    }),
    subtitle: transferKindLabel(transfer.kind),
    amountCents: transferAmountCents(transfer),
    currency: transferCurrency(transfer),
    direction,
    status,
    rail: uiRailFromPaymentsRail(rail),
    counterparty: record.counterparty ?? undefined,
    occurredAt: record.occurredAt,
    note: transfer.memo ?? undefined,
    pendingReason:
      transfer.status === 'pending_review'
        ? 'Manual review'
        : transfer.status === 'pending_provider'
          ? 'Provider confirmation'
          : undefined,
  };

  return {
    id: transfer.transferId,
    source: 'transfer',
    kind,
    kindLabel: transferKindLabel(transfer.kind),
    railLabel: getPaymentsRailLabel(rail),
    statusLabel: getPaymentsTransferStatusLabel(transfer.status),
    filterTags: tagsForTransfer({
      direction,
      status,
      kind,
    }),
    item,
  };
}

function rowFromRequest(
  record: PaymentsActivityRequestRecord,
  walletId: string,
): PaymentsActivityFeedRow {
  const request = record.request;
  const direction = requestDirection(request, walletId);
  const status = mapRequestStatus(request.status);
  const occurredAt = record.occurredAt ?? requestOccurredAt(request);
  const item: PaymentActivityItem = {
    id: request.requestId,
    title: requestTitle(request, direction),
    subtitle:
      request.payerWalletId === null
        ? 'Payment link'
        : direction === 'incoming'
          ? request.payerDisplayName ?? 'Waiting on payer'
          : request.requesterDisplayName ?? 'Payment request',
    amountCents: request.amountCents,
    currency: request.currency,
    direction,
    status,
    rail: 'wallet',
    counterparty: record.counterparty ?? undefined,
    occurredAt,
    note: request.memo ?? undefined,
    pendingReason: status === 'pending' ? 'Funds have not moved yet' : undefined,
  };

  return {
    id: request.requestId,
    source: 'request',
    kind: 'payment_request',
    kindLabel: 'Payment request',
    railLabel: 'Wallet',
    statusLabel: requestStatusLabel(request.status),
    filterTags: tagsForRequest({
      direction,
      status,
    }),
    item,
  };
}

function buildRows(
  records: PaymentsActivityRecord[],
  walletId: string,
): PaymentsActivityFeedRow[] {
  return records
    .map((record) => (
      record.source === 'transfer'
        ? rowFromTransfer(record, walletId)
        : rowFromRequest(record, walletId)
    ))
    .sort((left, right) => compareIsoDesc(left.item.occurredAt, right.item.occurredAt));
}

function groupRows(input: {
  rows: PaymentsActivityFeedRow[];
  now: string;
  locale?: string;
}): PaymentsActivityFeedGroup[] {
  const groups = new Map<string, PaymentsActivityFeedRow[]>();

  for (const row of input.rows) {
    const title = formatGroupTitle(row.item.occurredAt, input.now, input.locale);
    const key = `${title}:${formatPaymentsAbsoluteDate(row.item.occurredAt, input.locale)}`;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([id, rows]) => ({
    id,
    title: id.split(':')[0] ?? id,
    rows,
  }));
}

function filterRows(
  rows: PaymentsActivityFeedRow[],
  filter: PaymentsActivityFilter,
): PaymentsActivityFeedRow[] {
  if (filter === 'all') {
    return rows;
  }
  return rows.filter((row) => row.filterTags.includes(filter));
}

function buildLegalCopy(input: PaymentsActivityFeedSnapshot): PaymentsLegalCopyBlock[] {
  return buildPaymentsLegalCopyBlocks({
    blockIds: [
      'stored_balance',
      'partner_bank',
      'custodial_account',
      'error_resolution',
    ],
    locale: input.locale,
    generatedAt: input.now,
    surfaces: ['mobile'],
    productName: input.productName,
    partnerBankName: input.partnerBankName,
    custodialEntityName: input.custodialEntityName,
    supportContact: input.supportContact,
  });
}

function normalizeNow(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function makeTransferTimeline(input: {
  transfer: PaymentsTransferRecord;
  occurredAt: string;
  locale?: string;
}): PaymentTimelineStep[] {
  const occurredAt = formatPaymentsAbsoluteDateTime(input.occurredAt, input.locale);
  const providerReference = input.transfer.externalReference;

  switch (input.transfer.status) {
    case 'pending_review':
      return [
        {
          id: 'created',
          title: 'Created',
          detail: 'The server accepted the transfer intent.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'review',
          title: 'Manual review',
          detail: 'Money movement is paused until compliance review clears.',
          state: 'current',
        },
        {
          id: 'posted',
          title: 'Posted',
          detail: 'Funds move after the review state resolves.',
          state: 'upcoming',
        },
      ];
    case 'pending_provider':
    case 'processing':
      return [
        {
          id: 'created',
          title: 'Created',
          detail: 'The server accepted the transfer intent.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'provider',
          title: 'Provider processing',
          detail: providerReference
            ? `Provider reference ${providerReference}`
            : 'Waiting on the provider confirmation.',
          state: 'current',
        },
        {
          id: 'posted',
          title: 'Posted',
          detail: 'The final balance update appears after provider confirmation.',
          state: 'upcoming',
        },
      ];
    case 'completed':
      return [
        {
          id: 'created',
          title: 'Created',
          detail: 'The server accepted the transfer intent.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'provider',
          title: 'Provider confirmed',
          detail: providerReference
            ? `Provider reference ${providerReference}`
            : 'Provider confirmation is recorded.',
          state: 'complete',
        },
        {
          id: 'posted',
          title: 'Posted',
          detail: 'Ledger entries are reflected in available, pending, or escrow balances.',
          state: 'complete',
        },
      ];
    case 'failed':
      return [
        {
          id: 'created',
          title: 'Created',
          detail: 'The server accepted the transfer intent.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'failed',
          title: 'Failed',
          detail: 'The transfer did not complete. Use the detail references before retrying.',
          state: 'blocked',
        },
      ];
    case 'reversed':
      return [
        {
          id: 'posted',
          title: 'Posted',
          detail: 'The original transfer posted.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'reversed',
          title: 'Reversed',
          detail: 'A reversal entry has been applied to the ledger.',
          state: 'blocked',
        },
      ];
    case 'canceled':
      return [
        {
          id: 'created',
          title: 'Created',
          detail: 'The server accepted the transfer intent.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'canceled',
          title: 'Canceled',
          detail: 'The transfer was canceled before completion.',
          state: 'blocked',
        },
      ];
    case 'disputed':
      return [
        {
          id: 'posted',
          title: 'Posted',
          detail: 'The original transfer posted.',
          timestamp: occurredAt,
          state: 'complete',
        },
        {
          id: 'disputed',
          title: 'Issue open',
          detail: 'Error resolution is attached to this transaction.',
          state: 'current',
        },
      ];
  }
}

function makeTransferDisclosure(input: {
  transfer: PaymentsTransferRecord;
  kind: PaymentsActivityItemKind;
  disputeSummary: PaymentsTransferDisputeSummary;
}): PaymentDisclosure {
  if (input.disputeSummary.hasActiveCase) {
    return createPaymentsDisclosureCallout({
      id: 'activity_detail_issue_open',
      tone: 'warning',
      title: input.disputeSummary.headline,
      body: input.disputeSummary.nextStep,
    });
  }

  if (input.kind === 'escrow_hold') {
    return createPaymentsDisclosureCallout({
      id: 'activity_detail_escrow_hold',
      tone: 'info',
      title: 'Escrow balance',
      body: 'This activity is shown as a hold until the related release, reversal, or dispute updates the ledger.',
    });
  }

  return createPaymentsDisclosureCallout({
    id: 'activity_detail_server_authoritative',
    tone: input.transfer.status === 'failed' ? 'danger' : 'info',
    title: 'Server-authoritative status',
    body: 'Activity detail reflects the latest transfer state from the payments engine and provider references.',
  });
}

function makeFeeBreakdown(input: {
  transfer: PaymentsTransferRecord;
  locale?: string;
}): PaymentsTransactionDetailLine[] {
  const transfer = input.transfer;
  const currency = transferCurrency(transfer);
  return [
    {
      id: 'amount',
      label: 'Amount',
      value: formatPaymentsMoney(transferAmountCents(transfer), currency, input.locale),
      emphasis: 'neutral',
    },
    {
      id: 'fee',
      label: 'Fee',
      value: formatPaymentsMoney(transfer.feeAmountCents, currency, input.locale),
      emphasis: transfer.feeAmountCents > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'total',
      label: 'Total impact',
      value: formatPaymentsMoney(
        transferAmountCents(transfer) + transfer.feeAmountCents,
        currency,
        input.locale,
      ),
      emphasis: 'neutral',
    },
  ];
}

function makeRequestFeeBreakdown(input: {
  request: PaymentsRequestRecord;
  locale?: string;
}): PaymentsTransactionDetailLine[] {
  return [
    {
      id: 'request_amount',
      label: 'Requested amount',
      value: formatPaymentsMoney(input.request.amountCents, input.request.currency, input.locale),
      emphasis: 'neutral',
    },
    {
      id: 'movement',
      label: 'Funds moved',
      value: input.request.status === 'paid' ? 'Accepted transfer required' : 'Not yet',
      emphasis: input.request.status === 'paid' ? 'positive' : 'warning',
    },
  ];
}

function partiesFromReceipt(
  receipt: PaymentsReceiptPayload,
): PaymentsTransactionPartyLine[] {
  return receipt.parties.map((party) => ({
    id: party.role,
    label: party.label,
    value: party.value,
  }));
}

function requestParties(
  request: PaymentsRequestRecord,
): PaymentsTransactionPartyLine[] {
  return [
    {
      id: 'requester',
      label: 'Requester',
      value: request.requesterDisplayName ?? request.requesterWalletId,
    },
    {
      id: 'payer',
      label: request.payerWalletId ? 'Payer' : 'Payer',
      value: request.payerDisplayName ?? request.payerWalletId ?? 'Payment link recipient',
    },
  ];
}

function referencesFromReceipt(
  receipt: PaymentsReceiptPayload,
): PaymentsTransactionReferenceLine[] {
  return receipt.references.map((reference) => ({
    id: reference.key,
    label: reference.label,
    value: reference.value,
  }));
}

function requestReferences(
  request: PaymentsRequestRecord,
): PaymentsTransactionReferenceLine[] {
  return [
    {
      id: 'request_id',
      label: 'Request ID',
      value: request.requestId,
    },
    ...(request.paymentLinkId
      ? [
          {
            id: 'payment_link_id',
            label: 'Payment link',
            value: request.paymentLinkId,
          },
        ]
      : []),
    ...(request.acceptedTransferId
      ? [
          {
            id: 'accepted_transfer_id',
            label: 'Accepted transfer',
            value: request.acceptedTransferId,
          },
        ]
      : []),
  ];
}

function makeTransferIssueEntryPoint(input: {
  snapshot: PaymentsActivityFeedSnapshot;
  record: PaymentsActivityTransferRecord;
  disputeSummary: PaymentsTransferDisputeSummary;
}): PaymentsTransactionIssueEntryPoint {
  const draft = buildPaymentsIssueReportDraft({
    ownerUserId: input.snapshot.ownerUserId,
    walletId: input.snapshot.walletId,
    transfer: input.record.transfer,
    transferOccurredAt: input.record.occurredAt,
    now: normalizeNow(input.snapshot.now),
    counterparty: input.record.counterparty,
    existingCases: input.snapshot.existingDisputes,
    cardTransactionId: input.record.cardTransactionId,
    providerName: input.record.providerName,
    market: input.record.market,
  });

  return {
    label: 'Report an issue',
    enabled: draft.reportable,
    reason: draft.blockedReason,
    draft,
    summary: input.disputeSummary,
  };
}

function makeRequestIssueEntryPoint(): PaymentsTransactionIssueEntryPoint {
  return {
    label: 'Report from paid transfer',
    enabled: false,
    reason: 'Requests are not guaranteed receivables. Report an issue from the accepted transfer once funds move.',
    draft: null,
    summary: null,
  };
}

function buildTransferDetail(
  snapshot: PaymentsActivityFeedSnapshot,
  record: PaymentsActivityTransferRecord,
): PaymentsTransactionDetailViewModel {
  const row = rowFromTransfer(record, snapshot.walletId);
  const transfer = record.transfer;
  const legalCopyBlocks = buildLegalCopy(snapshot);
  const receipt = buildPaymentsReceiptPayload({
    transfer,
    occurredAt: record.occurredAt,
    issuedAt: snapshot.now,
    locale: snapshot.locale,
    generatedAt: snapshot.now,
    surfaces: ['mobile'],
    counterparty: record.counterparty,
    sourceDisplayName: record.sourceDisplayName,
    destinationDisplayName: record.destinationDisplayName,
    providerName: record.providerName,
    providerReference: record.providerReference ?? transfer.externalReference,
    quoteId: record.quoteId,
    relatedTransferId: record.relatedRequestId,
    remittance: record.remittance,
    cancellationWindow: record.cancellationWindow,
    productName: snapshot.productName,
    partnerBankName: snapshot.partnerBankName,
    custodialEntityName: snapshot.custodialEntityName,
    supportContact: snapshot.supportContact,
  });
  const disputeSummary = buildPaymentsTransferDisputeSummary({
    transfer,
    disputes: snapshot.existingDisputes,
  });

  return {
    id: transfer.transferId,
    source: 'transfer',
    kind: row.kind,
    kindLabel: row.kindLabel,
    title: row.item.title,
    subtitle: `${row.railLabel} - ${row.statusLabel}`,
    amountLabel: formatPaymentsMoney(
      transferAmountCents(transfer),
      transferCurrency(transfer),
      snapshot.locale,
    ),
    amountCents: transferAmountCents(transfer),
    currency: transferCurrency(transfer),
    direction: row.item.direction,
    status: row.item.status,
    statusLabel: row.statusLabel,
    railLabel: row.railLabel,
    parties: partiesFromReceipt(receipt),
    feeBreakdown: makeFeeBreakdown({
      transfer,
      locale: snapshot.locale,
    }),
    references: referencesFromReceipt(receipt),
    timeline: makeTransferTimeline({
      transfer,
      occurredAt: record.occurredAt,
      locale: snapshot.locale,
    }),
    note: transfer.memo ?? null,
    disclosures: [
      makeTransferDisclosure({
        transfer,
        kind: row.kind,
        disputeSummary,
      }),
      ...receipt.callouts,
    ],
    legalCopyBlocks,
    receipt,
    requestDetail: null,
    issueEntryPoint: makeTransferIssueEntryPoint({
      snapshot,
      record,
      disputeSummary,
    }),
  };
}

function buildRequestDetail(
  snapshot: PaymentsActivityFeedSnapshot,
  record: PaymentsActivityRequestRecord,
): PaymentsTransactionDetailViewModel {
  const row = rowFromRequest(record, snapshot.walletId);
  const request = record.request;
  const detail = buildPaymentsRequestDetailState({
    request,
    serverNow: snapshot.now,
    constraints: snapshot.requestConstraints,
    acceptancePayerWalletId: request.payerWalletId,
    locale: snapshot.locale,
  });

  return {
    id: request.requestId,
    source: 'request',
    kind: 'payment_request',
    kindLabel: 'Payment request',
    title: row.item.title,
    subtitle: detail.subtitle,
    amountLabel: formatPaymentsMoney(request.amountCents, request.currency, snapshot.locale),
    amountCents: request.amountCents,
    currency: request.currency,
    direction: row.item.direction,
    status: row.item.status,
    statusLabel: row.statusLabel,
    railLabel: 'Wallet',
    parties: requestParties(request),
    feeBreakdown: makeRequestFeeBreakdown({
      request,
      locale: snapshot.locale,
    }),
    references: requestReferences(request),
    timeline: detail.timeline,
    note: request.memo ?? null,
    disclosures: [
      detail.disclosure,
      createPaymentsDisclosureCallout({
        id: 'activity_request_not_receivable',
        tone: 'warning',
        title: 'Not a guaranteed receivable',
        body: 'A request is pending until the payer accepts and the send engine moves funds.',
      }),
    ],
    legalCopyBlocks: buildLegalCopy(snapshot),
    receipt: null,
    requestDetail: detail,
    issueEntryPoint: makeRequestIssueEntryPoint(),
  };
}

export function buildPaymentsTransactionDetailViewModel(
  snapshot: PaymentsActivityFeedSnapshot,
): PaymentsTransactionDetailViewModel | null {
  const selectedId = snapshot.selectedActivityId;
  if (!selectedId) {
    return null;
  }

  const record = snapshot.items.find((item) => {
    if (item.source === 'transfer') {
      return item.transfer.transferId === selectedId;
    }
    return item.request.requestId === selectedId;
  });

  if (!record) {
    return null;
  }

  if (record.source === 'transfer') {
    return buildTransferDetail(snapshot, record);
  }

  return buildRequestDetail(snapshot, record);
}

export function buildPaymentsActivityFeedViewModel(
  snapshot: PaymentsActivityFeedSnapshot,
): PaymentsActivityFeedViewModel {
  const filter = snapshot.filter ?? 'all';
  const allRows = buildRows(snapshot.items, snapshot.walletId);
  const rows = filterRows(allRows, filter);
  const filters = ACTIVITY_FILTERS.map((option) => ({
    ...option,
    count: filterRows(allRows, option.id).length,
  }));

  return {
    title: 'Activity',
    filter,
    filters,
    groups: groupRows({
      rows,
      now: snapshot.now,
      locale: snapshot.locale,
    }),
    rows,
    selectedDetail: buildPaymentsTransactionDetailViewModel(snapshot),
    emptyState: {
      title: 'No matching activity',
      body: 'Transfers, requests, card purchases, remittances, and payouts appear here after the server records them.',
    },
  };
}

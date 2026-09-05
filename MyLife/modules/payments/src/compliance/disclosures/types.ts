import type {
  PaymentsRail,
  PaymentsTransferKind,
} from '../../cloud/rpc';
import type {
  PaymentsTransferRecord,
  PaymentsTransferStatus,
} from '../../engine/types';
import type {
  CurrencyCode,
  PaymentCounterparty,
  PaymentDisclosure,
} from '../../types';

export const PAYMENTS_DISCLOSURE_LOCALES = ['en-US'] as const;
export type PaymentsDisclosureLocale =
  (typeof PAYMENTS_DISCLOSURE_LOCALES)[number];

export const PAYMENTS_DISCLOSURE_SURFACES = [
  'mobile',
  'web',
  'email',
  'pdf',
  'support_export',
] as const;
export type PaymentsDisclosureSurface =
  (typeof PAYMENTS_DISCLOSURE_SURFACES)[number];

export const PAYMENTS_CONTENT_EMPHASIS = [
  'neutral',
  'strong',
  'positive',
  'warning',
] as const;
export type PaymentsContentEmphasis =
  (typeof PAYMENTS_CONTENT_EMPHASIS)[number];

export interface PaymentsContentMeta {
  locale: string;
  resolvedLocale: PaymentsDisclosureLocale;
  generatedAt: string;
  templateVersion: string;
  surfaces: PaymentsDisclosureSurface[];
}

export interface PaymentsFactLine {
  lineId: string;
  label: string;
  value: string;
  emphasis: PaymentsContentEmphasis;
  footnote: string | null;
}

export interface PaymentsContentSection {
  sectionId: string;
  title: string;
  summary: string | null;
  paragraphs: string[];
  bullets: string[];
  facts: PaymentsFactLine[];
}

export const PAYMENTS_LEGAL_COPY_BLOCK_IDS = [
  'stored_balance',
  'partner_bank',
  'custodial_account',
  'debit_card',
  'stablecoin_rail',
  'remittance_cancellation',
  'error_resolution',
] as const;
export type PaymentsLegalCopyBlockId =
  (typeof PAYMENTS_LEGAL_COPY_BLOCK_IDS)[number];

export const PAYMENTS_LEGAL_COPY_PLACEMENTS = [
  'wallet_settings',
  'funding',
  'quote',
  'receipt',
  'transfer_detail',
  'card',
  'support_export',
] as const;
export type PaymentsLegalCopyPlacement =
  (typeof PAYMENTS_LEGAL_COPY_PLACEMENTS)[number];

export interface PaymentsLegalCopyBlock {
  blockId: PaymentsLegalCopyBlockId;
  title: string;
  summary: string;
  body: string[];
  footnote: string | null;
  version: string;
  effectiveAt: string;
  surfaces: PaymentsDisclosureSurface[];
  placements: PaymentsLegalCopyPlacement[];
  tags: string[];
}

export interface PaymentsDisclosureBundle {
  bundleId: string;
  meta: PaymentsContentMeta;
  callouts: PaymentDisclosure[];
  sections: PaymentsContentSection[];
  legalCopyBlocks: PaymentsLegalCopyBlock[];
}

export interface PaymentsLegalCopyRuntimeContext {
  productName?: string | null;
  partnerBankName?: string | null;
  custodialEntityName?: string | null;
  cardProgramName?: string | null;
  supportLabel?: string | null;
  supportContact?: string | null;
  supportReference?: string | null;
  stablecoinRailEnabled?: boolean;
}

export interface BuildPaymentsLegalCopyBlocksInput
  extends PaymentsLegalCopyRuntimeContext {
  blockIds: readonly PaymentsLegalCopyBlockId[];
  locale?: string;
  generatedAt?: string;
  surfaces?: PaymentsDisclosureSurface[];
  cancellationWindow?: PaymentsRemittanceCancellationWindow | null;
}

export const PAYMENTS_REMITTANCE_CORRIDOR_STATUSES = [
  'available',
  'limited',
  'unavailable',
] as const;
export type PaymentsRemittanceCorridorStatus =
  (typeof PAYMENTS_REMITTANCE_CORRIDOR_STATUSES)[number];

export interface PaymentsRemittanceCorridorAvailability {
  status: PaymentsRemittanceCorridorStatus;
  corridor: string;
  reason: string | null;
  availablePayoutMethods: string[];
  checkedAt: string | null;
}

export interface PaymentsDeliveryEstimate {
  label: string | null;
  estimatedAt: string | null;
  earliestAt: string | null;
  latestAt: string | null;
}

export interface PaymentsRemittanceCancellationWindow {
  cancelable: boolean;
  cancelBy: string | null;
  reason: string | null;
  version: string;
  effectiveAt: string;
}

export interface PaymentsRemittanceCancellationWindowInput {
  cancelable: boolean;
  cancelBy?: string | null;
  reason?: string | null;
  version?: string | null;
  effectiveAt?: string | null;
}

export const PAYMENTS_RECORDKEEPING_REQUIREMENTS = [
  'not_required',
  'prepared',
  'required',
] as const;
export type PaymentsRecordkeepingRequirement =
  (typeof PAYMENTS_RECORDKEEPING_REQUIREMENTS)[number];

export interface PaymentsRecordkeepingParty {
  fullName: string | null;
  countryCode: string | null;
  accountReference: string | null;
  addressLine: string | null;
  phoneE164: string | null;
  walletHandle: string | null;
}

export interface PaymentsRecordkeepingPayload {
  requirement: PaymentsRecordkeepingRequirement;
  reference: string | null;
  originator: PaymentsRecordkeepingParty;
  recipient: PaymentsRecordkeepingParty;
  notes: string[];
}

export interface PaymentsRecordkeepingPartyInput {
  fullName?: string | null;
  countryCode?: string | null;
  accountReference?: string | null;
  addressLine?: string | null;
  phoneE164?: string | null;
  walletHandle?: string | null;
}

export interface PaymentsRecordkeepingInput {
  requirement?: PaymentsRecordkeepingRequirement;
  reference?: string | null;
  originator?: PaymentsRecordkeepingPartyInput | null;
  recipient?: PaymentsRecordkeepingPartyInput | null;
  notes?: string[];
}

export interface BuildPaymentsRemittanceQuoteDisclosureInput
  extends PaymentsLegalCopyRuntimeContext {
  quoteId?: string | null;
  providerName: string;
  corridor: string;
  sourceAmountCents: number;
  sourceCurrency: CurrencyCode;
  destinationAmountCents: number;
  destinationCurrency: CurrencyCode;
  exchangeRate: string;
  feeCents: number;
  expiresAt: string;
  locale?: string;
  generatedAt?: string;
  surfaces?: PaymentsDisclosureSurface[];
  corridorAvailability?: PaymentsRemittanceCorridorAvailability | null;
  deliveryEstimate?: PaymentsDeliveryEstimate | null;
  cancellationWindow?: PaymentsRemittanceCancellationWindowInput | null;
  recordkeeping?: PaymentsRecordkeepingInput | null;
}

export interface PaymentsRemittanceQuotePayload {
  kind: 'remittance_quote';
  quoteId: string | null;
  providerName: string;
  corridor: string;
  breakdown: PaymentsFactLine[];
  availability: PaymentsRemittanceCorridorAvailability;
  deliveryEstimate: PaymentsDeliveryEstimate | null;
  cancellationWindow: PaymentsRemittanceCancellationWindow;
  recordkeeping: PaymentsRecordkeepingPayload;
  disclosureBundle: PaymentsDisclosureBundle;
}

export const PAYMENTS_RECEIPT_KINDS = [
  'p2p',
  'merchant',
  'card',
  'remittance',
  'refund',
  'reversal',
] as const;
export type PaymentsReceiptKind = (typeof PAYMENTS_RECEIPT_KINDS)[number];

export const PAYMENTS_RECEIPT_PARTY_ROLES = [
  'sender',
  'recipient',
  'merchant',
  'cardholder',
  'operator',
] as const;
export type PaymentsReceiptPartyRole =
  (typeof PAYMENTS_RECEIPT_PARTY_ROLES)[number];

export interface PaymentsReceiptParty {
  role: PaymentsReceiptPartyRole;
  label: string;
  value: string;
}

export interface PaymentsReceiptReference {
  key: string;
  label: string;
  value: string;
}

export interface PaymentsReceiptRemittanceContext {
  remittanceId?: string | null;
  corridor?: string | null;
  recipientName?: string | null;
  recipientCountryCode?: string | null;
  payoutMethod?: string | null;
  exchangeRate?: string | null;
  estimatedDeliveryAt?: string | null;
  recordkeeping?: PaymentsRecordkeepingInput | null;
}

export interface BuildPaymentsReceiptInput
  extends PaymentsLegalCopyRuntimeContext {
  transfer: PaymentsTransferRecord;
  occurredAt: string;
  issuedAt?: string;
  locale?: string;
  generatedAt?: string;
  surfaces?: PaymentsDisclosureSurface[];
  counterparty?: PaymentCounterparty | null;
  sourceDisplayName?: string | null;
  destinationDisplayName?: string | null;
  providerName?: string | null;
  providerReference?: string | null;
  quoteId?: string | null;
  relatedTransferId?: string | null;
  remittance?: PaymentsReceiptRemittanceContext | null;
  cancellationWindow?: PaymentsRemittanceCancellationWindowInput | null;
}

export interface PaymentsReceiptPayload {
  kind: 'receipt';
  receiptId: string;
  receiptKind: PaymentsReceiptKind;
  transferKind: PaymentsTransferKind;
  transferId: string;
  transferStatus: PaymentsTransferStatus;
  rail: PaymentsRail;
  title: string;
  subtitle: string;
  meta: PaymentsContentMeta;
  amountBreakdown: PaymentsFactLine[];
  parties: PaymentsReceiptParty[];
  references: PaymentsReceiptReference[];
  sections: PaymentsContentSection[];
  callouts: PaymentDisclosure[];
  legalCopyBlocks: PaymentsLegalCopyBlock[];
  recordkeeping: PaymentsRecordkeepingPayload | null;
}

export interface BuildPaymentsTransferDetailPayloadInput
  extends BuildPaymentsReceiptInput {
  remittanceQuote?: BuildPaymentsRemittanceQuoteDisclosureInput | null;
}

export interface PaymentsTransferDetailPayload {
  transferId: string;
  rail: PaymentsRail;
  status: PaymentsTransferStatus;
  headline: string;
  meta: PaymentsContentMeta;
  disclosureBundle: PaymentsDisclosureBundle;
  receipt: PaymentsReceiptPayload;
}

import type { PaymentsWalletType } from '../cloud/rpc';
import type { PaymentVerificationState } from '../types';

export const PAYMENTS_IDENTITY_SUBJECT_TYPES = [
  'individual',
  'business',
] as const;

export type PaymentsIdentitySubjectType =
  (typeof PAYMENTS_IDENTITY_SUBJECT_TYPES)[number];

export const PAYMENTS_IDENTITY_STATUSES = [
  'unsubmitted',
  'pending',
  'verified',
  'rejected',
  'restricted',
] as const;

export type PaymentsIdentityStatus =
  (typeof PAYMENTS_IDENTITY_STATUSES)[number];

export const PAYMENTS_IDENTITY_TIERS = [
  'unverified',
  'basic',
  'standard',
  'full',
] as const;

export type PaymentsIdentityTier = (typeof PAYMENTS_IDENTITY_TIERS)[number];

export const PAYMENTS_PROFILE_VISIBILITIES = [
  'private',
  'contacts_only',
  'searchable',
] as const;

export type PaymentsProfileVisibility =
  (typeof PAYMENTS_PROFILE_VISIBILITIES)[number];

export const PAYMENTS_PROFILE_IDENTIFIER_KINDS = [
  'handle',
  'email',
  'phone',
] as const;

export type PaymentsProfileIdentifierKind =
  (typeof PAYMENTS_PROFILE_IDENTIFIER_KINDS)[number];

export const PAYMENTS_IDENTITY_FIELD_KEYS = [
  'legalName',
  'email',
  'phoneE164',
  'dateOfBirth',
  'addressLine1',
  'city',
  'regionCode',
  'postalCode',
  'governmentIdLast4',
  'businessName',
  'businessType',
  'taxIdLast4',
  'beneficialOwnerCount',
  'registrationNumber',
  'websiteUrl',
] as const;

export type PaymentsIdentityFieldKey =
  (typeof PAYMENTS_IDENTITY_FIELD_KEYS)[number];

export type PaymentsIdentityFieldValue = string | number | boolean | null;

export type PaymentsIdentityFields = Partial<
  Record<PaymentsIdentityFieldKey, PaymentsIdentityFieldValue>
>;

export interface PaymentsVerificationMethod {
  value: string | null;
  verificationState: PaymentVerificationState;
  verifiedAt: string | null;
  discoverable: boolean;
}

export interface PaymentsProfileDiscoverability {
  visibility: PaymentsProfileVisibility;
  allowHandleLookup: boolean;
  allowEmailLookup: boolean;
  allowPhoneLookup: boolean;
}

export interface PaymentsTierCapabilities {
  canSend: boolean;
  canReceive: boolean;
  canRemit: boolean;
  canIssueCards: boolean;
  canAcceptMerchantQr: boolean;
  canReceiveMarketSellerPayouts: boolean;
}

export interface PaymentsTierLimitProfile {
  sendSingleMaxCents: number;
  sendRollingDailyMaxCents: number;
  receiveRollingDailyMaxCents: number;
  walletBalanceMaxCents: number;
  remittanceRollingDailyMaxCents: number;
  merchantSettlementRollingDailyMaxCents: number;
  capabilities: PaymentsTierCapabilities;
}

export interface PaymentsTierAssessment {
  approvedTier: PaymentsIdentityTier;
  completedTier: PaymentsIdentityTier;
  nextTier: PaymentsIdentityTier | null;
  missingFields: PaymentsIdentityFieldKey[];
  upgradeReady: boolean;
  currentLimits: PaymentsTierLimitProfile;
}

export interface PaymentsTierAssessmentInput {
  subjectType: PaymentsIdentitySubjectType;
  identityStatus: PaymentsIdentityStatus;
  verificationState: PaymentVerificationState;
  approvedTier?: PaymentsIdentityTier;
  fields?: PaymentsIdentityFields;
}

export const PAYMENTS_HANDLE_RESERVATION_DECISIONS = [
  'granted',
  'already_owned',
  'reserved_word',
  'taken',
] as const;

export type PaymentsHandleReservationDecision =
  (typeof PAYMENTS_HANDLE_RESERVATION_DECISIONS)[number];

export interface PaymentsHandleRecord {
  ownerUserId: string;
  handle: string;
  releasedAt?: string | null;
}

export interface PaymentsHandleReservationInput {
  requestedHandle: string;
  ownerUserId: string;
  existing: PaymentsHandleRecord[];
}

export interface PaymentsHandleReservationResult {
  ok: boolean;
  decision: PaymentsHandleReservationDecision;
  normalizedHandle: string;
  searchKey: string;
  ownerUserId: string | null;
}

export interface PaymentsProfileSearchEntry {
  kind: PaymentsProfileIdentifierKind;
  token: string;
  verified: boolean;
  exactOnly: boolean;
}

export type PaymentsDiscoveryRelationship =
  | 'self'
  | 'contact'
  | 'stranger';

export interface PaymentsDiscoveryContext {
  actorUserId: string;
  relationship: PaymentsDiscoveryRelationship;
  identifierKind: PaymentsProfileIdentifierKind;
  exactMatch: boolean;
}

export interface PaymentsPaymentProfileInput {
  ownerUserId: string;
  primaryWalletId?: string | null;
  walletType?: PaymentsWalletType;
  handle?: string | null;
  displayName?: string | null;
  countryCode?: string;
  subjectType?: PaymentsIdentitySubjectType;
  identityStatus?: PaymentsIdentityStatus;
  verificationState?: PaymentVerificationState;
  approvedTier?: PaymentsIdentityTier;
  fields?: PaymentsIdentityFields;
  discoverability?: Partial<PaymentsProfileDiscoverability>;
  email?: Partial<PaymentsVerificationMethod> & { value?: string | null };
  phone?: Partial<PaymentsVerificationMethod> & { value?: string | null };
}

export const PAYMENTS_KYB_PRODUCTS = [
  'merchant_qr',
  'market_seller_payout',
] as const;

export type PaymentsKybProduct = (typeof PAYMENTS_KYB_PRODUCTS)[number];

export const PAYMENTS_KYB_ENTRY_STATUSES = [
  'available',
  'requires_business_identity',
  'requires_full_kyc',
  'pending_review',
  'restricted',
] as const;

export type PaymentsKybEntryStatus =
  (typeof PAYMENTS_KYB_ENTRY_STATUSES)[number];

export interface PaymentsKybEntryPoint {
  product: PaymentsKybProduct;
  status: PaymentsKybEntryStatus;
  requiredTier: Extract<PaymentsIdentityTier, 'full'>;
  distinctIdentityTrack: true;
  recommendedWalletType: Extract<PaymentsWalletType, 'merchant'>;
  requiredFields: PaymentsIdentityFieldKey[];
  nextAction: string;
}

export interface PaymentsBusinessOnboardingDraft {
  ownerUserId: string;
  product: PaymentsKybProduct;
  status: 'draft';
  subjectType: Extract<PaymentsIdentitySubjectType, 'business'>;
  requiredTier: Extract<PaymentsIdentityTier, 'full'>;
  recommendedWalletType: Extract<PaymentsWalletType, 'merchant'>;
  sourceSurface: 'payments' | 'market';
}

export interface PaymentsPaymentProfile {
  ownerUserId: string;
  primaryWalletId: string | null;
  walletType: PaymentsWalletType;
  handle: string | null;
  handleSearchKey: string | null;
  displayName: string | null;
  countryCode: string;
  subjectType: PaymentsIdentitySubjectType;
  identityStatus: PaymentsIdentityStatus;
  verificationState: PaymentVerificationState;
  email: PaymentsVerificationMethod;
  phone: PaymentsVerificationMethod;
  discoverability: PaymentsProfileDiscoverability;
  fields: PaymentsIdentityFields;
  tierAssessment: PaymentsTierAssessment;
  searchIndex: PaymentsProfileSearchEntry[];
  kybEntryPoints: PaymentsKybEntryPoint[];
}

export interface PaymentsSearchProfilesInput {
  profiles: PaymentsPaymentProfile[];
  query: string;
  actorUserId: string;
  exactMatch?: boolean;
  identifierKind?: PaymentsProfileIdentifierKind;
  relationshipByOwnerUserId?: Partial<
    Record<string, Exclude<PaymentsDiscoveryRelationship, 'self'>>
  >;
}

export interface PaymentsSearchQuery {
  kind: PaymentsProfileIdentifierKind;
  token: string;
  exactMatch: boolean;
}

export type PaymentsTieredOperation =
  | 'send'
  | 'receive'
  | 'remittance'
  | 'merchant_qr'
  | 'market_seller_payout';

export interface PaymentsLimitBlockInput {
  assessment: PaymentsTierAssessment;
  operation: PaymentsTieredOperation;
  requestedAmountCents?: number | null;
}

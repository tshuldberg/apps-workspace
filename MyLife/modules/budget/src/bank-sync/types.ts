/**
 * Bank sync provider abstraction used by both standalone MyBudget and
 * the MyLife budget module implementation.
 *
 * This contract is intentionally provider-agnostic. Provider credentials
 * and token exchange must be handled by a secure server component.
 */

export type BankSyncProvider =
  | 'plaid'
  | 'mx'
  | 'truelayer'
  | 'tink'
  | 'belvo'
  | 'basiq'
  | 'akoya'
  | 'finicity'
  | 'other';

export const BANK_SYNC_PROVIDERS: readonly BankSyncProvider[] = [
  'plaid',
  'mx',
  'truelayer',
  'tink',
  'belvo',
  'basiq',
  'akoya',
  'finicity',
  'other',
];

/**
 * Build 1 implementation coverage. Keep this in sync with server runtime
 * provider registration so unsupported providers fail fast.
 */
export const BANK_SYNC_IMPLEMENTED_PROVIDERS: readonly BankSyncProvider[] = [
  'plaid',
];

export function isBankSyncProvider(value: string): value is BankSyncProvider {
  return BANK_SYNC_PROVIDERS.includes(value as BankSyncProvider);
}

export function isImplementedBankSyncProvider(
  provider: BankSyncProvider,
): boolean {
  return BANK_SYNC_IMPLEMENTED_PROVIDERS.includes(provider);
}

export type BankConnectionStatus =
  | 'active'
  | 'requires_reauth'
  | 'disconnected'
  | 'error';

export type BankSyncStatus = 'idle' | 'running' | 'error';

export interface BankLinkTokenRequest {
  userId: string;
  provider: BankSyncProvider;
  redirectUri?: string;
  countryCodes?: string[];
}

export interface BankLinkTokenResponse {
  provider: BankSyncProvider;
  token: string;
  expiresAt?: string;
}

export interface BankTokenExchangeRequest {
  provider: BankSyncProvider;
  publicToken: string;
}

export interface BankTokenExchangeResult {
  provider: BankSyncProvider;
  connectionExternalId: string;
  institutionId?: string;
  institutionName?: string;
}

export interface BankConnectionRecord {
  id: string;
  provider: BankSyncProvider;
  providerItemId: string;
  displayName: string;
  institutionId: string | null;
  institutionName: string | null;
  status: BankConnectionStatus;
}

export interface BankAccountRecord {
  id: string;
  connectionId: string;
  providerAccountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment' | 'other';
  subtype: string | null;
  currency: string;
  currentBalance: number | null;
  availableBalance: number | null;
  localAccountId: string | null;
  isActive: boolean;
}

export interface BankTransactionRecord {
  id: string;
  connectionId: string;
  bankAccountId: string;
  providerTransactionId: string;
  pendingTransactionId: string | null;
  datePosted: string;
  dateAuthorized: string | null;
  payee: string | null;
  memo: string | null;
  amount: number;
  currency: string;
  category: string | null;
  isPending: boolean;
  rawJson: string | null;
}

export interface BankSyncRequest {
  connectionExternalId: string;
  cursor?: string;
}

export interface BankSyncResult {
  added: BankTransactionRecord[];
  modified: BankTransactionRecord[];
  removedProviderTransactionIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface BankWebhookEvent {
  provider: BankSyncProvider;
  eventId: string;
  eventType: string;
  connectionExternalId?: string;
  payload: string;
  receivedAtIso: string;
}

export interface BankSyncProviderClient {
  readonly provider: BankSyncProvider;
  createLinkToken(request: BankLinkTokenRequest): Promise<BankLinkTokenResponse>;
  exchangePublicToken(request: BankTokenExchangeRequest): Promise<BankTokenExchangeResult>;
  syncTransactions(request: BankSyncRequest): Promise<BankSyncResult>;
  disconnect(connectionExternalId: string): Promise<void>;
}

import type { HttpClient } from '../http';
import type { BankTokenVault } from '../token-vault';
import type {
  BankLinkTokenRequest,
  BankLinkTokenResponse,
  BankSyncProviderClient,
  BankSyncRequest,
  BankSyncResult,
  BankTokenExchangeRequest,
  BankTokenExchangeResult,
  BankTransactionRecord,
} from '../types';

export type PlaidEnvironment = 'sandbox' | 'development' | 'production';

export interface PlaidProviderConfig {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  clientName?: string;
  language?: string;
  countryCodes?: string[];
  products?: string[];
  redirectUri?: string;
  webhookUrl?: string;
}

export interface PlaidProviderDependencies {
  httpClient: HttpClient;
  tokenVault: BankTokenVault;
}

function getPlaidBaseUrl(environment: PlaidEnvironment): string {
  if (environment === 'sandbox') return 'https://sandbox.plaid.com';
  if (environment === 'development') return 'https://development.plaid.com';
  return 'https://production.plaid.com';
}

function ensureRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Plaid ${context} response is not an object.`);
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Plaid ${context} response missing string "${key}".`);
  }
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readArray(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    );
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function mapPlaidTransaction(
  connectionExternalId: string,
  tx: Record<string, unknown>,
): BankTransactionRecord {
  const providerTransactionId = readString(tx, 'transaction_id', 'transactions/sync');
  const accountId = readString(tx, 'account_id', 'transactions/sync');
  const amount = readNumber(tx, 'amount') ?? 0;
  const merchantName = readNullableString(tx, 'merchant_name');
  const name = readNullableString(tx, 'name');
  const categoryArray = Array.isArray(tx.category)
    ? tx.category.filter((value): value is string => typeof value === 'string')
    : [];
  const isoCurrency = readNullableString(tx, 'iso_currency_code');
  const unofficialCurrency = readNullableString(tx, 'unofficial_currency_code');

  return {
    id: `${connectionExternalId}:${providerTransactionId}`,
    connectionId: connectionExternalId,
    bankAccountId: accountId,
    providerTransactionId,
    pendingTransactionId: readNullableString(tx, 'pending_transaction_id'),
    datePosted: readString(tx, 'date', 'transactions/sync'),
    dateAuthorized: readNullableString(tx, 'authorized_date'),
    payee: merchantName ?? name,
    memo: merchantName && name ? name : null,
    amount: toCents(amount),
    currency: isoCurrency ?? unofficialCurrency ?? 'USD',
    category: categoryArray.length > 0 ? categoryArray.join(' > ') : null,
    isPending: readBoolean(tx, 'pending', false),
    rawJson: JSON.stringify(tx),
  };
}

export class PlaidProviderClient implements BankSyncProviderClient {
  readonly provider = 'plaid' as const;

  private static readonly MAX_SYNC_MUTATION_RETRIES = 2;

  private readonly baseUrl: string;

  constructor(
    private readonly config: PlaidProviderConfig,
    private readonly deps: PlaidProviderDependencies,
  ) {
    this.baseUrl = getPlaidBaseUrl(config.environment);
  }

  async createLinkToken(
    request: BankLinkTokenRequest,
  ): Promise<BankLinkTokenResponse> {
    if (request.provider !== 'plaid') {
      throw new Error(
        `Plaid provider received unsupported provider "${request.provider}".`,
      );
    }

    const response = await this.post('/link/token/create', {
      client_name: this.config.clientName ?? 'MyBudget',
      language: this.config.language ?? 'en',
      country_codes: request.countryCodes ?? this.config.countryCodes ?? ['US'],
      products: this.config.products ?? ['transactions'],
      user: { client_user_id: request.userId },
      redirect_uri: request.redirectUri ?? this.config.redirectUri,
      webhook: this.config.webhookUrl,
    });

    return {
      provider: 'plaid',
      token: readString(response, 'link_token', 'link/token/create'),
      expiresAt: readNullableString(response, 'expiration') ?? undefined,
    };
  }

  async exchangePublicToken(
    request: BankTokenExchangeRequest,
  ): Promise<BankTokenExchangeResult> {
    if (request.provider !== 'plaid') {
      throw new Error(
        `Plaid provider received unsupported provider "${request.provider}".`,
      );
    }

    const response = await this.post('/item/public_token/exchange', {
      public_token: request.publicToken,
    });
    const accessToken = readString(
      response,
      'access_token',
      'item/public_token/exchange',
    );
    const itemId = readString(response, 'item_id', 'item/public_token/exchange');

    await this.deps.tokenVault.setTokens({
      provider: 'plaid',
      connectionExternalId: itemId,
      accessToken,
    });

    return {
      provider: 'plaid',
      connectionExternalId: itemId,
    };
  }

  async syncTransactions(request: BankSyncRequest): Promise<BankSyncResult> {
    const tokenPair = await this.deps.tokenVault.getTokens(
      'plaid',
      request.connectionExternalId,
    );
    if (!tokenPair) {
      throw new Error(
        `No Plaid access token found for connection "${request.connectionExternalId}".`,
      );
    }

    const initialCursor = request.cursor ?? null;
    let attempt = 0;
    while (true) {
      try {
        return await this.syncTransactionsPaged({
          connectionExternalId: request.connectionExternalId,
          accessToken: tokenPair.accessToken,
          cursor: initialCursor,
        });
      } catch (error) {
        if (
          this.isMutationDuringPaginationError(error)
          && attempt < PlaidProviderClient.MAX_SYNC_MUTATION_RETRIES
        ) {
          attempt += 1;
          continue;
        }
        throw error;
      }
    }
  }

  async disconnect(connectionExternalId: string): Promise<void> {
    const tokenPair = await this.deps.tokenVault.getTokens(
      'plaid',
      connectionExternalId,
    );
    if (!tokenPair) return;

    await this.post('/item/remove', {
      access_token: tokenPair.accessToken,
    });
    await this.deps.tokenVault.deleteTokens('plaid', connectionExternalId);
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const cleanedPayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) cleanedPayload[key] = value;
    }

    const response = await this.deps.httpClient.send({
      method: 'POST',
      url: `${this.baseUrl}${path}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        secret: this.config.secret,
        ...cleanedPayload,
      }),
    });

    let bodyParsed: unknown = {};
    if (response.bodyText) {
      try {
        bodyParsed = JSON.parse(response.bodyText);
      } catch {
        throw new Error(
          `Plaid request "${path}" returned non-JSON response: ${response.bodyText.slice(0, 200)}`,
        );
      }
    }
    const bodyRecord = ensureRecord(bodyParsed, path);
    if (response.status < 200 || response.status >= 300) {
      const errorCode = readNullableString(bodyRecord, 'error_code') ?? 'unknown_error';
      const errorMessage = readNullableString(bodyRecord, 'error_message')
        ?? `HTTP ${response.status}`;
      throw new Error(`Plaid ${path} failed (${errorCode}): ${errorMessage}`);
    }
    return bodyRecord;
  }

  private isMutationDuringPaginationError(error: unknown): boolean {
    return (
      error instanceof Error
      && error.message.includes('TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION')
    );
  }

  private async syncTransactionsPaged(input: {
    connectionExternalId: string;
    accessToken: string;
    cursor: string | null;
  }): Promise<BankSyncResult> {
    let cursor = input.cursor;
    let hasMore = false;
    const added: BankTransactionRecord[] = [];
    const modified: BankTransactionRecord[] = [];
    const removedProviderTransactionIds: string[] = [];

    do {
      const response = await this.post('/transactions/sync', {
        access_token: input.accessToken,
        cursor,
      });

      for (const tx of readArray(response, 'added')) {
        added.push(mapPlaidTransaction(input.connectionExternalId, tx));
      }
      for (const tx of readArray(response, 'modified')) {
        modified.push(mapPlaidTransaction(input.connectionExternalId, tx));
      }
      for (const removed of readArray(response, 'removed')) {
        const txId = readNullableString(removed, 'transaction_id');
        if (txId) removedProviderTransactionIds.push(txId);
      }

      cursor = readNullableString(response, 'next_cursor');
      hasMore = readBoolean(response, 'has_more', false);
    } while (hasMore);

    return {
      added,
      modified,
      removedProviderTransactionIds,
      nextCursor: cursor,
      hasMore: false,
    };
  }
}

export function createPlaidProviderClient(
  config: PlaidProviderConfig,
  deps: PlaidProviderDependencies,
): PlaidProviderClient {
  return new PlaidProviderClient(config, deps);
}

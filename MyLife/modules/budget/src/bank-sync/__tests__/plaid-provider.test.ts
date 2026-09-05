import { describe, expect, it } from 'vitest';

import type { HttpClient, HttpRequest, HttpResponse } from '../http';
import { PlaidProviderClient } from '../providers/plaid';
import {
  createEncryptedBankTokenVault,
  createInMemoryTokenVaultStore,
} from '../token-vault';

class MockHttpClient implements HttpClient {
  readonly requests: HttpRequest[] = [];
  private readonly responses: HttpResponse[] = [];

  queue(status: number, body: Record<string, unknown>): void {
    this.responses.push({
      status,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify(body),
    });
  }

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    const next = this.responses.shift();
    if (!next) {
      throw new Error('No queued mock HTTP response.');
    }
    return next;
  }
}

function createProvider(httpClient: MockHttpClient) {
  const vault = createEncryptedBankTokenVault({
    store: createInMemoryTokenVaultStore(),
    cipher: {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, ''),
    },
    nowIso: () => '2026-02-25T00:00:00.000Z',
  });
  const client = new PlaidProviderClient(
    {
      clientId: 'client-id',
      secret: 'secret',
      environment: 'sandbox',
      clientName: 'MyBudget Test',
      language: 'en',
      countryCodes: ['US', 'CA'],
      products: ['transactions'],
    },
    { httpClient, tokenVault: vault },
  );
  return { client, vault };
}

describe('PlaidProviderClient', () => {
  it('creates link tokens with expected request payload', async () => {
    const httpClient = new MockHttpClient();
    httpClient.queue(200, {
      link_token: 'link-sandbox-token',
      expiration: '2026-02-26T00:00:00Z',
    });
    const { client } = createProvider(httpClient);

    const result = await client.createLinkToken({
      userId: 'user-1',
      provider: 'plaid',
    });

    expect(result).toEqual({
      provider: 'plaid',
      token: 'link-sandbox-token',
      expiresAt: '2026-02-26T00:00:00Z',
    });
    expect(httpClient.requests[0].url).toBe('https://sandbox.plaid.com/link/token/create');
  });

  it('exchanges a public token and stores credentials in the vault', async () => {
    const httpClient = new MockHttpClient();
    httpClient.queue(200, {
      access_token: 'access-abc',
      item_id: 'item-123',
    });
    const { client, vault } = createProvider(httpClient);

    const exchange = await client.exchangePublicToken({
      provider: 'plaid',
      publicToken: 'public-token-xyz',
    });

    expect(exchange).toEqual({
      provider: 'plaid',
      connectionExternalId: 'item-123',
    });

    const stored = await vault.getTokens('plaid', 'item-123');
    expect(stored?.accessToken).toBe('access-abc');
  });

  it('syncs transaction pages and disconnects items', async () => {
    const httpClient = new MockHttpClient();
    const { client, vault } = createProvider(httpClient);

    await vault.setTokens({
      provider: 'plaid',
      connectionExternalId: 'item-123',
      accessToken: 'access-abc',
    });

    httpClient.queue(200, {
      added: [
        {
          transaction_id: 'tx-1',
          account_id: 'acct-1',
          date: '2026-02-24',
          authorized_date: '2026-02-23',
          merchant_name: 'Coffee Shop',
          name: 'Coffee Shop #123',
          amount: 4.5,
          iso_currency_code: 'USD',
          category: ['Food and Drink', 'Coffee'],
          pending: false,
        },
      ],
      modified: [],
      removed: [],
      next_cursor: 'cursor-1',
      has_more: true,
    });
    httpClient.queue(200, {
      added: [],
      modified: [
        {
          transaction_id: 'tx-2',
          account_id: 'acct-1',
          date: '2026-02-23',
          amount: 12.75,
          iso_currency_code: 'USD',
          name: 'Lunch',
          pending: true,
        },
      ],
      removed: [{ transaction_id: 'tx-removed' }],
      next_cursor: 'cursor-2',
      has_more: false,
    });

    const sync = await client.syncTransactions({
      connectionExternalId: 'item-123',
    });
    expect(sync.added).toHaveLength(1);
    expect(sync.modified).toHaveLength(1);
    expect(sync.removedProviderTransactionIds).toEqual(['tx-removed']);
    expect(sync.nextCursor).toBe('cursor-2');

    httpClient.queue(200, { removed: true });
    await client.disconnect('item-123');
    expect(await vault.getTokens('plaid', 'item-123')).toBeNull();
  });

  it('retries full sync when Plaid reports mutation during pagination', async () => {
    const httpClient = new MockHttpClient();
    const { client, vault } = createProvider(httpClient);

    await vault.setTokens({
      provider: 'plaid',
      connectionExternalId: 'item-123',
      accessToken: 'access-abc',
    });

    httpClient.queue(400, {
      error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
      error_message: 'Pagination state changed, restart from original cursor.',
    });
    httpClient.queue(200, {
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'cursor-retried',
      has_more: false,
    });

    const sync = await client.syncTransactions({
      connectionExternalId: 'item-123',
      cursor: 'cursor-initial',
    });

    expect(sync.nextCursor).toBe('cursor-retried');

    const firstRequest = JSON.parse(httpClient.requests[0].body ?? '{}') as {
      cursor?: string;
    };
    const secondRequest = JSON.parse(httpClient.requests[1].body ?? '{}') as {
      cursor?: string;
    };
    expect(firstRequest.cursor).toBe('cursor-initial');
    expect(secondRequest.cursor).toBe('cursor-initial');
  });
});

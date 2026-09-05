import { describe, expect, it } from 'vitest';

import { createBankSyncProviderRouter } from '../provider-router';
import type { BankSyncProviderClient } from '../types';

function fakeClient(provider: BankSyncProviderClient['provider']): BankSyncProviderClient {
  return {
    provider,
    async createLinkToken() {
      return { provider, token: `${provider}-token` };
    },
    async exchangePublicToken() {
      return { provider, connectionExternalId: `${provider}-conn` };
    },
    async syncTransactions() {
      return {
        added: [],
        modified: [],
        removedProviderTransactionIds: [],
        nextCursor: null,
        hasMore: false,
      };
    },
    async disconnect() {},
  };
}

describe('BankSyncProviderRouter', () => {
  it('registers, resolves, and lists providers', () => {
    const router = createBankSyncProviderRouter([fakeClient('plaid')]);
    router.register(fakeClient('mx'));

    expect(router.get('plaid')?.provider).toBe('plaid');
    expect(router.get('mx')?.provider).toBe('mx');
    expect(router.listProviders().sort()).toEqual(['mx', 'plaid']);
  });

  it('throws for missing providers with require()', () => {
    const router = createBankSyncProviderRouter();
    expect(() => router.require('plaid')).toThrow(
      'No bank sync provider registered for "plaid".',
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  createBankSyncAuditLogger,
  createInMemoryBankSyncAuditSink,
} from '../audit-log';
import {
  createBankSyncConnectorService,
  createInMemoryBankSyncConnectorStore,
} from '../connector-service';
import { createBankSyncProviderRouter } from '../provider-router';
import type {
  BankLinkTokenRequest,
  BankLinkTokenResponse,
  BankSyncProviderClient,
  BankSyncRequest,
  BankSyncResult,
  BankTokenExchangeRequest,
  BankTokenExchangeResult,
} from '../types';
import { createHmacWebhookVerifier } from '../webhook-security';

class FakePlaidProviderClient implements BankSyncProviderClient {
  readonly provider = 'plaid' as const;

  readonly syncRequests: BankSyncRequest[] = [];
  readonly disconnectRequests: string[] = [];

  constructor(
    private readonly responses: {
      linkToken: BankLinkTokenResponse;
      exchange: BankTokenExchangeResult;
      sync: BankSyncResult[];
    },
  ) {}

  async createLinkToken(_request: BankLinkTokenRequest): Promise<BankLinkTokenResponse> {
    return this.responses.linkToken;
  }

  async exchangePublicToken(
    _request: BankTokenExchangeRequest,
  ): Promise<BankTokenExchangeResult> {
    return this.responses.exchange;
  }

  async syncTransactions(request: BankSyncRequest): Promise<BankSyncResult> {
    this.syncRequests.push(request);
    return (
      this.responses.sync.shift() ?? {
        added: [],
        modified: [],
        removedProviderTransactionIds: [],
        nextCursor: null,
        hasMore: false,
      }
    );
  }

  async disconnect(connectionExternalId: string): Promise<void> {
    this.disconnectRequests.push(connectionExternalId);
  }
}

function buildFixture() {
  const providerClient = new FakePlaidProviderClient({
    linkToken: {
      provider: 'plaid',
      token: 'link-1',
      expiresAt: '2026-02-27T00:00:00.000Z',
    },
    exchange: {
      provider: 'plaid',
      connectionExternalId: 'item-123',
      institutionId: 'ins_1',
      institutionName: 'Bank One',
    },
    sync: [
      {
        added: [
          {
            id: 'item-123:tx-1',
            connectionId: 'item-123',
            bankAccountId: 'acct-1',
            providerTransactionId: 'tx-1',
            pendingTransactionId: null,
            datePosted: '2026-02-25',
            dateAuthorized: null,
            payee: 'Coffee',
            memo: null,
            amount: -450,
            currency: 'USD',
            category: 'Food and Drink',
            isPending: false,
            rawJson: '{}',
          },
        ],
        modified: [],
        removedProviderTransactionIds: [],
        nextCursor: 'cursor-1',
        hasMore: false,
      },
    ],
  });
  const providerRouter = createBankSyncProviderRouter([providerClient]);
  const auditSink = createInMemoryBankSyncAuditSink();
  const auditLogger = createBankSyncAuditLogger({
    sink: auditSink,
    nowIso: () => '2026-02-26T12:00:00.000Z',
    createId: (() => {
      let i = 0;
      return () => `audit-${++i}`;
    })(),
  });
  const store = createInMemoryBankSyncConnectorStore();
  const webhookVerifier = createHmacWebhookVerifier({
    strategies: [
      {
        provider: 'plaid',
        signatureHeader: 'x-signature',
        timestampHeader: 'x-timestamp',
        resolveSigningSecret: () => 'secret-1',
      },
    ],
    hmacDigest: ({ secret, payload }) => `${secret}:${payload}`,
    nowEpochSeconds: () => 1000,
  });

  const service = createBankSyncConnectorService({
    providerRouter,
    store,
    auditLogger,
    webhookVerifier,
    nowIso: () => '2026-02-26T12:00:00.000Z',
  });

  return { providerClient, auditSink, store, service };
}

describe('BankSyncConnectorService', () => {
  it('connects, syncs, and disconnects with audit trail updates', async () => {
    const { providerClient, auditSink, store, service } = buildFixture();

    const link = await service.createLinkToken({
      userId: 'user-1',
      provider: 'plaid',
    });
    expect(link.token).toBe('link-1');

    const exchange = await service.connectWithPublicToken({
      provider: 'plaid',
      publicToken: 'public-token',
      displayName: 'Main Checking',
    });
    expect(exchange.connectionExternalId).toBe('item-123');

    const sync = await service.syncConnection({
      provider: 'plaid',
      connectionExternalId: 'item-123',
    });
    expect(sync.nextCursor).toBe('cursor-1');
    expect(providerClient.syncRequests[0].cursor).toBeUndefined();

    await service.disconnectConnection({
      provider: 'plaid',
      connectionExternalId: 'item-123',
    });

    expect(providerClient.disconnectRequests).toEqual(['item-123']);
    expect(store.getTransactionDeltas()).toHaveLength(1);
    expect(store.readConnection('plaid', 'item-123')?.status).toBe(
      'disconnected',
    );

    const actions = auditSink.getEntries().map((entry) => entry.action);
    expect(actions).toContain('link_token.created');
    expect(actions).toContain('connection.exchanged');
    expect(actions).toContain('sync.started');
    expect(actions).toContain('sync.completed');
    expect(actions).toContain('connection.disconnected');
  });

  it('rejects invalid webhook signatures and accepts valid signatures', async () => {
    const { service, store } = buildFixture();
    const payload = '{"event":"SYNC_UPDATES_AVAILABLE"}';

    const invalid = await service.ingestWebhook({
      provider: 'plaid',
      eventId: 'evt-1',
      eventType: 'SYNC_UPDATES_AVAILABLE',
      headers: {
        'x-signature': 'invalid',
        'x-timestamp': '999',
      },
      payload,
      connectionExternalId: 'item-123',
    });
    expect(invalid.accepted).toBe(false);

    const validSignature = `secret-1:999.${payload}`;
    const valid = await service.ingestWebhook({
      provider: 'plaid',
      eventId: 'evt-2',
      eventType: 'SYNC_UPDATES_AVAILABLE',
      headers: {
        'x-signature': validSignature,
        'x-timestamp': '999',
      },
      payload,
      connectionExternalId: 'item-123',
    });
    expect(valid.accepted).toBe(true);

    const webhooks = store.getWebhooks();
    expect(webhooks[0].verificationState).toBe('rejected');
    expect(webhooks[1].verificationState).toBe('verified');
  });
});

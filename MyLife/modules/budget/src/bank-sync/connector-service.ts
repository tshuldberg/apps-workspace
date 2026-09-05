import type { BankSyncAuditLogger } from './audit-log';
import type { BankSyncProviderRouter } from './provider-router';
import type {
  BankConnectionStatus,
  BankLinkTokenRequest,
  BankLinkTokenResponse,
  BankSyncProvider,
  BankSyncResult,
  BankSyncStatus,
  BankTokenExchangeResult,
  BankWebhookEvent,
} from './types';
import type {
  BankWebhookVerificationResult,
  BankWebhookVerifier,
} from './webhook-security';

type MaybePromise<T> = T | Promise<T>;

function toConnectionKey(
  provider: BankSyncProvider,
  connectionExternalId: string,
): string {
  return `${provider}:${connectionExternalId}`;
}

export interface BankSyncConnectionRecord {
  provider: BankSyncProvider;
  connectionExternalId: string;
  displayName: string;
  institutionId: string | null;
  institutionName: string | null;
  status: BankConnectionStatus;
  lastSuccessfulSyncIso: string | null;
  lastAttemptedSyncIso: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface BankSyncCursorState {
  provider: BankSyncProvider;
  connectionExternalId: string;
  cursor: string | null;
  syncStatus: BankSyncStatus;
  lastAttemptedSyncIso: string | null;
  lastSuccessfulSyncIso: string | null;
  lastError: string | null;
}

export interface BankSyncWebhookRecord {
  provider: BankSyncProvider;
  eventId: string;
  eventType: string;
  connectionExternalId: string | null;
  payload: string;
  receivedAtIso: string;
  verificationState: 'verified' | 'rejected';
  verificationReason: string | null;
}

export interface BankSyncConnectorStore {
  upsertConnection(record: BankSyncConnectionRecord): MaybePromise<void>;
  getConnection(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): MaybePromise<BankSyncConnectionRecord | null>;
  setConnectionStatus(input: {
    provider: BankSyncProvider;
    connectionExternalId: string;
    status: BankConnectionStatus;
    lastSuccessfulSyncIso?: string | null;
    lastAttemptedSyncIso?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): MaybePromise<void>;
  getSyncCursor(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): MaybePromise<string | null>;
  upsertSyncCursor(state: BankSyncCursorState): MaybePromise<void>;
  applyTransactionDelta(input: {
    provider: BankSyncProvider;
    connectionExternalId: string;
    result: BankSyncResult;
    syncedAtIso: string;
  }): MaybePromise<void>;
  recordWebhook(record: BankSyncWebhookRecord): MaybePromise<void>;
}

export interface ConnectBankAccountRequest {
  provider: BankSyncProvider;
  publicToken: string;
  displayName: string;
  institutionId?: string;
  institutionName?: string;
}

export interface SyncBankConnectionRequest {
  provider: BankSyncProvider;
  connectionExternalId: string;
  cursor?: string;
}

export interface DisconnectBankConnectionRequest {
  provider: BankSyncProvider;
  connectionExternalId: string;
}

export interface IngestWebhookRequest {
  provider: BankSyncProvider;
  eventId: string;
  eventType: string;
  headers: Record<string, string | undefined>;
  payload: string;
  connectionExternalId?: string;
}

export interface IngestWebhookResult {
  accepted: boolean;
  verification: BankWebhookVerificationResult;
}

export class BankSyncConnectorService {
  private readonly nowIso: () => string;

  constructor(
    private readonly input: {
      providerRouter: BankSyncProviderRouter;
      store: BankSyncConnectorStore;
      auditLogger: BankSyncAuditLogger;
      webhookVerifier: BankWebhookVerifier;
      nowIso?: () => string;
    },
  ) {
    this.nowIso = input.nowIso ?? (() => new Date().toISOString());
  }

  async createLinkToken(
    request: BankLinkTokenRequest,
  ): Promise<BankLinkTokenResponse> {
    const client = this.input.providerRouter.require(request.provider);
    try {
      const response = await client.createLinkToken(request);
      await this.input.auditLogger.log({
        level: 'info',
        action: 'link_token.created',
        provider: request.provider,
        message: 'Created bank link token.',
        metadata: {
          userId: request.userId,
        },
      });
      return response;
    } catch (error) {
      await this.input.auditLogger.log({
        level: 'error',
        action: 'link_token.failed',
        provider: request.provider,
        message: 'Failed to create bank link token.',
        metadata: {
          userId: request.userId,
          error: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async connectWithPublicToken(
    request: ConnectBankAccountRequest,
  ): Promise<BankTokenExchangeResult> {
    const client = this.input.providerRouter.require(request.provider);
    try {
      const result = await client.exchangePublicToken({
        provider: request.provider,
        publicToken: request.publicToken,
      });
      await Promise.resolve(
        this.input.store.upsertConnection({
          provider: request.provider,
          connectionExternalId: result.connectionExternalId,
          displayName: request.displayName,
          institutionId: result.institutionId ?? request.institutionId ?? null,
          institutionName:
            result.institutionName ?? request.institutionName ?? null,
          status: 'active',
          lastSuccessfulSyncIso: null,
          lastAttemptedSyncIso: null,
          errorCode: null,
          errorMessage: null,
        }),
      );
      await Promise.resolve(
        this.input.store.upsertSyncCursor({
          provider: request.provider,
          connectionExternalId: result.connectionExternalId,
          cursor: null,
          syncStatus: 'idle',
          lastAttemptedSyncIso: null,
          lastSuccessfulSyncIso: null,
          lastError: null,
        }),
      );
      await this.input.auditLogger.log({
        level: 'info',
        action: 'connection.exchanged',
        provider: request.provider,
        connectionExternalId: result.connectionExternalId,
        message: 'Exchanged public token and created active bank connection.',
      });
      return result;
    } catch (error) {
      await this.input.auditLogger.log({
        level: 'error',
        action: 'connection.exchange_failed',
        provider: request.provider,
        message: 'Failed to exchange public token.',
        metadata: {
          error: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async syncConnection(request: SyncBankConnectionRequest): Promise<BankSyncResult> {
    const now = this.nowIso();
    const client = this.input.providerRouter.require(request.provider);
    const resolvedCursor =
      request.cursor
      ?? (await Promise.resolve(
        this.input.store.getSyncCursor(
          request.provider,
          request.connectionExternalId,
        ),
      ));

    await Promise.resolve(
      this.input.store.upsertSyncCursor({
        provider: request.provider,
        connectionExternalId: request.connectionExternalId,
        cursor: resolvedCursor ?? null,
        syncStatus: 'running',
        lastAttemptedSyncIso: now,
        lastSuccessfulSyncIso: null,
        lastError: null,
      }),
    );
    await this.input.auditLogger.log({
      level: 'info',
      action: 'sync.started',
      provider: request.provider,
      connectionExternalId: request.connectionExternalId,
      message: 'Started bank sync run.',
      metadata: { cursor: resolvedCursor ?? 'null' },
    });

    try {
      const result = await client.syncTransactions({
        connectionExternalId: request.connectionExternalId,
        cursor: resolvedCursor ?? undefined,
      });
      const completedAt = this.nowIso();

      await Promise.resolve(
        this.input.store.applyTransactionDelta({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          result,
          syncedAtIso: completedAt,
        }),
      );
      await Promise.resolve(
        this.input.store.upsertSyncCursor({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          cursor: result.nextCursor,
          syncStatus: 'idle',
          lastAttemptedSyncIso: now,
          lastSuccessfulSyncIso: completedAt,
          lastError: null,
        }),
      );
      await Promise.resolve(
        this.input.store.setConnectionStatus({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          status: 'active',
          lastAttemptedSyncIso: now,
          lastSuccessfulSyncIso: completedAt,
          errorCode: null,
          errorMessage: null,
        }),
      );
      await this.input.auditLogger.log({
        level: 'info',
        action: 'sync.completed',
        provider: request.provider,
        connectionExternalId: request.connectionExternalId,
        message: 'Completed bank sync run.',
        metadata: {
          added: result.added.length,
          modified: result.modified.length,
          removed: result.removedProviderTransactionIds.length,
        },
      });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'unknown_sync_error';
      await Promise.resolve(
        this.input.store.upsertSyncCursor({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          cursor: resolvedCursor ?? null,
          syncStatus: 'error',
          lastAttemptedSyncIso: now,
          lastSuccessfulSyncIso: null,
          lastError: errorMessage,
        }),
      );
      await Promise.resolve(
        this.input.store.setConnectionStatus({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          status: 'error',
          lastAttemptedSyncIso: now,
          lastSuccessfulSyncIso: null,
          errorCode: null,
          errorMessage: errorMessage,
        }),
      );
      await this.input.auditLogger.log({
        level: 'error',
        action: 'sync.failed',
        provider: request.provider,
        connectionExternalId: request.connectionExternalId,
        message: 'Bank sync run failed.',
        metadata: {
          error: errorMessage,
        },
      });
      throw error;
    }
  }

  async disconnectConnection(
    request: DisconnectBankConnectionRequest,
  ): Promise<void> {
    const client = this.input.providerRouter.require(request.provider);
    try {
      await client.disconnect(request.connectionExternalId);
      await Promise.resolve(
        this.input.store.setConnectionStatus({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          status: 'disconnected',
          lastAttemptedSyncIso: this.nowIso(),
          lastSuccessfulSyncIso: null,
          errorCode: null,
          errorMessage: null,
        }),
      );
      await Promise.resolve(
        this.input.store.upsertSyncCursor({
          provider: request.provider,
          connectionExternalId: request.connectionExternalId,
          cursor: null,
          syncStatus: 'idle',
          lastAttemptedSyncIso: null,
          lastSuccessfulSyncIso: null,
          lastError: null,
        }),
      );
      await this.input.auditLogger.log({
        level: 'info',
        action: 'connection.disconnected',
        provider: request.provider,
        connectionExternalId: request.connectionExternalId,
        message: 'Disconnected bank connection.',
      });
    } catch (error) {
      await this.input.auditLogger.log({
        level: 'error',
        action: 'connection.disconnect_failed',
        provider: request.provider,
        connectionExternalId: request.connectionExternalId,
        message: 'Failed to disconnect bank connection.',
        metadata: {
          error: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async ingestWebhook(request: IngestWebhookRequest): Promise<IngestWebhookResult> {
    const verification = await this.input.webhookVerifier.verify({
      provider: request.provider,
      headers: request.headers,
      rawBody: request.payload,
    });
    const receivedAtIso = this.nowIso();

    await Promise.resolve(
      this.input.store.recordWebhook({
        provider: request.provider,
        eventId: request.eventId,
        eventType: request.eventType,
        connectionExternalId: request.connectionExternalId ?? null,
        payload: request.payload,
        receivedAtIso,
        verificationState: verification.isVerified ? 'verified' : 'rejected',
        verificationReason: verification.reason ?? null,
      }),
    );

    await this.input.auditLogger.log({
      level: verification.isVerified ? 'info' : 'warning',
      action: verification.isVerified
        ? 'webhook.accepted'
        : 'webhook.rejected',
      provider: request.provider,
      connectionExternalId: request.connectionExternalId ?? null,
      message: verification.isVerified
        ? 'Accepted and recorded webhook event.'
        : 'Rejected webhook event due to failed verification.',
      metadata: {
        eventId: request.eventId,
        eventType: request.eventType,
        verificationReason: verification.reason ?? null,
      },
    });

    return {
      accepted: verification.isVerified,
      verification,
    };
  }
}

export function createBankSyncConnectorService(input: {
  providerRouter: BankSyncProviderRouter;
  store: BankSyncConnectorStore;
  auditLogger: BankSyncAuditLogger;
  webhookVerifier: BankWebhookVerifier;
  nowIso?: () => string;
}): BankSyncConnectorService {
  return new BankSyncConnectorService(input);
}

export function createInMemoryBankSyncConnectorStore(): BankSyncConnectorStore & {
  readConnection(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): BankSyncConnectionRecord | null;
  readSyncState(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): BankSyncCursorState | null;
  getTransactionDeltas(): Array<{
    provider: BankSyncProvider;
    connectionExternalId: string;
    result: BankSyncResult;
    syncedAtIso: string;
  }>;
  getWebhooks(): BankSyncWebhookRecord[];
} {
  const connections = new Map<string, BankSyncConnectionRecord>();
  const syncStates = new Map<string, BankSyncCursorState>();
  const transactionDeltas: Array<{
    provider: BankSyncProvider;
    connectionExternalId: string;
    result: BankSyncResult;
    syncedAtIso: string;
  }> = [];
  const webhooks: BankSyncWebhookRecord[] = [];

  return {
    upsertConnection(record): void {
      const key = toConnectionKey(record.provider, record.connectionExternalId);
      const existing = connections.get(key);
      connections.set(key, {
        ...existing,
        ...record,
      });
    },
    getConnection(provider, connectionExternalId): BankSyncConnectionRecord | null {
      return connections.get(toConnectionKey(provider, connectionExternalId)) ?? null;
    },
    readConnection(provider, connectionExternalId): BankSyncConnectionRecord | null {
      return connections.get(toConnectionKey(provider, connectionExternalId)) ?? null;
    },
    setConnectionStatus(input): void {
      const key = toConnectionKey(input.provider, input.connectionExternalId);
      const existing = connections.get(key);
      const base: BankSyncConnectionRecord = existing ?? {
        provider: input.provider,
        connectionExternalId: input.connectionExternalId,
        displayName: input.connectionExternalId,
        institutionId: null,
        institutionName: null,
        status: 'active',
        lastSuccessfulSyncIso: null,
        lastAttemptedSyncIso: null,
        errorCode: null,
        errorMessage: null,
      };
      connections.set(key, {
        ...base,
        status: input.status,
        lastSuccessfulSyncIso:
          input.lastSuccessfulSyncIso === undefined
            ? base.lastSuccessfulSyncIso
            : input.lastSuccessfulSyncIso,
        lastAttemptedSyncIso:
          input.lastAttemptedSyncIso === undefined
            ? base.lastAttemptedSyncIso
            : input.lastAttemptedSyncIso,
        errorCode: input.errorCode === undefined ? base.errorCode : input.errorCode,
        errorMessage:
          input.errorMessage === undefined ? base.errorMessage : input.errorMessage,
      });
    },
    getSyncCursor(provider, connectionExternalId): string | null {
      return (
        syncStates.get(toConnectionKey(provider, connectionExternalId))?.cursor
        ?? null
      );
    },
    upsertSyncCursor(state): void {
      const key = toConnectionKey(state.provider, state.connectionExternalId);
      const existing = syncStates.get(key);
      syncStates.set(key, {
        ...existing,
        ...state,
      });
    },
    applyTransactionDelta(input): void {
      transactionDeltas.push(input);
    },
    recordWebhook(record): void {
      webhooks.push(record);
    },
    readSyncState(provider, connectionExternalId): BankSyncCursorState | null {
      return syncStates.get(toConnectionKey(provider, connectionExternalId)) ?? null;
    },
    getTransactionDeltas() {
      return [...transactionDeltas];
    },
    getWebhooks() {
      return [...webhooks];
    },
  };
}

export function toBankWebhookEvent(
  record: BankSyncWebhookRecord,
): BankWebhookEvent {
  return {
    provider: record.provider,
    eventId: record.eventId,
    eventType: record.eventType,
    connectionExternalId: record.connectionExternalId ?? undefined,
    payload: record.payload,
    receivedAtIso: record.receivedAtIso,
  };
}

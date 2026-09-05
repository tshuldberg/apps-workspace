import type { BankSyncProvider } from './types';

type MaybePromise<T> = T | Promise<T>;

export interface BankTokenPair {
  accessToken: string;
  refreshToken: string | null;
}

export interface StoredBankTokenRecord {
  provider: BankSyncProvider;
  connectionExternalId: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface BankTokenVaultStore {
  put(record: StoredBankTokenRecord): MaybePromise<void>;
  get(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): MaybePromise<StoredBankTokenRecord | null>;
  delete(provider: BankSyncProvider, connectionExternalId: string): MaybePromise<void>;
}

export interface BankTokenCipher {
  encrypt(plaintext: string): MaybePromise<string>;
  decrypt(ciphertext: string): MaybePromise<string>;
}

export interface BankTokenVault {
  setTokens(input: {
    provider: BankSyncProvider;
    connectionExternalId: string;
    accessToken: string;
    refreshToken?: string | null;
  }): Promise<void>;
  getTokens(
    provider: BankSyncProvider,
    connectionExternalId: string,
  ): Promise<BankTokenPair | null>;
  deleteTokens(provider: BankSyncProvider, connectionExternalId: string): Promise<void>;
}

export interface KmsVaultClient {
  encrypt(input: {
    plaintext: string;
    encryptionContext: Record<string, string>;
  }): MaybePromise<{ ciphertext: string }>;
  decrypt(input: {
    ciphertext: string;
    encryptionContext: Record<string, string>;
  }): MaybePromise<{ plaintext: string }>;
}

export interface KmsBackedBankTokenVaultInput {
  store: BankTokenVaultStore;
  kmsClient: KmsVaultClient;
  nowIso?: () => string;
  baseEncryptionContext?: Record<string, string>;
  createEncryptionContext?: (input: {
    provider: BankSyncProvider;
    connectionExternalId: string;
    tokenType: 'access' | 'refresh';
  }) => Record<string, string>;
}

function toStoreKey(provider: BankSyncProvider, connectionExternalId: string): string {
  return `${provider}:${connectionExternalId}`;
}

export function createInMemoryTokenVaultStore(): BankTokenVaultStore {
  const records = new Map<string, StoredBankTokenRecord>();
  return {
    put(record): void {
      records.set(toStoreKey(record.provider, record.connectionExternalId), record);
    },
    get(provider, connectionExternalId): StoredBankTokenRecord | null {
      return records.get(toStoreKey(provider, connectionExternalId)) ?? null;
    },
    delete(provider, connectionExternalId): void {
      records.delete(toStoreKey(provider, connectionExternalId));
    },
  };
}

export function createEncryptedBankTokenVault(input: {
  store: BankTokenVaultStore;
  cipher: BankTokenCipher;
  nowIso?: () => string;
}): BankTokenVault {
  const { store, cipher, nowIso = () => new Date().toISOString() } = input;

  return {
    async setTokens(payload): Promise<void> {
      const existing = await Promise.resolve(
        store.get(payload.provider, payload.connectionExternalId),
      );
      const now = nowIso();
      const accessTokenCiphertext = await Promise.resolve(
        cipher.encrypt(payload.accessToken),
      );
      const refreshToken = payload.refreshToken ?? null;
      const refreshTokenCiphertext = refreshToken
        ? await Promise.resolve(cipher.encrypt(refreshToken))
        : null;

      await Promise.resolve(
        store.put({
          provider: payload.provider,
          connectionExternalId: payload.connectionExternalId,
          accessTokenCiphertext,
          refreshTokenCiphertext,
          createdAtIso: existing?.createdAtIso ?? now,
          updatedAtIso: now,
        }),
      );
    },

    async getTokens(
      provider: BankSyncProvider,
      connectionExternalId: string,
    ): Promise<BankTokenPair | null> {
      const record = await Promise.resolve(store.get(provider, connectionExternalId));
      if (!record) return null;
      const accessToken = await Promise.resolve(
        cipher.decrypt(record.accessTokenCiphertext),
      );
      const refreshToken = record.refreshTokenCiphertext
        ? await Promise.resolve(cipher.decrypt(record.refreshTokenCiphertext))
        : null;
      return { accessToken, refreshToken };
    },

    async deleteTokens(
      provider: BankSyncProvider,
      connectionExternalId: string,
    ): Promise<void> {
      await Promise.resolve(store.delete(provider, connectionExternalId));
    },
  };
}

function defaultTokenEncryptionContext(input: {
  provider: BankSyncProvider;
  connectionExternalId: string;
  tokenType: 'access' | 'refresh';
}): Record<string, string> {
  return {
    provider: input.provider,
    connection_external_id: input.connectionExternalId,
    token_type: input.tokenType,
  };
}

export function createKmsBackedBankTokenVault(
  input: KmsBackedBankTokenVaultInput,
): BankTokenVault {
  const {
    store,
    kmsClient,
    nowIso = () => new Date().toISOString(),
    baseEncryptionContext = {},
    createEncryptionContext = defaultTokenEncryptionContext,
  } = input;

  function buildContext(payload: {
    provider: BankSyncProvider;
    connectionExternalId: string;
    tokenType: 'access' | 'refresh';
  }): Record<string, string> {
    return {
      ...baseEncryptionContext,
      ...createEncryptionContext(payload),
    };
  }

  return {
    async setTokens(payload): Promise<void> {
      const existing = await Promise.resolve(
        store.get(payload.provider, payload.connectionExternalId),
      );
      const now = nowIso();

      const accessContext = buildContext({
        provider: payload.provider,
        connectionExternalId: payload.connectionExternalId,
        tokenType: 'access',
      });
      const accessEncrypted = await Promise.resolve(
        kmsClient.encrypt({
          plaintext: payload.accessToken,
          encryptionContext: accessContext,
        }),
      );

      const refreshToken = payload.refreshToken ?? null;
      let refreshTokenCiphertext: string | null = null;
      if (refreshToken) {
        const refreshContext = buildContext({
          provider: payload.provider,
          connectionExternalId: payload.connectionExternalId,
          tokenType: 'refresh',
        });
        refreshTokenCiphertext = (
          await Promise.resolve(
            kmsClient.encrypt({
              plaintext: refreshToken,
              encryptionContext: refreshContext,
            }),
          )
        ).ciphertext;
      }

      await Promise.resolve(
        store.put({
          provider: payload.provider,
          connectionExternalId: payload.connectionExternalId,
          accessTokenCiphertext: accessEncrypted.ciphertext,
          refreshTokenCiphertext,
          createdAtIso: existing?.createdAtIso ?? now,
          updatedAtIso: now,
        }),
      );
    },

    async getTokens(
      provider: BankSyncProvider,
      connectionExternalId: string,
    ): Promise<BankTokenPair | null> {
      const record = await Promise.resolve(store.get(provider, connectionExternalId));
      if (!record) return null;

      const accessContext = buildContext({
        provider,
        connectionExternalId,
        tokenType: 'access',
      });
      const accessToken = (
        await Promise.resolve(
          kmsClient.decrypt({
            ciphertext: record.accessTokenCiphertext,
            encryptionContext: accessContext,
          }),
        )
      ).plaintext;

      let refreshToken: string | null = null;
      if (record.refreshTokenCiphertext) {
        const refreshContext = buildContext({
          provider,
          connectionExternalId,
          tokenType: 'refresh',
        });
        refreshToken = (
          await Promise.resolve(
            kmsClient.decrypt({
              ciphertext: record.refreshTokenCiphertext,
              encryptionContext: refreshContext,
            }),
          )
        ).plaintext;
      }

      return { accessToken, refreshToken };
    },

    async deleteTokens(
      provider: BankSyncProvider,
      connectionExternalId: string,
    ): Promise<void> {
      await Promise.resolve(store.delete(provider, connectionExternalId));
    },
  };
}

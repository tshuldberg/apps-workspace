import {
  createBankSyncAuditLogger,
  type BankSyncAuditEntry,
} from './audit-log';
import {
  type AwsGetSecretValueInput,
  type AwsKmsDecryptInput,
  type AwsKmsEncryptInput,
  type AwsSdkV3CommandConstructor,
  createAwsSdkV3KmsVaultClient,
  createAwsSdkV3SecretsManagerWebhookSecretResolver,
  createGcpKmsVaultClient,
  createGcpSecretManagerWebhookSecretResolver,
  createStaticWebhookSecretResolver,
  createWebCryptoHmacDigest,
} from './cloud-adapters';
import {
  createBankSyncConnectorService,
  createInMemoryBankSyncConnectorStore,
} from './connector-service';
import type { HttpClient, HttpRequest, HttpResponse } from './http';
import { createBankSyncProviderRouter } from './provider-router';
import { createPlaidProviderClient } from './providers';
import {
  createEncryptedBankTokenVault,
  createInMemoryTokenVaultStore,
  createKmsBackedBankTokenVault,
} from './token-vault';
import {
  BANK_SYNC_IMPLEMENTED_PROVIDERS,
  BANK_SYNC_PROVIDERS,
  type BankSyncProvider,
} from './types';
import { createHmacWebhookVerifier } from './webhook-security';

export type BankSyncKmsProvider = 'aws' | 'gcp' | 'insecure_dev';
export type BankSyncWebhookSecretProvider = 'static' | 'aws' | 'gcp';

export interface BankSyncRuntimeEnv {
  [key: string]: string | undefined;
}

export interface BankSyncModuleLoader {
  importModule(specifier: string): Promise<Record<string, unknown>>;
}

export interface BankSyncServerRuntime {
  connector: ReturnType<typeof createBankSyncConnectorService>;
  store: ReturnType<typeof createInMemoryBankSyncConnectorStore>;
}

export interface BankSyncRuntimeOptions {
  env: BankSyncRuntimeEnv;
  fetchImpl?: (
    input: string,
    init: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ) => Promise<{
    status: number;
    headers?: {
      entries?: () => IterableIterator<[string, string]>;
      forEach?: (callback: (value: string, key: string) => void) => void;
    };
    text: () => Promise<string>;
  }>;
  moduleLoader?: BankSyncModuleLoader;
  nowIso?: () => string;
  nowEpochSeconds?: () => number;
}

interface RuntimeSingletonState {
  cacheKey: string;
  runtimePromise: Promise<BankSyncServerRuntime>;
}

let runtimeSingleton: RuntimeSingletonState | null = null;

function asProvider(value: string | undefined, fallback: BankSyncProvider): BankSyncProvider {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (BANK_SYNC_PROVIDERS.includes(normalized as BankSyncProvider)) {
    return normalized as BankSyncProvider;
  }
  return fallback;
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false;
  return fallback;
}

function asInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return list.length > 0 ? list : undefined;
}

function requiredEnv(env: BankSyncRuntimeEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvFirst(env: BankSyncRuntimeEnv, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim().length > 0) return value;
  }
  return undefined;
}

function createDefaultModuleLoader(): BankSyncModuleLoader {
  return {
    importModule(specifier: string): Promise<Record<string, unknown>> {
      const importer = new Function(
        'moduleName',
        'return import(moduleName);',
      ) as (moduleName: string) => Promise<Record<string, unknown>>;
      return importer(specifier);
    },
  };
}

function createFetchHttpClient(input: {
  fetchImpl?: BankSyncRuntimeOptions['fetchImpl'];
}): HttpClient {
  const { fetchImpl } = input;
  const globalFetch = (globalThis as { fetch?: BankSyncRuntimeOptions['fetchImpl'] }).fetch;
  const resolvedFetch = fetchImpl ?? globalFetch;

  if (!resolvedFetch) {
    throw new Error('No fetch implementation available for bank sync HTTP client.');
  }

  return {
    async send(request: HttpRequest): Promise<HttpResponse> {
      const response = await resolvedFetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      const headers: Record<string, string> = {};
      if (response.headers?.entries) {
        for (const [key, value] of response.headers.entries()) {
          headers[key] = value;
        }
      } else if (response.headers?.forEach) {
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
      }

      return {
        status: response.status,
        headers,
        bodyText: await response.text(),
      };
    },
  };
}

function createDevFallbackCipher() {
  return {
    encrypt(value: string): string {
      return `dev:${value}`;
    },
    decrypt(value: string): string {
      if (!value.startsWith('dev:')) {
        throw new Error('Invalid insecure-dev token ciphertext.');
      }
      return value.slice(4);
    },
  };
}

async function createTokenVault(input: {
  env: BankSyncRuntimeEnv;
  moduleLoader: BankSyncModuleLoader;
}): Promise<ReturnType<typeof createKmsBackedBankTokenVault> | ReturnType<typeof createEncryptedBankTokenVault>> {
  const { env, moduleLoader } = input;
  const store = createInMemoryTokenVaultStore();
  const kmsProvider = (
    getEnvFirst(env, ['BANK_SYNC_KMS_PROVIDER']) ?? 'insecure_dev'
  ).trim().toLowerCase() as BankSyncKmsProvider;

  if (kmsProvider === 'aws') {
    const keyId = requiredEnv(env, 'BANK_SYNC_AWS_KMS_KEY_ID');
    const awsRegion = getEnvFirst(env, ['BANK_SYNC_AWS_REGION', 'AWS_REGION']);
    const awsKmsModule = await moduleLoader.importModule('@aws-sdk/client-kms');
    const KMSClient = awsKmsModule.KMSClient as
      | (new (input?: Record<string, unknown>) => { send: (command: unknown) => Promise<Record<string, unknown>> })
      | undefined;
    const EncryptCommand = awsKmsModule.EncryptCommand as
      | AwsSdkV3CommandConstructor<AwsKmsEncryptInput>
      | undefined;
    const DecryptCommand = awsKmsModule.DecryptCommand as
      | AwsSdkV3CommandConstructor<AwsKmsDecryptInput>
      | undefined;

    if (!KMSClient || !EncryptCommand || !DecryptCommand) {
      throw new Error(
        'Failed to load AWS KMS SDK exports (KMSClient/EncryptCommand/DecryptCommand).',
      );
    }

    const kmsClient = awsRegion
      ? new KMSClient({ region: awsRegion })
      : new KMSClient();
    const vaultClient = createAwsSdkV3KmsVaultClient({
      kmsClient,
      keyId,
      EncryptCommand,
      DecryptCommand,
    });

    return createKmsBackedBankTokenVault({
      store,
      kmsClient: vaultClient,
      baseEncryptionContext: {
        service: 'mybudget-bank-sync',
      },
    });
  }

  if (kmsProvider === 'gcp') {
    const cryptoKeyName = requiredEnv(env, 'BANK_SYNC_GCP_KMS_CRYPTO_KEY_NAME');
    const gcpKmsModule = await moduleLoader.importModule('@google-cloud/kms');
    const KeyManagementServiceClient = gcpKmsModule.KeyManagementServiceClient as
      | (new () => {
        encrypt: (input: Record<string, unknown>) => Promise<[Record<string, unknown>]>;
        decrypt: (input: Record<string, unknown>) => Promise<[Record<string, unknown>]>;
      })
      | undefined;

    if (!KeyManagementServiceClient) {
      throw new Error(
        'Failed to load GCP KMS SDK export KeyManagementServiceClient.',
      );
    }

    const kmsClient = new KeyManagementServiceClient();
    const vaultClient = createGcpKmsVaultClient({
      kmsClient: {
        encrypt(inputPayload) {
          return kmsClient.encrypt(inputPayload as unknown as Record<string, unknown>);
        },
        decrypt(inputPayload) {
          return kmsClient.decrypt(inputPayload as unknown as Record<string, unknown>);
        },
      },
      cryptoKeyName,
    });

    return createKmsBackedBankTokenVault({
      store,
      kmsClient: vaultClient,
      baseEncryptionContext: {
        service: 'mybudget-bank-sync',
      },
    });
  }

  const allowInsecureDev = asBool(env.BANK_SYNC_ALLOW_INSECURE_DEV, false);
  if (!allowInsecureDev) {
    throw new Error(
      'BANK_SYNC_KMS_PROVIDER must be "aws" or "gcp". Set BANK_SYNC_ALLOW_INSECURE_DEV=true only for local development.',
    );
  }
  return createEncryptedBankTokenVault({
    store,
    cipher: createDevFallbackCipher(),
  });
}

async function createWebhookSecretResolver(input: {
  env: BankSyncRuntimeEnv;
  moduleLoader: BankSyncModuleLoader;
}): Promise<(args: { provider: BankSyncProvider; headers: Record<string, string> }) => Promise<string | null>> {
  const { env, moduleLoader } = input;
  const mode = (
    getEnvFirst(env, ['BANK_SYNC_WEBHOOK_SECRET_PROVIDER']) ?? 'static'
  ).trim().toLowerCase() as BankSyncWebhookSecretProvider;

  if (mode === 'aws') {
    const secretId = requiredEnv(env, 'BANK_SYNC_AWS_PLAID_WEBHOOK_SECRET_ID');
    const awsRegion = getEnvFirst(env, ['BANK_SYNC_AWS_REGION', 'AWS_REGION']);
    const awsSecretsModule = await moduleLoader.importModule(
      '@aws-sdk/client-secrets-manager',
    );
    const SecretsManagerClient = awsSecretsModule.SecretsManagerClient as
      | (new (input?: Record<string, unknown>) => { send: (command: unknown) => Promise<Record<string, unknown>> })
      | undefined;
    const GetSecretValueCommand = awsSecretsModule.GetSecretValueCommand as
      | AwsSdkV3CommandConstructor<AwsGetSecretValueInput>
      | undefined;

    if (!SecretsManagerClient || !GetSecretValueCommand) {
      throw new Error(
        'Failed to load AWS Secrets Manager SDK exports (SecretsManagerClient/GetSecretValueCommand).',
      );
    }

    const secretsClient = awsRegion
      ? new SecretsManagerClient({ region: awsRegion })
      : new SecretsManagerClient();
    return createAwsSdkV3SecretsManagerWebhookSecretResolver({
      secretsClient,
      GetSecretValueCommand,
      secretIdByProvider: {
        plaid: secretId,
      },
      cacheTtlSeconds: asInt(env.BANK_SYNC_WEBHOOK_SECRET_CACHE_TTL_SECONDS, 300),
    });
  }

  if (mode === 'gcp') {
    const secretVersionName = requiredEnv(
      env,
      'BANK_SYNC_GCP_PLAID_WEBHOOK_SECRET_VERSION',
    );
    const gcpSecretModule = await moduleLoader.importModule(
      '@google-cloud/secret-manager',
    );
    const SecretManagerServiceClient = gcpSecretModule.SecretManagerServiceClient as
      | (new () => {
        accessSecretVersion: (input: Record<string, unknown>) => Promise<[Record<string, unknown>]>;
      })
      | undefined;

    if (!SecretManagerServiceClient) {
      throw new Error(
        'Failed to load GCP Secret Manager SDK export SecretManagerServiceClient.',
      );
    }

    const secretManagerClient = new SecretManagerServiceClient();
    return createGcpSecretManagerWebhookSecretResolver({
      secretManagerClient: {
        accessSecretVersion(inputPayload) {
          return secretManagerClient.accessSecretVersion(
            inputPayload as unknown as Record<string, unknown>,
          );
        },
      },
      secretVersionNameByProvider: {
        plaid: secretVersionName,
      },
      cacheTtlSeconds: asInt(env.BANK_SYNC_WEBHOOK_SECRET_CACHE_TTL_SECONDS, 300),
    });
  }

  const staticSecret = getEnvFirst(env, [
    'BANK_SYNC_PLAID_WEBHOOK_SECRET',
    'BANK_SYNC_WEBHOOK_SECRET',
  ]);
  if (!staticSecret) {
    throw new Error(
      'Missing BANK_SYNC_PLAID_WEBHOOK_SECRET (or BANK_SYNC_WEBHOOK_SECRET) for static webhook verification mode.',
    );
  }

  return createStaticWebhookSecretResolver({
    secretByProvider: {
      plaid: staticSecret,
    },
  });
}

function getRuntimeCacheKey(env: BankSyncRuntimeEnv): string {
  const keys = [
    'BANK_SYNC_KMS_PROVIDER',
    'BANK_SYNC_WEBHOOK_SECRET_PROVIDER',
    'BANK_SYNC_AWS_REGION',
    'AWS_REGION',
    'BANK_SYNC_AWS_KMS_KEY_ID',
    'BANK_SYNC_GCP_KMS_CRYPTO_KEY_NAME',
    'BANK_SYNC_AWS_PLAID_WEBHOOK_SECRET_ID',
    'BANK_SYNC_GCP_PLAID_WEBHOOK_SECRET_VERSION',
    'BANK_SYNC_PLAID_WEBHOOK_SECRET',
    'BANK_SYNC_WEBHOOK_SECRET',
    'BANK_SYNC_ALLOW_INSECURE_DEV',
    'BANK_SYNC_PLAID_CLIENT_ID',
    'PLAID_CLIENT_ID',
    'BANK_SYNC_PLAID_SECRET',
    'PLAID_SECRET',
    'BANK_SYNC_PLAID_ENV',
    'PLAID_ENV',
    'BANK_SYNC_PLAID_PRODUCTS',
    'BANK_SYNC_PLAID_COUNTRY_CODES',
    'BANK_SYNC_WEBHOOK_SIGNATURE_HEADER',
    'BANK_SYNC_WEBHOOK_SIGNATURE_PREFIX',
    'BANK_SYNC_WEBHOOK_TIMESTAMP_HEADER',
    'BANK_SYNC_WEBHOOK_MAX_AGE_SECONDS',
  ];

  return keys.map((key) => `${key}:${env[key] ?? ''}`).join('|');
}

export async function createBankSyncServerRuntime(
  options: BankSyncRuntimeOptions,
): Promise<BankSyncServerRuntime> {
  const { env, fetchImpl, nowIso, nowEpochSeconds } = options;
  const moduleLoader = options.moduleLoader ?? createDefaultModuleLoader();
  const httpClient = createFetchHttpClient({ fetchImpl });
  const tokenVault = await createTokenVault({ env, moduleLoader });

  const plaidClientId = getEnvFirst(env, ['BANK_SYNC_PLAID_CLIENT_ID', 'PLAID_CLIENT_ID']);
  const plaidSecret = getEnvFirst(env, ['BANK_SYNC_PLAID_SECRET', 'PLAID_SECRET']);
  if (!plaidClientId || !plaidSecret) {
    throw new Error(
      'Missing Plaid credentials. Set BANK_SYNC_PLAID_CLIENT_ID/SECRET (or PLAID_CLIENT_ID/SECRET).',
    );
  }

  const plaidEnvironment = (getEnvFirst(env, ['BANK_SYNC_PLAID_ENV', 'PLAID_ENV']) ?? 'sandbox')
    .trim()
    .toLowerCase();
  if (
    plaidEnvironment !== 'sandbox'
    && plaidEnvironment !== 'development'
    && plaidEnvironment !== 'production'
  ) {
    throw new Error(
      'Invalid BANK_SYNC_PLAID_ENV value. Must be sandbox, development, or production.',
    );
  }

  const providerRouter = createBankSyncProviderRouter([
    createPlaidProviderClient(
      {
        clientId: plaidClientId,
        secret: plaidSecret,
        environment: plaidEnvironment,
        clientName: getEnvFirst(env, ['BANK_SYNC_PLAID_CLIENT_NAME']) ?? 'MyBudget',
        language: getEnvFirst(env, ['BANK_SYNC_PLAID_LANGUAGE']) ?? 'en',
        countryCodes: asCsv(getEnvFirst(env, ['BANK_SYNC_PLAID_COUNTRY_CODES'])),
        products: asCsv(getEnvFirst(env, ['BANK_SYNC_PLAID_PRODUCTS'])),
        redirectUri: getEnvFirst(env, ['BANK_SYNC_PLAID_REDIRECT_URI']),
        webhookUrl: getEnvFirst(env, ['BANK_SYNC_PLAID_WEBHOOK_URL']),
      },
      {
        httpClient,
        tokenVault,
      },
    ),
  ]);

  const secretResolver = await createWebhookSecretResolver({
    env,
    moduleLoader,
  });
  const defaultProvider = asProvider(
    getEnvFirst(env, ['BANK_SYNC_DEFAULT_PROVIDER']),
    'plaid',
  );
  if (!BANK_SYNC_IMPLEMENTED_PROVIDERS.includes(defaultProvider)) {
    throw new Error(
      `BANK_SYNC_DEFAULT_PROVIDER "${defaultProvider}" is not implemented in this build. Implemented providers: ${BANK_SYNC_IMPLEMENTED_PROVIDERS.join(', ')}.`,
    );
  }
  const signatureHeader = getEnvFirst(env, ['BANK_SYNC_WEBHOOK_SIGNATURE_HEADER'])
    ?? 'x-bank-signature';
  const timestampHeader = getEnvFirst(env, ['BANK_SYNC_WEBHOOK_TIMESTAMP_HEADER'])
    ?? 'x-bank-timestamp';
  const signaturePrefix = getEnvFirst(env, ['BANK_SYNC_WEBHOOK_SIGNATURE_PREFIX'])
    ?? 'v1=';

  const webhookVerifier = createHmacWebhookVerifier({
    strategies: [
      {
        provider: defaultProvider,
        signatureHeader,
        timestampHeader,
        signaturePrefix,
        maxAgeSeconds: asInt(env.BANK_SYNC_WEBHOOK_MAX_AGE_SECONDS, 300),
        signatureEncoding: (getEnvFirst(env, ['BANK_SYNC_WEBHOOK_SIGNATURE_ENCODING']) ?? 'hex')
          .trim()
          .toLowerCase() === 'base64'
          ? 'base64'
          : 'hex',
        resolveSigningSecret: secretResolver,
      },
    ],
    hmacDigest: createWebCryptoHmacDigest(),
    nowEpochSeconds,
  });

  const auditLogToConsole = asBool(env.BANK_SYNC_AUDIT_LOG_TO_CONSOLE, true);
  const auditLogger = createBankSyncAuditLogger({
    nowIso,
    sink: {
      append(entry: BankSyncAuditEntry): void {
        if (!auditLogToConsole) return;
        console.info('[bank-sync-audit]', JSON.stringify(entry));
      },
    },
  });

  const store = createInMemoryBankSyncConnectorStore();
  const connector = createBankSyncConnectorService({
    providerRouter,
    store,
    auditLogger,
    webhookVerifier,
    nowIso,
  });

  return { connector, store };
}

export async function getBankSyncServerRuntime(
  options: BankSyncRuntimeOptions,
): Promise<BankSyncServerRuntime> {
  const cacheKey = getRuntimeCacheKey(options.env);
  if (runtimeSingleton && runtimeSingleton.cacheKey === cacheKey) {
    return runtimeSingleton.runtimePromise;
  }

  const runtimePromise = createBankSyncServerRuntime(options);
  runtimeSingleton = {
    cacheKey,
    runtimePromise,
  };
  return runtimePromise;
}

export function resetBankSyncServerRuntimeCache(): void {
  runtimeSingleton = null;
}

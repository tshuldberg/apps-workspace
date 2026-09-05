import { describe, expect, it } from 'vitest';

import {
  createBankSyncServerRuntime,
  getBankSyncServerRuntime,
  resetBankSyncServerRuntimeCache,
  type BankSyncRuntimeEnv,
} from '../server-runtime';

class FakeAwsKmsClient {
  async send(command: { input?: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const input = command.input ?? {};
    if ('Plaintext' in input) {
      return { CiphertextBlob: new Uint8Array([1, 2, 3]) };
    }
    return { Plaintext: new Uint8Array([97, 98, 99]) };
  }
}

class FakeAwsEncryptCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

class FakeAwsDecryptCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

class FakeAwsSecretsClient {
  async send(): Promise<Record<string, unknown>> {
    return { SecretString: 'webhook-secret' };
  }
}

class FakeAwsGetSecretValueCommand {
  constructor(public readonly input: Record<string, unknown>) {}
}

function baseEnv(overrides: BankSyncRuntimeEnv = {}): BankSyncRuntimeEnv {
  return {
    BANK_SYNC_ALLOW_INSECURE_DEV: 'true',
    BANK_SYNC_KMS_PROVIDER: 'insecure_dev',
    BANK_SYNC_WEBHOOK_SECRET_PROVIDER: 'static',
    BANK_SYNC_PLAID_WEBHOOK_SECRET: 'webhook-secret',
    BANK_SYNC_PLAID_CLIENT_ID: 'plaid-client-id',
    BANK_SYNC_PLAID_SECRET: 'plaid-secret',
    BANK_SYNC_PLAID_ENV: 'sandbox',
    ...overrides,
  };
}

describe('bank sync server runtime', () => {
  it('creates runtime with insecure dev mode for local development', async () => {
    const runtime = await createBankSyncServerRuntime({
      env: baseEnv(),
      fetchImpl: async () => ({
        status: 200,
        text: async () => JSON.stringify({ link_token: 'token-1' }),
      }),
    });

    const result = await runtime.connector.createLinkToken({
      provider: 'plaid',
      userId: 'user-1',
    });
    expect(result.token).toBe('token-1');
  });

  it('loads AWS SDK modules when configured for aws kms + aws secrets', async () => {
    const importedModules: string[] = [];

    await createBankSyncServerRuntime({
      env: baseEnv({
        BANK_SYNC_ALLOW_INSECURE_DEV: undefined,
        BANK_SYNC_KMS_PROVIDER: 'aws',
        BANK_SYNC_WEBHOOK_SECRET_PROVIDER: 'aws',
        BANK_SYNC_AWS_KMS_KEY_ID: 'kms-key-1',
        BANK_SYNC_AWS_PLAID_WEBHOOK_SECRET_ID: 'secret-id',
      }),
      fetchImpl: async () => ({
        status: 200,
        text: async () => JSON.stringify({}),
      }),
      moduleLoader: {
        async importModule(specifier: string): Promise<Record<string, unknown>> {
          importedModules.push(specifier);
          if (specifier === '@aws-sdk/client-kms') {
            return {
              KMSClient: FakeAwsKmsClient,
              EncryptCommand: FakeAwsEncryptCommand,
              DecryptCommand: FakeAwsDecryptCommand,
            };
          }
          if (specifier === '@aws-sdk/client-secrets-manager') {
            return {
              SecretsManagerClient: FakeAwsSecretsClient,
              GetSecretValueCommand: FakeAwsGetSecretValueCommand,
            };
          }
          throw new Error(`Unexpected module: ${specifier}`);
        },
      },
    });

    expect(importedModules).toContain('@aws-sdk/client-kms');
    expect(importedModules).toContain('@aws-sdk/client-secrets-manager');
  });

  it('reuses singleton runtime cache for equivalent env snapshots', async () => {
    resetBankSyncServerRuntimeCache();

    const runtimeOne = await getBankSyncServerRuntime({
      env: baseEnv(),
      fetchImpl: async () => ({
        status: 200,
        text: async () => '{}',
      }),
    });

    const runtimeTwo = await getBankSyncServerRuntime({
      env: baseEnv(),
      fetchImpl: async () => ({
        status: 200,
        text: async () => '{}',
      }),
    });

    expect(runtimeOne).toBe(runtimeTwo);
  });
});

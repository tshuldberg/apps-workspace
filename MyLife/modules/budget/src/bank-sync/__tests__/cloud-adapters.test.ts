import { describe, expect, it } from 'vitest';

import {
  createAwsKmsVaultClient,
  createAwsSdkV3KmsVaultClient,
  createAwsSdkV3SecretsManagerWebhookSecretResolver,
  createAwsSecretsManagerWebhookSecretResolver,
  createGcpKmsVaultClient,
  createGcpSecretManagerWebhookSecretResolver,
  createStaticWebhookSecretResolver,
  createWebCryptoHmacDigest,
} from '../cloud-adapters';

function asciiBytes(input: string): Uint8Array {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = input.charCodeAt(index);
  }
  return output;
}

function asciiString(input: Uint8Array): string {
  let output = '';
  for (const byte of input) output += String.fromCharCode(byte);
  return output;
}

describe('bank-sync cloud adapters', () => {
  it('wraps AWS KMS encrypt/decrypt operations as a token vault client', async () => {
    const capturedInputs: Array<{
      kind: 'encrypt' | 'decrypt';
      value: Record<string, unknown>;
    }> = [];

    const client = createAwsKmsVaultClient({
      keyId: 'kms-key-1',
      kmsClient: {
        async encrypt(input) {
          capturedInputs.push({
            kind: 'encrypt',
            value: input as unknown as Record<string, unknown>,
          });
          return { CiphertextBlob: new Uint8Array([1, 2, 3]) };
        },
        async decrypt(input) {
          capturedInputs.push({
            kind: 'decrypt',
            value: input as unknown as Record<string, unknown>,
          });
          return { Plaintext: asciiBytes('token-ok') };
        },
      },
    });

    const encrypted = await client.encrypt({
      plaintext: 'token-ok',
      encryptionContext: { provider: 'plaid' },
    });
    const encryptedRequest = capturedInputs.find((item) => item.kind === 'encrypt');
    expect(encrypted.ciphertext).toBe('AQID');
    expect(encryptedRequest?.value.KeyId).toBe('kms-key-1');
    expect(encryptedRequest?.value.EncryptionContext).toEqual({
      provider: 'plaid',
    });

    const decrypted = await client.decrypt({
      ciphertext: 'AQID',
      encryptionContext: { provider: 'plaid' },
    });
    const decryptedRequest = capturedInputs.find((item) => item.kind === 'decrypt');
    expect(decrypted.plaintext).toBe('token-ok');
    expect(decryptedRequest?.value.CiphertextBlob).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('supports AWS SDK v3 command-style clients for KMS and Secrets Manager', async () => {
    class EncryptCommand {
      constructor(
        public readonly input: {
          KeyId: string;
          Plaintext: Uint8Array;
          EncryptionContext?: Record<string, string>;
        },
      ) {}
    }
    class DecryptCommand {
      constructor(
        public readonly input: {
          CiphertextBlob: Uint8Array;
          EncryptionContext?: Record<string, string>;
        },
      ) {}
    }
    class GetSecretValueCommand {
      constructor(public readonly input: { SecretId: string }) {}
    }

    const sentCommands: unknown[] = [];
    const sdkClient = {
      async send(command: unknown): Promise<Record<string, unknown>> {
        sentCommands.push(command);
        if (command instanceof EncryptCommand) {
          return { CiphertextBlob: new Uint8Array([9]) };
        }
        if (command instanceof DecryptCommand) {
          return { Plaintext: asciiBytes('x') };
        }
        if (command instanceof GetSecretValueCommand) {
          return { SecretString: 'webhook-secret' };
        }
        throw new Error('Unknown command');
      },
    };

    const kmsVaultClient = createAwsSdkV3KmsVaultClient({
      kmsClient: sdkClient,
      keyId: 'kms-key-2',
      EncryptCommand,
      DecryptCommand,
    });
    const encrypted = await kmsVaultClient.encrypt({
      plaintext: 'x',
      encryptionContext: {},
    });
    expect(encrypted.ciphertext).toBe('CQ==');

    const decrypted = await kmsVaultClient.decrypt({
      ciphertext: 'CQ==',
      encryptionContext: {},
    });
    expect(decrypted.plaintext).toBe('x');

    const secretResolver = createAwsSdkV3SecretsManagerWebhookSecretResolver({
      secretsClient: sdkClient,
      GetSecretValueCommand,
      secretIdByProvider: { plaid: 'plaid/webhook/secret' },
    });
    const secret = await secretResolver({ provider: 'plaid', headers: {} });
    expect(secret).toBe('webhook-secret');
    expect(sentCommands.some((cmd) => cmd instanceof EncryptCommand)).toBe(true);
    expect(sentCommands.some((cmd) => cmd instanceof DecryptCommand)).toBe(true);
    expect(sentCommands.some((cmd) => cmd instanceof GetSecretValueCommand)).toBe(
      true,
    );
  });

  it('wraps GCP KMS clients and includes sorted context as AAD', async () => {
    let encryptAad: Uint8Array | undefined;
    let decryptAad: Uint8Array | undefined;

    const kmsClient = createGcpKmsVaultClient({
      cryptoKeyName:
        'projects/p/locations/global/keyRings/r/cryptoKeys/budget-sync',
      kmsClient: {
        async encrypt(input) {
          encryptAad = input.additionalAuthenticatedData;
          return [{ ciphertext: 'AQID' }];
        },
        async decrypt(input) {
          decryptAad = input.additionalAuthenticatedData;
          return [{ plaintext: 'dG9rZW4tb2s=' }];
        },
      },
    });

    const encrypted = await kmsClient.encrypt({
      plaintext: 'token-ok',
      encryptionContext: { z: '2', a: '1' },
    });
    expect(encrypted.ciphertext).toBe('AQID');

    const decrypted = await kmsClient.decrypt({
      ciphertext: 'AQID',
      encryptionContext: { a: '1', z: '2' },
    });
    expect(decrypted.plaintext).toBe('token-ok');

    expect(encryptAad).toBeDefined();
    expect(decryptAad).toBeDefined();
    expect(asciiString(encryptAad!)).toBe('[["a","1"],["z","2"]]');
    expect(asciiString(decryptAad!)).toBe('[["a","1"],["z","2"]]');
  });

  it('resolves webhook secrets from static, AWS, and GCP stores with caching', async () => {
    const staticResolver = createStaticWebhookSecretResolver({
      secretByProvider: { plaid: 'static-secret' },
    });
    expect(await staticResolver({ provider: 'plaid', headers: {} })).toBe(
      'static-secret',
    );

    let now = 1_000;
    let awsCalls = 0;
    const awsResolver = createAwsSecretsManagerWebhookSecretResolver({
      secretsClient: {
        async getSecretValue() {
          awsCalls += 1;
          return { SecretString: 'aws-secret' };
        },
      },
      secretIdByProvider: { plaid: 'plaid/webhook' },
      nowEpochSeconds: () => now,
      cacheTtlSeconds: 60,
    });

    expect(await awsResolver({ provider: 'plaid', headers: {} })).toBe('aws-secret');
    expect(await awsResolver({ provider: 'plaid', headers: {} })).toBe('aws-secret');
    expect(awsCalls).toBe(1);
    now += 61;
    expect(await awsResolver({ provider: 'plaid', headers: {} })).toBe('aws-secret');
    expect(awsCalls).toBe(2);

    const gcpResolver = createGcpSecretManagerWebhookSecretResolver({
      secretManagerClient: {
        async accessSecretVersion() {
          return [{ payload: { data: 'Z2NwLXNlY3JldA==' } }];
        },
      },
      secretVersionNameByProvider: { plaid: 'projects/p/secrets/s/versions/latest' },
    });
    expect(await gcpResolver({ provider: 'plaid', headers: {} })).toBe('gcp-secret');
  });

  it('creates HMAC digest output from Web Crypto subtle API', async () => {
    let lastImportedKeyData: Uint8Array | null = null;
    const subtle = {
      async importKey(
        _format: string,
        keyData: ArrayBuffer | ArrayBufferView,
      ): Promise<unknown> {
        const view =
          keyData instanceof ArrayBuffer
            ? new Uint8Array(keyData)
            : new Uint8Array(keyData.buffer);
        lastImportedKeyData = view;
        return { id: 'hmac-key' };
      },
      async sign(): Promise<ArrayBuffer> {
        return new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer;
      },
    };

    const digest = createWebCryptoHmacDigest({
      subtleCrypto: subtle,
    });
    const hexDigest = await digest({
      secret: 'abc',
      payload: 'payload',
      encoding: 'hex',
    });
    const base64Digest = await digest({
      secret: 'abc',
      payload: 'payload',
      encoding: 'base64',
    });

    expect(lastImportedKeyData).toEqual(asciiBytes('abc'));
    expect(hexDigest).toBe('deadbeef');
    expect(base64Digest).toBe('3q2+7w==');
  });
});

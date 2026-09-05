import type { KmsVaultClient } from './token-vault';
import type { BankSyncProvider } from './types';
import type { HmacDigestFn } from './webhook-security';

type MaybePromise<T> = T | Promise<T>;
type MaybeTuple<T> = T | [T];

type BinaryValue = ArrayBuffer | Uint8Array | string;

interface Utf8Codec {
  encode(input: string): Uint8Array;
  decode(input: Uint8Array): string;
}

interface TextEncoderLike {
  encode(input: string): Uint8Array;
}

interface TextDecoderLike {
  decode(input: Uint8Array): string;
}

interface GlobalTextCodec {
  TextEncoder?: new () => TextEncoderLike;
  TextDecoder?: new () => TextDecoderLike;
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function unwrapTuple<T>(value: MaybeTuple<T>): T {
  return Array.isArray(value) ? value[0] : value;
}

function encodeUtf8Fallback(input: string): Uint8Array {
  const escaped = unescape(encodeURIComponent(input));
  const output = new Uint8Array(escaped.length);
  for (let i = 0; i < escaped.length; i += 1) {
    output[i] = escaped.charCodeAt(i);
  }
  return output;
}

function decodeUtf8Fallback(input: Uint8Array): string {
  let encoded = '';
  for (let i = 0; i < input.length; i += 1) {
    encoded += String.fromCharCode(input[i]);
  }
  return decodeURIComponent(escape(encoded));
}

function createUtf8Codec(): Utf8Codec {
  const globalCodec = globalThis as unknown as GlobalTextCodec;
  const encoder = globalCodec.TextEncoder ? new globalCodec.TextEncoder() : null;
  const decoder = globalCodec.TextDecoder ? new globalCodec.TextDecoder() : null;

  return {
    encode(input: string): Uint8Array {
      if (encoder) return encoder.encode(input);
      return encodeUtf8Fallback(input);
    },
    decode(input: Uint8Array): string {
      if (decoder) return decoder.decode(input);
      return decodeUtf8Fallback(input);
    },
  };
}

function asUint8Array(input: BinaryValue, inputEncoding: 'utf8' | 'base64'): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (inputEncoding === 'base64') return decodeBase64(input);
  return createUtf8Codec().encode(input);
}

function encodeHex(input: Uint8Array): string {
  let output = '';
  for (const byte of input) {
    output += byte.toString(16).padStart(2, '0');
  }
  return output;
}

function encodeBase64Manual(input: Uint8Array): string {
  let output = '';
  for (let i = 0; i < input.length; i += 3) {
    const byte1 = input[i] ?? 0;
    const byte2 = input[i + 1] ?? 0;
    const byte3 = input[i + 2] ?? 0;
    const hasByte2 = i + 1 < input.length;
    const hasByte3 = i + 2 < input.length;

    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;
    const index1 = (chunk >> 18) & 0x3f;
    const index2 = (chunk >> 12) & 0x3f;
    const index3 = (chunk >> 6) & 0x3f;
    const index4 = chunk & 0x3f;

    output += BASE64_ALPHABET[index1];
    output += BASE64_ALPHABET[index2];
    output += hasByte2 ? BASE64_ALPHABET[index3] : '=';
    output += hasByte3 ? BASE64_ALPHABET[index4] : '=';
  }
  return output;
}

function decodeBase64Manual(input: string): Uint8Array {
  const cleaned = input.replace(/[\r\n\s]/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i += 4) {
    const char1 = cleaned[i];
    const char2 = cleaned[i + 1];
    const char3 = cleaned[i + 2] ?? '=';
    const char4 = cleaned[i + 3] ?? '=';

    const index1 = BASE64_ALPHABET.indexOf(char1);
    const index2 = BASE64_ALPHABET.indexOf(char2);
    const index3 = char3 === '=' ? 0 : BASE64_ALPHABET.indexOf(char3);
    const index4 = char4 === '=' ? 0 : BASE64_ALPHABET.indexOf(char4);

    if (index1 < 0 || index2 < 0 || index3 < 0 || index4 < 0) {
      throw new Error('Invalid base64 input.');
    }

    const chunk = (index1 << 18) | (index2 << 12) | (index3 << 6) | index4;
    bytes.push((chunk >> 16) & 0xff);
    if (char3 !== '=') bytes.push((chunk >> 8) & 0xff);
    if (char4 !== '=') bytes.push(chunk & 0xff);
  }

  return new Uint8Array(bytes);
}

interface GlobalBase64 {
  btoa?: (value: string) => string;
  atob?: (value: string) => string;
  Buffer?: {
    from(value: Uint8Array | ArrayBuffer): {
      toString(encoding: 'base64'): string;
    };
  };
}

function encodeBase64(input: Uint8Array): string {
  const globalBase64 = globalThis as unknown as GlobalBase64;
  if (globalBase64.Buffer) {
    return globalBase64.Buffer.from(input).toString('base64');
  }

  if (globalBase64.btoa) {
    let binary = '';
    for (const byte of input) binary += String.fromCharCode(byte);
    return globalBase64.btoa(binary);
  }

  return encodeBase64Manual(input);
}

function decodeBase64(input: string): Uint8Array {
  const globalBase64 = globalThis as unknown as GlobalBase64;
  if (globalBase64.atob) {
    const binary = globalBase64.atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return decodeBase64Manual(input);
}

function serializeEncryptionContext(
  context: Record<string, string>,
  utf8: Utf8Codec,
): Uint8Array | undefined {
  const entries = Object.entries(context);
  if (entries.length === 0) return undefined;
  entries.sort(([left], [right]) => left.localeCompare(right));
  return utf8.encode(JSON.stringify(entries));
}

function decodeSecretValue(value: BinaryValue, inputEncoding: 'utf8' | 'base64'): string {
  const bytes = asUint8Array(value, inputEncoding);
  return createUtf8Codec().decode(bytes);
}

export interface AwsKmsEncryptInput {
  KeyId: string;
  Plaintext: Uint8Array;
  EncryptionContext?: Record<string, string>;
}

export interface AwsKmsDecryptInput {
  CiphertextBlob: Uint8Array;
  EncryptionContext?: Record<string, string>;
}

export interface AwsKmsEncryptOutput {
  CiphertextBlob?: BinaryValue;
}

export interface AwsKmsDecryptOutput {
  Plaintext?: BinaryValue;
}

export interface AwsKmsClientLike {
  encrypt(
    input: AwsKmsEncryptInput,
  ): MaybePromise<MaybeTuple<AwsKmsEncryptOutput>>;
  decrypt(
    input: AwsKmsDecryptInput,
  ): MaybePromise<MaybeTuple<AwsKmsDecryptOutput>>;
}

export interface AwsSdkV3ClientLike {
  send(command: unknown): MaybePromise<Record<string, unknown>>;
}

export interface AwsSdkV3CommandConstructor<TInput> {
  new (input: TInput): unknown;
}

export function createAwsKmsVaultClient(input: {
  kmsClient: AwsKmsClientLike;
  keyId: string;
}): KmsVaultClient {
  const { kmsClient, keyId } = input;
  const utf8 = createUtf8Codec();

  return {
    async encrypt(payload): Promise<{ ciphertext: string }> {
      const response = unwrapTuple(
        await Promise.resolve(
          kmsClient.encrypt({
            KeyId: keyId,
            Plaintext: utf8.encode(payload.plaintext),
            EncryptionContext: payload.encryptionContext,
          }),
        ),
      );
      if (!response.CiphertextBlob) {
        throw new Error('AWS KMS encrypt response missing CiphertextBlob.');
      }
      return {
        ciphertext: encodeBase64(asUint8Array(response.CiphertextBlob, 'utf8')),
      };
    },
    async decrypt(payload): Promise<{ plaintext: string }> {
      const response = unwrapTuple(
        await Promise.resolve(
          kmsClient.decrypt({
            CiphertextBlob: decodeBase64(payload.ciphertext),
            EncryptionContext: payload.encryptionContext,
          }),
        ),
      );
      if (!response.Plaintext) {
        throw new Error('AWS KMS decrypt response missing Plaintext.');
      }
      return {
        plaintext: decodeSecretValue(response.Plaintext, 'utf8'),
      };
    },
  };
}

export function createAwsSdkV3KmsVaultClient(input: {
  kmsClient: AwsSdkV3ClientLike;
  keyId: string;
  EncryptCommand: AwsSdkV3CommandConstructor<AwsKmsEncryptInput>;
  DecryptCommand: AwsSdkV3CommandConstructor<AwsKmsDecryptInput>;
}): KmsVaultClient {
  const {
    kmsClient,
    keyId,
    EncryptCommand,
    DecryptCommand,
  } = input;

  return createAwsKmsVaultClient({
    keyId,
    kmsClient: {
      encrypt(request): Promise<AwsKmsEncryptOutput> {
        return Promise.resolve(
          kmsClient.send(new EncryptCommand(request)) as Promise<AwsKmsEncryptOutput>,
        );
      },
      decrypt(request): Promise<AwsKmsDecryptOutput> {
        return Promise.resolve(
          kmsClient.send(new DecryptCommand(request)) as Promise<AwsKmsDecryptOutput>,
        );
      },
    },
  });
}

export interface GcpKmsEncryptInput {
  name: string;
  plaintext: Uint8Array;
  additionalAuthenticatedData?: Uint8Array;
}

export interface GcpKmsDecryptInput {
  name: string;
  ciphertext: Uint8Array;
  additionalAuthenticatedData?: Uint8Array;
}

export interface GcpKmsEncryptOutput {
  ciphertext?: BinaryValue;
}

export interface GcpKmsDecryptOutput {
  plaintext?: BinaryValue;
}

export interface GcpKmsClientLike {
  encrypt(
    input: GcpKmsEncryptInput,
  ): MaybePromise<MaybeTuple<GcpKmsEncryptOutput>>;
  decrypt(
    input: GcpKmsDecryptInput,
  ): MaybePromise<MaybeTuple<GcpKmsDecryptOutput>>;
}

export function createGcpKmsVaultClient(input: {
  kmsClient: GcpKmsClientLike;
  cryptoKeyName: string;
  useEncryptionContextAsAad?: boolean;
}): KmsVaultClient {
  const {
    kmsClient,
    cryptoKeyName,
    useEncryptionContextAsAad = true,
  } = input;
  const utf8 = createUtf8Codec();

  return {
    async encrypt(payload): Promise<{ ciphertext: string }> {
      const aad = useEncryptionContextAsAad
        ? serializeEncryptionContext(payload.encryptionContext, utf8)
        : undefined;

      const response = unwrapTuple(
        await Promise.resolve(
          kmsClient.encrypt({
            name: cryptoKeyName,
            plaintext: utf8.encode(payload.plaintext),
            additionalAuthenticatedData: aad,
          }),
        ),
      );
      if (!response.ciphertext) {
        throw new Error('GCP KMS encrypt response missing ciphertext.');
      }

      if (typeof response.ciphertext === 'string') {
        return { ciphertext: response.ciphertext };
      }
      return {
        ciphertext: encodeBase64(asUint8Array(response.ciphertext, 'utf8')),
      };
    },
    async decrypt(payload): Promise<{ plaintext: string }> {
      const aad = useEncryptionContextAsAad
        ? serializeEncryptionContext(payload.encryptionContext, utf8)
        : undefined;

      const response = unwrapTuple(
        await Promise.resolve(
          kmsClient.decrypt({
            name: cryptoKeyName,
            ciphertext: decodeBase64(payload.ciphertext),
            additionalAuthenticatedData: aad,
          }),
        ),
      );
      if (!response.plaintext) {
        throw new Error('GCP KMS decrypt response missing plaintext.');
      }

      const plaintextInputEncoding =
        typeof response.plaintext === 'string' ? 'base64' : 'utf8';
      return {
        plaintext: decodeSecretValue(response.plaintext, plaintextInputEncoding),
      };
    },
  };
}

export interface WebhookSecretResolverInput {
  provider: BankSyncProvider;
  headers: Record<string, string>;
}

export type WebhookSecretResolver = (
  input: WebhookSecretResolverInput,
) => Promise<string | null>;

export function createStaticWebhookSecretResolver(input: {
  secretByProvider: Partial<Record<BankSyncProvider, string>>;
  fallbackSecret?: string;
}): WebhookSecretResolver {
  const { secretByProvider, fallbackSecret = null } = input;
  return async ({ provider }): Promise<string | null> =>
    secretByProvider[provider] ?? fallbackSecret;
}

export interface AwsSecretValueOutput {
  SecretString?: string;
  SecretBinary?: BinaryValue;
}

export interface AwsSecretsManagerClientLike {
  getSecretValue(input: {
    SecretId: string;
    VersionStage?: string;
  }): MaybePromise<MaybeTuple<AwsSecretValueOutput>>;
}

export interface AwsGetSecretValueInput {
  SecretId: string;
  VersionStage?: string;
}

export function createAwsSecretsManagerWebhookSecretResolver(input: {
  secretsClient: AwsSecretsManagerClientLike;
  secretIdByProvider: Partial<Record<BankSyncProvider, string>>;
  versionStage?: string;
  cacheTtlSeconds?: number;
  nowEpochSeconds?: () => number;
}): WebhookSecretResolver {
  const {
    secretsClient,
    secretIdByProvider,
    versionStage,
    cacheTtlSeconds = 300,
    nowEpochSeconds = () => Math.floor(Date.now() / 1000),
  } = input;
  const cache = new Map<string, { value: string; expiresAt: number }>();

  return async ({ provider }): Promise<string | null> => {
    const secretId = secretIdByProvider[provider];
    if (!secretId) return null;

    const cached = cache.get(secretId);
    if (cached && cached.expiresAt > nowEpochSeconds()) {
      return cached.value;
    }

    const response = unwrapTuple(
      await Promise.resolve(
        secretsClient.getSecretValue({
          SecretId: secretId,
          VersionStage: versionStage,
        }),
      ),
    );
    const secretValue = response.SecretString
      ? response.SecretString
      : response.SecretBinary
        ? decodeSecretValue(response.SecretBinary, 'base64')
        : null;
    if (!secretValue) return null;

    cache.set(secretId, {
      value: secretValue,
      expiresAt: nowEpochSeconds() + cacheTtlSeconds,
    });
    return secretValue;
  };
}

export function createAwsSdkV3SecretsManagerWebhookSecretResolver(input: {
  secretsClient: AwsSdkV3ClientLike;
  GetSecretValueCommand: AwsSdkV3CommandConstructor<AwsGetSecretValueInput>;
  secretIdByProvider: Partial<Record<BankSyncProvider, string>>;
  versionStage?: string;
  cacheTtlSeconds?: number;
  nowEpochSeconds?: () => number;
}): WebhookSecretResolver {
  const {
    secretsClient,
    GetSecretValueCommand,
    secretIdByProvider,
    versionStage,
    cacheTtlSeconds,
    nowEpochSeconds,
  } = input;

  return createAwsSecretsManagerWebhookSecretResolver({
    secretIdByProvider,
    versionStage,
    cacheTtlSeconds,
    nowEpochSeconds,
    secretsClient: {
      getSecretValue(request): Promise<AwsSecretValueOutput> {
        return Promise.resolve(
          secretsClient.send(
            new GetSecretValueCommand(request),
          ) as Promise<AwsSecretValueOutput>,
        );
      },
    },
  });
}

export interface GcpSecretVersionOutput {
  payload?: {
    data?: BinaryValue;
  };
}

export interface GcpSecretManagerClientLike {
  accessSecretVersion(input: {
    name: string;
  }): MaybePromise<MaybeTuple<GcpSecretVersionOutput>>;
}

export function createGcpSecretManagerWebhookSecretResolver(input: {
  secretManagerClient: GcpSecretManagerClientLike;
  secretVersionNameByProvider: Partial<Record<BankSyncProvider, string>>;
  cacheTtlSeconds?: number;
  nowEpochSeconds?: () => number;
}): WebhookSecretResolver {
  const {
    secretManagerClient,
    secretVersionNameByProvider,
    cacheTtlSeconds = 300,
    nowEpochSeconds = () => Math.floor(Date.now() / 1000),
  } = input;
  const cache = new Map<string, { value: string; expiresAt: number }>();

  return async ({ provider }): Promise<string | null> => {
    const secretName = secretVersionNameByProvider[provider];
    if (!secretName) return null;

    const cached = cache.get(secretName);
    if (cached && cached.expiresAt > nowEpochSeconds()) return cached.value;

    const response = unwrapTuple(
      await Promise.resolve(
        secretManagerClient.accessSecretVersion({
          name: secretName,
        }),
      ),
    );
    const rawSecretData = response.payload?.data;
    if (!rawSecretData) return null;

    const inputEncoding = typeof rawSecretData === 'string' ? 'base64' : 'utf8';
    const secretValue = decodeSecretValue(rawSecretData, inputEncoding);
    cache.set(secretName, {
      value: secretValue,
      expiresAt: nowEpochSeconds() + cacheTtlSeconds,
    });
    return secretValue;
  };
}

export interface SubtleCryptoLike {
  importKey(
    format: string,
    keyData: ArrayBuffer | ArrayBufferView,
    algorithm: Record<string, unknown>,
    extractable: boolean,
    keyUsages: string[],
  ): Promise<unknown>;
  sign(
    algorithm: string | Record<string, unknown>,
    key: unknown,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer>;
}

interface GlobalCryptoLike {
  crypto?: {
    subtle?: SubtleCryptoLike;
  };
}

function resolveSubtleCrypto(input?: SubtleCryptoLike): SubtleCryptoLike {
  if (input) return input;
  const maybeGlobalCrypto = globalThis as unknown as GlobalCryptoLike;
  const subtle = maybeGlobalCrypto.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'No Web Crypto subtle implementation found for HMAC digest generation.',
    );
  }
  return subtle;
}

export function createWebCryptoHmacDigest(input?: {
  subtleCrypto?: SubtleCryptoLike;
  hashName?: 'SHA-256' | 'SHA-384' | 'SHA-512';
}): HmacDigestFn {
  const subtle = resolveSubtleCrypto(input?.subtleCrypto);
  const hashName = input?.hashName ?? 'SHA-256';
  const utf8 = createUtf8Codec();

  return async (payload): Promise<string> => {
    const key = await subtle.importKey(
      'raw',
      utf8.encode(payload.secret),
      { name: 'HMAC', hash: { name: hashName } },
      false,
      ['sign'],
    );
    const signatureBuffer = await subtle.sign('HMAC', key, utf8.encode(payload.payload));
    const signatureBytes = new Uint8Array(signatureBuffer);

    if (payload.encoding === 'hex') {
      return encodeHex(signatureBytes);
    }
    return encodeBase64(signatureBytes);
  };
}

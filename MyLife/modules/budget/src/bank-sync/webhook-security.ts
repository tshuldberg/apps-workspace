import type { BankSyncProvider } from './types';

type MaybePromise<T> = T | Promise<T>;

export type WebhookSignatureEncoding = 'hex' | 'base64';

export type BankWebhookVerificationReason =
  | 'provider_not_configured'
  | 'missing_signature'
  | 'missing_timestamp'
  | 'timestamp_out_of_range'
  | 'secret_unavailable'
  | 'invalid_signature';

export interface BankWebhookVerificationRequest {
  provider: BankSyncProvider;
  headers: Record<string, string | undefined>;
  rawBody: string;
}

export interface BankWebhookVerificationResult {
  provider: BankSyncProvider;
  isVerified: boolean;
  reason?: BankWebhookVerificationReason;
  timestampEpochSeconds?: number;
}

export interface BankWebhookVerifier {
  verify(
    input: BankWebhookVerificationRequest,
  ): Promise<BankWebhookVerificationResult>;
}

export interface HmacDigestInput {
  secret: string;
  payload: string;
  encoding: WebhookSignatureEncoding;
}

export type HmacDigestFn = (
  input: HmacDigestInput,
) => MaybePromise<string>;

export interface HmacWebhookStrategy {
  provider: BankSyncProvider;
  signatureHeader: string;
  timestampHeader?: string;
  maxAgeSeconds?: number;
  signatureEncoding?: WebhookSignatureEncoding;
  signaturePrefix?: string;
  resolveSigningSecret(input: {
    provider: BankSyncProvider;
    headers: Record<string, string>;
  }): MaybePromise<string | null>;
  createSignedPayload?(input: {
    rawBody: string;
    timestamp: string | null;
  }): string;
}

function normalizeHeaders(
  headers: Record<string, string | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(headers)) {
    if (typeof value !== 'string') continue;
    normalized[rawKey.toLowerCase()] = value;
  }
  return normalized;
}

function parseSignature(headerValue: string, prefix?: string): string | null {
  const tokens = headerValue.split(',').map((token) => token.trim());
  if (!prefix) {
    return tokens[0] ?? null;
  }

  for (const token of tokens) {
    if (token.startsWith(prefix)) {
      return token.slice(prefix.length);
    }
  }
  if (headerValue.startsWith(prefix)) {
    return headerValue.slice(prefix.length);
  }
  return null;
}

function constantTimeEquals(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index++) {
    const leftCode = left.charCodeAt(index) || 0;
    const rightCode = right.charCodeAt(index) || 0;
    mismatch |= leftCode ^ rightCode;
  }
  return mismatch === 0;
}

function parseTimestampSeconds(value: string): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.floor(numeric);
}

export function createHmacWebhookVerifier(input: {
  strategies: HmacWebhookStrategy[];
  hmacDigest: HmacDigestFn;
  nowEpochSeconds?: () => number;
}): BankWebhookVerifier {
  const {
    strategies,
    hmacDigest,
    nowEpochSeconds = () => Math.floor(Date.now() / 1000),
  } = input;
  const strategyByProvider = new Map<BankSyncProvider, HmacWebhookStrategy>();
  for (const strategy of strategies) {
    strategyByProvider.set(strategy.provider, strategy);
  }

  return {
    async verify(
      request: BankWebhookVerificationRequest,
    ): Promise<BankWebhookVerificationResult> {
      const strategy = strategyByProvider.get(request.provider);
      if (!strategy) {
        return {
          provider: request.provider,
          isVerified: false,
          reason: 'provider_not_configured',
        };
      }

      const headers = normalizeHeaders(request.headers);
      const signatureHeaderValue =
        headers[strategy.signatureHeader.toLowerCase()];
      if (!signatureHeaderValue) {
        return {
          provider: request.provider,
          isVerified: false,
          reason: 'missing_signature',
        };
      }

      const providedSignature = parseSignature(
        signatureHeaderValue,
        strategy.signaturePrefix,
      );
      if (!providedSignature) {
        return {
          provider: request.provider,
          isVerified: false,
          reason: 'missing_signature',
        };
      }

      let timestamp: string | null = null;
      let timestampEpochSeconds: number | undefined;
      if (strategy.timestampHeader) {
        timestamp = headers[strategy.timestampHeader.toLowerCase()] ?? null;
        if (!timestamp) {
          return {
            provider: request.provider,
            isVerified: false,
            reason: 'missing_timestamp',
          };
        }

        const parsedTimestamp = parseTimestampSeconds(timestamp);
        if (parsedTimestamp === null) {
          return {
            provider: request.provider,
            isVerified: false,
            reason: 'missing_timestamp',
          };
        }
        timestampEpochSeconds = parsedTimestamp;

        const maxAgeSeconds = strategy.maxAgeSeconds ?? 300;
        const ageSeconds = Math.abs(nowEpochSeconds() - parsedTimestamp);
        if (ageSeconds > maxAgeSeconds) {
          return {
            provider: request.provider,
            isVerified: false,
            reason: 'timestamp_out_of_range',
            timestampEpochSeconds: parsedTimestamp,
          };
        }
      }

      const secret = await Promise.resolve(
        strategy.resolveSigningSecret({
          provider: request.provider,
          headers,
        }),
      );
      if (!secret) {
        return {
          provider: request.provider,
          isVerified: false,
          reason: 'secret_unavailable',
          timestampEpochSeconds,
        };
      }

      const signedPayload = strategy.createSignedPayload
        ? strategy.createSignedPayload({
            rawBody: request.rawBody,
            timestamp,
          })
        : timestamp
          ? `${timestamp}.${request.rawBody}`
          : request.rawBody;
      const expectedSignature = await Promise.resolve(
        hmacDigest({
          secret,
          payload: signedPayload,
          encoding: strategy.signatureEncoding ?? 'hex',
        }),
      );

      if (!constantTimeEquals(providedSignature, expectedSignature)) {
        return {
          provider: request.provider,
          isVerified: false,
          reason: 'invalid_signature',
          timestampEpochSeconds,
        };
      }

      return {
        provider: request.provider,
        isVerified: true,
        timestampEpochSeconds,
      };
    },
  };
}

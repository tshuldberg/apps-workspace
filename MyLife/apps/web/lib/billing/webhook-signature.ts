import crypto from 'node:crypto';

export type StripeWebhookSignatureFailureReason =
  | 'missing_header'
  | 'invalid_format'
  | 'invalid_timestamp'
  | 'timestamp_out_of_tolerance'
  | 'invalid_signature';

export type VerifyStripeWebhookSignatureResult =
  | { ok: true }
  | { ok: false; reason: StripeWebhookSignatureFailureReason };

interface ParsedStripeSignatureHeader {
  timestamp: number;
  signatures: string[];
}

const DEFAULT_TOLERANCE_SECONDS = 300;

function parseStripeSignatureHeader(signatureHeader: string): ParsedStripeSignatureHeader | null {
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=');
    const trimmedKey = key?.trim();
    const trimmedValue = value?.trim();
    if (!trimmedKey || !trimmedValue) {
      continue;
    }

    if (trimmedKey === 't') {
      const parsedTimestamp = Number.parseInt(trimmedValue, 10);
      if (!Number.isFinite(parsedTimestamp)) {
        return null;
      }
      timestamp = parsedTimestamp;
      continue;
    }

    if (trimmedKey === 'v1') {
      signatures.push(trimmedValue);
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

function computeExpectedSignature(payload: string, secret: string, timestamp: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
}

export function verifyStripeWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowMs?: number;
}): VerifyStripeWebhookSignatureResult {
  if (!input.signatureHeader) {
    return { ok: false, reason: 'missing_header' };
  }

  const parsedHeader = parseStripeSignatureHeader(input.signatureHeader);
  if (!parsedHeader) {
    return { ok: false, reason: 'invalid_format' };
  }

  const nowMs = input.nowMs ?? Date.now();
  const toleranceSeconds = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const timestampMs = parsedHeader.timestamp * 1000;
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  if (Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expectedSignature = computeExpectedSignature(
    input.payload,
    input.secret,
    parsedHeader.timestamp,
  );
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  for (const signature of parsedHeader.signatures) {
    const receivedBuffer = Buffer.from(signature, 'utf8');
    if (receivedBuffer.length !== expectedBuffer.length) {
      continue;
    }

    if (crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'invalid_signature' };
}

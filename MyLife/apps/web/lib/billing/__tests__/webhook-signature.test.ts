import crypto from 'node:crypto';
import { verifyStripeWebhookSignature } from '../webhook-signature';

function createSignatureHeader(
  payload: string,
  secret: string,
  timestamp: number,
  opts?: { extraV1?: string[] },
): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  const parts = [`t=${timestamp}`, `v1=${signature}`];
  for (const extraSignature of opts?.extraV1 ?? []) {
    parts.push(`v1=${extraSignature}`);
  }
  return parts.join(',');
}

describe('verifyStripeWebhookSignature', () => {
  const secret = 'whsec_test_secret';
  const payload = '{"eventId":"evt_123","eventType":"purchase.created"}';
  const timestamp = 1_762_126_400;
  const nowMs = timestamp * 1000;

  it('accepts a valid stripe-style signature header', () => {
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: createSignatureHeader(payload, secret, timestamp),
      secret,
      nowMs,
    });

    expect(result).toEqual({ ok: true });
  });

  it('accepts a matching signature when multiple v1 values are present', () => {
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: createSignatureHeader(payload, secret, timestamp, {
        extraV1: ['forged', 'still-forged'],
      }),
      secret,
      nowMs,
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects a missing header', () => {
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: null,
      secret,
      nowMs,
    });

    expect(result).toEqual({ ok: false, reason: 'missing_header' });
  });

  it('rejects malformed headers', () => {
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: 'v1=missing-timestamp',
      secret,
      nowMs,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_format' });
  });

  it('rejects stale timestamps outside the tolerance window', () => {
    const staleTimestamp = timestamp - 3_600;
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: createSignatureHeader(payload, secret, staleTimestamp),
      secret,
      nowMs,
      toleranceSeconds: 300,
    });

    expect(result).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
  });

  it('rejects mismatched payload signatures', () => {
    const result = verifyStripeWebhookSignature({
      payload,
      signatureHeader: createSignatureHeader('{"tampered":true}', secret, timestamp),
      secret,
      nowMs,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' });
  });
});

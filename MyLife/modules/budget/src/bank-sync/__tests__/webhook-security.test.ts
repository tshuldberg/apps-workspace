import { describe, expect, it } from 'vitest';

import { createHmacWebhookVerifier } from '../webhook-security';

function fakeDigest(input: {
  secret: string;
  payload: string;
  encoding: 'hex' | 'base64';
}): string {
  return `${input.encoding}:${input.secret}:${input.payload}`;
}

describe('Hmac webhook verifier', () => {
  it('accepts valid signatures and timestamp windows', async () => {
    const verifier = createHmacWebhookVerifier({
      strategies: [
        {
          provider: 'plaid',
          signatureHeader: 'x-signature',
          signaturePrefix: 'v1=',
          timestampHeader: 'x-timestamp',
          maxAgeSeconds: 300,
          signatureEncoding: 'hex',
          resolveSigningSecret: () => 'secret-1',
        },
      ],
      hmacDigest: fakeDigest,
      nowEpochSeconds: () => 1_000,
    });

    const payload = '{"event":"SYNC_UPDATES_AVAILABLE"}';
    const timestamp = '950';
    const expectedSignature = fakeDigest({
      secret: 'secret-1',
      payload: `${timestamp}.${payload}`,
      encoding: 'hex',
    });

    const result = await verifier.verify({
      provider: 'plaid',
      rawBody: payload,
      headers: {
        'x-signature': `v1=${expectedSignature}`,
        'x-timestamp': timestamp,
      },
    });

    expect(result.isVerified).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects invalid signatures and stale timestamps', async () => {
    const verifier = createHmacWebhookVerifier({
      strategies: [
        {
          provider: 'plaid',
          signatureHeader: 'x-signature',
          timestampHeader: 'x-timestamp',
          maxAgeSeconds: 60,
          resolveSigningSecret: () => 'secret-1',
        },
      ],
      hmacDigest: fakeDigest,
      nowEpochSeconds: () => 1_000,
    });

    const stale = await verifier.verify({
      provider: 'plaid',
      rawBody: '{}',
      headers: {
        'x-signature': 'hex:secret-1:900.{}',
        'x-timestamp': '900',
      },
    });
    expect(stale.isVerified).toBe(false);
    expect(stale.reason).toBe('timestamp_out_of_range');

    const invalidSig = await verifier.verify({
      provider: 'plaid',
      rawBody: '{}',
      headers: {
        'x-signature': 'not-valid',
        'x-timestamp': '990',
      },
    });
    expect(invalidSig.isVerified).toBe(false);
    expect(invalidSig.reason).toBe('invalid_signature');
  });
});

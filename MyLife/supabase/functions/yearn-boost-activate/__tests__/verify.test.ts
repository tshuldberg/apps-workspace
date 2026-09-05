import { beforeAll, describe, expect, it } from 'vitest';
import {
  verifyYearnBoostTransaction,
  type YearnBoostVerificationReason,
} from '../verify.ts';
import {
  certificateBase64,
  certificateChainBase64,
  createTestCertificateChain,
  signTestTransaction,
  validTransactionPayload,
  type TestCertificateChain,
} from './fixtures.ts';

const NOW = new Date('2026-07-11T12:00:00.000Z');
const OPTIONS = {
  expectedBundleId: 'com.mylife.yearn',
  expectedProductId: 'com.mylife.yearn.boost',
  now: NOW,
};

const FAILURE_REASONS = [
  'malformed_jws',
  'bad_chain',
  'bad_signature',
  'wrong_bundle',
  'wrong_product',
  'revoked',
  'expired_cert',
  'not_consumable',
] as const satisfies readonly YearnBoostVerificationReason[];

let certificateChain: TestCertificateChain;
let unrelatedCertificateChain: TestCertificateChain;

beforeAll(async () => {
  certificateChain = await createTestCertificateChain();
  unrelatedCertificateChain = await createTestCertificateChain({
    rootCommonName: 'Unrelated Test Root',
  });
});

async function verify(
  payload: Record<string, unknown>,
  options: {
    chain?: TestCertificateChain;
    trustedRootDer?: Uint8Array;
  } = {},
) {
  const chain = options.chain ?? certificateChain;
  const signedTransaction = await signTestTransaction(chain, payload);
  return verifyYearnBoostTransaction(signedTransaction, {
    ...OPTIONS,
    trustedRootDer: options.trustedRootDer ?? chain.root.certificateDer,
  });
}

describe('verifyYearnBoostTransaction', () => {
  it('verifies a production consumable through a StoreKit-policy certificate chain', async () => {
    const result = await verify(validTransactionPayload());

    expect(result).toEqual({
      valid: true,
      originalTransactionId: 'original-transaction-123',
      transactionId: 'transaction-456',
      environment: 'production',
    });
  });

  it('returns the optional signed app account token', async () => {
    const result = await verify(validTransactionPayload({
      appAccountToken: '11111111-1111-4111-8111-111111111111',
    }));

    expect(result).toEqual({
      valid: true,
      originalTransactionId: 'original-transaction-123',
      transactionId: 'transaction-456',
      appAccountToken: '11111111-1111-4111-8111-111111111111',
      environment: 'production',
    });
  });

  it('normalizes the signed Sandbox environment', async () => {
    const result = await verify(validTransactionPayload({ environment: 'Sandbox' }));

    expect(result).toEqual({
      valid: true,
      originalTransactionId: 'original-transaction-123',
      transactionId: 'transaction-456',
      environment: 'sandbox',
    });
  });

  it.each([
    ['missing segments', 'not-a-jws'],
    ['invalid base64', '!.payload.signature'],
    ['empty segment', 'header..signature'],
  ])('returns malformed_jws for %s', async (_label, signedTransaction) => {
    await expect(verifyYearnBoostTransaction(signedTransaction, {
      ...OPTIONS,
      trustedRootDer: certificateChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'malformed_jws' });
  });

  it('requires ES256 and an x5c chain', async () => {
    const badAlgorithm = await signTestTransaction(certificateChain, validTransactionPayload(), {
      header: { alg: 'RS256', x5c: certificateChainBase64(certificateChain) },
    });
    const missingChain = await signTestTransaction(certificateChain, validTransactionPayload(), {
      header: { alg: 'ES256' },
    });

    await expect(verifyYearnBoostTransaction(badAlgorithm, {
      ...OPTIONS,
      trustedRootDer: certificateChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'malformed_jws' });
    await expect(verifyYearnBoostTransaction(missingChain, {
      ...OPTIONS,
      trustedRootDer: certificateChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'malformed_jws' });
  });

  it('rejects a two-certificate x5c chain as malformed_jws', async () => {
    const signedTransaction = await signTestTransaction(
      certificateChain,
      validTransactionPayload(),
      {
        header: {
          alg: 'ES256',
          x5c: [
            certificateBase64(certificateChain.leaf),
            certificateBase64(certificateChain.intermediate),
          ],
        },
      },
    );

    await expect(verifyYearnBoostTransaction(signedTransaction, {
      ...OPTIONS,
      trustedRootDer: certificateChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'malformed_jws' });
  });

  it('rejects a leaf missing the StoreKit leaf policy extension', async () => {
    const chain = await createTestCertificateChain({ leafHasStoreKitExtension: false });

    await expect(verify(validTransactionPayload(), { chain }))
      .resolves.toEqual({ valid: false, reason: 'bad_chain' });
  });

  it('rejects an intermediate missing the StoreKit intermediate policy extension', async () => {
    const chain = await createTestCertificateChain({
      intermediateHasStoreKitExtension: false,
    });

    await expect(verify(validTransactionPayload(), { chain }))
      .resolves.toEqual({ valid: false, reason: 'bad_chain' });
  });

  it('rejects an intermediate whose basicConstraints does not mark it as a CA', async () => {
    const chain = await createTestCertificateChain({ intermediateIsCa: false });

    await expect(verify(validTransactionPayload(), { chain }))
      .resolves.toEqual({ valid: false, reason: 'bad_chain' });
  });

  it('rejects a correctly signed G3-style chain with a policy-less attacker leaf', async () => {
    const attackerChain = await createTestCertificateChain({
      leafCommonName: 'Developer ID Application: Attacker Controlled',
      leafHasStoreKitExtension: false,
    });

    await expect(verify(validTransactionPayload(), { chain: attackerChain }))
      .resolves.toEqual({ valid: false, reason: 'bad_chain' });
  });

  it('rejects a certificate chain that does not present the trusted root', async () => {
    const result = await verify(validTransactionPayload(), {
      trustedRootDer: unrelatedCertificateChain.root.certificateDer,
    });

    expect(result).toEqual({ valid: false, reason: 'bad_chain' });
  });

  it('rejects a JWS signature not made by the certified leaf key', async () => {
    const signedTransaction = await signTestTransaction(
      certificateChain,
      validTransactionPayload(),
      { privateKey: unrelatedCertificateChain.leaf.privateKey },
    );

    await expect(verifyYearnBoostTransaction(signedTransaction, {
      ...OPTIONS,
      trustedRootDer: certificateChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'bad_signature' });
  });

  it('rejects a signed transaction for another bundle', async () => {
    await expect(verify(validTransactionPayload({ bundleId: 'com.attacker.app' })))
      .resolves.toEqual({ valid: false, reason: 'wrong_bundle' });
  });

  it('rejects a signed transaction for another product', async () => {
    await expect(verify(validTransactionPayload({ productId: 'com.mylife.yearn.membership' })))
      .resolves.toEqual({ valid: false, reason: 'wrong_product' });
  });

  it.each([
    ['revocationDate', { revocationDate: 1_789_000_000_000 }],
    ['revocationReason', { revocationReason: 1 }],
    ['null revocationReason', { revocationReason: null }],
  ])('rejects a signed transaction containing %s', async (_label, revocation) => {
    await expect(verify({ ...validTransactionPayload(), ...revocation }))
      .resolves.toEqual({ valid: false, reason: 'revoked' });
  });

  it('rejects a non-consumable signed transaction', async () => {
    await expect(verify(validTransactionPayload({ type: 'Auto-Renewable Subscription' })))
      .resolves.toEqual({ valid: false, reason: 'not_consumable' });
  });

  it('rejects a transaction signed by a certificate outside its validity window', async () => {
    const expiredChain = await createTestCertificateChain({
      notBefore: '20240101000000Z',
      notAfter: '20250101000000Z',
    });
    const signedTransaction = await signTestTransaction(
      expiredChain,
      validTransactionPayload(),
    );

    await expect(verifyYearnBoostTransaction(signedTransaction, {
      ...OPTIONS,
      trustedRootDer: expiredChain.root.certificateDer,
    })).resolves.toEqual({ valid: false, reason: 'expired_cert' });
  });

  it.each([
    ['empty original transaction id', { originalTransactionId: '   ' }],
    ['empty transaction id', { transactionId: '   ' }],
    ['missing transaction id', { transactionId: undefined }],
    ['non-string app account token', { appAccountToken: 123 }],
    ['empty app account token', { appAccountToken: '   ' }],
    ['unknown environment', { environment: 'Xcode' }],
  ])('returns malformed_jws for a signed payload with %s', async (_label, override) => {
    await expect(verify({ ...validTransactionPayload(), ...override }))
      .resolves.toEqual({ valid: false, reason: 'malformed_jws' });
  });

  it('keeps exhaustive failure reason coverage explicit', () => {
    expect(new Set(FAILURE_REASONS)).toEqual(new Set([
      'malformed_jws',
      'bad_chain',
      'bad_signature',
      'wrong_bundle',
      'wrong_product',
      'revoked',
      'expired_cert',
      'not_consumable',
    ]));
  });
});

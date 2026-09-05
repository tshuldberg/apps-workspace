import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createRevenueCatAppUserId,
  generateDeviceIdentity,
} from '@mylife/sync';
import { createRevenueCatStoreReceiptValidator } from '../hosted-receipt-validator';

const PRODUCT = 'meerkat_app_unlock';
let subject: string;
let receipt: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  const identity = generateDeviceIdentity('RevenueCat test');
  subject = identity.publicKey;
  receipt = createRevenueCatAppUserId(identity);
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('RevenueCat native app-unlock validator', () => {
  it('accepts only the matching subject, product, rail, and real purchase date', async () => {
    const fetchImpl = vi.fn(async () => response({
      subscriber: {
        original_app_user_id: 'prior-device-id',
        non_subscriptions: {
          [PRODUCT]: [{ store: 'app_store', purchase_date: '2026-07-09T12:00:00Z' }],
        },
      },
    }));
    const validator = createRevenueCatStoreReceiptValidator({ apiKey: 'rc-secret', fetchImpl });
    await expect(validator.validate({
      rail: 'storekit', receipt, subjectId: subject, productId: PRODUCT,
    })).resolves.toEqual({ valid: true, purchaseDate: '2026-07-09T12:00:00.000Z' });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(`/subscribers/${encodeURIComponent(receipt)}`),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Platform': 'ios' }) }),
    );
  });

  it('refuses a receipt id that differs from the device-signed subject without a provider call', async () => {
    const fetchImpl = vi.fn();
    const validator = createRevenueCatStoreReceiptValidator({ apiKey: 'rc-secret', fetchImpl });
    const other = generateDeviceIdentity('Other RevenueCat test');
    await expect(validator.validate({
      rail: 'play', receipt: createRevenueCatAppUserId(other), subjectId: subject, productId: PRODUCT,
    })).resolves.toEqual({ valid: false, reason: 'invalid_receipt' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects wrong products, wrong stores, refunds, provider errors, and malformed dates', async () => {
    const cases: Array<[unknown, { valid: false; reason: string }]> = [
      [{ subscriber: { original_app_user_id: 'prior-id', non_subscriptions: {} } }, { valid: false, reason: 'wrong_product' }],
      [{ subscriber: { original_app_user_id: 'prior-id', non_subscriptions: { [PRODUCT]: [{ store: 'app_store', purchase_date: '2026-07-09T12:00:00Z' }] } } }, { valid: false, reason: 'invalid_receipt' }],
      [{ subscriber: { original_app_user_id: 'prior-id', non_subscriptions: { [PRODUCT]: [{ store: 'play_store', purchase_date: '2026-07-09T12:00:00Z', refunded_at: '2026-07-09T13:00:00Z' }] } } }, { valid: false, reason: 'refunded' }],
      [{ subscriber: { original_app_user_id: 'prior-id', non_subscriptions: { [PRODUCT]: [{ store: 'play_store', purchase_date: 'not-a-date' }] } } }, { valid: false, reason: 'invalid_receipt' }],
    ];
    for (const [body, expected] of cases) {
      const validator = createRevenueCatStoreReceiptValidator({ apiKey: 'rc-secret', fetchImpl: async () => response(body) });
      await expect(validator.validate({ rail: 'play', receipt, subjectId: subject, productId: PRODUCT }))
        .resolves.toEqual(expected);
    }
    const outage = createRevenueCatStoreReceiptValidator({ apiKey: 'rc-secret', fetchImpl: async () => response({}, 503) });
    await expect(outage.validate({ rail: 'play', receipt, subjectId: subject, productId: PRODUCT }))
      .resolves.toEqual({ valid: false, reason: 'invalid_receipt' });
  });
});

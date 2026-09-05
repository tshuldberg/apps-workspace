import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MEERKAT_APP_UNLOCK_PRODUCT } from '@mylife/billing-config';
import { AppUnlockPersonaInUseError } from '../../hosted-api';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext } from '../store-context';
import { PostgresMeerkatBillingStore } from '../stores/hosted-billing-store';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;

describePostgres('PostgresMeerkatBillingStore multi-instance integration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_billing_${suffix}`;
  let adminPool: Pool | undefined;
  let firstPool: Pool | undefined;
  let secondPool: Pool | undefined;
  let first: PostgresMeerkatBillingStore;
  let second: PostgresMeerkatBillingStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    const currentName = current.rows[0]?.name ?? '';
    if (!destructiveTestEnabled || !/^meerkat_(?:ci|test)(?:_|$)/u.test(currentName)) {
      throw new Error(
        'Destructive PostgreSQL integration tests require MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS=true and a meerkat_ci or meerkat_test database',
      );
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-billing-integration-a',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    firstPool.on('error', () => undefined);
    secondPool = new Pool({
      connectionString: databaseUrl.toString(),
      application_name: 'meerkat-billing-integration-b',
      max: 2,
      statement_timeout: 10_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 15_000,
    });
    secondPool.on('error', () => undefined);
    await runPostgresMigrations(firstPool);
    first = new PostgresMeerkatBillingStore(new PostgresStoreContext(firstPool));
    second = new PostgresMeerkatBillingStore(new PostgresStoreContext(secondPool));
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('serializes provider events and keeps the newest restrictive purchase', async () => {
    const subjectId = `subject-${randomUUID()}`;
    const base = {
      subjectId,
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      rail: 'stripe' as const,
      purchaseDate: '2026-07-10T12:00:00.000Z',
    };
    const results = await Promise.all([
      first.applyAppPurchaseEvent({
        ...base,
        isActive: true,
        lastProviderEventId: `event-${randomUUID()}`,
        lastProviderEventAt: '2026-07-10T12:00:01.000Z',
      }),
      second.applyAppPurchaseEvent({
        ...base,
        isActive: false,
        lastProviderEventId: `event-${randomUUID()}`,
        lastProviderEventAt: '2026-07-10T12:00:02.000Z',
      }),
    ]);
    expect(results).toContain('applied');
    await expect(first.getAppPurchase(subjectId)).resolves.toMatchObject({
      isActive: false,
      lastProviderEventAt: '2026-07-10T12:00:02.000Z',
    });
  });

  it('deduplicates one provider event across different subjects', async () => {
    const eventId = `event-${randomUUID()}`;
    const eventAt = '2026-07-10T12:01:00.000Z';
    const input = {
      status: 'active' as const,
      updatedAt: eventAt,
      lastProviderEventId: eventId,
      lastProviderEventAt: eventAt,
    };
    const results = await Promise.all([
      first.applySubscriptionEvent({ ...input, subjectId: `subject-${randomUUID()}` }),
      second.applySubscriptionEvent({ ...input, subjectId: `subject-${randomUUID()}` }),
    ]);
    expect(results.filter((result) => result === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result === 'duplicate')).toHaveLength(1);
  });

  it('redeems one hashed link once and checks current purchase state using database time', async () => {
    const subjectId = `subject-${randomUUID()}`;
    await first.upsertAppPurchase({
      subjectId,
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      rail: 'stripe',
      purchaseDate: new Date().toISOString(),
      isActive: true,
    });
    const code = `link-${randomUUID()}`;
    const now = Date.now();
    await first.createLink({
      code,
      subjectId,
      createdAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      consumedAt: null,
    });
    const redemptions = await Promise.all([
      first.redeemLink(code, Number.MAX_SAFE_INTEGER),
      second.redeemLink(code, Number.MIN_SAFE_INTEGER),
    ]);
    expect(redemptions.filter((result) => result !== null)).toEqual([{ subjectId }]);
    expect(redemptions.filter((result) => result === null)).toHaveLength(1);

    const refundedCode = `link-${randomUUID()}`;
    await first.createLink({
      code: refundedCode,
      subjectId,
      createdAt: new Date(now - 1_000).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
      consumedAt: null,
    });
    await first.upsertAppPurchase({
      subjectId,
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      rail: 'stripe',
      purchaseDate: new Date().toISOString(),
      isActive: false,
    });
    await expect(second.redeemLink(refundedCode, now)).resolves.toBeNull();
  });

  it('enforces first-bind-wins for one subject and one persona across subjects', async () => {
    const subject = `subject-${randomUUID()}`;
    const otherSubject = `subject-${randomUUID()}`;
    const hashA = 'ab'.repeat(32);
    const hashB = 'cd'.repeat(32);
    const subjectRace = await Promise.all([
      first.bindAppUnlockPersona(subject, hashA),
      second.bindAppUnlockPersona(subject, hashB),
    ]);
    expect(new Set(subjectRace).size).toBe(1);
    const standing = subjectRace[0]!;
    await expect(first.getAppUnlockPersona(subject)).resolves.toBe(standing);
    await expect(second.bindAppUnlockPersona(otherSubject, standing))
      .rejects.toBeInstanceOf(AppUnlockPersonaInUseError);
    await expect(first.releaseAppUnlockPersona(subject)).resolves.toEqual({
      released: true,
      personaHash: standing,
    });
    await expect(second.bindAppUnlockPersona(otherSubject, standing)).resolves.toBe(standing);
  });

  it('rejects a corrupt typed projection instead of serving contradictory billing state', async () => {
    const subjectId = `subject-${randomUUID()}`;
    await firstPool!.query(
      `INSERT INTO hosted.subscriptions (
         subject_id, provider, active, payload
       ) VALUES ($1, 'stripe', true, $2::jsonb)`,
      [subjectId, JSON.stringify({
        subjectId,
        status: 'canceled',
        updatedAt: new Date().toISOString(),
      })],
    );
    await expect(first.getSubscription(subjectId)).rejects.toThrow(/columns and payload do not match/);
  });
});

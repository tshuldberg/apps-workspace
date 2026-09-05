import { createHash } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import {
  AppUnlockPersonaInUseError,
  type MeerkatAppBillingStore,
  type MeerkatAppLink,
  type MeerkatAppPurchase,
  type MeerkatHostedBillingStore,
  type MeerkatHostedSubscription,
  type MeerkatHostedSubscriptionStatus,
  type ProviderEventApplyResult,
} from '../../hosted-api';
import type { MeerkatPurchaseRail } from '../../hosted-receipt-validator';
import { shouldApplyProviderEvent } from '../../hosted-billing-store-file';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const PERSONA_HASH = /^[a-f0-9]{64}$/;
const SUBSCRIPTION_STATUSES = new Set<MeerkatHostedSubscriptionStatus>([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'unpaid',
  'paused',
]);
const PURCHASE_RAILS = new Set<MeerkatPurchaseRail>(['stripe', 'storekit', 'play']);

interface SubscriptionRow extends QueryResultRow {
  subject_id: string;
  provider: string;
  provider_event_id: string | null;
  provider_event_at: Date | string | null;
  active: boolean;
  payload: unknown;
}

interface PurchaseRow extends QueryResultRow {
  subject_id: string;
  product_id: string;
  rail: string;
  active: boolean;
  provider_event_id: string | null;
  provider_event_at: Date | string | null;
  payload: unknown;
}

interface BindingRow extends QueryResultRow {
  subject_id: string;
  persona_hash: string;
}

function safeText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 512 || normalized.includes('\0')) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

function isoTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${field} must be an ISO timestamp`);
  return parsed.toISOString();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`PostgreSQL ${field} is invalid`);
  return safeText(value, field);
}

function optionalTimestamp(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`PostgreSQL ${field} is invalid`);
  return isoTimestamp(value, field);
}

function jsonObject(value: unknown, field: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL ${field} contains invalid JSON`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL ${field} must be an object`);
  }
  return parsed as Record<string, unknown>;
}

function databaseTimestamp(value: Date | string | null, field: string): string | undefined {
  if (value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`PostgreSQL ${field} is invalid`);
  return parsed.toISOString();
}

function sameTimestamp(left: string | undefined, right: string | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return Date.parse(left) === Date.parse(right);
}

function validateSubscription(value: MeerkatHostedSubscription): MeerkatHostedSubscription {
  safeText(value.subjectId, 'subscription subject');
  if (!SUBSCRIPTION_STATUSES.has(value.status)) throw new TypeError('Subscription status is invalid');
  isoTimestamp(value.updatedAt, 'subscription updatedAt');
  if (value.currentPeriodEnd) isoTimestamp(value.currentPeriodEnd, 'subscription currentPeriodEnd');
  if (value.lastProviderEventAt) isoTimestamp(value.lastProviderEventAt, 'subscription provider event time');
  if (value.customerId) safeText(value.customerId, 'subscription customer id');
  if (value.subscriptionId) safeText(value.subscriptionId, 'subscription id');
  if (value.lastProviderEventId) safeText(value.lastProviderEventId, 'subscription provider event id');
  return value;
}

function validatePurchase(value: MeerkatAppPurchase): MeerkatAppPurchase {
  safeText(value.subjectId, 'purchase subject');
  safeText(value.productId, 'purchase product');
  if (!PURCHASE_RAILS.has(value.rail)) throw new TypeError('Purchase rail is invalid');
  isoTimestamp(value.purchaseDate, 'purchase date');
  if (value.lastProviderEventAt) isoTimestamp(value.lastProviderEventAt, 'purchase provider event time');
  if (value.lastProviderEventId) safeText(value.lastProviderEventId, 'purchase provider event id');
  return value;
}

function decodeSubscription(row: SubscriptionRow, provider: string): MeerkatHostedSubscription {
  const payload = jsonObject(row.payload, 'hosted subscription payload');
  const providerEventAt = databaseTimestamp(
    row.provider_event_at,
    'subscription provider_event_at',
  );
  const customerId = optionalText(payload.customerId, 'subscription customerId');
  const subscriptionId = optionalText(payload.subscriptionId, 'subscription subscriptionId');
  const currentPeriodEnd = optionalTimestamp(
    payload.currentPeriodEnd,
    'subscription currentPeriodEnd',
  );
  if (payload.subjectId !== row.subject_id
    || row.provider !== provider
    || typeof payload.status !== 'string'
    || !SUBSCRIPTION_STATUSES.has(payload.status as MeerkatHostedSubscriptionStatus)
    || row.active !== ['active', 'trialing'].includes(payload.status)
    || payload.lastProviderEventId !== (row.provider_event_id ?? undefined)
    || !sameTimestamp(
      optionalTimestamp(payload.lastProviderEventAt, 'subscription lastProviderEventAt'),
      providerEventAt,
    )
    || typeof payload.updatedAt !== 'string') {
    throw new Error('PostgreSQL hosted subscription columns and payload do not match');
  }
  return validateSubscription({
    subjectId: row.subject_id,
    status: payload.status as MeerkatHostedSubscriptionStatus,
    ...(customerId ? { customerId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
    updatedAt: payload.updatedAt,
    ...(row.provider_event_id ? { lastProviderEventId: row.provider_event_id } : {}),
    ...(providerEventAt ? { lastProviderEventAt: providerEventAt } : {}),
  });
}

function decodePurchase(row: PurchaseRow): MeerkatAppPurchase {
  const payload = jsonObject(row.payload, 'hosted app purchase payload');
  const providerEventAt = databaseTimestamp(row.provider_event_at, 'purchase provider_event_at');
  if (payload.subjectId !== row.subject_id
    || payload.productId !== row.product_id
    || payload.rail !== row.rail
    || typeof payload.isActive !== 'boolean'
    || payload.isActive !== row.active
    || payload.lastProviderEventId !== (row.provider_event_id ?? undefined)
    || !sameTimestamp(
      optionalTimestamp(payload.lastProviderEventAt, 'purchase lastProviderEventAt'),
      providerEventAt,
    )
    || typeof payload.purchaseDate !== 'string'
    || !PURCHASE_RAILS.has(row.rail as MeerkatPurchaseRail)) {
    throw new Error('PostgreSQL hosted app purchase columns and payload do not match');
  }
  return validatePurchase({
    subjectId: row.subject_id,
    productId: row.product_id,
    rail: row.rail as MeerkatPurchaseRail,
    purchaseDate: payload.purchaseDate,
    isActive: row.active,
    ...(row.provider_event_id ? { lastProviderEventId: row.provider_event_id } : {}),
    ...(providerEventAt ? { lastProviderEventAt: providerEventAt } : {}),
  });
}

function linkHash(code: string): string {
  return createHash('sha256').update(safeText(code, 'app link code'), 'utf8').digest('hex');
}

/** PostgreSQL billing and app-unlock authority for horizontally safe hosted APIs. */
export class PostgresMeerkatBillingStore implements MeerkatHostedBillingStore, MeerkatAppBillingStore {
  private readonly subscriptionProvider: string;

  constructor(
    private readonly context: PostgresStoreContext,
    options: { subscriptionProvider?: string } = {},
  ) {
    this.subscriptionProvider = safeText(
      options.subscriptionProvider ?? 'stripe',
      'subscription provider',
    );
  }

  private async query<Row extends QueryResultRow = QueryResultRow>(
    operation: string,
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.context.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  private async lock<T>(namespace: string, key: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await this.context.withAdvisoryTransactionLock(namespace, key, operation);
    } catch (error) {
      if (error instanceof AppUnlockPersonaInUseError) throw error;
      throw toPostgresStoreUnavailableError(`lock ${namespace}`, error);
    }
  }

  async getSubscription(subjectId: string): Promise<MeerkatHostedSubscription | null> {
    const result = await this.query<SubscriptionRow>(
      'get hosted subscription',
      `SELECT subject_id, provider, provider_event_id, provider_event_at, active, payload
       FROM hosted.subscriptions WHERE subject_id = $1`,
      [safeText(subjectId, 'subscription subject')],
    );
    const row = result.rows[0];
    return row ? decodeSubscription(row, this.subscriptionProvider) : null;
  }

  async upsertSubscription(subscription: MeerkatHostedSubscription): Promise<void> {
    validateSubscription(subscription);
    await this.query(
      'upsert hosted subscription',
      `INSERT INTO hosted.subscriptions (
         subject_id, provider, provider_event_id, provider_event_at,
         active, payload, updated_at
       ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6::jsonb, clock_timestamp())
       ON CONFLICT (subject_id) DO UPDATE SET
         provider = EXCLUDED.provider,
         provider_event_id = EXCLUDED.provider_event_id,
         provider_event_at = EXCLUDED.provider_event_at,
         active = EXCLUDED.active,
         payload = EXCLUDED.payload,
         updated_at = clock_timestamp(),
         lifecycle_version = hosted.subscriptions.lifecycle_version + 1`,
      [
        subscription.subjectId,
        this.subscriptionProvider,
        subscription.lastProviderEventId ?? null,
        subscription.lastProviderEventAt ?? null,
        ['active', 'trialing'].includes(subscription.status),
        JSON.stringify(subscription),
      ],
    );
  }

  async applySubscriptionEvent(
    subscription: MeerkatHostedSubscription,
  ): Promise<ProviderEventApplyResult> {
    validateSubscription(subscription);
    const eventId = safeText(subscription.lastProviderEventId ?? '', 'subscription provider event id');
    const eventAt = isoTimestamp(
      subscription.lastProviderEventAt ?? '',
      'subscription provider event time',
    );
    return this.lock('hosted.subscription.event', `${this.subscriptionProvider}:${eventId}`, () => (
      this.lock('hosted.subscription.subject', subscription.subjectId, async () => {
        const duplicate = await this.query(
          'find hosted subscription event',
          `SELECT 1 FROM hosted.subscriptions
           WHERE provider = $1 AND provider_event_id = $2`,
          [this.subscriptionProvider, eventId],
        );
        if (duplicate.rowCount === 1) return 'duplicate';
        const current = await this.getSubscription(subscription.subjectId);
        const verdict = shouldApplyProviderEvent({
          currentEventId: current?.lastProviderEventId,
          currentEventAt: current?.lastProviderEventAt,
          incomingEventId: eventId,
          incomingEventAt: eventAt,
          incomingMoreRestrictive: !['active', 'trialing'].includes(subscription.status),
          currentMoreRestrictive: current
            ? !['active', 'trialing'].includes(current.status)
            : false,
        });
        if (verdict === 'applied') await this.upsertSubscription(subscription);
        return verdict;
      })
    ));
  }

  async getAppPurchase(subjectId: string): Promise<MeerkatAppPurchase | null> {
    const result = await this.query<PurchaseRow>(
      'get hosted app purchase',
      `SELECT subject_id, product_id, rail, active,
         provider_event_id, provider_event_at, payload
       FROM hosted.app_purchases WHERE subject_id = $1`,
      [safeText(subjectId, 'purchase subject')],
    );
    const row = result.rows[0];
    return row ? decodePurchase(row) : null;
  }

  async upsertAppPurchase(purchase: MeerkatAppPurchase): Promise<void> {
    validatePurchase(purchase);
    await this.query(
      'upsert hosted app purchase',
      `INSERT INTO hosted.app_purchases (
         subject_id, product_id, rail, active,
         provider_event_id, provider_event_at, payload, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb, clock_timestamp())
       ON CONFLICT (subject_id) DO UPDATE SET
         product_id = EXCLUDED.product_id,
         rail = EXCLUDED.rail,
         active = EXCLUDED.active,
         provider_event_id = EXCLUDED.provider_event_id,
         provider_event_at = EXCLUDED.provider_event_at,
         payload = EXCLUDED.payload,
         updated_at = clock_timestamp(),
         lifecycle_version = hosted.app_purchases.lifecycle_version + 1`,
      [
        purchase.subjectId,
        purchase.productId,
        purchase.rail,
        purchase.isActive,
        purchase.lastProviderEventId ?? null,
        purchase.lastProviderEventAt ?? null,
        JSON.stringify(purchase),
      ],
    );
  }

  async applyAppPurchaseEvent(purchase: MeerkatAppPurchase): Promise<ProviderEventApplyResult> {
    validatePurchase(purchase);
    const eventId = safeText(purchase.lastProviderEventId ?? '', 'purchase provider event id');
    const eventAt = isoTimestamp(purchase.lastProviderEventAt ?? '', 'purchase provider event time');
    return this.lock('hosted.purchase.event', `${purchase.rail}:${eventId}`, () => (
      this.lock('hosted.purchase.subject', purchase.subjectId, async () => {
        const duplicate = await this.query(
          'find hosted purchase event',
          `SELECT 1 FROM hosted.app_purchases
           WHERE rail = $1 AND provider_event_id = $2`,
          [purchase.rail, eventId],
        );
        if (duplicate.rowCount === 1) return 'duplicate';
        const current = await this.getAppPurchase(purchase.subjectId);
        const verdict = shouldApplyProviderEvent({
          currentEventId: current?.lastProviderEventId,
          currentEventAt: current?.lastProviderEventAt,
          incomingEventId: eventId,
          incomingEventAt: eventAt,
          incomingMoreRestrictive: !purchase.isActive,
          currentMoreRestrictive: current ? !current.isActive : false,
        });
        if (verdict === 'applied') await this.upsertAppPurchase(purchase);
        return verdict;
      })
    ));
  }

  async createLink(link: MeerkatAppLink): Promise<void> {
    const createdAt = isoTimestamp(link.createdAt, 'app link createdAt');
    const expiresAt = isoTimestamp(link.expiresAt, 'app link expiresAt');
    if (Date.parse(expiresAt) <= Date.parse(createdAt) || link.consumedAt !== null) {
      throw new TypeError('New app link must be unconsumed and expire after creation');
    }
    const result = await this.query(
      'create hosted app link',
      `INSERT INTO hosted.app_links (
         code_hash, subject_id, created_at, expires_at, consumed_at
       ) VALUES ($1, $2, $3::timestamptz, $4::timestamptz, NULL)
       ON CONFLICT (code_hash) DO NOTHING`,
      [linkHash(link.code), safeText(link.subjectId, 'app link subject'), createdAt, expiresAt],
    );
    if (result.rowCount !== 1) throw new Error('App link code collision');
  }

  async redeemLink(code: string, _nowMs: number): Promise<{ subjectId: string } | null> {
    const result = await this.query<{ subject_id: string }>(
      'redeem hosted app link',
      `WITH eligible AS (
         SELECT link.code_hash, link.subject_id
         FROM hosted.app_links AS link
         JOIN hosted.app_purchases AS purchase ON purchase.subject_id = link.subject_id
         WHERE link.code_hash = $1
           AND link.consumed_at IS NULL
           AND link.expires_at > clock_timestamp()
           AND purchase.active
         FOR UPDATE OF link
       )
       UPDATE hosted.app_links AS link
       SET consumed_at = clock_timestamp(),
           lifecycle_version = lifecycle_version + 1
       FROM eligible
       WHERE link.code_hash = eligible.code_hash
       RETURNING eligible.subject_id`,
      [linkHash(code)],
    );
    const row = result.rows[0];
    return row ? { subjectId: row.subject_id } : null;
  }

  async getAppUnlockPersona(subjectId: string): Promise<string | null> {
    const result = await this.query<BindingRow>(
      'get hosted app persona binding',
      'SELECT subject_id, persona_hash FROM hosted.app_persona_bindings WHERE subject_id = $1',
      [safeText(subjectId, 'binding subject')],
    );
    const hash = result.rows[0]?.persona_hash;
    if (hash === undefined) return null;
    if (!PERSONA_HASH.test(hash)) throw new Error('PostgreSQL app persona binding is invalid');
    return hash;
  }

  async bindAppUnlockPersona(subjectId: string, personaHash: string): Promise<string> {
    const subject = safeText(subjectId, 'binding subject');
    const hash = personaHash.toLowerCase();
    if (!PERSONA_HASH.test(hash)) throw new TypeError('Persona binding hash is invalid');
    return this.lock('hosted.binding.persona', hash, () => (
      this.lock('hosted.binding.subject', subject, async () => {
        const existing = await this.getAppUnlockPersona(subject);
        if (existing) return existing;
        const reverse = await this.query<BindingRow>(
          'get reverse hosted app persona binding',
          `SELECT subject_id, persona_hash
           FROM hosted.app_persona_bindings WHERE persona_hash = $1`,
          [hash],
        );
        if (reverse.rows[0] && reverse.rows[0].subject_id !== subject) {
          throw new AppUnlockPersonaInUseError();
        }
        await this.query(
          'bind hosted app persona',
          `INSERT INTO hosted.app_persona_bindings (subject_id, persona_hash)
           VALUES ($1, $2)`,
          [subject, hash],
        );
        return hash;
      })
    ));
  }

  async getSubjectByAppUnlockPersona(personaHash: string): Promise<string | null> {
    const hash = personaHash.toLowerCase();
    if (!PERSONA_HASH.test(hash)) return null;
    const result = await this.query<BindingRow>(
      'reverse hosted app persona binding',
      `SELECT subject_id, persona_hash
       FROM hosted.app_persona_bindings WHERE persona_hash = $1`,
      [hash],
    );
    return result.rows[0]?.subject_id ?? null;
  }

  async releaseAppUnlockPersona(
    subjectId: string,
  ): Promise<{ released: boolean; personaHash: string | null }> {
    const subject = safeText(subjectId, 'binding subject');
    return this.lock('hosted.binding.subject', subject, async () => {
      const result = await this.query<{ persona_hash: string }>(
        'release hosted app persona binding',
        `DELETE FROM hosted.app_persona_bindings
         WHERE subject_id = $1
         RETURNING persona_hash`,
        [subject],
      );
      const hash = result.rows[0]?.persona_hash;
      if (!hash) return { released: false, personaHash: null };
      if (!PERSONA_HASH.test(hash)) throw new Error('PostgreSQL app persona binding is invalid');
      return { released: true, personaHash: hash };
    });
  }
}

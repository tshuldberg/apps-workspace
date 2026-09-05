import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
} from '../../../test/function-quality';
import { AppUnlockPersonaInUseError } from '../../../hosted-api';
import type { PostgresStoreContext } from '../../store-context';
import { PostgresMeerkatBillingStore } from '../hosted-billing-store';

interface ScriptedResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number | null;
}

class BillingDatabase {
  readonly calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  readonly locks: Array<{ namespace: string; key: string }> = [];

  constructor(private readonly results: ScriptedResult[]) {}

  async query(sql: string, values: readonly unknown[] = []): Promise<ScriptedResult> {
    this.calls.push({ sql, values });
    const result = this.results.shift();
    if (!result) throw new Error('Unexpected query');
    return result;
  }

  async withAdvisoryTransactionLock<T>(
    namespace: string,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    this.locks.push({ namespace, key });
    return operation();
  }
}

function store(results: ScriptedResult[]): {
  store: PostgresMeerkatBillingStore;
  database: BillingDatabase;
} {
  const database = new BillingDatabase(results);
  return {
    store: new PostgresMeerkatBillingStore(database as unknown as PostgresStoreContext),
    database,
  };
}

describe('PostgresMeerkatBillingStore function quality gate', () => {
  it('serializes provider event and subject before applying a subscription', async () => {
    const scripted = store([
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 0 },
      { rows: [], rowCount: 1 },
    ]);
    await expect(scripted.store.applySubscriptionEvent({
      subjectId: 'subject-1',
      status: 'active',
      updatedAt: '2026-07-10T12:00:00.000Z',
      lastProviderEventId: 'evt-1',
      lastProviderEventAt: '2026-07-10T12:00:00.000Z',
    })).resolves.toBe('applied');
    expect(scripted.database.locks).toEqual([
      { namespace: 'hosted.subscription.event', key: 'stripe:evt-1' },
      { namespace: 'hosted.subscription.subject', key: 'subject-1' },
    ]);
    expect(scripted.database.calls[2]?.sql).toContain('lifecycle_version');
  });

  it('keeps a newer restrictive purchase when an older grant arrives', async () => {
    const current = {
      subjectId: 'subject-1',
      productId: 'meerkat-app-unlock',
      rail: 'stripe' as const,
      purchaseDate: '2026-07-10T11:00:00.000Z',
      isActive: false,
      lastProviderEventId: 'evt-refund',
      lastProviderEventAt: '2026-07-10T12:00:02.000Z',
    };
    const scripted = store([
      { rows: [], rowCount: 0 },
      {
        rows: [{
          subject_id: current.subjectId,
          product_id: current.productId,
          rail: current.rail,
          active: current.isActive,
          provider_event_id: current.lastProviderEventId,
          provider_event_at: new Date(current.lastProviderEventAt),
          payload: current,
        }],
        rowCount: 1,
      },
    ]);
    await expect(scripted.store.applyAppPurchaseEvent({
      ...current,
      isActive: true,
      lastProviderEventId: 'evt-old',
      lastProviderEventAt: '2026-07-10T12:00:01.000Z',
    })).resolves.toBe('stale');
    expect(scripted.database.calls).toHaveLength(2);
  });

  it('uses database time for link redemption and returns one subject', async () => {
    const scripted = store([{
      rows: [{ subject_id: 'subject-1' }], rowCount: 1,
    }]);
    await expect(scripted.store.redeemLink('one-time-code', 0)).resolves.toEqual({
      subjectId: 'subject-1',
    });
    expect(scripted.database.calls[0]?.sql).toContain('expires_at > clock_timestamp()');
    expect(scripted.database.calls[0]?.sql).toContain('FOR UPDATE OF link');
    expect(scripted.database.calls[0]?.values[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns the existing subject binding and rejects cross-purchase persona reuse', async () => {
    const existing = store([{
      rows: [{ subject_id: 'subject-1', persona_hash: 'ab'.repeat(32) }], rowCount: 1,
    }]);
    await expect(existing.store.bindAppUnlockPersona('subject-1', 'cd'.repeat(32)))
      .resolves.toBe('ab'.repeat(32));

    const conflict = store([
      { rows: [], rowCount: 0 },
      {
        rows: [{ subject_id: 'subject-other', persona_hash: 'cd'.repeat(32) }],
        rowCount: 1,
      },
    ]);
    await expect(conflict.store.bindAppUnlockPersona('subject-1', 'cd'.repeat(32)))
      .rejects.toBeInstanceOf(AppUnlockPersonaInUseError);
  });

  it('stays within constant construction complexity and bounded memory', async () => {
    const setup = () => new BillingDatabase([]);
    await assertComplexitySlope({
      label: 'PostgresMeerkatBillingStore construction',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup,
      run: (database) => new PostgresMeerkatBillingStore(
        database as unknown as PostgresStoreContext,
      ),
    });
    await assertMemoryBudget({
      label: 'PostgresMeerkatBillingStore construction',
      repeats: 500,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup,
      run: (database) => new PostgresMeerkatBillingStore(
        database as unknown as PostgresStoreContext,
      ),
    });
  });
});

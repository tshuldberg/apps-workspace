import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../test/function-quality';
import { PostgresStoreContext, PostgresStoreUnavailableError } from '../../store-context';
import { PostgresDirectoryHostAnnouncementStore } from '../directory-store';

const HMAC_KEY = new Uint8Array(32).fill(0x6a);

function storeWithResult(count: unknown): {
  store: PostgresDirectoryHostAnnouncementStore;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(async () => ({ rows: [{ count }] }));
  const context = new PostgresStoreContext({ query } as unknown as Pool);
  return {
    store: new PostgresDirectoryHostAnnouncementStore(context, {
      announcerHmacKey: HMAC_KEY,
    }),
    query,
  };
}

describe('PostgresDirectoryHostAnnouncementStore.stats function quality gate', () => {
  it('queries the shared authority for distinct, unexpired RIDs', async () => {
    const { store, query } = storeWithResult('4');
    await expect(store.stats()).resolves.toEqual({ liveRids: 4 });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain('count(DISTINCT rid)');
    expect(query.mock.calls[0]?.[0]).toContain('expires_at > clock_timestamp()');
  });

  it('fails closed for an unavailable or malformed authority response', async () => {
    const query = vi.fn(async () => {
      throw new Error('database offline');
    });
    const unavailable = new PostgresDirectoryHostAnnouncementStore(
      new PostgresStoreContext({ query } as unknown as Pool),
      { announcerHmacKey: HMAC_KEY },
    );
    await expect(unavailable.stats()).rejects.toBeInstanceOf(PostgresStoreUnavailableError);
    await expect(storeWithResult('-1').store.stats()).rejects.toMatchObject({
      code: 'postgres_store_unavailable',
      operation: 'count live directory host rids for observability',
    });
  });

  it('passes deterministic count-decoding fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'PostgresDirectoryHostAnnouncementStore.stats fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 200_000),
      assertCase: async (count) => {
        await expect(storeWithResult(String(count)).store.stats())
          .resolves.toEqual({ liveRids: count });
      },
    });
  });

  it('stays within constant adapter complexity and bounded memory', async () => {
    await assertComplexitySlope({
      label: 'PostgresDirectoryHostAnnouncementStore.stats',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup: (size) => storeWithResult(String(size)).store,
      run: (store) => store.stats(),
    });
    await assertMemoryBudget({
      label: 'PostgresDirectoryHostAnnouncementStore.stats',
      repeats: 100,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => storeWithResult('10').store,
      run: (store) => store.stats(),
    });
  });
});

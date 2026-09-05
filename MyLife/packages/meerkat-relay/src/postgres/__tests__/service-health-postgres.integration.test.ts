import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { createHealthEndpoints, postgresReadyProbe } from '../../service-health';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const describePostgres = connectionString ? describe.sequential : describe.skip;

describePostgres('readyz over a live PostgreSQL pool', () => {
  let pool: Pool | undefined;

  afterAll(async () => {
    if (pool && !(pool as unknown as { ended?: boolean }).ended) {
      try {
        await pool.end();
      } catch {
        // already ended by the test
      }
    }
  });

  it('reports ready with a live pool and not-ready after the pool closes', async () => {
    pool = new Pool({ connectionString, max: 2, application_name: 'meerkat-readyz-test' });
    pool.on('error', () => undefined);
    const health = createHealthEndpoints({
      service: 'test',
      checks: [{ name: 'postgres', required: true, probe: postgresReadyProbe(pool) }],
    });

    const live = await health.evaluateReadiness();
    expect(live.ready).toBe(true);
    expect(live.checks).toEqual([{ name: 'postgres', ok: true, detailClass: 'ok' }]);

    // Close the pool: the SELECT 1 probe now rejects, so readiness honestly flips to
    // not-ready with a machine-readable class, never a fabricated healthy answer.
    await pool.end();
    const dead = await health.evaluateReadiness();
    expect(dead.ready).toBe(false);
    expect(dead.checks[0]).toEqual({ name: 'postgres', ok: false, detailClass: 'unavailable' });
  });
});

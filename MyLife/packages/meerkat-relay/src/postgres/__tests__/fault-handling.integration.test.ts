import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMeerkatPostgresPool } from '../pool';
import { runPostgresMigrations } from '../migrate';
import { PostgresStoreContext, PostgresStoreUnavailableError } from '../store-context';
import { PostgresOperationsStore, type JobLease } from '../stores/operations-store';
import { createHealthEndpoints, postgresReadyProbe } from '../../service-health';

/**
 * Fault-handling integration proofs (Plan 44 WP-7C, part 3a/3b).
 *
 * These prove the REPO-OWNED handling contracts the drill runbooks rely on, against
 * the live test PostgreSQL container. No test simulates a provider drill: each proves
 * a handling path that ships in this package.
 *
 *   (a) dependency outage: a pool pointed at a dead port yields the TYPED
 *       PostgresStoreUnavailableError from a store call (not a hang or a raw driver
 *       error) inside its bounded connection timeout, and the readiness probe over
 *       that dead pool evaluates fail-closed (`unavailable`, ready=false). After the
 *       outage, a pool against the LIVE database recovers and serves.
 *   (b) queue lease fencing under a crashed worker: a claimed lease with a SHORT
 *       leaseMs expires without release (the crash), a second worker re-claims it
 *       exactly once with an ADVANCED fencing token, and the expired holder's
 *       renewJobLease + releaseJobLease are both refused.
 *
 * The canary-stop proof (3c) lives in canary-stop.integration.test.ts: it drives the
 * real promotion bin and belongs with the spawnSync CLI idiom, not this pool-level file.
 */

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTests = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructiveTests ? describe.sequential : describe.skip;

// A closed port on loopback: connect() rejects fast (ECONNREFUSED), which is the
// outage we assert typed handling for. connectionTimeoutMillis bounds the wait so a
// silently-black-holed host cannot hang the probe.
const DEAD_PORT_URL = 'postgres://meerkat:meerkat-test-password@127.0.0.1:1/meerkat_test';

describePostgres('fault handling over live PostgreSQL', () => {
  let scratchName: string;
  let adminPool: Pool;
  let livePool: Pool;
  let operations: PostgresOperationsStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Fault-handling integration requires a meerkat_ci or meerkat_test database');
    }
    scratchName = `meerkat_test_fault_${Date.now().toString(36)}`;
    await adminPool.query(`CREATE DATABASE "${scratchName}"`);
    const url = new URL(connectionString!);
    url.pathname = `/${scratchName}`;
    livePool = new Pool({ connectionString: url.toString(), max: 6, statement_timeout: 30_000 });
    livePool.on('error', () => undefined);
    await runPostgresMigrations(livePool);
    operations = new PostgresOperationsStore(new PostgresStoreContext(livePool));
  });

  afterAll(async () => {
    await livePool?.end().catch(() => undefined);
    await adminPool.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`).catch(() => undefined);
    await adminPool.end().catch(() => undefined);
  });

  describe('dependency outage', () => {
    it('yields the typed unavailable error from a store call against a dead port, then recovers on the live db', async () => {
      // A pool built with the real factory + a short connection timeout: the dead port
      // makes every checkout reject, and the store maps it to the typed error.
      const deadPool = createMeerkatPostgresPool({
        connectionString: DEAD_PORT_URL,
        applicationName: 'meerkat-fault-outage-test',
        sslMode: 'disable',
        maxConnections: 2,
        connectionTimeoutMs: 2_000,
      });
      try {
        const deadOps = new PostgresOperationsStore(new PostgresStoreContext(deadPool));
        const started = Date.now();
        // A store read (not a raw pool.query): it must surface the TYPED unavailability,
        // never a hang and never a leaked raw driver error.
        await expect(deadOps.pruneIdempotencyResults()).rejects.toBeInstanceOf(
          PostgresStoreUnavailableError,
        );
        // Bounded: the rejection arrives inside the connection-timeout budget, not after
        // an unbounded wait. Generous ceiling to stay non-flaky under CI load.
        expect(Date.now() - started).toBeLessThan(15_000);

        // The readiness path over the same dead pool is fail-closed: not ready, with the
        // machine-readable `unavailable` class (never a fabricated healthy answer).
        const deadHealth = createHealthEndpoints({
          service: 'fault-test',
          checks: [{ name: 'postgres', required: true, probe: postgresReadyProbe(deadPool) }],
        });
        const deadReport = await deadHealth.evaluateReadiness();
        expect(deadReport.ready).toBe(false);
        expect(deadReport.checks[0]).toEqual({ name: 'postgres', ok: false, detailClass: 'unavailable' });
      } finally {
        await deadPool.end().catch(() => undefined);
      }

      // Recovery: a store call and a readiness probe against the LIVE database both
      // succeed, proving the outage did not poison the process.
      await expect(operations.pruneIdempotencyResults()).resolves.toBeTypeOf('number');
      const liveHealth = createHealthEndpoints({
        service: 'fault-test',
        checks: [{ name: 'postgres', required: true, probe: postgresReadyProbe(livePool) }],
      });
      const liveReport = await liveHealth.evaluateReadiness();
      expect(liveReport.ready).toBe(true);
      expect(liveReport.checks[0]).toEqual({ name: 'postgres', ok: true, detailClass: 'ok' });
    });
  });

  describe('queue lease fencing under a crashed worker', () => {
    it('re-claims an expired lease exactly once and fences the crashed holder', async () => {
      const jobId = `fault-fence-${Date.now().toString(36)}`;
      const queue = 'rehearsal';
      const leaseMs = 250;

      // Worker A claims the lease, then "crashes": it never renews and never releases.
      const leaseA = await operations.claimJobLease({ queue, jobId, owner: 'worker-a', leaseMs });
      expect(leaseA).not.toBeNull();
      const claimedA = leaseA as JobLease;
      expect(claimedA.fencingToken).toBeGreaterThan(0);

      // While A's lease is still live, a second worker cannot steal it: the claim SQL
      // only takes over once `leased_until <= now`, so a mid-flight steal returns null.
      const premature = await operations.claimJobLease({ queue, jobId, owner: 'worker-b', leaseMs });
      expect(premature).toBeNull();

      // Let A's lease expire (the crash window passes).
      await delay(leaseMs + 150);

      // Worker B re-claims exactly once, and the fencing token STRICTLY advances so a
      // fenced write from A can be told apart from B's.
      const leaseB = await operations.claimJobLease({ queue, jobId, owner: 'worker-b', leaseMs: 5_000 });
      expect(leaseB).not.toBeNull();
      const claimedB = leaseB as JobLease;
      expect(claimedB.owner).toBe('worker-b');
      expect(claimedB.fencingToken).toBeGreaterThan(claimedA.fencingToken);

      // The crashed holder A is fenced: its renew and release both refuse, because its
      // (owner, fencing token) no longer matches the live lease. A stale worker waking
      // up cannot extend or clear a lease another worker now owns.
      const renewA = await operations.renewJobLease(claimedA, 5_000);
      expect(renewA).toBeNull();
      const releaseA = await operations.releaseJobLease(claimedA);
      expect(releaseA).toBe(false);

      // B, the true owner, can still renew and then release.
      const renewB = await operations.renewJobLease(claimedB, 5_000);
      expect(renewB).not.toBeNull();
      const releaseB = await operations.releaseJobLease(claimedB);
      expect(releaseB).toBe(true);
    });
  });
});

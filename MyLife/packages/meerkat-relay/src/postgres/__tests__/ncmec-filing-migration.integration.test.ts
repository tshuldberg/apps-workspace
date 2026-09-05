import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runPostgresMigrations } from '../migrate';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

interface FilingRow {
  status: string;
  provider_ref: string | null;
  filed_at: Date | null;
  last_filing_error_code: string | null;
  lifecycle_version: string;
}

describePostgres('NCMEC filing v15 rolling compatibility migration', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_ncmec_migrate_${suffix}`;
  let adminPool: Pool;
  let pool: Pool;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    adminPool.on('error', () => undefined);
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('NCMEC migration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 3 });
    pool.on('error', () => undefined);
    await runPostgresMigrations(pool, { targetVersion: 14 });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('normalizes legacy filed rows and old-writer filed updates without fabricating evidence', async () => {
    const legacyId = `legacy-${randomUUID()}`;
    await pool.query(
      `INSERT INTO moderation.ncmec_reports (report_id, status, payload, detected_at)
       VALUES ($1, 'filed', '{"source":"legacy-export"}'::jsonb, clock_timestamp())`,
      [legacyId],
    );

    await expect(runPostgresMigrations(pool, { targetVersion: 15 })).resolves.toEqual({
      previousVersion: 14,
      currentVersion: 15,
      appliedVersions: [15],
    });

    const legacy = await pool.query<FilingRow>(
      `SELECT status, provider_ref, filed_at, last_filing_error_code, lifecycle_version
       FROM moderation.ncmec_reports WHERE report_id = $1`,
      [legacyId],
    );
    expect(legacy.rows[0]).toEqual({
      status: 'exported',
      provider_ref: null,
      filed_at: null,
      last_filing_error_code: 'legacy_filed_without_provider_evidence',
      lifecycle_version: '2',
    });

    const rollingId = `rolling-${randomUUID()}`;
    await pool.query(
      `INSERT INTO moderation.ncmec_reports (report_id, status, payload, detected_at)
       VALUES ($1, 'queued', '{"source":"rolling-writer"}'::jsonb, clock_timestamp())`,
      [rollingId],
    );
    // This is the pre-v15 write shape: it knows neither provider_ref nor filed_at.
    await expect(pool.query(
      `UPDATE moderation.ncmec_reports
       SET status = 'filed', updated_at = clock_timestamp(), lifecycle_version = lifecycle_version + 1
       WHERE report_id = $1`,
      [rollingId],
    )).resolves.toMatchObject({ rowCount: 1 });

    const normalized = await pool.query<FilingRow>(
      `SELECT status, provider_ref, filed_at, last_filing_error_code, lifecycle_version
       FROM moderation.ncmec_reports WHERE report_id = $1`,
      [rollingId],
    );
    expect(normalized.rows[0]).toMatchObject({
      status: 'exported',
      provider_ref: null,
      filed_at: null,
      last_filing_error_code: 'legacy_filed_without_provider_evidence',
    });

    await pool.query(
      `UPDATE moderation.ncmec_reports
       SET status = 'filed', provider_ref = 'provider-confirmed-1',
           filed_at = clock_timestamp(), last_filing_error_code = NULL
       WHERE report_id = $1`,
      [rollingId],
    );
    const confirmed = await pool.query<FilingRow>(
      `SELECT status, provider_ref, filed_at, last_filing_error_code, lifecycle_version
       FROM moderation.ncmec_reports WHERE report_id = $1`,
      [rollingId],
    );
    expect(confirmed.rows[0]).toMatchObject({
      status: 'filed',
      provider_ref: 'provider-confirmed-1',
      last_filing_error_code: null,
    });
    expect(confirmed.rows[0]?.filed_at).toBeInstanceOf(Date);

    const constraint = await pool.query<{ convalidated: boolean }>(
      `SELECT convalidated FROM pg_constraint
       WHERE conrelid = 'moderation.ncmec_reports'::regclass
         AND conname = 'moderation_ncmec_filed_coherent'`,
    );
    expect(constraint.rows[0]?.convalidated).toBe(true);
  });
});

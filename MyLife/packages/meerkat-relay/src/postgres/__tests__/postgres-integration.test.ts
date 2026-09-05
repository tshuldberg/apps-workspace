import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_MIGRATION_LEDGER_SQL,
  runPostgresMigrations,
  type PostgresMigrationClient,
  type PostgresMigrationPool,
} from '../migrate';
import {
  MEERKAT_POSTGRES_MIGRATIONS,
  MEERKAT_POSTGRES_SCHEMA_VERSION,
  calculateMigrationChecksum,
  type MeerkatPostgresMigration,
} from '../migrations';
import { MEERKAT_POSTGRES_SCHEMAS } from '../store-inventory';
import { MEERKAT_DATABASE_ROLES, renderMeerkatRoleGrants } from '../roles';
import { readPostgresSchemaState } from '../schema-guard';
import { createMeerkatPostgresPool } from '../pool';

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructiveTestEnabled = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString ? describe.sequential : describe.skip;
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const migrateBin = fileURLToPath(new URL('../../../bin/meerkat-postgres-migrate.mjs', import.meta.url));

function wrapClient(client: PoolClient, beforeLock: () => Promise<void>): PostgresMigrationClient {
  return {
    query: async (sql, values = []) => {
      if (sql.includes('pg_advisory')) await beforeLock();
      const result = await client.query(sql, values);
      return { rows: result.rows as Array<Record<string, unknown>>, rowCount: result.rowCount };
    },
    release: () => client.release(),
  };
}

function twoClientBarrierPool(pool: Pool): PostgresMigrationPool {
  let arrivals = 0;
  let releaseBarrier: (() => void) | undefined;
  const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });

  return {
    connect: async () => wrapClient(await pool.connect(), async () => {
      arrivals += 1;
      if (arrivals === 2) releaseBarrier?.();
      await barrier;
    }),
  };
}

function migration(version: number, name: string, sql: string): MeerkatPostgresMigration {
  return { version, name, sql, checksum: calculateMigrationChecksum(version, name, sql) };
}

function onlineIndexMigration(
  version: number,
  name: string,
  indexName: string,
  column: string,
): MeerkatPostgresMigration {
  const sql = `CREATE INDEX CONCURRENTLY ${indexName} ON ops.job_leases (${column});`;
  const recoverySql = `DROP INDEX CONCURRENTLY IF EXISTS ops.${indexName};`;
  const verificationSql = `
    SELECT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'ops'
        AND c.relname = '${indexName}'
        AND t.relname = 'job_leases'
        AND i.indisvalid
        AND i.indisready
        AND pg_get_indexdef(i.indexrelid) LIKE '%USING btree (${column})'
    ) AS applied
  `;
  return {
    version,
    name,
    sql,
    execution: 'online',
    verificationSql,
    recoverySql,
    checksum: calculateMigrationChecksum(
      version,
      name,
      sql,
      'online',
      verificationSql,
      recoverySql,
    ),
  };
}

describePostgres('Plan 44 PostgreSQL 17 migration integration', () => {
  const pool = new Pool({
    connectionString,
    application_name: 'meerkat-migration-integration',
    max: 4,
    statement_timeout: 30_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 15_000,
  });
  pool.on('error', () => undefined);

  beforeAll(async () => {
    const database = await pool.query<{ name: string }>('SELECT current_database() AS name');
    const databaseName = database.rows[0]?.name ?? '';
    if (!destructiveTestEnabled || !/^meerkat_(?:ci|test)(?:_|$)/u.test(databaseName)) {
      throw new Error(
        'Destructive PostgreSQL integration tests require MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS=true and a meerkat_ci or meerkat_test database',
      );
    }
    for (const schema of [...MEERKAT_POSTGRES_SCHEMAS].reverse()) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a pre-existing migration ledger with the wrong shape or constraints', async () => {
    await pool.query('CREATE SCHEMA ops');
    await pool.query('CREATE TABLE ops.schema_migrations (version integer PRIMARY KEY)');
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL.replace(
      'CHECK (version > 0)',
      'CHECK (version >= 0)',
    ));
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL.replace(
      'CREATE TABLE IF NOT EXISTS',
      'CREATE UNLOGGED TABLE IF NOT EXISTS',
    ));
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL);
    await pool.query('GRANT CREATE ON SCHEMA ops TO PUBLIC');
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL);
    await pool.query('GRANT INSERT ON TABLE ops.schema_migrations TO PUBLIC');
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL);
    await pool.query('GRANT UPDATE (checksum) ON TABLE ops.schema_migrations TO PUBLIC');
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }

    await pool.query(BOOTSTRAP_MIGRATION_LEDGER_SQL);
    await pool.query('GRANT MAINTAIN ON TABLE ops.schema_migrations TO PUBLIC');
    try {
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/ledger shape or ownership is invalid/);
    } finally {
      await pool.query('DROP SCHEMA ops CASCADE');
    }
  });

  it('forces two first-run migrators to contend and applies version 1 once', async () => {
    const contendedPool = twoClientBarrierPool(pool);
    const results = await Promise.all([
      runPostgresMigrations(contendedPool, { targetVersion: 1 }),
      runPostgresMigrations(contendedPool, { targetVersion: 1 }),
    ]);
    expect(results.map((result) => result.appliedVersions).sort((a, b) => b.length - a.length)).toEqual([
      [1],
      [],
    ]);
    await pool.query(
      `INSERT INTO ops.idempotency_results (scope, idempotency_key, result)
       VALUES ('compatibility', 'version-1', '{"ok":true}'::jsonb)`,
    );
  });

  it('upgrades the prior version and preserves the old contract', async () => {
    await expect(runPostgresMigrations(pool, { targetVersion: 2 })).resolves.toEqual({
      previousVersion: 1,
      currentVersion: 2,
      appliedVersions: [2],
    });

    const oldContract = await pool.query<{ result: { ok: boolean } }>(
      `SELECT result FROM ops.idempotency_results
       WHERE scope = 'compatibility' AND idempotency_key = 'version-1'`,
    );
    expect(oldContract.rows[0]?.result).toEqual({ ok: true });

    const schemas = await pool.query<{ schema_name: string }>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1::text[])
      ORDER BY schema_name
    `, [[...MEERKAT_POSTGRES_SCHEMAS]]);
    // Frozen version-2-era set: the eight schemas migration 1 creates plus the
    // migrator-owned ops schema. Later migrations add schemas (rooms at 17,
    // account/credential at 18, ...) which must NOT exist yet at version 2;
    // querying the full current inventory asserts their absence too. Do not
    // derive this list from MEERKAT_POSTGRES_SCHEMAS: the inventory grows, the
    // v2 tree does not. The migrate-to-latest test below pins full inventory.
    const V2_SCHEMAS = [
      'archive', 'community', 'directory', 'hosted', 'humanity',
      'moderation', 'ops', 'persona', 'push',
    ];
    expect(schemas.rows.map((row) => row.schema_name)).toEqual([...V2_SCHEMAS].sort());
  });

  it('upgrades a populated version 2 fixture without losing identity or references', async () => {
    const publicationId = `publication-${randomUUID()}`;
    const communityId = `community-${randomUUID()}`;
    const contentId = `content-${randomUUID()}`;
    const archiveJobId = randomUUID();
    const archiveScanId = randomUUID();
    const rids = ['a'.repeat(16), 'b'.repeat(32)];
    const signedRecord = JSON.stringify({
      descriptor: {
        publicationId,
        ownerDeviceId: 'c'.repeat(64),
        communityId,
        contentId,
        kind: 'community',
        category: 'technology',
        revision: 1,
        status: 'active',
        updatedAt: '2026-07-10T12:00:00.000Z',
      },
      signature: 'd'.repeat(128),
    });

    await pool.query(
      `INSERT INTO directory.publications (
         publication_id, signed_record, rids, expires_at
       ) VALUES ($1, $2, $3, clock_timestamp() + interval '1 hour')`,
      [publicationId, signedRecord, rids],
    );
    await pool.query(
      `INSERT INTO archive.jobs (
         job_id, idempotency_key, publication_id, content_id, owner_subject_hash,
         tier, status, rights_json, rights_signature, expected_bytes
       ) VALUES (
         $1, $2, $3, $4, decode(repeat('aa', 16), 'hex'),
         'self_hosted', 'created', '{}', 'legacy-rights-signature', 1
       )`,
      [archiveJobId, randomUUID(), publicationId, contentId],
    );
    await pool.query(
      `INSERT INTO archive.scans (
         scan_id, job_id, engine, engine_version, result, started_at
       ) VALUES ($1, $2, 'fixture', '1', 'clean', clock_timestamp())`,
      [archiveScanId, archiveJobId],
    );
    await pool.query(
      `INSERT INTO ops.job_leases (queue, job_id, owner, attempt, leased_until)
       VALUES ('fixture', 'job', 'worker', 4, clock_timestamp() + interval '1 minute')`,
    );

    await expect(runPostgresMigrations(pool)).resolves.toEqual({
      previousVersion: 2,
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      appliedVersions: MEERKAT_POSTGRES_MIGRATIONS.slice(2).map((entry) => entry.version),
    });

    const latestSchemas = await pool.query<{ schema_name: string }>(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = ANY($1::text[])
      ORDER BY schema_name
    `, [[...MEERKAT_POSTGRES_SCHEMAS]]);
    expect(latestSchemas.rows.map((row) => row.schema_name)).toEqual(
      [...MEERKAT_POSTGRES_SCHEMAS].sort(),
    );

    const idempotency = await pool.query<{
      result: { ok: boolean };
      state: string;
      request_digest: string;
    }>(
      `SELECT result, state, encode(request_digest, 'hex') AS request_digest
       FROM ops.idempotency_results
       WHERE scope = 'compatibility' AND idempotency_key = 'version-1'`,
    );
    expect(idempotency.rows[0]).toEqual({
      result: { ok: true },
      state: 'committed',
      request_digest: '0'.repeat(64),
    });

    const lease = await pool.query<{ attempt: number; fencing_token: string }>(
      `SELECT attempt, fencing_token::text
       FROM ops.job_leases WHERE queue = 'fixture' AND job_id = 'job'`,
    );
    expect(lease.rows[0]).toEqual({ attempt: 4, fencing_token: '4' });

    const publication = await pool.query<{
      community_id: string;
      content_id: string;
      descriptor_status: string;
      descriptor_revision: string;
      rids: string[];
    }>(
      `SELECT
         p.community_id,
         p.content_id,
         p.descriptor_status,
         p.descriptor_revision::text,
         array_agg(r.rid ORDER BY r.rid) AS rids
       FROM directory.publications p
       JOIN directory.publication_rids r ON r.publication_id = p.publication_id
       WHERE p.publication_id = $1
       GROUP BY p.publication_id`,
      [publicationId],
    );
    expect(publication.rows[0]).toEqual({
      community_id: communityId,
      content_id: contentId,
      descriptor_status: 'active',
      descriptor_revision: '1',
      rids,
    });

    const archive = await pool.query<{
      job_id: string;
      tier: string;
      scan_job_id: string;
      signed_job: unknown;
    }>(
      `SELECT j.job_id, j.tier, s.job_id AS scan_job_id, j.signed_job
       FROM archive.jobs j
       JOIN archive.scans s ON s.job_id = j.job_id
       WHERE j.job_id = $1`,
      [archiveJobId],
    );
    expect(archive.rows[0]).toEqual({
      job_id: archiveJobId,
      tier: 'self_host',
      scan_job_id: archiveJobId,
      signed_job: null,
    });

    const expanded = await pool.query<{ reservations: string; policies: string }>(
      `SELECT
         to_regclass('hosted.storage_reservations')::text AS reservations,
         to_regclass('hosted.storage_tenant_policies')::text AS policies`,
    );
    expect(expanded.rows[0]).toEqual({
      reservations: 'hosted.storage_reservations',
      policies: 'hosted.storage_tenant_policies',
    });

    const rollingPublicationId = `rolling-${randomUUID()}`;
    const rollingRid = 'e'.repeat(16);
    const rollingRecord = JSON.stringify({
      descriptor: {
        publicationId: rollingPublicationId,
        ownerDeviceId: 'f'.repeat(64),
        communityId,
        contentId: `rolling-${contentId}`,
        kind: 'post',
        category: 'discussion',
        revision: 2,
        status: 'active',
        updatedAt: '2026-07-10T13:00:00.000Z',
      },
      signature: '1'.repeat(128),
    });
    await pool.query(
      `INSERT INTO directory.publications (
         publication_id, signed_record, rids, expires_at
       ) VALUES ($1, $2, ARRAY[$3], clock_timestamp() + interval '1 hour')`,
      [rollingPublicationId, rollingRecord, rollingRid],
    );
    const rollingPublication = await pool.query<{
      publication_kind: string;
      category: string;
      rid: string;
    }>(
      `SELECT p.publication_kind, p.category, r.rid
       FROM directory.publications p
       JOIN directory.publication_rids r ON r.publication_id = p.publication_id
       WHERE p.publication_id = $1`,
      [rollingPublicationId],
    );
    expect(rollingPublication.rows[0]).toEqual({
      publication_kind: 'post',
      category: 'discussion',
      rid: rollingRid,
    });

    const rollingArchiveJobId = randomUUID();
    await pool.query(
      `INSERT INTO archive.jobs (
         job_id, idempotency_key, publication_id, content_id, owner_subject_hash,
         tier, status, rights_json, rights_signature, expected_bytes
       ) VALUES (
         $1, $2, $3, $4, decode(repeat('bb', 16), 'hex'),
         'self_hosted', 'created', '{}', 'legacy-rights-signature', 1
       )`,
      [rollingArchiveJobId, randomUUID(), rollingPublicationId, `rolling-${contentId}`],
    );
    const rollingArchive = await pool.query<{ tier: string }>(
      'SELECT tier FROM archive.jobs WHERE job_id = $1',
      [rollingArchiveJobId],
    );
    expect(rollingArchive.rows[0]?.tier).toBe('self_host');
  });

  it('is idempotent and records exact checked-in checksums', async () => {
    await expect(runPostgresMigrations(pool)).resolves.toEqual({
      previousVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      appliedVersions: [],
    });
    const ledger = await pool.query<{ version: number; name: string; checksum: string }>(
      'SELECT version, name, checksum FROM ops.schema_migrations ORDER BY version',
    );
    expect(ledger.rows).toEqual(MEERKAT_POSTGRES_MIGRATIONS.map((entry) => ({
      version: entry.version,
      name: entry.name,
      checksum: entry.checksum,
    })));
    await expect(readPostgresSchemaState(pool)).resolves.toEqual({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      appliedCount: MEERKAT_POSTGRES_MIGRATIONS.length,
    });
  });

  it('keeps content-global archive objects when one of two referencing jobs is removed', async () => {
    const firstJob = randomUUID();
    const secondJob = randomUUID();
    const contentId = `shared-${randomUUID()}`;
    const publicationA = `publication-${randomUUID()}`;
    const publicationB = `publication-${randomUUID()}`;
    await pool.query(
      `INSERT INTO archive.jobs (
         job_id, idempotency_key, publication_id, content_id, owner_subject_hash,
         tier, status, rights_json, rights_signature, expected_bytes
       ) VALUES
         ($1, $2, $3, $4, decode(repeat('aa', 16), 'hex'), 'managed', 'created', '{}', 'sig', 1),
         ($5, $6, $7, $4, decode(repeat('bb', 16), 'hex'), 'managed', 'created', '{}', 'sig', 1)`,
      [firstJob, randomUUID(), publicationA, contentId, secondJob, randomUUID(), publicationB],
    );
    await pool.query(
      `INSERT INTO archive.objects (
         content_id, object_index, object_hash, object_bytes, quarantine_key, status
       ) VALUES ($1, 0, 'hash', 1, 'quarantine-key', 'quarantined')`,
      [contentId],
    );
    await pool.query(
      `INSERT INTO archive.pins (publication_id, content_id, host_id, state)
       VALUES ($1, $3, 'host-a', 'active'), ($2, $3, 'host-b', 'active')`,
      [publicationA, publicationB, contentId],
    );

    await pool.query('DELETE FROM archive.jobs WHERE job_id = $1', [firstJob]);
    const state = await pool.query<{ objects: number; jobs: number; pins: number }>(
      `SELECT
         (SELECT count(*)::integer FROM archive.objects WHERE content_id = $1) AS objects,
         (SELECT count(*)::integer FROM archive.jobs WHERE job_id = $2) AS jobs,
         (SELECT count(*)::integer FROM archive.pins WHERE publication_id = $3) AS pins`,
      [contentId, secondJob, publicationB],
    );
    expect(state.rows[0]).toEqual({ objects: 1, jobs: 1, pins: 1 });

    await pool.query('DELETE FROM archive.pins WHERE content_id = $1', [contentId]);
    await pool.query('DELETE FROM archive.objects WHERE content_id = $1', [contentId]);
    await pool.query('DELETE FROM archive.jobs WHERE job_id = $1', [secondJob]);
  });

  it('applies managed statement, lock, idle, and total transaction timeouts', async () => {
    const managed = createMeerkatPostgresPool({
      connectionString: connectionString!,
      applicationName: 'meerkat-timeout-test',
      sslMode: 'disable',
      maxConnections: 1,
      statementTimeoutMs: 2_500,
      lockTimeoutMs: 2_000,
      idleInTransactionTimeoutMs: 3_000,
      transactionTimeoutMs: 5_000,
      queryTimeoutMs: 3_500,
    });
    try {
      const settings = await managed.query<{
        statement_timeout: string;
        lock_timeout: string;
        idle_in_transaction_session_timeout: string;
        transaction_timeout: string;
      }>(`
        SELECT
          current_setting('statement_timeout') AS statement_timeout,
          current_setting('lock_timeout') AS lock_timeout,
          current_setting('idle_in_transaction_session_timeout') AS idle_in_transaction_session_timeout,
          current_setting('transaction_timeout') AS transaction_timeout
      `);
      expect(settings.rows[0]).toEqual({
        statement_timeout: '2500ms',
        lock_timeout: '2s',
        idle_in_transaction_session_timeout: '3s',
        transaction_timeout: '5s',
      });
    } finally {
      await managed.end();
    }
  });

  it('applies the exact service-role table privileges and removes stale grants', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const schemaOwner = `meerkat_schema_owner_${suffix}`;
    const roleDatabase = `meerkat_roles_${suffix}`;
    const roles = MEERKAT_DATABASE_ROLES.map((role) => ({
      ...role,
      name: `${role.name}_${suffix}`,
    }));
    const createdRoles: string[] = [];
    const parentRole = `meerkat_parent_${suffix}`;
    let parentCreated = false;
    let schemaOwnerCreated = false;
    let rolePool: Pool | undefined;
    try {
      await pool.query(
        `CREATE ROLE "${schemaOwner}" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
      );
      schemaOwnerCreated = true;
      for (const role of roles) {
        await pool.query(
          `CREATE ROLE "${role.name}" NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
        );
        createdRoles.push(role.name);
      }
      await pool.query(`CREATE ROLE "${parentRole}" NOLOGIN`);
      parentCreated = true;
      await pool.query(`CREATE DATABASE "${roleDatabase}" OWNER "${schemaOwner}"`);
      const databaseUrl = new URL(connectionString!);
      databaseUrl.pathname = `/${roleDatabase}`;
      rolePool = new Pool({
        connectionString: databaseUrl.toString(),
        options: `-c role=${schemaOwner}`,
      });
      rolePool.on('error', () => undefined);
      await runPostgresMigrations(rolePool);
      await pool.query(`GRANT "${parentRole}" TO "${roles[0]!.name}"`);
      const client = await rolePool.connect();
      try {
        await expect(client.query(renderMeerkatRoleGrants('wrong_owner', roles)))
          .rejects.toThrow(/must run as schema owner/);
        await client.query('ROLLBACK');
        await expect(client.query(renderMeerkatRoleGrants(schemaOwner, roles)))
          .rejects.toThrow(/must not be a member/);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      await pool.query(`REVOKE "${parentRole}" FROM "${roles[0]!.name}"`);
      await pool.query(`DROP ROLE "${parentRole}"`);
      parentCreated = false;
      await rolePool.query(`GRANT DELETE ON TABLE community.kills TO "${roles[0]!.name}"`);
      await rolePool.query(`GRANT SELECT ON TABLE archive.jobs TO "${roles[0]!.name}"`);
      await rolePool.query('GRANT DELETE ON TABLE community.kills TO PUBLIC');
      await rolePool.query(renderMeerkatRoleGrants(schemaOwner, roles));

      const actual = await rolePool.query<{
        grantee: string;
        table_schema: string;
        table_name: string;
        privilege_type: string;
      }>(`
        SELECT grantee, table_schema, table_name, privilege_type
        FROM information_schema.role_table_grants
        WHERE grantee = ANY($1::text[])
        ORDER BY grantee, table_schema, table_name, privilege_type
      `, [roles.map((role) => role.name)]);
      const expected = roles.flatMap((role) => role.access.flatMap((access) =>
        access.tables.flatMap((table) => access.privileges.map((privilege) => ({
          grantee: role.name,
          table_schema: access.schema,
          table_name: table,
          privilege_type: privilege,
        }))),
      )).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      expect(actual.rows).toEqual(expected);

      const immutable = await rolePool.query<{
        kills_table_update: boolean;
        public_delete_inherited: boolean;
        hosted_tenant_delete: boolean;
        hosted_object_delete: boolean;
        hosted_storage_delete_function: boolean;
        hosted_binding_delete: boolean;
        hosted_manifest_delete: boolean;
        ncmec_table_update: boolean;
        ncmec_status_update: boolean;
        ncmec_payload_update: boolean;
        release_manifest_update: boolean;
        release_approval_update: boolean;
        archive_ncmec_insert: boolean;
        archive_ncmec_update: boolean;
        archive_dmca_insert: boolean;
        room_token_select: boolean;
        room_token_insert: boolean;
        room_token_update: boolean;
        room_token_delete: boolean;
      }>(`
        SELECT
          has_table_privilege($1, 'directory.kills', 'UPDATE') AS kills_table_update,
          has_table_privilege($1, 'community.kills', 'DELETE') AS public_delete_inherited,
          has_table_privilege($4, 'hosted.storage_tenants', 'DELETE') AS hosted_tenant_delete,
          has_table_privilege($4, 'hosted.storage_objects', 'DELETE') AS hosted_object_delete,
          has_function_privilege(
            $4, 'hosted.delete_storage_api_tenant(text)', 'EXECUTE'
          ) AS hosted_storage_delete_function,
          has_table_privilege($4, 'hosted.app_persona_bindings', 'DELETE') AS hosted_binding_delete,
          has_table_privilege($4, 'hosted.seeder_manifests', 'DELETE') AS hosted_manifest_delete,
          has_table_privilege($2, 'moderation.ncmec_reports', 'UPDATE') AS ncmec_table_update,
          has_column_privilege($2, 'moderation.ncmec_reports', 'status', 'UPDATE') AS ncmec_status_update,
          has_column_privilege($2, 'moderation.ncmec_reports', 'payload', 'UPDATE') AS ncmec_payload_update,
          has_table_privilege($3, 'ops.release_manifests', 'UPDATE') AS release_manifest_update,
          has_column_privilege($3, 'ops.release_manifests', 'approved_at', 'UPDATE') AS release_approval_update,
          has_table_privilege($5, 'moderation.ncmec_reports', 'INSERT') AS archive_ncmec_insert,
          has_table_privilege($5, 'moderation.ncmec_reports', 'UPDATE') AS archive_ncmec_update,
          has_table_privilege($5, 'moderation.dmca_claims', 'INSERT') AS archive_dmca_insert,
          has_table_privilege($6, 'rooms.admission_state', 'SELECT') AS room_token_select,
          has_table_privilege($6, 'rooms.admission_state', 'INSERT') AS room_token_insert,
          has_table_privilege($6, 'rooms.admission_state', 'UPDATE') AS room_token_update,
          has_table_privilege($6, 'rooms.admission_state', 'DELETE') AS room_token_delete
      `, [
        roles[1]!.name,
        roles[5]!.name,
        roles[8]!.name,
        roles[4]!.name,
        roles[7]!.name,
        roles[12]!.name,
      ]);
      expect(immutable.rows[0]).toEqual({
        kills_table_update: false,
        public_delete_inherited: false,
        hosted_tenant_delete: false,
        hosted_object_delete: false,
        hosted_storage_delete_function: true,
        hosted_binding_delete: true,
        hosted_manifest_delete: true,
        ncmec_table_update: false,
        ncmec_status_update: true,
        ncmec_payload_update: false,
        release_manifest_update: false,
        release_approval_update: true,
        // The archive scanner enqueues CSAM evidence (INSERT) but never files/exports (no UPDATE)
        // and never writes DMCA claims (SELECT-only there).
        archive_ncmec_insert: true,
        archive_ncmec_update: false,
        archive_dmca_insert: false,
        room_token_select: true,
        room_token_insert: true,
        room_token_update: true,
        room_token_delete: false,
      });
      const sequencePrivilege = await rolePool.query<{ allowed: boolean }>(
        `SELECT has_sequence_privilege($1, 'moderation.operator_audit_seq_seq', 'USAGE') AS allowed`,
        [roles[5]!.name],
      );
      expect(sequencePrivilege.rows[0]?.allowed).toBe(true);
    } finally {
      if (parentCreated) {
        for (const role of createdRoles) {
          await pool.query(`REVOKE "${parentRole}" FROM "${role}"`).catch(() => undefined);
        }
        await pool.query(`DROP ROLE IF EXISTS "${parentRole}"`).catch(() => undefined);
      }
      await rolePool?.end().catch(() => undefined);
      await pool.query(`DROP DATABASE IF EXISTS "${roleDatabase}" WITH (FORCE)`).catch(() => undefined);
      for (const role of [...createdRoles].reverse()) {
        await pool.query(`DROP OWNED BY "${role}"`);
        await pool.query(`DROP ROLE "${role}"`);
      }
      if (schemaOwnerCreated) {
        await pool.query(`DROP OWNED BY "${schemaOwner}"`).catch(() => undefined);
        await pool.query(`DROP ROLE "${schemaOwner}"`).catch(() => undefined);
      }
    }
  });

  it('rejects a changed applied migration without mutating the schema', async () => {
    const original = MEERKAT_POSTGRES_MIGRATIONS[0]!;
    await pool.query(
      'UPDATE ops.schema_migrations SET checksum = $1 WHERE version = $2',
      ['0'.repeat(64), original.version],
    );
    try {
      const cli = spawnSync(migrateBin, [], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: connectionString,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
        },
      });
      expect(cli.status).toBe(1);
      expect(JSON.parse(cli.stdout)).toMatchObject({ event: 'fatal', reason: 'migration_failed' });
      await expect(runPostgresMigrations(pool)).rejects.toThrow(/does not match/);
      await expect(readPostgresSchemaState(pool)).rejects.toThrow(/does not match/);
    } finally {
      await pool.query(
        'UPDATE ops.schema_migrations SET checksum = $1 WHERE version = $2',
        [original.checksum, original.version],
      );
    }
  });

  it('rolls back DDL and ledger writes when a later migration fails, then retries cleanly', async () => {
    const probeVersion = MEERKAT_POSTGRES_SCHEMA_VERSION + 1;
    const failureVersion = probeVersion + 1;
    const probe = migration(probeVersion, 'rollback_probe', 'CREATE TABLE ops.rollback_probe (id integer PRIMARY KEY);');
    const broken = migration(failureVersion, 'rollback_failure', 'SELECT * FROM ops.table_that_does_not_exist;');

    await expect(runPostgresMigrations(pool, {
      migrations: [...MEERKAT_POSTGRES_MIGRATIONS, probe, broken],
    })).rejects.toThrow();
    const rolledBack = await pool.query<{ probe: string | null }>(
      `SELECT to_regclass('ops.rollback_probe')::text AS probe`,
    );
    expect(rolledBack.rows[0]?.probe).toBeNull();
    const ledgerAfterFailure = await pool.query<{ version: number }>(
      'SELECT version FROM ops.schema_migrations ORDER BY version',
    );
    expect(ledgerAfterFailure.rows.map((row) => row.version)).toEqual(
      MEERKAT_POSTGRES_MIGRATIONS.map((migrationEntry) => migrationEntry.version),
    );

    const fixed = migration(failureVersion, 'rollback_failure', 'CREATE TABLE ops.rollback_retry (id integer PRIMARY KEY);');
    await expect(runPostgresMigrations(pool, {
      migrations: [...MEERKAT_POSTGRES_MIGRATIONS, probe, fixed],
    })).resolves.toMatchObject({ appliedVersions: [probeVersion, failureVersion] });
  });

  it('runs online DDL outside a transaction, verifies it, and resumes without replaying it', async () => {
    const probeVersion = MEERKAT_POSTGRES_SCHEMA_VERSION + 1;
    const retryVersion = probeVersion + 1;
    const firstOnlineVersion = retryVersion + 1;
    const secondOnlineVersion = firstOnlineVersion + 1;
    const probe = migration(probeVersion, 'rollback_probe', 'CREATE TABLE ops.rollback_probe (id integer PRIMARY KEY);');
    const retry = migration(retryVersion, 'rollback_failure', 'CREATE TABLE ops.rollback_retry (id integer PRIMARY KEY);');
    const firstOnline = onlineIndexMigration(
      firstOnlineVersion,
      'online_job_lease_updated_index',
      'ops_job_leases_updated_at_online_idx',
      'updated_at',
    );
    const secondOnline = onlineIndexMigration(
      secondOnlineVersion,
      'online_job_lease_owner_index',
      'ops_job_leases_owner_online_idx',
      'owner',
    );

    await pool.query(firstOnline.sql);
    await expect(runPostgresMigrations(pool, {
      migrations: [...MEERKAT_POSTGRES_MIGRATIONS, probe, retry, firstOnline],
    })).resolves.toMatchObject({
      previousVersion: retryVersion,
      appliedVersions: [firstOnlineVersion],
    });
    await pool.query('CREATE INDEX CONCURRENTLY ops_job_leases_owner_online_idx ON ops.job_leases (queue)');
    const migrations = [
      ...MEERKAT_POSTGRES_MIGRATIONS,
      probe,
      retry,
      firstOnline,
      secondOnline,
    ];
    await expect(runPostgresMigrations(pool, { migrations })).resolves.toMatchObject({
      previousVersion: firstOnlineVersion,
      appliedVersions: [secondOnlineVersion],
    });
    await expect(runPostgresMigrations(pool, { migrations })).resolves.toMatchObject({
      previousVersion: secondOnlineVersion,
      appliedVersions: [],
    });
  });
});

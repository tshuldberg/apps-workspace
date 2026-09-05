import { describe, expect, it } from 'vitest';
import {
  MEERKAT_POSTGRES_MIGRATIONS,
  MEERKAT_POSTGRES_SCHEMA_VERSION,
  calculateMigrationChecksum,
  validateMigrationSet,
  type MeerkatPostgresMigration,
} from '../migrations';
import {
  BOOTSTRAP_MIGRATION_LEDGER_SQL,
  runPostgresMigrations,
  type PostgresMigrationClient,
  type PostgresMigrationPool,
} from '../migrate';
import {
  assertPostgresSchemaCompatibility,
  readPostgresSchemaState,
} from '../schema-guard';
import {
  MUTABLE_STORE_INVENTORY,
  validateMutableStoreInventory,
} from '../store-inventory';
import { createMeerkatPostgresPoolConfig } from '../pool';
import { renderMeerkatRoleGrants } from '../roles';
import { runStoreConformanceSuite } from '../conformance/store-conformance';

interface LedgerRow extends Record<string, unknown> {
  version: number;
  name: string;
  checksum: string;
}

class FakeMigrationClient implements PostgresMigrationClient {
  readonly queries: Array<{ sql: string; values: unknown[] }> = [];
  readonly ledger: LedgerRow[];
  released = false;
  failOnSql = '';
  onlineVerificationSql = '';
  onlineRecoverySql = '';
  onlineSql = '';
  onlineApplied = false;

  constructor(ledger: LedgerRow[] = []) {
    this.ledger = ledger;
  }

  async query(
    sql: string,
    values: unknown[] = [],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }> {
    this.queries.push({ sql, values });
    if (this.failOnSql && sql.includes(this.failOnSql)) {
      throw new Error('injected migration failure');
    }
    if (this.onlineVerificationSql && sql === this.onlineVerificationSql) {
      return { rows: [{ applied: this.onlineApplied }], rowCount: 1 };
    }
    if (this.onlineRecoverySql && sql === this.onlineRecoverySql) {
      this.onlineApplied = false;
      return { rows: [], rowCount: 0 };
    }
    if (this.onlineSql && sql === this.onlineSql) {
      this.onlineApplied = true;
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('AS valid') && sql.includes('schema_migrations')) {
      return { rows: [{ valid: true }], rowCount: 1 };
    }
    if (sql.includes('pg_advisory_unlock')) {
      return { rows: [{ unlocked: true }], rowCount: 1 };
    }
    if (sql.includes('SELECT version, name, checksum')) {
      return { rows: [...this.ledger], rowCount: this.ledger.length };
    }
    if (sql.includes('INSERT INTO ops.schema_migrations')) {
      this.ledger.push({
        version: Number(values[0]),
        name: String(values[1]),
        checksum: String(values[2]),
      });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  release(): void {
    this.released = true;
  }
}

function fakePool(client: FakeMigrationClient): PostgresMigrationPool {
  return { connect: async () => client };
}

describe('Plan 44 PostgreSQL foundation', () => {
  it('keeps a complete, unique mutable-store inventory', () => {
    expect(() => validateMutableStoreInventory()).not.toThrow();
    expect(MUTABLE_STORE_INVENTORY.map((entry) => entry.id)).toEqual([
      'community.descriptor-revisions',
      'community.publications',
      'community.kills',
      'community.reports',
      'community.public-posts',
      'community.private-state',
      'directory.publications',
      'directory.kills',
      'directory.host-freshness',
      'humanity.verification',
      'persona.registry',
      'hosted.billing',
      'hosted.storage-metadata',
      'hosted.oauth-broker',
      'moderation.console',
      'moderation.ncmec',
      'moderation.dmca',
      'hosted.seeder-pieces',
      'hosted.seeder-manifests',
      'push.delivery',
      'archive.lifecycle',
      'ops.release-recovery',
      'ops.object-accounting',
      'account.verification-accounts',
      'credential.anonymous-bridge',
    ]);
    expect(() => validateMutableStoreInventory([
      MUTABLE_STORE_INVENTORY[0]!,
      MUTABLE_STORE_INVENTORY[0]!,
    ])).toThrow(/duplicate id/);
  });

  it('locks migration order, checksums, and required production schemas', () => {
    expect(() => validateMigrationSet()).not.toThrow();
    expect(MEERKAT_POSTGRES_SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    const sql = [
      BOOTSTRAP_MIGRATION_LEDGER_SQL,
      ...MEERKAT_POSTGRES_MIGRATIONS.map((migration) => migration.sql),
    ].join('\n');
    for (const schema of [
      'community', 'directory', 'humanity', 'persona', 'hosted',
      'moderation', 'push', 'archive',
    ]) {
      expect(sql).toContain(`CREATE SCHEMA ${schema}`);
      expect(sql).not.toContain(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    }
    expect(BOOTSTRAP_MIGRATION_LEDGER_SQL).toContain('CREATE SCHEMA IF NOT EXISTS ops');
    expect(sql).toContain('PRIMARY KEY (scope, idempotency_key)');
    expect(sql).toContain('token_hash text PRIMARY KEY');
    expect(sql).toContain('persona_pubkey text NOT NULL UNIQUE');
    expect(sql).toContain('code_hash text PRIMARY KEY');
    expect(sql).toContain('idempotency_key text NOT NULL UNIQUE');
    expect(sql).toContain('hosted_app_purchase_provider_event_idx');
    expect(sql).toContain('CREATE TABLE push.capabilities');
    expect(sql).toContain('registration_secret_hash bytea NOT NULL UNIQUE');
    expect(sql).toContain('CREATE TABLE archive.objects');
    expect(sql).toContain('rights_signature text NOT NULL');
    expect(sql).toContain("CHECK (tier IN ('self_host', 'managed'))");
    expect(sql).toContain('CREATE TABLE directory.publication_rids');
    expect(sql).toContain('CREATE TABLE hosted.storage_reservations');
    expect(sql).toContain('ADD COLUMN request_digest bytea NOT NULL');
    expect(sql).toContain('ADD COLUMN fencing_token bigint');
    expect(sql).toContain('CREATE TABLE humanity.registration_redemptions');
    expect(sql).toContain('CREATE TABLE persona.registration_attempts');
    expect(sql).toContain('persona_registration_attempts_pending_alias_uidx');

    const first = MEERKAT_POSTGRES_MIGRATIONS[0]!;
    const tampered: MeerkatPostgresMigration = { ...first, sql: `${first.sql}\nSELECT 1;` };
    expect(() => validateMigrationSet([tampered])).toThrow(/checksum/);
  });

  it('applies migrations once under a session advisory lock', async () => {
    const client = new FakeMigrationClient();
    const result = await runPostgresMigrations(fakePool(client));

    expect(result).toEqual({
      previousVersion: 0,
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      appliedVersions: MEERKAT_POSTGRES_MIGRATIONS.map((migration) => migration.version),
    });
    expect(client.ledger).toHaveLength(MEERKAT_POSTGRES_MIGRATIONS.length);
    expect(client.queries.map((query) => query.sql)).toContain('BEGIN');
    const lockIndex = client.queries.findIndex((query) => query.sql.includes('pg_advisory_lock'));
    const bootstrapIndex = client.queries.findIndex((query) => query.sql.includes('CREATE TABLE IF NOT EXISTS ops.schema_migrations'));
    expect(lockIndex).toBe(0);
    expect(lockIndex).toBeLessThan(bootstrapIndex);
    expect(client.queries.at(-1)?.sql).toContain('pg_advisory_unlock');
    expect(client.released).toBe(true);
  });

  it('refuses checksum drift and rolls back without applying new SQL', async () => {
    const client = new FakeMigrationClient([{
      version: 1,
      name: MEERKAT_POSTGRES_MIGRATIONS[0]!.name,
      checksum: calculateMigrationChecksum(1, 'wrong', 'wrong'),
    }]);

    await expect(runPostgresMigrations(fakePool(client))).rejects.toThrow(/does not match/);
    expect(client.queries.some((query) => query.sql.includes('CREATE TABLE community.'))).toBe(false);
    expect(client.released).toBe(true);
  });

  it('rolls back the whole migration set when SQL fails', async () => {
    const client = new FakeMigrationClient();
    client.failOnSql = 'CREATE TABLE community.descriptor_revisions';

    await expect(runPostgresMigrations(fakePool(client))).rejects.toThrow(/injected/);
    expect(client.queries.some((query) => query.sql === 'ROLLBACK')).toBe(true);
    expect(client.released).toBe(true);
  });

  it('runs verified online migrations outside a transaction and checkpoints them', async () => {
    const client = new FakeMigrationClient();
    client.onlineSql = 'CREATE INDEX CONCURRENTLY online_probe ON ops.job_leases (updated_at);';
    client.onlineRecoverySql = 'DROP INDEX CONCURRENTLY IF EXISTS ops.online_probe;';
    client.onlineVerificationSql = 'SELECT false AS applied';
    const online: MeerkatPostgresMigration = {
      version: 1,
      name: 'online_probe',
      sql: client.onlineSql,
      execution: 'online',
      verificationSql: client.onlineVerificationSql,
      recoverySql: client.onlineRecoverySql,
      checksum: calculateMigrationChecksum(
        1,
        'online_probe',
        client.onlineSql,
        'online',
        client.onlineVerificationSql,
        client.onlineRecoverySql,
      ),
    };

    await expect(runPostgresMigrations(fakePool(client), { migrations: [online] })).resolves.toMatchObject({
      appliedVersions: [1],
    });
    const onlineIndex = client.queries.findIndex((query) => query.sql === client.onlineSql);
    expect(client.queries[onlineIndex - 2]?.sql).toBe(client.onlineVerificationSql);
    expect(client.queries[onlineIndex - 1]?.sql).toBe(client.onlineRecoverySql);
    expect(client.queries[onlineIndex + 1]?.sql).toBe(client.onlineVerificationSql);
    expect(() => validateMigrationSet([{ ...online, verificationSql: undefined }])).toThrow(/requires verification SQL/);
    expect(() => validateMigrationSet([{ ...online, recoverySql: undefined }])).toThrow(/requires recovery SQL/);
  });

  it('enforces bounded pool configuration and production TLS', () => {
    expect(() => createMeerkatPostgresPoolConfig({
      connectionString: 'postgres://localhost/meerkat',
      applicationName: 'meerkat-community',
      productionMode: true,
      sslMode: 'disable',
    })).toThrow(/require verify-full TLS/);

    const config = createMeerkatPostgresPoolConfig({
      connectionString: 'postgres://db.example/meerkat',
      applicationName: 'meerkat-community',
      productionMode: true,
      sslMode: 'verify-full',
      sslCa: 'test-ca',
      maxConnections: 12,
    });
    expect(config.max).toBe(12);
    expect(config.statement_timeout).toBe(10_000);
    expect(config.lock_timeout).toBe(5_000);
    expect(config.idle_in_transaction_session_timeout).toBe(15_000);
    expect(config.options).toBe('-c transaction_timeout=60000');
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: 'test-ca' });
  });

  it('guards schema compatibility and reads numeric ledger values safely', async () => {
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
    })).not.toThrow();
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION - 1,
    })).toThrow(/too old/);
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION - 1,
      minimumVersion: MEERKAT_POSTGRES_SCHEMA_VERSION - 1,
      maximumVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
    })).not.toThrow();
    expect(() => assertPostgresSchemaCompatibility({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      minimumVersion: 1,
      maximumVersion: MEERKAT_POSTGRES_SCHEMA_VERSION - 1,
    })).toThrow(/too new/);

    const state = await readPostgresSchemaState({
      query: async () => ({
        rows: MEERKAT_POSTGRES_MIGRATIONS.map(({ version, name, checksum }) => ({
          version: String(version), name, checksum,
        })),
      }),
    });
    expect(state).toEqual({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION,
      appliedCount: MEERKAT_POSTGRES_MIGRATIONS.length,
    });
    await expect(readPostgresSchemaState({
      query: async () => ({
        rows: [{
          version: '2',
          name: MEERKAT_POSTGRES_MIGRATIONS[1]!.name,
          checksum: MEERKAT_POSTGRES_MIGRATIONS[1]!.checksum,
        }],
      }),
    })).rejects.toThrow(/not contiguous/);
    await expect(readPostgresSchemaState({
      query: async () => ({
        rows: [{
          version: '1',
          name: MEERKAT_POSTGRES_MIGRATIONS[0]!.name,
          checksum: '0'.repeat(64),
        }],
      }),
    })).rejects.toThrow(/does not match/);
    await expect(readPostgresSchemaState({
      query: async () => ({
        rows: [
          ...MEERKAT_POSTGRES_MIGRATIONS.map(({ version, name, checksum }) => ({
            version, name, checksum,
          })),
          {
            version: MEERKAT_POSTGRES_SCHEMA_VERSION + 1,
            name: 'future_additive',
            checksum: 'a'.repeat(64),
          },
        ],
      }),
    })).resolves.toEqual({
      currentVersion: MEERKAT_POSTGRES_SCHEMA_VERSION + 1,
      appliedCount: MEERKAT_POSTGRES_MIGRATIONS.length + 1,
    });
  });

  it('renders least-privilege grants without creating login roles', () => {
    const sql = renderMeerkatRoleGrants('meerkat_schema_owner');
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "community" FROM PUBLIC;');
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "community" FROM "meerkat_community";');
    expect(sql).toContain('GRANT USAGE ON SCHEMA "community" TO "meerkat_community";');
    expect(sql).toContain('GRANT SELECT ON TABLE "ops"."schema_migrations"');
    expect(sql).not.toContain('CREATE ROLE');
    expect(sql).not.toMatch(/GRANT .*UPDATE.*ON TABLE "ops"\."schema_migrations"/);
    expect(sql).not.toMatch(/GRANT .*DELETE.*ON TABLE "moderation"\."operator_audit"/);
    expect(sql).not.toMatch(/GRANT .*DELETE.*ON TABLE [^\n]*"community"\."kills"/);
    expect(sql).not.toMatch(/GRANT .*DELETE.*ON TABLE [^\n]*"moderation"\."ncmec_reports"/);
    expect(sql).toContain(
      'GRANT SELECT, INSERT ON TABLE "community"."public_post_tombstones" TO "meerkat_community";',
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT ON TABLE "community"."public_post_tombstones" TO "meerkat_persona";',
    );
    expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON TABLE "community"\."public_posts"/);
    expect(sql).not.toMatch(/GRANT .*UPDATE.*ON TABLE [^\n]*"ops"\."backup_restore_proofs"/);
    expect(sql).toMatch(/GRANT SELECT, INSERT ON TABLE "directory"\."kills" TO "meerkat_directory"/);
    expect(sql).not.toMatch(/GRANT UPDATE.*ON TABLE (?:"community"|"directory")\."kills"/);
    expect(sql).toContain(
      'GRANT UPDATE ("status", "claim_owner", "claim_expires_at", "fencing_token", "attempt_count", "next_attempt_at", "last_error_code", "lifecycle_version", "updated_at", "provider_ref", "filed_at", "filing_attempt_count", "last_filing_error_code", "next_filing_attempt_at") ON TABLE "moderation"."ncmec_reports" TO "meerkat_moderation";',
    );
    expect(sql).toContain(
      'GRANT UPDATE ("approved_at", "lifecycle_version") ON TABLE "ops"."release_manifests" TO "meerkat_ops";',
    );
    // WP-43B seeder role: verb-exact over the archive tables it mutates, scans read-only,
    // the pin-reconcile cursor upsert-only, and never a DELETE on an archive table.
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE "archive"."jobs", "archive"."objects", "archive"."pins" TO "meerkat_archive_seeder";',
    );
    expect(sql).toContain('GRANT SELECT ON TABLE "archive"."scans" TO "meerkat_archive_seeder";');
    expect(sql).not.toMatch(/GRANT [^\n]*(INSERT|UPDATE|DELETE)[^\n]* ON TABLE "archive"\."scans" TO "meerkat_archive_seeder"/);
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE "ops"."archive_pin_reconcile_runs" TO "meerkat_archive_seeder";',
    );
    expect(sql).not.toMatch(/GRANT [^\n]*DELETE[^\n]* ON TABLE "ops"\."archive_pin_reconcile_runs"/);
    expect(sql).not.toMatch(/GRANT [^\n]*DELETE[^\n]* ON TABLE "archive"\./);
    expect(sql).not.toMatch(/GRANT .*INSERT.*ON TABLE "community"\..*TO "meerkat_moderation"/);
    expect(sql).not.toMatch(/GRANT .*INSERT.*ON TABLE "persona"\..*TO "meerkat_moderation"/);
    expect(() => renderMeerkatRoleGrants('unsafe;drop role')).toThrow(/Unsafe/);
    expect(() => renderMeerkatRoleGrants('meerkat_schema_owner', [{
      name: 'meerkat_bad',
      access: [{ schema: 'ops', tables: ['job_leases'], privileges: ['EXECUTE' as never] }],
    }])).toThrow(/unsupported privilege/);
    expect(() => renderMeerkatRoleGrants('meerkat_schema_owner', [{
      name: 'meerkat_bad_columns',
      access: [{
        schema: 'ops',
        tables: ['release_manifests'],
        privileges: ['SELECT'],
        updateColumns: ['approved_at; DROP TABLE ops.release_manifests'],
      }],
    }])).toThrow(/invalid update columns/);
  });

  it('runs every conformance scenario against a fresh store instance', async () => {
    let creates = 0;
    const result = await runStoreConformanceSuite({
      storeName: 'counter',
      createStore: () => {
        creates += 1;
        return { value: 0 };
      },
      scenarios: [
        { name: 'starts empty', run: (store) => expect(store.value).toBe(0) },
        { name: 'accepts mutation', run: (store) => { store.value += 1; expect(store.value).toBe(1); } },
      ],
    });

    expect(creates).toBe(2);
    expect(result).toEqual({ storeName: 'counter', passedScenarios: ['starts empty', 'accepts mutation'] });
  });
});

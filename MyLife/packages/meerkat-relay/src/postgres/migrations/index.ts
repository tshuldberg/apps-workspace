import { createHash } from 'node:crypto';
import { SERVICE_SCHEMAS_SQL } from './0001-service-schemas';
import { MUTABLE_STORE_CONTRACTS_SQL } from './0002-mutable-store-contracts';
import { ADAPTER_CONTRACTS_SQL } from './0003-adapter-contracts';
import { PERSONA_HUMANITY_REGISTRATION_SAGA_SQL } from './0004-persona-humanity-registration-saga';
import { PUSH_LIFECYCLE_SQL } from './0005-push-lifecycle';
import { ARCHIVE_LIFECYCLE_SQL } from './0006-archive-lifecycle';
import { COMMUNITY_PRIVATE_STATE_SQL } from './0007-community-private-state';
import { OBJECT_REFERENCE_ACCOUNTING_SQL } from './0008-object-reference-accounting';
import { BLOCKED_PERSONA_HASH_SQL } from './0009-blocked-persona-hash';
import { CUTOVER_PROOFS_SQL } from './0010-cutover-proofs';
import { RELEASE_PROMOTIONS_SQL } from './0011-release-promotions';
import { REHEARSAL_PROOFS_SQL } from './0012-rehearsal-proofs';
import { HOSTED_STORAGE_API_SQL } from './0013-hosted-storage-api';
import { OAUTH_BROKER_SQL } from './0014-oauth-broker';
import { NCMEC_FILING_SQL } from './0015-ncmec-filing';
import { ARCHIVE_PIN_RECONCILE_CURSOR_SQL } from './0016-archive-pin-reconcile-cursor';
import { ROOM_ADMISSION_STATE_SQL } from './0017-room-admission-state';
import { ACCOUNT_CREDENTIAL_SQL } from './0018-account-credential';
import { ACCOUNT_DELETION_TOMBSTONES_SQL } from './0019-account-deletion-tombstones';
import { ACCOUNT_ISSUANCE_CONTINUITY_SQL } from './0020-account-issuance-continuity';

export interface MeerkatPostgresMigration {
  version: number;
  name: string;
  sql: string;
  execution?: 'transactional' | 'online';
  verificationSql?: string;
  recoverySql?: string;
  checksum: string;
}

export function calculateMigrationChecksum(
  version: number,
  name: string,
  sql: string,
  execution: 'transactional' | 'online' = 'transactional',
  verificationSql = '',
  recoverySql = '',
): string {
  return createHash('sha256')
    .update(`${version}\0${name}\0${execution}\0${verificationSql}\0${recoverySql}\0${sql}`, 'utf8')
    .digest('hex');
}

function defineMigration(version: number, name: string, sql: string): MeerkatPostgresMigration {
  return {
    version,
    name,
    sql,
    execution: 'transactional',
    checksum: calculateMigrationChecksum(version, name, sql, 'transactional'),
  };
}

export const MEERKAT_POSTGRES_MIGRATIONS: readonly MeerkatPostgresMigration[] = [
  defineMigration(1, 'service_schemas', SERVICE_SCHEMAS_SQL),
  defineMigration(2, 'mutable_store_contracts', MUTABLE_STORE_CONTRACTS_SQL),
  defineMigration(3, 'adapter_contracts', ADAPTER_CONTRACTS_SQL),
  defineMigration(4, 'persona_humanity_registration_saga', PERSONA_HUMANITY_REGISTRATION_SAGA_SQL),
  defineMigration(5, 'push_lifecycle', PUSH_LIFECYCLE_SQL),
  defineMigration(6, 'archive_lifecycle', ARCHIVE_LIFECYCLE_SQL),
  defineMigration(7, 'community_private_state', COMMUNITY_PRIVATE_STATE_SQL),
  defineMigration(8, 'object_reference_accounting', OBJECT_REFERENCE_ACCOUNTING_SQL),
  defineMigration(9, 'blocked_persona_hash', BLOCKED_PERSONA_HASH_SQL),
  defineMigration(10, 'cutover_proofs', CUTOVER_PROOFS_SQL),
  defineMigration(11, 'release_promotions', RELEASE_PROMOTIONS_SQL),
  defineMigration(12, 'rehearsal_proofs', REHEARSAL_PROOFS_SQL),
  defineMigration(13, 'hosted_storage_api', HOSTED_STORAGE_API_SQL),
  defineMigration(14, 'oauth_broker', OAUTH_BROKER_SQL),
  defineMigration(15, 'ncmec_filing', NCMEC_FILING_SQL),
  defineMigration(16, 'archive_pin_reconcile_cursor', ARCHIVE_PIN_RECONCILE_CURSOR_SQL),
  defineMigration(17, 'room_admission_state', ROOM_ADMISSION_STATE_SQL),
  defineMigration(18, 'account_credential', ACCOUNT_CREDENTIAL_SQL),
  defineMigration(19, 'account_deletion_tombstones', ACCOUNT_DELETION_TOMBSTONES_SQL),
  defineMigration(20, 'account_issuance_continuity', ACCOUNT_ISSUANCE_CONTINUITY_SQL),
] as const;

export const MEERKAT_POSTGRES_SCHEMA_VERSION =
  MEERKAT_POSTGRES_MIGRATIONS.at(-1)?.version ?? 0;

export function validateMigrationSet(
  migrations: readonly MeerkatPostgresMigration[] = MEERKAT_POSTGRES_MIGRATIONS,
): void {
  let expectedVersion = 1;
  const names = new Set<string>();

  for (const migration of migrations) {
    if (migration.version !== expectedVersion) {
      throw new Error(
        `PostgreSQL migrations must be contiguous from 1. Expected ${expectedVersion}, received ${migration.version}`,
      );
    }
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(migration.name) || names.has(migration.name)) {
      throw new Error(`PostgreSQL migration has an unsafe or duplicate name: ${migration.name}`);
    }
    if (!migration.sql.trim()) {
      throw new Error(`PostgreSQL migration ${migration.version} has empty SQL`);
    }
    const execution = migration.execution ?? 'transactional';
    if (execution !== 'transactional' && execution !== 'online') {
      throw new Error(`PostgreSQL migration has an unsupported execution policy: ${migration.version}`);
    }
    if (execution === 'online' && !migration.verificationSql?.trim()) {
      throw new Error(`Online PostgreSQL migration requires verification SQL: ${migration.version}`);
    }
    if (execution === 'online' && !migration.recoverySql?.trim()) {
      throw new Error(`Online PostgreSQL migration requires recovery SQL: ${migration.version}`);
    }
    if (execution === 'transactional'
      && (migration.verificationSql !== undefined || migration.recoverySql !== undefined)) {
      throw new Error(`Transactional PostgreSQL migration cannot define recovery or verification SQL: ${migration.version}`);
    }
    const expectedChecksum = calculateMigrationChecksum(
      migration.version,
      migration.name,
      migration.sql,
      execution,
      migration.verificationSql ?? '',
      migration.recoverySql ?? '',
    );
    if (migration.checksum !== expectedChecksum) {
      throw new Error(`PostgreSQL migration checksum is invalid: ${migration.version}`);
    }
    names.add(migration.name);
    expectedVersion += 1;
  }
}

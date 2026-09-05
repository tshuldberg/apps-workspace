import { MEERKAT_POSTGRES_SCHEMAS, type MeerkatPostgresSchema } from './store-inventory';

export type MeerkatDatabasePrivilege = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface MeerkatDatabaseTableAccess {
  schema: MeerkatPostgresSchema;
  tables: readonly string[];
  privileges: readonly MeerkatDatabasePrivilege[];
  updateColumns?: readonly string[];
  sequences?: readonly string[];
}

export interface MeerkatDatabaseFunctionAccess {
  schema: MeerkatPostgresSchema;
  name: string;
  argumentTypes: readonly 'text'[];
}

export interface MeerkatDatabaseRole {
  name: string;
  access: readonly MeerkatDatabaseTableAccess[];
  functions?: readonly MeerkatDatabaseFunctionAccess[];
}

const SCHEMA_READINESS_ACCESS: MeerkatDatabaseTableAccess = {
  schema: 'ops',
  tables: ['schema_migrations'],
  privileges: ['SELECT'],
};

/**
 * Infrastructure creates login roles. This manifest grants only the tables and
 * verbs each service needs, so append-only audit and migration-ledger state cannot
 * be rewritten by ordinary service credentials.
 */
export const MEERKAT_DATABASE_ROLES: readonly MeerkatDatabaseRole[] = [
  {
    name: 'meerkat_community',
    access: [
      {
        schema: 'community',
        tables: ['descriptor_revisions', 'publications', 'publication_freezes', 'blocked_personas'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      { schema: 'community', tables: ['kills'], privileges: ['SELECT', 'INSERT'] },
      {
        schema: 'community',
        tables: ['reports'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'community',
        tables: ['public_posts'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      { schema: 'community', tables: ['public_post_tombstones'], privileges: ['SELECT', 'INSERT'] },
      {
        schema: 'community',
        tables: ['public_submit_windows'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      // Plan 51: anonymous-credential presentation checks on the publish surface.
      // Read-only bridge access: epoch public keys + serial revocation list. Never
      // any account-schema table (the wall).
      { schema: 'credential', tables: ['epoch_keys', 'revocations'], privileges: ['SELECT'] },
      {
        schema: 'community', tables: ['private_states'],
        privileges: ['SELECT', 'INSERT'],
        updateColumns: [
          'descriptor_revision', 'descriptor_hash', 'publish_digest',
          'descriptor_payload', 'lifecycle_version', 'updated_at',
        ],
      },
      {
        schema: 'community',
        tables: [
          'private_snapshots', 'private_descriptor_history', 'private_tail',
          'private_challenges', 'private_rate_hits', 'private_publish_stages',
        ],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
        sequences: ['private_tail_tail_id_seq', 'private_rate_hits_hit_id_seq'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_directory',
    access: [
      {
        schema: 'directory',
        tables: ['publications', 'publication_rids', 'host_announcements'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'directory', tables: ['kills'], privileges: ['SELECT', 'INSERT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_humanity',
    access: [{
      schema: 'humanity',
      tables: ['challenges', 'spent_tokens', 'issuance_counts', 'registration_redemptions'],
      privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    }, SCHEMA_READINESS_ACCESS],
  },
  {
    name: 'meerkat_persona',
    access: [
      {
        schema: 'persona',
        tables: ['records', 'alias_tombstones', 'revocations', 'sessions', 'registration_attempts'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'community', tables: ['publications', 'kills', 'reports'], privileges: ['SELECT'] },
      {
        schema: 'community', tables: ['public_posts'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'community', tables: ['public_post_tombstones'],
        privileges: ['SELECT', 'INSERT'],
      },
      {
        schema: 'community', tables: ['public_submit_windows'],
        privileges: ['SELECT', 'DELETE'],
      },
      {
        schema: 'community', tables: ['blocked_personas'],
        privileges: ['SELECT', 'INSERT'],
      },
      {
        schema: 'hosted', tables: ['app_persona_bindings'],
        privileges: ['SELECT', 'DELETE'],
      },
      { schema: 'moderation', tables: ['triage'], privileges: ['SELECT', 'DELETE'] },
      // Plan 51: credential presentation checks at persona registration (read-only bridge).
      { schema: 'credential', tables: ['epoch_keys', 'revocations'], privileges: ['SELECT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_hosted',
    access: [
      {
        schema: 'hosted',
        tables: ['subscriptions', 'app_purchases', 'app_links'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      {
        schema: 'hosted',
        tables: ['app_persona_bindings'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'hosted',
        tables: [
          'storage_tenants', 'storage_tenant_policies', 'storage_reservations',
          'storage_objects',
        ],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      {
        schema: 'hosted',
        tables: [
          'storage_api_upload_blocks', 'storage_api_objects', 'storage_backup_locators',
        ],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'hosted',
        tables: ['seeder_manifests'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'ops',
        tables: ['object_deletion_jobs'],
        privileges: ['SELECT', 'INSERT'],
      },
      {
        schema: 'ops',
        tables: ['object_deletion_audit'],
        privileges: ['INSERT'],
        sequences: ['object_deletion_audit_audit_seq_seq'],
      },
      {
        schema: 'hosted',
        tables: ['oauth_pending_connects'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'hosted',
        tables: ['oauth_vaults'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'hosted',
        tables: ['oauth_sessions', 'oauth_audit_events'],
        privileges: ['INSERT'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
    functions: [{
      schema: 'hosted',
      name: 'delete_storage_api_tenant',
      argumentTypes: ['text'],
    }],
  },
  {
    name: 'meerkat_moderation',
    access: [
      {
        schema: 'moderation',
        tables: ['operator_audit'],
        privileges: ['SELECT', 'INSERT'],
        sequences: ['operator_audit_seq_seq'],
      },
      {
        schema: 'moderation',
        tables: ['triage'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'moderation', tables: ['ncmec_reports'], privileges: ['SELECT', 'INSERT'],
        updateColumns: [
          'status', 'claim_owner', 'claim_expires_at', 'fencing_token', 'attempt_count',
          'next_attempt_at', 'last_error_code', 'lifecycle_version', 'updated_at',
          // WP-43C filing worker: it advances filing state under the same least-privilege role,
          // never a table-wide UPDATE. provider_ref/filed_at are set only on a confirmed filing.
          'provider_ref', 'filed_at', 'filing_attempt_count', 'last_filing_error_code',
          'next_filing_attempt_at',
        ],
      },
      {
        schema: 'moderation', tables: ['dmca_claims'], privileges: ['SELECT', 'INSERT'],
        updateColumns: ['status', 'lifecycle', 'lifecycle_version', 'updated_at'],
      },
      // Plan 51 enforcement: an actioned persona's presented credential serial is revoked
      // here (serial + epoch + reason only, append-only). The moderation role never touches
      // the account schema, so no enforcement write can join an account to a persona.
      { schema: 'credential', tables: ['revocations'], privileges: ['SELECT', 'INSERT'] },
      { schema: 'credential', tables: ['epoch_keys'], privileges: ['SELECT'] },
      {
        schema: 'community',
        tables: ['kills', 'reports', 'public_posts', 'public_post_tombstones', 'publication_freezes'],
        privileges: ['SELECT'],
      },
      { schema: 'persona', tables: ['records', 'revocations'], privileges: ['SELECT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_push',
    access: [
      {
        schema: 'push',
        tables: ['registrations', 'registration_tokens', 'capabilities', 'attempts'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'ops', tables: ['idempotency_results'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_archive',
    access: [
      {
        schema: 'archive',
        tables: ['jobs', 'objects', 'pins'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      { schema: 'archive', tables: ['scans'], privileges: ['SELECT', 'INSERT'] },
      // The archive scanner worker (WP-43A) enqueues CSAM evidence to the NCMEC queue on an
      // abuse-hash hit: append-only INSERT only (idempotent by evidence id). It never claims,
      // exports, or files a report -- that is the NCMEC filing worker (WP-43C, meerkat_moderation).
      // So the archive role gets SELECT + INSERT here and NO update columns. dmca_claims: SELECT.
      { schema: 'moderation', tables: ['ncmec_reports'], privileges: ['SELECT', 'INSERT'] },
      { schema: 'moderation', tables: ['dmca_claims'], privileges: ['SELECT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_ops',
    access: [
      {
        schema: 'ops',
        tables: ['idempotency_results', 'job_leases'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'ops', tables: ['backup_restore_proofs'], privileges: ['SELECT', 'INSERT'] },
      {
        schema: 'ops', tables: ['release_manifests'], privileges: ['SELECT', 'INSERT'],
        updateColumns: ['approved_at', 'lifecycle_version'],
      },
      {
        // The cutover CLI inserts a proof and advances its fenced state machine, updating
        // only the phase columns and the lifecycle guard (column-scoped UPDATE, never a
        // table-wide UPDATE). It never deletes a proof.
        schema: 'ops', tables: ['cutover_proofs'], privileges: ['SELECT', 'INSERT'],
        updateColumns: [
          'state', 'executed_digest', 'post_boot_digest', 'rollback_digest_delta',
          'executed_at', 'flipped_at', 'verified_at', 'rolled_back_at',
          'lifecycle_version', 'updated_at',
        ],
      },
      {
        schema: 'ops',
        tables: ['object_reference_keys', 'object_reference_edges'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'ops',
        tables: ['object_deletion_jobs', 'object_reconciliation_runs'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      {
        schema: 'ops',
        tables: ['object_orphan_sightings'],
        privileges: ['SELECT', 'INSERT', 'DELETE'],
      },
      {
        schema: 'ops', tables: ['object_deletion_audit'], privileges: ['SELECT', 'INSERT'],
        sequences: ['object_deletion_audit_audit_seq_seq'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    name: 'meerkat_observer',
    access: [
      {
        schema: 'ops',
        tables: ['schema_migrations', 'backup_restore_proofs', 'release_manifests', 'cutover_proofs'],
        privileges: ['SELECT'],
      },
    ],
  },
  {
    // The backup digest role: SELECT-only on EVERY managed state store table the
    // portable digest engine scans plus the PostgreSQL-only durable backup-proof
    // inventory, so a production reference snapshot or restore smoke reads every
    // required table as a pure reader. It holds NO write on any table and NO
    // sequence usage, and it is NOT
    // the ops proof tables' writer: the proof insert happens through the separate
    // meerkat_ops connection, so the credential that DIGESTS never RECORDS. Verb-
    // exact discipline: SELECT is the only verb, no UPDATE, no INSERT, no DELETE.
    name: 'meerkat_backup_digest',
    access: [
      {
        schema: 'community',
        tables: [
          'descriptor_revisions', 'publications', 'kills', 'reports', 'public_posts',
          'public_post_tombstones', 'publication_freezes', 'public_submit_windows',
          'blocked_personas', 'private_states',
        ],
        privileges: ['SELECT'],
      },
      { schema: 'directory', tables: ['publications', 'kills'], privileges: ['SELECT'] },
      { schema: 'humanity', tables: ['spent_tokens'], privileges: ['SELECT'] },
      {
        schema: 'persona',
        tables: ['records', 'alias_tombstones', 'revocations'],
        privileges: ['SELECT'],
      },
      {
        schema: 'hosted',
        tables: [
          'subscriptions', 'app_purchases', 'app_persona_bindings',
          'storage_api_objects', 'storage_backup_locators', 'oauth_vaults',
        ],
        privileges: ['SELECT'],
      },
      {
        schema: 'moderation',
        tables: ['triage', 'operator_audit', 'ncmec_reports', 'dmca_claims'],
        privileges: ['SELECT'],
      },
      {
        schema: 'ops',
        tables: ['object_reference_keys', 'object_reference_edges', 'object_deletion_jobs'],
        privileges: ['SELECT'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    // The managed archive SEEDER reconciler (WP-43B): it reconciles serving state against pin intent,
    // drains takedowns (serving off -> reference release -> deletion queue), and never files or scans.
    // It drives the archive pin/object/job UPDATE transitions (claim, confirmRemoval, markObjectDeleted)
    // under a FENCED ops.job_leases lease, releases object reference edges, and enqueues byte deletion
    // through the WP-2C deletion queue -- but it NEVER deletes bytes inline and touches no moderation
    // filing tables. Appended at the END of the role list so existing positional indices are stable.
    // Verb-exact: SELECT/INSERT/UPDATE on the archive tables + the object-accounting tables it mutates,
    // DELETE only where the reference register requires it, and the fenced lease row. scans: SELECT.
    name: 'meerkat_archive_seeder',
    access: [
      {
        schema: 'archive',
        tables: ['jobs', 'objects', 'pins'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      { schema: 'archive', tables: ['scans'], privileges: ['SELECT'] },
      {
        schema: 'ops', tables: ['job_leases'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      {
        schema: 'ops', tables: ['object_reference_keys', 'object_reference_edges'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'ops', tables: ['object_deletion_jobs'], privileges: ['SELECT', 'INSERT', 'UPDATE'] },
      // Durable pin-reconcile resume cursor (migration 14): upsert-only bookkeeping, no DELETE.
      {
        schema: 'ops', tables: ['archive_pin_reconcile_runs'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    // The community room-token service (WP-25E): it reads the current admission generation and
    // atomically inserts or advances that generation when an operator revokes a room. It has no
    // community roster, moderation, LiveKit, archive, or delete authority. Appended at the END of
    // the role list so every existing positional grant assertion remains stable.
    // Verb-exact: SELECT/INSERT/UPDATE on rooms.admission_state plus schema readiness only.
    name: 'meerkat_room_token',
    access: [
      {
        schema: 'rooms',
        tables: ['admission_state'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    // Managed archive HTTP intake (WP-43E). It owns archive job/object lifecycle writes and the
    // exact reference/deletion operations needed for owner-requested takedown. It cannot scan,
    // file moderation reports, mutate serving leases, or touch any private community state.
    name: 'meerkat_archive_intake',
    access: [
      {
        schema: 'archive',
        tables: ['jobs', 'objects', 'pins'],
        privileges: ['SELECT', 'INSERT', 'UPDATE'],
      },
      { schema: 'archive', tables: ['scans'], privileges: ['SELECT'] },
      {
        schema: 'ops', tables: ['object_reference_keys', 'object_reference_edges'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'ops', tables: ['object_deletion_jobs'], privileges: ['SELECT', 'INSERT'] },
      { schema: 'ops', tables: ['object_deletion_audit'], privileges: ['SELECT'] },
      // Plan 51: credential presentation checks at archive intake (read-only bridge).
      { schema: 'credential', tables: ['epoch_keys', 'revocations'], privileges: ['SELECT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
  {
    // Plan 51 verification-account service. Owns the outer identity layer: accounts,
    // entitlements, issuance quota bookkeeping, sealed epoch signing keys, and the
    // anonymous bridge writes (publish epoch public keys; revoke a serial only when the
    // client itself submits its credential during deletion). It holds NO grant on any
    // persona, community, moderation, or archive table: the one-way wall is enforced at
    // the role layer, not just the schema layer. Appended at the END of the role list so
    // every existing positional grant assertion remains stable.
    name: 'meerkat_account',
    access: [
      {
        schema: 'account',
        tables: ['accounts', 'entitlements', 'credential_issuance', 'deleted_subjects'],
        privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
      },
      { schema: 'account', tables: ['epoch_signing_keys'], privileges: ['SELECT', 'INSERT'] },
      { schema: 'credential', tables: ['epoch_keys'], privileges: ['SELECT', 'INSERT'] },
      { schema: 'credential', tables: ['revocations'], privileges: ['SELECT', 'INSERT'] },
      SCHEMA_READINESS_ACCESS,
    ],
  },
] as const;

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;
const SAFE_PRIVILEGES = new Set<MeerkatDatabasePrivilege>(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);

function quoteIdentifier(identifier: string): string {
  if (!SAFE_IDENTIFIER.test(identifier)) {
    throw new Error(`Unsafe PostgreSQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function renderMeerkatRoleGrants(
  ownerRole: string,
  roles: readonly MeerkatDatabaseRole[] = MEERKAT_DATABASE_ROLES,
): string {
  const owner = quoteIdentifier(ownerRole);
  const statements: string[] = [
    'BEGIN;',
    `DO $meerkat_owner_guard$
BEGIN
  IF current_user <> '${ownerRole}' THEN
    RAISE EXCEPTION 'Meerkat grants must run as schema owner ${ownerRole}';
  END IF;
END
$meerkat_owner_guard$;`,
    `-- Applying as schema owner ${owner}.`,
  ];
  const roleNames = new Set<string>();

  for (const schemaName of MEERKAT_POSTGRES_SCHEMAS) {
    const schema = quoteIdentifier(schemaName);
    statements.push(`REVOKE ALL PRIVILEGES ON SCHEMA ${schema} FROM PUBLIC;`);
    statements.push(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} FROM PUBLIC;`);
    statements.push(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} FROM PUBLIC;`);
    statements.push(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM PUBLIC;`);
  }

  for (const role of roles) {
    if (roleNames.has(role.name)) throw new Error(`Duplicate PostgreSQL role: ${role.name}`);
    if (role.name === ownerRole) {
      throw new Error(`PostgreSQL schema owner must be distinct from service roles: ${role.name}`);
    }
    roleNames.add(role.name);
    const target = quoteIdentifier(role.name);
    const roleTables = new Set<string>();
    const roleFunctions = new Set<string>();
    for (const access of role.access) {
      if (access.tables.length === 0 || access.privileges.length === 0) {
        throw new Error(`PostgreSQL role access must name tables and privileges: ${role.name}`);
      }
      if (new Set(access.tables).size !== access.tables.length) {
        throw new Error(`PostgreSQL role access repeats a table: ${role.name}`);
      }
      if (new Set(access.privileges).size !== access.privileges.length
        || access.privileges.some((privilege) => !SAFE_PRIVILEGES.has(privilege))) {
        throw new Error(`PostgreSQL role access has an unsupported privilege: ${role.name}`);
      }
      if (access.updateColumns) {
        if (access.tables.length !== 1
          || access.privileges.includes('UPDATE')
          || access.updateColumns.length === 0
          || new Set(access.updateColumns).size !== access.updateColumns.length
          || access.updateColumns.some((column) => !SAFE_IDENTIFIER.test(column))) {
          throw new Error(`PostgreSQL role access has invalid update columns: ${role.name}`);
        }
      }
      if (access.sequences && (
        access.sequences.length === 0
        || new Set(access.sequences).size !== access.sequences.length
        || access.sequences.some((sequence) => !SAFE_IDENTIFIER.test(sequence))
      )) {
        throw new Error(`PostgreSQL role access has invalid sequences: ${role.name}`);
      }
      for (const table of access.tables) {
        const qualifiedTable = `${access.schema}.${table}`;
        if (roleTables.has(qualifiedTable)) {
          throw new Error(`PostgreSQL role access repeats a qualified table: ${role.name}`);
        }
        roleTables.add(qualifiedTable);
      }
    }
    for (const routine of role.functions ?? []) {
      if (!SAFE_IDENTIFIER.test(routine.name)
        || routine.argumentTypes.some((argument) => argument !== 'text')) {
        throw new Error(`PostgreSQL role access has an invalid function: ${role.name}`);
      }
      const signature = `${routine.schema}.${routine.name}(${routine.argumentTypes.join(',')})`;
      if (roleFunctions.has(signature)) {
        throw new Error(`PostgreSQL role access repeats a function: ${role.name}`);
      }
      roleFunctions.add(signature);
    }

    statements.push(`DO $meerkat_role_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = '${role.name}'
  ) THEN
    RAISE EXCEPTION 'Meerkat service role ${role.name} does not exist';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = '${role.name}'
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'Meerkat service role ${role.name} has unsafe infrastructure-managed attributes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members WHERE member = '${role.name}'::regrole
  ) THEN
    RAISE EXCEPTION 'Meerkat service role ${role.name} must not be a member of another role';
  END IF;
END
$meerkat_role_guard$;`);

    for (const schemaName of MEERKAT_POSTGRES_SCHEMAS) {
      const schema = quoteIdentifier(schemaName);
      statements.push(`REVOKE ALL PRIVILEGES ON SCHEMA ${schema} FROM ${target};`);
      statements.push(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} FROM ${target};`);
      statements.push(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} FROM ${target};`);
      statements.push(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM ${target};`);
    }

    for (const access of role.access) {
      const schema = quoteIdentifier(access.schema);
      const tables = access.tables
        .map((table) => `${schema}.${quoteIdentifier(table)}`)
        .join(', ');
      const privileges = access.privileges.join(', ');
      statements.push(`GRANT USAGE ON SCHEMA ${schema} TO ${target};`);
      statements.push(`GRANT ${privileges} ON TABLE ${tables} TO ${target};`);
      if (access.updateColumns) {
        const columns = access.updateColumns.map(quoteIdentifier).join(', ');
        statements.push(`GRANT UPDATE (${columns}) ON TABLE ${tables} TO ${target};`);
      }
      if (access.sequences) {
        const sequences = access.sequences
          .map((sequence) => `${schema}.${quoteIdentifier(sequence)}`)
          .join(', ');
        statements.push(`GRANT USAGE, SELECT ON SEQUENCE ${sequences} TO ${target};`);
      }
    }
    for (const routine of role.functions ?? []) {
      const schema = quoteIdentifier(routine.schema);
      const name = quoteIdentifier(routine.name);
      statements.push(`GRANT USAGE ON SCHEMA ${schema} TO ${target};`);
      statements.push(
        `GRANT EXECUTE ON FUNCTION ${schema}.${name}(${routine.argumentTypes.join(', ')}) TO ${target};`,
      );
    }
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

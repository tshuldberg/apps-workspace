import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { MEERKAT_DATABASE_ROLES, renderMeerkatRoleGrants, type MeerkatDatabaseRole } from '../roles';
import { STATE_STORE_DESCRIPTORS, STATE_STORE_IDS } from '../../state-import';
import { POSTGRES_BACKUP_PROOF_STORE_IDS } from '../backup-proof-inventory';

function makeRoles(size: number): MeerkatDatabaseRole[] {
  return Array.from({ length: size }, (_, index) => ({
    name: `meerkat_test_${index}`,
    access: [{
      schema: index % 2 === 0 ? 'community' : 'ops',
      tables: [`test_${index}`],
      privileges: index % 3 === 0 ? ['SELECT'] : ['SELECT', 'INSERT'],
    }],
  }));
}

describe('renderMeerkatRoleGrants function quality gate', () => {
  it('renders grants without role creation or credentials', () => {
    const sql = renderMeerkatRoleGrants('meerkat_owner', makeRoles(2));
    expect(sql).toContain('unsafe infrastructure-managed attributes');
    expect(sql).toContain('must not be a member of another role');
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA');
    expect(sql).toContain('GRANT USAGE ON SCHEMA');
    expect(sql).toContain('GRANT SELECT ON TABLE');
    expect(sql).not.toContain('CREATE ROLE');
    expect(sql).not.toContain('ALTER ROLE');
    expect(sql).not.toContain('PASSWORD');
    expect(() => renderMeerkatRoleGrants('meerkat_test_0', makeRoles(1)))
      .toThrow(/owner must be distinct/);
  });

  it('grants each registration saga table only to its owning service role', () => {
    const sql = renderMeerkatRoleGrants('meerkat_owner');
    expect(sql).toContain(
      '"humanity"."registration_redemptions" TO "meerkat_humanity";',
    );
    expect(sql).toContain(
      '"persona"."registration_attempts" TO "meerkat_persona";',
    );
    expect(sql).not.toContain(
      'ON TABLE "humanity"."registration_redemptions" TO "meerkat_persona"',
    );
  });

  it('uses a constrained tenant-delete function instead of table-wide cascade authority', () => {
    const sql = renderMeerkatRoleGrants('meerkat_owner');
    expect(sql).not.toContain(
      'GRANT DELETE ON TABLE "hosted"."storage_tenants" TO "meerkat_hosted";',
    );
    expect(sql).not.toContain(
      'GRANT DELETE ON TABLE "hosted"."storage_objects" TO "meerkat_hosted";',
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, DELETE ON TABLE "hosted"."app_persona_bindings" TO "meerkat_hosted";',
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "hosted"."seeder_manifests" TO "meerkat_hosted";',
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, DELETE ON TABLE "hosted"."storage_api_upload_blocks", "hosted"."storage_api_objects", "hosted"."storage_backup_locators" TO "meerkat_hosted";',
    );
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION "hosted"."delete_storage_api_tenant"(text) TO "meerkat_hosted";',
    );
  });

  it('grants meerkat_backup_digest SELECT-only over exactly the digest scan set, no writes or sequences', () => {
    const role = MEERKAT_DATABASE_ROLES.find((r) => r.name === 'meerkat_backup_digest');
    expect(role, 'meerkat_backup_digest role must exist').toBeTruthy();
    if (!role) throw new Error('missing role');

    // SELECT is the only verb anywhere, and no access block grants a sequence or update columns.
    for (const access of role.access) {
      expect(access.privileges).toEqual(['SELECT']);
      expect(access.sequences).toBeUndefined();
      expect(access.updateColumns).toBeUndefined();
    }

    // The granted tables must equal the portable state-store scan set plus the PostgreSQL-only
    // durable proof inventory. The ops schema_migrations readiness table is the only other grant.
    const granted = new Set<string>();
    for (const access of role.access) {
      for (const table of access.tables) granted.add(`${access.schema}.${table}`);
    }
    expect(granted.has('ops.schema_migrations')).toBe(true);
    granted.delete('ops.schema_migrations');

    const digestSet = new Set(
      STATE_STORE_IDS.map((id) => {
        const d = STATE_STORE_DESCRIPTORS[id];
        return `${d.schema}.${d.table}`;
      }),
    );
    for (const storeId of POSTGRES_BACKUP_PROOF_STORE_IDS) {
      digestSet.add(storeId.replaceAll('-', '_'));
    }
    expect([...granted].sort()).toEqual([...digestSet].sort());

    // The digest credential is NOT the proof writer: it must not touch the ops proof tables.
    expect(granted.has('ops.backup_restore_proofs')).toBe(false);
    expect(granted.has('ops.cutover_proofs')).toBe(false);

    const sql = renderMeerkatRoleGrants('meerkat_owner');
    expect(sql).toContain('GRANT SELECT ON TABLE "humanity"."spent_tokens" TO "meerkat_backup_digest";');
    expect(sql).toContain('"hosted"."storage_api_objects"');
    expect(sql).toContain('"hosted"."storage_backup_locators"');
    expect(sql).toContain('"hosted"."oauth_vaults"');
    // No write verb is ever granted to the digest role.
    expect(sql).not.toMatch(/GRANT [^\n]*(INSERT|UPDATE|DELETE)[^\n]* TO "meerkat_backup_digest"/);
  });

  it('grants the archive scanner NCMEC enqueue authority (INSERT, no export update columns)', () => {
    const sql = renderMeerkatRoleGrants('meerkat_owner');
    // The archive scanner enqueues CSAM evidence on an abuse-hash hit: SELECT + INSERT only.
    expect(sql).toContain(
      'GRANT SELECT, INSERT ON TABLE "moderation"."ncmec_reports" TO "meerkat_archive";',
    );
    // It is NOT the filing/export worker, so it never receives the fenced export update columns.
    expect(sql).not.toMatch(
      /GRANT UPDATE \([^)]*\) ON TABLE "moderation"\."ncmec_reports" TO "meerkat_archive"/,
    );
    // dmca_claims stays SELECT-only for the archive role.
    expect(sql).toContain(
      'GRANT SELECT ON TABLE "moderation"."dmca_claims" TO "meerkat_archive";',
    );
    expect(sql).not.toMatch(
      /GRANT [^\n]*(INSERT|UPDATE|DELETE)[^\n]* ON TABLE "moderation"\."dmca_claims" TO "meerkat_archive"/,
    );
  });

  it('rejects duplicate roles, qualified tables, and privileges', () => {
    const duplicateRole = makeRoles(1)[0]!;
    expect(() => renderMeerkatRoleGrants('meerkat_owner', [duplicateRole, duplicateRole]))
      .toThrow(/Duplicate PostgreSQL role/);
    expect(() => renderMeerkatRoleGrants('meerkat_owner', [{
      name: 'meerkat_duplicate_table',
      access: [
        { schema: 'ops', tables: ['job_leases'], privileges: ['SELECT'] },
        { schema: 'ops', tables: ['job_leases'], privileges: ['UPDATE'] },
      ],
    }])).toThrow(/repeats a qualified table/);
    expect(() => renderMeerkatRoleGrants('meerkat_owner', [{
      name: 'meerkat_duplicate_privilege',
      access: [{ schema: 'ops', tables: ['job_leases'], privileges: ['SELECT', 'SELECT'] }],
    }])).toThrow(/unsupported privilege/);
    expect(() => renderMeerkatRoleGrants('meerkat_owner', [{
      name: 'meerkat_table_and_column_update',
      access: [{
        schema: 'ops',
        tables: ['release_manifests'],
        privileges: ['SELECT', 'UPDATE'],
        updateColumns: ['approved_at'],
      }],
    }])).toThrow(/invalid update columns/);
  });

  it('rejects fuzzed unsafe owner identifiers', async () => {
    await runDeterministicFuzz({
      label: 'renderMeerkatRoleGrants fuzz',
      iterations: 150,
      seed: 42,
      makeCase: (rng) => rng() > 0.5
        ? `owner_${randomInt(rng, 1, 99999)}`
        : `owner;${randomInt(rng, 1, 99999)}`,
      assertCase: (owner) => {
        if (owner.includes(';')) {
          expect(() => renderMeerkatRoleGrants(owner, makeRoles(1))).toThrow(/Unsafe/);
        } else {
          expect(renderMeerkatRoleGrants(owner, makeRoles(1))).toContain(`"${owner}"`);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'renderMeerkatRoleGrants',
      sizes: [100, 200, 400],
      expected: 'linear',
      setup: makeRoles,
      run: (input) => renderMeerkatRoleGrants('meerkat_owner', input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'renderMeerkatRoleGrants',
      repeats: 30,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeRoles(50),
      run: (input) => renderMeerkatRoleGrants('meerkat_owner', input),
    });
  });
});

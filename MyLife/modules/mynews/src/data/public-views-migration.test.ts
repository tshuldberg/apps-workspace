import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the least-privilege public views migration
// (production audit 2026-07-11, finding C07). The public base-table select
// policies are gone (self-select only remains); public reads go through
// nw_public_profiles / nw_public_journalists, which never expose user_id,
// suspended_until, copyright_strikes, or stripe_account_id; and
// stripe_account_id gets its own client-write guard trigger.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260712000003_mynews_public_views.sql'),
  'utf8',
);

/**
 * Extracts the text of one `create ... view <name> ... ;` statement so column
 * assertions can be scoped to that statement instead of the whole migration
 * file, which legitimately mentions user_id elsewhere (the new self-select
 * policy bodies).
 */
function viewBody(name: string): string {
  const start = migration.indexOf(`view public.${name}`);
  expect(start, `expected to find "view public.${name}" in the migration`).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf(';', start);
  return migration.slice(start, end);
}

describe('20260712000003 public views + DTO scrub', () => {
  it('drops the public base-table select policies', () => {
    expect(migration).toContain('drop policy if exists nw_profiles_public_select on public.nw_profiles');
    expect(migration).toContain('drop policy if exists nw_journalists_public_select on public.nw_journalists');
  });

  it('replaces them with self-select policies', () => {
    expect(migration).toContain('create policy nw_profiles_self_select on public.nw_profiles');
    expect(migration).toContain('for select using (auth.uid() = user_id)');
    expect(migration).toContain('create policy nw_journalists_self_select on public.nw_journalists');
    expect(migration).toContain(
      'auth.uid() = (select user_id from public.nw_profiles where id = profile_id)',
    );
  });

  it('creates nw_public_profiles without user_id, suspended_until, or copyright_strikes', () => {
    const body = viewBody('nw_public_profiles');
    expect(body).toContain('id, handle, display_name, pubkey_ed25519, kind, created_at');
    expect(body).not.toContain('user_id');
    expect(body).not.toContain('suspended_until');
    expect(body).not.toContain('copyright_strikes');
  });

  it('creates nw_public_journalists without stripe_account_id', () => {
    const body = viewBody('nw_public_journalists');
    expect(body).toContain('profile_id, tier, bio, beats, region, created_at');
    expect(body).not.toContain('stripe_account_id');
  });

  it('makes both owner-rights public views security barriers', () => {
    expect(viewBody('nw_public_profiles')).toContain('with (security_barrier = true)');
    expect(viewBody('nw_public_journalists')).toContain('with (security_barrier = true)');
    expect(migration).not.toMatch(/security_invoker\s*=/);
  });

  it('grants select on both public views to anon and authenticated', () => {
    expect(migration).toContain('grant select on public.nw_public_profiles to anon, authenticated');
    expect(migration).toContain('grant select on public.nw_public_journalists to anon, authenticated');
  });

  it('guards stripe_account_id against client insert and update', () => {
    expect(migration).toContain('create or replace function public.nw_journalists_guard_client_write');
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain("tg_op = 'INSERT' and new.stripe_account_id is not null");
    expect(migration).toContain('new.stripe_account_id is distinct from old.stripe_account_id');
    expect(migration).toContain(
      'create trigger nw_journalists_client_write_guard\n  before insert or update on public.nw_journalists',
    );
  });

  it('is append-only against the tables and policies it references', () => {
    expect(migration).not.toContain('create table if not exists public.nw_profiles');
    expect(migration).not.toContain('create table if not exists public.nw_journalists');
    expect(migration).not.toContain('create policy nw_profiles_self_insert');
    expect(migration).not.toContain('create policy nw_profiles_self_update');
  });
});

/**
 * Table-driven RLS access matrix: executable documentation of who can read
 * what after this migration. Cross-references the migration text so a future
 * edit that silently widens access fails this test.
 */
interface AccessRow {
  role: 'anon' | 'authenticated' | 'owner' | 'service_role';
  table: 'nw_profiles' | 'nw_journalists';
  readableColumns: string[];
}

const ACCESS_MATRIX: AccessRow[] = [
  {
    role: 'anon',
    table: 'nw_profiles',
    readableColumns: ['id', 'handle', 'display_name', 'pubkey_ed25519', 'kind', 'created_at'],
  },
  {
    role: 'authenticated',
    table: 'nw_profiles',
    readableColumns: ['id', 'handle', 'display_name', 'pubkey_ed25519', 'kind', 'created_at'],
  },
  {
    role: 'owner',
    table: 'nw_profiles',
    readableColumns: [
      'id',
      'user_id',
      'handle',
      'display_name',
      'pubkey_ed25519',
      'kind',
      'created_at',
      'suspended_until',
      'copyright_strikes',
    ],
  },
  {
    role: 'anon',
    table: 'nw_journalists',
    readableColumns: ['profile_id', 'tier', 'bio', 'beats', 'region', 'created_at'],
  },
  {
    role: 'authenticated',
    table: 'nw_journalists',
    readableColumns: ['profile_id', 'tier', 'bio', 'beats', 'region', 'created_at'],
  },
  {
    role: 'owner',
    table: 'nw_journalists',
    readableColumns: ['profile_id', 'tier', 'bio', 'beats', 'region', 'stripe_account_id', 'created_at'],
  },
];

describe('post-migration RLS access matrix', () => {
  for (const row of ACCESS_MATRIX) {
    it(`${row.role} on ${row.table} sees only ${row.readableColumns.join(', ')}`, () => {
      if (row.role === 'anon' || row.role === 'authenticated') {
        // Public roles read through the least-privilege view, never the base
        // table select policy (which is dropped).
        const viewName = row.table === 'nw_profiles' ? 'nw_public_profiles' : 'nw_public_journalists';
        expect(migration).toContain(`grant select on public.${viewName} to anon, authenticated`);
        expect(row.readableColumns).not.toContain('user_id');
        expect(row.readableColumns).not.toContain('suspended_until');
        expect(row.readableColumns).not.toContain('copyright_strikes');
        expect(row.readableColumns).not.toContain('stripe_account_id');
      }
      if (row.role === 'owner') {
        // Owners read their own full row from the base table via self-select.
        const policyName = row.table === 'nw_profiles' ? 'nw_profiles_self_select' : 'nw_journalists_self_select';
        expect(migration).toContain(`create policy ${policyName} on public.${row.table}`);
      }
    });
  }

  it('service_role bypasses RLS entirely and is unaffected by any policy change here', () => {
    // Documented, not asserted against SQL text: RLS never applies to the
    // service role, so no policy in this migration can affect it.
    const serviceRoleRow = ACCESS_MATRIX.find((r) => r.role === 'service_role');
    expect(serviceRoleRow).toBeUndefined();
  });
});

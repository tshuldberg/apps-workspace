import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural pins for the WP12 custody + deletion hardening migration
// (plan 48, opus adversarial review 2026-07-30). No live Postgres runs here, so
// these assert the SQL text closes each finding; behavior is proven against the
// in-memory twin in supabase/functions/mynews-account/__tests__.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000013_mynews_custody_deletion_hardening.sql'),
  'utf8',
);
const guardOrigin = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000008_mynews_dmca.sql'),
  'utf8',
);

describe('20260730000013 custody + deletion hardening', () => {
  it('the lifecycle columns had no guard before this migration (finding #1)', () => {
    // The prior guard body covered only suspension and strikes.
    expect(guardOrigin).toContain('nw_profiles_guard_suspension_write');
    expect(guardOrigin).not.toContain('new.deleted_at is distinct from old.deleted_at');
    expect(guardOrigin).not.toContain('new.pubkey_revoked_at is distinct from old.pubkey_revoked_at');
  });

  it('extends the client-write guard to deleted_at and pubkey_revoked_at (finding #1a)', () => {
    expect(migration).toContain('create or replace function public.nw_profiles_guard_suspension_write()');
    expect(migration).toContain("current_user in ('authenticated', 'anon')");
    expect(migration).toContain('new.deleted_at is distinct from old.deleted_at');
    expect(migration).toContain('new.pubkey_revoked_at is distinct from old.pubkey_revoked_at');
  });

  it('keys the dispose one-shot on the anonymization marker, not deleted_at (finding #1b)', () => {
    expect(migration).toContain('create or replace function public.nw_account_deletion_dispose');
    expect(migration).toContain(
      "if v_display_name is distinct from 'Deleted account' or v_deleted_at is null then",
    );
    // The old fail-open gate must be gone.
    expect(migration).not.toContain('if v_deleted_at is null then\n      loop');
  });

  it('hard-deletes every WP6 custody personal table (finding #4)', () => {
    for (const table of [
      'nw_key_escrow',
      'nw_key_escrow_access',
      'nw_key_recovery_requests',
      'nw_key_nonces',
      'nw_key_notify_channels',
    ]) {
      expect(migration, table).toContain(`delete from public.${table} where profile_id = v_profile_id`);
    }
    // The authorship chain is retained (it verifies public revisions).
    expect(migration).not.toContain('delete from public.nw_profile_keys');
  });

  it('retains an open-reported suggestion instead of deleting it (finding #3)', () => {
    expect(migration).toContain("r.target_kind = 'suggestion'");
    expect(migration).toContain('r.target_id = nw_edit_suggestions.id::text');
    expect(migration).toContain("r.status = 'open'");
  });

  it('never deletes a legal or safety row', () => {
    for (const table of [
      'nw_reports',
      'nw_dmca_notices',
      'nw_dmca_counter_notices',
      'nw_ncii_cases',
      'nw_moderation_actions',
    ]) {
      expect(migration, table).not.toContain(`delete from public.${table}`);
    }
  });

  it('keeps the dispose RPC service-role only', () => {
    expect(migration).toContain(
      'revoke all on function public.nw_account_deletion_dispose(uuid) from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.nw_account_deletion_dispose(uuid) to service_role',
    );
  });
});

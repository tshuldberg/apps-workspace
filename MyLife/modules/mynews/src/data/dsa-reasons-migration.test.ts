import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the DSA Art 17 statement-of-reasons read (Plan 39
// T11). The read RPC is SECURITY DEFINER (bypasses the service-role-only RLS on
// nw_moderation_actions) but scopes every returned row to content the passed-in
// user OWNS, and is revoked from public/anon/authenticated (service role only).
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000010_mynews_dsa_reasons.sql'),
  'utf8',
);

describe('20260705000010 DSA statement-of-reasons read', () => {
  it('defines the scoped read RPC as security definer', () => {
    expect(migration).toContain(
      'create or replace function public.nw_get_my_moderation_notices(p_user uuid)',
    );
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
  });

  it('scopes rows to content the caller owns (article, suggestion, profile)', () => {
    // Each ownership branch joins the target back to nw_profiles.user_id = p_user.
    expect(migration).toContain('join public.nw_profiles p on p.id = a.author_id');
    expect(migration).toContain('join public.nw_profiles p on p.id = s.editor_id');
    expect(migration).toContain('p.user_id = p_user');
    expect(migration).toContain("ma.target_kind in ('article', 'revision')");
    expect(migration).toContain("ma.target_kind = 'suggestion'");
    expect(migration).toContain("ma.target_kind = 'profile'");
  });

  it('excludes non-adverse dismiss/restore actions', () => {
    expect(migration).toContain("ma.action not in ('dismiss', 'restore')");
  });

  it('locks the RPC to the service role', () => {
    expect(migration).toContain(
      'revoke all on function public.nw_get_my_moderation_notices(uuid) from public',
    );
    expect(migration).toContain('from anon, authenticated');
    expect(migration).toContain(
      'grant execute on function public.nw_get_my_moderation_notices(uuid) to service_role',
    );
  });

  it('is append-only: it never creates or alters the audit table', () => {
    expect(migration).not.toContain('create table');
    expect(migration).not.toContain('alter table');
  });
});

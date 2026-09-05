import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source-structural proof for the block/mute list migration. A block is a
// personal, self-scoped list (like nw_follows): the blocker owns their own rows
// directly and the blocked user can never read who blocked them. So the RLS must
// mirror nw_follows_self_all (auth.uid() = the blocker's user_id for all ops),
// NOT the service-role client-write-guard pattern used for nw_reports.
const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000006_mynews_blocks.sql'),
  'utf8',
);

describe('20260705000006 blocks', () => {
  it('creates nw_blocks with blocker/blocked profile fks and a mode check', () => {
    expect(migration).toContain('create table if not exists public.nw_blocks');
    expect(migration).toContain('blocker_id uuid not null references public.nw_profiles');
    expect(migration).toContain('blocked_profile_id uuid not null references public.nw_profiles');
    expect(migration).toContain("mode text not null default 'block' check (mode in ('block', 'mute'))");
  });

  it('enforces one block per (blocker, blocked) pair', () => {
    expect(migration).toContain('unique (blocker_id, blocked_profile_id)');
  });

  it('enables RLS and models the self-scoped policy on nw_follows_self_all', () => {
    expect(migration).toContain('alter table public.nw_blocks enable row level security');
    expect(migration).toContain('create policy nw_blocks_self_all on public.nw_blocks');
    expect(migration).toContain('for all using');
    // The only path binds every op to the blocker's own user_id: the blocked
    // user can never select who blocked them (no separate public read policy).
    expect(migration).toContain(
      'auth.uid() = (select user_id from public.nw_profiles where id = blocker_id)',
    );
    expect(migration).not.toContain('using (true)');
  });

  it('is NOT the service-role client-write-guard pattern (a client owns blocks directly)', () => {
    expect(migration).not.toContain('guard_client_insert');
    expect(migration).not.toContain('security definer');
    expect(migration).not.toContain('to service_role');
  });

  it('is append-only (does not redefine base tables or the follows policy)', () => {
    expect(migration).not.toContain('create policy nw_follows_self_all');
    expect(migration).not.toContain('create table if not exists public.nw_profiles');
    expect(migration).not.toContain('create table if not exists public.nw_follows');
  });
});

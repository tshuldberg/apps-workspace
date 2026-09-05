// SQL-text assertions for the key custody migration. Deliberately import-free:
// this project's rootDir is modules/mynews/src, so it cannot pull runtime values
// out of supabase/functions. Behavioural assertions live beside the handlers
// (supabase/functions/_shared/__tests__/mynews-key-custody-store.test.ts and
// mynews-key-verify.test.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260730000008_mynews_key_custody.sql'),
  'utf8',
);

const pubkeyPop = readFileSync(
  join(__dirname, '../../../../supabase/migrations/20260705000003_mynews_pubkey_pop.sql'),
  'utf8',
);

/**
 * Whitespace- and comment-marker-collapsed view of the migration. Statements and
 * prose both wrap across lines for readability, so assertions about either would
 * otherwise be hostage to where a line happened to break.
 */
const flat = migration.replace(/^\s*--\s?/gm, ' ').replace(/\s+/g, ' ');

/** SQL only, comments stripped: for asserting what the migration DOES. */
const sqlOnly = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('20260730000008 MyNews key custody', () => {
  it('creates every custody table with RLS enabled', () => {
    for (const table of [
      'nw_profile_keys',
      'nw_key_nonces',
      'nw_key_escrow',
      'nw_key_escrow_access',
      'nw_key_notify_channels',
      'nw_key_recovery_requests',
      'nw_key_events',
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('grants every custody RPC to service_role ONLY', () => {
    const rpcs = [
      'nw_key_resolve_active(text)',
      'nw_key_issue_nonce(uuid, text, text, integer, integer, integer)',
      'nw_key_rotate(uuid, text, text, text, jsonb)',
      'nw_key_approve_device(uuid, text, text, jsonb)',
      'nw_key_revoke(uuid, text, uuid)',
      'nw_key_escrow_put(uuid, text, jsonb, text)',
      'nw_key_escrow_get(uuid, integer)',
      'nw_key_recovery_request(uuid, text, text, integer, integer, integer, integer)',
      'nw_key_recovery_cancel(uuid, text, uuid, text, integer, integer)',
      'nw_key_recovery_complete(uuid, text, uuid, text, jsonb)',
      'nw_key_custody_status(uuid)',
    ];
    for (const rpc of rpcs) {
      // Grant and revoke statements wrap across lines, so match the flattened
      // text rather than a particular line break.
      expect(flat).toContain(`grant execute on function public.${rpc} to service_role`);
      expect(flat).toContain(`revoke all on function public.${rpc} from public, anon, authenticated`);
    }
  });

  it('declares every custody RPC security definer with a pinned search_path', () => {
    // One definer per RPC plus the three trigger/helper functions.
    const definers = migration.match(/security definer/g) ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(15);
    expect(migration.match(/set search_path = public/g)?.length).toBe(definers.length);
  });

  it('enforces ONE globally active pubkey and one active primary per profile', () => {
    expect(migration).toContain(
      'create unique index if not exists idx_nw_profile_keys_active_pubkey',
    );
    expect(migration).toMatch(
      /idx_nw_profile_keys_active_pubkey[\s\S]{0,120}on public\.nw_profile_keys \(pubkey\)[\s\S]{0,40}where status = 'active'/,
    );
    expect(migration).toMatch(
      /idx_nw_profile_keys_one_active_primary[\s\S]{0,160}where status = 'active' and kind = 'primary'/,
    );
  });

  it('keeps valid_from and revoked_at as DISPLAY ONLY, never a validity gate', () => {
    expect(flat).toContain('valid_from and revoked_at are DISPLAY ONLY');
    // No RPC compares a revision timestamp to a key window.
    expect(migration).not.toMatch(/created_at\s*(<|>)=?\s*(k\.)?valid_from/);
    expect(migration).not.toMatch(/created_at\s*(<|>)=?\s*(k\.)?revoked_at/);
  });

  it('adds verified_key_id to revisions and suggestions and backfills both', () => {
    expect(migration).toContain('alter table public.nw_article_revisions');
    expect(migration).toContain('add column if not exists verified_key_id uuid');
    expect(migration).toContain('alter table public.nw_edit_suggestions');
    expect(migration).toContain('update public.nw_article_revisions r');
    expect(migration).toContain('update public.nw_edit_suggestions s');
  });

  it('records the signer on suggestions so they survive an editor rotation', () => {
    expect(migration).toContain(
      'add column if not exists signer_pubkey text not null default',
    );
    expect(migration).toContain("coalesce(p_suggestion->>'signerPubkey', '')");
  });

  it('backfills an initial chain row ONLY for live, non-anonymized profiles', () => {
    expect(migration).toMatch(
      /insert into public\.nw_profile_keys[\s\S]{0,900}where coalesce\(p\.pubkey_ed25519, ''\) <> ''[\s\S]{0,200}and p\.pubkey_revoked_at is null[\s\S]{0,80}and p\.deleted_at is null/,
    );
  });

  it('revokes the chain when a head is cleared, covering WP5 anonymization', () => {
    expect(migration).toContain('create or replace function public.nw_profiles_sync_key_chain');
    expect(migration).toMatch(
      /coalesce\(old\.pubkey_ed25519, ''\) <> '' and coalesce\(new\.pubkey_ed25519, ''\) = ''[\s\S]{0,300}set status = 'revoked'/,
    );
    expect(migration).toContain('create trigger nw_profiles_key_chain_sync');
  });

  it('writes the initial chain row on a bind, so a new registration can publish', () => {
    expect(migration).toMatch(
      /coalesce\(old\.pubkey_ed25519, ''\) = '' and coalesce\(new\.pubkey_ed25519, ''\) <> ''[\s\S]{0,400}added_via[\s\S]{0,200}'initial'/,
    );
  });

  it('leaves the frozen initial-bind path from 20260705000003 untouched', () => {
    // The design freezes nw_set_profile_pubkey, its already-set guard, and the
    // client-write trigger. This migration must not redefine any of them.
    expect(pubkeyPop).toContain('create or replace function public.nw_set_profile_pubkey');
    expect(migration).not.toContain('function public.nw_set_profile_pubkey');
    expect(migration).not.toContain('nw_profiles_guard_client_update');
    expect(migration).not.toContain('nw_profiles_client_guard');
  });

  it('does not redefine the WP5 disposition function', () => {
    // A transition trigger covers the anonymization path instead, so the
    // ~200-line disposition function is not duplicated here.
    expect(sqlOnly).not.toContain('nw_account_deletion_dispose');
    // The header explains WHY it is not redefined, so the name appears in prose.
    expect(flat).toContain('this migration does not create-or-replace');
  });

  it('consumes the nonce and re-asserts the head INSIDE each mutation', () => {
    for (const rpc of ['nw_key_rotate', 'nw_key_recovery_complete']) {
      const body = migration.slice(
        migration.indexOf(`create or replace function public.${rpc}`),
      );
      expect(body).toContain('delete from public.nw_key_nonces');
      expect(body).toMatch(/and pubkey_ed25519 = v_nonce\.old_pubkey/);
      expect(body).toContain("return jsonb_build_object('outcome', 'head-conflict')");
    }
    // Device approval takes the same row lock without mutating the head.
    const approve = migration.slice(
      migration.indexOf('create or replace function public.nw_key_approve_device'),
    );
    expect(approve).toContain('for update');
    expect(approve).toContain("return jsonb_build_object('outcome', 'head-conflict')");
  });

  it('binds each nonce to a purpose and enforces the 5-minute TTL', () => {
    expect(migration).toMatch(/purpose text not null check \([\s\S]{0,200}'recovery_complete'/);
    expect(migration).toContain('p_ttl_seconds integer default 300');
    for (const rpc of ['nw_key_rotate', 'nw_key_approve_device', 'nw_key_revoke']) {
      const body = migration.slice(migration.indexOf(`create or replace function public.${rpc}`));
      expect(body).toContain('and expires_at >= now()');
    }
  });

  it('spells out the revocation precedence rules', () => {
    const revoke = migration.slice(
      migration.indexOf('create or replace function public.nw_key_revoke'),
    );
    expect(revoke).toContain("return jsonb_build_object('outcome', 'use-rotation-for-primary')");
    expect(revoke).toContain("return jsonb_build_object('outcome', 'revoke-precedence')");
    expect(revoke).toMatch(/v_actor\.kind = 'device' and v_actor\.id <> v_target\.id and v_actor\.seq > v_target\.seq/);
  });

  it('makes escrow append-versioned, capped at 3, and logged', () => {
    const put = migration.slice(
      migration.indexOf('create or replace function public.nw_key_escrow_put'),
    );
    expect(put).toContain('select coalesce(max(version), 0) + 1');
    expect(put).toContain('and e.version <= v_version - 3');
    expect(put).toContain('insert into public.nw_key_escrow_access');
  });

  it('rate limits escrow reads to 3 a day and logs denials too', () => {
    const get = migration.slice(
      migration.indexOf('create or replace function public.nw_key_escrow_get'),
    );
    expect(get).toContain('p_max_per_day integer default 3');
    expect(get).toContain("interval '24 hours'");
    expect(get).toContain("'get-denied'");
    expect(get).toContain("return jsonb_build_object('outcome', 'rate-limited')");
  });

  it('publishes a backup_restore event for a bind within 24h of a read', () => {
    const rotate = migration.slice(
      migration.indexOf('create or replace function public.nw_key_rotate'),
    );
    expect(rotate).toMatch(/nw_key_escrow_access[\s\S]{0,200}interval '24 hours'/);
    expect(rotate).toContain("case when v_restore then 'backup_restore' else 'rotation' end");
  });

  it('hard-gates no-kit recovery on a CONFIRMED notification channel', () => {
    const request = migration.slice(
      migration.indexOf('create or replace function public.nw_key_recovery_request'),
    );
    expect(request).toMatch(
      /nw_key_notify_channels[\s\S]{0,120}confirmed_at is not null[\s\S]{0,200}'notification-channel-required'/,
    );
  });

  it('ships NO way to confirm a notification channel, so the gate always refuses', () => {
    // The honesty boundary: a confirmed_at with no delivery behind it would turn
    // the fail-closed gate into a fabricated capability and re-open finding C-1.
    expect(migration).not.toMatch(/update public\.nw_key_notify_channels/);
    expect(migration).not.toMatch(/insert into public\.nw_key_notify_channels/);
    expect(migration).not.toMatch(/create policy nw_key_notify_channels_\w*_insert/);
    expect(flat).toContain('MyNews ships no notification provider today');
  });

  it('scales the recovery lock by byline standing', () => {
    const request = migration.slice(
      migration.indexOf('create or replace function public.nw_key_recovery_request'),
    );
    expect(request).toContain('p_baseline_hours integer default 72');
    expect(request).toContain('p_verified_hours integer default 168');
    expect(request).toMatch(/case when v_standing = 'verified' then p_verified_hours else p_baseline_hours end/);
  });

  it('freezes the no-kit path after 2 cancels in 90 days', () => {
    expect(migration).toContain('p_freeze_window_days integer default 90');
    expect(migration).toContain('p_freeze_cancel_count integer default 2');
    const cancel = migration.slice(
      migration.indexOf('create or replace function public.nw_key_recovery_cancel'),
    );
    expect(cancel).toMatch(/v_prior \+ 1 >= p_freeze_cancel_count then 'frozen' else 'cancelled'/);
    expect(cancel).toContain("'recovery_frozen'");
  });

  it('stores only the HASH of the cancel token', () => {
    expect(migration).toContain('cancel_token_hash text not null');
    expect(flat).toContain('NEVER stored');
    // No column, anywhere, holds the raw token.
    expect(sqlOnly).not.toMatch(/cancel_token text/);
  });

  it('enforces the pre-committed pubkey at completion', () => {
    const complete = migration.slice(
      migration.indexOf('create or replace function public.nw_key_recovery_complete'),
    );
    expect(complete).toContain('if v_req.new_pubkey <> p_new_pubkey then');
    expect(complete).toContain("'pubkey-not-precommitted'");
    expect(complete).toContain("return jsonb_build_object('outcome', 'still-locked'");
    // Recovery revokes EVERY prior key, devices included.
    expect(complete).toMatch(
      /update public\.nw_profile_keys[\s\S]{0,200}where profile_id = v_nonce\.profile_id and status = 'active'/,
    );
  });

  it('keeps the resolver fail-closed on deleted and revoked profiles', () => {
    const resolver = migration.slice(
      migration.indexOf('create or replace function public.nw_key_resolve_active'),
    );
    expect(resolver).toMatch(
      /v_row\.status = 'active'[\s\S]{0,120}v_row\.deleted_at is null[\s\S]{0,80}v_row\.pubkey_revoked_at is null/,
    );
    expect(resolver).toContain("jsonb_build_object('verdict', 'unknown')");
    expect(resolver).toContain("'verdict', 'revoked'");
  });

  it('orders the escrow access log by a monotonic seq, not by wall clock', () => {
    // Two events inside one millisecond would tie on created_at, and a security
    // log whose newest row can render below an older one is misleading.
    expect(migration).toMatch(/nw_key_escrow_access \([\s\S]{0,400}seq bigserial not null unique/);
    expect(migration).toContain('on public.nw_key_escrow_access (profile_id, seq desc)');
    expect(migration).toContain('order by seq desc limit 20');
  });

  it('makes the chain and the event feed publicly readable', () => {
    expect(migration).toContain('create policy nw_profile_keys_public_select');
    expect(migration).toContain('create policy nw_key_events_public_select');
  });

  it('keeps nonces entirely off the client', () => {
    expect(migration).not.toMatch(/create policy nw_key_nonces_/);
  });

  it('scopes escrow, its access log, and recovery rows to the OWNER session', () => {
    for (const policy of [
      'nw_key_escrow_owner_select',
      'nw_key_escrow_access_owner_select',
      'nw_key_notify_channels_owner_select',
      'nw_key_recovery_requests_owner_select',
    ]) {
      expect(migration).toContain(`create policy ${policy}`);
    }
    expect(migration).toMatch(/p\.user_id = auth\.uid\(\) and p\.deleted_at is null/);
  });
});

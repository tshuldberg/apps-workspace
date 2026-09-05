-- MyNews moderator console integrity (plan 48 WP9, section F).
--
-- Everything the console could already do, it could do with one moderator, one
-- factor, no role, no version check, and an audit trail that a database writer
-- could edit. This migration closes all of that:
--
--   1. Optimistic concurrency. Every console-facing queue row carries
--      `console_version`, bumped by a trigger on every update. A console action
--      submits the version it rendered; a mismatch is a typed 'stale-action'
--      conflict instead of a silent second enforcement.
--   2. RBAC. nw_moderator_roles (admin > senior > reviewer) with service-role
--      only writes, an admin-gated grant/revoke path, and a bootstrap RPC that
--      works exactly once (while no active admin exists) so founder-ops can seed
--      the first admin without a hand-written insert.
--   3. Replay protection. nw_console_action_tokens claims a per-form token
--      inside the enforcement transaction. A resubmitted form returns 'replayed'
--      with the original outcome rather than enforcing twice.
--   4. Dual control. nw_pending_actions holds high-impact actions (long
--      suspensions, terminations, restorations, payout block/unblock) until a
--      SECOND moderator approves. Self-approval is blocked by a table CHECK, not
--      only by the UI, and approval executes in the approving transaction.
--   5. Transactional enforcement. One RPC per queue runs the whole multi-step
--      action (hide + strike + resolve) inside a single transaction with an
--      inner exception block, so a failing step rolls back the steps before it
--      and still returns a typed result.
--   6. Assignment + escalation. nw_queue_assignments covers every queue with one
--      table so a new queue does not need a new column on someone else's table.
--   7. Appeals. nw_moderation_appeals gives users an appeal against moderation
--      actions on their own content, and nw_console_appeals unions those with the
--      WP8 screening appeals already in nw_screening_decisions: ONE operator
--      queue, two sources, no duplicated appeal state.
--   8. Immutable audit. nw_console_audit is hash-chained (prev_hash + payload
--      hash + row hash over octet-length-prefixed fields), append-only by
--      trigger, verifiable in SQL and in TypeScript from the same canonical
--      bytes, and exportable as a self-verifying JSON document.
--
-- Append-only migration. Nothing from 20260703* .. 20260730000009 is dropped or
-- redefined; the existing enforcement RPCs stay the single implementation of what
-- each action does to content, and the RPCs added here call them.

-- ============================================================ optimistic version

-- One trigger function, attached to every console-facing queue table. Bumping in
-- a BEFORE UPDATE trigger means an enforcement path cannot forget to bump: any
-- update through any code path moves the version.
create or replace function public.nw_console_bump_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.console_version := coalesce(old.console_version, 1) + 1;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'nw_reports',
    'nw_ncii_cases',
    'nw_dmca_notices',
    'nw_dmca_counter_notices',
    'nw_screening_decisions',
    'nw_journalist_verifications',
    'nw_payout_accounts'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists console_version integer not null default 1',
      v_table
    );
    execute format('drop trigger if exists %I on public.%I', v_table || '_console_version', v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.nw_console_bump_version()',
      v_table || '_console_version',
      v_table
    );
  end loop;
end;
$$;

-- The sentinel a permanent suspension writes. nw_moderate_suspend_profile treats
-- a null `until` as LIFTING the ban, so a permanent suspension must be a real
-- far-future timestamp. Twin of PERMANENT_ISO in
-- apps/mynews-console/lib/moderation.ts, pinned by a drift test.
create or replace function public.nw_console_permanent_until()
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select '2999-12-31T23:59:59.000Z'::timestamptz;
$$;

revoke all on function public.nw_console_permanent_until() from public, anon, authenticated;
grant execute on function public.nw_console_permanent_until() to service_role;

-- ============================================================ RBAC

-- moderator_ref is the lowercased email the console already audits with, so a
-- role row and an audit row name the same principal. RLS on with zero policies:
-- anon and authenticated cannot read or write roles at all, and the service role
-- reaches them only through the RPCs below.
create table if not exists public.nw_moderator_roles (
  moderator_ref text primary key check (
    moderator_ref = lower(btrim(moderator_ref))
    and position('@' in moderator_ref) > 1
    and char_length(moderator_ref) between 3 and 320
  ),
  role text not null check (role in ('admin', 'senior', 'reviewer')),
  is_active boolean not null default true,
  granted_by text,
  granted_at timestamptz not null default now(),
  revoked_by text,
  revoked_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.nw_moderator_roles enable row level security;
revoke all on table public.nw_moderator_roles from public, anon, authenticated;

create index if not exists idx_nw_moderator_roles_active
  on public.nw_moderator_roles (role)
  where is_active;

-- Numeric ladder so a check is a comparison, not a set membership test that
-- forgets a role. 0 means "no role", which is what an unknown or deactivated
-- moderator gets: the console then refuses every action.
create or replace function public.nw_moderator_role_rank(p_role text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'admin' then 3
    when 'senior' then 2
    when 'reviewer' then 1
    else 0
  end;
$$;

revoke all on function public.nw_moderator_role_rank(text) from public, anon, authenticated;
grant execute on function public.nw_moderator_role_rank(text) to service_role;

-- The active role of one moderator, or null. Definer so it can read the
-- zero-policy table.
create or replace function public.nw_moderator_role(p_ref text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.nw_moderator_roles
  where moderator_ref = lower(btrim(coalesce(p_ref, '')))
    and is_active;
$$;

revoke all on function public.nw_moderator_role(text) from public, anon, authenticated;
grant execute on function public.nw_moderator_role(text) to service_role;

create or replace function public.nw_moderator_role_level(p_ref text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.nw_moderator_role_rank(coalesce(public.nw_moderator_role(p_ref), 'none'));
$$;

revoke all on function public.nw_moderator_role_level(text) from public, anon, authenticated;
grant execute on function public.nw_moderator_role_level(text) to service_role;

-- Admin bootstrap. Succeeds only while no active admin exists, so founder-ops
-- can seed the first admin once and the same call can never be replayed to mint
-- a second one. Documented in apps/mynews-console/README.md.
create or replace function public.nw_moderator_bootstrap_admin(
  p_ref text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := lower(btrim(coalesce(p_ref, '')));
  v_existing integer;
begin
  if v_ref = '' or position('@' in v_ref) < 2 then
    return jsonb_build_object('ok', false, 'code', 'bad-ref');
  end if;
  select count(*) into v_existing
  from public.nw_moderator_roles
  where role = 'admin' and is_active;
  if v_existing > 0 then
    return jsonb_build_object('ok', false, 'code', 'admin-exists');
  end if;

  insert into public.nw_moderator_roles (moderator_ref, role, granted_by, note)
  values (v_ref, 'admin', 'bootstrap', coalesce(p_note, ''))
  on conflict (moderator_ref) do update
    set role = 'admin',
        is_active = true,
        granted_by = 'bootstrap',
        granted_at = now(),
        revoked_by = null,
        revoked_at = null,
        note = coalesce(excluded.note, ''),
        updated_at = now();

  perform public.nw_console_audit_append(
    v_ref, 'admin', 'role_bootstrap', 'moderator', v_ref, 'ok',
    coalesce(p_note, 'first admin bootstrap'),
    jsonb_build_object('role', 'admin'), null
  );
  return jsonb_build_object('ok', true, 'code', 'bootstrapped');
end;
$$;

revoke all on function public.nw_moderator_bootstrap_admin(text, text)
  from public, anon, authenticated;
grant execute on function public.nw_moderator_bootstrap_admin(text, text) to service_role;

-- Grant or change a role. Admin-only, and the last active admin cannot be
-- demoted or deactivated: an empty admin set would leave the console with no way
-- to grant roles again except another bootstrap.
create or replace function public.nw_moderator_role_grant(
  p_actor_ref text,
  p_target_ref text,
  p_role text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_target text := lower(btrim(coalesce(p_target_ref, '')));
  v_prev text;
  v_admins integer;
begin
  if public.nw_moderator_role(v_actor) is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'code', 'not-admin');
  end if;
  if v_target = '' or position('@' in v_target) < 2 then
    return jsonb_build_object('ok', false, 'code', 'bad-ref');
  end if;
  if public.nw_moderator_role_rank(p_role) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad-role');
  end if;

  v_prev := public.nw_moderator_role(v_target);
  if v_prev = 'admin' and p_role <> 'admin' then
    select count(*) into v_admins
    from public.nw_moderator_roles
    where role = 'admin' and is_active;
    if v_admins <= 1 then
      return jsonb_build_object('ok', false, 'code', 'last-admin');
    end if;
  end if;

  insert into public.nw_moderator_roles (moderator_ref, role, granted_by, note)
  values (v_target, p_role, v_actor, coalesce(p_note, ''))
  on conflict (moderator_ref) do update
    set role = p_role,
        is_active = true,
        granted_by = v_actor,
        granted_at = now(),
        revoked_by = null,
        revoked_at = null,
        note = coalesce(excluded.note, ''),
        updated_at = now();

  perform public.nw_console_audit_append(
    v_actor, 'admin', 'role_grant', 'moderator', v_target, 'ok',
    coalesce(p_note, ''),
    jsonb_build_object('role', p_role, 'previousRole', v_prev), null
  );
  return jsonb_build_object('ok', true, 'code', 'granted', 'previousRole', v_prev);
end;
$$;

revoke all on function public.nw_moderator_role_grant(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_moderator_role_grant(text, text, text, text) to service_role;

-- Deactivate a role. The row is kept (an access review needs the history) and
-- the last active admin is protected for the same reason as above.
create or replace function public.nw_moderator_role_revoke(
  p_actor_ref text,
  p_target_ref text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_target text := lower(btrim(coalesce(p_target_ref, '')));
  v_prev text;
  v_admins integer;
begin
  if public.nw_moderator_role(v_actor) is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'code', 'not-admin');
  end if;
  v_prev := public.nw_moderator_role(v_target);
  if v_prev is null then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if v_prev = 'admin' then
    select count(*) into v_admins
    from public.nw_moderator_roles
    where role = 'admin' and is_active;
    if v_admins <= 1 then
      return jsonb_build_object('ok', false, 'code', 'last-admin');
    end if;
  end if;

  update public.nw_moderator_roles
    set is_active = false,
        revoked_by = v_actor,
        revoked_at = now(),
        note = coalesce(p_note, note),
        updated_at = now()
    where moderator_ref = v_target;

  perform public.nw_console_audit_append(
    v_actor, 'admin', 'role_revoke', 'moderator', v_target, 'ok',
    coalesce(p_note, ''),
    jsonb_build_object('previousRole', v_prev), null
  );
  return jsonb_build_object('ok', true, 'code', 'revoked', 'previousRole', v_prev);
end;
$$;

revoke all on function public.nw_moderator_role_revoke(text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_moderator_role_revoke(text, text, text) to service_role;

-- Access review read: every role row including deactivated ones.
create or replace function public.nw_moderator_roles_list()
returns table (
  moderator_ref text,
  role text,
  is_active boolean,
  granted_by text,
  granted_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select moderator_ref, role, is_active, granted_by, granted_at, revoked_by, revoked_at, note
  from public.nw_moderator_roles
  order by is_active desc, public.nw_moderator_role_rank(role) desc, moderator_ref;
$$;

revoke all on function public.nw_moderator_roles_list() from public, anon, authenticated;
grant execute on function public.nw_moderator_roles_list() to service_role;

-- ============================================================ immutable audit

-- Hash-chained console audit. Distinct from nw_moderation_actions, which is the
-- user-facing statement-of-reasons feed: this table records WHO in the console
-- did WHAT, including refusals, failures, role changes, and approvals, and it is
-- append-only and tamper-evident.
create table if not exists public.nw_console_audit (
  seq bigserial primary key,
  actor_ref text not null,
  actor_role text not null,
  action text not null,
  target_kind text not null,
  target_id text not null,
  outcome text not null,
  reason text not null default '',
  payload jsonb not null default '{}',
  action_token text,
  /* Exact UTC rendering of created_at that the row hash was computed over, so a
     verifier never has to reproduce timestamp formatting. */
  created_at_canonical text not null default '',
  payload_hash text not null default '',
  prev_hash text not null default '',
  row_hash text not null default '',
  created_at timestamptz not null default now()
);
alter table public.nw_console_audit enable row level security;
revoke all on table public.nw_console_audit from public, anon, authenticated;

create index if not exists idx_nw_console_audit_actor
  on public.nw_console_audit (actor_ref, seq desc);
create index if not exists idx_nw_console_audit_target
  on public.nw_console_audit (target_kind, target_id, seq desc);
create index if not exists idx_nw_console_audit_action
  on public.nw_console_audit (action, seq desc);

-- Octet-length-prefixed field encoding. Free text (reason, target ids) can
-- contain any byte including the separator, so each field is prefixed with its
-- byte length: no two distinct field tuples can produce the same canonical
-- string. The TypeScript verifier (apps/mynews-console/lib/audit-chain.ts) uses
-- the same encoding, and a drift test pins the two together.
create or replace function public.nw_console_audit_segment(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select octet_length(coalesce(p_value, '')) || ':' || coalesce(p_value, '');
$$;

revoke all on function public.nw_console_audit_segment(text) from public, anon, authenticated;
grant execute on function public.nw_console_audit_segment(text) to service_role;

create or replace function public.nw_console_audit_row_hash(
  p_prev_hash text,
  p_seq bigint,
  p_created_at_canonical text,
  p_actor_ref text,
  p_actor_role text,
  p_action text,
  p_target_kind text,
  p_target_id text,
  p_outcome text,
  p_reason text,
  p_payload_hash text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    sha256(
      convert_to(
        public.nw_console_audit_segment(p_prev_hash)
          || public.nw_console_audit_segment(p_seq::text)
          || public.nw_console_audit_segment(p_created_at_canonical)
          || public.nw_console_audit_segment(p_actor_ref)
          || public.nw_console_audit_segment(p_actor_role)
          || public.nw_console_audit_segment(p_action)
          || public.nw_console_audit_segment(p_target_kind)
          || public.nw_console_audit_segment(p_target_id)
          || public.nw_console_audit_segment(p_outcome)
          || public.nw_console_audit_segment(p_reason)
          || public.nw_console_audit_segment(p_payload_hash),
        'utf8'
      )
    ),
    'hex'
  );
$$;

revoke all on function public.nw_console_audit_row_hash(
  text, bigint, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.nw_console_audit_row_hash(
  text, bigint, text, text, text, text, text, text, text, text, text
) to service_role;

-- Seal an incoming row into the chain. The advisory lock serializes appends so
-- two concurrent writers cannot both read the same tail and fork the chain; it
-- is transaction-scoped, so it releases on commit or rollback.
create or replace function public.nw_console_audit_seal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prev text;
begin
  perform pg_advisory_xact_lock(7724010);
  select row_hash into v_prev
  from public.nw_console_audit
  order by seq desc
  limit 1;
  new.prev_hash := coalesce(v_prev, repeat('0', 64));
  new.created_at := coalesce(new.created_at, now());
  new.created_at_canonical := to_char(
    new.created_at at time zone 'utc',
    'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  );
  new.payload := coalesce(new.payload, '{}'::jsonb);
  new.payload_hash := encode(sha256(convert_to(new.payload::text, 'utf8')), 'hex');
  new.row_hash := public.nw_console_audit_row_hash(
    new.prev_hash,
    new.seq,
    new.created_at_canonical,
    new.actor_ref,
    new.actor_role,
    new.action,
    new.target_kind,
    new.target_id,
    new.outcome,
    coalesce(new.reason, ''),
    new.payload_hash
  );
  return new;
end;
$$;

drop trigger if exists nw_console_audit_seal on public.nw_console_audit;
create trigger nw_console_audit_seal
  before insert on public.nw_console_audit
  for each row execute function public.nw_console_audit_seal();

-- Append-only enforcement. Even the table owner's UPDATE/DELETE/TRUNCATE are
-- refused, so a tampered row has to be a direct catalog attack rather than a
-- stray statement, and the hash chain catches that too.
create or replace function public.nw_console_audit_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'nw_console_audit is append-only (attempted %)', tg_op;
end;
$$;

drop trigger if exists nw_console_audit_no_update on public.nw_console_audit;
create trigger nw_console_audit_no_update
  before update or delete on public.nw_console_audit
  for each row execute function public.nw_console_audit_immutable();

drop trigger if exists nw_console_audit_no_truncate on public.nw_console_audit;
create trigger nw_console_audit_no_truncate
  before truncate on public.nw_console_audit
  for each statement execute function public.nw_console_audit_immutable();

-- The single audit writer. Every console RPC below calls this; nothing writes
-- nw_console_audit directly.
create or replace function public.nw_console_audit_append(
  p_actor_ref text,
  p_actor_role text,
  p_action text,
  p_target_kind text,
  p_target_id text,
  p_outcome text,
  p_reason text,
  p_payload jsonb default '{}',
  p_action_token text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
begin
  insert into public.nw_console_audit
    (actor_ref, actor_role, action, target_kind, target_id, outcome, reason, payload, action_token)
  values
    (
      lower(btrim(coalesce(p_actor_ref, ''))),
      coalesce(nullif(btrim(p_actor_role), ''), 'none'),
      p_action,
      p_target_kind,
      coalesce(p_target_id, ''),
      p_outcome,
      coalesce(p_reason, ''),
      coalesce(p_payload, '{}'::jsonb),
      p_action_token
    )
  returning seq into v_seq;
  return v_seq;
end;
$$;

revoke all on function public.nw_console_audit_append(
  text, text, text, text, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.nw_console_audit_append(
  text, text, text, text, text, text, text, jsonb, text
) to service_role;

-- Walk the chain and recompute every hash. Anchors on the row before p_from so a
-- windowed verification still checks the incoming link.
create or replace function public.nw_console_audit_verify(
  p_from bigint default 0,
  p_limit integer default 100000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_expected_prev text;
  v_computed text;
  v_payload_hash text;
  v_checked integer := 0;
  v_first bigint;
  v_last bigint;
begin
  select row_hash into v_expected_prev
  from public.nw_console_audit
  where seq < greatest(p_from, 0)
  order by seq desc
  limit 1;
  v_expected_prev := coalesce(v_expected_prev, repeat('0', 64));

  for v_row in
    select * from public.nw_console_audit
    where seq >= greatest(p_from, 0)
    order by seq
    limit greatest(coalesce(p_limit, 1), 1)
  loop
    if v_row.prev_hash <> v_expected_prev then
      return jsonb_build_object(
        'ok', false, 'badSeq', v_row.seq, 'reason', 'prev-hash', 'checked', v_checked
      );
    end if;
    v_payload_hash := encode(sha256(convert_to(v_row.payload::text, 'utf8')), 'hex');
    if v_payload_hash <> v_row.payload_hash then
      return jsonb_build_object(
        'ok', false, 'badSeq', v_row.seq, 'reason', 'payload-hash', 'checked', v_checked
      );
    end if;
    v_computed := public.nw_console_audit_row_hash(
      v_row.prev_hash, v_row.seq, v_row.created_at_canonical, v_row.actor_ref,
      v_row.actor_role, v_row.action, v_row.target_kind, v_row.target_id,
      v_row.outcome, v_row.reason, v_row.payload_hash
    );
    if v_computed <> v_row.row_hash then
      return jsonb_build_object(
        'ok', false, 'badSeq', v_row.seq, 'reason', 'row-hash', 'checked', v_checked
      );
    end if;
    if v_first is null then v_first := v_row.seq; end if;
    v_last := v_row.seq;
    v_expected_prev := v_row.row_hash;
    v_checked := v_checked + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'checked', v_checked,
    'firstSeq', v_first,
    'lastSeq', v_last,
    'head', case when v_checked = 0 then null else v_expected_prev end
  );
end;
$$;

revoke all on function public.nw_console_audit_verify(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.nw_console_audit_verify(bigint, integer) to service_role;

-- Export a verifiable window. payloadText is the exact jsonb rendering the
-- payload hash was taken over, so an offline verifier reproduces every hash from
-- the export alone with no knowledge of Postgres jsonb formatting.
create or replace function public.nw_console_audit_export(
  p_from bigint default 0,
  p_limit integer default 5000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_json order by seq), '[]'::jsonb) into v_rows
  from (
    select
      seq,
      jsonb_build_object(
        'seq', seq,
        'createdAtCanonical', created_at_canonical,
        'actorRef', actor_ref,
        'actorRole', actor_role,
        'action', action,
        'targetKind', target_kind,
        'targetId', target_id,
        'outcome', outcome,
        'reason', reason,
        'payloadText', payload::text,
        'payloadHash', payload_hash,
        'prevHash', prev_hash,
        'rowHash', row_hash,
        'actionToken', action_token
      ) as row_json
    from public.nw_console_audit
    where seq >= greatest(p_from, 0)
    order by seq
    limit greatest(coalesce(p_limit, 1), 1)
  ) exported;

  return jsonb_build_object(
    'chain', 'nw_console_audit',
    'hashAlgorithm', 'sha256',
    'encoding', 'octet-length-prefixed',
    'genesisPrevHash', repeat('0', 64),
    'exportedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'fromSeq', greatest(p_from, 0),
    'anchorPrevHash', coalesce(
      (
        select row_hash from public.nw_console_audit
        where seq < greatest(p_from, 0) order by seq desc limit 1
      ),
      repeat('0', 64)
    ),
    'sqlVerification', public.nw_console_audit_verify(p_from, p_limit),
    'rows', v_rows
  );
end;
$$;

revoke all on function public.nw_console_audit_export(bigint, integer)
  from public, anon, authenticated;
grant execute on function public.nw_console_audit_export(bigint, integer) to service_role;

-- ============================================================ replay tokens

-- One row per console form submission. The claim happens inside the enforcement
-- transaction: if the action rolls back, the claim rolls back with it and the
-- moderator can retry, but a duplicate POST of a committed action is refused.
create table if not exists public.nw_console_action_tokens (
  token text primary key check (char_length(token) between 8 and 200),
  actor_ref text not null,
  action text not null,
  result jsonb,
  claimed_at timestamptz not null default now()
);
alter table public.nw_console_action_tokens enable row level security;
revoke all on table public.nw_console_action_tokens from public, anon, authenticated;

create index if not exists idx_nw_console_action_tokens_claimed
  on public.nw_console_action_tokens (claimed_at);

-- Claim a token. Returns null when the claim succeeded, or the previous result
-- (possibly 'null'::jsonb) when the token was already used.
create or replace function public.nw_console_claim_token(
  p_token text,
  p_actor_ref text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_prior jsonb;
begin
  insert into public.nw_console_action_tokens (token, actor_ref, action)
  values (p_token, lower(btrim(coalesce(p_actor_ref, ''))), p_action)
  on conflict (token) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return null;
  end if;
  select coalesce(result, jsonb_build_object('ok', false, 'code', 'in-flight')) into v_prior
  from public.nw_console_action_tokens
  where token = p_token;
  return coalesce(v_prior, jsonb_build_object('ok', false, 'code', 'in-flight'));
end;
$$;

revoke all on function public.nw_console_claim_token(text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_claim_token(text, text, text) to service_role;

create or replace function public.nw_console_record_token_result(
  p_token text,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.nw_console_action_tokens
    set result = p_result
    where token = p_token;
$$;

revoke all on function public.nw_console_record_token_result(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_console_record_token_result(text, jsonb) to service_role;

-- Bounded retention: the token table is a replay guard, not a record. Old rows
-- are dropped once no browser could still be holding that form.
create or replace function public.nw_console_gc_action_tokens(p_older_than interval default interval '30 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.nw_console_action_tokens
  where claimed_at < now() - coalesce(p_older_than, interval '30 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.nw_console_gc_action_tokens(interval)
  from public, anon, authenticated;
grant execute on function public.nw_console_gc_action_tokens(interval) to service_role;

-- ============================================================ dual control

-- Actions that one moderator must never complete alone. Every kind here has a
-- real executor in nw_console_pending_execute; nothing is reserved for later.
create table if not exists public.nw_pending_actions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('suspend_long', 'terminate_account', 'restore_content', 'payout_block', 'payout_unblock')
  ),
  target_kind text not null check (
    target_kind in ('profile', 'article', 'suggestion', 'dmca_notice', 'dmca_counter', 'payout_account')
  ),
  target_id text not null,
  /* Enforcement parameters resolved at PROPOSE time (suspension end date, notice
     kind, report id). The approver approves exactly what was proposed. */
  params jsonb not null default '{}',
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 2000),
  report_id uuid references public.nw_reports (id) on delete set null,
  proposed_by text not null,
  proposed_role text not null,
  proposed_at timestamptz not null default now(),
  /* The target's console_version at propose time, so an approval cannot land on
     a row that moved underneath the proposal. */
  target_version integer,
  state text not null default 'pending' check (
    state in ('pending', 'approved', 'rejected', 'cancelled', 'expired', 'failed')
  ),
  decided_by text,
  decided_role text,
  decided_at timestamptz,
  decision_reason text not null default '',
  executed_at timestamptz,
  execution_outcome text,
  expires_at timestamptz not null,
  /* Second-moderator rule, enforced by the database rather than by the UI: the
     proposer's ref can never appear as the decider's ref. */
  constraint nw_pending_actions_second_moderator check (
    decided_by is null or lower(btrim(decided_by)) <> lower(btrim(proposed_by))
  )
);
alter table public.nw_pending_actions enable row level security;
revoke all on table public.nw_pending_actions from public, anon, authenticated;

create index if not exists idx_nw_pending_actions_open
  on public.nw_pending_actions (proposed_at)
  where state = 'pending';
create index if not exists idx_nw_pending_actions_target
  on public.nw_pending_actions (target_kind, target_id, proposed_at desc);

-- Approval role floor per kind. Terminations and payment-adjacent actions are
-- admin-approved; the rest need a senior.
create or replace function public.nw_pending_action_min_level(p_kind text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'terminate_account' then 3
    when 'payout_block' then 3
    when 'payout_unblock' then 3
    else 2
  end;
$$;

revoke all on function public.nw_pending_action_min_level(text) from public, anon, authenticated;
grant execute on function public.nw_pending_action_min_level(text) to service_role;

-- Expire stale proposals so an unreviewed high-impact action does not sit
-- approvable forever.
create or replace function public.nw_console_expire_pending_actions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.nw_pending_actions
    set state = 'expired'
    where state = 'pending' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.nw_console_expire_pending_actions()
  from public, anon, authenticated;
grant execute on function public.nw_console_expire_pending_actions() to service_role;

-- ============================================================ assignment

create table if not exists public.nw_queue_assignments (
  queue text not null check (
    queue in ('report', 'ncii', 'dmca', 'screening', 'verification', 'appeal', 'pending_action')
  ),
  item_id text not null,
  assignee_ref text,
  assigned_by text,
  assigned_at timestamptz,
  escalation_level text not null default 'none' check (
    escalation_level in ('none', 'senior', 'admin')
  ),
  escalation_reason text not null default '',
  escalated_by text,
  escalated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (queue, item_id)
);
alter table public.nw_queue_assignments enable row level security;
revoke all on table public.nw_queue_assignments from public, anon, authenticated;

create index if not exists idx_nw_queue_assignments_assignee
  on public.nw_queue_assignments (assignee_ref, queue);
create index if not exists idx_nw_queue_assignments_escalated
  on public.nw_queue_assignments (queue, escalation_level)
  where escalation_level <> 'none';

-- Claim, reassign, or release a queue item. Reassigning someone else's item
-- needs senior: a reviewer can claim free work and drop their own, not take work
-- off a colleague.
create or replace function public.nw_console_assign(
  p_actor_ref text,
  p_queue text,
  p_item_id text,
  p_assignee_ref text,
  p_action_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_assignee text := nullif(lower(btrim(coalesce(p_assignee_ref, ''))), '');
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_current text;
begin
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if p_queue is null or btrim(p_queue) = '' or p_item_id is null or btrim(p_item_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'bad-input');
  end if;
  if v_assignee is not null and public.nw_moderator_role_level(v_assignee) < 1 then
    return jsonb_build_object('ok', false, 'code', 'assignee-no-role');
  end if;

  select assignee_ref into v_current
  from public.nw_queue_assignments
  where queue = p_queue and item_id = p_item_id
  for update;

  if v_current is not null and v_current <> v_actor and v_level < 2 then
    return jsonb_build_object('ok', false, 'code', 'assigned-elsewhere');
  end if;

  insert into public.nw_queue_assignments (queue, item_id, assignee_ref, assigned_by, assigned_at)
  values (p_queue, p_item_id, v_assignee, v_actor, now())
  on conflict (queue, item_id) do update
    set assignee_ref = v_assignee,
        assigned_by = v_actor,
        assigned_at = now(),
        updated_at = now();

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'),
    case when v_assignee is null then 'queue_unassign' else 'queue_assign' end,
    p_queue, p_item_id, 'ok', '',
    jsonb_build_object('assignee', v_assignee, 'previousAssignee', v_current),
    p_action_token
  );
  return jsonb_build_object('ok', true, 'code', 'assigned', 'assignee', v_assignee);
end;
$$;

revoke all on function public.nw_console_assign(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_assign(text, text, text, text, text) to service_role;

create or replace function public.nw_console_escalate(
  p_actor_ref text,
  p_queue text,
  p_item_id text,
  p_level text,
  p_reason text,
  p_action_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
begin
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if p_level not in ('none', 'senior', 'admin') then
    return jsonb_build_object('ok', false, 'code', 'bad-level');
  end if;
  if p_level <> 'none' and (p_reason is null or btrim(p_reason) = '') then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  -- Clearing an escalation is a senior call: whoever escalated wanted eyes on it.
  if p_level = 'none' and v_level < 2 then
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;

  insert into public.nw_queue_assignments (queue, item_id, escalation_level, escalation_reason, escalated_by, escalated_at)
  values (p_queue, p_item_id, p_level, coalesce(p_reason, ''), v_actor, now())
  on conflict (queue, item_id) do update
    set escalation_level = p_level,
        escalation_reason = coalesce(p_reason, ''),
        escalated_by = v_actor,
        escalated_at = now(),
        updated_at = now();

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), 'queue_escalate', p_queue, p_item_id, 'ok',
    coalesce(p_reason, ''), jsonb_build_object('level', p_level), p_action_token
  );
  return jsonb_build_object('ok', true, 'code', 'escalated', 'level', p_level);
end;
$$;

revoke all on function public.nw_console_escalate(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_escalate(text, text, text, text, text, text) to service_role;

-- ============================================================ user appeals

-- Ownership predicate for an appeal, mirroring the three branches
-- nw_get_my_moderation_notices uses (article/revision author, suggestion editor,
-- own profile). Pinned to that RPC by a drift test.
create or replace function public.nw_moderation_action_is_owned(
  p_target_kind text,
  p_target_id text,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_target_kind in ('article', 'revision') then exists (
      select 1 from public.nw_articles a
      where a.id::text = p_target_id and a.author_id = p_profile_id
    )
    when p_target_kind = 'suggestion' then exists (
      select 1 from public.nw_edit_suggestions s
      where s.id::text = p_target_id and s.editor_id = p_profile_id
    )
    when p_target_kind = 'profile' then p_target_id = p_profile_id::text
    else false
  end;
$$;

revoke all on function public.nw_moderation_action_is_owned(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.nw_moderation_action_is_owned(text, text, uuid) to service_role;

create table if not exists public.nw_moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.nw_moderation_actions (id) on delete cascade,
  appellant_profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  reason text not null check (btrim(reason) <> '' and char_length(reason) <= 2000),
  state text not null default 'requested' check (
    state in ('requested', 'granted', 'denied')
  ),
  reviewer_ref text,
  decision_reason text not null default '',
  decided_at timestamptz,
  /* Reversal outcome when an appeal is granted, so a granted appeal that could
     not restore the content says so instead of implying it did. */
  reversal_outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  console_version integer not null default 1,
  constraint nw_moderation_appeals_one_per_action unique (action_id, appellant_profile_id)
);
alter table public.nw_moderation_appeals enable row level security;
revoke all on table public.nw_moderation_appeals from public, anon, authenticated;

create index if not exists idx_nw_moderation_appeals_open
  on public.nw_moderation_appeals (created_at)
  where state = 'requested';
create index if not exists idx_nw_moderation_appeals_appellant
  on public.nw_moderation_appeals (appellant_profile_id, created_at desc);

drop trigger if exists nw_moderation_appeals_console_version on public.nw_moderation_appeals;
create trigger nw_moderation_appeals_console_version
  before update on public.nw_moderation_appeals
  for each row execute function public.nw_console_bump_version();

-- File an appeal against one adverse action on the caller's own content. The
-- same 'not-found' answer covers a missing action and someone else's, so this
-- cannot be used to probe which action ids exist.
create or replace function public.nw_moderation_appeal_request(
  p_action_id uuid,
  p_profile_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_id text;
  v_action text;
begin
  if p_reason is null or btrim(p_reason) = '' or char_length(p_reason) > 2000 then
    return 'bad-reason';
  end if;

  select target_kind, target_id, action into v_kind, v_id, v_action
  from public.nw_moderation_actions
  where id = p_action_id;
  if v_kind is null then
    return 'not-found';
  end if;
  -- 'dismiss' and 'restore' are not adverse actions against the user, and the
  -- statement-of-reasons feed does not show them, so they are not appealable.
  if v_action in ('dismiss', 'restore') then
    return 'not-appealable';
  end if;
  if not public.nw_moderation_action_is_owned(v_kind, v_id, p_profile_id) then
    return 'not-found';
  end if;

  insert into public.nw_moderation_appeals (action_id, appellant_profile_id, reason)
  values (p_action_id, p_profile_id, btrim(p_reason))
  on conflict (action_id, appellant_profile_id) do nothing;
  if not found then
    return 'already-appealed';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.nw_moderation_appeal_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.nw_moderation_appeal_request(uuid, uuid, text) to service_role;

-- The caller's own appeals, keyed on the verified JWT subject.
create or replace function public.nw_get_my_moderation_appeals(p_user uuid)
returns table (
  id uuid,
  action_id uuid,
  state text,
  reason text,
  decision_reason text,
  reversal_outcome text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.action_id, a.state, a.reason, a.decision_reason, a.reversal_outcome,
         a.created_at, a.decided_at
  from public.nw_moderation_appeals a
  join public.nw_profiles p on p.id = a.appellant_profile_id
  where p.user_id = p_user
  order by a.created_at desc;
$$;

revoke all on function public.nw_get_my_moderation_appeals(uuid)
  from public, anon, authenticated;
grant execute on function public.nw_get_my_moderation_appeals(uuid) to service_role;

-- Statement of reasons including the action id and appeal state, so the app can
-- show an appeal affordance and its outcome on the same card. The v1 RPC stays
-- exactly as it was for any caller that still uses it; this is the superset.
create or replace function public.nw_get_my_moderation_notices_v2(p_user uuid)
returns table (
  action_id uuid,
  target_kind text,
  target_id text,
  machine_reason text,
  note text,
  created_at timestamptz,
  appeal_state text,
  appeal_reason text,
  appeal_decision_reason text,
  appeal_reversal_outcome text,
  appeal_decided_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ma.id as action_id,
    ma.target_kind,
    ma.target_id,
    ma.action as machine_reason,
    ma.note,
    ma.created_at,
    coalesce(ap.state, 'none') as appeal_state,
    coalesce(ap.reason, '') as appeal_reason,
    coalesce(ap.decision_reason, '') as appeal_decision_reason,
    ap.reversal_outcome as appeal_reversal_outcome,
    ap.decided_at as appeal_decided_at
  from public.nw_moderation_actions ma
  join public.nw_profiles owner on owner.user_id = p_user
    and public.nw_moderation_action_is_owned(ma.target_kind, ma.target_id, owner.id)
  left join public.nw_moderation_appeals ap
    on ap.action_id = ma.id and ap.appellant_profile_id = owner.id
  where ma.action not in ('dismiss', 'restore')
  order by ma.created_at desc;
$$;

revoke all on function public.nw_get_my_moderation_notices_v2(uuid)
  from public, anon, authenticated;
grant execute on function public.nw_get_my_moderation_notices_v2(uuid) to service_role;

-- One operator appeals queue over two sources: moderation-action appeals filed
-- here, and the WP8 screening appeals that already live on the decision row. The
-- console reads this view and dispatches each disposition back to the source's
-- own RPC, so screening appeal state is never duplicated.
create or replace view public.nw_console_appeals as
select
  'moderation'::text as source,
  a.id::text as appeal_id,
  a.state,
  a.reason as appeal_reason,
  a.created_at,
  a.console_version,
  ma.action as subject_action,
  ma.target_kind,
  ma.target_id,
  ma.note as subject_note,
  ma.moderator_ref as decided_against_by,
  a.appellant_profile_id as appellant_profile_id,
  a.reviewer_ref,
  a.decided_at,
  a.decision_reason
from public.nw_moderation_appeals a
join public.nw_moderation_actions ma on ma.id = a.action_id
union all
select
  'screening'::text as source,
  d.id::text as appeal_id,
  d.appeal_state as state,
  d.appeal_reason,
  d.created_at,
  d.console_version,
  ('screening_' || d.auto_action)::text as subject_action,
  d.content_kind as target_kind,
  d.content_id as target_id,
  d.review_reason as subject_note,
  d.reviewer_ref as decided_against_by,
  d.author_profile_id as appellant_profile_id,
  d.appeal_reviewer_ref as reviewer_ref,
  d.appeal_decided_at as decided_at,
  ''::text as decision_reason
from public.nw_screening_decisions d
where d.appeal_state <> 'none';

revoke all on public.nw_console_appeals from public, anon, authenticated;
grant select on public.nw_console_appeals to service_role;

-- ============================================================ shared guards

-- Reason floor shared by every console RPC. A destructive action without a
-- recorded reason is not auditable, so it is refused before anything happens.
create or replace function public.nw_console_reason_ok(p_reason text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_reason is not null
    and btrim(p_reason) <> ''
    and char_length(p_reason) <= 2000;
$$;

revoke all on function public.nw_console_reason_ok(text) from public, anon, authenticated;
grant execute on function public.nw_console_reason_ok(text) to service_role;

-- Minimum role level per console action. One definition, read by both the SQL
-- RPCs and (via a drift test) the console's TypeScript policy module.
create or replace function public.nw_console_action_min_level(p_action text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_action
    -- reviewer: content decisions that are reversible and per-item
    when 'hide_article' then 1
    when 'hide_suggestion' then 1
    when 'dismiss' then 1
    when 'screening_approve' then 1
    when 'screening_reject' then 1
    when 'ncii_ensure_removed' then 1
    when 'ncii_escalate' then 1
    when 'verification_approve' then 1
    when 'verification_deny' then 1
    when 'dmca_assign' then 1
    when 'dmca_add_note' then 1
    when 'dmca_acknowledge' then 1
    when 'dmca_forward' then 1
    when 'dmca_resolve_url' then 1
    when 'dmca_link_original' then 1
    when 'dmca_unlink_original' then 1
    when 'dmca_forward_to_claimant' then 1
    -- senior: account-level enforcement, peer review, legal posture
    when 'suspend_profile' then 2
    when 'strike_author' then 2
    when 'ncii_clear' then 2
    when 'verification_revoke' then 2
    when 'appeal_grant' then 2
    when 'appeal_deny' then 2
    when 'dmca_close' then 2
    when 'dmca_link_strike' then 2
    when 'dmca_litigation_hold' then 2
    when 'dmca_start_waiting_period' then 2
    when 'dmca_restore_content' then 2
    when 'propose_pending' then 2
    -- admin: who moderates, and money
    when 'role_grant' then 3
    when 'role_revoke' then 3
    when 'payout_block' then 3
    when 'payout_unblock' then 3
    when 'audit_export' then 3
    else 3
  end;
$$;

revoke all on function public.nw_console_action_min_level(text) from public, anon, authenticated;
grant execute on function public.nw_console_action_min_level(text) to service_role;

-- ============================================================ report queue

-- The whole report-queue enforcement path in ONE transaction with a version
-- check. hide + strike + resolve either all land or none do: the inner block
-- rolls back on the first failing step and the function still returns a typed
-- result (and audits the failure, after the rollback).
create or replace function public.nw_console_enforce_report(
  p_report_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_action text,
  p_reason text,
  p_action_token text,
  p_params jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_status text;
  v_kind text;
  v_target text;
  v_author uuid;
  v_step text;
  v_failed text;
  v_until timestamptz;
  v_permanent boolean := false;
  v_pending uuid;
  v_days numeric;
  v_code text;
begin
  if p_action not in ('hide_article', 'hide_suggestion', 'suspend_profile', 'strike_author', 'dismiss') then
    return jsonb_build_object('ok', false, 'code', 'bad-action');
  end if;
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  if v_level < public.nw_console_action_min_level(p_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), p_action, 'report', p_report_id::text,
      'refused:insufficient-role', p_reason, coalesce(p_params, '{}'::jsonb), p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, p_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select console_version, status, target_kind, target_id
    into v_version, v_status, v_kind, v_target
  from public.nw_reports
  where id = p_report_id
  for update;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object(
      'ok', false, 'code', 'stale-action', 'currentVersion', v_version
    );
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), p_action, 'report', p_report_id::text,
      'refused:stale-action', p_reason,
      jsonb_build_object('expectedVersion', p_expected_version, 'currentVersion', v_version),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_status <> 'open' then
    v_result := jsonb_build_object('ok', false, 'code', 'not-open');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  -- Target-kind gate. The enforcement target always comes from the report row,
  -- never from a form field, so a tampered hidden input cannot redirect it.
  if p_action in ('hide_article', 'strike_author') and v_kind not in ('article', 'revision') then
    v_result := jsonb_build_object('ok', false, 'code', 'wrong-target-kind');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_action = 'hide_suggestion' and v_kind <> 'suggestion' then
    v_result := jsonb_build_object('ok', false, 'code', 'wrong-target-kind');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_action = 'suspend_profile' and v_kind <> 'profile' then
    v_result := jsonb_build_object('ok', false, 'code', 'wrong-target-kind');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  -- Suspension length decides whether this is a one-moderator action at all.
  if p_action = 'suspend_profile' then
    v_permanent := coalesce(p_params->>'permanent', 'false') = 'true';
    if v_permanent then
      v_until := public.nw_console_permanent_until();
    else
      begin
        v_until := (p_params->>'until')::timestamptz;
      exception when others then
        v_until := null;
      end;
      if v_until is null then
        v_result := jsonb_build_object('ok', false, 'code', 'bad-suspension');
        perform public.nw_console_record_token_result(p_action_token, v_result);
        return v_result;
      end if;
      v_days := extract(epoch from (v_until - now())) / 86400.0;
      if v_days <= 0 then
        v_result := jsonb_build_object('ok', false, 'code', 'bad-suspension');
        perform public.nw_console_record_token_result(p_action_token, v_result);
        return v_result;
      end if;
    end if;

    -- Over 7 days, or permanent: dual control. The proposal captures the exact
    -- end date so the approver approves the same suspension that was proposed.
    if v_permanent or v_days > 7 then
      if v_level < public.nw_console_action_min_level('propose_pending') then
        v_result := jsonb_build_object('ok', false, 'code', 'insufficient-role');
        perform public.nw_console_record_token_result(p_action_token, v_result);
        return v_result;
      end if;
      insert into public.nw_pending_actions
        (kind, target_kind, target_id, params, reason, report_id, proposed_by, proposed_role,
         target_version, expires_at)
      values
        (
          case when v_permanent then 'terminate_account' else 'suspend_long' end,
          'profile', v_target,
          jsonb_build_object('until', v_until, 'permanent', v_permanent, 'reportId', p_report_id),
          btrim(p_reason), p_report_id, v_actor, v_role, v_version, now() + interval '7 days'
        )
      returning id into v_pending;
      perform public.nw_console_audit_append(
        v_actor, coalesce(v_role, 'none'), 'propose_pending', 'profile', v_target, 'ok', p_reason,
        jsonb_build_object(
          'pendingId', v_pending,
          'kind', case when v_permanent then 'terminate_account' else 'suspend_long' end,
          'reportId', p_report_id,
          'until', v_until
        ),
        p_action_token
      );
      v_result := jsonb_build_object(
        'ok', true, 'code', 'pending-approval', 'pendingId', v_pending
      );
      perform public.nw_console_record_token_result(p_action_token, v_result);
      return v_result;
    end if;
  end if;

  if p_action = 'strike_author' then
    select author_id into v_author from public.nw_articles where id = v_target::uuid;
    if v_author is null then
      v_result := jsonb_build_object('ok', false, 'code', 'not-found');
      perform public.nw_console_record_token_result(p_action_token, v_result);
      return v_result;
    end if;
  end if;

  -- One transaction, all steps. A failure inside this block rolls back every
  -- write it made (including writes made by the RPCs it calls) and reports the
  -- failing step's own code.
  begin
    if p_action = 'hide_article' then
      v_step := public.nw_moderate_hide_article(v_target::uuid, v_actor, btrim(p_reason), p_report_id);
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_step := public.nw_moderate_resolve_report(p_report_id, 'actioned', v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_code := 'article-hidden';

    elsif p_action = 'hide_suggestion' then
      v_step := public.nw_moderate_hide_suggestion(v_target::uuid, v_actor, btrim(p_reason), p_report_id);
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_step := public.nw_moderate_resolve_report(p_report_id, 'actioned', v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_code := 'suggestion-hidden';

    elsif p_action = 'suspend_profile' then
      v_step := public.nw_moderate_suspend_profile(
        v_target::uuid, v_until, v_actor, btrim(p_reason), p_report_id
      );
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_step := public.nw_moderate_resolve_report(p_report_id, 'actioned', v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_code := 'profile-suspended';

    elsif p_action = 'strike_author' then
      v_step := public.nw_moderate_hide_article(v_target::uuid, v_actor, btrim(p_reason), p_report_id);
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_step := public.nw_moderate_strike_and_maybe_suspend(
        v_author, v_actor, btrim(p_reason), p_report_id, 3, null::timestamptz
      );
      if v_step not in ('struck', 'suspended') then
        raise exception using errcode = 'NW001', message = v_step;
      end if;
      v_code := case when v_step = 'suspended' then 'author-suspended-repeat' else 'author-struck' end;
      v_step := public.nw_moderate_resolve_report(p_report_id, 'actioned', v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;

    else -- dismiss
      v_step := public.nw_moderate_resolve_report(p_report_id, 'no_action', v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_code := 'report-dismissed';
    end if;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), p_action, 'report', p_report_id::text,
      'failed:' || v_failed, p_reason,
      jsonb_build_object('rolledBack', true, 'targetKind', v_kind, 'targetId', v_target),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), p_action, v_kind, v_target, 'ok', p_reason,
    jsonb_build_object('reportId', p_report_id, 'outcome', v_code, 'until', v_until),
    p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', v_code);
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_enforce_report(uuid, integer, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_console_enforce_report(uuid, integer, text, text, text, text, jsonb)
  to service_role;

-- ============================================================ NCII queue

create or replace function public.nw_console_enforce_ncii(
  p_case_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_action text,
  p_reason text,
  p_action_token text,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := 'ncii_' || coalesce(p_action, '');
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_status text;
  v_step text;
  v_failed text;
begin
  if p_action not in ('ensure_removed', 'escalate', 'clear') then
    return jsonb_build_object('ok', false, 'code', 'bad-action');
  end if;
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  -- Clearing a case lifts a takedown, so it is senior-only AND confirmed.
  if v_level < public.nw_console_action_min_level(v_audit_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'ncii_case', p_case_id::text,
      'refused:insufficient-role', p_reason, '{}'::jsonb, p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;
  if p_action = 'clear' and not coalesce(p_confirm, false) then
    return jsonb_build_object('ok', false, 'code', 'confirm-required');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select console_version, status into v_version, v_status
  from public.nw_ncii_cases
  where id = p_case_id
  for update;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'ncii_case', p_case_id::text,
      'refused:stale-action', p_reason,
      jsonb_build_object('expectedVersion', p_expected_version, 'currentVersion', v_version),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_status = 'cleared' and p_action <> 'clear' then
    v_result := jsonb_build_object('ok', false, 'code', 'already-cleared');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  begin
    v_step := public.nw_ncii_enforce(
      p_case_id, p_action, v_actor, btrim(p_reason), null::text, null::text
    );
    if v_step not in ('removed', 'escalated', 'cleared') then
      raise exception using errcode = 'NW001', message = v_step;
    end if;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'ncii_case', p_case_id::text,
      'failed:' || v_failed, p_reason, jsonb_build_object('rolledBack', true), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, 'ncii_case', p_case_id::text,
    'ok', p_reason, jsonb_build_object('newStatus', v_step), p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', v_step);
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_enforce_ncii(uuid, integer, text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.nw_console_enforce_ncii(uuid, integer, text, text, text, text, boolean)
  to service_role;

-- ============================================================ DMCA queue

create or replace function public.nw_console_enforce_dmca(
  p_notice_id uuid,
  p_notice_kind text,
  p_expected_version integer,
  p_actor_ref text,
  p_action text,
  p_reason text,
  p_action_token text,
  p_value text default null,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := 'dmca_' || coalesce(p_action, '');
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_step text;
  v_failed text;
  v_pending uuid;
begin
  if p_notice_kind not in ('takedown', 'counter') then
    return jsonb_build_object('ok', false, 'code', 'bad-notice-kind');
  end if;
  if p_action not in (
    'assign', 'add_note', 'acknowledge', 'forward', 'resolve_url', 'link_strike', 'close',
    'link_original', 'unlink_original', 'forward_to_claimant', 'start_waiting_period',
    'restore_content', 'litigation_hold'
  ) then
    return jsonb_build_object('ok', false, 'code', 'bad-action');
  end if;
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  if v_level < public.nw_console_action_min_level(v_audit_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'dmca_' || p_notice_kind,
      p_notice_id::text, 'refused:insufficient-role', p_reason, '{}'::jsonb, p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;
  if p_action = 'restore_content' and not coalesce(p_confirm, false) then
    return jsonb_build_object('ok', false, 'code', 'confirm-required');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  if p_notice_kind = 'takedown' then
    select console_version into v_version
    from public.nw_dmca_notices where id = p_notice_id for update;
  else
    select console_version into v_version
    from public.nw_dmca_counter_notices where id = p_notice_id for update;
  end if;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'dmca_' || p_notice_kind,
      p_notice_id::text, 'refused:stale-action', p_reason,
      jsonb_build_object('expectedVersion', p_expected_version, 'currentVersion', v_version),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  -- Restoring content that a takedown removed is a dual-control action: it is
  -- the one DMCA step that puts contested material back in public.
  if p_action = 'restore_content' then
    insert into public.nw_pending_actions
      (kind, target_kind, target_id, params, reason, proposed_by, proposed_role,
       target_version, expires_at)
    values
      ('restore_content',
       case when p_notice_kind = 'takedown' then 'dmca_notice' else 'dmca_counter' end,
       p_notice_id::text,
       jsonb_build_object('noticeKind', p_notice_kind, 'value', p_value),
       btrim(p_reason), v_actor, v_role, v_version, now() + interval '7 days')
    returning id into v_pending;
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), 'propose_pending', 'dmca_' || p_notice_kind,
      p_notice_id::text, 'ok', p_reason,
      jsonb_build_object('pendingId', v_pending, 'kind', 'restore_content'), p_action_token
    );
    v_result := jsonb_build_object('ok', true, 'code', 'pending-approval', 'pendingId', v_pending);
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  begin
    v_step := public.nw_dmca_apply_action(
      p_notice_id, p_notice_kind, p_action, v_actor, btrim(p_reason), p_value
    );
    if v_step not in (
      'assigned', 'noted', 'acknowledged', 'forwarded', 'resolved', 'still-needs-resolution',
      'strike-linked', 'closed', 'original-linked', 'original-unlinked', 'forwarded-to-claimant',
      'waiting-period', 'restored', 'litigation-hold'
    ) then
      raise exception using errcode = 'NW001', message = v_step;
    end if;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'dmca_' || p_notice_kind,
      p_notice_id::text, 'failed:' || v_failed, p_reason,
      jsonb_build_object('rolledBack', true), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, 'dmca_' || p_notice_kind,
    p_notice_id::text, 'ok', p_reason, jsonb_build_object('outcome', v_step), p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', v_step);
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_enforce_dmca(
  uuid, text, integer, text, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.nw_console_enforce_dmca(
  uuid, text, integer, text, text, text, text, text, boolean
) to service_role;

-- ============================================================ screening queue

-- Screening review and screening APPEAL disposition both land here, so the WP8
-- appeal state on nw_screening_decisions stays the only screening appeal record.
create or replace function public.nw_console_enforce_screening(
  p_decision_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_action text,
  p_reason text,
  p_action_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := case p_action
    when 'approve' then 'screening_approve'
    when 'reject' then 'screening_reject'
    when 'appeal_grant' then 'appeal_grant'
    when 'appeal_deny' then 'appeal_deny'
    else 'screening_unknown'
  end;
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_decision text;
  v_appeal text;
  v_reviewer text;
  v_step text;
  v_failed text;
begin
  if p_action not in ('approve', 'reject', 'appeal_grant', 'appeal_deny') then
    return jsonb_build_object('ok', false, 'code', 'bad-action');
  end if;
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  if v_level < public.nw_console_action_min_level(v_audit_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'screening_decision',
      p_decision_id::text, 'refused:insufficient-role', p_reason, '{}'::jsonb, p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select console_version, decision, appeal_state, reviewer_ref
    into v_version, v_decision, v_appeal, v_reviewer
  from public.nw_screening_decisions
  where id = p_decision_id
  for update;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'screening_decision',
      p_decision_id::text, 'refused:stale-action', p_reason,
      jsonb_build_object('expectedVersion', p_expected_version, 'currentVersion', v_version),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  -- Nobody reviews their own screening decision on appeal. A reviewer who
  -- rejected the content cannot then rule on the appeal against that rejection.
  if p_action in ('appeal_grant', 'appeal_deny')
     and v_reviewer is not null
     and lower(btrim(v_reviewer)) = v_actor then
    v_result := jsonb_build_object('ok', false, 'code', 'same-moderator');
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'screening_decision',
      p_decision_id::text, 'refused:same-moderator', p_reason, '{}'::jsonb, p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  begin
    if p_action = 'approve' then
      v_step := public.nw_screening_approve(p_decision_id, v_actor, btrim(p_reason));
      if v_step not in ('ok', 'stale-rev') then
        raise exception using errcode = 'NW001', message = v_step;
      end if;
    elsif p_action = 'reject' then
      v_step := public.nw_screening_reject(p_decision_id, v_actor, btrim(p_reason));
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
    else
      v_step := public.nw_screening_appeal_disposition(
        p_decision_id, v_actor, p_action = 'appeal_grant', btrim(p_reason)
      );
      if v_step not in ('ok', 'stale-rev') then
        raise exception using errcode = 'NW001', message = v_step;
      end if;
    end if;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'screening_decision',
      p_decision_id::text, 'failed:' || v_failed, p_reason,
      jsonb_build_object('rolledBack', true), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, 'screening_decision',
    p_decision_id::text, 'ok', p_reason, jsonb_build_object('outcome', v_step), p_action_token
  );
  -- 'stale-rev' is an honest PARTIAL outcome: the decision is approved and the
  -- author holds an allowance, but the article head moved so the held revision
  -- could not be released in place. It keeps its own code so the console can say
  -- that rather than implying a clean release.
  v_result := jsonb_build_object(
    'ok', true,
    'code', case p_action
      when 'approve' then
        case when v_step = 'stale-rev' then 'screening-approved-stale' else 'screening-approved' end
      when 'reject' then 'screening-rejected'
      when 'appeal_grant' then
        case when v_step = 'stale-rev' then 'appeal-granted-stale' else 'appeal-granted' end
      else 'appeal-denied'
    end
  );
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_enforce_screening(uuid, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_enforce_screening(uuid, integer, text, text, text, text)
  to service_role;

-- ============================================================ verification

create or replace function public.nw_console_enforce_verification(
  p_verification_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_action text,
  p_reason text,
  p_action_token text,
  p_expires_at timestamptz default null,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := 'verification_' || coalesce(p_action, '');
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_status text;
  v_step text;
  v_failed text;
begin
  if p_action not in ('approve', 'deny', 'revoke') then
    return jsonb_build_object('ok', false, 'code', 'bad-action');
  end if;
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  if v_level < public.nw_console_action_min_level(v_audit_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'verification',
      p_verification_id::text, 'refused:insufficient-role', p_reason, '{}'::jsonb, p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;
  if p_action = 'approve' and (p_expires_at is null or p_expires_at <= now()) then
    return jsonb_build_object('ok', false, 'code', 'expiry-required');
  end if;
  if p_action = 'revoke' and not coalesce(p_confirm, false) then
    return jsonb_build_object('ok', false, 'code', 'confirm-required');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select console_version, status into v_version, v_status
  from public.nw_journalist_verifications
  where id = p_verification_id
  for update;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'verification',
      p_verification_id::text, 'refused:stale-action', p_reason,
      jsonb_build_object('expectedVersion', p_expected_version, 'currentVersion', v_version),
      p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  begin
    if p_action = 'revoke' then
      v_step := public.nw_verification_revoke(p_verification_id, v_actor, btrim(p_reason));
    else
      v_step := public.nw_verification_decide(
        p_verification_id, v_actor, p_action = 'approve', btrim(p_reason), p_expires_at
      );
    end if;
    if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'verification',
      p_verification_id::text, 'failed:' || v_failed, p_reason,
      jsonb_build_object('rolledBack', true), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, 'verification',
    p_verification_id::text, 'ok', p_reason,
    jsonb_build_object('expiresAt', p_expires_at), p_action_token
  );
  -- A distinct code per action, so the console can say WHICH thing happened
  -- instead of a bare 'ok' that every action shares.
  v_result := jsonb_build_object(
    'ok', true,
    'code', case p_action
      when 'approve' then 'verification-approved'
      when 'deny' then 'verification-denied'
      else 'verification-revoked'
    end
  );
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_enforce_verification(
  uuid, integer, text, text, text, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.nw_console_enforce_verification(
  uuid, integer, text, text, text, text, timestamptz, boolean
) to service_role;

-- ============================================================ appeal disposition

-- Moderation-action appeal disposition. Granting an appeal reverses the original
-- action in the same transaction, so a granted appeal restores content instead of
-- only relabelling the appeal. The appeal reviewer may never be the moderator who
-- took the action being appealed: that is the dual control for this path, and it
-- is checked here rather than in the UI.
create or replace function public.nw_console_dispose_moderation_appeal(
  p_appeal_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_grant boolean,
  p_reason text,
  p_action_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := case when p_grant then 'appeal_grant' else 'appeal_deny' end;
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_state text;
  v_action_id uuid;
  v_action text;
  v_kind text;
  v_target text;
  v_original_ref text;
  v_reversal text;
  v_failed text;
  v_rows integer;
begin
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;
  if v_level < public.nw_console_action_min_level(v_audit_action) then
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'moderation_appeal',
      p_appeal_id::text, 'refused:insufficient-role', p_reason, '{}'::jsonb, p_action_token
    );
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select a.console_version, a.state, a.action_id, ma.action, ma.target_kind, ma.target_id,
         ma.moderator_ref
    into v_version, v_state, v_action_id, v_action, v_kind, v_target, v_original_ref
  from public.nw_moderation_appeals a
  join public.nw_moderation_actions ma on ma.id = a.action_id
  where a.id = p_appeal_id
  for update of a;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_state <> 'requested' then
    v_result := jsonb_build_object('ok', false, 'code', 'already-decided');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if lower(btrim(coalesce(v_original_ref, ''))) = v_actor then
    v_result := jsonb_build_object('ok', false, 'code', 'same-moderator');
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'moderation_appeal',
      p_appeal_id::text, 'refused:same-moderator', p_reason, '{}'::jsonb, p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  begin
    if p_grant then
      if v_action = 'hide_article' then
        update public.nw_articles set status = 'published'
          where id = v_target::uuid and status = 'retracted';
        get diagnostics v_rows = row_count;
        v_reversal := case when v_rows = 1 then 'article-republished' else 'article-unchanged' end;
      elsif v_action = 'hide_suggestion' then
        update public.nw_edit_suggestions set status = 'open'
          where id = v_target::uuid and status = 'rejected';
        get diagnostics v_rows = row_count;
        v_reversal := case when v_rows = 1 then 'suggestion-reopened' else 'suggestion-unchanged' end;
      elsif v_action = 'suspend_profile' then
        update public.nw_profiles set suspended_until = null
          where id = v_target::uuid and suspended_until is not null;
        get diagnostics v_rows = row_count;
        v_reversal := case when v_rows = 1 then 'suspension-lifted' else 'suspension-unchanged' end;
      else
        v_reversal := 'no-automatic-reversal';
      end if;

      -- The reversal is itself a moderation action, so it belongs in the
      -- statement-of-reasons trail the user can read.
      insert into public.nw_moderation_actions
        (report_id, moderator_ref, action, target_kind, target_id, note)
      values
        (null, v_actor, 'restore', v_kind, v_target,
         'appeal granted: ' || btrim(p_reason));
    else
      v_reversal := null;
    end if;

    update public.nw_moderation_appeals
      set state = case when p_grant then 'granted' else 'denied' end,
          reviewer_ref = v_actor,
          decision_reason = btrim(p_reason),
          decided_at = now(),
          reversal_outcome = v_reversal,
          updated_at = now()
      where id = p_appeal_id;
  exception when others then
    v_failed := coalesce(nullif(sqlerrm, ''), 'reversal-failed');
  end;

  if v_failed is not null then
    v_result := jsonb_build_object('ok', false, 'code', 'reversal-failed', 'rolledBack', true);
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, 'moderation_appeal',
      p_appeal_id::text, 'failed:reversal', p_reason,
      jsonb_build_object('rolledBack', true, 'detail', v_failed), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, 'moderation_appeal',
    p_appeal_id::text, 'ok', p_reason,
    jsonb_build_object(
      'actionId', v_action_id, 'subjectAction', v_action, 'reversal', v_reversal,
      'decidedAgainstBy', v_original_ref
    ),
    p_action_token
  );
  v_result := jsonb_build_object(
    'ok', true,
    'code', case when p_grant then 'appeal-granted' else 'appeal-denied' end,
    'reversal', v_reversal
  );
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_dispose_moderation_appeal(
  uuid, integer, text, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.nw_console_dispose_moderation_appeal(
  uuid, integer, text, boolean, text, text
) to service_role;

-- ============================================================ dual-control decide

-- Approve (and execute) or reject a pending action. Approval and execution share
-- one transaction: an approved proposal that cannot execute is rolled back to
-- 'failed' rather than left approved-but-not-applied.
create or replace function public.nw_console_decide_pending_action(
  p_pending_id uuid,
  p_actor_ref text,
  p_approve boolean,
  p_reason text,
  p_action_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_audit_action text := case when p_approve then 'pending_approve' else 'pending_reject' end;
  v_prior jsonb;
  v_result jsonb;
  v_row public.nw_pending_actions;
  v_current_version integer;
  v_step text;
  v_failed text;
  v_outcome text;
  v_rows integer;
  v_until timestamptz;
begin
  if v_level < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, v_audit_action);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select * into v_row from public.nw_pending_actions where id = p_pending_id for update;
  if v_row.id is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_row.state <> 'pending' then
    v_result := jsonb_build_object('ok', false, 'code', 'already-decided');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_row.expires_at <= now() then
    update public.nw_pending_actions set state = 'expired' where id = p_pending_id;
    v_result := jsonb_build_object('ok', false, 'code', 'expired');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  -- Second-moderator rule. The table CHECK also refuses this, so a code path
  -- that forgot the guard would still fail; this returns the typed code.
  if lower(btrim(v_row.proposed_by)) = v_actor then
    v_result := jsonb_build_object('ok', false, 'code', 'self-approval');
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
      'refused:self-approval', p_reason,
      jsonb_build_object('pendingId', p_pending_id, 'kind', v_row.kind), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_level < public.nw_pending_action_min_level(v_row.kind) then
    v_result := jsonb_build_object('ok', false, 'code', 'insufficient-role');
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
      'refused:insufficient-role', p_reason,
      jsonb_build_object('pendingId', p_pending_id, 'kind', v_row.kind), p_action_token
    );
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  if not p_approve then
    update public.nw_pending_actions
      set state = 'rejected', decided_by = v_actor, decided_role = v_role,
          decided_at = now(), decision_reason = btrim(p_reason)
      where id = p_pending_id;
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
      'ok', p_reason,
      jsonb_build_object('pendingId', p_pending_id, 'kind', v_row.kind,
                         'proposedBy', v_row.proposed_by),
      p_action_token
    );
    v_result := jsonb_build_object('ok', true, 'code', 'pending-rejected');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  -- The proposal captured the target's version; if the target moved since, the
  -- approver is not approving the situation the proposer described.
  if v_row.target_version is not null then
    v_current_version := case v_row.target_kind
      when 'profile' then (
        select r.console_version from public.nw_reports r
        where r.id = (v_row.params->>'reportId')::uuid
      )
      when 'dmca_notice' then (
        select n.console_version from public.nw_dmca_notices n where n.id = v_row.target_id::uuid
      )
      when 'dmca_counter' then (
        select c.console_version from public.nw_dmca_counter_notices c
        where c.id = v_row.target_id::uuid
      )
      when 'payout_account' then (
        select a.console_version from public.nw_payout_accounts a
        where a.journalist_profile_id = v_row.target_id::uuid
      )
      else null
    end;
    if v_current_version is not null and v_current_version <> v_row.target_version then
      v_result := jsonb_build_object(
        'ok', false, 'code', 'stale-action', 'currentVersion', v_current_version
      );
      perform public.nw_console_audit_append(
        v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
        'refused:stale-action', p_reason,
        jsonb_build_object('pendingId', p_pending_id, 'proposedVersion', v_row.target_version,
                           'currentVersion', v_current_version),
        p_action_token
      );
      perform public.nw_console_record_token_result(p_action_token, v_result);
      return v_result;
    end if;
  end if;

  begin
    if v_row.kind in ('suspend_long', 'terminate_account') then
      begin
        v_until := (v_row.params->>'until')::timestamptz;
      exception when others then
        v_until := null;
      end;
      if v_row.kind = 'terminate_account' then
        -- A termination is a permanent suspension: the profile can never publish,
        -- suggest, or report again. Deleting the person's data stays the
        -- user-initiated WP5 path, so nothing here claims to erase an account.
        v_until := public.nw_console_permanent_until();
      end if;
      if v_until is null then
        raise exception using errcode = 'NW001', message = 'bad-suspension';
      end if;
      v_step := public.nw_moderate_suspend_profile(
        v_row.target_id::uuid, v_until, v_actor, btrim(v_row.reason),
        nullif(v_row.params->>'reportId', '')::uuid
      );
      if v_step <> 'ok' then raise exception using errcode = 'NW001', message = v_step; end if;
      if v_row.report_id is not null then
        v_step := public.nw_moderate_resolve_report(
          v_row.report_id, 'actioned', v_actor, btrim(v_row.reason)
        );
        -- A report someone else already resolved is not a failure of the
        -- suspension; the suspension is what was approved.
        if v_step not in ('ok', 'not-open') then
          raise exception using errcode = 'NW001', message = v_step;
        end if;
      end if;
      v_outcome := case when v_row.kind = 'terminate_account'
        then 'account-terminated' else 'suspension-applied' end;

    elsif v_row.kind = 'restore_content' then
      v_step := public.nw_dmca_apply_action(
        v_row.target_id::uuid,
        coalesce(v_row.params->>'noticeKind', 'takedown'),
        'restore_content',
        v_actor,
        btrim(v_row.reason),
        nullif(v_row.params->>'value', '')
      );
      if v_step <> 'restored' then raise exception using errcode = 'NW001', message = v_step; end if;
      v_outcome := 'content-restored';

    elsif v_row.kind = 'payout_block' then
      update public.nw_payout_accounts
        set onboarding_state = 'blocked',
            status_reason = btrim(v_row.reason),
            updated_at = now()
        where journalist_profile_id = v_row.target_id::uuid
          and onboarding_state <> 'none';
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception using errcode = 'NW001', message = 'no-payout-account'; end if;
      v_outcome := 'payout-blocked';

    elsif v_row.kind = 'payout_unblock' then
      update public.nw_payout_accounts
        set onboarding_state = 'verified',
            status_reason = btrim(v_row.reason),
            updated_at = now()
        where journalist_profile_id = v_row.target_id::uuid
          and onboarding_state = 'blocked';
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception using errcode = 'NW001', message = 'not-blocked'; end if;
      v_outcome := 'payout-unblocked';

    else
      raise exception using errcode = 'NW001', message = 'no-executor';
    end if;

    update public.nw_pending_actions
      set state = 'approved', decided_by = v_actor, decided_role = v_role,
          decided_at = now(), decision_reason = btrim(p_reason),
          executed_at = now(), execution_outcome = v_outcome
      where id = p_pending_id;
  exception when sqlstate 'NW001' then
    v_failed := sqlerrm;
  end;

  if v_failed is not null then
    -- The execution rolled back. Record the failure on the proposal (a separate
    -- statement, so it survives) instead of leaving it approvable forever.
    update public.nw_pending_actions
      set state = 'failed', decided_by = v_actor, decided_role = v_role,
          decided_at = now(), decision_reason = btrim(p_reason),
          execution_outcome = v_failed
      where id = p_pending_id;
    perform public.nw_console_audit_append(
      v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
      'failed:' || v_failed, p_reason,
      jsonb_build_object('pendingId', p_pending_id, 'kind', v_row.kind, 'rolledBack', true),
      p_action_token
    );
    v_result := jsonb_build_object('ok', false, 'code', v_failed, 'rolledBack', true);
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), v_audit_action, v_row.target_kind, v_row.target_id,
    'ok', p_reason,
    jsonb_build_object('pendingId', p_pending_id, 'kind', v_row.kind,
                       'proposedBy', v_row.proposed_by, 'outcome', v_outcome),
    p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', 'pending-approved', 'outcome', v_outcome);
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_decide_pending_action(uuid, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_decide_pending_action(uuid, text, boolean, text, text)
  to service_role;

-- A proposer can withdraw their own pending action (and only their own).
create or replace function public.nw_console_cancel_pending_action(
  p_pending_id uuid,
  p_actor_ref text,
  p_reason text,
  p_action_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_prior jsonb;
  v_result jsonb;
  v_proposer text;
  v_state text;
  v_kind text;
  v_target_kind text;
  v_target_id text;
begin
  if public.nw_moderator_role_rank(coalesce(v_role, 'none')) < 1 then
    return jsonb_build_object('ok', false, 'code', 'no-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, 'pending_cancel');
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select proposed_by, state, kind, target_kind, target_id
    into v_proposer, v_state, v_kind, v_target_kind, v_target_id
  from public.nw_pending_actions where id = p_pending_id for update;
  if v_proposer is null then
    v_result := jsonb_build_object('ok', false, 'code', 'not-found');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if v_state <> 'pending' then
    v_result := jsonb_build_object('ok', false, 'code', 'already-decided');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if lower(btrim(v_proposer)) <> v_actor then
    v_result := jsonb_build_object('ok', false, 'code', 'not-proposer');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  update public.nw_pending_actions
    set state = 'cancelled', decision_reason = btrim(p_reason)
    where id = p_pending_id;
  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), 'pending_cancel', v_target_kind, v_target_id,
    'ok', p_reason, jsonb_build_object('pendingId', p_pending_id, 'kind', v_kind), p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', 'cancelled');
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_cancel_pending_action(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_console_cancel_pending_action(uuid, text, text, text)
  to service_role;

-- Propose a payout block or unblock. There is no single-moderator path to a
-- payment-adjacent change: the propose RPC is the only entry point, and it always
-- produces a pending action.
create or replace function public.nw_console_propose_payout_action(
  p_journalist_profile_id uuid,
  p_expected_version integer,
  p_actor_ref text,
  p_block boolean,
  p_reason text,
  p_action_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := lower(btrim(coalesce(p_actor_ref, '')));
  v_role text := public.nw_moderator_role(v_actor);
  v_level integer := public.nw_moderator_role_rank(coalesce(v_role, 'none'));
  v_kind text := case when p_block then 'payout_block' else 'payout_unblock' end;
  v_prior jsonb;
  v_result jsonb;
  v_version integer;
  v_state text;
  v_pending uuid;
begin
  if v_level < public.nw_console_action_min_level(v_kind) then
    return jsonb_build_object('ok', false, 'code', 'insufficient-role');
  end if;
  if not public.nw_console_reason_ok(p_reason) then
    return jsonb_build_object('ok', false, 'code', 'bad-reason');
  end if;
  if p_action_token is null or char_length(btrim(p_action_token)) < 8 then
    return jsonb_build_object('ok', false, 'code', 'bad-token');
  end if;

  v_prior := public.nw_console_claim_token(p_action_token, v_actor, 'propose_' || v_kind);
  if v_prior is not null then
    return jsonb_build_object('ok', false, 'code', 'replayed', 'original', v_prior);
  end if;

  select console_version, onboarding_state into v_version, v_state
  from public.nw_payout_accounts
  where journalist_profile_id = p_journalist_profile_id
  for update;
  if v_version is null then
    v_result := jsonb_build_object('ok', false, 'code', 'no-payout-account');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_expected_version is null or p_expected_version <> v_version then
    v_result := jsonb_build_object('ok', false, 'code', 'stale-action', 'currentVersion', v_version);
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if p_block and v_state = 'none' then
    v_result := jsonb_build_object('ok', false, 'code', 'nothing-to-block');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;
  if not p_block and v_state <> 'blocked' then
    v_result := jsonb_build_object('ok', false, 'code', 'not-blocked');
    perform public.nw_console_record_token_result(p_action_token, v_result);
    return v_result;
  end if;

  insert into public.nw_pending_actions
    (kind, target_kind, target_id, params, reason, proposed_by, proposed_role,
     target_version, expires_at)
  values
    (v_kind, 'payout_account', p_journalist_profile_id::text,
     jsonb_build_object('previousState', v_state),
     btrim(p_reason), v_actor, v_role, v_version, now() + interval '7 days')
  returning id into v_pending;

  perform public.nw_console_audit_append(
    v_actor, coalesce(v_role, 'none'), 'propose_pending', 'payout_account',
    p_journalist_profile_id::text, 'ok', p_reason,
    jsonb_build_object('pendingId', v_pending, 'kind', v_kind, 'previousState', v_state),
    p_action_token
  );
  v_result := jsonb_build_object('ok', true, 'code', 'pending-approval', 'pendingId', v_pending);
  perform public.nw_console_record_token_result(p_action_token, v_result);
  return v_result;
end;
$$;

revoke all on function public.nw_console_propose_payout_action(
  uuid, integer, text, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.nw_console_propose_payout_action(
  uuid, integer, text, boolean, text, text
) to service_role;

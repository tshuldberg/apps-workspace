-- Yearn boost purchase integrity. Threat model: an authenticated client can
-- self-grant a boost through the legacy RPC or replay one StoreKit transaction.
-- This supersedes the client-trust design introduced by 0012_yearn_boost.sql.
-- Only a service-role caller may record a locally chain-verified transaction.
-- Idempotent and safely re-runnable.
--
-- Ordering matters here (security review finding): this project reuses a live
-- yearn database whose boosts ledger may already hold rows created by the
-- client-trusted legacy RPC, including duplicate or null original_transaction_id
-- values. We must (1) tombstone the vulnerable RPC, (2) neutralize every
-- pre-cutover boost, and (3) deduplicate legacy rows BEFORE creating the unique
-- index, or the index build aborts the whole migration on a dirty database.

-- 0. Add the environment column first; the new RPC and the cleanup below use it.
alter table yearn.boosts
  add column if not exists environment text not null default 'production';

-- 1. Tombstone the client-callable entry point so no further self-grants land
-- while we clean up. Existing clients receive an explicit error.
create or replace function yearn.activate_boost(p_original_transaction_id text)
returns timestamptz
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  raise exception 'activate_boost is disabled: boosts require server-side App Store receipt validation';
end;
$$;

revoke execute on function yearn.activate_boost(text)
  from public, anon, authenticated;

-- 2. Expire every pre-cutover boost. All rows that predate server-side
-- verification are presumed self-granted and must not keep ranking anyone to the
-- top of the deck. Expiring (rather than deleting) preserves the audit trail.
update yearn.boosts
  set expires_at = now()
  where expires_at > now();

-- 3. Deduplicate legacy rows on original_transaction_id so the partial unique
-- index can be created. Keep the earliest row per transaction id; drop the rest.
-- Rows with a null transaction id are legacy self-grants (the new RPC always
-- supplies one); delete them outright so the going-forward NOT VALID check does
-- not leave unexplained nulls behind.
delete from yearn.boosts where original_transaction_id is null;

delete from yearn.boosts b
using yearn.boosts keeper
where b.original_transaction_id = keeper.original_transaction_id
  and b.original_transaction_id is not null
  and (
    keeper.created_at < b.created_at
    or (keeper.created_at = b.created_at and keeper.id < b.id)
  );

-- 4. Now the ledger is clean: create the uniqueness guarantee.
create unique index if not exists boosts_original_txn_unique_idx
  on yearn.boosts (original_transaction_id)
  where original_transaction_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'boosts_txn_required'
      and conrelid = 'yearn.boosts'::regclass
  ) then
    alter table yearn.boosts
      add constraint boosts_txn_required
      check (original_transaction_id is not null) not valid;
  end if;
end;
$$;

-- Records one verified consumable transaction exactly once. The pre-insert
-- lookup gives ordinary replays a stable response. ON CONFLICT also closes the
-- concurrent replay race without extending the original boost window.
create or replace function yearn.activate_boost_validated(
  p_user_id uuid,
  p_original_transaction_id text,
  p_environment text default 'production'
)
returns table (
  expires_at timestamptz,
  duplicate boolean
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_expires_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'activate_boost_validated: user id is required';
  end if;

  if p_original_transaction_id is null or btrim(p_original_transaction_id) = '' then
    raise exception 'activate_boost_validated: original transaction id is required';
  end if;

  select b.expires_at
  into v_expires_at
  from yearn.boosts b
  where b.original_transaction_id = btrim(p_original_transaction_id)
  limit 1;

  if found then
    return query select v_expires_at, true;
    return;
  end if;

  insert into yearn.boosts as b (
    user_id,
    started_at,
    expires_at,
    original_transaction_id,
    environment
  )
  values (
    p_user_id,
    now(),
    now() + interval '7 days',
    btrim(p_original_transaction_id),
    coalesce(nullif(lower(btrim(p_environment)), ''), 'production')
  )
  on conflict (original_transaction_id)
    where original_transaction_id is not null
    do nothing
  returning b.expires_at into v_expires_at;

  if found then
    return query select v_expires_at, false;
    return;
  end if;

  select b.expires_at
  into v_expires_at
  from yearn.boosts b
  where b.original_transaction_id = btrim(p_original_transaction_id)
  limit 1;

  if not found then
    raise exception 'activate_boost_validated: transaction replay resolution failed';
  end if;

  return query select v_expires_at, true;
end;
$$;

revoke execute on function yearn.activate_boost_validated(uuid, text, text)
  from public, anon, authenticated;
grant execute on function yearn.activate_boost_validated(uuid, text, text)
  to service_role;

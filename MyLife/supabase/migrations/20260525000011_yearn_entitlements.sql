-- Yearn StoreKit entitlements: server-truth record of membership subscription state.
-- Apply after 0010_yearn_rls_hardening.sql. Idempotent and safely re-runnable.
--
-- Product: com.mylife.yearn.membership ($4.99/year auto-renewable). One
-- membership per user, so user_id is the primary key.
--
-- Trust model:
--   - The App Store Server Notifications V2 webhook, running as service_role,
--     is the ONLY writer. It calls yearn.upsert_entitlement(...) to record the
--     verified subscription state after validating the signed transaction.
--   - Clients can NEVER self-grant: authenticated/anon have no insert/update/
--     delete privilege on the table, and execute on upsert_entitlement is
--     revoked from them. The Swift client trusts yearn.current_membership()
--     (server truth) over on-device StoreKit alone.

-- =========================================
-- ENTITLEMENTS
-- One row per user. Effective membership computed from status + expires_at.
-- =========================================
create table if not exists yearn.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  product_id text not null,
  original_transaction_id text,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'grace')),
  environment text not null default 'Production',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- One transaction maps to at most one user. Partial unique so multiple NULLs
-- (pre-purchase rows are not expected, but defensive) do not collide.
create unique index if not exists entitlements_original_txn_idx
  on yearn.entitlements (original_transaction_id)
  where original_transaction_id is not null;

-- Supports expiry sweeps / "active and not yet expired" lookups.
create index if not exists entitlements_status_expires_idx
  on yearn.entitlements (status, expires_at);

alter table yearn.entitlements enable row level security;

-- Users may read their own entitlement row. There is deliberately no INSERT /
-- UPDATE / DELETE policy: writes flow exclusively through the SECURITY DEFINER
-- upsert RPC (service_role) so clients cannot fabricate or alter membership.
drop policy if exists "entitlements select own" on yearn.entitlements;
create policy "entitlements select own"
on yearn.entitlements for select
to authenticated
using (user_id = auth.uid());

grant select on yearn.entitlements to authenticated;

-- =========================================
-- upsert_entitlement(p_user_id, p_product_id, p_original_transaction_id,
--                     p_status, p_environment, p_expires_at)
-- Records the verified subscription state for a user. SECURITY DEFINER so it can
-- write past the (deliberately absent) INSERT/UPDATE policies. Execute is granted
-- only to service_role: the App Store webhook is the sole caller. Clients have no
-- path to invoke this.
-- =========================================
create or replace function yearn.upsert_entitlement(
  p_user_id uuid,
  p_product_id text,
  p_original_transaction_id text,
  p_status text,
  p_environment text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  insert into yearn.entitlements (
    user_id, product_id, original_transaction_id,
    status, environment, expires_at, updated_at
  )
  values (
    p_user_id, p_product_id, p_original_transaction_id,
    coalesce(p_status, 'active'),
    coalesce(p_environment, 'Production'),
    p_expires_at, now()
  )
  on conflict (user_id)
  do update set product_id = excluded.product_id,
                original_transaction_id = excluded.original_transaction_id,
                status = excluded.status,
                environment = excluded.environment,
                expires_at = excluded.expires_at,
                updated_at = now();
end;
$$;

revoke execute on function yearn.upsert_entitlement(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function yearn.upsert_entitlement(uuid, text, text, text, text, timestamptz)
  to service_role;

-- =========================================
-- current_membership()
-- Server-truth membership for the caller. The client reads this instead of
-- trusting only on-device StoreKit. SECURITY DEFINER so it can read the caller's
-- row regardless of table RLS (and is still scoped to auth.uid() internally).
-- Returns is_member=false / status='none' when the caller has no entitlement.
-- =========================================
create or replace function yearn.current_membership()
returns table (
  is_member boolean,
  status text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'current_membership: no authenticated user';
  end if;

  return query
  select (e.status = 'active' and (e.expires_at is null or e.expires_at > now())) as is_member,
         e.status,
         e.expires_at
  from yearn.entitlements e
  where e.user_id = v_uid;

  -- No entitlement row: report a non-member default.
  if not found then
    return query select false, 'none'::text, null::timestamptz;
  end if;
end;
$$;

revoke execute on function yearn.current_membership() from public, anon;
grant execute on function yearn.current_membership() to authenticated;

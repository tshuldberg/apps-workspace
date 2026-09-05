-- Yearn visibility boost: a 7-day increased-visibility purchase that surfaces the
-- boosting user first in everyone else's swipe deck.
-- Apply after 0011_yearn_entitlements.sql. Idempotent and safely re-runnable.
--
-- A boost is bought as a StoreKit consumable (com.mylife.yearn.boost, ~$1).
-- After the client verifies the purchase locally it calls activate_boost(), which
-- pins the row to auth.uid() and dates it now()..now()+7d. has_active_boost() is
-- the predicate discover_profiles() uses to float boosted candidates to the top.
--
-- This migration:
--   1. Adds yearn.boosts (per-user boost ledger) + RLS.
--   2. Adds yearn.has_active_boost(p_user) read predicate.
--   3. Adds yearn.activate_boost(p_original_transaction_id) write RPC.
--   4. REDEFINES yearn.discover_profiles() identically to 0006 except the ORDER BY
--      now leads with the boosted candidate first. Same signature/return type, so
--      create or replace is sufficient.

-- =========================================
-- BOOSTS
-- One row per purchased boost window. expires_at is the only thing that matters
-- for ranking; we keep started_at and original_transaction_id for audit. Inserts
-- go through activate_boost(), so no INSERT policy is granted to clients.
-- on delete cascade clears a user's boost ledger when the account is removed.
-- =========================================
create table if not exists yearn.boosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  original_transaction_id text,
  created_at timestamptz not null default now()
);

create index if not exists boosts_user_expires_idx
  on yearn.boosts (user_id, expires_at desc);

alter table yearn.boosts enable row level security;

-- Users may read their own boost history. Writes go through activate_boost(), so
-- no insert/update/delete policy or grant is exposed to clients.
drop policy if exists "boosts select own" on yearn.boosts;
create policy "boosts select own"
on yearn.boosts for select
to authenticated
using (user_id = auth.uid());

grant select on yearn.boosts to authenticated;

-- =========================================
-- has_active_boost(p_user)
-- True iff the user has any boost whose window has not yet expired. Used by
-- discover_profiles() to float boosted candidates to the top of the deck.
-- SECURITY DEFINER so it can read yearn.boosts regardless of the caller's RLS.
-- =========================================
create or replace function yearn.has_active_boost(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = yearn, public
as $$
  select exists (
    select 1 from yearn.boosts
    where user_id = p_user
      and expires_at > now()
  );
$$;

grant execute on function yearn.has_active_boost(uuid) to authenticated;

-- =========================================
-- activate_boost(p_original_transaction_id)
-- Open a fresh 7-day boost window for the caller and return its expiry. SECURITY
-- DEFINER + null-uid guard because it writes yearn.boosts with user_id pinned to
-- auth.uid() (there is deliberately no client INSERT policy).
--
-- The client calls this ONLY after a StoreKit-verified purchase; the
-- p_original_transaction_id is stored purely for audit. Server-side receipt
-- validation against the App Store Server API is future hardening - this RPC
-- trusts the client-verified purchase for now.
-- =========================================
create or replace function yearn.activate_boost(p_original_transaction_id text)
returns timestamptz
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_expires_at timestamptz;
begin
  if v_uid is null then
    raise exception 'activate_boost: not authenticated';
  end if;

  insert into yearn.boosts (user_id, started_at, expires_at, original_transaction_id)
  values (v_uid, now(), now() + interval '7 days', p_original_transaction_id)
  returning expires_at into v_expires_at;

  return v_expires_at;
end;
$$;

revoke execute on function yearn.activate_boost(text) from public, anon;
grant execute on function yearn.activate_boost(text) to authenticated;

-- =========================================
-- discover_profiles(p_limit)
-- Redefined identically to 0006 EXCEPT the ORDER BY now leads with the boosted
-- candidate first, so users with an active boost surface at the top of every
-- other viewer's deck. Same signature, return type, filters (pause / self /
-- block / already-swiped), computed age, SECURITY DEFINER, search_path, and
-- grants as 0006. Returns NO birthday column - only the derived integer age.
-- =========================================
create or replace function yearn.discover_profiles(p_limit int default 30)
returns table (
  id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified
  from yearn.profiles p
  where p.is_paused = false
    and p.id <> auth.uid()
    and not yearn.is_blocked(auth.uid(), p.id)
    and not exists (
      select 1 from yearn.likes l
      where l.sender_id = auth.uid() and l.recipient_id = p.id
    )
    and not exists (
      select 1 from yearn.passes pa
      where pa.sender_id = auth.uid() and pa.recipient_id = p.id
    )
  order by yearn.has_active_boost(p.id) desc, p.updated_at desc
  limit greatest(coalesce(p_limit, 30), 0);
$$;

revoke execute on function yearn.discover_profiles(int) from public, anon;
grant execute on function yearn.discover_profiles(int) to authenticated;

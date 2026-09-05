-- Yearn secure discovery read path + age-gating + is_verified lockdown.
-- Apply after 0005_yearn_push.sql. Idempotent.
--
-- discover_profiles() is the swipe-deck source. It returns a *computed age*
-- (never the raw birthday) and applies pause / self / block / already-swiped
-- filters server-side. This prevents mass DOB scraping and respects blocks.
-- The broad "profiles select active" policy from 0001 stays for own-profile and
-- detail reads; discovery itself should go through this function.

-- =========================================
-- discover_profiles(p_limit)
-- SECURITY DEFINER so it can evaluate is_blocked / likes / passes uniformly.
-- auth.uid() resolves from the caller's JWT, so each viewer gets their own deck.
-- Returns NO birthday column - only the derived integer age.
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
  order by p.updated_at desc
  limit greatest(coalesce(p_limit, 30), 0);
$$;

revoke execute on function yearn.discover_profiles(int) from public, anon;
grant execute on function yearn.discover_profiles(int) to authenticated;

-- =========================================
-- 18+ age gate (server-side).
-- Enforced as a NOT VALID check so the migration never fails on any
-- pre-existing under-age rows; it still applies to every future INSERT/UPDATE.
-- birthday <= today - 18y means the user is at least 18.
-- =========================================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_min_age_18'
      and conrelid = 'yearn.profiles'::regclass
  ) then
    alter table yearn.profiles
      add constraint profiles_min_age_18
      check (birthday <= (current_date - interval '18 years'))
      not valid;
  end if;
end;
$$;

-- =========================================
-- is_verified lockdown.
-- Clients must not be able to self-promote to verified. On UPDATE, force
-- is_verified back to its prior value. service_role bypasses RLS but still runs
-- triggers, so verification flips are done by setting the row via service_role
-- with the trigger disabled, or via a dedicated admin RPC (TODO). For client
-- updates this trigger pins the flag.
-- =========================================
create or replace function yearn.lock_is_verified()
returns trigger
language plpgsql
as $$
begin
  -- Preserve verification on client-driven updates so users cannot self-promote.
  -- Privileged backend roles (service_role, or a SECURITY DEFINER admin RPC owned
  -- by postgres) are exempt, leaving a path for a real server-side verification flow.
  if current_user not in ('service_role', 'supabase_admin', 'postgres') then
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_is_verified on yearn.profiles;
create trigger profiles_lock_is_verified
before update on yearn.profiles
for each row execute function yearn.lock_is_verified();

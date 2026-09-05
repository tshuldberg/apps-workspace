-- Yearn geolocation, discovery filters, and realtime publication wiring
-- (plan 47 Phase 4). Idempotent and re-runnable after 20260730000002.
--
-- Makes the existing app.json coarse-location declarations true: profiles
-- gain an optional geography point, discovery ranks by distance, and users
-- get seek preferences (age range, max distance, intention).

-- =========================================
-- POSTGIS
-- =========================================
create extension if not exists postgis;

-- =========================================
-- PROFILE LOCATION (optional, user-controlled)
-- =========================================
alter table yearn.profiles
  add column if not exists location geography(Point, 4326),
  add column if not exists location_updated_at timestamptz;

create index if not exists yearn_profiles_location_idx
  on yearn.profiles using gist (location);

-- update_my_location: definer-pinned to auth.uid(). Passing nulls clears the
-- stored location (honest opt-out); otherwise both coordinates are required
-- and range-checked.
create or replace function yearn.update_my_location(
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'update_my_location: no authenticated user';
  end if;

  if p_latitude is null and p_longitude is null then
    update yearn.profiles
    set location = null,
        location_updated_at = now()
    where id = v_uid;
    return;
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'update_my_location: both coordinates are required';
  end if;

  if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
    raise exception 'update_my_location: coordinates out of range';
  end if;

  update yearn.profiles
  set location = st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      location_updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function yearn.update_my_location(double precision, double precision)
  from public, anon;
grant execute on function yearn.update_my_location(double precision, double precision)
  to authenticated;

-- =========================================
-- DISCOVERY PREFERENCES (seek filters)
-- =========================================
create table if not exists yearn.discovery_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  min_age int not null default 18 check (min_age >= 18 and min_age <= 100),
  max_age int check (max_age >= 18 and max_age <= 100),
  max_distance_miles int check (max_distance_miles >= 1 and max_distance_miles <= 500),
  intention_filter text,
  updated_at timestamptz not null default now(),
  check (max_age is null or max_age >= min_age)
);

alter table yearn.discovery_prefs enable row level security;

drop policy if exists "discovery_prefs select own" on yearn.discovery_prefs;
create policy "discovery_prefs select own"
on yearn.discovery_prefs for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "discovery_prefs insert own" on yearn.discovery_prefs;
create policy "discovery_prefs insert own"
on yearn.discovery_prefs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "discovery_prefs update own" on yearn.discovery_prefs;
create policy "discovery_prefs update own"
on yearn.discovery_prefs for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on table yearn.discovery_prefs to authenticated;

-- =========================================
-- DISCOVER: DISTANCE RANKING + SEEK FILTERS
-- =========================================
-- Preserves every exclusion from the 20260712000004 definition (pause,
-- moderation state, blocks, already liked/passed) and adds:
--   * caller prefs (age range, intention, max distance) read server-side
--   * distance_miles / distance_bucket return columns (the client Zod schema
--     has carried these optional fields since the audit)
--   * ranking boost desc -> distance asc nulls last -> recency
-- Profiles without a stored location are NOT excluded by a distance cap:
-- location is optional, and excluding them would empty the deck for every
-- pre-geo profile. They rank after located profiles instead.
drop function if exists yearn.discover_profiles(int);

create function yearn.discover_profiles(p_limit int default 30)
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
  is_verified boolean,
  distance_miles double precision,
  distance_bucket text
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  with me as (
    select
      p.location as my_location,
      coalesce(dp.min_age, 18) as min_age,
      dp.max_age,
      dp.max_distance_miles,
      dp.intention_filter
    from yearn.profiles p
    left join yearn.discovery_prefs dp on dp.user_id = p.id
    where p.id = auth.uid()
  )
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
    p.is_verified,
    d.miles as distance_miles,
    case
      when d.miles is null then null
      when d.miles < 5 then 'nearby'
      when d.miles < 25 then 'under 25 mi'
      when d.miles < 100 then 'under 100 mi'
      else '100+ mi'
    end as distance_bucket
  from yearn.profiles p
  left join me on true
  left join lateral (
    select case
      when me.my_location is not null and p.location is not null
        then st_distance(me.my_location, p.location) / 1609.344
    end as miles
  ) d on true
  where p.is_paused = false
    and p.moderation_status = 'active'
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
    and extract(year from age(current_date, p.birthday))::int
          >= coalesce(me.min_age, 18)
    and extract(year from age(current_date, p.birthday))::int
          <= coalesce(me.max_age, 200)
    and (me.intention_filter is null or p.intention = me.intention_filter)
    and (
      me.max_distance_miles is null
      or d.miles is null
      or d.miles <= me.max_distance_miles
    )
  order by yearn.has_active_boost(p.id) desc, d.miles asc nulls last, p.updated_at desc
  limit greatest(coalesce(p_limit, 30), 0);
$$;

revoke execute on function yearn.discover_profiles(int) from public, anon;
grant execute on function yearn.discover_profiles(int) to authenticated;

-- =========================================
-- REALTIME PUBLICATION
-- messages_ciphertext (replaces the legacy yearn.messages entry's role),
-- likes, and matches feed the client's postgres-changes subscriptions. RLS
-- still gates which rows each connection may see. Guarded so re-runs no-op.
-- =========================================
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages_ciphertext', 'likes', 'matches'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'yearn'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table yearn.%I', t);
      end if;
    end loop;
  end if;
exception when others then
  raise notice 'Yearn realtime publication wiring skipped: %', sqlerrm;
end $$;

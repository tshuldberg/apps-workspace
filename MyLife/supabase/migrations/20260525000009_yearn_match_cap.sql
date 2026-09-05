-- Yearn match cap + archival: a per-user "10 active matches" ceiling with a FIFO
-- pending queue for the overflow, plus per-user match archival (hide/unmatch
-- without destroying the shared yearn.matches row).
-- Apply after 0008_yearn_social_reads.sql. Idempotent and safely re-runnable.
--
-- Design is STATELESS RANKING. Among a user's non-archived matches ordered by
-- created_at ASC (oldest first = FIFO), the first 10 are active and the rest are
-- pending. Archiving an active match re-ranks the remaining matches automatically,
-- promoting the next pending match into the active set. No promotion trigger is
-- needed because nothing is stored about active/pending state.
--
-- This migration:
--   1. Adds yearn.match_archivals (per-user "I archived this match" ledger) + RLS.
--   2. Adds yearn.archive_match(p_match_id) to hide a match for the caller only.
--   3. REDEFINES yearn.my_matches() to add an is_pending column and exclude the
--      caller's archived matches.
--   4. REDEFINES yearn.like_back(p_like_id) to return the same new is_pending shape.
--
-- Both my_matches() and like_back() change their RETURN TABLE shape, so each is
-- dropped first: create-or-replace cannot change a function's return type.

-- =========================================
-- MATCH ARCHIVALS
-- One row per (match, user) the caller has archived. Per-user, so archiving by
-- one participant does not affect the other. on delete cascade keeps the ledger
-- clean when the match row or the user is removed.
-- =========================================
create table if not exists yearn.match_archivals (
  match_id uuid not null references yearn.matches(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index if not exists match_archivals_user_idx on yearn.match_archivals (user_id);

alter table yearn.match_archivals enable row level security;

drop policy if exists "match_archivals select own" on yearn.match_archivals;
create policy "match_archivals select own"
on yearn.match_archivals for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "match_archivals insert own" on yearn.match_archivals;
create policy "match_archivals insert own"
on yearn.match_archivals for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "match_archivals delete own" on yearn.match_archivals;
create policy "match_archivals delete own"
on yearn.match_archivals for delete
to authenticated
using (user_id = auth.uid());

grant select, insert, delete on yearn.match_archivals to authenticated;

-- =========================================
-- archive_match(p_match_id)
-- Hide a match for the caller and free one active slot. Idempotent: re-archiving
-- is a no-op. The other participant is unaffected. SECURITY DEFINER + null-uid
-- guard because it writes yearn.match_archivals.
-- =========================================
create or replace function yearn.archive_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'archive_match: not authenticated';
  end if;

  insert into yearn.match_archivals (match_id, user_id)
  values (p_match_id, v_uid)
  on conflict (match_id, user_id) do nothing;
end;
$$;

revoke execute on function yearn.archive_match(uuid) from public, anon;
grant execute on function yearn.archive_match(uuid) to authenticated;

-- =========================================
-- my_matches()
-- Every non-archived match I am part of, joined to the other person's profile,
-- with an is_pending flag. Blocked pairs are excluded in either direction and
-- matches I have archived are excluded. is_pending is computed by ranking my
-- non-archived matches oldest-first (FIFO): rank 1..10 are active, 11+ pending.
-- SECURITY DEFINER for uniform is_blocked evaluation. Returns NO birthday column
-- - only the derived integer age.
--
-- Return type changes (adds is_pending), so the old function is dropped first.
-- =========================================
drop function if exists yearn.my_matches();
create function yearn.my_matches()
returns table (
  match_id uuid,
  matched_at timestamptz,
  other_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean,
  is_pending boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  with ranked as (
    select
      m.id,
      m.created_at,
      row_number() over (order by m.created_at asc, m.id asc) as rn
    from yearn.matches m
    where (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(m.user_a, m.user_b)
      and not exists (
        select 1 from yearn.match_archivals a
        where a.match_id = m.id and a.user_id = auth.uid()
      )
  )
  select
    m.id as match_id,
    m.created_at as matched_at,
    p.id as other_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified,
    (r.rn > 10) as is_pending
  from ranked r
  join yearn.matches m on m.id = r.id
  join yearn.profiles p
    on p.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  order by m.created_at desc;
$$;

revoke execute on function yearn.my_matches() from public, anon;
grant execute on function yearn.my_matches() to authenticated;

-- =========================================
-- like_back(p_like_id)
-- Accept an incoming like. Inserts my reciprocal like; the existing
-- handle_new_like trigger from 0001 forms the canonical match. Returns the
-- freshly-formed match row in the same shape as my_matches() (at most one row),
-- now including is_pending. is_pending is computed consistently with my_matches:
-- the match is pending iff its FIFO rank among my non-archived matches exceeds 10.
-- SECURITY DEFINER + null-uid guard because it writes yearn.likes.
--
-- Return type changes (adds is_pending), so the old function is dropped first.
-- =========================================
drop function if exists yearn.like_back(uuid);
create function yearn.like_back(p_like_id uuid)
returns table (
  match_id uuid,
  matched_at timestamptz,
  other_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean,
  is_pending boolean
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_match_id uuid;
  v_match_created_at timestamptz;
  v_is_pending boolean;
begin
  if v_uid is null then
    raise exception 'like_back: not authenticated';
  end if;

  select sender_id into v_sender
  from yearn.likes
  where id = p_like_id and recipient_id = v_uid;

  if v_sender is null then
    raise exception 'like_back: like not found';
  end if;

  -- Reciprocal like. The handle_new_like trigger forms the match on mutual like.
  insert into yearn.likes (sender_id, recipient_id, note)
  values (v_uid, v_sender, null)
  on conflict (sender_id, recipient_id) do nothing;

  -- Resolve the canonical match row formed (or pre-existing) for this pair.
  select m.id, m.created_at
    into v_match_id, v_match_created_at
  from yearn.matches m
  where m.user_a = least(v_uid, v_sender)
    and m.user_b = greatest(v_uid, v_sender)
  limit 1;

  if v_match_id is null then
    return;
  end if;

  -- Pending iff this match's FIFO rank among my non-archived matches exceeds 10.
  -- Count my non-archived matches that are at or before this one in FIFO order;
  -- the tiebreaker on equal created_at uses id to stay consistent with my_matches.
  v_is_pending := (
    select count(*)
    from yearn.matches m2
    left join yearn.match_archivals a2
      on a2.match_id = m2.id and a2.user_id = v_uid
    where (m2.user_a = v_uid or m2.user_b = v_uid)
      and a2.match_id is null
      and (
        m2.created_at < v_match_created_at
        or (m2.created_at = v_match_created_at and m2.id <= v_match_id)
      )
  ) > 10;

  return query
  select
    m.id as match_id,
    m.created_at as matched_at,
    p.id as other_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified,
    v_is_pending as is_pending
  from yearn.matches m
  join yearn.profiles p on p.id = v_sender
  where m.id = v_match_id
  limit 1;
end;
$$;

revoke execute on function yearn.like_back(uuid) from public, anon;
grant execute on function yearn.like_back(uuid) to authenticated;

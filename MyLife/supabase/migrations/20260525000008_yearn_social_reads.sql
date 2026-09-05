-- Yearn social read path: likes inbox, matches list, and like-back / dismiss RPCs.
-- Apply after 0007_yearn_*.sql. Idempotent.
--
-- These functions back the "who liked me" inbox and the matches screen. Like
-- discover_profiles() in 0006, they return a *computed age* (never the raw
-- birthday) and apply pause / self / block / already-swiped filters server-side.
-- They reuse yearn.is_blocked(a, b) from 0003 so blocks hide people both ways.
-- like_back() and dismiss_like() are the write actions on the inbox; they guard
-- a null auth.uid() because they mutate yearn.likes / yearn.passes.

-- =========================================
-- incoming_likes()
-- Each like sent TO me that is still actionable: the sender is not paused, not
-- blocked, I have not already passed on them, and we are not already matched.
-- SECURITY DEFINER so is_blocked / passes / matches evaluate uniformly.
-- auth.uid() resolves from the caller's JWT, so each viewer gets their own inbox.
-- Returns NO birthday column - only the derived integer age.
-- =========================================
create or replace function yearn.incoming_likes()
returns table (
  like_id uuid,
  note text,
  created_at timestamptz,
  sender_id uuid,
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
    l.id as like_id,
    l.note,
    l.created_at,
    l.sender_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified
  from yearn.likes l
  join yearn.profiles p on p.id = l.sender_id
  where l.recipient_id = auth.uid()
    and p.is_paused = false
    and not yearn.is_blocked(auth.uid(), l.sender_id)
    and not exists (
      select 1 from yearn.passes pa
      where pa.sender_id = auth.uid() and pa.recipient_id = l.sender_id
    )
    and not exists (
      select 1 from yearn.matches m
      where m.user_a = least(auth.uid(), l.sender_id)
        and m.user_b = greatest(auth.uid(), l.sender_id)
    )
  order by l.created_at desc;
$$;

revoke execute on function yearn.incoming_likes() from public, anon;
grant execute on function yearn.incoming_likes() to authenticated;

-- =========================================
-- my_matches()
-- Every match I am part of, joined to the other person's profile. Blocked pairs
-- are excluded in either direction. SECURITY DEFINER for uniform is_blocked
-- evaluation. Returns NO birthday column - only the derived integer age.
-- =========================================
create or replace function yearn.my_matches()
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
  is_verified boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
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
    p.is_verified
  from yearn.matches m
  join yearn.profiles p
    on p.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and not yearn.is_blocked(m.user_a, m.user_b)
  order by m.created_at desc;
$$;

revoke execute on function yearn.my_matches() from public, anon;
grant execute on function yearn.my_matches() to authenticated;

-- =========================================
-- like_back(p_like_id)
-- Accept an incoming like. Inserts my reciprocal like; the existing
-- handle_new_like trigger from 0001 forms the canonical match. Returns the
-- freshly-formed match row in the same shape as my_matches() (at most one row).
-- SECURITY DEFINER + null-uid guard because it writes yearn.likes.
-- =========================================
create or replace function yearn.like_back(p_like_id uuid)
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
  is_verified boolean
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
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
    p.is_verified
  from yearn.matches m
  join yearn.profiles p on p.id = v_sender
  where m.user_a = least(v_uid, v_sender)
    and m.user_b = greatest(v_uid, v_sender)
  limit 1;
end;
$$;

revoke execute on function yearn.like_back(uuid) from public, anon;
grant execute on function yearn.like_back(uuid) to authenticated;

-- =========================================
-- dismiss_like(p_like_id)
-- Decline an incoming like. Records a pass so the sender drops out of both the
-- inbox (incoming_likes) and discovery (discover_profiles). Idempotent: a
-- missing or already-dismissed like is a no-op. SECURITY DEFINER + null-uid
-- guard because it writes yearn.passes.
-- =========================================
create or replace function yearn.dismiss_like(p_like_id uuid)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
begin
  if v_uid is null then
    raise exception 'dismiss_like: not authenticated';
  end if;

  select sender_id into v_sender
  from yearn.likes
  where id = p_like_id and recipient_id = v_uid;

  if v_sender is null then
    return;
  end if;

  insert into yearn.passes (sender_id, recipient_id)
  values (v_uid, v_sender)
  on conflict (sender_id, recipient_id) do nothing;
end;
$$;

revoke execute on function yearn.dismiss_like(uuid) from public, anon;
grant execute on function yearn.dismiss_like(uuid) to authenticated;

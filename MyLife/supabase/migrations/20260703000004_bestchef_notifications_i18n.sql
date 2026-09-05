-- Backend notifications stop speaking English (plan 33 Phase 2.1, finding N1).
--
-- bc_notifications rows used to store English titles/bodies baked inside
-- Postgres ("<name> upvoted your recipe", tier labels, to_char dates), which
-- ships English to every locale and makes stored rows unmigratable later.
-- From this migration on:
--   * rows carry kind (the type) + params jsonb; title/body are written EMPTY
--   * clients render localized copy from kind + params via the i18n catalogs
--   * existing rows are backfilled with best-effort params (actor name via
--     profile join, comment snippet from body); their legacy English
--     title/body remains as a render fallback for pre-typed rows
--   * bc_profile_activity_v exposes params per branch; its legacy
--     title/subtitle columns stay TEMPORARILY (computed, nothing stored) so
--     TestFlight build 24 keeps rendering, and drop once build 25 is the floor
--
-- Ordering is load-bearing: this must land before any non-EN user exists
-- (plan 33 risk register).

alter table public.bc_notifications
  add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.bc_notifications
  alter column title set default '';

-- ── Fanout functions: kind + params only ─────────────────────────────

create or replace function public.bc_notify_upvote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
  v_dish_title text;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  select coalesce(r.title, d.name) into v_dish_title
    from public.bc_submissions s
    join public.bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
    join public.bc_dishes d on d.id = s.dish_id
   where s.id = submission_id;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_author_user_id, 'upvote', 'votes', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'actor_name', v_actor_name,
       'dish_title', v_dish_title
     )),
     v_actor_user_id, v_actor_name, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_reviewed_vote(
  submission_id uuid,
  actor_id uuid,
  tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
begin
  if tier not in ('gold', 'silver', 'bronze') then
    return;
  end if;

  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  select user_id, coalesce(display_name, handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles
   where id = actor_id;

  if v_author_profile_id is null
     or v_author_profile_id = actor_id
     or v_author_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_author_user_id, 'reviewed_vote', 'votes', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'actor_name', v_actor_name,
       'tier', tier
     )),
     v_actor_user_id, v_actor_name, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_follow(
  follower_id uuid,
  chef_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chef_user_id uuid;
  v_follower_user_id uuid;
  v_name text;
begin
  if follower_id = chef_id then
    return;
  end if;

  select user_id, coalesce(display_name, handle)
    into v_follower_user_id, v_name
    from public.social_profiles
   where id = follower_id;

  select user_id into v_chef_user_id
    from public.social_profiles
   where id = chef_id;

  if v_chef_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, params, actor_user_id, actor_name, target_type, target_id)
  values
    (v_chef_user_id, 'follow', 'social', '',
     jsonb_strip_nulls(jsonb_build_object('actor_name', v_name)),
     v_follower_user_id, v_name, 'chef', follower_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_comment(
  submission_id uuid,
  comment_id uuid,
  actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_profile_id uuid;
  v_author_user_id uuid;
  v_actor_user_id uuid;
  v_actor_name text;
  v_body text;
  v_parent_id uuid;
  v_parent_author_profile_id uuid;
  v_parent_author_user_id uuid;
  v_handle text;
  v_mention_profile_id uuid;
  v_mention_user_id uuid;
begin
  select s.profile_id, p.user_id
    into v_author_profile_id, v_author_user_id
    from public.bc_submissions s
    join public.social_profiles p on p.id = s.profile_id
   where s.id = submission_id;

  if v_author_profile_id is null then
    return;
  end if;

  select p.user_id, coalesce(p.display_name, p.handle)
    into v_actor_user_id, v_actor_name
    from public.social_profiles p
   where p.id = actor_id;

  select c.body, c.parent_id
    into v_body, v_parent_id
    from public.bc_comments c
   where c.id = comment_id;

  if v_author_profile_id <> actor_id and v_author_user_id is not null then
    insert into public.bc_notifications
      (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
    values
      (v_author_user_id, 'comment', 'social', '', '',
       jsonb_strip_nulls(jsonb_build_object(
         'actor_name', v_actor_name,
         'snippet', left(coalesce(v_body, ''), 120),
         'reply', false
       )),
       v_actor_user_id, v_actor_name, 'submission', submission_id::text);
  end if;

  if v_parent_id is not null then
    select c.profile_id, p.user_id
      into v_parent_author_profile_id, v_parent_author_user_id
      from public.bc_comments c
      join public.social_profiles p on p.id = c.profile_id
     where c.id = v_parent_id;

    if v_parent_author_profile_id is not null
       and v_parent_author_profile_id <> actor_id
       and v_parent_author_profile_id <> v_author_profile_id
       and v_parent_author_user_id is not null then
      insert into public.bc_notifications
        (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
      values
        (v_parent_author_user_id, 'comment', 'social', '', '',
         jsonb_strip_nulls(jsonb_build_object(
           'actor_name', v_actor_name,
           'snippet', left(coalesce(v_body, ''), 120),
           'reply', true
         )),
         v_actor_user_id, v_actor_name, 'submission', submission_id::text);
    end if;
  end if;

  if v_body is not null then
    for v_handle in
      select distinct (regexp_matches(v_body, '@([A-Za-z0-9_]+)', 'g'))[1]
    loop
      select p.id, p.user_id
        into v_mention_profile_id, v_mention_user_id
        from public.social_profiles p
       where lower(p.handle) = lower(v_handle)
       limit 1;

      if v_mention_profile_id is not null
         and v_mention_profile_id <> actor_id
         and v_mention_user_id is not null then
        insert into public.bc_notifications
          (user_id, kind, category, title, body, params, actor_user_id, actor_name, target_type, target_id)
        values
          (v_mention_user_id, 'mention', 'social', '', '',
           jsonb_strip_nulls(jsonb_build_object(
             'actor_name', v_actor_name,
             'snippet', left(v_body, 120)
           )),
           v_actor_user_id, v_actor_name, 'submission', submission_id::text);
      end if;
    end loop;
  end if;
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_rank_change(
  chef_id uuid,
  old_rank int,
  new_rank int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_kind text;
  v_milestone int;
begin
  if new_rank >= old_rank then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  v_kind := 'rank_up';
  foreach v_milestone in array array[1, 3, 10, 25, 50, 100] loop
    if old_rank > v_milestone and new_rank <= v_milestone then
      v_kind := 'rank_milestone';
      exit;
    end if;
  end loop;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, v_kind, 'ranks', '', '',
     jsonb_build_object(
       'new_rank', new_rank,
       'old_rank', old_rank,
       'delta', old_rank - new_rank
     ),
     'chef', chef_id::text);
exception when others then
  null;
end;
$$;

create or replace function public.bc_notify_badge(
  chef_id uuid,
  badge_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name text;
  v_desc text;
begin
  select user_id into v_user_id
    from public.social_profiles
   where id = chef_id;

  if v_user_id is null then
    return;
  end if;

  select name, description into v_name, v_desc
    from public.bc_badge_definitions
   where id = badge_id;

  if v_name is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'badge', 'system', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'badge_id', badge_id,
       'badge_name', v_name,
       'badge_description', v_desc
     )),
     'badge', badge_id);
exception when others then
  null;
end;
$$;

-- ── Backfill existing rows to typed form (best-effort) ───────────────

update public.bc_notifications n
set params = n.params
  || coalesce(
       (select jsonb_build_object('actor_name', coalesce(p.display_name, p.handle))
          from public.social_profiles p
         where p.user_id = n.actor_user_id
         limit 1),
       '{}'::jsonb
     )
  || case
       when n.kind in ('comment', 'mention') and n.body <> ''
         then jsonb_build_object('snippet', left(n.body, 120))
       else '{}'::jsonb
     end
where n.params = '{}'::jsonb;

-- ── Activity view v2: params per branch ──────────────────────────────
-- Legacy English title/subtitle stay temporarily (view-computed, nothing
-- stored) so pre-params clients keep rendering; drop with build 25.
-- drop+create because create-or-replace cannot insert the params column.

drop view if exists public.bc_profile_activity_v;
create view public.bc_profile_activity_v as
select
  concat('rank:', chef_id::text, ':', week::text) as id,
  chef_id,
  'rank_change'::text as kind,
  'trophy.fill' as icon,
  '#EAB308' as tint,
  concat('Climbed to #', rank) as title,
  concat('Week of ', to_char(week, 'Mon DD')) as subtitle,
  jsonb_build_object('rank', rank, 'week', week::text) as params,
  week::timestamptz as occurred_at,
  null::text as target_route
from public.bc_rank_history
where week >= current_date - interval '30 days'
union all
select
  concat('reviewed:', v.id) as id,
  s.profile_id as chef_id,
  'reviewed_vote'::text as kind,
  'checkmark.seal.fill' as icon,
  '#22C55E' as tint,
  concat(initcap(v.tier::text), ' vote received') as title,
  'On your submission' as subtitle,
  jsonb_build_object('tier', v.tier) as params,
  v.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier in ('gold', 'silver', 'bronze')
  and v.created_at >= now() - interval '14 days'
union all
select
  concat('follow:', follower_id::text, ':', chef_id::text) as id,
  chef_id,
  'new_follower'::text as kind,
  'person.badge.plus' as icon,
  '#3B82F6' as tint,
  'New follower' as title,
  '' as subtitle,
  '{}'::jsonb as params,
  created_at as occurred_at,
  null::text as target_route
from public.bc_followers
where created_at >= now() - interval '14 days'
union all
select
  concat('badge:', cb.id) as id,
  cb.profile_id as chef_id,
  'badge'::text as kind,
  'rosette' as icon,
  '#F97316' as tint,
  concat(bd.name, ' unlocked') as title,
  bd.description as subtitle,
  jsonb_build_object('badge_name', bd.name, 'badge_description', bd.description) as params,
  cb.earned_at as occurred_at,
  null::text as target_route
from public.bc_chef_badges cb
join public.bc_badge_definitions bd on bd.id = cb.badge_id
where cb.earned_at >= now() - interval '30 days'
union all
select
  concat('upvotes:', s.id, ':', date_trunc('day', v.created_at)::text) as id,
  s.profile_id as chef_id,
  'upvotes'::text as kind,
  'hand.thumbsup.fill' as icon,
  '#EF4444' as tint,
  concat(count(v.id), ' new upvotes') as title,
  'On your submission' as subtitle,
  jsonb_build_object('count', count(v.id)) as params,
  max(v.created_at) as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier = 'tap_up'
  and v.created_at >= now() - interval '7 days'
group by s.id, s.profile_id, date_trunc('day', v.created_at)
union all
select
  concat('posted:', s.id) as id,
  s.profile_id as chef_id,
  'posted_recipe'::text as kind,
  'fork.knife' as icon,
  '#A855F7' as tint,
  'Posted a recipe' as title,
  'Entered the competition' as subtitle,
  '{}'::jsonb as params,
  s.created_at as occurred_at,
  concat('/submission/', s.id) as target_route
from public.bc_submissions s
where s.created_at >= now() - interval '14 days'
  and s.moderation_status = 'approved';

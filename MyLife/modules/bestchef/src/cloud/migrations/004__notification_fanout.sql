-- P1-C: Notification fanout RPCs (SECURITY DEFINER, service-role owned).
-- All functions write to bc_notifications. No direct client insert policy exists.

-- Helper: resolve user_id from a social_profiles.id (profile FK -> auth.users).
-- bc_notifications.user_id references auth.users, profiles use their own UUIDs
-- that equal auth.users.id by convention in this schema.

-- ── 1. Upvote notification ──────────────────────────────────────────────
create or replace function bc_notify_upvote(
  submission_id uuid,
  actor_id      uuid,   -- voter's auth.users id
  tier          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_title     text;
  v_sub_title text;
begin
  -- Look up submission author
  select profile_id into v_author_id
  from   bc_submissions
  where  id = submission_id;

  -- Skip if author is the actor (self-vote guard)
  if v_author_id is null or v_author_id = actor_id then
    return;
  end if;

  -- Best-effort actor name lookup
  select coalesce(display_name, handle, 'Someone') into v_title
  from   social_profiles
  where  id = actor_id;

  -- Best-effort submission title
  select coalesce(r.title, d.name, 'your recipe') into v_sub_title
  from   bc_submissions s
  join   bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
  join   bc_dishes d           on d.id = s.dish_id
  where  s.id = submission_id;

  insert into bc_notifications
    (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
  values
    (v_author_id, 'upvote', 'votes',
     v_title || ' upvoted your recipe',
     v_sub_title,
     actor_id, 'submission', submission_id::text);
exception when others then
  -- fire-and-forget: never surface to caller
  null;
end;
$$;

-- ── 2. Reviewed-vote notification (gold / silver / bronze only) ─────────
create or replace function bc_notify_reviewed_vote(
  submission_id uuid,
  actor_id      uuid,
  tier          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_title     text;
  v_tier_label text;
begin
  -- Only emit for reviewed tiers
  if tier not in ('gold', 'silver', 'bronze') then
    return;
  end if;

  select profile_id into v_author_id
  from   bc_submissions
  where  id = submission_id;

  if v_author_id is null or v_author_id = actor_id then
    return;
  end if;

  select coalesce(display_name, handle, 'Someone') into v_title
  from   social_profiles
  where  id = actor_id;

  v_tier_label := case tier
    when 'gold'   then 'Best Chef'
    when 'silver' then 'As good as momma''s'
    when 'bronze' then 'I''d eat that'
    else tier
  end;

  insert into bc_notifications
    (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
  values
    (v_author_id, 'reviewed_vote', 'votes',
     v_title || ' rated your recipe',
     v_tier_label,
     actor_id, 'submission', submission_id::text);
exception when others then
  null;
end;
$$;

-- ── 3. Follow notification ──────────────────────────────────────────────
create or replace function bc_notify_follow(
  follower_id uuid,
  chef_id     uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if follower_id = chef_id then
    return;
  end if;

  select coalesce(display_name, handle, 'Someone') into v_name
  from   social_profiles
  where  id = follower_id;

  insert into bc_notifications
    (user_id, kind, category, title, actor_user_id, target_type, target_id)
  values
    (chef_id, 'follow', 'social',
     v_name || ' started following you',
     follower_id, 'chef', follower_id::text);
exception when others then
  null;
end;
$$;

-- ── 4. Comment notification (+ optional mention per @-tag) ──────────────
create or replace function bc_notify_comment(
  submission_id uuid,
  comment_id    uuid,
  actor_id      uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id  uuid;
  v_actor_name text;
  v_body       text;
  v_handle     text;
  v_mention_id uuid;
begin
  select profile_id into v_author_id
  from   bc_submissions
  where  id = submission_id;

  if v_author_id is null then
    return;
  end if;

  select coalesce(display_name, handle, 'Someone') into v_actor_name
  from   social_profiles
  where  id = actor_id;

  select body into v_body
  from   bc_comments
  where  id = comment_id;

  -- Comment notification to submission author (skip if self-comment)
  if v_author_id <> actor_id then
    insert into bc_notifications
      (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
    values
      (v_author_id, 'comment', 'social',
       v_actor_name || ' commented on your recipe',
       left(coalesce(v_body, ''), 120),
       actor_id, 'submission', submission_id::text);
  end if;

  -- Mention notifications: scan comment body for @handle patterns
  if v_body is not null then
    for v_handle in
      select distinct (regexp_matches(v_body, '@([A-Za-z0-9_]+)', 'g'))[1]
    loop
      select id into v_mention_id
      from   social_profiles
      where  handle = v_handle
      limit  1;

      if v_mention_id is not null and v_mention_id <> actor_id then
        insert into bc_notifications
          (user_id, kind, category, title, body, actor_user_id, target_type, target_id)
        values
          (v_mention_id, 'mention', 'social',
           v_actor_name || ' mentioned you in a comment',
           left(v_body, 120),
           actor_id, 'submission', submission_id::text);
      end if;
    end loop;
  end if;

exception when others then
  null;
end;
$$;

-- ── 5. Rank change notification ─────────────────────────────────────────
create or replace function bc_notify_rank_change(
  chef_id  uuid,
  old_rank int,
  new_rank int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind  text;
  v_title text;
  v_body  text;
  m       int;
begin
  -- Only notify on improvement
  if new_rank >= old_rank then
    return;
  end if;

  -- Check milestone crossing (1, 3, 10, 25, 50, 100)
  v_kind := 'rank_up';
  foreach m in array array[1, 3, 10, 25, 50, 100] loop
    if old_rank > m and new_rank <= m then
      v_kind := 'rank_milestone';
      exit;
    end if;
  end loop;

  v_title := case
    when v_kind = 'rank_milestone' then 'You climbed to #' || new_rank || '!'
    else 'You moved up to #' || new_rank
  end;

  v_body := 'Up ' || (old_rank - new_rank) || ' rank' ||
            case when (old_rank - new_rank) > 1 then 's' else '' end ||
            ' this week';

  insert into bc_notifications
    (user_id, kind, category, title, body)
  values
    (chef_id, v_kind, 'ranks', v_title, v_body);

exception when others then
  null;
end;
$$;

-- ── 6. Badge notification ───────────────────────────────────────────────
create or replace function bc_notify_badge(
  chef_id  uuid,
  badge_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_desc text;
begin
  select name, description into v_name, v_desc
  from   bc_badge_definitions
  where  id = badge_id;

  if v_name is null then
    return;
  end if;

  insert into bc_notifications
    (user_id, kind, category, title, body, target_type, target_id)
  values
    (chef_id, 'badge', 'system',
     v_name || ' unlocked',
     coalesce(v_desc, ''),
     'badge', badge_id);

exception when others then
  null;
end;
$$;

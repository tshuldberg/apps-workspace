-- P1-D: Profile activity view.
-- Aggregates rank changes, reviewed votes, upvote deltas, badges, followers,
-- and posted recipes into a single queryable surface for the profile screen.

create or replace view public.bc_profile_activity_v as

-- Rank changes (from bc_rank_history)
select
  concat('rank:', chef_id::text, ':', week::text)  as id,
  chef_id,
  'rank_change'::text                               as kind,
  'trophy.fill'                                     as icon,
  '#EAB308'                                         as tint,
  concat('Climbed to #', rank)                      as title,
  concat('Week of ', to_char(week, 'Mon DD'))       as subtitle,
  week::timestamptz                                 as occurred_at,
  null::text                                        as target_route
from public.bc_rank_history
where week >= current_date - interval '30 days'

union all

-- Reviewed votes received (gold/silver/bronze) in last 14 days
select
  concat('reviewed:', v.id)                         as id,
  s.profile_id                                      as chef_id,
  'reviewed_vote'::text                             as kind,
  'checkmark.seal.fill'                             as icon,
  '#22C55E'                                         as tint,
  concat(initcap(v.tier), ' vote received')         as title,
  concat('On your submission')                      as subtitle,
  v.created_at                                      as occurred_at,
  concat('/submission/', s.id)                      as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier in ('gold', 'silver', 'bronze')
  and v.created_at >= now() - interval '14 days'

union all

-- New followers in last 14 days (one row per new follower)
select
  concat('follow:', follower_id::text, ':', chef_id::text) as id,
  chef_id,
  'new_follower'::text                              as kind,
  'person.badge.plus'                               as icon,
  '#3B82F6'                                         as tint,
  'New follower'                                    as title,
  ''                                                as subtitle,
  created_at                                        as occurred_at,
  null::text                                        as target_route
from public.bc_followers
where created_at >= now() - interval '14 days'

union all

-- Badges earned in last 30 days
select
  concat('badge:', cb.id)                           as id,
  cb.profile_id                                     as chef_id,
  'badge'::text                                     as kind,
  'rosette'                                         as icon,
  '#F97316'                                         as tint,
  concat(bd.name, ' unlocked')                      as title,
  bd.description                                    as subtitle,
  cb.earned_at                                      as occurred_at,
  null::text                                        as target_route
from public.bc_chef_badges cb
join public.bc_badge_definitions bd on bd.id = cb.badge_id
where cb.earned_at >= now() - interval '30 days'

union all

-- Upvotes received in last 7 days, grouped per submission
select
  concat('upvotes:', s.id, ':', date_trunc('day', v.created_at)::text) as id,
  s.profile_id                                      as chef_id,
  'upvotes'::text                                   as kind,
  'hand.thumbsup.fill'                              as icon,
  '#EF4444'                                         as tint,
  concat(count(v.id), ' new upvotes')               as title,
  concat('On your submission')                      as subtitle,
  max(v.created_at)                                 as occurred_at,
  concat('/submission/', s.id)                      as target_route
from public.bc_votes v
join public.bc_submissions s on s.id = v.submission_id
where v.tier = 'tap_up'
  and v.created_at >= now() - interval '7 days'
group by s.id, s.profile_id, date_trunc('day', v.created_at)

union all

-- Posted submissions in last 14 days
select
  concat('posted:', s.id)                           as id,
  s.profile_id                                      as chef_id,
  'posted_recipe'::text                             as kind,
  'fork.knife'                                      as icon,
  '#A855F7'                                         as tint,
  concat('Posted a recipe')                         as title,
  concat('Entered the competition')                 as subtitle,
  s.created_at                                      as occurred_at,
  concat('/submission/', s.id)                      as target_route
from public.bc_submissions s
where s.created_at >= now() - interval '14 days'
  and s.moderation_status = 'approved';

-- RLS: view inherits underlying table policies. Row access is controlled
-- by the caller filtering on chef_id; no separate policy needed on the view.
comment on view public.bc_profile_activity_v is
  'Unified activity feed for a chef profile. Filter by chef_id and order by occurred_at desc.';

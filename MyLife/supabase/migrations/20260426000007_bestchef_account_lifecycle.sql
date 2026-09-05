-- BestChef production account lifecycle foundation.
-- Public deletion and recovery still require Supabase Auth provider setup and
-- a service-role Edge Function to delete auth.users and storage objects.

create table if not exists bc_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references social_profiles(id) on delete set null,
  status text not null default 'requested' check (status in (
    'requested',
    'processing',
    'completed',
    'cancelled',
    'rejected',
    'failed'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_profile_id uuid references social_profiles(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists bc_account_deletion_requests_user_idx
  on bc_account_deletion_requests (user_id, requested_at desc);
create index if not exists bc_account_deletion_requests_profile_idx
  on bc_account_deletion_requests (profile_id, requested_at desc);
create index if not exists bc_account_deletion_requests_status_idx
  on bc_account_deletion_requests (status, requested_at desc);
create unique index if not exists bc_account_deletion_requests_one_open_idx
  on bc_account_deletion_requests (user_id)
  where status in ('requested', 'processing');

create table if not exists bc_account_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references social_profiles(id) on delete set null,
  target_profile_id uuid references social_profiles(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'identity_status_checked',
    'account_deletion_requested',
    'account_deletion_status_changed',
    'profile_owned_row_counted',
    'profile_merge_conflicts_checked'
  )),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bc_account_lifecycle_events_actor_idx
  on bc_account_lifecycle_events (actor_profile_id, created_at desc);
create index if not exists bc_account_lifecycle_events_target_profile_idx
  on bc_account_lifecycle_events (target_profile_id, created_at desc);
create index if not exists bc_account_lifecycle_events_target_user_idx
  on bc_account_lifecycle_events (target_user_id, created_at desc);
create index if not exists bc_account_lifecycle_events_type_idx
  on bc_account_lifecycle_events (event_type, created_at desc);

alter table bc_account_deletion_requests enable row level security;
alter table bc_account_lifecycle_events enable row level security;

drop policy if exists "bc_account_deletion_requests_read" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_read"
  on bc_account_deletion_requests for select
  using (user_id = auth.uid() or bc_is_admin());

drop policy if exists "bc_account_deletion_requests_insert" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_insert"
  on bc_account_deletion_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "bc_account_deletion_requests_update" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_update"
  on bc_account_deletion_requests for update
  using (bc_is_admin())
  with check (bc_is_admin());

drop policy if exists "bc_account_deletion_requests_delete" on bc_account_deletion_requests;
create policy "bc_account_deletion_requests_delete"
  on bc_account_deletion_requests for delete
  using (bc_is_admin());

drop policy if exists "bc_account_lifecycle_events_read" on bc_account_lifecycle_events;
create policy "bc_account_lifecycle_events_read"
  on bc_account_lifecycle_events for select
  using (
    bc_is_admin()
    or target_user_id = auth.uid()
    or bc_profile_owned(actor_profile_id)
    or bc_profile_owned(target_profile_id)
  );

drop policy if exists "bc_account_lifecycle_events_insert" on bc_account_lifecycle_events;
create policy "bc_account_lifecycle_events_insert"
  on bc_account_lifecycle_events for insert
  with check (bc_is_admin());

create or replace function bc_current_identity_status()
returns jsonb as $$
declare
  current_profile social_profiles%rowtype;
  jwt jsonb := auth.jwt();
  anonymous_claim boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into current_profile
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  anonymous_claim := coalesce((jwt->>'is_anonymous')::boolean, false);

  return jsonb_build_object(
    'user_id', auth.uid(),
    'profile_id', current_profile.id,
    'is_anonymous', anonymous_claim,
    'has_profile', current_profile.id is not null,
    'role', coalesce(jwt->'app_metadata'->>'role', 'authenticated'),
    'roles', coalesce(jwt->'app_metadata'->'roles', '[]'::jsonb)
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function bc_request_account_deletion(
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bc_account_deletion_requests as $$
declare
  current_profile_id uuid;
  existing_request bc_account_deletion_requests%rowtype;
  saved_request bc_account_deletion_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into current_profile_id
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  select *
  into existing_request
  from bc_account_deletion_requests
  where user_id = auth.uid()
    and status in ('requested', 'processing')
  order by requested_at desc
  limit 1;

  if found then
    return existing_request;
  end if;

  insert into bc_account_deletion_requests (
    user_id,
    profile_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    current_profile_id,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into saved_request;

  insert into bc_account_lifecycle_events (
    actor_profile_id,
    target_profile_id,
    target_user_id,
    event_type,
    reason,
    metadata
  )
  values (
    current_profile_id,
    current_profile_id,
    auth.uid(),
    'account_deletion_requested',
    p_reason,
    jsonb_build_object('request_id', saved_request.id)
      || coalesce(p_metadata, '{}'::jsonb)
  );

  return saved_request;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_profile_owned_row_counts(p_profile_id uuid)
returns jsonb as $$
declare
  counts jsonb;
begin
  if p_profile_id is null then
    raise exception 'Profile id is required';
  end if;

  if not (bc_is_admin() or bc_profile_owned(p_profile_id)) then
    raise exception 'Not authorized to inspect this profile';
  end if;

  counts := jsonb_build_object(
    'bc_recipe_snapshots.profile_id', (select count(*) from bc_recipe_snapshots where profile_id = p_profile_id),
    'bc_media_assets.owner_profile_id', (select count(*) from bc_media_assets where owner_profile_id = p_profile_id),
    'bc_product_records.created_by_profile_id', (select count(*) from bc_product_records where created_by_profile_id = p_profile_id),
    'bc_product_records.verified_by_profile_id', (select count(*) from bc_product_records where verified_by_profile_id = p_profile_id),
    'bc_product_contributions.profile_id', (select count(*) from bc_product_contributions where profile_id = p_profile_id),
    'bc_product_contributions.reviewed_by_profile_id', (select count(*) from bc_product_contributions where reviewed_by_profile_id = p_profile_id),
    'bc_product_evidence.owner_profile_id', (select count(*) from bc_product_evidence where owner_profile_id = p_profile_id),
    'bc_submissions.profile_id', (select count(*) from bc_submissions where profile_id = p_profile_id),
    'bc_votes.voter_profile_id', (select count(*) from bc_votes where voter_profile_id = p_profile_id),
    'bc_comments.profile_id', (select count(*) from bc_comments where profile_id = p_profile_id),
    'bc_comment_helpful.voter_profile_id', (select count(*) from bc_comment_helpful where voter_profile_id = p_profile_id),
    'bc_photo_reports.reporter_id', (select count(*) from bc_photo_reports where reporter_id = p_profile_id),
    'bc_flags.flagger_id', (select count(*) from bc_flags where flagger_id = p_profile_id),
    'bc_notes.author_id', (select count(*) from bc_notes where author_id = p_profile_id),
    'bc_note_ratings.rater_id', (select count(*) from bc_note_ratings where rater_id = p_profile_id),
    'bc_chef_badges.profile_id', (select count(*) from bc_chef_badges where profile_id = p_profile_id),
    'bc_creator_applications.profile_id', (select count(*) from bc_creator_applications where profile_id = p_profile_id),
    'bc_tips.tipper_id', (select count(*) from bc_tips where tipper_id = p_profile_id),
    'bc_tips.chef_id', (select count(*) from bc_tips where chef_id = p_profile_id),
    'bc_subscription_tiers.chef_id', (select count(*) from bc_subscription_tiers where chef_id = p_profile_id),
    'bc_subscriptions.subscriber_id', (select count(*) from bc_subscriptions where subscriber_id = p_profile_id),
    'bc_subscriptions.chef_id', (select count(*) from bc_subscriptions where chef_id = p_profile_id),
    'bc_posts.author_id', (select count(*) from bc_posts where author_id = p_profile_id),
    'bc_recipe_forks.forked_by_profile_id', (select count(*) from bc_recipe_forks where forked_by_profile_id = p_profile_id),
    'bc_affiliate_orders.chef_id', (select count(*) from bc_affiliate_orders where chef_id = p_profile_id),
    'bc_hubs.owner_profile_id', (select count(*) from bc_hubs where owner_profile_id = p_profile_id),
    'bc_submission_aliases.created_by_profile_id', (select count(*) from bc_submission_aliases where created_by_profile_id = p_profile_id)
  );

  insert into bc_account_lifecycle_events (
    actor_profile_id,
    target_profile_id,
    target_user_id,
    event_type,
    metadata
  )
  select
    viewer.id,
    p_profile_id,
    auth.uid(),
    'profile_owned_row_counted',
    counts
  from social_profiles viewer
  where viewer.user_id = auth.uid()
  limit 1;

  return counts;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_profile_merge_conflicts(
  p_source_profile_id uuid,
  p_target_profile_id uuid
)
returns jsonb as $$
declare
  conflicts jsonb;
begin
  if not bc_is_admin() then
    raise exception 'Not authorized to inspect profile merge conflicts';
  end if;

  if p_source_profile_id is null or p_target_profile_id is null then
    raise exception 'Source and target profile ids are required';
  end if;

  conflicts := jsonb_build_object(
    'bc_votes.same_submission', (
      select count(*)
      from bc_votes source_vote
      where source_vote.voter_profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_votes target_vote
          where target_vote.submission_id = source_vote.submission_id
            and target_vote.voter_profile_id = p_target_profile_id
        )
    ),
    'bc_comment_helpful.same_comment', (
      select count(*)
      from bc_comment_helpful source_helpful
      where source_helpful.voter_profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_comment_helpful target_helpful
          where target_helpful.comment_id = source_helpful.comment_id
            and target_helpful.voter_profile_id = p_target_profile_id
        )
    ),
    'bc_note_ratings.same_note', (
      select count(*)
      from bc_note_ratings source_rating
      where source_rating.rater_id = p_source_profile_id
        and exists (
          select 1
          from bc_note_ratings target_rating
          where target_rating.note_id = source_rating.note_id
            and target_rating.rater_id = p_target_profile_id
        )
    ),
    'bc_chef_badges.same_badge', (
      select count(*)
      from bc_chef_badges source_badge
      where source_badge.profile_id = p_source_profile_id
        and exists (
          select 1
          from bc_chef_badges target_badge
          where target_badge.badge_id = source_badge.badge_id
            and target_badge.profile_id = p_target_profile_id
        )
    )
  );

  insert into bc_account_lifecycle_events (
    target_profile_id,
    target_user_id,
    event_type,
    metadata
  )
  values (
    p_source_profile_id,
    auth.uid(),
    'profile_merge_conflicts_checked',
    jsonb_build_object(
      'source_profile_id', p_source_profile_id,
      'target_profile_id', p_target_profile_id,
      'conflicts', conflicts
    )
  );

  return conflicts;
end;
$$ language plpgsql security definer set search_path = public;

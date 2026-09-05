-- BestChef plan 33 Phase 5.6 (F-010): cloud bookmarks.
-- bc_saved_submissions is the durable backing for the video-feed and
-- submission bookmark affordances. Saves are PRIVATE library data: unlike
-- bc_submission_likes, only the owner (or an admin) can read who saved
-- what. Writes ride the CHF-1 durable action-quota engine ('save').

create table if not exists bc_saved_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_saved_submissions_unique unique (profile_id, submission_id)
);

create index if not exists bc_saved_submissions_profile_idx
  on bc_saved_submissions (profile_id, created_at desc);
create index if not exists bc_saved_submissions_submission_idx
  on bc_saved_submissions (submission_id);

alter table bc_saved_submissions enable row level security;

drop policy if exists "bc_saved_submissions_read" on bc_saved_submissions;
create policy "bc_saved_submissions_read" on bc_saved_submissions for select using (
  bc_profile_owned(profile_id) or bc_is_admin()
);
drop policy if exists "bc_saved_submissions_insert" on bc_saved_submissions;
create policy "bc_saved_submissions_insert" on bc_saved_submissions for insert with check (
  bc_profile_owned(profile_id)
  and bc_submission_visible(submission_id)
);
drop policy if exists "bc_saved_submissions_delete" on bc_saved_submissions;
create policy "bc_saved_submissions_delete" on bc_saved_submissions for delete using (
  bc_profile_owned(profile_id) or bc_is_admin()
);

-- Durable rate limit: same ceiling as likes (cheap, reversible action).
insert into public.bc_action_limits (action, max_count, window_seconds)
values ('save', 200, 3600)
on conflict (action) do nothing;

drop trigger if exists bc_saved_submissions_action_quota on public.bc_saved_submissions;
create trigger bc_saved_submissions_action_quota
  before insert on public.bc_saved_submissions
  for each row execute function public.bc_enforce_action_quota('save', 'profile_id');

-- DSAR/inventory completeness: the pre-deletion row-count manifest must
-- include saved submissions (review finding, GDPR data inventory).
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
    'bc_submission_likes.profile_id', (select count(*) from bc_submission_likes where profile_id = p_profile_id),
    'bc_saved_submissions.profile_id', (select count(*) from bc_saved_submissions where profile_id = p_profile_id),
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

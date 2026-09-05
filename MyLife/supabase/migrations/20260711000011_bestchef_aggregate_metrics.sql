-- BestChef privacy-respecting aggregate metrics (plan 45 item 2.5, audit L7).
--
-- Audit L7: BestChef ships with the MyLife privacy-first "zero analytics, zero
-- telemetry" default, so launch waves produce no learning at all. The honest fix
-- for this codebase is NOT a third-party analytics SDK, device identifiers, or a
-- per-user event trail. It is a small set of AGGREGATE, SERVER-SIDE daily counters
-- incremented as a side effect of actions the server already processes through its
-- own SECURITY DEFINER chokepoints (votes, submissions, reports, appeals, push
-- registration, deletion, terms acceptance). No client-side tracking, no device
-- IDs, no user lists: only per-day integer counts land in bc_daily_metrics.
--
-- What is deliberately NOT collected here:
--   * No device identifiers, IDFA/GAID, IP, or user-agent.
--   * No per-user event trail (we never record WHO acted, only that a counted
--     action happened on a given UTC day).
--   * No client-side SDK or tracking library (app clients are untouched by this
--     migration by design).
--   * No distinct-user (DAU/MAU) tables. Engagement is proxied by the raw
--     votes/submissions/comments counts and labelled as such, not by any
--     per-user set or HyperLogLog sketch.

-- ---------------------------------------------------------------------------
-- 1. Aggregate counter table: (day, metric) -> count. Definer-only, zero client
--    policies. Only SECURITY DEFINER functions and service_role touch it.
-- ---------------------------------------------------------------------------

create table if not exists public.bc_daily_metrics (
  day date not null default (now() at time zone 'utc')::date,
  metric text not null,
  count bigint not null default 0,
  primary key (day, metric)
);

create index if not exists bc_daily_metrics_metric_day_idx
  on public.bc_daily_metrics (metric, day desc);

alter table public.bc_daily_metrics enable row level security;

-- No policies are created on purpose: RLS with zero policies denies all
-- anon/authenticated access. Reads happen through the moderator console's
-- service-role client; writes happen only inside the definer helper below.
revoke all on table public.bc_daily_metrics from public, anon, authenticated;

comment on table public.bc_daily_metrics is
  'Aggregate-only privacy-respecting launch metrics (plan 45 item 2.5). '
  'Per-day integer counts of server-observed actions. No device IDs, no '
  'per-user trails, no client SDK. RLS with zero policies; definer-write, '
  'service-role-read only.';

-- ---------------------------------------------------------------------------
-- 2. bc_bump_metric: upsert-increment one counter for the current UTC day.
--    SECURITY DEFINER so it can write the definer-only table. Exception-
--    swallowing so a metrics failure can NEVER abort or roll back the caller
--    (a vote, submission, report, etc. must succeed even if metrics break).
-- ---------------------------------------------------------------------------

create or replace function public.bc_bump_metric(p_metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_metric is null or length(trim(p_metric)) = 0 then
    return;
  end if;

  insert into public.bc_daily_metrics (day, metric, count)
  values ((now() at time zone 'utc')::date, trim(p_metric), 1)
  on conflict (day, metric) do update
    set count = public.bc_daily_metrics.count + 1;
exception
  when others then
    -- Metrics are best-effort. Never let a counter failure surface to, or roll
    -- back, the business transaction that called us.
    return;
end;
$$;

revoke all on function public.bc_bump_metric(text) from public, anon, authenticated;

comment on function public.bc_bump_metric(text) is
  'Best-effort aggregate daily counter increment. Exception-swallowing so it '
  'can never abort a caller. Definer-only.';

-- ---------------------------------------------------------------------------
-- 3. bc_cast_vote v6: FAITHFUL COPY of v5 (20260711000003) plus a single
--    additive metric tail. Every clause below is byte-for-byte the v5 body
--    except for the final bc_bump_metric('votes') call added immediately before
--    the closing return. The bump sits after all commits/inserts and cannot
--    change the returned result (it returns void and swallows its own errors).
-- ---------------------------------------------------------------------------

create or replace function public.bc_cast_vote(
  p_submission_id uuid,
  p_tier text,
  p_media_asset_id uuid
) returns table (
  vote_id uuid,
  proof_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_author_profile_id uuid;
  v_asset public.bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
  v_quota jsonb;
  v_hash_reuse integer := 0;
  v_is_anonymous boolean := false;
  v_account_created_at timestamptz;
  v_recent_anonymous_vote_count integer := 0;
  v_anonymous_vote_burst boolean := false;
  v_young_anonymous_account boolean := false;
  v_anonymous_vote_burst_threshold constant integer := 5;
  v_anonymous_vote_burst_window constant interval := interval '15 minutes';
  v_young_anonymous_account_max_age constant interval := interval '1 hour';
begin
  if v_user_id is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  select id
    into v_profile_id
    from public.social_profiles
   where user_id = v_user_id
   limit 1;

  if v_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'profile_not_found'::text;
    return;
  end if;

  if p_tier not in ('gold', 'silver', 'bronze', 'like') then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text;
    return;
  end if;

  select s.profile_id
    into v_author_profile_id
    from public.bc_submissions s
   where s.id = p_submission_id
     and s.moderation_status = 'approved';

  if v_author_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  -- Server-side block enforcement (N13). Indistinguishable from a missing
  -- submission on purpose: do not reveal blocks.
  if public.bc_blocked_between(v_profile_id, v_author_profile_id) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  select *
    into v_asset
    from public.bc_media_assets
   where id = p_media_asset_id;

  if not found
     or v_asset.owner_profile_id is distinct from v_profile_id
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind <> 'vote_proof'
     or nullif(trim(coalesce(v_asset.content_hash, '')), '') is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text;
    return;
  end if;

  if v_author_profile_id = v_profile_id then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text;
    return;
  end if;

  select id
    into v_existing_vote_id
    from public.bc_votes
   where submission_id = p_submission_id
     and voter_profile_id = v_profile_id
   limit 1;

  if v_existing_vote_id is not null then
    return query select v_existing_vote_id, null::uuid, null::text, 'vote_already_exists'::text;
    return;
  end if;

  -- Recast cooldown: deleting a vote on this submission starts a 24h clock
  -- before a new vote is accepted (and the new vote re-enters moderation as
  -- 'proof_pending' like every vote).
  if exists (
    select 1
    from public.bc_action_usage u
    where u.profile_id = v_profile_id
      and u.action = 'vote_delete'
      and u.context = p_submission_id
      and u.called_at > now() - interval '24 hours'
  ) then
    return query select null::uuid, null::uuid, null::text, 'recast_cooldown'::text;
    return;
  end if;

  -- Durable rate limit, consumed only after all validation passes.
  v_quota := public.bc_consume_action_quota(v_profile_id, 'vote', p_submission_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, null::uuid, null::text, 'rate_limited'::text;
    return;
  end if;

  -- Cross-user reuse count BEFORE we insert our own ledger row.
  select count(*)
    into v_hash_reuse
    from public.bc_proof_hash_ledger l
   where l.content_hash = v_asset.content_hash
     and l.profile_id <> v_profile_id;

  -- Audit C11 signals. Account age is server-owned auth data, and these signals
  -- add moderation context only. They do not reject or delay the vote.
  select coalesce(u.is_anonymous, false), u.created_at
    into v_is_anonymous, v_account_created_at
    from auth.users u
   where u.id = v_user_id;

  v_is_anonymous := coalesce(v_is_anonymous, false);
  v_young_anonymous_account := v_is_anonymous
    and v_account_created_at is not null
    and v_account_created_at > now() - v_young_anonymous_account_max_age;

  insert into public.bc_votes (
    id,
    submission_id,
    voter_profile_id,
    tier,
    status,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_submission_id,
    v_profile_id,
    p_tier,
    'proof_pending',
    now()
  )
  returning id into v_vote_id;

  -- Count after insertion so the threshold includes the current stamped vote.
  select count(*)::integer
    into v_recent_anonymous_vote_count
    from public.bc_votes v
   where v.submission_id = p_submission_id
     and v.voter_is_anonymous = true
     and v.created_at > now() - v_anonymous_vote_burst_window;

  v_anonymous_vote_burst :=
    v_recent_anonymous_vote_count >= v_anonymous_vote_burst_threshold;

  -- Per-user GLOBAL dedup: one hash, one vote, ever (N3).
  begin
    insert into public.bc_proof_hash_ledger
      (profile_id, content_hash, first_vote_id, first_submission_id)
    values
      (v_profile_id, v_asset.content_hash, v_vote_id, p_submission_id);
  exception
    when unique_violation then
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  begin
    insert into public.bc_vote_proofs (
      id,
      vote_id,
      submission_id,
      profile_id,
      media_asset_id,
      content_hash,
      status
    )
    values (
      gen_random_uuid(),
      v_vote_id,
      p_submission_id,
      v_profile_id,
      p_media_asset_id,
      v_asset.content_hash,
      'pending'
    )
    returning id into v_proof_id;
  exception
    when unique_violation then
      -- (submission_id, content_hash) collision: another user already used
      -- this exact photo on this submission. Roll our rows back.
      delete from public.bc_proof_hash_ledger
       where profile_id = v_profile_id
         and content_hash = v_asset.content_hash
         and first_vote_id = v_vote_id;
      delete from public.bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  insert into public.bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    'vote_proof',
    v_proof_id,
    v_profile_id,
    'queued',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'media_asset_id', p_media_asset_id
    )
    || case
         when v_hash_reuse > 0 then jsonb_build_object(
           'cross_user_hash_reuse', true,
           'hash_reuse_other_profiles', v_hash_reuse
         )
         else '{}'::jsonb
       end
    || case
         when v_anonymous_vote_burst then jsonb_build_object(
           'anonymous_vote_burst', true,
           'anonymous_vote_burst_count', v_recent_anonymous_vote_count,
           'anonymous_vote_burst_threshold', v_anonymous_vote_burst_threshold,
           'anonymous_vote_burst_window_seconds',
             extract(epoch from v_anonymous_vote_burst_window)::integer
         )
         else '{}'::jsonb
       end
    || case
         when v_young_anonymous_account then jsonb_build_object(
           'young_anonymous_account', true,
           'anonymous_account_age_seconds',
             greatest(0, extract(epoch from (now() - v_account_created_at)))::bigint,
           'young_anonymous_account_max_age_seconds',
             extract(epoch from v_young_anonymous_account_max_age)::integer
         )
         else '{}'::jsonb
       end
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  -- Plan 45 item 2.5 metric tail (additive; the only change from v5). Counts an
  -- accepted, proof-pending vote. bc_bump_metric returns void and swallows its
  -- own errors, so this cannot change the returned row or roll the vote back.
  perform public.bc_bump_metric('votes');

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Metric tails on the other server-side chokepoints. Each is a faithful copy
--    of the existing function with a single bc_bump_metric line added; only the
--    added line and this header differ from the source migration.
-- ---------------------------------------------------------------------------

-- 4a. Submission created: the AFTER INSERT enqueue trigger already fires for
--     every pending submission. Copy of 20260711000001's function plus a bump.
create or replace function public.bc_enqueue_submission_for_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation_status = 'pending' then
    insert into public.bc_moderation_queue (kind, target_id, profile_id, status, metadata)
    values (
      'submission',
      new.id,
      new.profile_id,
      'queued',
      jsonb_build_object('owner_kind', 'submission')
    )
    on conflict (kind, target_id) do nothing;

    -- Plan 45 item 2.5: count a newly created (pending) submission. Approved
    -- admin/seed inserts are intentionally not counted, matching the enqueue.
    perform public.bc_bump_metric('submissions');
  end if;
  return new;
end;
$$;

-- 4b. Account created (BestChef-specific): social_profiles is suite-shared, so a
--     trigger there would count every MyLife signup, not BestChef. The honest
--     BestChef-specific "new account" chokepoint is the first terms acceptance
--     (mandatory, BestChef-only). Re-acceptance on a new terms version does not
--     recount: we bump only when this is the profile's first acceptance row.
create or replace function public.bc_count_first_terms_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.bc_terms_acceptance t
    where t.profile_id = new.profile_id
      and t.id <> new.id
  ) then
    perform public.bc_bump_metric('accounts_created');
  end if;
  return new;
end;
$$;

revoke all on function public.bc_count_first_terms_acceptance() from public, anon, authenticated;

drop trigger if exists bc_terms_acceptance_count_first on public.bc_terms_acceptance;
create trigger bc_terms_acceptance_count_first
  after insert on public.bc_terms_acceptance
  for each row execute function public.bc_count_first_terms_acceptance();

-- 4c. Report filed: copy of 20260427000011's bc_report_content plus a bump on
--     successful flag creation (after both inserts succeed).
create or replace function bc_report_content(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_reporter_profile_id uuid default null
) returns table (
  flag_id uuid,
  queue_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_kind text := lower(trim(coalesce(p_target_kind, '')));
  v_queue_kind text;
  v_flag_target_type text;
  v_reporter_profile_id uuid;
  v_target_profile_id uuid;
begin
  if p_target_id is null then
    return query select null::uuid, null::uuid, 'target_required'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    return query select null::uuid, null::uuid, 'reason_required'::text;
    return;
  end if;

  v_reporter_profile_id := coalesce(p_reporter_profile_id, bc_current_profile_id());

  if v_reporter_profile_id is null or not bc_profile_owned(v_reporter_profile_id) then
    return query select null::uuid, null::uuid, 'not_authorized'::text;
    return;
  end if;

  v_queue_kind := case
    when v_target_kind = 'photo' then 'media_asset'
    else v_target_kind
  end;
  v_flag_target_type := case
    when v_target_kind = 'photo' then 'photo'
    else v_queue_kind
  end;

  if v_queue_kind not in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ) then
    return query select null::uuid, null::uuid, 'invalid_target_kind'::text;
    return;
  end if;

  if v_queue_kind = 'submission' then
    select profile_id
    into v_target_profile_id
    from bc_submissions
    where id = p_target_id;
  elsif v_queue_kind = 'comment' then
    select profile_id
    into v_target_profile_id
    from bc_comments
    where id = p_target_id;
  elsif v_queue_kind = 'profile' then
    select id
    into v_target_profile_id
    from social_profiles
    where id = p_target_id;
  elsif v_queue_kind = 'media_asset' then
    select owner_profile_id
    into v_target_profile_id
    from bc_media_assets
    where id = p_target_id;
  elsif v_queue_kind = 'product_contribution' then
    select profile_id
    into v_target_profile_id
    from bc_product_contributions
    where id = p_target_id;
  elsif v_queue_kind = 'product_evidence' then
    select owner_profile_id
    into v_target_profile_id
    from bc_product_evidence
    where id = p_target_id;
  elsif v_queue_kind = 'vote_proof' then
    select profile_id
    into v_target_profile_id
    from bc_vote_proofs
    where id = p_target_id;
  end if;

  if not found then
    return query select null::uuid, null::uuid, 'target_not_found'::text;
    return;
  end if;

  insert into bc_flags (
    target_type,
    target_id,
    flagger_id,
    reason,
    status
  )
  values (
    v_flag_target_type,
    p_target_id,
    v_reporter_profile_id,
    trim(p_reason),
    'open'
  )
  returning id into flag_id;

  insert into bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    v_queue_kind,
    p_target_id,
    v_target_profile_id,
    'queued',
    jsonb_build_object(
      'first_flag_id', flag_id,
      'latest_flag_id', flag_id,
      'latest_reason', trim(p_reason),
      'latest_reporter_profile_id', v_reporter_profile_id,
      'source', 'bc_report_content'
    )
  )
  on conflict (kind, target_id) do update
    set status = case
          when bc_moderation_queue.status = 'decided' then 'queued'
          else bc_moderation_queue.status
        end,
        profile_id = coalesce(excluded.profile_id, bc_moderation_queue.profile_id),
        metadata = bc_moderation_queue.metadata || jsonb_build_object(
          'latest_flag_id', flag_id,
          'latest_reason', trim(p_reason),
          'latest_reporter_profile_id', v_reporter_profile_id,
          'source', 'bc_report_content'
        ),
        updated_at = now()
  returning id into queue_id;

  -- Plan 45 item 2.5: count a filed report after the flag + queue rows land.
  perform public.bc_bump_metric('reports');

  return query select flag_id, queue_id, null::text;
end;
$$;

comment on function bc_report_content(text, uuid, text, uuid) is
  'Files a content report (flag + moderation-queue row) and counts it in '
  'bc_daily_metrics. Faithful copy of the 20260427000011 body plus a metric tail.';

grant execute on function bc_report_content(text, uuid, text, uuid) to authenticated, service_role;

-- 4d. Appeal filed: copy of 20260703000003's bc_submit_appeal plus a bump on
--     successful appeal insert.
create or replace function public.bc_submit_appeal(
  p_decision_id uuid,
  p_body text
) returns table (
  appeal_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_decision public.bc_moderation_decisions%rowtype;
  v_quota jsonb;
  v_appeal_id uuid;
begin
  v_profile_id := public.bc_current_profile_id();
  if v_profile_id is null then
    return query select null::uuid, 'unauthenticated'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null or char_length(p_body) > 2000 then
    return query select null::uuid, 'invalid_body'::text;
    return;
  end if;

  select * into v_decision
  from public.bc_moderation_decisions
  where id = p_decision_id;

  if not found or v_decision.profile_id is distinct from v_profile_id then
    -- Only the affected user may appeal, and we do not reveal other
    -- decisions' existence.
    return query select null::uuid, 'decision_not_found'::text;
    return;
  end if;

  if exists (select 1 from public.bc_appeals a where a.decision_id = p_decision_id) then
    return query select null::uuid, 'already_appealed'::text;
    return;
  end if;

  v_quota := public.bc_consume_action_quota(v_profile_id, 'appeal', p_decision_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;

  insert into public.bc_appeals (decision_id, profile_id, body)
  values (p_decision_id, v_profile_id, trim(p_body))
  returning id into v_appeal_id;

  -- Plan 45 item 2.5: count a filed appeal after the row lands.
  perform public.bc_bump_metric('appeals');

  return query select v_appeal_id, null::text;
end;
$$;

grant execute on function public.bc_submit_appeal(uuid, text) to authenticated;

-- 4e. Push registered: copy of 20260711000010's bc_register_push_token plus a
--     bump on successful upsert.
create or replace function public.bc_register_push_token(
  p_token text,
  p_platform text default 'ios',
  p_locale text default 'en'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_platform text := lower(trim(coalesce(p_platform, 'ios')));
  v_locale text := coalesce(nullif(trim(p_locale), ''), 'en');
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token required';
  end if;
  if v_platform not in ('ios', 'android') then
    v_platform := 'ios';
  end if;

  -- Re-own: drop any prior registration of this exact token by another user
  -- (device signed into a new account). The unique(token) constraint otherwise
  -- rejects the upsert.
  delete from public.bc_push_tokens
   where token = trim(p_token) and user_id <> v_user;

  insert into public.bc_push_tokens (user_id, token, platform, locale, last_seen_at)
  values (v_user, trim(p_token), v_platform, v_locale, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        locale = excluded.locale,
        last_seen_at = now();

  -- Plan 45 item 2.5: count a push registration. This fires on every refresh of
  -- the same token too; it is a coarse "push-enabled activity" counter, not a
  -- distinct-device count, and is labelled as such in the console.
  perform public.bc_bump_metric('push_registrations');
end;
$$;

revoke all on function public.bc_register_push_token(text, text, text) from public, anon;
grant execute on function public.bc_register_push_token(text, text, text) to authenticated;

-- 4f. Account deletion requested: copy of 20260426000007's
--     bc_request_account_deletion plus a bump on a NEW request (not on the
--     idempotent early-return of an existing pending request).
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

  -- Plan 45 item 2.5: count a NEW deletion request only. The early return above
  -- (existing pending request) is intentionally not counted, so repeated taps do
  -- not inflate the number.
  perform public.bc_bump_metric('account_deletions');

  return saved_request;
end;
$$ language plpgsql security definer set search_path = public;

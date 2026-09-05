-- MyNews account lifecycle: deletion with a disclosed grace period, content
-- disposition, and full personal-data export (plan 48 WP5, audit finding C08).
--
-- Deletion is a two-phase job, never an in-request wipe:
--   1. nw_account_deletion_initiate opens a 'grace' row (requested_at + 7 days).
--      The user can cancel for the whole window. Nothing is destroyed yet.
--   2. nw_account_deletion_claim_due promotes due rows to 'processing' and the
--      mynews-account-worker calls nw_account_deletion_dispose, which performs
--      the entire CONTENT DISPOSITION in ONE transaction, then records the
--      auth-user deletion and processor-cleanup outcomes and completes the row.
--
-- Disposition policy (disclosed in the privacy policy, modules/mynews/src/data/
-- legal-content.ts):
--   RETAINED + ANONYMIZED  the signed public record. Published/retracted
--     articles, their revisions, accepted/partial suggestions, endorsements and
--     the credibility ledger stay, because deleting them would silently rewrite
--     other people's public contribution history and break offline signature
--     verification of the corpus. The identity in front of them is anonymized:
--     handle -> deleted_<random>, display name -> 'Deleted account', bio/beats/
--     region cleared, Ed25519 key cleared and marked revoked so no NEW revision
--     can ever verify against it, and user_id detached from auth.users.
--   RETAINED for legal/safety reasons: nw_reports, nw_dmca_notices,
--     nw_dmca_counter_notices, nw_dmca_events, nw_ncii_cases,
--     nw_moderation_actions, and the money rows (nw_support_charges,
--     nw_transfer_ledger, nw_support_ledger, nw_support_receipts).
--   HARD DELETED: every purely personal row. The exact list is enumerated in
--     nw_account_deletion_dispose, one comment per table.
--
-- auth.users cascade fix (load-bearing): nw_profiles.user_id was
-- "not null references auth.users(id) on delete cascade" while
-- nw_articles.author_id is "on delete restrict". Deleting the auth user would
-- therefore either FAIL outright for any author, or silently cascade the whole
-- retained public record away for a non-author. This migration makes user_id
-- nullable with "on delete set null" so disposition can DETACH the profile from
-- the auth user before the admin API deletes it. Every RLS policy of the form
-- "auth.uid() = user_id" fails closed against a null user_id, so a detached
-- profile is unreachable by any session.
--
-- Export is synchronous: nw_account_export_bundle assembles every user-owned
-- row as one jsonb document that the edge function streams back to the caller.
-- nw_export_jobs is the durable AUDIT of the request; it never stores the data.

-- ==================================================== auth detach groundwork

alter table public.nw_profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists pubkey_revoked_at timestamptz;

comment on column public.nw_profiles.deleted_at is
  'Set by nw_account_deletion_dispose when this profile was anonymized after an account deletion. The public record it fronts is retained.';
comment on column public.nw_profiles.pubkey_revoked_at is
  'Set when pubkey_ed25519 was cleared/revoked. A revoked binding can never authorize a new signed revision.';

alter table public.nw_profiles alter column user_id drop not null;

alter table public.nw_profiles drop constraint if exists nw_profiles_user_id_fkey;
alter table public.nw_profiles
  add constraint nw_profiles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- The unique constraint on user_id survives: Postgres unique treats NULLs as
-- distinct, so any number of detached (deleted) profiles can coexist.
--
-- Side effect worth knowing: an auth user deleted OUT OF BAND (an operator using
-- the Supabase dashboard rather than this pipeline) now leaves its profile
-- detached with its real handle and display name, no longer able to sign in.
-- That is deliberate and strictly better than the two previous outcomes: the
-- delete used to FAIL for any author (nw_articles.author_id is on delete
-- restrict) or, for a non-author, cascade away their profile, suggestions and
-- other editors' credibility rows. Anonymization belongs to
-- nw_account_deletion_dispose; the out-of-band path is not a supported way to
-- honor a deletion request.

-- ==================================================== deletion request table

create table if not exists public.nw_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately NOT a foreign key to auth.users: this audit row must outlive
  -- the auth user it describes. The same reason applies to profile_id, which is
  -- a soft reference (the profile is retained, but a future hard purge must not
  -- take the audit trail with it).
  user_id uuid not null,
  profile_id uuid,
  status text not null default 'grace' check (
    status in ('grace', 'processing', 'completed', 'cancelled', 'failed')
  ),
  requested_at timestamptz not null default now(),
  grace_ends_at timestamptz not null,
  cancelled_at timestamptz,
  processing_started_at timestamptz,
  content_disposed_at timestamptz,
  completed_at timestamptz,
  failure_detail text,
  auth_user_deletion_state text not null default 'pending' check (
    auth_user_deletion_state in ('pending', 'done', 'skipped-unconfigured', 'failed')
  ),
  processor_cleanup_state text not null default 'pending' check (
    processor_cleanup_state in ('pending', 'done', 'skipped-unconfigured', 'failed')
  )
);

alter table public.nw_deletion_requests enable row level security;

-- Service-role territory for every write. The owner may READ their own row so
-- the in-app status screen keeps working even if the edge function is down.
create policy nw_deletion_requests_self_select on public.nw_deletion_requests
  for select using (auth.uid() = user_id);

create index if not exists idx_nw_deletion_requests_user
  on public.nw_deletion_requests (user_id, requested_at desc);
create index if not exists idx_nw_deletion_requests_due
  on public.nw_deletion_requests (status, grace_ends_at);

-- Only one in-flight deletion per user. 'grace', 'processing' and 'failed' are
-- all in-flight (a failed pass is retried by the worker), so the partial unique
-- index is the hard backstop behind the idempotency check in initiate.
create unique index if not exists idx_nw_deletion_requests_one_inflight
  on public.nw_deletion_requests (user_id)
  where status in ('grace', 'processing', 'failed');

-- ==================================================== export job audit table

create table if not exists public.nw_export_jobs (
  id uuid primary key default gen_random_uuid(),
  -- Same no-FK reasoning as nw_deletion_requests: the audit row outlives the
  -- account (an export immediately followed by a deletion must stay auditable).
  user_id uuid not null,
  profile_id uuid,
  -- Export runs synchronously inside the request, so a row is only ever written
  -- at a terminal state. There is no queue and no stored payload.
  status text not null check (status in ('completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  byte_count bigint not null default 0 check (byte_count >= 0),
  failure_detail text
);

alter table public.nw_export_jobs enable row level security;

create policy nw_export_jobs_self_select on public.nw_export_jobs
  for select using (auth.uid() = user_id);

create index if not exists idx_nw_export_jobs_user
  on public.nw_export_jobs (user_id, requested_at desc);

-- ==================================================== initiate / cancel / read

-- Grace window. The 7 days here is mirrored by MYNEWS_DELETION_GRACE_DAYS in
-- supabase/functions/mynews-account/index.ts and pinned by a drift test that
-- reads this file.
create or replace function public.nw_account_deletion_initiate(
  p_user_id uuid,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.nw_deletion_requests;
begin
  if p_user_id is null then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  -- Idempotent: an in-flight request (grace, processing, or a failed pass the
  -- worker will retry) is returned as-is. A cancelled or completed row never
  -- blocks a new request.
  select * into v_row
  from public.nw_deletion_requests
  where user_id = p_user_id
    and status in ('grace', 'processing', 'failed')
  order by requested_at desc
  limit 1;

  if found then
    return jsonb_build_object('outcome', 'existing', 'request', to_jsonb(v_row));
  end if;

  insert into public.nw_deletion_requests (user_id, profile_id, grace_ends_at)
  values (p_user_id, p_profile_id, now() + interval '7 days')
  returning * into v_row;

  return jsonb_build_object('outcome', 'created', 'request', to_jsonb(v_row));
exception
  when unique_violation then
    -- Lost a race with a concurrent initiate; the winner's row is the answer.
    select * into v_row
    from public.nw_deletion_requests
    where user_id = p_user_id
      and status in ('grace', 'processing', 'failed')
    order by requested_at desc
    limit 1;
    if found then
      return jsonb_build_object('outcome', 'existing', 'request', to_jsonb(v_row));
    end if;
    return jsonb_build_object('outcome', 'conflict');
end;
$$;

revoke all on function public.nw_account_deletion_initiate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_initiate(uuid, uuid) to service_role;

-- Cancellation is only ever possible from 'grace'. Once disposition starts the
-- content is already being destroyed, so there is nothing honest to cancel.
create or replace function public.nw_account_deletion_cancel(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  select id, status into v_id, v_status
  from public.nw_deletion_requests
  where user_id = p_user_id
    and status in ('grace', 'processing', 'failed')
  order by requested_at desc
  limit 1
  for update;

  if not found then
    return 'not-found';
  end if;
  if v_status <> 'grace' then
    return 'not-cancellable';
  end if;

  update public.nw_deletion_requests
  set status = 'cancelled', cancelled_at = now()
  where id = v_id;

  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_cancel(uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_cancel(uuid) to service_role;

-- Newest request for a user, or null. Backs the durable status read.
create or replace function public.nw_account_deletion_status(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(r)
  from public.nw_deletion_requests r
  where r.user_id = p_user_id
  order by r.requested_at desc
  limit 1;
$$;

revoke all on function public.nw_account_deletion_status(uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_status(uuid) to service_role;

-- ==================================================== worker claim + states

-- Claim work for one worker pass. Three claimable shapes, all bounded by
-- FOR UPDATE SKIP LOCKED so concurrent passes never double-claim:
--   * 'grace' whose window has elapsed (the normal path),
--   * 'processing' stalled for over an hour (a crashed pass; disposition is
--     idempotent so re-running it is safe),
--   * 'failed' older than an hour (retry with backoff; a failure never becomes
--     a silent abandonment).
create or replace function public.nw_account_deletion_claim_due(
  p_now timestamptz,
  p_limit integer default 25
)
-- The OUT columns are deliberately NOT named id/user_id/profile_id/status: in a
-- plpgsql RETURNS TABLE function those names become variables, and an
-- unqualified column reference matching one raises "column reference is
-- ambiguous" at execution time, which no static check would catch.
returns table (
  request_id uuid,
  owner_user_id uuid,
  owner_profile_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
begin
  return query
  with claimed as (
    select r.id
    from public.nw_deletion_requests r
    where (r.status = 'grace' and r.grace_ends_at <= v_now)
       or (r.status = 'processing' and coalesce(r.processing_started_at, r.requested_at) <= v_now - interval '1 hour')
       or (r.status = 'failed' and coalesce(r.processing_started_at, r.requested_at) <= v_now - interval '1 hour')
    order by r.grace_ends_at
    limit v_limit
    for update skip locked
  )
  update public.nw_deletion_requests r
  set status = 'processing',
      processing_started_at = v_now,
      failure_detail = null
  where r.id in (select c.id from claimed c)
  returning
    r.id as request_id,
    r.user_id as owner_user_id,
    r.profile_id as owner_profile_id,
    r.status as request_status;
end;
$$;

revoke all on function public.nw_account_deletion_claim_due(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_claim_due(timestamptz, integer) to service_role;

-- ==================================================== content disposition

-- ONE transaction. Any statement that cannot complete raises, the whole
-- disposition rolls back, and the worker records 'failed' + failure_detail on
-- the request so the next pass retries it. There is no partial disposition.
create or replace function public.nw_account_deletion_dispose(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_status text;
  v_deleted_at timestamptz;
  v_handle text;
  v_attempt integer := 0;
begin
  select user_id, profile_id, status
  into v_user_id, v_profile_id, v_status
  from public.nw_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    return 'not-found';
  end if;
  if v_status <> 'processing' then
    return 'bad-status';
  end if;

  if v_profile_id is not null then
    -- ---------------------------------------------------------------- HARD DELETE
    -- Purely personal rows. Every table below is enumerated from the live
    -- schema (bootstrap 20260703000001, editing desk 20260703000003, blocks
    -- 20260705000006, report atomicity 20260712000001, support rails
    -- 20260712000007).

    -- nw_follows: the user's private reading graph. Rows where they are the
    -- FOLLOWED journalist belong to other users and stay.
    delete from public.nw_follows where follower_id = v_profile_id;

    -- nw_blocks: the user's own block/mute list. Rows where they are the
    -- BLOCKED party are other users' safety settings and stay (deleting them
    -- would silently unblock an account for someone else).
    delete from public.nw_blocks where blocker_id = v_profile_id;

    -- nw_newsroom_members: their newsroom memberships. Owned nw_newsrooms rows
    -- are shared containers for other members' drafts and stay, fronted by the
    -- anonymized profile.
    delete from public.nw_newsroom_members where profile_id = v_profile_id;

    -- nw_journalist_verifications: evidence_ref holds identity evidence (domain
    -- email, ORCID, byline references). The most sensitive personal data in the
    -- schema and never part of the public record.
    delete from public.nw_journalist_verifications where journalist_id = v_profile_id;

    -- nw_suggestion_events: the user's free-text comments on editing threads.
    -- Decision events (accept/reject/partial/rebase) are the signed record of an
    -- author's decision and stay.
    delete from public.nw_suggestion_events
    where actor_id = v_profile_id and action = 'comment';

    -- nw_edit_suggestions: suggestions that never became public record.
    -- accepted/partial ones are retained (their words are in a published
    -- revision and their credibility ledger row is public).
    delete from public.nw_edit_suggestions
    where editor_id = v_profile_id and status in ('open', 'rejected', 'stale');

    -- nw_articles (drafts only): never public, so nothing to retain. Cascades
    -- the draft's revisions, meta, suggestions and events. Guarded so a
    -- collaborative draft that already awarded credibility to ANOTHER editor is
    -- not deleted, because that would rewrite their earned public record.
    delete from public.nw_articles a
    where a.author_id = v_profile_id
      and a.status = 'draft'
      and not exists (
        select 1
        from public.nw_credibility_ledger l
        join public.nw_edit_suggestions s on s.id = l.suggestion_id
        where s.article_id = a.id
          and l.editor_id <> v_profile_id
      );

    -- Remaining drafts are the guarded collaborative case: keep the rows so the
    -- other editors' ledger survives, but scrub the deleted author's words and
    -- drop the signatures (nothing may claim to be a valid signature over
    -- scrubbed bytes).
    update public.nw_article_revisions r
    set headline = '[removed at author request]',
        dek = null,
        body_md = '',
        signature = '',
        signer_pubkey = ''
    where exists (
      select 1 from public.nw_articles a
      where a.id = r.article_id
        and a.author_id = v_profile_id
        and a.status = 'draft'
    );

    delete from public.nw_article_meta m
    where exists (
      select 1 from public.nw_articles a
      where a.id = m.article_id
        and a.author_id = v_profile_id
        and a.status = 'draft'
    );

    -- ------------------------------------------------------- MONEY: stop, retain
    -- Future billing stops; the charge/ledger/receipt rows are financial and tax
    -- records and are retained, now fronted by the anonymized profile.
    update public.nw_supports
    set status = 'canceled'
    where supporter_id = v_profile_id and status <> 'canceled';

    -- Payout identity is removed from our database. Closing the account on the
    -- processor side is the worker's processor-cleanup hook.
    update public.nw_payout_accounts
    set onboarding_state = 'none',
        provider = null,
        provider_account_ref = null,
        status_reason = 'account deleted',
        updated_at = now()
    where journalist_profile_id = v_profile_id;

    -- ------------------------------------------------- RETAIN + ANONYMIZE
    -- Anonymization runs once. A retried disposition must not re-roll the
    -- handle (it would churn a public identifier for no reason).
    select deleted_at into v_deleted_at from public.nw_profiles where id = v_profile_id;

    if v_deleted_at is null then
      loop
        v_attempt := v_attempt + 1;
        -- 'deleted_' + 10 hex chars = 18 chars, inside the
        -- '^[a-z0-9_]{3,30}$' handle constraint.
        v_handle := 'deleted_' || left(md5(random()::text), 10);
        exit when not exists (select 1 from public.nw_profiles where handle = v_handle);
        if v_attempt >= 20 then
          raise exception 'nw_account_deletion_dispose: could not allocate an anonymized handle';
        end if;
      end loop;

      -- user_id = null DETACHES the retained record from auth.users so the
      -- admin-API user deletion in the worker cannot cascade it away. It also
      -- fails every "auth.uid() = user_id" policy closed.
      update public.nw_profiles
      set handle = v_handle,
          display_name = 'Deleted account',
          pubkey_ed25519 = '',
          pubkey_revoked_at = now(),
          deleted_at = now(),
          user_id = null
      where id = v_profile_id;

      update public.nw_journalists
      set bio = '',
          beats = '{}',
          region = '',
          stripe_account_id = null
      where profile_id = v_profile_id;
    end if;
  end if;

  -- nw_terms_acceptance is keyed by auth user, not profile, so it is cleared
  -- even for an account that never registered a public profile.
  delete from public.nw_terms_acceptance where user_id = v_user_id;

  -- Retry semantics: re-arm any sub-state that is not already 'done'. A 'done'
  -- auth deletion or processor cleanup is never rewound.
  update public.nw_deletion_requests
  set content_disposed_at = now(),
      auth_user_deletion_state =
        case when auth_user_deletion_state = 'done' then 'done' else 'pending' end,
      processor_cleanup_state =
        case when processor_cleanup_state = 'done' then 'done' else 'pending' end
  where id = p_request_id;

  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_dispose(uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_dispose(uuid) to service_role;

-- ==================================================== worker state recording

create or replace function public.nw_account_deletion_record_state(
  p_request_id uuid,
  p_field text,
  p_state text,
  p_detail text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field not in ('auth_user_deletion_state', 'processor_cleanup_state') then
    return 'bad-field';
  end if;
  if p_state not in ('pending', 'done', 'skipped-unconfigured', 'failed') then
    return 'bad-state';
  end if;

  if p_field = 'auth_user_deletion_state' then
    update public.nw_deletion_requests
    set auth_user_deletion_state = p_state,
        failure_detail = case when p_state = 'failed' then p_detail else failure_detail end
    where id = p_request_id;
  else
    update public.nw_deletion_requests
    set processor_cleanup_state = p_state,
        failure_detail = case when p_state = 'failed' then p_detail else failure_detail end
    where id = p_request_id;
  end if;

  if not found then
    return 'not-found';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_record_state(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_record_state(uuid, text, text, text) to service_role;

-- Completion is fail-closed: a request only reaches 'completed' when content
-- disposition ran AND both side-effect states reached a terminal outcome.
-- 'skipped-unconfigured' is terminal and stays VISIBLE in the status read; it
-- is never rewritten as 'done'.
create or replace function public.nw_account_deletion_complete(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.nw_deletion_requests;
begin
  select * into v_row
  from public.nw_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    return 'not-found';
  end if;
  if v_row.status <> 'processing' then
    return 'bad-status';
  end if;
  if v_row.content_disposed_at is null then
    return 'not-disposed';
  end if;
  if v_row.auth_user_deletion_state not in ('done', 'skipped-unconfigured')
     or v_row.processor_cleanup_state not in ('done', 'skipped-unconfigured') then
    return 'states-pending';
  end if;

  update public.nw_deletion_requests
  set status = 'completed', completed_at = now(), failure_detail = null
  where id = p_request_id;

  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_complete(uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_complete(uuid) to service_role;

create or replace function public.nw_account_deletion_fail(
  p_request_id uuid,
  p_detail text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.nw_deletion_requests
  set status = 'failed',
      failure_detail = left(coalesce(p_detail, 'unknown failure'), 2000)
  where id = p_request_id
    and status = 'processing';

  if not found then
    return 'not-found';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_fail(uuid, text) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_fail(uuid, text) to service_role;

-- ==================================================== export

create or replace function public.nw_account_export_record(
  p_user_id uuid,
  p_profile_id uuid,
  p_status text,
  p_byte_count bigint,
  p_detail text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('completed', 'failed') then
    return 'bad-status';
  end if;

  insert into public.nw_export_jobs (
    user_id, profile_id, status, completed_at, byte_count, failure_detail
  )
  values (
    p_user_id,
    p_profile_id,
    p_status,
    now(),
    greatest(0, coalesce(p_byte_count, 0)),
    case when p_status = 'failed' then left(coalesce(p_detail, ''), 2000) else null end
  );

  return 'ok';
end;
$$;

revoke all on function public.nw_account_export_record(uuid, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.nw_account_export_record(uuid, uuid, text, bigint, text) to service_role;

-- Every row the user owns, in one consistent snapshot. Sections are always
-- present (an empty array rather than a missing key) so the caller can tell
-- "you have no rows of this kind" from "this export is incomplete".
create or replace function public.nw_account_export_bundle(
  p_user_id uuid,
  p_profile_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'userId', p_user_id,
    'profileId', p_profile_id,
    'profile', (select to_jsonb(p) from public.nw_profiles p where p.id = p_profile_id),
    'journalist', (select to_jsonb(j) from public.nw_journalists j where j.profile_id = p_profile_id),
    'journalistVerifications', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at), '[]'::jsonb)
      from public.nw_journalist_verifications v where v.journalist_id = p_profile_id
    ),
    'articles', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
      from public.nw_articles a where a.author_id = p_profile_id
    ),
    'articleRevisions', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.article_id, r.rev), '[]'::jsonb)
      from public.nw_article_revisions r
      join public.nw_articles a on a.id = r.article_id
      where a.author_id = p_profile_id
    ),
    'articleMeta', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.nw_article_meta m
      join public.nw_articles a on a.id = m.article_id
      where a.author_id = p_profile_id
    ),
    'suggestionsAuthored', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at), '[]'::jsonb)
      from public.nw_edit_suggestions s where s.editor_id = p_profile_id
    ),
    'suggestionEventsAuthored', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
      from public.nw_suggestion_events e where e.actor_id = p_profile_id
    ),
    'dupeEndorsements', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at), '[]'::jsonb)
      from public.nw_suggestion_dupes d where d.endorser_id = p_profile_id
    ),
    'credibilityLedger', (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.awarded_at), '[]'::jsonb)
      from public.nw_credibility_ledger l where l.editor_id = p_profile_id
    ),
    'follows', (
      select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at), '[]'::jsonb)
      from public.nw_follows f where f.follower_id = p_profile_id
    ),
    'blocks', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
      from public.nw_blocks b where b.blocker_id = p_profile_id
    ),
    'newsroomsOwned', (
      select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb)
      from public.nw_newsrooms n where n.owner_id = p_profile_id
    ),
    'newsroomMemberships', (
      select coalesce(jsonb_agg(to_jsonb(nm) order by nm.created_at), '[]'::jsonb)
      from public.nw_newsroom_members nm where nm.profile_id = p_profile_id
    ),
    'mediaAssets', (
      select coalesce(jsonb_agg(to_jsonb(ma) order by ma.created_at), '[]'::jsonb)
      from public.nw_media_assets ma where ma.owner_profile_id = p_profile_id
    ),
    'termsAcceptances', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.accepted_at), '[]'::jsonb)
      from public.nw_terms_acceptance t where t.user_id = p_user_id
    ),
    'reportsFiled', (
      select coalesce(jsonb_agg(to_jsonb(rp) order by rp.created_at), '[]'::jsonb)
      from public.nw_reports rp where rp.reporter_id = p_profile_id
    ),
    'moderationNotices', (
      select coalesce(jsonb_agg(to_jsonb(mn)), '[]'::jsonb)
      from public.nw_get_my_moderation_notices(p_user_id) mn
    ),
    'dmcaNoticesSubmitted', (
      select coalesce(jsonb_agg(to_jsonb(dn) order by dn.created_at), '[]'::jsonb)
      from public.nw_dmca_notices dn where dn.submitter_profile_id = p_profile_id
    ),
    'dmcaCounterNoticesSubmitted', (
      select coalesce(jsonb_agg(to_jsonb(dc) order by dc.created_at), '[]'::jsonb)
      from public.nw_dmca_counter_notices dc where dc.submitter_profile_id = p_profile_id
    ),
    'supports', (
      select coalesce(jsonb_agg(to_jsonb(sp) order by sp.started_at), '[]'::jsonb)
      from public.nw_supports sp where sp.supporter_id = p_profile_id
    ),
    'supportCharges', (
      select coalesce(jsonb_agg(to_jsonb(sc) order by sc.created_at), '[]'::jsonb)
      from public.nw_support_charges sc where sc.supporter_id = p_profile_id
    ),
    'supportLedger', (
      select coalesce(jsonb_agg(to_jsonb(sl) order by sl.created_at), '[]'::jsonb)
      from public.nw_support_ledger sl
      where sl.supporter_profile_id = p_profile_id
         or sl.journalist_profile_id = p_profile_id
    ),
    'supportReceipts', (
      select coalesce(jsonb_agg(to_jsonb(sr) order by sr.created_at), '[]'::jsonb)
      from public.nw_support_receipts sr
      where sr.supporter_profile_id = p_profile_id
         or sr.journalist_profile_id = p_profile_id
    ),
    'transferLedger', (
      select coalesce(jsonb_agg(to_jsonb(tl) order by tl.created_at), '[]'::jsonb)
      from public.nw_transfer_ledger tl where tl.journalist_id = p_profile_id
    ),
    'payoutAccount', (
      select to_jsonb(pa) from public.nw_payout_accounts pa
      where pa.journalist_profile_id = p_profile_id
    ),
    'deletionRequests', (
      select coalesce(jsonb_agg(to_jsonb(dr) order by dr.requested_at), '[]'::jsonb)
      from public.nw_deletion_requests dr where dr.user_id = p_user_id
    ),
    'exportJobs', (
      select coalesce(jsonb_agg(to_jsonb(ej) order by ej.requested_at), '[]'::jsonb)
      from public.nw_export_jobs ej where ej.user_id = p_user_id
    )
  );
$$;

revoke all on function public.nw_account_export_bundle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nw_account_export_bundle(uuid, uuid) to service_role;

-- ==================================================== pg_cron worker seam

-- Same shape as nw_run_ncii_worker (20260705000009): configuration lives in
-- nw_job_config rows written by founder-ops, and the function is a no-op until
-- both are present. It never fabricates a call it cannot make.
create or replace function public.nw_run_account_worker()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_pending integer;
begin
  select value into v_url from public.nw_job_config where key = 'functions_base_url';
  select value into v_secret from public.nw_job_config where key = 'account_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from public.nw_deletion_requests
  where status in ('grace', 'processing', 'failed')
    and (
      status <> 'grace' or grace_ends_at <= now()
    );
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/mynews-account-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MyNews-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'nw_run_account_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.nw_run_account_worker() from public, anon, authenticated;
grant execute on function public.nw_run_account_worker() to service_role;

-- Hourly is ample for a 7-day grace window and keeps retry latency low.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'mynews-account-worker',
      '7 * * * *',
      $job$select public.nw_run_account_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: mynews-account-worker not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'mynews-account-worker scheduling skipped: %', sqlerrm;
end $$;

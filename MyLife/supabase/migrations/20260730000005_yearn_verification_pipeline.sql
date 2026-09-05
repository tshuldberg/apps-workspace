-- Yearn identity verification pipeline (plan 47 Phase 5).
-- Human-review selfie verification: users submit a camera selfie into their
-- own private storage folder, reviewers act through the yearn-moderation
-- surface, and profiles.is_verified is structurally impossible to set true
-- without an approved submission (DB trigger guard). A liveness-vendor slot
-- is recorded fail-closed ('not_configured') until the founder selects a
-- provider; nothing here fakes a liveness check.
-- Idempotent and re-runnable after 20260730000004.

-- =========================================
-- SUBMISSIONS
-- =========================================
create table if not exists yearn.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  selfie_path text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'revoked', 'superseded')),
  liveness_status text not null default 'not_configured'
    check (liveness_status in ('not_configured', 'passed', 'failed')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live review request per user at a time.
create unique index if not exists yearn_verification_pending_unique
  on yearn.verification_submissions (user_id)
  where status = 'pending_review';

create index if not exists yearn_verification_status_idx
  on yearn.verification_submissions (status, created_at);

alter table yearn.verification_submissions enable row level security;

-- Users see their own submission history; all writes flow through RPCs.
drop policy if exists "verification select own" on yearn.verification_submissions;
create policy "verification select own"
on yearn.verification_submissions for select
to authenticated
using (user_id = auth.uid());

grant select on yearn.verification_submissions to authenticated;

-- =========================================
-- BADGE GUARD
-- profiles.is_verified can only become true while an approved submission
-- exists. This turns the client-side honesty gate into a structural DB
-- invariant: no console mistake, compromised client, or stray UPDATE can
-- show an unearned badge.
-- =========================================
create or replace function yearn.guard_profile_verified()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  if new.is_verified = true
     and (old.is_verified is distinct from new.is_verified)
     and not exists (
       select 1 from yearn.verification_submissions v
       where v.user_id = new.id and v.status = 'approved'
     ) then
    raise exception
      'profiles: is_verified requires an approved verification submission';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_verified_guard on yearn.profiles;
create trigger profiles_verified_guard
before update of is_verified on yearn.profiles
for each row execute function yearn.guard_profile_verified();

revoke all on function yearn.guard_profile_verified()
  from public, anon, authenticated;

-- =========================================
-- SUBMIT (authenticated, definer-pinned)
-- =========================================
create or replace function yearn.submit_verification(p_selfie_path text)
returns uuid
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'submit_verification: no authenticated user';
  end if;

  -- The selfie must live in the caller's own private folder under the
  -- verification prefix (never readable by other users: it is not a
  -- profiles.photos entry, so the cross-user storage policy cannot match).
  if p_selfie_path is null
     or p_selfie_path not like v_uid::text || '/verification-selfie-%' then
    raise exception 'submit_verification: selfie path must be in your verification folder';
  end if;

  update yearn.verification_submissions
  set status = 'superseded',
      updated_at = now()
  where user_id = v_uid
    and status = 'pending_review';

  insert into yearn.verification_submissions (user_id, selfie_path)
  values (v_uid, p_selfie_path)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function yearn.submit_verification(text) from public, anon;
grant execute on function yearn.submit_verification(text) to authenticated;

-- =========================================
-- REVIEW (service-role, via yearn-moderation)
-- =========================================
create or replace function yearn.review_verification(
  p_submission_id uuid,
  p_decision text,
  p_reviewer text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected', 'revoked') then
    raise exception 'review_verification: invalid decision %', p_decision;
  end if;

  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'review_verification: reviewer is required';
  end if;

  select v.user_id, v.status
    into v_user_id, v_status
  from yearn.verification_submissions v
  where v.id = p_submission_id
  for update;

  if not found then
    raise exception 'review_verification: submission % not found', p_submission_id;
  end if;

  if p_decision in ('approved', 'rejected') and v_status <> 'pending_review' then
    raise exception 'review_verification: submission is % (expected pending_review)', v_status;
  end if;
  if p_decision = 'revoked' and v_status <> 'approved' then
    raise exception 'review_verification: only approved submissions can be revoked';
  end if;

  update yearn.verification_submissions
  set status = p_decision,
      reviewed_by = btrim(p_reviewer),
      reviewed_at = now(),
      review_reason = p_reason,
      updated_at = now()
  where id = p_submission_id;

  if p_decision = 'approved' then
    -- Any earlier approved submission is superseded by this one.
    update yearn.verification_submissions
    set status = 'superseded',
        updated_at = now()
    where user_id = v_user_id
      and status = 'approved'
      and id <> p_submission_id;

    update yearn.profiles
    set is_verified = true
    where id = v_user_id;
  elsif p_decision = 'revoked' then
    -- Guard invariant: with no approved submission left, the badge drops.
    update yearn.profiles
    set is_verified = false
    where id = v_user_id;
  end if;

  insert into yearn.moderation_actions (
    report_id,
    target_user_id,
    actor,
    action,
    reason,
    detail
  ) values (
    null,
    v_user_id,
    btrim(p_reviewer),
    'warn',
    p_reason,
    jsonb_build_object(
      'event', 'verification_review',
      'submission_id', p_submission_id,
      'decision', p_decision
    )
  );
end;
$$;

revoke all on function yearn.review_verification(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function yearn.review_verification(uuid, text, text, text)
  to service_role;

-- =========================================
-- OPS LISTING (service-role, via yearn-moderation)
-- =========================================
create or replace function yearn.list_verification_submissions(
  p_status text default null,
  p_limit int default 50,
  p_before timestamptz default null
)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  selfie_path text,
  status text,
  liveness_status text,
  reviewed_by text,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    v.id,
    v.user_id,
    p.display_name,
    v.selfie_path,
    v.status,
    v.liveness_status,
    v.reviewed_by,
    v.reviewed_at,
    v.review_reason,
    v.created_at
  from yearn.verification_submissions v
  left join yearn.profiles p on p.id = v.user_id
  where (p_status is null or v.status = p_status)
    and (p_before is null or v.created_at < p_before)
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function yearn.list_verification_submissions(text, int, timestamptz)
  from public, anon, authenticated;
grant execute on function yearn.list_verification_submissions(text, int, timestamptz)
  to service_role;

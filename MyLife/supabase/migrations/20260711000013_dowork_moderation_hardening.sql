-- DoWork moderation + invite-abuse hardening (BK-3, BK-4).
--
-- BK-3: dw_redeem_client_invite() and the dowork-redeem-invite trainer-creation
-- path had no rate limit, so a leaked/guessed code or a scripted attacker could
-- burn through the invite space (or hammer the trainer-signup path) at
-- unlimited speed with no cost. Mirrors BestChef's durable Postgres quota
-- ledger (bc_consume_provider_quota, 20260529000005_bestchef_provider_usage.sql)
-- rather than the in-memory broker.ts limiter, which resets per Edge isolate
-- and does not bound a security-definer RPC called directly from the client
-- anyway. Conservative window: 10 attempts per user per hour, checked before
-- the code lookup so failed guesses count too.
--
-- BK-4: dw_reports let a client insert any target_id for a given target_kind
-- with no check it names a real row of the right kind, letting a client
-- pollute the moderation queue with garbage ids. A BEFORE INSERT trigger
-- validates target_id exists in the table target_kind implies.
--
-- All statements idempotent.

-- ── BK-3: durable per-user invite-redemption rate limit ────────────────────

create table if not exists public.dw_invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null check (kind in ('client_invite', 'trainer_invite')),
  attempted_at timestamptz not null default now()
);

create index if not exists dw_invite_attempts_user_kind_idx
  on public.dw_invite_attempts (user_id, kind, attempted_at desc);

alter table public.dw_invite_attempts enable row level security;
-- No anon/authenticated policies: only service-role functions and the
-- security-definer RPC below (which runs as the table owner) touch this ledger.

-- Atomic quota check + log, mirroring bc_consume_provider_quota. Returns
-- true when the caller is still within budget (and logs the attempt);
-- false when the budget is exhausted (attempt is still logged, so retries
-- do not reset the window).
create or replace function public.dw_consume_invite_attempt(
  p_user_id uuid,
  p_kind text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.dw_invite_attempts
  where user_id = p_user_id
    and kind = p_kind
    and attempted_at > now() - make_interval(secs => greatest(p_window_seconds, 1));

  insert into public.dw_invite_attempts (user_id, kind) values (p_user_id, p_kind);

  return v_count < greatest(p_max, 0);
end;
$$;

revoke all on function public.dw_consume_invite_attempt(uuid, text, integer, integer) from public, anon;
grant execute on function public.dw_consume_invite_attempt(uuid, text, integer, integer)
  to authenticated, service_role;

-- Wrap dw_redeem_client_invite with the rate check. Recreated in full since
-- Postgres cannot alter a function body via ALTER FUNCTION.
create or replace function public.dw_redeem_client_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.dw_client_links%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not public.dw_consume_invite_attempt(v_uid, 'client_invite', 10, 3600) then
    raise exception 'too many invite attempts, try again later';
  end if;

  select * into v_link
  from public.dw_client_links
  where invite_code = p_code
  for update;

  if not found then
    raise exception 'invalid invite code';
  end if;

  if v_link.status is distinct from 'invited' then
    raise exception 'invite is not redeemable';
  end if;

  -- A trainer cannot redeem their own client invite onto themselves.
  if exists (
    select 1 from public.dw_trainers t
    where t.id = v_link.trainer_id and t.user_id = v_uid
  ) then
    raise exception 'trainers cannot redeem their own client invite';
  end if;

  update public.dw_client_links
  set client_user_id = v_uid,
      status = 'active',
      activated_at = now()
  where id = v_link.id;

  return v_link.id;
end;
$$;
revoke all on function public.dw_redeem_client_invite(text) from public, anon;
grant execute on function public.dw_redeem_client_invite(text) to authenticated;

-- ── BK-4: dw_reports target_id existence + kind validation ─────────────────

create or replace function public.dw_reports_validate_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  case new.target_kind
    when 'share' then
      if not exists (select 1 from public.dw_workout_shares where id = new.target_id) then
        raise exception 'target_id does not reference an existing share';
      end if;
    when 'comment' then
      if not exists (select 1 from public.dw_comments where id = new.target_id) then
        raise exception 'target_id does not reference an existing comment';
      end if;
    when 'trainer_video' then
      if not exists (select 1 from public.dw_trainer_videos where id = new.target_id) then
        raise exception 'target_id does not reference an existing trainer video';
      end if;
    when 'profile' then
      if not exists (select 1 from public.dw_trainers where id = new.target_id) then
        raise exception 'target_id does not reference an existing trainer profile';
      end if;
    else
      raise exception 'unknown target_kind %', new.target_kind;
  end case;
  return new;
end;
$$;

drop trigger if exists dw_reports_validate_target_trg on public.dw_reports;
create trigger dw_reports_validate_target_trg
  before insert on public.dw_reports
  for each row
  execute function public.dw_reports_validate_target();

-- ── CG-8: premium-video teaser metadata for non-entitled visitors ──────────
--
-- dw_trainer_videos_select_entitled (20260703000001_dowork_trainer_platform_v2.sql:537)
-- gates the ENTIRE row on entitlement, so a non-subscriber's client query
-- returns nothing for a premium video -- no title, no thumbnail. That is
-- correct for storage_path (never leak a playable path pre-purchase) but
-- means the app cannot show a locked teaser row today; premium videos are
-- invisible rather than a conversion lever.
--
-- This RPC is a narrow, explicit exception: it returns ONLY non-sensitive
-- display metadata (id, title, thumbnail_url, duration_seconds, sort_order)
-- for a trainer's non-hidden premium videos, regardless of caller
-- entitlement. storage_path, description, exercise_slug, and view_count are
-- deliberately excluded -- none of them are needed to render "Coach Max --
-- Deadlift Setup [locked]" and description/exercise_slug could describe
-- content precisely enough to be a soft paywall bypass. The signed playback
-- URL remains impossible to mint without entitlement (dowork-playback-url
-- re-checks the 4-path policy server-side), so exposing this metadata does
-- not weaken the paywall; it only lets the client render what it already
-- cannot play.
create or replace function public.dw_list_premium_video_teasers(p_trainer_id uuid)
returns table (
  id uuid,
  title text,
  thumbnail_url text,
  duration_seconds integer,
  sort_order integer
)
language sql
security definer
stable
set search_path = public
as $$
  select v.id, v.title, v.thumbnail_url, v.duration_seconds, v.sort_order
  from public.dw_trainer_videos v
  where v.trainer_id = p_trainer_id
    and v.is_hidden = false
    and v.is_premium = true
  order by v.sort_order asc, v.published_at desc nulls last;
$$;

revoke all on function public.dw_list_premium_video_teasers(uuid) from public;
grant execute on function public.dw_list_premium_video_teasers(uuid) to authenticated, anon;

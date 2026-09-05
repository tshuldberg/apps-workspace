-- DoWork trainer platform schema v2 (Plan 36, Phase 1.1).
--
-- Adds the cloud spine for the trainer platform: invite-gated trainer
-- onboarding, per-trainer subscriptions, an append-only purchase ledger,
-- a private trainer-client coaching loop (client links, form checks,
-- timestamped feedback), per-hour view dedup, and Expo push tokens.
--
-- Security posture:
--   * Sensitive writes (invites, subscriptions, purchase events, view marks)
--     happen through service-role edge functions; those tables carry RLS with
--     no end-user policies so JWT callers cannot read or enumerate them.
--   * Coaching rows are readable/writable only by the two participants of a
--     client link, resolved through security-definer helpers to avoid RLS
--     recursion across dw_client_links / dw_trainers.
--   * The paywall lives in the database: dw_trainer_videos select is gated on
--     free / owner / active subscription / active client link.
--
-- All statements idempotent. Existing dw_ tables carry updated_at columns with
-- no auto-update trigger (writers set it explicitly); this migration mirrors
-- that and adds no updated_at trigger.

-- ─── New tables (dependency order) ─────────────────────────────────────────

create table if not exists public.dw_trainer_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                     -- 12-char A-Z2-9, server-generated
  created_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
alter table public.dw_trainer_invites enable row level security;
-- No policies: redemption runs inside dowork-redeem-invite (service role),
-- which prevents code enumeration.

create table if not exists public.dw_trainer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trainer_id uuid not null references public.dw_trainers(id) on delete cascade,
  product_id text not null,
  store text not null check (store in ('app_store','play_store')),
  status text not null check (status in ('active','cancelled','expired','billing_issue')),
  current_period_end timestamptz,
  rc_app_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trainer_id)
);
create index if not exists dw_trainer_subscriptions_trainer_idx
  on public.dw_trainer_subscriptions (trainer_id, status);
create index if not exists dw_trainer_subscriptions_user_idx
  on public.dw_trainer_subscriptions (user_id, status);
alter table public.dw_trainer_subscriptions enable row level security;
-- Written only by dowork-rc-webhook (service role). Self-read + trainer-read
-- policies below.

create table if not exists public.dw_purchase_events (
  id uuid primary key default gen_random_uuid(),
  rc_event_id text not null unique,              -- idempotency key
  event_type text not null,
  user_id uuid,
  trainer_id uuid,
  product_id text,
  price_usd numeric(10,2),
  raw jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists dw_purchase_events_trainer_idx
  on public.dw_purchase_events (trainer_id, created_at);
alter table public.dw_purchase_events enable row level security;
-- Append-only ledger, service role only. Trainer earnings read through
-- dw_get_trainer_earnings() below, never the raw table.

create table if not exists public.dw_client_links (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.dw_trainers(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique,              -- per-client code the trainer shares
  status text not null default 'invited' check (status in ('invited','active','ended')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  ended_at timestamptz,
  unique (trainer_id, client_user_id)
);
create index if not exists dw_client_links_trainer_idx
  on public.dw_client_links (trainer_id, status);
create index if not exists dw_client_links_client_idx
  on public.dw_client_links (client_user_id) where client_user_id is not null;
alter table public.dw_client_links enable row level security;

create table if not exists public.dw_form_checks (
  id uuid primary key default gen_random_uuid(),
  client_link_id uuid not null references public.dw_client_links(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  exercise_slug text,
  storage_path text not null,                    -- dowork-form-checks bucket, private
  thumbnail_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','reviewed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists dw_form_checks_link_idx
  on public.dw_form_checks (client_link_id, created_at);
create index if not exists dw_form_checks_status_idx
  on public.dw_form_checks (client_link_id, status);
alter table public.dw_form_checks enable row level security;

create table if not exists public.dw_form_feedback (
  id uuid primary key default gen_random_uuid(),
  form_check_id uuid not null references public.dw_form_checks(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text,
  video_timestamp_seconds numeric(8,2),          -- anchors feedback to a moment
  reply_storage_path text,                       -- optional video reply, same bucket
  created_at timestamptz not null default now(),
  check (body is not null or reply_storage_path is not null)
);
create index if not exists dw_form_feedback_check_idx
  on public.dw_form_feedback (form_check_id, created_at);
alter table public.dw_form_feedback enable row level security;

create table if not exists public.dw_video_view_marks (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.dw_trainer_videos(id) on delete cascade,
  hour_bucket timestamptz not null,
  primary key (user_id, video_id, hour_bucket)
);
alter table public.dw_video_view_marks enable row level security;
-- Service-role only (written by dowork-playback-url); dedupes view_count bumps
-- to one per user per video per hour. No policies.

create table if not exists public.dw_push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_token)
);
alter table public.dw_push_tokens enable row level security;

-- ─── Altered base tables ───────────────────────────────────────────────────

alter table public.dw_trainers
  add column if not exists handle text unique,
  add column if not exists headline text,
  add column if not exists specialties text[] not null default '{}',
  add column if not exists instagram text,
  add column if not exists website text,
  add column if not exists hero_image_path text,
  add column if not exists price_tier integer not null default 1
    check (price_tier between 1 and 8),
  add column if not exists subscriber_count integer not null default 0;

-- Invite-only trainers: dowork-redeem-invite (service role) is the ONLY path that
-- creates dw_trainers rows. The P7 guarded owner-insert would otherwise let any
-- authenticated user self-create an unverified trainer row, which unlocks the
-- Trainer Studio gate (the gate is row existence, not is_verified).
drop policy if exists dw_trainers_owner_insert on public.dw_trainers;

alter table public.dw_trainer_videos
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists is_premium boolean not null default false,
  add column if not exists view_count integer not null default 0,
  add column if not exists published_at timestamptz default now();

create index if not exists dw_trainer_videos_trainer_idx
  on public.dw_trainer_videos (trainer_id, published_at desc);

-- ─── Security-definer helpers (coaching participation + invite redemption) ─

-- True when the caller is either participant (client or trainer) of a client
-- link. Security definer so the check is not blocked by the caller's RLS view
-- of dw_client_links / dw_trainers. Pass p_require_active to also require the
-- link to be currently active.
create or replace function public.dw_link_participant(
  p_link_id uuid,
  p_require_active boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dw_client_links c
    left join public.dw_trainers t on t.id = c.trainer_id
    where c.id = p_link_id
      and (c.client_user_id = auth.uid() or t.user_id = auth.uid())
      and (not p_require_active or c.status = 'active')
  );
$$;
revoke all on function public.dw_link_participant(uuid, boolean) from public, anon;
grant execute on function public.dw_link_participant(uuid, boolean) to authenticated, service_role;

-- Participation resolved through a form check's parent link.
create or replace function public.dw_form_feedback_participant(
  p_form_check_id uuid,
  p_require_active boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dw_form_checks fc
    join public.dw_client_links c on c.id = fc.client_link_id
    left join public.dw_trainers t on t.id = c.trainer_id
    where fc.id = p_form_check_id
      and (c.client_user_id = auth.uid() or t.user_id = auth.uid())
      and (not p_require_active or c.status = 'active')
  );
$$;
revoke all on function public.dw_form_feedback_participant(uuid, boolean) from public, anon;
grant execute on function public.dw_form_feedback_participant(uuid, boolean) to authenticated, service_role;

-- True only when the caller is the trainer side of the link (used to gate the
-- trainer-only form-check status update).
create or replace function public.dw_trainer_owns_link(p_link_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dw_client_links c
    join public.dw_trainers t on t.id = c.trainer_id
    where c.id = p_link_id and t.user_id = auth.uid()
  );
$$;
revoke all on function public.dw_trainer_owns_link(uuid) from public, anon;
grant execute on function public.dw_trainer_owns_link(uuid) to authenticated, service_role;

-- Client activation path. Validates an unclaimed per-client code, requires
-- status = 'invited', and flips the link to active for the caller. Codes are
-- not enumerable: this is the only end-user path that reads them, and it never
-- returns other columns. A trainer cannot redeem their own client code.
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

-- Trainer earnings. dw_purchase_events has no end-user policies, so a plain
-- security_invoker view would return nothing; this security-definer function
-- aggregates only the caller's own trainer events. Column shape matches the
-- plan (month, paid_events, gross_usd).
drop view if exists public.dw_trainer_earnings;
create or replace function public.dw_get_trainer_earnings()
returns table (
  month timestamptz,
  paid_events bigint,
  gross_usd numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('month', e.created_at) as month,
    count(*) filter (where e.event_type in ('INITIAL_PURCHASE','RENEWAL')) as paid_events,
    coalesce(
      sum(e.price_usd) filter (where e.event_type in ('INITIAL_PURCHASE','RENEWAL')),
      0
    ) as gross_usd
  from public.dw_purchase_events e
  where e.trainer_id in (
    select t.id from public.dw_trainers t where t.user_id = auth.uid()
  )
  group by 1
  order by 1 desc;
$$;
revoke all on function public.dw_get_trainer_earnings() from public, anon;
grant execute on function public.dw_get_trainer_earnings() to authenticated;

-- ─── dw_trainer_subscriptions policies (self-read + trainer-read) ───────────

drop policy if exists dw_trainer_subscriptions_self_select on public.dw_trainer_subscriptions;
create policy dw_trainer_subscriptions_self_select
  on public.dw_trainer_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists dw_trainer_subscriptions_trainer_select on public.dw_trainer_subscriptions;
create policy dw_trainer_subscriptions_trainer_select
  on public.dw_trainer_subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  );

-- ─── dw_client_links policies (trainer CRUD on own rows + client self-read) ─

drop policy if exists dw_client_links_trainer_select on public.dw_client_links;
create policy dw_client_links_trainer_select
  on public.dw_client_links
  for select
  to authenticated
  using (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  );

drop policy if exists dw_client_links_trainer_insert on public.dw_client_links;
create policy dw_client_links_trainer_insert
  on public.dw_client_links
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
    and status = 'invited'
    and client_user_id is null
  );

drop policy if exists dw_client_links_trainer_update on public.dw_client_links;
create policy dw_client_links_trainer_update
  on public.dw_client_links
  for update
  to authenticated
  using (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  );

drop policy if exists dw_client_links_trainer_delete on public.dw_client_links;
create policy dw_client_links_trainer_delete
  on public.dw_client_links
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.dw_trainers t
      where t.id = trainer_id and t.user_id = auth.uid()
    )
  );

-- Client reads its own link. Activation flows through
-- dw_redeem_client_invite() (security definer), so there is no client update
-- policy and codes stay non-enumerable.
drop policy if exists dw_client_links_client_select on public.dw_client_links;
create policy dw_client_links_client_select
  on public.dw_client_links
  for select
  to authenticated
  using (client_user_id = auth.uid());

-- ─── dw_form_checks policies (participants read; participant insert on active;
--     trainer-only status update guarded by a protect trigger) ──────────────

drop policy if exists dw_form_checks_participant_select on public.dw_form_checks;
create policy dw_form_checks_participant_select
  on public.dw_form_checks
  for select
  to authenticated
  using (public.dw_link_participant(client_link_id));

drop policy if exists dw_form_checks_participant_insert on public.dw_form_checks;
create policy dw_form_checks_participant_insert
  on public.dw_form_checks
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and public.dw_link_participant(client_link_id, true)
  );

drop policy if exists dw_form_checks_trainer_update on public.dw_form_checks;
create policy dw_form_checks_trainer_update
  on public.dw_form_checks
  for update
  to authenticated
  using (public.dw_trainer_owns_link(client_link_id))
  with check (public.dw_trainer_owns_link(client_link_id));

-- No delete policy: account deletion cascades server-side.

-- Column guard: the trainer update path may only touch status / reviewed_at.
create or replace function public.dw_form_checks_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if new.client_link_id is distinct from old.client_link_id
     or new.author_user_id is distinct from old.author_user_id
     or new.exercise_slug is distinct from old.exercise_slug
     or new.storage_path is distinct from old.storage_path
     or new.thumbnail_path is distinct from old.thumbnail_path
     or new.duration_seconds is distinct from old.duration_seconds
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at then
    raise exception 'dw_form_checks: only status and reviewed_at may be updated';
  end if;
  return new;
end;
$$;

drop trigger if exists dw_form_checks_protect_columns on public.dw_form_checks;
create trigger dw_form_checks_protect_columns
  before update on public.dw_form_checks
  for each row
  execute function public.dw_form_checks_protect_columns();

-- ─── dw_form_feedback policies (participants read + author insert) ──────────

drop policy if exists dw_form_feedback_participant_select on public.dw_form_feedback;
create policy dw_form_feedback_participant_select
  on public.dw_form_feedback
  for select
  to authenticated
  using (public.dw_form_feedback_participant(form_check_id));

drop policy if exists dw_form_feedback_participant_insert on public.dw_form_feedback;
create policy dw_form_feedback_participant_insert
  on public.dw_form_feedback
  for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and public.dw_form_feedback_participant(form_check_id)
  );

-- No delete policy: account deletion cascades server-side.

-- ─── dw_push_tokens policies (owner-only CRUD) ─────────────────────────────

drop policy if exists dw_push_tokens_owner_select on public.dw_push_tokens;
create policy dw_push_tokens_owner_select
  on public.dw_push_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists dw_push_tokens_owner_insert on public.dw_push_tokens;
create policy dw_push_tokens_owner_insert
  on public.dw_push_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists dw_push_tokens_owner_update on public.dw_push_tokens;
create policy dw_push_tokens_owner_update
  on public.dw_push_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists dw_push_tokens_owner_delete on public.dw_push_tokens;
create policy dw_push_tokens_owner_delete
  on public.dw_push_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── dw_trainer_videos paywall (the entitlement select policy) ─────────────
-- Enforced in the database, not the client: free OR owner OR active unexpired
-- subscription OR active client link.

drop policy if exists dw_trainer_videos_select_public on public.dw_trainer_videos;
drop policy if exists dw_trainer_videos_select_entitled on public.dw_trainer_videos;
create policy dw_trainer_videos_select_entitled
  on public.dw_trainer_videos
  for select
  using (
    is_hidden = false and (
      is_premium = false
      or exists (select 1 from public.dw_trainers t
                 where t.id = trainer_id and t.user_id = auth.uid())
      or exists (select 1 from public.dw_trainer_subscriptions s
                 where s.trainer_id = dw_trainer_videos.trainer_id
                   and s.user_id = auth.uid() and s.status = 'active'
                   and (s.current_period_end is null or s.current_period_end > now()))
      or exists (select 1 from public.dw_client_links c
                 where c.trainer_id = dw_trainer_videos.trainer_id
                   and c.client_user_id = auth.uid() and c.status = 'active')
    )
  );

-- ─── dw_trainers protect trigger (extend the P7 is_verified guard) ─────────
-- Owner JWTs may not change is_verified, is_active, or subscriber_count.
-- Service role (moderation tooling, billing webhooks) and direct admin SQL
-- pass. price_tier changes remain allowed for the owner.

create or replace function public.dw_trainers_protect_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if new.is_verified is distinct from old.is_verified then
    raise exception 'dw_trainers.is_verified may only be changed by moderation tooling';
  end if;
  if new.is_active is distinct from old.is_active then
    raise exception 'dw_trainers.is_active may only be changed by moderation tooling';
  end if;
  if new.subscriber_count is distinct from old.subscriber_count then
    raise exception 'dw_trainers.subscriber_count is maintained by billing webhooks only';
  end if;
  return new;
end;
$$;

drop trigger if exists dw_trainers_protect_verified on public.dw_trainers;
create trigger dw_trainers_protect_verified
  before update on public.dw_trainers
  for each row
  execute function public.dw_trainers_protect_verified();

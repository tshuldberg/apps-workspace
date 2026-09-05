-- Yearn push notification fanout substrate (plan 47 Phase 4).
-- Durable outbox + definer enqueue triggers on likes, matches, and messages,
-- drained by the yearn-push-fanout edge function. Mirrors the BestChef
-- bc_push_outbox pattern (20260711000010). Idempotent and re-runnable.
--
-- Privacy: pushes NEVER carry message content (chat is E2EE), sender display
-- names, or profile data. Copy is composed server-side in the fanout worker
-- from the kind alone ("Someone liked you", "You have a new match",
-- "New message").

-- =========================================
-- JOB CONFIG (service-role only key/value, mirrors bc_job_config)
-- =========================================
create table if not exists yearn.job_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table yearn.job_config enable row level security;
-- No policies: service-role only.
revoke all on table yearn.job_config from public, anon, authenticated;
grant select, insert, update, delete on table yearn.job_config to service_role;

-- =========================================
-- PUSH OUTBOX
-- =========================================
create table if not exists yearn.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like_received', 'match_created', 'message_received')),
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table yearn.push_outbox is
  'Durable push-fanout queue. Definer triggers enqueue kind-only rows '
  '(no content, no identities beyond the recipient); yearn-push-fanout '
  'drains it. Service-role only.';

create index if not exists yearn_push_outbox_drain_idx
  on yearn.push_outbox (status, created_at)
  where status in ('queued', 'failed');

alter table yearn.push_outbox enable row level security;
-- No policies: RLS with zero policies denies all end-user access.
revoke all on table yearn.push_outbox from public, anon, authenticated;
grant select, insert, update on table yearn.push_outbox to service_role;

-- =========================================
-- ENQUEUE TRIGGERS
-- Wrapped so a push-queue failure never aborts the source insert: the like,
-- match, or message row is the source of truth; push is best-effort delivery.
-- =========================================

-- Likes: notify the recipient unless this like completes a mutual pair
-- (like_back inserts a reciprocal like just before the match row; the
-- match_created push covers that moment).
create or replace function yearn.enqueue_push_on_like()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  if not exists (
    select 1 from yearn.likes l
    where l.sender_id = new.recipient_id
      and l.recipient_id = new.sender_id
  ) then
    insert into yearn.push_outbox (user_id, kind)
    values (new.recipient_id, 'like_received');
  end if;
  return new;
exception when others then
  raise notice 'yearn.enqueue_push_on_like: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists yearn_likes_enqueue_push on yearn.likes;
create trigger yearn_likes_enqueue_push
after insert on yearn.likes
for each row execute function yearn.enqueue_push_on_like();

revoke all on function yearn.enqueue_push_on_like()
  from public, anon, authenticated;

-- Matches: notify both members.
create or replace function yearn.enqueue_push_on_match()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  insert into yearn.push_outbox (user_id, kind)
  values
    (new.user_a, 'match_created'),
    (new.user_b, 'match_created');
  return new;
exception when others then
  raise notice 'yearn.enqueue_push_on_match: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists yearn_matches_enqueue_push on yearn.matches;
create trigger yearn_matches_enqueue_push
after insert on yearn.matches
for each row execute function yearn.enqueue_push_on_match();

revoke all on function yearn.enqueue_push_on_match()
  from public, anon, authenticated;

-- Messages: notify the other match member. Intro messages ride along with a
-- like (which already pushes), so only kind='user' messages enqueue.
create or replace function yearn.enqueue_push_on_message()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_recipient uuid;
begin
  if new.kind <> 'user' then
    return new;
  end if;

  select case when m.user_a = new.sender_id then m.user_b else m.user_a end
    into v_recipient
  from yearn.matches m
  where m.id = new.match_id;

  if v_recipient is not null then
    insert into yearn.push_outbox (user_id, kind)
    values (v_recipient, 'message_received');
  end if;
  return new;
exception when others then
  raise notice 'yearn.enqueue_push_on_message: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists yearn_messages_enqueue_push on yearn.messages_ciphertext;
create trigger yearn_messages_enqueue_push
after insert on yearn.messages_ciphertext
for each row execute function yearn.enqueue_push_on_message();

revoke all on function yearn.enqueue_push_on_message()
  from public, anon, authenticated;

-- =========================================
-- WORKER SCHEDULING
-- Quiet no-op when unconfigured, when the outbox is empty, or when pg_net is
-- missing. Mirrors bc_run_push_fanout_worker.
-- =========================================
create or replace function yearn.run_push_fanout_worker()
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_url text;
  v_secret text;
  v_pending integer;
begin
  select value into v_url from yearn.job_config where key = 'functions_base_url';
  select value into v_secret from yearn.job_config where key = 'push_fanout_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  select count(*) into v_pending
  from yearn.push_outbox
  where status in ('queued', 'failed') and attempts < 5;
  if v_pending = 0 then
    return;
  end if;

  begin
    perform net.http_post(
      url := rtrim(v_url, '/') || '/yearn-push-fanout',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Yearn-Worker-Secret', v_secret
      ),
      body := '{}'::jsonb
    );
  exception when others then
    raise notice 'yearn.run_push_fanout_worker: http_post failed: %', sqlerrm;
  end;
end;
$$;

revoke all on function yearn.run_push_fanout_worker() from public, anon, authenticated;
grant execute on function yearn.run_push_fanout_worker() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'yearn-push-fanout-worker',
      '*/2 * * * *',
      $job$select yearn.run_push_fanout_worker();$job$
    );
  else
    raise notice 'pg_cron not installed: Yearn push-fanout worker job not scheduled in this environment.';
  end if;
exception when others then
  raise notice 'Yearn push-fanout worker job scheduling skipped: %', sqlerrm;
end $$;

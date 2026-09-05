-- Yearn rate-limit hardening for victim-hammering and rolling-window scans.
-- The audit found that one sender could focus the full global message budget on
-- a single victim. The existing 30-per-minute global cap remains, while a
-- 15-per-minute per-conversation cap limits concentrated traffic and still
-- allows normal chat. Reports are capped at 30 per reporter per rolling hour to
-- protect moderation intake without blocking legitimate safety use. The
-- existing 120-per-hour likes cap is unchanged; its scan only gains an index.
-- Idempotent and safely re-runnable.

-- =========================================
-- Supporting indexes for rolling windows
-- =========================================
create index if not exists messages_sender_rate_limit_idx
  on yearn.messages (sender_id, created_at);
create index if not exists messages_conversation_rate_limit_idx
  on yearn.messages (match_id, sender_id, created_at);
create index if not exists messages_ciphertext_sender_rate_limit_idx
  on yearn.messages_ciphertext (sender_id, created_at);
create index if not exists messages_ciphertext_conversation_rate_limit_idx
  on yearn.messages_ciphertext (match_id, sender_id, created_at);
create index if not exists likes_sender_rate_limit_idx
  on yearn.likes (sender_id, created_at);
create index if not exists reports_reporter_rate_limit_idx
  on yearn.reports (reporter_id, created_at);

-- =========================================
-- Plaintext message rate limiting
-- =========================================
create or replace function yearn.rate_limit_messages()
returns trigger
language plpgsql
as $$
declare
  -- TUNABLE: max messages a single sender may send per rolling minute.
  MESSAGES_MAX_PER_MIN constant int := 30;
  -- TUNABLE: max messages a sender may send to one match per rolling minute.
  MESSAGES_MAX_PER_CONVERSATION_PER_MIN constant int := 15;
  recent_global int;
  recent_conversation int;
begin
  select count(*) into recent_global
  from yearn.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_global >= MESSAGES_MAX_PER_MIN then
    raise exception 'You are sending messages too quickly. Global message rate limit exceeded.'
      using errcode = 'check_violation';
  end if;

  select count(*) into recent_conversation
  from yearn.messages
  where match_id = new.match_id
    and sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_conversation >= MESSAGES_MAX_PER_CONVERSATION_PER_MIN then
    raise exception 'You are sending messages too quickly in this conversation. Per-conversation message rate limit exceeded.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- =========================================
-- Ciphertext message rate limiting
-- =========================================
create or replace function yearn.rate_limit_messages_ciphertext()
returns trigger
language plpgsql
as $$
declare
  -- TUNABLE: max ciphertext messages a sender may send per rolling minute.
  MESSAGES_CIPHERTEXT_MAX_PER_MIN constant int := 30;
  -- TUNABLE: max ciphertext messages a sender may send to one match per minute.
  MESSAGES_CIPHERTEXT_MAX_PER_CONVERSATION_PER_MIN constant int := 15;
  recent_global int;
  recent_conversation int;
begin
  select count(*) into recent_global
  from yearn.messages_ciphertext
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_global >= MESSAGES_CIPHERTEXT_MAX_PER_MIN then
    raise exception 'You are sending messages too quickly. Global message rate limit exceeded.'
      using errcode = 'check_violation';
  end if;

  select count(*) into recent_conversation
  from yearn.messages_ciphertext
  where match_id = new.match_id
    and sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_conversation >= MESSAGES_CIPHERTEXT_MAX_PER_CONVERSATION_PER_MIN then
    raise exception 'You are sending messages too quickly in this conversation. Per-conversation message rate limit exceeded.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- =========================================
-- Report rate limiting
-- =========================================
create or replace function yearn.rate_limit_reports()
returns trigger
language plpgsql
as $$
declare
  -- TUNABLE: max reports a single reporter may file per rolling hour.
  REPORTS_MAX_PER_HOUR constant int := 30;
  recent int;
begin
  select count(*) into recent
  from yearn.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';

  if recent >= REPORTS_MAX_PER_HOUR then
    raise exception 'report rate limit exceeded'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_rate_limit on yearn.reports;
create trigger reports_rate_limit
before insert on yearn.reports
for each row execute function yearn.rate_limit_reports();

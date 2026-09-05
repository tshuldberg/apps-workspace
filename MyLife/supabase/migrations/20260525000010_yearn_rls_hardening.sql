-- Yearn RLS hardening: tighten two over-broad policies flagged by security review.
-- Apply after 0009_yearn_match_cap.sql. Idempotent and safely re-runnable.
--
-- This migration:
--   1. profiles SELECT: replaces the broad "profiles select active" (any
--      authenticated user could read every non-paused profile row - a mass-scrape
--      vector) with own-row-only. Discovery / likes inbox / matches keep working
--      because they flow through the SECURITY DEFINER RPCs in 0006 / 0008
--      (discover_profiles, incoming_likes, my_matches, like_back), which run as the
--      definer and ignore table RLS. The Swift client only ever selects the
--      caller's OWN profile row directly from the table (loadMyProfile filters by
--      the session user id), so own-only does not break the client.
--   2. messages UPDATE: replaces the over-broad "messages update read_at" (any
--      authenticated non-sender could update ANY message row, including threads
--      they are not part of, with no column restriction) with a participant- and
--      column-scoped update. Clients can only ever write the read_at column, and
--      only on messages in a match they belong to, where they are not the sender,
--      and where the pair is not blocked. This matches the markRead path in
--      SupabaseRepository, which updates only read_at on its own match threads.
--   3. (Optional) Basic abuse rate-limit triggers on likes and messages.

-- =========================================
-- 1. profiles SELECT -> own row only
-- =========================================
-- Drop the broad policy from 0001 that exposed every non-paused profile.
drop policy if exists "profiles select active" on yearn.profiles;

-- Own-row-only. Other users' profile data is served exclusively by the
-- SECURITY DEFINER discovery / social RPCs, which bypass this policy.
drop policy if exists "profiles select own" on yearn.profiles;
create policy "profiles select own"
on yearn.profiles for select
to authenticated
using (id = auth.uid());

-- =========================================
-- 2. messages UPDATE -> column- and participant-scoped read_at write
-- =========================================
-- Column scope: clients may only ever write the read_at column. Revoke the
-- table-wide UPDATE granted in 0001 / 0002 and re-grant only update(read_at).
-- (service_role bypasses column privileges and RLS, so the backend is unaffected.)
revoke update on yearn.messages from authenticated;
grant update (read_at) on yearn.messages to authenticated;

-- Row scope: the updater must be a participant of the message's match, must NOT
-- be the sender, and the pair must not be blocked. Replaces the 0002 policy that
-- only checked sender_id <> auth.uid().
drop policy if exists "messages update read_at" on yearn.messages;
create policy "messages update read_at"
on yearn.messages for update
to authenticated
using (
  sender_id <> auth.uid()
  and exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(m.user_a, m.user_b)
  )
)
with check (
  sender_id <> auth.uid()
  and exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(m.user_a, m.user_b)
  )
);

-- =========================================
-- 3. Abuse rate limiting (BEFORE INSERT triggers)
-- =========================================
-- Tunable thresholds. Raise a friendly exception when a sender exceeds the limit
-- over a rolling window. These run as part of the normal INSERT path; the
-- handle_new_like AFTER trigger from 0001 still fires for inserts that pass the
-- BEFORE guard, so match formation is unaffected.
--
-- Tuning knobs (edit these two constants to adjust the limits):
--   likes:    LIKES_MAX_PER_HOUR     = 120 inserts per sender per rolling hour
--   messages: MESSAGES_MAX_PER_MIN   = 30  inserts per sender per rolling minute

create or replace function yearn.rate_limit_likes()
returns trigger
language plpgsql
as $$
declare
  -- TUNABLE: max likes a single sender may create per rolling hour.
  LIKES_MAX_PER_HOUR constant int := 120;
  recent int;
begin
  select count(*) into recent
  from yearn.likes
  where sender_id = new.sender_id
    and created_at > now() - interval '1 hour';

  if recent >= LIKES_MAX_PER_HOUR then
    raise exception 'You are liking a bit too fast. Take a short break and try again soon.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists likes_rate_limit on yearn.likes;
create trigger likes_rate_limit
before insert on yearn.likes
for each row execute function yearn.rate_limit_likes();

create or replace function yearn.rate_limit_messages()
returns trigger
language plpgsql
as $$
declare
  -- TUNABLE: max messages a single sender may send per rolling minute.
  MESSAGES_MAX_PER_MIN constant int := 30;
  recent int;
begin
  select count(*) into recent
  from yearn.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent >= MESSAGES_MAX_PER_MIN then
    raise exception 'You are sending messages too quickly. Please slow down a moment.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit on yearn.messages;
create trigger messages_rate_limit
before insert on yearn.messages
for each row execute function yearn.rate_limit_messages();

-- =========================================
-- Grants / revokes
-- =========================================
-- profiles: full table CRUD privileges for authenticated stay as granted in 0001;
-- own-row visibility is enforced by RLS, not by revoking table privileges.
-- messages: UPDATE is now column-scoped to read_at (handled above). SELECT and
-- INSERT privileges from 0002 are unchanged.
grant select, insert on yearn.messages to authenticated;

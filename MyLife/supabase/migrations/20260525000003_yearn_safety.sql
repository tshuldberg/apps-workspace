-- Yearn safety layer: blocks, reports, and bidirectional block enforcement.
-- Apply after 0002_yearn_messages.sql. Idempotent and safely re-runnable.
--
-- This migration:
--   1. Adds yearn.blocks (mutual-block ledger) + RLS.
--   2. Adds yearn.reports (moderation queue, service-role managed) + RLS.
--   3. Adds yearn.is_blocked(a, b) helper used by every read path.
--   4. Folds block exclusion into the existing messages / matches / likes
--      SELECT (and messages INSERT) policies so a block hides people both ways.

-- =========================================
-- BLOCKS
-- One row per directional block. is_blocked() makes it effectively mutual.
-- =========================================
create table if not exists yearn.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on yearn.blocks (blocked_id);

alter table yearn.blocks enable row level security;

drop policy if exists "blocks select own" on yearn.blocks;
create policy "blocks select own"
on yearn.blocks for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "blocks insert own" on yearn.blocks;
create policy "blocks insert own"
on yearn.blocks for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "blocks delete own" on yearn.blocks;
create policy "blocks delete own"
on yearn.blocks for delete
to authenticated
using (blocker_id = auth.uid());

grant select, insert, delete on yearn.blocks to authenticated;

-- =========================================
-- REPORTS
-- Moderation queue. Users file and read their own reports only;
-- update/delete are service-role only (no authenticated policy for them).
-- =========================================
create table if not exists yearn.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text default null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index if not exists reports_reported_idx on yearn.reports (reported_id);
create index if not exists reports_status_idx on yearn.reports (status);

alter table yearn.reports enable row level security;

drop policy if exists "reports insert own" on yearn.reports;
create policy "reports insert own"
on yearn.reports for insert
to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports select own" on yearn.reports;
create policy "reports select own"
on yearn.reports for select
to authenticated
using (reporter_id = auth.uid());

-- No UPDATE or DELETE policy for authenticated: moderation runs as service_role,
-- which bypasses RLS. Grant only insert + select to authenticated.
grant insert, select on yearn.reports to authenticated;

-- =========================================
-- is_blocked(a, b)
-- True if a blocked b OR b blocked a. Used everywhere to hide blocked people
-- in both directions. SECURITY DEFINER so it can read yearn.blocks regardless
-- of the caller's row-level visibility into the blocks table.
-- =========================================
create or replace function yearn.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = yearn, public
as $$
  select exists (
    select 1 from yearn.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function yearn.is_blocked(uuid, uuid) from public, anon;
grant execute on function yearn.is_blocked(uuid, uuid) to authenticated;

-- =========================================
-- Fold blocks into existing read paths.
-- Each policy below reproduces its original USING / WITH CHECK from
-- 0001/0002 verbatim and appends the block exclusion. Nothing is loosened.
-- =========================================

-- messages SELECT: original required match participation. Add: the OTHER
-- participant must not be blocked relative to me. Derived from the match row.
drop policy if exists "messages select participants" on yearn.messages;
create policy "messages select participants"
on yearn.messages for select
to authenticated
using (
  exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(
        auth.uid(),
        case when m.user_a = auth.uid() then m.user_b else m.user_a end
      )
  )
);

-- messages INSERT: original required sender_id = me AND match participation.
-- Add: the other participant must not be blocked.
drop policy if exists "messages insert as sender" on yearn.messages;
create policy "messages insert as sender"
on yearn.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(
        auth.uid(),
        case when m.user_a = auth.uid() then m.user_b else m.user_a end
      )
  )
);

-- matches SELECT: original required I am user_a or user_b. Add: the pair is
-- not blocked in either direction.
drop policy if exists "matches select mine" on yearn.matches;
create policy "matches select mine"
on yearn.matches for select
to authenticated
using (
  (user_a = auth.uid() or user_b = auth.uid())
  and not yearn.is_blocked(user_a, user_b)
);

-- likes SELECT: original required I am sender or recipient. Add: exclude
-- blocked pairs in either direction.
drop policy if exists "likes select involving me" on yearn.likes;
create policy "likes select involving me"
on yearn.likes for select
to authenticated
using (
  (sender_id = auth.uid() or recipient_id = auth.uid())
  and not yearn.is_blocked(sender_id, recipient_id)
);

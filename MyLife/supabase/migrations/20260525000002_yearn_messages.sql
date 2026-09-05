-- Yearn messaging layer.
-- Apply after 0001_yearn_schema_init.sql.

-- =========================================
-- MESSAGES
-- Each row is one message in a match thread.
-- =========================================
create table if not exists yearn.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references yearn.matches(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz default null,
  created_at timestamptz not null default now()
);

create index if not exists messages_match_idx on yearn.messages (match_id, created_at asc);
create index if not exists messages_sender_idx on yearn.messages (sender_id, created_at desc);

alter table yearn.messages enable row level security;

-- Participants in the match can select and insert.
drop policy if exists "messages select participants" on yearn.messages;
create policy "messages select participants"
on yearn.messages for select
to authenticated
using (
  exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
  )
);

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
  )
);

-- Only the recipient can mark read.
drop policy if exists "messages update read_at" on yearn.messages;
create policy "messages update read_at"
on yearn.messages for update
to authenticated
using (sender_id <> auth.uid())
with check (sender_id <> auth.uid());

grant select, insert, update on yearn.messages to authenticated;

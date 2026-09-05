-- P1-B: Tap vote tier expansion + decomposition count triggers.
-- The existing bc_votes.tier column is integer (0-3). This migration converts
-- it to text using named labels, adds tap_up / tap_down to the allowed set,
-- and wires up the decomposition trigger for bc_submissions count columns.

begin;

-- 1. Add a temporary text column and backfill from the integer values.
alter table public.bc_votes
  add column if not exists tier_text text;

update public.bc_votes set tier_text = case tier
  when 0 then 'like'
  when 1 then 'bronze'
  when 2 then 'silver'
  when 3 then 'gold'
  else 'like'
end;

-- 2. Drop the old integer column (and its implicit CHECK).
alter table public.bc_votes
  drop column tier;

-- 3. Rename tier_text -> tier and add the full constraint.
alter table public.bc_votes
  rename column tier_text to tier;

alter table public.bc_votes
  alter column tier set not null;

alter table public.bc_votes
  drop constraint if exists bc_votes_tier_check;

alter table public.bc_votes
  add constraint bc_votes_tier_check
  check (tier in ('gold', 'silver', 'bronze', 'like', 'tap_up', 'tap_down'));

-- 4. Decomposition trigger: maintain upvote_count, downvote_count,
--    reviewed_count, and tap_count on bc_submissions.
--    Only INSERT and DELETE fire; updates to tier are not expected
--    (upsert logic deletes + inserts instead).

create or replace function bc_submissions_decompose_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta        int  := case when tg_op = 'INSERT' then 1
                            when tg_op = 'DELETE' then -1
                            else 0 end;
  v_tier       text;
  v_sub_id     uuid;
begin
  if tg_op = 'INSERT' then
    v_tier   := new.tier;
    v_sub_id := new.submission_id;
  elsif tg_op = 'DELETE' then
    v_tier   := old.tier;
    v_sub_id := old.submission_id;
  else
    return null;
  end if;

  update public.bc_submissions s set
    upvote_count   = upvote_count   + (case when v_tier in ('gold','silver','bronze','like','tap_up')  then delta else 0 end),
    downvote_count = downvote_count + (case when v_tier = 'tap_down'                                   then delta else 0 end),
    reviewed_count = reviewed_count + (case when v_tier in ('gold','silver','bronze')                  then delta else 0 end),
    tap_count      = tap_count      + (case when v_tier in ('tap_up','tap_down')                       then delta else 0 end)
  where s.id = v_sub_id;

  return null;
end;
$$;

drop trigger if exists bc_votes_decompose on public.bc_votes;

create trigger bc_votes_decompose
  after insert or delete on public.bc_votes
  for each row execute function bc_submissions_decompose_counts();

commit;

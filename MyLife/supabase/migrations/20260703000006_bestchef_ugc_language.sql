-- BestChef UGC language tagging (plan 33 Phase 2.5).
--
-- Submissions, recipe snapshots, and comments carry the author's app
-- language at write time (nullable: rows written before this migration and
-- clients older than build 25 stay untagged and only appear in unfiltered
-- views). Feed and leaderboard queries filter on bc_submissions.language;
-- per-market leaderboards compose this with the existing region kind.
--
-- Vote-proof moderation queue rows inherit the submission's language via a
-- BEFORE trigger so the moderator console's queue language filter (built
-- dormant in Phase 1.3) activates without touching the bc_cast_vote RPC.

alter table public.bc_submissions
  add column if not exists language text;
alter table public.bc_recipe_snapshots
  add column if not exists language text;
alter table public.bc_comments
  add column if not exists language text;

-- Lowercase-only tags, same shape as bc_dish_translations.locale.
alter table public.bc_submissions
  drop constraint if exists bc_submissions_language_shape;
alter table public.bc_submissions
  add constraint bc_submissions_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');
alter table public.bc_recipe_snapshots
  drop constraint if exists bc_recipe_snapshots_language_shape;
alter table public.bc_recipe_snapshots
  add constraint bc_recipe_snapshots_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');
alter table public.bc_comments
  drop constraint if exists bc_comments_language_shape;
alter table public.bc_comments
  add constraint bc_comments_language_shape
  check (language is null or language ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$');

-- Feed/leaderboard filter path: language + approved + ranking order.
create index if not exists bc_submissions_language_idx
  on public.bc_submissions (language, moderation_status, vote_score desc)
  where language is not null;

-- ── Vote-proof queue language stamp ───────────────────────────────────

create or replace function public.bc_stamp_queue_language()
returns trigger
language plpgsql
as $$
declare
  v_submission_id uuid;
  v_language text;
begin
  if new.kind <> 'vote_proof' then
    return new;
  end if;
  begin
    v_submission_id := nullif(new.metadata ->> 'submission_id', '')::uuid;
  exception when others then
    return new;
  end;
  if v_submission_id is null then
    return new;
  end if;
  select s.language into v_language
  from public.bc_submissions s
  where s.id = v_submission_id;
  if v_language is not null then
    new.metadata := new.metadata || jsonb_build_object('language', v_language);
  end if;
  return new;
end;
$$;

drop trigger if exists bc_moderation_queue_language on public.bc_moderation_queue;
create trigger bc_moderation_queue_language
  before insert or update of metadata on public.bc_moderation_queue
  for each row
  execute function public.bc_stamp_queue_language();

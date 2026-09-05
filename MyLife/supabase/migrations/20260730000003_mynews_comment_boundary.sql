-- MyNews comment boundary and canonical size bounds (plan 48 WP4, review
-- findings C06 residual + H05).
--
-- Two gaps close here.
--
-- 1. Comments were the last unguarded client write. The bootstrap policy
--    nw_suggestion_events_actor_insert let any authenticated session insert
--    action='comment' rows straight into nw_suggestion_events via PostgREST:
--    no suspension check, no current-Terms check, no rate limit, and no length
--    limit at all. A suspended account could flood every public suggestion
--    thread with unbounded text. Every legitimate comment now goes through the
--    mynews-comment edge function under the service role, exactly like reports
--    go through mynews-report (see 20260705000005_mynews_report_intake.sql,
--    whose lockdown pattern this follows).
--
-- 2. Most stored MyNews text had no maximum anywhere: headline, dek, body,
--    rationale, citation list, structured diff, comment body, display name,
--    and journalist bio were all unbounded. The canonical numbers now live in
--    modules/mynews/src/data/bounds.ts, are mirrored for the edge in
--    supabase/functions/_shared/mynews-bounds.ts, and are enforced here in SQL
--    so a service-role bug or a future direct write cannot exceed them.
--
-- Bound values reproduced from MYNEWS_BOUNDS (keep the two in sync; the module
-- test bounds.test.ts pins each literal and the migration test
-- bounds-migration.test.ts pins the SQL):
--   headline        1..300 characters
--   dek             <= 600 characters
--   body_md         1..400000 BYTES (octet_length: script-neutral storage bound)
--   changelog_json  array, <= 100 entries
--   rationale       1..4000 characters
--   citations       array, <= 20 https URLs, each <= 2000 characters
--   diff_json       structured-diff object, <= 200 ops, <= 200 blocks per op,
--                   <= 20000 characters per block, <= 400000 bytes serialized
--   comment body    1..4000 characters
--   display_name    <= 80 characters
--   journalist bio  <= 2000 characters
--   report detail   <= 2000 characters
--
-- The CHECK constraints are added validated (not NOT VALID) on purpose: MyNews
-- has no public launch yet, and every bound is at or above the limit the app
-- and edge functions already enforced, so no row the current rules accept can
-- fail them. Append-only migration: earlier files stay untouched.

-- ============================================ immutable bound helpers

-- CHECK constraints cannot contain subqueries, so the per-element citation and
-- diff rules live in IMMUTABLE helper functions the constraints call.

-- plpgsql, not sql: Postgres does not guarantee the evaluation order of AND /
-- OR subexpressions, and jsonb_array_length() raises on a non-array. Sequential
-- IFs make the type guard provably run before the length call, so a malformed
-- payload returns false instead of raising a confusing error.
create or replace function public.nw_citations_within_bounds(p_citations jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_citations is null then
    return true;
  end if;
  if jsonb_typeof(p_citations) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p_citations) > 20 then
    return false;
  end if;
  return not exists (
    select 1
    from jsonb_array_elements(p_citations) as element
    where jsonb_typeof(element) <> 'string'
      or char_length(element #>> '{}') > 2000
      or element #>> '{}' not like 'https://%'
  );
end;
$$;

comment on function public.nw_citations_within_bounds(jsonb) is
  'Canonical citation bounds: <= 20 https URLs, each <= 2000 characters. Mirrors CITATIONS_MAX_ITEMS / URL_MAX_CHARS in modules/mynews/src/data/bounds.ts.';

-- plpgsql for the same evaluation-order reason as the citation helper: every
-- type guard provably precedes the call that would raise on the wrong type.
create or replace function public.nw_diff_within_bounds(p_diff jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_diff is null or jsonb_typeof(p_diff) <> 'object' then
    return false;
  end if;
  if jsonb_typeof(p_diff -> 'baseHash') <> 'string' then
    return false;
  end if;
  if char_length(p_diff #>> '{baseHash}') not between 1 and 64 then
    return false;
  end if;
  if jsonb_typeof(p_diff -> 'ops') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p_diff -> 'ops') > 200 then
    return false;
  end if;
  if octet_length(p_diff::text) > 400000 then
    return false;
  end if;
  return not exists (
    select 1
    from jsonb_array_elements(p_diff -> 'ops') as op
    where case
      when jsonb_typeof(op) <> 'object' then true
      when coalesce(op #>> '{kind}', '') not in ('replace', 'insert', 'delete') then true
      when jsonb_typeof(op -> 'baseIndex') <> 'number' then true
      when (op ->> 'baseIndex')::numeric < 0 then true
      when jsonb_typeof(op -> 'baseBlocks') <> 'array' then true
      when jsonb_typeof(op -> 'newBlocks') <> 'array' then true
      when jsonb_array_length(op -> 'baseBlocks') > 200 then true
      when jsonb_array_length(op -> 'newBlocks') > 200 then true
      when exists (
        select 1
        from jsonb_array_elements((op -> 'baseBlocks') || (op -> 'newBlocks')) as block
        where jsonb_typeof(block) <> 'string'
          or char_length(block #>> '{}') > 20000
      ) then true
      else false
    end
  );
end;
$$;

comment on function public.nw_diff_within_bounds(jsonb) is
  'Canonical structured-diff shape and bounds: typed ops, <= 200 ops, <= 200 blocks per op, <= 20000 chars per block, <= 400000 bytes serialized. Mirrors the DIFF_* values in modules/mynews/src/data/bounds.ts.';

-- ============================================ comment boundary

-- The direct client insert door closes. Service-role inserts (RLS-exempt) keep
-- working, and nw_suggestion_events_public_select is untouched: reading a
-- thread is unchanged, only writing moves behind the function.
drop policy if exists nw_suggestion_events_actor_insert on public.nw_suggestion_events;

-- Defense in depth, mirroring nw_reports_guard_client_insert. Even a future
-- misconfigured INSERT policy cannot let an authenticated or anonymous session
-- write a comment: the only comment writer is the service role, and it has
-- already resolved the profile, checked suspension and Terms, rate-limited the
-- actor, and bounded the body. Decision events (accept/reject/partial/rebase)
-- were already service-role-only through the review function; the guard now
-- states that for every action, not just comments.
create or replace function public.nw_suggestion_events_guard_client_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception
      'nw_suggestion_events: comments are created only through the mynews-comment function';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_suggestion_events_insert_guard on public.nw_suggestion_events;
create trigger nw_suggestion_events_insert_guard
  before insert on public.nw_suggestion_events
  for each row execute function public.nw_suggestion_events_guard_client_insert();

-- Comment payload shape and length. A comment event must carry a string body
-- of 1..4000 characters; other actions carry their own payloads and are not
-- constrained here.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_suggestion_events_comment_body_check'
      and conrelid = 'public.nw_suggestion_events'::regclass
  ) then
    alter table public.nw_suggestion_events
      add constraint nw_suggestion_events_comment_body_check
      check (
        action <> 'comment'
        or (
          jsonb_typeof(payload -> 'body') = 'string'
          and char_length(payload ->> 'body') between 1 and 4000
        )
      );
  end if;
end;
$$;

-- Per-actor recency lookup for the durable comment throttle (HEAD count in the
-- edge store). Partial on comments: decision events never hit this path.
create index if not exists idx_nw_suggestion_events_actor_comments
  on public.nw_suggestion_events (actor_id, created_at)
  where action = 'comment';

-- Service-role insert path for mynews-comment. SECURITY DEFINER so the definer
-- (the table owner) bypasses the client guard above. The edge function has
-- ALREADY resolved the profile from the JWT sub, rejected suspended actors,
-- required current Terms, applied the 10-per-minute throttle, bounded the body,
-- and confirmed the thread is visible to the actor. This RPC re-validates the
-- bounds and the referenced rows so a caller bug cannot persist a bad comment.
create or replace function public.nw_insert_suggestion_comment(
  p_suggestion_id uuid,
  p_actor_id uuid,
  p_body text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_suggestion_id is null or p_actor_id is null then
    return 'bad-payload';
  end if;
  if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 4000 then
    return 'bad-payload';
  end if;
  if not exists (select 1 from public.nw_edit_suggestions where id = p_suggestion_id) then
    return 'unknown-suggestion';
  end if;
  if not exists (select 1 from public.nw_profiles where id = p_actor_id) then
    return 'unknown-actor';
  end if;
  insert into public.nw_suggestion_events (suggestion_id, actor_id, action, payload)
  values (p_suggestion_id, p_actor_id, 'comment', jsonb_build_object('body', p_body));
  return 'ok';
end;
$$;

revoke all on function public.nw_insert_suggestion_comment(uuid, uuid, text) from public;
revoke all on function public.nw_insert_suggestion_comment(uuid, uuid, text) from anon, authenticated;
grant execute on function public.nw_insert_suggestion_comment(uuid, uuid, text) to service_role;

-- ============================================ suggestion bounds

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_edit_suggestions_rationale_bounds'
      and conrelid = 'public.nw_edit_suggestions'::regclass
  ) then
    alter table public.nw_edit_suggestions
      add constraint nw_edit_suggestions_rationale_bounds
      check (char_length(rationale) between 1 and 4000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_edit_suggestions_citations_bounds'
      and conrelid = 'public.nw_edit_suggestions'::regclass
  ) then
    -- The bootstrap nw_edit_suggestions_citation_floor CHECK still enforces the
    -- >= 1 floor for correction and context; this adds the ceiling and the
    -- per-URL scheme and length rules it never covered.
    alter table public.nw_edit_suggestions
      add constraint nw_edit_suggestions_citations_bounds
      check (public.nw_citations_within_bounds(citations));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_edit_suggestions_diff_bounds'
      and conrelid = 'public.nw_edit_suggestions'::regclass
  ) then
    alter table public.nw_edit_suggestions
      add constraint nw_edit_suggestions_diff_bounds
      check (public.nw_diff_within_bounds(diff_json));
  end if;
end;
$$;

-- ============================================ article revision bounds

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_article_revisions_headline_bounds'
      and conrelid = 'public.nw_article_revisions'::regclass
  ) then
    alter table public.nw_article_revisions
      add constraint nw_article_revisions_headline_bounds
      check (char_length(headline) between 1 and 300);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_article_revisions_dek_bounds'
      and conrelid = 'public.nw_article_revisions'::regclass
  ) then
    alter table public.nw_article_revisions
      add constraint nw_article_revisions_dek_bounds
      check (dek is null or char_length(dek) <= 600);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_article_revisions_body_bounds'
      and conrelid = 'public.nw_article_revisions'::regclass
  ) then
    alter table public.nw_article_revisions
      add constraint nw_article_revisions_body_bounds
      check (octet_length(body_md) between 1 and 400000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_article_revisions_changelog_bounds'
      and conrelid = 'public.nw_article_revisions'::regclass
  ) then
    alter table public.nw_article_revisions
      add constraint nw_article_revisions_changelog_bounds
      check (
        jsonb_typeof(changelog_json) = 'array'
        and jsonb_array_length(changelog_json) <= 100
      );
  end if;
end;
$$;

-- ============================================ profile and report bounds

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_profiles_display_name_bounds'
      and conrelid = 'public.nw_profiles'::regclass
  ) then
    alter table public.nw_profiles
      add constraint nw_profiles_display_name_bounds
      check (char_length(display_name) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_journalists_bio_bounds'
      and conrelid = 'public.nw_journalists'::regclass
  ) then
    alter table public.nw_journalists
      add constraint nw_journalists_bio_bounds
      check (char_length(bio) <= 2000);
  end if;

  -- mynews-report already refuses a detail over 2000 characters; the table
  -- never said so. Now it does, for every writer.
  if not exists (
    select 1 from pg_constraint
    where conname = 'nw_reports_detail_bounds'
      and conrelid = 'public.nw_reports'::regclass
  ) then
    alter table public.nw_reports
      add constraint nw_reports_detail_bounds
      check (detail is null or char_length(detail) <= 2000);
  end if;
end;
$$;

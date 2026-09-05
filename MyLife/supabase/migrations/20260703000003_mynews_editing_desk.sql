-- MyNews editing desk (plan 36, Phase 2).
-- Newsrooms (RLS membership over embargoed drafts), near-dupe endorsements,
-- editor aggregates v2 (raw stats only; level and cap math moves to the TS
-- credibility twins), reject notes, batch copyedit acceptance, publish v2
-- (newsroom drafts + draft-to-published transitions), and trust hardening
-- (journalist tier lock, article client-update guard). Append-only: the P0/P1
-- migrations (000001/000002) are never edited.
-- founder-ops: enable anonymous sign-in in Supabase Auth settings; add
-- mynews://auth-callback to the magic-link redirect allowlist; redeploy the
-- three mynews edge functions (mynews-publish, mynews-suggest, mynews-review)
-- after db push.

-- ============================================================ newsrooms

create table if not exists public.nw_newsrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nw_profiles (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.nw_newsrooms enable row level security;

create table if not exists public.nw_newsroom_members (
  newsroom_id uuid not null references public.nw_newsrooms (id) on delete cascade,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'coauthor', 'reviewer')),
  invited_by uuid references public.nw_profiles (id),
  created_at timestamptz not null default now(),
  primary key (newsroom_id, profile_id)
);
alter table public.nw_newsroom_members enable row level security;

create table if not exists public.nw_suggestion_dupes (
  id uuid primary key default gen_random_uuid(),
  original_id uuid not null references public.nw_edit_suggestions (id) on delete cascade,
  endorser_id uuid not null references public.nw_profiles (id) on delete cascade,
  similarity real not null check (similarity >= 0 and similarity <= 1),
  created_at timestamptz not null default now(),
  unique (original_id, endorser_id)
);
alter table public.nw_suggestion_dupes enable row level security;

-- Membership check as a security definer helper so the self-referencing
-- member policies below never recurse (the standard Supabase pattern for
-- membership tables). It leaks only a boolean that membership SELECT already
-- reveals, so clients may execute it; RLS-called functions must be executable
-- by the querying role.
create or replace function public.nw_is_newsroom_member(p_newsroom uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.nw_newsroom_members m
    join public.nw_profiles p on p.id = m.profile_id
    where m.newsroom_id = p_newsroom and p.user_id = p_user
  );
$$;
revoke execute on function public.nw_is_newsroom_member(uuid, uuid) from public;
grant execute on function public.nw_is_newsroom_member(uuid, uuid) to anon, authenticated, service_role;

create policy nw_newsrooms_member_select on public.nw_newsrooms
  for select using (
    public.nw_is_newsroom_member(id, auth.uid())
    or auth.uid() = (select user_id from public.nw_profiles where id = owner_id)
  );
create policy nw_newsrooms_owner_insert on public.nw_newsrooms
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = owner_id)
  );
create policy nw_newsrooms_owner_update on public.nw_newsrooms
  for update using (
    auth.uid() = (select user_id from public.nw_profiles where id = owner_id)
  );
create policy nw_newsrooms_owner_delete on public.nw_newsrooms
  for delete using (
    auth.uid() = (select user_id from public.nw_profiles where id = owner_id)
  );

create policy nw_newsroom_members_member_select on public.nw_newsroom_members
  for select using (
    public.nw_is_newsroom_member(newsroom_id, auth.uid())
    or auth.uid() = (
      select p.user_id from public.nw_newsrooms r
      join public.nw_profiles p on p.id = r.owner_id
      where r.id = newsroom_id
    )
  );
-- Only the room owner adds members; the create-room flow's second insert (the
-- owner's own role='owner' row) rides this same path.
create policy nw_newsroom_members_owner_insert on public.nw_newsroom_members
  for insert with check (
    auth.uid() = (
      select p.user_id from public.nw_newsrooms r
      join public.nw_profiles p on p.id = r.owner_id
      where r.id = newsroom_id
    )
  );
create policy nw_newsroom_members_owner_delete on public.nw_newsroom_members
  for delete using (
    auth.uid() = (
      select p.user_id from public.nw_newsrooms r
      join public.nw_profiles p on p.id = r.owner_id
      where r.id = newsroom_id
    )
  );
create policy nw_newsroom_members_self_delete on public.nw_newsroom_members
  for delete using (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  );

create policy nw_suggestion_dupes_public_select on public.nw_suggestion_dupes
  for select using (true);
-- Endorsements are recorded by mynews-suggest under the service role after
-- near-dupe verification; no client write policies.

-- ============================================================ draft visibility
-- Newsroom members see embargoed drafts (and their revisions, suggestions,
-- and suggestion events) additively alongside the P0 owner policies.

create policy nw_articles_newsroom_member_select on public.nw_articles
  for select using (
    status = 'draft'
    and newsroom_id is not null
    and public.nw_is_newsroom_member(newsroom_id, auth.uid())
  );

create policy nw_article_revisions_newsroom_member_select on public.nw_article_revisions
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id
        and a.status = 'draft'
        and a.newsroom_id is not null
        and public.nw_is_newsroom_member(a.newsroom_id, auth.uid())
    )
  );

create policy nw_edit_suggestions_newsroom_member_select on public.nw_edit_suggestions
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id
        and a.status = 'draft'
        and a.newsroom_id is not null
        and public.nw_is_newsroom_member(a.newsroom_id, auth.uid())
    )
  );

create policy nw_suggestion_events_newsroom_member_select on public.nw_suggestion_events
  for select using (
    exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = suggestion_id
        and a.status = 'draft'
        and a.newsroom_id is not null
        and public.nw_is_newsroom_member(a.newsroom_id, auth.uid())
    )
  );

-- Suggestion insert tightening: ownership as before, plus the target article
-- must be visible to the editor (non-draft, or a newsroom the editor belongs
-- to, or the editor's own draft).
drop policy if exists nw_edit_suggestions_editor_insert on public.nw_edit_suggestions;
create policy nw_edit_suggestions_editor_insert on public.nw_edit_suggestions
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = editor_id)
    and exists (
      select 1 from public.nw_articles a
      where a.id = article_id
        and (
          a.status <> 'draft'
          or (a.newsroom_id is not null and public.nw_is_newsroom_member(a.newsroom_id, auth.uid()))
          or auth.uid() = (select user_id from public.nw_profiles where id = a.author_id)
        )
    )
  );

-- ============================================================ trust hardening

-- Clients can never self-assign tier='verified'; the Phase 3 verification
-- center sets it under the service role.
drop policy if exists nw_journalists_self_insert on public.nw_journalists;
create policy nw_journalists_self_insert on public.nw_journalists
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
    and tier = 'open'
  );
drop policy if exists nw_journalists_self_update on public.nw_journalists;
create policy nw_journalists_self_update on public.nw_journalists
  for update using (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  ) with check (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
    and tier = 'open'
  );

-- Client sessions never bump the revision head or flip an article to
-- published; both happen only inside the security definer RPCs below (which
-- run as the function owner) or under the service role. Client retract
-- (published -> retracted) stays allowed.
create or replace function public.nw_articles_guard_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.current_rev is distinct from old.current_rev then
      raise exception 'nw_articles: current_rev changes only through the mynews RPCs';
    end if;
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'nw_articles: publishing only through the mynews RPCs';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nw_articles_client_guard on public.nw_articles;
create trigger nw_articles_client_guard
  before update on public.nw_articles
  for each row execute function public.nw_articles_guard_client_update();

-- ============================================================ editor stats

-- v2: raw stats only. The P1 levelCap key is gone: level and cap math lives
-- in the TypeScript credibility twins (modules/mynews/src/engines/credibility.ts
-- and supabase/functions/_shared/mynews-cred.ts), so both sides compute levels
-- from one formula.
create or replace function public.nw_editor_aggregates(p_editor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open integer;
  v_decided integer;
  v_accepted integer;
  v_accepted_copyedits integer;
  v_distinct integer;
  v_endorsements integer;
  v_max_pair_share numeric;
begin
  select count(*) into v_open
    from public.nw_edit_suggestions where editor_id = p_editor and status = 'open';
  select count(*) into v_decided
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial', 'rejected');
  select count(*) into v_accepted
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial');
  select count(*) into v_accepted_copyedits
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial') and type = 'copyedit';
  select count(distinct a.author_id) into v_distinct
    from public.nw_edit_suggestions s
    join public.nw_articles a on a.id = s.article_id
    where s.editor_id = p_editor and s.status in ('accepted', 'partial');
  select count(*) into v_endorsements
    from public.nw_suggestion_dupes d
    join public.nw_edit_suggestions s on s.id = d.original_id
    where s.editor_id = p_editor;
  -- Pair concentration: the largest single-author share of this editor's
  -- merged suggestions, 0 when nothing has merged yet.
  select coalesce(max(per_author.merged)::numeric / nullif(sum(per_author.merged), 0), 0)
    into v_max_pair_share
    from (
      select a.author_id, count(*) as merged
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.editor_id = p_editor and s.status in ('accepted', 'partial')
      group by a.author_id
    ) per_author;

  return jsonb_build_object(
    'openCount', v_open,
    'decidedSampleSize', v_decided,
    'acceptanceRate', case when v_decided = 0 then 1 else v_accepted::numeric / v_decided end,
    'acceptedTotal', v_accepted,
    'acceptedCopyedits', v_accepted_copyedits,
    'distinctAuthors', v_distinct,
    'endorsementsReceived', v_endorsements,
    'maxPairShare', v_max_pair_share,
    -- Sanctions land with the Phase 5 moderation pipeline; 0 until then.
    'sanctionsInLast90d', 0,
    -- Baseline standing. The review function overrides per award from the
    -- article author's journalist tier (0.75 when 'verified') per C7.
    'authorStanding', 0.5
  );
end;
$$;

-- ============================================================ review

-- v2 adds an optional reject note. The signature changes, so the P1 two-arg
-- function is dropped first: create or replace with a defaulted third arg
-- would leave an ambiguous two-arg overload behind.
drop function if exists public.nw_reject_suggestion(uuid, uuid);
create or replace function public.nw_reject_suggestion(
  p_suggestion_id uuid,
  p_actor uuid,
  p_note text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
    from public.nw_edit_suggestions where id = p_suggestion_id for update;
  if v_status is null or v_status <> 'open' then
    return 'not-open';
  end if;

  update public.nw_edit_suggestions set status = 'rejected' where id = p_suggestion_id;
  insert into public.nw_suggestion_events (suggestion_id, actor_id, action, payload)
  values (
    p_suggestion_id,
    p_actor,
    'reject',
    case when p_note is not null then jsonb_build_object('note', p_note) else '{}'::jsonb end
  );

  return 'ok';
end;
$$;

-- Batch copyedit acceptance: one revision, N status flips, N accept events,
-- N ledger rows, all-or-nothing. p_awards is a jsonb object keyed by
-- suggestion id mapping to {basePoints, diversityMult, standingMult,
-- editorProfileId}. Returns 'ok' | 'rev-conflict' | 'not-open' |
-- 'mixed-articles' | 'bad-award' ('bad-award' when any suggestion id lacks a
-- complete award entry). Every check runs before the first write: a plain
-- return does not roll back, so validation must finish before mutation.
create function public.nw_accept_suggestions_batch(
  p_suggestion_ids uuid[],
  p_actor uuid,
  p_revision jsonb,
  p_awards jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_article_ids uuid[];
  v_not_open integer;
  v_article_id uuid;
  v_current integer;
  v_rev integer := (p_revision->>'rev')::integer;
  v_id uuid;
  v_award jsonb;
begin
  if p_suggestion_ids is null or cardinality(p_suggestion_ids) = 0 then
    return 'not-open';
  end if;

  -- Lock every suggestion ordered by id so concurrent batches cannot
  -- deadlock, then the article (same suggestion-then-article order as the
  -- single-accept RPC).
  select array_agg(locked.id),
         array_agg(distinct locked.article_id),
         count(*) filter (where locked.status <> 'open')
    into v_ids, v_article_ids, v_not_open
    from (
      select id, article_id, status
      from public.nw_edit_suggestions
      where id = any (p_suggestion_ids)
      order by id
      for update
    ) locked;

  if v_ids is null
     or cardinality(v_ids) <> cardinality(p_suggestion_ids)
     or v_not_open > 0 then
    return 'not-open';
  end if;
  if cardinality(v_article_ids) > 1 then
    return 'mixed-articles';
  end if;
  v_article_id := v_article_ids[1];

  select current_rev into v_current from public.nw_articles where id = v_article_id for update;
  if v_rev <> v_current + 1 then
    return 'rev-conflict';
  end if;

  foreach v_id in array v_ids loop
    v_award := p_awards->(v_id::text);
    if v_award is null
       or v_award->>'editorProfileId' is null
       or v_award->>'basePoints' is null
       or v_award->>'diversityMult' is null
       or v_award->>'standingMult' is null then
      return 'bad-award';
    end if;
  end loop;

  update public.nw_articles set current_rev = v_rev where id = v_article_id;

  insert into public.nw_article_revisions
    (article_id, rev, headline, dek, body_md, signature, signer_pubkey, changelog_json, created_at)
  values (
    v_article_id,
    v_rev,
    p_revision->>'headline',
    nullif(p_revision->>'dek', ''),
    p_revision->>'bodyMd',
    p_revision->>'signature',
    p_revision->>'signerPubkey',
    coalesce((p_revision->>'changelogJson')::jsonb, '[]'::jsonb),
    (p_revision->>'createdAt')::timestamptz
  );

  foreach v_id in array v_ids loop
    v_award := p_awards->(v_id::text);

    update public.nw_edit_suggestions set status = 'accepted' where id = v_id;

    insert into public.nw_suggestion_events (suggestion_id, actor_id, action, payload)
    values (v_id, p_actor, 'accept', jsonb_build_object('rev', v_rev));

    insert into public.nw_credibility_ledger
      (editor_id, suggestion_id, base_points, diversity_mult, standing_mult)
    values (
      (v_award->>'editorProfileId')::uuid,
      v_id,
      (v_award->>'basePoints')::numeric,
      (v_award->>'diversityMult')::numeric,
      (v_award->>'standingMult')::numeric
    );
  end loop;

  return 'ok';
end;
$$;

-- ============================================================ publish

-- v2 honors p_article draft/newsroomId per C4: draft inserts land with status
-- 'draft' and null published_at (newsroomId required, else 'bad-payload');
-- publishing an existing draft flips status and stamps p_published_at
-- atomically with the rev bump; the P1 published paths are unchanged.
-- Author and newsroom-membership checks stay in the edge function; this RPC
-- enforces structural atomicity only. Returns 'ok' | 'rev-conflict' |
-- 'slug-conflict' | 'bad-payload'.
create or replace function public.nw_publish_article(
  p_article jsonb,
  p_revision jsonb,
  p_published_at timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid := (p_article->>'id')::uuid;
  v_rev integer := (p_revision->>'rev')::integer;
  v_draft boolean := coalesce((p_article->>'draft')::boolean, false);
  v_newsroom uuid := (nullif(p_article->>'newsroomId', ''))::uuid;
  v_current integer;
  v_status text;
begin
  select current_rev, status into v_current, v_status
    from public.nw_articles where id = v_article_id for update;

  if v_current is null then
    if v_rev <> 1 then
      return 'rev-conflict';
    end if;
    if v_draft and v_newsroom is null then
      return 'bad-payload';
    end if;
    if exists (select 1 from public.nw_articles where slug = p_article->>'slug') then
      return 'slug-conflict';
    end if;
    insert into public.nw_articles
      (id, author_id, newsroom_id, kind, status, slug, current_rev, published_at)
    values (
      v_article_id,
      (p_article->>'authorProfileId')::uuid,
      v_newsroom,
      p_article->>'kind',
      case when v_draft then 'draft' else 'published' end,
      p_article->>'slug',
      1,
      case when v_draft then null else p_published_at end
    );
  else
    if v_rev <> v_current + 1 then
      return 'rev-conflict';
    end if;
    if not v_draft and v_status = 'draft' then
      -- Publish-the-draft: status flip + published_at stamp ride the same
      -- statement as the head bump, always with a fresh signed revision.
      update public.nw_articles
        set current_rev = v_rev, status = 'published', published_at = p_published_at
        where id = v_article_id;
    else
      -- Published head bump, or a further draft revision inside a newsroom
      -- (draft=true never demotes an already published article).
      update public.nw_articles set current_rev = v_rev where id = v_article_id;
    end if;
  end if;

  insert into public.nw_article_revisions
    (article_id, rev, headline, dek, body_md, signature, signer_pubkey, changelog_json, created_at)
  values (
    v_article_id,
    v_rev,
    p_revision->>'headline',
    nullif(p_revision->>'dek', ''),
    p_revision->>'bodyMd',
    p_revision->>'signature',
    p_revision->>'signerPubkey',
    coalesce((p_revision->>'changelogJson')::jsonb, '[]'::jsonb),
    (p_revision->>'createdAt')::timestamptz
  );

  return 'ok';
end;
$$;

-- ============================================================ indexes

create index if not exists idx_nw_newsrooms_owner on public.nw_newsrooms (owner_id);
create index if not exists idx_nw_newsroom_members_profile on public.nw_newsroom_members (profile_id);
create index if not exists idx_nw_suggestion_dupes_original on public.nw_suggestion_dupes (original_id);
create index if not exists idx_nw_articles_newsroom on public.nw_articles (newsroom_id) where newsroom_id is not null;

-- ============================================================ lockdown

revoke execute on function public.nw_editor_aggregates(uuid) from public, anon, authenticated;
revoke execute on function public.nw_reject_suggestion(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.nw_accept_suggestions_batch(uuid[], uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.nw_publish_article(jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.nw_editor_aggregates(uuid) to service_role;
grant execute on function public.nw_reject_suggestion(uuid, uuid, text) to service_role;
grant execute on function public.nw_accept_suggestions_batch(uuid[], uuid, jsonb, jsonb) to service_role;
grant execute on function public.nw_publish_article(jsonb, jsonb, timestamptz) to service_role;

-- ============================================================ review hardening
-- Adversarial-review fixes. This migration is unreleased (never db-pushed), so
-- the fixes are appended here rather than in a fourth file; drops below
-- supersede policies from the bootstrap migration (000001) and definitions
-- earlier in this file. 000001/000002 stay untouched.

-- ---- draft thread visibility
-- The bootstrap public-select on suggestion events was using (true), so the
-- comment thread on an embargoed draft's suggestions leaked to everyone even
-- though the draft, its revisions, and the suggestions themselves were hidden.
-- Public reads now require the suggestion's article to be non-draft;
-- nw_suggestion_events_newsroom_member_select above covers draft-room members.
drop policy if exists nw_suggestion_events_public_select on public.nw_suggestion_events;
create policy nw_suggestion_events_public_select on public.nw_suggestion_events
  for select using (
    exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = suggestion_id and a.status <> 'draft'
    )
  );

-- Comment inserts get the same visibility gate as suggestion inserts: actor
-- ownership and action = 'comment' as before, plus the suggestion's article
-- must be visible to the actor (non-draft, or a newsroom the actor belongs to,
-- or the actor's own draft). Blind commenting on hidden threads is gone.
drop policy if exists nw_suggestion_events_actor_insert on public.nw_suggestion_events;
create policy nw_suggestion_events_actor_insert on public.nw_suggestion_events
  for insert with check (
    auth.uid() = (select user_id from public.nw_profiles where id = actor_id)
    and action = 'comment'
    and exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = suggestion_id
        and (
          a.status <> 'draft'
          or (a.newsroom_id is not null and public.nw_is_newsroom_member(a.newsroom_id, auth.uid()))
          or auth.uid() = (select user_id from public.nw_profiles where id = a.author_id)
        )
    )
  );

-- Endorsement rows on a draft's suggestions revealed who endorsed what before
-- the draft ever published. Same non-draft guard through original -> suggestion
-- -> article; draft-room members keep access through the membership arm.
drop policy if exists nw_suggestion_dupes_public_select on public.nw_suggestion_dupes;
create policy nw_suggestion_dupes_public_select on public.nw_suggestion_dupes
  for select using (
    exists (
      select 1
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = original_id
        and (
          a.status <> 'draft'
          or (a.newsroom_id is not null and public.nw_is_newsroom_member(a.newsroom_id, auth.uid()))
        )
    )
  );

-- ---- client publish bypass
-- The update-only guard left two client doors open: INSERT a row born
-- 'published' (or with a nonzero head), and UPDATE a draft to 'retracted' or a
-- retracted row back to 'draft'. The guard now covers both operations: article
-- creation and every status transition flow through the service-role RPCs;
-- the only client-side transition is published -> retracted.
create or replace function public.nw_articles_guard_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.status = 'published' or new.current_rev <> 0 then
        raise exception 'nw_articles: creation only through the mynews RPCs';
      end if;
      return new;
    end if;
    if new.current_rev is distinct from old.current_rev then
      raise exception 'nw_articles: current_rev changes only through the mynews RPCs';
    end if;
    if new.status = 'published' and old.status is distinct from 'published' then
      raise exception 'nw_articles: publishing only through the mynews RPCs';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'published' and new.status = 'retracted') then
      raise exception 'nw_articles: status changes only through the mynews RPCs; clients may only retract';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nw_articles_client_guard on public.nw_articles;
create trigger nw_articles_client_guard
  before insert or update on public.nw_articles
  for each row execute function public.nw_articles_guard_client_update();

-- Revisions are written exclusively by the security definer RPCs after
-- signature verification; the bootstrap FOR ALL owner policy let authors
-- insert unverified revisions (and rewrite or delete signed history) directly.
-- The owner keeps read access to their draft revisions, nothing more.
drop policy if exists nw_article_revisions_owner_all on public.nw_article_revisions;
create policy nw_article_revisions_owner_select on public.nw_article_revisions
  for select using (
    auth.uid() = (
      select p.user_id from public.nw_articles a
      join public.nw_profiles p on p.id = a.author_id
      where a.id = article_id
    )
  );

-- ---- newsroom embargo labels
-- Draft visibility above covered articles, revisions, suggestions, and events
-- but not nw_article_meta, so newsroom members could not see the embargo_until
-- (or DOI, license, rights route) of a draft they are working on.
create policy nw_article_meta_newsroom_member_select on public.nw_article_meta
  for select using (
    exists (
      select 1 from public.nw_articles a
      where a.id = article_id
        and a.status = 'draft'
        and a.newsroom_id is not null
        and public.nw_is_newsroom_member(a.newsroom_id, auth.uid())
    )
  );

-- ---- journalist tier lock, without freezing verified profiles
-- The with check (tier = 'open') above locked tier but also blocked verified
-- journalists from editing their own bio, beats, or region. Ownership-only
-- policy plus a trigger that pins tier for client sessions: verified profiles
-- stay editable, tier changes stay service-role.
drop policy if exists nw_journalists_self_update on public.nw_journalists;
create policy nw_journalists_self_update on public.nw_journalists
  for update using (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  ) with check (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  );

create or replace function public.nw_journalists_guard_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.tier is distinct from old.tier then
    raise exception 'nw_journalists: tier changes only through the verification service';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_journalists_client_guard on public.nw_journalists;
create trigger nw_journalists_client_guard
  before update on public.nw_journalists
  for each row execute function public.nw_journalists_guard_client_update();

-- ---- membership oracle
-- Supersedes the definition earlier in this file. That version answered for
-- any (newsroom, user) pair, so /rest/v1/rpc probing disclosed OTHER users'
-- newsroom memberships. It now returns true only when the caller asks about
-- themselves: p_user must equal auth.uid() and the membership row must exist.
-- Every policy in this file passes auth.uid() as p_user, so behavior under RLS
-- is unchanged; probing other users always returns false. Still security
-- definer so the self-referencing member policies never recurse, and still
-- client-executable because RLS evaluates it as the querying role.
create or replace function public.nw_is_newsroom_member(p_newsroom uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_user = auth.uid(), false)
    and exists (
      select 1
      from public.nw_newsroom_members m
      join public.nw_profiles p on p.id = m.profile_id
      where m.newsroom_id = p_newsroom and p.user_id = p_user
    );
$$;

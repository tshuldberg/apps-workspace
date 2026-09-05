-- MyNews plan 48 WP12 screening finding A4: a quarantined revision permanently
-- freezes an existing article.
--
-- nw_screening_quarantine_article writes a held revision at rev = current_rev+1
-- WITHOUT advancing current_rev (correct, so readers keep the last cleared
-- revision). But the next publish also targets current_rev+1: nw_publish_article
-- and nw_screening_quarantine_article both did a BLIND insert into
-- nw_article_revisions (article_id, rev), hit the primary-key collision on the
-- held slot, and raised an untyped exception that surfaced as a 500. rev+2 is
-- rejected as rev-conflict by the edge, so once an author tripped the screener
-- on an existing article, that article could never be updated again. Given the
-- screener's false-positive rate this hits legitimate authors.
--
-- WP8's own design note (migration 09) states that DIFFERENT, screened text over
-- a held draft is meant to go through nw_publish_article; the function was just
-- never taught to clear the held revision. Both write paths now delete any
-- QUARANTINED revision occupying the target slot before inserting. This only
-- ever removes held content: a cleared/published revision sits at rev <=
-- current_rev, never at current_rev+1. The edge re-screens the resubmission, so
-- a clean version publishes and a still-flagged version is held again; the
-- separate nw_screening_decisions audit row is untouched either way.

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
  v_current integer;
begin
  select current_rev into v_current from public.nw_articles where id = v_article_id for update;

  if v_current is null then
    if v_rev <> 1 then
      return 'rev-conflict';
    end if;
    if exists (select 1 from public.nw_articles where slug = p_article->>'slug') then
      return 'slug-conflict';
    end if;
    insert into public.nw_articles (id, author_id, kind, status, slug, current_rev, published_at)
    values (
      v_article_id,
      (p_article->>'authorProfileId')::uuid,
      p_article->>'kind',
      'published',
      p_article->>'slug',
      1,
      p_published_at
    );
  else
    if v_rev <> v_current + 1 then
      return 'rev-conflict';
    end if;
    -- A4: replace a held revision occupying this slot rather than colliding on
    -- the primary key. The article returns to 'cleared' now that a clean
    -- revision advances the head.
    delete from public.nw_article_revisions
      where article_id = v_article_id and rev = v_rev and screening_status = 'quarantined';
    update public.nw_articles
      set current_rev = v_rev, screening_status = 'cleared'
      where id = v_article_id;
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

revoke all on function public.nw_publish_article(jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.nw_publish_article(jsonb, jsonb, timestamptz) to service_role;

create or replace function public.nw_screening_quarantine_article(
  p_article jsonb,
  p_revision jsonb,
  p_verdict jsonb,
  p_content_sha256 text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid := (p_article->>'id')::uuid;
  v_author uuid := (p_article->>'authorProfileId')::uuid;
  v_rev integer := (p_revision->>'rev')::integer;
  v_newsroom uuid := (nullif(p_article->>'newsroomId', ''))::uuid;
  v_current integer;
  v_decision uuid;
begin
  select current_rev into v_current
    from public.nw_articles where id = v_article_id for update;

  if v_current is null then
    if v_rev <> 1 then
      return 'rev-conflict';
    end if;
    if exists (select 1 from public.nw_articles where slug = p_article->>'slug') then
      return 'slug-conflict';
    end if;
    insert into public.nw_articles
      (id, author_id, newsroom_id, kind, status, slug, current_rev, published_at, screening_status)
    values (
      v_article_id,
      v_author,
      v_newsroom,
      p_article->>'kind',
      'draft',
      p_article->>'slug',
      1,
      null,
      'quarantined'
    );
  else
    if v_rev <> v_current + 1 then
      return 'rev-conflict';
    end if;
    -- A4: replace a still-held revision at this slot instead of colliding. The
    -- author is resubmitting content that is again flagged; current_rev stays on
    -- the last cleared revision.
    delete from public.nw_article_revisions
      where article_id = v_article_id and rev = v_rev and screening_status = 'quarantined';
    update public.nw_articles
      set screening_status = 'quarantined'
      where id = v_article_id and status = 'draft';
  end if;

  insert into public.nw_article_revisions
    (article_id, rev, headline, dek, body_md, signature, signer_pubkey,
     changelog_json, created_at, screening_status)
  values (
    v_article_id,
    v_rev,
    p_revision->>'headline',
    nullif(p_revision->>'dek', ''),
    p_revision->>'bodyMd',
    p_revision->>'signature',
    p_revision->>'signerPubkey',
    coalesce((p_revision->>'changelogJson')::jsonb, '[]'::jsonb),
    (p_revision->>'createdAt')::timestamptz,
    'quarantined'
  );

  v_decision := public.nw_screening_insert_decision(
    case when v_current is null then 'article' else 'revision' end,
    v_article_id::text,
    v_rev,
    v_author,
    p_content_sha256,
    'quarantined',
    p_verdict,
    null
  );

  return 'ok:' || v_decision::text;
end;
$$;

revoke all on function public.nw_screening_quarantine_article(jsonb, jsonb, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_screening_quarantine_article(jsonb, jsonb, jsonb, text)
  to service_role;

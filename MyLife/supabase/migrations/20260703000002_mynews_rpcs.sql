-- MyNews atomic write RPCs (plan 35, Phase 1).
-- Called exclusively by the mynews-* edge functions with the service role;
-- EXECUTE is revoked from anon/authenticated so clients cannot bypass the
-- signature checks the functions perform. SECURITY DEFINER keeps the writes
-- atomic across articles, revisions, suggestions, events, and the ledger.

-- ============================================================ publish

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
    update public.nw_articles set current_rev = v_rev where id = v_article_id;
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

-- ============================================================ suggest

create or replace function public.nw_insert_suggestion(p_suggestion jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nw_articles where id = (p_suggestion->>'articleId')::uuid
  ) then
    return 'unknown-article';
  end if;

  insert into public.nw_edit_suggestions
    (id, article_id, base_rev, editor_id, type, diff_json, citations, rationale, signature, status, created_at)
  values (
    (p_suggestion->>'id')::uuid,
    (p_suggestion->>'articleId')::uuid,
    (p_suggestion->>'baseRev')::integer,
    (p_suggestion->>'editorProfileId')::uuid,
    p_suggestion->>'type',
    (p_suggestion->>'diffJson')::jsonb,
    coalesce(p_suggestion->'citations', '[]'::jsonb),
    p_suggestion->>'rationale',
    p_suggestion->>'signature',
    'open',
    (p_suggestion->>'createdAt')::timestamptz
  );

  return 'ok';
end;
$$;

-- ============================================================ editor stats

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
  v_distinct integer;
begin
  select count(*) into v_open
    from public.nw_edit_suggestions where editor_id = p_editor and status = 'open';
  select count(*) into v_decided
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial', 'rejected');
  select count(*) into v_accepted
    from public.nw_edit_suggestions
    where editor_id = p_editor and status in ('accepted', 'partial');
  select count(distinct a.author_id) into v_distinct
    from public.nw_edit_suggestions s
    join public.nw_articles a on a.id = s.article_id
    where s.editor_id = p_editor and s.status in ('accepted', 'partial');

  -- levelCap mirrors LEVEL_CAPS in the module engine; P1 serves the two
  -- lowest rungs (5/8) until the trust spine phase materializes full stats.
  return jsonb_build_object(
    'openCount', v_open,
    'acceptanceRate', case when v_decided = 0 then 1 else v_accepted::numeric / v_decided end,
    'decidedSampleSize', v_decided,
    'levelCap', case when v_accepted >= 1 then 8 else 5 end,
    'distinctAuthors', v_distinct,
    'authorStanding', 0.5
  );
end;
$$;

-- ============================================================ review

create or replace function public.nw_accept_suggestion(
  p_suggestion_id uuid,
  p_decision text,
  p_actor uuid,
  p_revision jsonb,
  p_award jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_id uuid;
  v_status text;
  v_current integer;
  v_rev integer := (p_revision->>'rev')::integer;
begin
  select article_id, status into v_article_id, v_status
    from public.nw_edit_suggestions where id = p_suggestion_id for update;
  if v_article_id is null or v_status <> 'open' then
    return 'not-open';
  end if;

  select current_rev into v_current from public.nw_articles where id = v_article_id for update;
  if v_rev <> v_current + 1 then
    return 'rev-conflict';
  end if;

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

  update public.nw_edit_suggestions
    set status = case when p_decision = 'partial' then 'partial' else 'accepted' end
    where id = p_suggestion_id;

  insert into public.nw_suggestion_events (suggestion_id, actor_id, action, payload)
  values (p_suggestion_id, p_actor, p_decision, jsonb_build_object('rev', v_rev));

  insert into public.nw_credibility_ledger
    (editor_id, suggestion_id, base_points, diversity_mult, standing_mult)
  values (
    (p_award->>'editorProfileId')::uuid,
    p_suggestion_id,
    (p_award->>'basePoints')::numeric,
    (p_award->>'diversityMult')::numeric,
    (p_award->>'standingMult')::numeric
  );

  return 'ok';
end;
$$;

create or replace function public.nw_reject_suggestion(
  p_suggestion_id uuid,
  p_actor uuid
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
  values (p_suggestion_id, p_actor, 'reject', '{}'::jsonb);

  return 'ok';
end;
$$;

-- ============================================================ lockdown

revoke execute on function public.nw_publish_article(jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.nw_insert_suggestion(jsonb) from public, anon, authenticated;
revoke execute on function public.nw_editor_aggregates(uuid) from public, anon, authenticated;
revoke execute on function public.nw_accept_suggestion(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.nw_reject_suggestion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nw_publish_article(jsonb, jsonb, timestamptz) to service_role;
grant execute on function public.nw_insert_suggestion(jsonb) to service_role;
grant execute on function public.nw_editor_aggregates(uuid) to service_role;
grant execute on function public.nw_accept_suggestion(uuid, text, uuid, jsonb, jsonb) to service_role;
grant execute on function public.nw_reject_suggestion(uuid, uuid) to service_role;

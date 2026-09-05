-- MyNews signed article metadata (production audit 2026-07-05, Track 0.5).
-- nw_article_meta (doi, orcid_authors, license, rights_route, embargo_until,
-- dataset_hashes, canonical_url) was CLIENT-WRITABLE via nw_article_meta_owner_all
-- (bootstrap 20260703000001) and covered by NO Ed25519 signature. So provenance-
-- critical claims (DOI, dataset hashes, license, canonical URL, embargo) were
-- mutable author assertions a hijacked session WITHOUT the signing key could alter
-- without breaking any signature: the offline re-verifiable corpus only covered
-- headline/dek/body/changelog. Close it exactly like revisions/suggestions/rejects:
-- meta writes are author-signed over canonicalArticleMetaBytes and verified server-
-- side by the mynews-set-meta edge function before the service role upserts.
--
-- This mirrors the nw_articles / nw_journalists / nw_edit_suggestions / nw_profiles
-- client-guard triggers that already force sensitive writes through the service-
-- role path. Append-only: 000001/000002/000003/20260705000001/20260705000002/
-- 20260705000003 stay untouched.

-- 1) Persist the signature + signer alongside the meta so it is offline re-
-- verifiable. Nullable / default '' for any legacy row written before this
-- migration; every new write through the edge path fills them.
alter table public.nw_article_meta
  add column if not exists signature text not null default '',
  add column if not exists signer_pubkey text not null default '';

-- 2) Drop the client FOR-ALL write policy. SELECT policies stay:
-- nw_article_meta_public_select (non-draft) and the owner/newsroom-member reads.
-- The owner still needs to READ their draft meta, so replace the FOR-ALL policy
-- with a SELECT-only owner policy (reads unaffected; only the client write closes).
drop policy if exists nw_article_meta_owner_all on public.nw_article_meta;

create policy nw_article_meta_owner_select on public.nw_article_meta
  for select using (
    auth.uid() = (
      select p.user_id from public.nw_articles a
      join public.nw_profiles p on p.id = a.author_id
      where a.id = article_id
    )
  );

-- 3) Client-write guard: even with no INSERT/UPDATE policy, defense in depth.
-- An authenticated/anon session can never write nw_article_meta directly; a blank
-- signature means the row did not come through the mynews-set-meta function. The
-- service role (edge) is exempt because current_user is not 'authenticated'/'anon'
-- under the service-role JWT.
create or replace function public.nw_article_meta_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'nw_article_meta: metadata is written only through the mynews-set-meta function';
  end if;
  if coalesce(new.signature, '') = '' or coalesce(new.signer_pubkey, '') = '' then
    raise exception 'nw_article_meta: a signed metadata upsert is required';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_article_meta_client_guard on public.nw_article_meta;
create trigger nw_article_meta_client_guard
  before insert or update on public.nw_article_meta
  for each row execute function public.nw_article_meta_guard_client_write();

-- 4) Atomic signed upsert under the service role. SECURITY DEFINER so the
-- mynews-set-meta function calls it via PostgREST rpc; the definer runs as the
-- table owner (service-role-equivalent), bypassing the client guard above. The
-- edge function has ALREADY verified the Ed25519 signature over the meta bytes
-- against the head author key AND confirmed the caller is the head author; this
-- RPC just persists the whole meta row (all provenance fields) plus the proof.
create or replace function public.nw_upsert_article_meta(
  p_article_id uuid,
  p_doi text,
  p_orcid_authors text[],
  p_license text,
  p_rights_route text,
  p_embargo_until timestamptz,
  p_dataset_hashes text[],
  p_canonical_url text,
  p_signature text,
  p_signer_pubkey text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_signature, '') = '' or coalesce(p_signer_pubkey, '') = '' then
    return 'bad-payload';
  end if;

  insert into public.nw_article_meta (
    article_id, doi, orcid_authors, license, rights_route,
    embargo_until, dataset_hashes, canonical_url, signature, signer_pubkey
  )
  values (
    p_article_id,
    nullif(p_doi, ''),
    coalesce(p_orcid_authors, '{}'),
    coalesce(p_license, ''),
    coalesce(p_rights_route, ''),
    p_embargo_until,
    coalesce(p_dataset_hashes, '{}'),
    nullif(p_canonical_url, ''),
    p_signature,
    p_signer_pubkey
  )
  on conflict (article_id) do update set
    doi = excluded.doi,
    orcid_authors = excluded.orcid_authors,
    license = excluded.license,
    rights_route = excluded.rights_route,
    embargo_until = excluded.embargo_until,
    dataset_hashes = excluded.dataset_hashes,
    canonical_url = excluded.canonical_url,
    signature = excluded.signature,
    signer_pubkey = excluded.signer_pubkey;

  return 'ok';
end;
$$;

revoke all on function public.nw_upsert_article_meta(
  uuid, text, text[], text, text, timestamptz, text[], text, text, text
) from public;
revoke all on function public.nw_upsert_article_meta(
  uuid, text, text[], text, text, timestamptz, text[], text, text, text
) from anon, authenticated;
-- Only the service role (via the edge function) may call the upsert.
grant execute on function public.nw_upsert_article_meta(
  uuid, text, text[], text, text, timestamptz, text[], text, text, text
) to service_role;

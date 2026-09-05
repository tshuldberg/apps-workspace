-- MyNews integrity hardening (production audit 2026-07-05 + independent reviews).
-- Two validated findings from parallel server-side + codex reviews:
--   * pubkey squatting: nw_profiles.pubkey_ed25519 had no uniqueness, so two
--     profiles could register the same key; getProfileIdByPubkey resolves
--     pubkey -> profile with limit 1 / no order, so authorship and credibility
--     could be misattributed to a squatter. Enforce one real key per profile.
--   * feed-rank manipulation: the nw_articles client-update guard blocked
--     current_rev and status changes but not published_at, so an author could
--     PATCH published_at to a far-future value and pin themselves atop the
--     public "latest" feed (ordered by published_at desc). published_at is set
--     only by nw_publish_article; clients must not move it.
-- Append-only: 000001/000002/000003/20260705000001 stay untouched.

-- One profile per real Ed25519 key. Empty defaults are excluded (readers who
-- never set a key keep '' and are not signers; the edge only looks a key up
-- from a verified signature, never '').
create unique index if not exists uq_nw_profiles_pubkey
  on public.nw_profiles (pubkey_ed25519)
  where pubkey_ed25519 <> '';

-- Extend the client-update guard to freeze published_at for client sessions.
-- The publish RPC (security definer) still sets it; clients keep retract.
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
    if new.published_at is distinct from old.published_at then
      raise exception 'nw_articles: published_at is set only through the mynews RPCs';
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

-- Trigger already bound (000003); create or replace above updates behavior.

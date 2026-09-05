-- MyNews suggestion-insert lockdown (production audit 2026-07-05, finding F1).
-- Every legitimate suggestion is written by the mynews-suggest edge function
-- under the service role, which verifies the Ed25519 signature, enforces the
-- open-suggestion cap, and collapses near-dupes. No client path inserts a
-- suggestion directly; submitSuggestion (modules/mynews/src/data/publish.ts)
-- POSTs to the function. The bootstrap/editing-desk client INSERT policy was
-- therefore pure attack surface: a direct PostgREST insert with the anon key
-- bypassed the signature check (signature column defaults to ''), the cap, and
-- the https-only citation scheme, letting a registered user seed unsigned
-- suggestions and flood any visible article's open queue. This mirrors the
-- nw_articles / nw_journalists client-guard triggers that already force writes
-- through the service-role RPCs; suggestions were the gap.
--
-- Dropping the INSERT policy leaves service-role inserts (RLS-exempt) working
-- and keeps every SELECT policy (public, newsroom-member) intact. Reads are
-- unaffected; only the unused client insert door closes.
-- Append-only migration: 000001/000002/000003 stay untouched.

drop policy if exists nw_edit_suggestions_editor_insert on public.nw_edit_suggestions;

-- Defense in depth: even a future misconfigured client policy or a service-role
-- code path cannot persist an unsigned suggestion. The edge function always
-- supplies a signature; a blank one means the row did not come through it.
create or replace function public.nw_edit_suggestions_guard_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'nw_edit_suggestions: suggestions are created only through the mynews-suggest function';
  end if;
  if coalesce(new.signature, '') = '' then
    raise exception 'nw_edit_suggestions: a signed suggestion is required';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_edit_suggestions_insert_guard on public.nw_edit_suggestions;
create trigger nw_edit_suggestions_insert_guard
  before insert on public.nw_edit_suggestions
  for each row execute function public.nw_edit_suggestions_guard_insert();

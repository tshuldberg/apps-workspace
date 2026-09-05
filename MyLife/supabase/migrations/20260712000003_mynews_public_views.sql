-- MyNews least-privilege security-barrier public views + public DTO scrub
-- (production audit 2026-07-11, finding C07).
--
-- nw_profiles_public_select and nw_journalists_public_select (bootstrap
-- migration 20260703000001) grant public row selection over the BASE tables.
-- That exposes nw_profiles.user_id (the Supabase auth identifier, a
-- correlatable tracking key), nw_profiles.suspended_until (moderation
-- signal, added by 20260705000007), nw_profiles.copyright_strikes (added by
-- 20260705000008), and nw_journalists.stripe_account_id (Stripe Connect
-- account id, a payout-hijack surface) to anyone holding the anon key. The
-- bootstrap migration's comment claims a public view already keeps
-- stripe_account_id private; no such view exists until this migration.
--
-- Fix: least-privilege public views (mirrors the bc_public_profiles_v /
-- dw_public_profiles pattern already shipped for BestChef and DoWork) plus
-- dropping the public base-table select policies in favor of self-select.
-- Append-only: 20260703000001..20260705000010 stay untouched.

-- ============================================================ public views

-- Owner-rights security-barrier views (NOT security_invoker): the base
-- public-select policies are dropped below, so an invoker-rights view would
-- evaluate base RLS as the anon caller and return zero rows. Owner rights
-- expose exactly the listed columns and nothing else. security_barrier keeps
-- caller predicates from being pushed below the view boundary.
create or replace view public.nw_public_profiles
with (security_barrier = true) as
select id, handle, display_name, pubkey_ed25519, kind, created_at
from public.nw_profiles;

grant select on public.nw_public_profiles to anon, authenticated;

create or replace view public.nw_public_journalists
with (security_barrier = true) as
select profile_id, tier, bio, beats, region, created_at
from public.nw_journalists;

grant select on public.nw_public_journalists to anon, authenticated;

-- ============================================================ self-select

-- Public row selection is gone; a caller can now only select their own full
-- row from the base table. Public reads go through the views above.
drop policy if exists nw_profiles_public_select on public.nw_profiles;
create policy nw_profiles_self_select on public.nw_profiles
  for select using (auth.uid() = user_id);

drop policy if exists nw_journalists_public_select on public.nw_journalists;
create policy nw_journalists_self_select on public.nw_journalists
  for select using (
    auth.uid() = (select user_id from public.nw_profiles where id = profile_id)
  );

-- Every other RLS policy that reads nw_profiles/nw_journalists via a
-- subquery (e.g. nw_journalists_self_insert's
-- "auth.uid() = (select user_id from public.nw_profiles where id = profile_id)",
-- and the equivalent author/editor ownership checks on nw_articles,
-- nw_edit_suggestions, nw_follows, nw_supports, nw_reports,
-- nw_terms_acceptance) evaluates that subquery as part of the policy
-- expression itself, not as a separately RLS-filtered client query. Dropping
-- the public-select policies does not change what those subqueries can see,
-- so none of them break.

-- ============================================================ stripe lockdown

-- stripe_account_id lives on nw_journalists, which today has no client-write
-- guard trigger at all: nw_journalists_self_update lets the owning
-- journalist update ANY column on their own row, including
-- stripe_account_id. That is the latent payout-hijack the audit flagged.
-- Guard it the same way 20260705000007/20260705000008 guard
-- nw_profiles.suspended_until/copyright_strikes: reject the column on
-- insert or update from client roles, leave the service role (billing edge
-- function) unaffected.
create or replace function public.nw_journalists_guard_client_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.stripe_account_id is not null then
      raise exception 'nw_journalists: stripe_account_id is set only by the billing service';
    end if;
    if tg_op = 'UPDATE' and new.stripe_account_id is distinct from old.stripe_account_id then
      raise exception 'nw_journalists: stripe_account_id is set only by the billing service';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nw_journalists_client_write_guard on public.nw_journalists;
create trigger nw_journalists_client_write_guard
  before insert or update on public.nw_journalists
  for each row execute function public.nw_journalists_guard_client_write();

-- MyNews pubkey proof-of-possession (production audit 2026-07-05, Track 0.5).
-- The partial unique index (migration 20260705000002) stops two profiles from
-- holding the same non-empty key, but the client still SET the key directly at
-- registration, so an attacker could register a victim's PUBLIC key first
-- (squatting) and, via getProfileIdByPubkey, capture the victim's future
-- authorship / accepted-suggestion credibility. Close it with proof-of-
-- possession: the only path to a non-empty pubkey_ed25519 is the
-- mynews-register-key edge function, which verifies an Ed25519 signature over
-- canonicalKeyPossessionBytes(auth_uid, pubkey) before writing under the
-- service role. Binding the auth uid makes the proof non-transferable.
--
-- This mirrors the nw_articles / nw_journalists / nw_edit_suggestions client
-- guards that already force sensitive writes through the service-role path.
-- Append-only: 000001/000002/000003/20260705000001/20260705000002 stay
-- untouched.

-- 1) Client-write guard: an authenticated/anon session may keep pubkey_ed25519
-- at '' or leave it unchanged, but can never set it to a non-empty value it did
-- not already hold. Registration inserts the profile with '' and then calls the
-- edge function to bind the real key. The service role (edge) is exempt because
-- current_user is not 'authenticated'/'anon' under the service-role JWT.
create or replace function public.nw_profiles_guard_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if coalesce(new.pubkey_ed25519, '') <> '' then
        raise exception 'nw_profiles: pubkey_ed25519 is bound only through the mynews-register-key function';
      end if;
      return new;
    end if;
    -- UPDATE: block any change to a non-empty key value. Setting '' -> key,
    -- key -> other key, or key -> '' (rotation/clearing) all route through the
    -- service role only. Leaving the key unchanged is always allowed.
    if new.pubkey_ed25519 is distinct from old.pubkey_ed25519 then
      raise exception 'nw_profiles: pubkey_ed25519 changes only through the mynews-register-key function';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nw_profiles_client_guard on public.nw_profiles;
create trigger nw_profiles_client_guard
  before insert or update on public.nw_profiles
  for each row execute function public.nw_profiles_guard_client_update();

-- 2) Atomic bind under the service role. SECURITY DEFINER so the mynews-register-key
-- function calls it via PostgREST rpc; the definer runs as the table owner
-- (service-role-equivalent), bypassing the client guard above. The function
-- re-derives the caller's profile from p_user_id, enforces set-once semantics,
-- and returns the same priority-ordered codes as the in-memory store twin:
--   no-profile      : no nw_profiles row for this auth uid
--   already-set     : this profile already holds a non-empty key (no rotation here)
--   pubkey-conflict : the key is already held by another profile
--   ok              : the key was bound
create or replace function public.nw_set_profile_pubkey(p_user_id uuid, p_pubkey text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_current text;
begin
  if coalesce(p_pubkey, '') = '' then
    return 'bad-payload';
  end if;

  select id, pubkey_ed25519 into v_profile_id, v_current
  from public.nw_profiles
  where user_id = p_user_id
  for update;

  if v_profile_id is null then
    return 'no-profile';
  end if;
  if coalesce(v_current, '') <> '' then
    return 'already-set';
  end if;
  if exists (
    select 1 from public.nw_profiles
    where pubkey_ed25519 = p_pubkey and id <> v_profile_id
  ) then
    return 'pubkey-conflict';
  end if;

  update public.nw_profiles
  set pubkey_ed25519 = p_pubkey
  where id = v_profile_id;

  return 'ok';
exception
  when unique_violation then
    -- The partial unique index is the last line of defense against a race
    -- between the existence check and the update.
    return 'pubkey-conflict';
end;
$$;

revoke all on function public.nw_set_profile_pubkey(uuid, text) from public;
revoke all on function public.nw_set_profile_pubkey(uuid, text) from anon, authenticated;
-- Only the service role (via the edge function) may call the binder.
grant execute on function public.nw_set_profile_pubkey(uuid, text) to service_role;

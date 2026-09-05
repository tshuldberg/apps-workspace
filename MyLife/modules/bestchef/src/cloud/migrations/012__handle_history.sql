-- P13-C (F-025): Handle uniqueness + cooldown history.
--
-- Enforces case-insensitive uniqueness on social_profiles.handle and
-- records released handles (handles that change to a new value) in a
-- separate history table so the app can apply a cooldown before another
-- chef can claim a recently abandoned handle.
--
-- Idempotent: every object uses IF NOT EXISTS or CREATE OR REPLACE.
--
-- F-026 also requires a 'bc-avatars' Supabase Storage bucket. Bucket
-- creation is performed via the Supabase dashboard / CLI rather than SQL
-- migration; uploadAvatar() in chef-profile.ts writes to bc-avatars and
-- expects public read access on the published key.

create unique index if not exists social_profiles_handle_unique
  on public.social_profiles (lower(handle));

create table if not exists public.bc_handle_history (
  handle text not null,
  released_at timestamptz not null default now(),
  primary key (handle, released_at)
);

-- Trigger: when handle changes on social_profiles, record the old value
-- (lowercased) into bc_handle_history with the current timestamp. The
-- released handle is then subject to a cooldown window enforced in code
-- by checkHandleAvailability().
create or replace function bc_record_handle_release()
returns trigger
language plpgsql
as $$
begin
  if old.handle is not null and old.handle is distinct from new.handle then
    insert into public.bc_handle_history (handle)
    values (lower(old.handle));
  end if;
  return new;
end;
$$;

drop trigger if exists bc_handle_history_t on public.social_profiles;
create trigger bc_handle_history_t
  before update of handle on public.social_profiles
  for each row execute function bc_record_handle_release();

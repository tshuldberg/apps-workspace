-- DoWork security hardening (production audit 2026-06-09, roadmap P7).
--
-- Fixes finding C1: the FOR ALL owner policy on dw_trainers let a row
-- owner UPDATE any column, including is_verified, so any user could mark
-- themselves a verified trainer. Owner policies are split per-operation,
-- inserts can never start verified, and a trigger guards is_verified so
-- only moderation tooling (service role or admin SQL) can change it.
--
-- Also splits the FOR ALL owner policies on dw_workout_shares and
-- dw_comments into explicit per-operation policies (audit-friendly, and
-- the comment insert path now enforces a per-user rate limit).

-- ─── dw_trainers: kill self-verification ───────────────────────────────────

drop policy if exists dw_trainers_owner_modify on public.dw_trainers;

create policy dw_trainers_owner_insert
  on public.dw_trainers
  for insert
  to authenticated
  with check (auth.uid() = user_id and is_verified = false);

create policy dw_trainers_owner_update
  on public.dw_trainers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy dw_trainers_owner_delete
  on public.dw_trainers
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Owners may read their own row even while is_active = false (the public
-- select policy only exposes active rows).
create policy dw_trainers_owner_select
  on public.dw_trainers
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Column guard: is_verified may only change via moderation tooling.
-- Service-role API calls and direct admin SQL pass; end-user JWTs do not.
create or replace function public.dw_trainers_protect_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_verified is distinct from old.is_verified then
    if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
       or current_user in ('postgres', 'supabase_admin') then
      return new;
    end if;
    raise exception 'dw_trainers.is_verified may only be changed by moderation tooling';
  end if;
  return new;
end;
$$;

drop trigger if exists dw_trainers_protect_verified on public.dw_trainers;
create trigger dw_trainers_protect_verified
  before update on public.dw_trainers
  for each row
  execute function public.dw_trainers_protect_verified();

-- ─── dw_workout_shares: explicit per-operation owner policies ─────────────

drop policy if exists dw_workout_shares_owner_all on public.dw_workout_shares;

create policy dw_workout_shares_owner_select
  on public.dw_workout_shares
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy dw_workout_shares_owner_insert
  on public.dw_workout_shares
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy dw_workout_shares_owner_update
  on public.dw_workout_shares
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy dw_workout_shares_owner_delete
  on public.dw_workout_shares
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── dw_comments: explicit owner policies + insert rate limit ─────────────

-- True when the user has posted fewer than 5 comments in the last minute.
-- SECURITY DEFINER so the count is not subject to the caller's RLS view.
create or replace function public.dw_comment_rate_limit_ok(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) < 5
  from public.dw_comments
  where user_id = p_user_id
    and created_at > now() - interval '1 minute';
$$;

revoke all on function public.dw_comment_rate_limit_ok(uuid) from public;
grant execute on function public.dw_comment_rate_limit_ok(uuid) to authenticated, service_role;

drop policy if exists dw_comments_owner_modify on public.dw_comments;

create policy dw_comments_owner_select
  on public.dw_comments
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy dw_comments_owner_insert
  on public.dw_comments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.dw_comment_rate_limit_ok(auth.uid())
  );

create policy dw_comments_owner_update
  on public.dw_comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy dw_comments_owner_delete
  on public.dw_comments
  for delete
  to authenticated
  using (auth.uid() = user_id);

alter table bc_submissions
  add column if not exists like_count integer not null default 0 check (like_count >= 0);

create table if not exists bc_submission_likes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bc_submission_likes_unique unique (submission_id, profile_id)
);

create index if not exists bc_submission_likes_submission_idx on bc_submission_likes (submission_id, created_at desc);
create index if not exists bc_submission_likes_profile_idx on bc_submission_likes (profile_id, created_at desc);

alter table bc_submission_likes enable row level security;

drop policy if exists "bc_submission_likes_read" on bc_submission_likes;
create policy "bc_submission_likes_read" on bc_submission_likes for select using (
  bc_submission_visible(submission_id) or bc_profile_owned(profile_id)
);
drop policy if exists "bc_submission_likes_insert" on bc_submission_likes;
create policy "bc_submission_likes_insert" on bc_submission_likes for insert with check (
  bc_profile_owned(profile_id)
  and bc_submission_visible(submission_id)
);
drop policy if exists "bc_submission_likes_delete" on bc_submission_likes;
create policy "bc_submission_likes_delete" on bc_submission_likes for delete using (
  bc_profile_owned(profile_id) or bc_is_admin()
);

create or replace function bc_refresh_submission_like_count()
returns trigger as $$
declare
  target_submission_id uuid;
begin
  if tg_op = 'DELETE' then
    target_submission_id := old.submission_id;
  else
    target_submission_id := new.submission_id;
  end if;

  update bc_submissions
  set like_count = (
        select count(*)::integer
        from bc_submission_likes
        where submission_id = target_submission_id
      ),
      updated_at = now()
  where id = target_submission_id;

  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists bc_submission_likes_refresh_count on bc_submission_likes;
create trigger bc_submission_likes_refresh_count after insert or delete on bc_submission_likes
  for each row execute function bc_refresh_submission_like_count();

create or replace function bc_get_submission_like_state(p_submission_id uuid)
returns table (
  submission_id uuid,
  like_count integer,
  liked boolean,
  error_code text
) as $$
declare
  v_profile_id uuid;
  v_like_count integer;
  v_liked boolean;
begin
  v_profile_id := bc_current_profile_id();

  if v_profile_id is null then
    return query select p_submission_id, 0::integer, false, 'profile_not_found'::text;
    return;
  end if;

  if not bc_submission_visible(p_submission_id) then
    return query select p_submission_id, 0::integer, false, 'submission_not_found'::text;
    return;
  end if;

  select coalesce(s.like_count, 0)::integer
  into v_like_count
  from bc_submissions s
  where s.id = p_submission_id;

  select exists (
    select 1
    from bc_submission_likes l
    where l.submission_id = p_submission_id
      and l.profile_id = v_profile_id
  ) into v_liked;

  return query select p_submission_id, coalesce(v_like_count, 0), coalesce(v_liked, false), null::text;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_set_submission_like(
  p_submission_id uuid,
  p_liked boolean
)
returns table (
  submission_id uuid,
  like_count integer,
  liked boolean,
  error_code text
) as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := bc_current_profile_id();

  if v_profile_id is null then
    return query select p_submission_id, 0::integer, false, 'profile_not_found'::text;
    return;
  end if;

  if not bc_submission_visible(p_submission_id) then
    return query select p_submission_id, 0::integer, false, 'submission_not_found'::text;
    return;
  end if;

  if p_liked then
    insert into bc_submission_likes (submission_id, profile_id)
    values (p_submission_id, v_profile_id)
    on conflict on constraint bc_submission_likes_unique do nothing;
  else
    delete from bc_submission_likes l
    where l.submission_id = p_submission_id
      and l.profile_id = v_profile_id;
  end if;

  return query select * from bc_get_submission_like_state(p_submission_id);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function bc_guard_submission_user_update()
returns trigger as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if bc_is_admin() then
    return new;
  end if;

  if new.vote_score is distinct from old.vote_score
    or new.like_count is distinct from old.like_count
    or new.rank is distinct from old.rank
    or new.photo_verified is distinct from old.photo_verified
    or new.photo_verified_at is distinct from old.photo_verified_at
    or new.verification_method is distinct from old.verification_method
    or new.moderation_status is distinct from old.moderation_status then
    raise exception 'Server-controlled submission fields cannot be changed directly';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function bc_get_submission_like_state(uuid) to authenticated, service_role;
grant execute on function bc_set_submission_like(uuid, boolean) to authenticated, service_role;

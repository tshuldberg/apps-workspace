-- BestChef vote proof-of-cook gate.
-- Public vote contribution is now gated by an approved proof photo.

create or replace function bc_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role() = 'service_role', false)
    or coalesce((auth.jwt()->>'role') in ('admin', 'moderator', 'service_role'), false)
    or coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin', 'moderator', 'service_role'), false)
    or coalesce((auth.jwt()->'app_metadata'->'roles') ?| array['admin', 'moderator', 'service_role'], false);
$$;

alter table bc_media_assets
  drop constraint if exists bc_media_assets_owner_kind_check;
alter table bc_media_assets
  add constraint bc_media_assets_owner_kind_check
  check (owner_kind in (
    'dish',
    'submission',
    'recipe_snapshot',
    'comment',
    'post',
    'product_record',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ));

alter table bc_votes
  add column if not exists status text not null default 'active';
alter table bc_votes
  drop constraint if exists bc_votes_status_check;
alter table bc_votes
  add constraint bc_votes_status_check
  check (status in ('active', 'proof_pending', 'proof_rejected', 'deleted'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bc_votes_unique_voter_submission'
      and conrelid = 'bc_votes'::regclass
  ) then
    alter table bc_votes
      add constraint bc_votes_unique_voter_submission
      unique (voter_profile_id, submission_id);
  end if;
end;
$$;

create table if not exists bc_vote_proofs (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null unique references bc_votes(id) on delete cascade,
  submission_id uuid not null references bc_submissions(id) on delete cascade,
  profile_id uuid not null references social_profiles(id) on delete cascade,
  media_asset_id uuid not null references bc_media_assets(id) on delete restrict,
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  captured_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_vote_proofs_unique_per_submission
    unique (submission_id, content_hash)
);

create index if not exists bc_vote_proofs_submission_idx
  on bc_vote_proofs (submission_id, status, captured_at desc);
create index if not exists bc_vote_proofs_profile_idx
  on bc_vote_proofs (profile_id, captured_at desc);
create index if not exists bc_vote_proofs_status_idx
  on bc_vote_proofs (status, captured_at desc);
create index if not exists bc_vote_proofs_media_asset_idx
  on bc_vote_proofs (media_asset_id);

create table if not exists bc_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'submission',
    'comment',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  )),
  target_id uuid not null,
  profile_id uuid references social_profiles(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'decided', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_moderation_queue_target_unique unique (kind, target_id)
);

create index if not exists bc_moderation_queue_status_idx
  on bc_moderation_queue (status, created_at);
create index if not exists bc_moderation_queue_profile_idx
  on bc_moderation_queue (profile_id, created_at desc);

create table if not exists bc_moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'submission',
    'comment',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  )),
  target_id uuid not null,
  profile_id uuid references social_profiles(id) on delete set null,
  actor_profile_id uuid references social_profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bc_moderation_decisions_target_idx
  on bc_moderation_decisions (kind, target_id, created_at desc);
create index if not exists bc_moderation_decisions_actor_idx
  on bc_moderation_decisions (actor_profile_id, created_at desc);

alter table bc_vote_proofs enable row level security;
alter table bc_moderation_queue enable row level security;
alter table bc_moderation_decisions enable row level security;

drop policy if exists "bc_votes_insert" on bc_votes;
create policy "bc_votes_insert" on bc_votes for insert
  with check (false);
drop policy if exists "bc_votes_update" on bc_votes;
create policy "bc_votes_update" on bc_votes for update
  using (bc_is_admin())
  with check (bc_is_admin());
drop policy if exists "bc_votes_delete" on bc_votes;
create policy "bc_votes_delete" on bc_votes for delete
  using (bc_is_admin());

drop policy if exists "bc_vote_proofs_read" on bc_vote_proofs;
create policy "bc_vote_proofs_read" on bc_vote_proofs for select using (
  status = 'approved'
  or bc_profile_owned(profile_id)
  or bc_is_admin()
);
drop policy if exists "bc_vote_proofs_insert" on bc_vote_proofs;
create policy "bc_vote_proofs_insert" on bc_vote_proofs for insert
  with check (false);
drop policy if exists "bc_vote_proofs_update" on bc_vote_proofs;
create policy "bc_vote_proofs_update" on bc_vote_proofs for update using (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
) with check (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
);
drop policy if exists "bc_vote_proofs_delete" on bc_vote_proofs;
create policy "bc_vote_proofs_delete" on bc_vote_proofs for delete using (
  bc_is_admin()
  or (bc_profile_owned(profile_id) and status = 'pending')
);

drop policy if exists "bc_moderation_queue_read" on bc_moderation_queue;
create policy "bc_moderation_queue_read" on bc_moderation_queue for select
  using (bc_is_admin());
drop policy if exists "bc_moderation_queue_write" on bc_moderation_queue;
create policy "bc_moderation_queue_write" on bc_moderation_queue for all
  using (bc_is_admin())
  with check (bc_is_admin());

drop policy if exists "bc_moderation_decisions_read" on bc_moderation_decisions;
create policy "bc_moderation_decisions_read" on bc_moderation_decisions for select
  using (bc_is_admin() or bc_profile_owned(profile_id));
drop policy if exists "bc_moderation_decisions_write" on bc_moderation_decisions;
create policy "bc_moderation_decisions_write" on bc_moderation_decisions for all
  using (bc_is_admin())
  with check (bc_is_admin());

drop trigger if exists bc_vote_proofs_set_updated_at on bc_vote_proofs;
create trigger bc_vote_proofs_set_updated_at before update on bc_vote_proofs
  for each row execute function bc_set_updated_at();
drop trigger if exists bc_moderation_queue_set_updated_at on bc_moderation_queue;
create trigger bc_moderation_queue_set_updated_at before update on bc_moderation_queue
  for each row execute function bc_set_updated_at();

create or replace function bc_weighted_wilson_score(p_submission_id uuid)
returns double precision
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n double precision;
  weighted_sum double precision;
  p_hat double precision;
  z double precision := 1.96;
  z_squared double precision := 3.8416;
  denominator double precision;
  center double precision;
  spread double precision;
begin
  select count(*)::double precision,
    coalesce(sum(case tier when 0 then 0 when 1 then 1 when 2 then 3 when 3 then 5 else 0 end), 0)::double precision
  into n, weighted_sum
  from bc_votes
  where submission_id = p_submission_id
    and status = 'active';

  if n is null or n = 0 then
    return 0;
  end if;

  p_hat := weighted_sum / (n * 5);
  denominator := 1 + z_squared / n;
  center := p_hat + z_squared / (2 * n);
  spread := z * sqrt((p_hat * (1 - p_hat) + z_squared / (4 * n)) / n);

  return greatest(0, least(1, (center - spread) / denominator));
end;
$$;

create or replace function bc_vote_tier_from_text(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'like' then 0
    when 'bronze' then 1
    when 'silver' then 2
    when 'gold' then 3
    else null
  end;
$$;

create or replace function bc_cast_vote(
  p_submission_id uuid,
  p_tier text,
  p_media_asset_id uuid
) returns table (
  vote_id uuid,
  proof_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_asset bc_media_assets%rowtype;
  v_existing_vote_id uuid;
  v_vote_id uuid;
  v_proof_id uuid;
  v_tier integer;
begin
  if v_user_id is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    return query select null::uuid, null::uuid, null::text, 'profile_not_found'::text;
    return;
  end if;

  if not exists (
    select 1
    from bc_submissions s
    where s.id = p_submission_id
      and s.moderation_status = 'approved'
  ) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text;
    return;
  end if;

  v_tier := bc_vote_tier_from_text(p_tier);
  if v_tier is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text;
    return;
  end if;

  select *
  into v_asset
  from bc_media_assets
  where id = p_media_asset_id;

  if not found
     or v_asset.owner_profile_id is distinct from v_profile_id
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind <> 'vote_proof'
     or nullif(trim(coalesce(v_asset.content_hash, '')), '') is null then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text;
    return;
  end if;

  if exists (
    select 1
    from bc_submissions s
    where s.id = p_submission_id
      and s.profile_id = v_profile_id
  ) then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text;
    return;
  end if;

  select id
  into v_existing_vote_id
  from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id
  limit 1;

  if v_existing_vote_id is not null then
    return query select v_existing_vote_id, null::uuid, null::text, 'vote_already_exists'::text;
    return;
  end if;

  insert into bc_votes (
    id,
    submission_id,
    voter_profile_id,
    tier,
    status,
    updated_at
  )
  values (
    gen_random_uuid(),
    p_submission_id,
    v_profile_id,
    v_tier,
    'proof_pending',
    now()
  )
  returning id into v_vote_id;

  begin
    insert into bc_vote_proofs (
      id,
      vote_id,
      submission_id,
      profile_id,
      media_asset_id,
      content_hash,
      status
    )
    values (
      gen_random_uuid(),
      v_vote_id,
      p_submission_id,
      v_profile_id,
      p_media_asset_id,
      v_asset.content_hash,
      'pending'
    )
    returning id into v_proof_id;
  exception
    when unique_violation then
      delete from bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text;
      return;
  end;

  insert into bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    'vote_proof',
    v_proof_id,
    v_profile_id,
    'queued',
    jsonb_build_object(
      'submission_id', p_submission_id,
      'media_asset_id', p_media_asset_id
    )
  )
  on conflict (kind, target_id) do update
    set status = 'queued',
        profile_id = excluded.profile_id,
        metadata = excluded.metadata,
        updated_at = now();

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

create or replace function bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  delete from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id;
end;
$$;

create or replace function bc_apply_vote_proof_decision(
  p_proof_id uuid,
  p_decision text,
  p_reason text default null
) returns table (
  proof_id uuid,
  vote_id uuid,
  proof_status text,
  vote_status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_proof bc_vote_proofs%rowtype;
  v_proof_status text;
  v_vote_status text;
begin
  if not bc_is_admin() then
    return query select p_proof_id, null::uuid, null::text, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_decision not in ('approved', 'rejected') then
    return query select p_proof_id, null::uuid, null::text, null::text, 'invalid_decision'::text;
    return;
  end if;

  select id
  into v_actor_profile_id
  from social_profiles
  where user_id = auth.uid()
  limit 1;

  select *
  into v_proof
  from bc_vote_proofs
  where id = p_proof_id
  for update;

  if not found then
    return query select p_proof_id, null::uuid, null::text, null::text, 'proof_not_found'::text;
    return;
  end if;

  if p_decision = 'approved' then
    v_proof_status := 'approved';
    v_vote_status := 'active';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = null,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'approved',
        visibility = 'public',
        upload_status = case
          when upload_status = 'uploaded' then 'ready'
          else upload_status
        end,
        updated_at = now()
    where id = v_proof.media_asset_id;
  else
    v_proof_status := 'rejected';
    v_vote_status := 'proof_rejected';

    update bc_vote_proofs
    set status = v_proof_status,
        rejection_reason = p_reason,
        reviewed_at = now(),
        updated_at = now()
    where id = p_proof_id;

    update bc_media_assets
    set moderation_status = 'rejected',
        visibility = 'private',
        updated_at = now()
    where id = v_proof.media_asset_id;
  end if;

  update bc_votes
  set status = v_vote_status,
      updated_at = now()
  where id = v_proof.vote_id;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata
  )
  values (
    'vote_proof',
    p_proof_id,
    v_proof.profile_id,
    v_actor_profile_id,
    p_decision,
    p_reason,
    jsonb_build_object('vote_id', v_proof.vote_id, 'submission_id', v_proof.submission_id)
  );

  update bc_moderation_queue
  set status = 'decided',
      updated_at = now()
  where kind = 'vote_proof'
    and target_id = p_proof_id;

  return query select p_proof_id, v_proof.vote_id, v_proof_status, v_vote_status, null::text;
end;
$$;

create or replace function bc_submit_vote(
  p_submission_id uuid,
  p_voter_profile_id uuid,
  p_tier integer
)
returns bc_votes as $$
begin
  raise exception 'Vote proof is required. Use bc_cast_vote with a proof media asset.';
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function bc_submit_vote(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function bc_cast_vote(uuid, text, uuid) to authenticated;
grant execute on function bc_delete_vote(uuid) to authenticated;
grant execute on function bc_apply_vote_proof_decision(uuid, text, text) to service_role;

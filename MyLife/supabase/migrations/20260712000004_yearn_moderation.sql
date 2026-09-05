-- Yearn moderation lifecycle, enforcement, and minor-safety escalation seam.
-- Idempotent and safely re-runnable after 20260712000003.

-- =========================================
-- REPORT LIFECYCLE
-- =========================================
update yearn.reports
set status = 'open'
where status is null
   or status not in ('open', 'reviewing', 'actioned', 'dismissed');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_status_check'
      and conrelid = 'yearn.reports'::regclass
  ) then
    alter table yearn.reports
      add constraint reports_status_check
      check (status in ('open', 'reviewing', 'actioned', 'dismissed'));
  end if;
end $$;

alter table yearn.reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists resolution_note text;

-- =========================================
-- PROFILE MODERATION STATE
-- =========================================
alter table yearn.profiles
  add column if not exists moderation_status text not null default 'active',
  add column if not exists suspended_until timestamptz;

-- clear_profile_field supports bio as required by the moderation action API.
-- The original Yearn profile schema predates this optional field.
alter table yearn.profiles
  add column if not exists bio text;

alter table yearn.profiles
  alter column moderation_status set default 'active';

update yearn.profiles
set moderation_status = 'active'
where moderation_status is null
   or moderation_status not in ('active', 'hidden_pending_review', 'suspended', 'banned');

alter table yearn.profiles
  alter column moderation_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_moderation_status_check'
      and conrelid = 'yearn.profiles'::regclass
  ) then
    alter table yearn.profiles
      add constraint profiles_moderation_status_check
      check (moderation_status in ('active', 'hidden_pending_review', 'suspended', 'banned'));
  end if;
end $$;

create or replace function yearn.is_moderation_restricted(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = yearn, public
as $$
  select exists (
    select 1
    from yearn.profiles p
    where p.id = p_user
      and p.moderation_status in ('suspended', 'banned')
      and (
        p.moderation_status = 'banned'
        or p.suspended_until is null
        or p.suspended_until > now()
      )
  );
$$;

revoke all on function yearn.is_moderation_restricted(uuid)
  from public, anon, authenticated;
grant execute on function yearn.is_moderation_restricted(uuid)
  to authenticated, service_role;

-- Clients may edit their own profile, so protect moderation-owned columns from
-- direct updates and prevent a moderated profile from deleting and recreating
-- its row to recover the active default. Account deletion runs as a definer.
create or replace function yearn.guard_profile_moderation_state()
returns trigger
language plpgsql
set search_path = yearn, public
as $$
begin
  if tg_op = 'UPDATE'
     and current_user not in ('service_role', 'supabase_admin', 'postgres')
     and (
       new.moderation_status is distinct from old.moderation_status
       or new.suspended_until is distinct from old.suspended_until
     ) then
    raise exception 'profiles: moderation state is service-role managed';
  end if;

  if tg_op = 'DELETE'
     and current_user not in ('service_role', 'supabase_admin', 'postgres')
     and old.moderation_status <> 'active' then
    raise exception 'profiles: moderated profiles must use the account deletion workflow';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_moderation_state_guard on yearn.profiles;
create trigger profiles_moderation_state_guard
before update or delete on yearn.profiles
for each row execute function yearn.guard_profile_moderation_state();

revoke all on function yearn.guard_profile_moderation_state()
  from public, anon, authenticated;

-- =========================================
-- ENFORCEMENT FOLDS
-- =========================================

-- 20260712000002 scoped photo reads to live deck/likes/matches surfaces but
-- predates moderation_status. Without this fold, a hidden/suspended/banned
-- profile's photos stay readable through the storage policy even though
-- discover_profiles, incoming_likes, and my_matches now all exclude it.
-- Reapply the same policy body with a moderation_status = 'active' guard.
drop policy if exists "yearn photos read visible profiles" on storage.objects;
create policy "yearn photos read visible profiles"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'yearn-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from yearn.profiles p
        cross join lateral jsonb_array_elements(p.photos) as photo
        cross join lateral (
          select (storage.foldername(storage.objects.name))[1] as v_owner
        ) as owner_scope
        where p.id::text = owner_scope.v_owner
          and p.is_paused = false
          and p.moderation_status = 'active'
          and photo->>'path' = storage.objects.name
          -- Default-deny: a photo is readable by others only when the
          -- client explicitly marked it visible with a boolean true.
          and jsonb_typeof(photo->'show_on_profile') = 'boolean'
          and (photo->>'show_on_profile')::boolean = true
          and not yearn.is_blocked(auth.uid(), p.id)
          and (
            -- Active match for this viewer. Archiving is per-user, so only
            -- the viewer's own match_archivals row revokes this surface.
            exists (
              select 1
              from yearn.matches m
              where (
                (m.user_a = auth.uid() and m.user_b = p.id)
                or (m.user_a = p.id and m.user_b = auth.uid())
              )
                and not exists (
                  select 1 from yearn.match_archivals a
                  where a.match_id = m.id and a.user_id = auth.uid()
                )
            )
            or (
              -- Actionable incoming likes disappear after the viewer passes
              -- or the pair becomes a match, matching incoming_likes().
              exists (
                select 1
                from yearn.likes incoming
                where incoming.sender_id = p.id
                  and incoming.recipient_id = auth.uid()
              )
              and not exists (
                select 1
                from yearn.passes incoming_pass
                where incoming_pass.sender_id = auth.uid()
                  and incoming_pass.recipient_id = p.id
              )
              and not exists (
                select 1
                from yearn.matches incoming_match
                where (
                  (incoming_match.user_a = auth.uid() and incoming_match.user_b = p.id)
                  or (incoming_match.user_a = p.id and incoming_match.user_b = auth.uid())
                )
              )
            )
            or (
              -- Deck candidates remain visible until the viewer swipes.
              not exists (
                select 1
                from yearn.likes deck_like
                where deck_like.sender_id = auth.uid()
                  and deck_like.recipient_id = p.id
              )
              and not exists (
                select 1
                from yearn.passes deck_pass
                where deck_pass.sender_id = auth.uid()
                  and deck_pass.recipient_id = p.id
              )
            )
          )
      )
    )
  );

-- Keep the boost-first ordering and every existing discovery exclusion. Only
-- profiles in active moderation state may enter the deck.
create or replace function yearn.discover_profiles(p_limit int default 30)
returns table (
  id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    p.id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified
  from yearn.profiles p
  where p.is_paused = false
    and p.moderation_status = 'active'
    and p.id <> auth.uid()
    and not yearn.is_blocked(auth.uid(), p.id)
    and not exists (
      select 1 from yearn.likes l
      where l.sender_id = auth.uid() and l.recipient_id = p.id
    )
    and not exists (
      select 1 from yearn.passes pa
      where pa.sender_id = auth.uid() and pa.recipient_id = p.id
    )
  order by yearn.has_active_boost(p.id) desc, p.updated_at desc
  limit greatest(coalesce(p_limit, 30), 0);
$$;

revoke execute on function yearn.discover_profiles(int) from public, anon;
grant execute on function yearn.discover_profiles(int) to authenticated;

drop policy if exists "messages insert as sender" on yearn.messages;
create policy "messages insert as sender"
on yearn.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and not yearn.is_moderation_restricted(auth.uid())
  and exists (
    select 1 from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(
        auth.uid(),
        case when m.user_a = auth.uid() then m.user_b else m.user_a end
      )
  )
);

drop policy if exists "messages_ciphertext insert as sender" on yearn.messages_ciphertext;
create policy "messages_ciphertext insert as sender"
on yearn.messages_ciphertext for insert
to authenticated
with check (
  sender_id = auth.uid()
  and not yearn.is_moderation_restricted(auth.uid())
  and exists (
    select 1
    from yearn.matches m
    where m.id = match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(m.user_a, m.user_b)
  )
);

-- Direct inserts remain granted by the canonical schema, while product writes
-- use send_like() and like_back(). Enforce the same restriction on both paths.
drop policy if exists "likes insert as sender" on yearn.likes;
create policy "likes insert as sender"
on yearn.likes for insert
to authenticated
with check (
  sender_id = auth.uid()
  and not yearn.is_moderation_restricted(auth.uid())
);

create or replace function yearn.incoming_likes()
returns table (
  like_id uuid,
  note text,
  intro_ciphertext jsonb,
  created_at timestamptz,
  sender_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  select
    l.id as like_id,
    l.note,
    l.intro_ciphertext,
    l.created_at,
    l.sender_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified
  from yearn.likes l
  join yearn.profiles p on p.id = l.sender_id
  where l.recipient_id = auth.uid()
    and p.is_paused = false
    and p.moderation_status <> 'banned'
    and not yearn.is_blocked(auth.uid(), l.sender_id)
    and not exists (
      select 1 from yearn.passes pa
      where pa.sender_id = auth.uid() and pa.recipient_id = l.sender_id
    )
    and not exists (
      select 1 from yearn.matches m
      where m.user_a = least(auth.uid(), l.sender_id)
        and m.user_b = greatest(auth.uid(), l.sender_id)
    )
  order by l.created_at desc;
$$;

revoke execute on function yearn.incoming_likes() from public, anon;
grant execute on function yearn.incoming_likes() to authenticated;

create or replace function yearn.my_matches()
returns table (
  match_id uuid,
  matched_at timestamptz,
  other_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean,
  is_pending boolean
)
language sql
stable
security definer
set search_path = yearn, public
as $$
  with ranked as (
    select
      m.id,
      m.created_at,
      row_number() over (order by m.created_at asc, m.id asc) as rn
    from yearn.matches m
    where (m.user_a = auth.uid() or m.user_b = auth.uid())
      and not yearn.is_blocked(m.user_a, m.user_b)
      and not exists (
        select 1 from yearn.match_archivals a
        where a.match_id = m.id and a.user_id = auth.uid()
      )
  )
  select
    m.id as match_id,
    m.created_at as matched_at,
    p.id as other_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified,
    (r.rn > 10) as is_pending
  from ranked r
  join yearn.matches m on m.id = r.id
  join yearn.profiles p
    on p.id = (case when m.user_a = auth.uid() then m.user_b else m.user_a end)
  where p.moderation_status <> 'banned'
  order by m.created_at desc;
$$;

revoke execute on function yearn.my_matches() from public, anon;
grant execute on function yearn.my_matches() to authenticated;

create or replace function yearn.send_like(
  p_profile_id uuid,
  p_note text default null,
  p_intro_ciphertext jsonb default null
)
returns table (
  match_id uuid,
  matched_at timestamptz,
  other_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean,
  is_pending boolean
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_match_id uuid;
  v_match_created_at timestamptz;
  v_is_pending boolean;
begin
  if v_uid is null then
    raise exception 'send_like: not authenticated';
  end if;

  if yearn.is_moderation_restricted(v_uid) then
    raise exception 'send_like: sender is restricted by moderation';
  end if;

  if p_profile_id is null or p_profile_id = v_uid then
    raise exception 'send_like: invalid recipient';
  end if;

  if v_note is not null then
    raise exception 'send_like: plaintext intros are disabled';
  end if;

  if p_intro_ciphertext is not null and jsonb_typeof(p_intro_ciphertext) <> 'object' then
    raise exception 'send_like: intro ciphertext must be a JSON object';
  end if;

  if not exists (
    select 1
    from yearn.profiles p
    where p.id = p_profile_id
      and p.is_paused = false
  ) then
    raise exception 'send_like: profile not available';
  end if;

  if yearn.is_blocked(v_uid, p_profile_id) then
    raise exception 'send_like: profile not available';
  end if;

  insert into yearn.likes (sender_id, recipient_id, note, intro_ciphertext)
  values (v_uid, p_profile_id, null, p_intro_ciphertext)
  on conflict (sender_id, recipient_id) do update
    set note = coalesce(yearn.likes.note, excluded.note),
        intro_ciphertext = coalesce(yearn.likes.intro_ciphertext, excluded.intro_ciphertext);

  select m.id, m.created_at
    into v_match_id, v_match_created_at
  from yearn.matches m
  where m.user_a = least(v_uid, p_profile_id)
    and m.user_b = greatest(v_uid, p_profile_id)
    and not yearn.is_blocked(m.user_a, m.user_b)
  limit 1;

  if v_match_id is null then
    return;
  end if;

  perform yearn.seed_intro_ciphertexts_for_match(v_match_id);

  v_is_pending := (
    select count(*)
    from yearn.matches m2
    left join yearn.match_archivals a2
      on a2.match_id = m2.id and a2.user_id = v_uid
    where (m2.user_a = v_uid or m2.user_b = v_uid)
      and a2.match_id is null
      and not yearn.is_blocked(m2.user_a, m2.user_b)
      and (
        m2.created_at < v_match_created_at
        or (m2.created_at = v_match_created_at and m2.id <= v_match_id)
      )
  ) > 10;

  return query
  select
    m.id as match_id,
    m.created_at as matched_at,
    p.id as other_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified,
    v_is_pending as is_pending
  from yearn.matches m
  join yearn.profiles p on p.id = p_profile_id
  where m.id = v_match_id
  limit 1;
end;
$$;

revoke execute on function yearn.send_like(uuid, text, jsonb) from public, anon;
grant execute on function yearn.send_like(uuid, text, jsonb) to authenticated;

create or replace function yearn.like_back(p_like_id uuid)
returns table (
  match_id uuid,
  matched_at timestamptz,
  other_id uuid,
  display_name text,
  age int,
  pronouns text,
  intention text,
  relationship_structure text,
  photos jsonb,
  prompts jsonb,
  interests jsonb,
  is_verified boolean,
  is_pending boolean
)
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_match_id uuid;
  v_match_created_at timestamptz;
  v_is_pending boolean;
begin
  if v_uid is null then
    raise exception 'like_back: not authenticated';
  end if;

  if yearn.is_moderation_restricted(v_uid) then
    raise exception 'like_back: sender is restricted by moderation';
  end if;

  select sender_id
    into v_sender
  from yearn.likes
  where id = p_like_id and recipient_id = v_uid;

  if v_sender is null or yearn.is_blocked(v_uid, v_sender) then
    raise exception 'like_back: like not found';
  end if;

  insert into yearn.likes (sender_id, recipient_id, note, intro_ciphertext)
  values (v_uid, v_sender, null, null)
  on conflict (sender_id, recipient_id) do nothing;

  select m.id, m.created_at
    into v_match_id, v_match_created_at
  from yearn.matches m
  where m.user_a = least(v_uid, v_sender)
    and m.user_b = greatest(v_uid, v_sender)
    and not yearn.is_blocked(m.user_a, m.user_b)
  limit 1;

  if v_match_id is null then
    return;
  end if;

  perform yearn.seed_intro_ciphertexts_for_match(v_match_id);

  v_is_pending := (
    select count(*)
    from yearn.matches m2
    left join yearn.match_archivals a2
      on a2.match_id = m2.id and a2.user_id = v_uid
    where (m2.user_a = v_uid or m2.user_b = v_uid)
      and a2.match_id is null
      and not yearn.is_blocked(m2.user_a, m2.user_b)
      and (
        m2.created_at < v_match_created_at
        or (m2.created_at = v_match_created_at and m2.id <= v_match_id)
      )
  ) > 10;

  return query
  select
    m.id as match_id,
    m.created_at as matched_at,
    p.id as other_id,
    p.display_name,
    extract(year from age(current_date, p.birthday))::int as age,
    p.pronouns,
    p.intention,
    p.relationship_structure,
    p.photos,
    p.prompts,
    p.interests,
    p.is_verified,
    v_is_pending as is_pending
  from yearn.matches m
  join yearn.profiles p on p.id = v_sender
  where m.id = v_match_id
  limit 1;
end;
$$;

revoke execute on function yearn.like_back(uuid) from public, anon;
grant execute on function yearn.like_back(uuid) to authenticated;

-- =========================================
-- MODERATION AUDIT LEDGER
-- =========================================
create table if not exists yearn.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references yearn.reports(id) on delete set null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null,
  action text not null check (
    action in (
      'warn',
      'hide_pending_review',
      'unhide',
      'suspend',
      'unsuspend',
      'ban',
      'remove_photo',
      'clear_profile_field'
    )
  ),
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_target_created_idx
  on yearn.moderation_actions (target_user_id, created_at desc);

alter table yearn.moderation_actions enable row level security;
-- No policies. This append-only ledger is service-role only.

revoke all on table yearn.moderation_actions from public, anon, authenticated;
grant select, insert on table yearn.moderation_actions to service_role;

create or replace function yearn.moderation_actions_immutable()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  -- Preserve the declared foreign-key behavior without permitting direct row
  -- mutation. Referential actions execute from a nested constraint trigger.
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and old.report_id is not null
     and new.report_id is null
     and new.id is not distinct from old.id
     and new.target_user_id is not distinct from old.target_user_id
     and new.actor is not distinct from old.actor
     and new.action is not distinct from old.action
     and new.reason is not distinct from old.reason
     and new.detail is not distinct from old.detail
     and new.created_at is not distinct from old.created_at then
    return new;
  end if;

  if tg_op = 'DELETE'
     and pg_trigger_depth() > 1 then
    return old;
  end if;

  raise exception 'moderation_actions: rows are append-only';
end;
$$;

drop trigger if exists moderation_actions_immutability on yearn.moderation_actions;
create trigger moderation_actions_immutability
before update or delete on yearn.moderation_actions
for each row execute function yearn.moderation_actions_immutable();

revoke all on function yearn.moderation_actions_immutable()
  from public, anon, authenticated;

-- =========================================
-- MINOR-SAFETY ESCALATION WORKFLOW SEAM
-- =========================================
-- SCOPE: this section builds the WORKFLOW SEAM only. It does not contain CSAM
-- detection, hash lists, hash-matching logic, or NCMEC transmission code.
-- Transmission requires the operator to be a registered electronic service
-- provider under 18 U.S.C. 2258A. Registration and the designated reporter
-- process are founder items. Until that work is complete, escalation rows stay
-- pending_registration and preserved evidence is never transmitted here.
-- A future, separately authored migration must deliberately enable transmission.
create table if not exists yearn.safety_escalations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references yearn.reports(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'minor_safety'
    check (kind in ('minor_safety')),
  status text not null default 'pending_registration'
    check (status in ('pending_registration', 'ready_for_transmission', 'transmitted', 'dismissed')),
  evidence jsonb,
  detected_at timestamptz not null default now(),
  transmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id)
);

create index if not exists safety_escalations_status_idx
  on yearn.safety_escalations (status, detected_at);

alter table yearn.safety_escalations enable row level security;
-- No policies. Minor-safety evidence is service-role only.

revoke all on table yearn.safety_escalations from public, anon, authenticated;
grant select, insert, update on table yearn.safety_escalations to service_role;

create or replace function yearn.safety_escalations_immutable()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'transmitted' then
      raise exception 'NCMEC transmission requires registered ESP status (founder item); transition authored separately';
    end if;

    if new.status <> 'pending_registration' or new.transmitted_at is not null then
      raise exception 'safety_escalations: new rows must start pending_registration';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'safety_escalations: evidence rows cannot be deleted';
  end if;

  -- Allow only the target_user_id nullification declared by ON DELETE SET NULL.
  -- All evidence remains intact after the account row is removed.
  if pg_trigger_depth() > 1
     and old.target_user_id is not null
     and new.target_user_id is null
     and new.id is not distinct from old.id
     and new.report_id is not distinct from old.report_id
     and new.kind is not distinct from old.kind
     and new.status is not distinct from old.status
     and new.evidence is not distinct from old.evidence
     and new.detected_at is not distinct from old.detected_at
     and new.transmitted_at is not distinct from old.transmitted_at
     and new.created_at is not distinct from old.created_at
     and new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
    return new;
  end if;

  if new.status = 'transmitted' and new.status is distinct from old.status then
    raise exception 'NCMEC transmission requires registered ESP status (founder item); transition authored separately';
  end if;

  if new.id is distinct from old.id
     or new.report_id is distinct from old.report_id
     or new.target_user_id is distinct from old.target_user_id
     or new.kind is distinct from old.kind
     or new.evidence is distinct from old.evidence
     or new.detected_at is distinct from old.detected_at
     or new.transmitted_at is distinct from old.transmitted_at
     or new.created_at is distinct from old.created_at
     or new.updated_at is distinct from old.updated_at then
    raise exception 'safety_escalations: evidence fields are immutable';
  end if;

  if new.status is not distinct from old.status then
    raise exception 'safety_escalations: status must move forward';
  end if;

  if not (
    (old.status = 'pending_registration' and new.status in ('ready_for_transmission', 'dismissed'))
    or (old.status = 'ready_for_transmission' and new.status in ('transmitted', 'dismissed'))
  ) then
    raise exception 'safety_escalations: illegal status transition % -> %', old.status, new.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists safety_escalations_immutability on yearn.safety_escalations;
create trigger safety_escalations_immutability
before insert or update or delete on yearn.safety_escalations
for each row execute function yearn.safety_escalations_immutable();

revoke all on function yearn.safety_escalations_immutable()
  from public, anon, authenticated;

comment on table yearn.safety_escalations is
  'Minor-safety workflow seam. Service-role only. Rows remain pending registration until registered ESP status; no NCMEC transmission code lives here.';

-- =========================================
-- SERVICE-ROLE MODERATION RPCS
-- =========================================
create or replace function yearn.moderate_report(
  p_report_id uuid,
  p_new_status text,
  p_reviewer text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_target_user_id uuid;
  v_old_status text;
begin
  if p_new_status is null
     or p_new_status not in ('open', 'reviewing', 'actioned', 'dismissed') then
    raise exception 'moderate_report: invalid status %', p_new_status;
  end if;

  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception 'moderate_report: reviewer is required';
  end if;

  select r.reported_id, r.status
    into v_target_user_id, v_old_status
  from yearn.reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'moderate_report: report % not found', p_report_id;
  end if;

  update yearn.reports
  set status = p_new_status,
      reviewed_at = now(),
      reviewed_by = btrim(p_reviewer),
      resolution_note = p_note
  where id = p_report_id;

  -- warn is the ledger's audit-only action. detail identifies this row as a
  -- report lifecycle event rather than a warning delivered to the target.
  insert into yearn.moderation_actions (
    report_id,
    target_user_id,
    actor,
    action,
    reason,
    detail
  ) values (
    p_report_id,
    v_target_user_id,
    btrim(p_reviewer),
    'warn',
    p_note,
    jsonb_build_object(
      'event', 'report_status_change',
      'previous_status', v_old_status,
      'new_status', p_new_status
    )
  );
end;
$$;

revoke all on function yearn.moderate_report(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function yearn.moderate_report(uuid, text, text, text)
  to service_role;

create or replace function yearn.apply_moderation_action(
  p_target_user_id uuid,
  p_action text,
  p_actor text,
  p_reason text default null,
  p_report_id uuid default null,
  p_suspend_until timestamptz default null,
  p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_current_status text;
  v_photos jsonb;
  v_report_target uuid;
  v_path text;
  v_field text;
  v_photo_found boolean;
  v_open_escalation boolean;
  v_new_photos jsonb;
  v_action_detail jsonb := p_detail;
  v_deleted_count int := 0;
begin
  if p_target_user_id is null then
    raise exception 'apply_moderation_action: target user is required';
  end if;

  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'apply_moderation_action: actor is required';
  end if;

  if p_action is null
     or p_action not in (
       'warn',
       'hide_pending_review',
       'unhide',
       'suspend',
       'unsuspend',
       'ban',
       'remove_photo',
       'clear_profile_field'
     ) then
    raise exception 'apply_moderation_action: invalid action %', p_action;
  end if;

  select p.moderation_status, p.photos
    into v_current_status, v_photos
  from yearn.profiles p
  where p.id = p_target_user_id
  for update;

  if not found then
    raise exception 'apply_moderation_action: target profile % not found', p_target_user_id;
  end if;

  if p_report_id is not null then
    select r.reported_id
      into v_report_target
    from yearn.reports r
    where r.id = p_report_id;

    if not found then
      raise exception 'apply_moderation_action: report % not found', p_report_id;
    end if;

    if v_report_target <> p_target_user_id then
      raise exception 'apply_moderation_action: report target does not match action target';
    end if;
  end if;

  case p_action
    when 'warn' then
      null;

    when 'hide_pending_review' then
      if v_current_status <> 'active' then
        raise exception 'apply_moderation_action: hide_pending_review requires active profile, found %', v_current_status;
      end if;

      update yearn.profiles
      set moderation_status = 'hidden_pending_review'
      where id = p_target_user_id;

    when 'unhide' then
      if v_current_status <> 'hidden_pending_review' then
        raise exception 'apply_moderation_action: unhide requires hidden_pending_review profile, found %', v_current_status;
      end if;

      update yearn.profiles
      set moderation_status = 'active'
      where id = p_target_user_id;

    when 'suspend' then
      if p_suspend_until is null or p_suspend_until <= now() then
        raise exception 'apply_moderation_action: suspend_until must be in the future';
      end if;

      if v_current_status not in ('active', 'hidden_pending_review') then
        raise exception 'apply_moderation_action: suspend cannot transition profile from %', v_current_status;
      end if;

      update yearn.profiles
      set moderation_status = 'suspended',
          suspended_until = p_suspend_until
      where id = p_target_user_id;

    when 'unsuspend' then
      if v_current_status <> 'suspended' then
        raise exception 'apply_moderation_action: unsuspend requires suspended profile, found %', v_current_status;
      end if;

      update yearn.profiles
      set moderation_status = 'active',
          suspended_until = null
      where id = p_target_user_id;

    when 'ban' then
      if v_current_status = 'banned' then
        raise exception 'apply_moderation_action: profile is already banned';
      end if;

      update yearn.profiles
      set moderation_status = 'banned',
          suspended_until = null
      where id = p_target_user_id;

    when 'remove_photo' then
      if p_detail is null or jsonb_typeof(p_detail) <> 'object' then
        raise exception 'apply_moderation_action: remove_photo detail must be an object with path';
      end if;

      v_path := nullif(btrim(p_detail->>'path'), '');
      if v_path is null then
        raise exception 'apply_moderation_action: remove_photo detail.path is required';
      end if;

      select exists (
        select 1
        from jsonb_array_elements(v_photos) as photo
        where photo->>'path' = v_path
      ) into v_photo_found;

      if not v_photo_found then
        raise exception 'apply_moderation_action: photo path is not present on target profile';
      end if;

      select coalesce(
        jsonb_agg(item.photo order by item.ordinality),
        '[]'::jsonb
      )
      into v_new_photos
      from jsonb_array_elements(v_photos) with ordinality as item(photo, ordinality)
      where item.photo->>'path' is distinct from v_path;

      update yearn.profiles
      set photos = v_new_photos
      where id = p_target_user_id;

      select exists (
        select 1
        from yearn.safety_escalations se
        where se.target_user_id = p_target_user_id
          and se.status in ('pending_registration', 'ready_for_transmission')
      ) into v_open_escalation;

      if v_open_escalation then
        v_action_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
          'evidence_object_preserved', true,
          'storage_object_deleted', false
        );
      elsif (storage.foldername(v_path))[1] = p_target_user_id::text then
        delete from storage.objects
        where bucket_id = 'yearn-photos'
          and name = v_path;

        get diagnostics v_deleted_count = row_count;
        v_action_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
          'evidence_object_preserved', false,
          'storage_object_deleted', v_deleted_count > 0
        );
      else
        v_action_detail := coalesce(p_detail, '{}'::jsonb) || jsonb_build_object(
          'evidence_object_preserved', false,
          'storage_object_deleted', false,
          'storage_delete_skipped', 'path_outside_target_folder'
        );
      end if;

    when 'clear_profile_field' then
      if p_detail is null or jsonb_typeof(p_detail) <> 'object' then
        raise exception 'apply_moderation_action: clear_profile_field detail must be an object with field';
      end if;

      v_field := p_detail->>'field';
      if v_field is null or v_field not in ('bio', 'prompts', 'interests') then
        raise exception 'apply_moderation_action: clear_profile_field field must be bio, prompts, or interests';
      end if;

      if v_field = 'bio' then
        update yearn.profiles
        set bio = null
        where id = p_target_user_id;
      elsif v_field = 'prompts' then
        update yearn.profiles
        set prompts = '[]'::jsonb
        where id = p_target_user_id;
      else
        update yearn.profiles
        set interests = '[]'::jsonb
        where id = p_target_user_id;
      end if;
  end case;

  insert into yearn.moderation_actions (
    report_id,
    target_user_id,
    actor,
    action,
    reason,
    detail
  ) values (
    p_report_id,
    p_target_user_id,
    btrim(p_actor),
    p_action,
    p_reason,
    v_action_detail
  );
end;
$$;

revoke all on function yearn.apply_moderation_action(uuid, text, text, text, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function yearn.apply_moderation_action(uuid, text, text, text, uuid, timestamptz, jsonb)
  to service_role;

-- =========================================
-- UNDERAGE REPORT AUTO-HIDE AND ESCALATION
-- =========================================
create or replace function yearn.handle_underage_report()
returns trigger
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_hidden boolean := false;
  v_photo_paths jsonb := '[]'::jsonb;
begin
  if new.reason <> 'underage' then
    return new;
  end if;

  update yearn.profiles
  set moderation_status = 'hidden_pending_review'
  where id = new.reported_id
    and moderation_status = 'active'
  returning true into v_hidden;

  select coalesce(
    jsonb_agg(photo.value->>'path' order by photo.ordinality)
      filter (where nullif(photo.value->>'path', '') is not null),
    '[]'::jsonb
  )
  into v_photo_paths
  from yearn.profiles p
  cross join lateral jsonb_array_elements(p.photos)
    with ordinality as photo(value, ordinality)
  where p.id = new.reported_id;

  insert into yearn.safety_escalations (
    report_id,
    target_user_id,
    kind,
    status,
    evidence,
    detected_at
  ) values (
    new.id,
    new.reported_id,
    'minor_safety',
    'pending_registration',
    jsonb_build_object(
      'reason', new.reason,
      'details', new.details,
      'reported_profile_photo_paths', v_photo_paths
    ),
    new.created_at
  )
  on conflict (report_id) do nothing;

  if v_hidden then
    insert into yearn.moderation_actions (
      report_id,
      target_user_id,
      actor,
      action,
      reason,
      detail
    ) values (
      new.id,
      new.reported_id,
      'system:auto',
      'hide_pending_review',
      'Underage report received; profile hidden pending review',
      jsonb_build_object('source', 'underage_report')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reports_underage_escalation on yearn.reports;
create trigger reports_underage_escalation
after insert on yearn.reports
for each row execute function yearn.handle_underage_report();

revoke all on function yearn.handle_underage_report()
  from public, anon, authenticated;

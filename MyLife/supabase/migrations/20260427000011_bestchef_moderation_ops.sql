-- BestChef public-launch moderation operations.
-- Adds authenticated reporting, admin/service audited decisions, and state
-- snapshots for report-to-hidden launch operations.

create or replace function bc_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from social_profiles
  where user_id = auth.uid()
  limit 1;
$$;

alter table bc_flags
  drop constraint if exists bc_flags_target_type_check;
alter table bc_flags
  add constraint bc_flags_target_type_check
  check (target_type in (
    'submission',
    'comment',
    'dish_proposal',
    'photo',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ));

alter table bc_moderation_queue
  drop constraint if exists bc_moderation_queue_kind_check;
alter table bc_moderation_queue
  add constraint bc_moderation_queue_kind_check
  check (kind in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ));

alter table bc_moderation_decisions
  add column if not exists previous_state jsonb not null default '{}'::jsonb;
alter table bc_moderation_decisions
  add column if not exists new_state jsonb not null default '{}'::jsonb;
alter table bc_moderation_decisions
  drop constraint if exists bc_moderation_decisions_kind_check;
alter table bc_moderation_decisions
  add constraint bc_moderation_decisions_kind_check
  check (kind in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ));
alter table bc_moderation_decisions
  drop constraint if exists bc_moderation_decisions_decision_check;
alter table bc_moderation_decisions
  add constraint bc_moderation_decisions_decision_check
  check (decision in (
    'approved',
    'rejected',
    'hidden',
    'removed',
    'restored',
    'dismissed'
  ));

create or replace function bc_report_content(
  p_target_kind text,
  p_target_id uuid,
  p_reason text,
  p_reporter_profile_id uuid default null
) returns table (
  flag_id uuid,
  queue_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_kind text := lower(trim(coalesce(p_target_kind, '')));
  v_queue_kind text;
  v_flag_target_type text;
  v_reporter_profile_id uuid;
  v_target_profile_id uuid;
begin
  if p_target_id is null then
    return query select null::uuid, null::uuid, 'target_required'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    return query select null::uuid, null::uuid, 'reason_required'::text;
    return;
  end if;

  v_reporter_profile_id := coalesce(p_reporter_profile_id, bc_current_profile_id());

  if v_reporter_profile_id is null or not bc_profile_owned(v_reporter_profile_id) then
    return query select null::uuid, null::uuid, 'not_authorized'::text;
    return;
  end if;

  v_queue_kind := case
    when v_target_kind = 'photo' then 'media_asset'
    else v_target_kind
  end;
  v_flag_target_type := case
    when v_target_kind = 'photo' then 'photo'
    else v_queue_kind
  end;

  if v_queue_kind not in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ) then
    return query select null::uuid, null::uuid, 'invalid_target_kind'::text;
    return;
  end if;

  if v_queue_kind = 'submission' then
    select profile_id
    into v_target_profile_id
    from bc_submissions
    where id = p_target_id;
  elsif v_queue_kind = 'comment' then
    select profile_id
    into v_target_profile_id
    from bc_comments
    where id = p_target_id;
  elsif v_queue_kind = 'profile' then
    select id
    into v_target_profile_id
    from social_profiles
    where id = p_target_id;
  elsif v_queue_kind = 'media_asset' then
    select owner_profile_id
    into v_target_profile_id
    from bc_media_assets
    where id = p_target_id;
  elsif v_queue_kind = 'product_contribution' then
    select profile_id
    into v_target_profile_id
    from bc_product_contributions
    where id = p_target_id;
  elsif v_queue_kind = 'product_evidence' then
    select owner_profile_id
    into v_target_profile_id
    from bc_product_evidence
    where id = p_target_id;
  elsif v_queue_kind = 'vote_proof' then
    select profile_id
    into v_target_profile_id
    from bc_vote_proofs
    where id = p_target_id;
  end if;

  if not found then
    return query select null::uuid, null::uuid, 'target_not_found'::text;
    return;
  end if;

  insert into bc_flags (
    target_type,
    target_id,
    flagger_id,
    reason,
    status
  )
  values (
    v_flag_target_type,
    p_target_id,
    v_reporter_profile_id,
    trim(p_reason),
    'open'
  )
  returning id into flag_id;

  insert into bc_moderation_queue (
    kind,
    target_id,
    profile_id,
    status,
    metadata
  )
  values (
    v_queue_kind,
    p_target_id,
    v_target_profile_id,
    'queued',
    jsonb_build_object(
      'first_flag_id', flag_id,
      'latest_flag_id', flag_id,
      'latest_reason', trim(p_reason),
      'latest_reporter_profile_id', v_reporter_profile_id,
      'source', 'bc_report_content'
    )
  )
  on conflict (kind, target_id) do update
    set status = case
          when bc_moderation_queue.status = 'decided' then 'queued'
          else bc_moderation_queue.status
        end,
        profile_id = coalesce(excluded.profile_id, bc_moderation_queue.profile_id),
        metadata = bc_moderation_queue.metadata || jsonb_build_object(
          'latest_flag_id', flag_id,
          'latest_reason', trim(p_reason),
          'latest_reporter_profile_id', v_reporter_profile_id,
          'source', 'bc_report_content'
        ),
        updated_at = now()
  returning id into queue_id;

  return query select flag_id, queue_id, null::text;
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
  v_previous_state jsonb := '{}'::jsonb;
  v_new_state jsonb := '{}'::jsonb;
begin
  if not bc_is_admin() then
    return query select p_proof_id, null::uuid, null::text, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_decision not in ('approved', 'rejected') then
    return query select p_proof_id, null::uuid, null::text, null::text, 'invalid_decision'::text;
    return;
  end if;

  v_actor_profile_id := bc_current_profile_id();

  select *
  into v_proof
  from bc_vote_proofs
  where id = p_proof_id
  for update;

  if not found then
    return query select p_proof_id, null::uuid, null::text, null::text, 'proof_not_found'::text;
    return;
  end if;

  select jsonb_build_object(
    'proof_status', v_proof.status,
    'vote_status', v.status,
    'media_upload_status', m.upload_status,
    'media_moderation_status', m.moderation_status,
    'media_visibility', m.visibility
  )
  into v_previous_state
  from bc_votes v
  left join bc_media_assets m on m.id = v_proof.media_asset_id
  where v.id = v_proof.vote_id;

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

  select jsonb_build_object(
    'proof_status', p.status,
    'vote_status', v.status,
    'media_upload_status', m.upload_status,
    'media_moderation_status', m.moderation_status,
    'media_visibility', m.visibility
  )
  into v_new_state
  from bc_vote_proofs p
  join bc_votes v on v.id = p.vote_id
  left join bc_media_assets m on m.id = p.media_asset_id
  where p.id = p_proof_id;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata,
    previous_state,
    new_state
  )
  values (
    'vote_proof',
    p_proof_id,
    v_proof.profile_id,
    v_actor_profile_id,
    p_decision,
    p_reason,
    jsonb_build_object('vote_id', v_proof.vote_id, 'submission_id', v_proof.submission_id),
    coalesce(v_previous_state, '{}'::jsonb),
    coalesce(v_new_state, '{}'::jsonb)
  );

  update bc_moderation_queue
  set status = 'decided',
      updated_at = now()
  where kind = 'vote_proof'
    and target_id = p_proof_id;

  return query select p_proof_id, v_proof.vote_id, v_proof_status, v_vote_status, null::text;
end;
$$;

create or replace function bc_apply_moderation_decision(
  p_kind text,
  p_target_id uuid,
  p_decision text,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  target_id uuid,
  decision_id uuid,
  previous_state jsonb,
  new_state jsonb,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
  v_content_status text;
  v_product_moderation_status text;
  v_previous_state jsonb := '{}'::jsonb;
  v_new_state jsonb := '{}'::jsonb;
  v_vote_result record;
begin
  if not bc_is_admin() then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'not_authorized'::text;
    return;
  end if;

  if p_target_id is null then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_required'::text;
    return;
  end if;

  if v_kind = 'photo' then
    v_kind := 'media_asset';
  end if;

  if v_kind not in (
    'submission',
    'comment',
    'profile',
    'media_asset',
    'product_contribution',
    'product_evidence',
    'vote_proof'
  ) then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_target_kind'::text;
    return;
  end if;

  if v_decision not in (
    'approved',
    'rejected',
    'hidden',
    'removed',
    'restored',
    'dismissed'
  ) then
    return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_decision'::text;
    return;
  end if;

  if v_kind = 'vote_proof' then
    if v_decision not in ('approved', 'rejected') then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'invalid_vote_proof_decision'::text;
      return;
    end if;

    select *
    into v_vote_result
    from bc_apply_vote_proof_decision(p_target_id, v_decision, p_reason);

    if v_vote_result.error_code is not null then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, v_vote_result.error_code::text;
      return;
    end if;

    select md.id, md.previous_state, md.new_state
    into decision_id, v_previous_state, v_new_state
    from bc_moderation_decisions md
    where md.kind = 'vote_proof'
      and md.target_id = p_target_id
    order by md.created_at desc
    limit 1;

    if p_metadata is not null and p_metadata <> '{}'::jsonb then
      update bc_moderation_decisions
      set metadata = metadata || p_metadata
      where id = decision_id;
    end if;

    return query select p_target_id, decision_id, v_previous_state, v_new_state, null::text;
    return;
  end if;

  v_actor_profile_id := bc_current_profile_id();

  if v_kind in ('submission', 'comment') then
    v_content_status := case
      when v_decision in ('approved', 'restored') then 'approved'
      when v_decision in ('hidden', 'removed') then 'hidden'
      when v_decision = 'rejected' then 'rejected'
      else null
    end;
  end if;

  if v_kind in ('product_contribution', 'product_evidence', 'media_asset') then
    v_product_moderation_status := case
      when v_decision in ('approved', 'restored') then 'approved'
      when v_decision in ('hidden', 'removed') then 'quarantined'
      when v_decision = 'rejected' then 'rejected'
      else null
    end;
  end if;

  if v_kind = 'submission' then
    select profile_id,
           jsonb_build_object('moderation_status', moderation_status)
    into v_target_profile_id, v_previous_state
    from bc_submissions
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_content_status is not null then
      update bc_submissions
      set moderation_status = v_content_status,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object('moderation_status', moderation_status, 'updated_at', updated_at)
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'comment' then
    select profile_id,
           jsonb_build_object('moderation_status', moderation_status)
    into v_target_profile_id, v_previous_state
    from bc_comments
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_content_status is not null then
      update bc_comments
      set moderation_status = v_content_status,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object('moderation_status', moderation_status, 'updated_at', updated_at)
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'media_asset' then
    select owner_profile_id,
           jsonb_build_object(
             'upload_status', upload_status,
             'moderation_status', moderation_status,
             'visibility', visibility
           )
    into v_target_profile_id, v_previous_state
    from bc_media_assets
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_media_assets
      set moderation_status = v_product_moderation_status,
          visibility = case
            when v_decision in ('approved', 'restored') then 'public'
            else 'private'
          end,
          upload_status = case
            when v_decision in ('approved', 'restored') and upload_status = 'uploaded' then 'ready'
            else upload_status
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'upload_status', upload_status,
        'moderation_status', moderation_status,
        'visibility', visibility,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'product_contribution' then
    select profile_id,
           jsonb_build_object(
             'status', status,
             'moderation_status', moderation_status
           )
    into v_target_profile_id, v_previous_state
    from bc_product_contributions
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_product_contributions
      set moderation_status = v_product_moderation_status,
          status = case
            when v_decision in ('approved', 'restored') and status = 'submitted' then 'verified'
            when v_decision in ('rejected', 'removed') and status in ('submitted', 'verified') then 'rejected'
            else status
          end,
          reviewed_by_profile_id = coalesce(v_actor_profile_id, reviewed_by_profile_id),
          moderation_notes = coalesce(p_reason, moderation_notes),
          reviewed_at = now(),
          verified_at = case
            when v_decision in ('approved', 'restored') and status = 'submitted' then now()
            else verified_at
          end,
          rejected_at = case
            when v_decision in ('rejected', 'removed') and status in ('submitted', 'verified') then now()
            else rejected_at
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'status', status,
        'moderation_status', moderation_status,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'product_evidence' then
    select owner_profile_id,
           jsonb_build_object(
             'moderation_status', moderation_status,
             'visibility', visibility
           )
    into v_target_profile_id, v_previous_state
    from bc_product_evidence
    where id = p_target_id
    for update;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    if v_product_moderation_status is not null then
      update bc_product_evidence
      set moderation_status = v_product_moderation_status,
          visibility = case
            when v_decision in ('approved', 'restored')
              and share_opt_in
              and image_consent_status in ('owned_by_user', 'permission_granted', 'public_domain', 'not_required')
              then 'public'
            when v_decision = 'dismissed' then visibility
            else 'private'
          end,
          approved_at = case
            when v_decision in ('approved', 'restored') then coalesce(approved_at, now())
            else approved_at
          end,
          updated_at = now()
      where id = p_target_id
      returning jsonb_build_object(
        'moderation_status', moderation_status,
        'visibility', visibility,
        'updated_at', updated_at
      )
      into v_new_state;
    else
      v_new_state := v_previous_state;
    end if;
  elsif v_kind = 'profile' then
    select id,
           jsonb_build_object(
             'profile_id', id,
             'handle', handle,
             'display_name', display_name
           )
    into v_target_profile_id, v_previous_state
    from social_profiles
    where id = p_target_id;

    if not found then
      return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'target_not_found'::text;
      return;
    end if;

    v_new_state := v_previous_state || jsonb_build_object('moderation_decision', v_decision);
  end if;

  insert into bc_moderation_decisions (
    kind,
    target_id,
    profile_id,
    actor_profile_id,
    decision,
    reason,
    metadata,
    previous_state,
    new_state
  )
  values (
    v_kind,
    p_target_id,
    v_target_profile_id,
    v_actor_profile_id,
    v_decision,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(v_previous_state, '{}'::jsonb),
    coalesce(v_new_state, '{}'::jsonb)
  )
  returning id into decision_id;

  update bc_moderation_queue mq
  set status = 'decided',
      updated_at = now()
  where mq.kind = v_kind
    and mq.target_id = p_target_id;

  update bc_flags f
  set status = case
        when v_decision in ('approved', 'dismissed') then 'dismissed'
        else 'actioned'
      end,
      resolution = coalesce(p_reason, v_decision),
      updated_at = now()
  where f.target_id = p_target_id
    and (
      f.target_type = v_kind
      or (v_kind = 'media_asset' and f.target_type = 'photo')
    )
    and f.status in ('open', 'noted');

  return query select p_target_id, decision_id, v_previous_state, v_new_state, null::text;
end;
$$;

comment on function bc_report_content(text, uuid, text, uuid) is
  'Authenticated BestChef reporting RPC. Production launch must pair this with edge/API rate limits for report flooding.';
comment on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) is
  'Admin/service moderation decision RPC. Hides, rejects, restores, or dismisses public content while writing audited previous/new state.';

grant execute on function bc_current_profile_id() to authenticated, service_role;
grant execute on function bc_report_content(text, uuid, text, uuid) to authenticated, service_role;
grant execute on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function bc_apply_vote_proof_decision(uuid, text, text) to authenticated, service_role;

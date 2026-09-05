-- BestChef statement of reasons on moderation decisions (audit H4, DSA Art. 17).
--
-- The Community Guidelines and Terms promise that when we remove or restrict a
-- user's content we tell them why and how to contest it. Until now nothing
-- delivered that: bc_apply_moderation_decision wrote the audited decision row
-- but never notified the affected user. This migration closes the gap through
-- the existing typed-notification path (kind + params; the client renders the
-- localized copy from the i18n catalogs, plan 33 Phase 2.1):
--
--   * a faithful, additive redefinition of bc_apply_moderation_decision that,
--     after a restrictive decision on user content, inserts a
--     'moderation_decision' notification for the content owner carrying the
--     content type, a title/reference, the decision, the reason category, and
--     whether an appeal is available;
--   * a new bc_notify_appeal_resolved fanout + a bc_resolve_appeal redefinition
--     that emits an 'appeal_resolved' notification when a moderator upholds or
--     overturns an appeal (Art. 17 statement of reasons for the appeal outcome
--     too).
--
-- Only restrictive decisions notify (reject / remove / restrict = the
-- rejected/hidden/removed/quarantined states). Approvals and restores are not
-- adverse to the user, so they stay silent to avoid notification noise; the
-- restore path is still recorded in the audit trail by the decision row.
--
-- Additive only: no column drops, no behavior removed from the prior version.
-- The redefinition below is copied from the latest definition in
-- 20260427000011_bestchef_moderation_ops.sql and extended at the tail.

-- ── Notification constraint widening ─────────────────────────────────
-- The typed notification kinds, categories, and target types are CHECK-
-- constrained (20260429000001). Add the moderation kinds/category/target so
-- the inserts below satisfy the constraints.

alter table public.bc_notifications
  drop constraint if exists bc_notifications_kind_check;
alter table public.bc_notifications
  add constraint bc_notifications_kind_check
  check (kind in (
    'upvote','reviewed_vote','rank_up','rank_milestone','follow',
    'comment','mention','badge','competition','system',
    'moderation_decision','appeal_resolved'
  ));

alter table public.bc_notifications
  drop constraint if exists bc_notifications_category_check;
alter table public.bc_notifications
  add constraint bc_notifications_category_check
  check (category in ('votes','ranks','social','system','moderation'));

alter table public.bc_notifications
  drop constraint if exists bc_notifications_target_type_check;
alter table public.bc_notifications
  add constraint bc_notifications_target_type_check
  check (
    target_type in ('submission','chef','dish','badge','challenge','comment','appeal')
    or target_type is null
  );

-- ── Reason category derivation ───────────────────────────────────────
-- Moderators store a free-text reason on each decision. For the statement of
-- reasons we surface a coarse, localizable CATEGORY (not the raw text, which
-- may be internal notes) derived from the reason and the decision. Falls back
-- to 'other' so a decision without a recognized reason still notifies.

create or replace function public.bc_moderation_reason_category(
  p_reason text,
  p_decision text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_reason, '')) ~ 'csam|child|minor|exploitat' then 'child_safety'
    when lower(coalesce(p_reason, '')) ~ 'nsfw|sexual|explicit|nudity|porn' then 'sexual_content'
    when lower(coalesce(p_reason, '')) ~ 'hate|harass|abus|threat|bully' then 'harassment'
    when lower(coalesce(p_reason, '')) ~ 'spam|advertis|scam|fraud' then 'spam'
    when lower(coalesce(p_reason, '')) ~ 'violen|gore|graphic' then 'violence'
    when lower(coalesce(p_reason, '')) ~ 'copyright|infring|dmca|stolen|impersonat' then 'intellectual_property'
    when lower(coalesce(p_reason, '')) ~ 'vote|proof|fraud|manipulat|ring|farm' then 'vote_integrity'
    when lower(coalesce(p_reason, '')) ~ 'guideline|rule|policy|off.?topic|irrelevant|quality' then 'guidelines'
    else 'other'
  end;
$$;

grant execute on function public.bc_moderation_reason_category(text, text) to authenticated, service_role;

-- ── Statement-of-reasons fanout ──────────────────────────────────────
-- Inserts a 'moderation_decision' notification for the content owner. Wrapped
-- so a notification failure never aborts the moderation decision itself.

create or replace function public.bc_notify_moderation_decision(
  p_kind text,
  p_target_id uuid,
  p_target_profile_id uuid,
  p_decision text,
  p_reason text,
  p_appeal_available boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_content_title text;
  v_target_type text;
  v_target_ref text := p_target_id::text;
begin
  if p_target_profile_id is null then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = p_target_profile_id;

  if v_user_id is null then
    return;
  end if;

  -- Best-effort human-readable reference + notification target route.
  if p_kind = 'submission' then
    v_target_type := 'submission';
    select coalesce(r.title, d.name)
      into v_content_title
      from public.bc_submissions s
      left join public.bc_recipe_snapshots r on r.id = s.recipe_snapshot_id
      left join public.bc_dishes d on d.id = s.dish_id
     where s.id = p_target_id;
  elsif p_kind = 'comment' then
    v_target_type := 'comment';
    select left(c.body, 120)
      into v_content_title
      from public.bc_comments c
     where c.id = p_target_id;
    -- Route a comment notice to the submission it lives on when known.
    select s.id::text
      into v_target_ref
      from public.bc_comments c
      join public.bc_submissions s on s.id = c.submission_id
     where c.id = p_target_id;
    if v_target_ref is not null then
      v_target_type := 'submission';
    end if;
  else
    -- media_asset, product_contribution, product_evidence, profile.
    v_target_type := 'submission';
    v_content_title := null;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'moderation_decision', 'moderation', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'content_type', p_kind,
       'content_title', v_content_title,
       'decision', p_decision,
       'reason_category', public.bc_moderation_reason_category(p_reason, p_decision),
       'appeal_available', p_appeal_available
     )),
     v_target_type, v_target_ref);
exception when others then
  null;
end;
$$;

grant execute on function public.bc_notify_moderation_decision(text, uuid, uuid, text, text, boolean)
  to authenticated, service_role;

-- ── Appeal-outcome fanout ────────────────────────────────────────────

create or replace function public.bc_notify_appeal_resolved(
  p_appeal_id uuid,
  p_outcome text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
begin
  select a.profile_id into v_profile_id
    from public.bc_appeals a
   where a.id = p_appeal_id;

  if v_profile_id is null then
    return;
  end if;

  select user_id into v_user_id
    from public.social_profiles
   where id = v_profile_id;

  if v_user_id is null then
    return;
  end if;

  insert into public.bc_notifications
    (user_id, kind, category, title, body, params, target_type, target_id)
  values
    (v_user_id, 'appeal_resolved', 'moderation', '', '',
     jsonb_strip_nulls(jsonb_build_object(
       'outcome', p_outcome,
       'reason_category', public.bc_moderation_reason_category(p_reason, p_outcome)
     )),
     'appeal', p_appeal_id::text);
exception when others then
  null;
end;
$$;

grant execute on function public.bc_notify_appeal_resolved(uuid, text, text)
  to authenticated, service_role;

-- ── bc_apply_moderation_decision: faithful copy + notification tail ──
-- Copied verbatim from 20260427000011_bestchef_moderation_ops.sql, with a
-- single additive block appended before the final RETURN: after a restrictive
-- decision on user content it calls bc_notify_moderation_decision.

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
  v_is_restrictive boolean;
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

  -- Statement of reasons (audit H4 / DSA Art. 17). Restrictive decisions on
  -- user-owned content notify the owner with the decision, reason category,
  -- and appeal availability. Approvals/restores/dismissals stay silent; the
  -- audit trail already records them via bc_moderation_decisions.
  v_is_restrictive := v_decision in ('rejected', 'hidden', 'removed');
  if v_is_restrictive then
    perform public.bc_notify_moderation_decision(
      v_kind,
      p_target_id,
      v_target_profile_id,
      v_decision,
      p_reason,
      true
    );
  end if;

  return query select p_target_id, decision_id, v_previous_state, v_new_state, null::text;
end;
$$;

comment on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) is
  'Admin/service moderation decision RPC. Hides, rejects, restores, or dismisses public content while writing audited previous/new state. Restrictive decisions notify the content owner with a statement of reasons (DSA Art. 17).';

grant execute on function bc_apply_moderation_decision(text, uuid, text, text, jsonb) to authenticated, service_role;

-- ── bc_resolve_appeal: faithful copy + appeal-outcome notification ───
-- Copied verbatim from 20260703000003_bestchef_appeals.sql, with a single
-- additive call to bc_notify_appeal_resolved before the final RETURN.

create or replace function public.bc_resolve_appeal(
  p_appeal_id uuid,
  p_outcome text,
  p_reason text
) returns table (
  appeal_id uuid,
  status text,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if not bc_is_admin() then
    return query select p_appeal_id, null::text, 'not_authorized'::text;
    return;
  end if;

  if p_outcome not in ('upheld', 'overturned') then
    return query select p_appeal_id, null::text, 'invalid_outcome'::text;
    return;
  end if;

  select id into v_actor
  from public.social_profiles
  where user_id = auth.uid()
  limit 1;

  update public.bc_appeals as a
  set status = p_outcome,
      resolution_reason = nullif(trim(coalesce(p_reason, '')), ''),
      resolved_by = v_actor,
      resolved_at = now()
  where a.id = p_appeal_id
    and a.status = 'open';

  if not found then
    return query select p_appeal_id, null::text, 'appeal_not_found'::text;
    return;
  end if;

  -- Statement of reasons for the appeal outcome (audit H4 / DSA Art. 17).
  perform public.bc_notify_appeal_resolved(p_appeal_id, p_outcome, p_reason);

  return query select p_appeal_id, p_outcome, null::text;
end;
$$;

revoke all on function public.bc_resolve_appeal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bc_resolve_appeal(uuid, text, text) to service_role;

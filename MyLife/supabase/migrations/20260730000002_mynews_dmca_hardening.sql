-- MyNews Plan 48 Wave 2: DMCA hardening (WP2 gap closure).
--
-- 1. nw_resolve_public_url vocabulary now matches the routes mynews-web
--    actually serves: /a/[slug], /a/[slug]/suggestions, /j/[handle],
--    /e/[handle], plus the legacy /article, /journalist, /profile forms and
--    the /suggestion/<uuid> app deep link. The /a/[slug]/suggestions list
--    page resolves to its ARTICLE target: a takedown or restoration on that
--    URL acts on the article, and a specific suggestion inside the list is
--    resolved by the operator via resolve_url or link actions.
-- 2. nw_consume_dmca_rate_limit becomes a real token bucket (capacity 5,
--    refill 1 token per 120 seconds) with opportunistic GC of counters idle
--    for 30 days. Same signature and outcomes, so callers are unchanged.
-- 3. nw_dmca_apply_action: restore_content learns profile targets (lifts
--    suspension), link_strike accepts every enforcement action kind
--    (suspend_profile, hide_article, hide_suggestion), and forwarding events
--    record delivery='manual-attested' because no automated mail exists yet
--    (mail infrastructure is founder-ops; the console shows this honestly).

-- ============================================================ resolver v2

create or replace function public.nw_resolve_public_url(p_url text)
returns table (target_kind text, target_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text;
  v_path text;
  v_match text[];
  v_token text;
  v_uuid uuid;
  v_id uuid;
begin
  v_url := trim(coalesce(p_url, ''));
  if length(v_url) = 0 or length(v_url) > 2000
     or v_url !~* '^https://[^[:space:]]+$' then
    return;
  end if;

  v_url := split_part(split_part(v_url, '#', 1), '?', 1);
  v_path := regexp_replace(v_url, '^https://[^/]+', '', 'i');
  if v_path = '' then
    v_path := '/';
  end if;

  -- Article: /a/<slug|uuid>, /article/<slug|uuid>, and the article's
  -- suggestions list page /a/<slug|uuid>/suggestions.
  v_match := regexp_match(v_path, '^/(article|a)/([a-z0-9-]{3,120})(/suggestions)?/?$', 'i');
  if v_match is not null then
    v_token := lower(v_match[2]);
    begin
      v_uuid := v_token::uuid;
    exception when others then
      v_uuid := null;
    end;
    select a.id into v_id
    from public.nw_articles a
    where a.status <> 'draft'
      and ((v_uuid is not null and a.id = v_uuid) or lower(a.slug) = v_token)
    order by case when v_uuid is not null and a.id = v_uuid then 0 else 1 end
    limit 1;
    if v_id is not null then
      target_kind := 'article';
      target_id := v_id::text;
      return next;
    end if;
    return;
  end if;

  -- Profile: /j/<handle> (journalists), /e/<handle> (editors), plus the
  -- legacy /journalist and /profile forms. All resolve against nw_profiles.
  v_match := regexp_match(v_path, '^/(journalist|profile|j|e)/([a-z0-9_]{3,30})/?$', 'i');
  if v_match is not null then
    v_token := lower(v_match[2]);
    select p.id into v_id
    from public.nw_profiles p
    where lower(p.handle) = v_token
    limit 1;
    if v_id is not null then
      target_kind := 'profile';
      target_id := v_id::text;
      return next;
    end if;
    return;
  end if;

  -- Suggestion deep link (app): /suggestion/<uuid>.
  v_match := regexp_match(v_path, '^/suggestion/([a-f0-9-]{36})/?$', 'i');
  if v_match is not null then
    begin
      v_uuid := v_match[1]::uuid;
    exception when others then
      v_uuid := null;
    end;
    if v_uuid is not null then
      select s.id into v_id
      from public.nw_edit_suggestions s
      join public.nw_articles a on a.id = s.article_id
      where s.id = v_uuid and a.status <> 'draft'
      limit 1;
    end if;
    if v_id is not null then
      target_kind := 'suggestion';
      target_id := v_id::text;
      return next;
    end if;
  end if;
end;
$$;

revoke all on function public.nw_resolve_public_url(text) from public, anon, authenticated;
grant execute on function public.nw_resolve_public_url(text) to service_role;

-- ============================================================ token bucket

alter table public.nw_dmca_rate_counters
  add column if not exists tokens double precision not null default 5,
  add column if not exists last_refill_at timestamptz not null default now();

create index if not exists idx_nw_dmca_rate_updated
  on public.nw_dmca_rate_counters (updated_at);

create or replace function public.nw_consume_dmca_rate_limit(
  p_rate_key text,
  p_ip_hash text,
  p_email_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_tokens double precision;
  v_last_refill timestamptz;
  c_capacity constant double precision := 5;
  c_refill_seconds constant double precision := 120;
begin
  if p_rate_key !~ '^[a-f0-9]{64}$'
     or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_email_hash !~ '^[a-f0-9]{64}$' then
    return 'bad-key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nw-dmca-rate:' || p_rate_key, 0));

  -- Opportunistic GC: counters idle for 30 days carry no rate signal worth
  -- keeping (the bucket would be full again). Bounded so submissions stay fast.
  delete from public.nw_dmca_rate_counters
  where ctid in (
    select ctid from public.nw_dmca_rate_counters
    where updated_at < v_now - interval '30 days'
    limit 50
  );

  select tokens, last_refill_at
    into v_tokens, v_last_refill
  from public.nw_dmca_rate_counters
  where rate_key = p_rate_key
  for update;

  if v_tokens is null then
    insert into public.nw_dmca_rate_counters
      (rate_key, ip_hash, email_hash, window_started_at, request_count,
       tokens, last_refill_at, updated_at)
    values
      (p_rate_key, p_ip_hash, p_email_hash, v_now, 1,
       c_capacity - 1, v_now, v_now);
    return 'allowed';
  end if;

  v_tokens := least(
    c_capacity,
    v_tokens + greatest(0, extract(epoch from (v_now - v_last_refill))) / c_refill_seconds
  );

  if v_tokens < 1 then
    update public.nw_dmca_rate_counters
      set tokens = v_tokens,
          last_refill_at = v_now,
          updated_at = v_now
      where rate_key = p_rate_key;
    return 'rate-limited';
  end if;

  update public.nw_dmca_rate_counters
    set tokens = v_tokens - 1,
        last_refill_at = v_now,
        request_count = request_count + 1,
        updated_at = v_now
    where rate_key = p_rate_key;
  return 'allowed';
end;
$$;

revoke all on function public.nw_consume_dmca_rate_limit(text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_consume_dmca_rate_limit(text, text, text)
  to service_role;

-- ============================================================ workflow actions v2

create or replace function public.nw_dmca_apply_action(
  p_notice_id uuid,
  p_notice_kind text,
  p_action text,
  p_moderator_ref text,
  p_note text,
  p_value text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_url text;
  v_target_kind text;
  v_target_id text;
  v_report_id uuid;
  v_original_notice_id uuid;
  v_value_uuid uuid;
  v_forward_email text;
  v_restore_uuid uuid;
  v_found boolean;
  v_assignee text;
begin
  if length(trim(coalesce(p_moderator_ref, ''))) = 0 then
    return 'bad-moderator';
  end if;
  if p_notice_kind not in ('takedown', 'counter') then
    return 'bad-kind';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nw-dmca-action:' || p_notice_kind || ':' || p_notice_id::text, 0)
  );

  if p_notice_kind = 'takedown' then
    select status, infringing_url, target_kind, target_id, report_id
      into v_status, v_url, v_target_kind, v_target_id, v_report_id
    from public.nw_dmca_notices
    where id = p_notice_id
    for update;
    if v_status is null then
      return 'not-found';
    end if;

    if p_action = 'assign' then
      v_assignee := coalesce(nullif(trim(coalesce(p_value, '')), ''), trim(p_moderator_ref));
      update public.nw_dmca_notices
        set assigned_moderator_ref = v_assignee, updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'assigned', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('assignee', v_assignee));
      return 'assigned';
    elsif p_action = 'add_note' then
      if length(trim(coalesce(p_note, ''))) = 0 then return 'note-required'; end if;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'communication', p_moderator_ref, trim(p_note));
      return 'noted';
    elsif p_action = 'acknowledge' then
      if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
      update public.nw_dmca_notices
        set acknowledged_at = coalesce(acknowledged_at, v_now),
            status = case when status = 'received' then 'acknowledged' else status end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'acknowledged', p_moderator_ref, coalesce(p_note, ''));
      return 'acknowledged';
    elsif p_action = 'forward' then
      if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
      v_forward_email := nullif(lower(trim(coalesce(p_value, ''))), '');
      if v_forward_email is null then return 'email-required'; end if;
      update public.nw_dmca_notices
        set forwarded_at = v_now,
            forwarded_to_email = v_forward_email,
            status = case when status = 'needs_resolution' then status else 'forwarded' end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'forwarded', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('to', v_forward_email, 'delivery', 'manual-attested'));
      return 'forwarded';
    elsif p_action = 'resolve_url' then
      select r.target_kind, r.target_id
        into v_target_kind, v_target_id
      from public.nw_resolve_public_url(v_url) r
      limit 1;
      if v_target_kind is null then
        insert into public.nw_dmca_events
          (notice_kind, takedown_notice_id, event, actor_ref, note)
        values
          ('takedown', p_notice_id, 'resolution_retry_failed', p_moderator_ref,
           coalesce(p_note, ''));
        return 'still-needs-resolution';
      end if;
      if v_report_id is null then
        insert into public.nw_reports (
          reporter_id, target_kind, target_id, reason, detail, intake_source,
          dmca_notice_id
        )
        select null, v_target_kind, v_target_id, 'copyright',
               'DMCA takedown: ' || left(copyrighted_work, 500), 'dmca', id
        from public.nw_dmca_notices
        where id = p_notice_id
        returning id into v_report_id;
      end if;
      update public.nw_dmca_notices
        set target_kind = v_target_kind,
            target_id = v_target_id,
            report_id = v_report_id,
            status = case when acknowledged_at is null then 'received' else 'acknowledged' end,
            updated_at = v_now
        where id = p_notice_id;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'target_resolved', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('targetKind', v_target_kind, 'targetId', v_target_id,
                            'reportId', v_report_id));
      return 'resolved';
    elsif p_action = 'link_strike' then
      begin
        v_value_uuid := trim(coalesce(p_value, ''))::uuid;
      exception when others then
        return 'bad-strike';
      end;
      -- Any enforcement action can carry the copyright strike for this notice:
      -- profile suspension, article removal, or suggestion removal. dismiss and
      -- restore rows are not enforcement and stay unlinkable.
      select true into v_found
      from public.nw_moderation_actions
      where id = v_value_uuid
        and action in ('suspend_profile', 'hide_article', 'hide_suggestion');
      if not coalesce(v_found, false) then return 'bad-strike'; end if;
      update public.nw_dmca_notices n
        set strike_action_id = a.id,
            strike_profile_id = case when a.target_kind = 'profile' then a.target_id::uuid else null end,
            status = 'actioned',
            actioned_at = v_now,
            updated_at = v_now
      from public.nw_moderation_actions a
      where n.id = p_notice_id and a.id = v_value_uuid;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', p_notice_id, 'strike_linked', p_moderator_ref, coalesce(p_note, ''),
         jsonb_build_object('strikeActionId', v_value_uuid));
      return 'strike-linked';
    elsif p_action = 'close' then
      if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
      update public.nw_dmca_notices
        set status = 'closed', closed_at = v_now, disposition = trim(p_note), updated_at = v_now
        where id = p_notice_id;
      if v_report_id is not null then
        update public.nw_reports set status = 'no_action'
        where id = v_report_id and status = 'open';
      end if;
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note)
      values ('takedown', p_notice_id, 'closed', p_moderator_ref, trim(p_note));
      return 'closed';
    end if;
    return 'bad-action';
  end if;

  -- Counter-notice state machine:
  -- needs_resolution -> received -> forwarded_to_claimant -> waiting_period
  -- -> restored | litigation_hold | closed.
  select status, material_location_before_removal, target_kind, target_id,
         original_notice_id
    into v_status, v_url, v_target_kind, v_target_id, v_original_notice_id
  from public.nw_dmca_counter_notices
  where id = p_notice_id
  for update;
  if v_status is null then
    return 'not-found';
  end if;

  if p_action = 'assign' then
    v_assignee := coalesce(nullif(trim(coalesce(p_value, '')), ''), trim(p_moderator_ref));
    update public.nw_dmca_counter_notices
      set assigned_moderator_ref = v_assignee, updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'assigned', p_moderator_ref, coalesce(p_note, ''),
       jsonb_build_object('assignee', v_assignee));
    return 'assigned';
  elsif p_action = 'add_note' then
    if length(trim(coalesce(p_note, ''))) = 0 then return 'note-required'; end if;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'communication', p_moderator_ref, trim(p_note));
    return 'noted';
  elsif p_action = 'acknowledge' then
    if v_status in ('restored', 'closed') then return 'bad-transition'; end if;
    update public.nw_dmca_counter_notices
      set acknowledged_at = coalesce(acknowledged_at, v_now), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'acknowledged', p_moderator_ref, coalesce(p_note, ''));
    return 'acknowledged';
  elsif p_action = 'resolve_url' then
    select r.target_kind, r.target_id
      into v_target_kind, v_target_id
    from public.nw_resolve_public_url(v_url) r
    limit 1;
    if v_target_kind is null then
      insert into public.nw_dmca_events
        (notice_kind, counter_notice_id, event, actor_ref, note)
      values
        ('counter', p_notice_id, 'resolution_retry_failed', p_moderator_ref,
         coalesce(p_note, ''));
      return 'still-needs-resolution';
    end if;
    update public.nw_dmca_counter_notices
      set target_kind = v_target_kind, target_id = v_target_id,
          status = case when status = 'needs_resolution' then 'received' else status end,
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'target_resolved', p_moderator_ref, coalesce(p_note, ''),
       jsonb_build_object('targetKind', v_target_kind, 'targetId', v_target_id));
    return 'resolved';
  elsif p_action = 'link_original' then
    begin
      v_value_uuid := trim(coalesce(p_value, ''))::uuid;
    exception when others then
      return 'bad-original';
    end;
    if not exists (select 1 from public.nw_dmca_notices where id = v_value_uuid) then
      return 'bad-original';
    end if;
    update public.nw_dmca_counter_notices
      set original_notice_id = v_value_uuid,
          original_notice_reference = v_value_uuid::text,
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'original_notice_linked', p_moderator_ref,
       coalesce(p_note, ''), jsonb_build_object('originalNoticeId', v_value_uuid));
    return 'original-linked';
  elsif p_action = 'unlink_original' then
    update public.nw_dmca_counter_notices
      set original_notice_id = null, updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values
      ('counter', p_notice_id, 'original_notice_unlinked', p_moderator_ref,
       coalesce(p_note, ''));
    return 'original-unlinked';
  elsif p_action = 'forward_to_claimant' then
    if v_status <> 'received' then return 'bad-transition'; end if;
    if v_original_notice_id is null then return 'original-required'; end if;
    select complainant_email into v_forward_email
    from public.nw_dmca_notices where id = v_original_notice_id;
    if v_forward_email is null then return 'original-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'forwarded_to_claimant', forwarded_to_claimant_at = v_now,
          forwarded_to_email = v_forward_email, updated_at = v_now
      where id = p_notice_id;
    update public.nw_dmca_notices
      set forwarded_at = v_now, forwarded_to_email = v_forward_email, updated_at = v_now
      where id = v_original_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'forwarded_to_claimant', p_moderator_ref,
       coalesce(p_note, ''),
       jsonb_build_object('to', v_forward_email, 'delivery', 'manual-attested'));
    return 'forwarded-to-claimant';
  elsif p_action = 'start_waiting_period' then
    if v_status <> 'forwarded_to_claimant' then return 'bad-transition'; end if;
    update public.nw_dmca_counter_notices
      set status = 'waiting_period', waiting_period_started_at = v_now,
          restoration_eligible_at = public.nw_add_business_days(v_now, 10),
          restoration_deadline_at = public.nw_add_business_days(v_now, 14),
          updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note, metadata)
    values
      ('counter', p_notice_id, 'waiting_period_started', p_moderator_ref,
       coalesce(p_note, ''),
       jsonb_build_object('minimumBusinessDays', 10, 'maximumBusinessDays', 14));
    return 'waiting-period';
  elsif p_action = 'restore_content' then
    if v_status <> 'waiting_period' then return 'bad-transition'; end if;
    if not exists (
      select 1 from public.nw_dmca_counter_notices
      where id = p_notice_id and restoration_eligible_at <= v_now
    ) then
      return 'waiting-period-active';
    end if;
    begin
      v_restore_uuid := v_target_id::uuid;
    exception when others then
      v_restore_uuid := null;
    end;
    if v_restore_uuid is null then return 'bad-target'; end if;
    if v_target_kind = 'article' then
      update public.nw_articles set status = 'published' where id = v_restore_uuid
      returning true into v_found;
    elsif v_target_kind = 'suggestion' then
      update public.nw_edit_suggestions set status = 'open' where id = v_restore_uuid
      returning true into v_found;
    elsif v_target_kind = 'profile' then
      -- Restoration for a profile target lifts the suspension signal. Setting
      -- suspended_until to null on an unsuspended profile is an idempotent
      -- no-op; the action still records the restoration decision.
      update public.nw_profiles set suspended_until = null where id = v_restore_uuid
      returning true into v_found;
    else
      return 'bad-target';
    end if;
    if not coalesce(v_found, false) then return 'bad-target'; end if;
    update public.nw_dmca_counter_notices
      set status = 'restored', restored_at = v_now, disposition = nullif(trim(coalesce(p_note, '')), ''),
          updated_at = v_now
      where id = p_notice_id;
    if v_original_notice_id is not null then
      update public.nw_dmca_notices
        set status = 'restored', restored_at = v_now, updated_at = v_now
        where id = v_original_notice_id;
      select report_id into v_report_id
      from public.nw_dmca_notices where id = v_original_notice_id;
    end if;
    insert into public.nw_moderation_actions
      (report_id, moderator_ref, action, target_kind, target_id, note)
    values
      (v_report_id, p_moderator_ref, 'restore', v_target_kind, v_target_id,
       coalesce(p_note, 'DMCA counter-notice restoration'));
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'content_restored', p_moderator_ref, coalesce(p_note, ''));
    if v_original_notice_id is not null then
      insert into public.nw_dmca_events
        (notice_kind, takedown_notice_id, event, actor_ref, note, metadata)
      values
        ('takedown', v_original_notice_id, 'content_restored', p_moderator_ref,
         coalesce(p_note, ''), jsonb_build_object('counterNoticeId', p_notice_id));
    end if;
    return 'restored';
  elsif p_action = 'litigation_hold' then
    if v_status not in ('forwarded_to_claimant', 'waiting_period') then
      return 'bad-transition';
    end if;
    if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'litigation_hold', litigation_hold_at = v_now,
          disposition = trim(p_note), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'litigation_hold', p_moderator_ref, trim(p_note));
    return 'litigation-hold';
  elsif p_action = 'close' then
    if length(trim(coalesce(p_note, ''))) = 0 then return 'disposition-required'; end if;
    update public.nw_dmca_counter_notices
      set status = 'closed', closed_at = v_now, disposition = trim(p_note), updated_at = v_now
      where id = p_notice_id;
    insert into public.nw_dmca_events
      (notice_kind, counter_notice_id, event, actor_ref, note)
    values ('counter', p_notice_id, 'closed', p_moderator_ref, trim(p_note));
    return 'closed';
  end if;

  return 'bad-action';
end;
$$;

revoke all on function public.nw_dmca_apply_action(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.nw_dmca_apply_action(uuid, text, text, text, text, text)
  to service_role;

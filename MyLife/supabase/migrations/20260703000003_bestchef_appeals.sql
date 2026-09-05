-- BestChef moderation appeals (plan 33 Phase 1.7, P0-08 / DSA Art. 20
-- internal complaint handling).
--
-- A user may contest a moderation decision made about THEIR content. The
-- appeal records the user's argument, is rate limited like other actions,
-- and lands in a queue the moderator console (plan 33 Phase 1.3) works
-- through. Resolving an appeal records the outcome + reason (statement of
-- reasons); actually reversing content state stays with the existing
-- decision RPCs (bc_apply_moderation_decision / bc_apply_vote_proof_decision).

create table if not exists public.bc_appeals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.bc_moderation_decisions(id) on delete cascade,
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  body text not null,
  status text not null default 'open' check (status in ('open', 'upheld', 'overturned')),
  resolution_reason text,
  resolved_by uuid references public.social_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint bc_appeals_body_length check (char_length(body) between 1 and 2000),
  constraint bc_appeals_one_per_decision unique (decision_id)
);

create index if not exists bc_appeals_profile_idx
  on public.bc_appeals (profile_id, created_at desc);
create index if not exists bc_appeals_status_idx
  on public.bc_appeals (status, created_at);

alter table public.bc_appeals enable row level security;

drop policy if exists "bc_appeals_read" on public.bc_appeals;
create policy "bc_appeals_read" on public.bc_appeals for select
  using (bc_profile_owned(profile_id) or bc_is_admin());
drop policy if exists "bc_appeals_insert" on public.bc_appeals;
create policy "bc_appeals_insert" on public.bc_appeals for insert
  with check (false); -- RPC only
drop policy if exists "bc_appeals_update" on public.bc_appeals;
create policy "bc_appeals_update" on public.bc_appeals for update
  using (bc_is_admin()) with check (bc_is_admin());

-- Appeals get their own durable cap.
insert into public.bc_action_limits (action, max_count, window_seconds)
values ('appeal', 10, 86400)
on conflict (action) do nothing;

create or replace function public.bc_submit_appeal(
  p_decision_id uuid,
  p_body text
) returns table (
  appeal_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_decision public.bc_moderation_decisions%rowtype;
  v_quota jsonb;
  v_appeal_id uuid;
begin
  v_profile_id := public.bc_current_profile_id();
  if v_profile_id is null then
    return query select null::uuid, 'unauthenticated'::text;
    return;
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null or char_length(p_body) > 2000 then
    return query select null::uuid, 'invalid_body'::text;
    return;
  end if;

  select * into v_decision
  from public.bc_moderation_decisions
  where id = p_decision_id;

  if not found or v_decision.profile_id is distinct from v_profile_id then
    -- Only the affected user may appeal, and we do not reveal other
    -- decisions' existence.
    return query select null::uuid, 'decision_not_found'::text;
    return;
  end if;

  if exists (select 1 from public.bc_appeals a where a.decision_id = p_decision_id) then
    return query select null::uuid, 'already_appealed'::text;
    return;
  end if;

  v_quota := public.bc_consume_action_quota(v_profile_id, 'appeal', p_decision_id);
  if not coalesce((v_quota ->> 'allowed')::boolean, false) then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;

  insert into public.bc_appeals (decision_id, profile_id, body)
  values (p_decision_id, v_profile_id, trim(p_body))
  returning id into v_appeal_id;

  return query select v_appeal_id, null::text;
end;
$$;

grant execute on function public.bc_submit_appeal(uuid, text) to authenticated;

-- Console-side resolution (service role / moderators only): records the
-- outcome and statement of reasons.
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

  return query select p_appeal_id, p_outcome, null::text;
end;
$$;

revoke all on function public.bc_resolve_appeal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bc_resolve_appeal(uuid, text, text) to service_role;

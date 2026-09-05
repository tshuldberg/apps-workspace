-- Yearn public deck write RPCs for Expo LOOP-02.
-- Safe for fresh MyLife databases where the isolated Yearn schema is absent.

do $$
begin
  if to_regclass('yearn.profiles') is null
    or to_regclass('yearn.likes') is null
    or to_regclass('yearn.passes') is null
    or to_regclass('yearn.matches') is null
    or to_regclass('yearn.match_archivals') is null
    or to_regprocedure('yearn.is_blocked(uuid,uuid)') is null
  then
    raise notice 'Yearn social tables/functions are incomplete; skipping send_like/send_pass RPC migration.';
  else
    execute 'drop function if exists yearn.send_like(uuid, text)';

    execute $fn$
      create function yearn.send_like(
        p_profile_id uuid,
        p_note text default null
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
      as $body$
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

        if p_profile_id is null or p_profile_id = v_uid then
          raise exception 'send_like: invalid recipient';
        end if;

        if v_note is not null then
          raise exception 'send_like: plaintext intros are disabled';
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

        insert into yearn.likes (sender_id, recipient_id, note)
        values (v_uid, p_profile_id, null)
        on conflict (sender_id, recipient_id) do nothing;

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
      $body$;
    $fn$;

    execute 'revoke execute on function yearn.send_like(uuid, text) from public, anon';
    execute 'grant execute on function yearn.send_like(uuid, text) to authenticated';

    execute $fn$
      create or replace function yearn.send_pass(p_profile_id uuid)
      returns void
      language plpgsql
      security definer
      set search_path = yearn, public
      as $body$
      declare
        v_uid uuid := auth.uid();
      begin
        if v_uid is null then
          raise exception 'send_pass: not authenticated';
        end if;

        if p_profile_id is null or p_profile_id = v_uid then
          raise exception 'send_pass: invalid recipient';
        end if;

        if not exists (
          select 1
          from yearn.profiles p
          where p.id = p_profile_id
            and p.is_paused = false
        ) then
          return;
        end if;

        if yearn.is_blocked(v_uid, p_profile_id) then
          return;
        end if;

        insert into yearn.passes (sender_id, recipient_id)
        values (v_uid, p_profile_id)
        on conflict (sender_id, recipient_id) do nothing;
      end;
      $body$;
    $fn$;

    execute 'revoke execute on function yearn.send_pass(uuid) from public, anon';
    execute 'grant execute on function yearn.send_pass(uuid) to authenticated';

    -- Abuse rate limiting for passes, mirroring the likes/messages BEFORE
    -- INSERT trigger pattern from the native 0010 hardening migration.
    -- Likes are limited there (120/hour); passes get a higher ceiling since
    -- passing is the highest-frequency legitimate deck action.
    execute $fn$
      create or replace function yearn.rate_limit_passes()
      returns trigger
      language plpgsql
      as $body$
      declare
        -- TUNABLE: max passes a single sender may create per rolling hour.
        PASSES_MAX_PER_HOUR constant int := 300;
        recent int;
      begin
        select count(*) into recent
        from yearn.passes
        where sender_id = new.sender_id
          and created_at > now() - interval '1 hour';

        if recent >= PASSES_MAX_PER_HOUR then
          raise exception 'You are moving a bit too fast. Take a short break and try again soon.'
            using errcode = 'check_violation';
        end if;

        return new;
      end;
      $body$;
    $fn$;

    execute 'drop trigger if exists passes_rate_limit on yearn.passes';
    execute 'create trigger passes_rate_limit before insert on yearn.passes for each row execute function yearn.rate_limit_passes()';
  end if;
end $$;

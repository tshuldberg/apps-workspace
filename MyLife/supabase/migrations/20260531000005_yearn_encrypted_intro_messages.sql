-- Yearn LOOP-03 encrypted intro seed path.
-- Keeps accepted-like intro seeding on the future E2EE path: clients may attach
-- a ciphertext envelope to the like, and the backend promotes that ciphertext
-- into the match thread when a mutual match exists. It does not copy likes.note
-- into plaintext chat rows.

do $$
begin
  if to_regclass('yearn.profiles') is null
    or to_regclass('yearn.likes') is null
    or to_regclass('yearn.passes') is null
    or to_regclass('yearn.matches') is null
    or to_regclass('yearn.match_archivals') is null
    or to_regprocedure('yearn.is_blocked(uuid,uuid)') is null
  then
    raise notice 'Yearn social tables/functions are incomplete; skipping encrypted intro message migration.';
  else
    alter table yearn.likes
      add column if not exists intro_ciphertext jsonb;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'likes_intro_ciphertext_object'
        and conrelid = 'yearn.likes'::regclass
    ) then
      alter table yearn.likes
        add constraint likes_intro_ciphertext_object
        check (intro_ciphertext is null or jsonb_typeof(intro_ciphertext) = 'object');
    end if;

    create table if not exists yearn.messages_ciphertext (
      id uuid primary key default gen_random_uuid(),
      match_id uuid not null references yearn.matches(id) on delete cascade,
      sender_id uuid not null references auth.users(id) on delete cascade,
      kind text not null default 'user' check (kind in ('user', 'intro')),
      ciphertext jsonb not null check (jsonb_typeof(ciphertext) = 'object'),
      source_like_id uuid references yearn.likes(id) on delete set null,
      read_at timestamptz default null,
      created_at timestamptz not null default now()
    );

    create index if not exists messages_ciphertext_match_idx
      on yearn.messages_ciphertext (match_id, created_at asc, id asc);
    create index if not exists messages_ciphertext_sender_idx
      on yearn.messages_ciphertext (sender_id, created_at desc);
    create unique index if not exists messages_ciphertext_source_like_idx
      on yearn.messages_ciphertext (source_like_id);

    alter table yearn.messages_ciphertext enable row level security;

    drop policy if exists "messages_ciphertext select participants" on yearn.messages_ciphertext;
    create policy "messages_ciphertext select participants"
    on yearn.messages_ciphertext for select
    to authenticated
    using (
      exists (
        select 1
        from yearn.matches m
        where m.id = match_id
          and (m.user_a = auth.uid() or m.user_b = auth.uid())
          and not yearn.is_blocked(m.user_a, m.user_b)
      )
    );

    drop policy if exists "messages_ciphertext insert as sender" on yearn.messages_ciphertext;
    create policy "messages_ciphertext insert as sender"
    on yearn.messages_ciphertext for insert
    to authenticated
    with check (
      sender_id = auth.uid()
      and exists (
        select 1
        from yearn.matches m
        where m.id = match_id
          and (m.user_a = auth.uid() or m.user_b = auth.uid())
          and not yearn.is_blocked(m.user_a, m.user_b)
      )
    );

    drop policy if exists "messages_ciphertext update read_at" on yearn.messages_ciphertext;
    create policy "messages_ciphertext update read_at"
    on yearn.messages_ciphertext for update
    to authenticated
    using (
      sender_id <> auth.uid()
      and exists (
        select 1
        from yearn.matches m
        where m.id = match_id
          and (m.user_a = auth.uid() or m.user_b = auth.uid())
          and not yearn.is_blocked(m.user_a, m.user_b)
      )
    )
    with check (
      sender_id <> auth.uid()
      and exists (
        select 1
        from yearn.matches m
        where m.id = match_id
          and (m.user_a = auth.uid() or m.user_b = auth.uid())
          and not yearn.is_blocked(m.user_a, m.user_b)
      )
    );

    revoke all on yearn.messages_ciphertext from public, anon;
    grant select, insert on yearn.messages_ciphertext to authenticated;
    grant update (read_at) on yearn.messages_ciphertext to authenticated;

    execute $fn$
      create or replace function yearn.rate_limit_messages_ciphertext()
      returns trigger
      language plpgsql
      as $body$
      declare
        messages_ciphertext_max_per_min constant int := 30;
        recent int;
      begin
        select count(*) into recent
        from yearn.messages_ciphertext
        where sender_id = new.sender_id
          and created_at > now() - interval '1 minute';

        if recent >= messages_ciphertext_max_per_min then
          raise exception 'You are sending messages too quickly. Please slow down a moment.'
            using errcode = 'check_violation';
        end if;

        return new;
      end;
      $body$;
    $fn$;

    drop trigger if exists messages_ciphertext_rate_limit on yearn.messages_ciphertext;
    create trigger messages_ciphertext_rate_limit
    before insert on yearn.messages_ciphertext
    for each row execute function yearn.rate_limit_messages_ciphertext();

    execute $fn$
      create or replace function yearn.seed_intro_ciphertexts_for_match(p_match_id uuid)
      returns void
      language plpgsql
      security definer
      set search_path = yearn, public
      as $body$
      declare
        v_user_a uuid;
        v_user_b uuid;
      begin
        select m.user_a, m.user_b
          into v_user_a, v_user_b
        from yearn.matches m
        where m.id = p_match_id;

        if v_user_a is null or yearn.is_blocked(v_user_a, v_user_b) then
          return;
        end if;

        insert into yearn.messages_ciphertext (
          match_id,
          sender_id,
          kind,
          ciphertext,
          source_like_id,
          created_at
        )
        select
          p_match_id,
          l.sender_id,
          'intro',
          l.intro_ciphertext,
          l.id,
          l.created_at
        from yearn.likes l
        where l.intro_ciphertext is not null
          and (
            (l.sender_id = v_user_a and l.recipient_id = v_user_b)
            or (l.sender_id = v_user_b and l.recipient_id = v_user_a)
          )
        order by l.created_at asc, l.id asc
        on conflict do nothing;
      end;
      $body$;
    $fn$;

    revoke execute on function yearn.seed_intro_ciphertexts_for_match(uuid) from public, anon, authenticated;

    execute $fn$
      create or replace function yearn.handle_new_like()
      returns trigger
      language plpgsql
      security definer
      set search_path = yearn, public
      as $body$
      declare
        mutual boolean;
        a uuid;
        b uuid;
        v_match_id uuid;
      begin
        select exists (
          select 1
          from yearn.likes
          where sender_id = new.recipient_id
            and recipient_id = new.sender_id
        ) into mutual;

        if mutual then
          a := least(new.sender_id, new.recipient_id);
          b := greatest(new.sender_id, new.recipient_id);

          insert into yearn.matches (user_a, user_b)
          values (a, b)
          on conflict do nothing;

          select m.id
            into v_match_id
          from yearn.matches m
          where m.user_a = a and m.user_b = b
          limit 1;

          if v_match_id is not null then
            perform yearn.seed_intro_ciphertexts_for_match(v_match_id);
          end if;
        end if;

        return new;
      end;
      $body$;
    $fn$;

    drop trigger if exists likes_handle_new on yearn.likes;
    create trigger likes_handle_new
    after insert on yearn.likes
    for each row execute function yearn.handle_new_like();

    drop function if exists yearn.incoming_likes();
    execute $fn$
      create function yearn.incoming_likes()
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
      as $body$
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
      $body$;
    $fn$;

    revoke execute on function yearn.incoming_likes() from public, anon;
    grant execute on function yearn.incoming_likes() to authenticated;

    drop function if exists yearn.send_like(uuid, text);
    drop function if exists yearn.send_like(uuid, text, jsonb);
    execute $fn$
      create function yearn.send_like(
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
      $body$;
    $fn$;

    revoke execute on function yearn.send_like(uuid, text, jsonb) from public, anon;
    grant execute on function yearn.send_like(uuid, text, jsonb) to authenticated;

    drop function if exists yearn.like_back(uuid);
    execute $fn$
      create function yearn.like_back(p_like_id uuid)
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
        v_sender uuid;
        v_match_id uuid;
        v_match_created_at timestamptz;
        v_is_pending boolean;
      begin
        if v_uid is null then
          raise exception 'like_back: not authenticated';
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
      $body$;
    $fn$;

    revoke execute on function yearn.like_back(uuid) from public, anon;
    grant execute on function yearn.like_back(uuid) to authenticated;

    if exists (
      select 1
      from pg_publication
      where pubname = 'supabase_realtime'
    ) and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'yearn'
        and tablename = 'messages_ciphertext'
    ) then
      alter publication supabase_realtime add table yearn.messages_ciphertext;
    end if;
  end if;
end $$;

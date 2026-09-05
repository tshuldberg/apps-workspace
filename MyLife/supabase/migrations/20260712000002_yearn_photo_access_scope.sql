-- Threat model: the prior policy allowed any authenticated account to scrape
-- visible profile photos and retain stale access after an unmatch, pass, or block.
-- Invariant: another user's photo is readable only while at least one legitimate
-- Yearn surface can display it to the viewer: deck, incoming likes, or active matches.
-- Residual access from an already minted signed URL is bounded by the client's
-- 900-second TTL cap for other users' photos.

do $$
begin
  drop policy if exists "yearn photos select own" on storage.objects;
  drop policy if exists "yearn photos read authenticated" on storage.objects;
  drop policy if exists "yearn photos read visible profiles" on storage.objects;

  if to_regclass('yearn.profiles') is null
    or to_regclass('yearn.likes') is null
    or to_regclass('yearn.passes') is null
    or to_regclass('yearn.matches') is null
    or to_regclass('yearn.match_archivals') is null
    or to_regprocedure('yearn.is_blocked(uuid,uuid)') is null
  then
    create policy "yearn photos select own"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'yearn-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  else
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
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('yearn-photos', 'yearn-photos', false)
on conflict (id) do update set
  public = excluded.public;

-- Private bucket, scoped reads: users can mint signed URLs only for their own
-- objects or for visible photo paths on unpaused, non-blocked Yearn profiles.
-- This preserves deck photo display without reopening arbitrary folder reads.
do $$
begin
  drop policy if exists "yearn photos select own" on storage.objects;
  drop policy if exists "yearn photos read authenticated" on storage.objects;
  drop policy if exists "yearn photos read visible profiles" on storage.objects;

  if to_regclass('yearn.profiles') is null
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
            where p.id::text = (storage.foldername(storage.objects.name))[1]
              and p.is_paused = false
              and photo->>'path' = storage.objects.name
              -- Default-deny: a photo is readable by others only when the
              -- client explicitly marked it visible with a boolean true.
              and jsonb_typeof(photo->'show_on_profile') = 'boolean'
              and (photo->>'show_on_profile')::boolean = true
              and not yearn.is_blocked(auth.uid(), p.id)
          )
        )
      );
  end if;
end $$;

do $$ begin
  drop policy if exists "yearn photos insert own" on storage.objects;
  create policy "yearn photos insert own"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'yearn-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
end $$;

do $$ begin
  drop policy if exists "yearn photos update own" on storage.objects;
  create policy "yearn photos update own"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'yearn-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'yearn-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
end $$;

do $$ begin
  drop policy if exists "yearn photos delete own" on storage.objects;
  create policy "yearn photos delete own"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'yearn-photos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
end $$;

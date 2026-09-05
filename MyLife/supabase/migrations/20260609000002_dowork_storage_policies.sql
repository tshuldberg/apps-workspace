-- DoWork storage buckets + RLS policies (production audit 2026-06-09, P7).
--
-- Buckets:
--   dowork-avatars        (public read, owner write, 5 MB images)
--   dowork-share-media    (public read, owner write, 250 MB images/video)
--   dowork-trainer-videos (private: owner-only direct access, 500 MB video;
--                          member playback happens via signed URLs minted by
--                          the dowork-playback-url edge function after an
--                          entitlement check, so no public/select policy)
--
-- Path convention: <user_id>/...  (first folder segment matches auth.uid()).
-- Service role bypasses RLS automatically.
--
-- Unlike BestChef (dashboard-created buckets), DoWork creates buckets in-
-- migration so provisioning a fresh project is deterministic. Size and MIME
-- limits converge on every run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dowork-avatars', 'dowork-avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('dowork-share-media', 'dowork-share-media', true, 262144000,
   array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('dowork-trainer-videos', 'dowork-trainer-videos', false, 524288000,
   array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── dowork-avatars (public read, owner write) ─────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_avatars_select ON storage.objects;
  CREATE POLICY dowork_avatars_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'dowork-avatars');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_avatars_insert ON storage.objects;
  CREATE POLICY dowork_avatars_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'dowork-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_avatars_update ON storage.objects;
  CREATE POLICY dowork_avatars_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'dowork-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'dowork-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_avatars_delete ON storage.objects;
  CREATE POLICY dowork_avatars_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'dowork-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- ─── dowork-share-media (public read, owner write) ─────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_share_media_select ON storage.objects;
  CREATE POLICY dowork_share_media_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'dowork-share-media');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_share_media_insert ON storage.objects;
  CREATE POLICY dowork_share_media_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'dowork-share-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_share_media_update ON storage.objects;
  CREATE POLICY dowork_share_media_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'dowork-share-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'dowork-share-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_share_media_delete ON storage.objects;
  CREATE POLICY dowork_share_media_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'dowork-share-media'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- ─── dowork-trainer-videos (private, owner-only; playback via signed URLs) ─
DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_trainer_videos_select ON storage.objects;
  CREATE POLICY dowork_trainer_videos_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'dowork-trainer-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_trainer_videos_insert ON storage.objects;
  CREATE POLICY dowork_trainer_videos_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'dowork-trainer-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_trainer_videos_update ON storage.objects;
  CREATE POLICY dowork_trainer_videos_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'dowork-trainer-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'dowork-trainer-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_trainer_videos_delete ON storage.objects;
  CREATE POLICY dowork_trainer_videos_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'dowork-trainer-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

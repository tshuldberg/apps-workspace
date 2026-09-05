-- DoWork form-check storage bucket + RLS (Plan 36, Phase 1.2).
--
-- Bucket:
--   dowork-form-checks (private: no public/select policy; participant upload,
--                       uploader-only delete; playback happens via signed URLs
--                       minted by dowork-playback-url after an entitlement check)
--
-- Path convention: <client_link_id>/<uuid>.mp4  (first folder segment is the
-- client link id, resolved through dw_link_participant()). Size/MIME parity
-- with dowork-trainer-videos: 500 MB, video/mp4 + video/quicktime.
-- Service role bypasses RLS automatically.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dowork-form-checks', 'dowork-form-checks', false, 524288000,
   array['video/mp4', 'video/quicktime'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── dowork-form-checks (private; participant upload, signed-URL reads) ─────
-- Insert only when the uploader is a participant of the ACTIVE client link
-- named by the first path segment.
DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_form_checks_insert ON storage.objects;
  CREATE POLICY dowork_form_checks_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'dowork-form-checks'
      AND public.dw_link_participant(split_part(name, '/', 1)::uuid, true)
    );
END $$;

-- No SELECT policy: reads happen only through signed URLs minted server-side
-- (parity with dowork-trainer-videos private-signed-only reads).

-- Delete allowed for the uploader (owner column is set to auth.uid()).
DO $$ BEGIN
  DROP POLICY IF EXISTS dowork_form_checks_delete ON storage.objects;
  CREATE POLICY dowork_form_checks_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'dowork-form-checks'
      AND owner = auth.uid()
    );
END $$;

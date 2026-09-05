-- BestChef storage RLS policies
-- ----------------------------------------------------------------------------
-- Buckets:
--   bc-avatars                 (public read, owner-write)
--   bestchef-submission-images (public read, owner-write)
--   bestchef-submission-videos (private, owner-only)
--   bestchef-thumbnails        (private, owner-only)
--   bestchef-product-evidence  (private, owner-only)
--   bestchef-receipt-evidence  (private, owner-only)
--   bestchef-quarantine        (private, owner-only)
--
-- Path convention: <user_id>/...    (first folder segment matches auth.uid()).
-- Service role bypasses RLS automatically.
-- ----------------------------------------------------------------------------

-- RLS on storage.objects is enabled by default in Supabase. The migration
-- runs as `postgres`, which is not the owner of storage.objects, so we skip
-- the redundant ALTER TABLE ... ENABLE ROW LEVEL SECURITY here.

-- ─── bc-avatars (public read, owner write) ────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS bc_avatars_select ON storage.objects;
  CREATE POLICY bc_avatars_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'bc-avatars');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bc_avatars_insert ON storage.objects;
  CREATE POLICY bc_avatars_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bc-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bc_avatars_update ON storage.objects;
  CREATE POLICY bc_avatars_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bc-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bc-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bc_avatars_delete ON storage.objects;
  CREATE POLICY bc_avatars_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bc-avatars'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- ─── bestchef-submission-images (public read, owner write) ────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_images_select ON storage.objects;
  CREATE POLICY bestchef_submission_images_select ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'bestchef-submission-images');
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_images_insert ON storage.objects;
  CREATE POLICY bestchef_submission_images_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-submission-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_images_update ON storage.objects;
  CREATE POLICY bestchef_submission_images_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-submission-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-submission-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_images_delete ON storage.objects;
  CREATE POLICY bestchef_submission_images_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-submission-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- ─── Private buckets: owner-only SELECT + INSERT/UPDATE/DELETE ────────────
-- bestchef-submission-videos
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_videos_select ON storage.objects;
  CREATE POLICY bestchef_submission_videos_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-submission-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_videos_insert ON storage.objects;
  CREATE POLICY bestchef_submission_videos_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-submission-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_videos_update ON storage.objects;
  CREATE POLICY bestchef_submission_videos_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-submission-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-submission-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_videos_delete ON storage.objects;
  CREATE POLICY bestchef_submission_videos_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-submission-videos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- bestchef-thumbnails
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_thumbnails_select ON storage.objects;
  CREATE POLICY bestchef_thumbnails_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-thumbnails'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_thumbnails_insert ON storage.objects;
  CREATE POLICY bestchef_thumbnails_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-thumbnails'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_thumbnails_update ON storage.objects;
  CREATE POLICY bestchef_thumbnails_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-thumbnails'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-thumbnails'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_thumbnails_delete ON storage.objects;
  CREATE POLICY bestchef_thumbnails_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-thumbnails'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- bestchef-product-evidence
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_product_evidence_select ON storage.objects;
  CREATE POLICY bestchef_product_evidence_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-product-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_product_evidence_insert ON storage.objects;
  CREATE POLICY bestchef_product_evidence_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-product-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_product_evidence_update ON storage.objects;
  CREATE POLICY bestchef_product_evidence_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-product-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-product-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_product_evidence_delete ON storage.objects;
  CREATE POLICY bestchef_product_evidence_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-product-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- bestchef-receipt-evidence
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_receipt_evidence_select ON storage.objects;
  CREATE POLICY bestchef_receipt_evidence_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-receipt-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_receipt_evidence_insert ON storage.objects;
  CREATE POLICY bestchef_receipt_evidence_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-receipt-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_receipt_evidence_update ON storage.objects;
  CREATE POLICY bestchef_receipt_evidence_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-receipt-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-receipt-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_receipt_evidence_delete ON storage.objects;
  CREATE POLICY bestchef_receipt_evidence_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-receipt-evidence'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- bestchef-quarantine
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_quarantine_select ON storage.objects;
  CREATE POLICY bestchef_quarantine_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-quarantine'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_quarantine_insert ON storage.objects;
  CREATE POLICY bestchef_quarantine_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-quarantine'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_quarantine_update ON storage.objects;
  CREATE POLICY bestchef_quarantine_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-quarantine'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-quarantine'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_quarantine_delete ON storage.objects;
  CREATE POLICY bestchef_quarantine_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-quarantine'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

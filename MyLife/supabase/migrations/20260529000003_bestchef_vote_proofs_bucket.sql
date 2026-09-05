-- Private, owner-only storage policies for the vote "proof of cook" bucket (TS-05).
-- Vote proofs are camera-captured photos that can include people/faces, so unlike
-- recipe plating photos they must NOT be anonymously readable by key. Approved proofs
-- are served via short-lived signed URLs minted server-side after moderation approval.
--
-- Path convention: <user_id>/...  (first folder segment matches auth.uid()).
-- Service role bypasses RLS automatically (used by the moderation worker + signed-URL minting).
-- The hosted bucket bestchef-vote-proofs must also be created in the Supabase dashboard /
-- Management API (config.toml provisions it for local dev only).

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_vote_proofs_select ON storage.objects;
  CREATE POLICY bestchef_vote_proofs_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-vote-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_vote_proofs_insert ON storage.objects;
  CREATE POLICY bestchef_vote_proofs_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'bestchef-vote-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_vote_proofs_update ON storage.objects;
  CREATE POLICY bestchef_vote_proofs_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'bestchef-vote-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'bestchef-vote-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_vote_proofs_delete ON storage.objects;
  CREATE POLICY bestchef_vote_proofs_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'bestchef-vote-proofs'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

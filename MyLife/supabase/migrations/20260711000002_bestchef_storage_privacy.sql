-- BestChef storage privacy hardening (audit findings C1, H18).
--
-- C1: bestchef-submission-images was created public=true (20260429000001) with an
-- anon SELECT storage policy over the WHOLE bucket (20260428000016). Any object -
-- including images attached to a still-pending / rejected submission - was reachable
-- by direct URL with no moderation gate. This flips the bucket private, drops the
-- anon SELECT policy, and restricts authenticated SELECT to the object's owner
-- (path convention <user_id>/...). Approved images are delivered via server-minted
-- signed URLs (generated with the service role / an authorized client), which work
-- regardless of these SELECT policies - the same pattern used for submission videos
-- and vote proofs.
--
-- H18: add server-enforced size + MIME limits to bestchef-submission-images and
-- bc-avatars so oversized or non-image uploads are rejected by storage itself, not
-- just by client checks. supabase/config.toml is reconciled to match for local
-- `db reset`.
--
-- Existing objects are unaffected on disk; only their reachability changes. Legacy
-- rows that stored a full public URL keep working because the client resolver parses
-- the storage path out of the stored URL and re-signs it (see
-- modules/bestchef/src/cloud/submission-image-url.ts).

-- 1. Flip the bucket private and pin size + MIME limits. `public=false` means the
--    public object endpoint 404s; only signed URLs and RLS-authorized reads resolve.
update storage.buckets
set
  public = false,
  file_size_limit = 12 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'bestchef-submission-images';

-- bc-avatars stays publicly readable (avatars are public profile media by design),
-- but still gets the server-enforced upload limits (H18).
update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'bc-avatars';

-- 2. Replace the whole-bucket anon SELECT policy with owner-only authenticated read.
--    Approved content reaches non-owners exclusively through signed URLs.
DO $$ BEGIN
  DROP POLICY IF EXISTS bestchef_submission_images_select ON storage.objects;
  CREATE POLICY bestchef_submission_images_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'bestchef-submission-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
END $$;

-- The INSERT/UPDATE/DELETE owner-write policies from 20260428000016 remain correct
-- (owner-scoped by first path segment). They are left in place.

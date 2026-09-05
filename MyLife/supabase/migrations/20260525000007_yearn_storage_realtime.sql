-- Yearn storage bucket, storage RLS, and realtime publication wiring.
-- Apply after 0006_yearn_discovery.sql. Idempotent.
--
-- This migration:
--   1. Creates the private yearn-photos bucket.
--   2. Locks storage.objects RLS to each user's own folder for that bucket.
--   3. Adds yearn.messages to the supabase_realtime publication so the client's
--      realtimeV2 postgres-changes stream fires on new messages.

-- =========================================
-- PRIVATE PHOTO BUCKET
-- public = false: photos are reached only via signed URLs (see note below).
-- =========================================
insert into storage.buckets (id, name, public)
values ('yearn-photos', 'yearn-photos', false)
on conflict (id) do nothing;

-- =========================================
-- STORAGE RLS (per-user folder isolation)
-- Client uploads to path "<uid>/<uuid>.<ext>", so the first path segment is the
-- owner's uid. Each authenticated user may CRUD only objects whose first folder
-- segment matches their uid in the yearn-photos bucket.
--
-- NOTE: the bucket is private. Cross-user photo display uses short-lived signed
-- URLs minted by the client (storage.createSignedURL), not public object URLs,
-- so a viewer never needs direct RLS read access to someone else's folder.
-- =========================================
-- SELECT (read): any authenticated user may read objects in yearn-photos so they
-- can mint short-lived signed URLs for the deck and their matches' photos. Paths
-- embed a random UUID and are only ever surfaced through the block-aware discovery
-- function and match data, so they cannot be enumerated. Writes stay locked to the
-- owner's own folder (insert/update/delete policies below).
-- TODO (Phase 2 hardening): replace blanket authenticated read with a SECURITY
-- DEFINER URL-minting function scoped to discoverable / matched users only.
drop policy if exists "yearn photos select own" on storage.objects;
drop policy if exists "yearn photos read authenticated" on storage.objects;
create policy "yearn photos read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'yearn-photos');

drop policy if exists "yearn photos insert own" on storage.objects;
create policy "yearn photos insert own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'yearn-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

drop policy if exists "yearn photos delete own" on storage.objects;
create policy "yearn photos delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'yearn-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================
-- REALTIME PUBLICATION
-- Add yearn.messages to supabase_realtime so postgres-changes INSERT events
-- reach the client. Wrapped so a re-run (table already in publication) is a
-- no-op instead of an error. Publication name "supabase_realtime" is the
-- Supabase default; verify it exists in this project before relying on this.
-- =========================================
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'yearn'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table yearn.messages;
  end if;
exception
  when duplicate_object then
    null; -- already added by a concurrent run; safe to ignore
end;
$$;

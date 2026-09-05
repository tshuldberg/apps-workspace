# BestChef Media Storage Runbook

Date: 2026-04-26

Status: Local Edge Function and local bucket scaffolding exists. Hosted staging/production bucket creation, function deployment, moderation approval, app queue wiring, and device drills remain blocked or incomplete.

## Launch Rule

Public BestChef media must be server-mediated. Local `file://` URIs are allowed only as offline drafts, cache entries, and upload-queue state. Public cloud rows and public feed payloads must never expose local device paths.

## Local Server Scaffold

- `supabase/config.toml` defines private local buckets:
  - `bestchef-submission-images`
  - `bestchef-submission-videos`
  - `bestchef-thumbnails`
  - `bestchef-product-evidence`
  - `bestchef-receipt-evidence`
  - `bestchef-quarantine`
- `supabase/functions/bestchef-media-upload/index.ts` validates authenticated upload intent, owner kind, media kind, MIME type, byte size, and rejects local/remote URL payloads. It returns a signed upload URL and creates a pending private `bc_media_assets` row.
- `supabase/functions/bestchef-media-finalize/index.ts` validates authenticated ownership and marks an uploaded asset `uploaded`, `pending`, and `private`. It does not approve public delivery.
- `supabase/functions/_shared/media.ts` owns bucket selection, size limits, MIME allowlists, and Storage key construction.

## Required Hosted Setup

1. Create the hosted staging buckets and mirror the same bucket names in production.
2. Keep all buckets private until the moderation/public-delivery policy is finalized.
3. Deploy `bestchef-media-upload` and `bestchef-media-finalize`.
4. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in Supabase/server-side secret storage.
5. Add persistent rate limits, quota checks, idempotent upload tokens, and upload retry state before public beta.
6. Add thumbnail/variant generation and public HTTPS URL promotion only after moderation approval.
7. Wire account deletion and moderator takedown to remove Storage objects and mark media rows deleted/private.

## Device QA

- Photo upload from fresh authenticated account.
- Video upload if video remains in public beta scope.
- Offline capture, then online retry without duplicate public rows.
- Cancel upload and retry.
- Oversized file rejection.
- Unsupported MIME rejection.
- Delete-account cleanup of media rows and Storage objects.
- Public feed before approval, after approval, after rejection, and after deletion.

## Scheduled Jobs

- `bestchef-media-purge` (weekly-eligible, runs on schedule): removes storage objects for rejected/deleted `bc_media_assets` rows past the retention window.
- `bestchef-url-resign` (weekly, audit H6): re-signs the 365-day playback URL on approved submission videos before `bc_media_assets.playback_url_expires_at` falls within 30 days, so approved videos never silently 403 on expiry. Config key `url_resign_worker_secret` in `bc_job_config`; see migration `20260711000009_bestchef_url_resign_job.sql`. `bc_job_health()` reports `url_resign_job_scheduled`, `config_url_resign_secret`, and `expiring_playback_urls` (backlog count).
- **One-time follow-up after the console deploy that starts writing `playback_url_expires_at`** (the `attachPlaybackUrl` change in `media-promotion.ts`): re-run the idempotent backfill `UPDATE` from migration `20260711000009` once against that environment. Any submission video approved in the window between the migration landing and the console deploy going live has no `attachPlaybackUrl` write to set the column, so it would otherwise carry a `NULL` expiry forever and never enter the re-sign worker's candidate set.

## Current Blockers

- Hosted Storage buckets are not created.
- Edge Functions are not deployed.
- App upload queue is not wired to the signed upload/finalize functions.
- No staging device upload drill has been run.

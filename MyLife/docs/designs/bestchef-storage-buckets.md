# BestChef Storage Buckets: Access Model and Rationale

Plan 33 Phase 4.2 (bucket audit). This documents the intentional access
model for every BestChef bucket so the "public bucket" reality never
contradicts the "private + signed" claims elsewhere. Source of truth for
policies: `supabase/migrations/20260428000016_storage_policies.sql`.

## Inventory

| Bucket | Read | Write | Why |
|--------|------|-------|-----|
| `bc-avatars` | Public (anon + authenticated) | Owner-only (first path segment = auth.uid()) | Avatars render on every social surface incl. logged-out web/share previews; per-object signing would add a signing round-trip to every list row. |
| `bestchef-submission-images` | Public | Owner-only | Submission photos are the public product surface (feed, leaderboard, share links). `bc_submissions.photo_url` stores the public URL; the `_https` constraint rejects anything else. |
| `bestchef-submission-videos` | Private | Owner-only | Videos ship through the moderation + promotion pipeline (console `/media`): approval signs a long-lived playback URL and flips the `bc_media_assets` row public. Raw objects are never publicly listable. |
| `bestchef-thumbnails` | Private | Owner-only | Derived media; consumers get signed URLs. |
| `bestchef-product-evidence` | Private | Owner-only | User-submitted evidence (TS-05 class data). |
| `bestchef-receipt-evidence` | Private | Owner-only | Receipt imagery may contain payment fragments; never public. |
| `bestchef-quarantine` | Private | Owner-only | Moderation quarantine target. |
| `bestchef-vote-proofs` | Private | Owner-only (storage RLS; the app path is brokered through `bestchef-media-upload`) | Proof photos are moderation evidence (TS-05): console reviews via 10-minute signed URLs. Policies: `20260529000003_bestchef_vote_proofs_bucket.sql`. |

## Public-by-design: the two public buckets

The decision (20260429 backfill, reaffirmed by this audit): avatars and
submission images are **public read, owner-scoped write, moderation-gated
distribution**.

- **Write gating.** Storage RLS requires the first path segment to equal
  `auth.uid()`; anonymous writes are impossible; the CHF-1 durable
  `media_upload` quota (40/day, fail-closed kill switch) caps abuse volume
  through the brokered path.
- **Distribution gating.** A public object is only *discoverable* through
  product surfaces once its owning row clears moderation
  (`bc_submissions.moderation_status = 'approved'`, `bc_media_assets`
  approved + ready). Pre-approval, objects are uuid-keyed and unlisted:
  fetchable only by someone who already has the exact URL.
- **Takedown.** Moderation rejection flips the DB row (source of truth for
  every surface); object deletion is the `bestchef-media-purge` worker
  (TS-04, shipped 2026-07-04): user/account deletions purge on the daily
  run, moderation rejections only after the 183-day appeal-evidence
  window (DSA Art. 20 complaint floor). Until a rejection ages out, its
  object stays private in storage as appeal evidence.

## Residual risks (accepted, stated honestly)

1. **URL-knowers can fetch pre-moderation or post-rejection objects** in
   the two public buckets. Mitigations: uuid keys (no enumeration), EXIF
   stripped client-side before upload, quota caps. Removed entirely when
   F4 lands (below).
2. **No rotation.** Public URLs are permanent; a user who deletes a photo
   relies on the account-deletion worker or the daily TS-04 purge run.
3. **Signed playback URLs for promoted videos expire (~1 year).** A
   re-signing job must exist before the first expiry cohort; F4's CDN
   replaces this entirely. Tracked in plan 33 Phase 4.1.

## The F4 upgrade path

When the founder enables Supabase Pro (F4): image transforms + smart CDN
replace direct public-bucket URLs, at which point both public buckets can
flip private and serve exclusively through the CDN with signed origins.
Nothing in the app hardcodes bucket publicness: consumers read
`photo_url`/`remote_url` from rows, so the flip is a data migration
(rewrite URLs), not an app change.

## Verification pointers

- Storage policies: `supabase/migrations/20260428000016_storage_policies.sql`
- Quota engine: `bc_consume_action_quota` + `bc_action_limits` ('media_upload')
- Promotion pipeline: `apps/bestchef-console/app/media/`
- Asset visibility RLS: `bc_media_assets_read` (approved + public/unlisted + ready)

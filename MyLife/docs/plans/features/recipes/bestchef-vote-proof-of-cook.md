# BestChef Vote Proof-of-Cook

**Feature ID:** BCVOTE-PROOF
**Owner:** BestChef product
**Status:** Spec — not started
**Launch posture:** Public launch blocker. Required before public beta or GA.
**Spec date:** 2026-04-26
**Parent mission control:** [bestchef-server-launch-mission-control.md](./bestchef-server-launch-mission-control.md)

## 1. Summary

To cast any vote on a recipe submission in BestChef, the voter must upload a photo of their own completed, plated dish before they eat it. No photo, no vote — for every tier including `like`. This rule turns voting into a "proof-of-cook" act and converts every submission into a living gallery of community cooks of the same recipe.

This is a **public, server-backed** feature. Vote proofs live in Supabase Postgres and Storage, are subject to moderation, and surface publicly on the submission detail page and the voter's profile feed.

## 2. Goals

- Block drive-by voting and rating manipulation on the public leaderboard.
- Make every vote evidence-backed, so submission rankings reflect people who actually cooked the recipe.
- Create a richer competitive social loop: cookers see their plated dish next to the original recipe and other cooks of the same dish.
- Establish moderation, ownership, and uniqueness contracts that hold up at public-launch scale.

## 3. Non-Goals

- This is **not** a recipe step-tracking or video proof feature. One photo per vote, plated, before eating.
- This is **not** a private-by-default journaling feature. Vote proofs are public on approval — consistent with the BestChef "everything is public server-first" launch posture.
- This is **not** a way to comment on a submission without voting. Comments remain a separate flow with their own sanitization rules.
- We are **not** layering image AI quality scoring (e.g., "is this a great photo?"). Moderation only checks safety, ownership, and food-likeness.

## 4. Product Decisions (locked)

1. **One vote per (user, submission)** — no re-vote, no override, no per-tier multi-vote.
2. **Each proof photo must be unique per submission** — same photo cannot be reused across two votes on the same submission. Different submissions can use different photos from the same cook session.
3. **Proof is required for every tier** — `gold`, `silver`, `bronze`, and `like`. No exceptions.
4. **Public by default** — approved proofs publish to (a) a CookProof gallery on the submission detail and (b) the voter's profile feed. No private-mode toggle in MVP.

## 5. User Story

> *As a BestChef user browsing a top-ranked recipe for "Spicy Sichuan Wontons", I cook the recipe at home, plate it, take a photo before I eat it, and tap Vote → Gold. The app uploads my photo, links it to my vote, and after moderation approves it, my plated dish appears in the submission's CookProof gallery alongside other community cooks. The submission's score updates to reflect a real cook, not a casual scroll.*

## 6. Functional Requirements

### 6.1 Vote gating

- The Vote affordance on a submission detail screen MUST open the **CookProof Capture** flow before any vote is recorded server-side.
- The vote tier (`gold` / `silver` / `bronze` / `like`) is selected before or during the capture flow; capture step is identical for all tiers.
- The Vote button is **disabled with a tooltip** until the user has confirmed a candidate proof photo.
- A vote is committed to the server only after the proof photo's bytes are uploaded to Supabase Storage AND the linked `bc_media_assets` row reaches `upload_status='uploaded'`.

### 6.2 Photo source

- Acceptable sources: device camera (preferred), photo library.
- File requirements: image MIME (`image/jpeg|png|heic|webp`), max 10 MB after client compression, min 720 px on the long edge.
- Each capture is locally compressed to ≤ 2 MB and re-encoded to JPEG before upload (consistent with existing media-upload helper).
- The client computes a SHA-256 `content_hash` of the compressed bytes BEFORE upload. Server enforces uniqueness on `(submission_id, content_hash)`.

### 6.3 One-vote-per-submission

- Database enforces `UNIQUE (profile_id, submission_id)` on `bc_votes`.
- RPC returns a typed `vote_already_exists` error if the user attempts a second vote on the same submission. The client surfaces this as "You already voted on this recipe" with a link to view the user's existing proof.

### 6.4 Photo uniqueness

- Database enforces `UNIQUE (submission_id, content_hash)` on `bc_vote_proofs`.
- If the upload completes but the hash collides with an existing proof on the same submission, the RPC returns `proof_duplicate` and the client deletes the orphaned media asset and prompts for a new photo.

### 6.5 Proof visibility

- A proof becomes publicly visible only after `bc_vote_proofs.status = 'approved'`.
- Until approval, the voter sees their own pending proof on the submission with a "pending review" badge. Other users do not see it.
- Rejected proofs remove the linked vote from the submission's score (see 6.7).

### 6.6 Moderation pipeline

- Every uploaded vote-proof image enters `bc_moderation_queue` immediately on upload.
- An Edge Function (`moderate_vote_proof`) runs:
  1. NSFW classifier — reject above threshold.
  2. Food-likeness classifier — reject below threshold (with reviewer override).
  3. PII heuristics — face-blur recommendation if a clear face is detected (auto-blur via image transform; do not reject for face presence alone).
- Decisions write to `bc_moderation_decisions` and update `bc_vote_proofs.status` to `approved` or `rejected`.
- Decisions are appealable via the existing report-and-appeal surface; not in MVP scope but the schema must allow it (`bc_moderation_decisions` already supports it).

### 6.7 Vote score reconciliation

- A vote's contribution to `bc_submissions.score` and `bc_leaderboards` rankings counts only when its proof is `approved`.
- If a proof is rejected, the linked vote is **soft-disabled**: the row stays in `bc_votes` with `status='proof_rejected'` but does not contribute to score; the voter is notified and may submit a new proof, which moves the vote back to `status='active'`.

### 6.8 Voter experience after voting

- The voter's profile feed shows the proof + the dish they voted on.
- The submission detail's CookProof gallery shows up to 12 most recent approved proofs by default, with a "View all (N)" expansion.
- The voter can delete their own proof (and the linked vote) from their profile or from the submission detail. Deletion is a hard-delete that purges the media bytes and decrements the score.

### 6.9 Account deletion

- When a voter's account is deleted (existing `bc_account_deletion_jobs` flow), all their `bc_vote_proofs` rows AND linked `bc_votes` rows are hard-deleted, and the linked media bytes are purged from the `bc-media` bucket.
- Submission scores and leaderboard snapshots recompute on the next nightly cron.

### 6.10 Offline behavior

- A vote tap with no network: the photo is captured and stored as a `device_local` draft in `rc_local_vote_proofs`. The vote is **not** submitted yet.
- On reconnect, the client drains drafts: uploads media, calls the RPC, marks the draft as committed.
- A draft is auto-discarded if older than 7 days.

## 7. Data Model

### 7.1 Cloud (Supabase) — new migration `20260427000008_bc_vote_proofs.sql`

```sql
-- bc_vote_proofs: one row per vote, links to a media asset, gates score contribution.
create table if not exists bc_vote_proofs (
  id              uuid primary key default gen_random_uuid(),
  vote_id         uuid not null unique references bc_votes(id) on delete cascade,
  submission_id   uuid not null references bc_submissions(id) on delete cascade,
  profile_id      uuid not null references social_profiles(id) on delete cascade,
  media_asset_id  uuid not null references bc_media_assets(id) on delete restrict,
  content_hash    text not null,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  rejection_reason text,
  captured_at     timestamptz not null default now(),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bc_vote_proofs_unique_per_submission unique (submission_id, content_hash)
);

create index if not exists bc_vote_proofs_submission_idx
  on bc_vote_proofs (submission_id, status, captured_at desc);
create index if not exists bc_vote_proofs_profile_idx
  on bc_vote_proofs (profile_id, captured_at desc);
create index if not exists bc_vote_proofs_status_idx
  on bc_vote_proofs (status, captured_at desc);

-- bc_votes additions
alter table bc_votes
  add column if not exists status text not null default 'active'
    check (status in ('active','proof_pending','proof_rejected','deleted'));

alter table bc_votes
  add constraint bc_votes_unique_voter_submission unique (profile_id, submission_id);
```

`bc_media_assets.owner_kind` must accept a new value `'vote_proof'`. Update the existing CHECK constraint in the same migration.

### 7.2 RLS

- `bc_vote_proofs`:
  - SELECT: voter (`profile_id = auth.uid()`) OR proof is `approved` OR caller is admin.
  - INSERT: blocked from clients. Created only via `bc_cast_vote` RPC (SECURITY DEFINER).
  - UPDATE / DELETE: voter on their own pending row, OR moderator/admin on any row.
- `bc_votes` RLS keeps current shape, with the new `status` column publicly readable.

### 7.3 Local SQLite — schema bump v18 (BestChef module)

```sql
create table if not exists rc_local_vote_proofs (
  id              text primary key,            -- uuid
  submission_id   text not null,               -- cloud bc_submissions.id (or bc_submission_aliases.local_submission_id)
  tier            text not null check (tier in ('gold','silver','bronze','like')),
  local_image_uri text not null,               -- file:// path to compressed JPEG
  content_hash    text not null,               -- SHA-256 of bytes, computed pre-upload
  state           text not null default 'draft'
                    check (state in ('draft','uploading','committing','committed','failed','expired')),
  failure_reason  text,
  created_at      text not null default (datetime('now')),
  updated_at      text not null default (datetime('now')),
  expires_at      text not null
);
create index if not exists rc_local_vote_proofs_submission_idx
  on rc_local_vote_proofs (submission_id, state);
```

This table is `device_local` only. It is NEVER mesh-synced (privacy cap policy strips it).

## 8. RPC Contract

### 8.1 `bc_cast_vote`

Replaces existing `bc_cast_vote(submission_id uuid, tier text)`.

```sql
create or replace function bc_cast_vote(
  p_submission_id   uuid,
  p_tier            text,
  p_media_asset_id  uuid
) returns table (
  vote_id    uuid,
  proof_id   uuid,
  status     text,           -- 'pending' on success
  error_code text             -- non-null on failure paths
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
  v_asset bc_media_assets%rowtype;
  v_existing_vote uuid;
  v_vote_id uuid;
  v_proof_id uuid;
begin
  if v_profile is null then
    return query select null::uuid, null::uuid, null::text, 'unauthenticated'::text;
    return;
  end if;

  -- 1. Submission must exist & be active
  if not exists (select 1 from bc_submissions s where s.id = p_submission_id) then
    return query select null::uuid, null::uuid, null::text, 'submission_not_found'::text; return;
  end if;

  -- 2. Tier must be valid
  if p_tier not in ('gold','silver','bronze','like') then
    return query select null::uuid, null::uuid, null::text, 'invalid_tier'::text; return;
  end if;

  -- 3. Media asset must exist, be image, owned by voter, uploaded
  select * into v_asset from bc_media_assets where id = p_media_asset_id;
  if not found
     or v_asset.owner_profile_id <> v_profile
     or v_asset.media_kind <> 'image'
     or v_asset.upload_status <> 'uploaded'
     or v_asset.owner_kind   <> 'vote_proof' then
    return query select null::uuid, null::uuid, null::text, 'invalid_proof_asset'::text; return;
  end if;

  -- 4. Voter cannot vote on their own submission (anti-self-vote)
  if exists (select 1 from bc_submissions s where s.id = p_submission_id and s.profile_id = v_profile) then
    return query select null::uuid, null::uuid, null::text, 'cannot_vote_on_own'::text; return;
  end if;

  -- 5. One vote per (user, submission) — explicit early check for clean error
  select id into v_existing_vote from bc_votes
   where submission_id = p_submission_id and profile_id = v_profile;
  if v_existing_vote is not null then
    return query select v_existing_vote, null::uuid, null::text, 'vote_already_exists'::text; return;
  end if;

  -- 6. Insert vote (still proof_pending) + proof
  insert into bc_votes (id, submission_id, profile_id, tier, status)
    values (gen_random_uuid(), p_submission_id, v_profile, p_tier, 'proof_pending')
    returning id into v_vote_id;

  begin
    insert into bc_vote_proofs (id, vote_id, submission_id, profile_id, media_asset_id, content_hash, status)
      values (gen_random_uuid(), v_vote_id, p_submission_id, v_profile, p_media_asset_id, v_asset.content_hash, 'pending')
      returning id into v_proof_id;
  exception
    when unique_violation then
      -- duplicate photo on same submission
      delete from bc_votes where id = v_vote_id;
      return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text; return;
  end;

  -- 7. Enqueue moderation (separate table/queue insert)
  insert into bc_moderation_queue (kind, target_id, profile_id)
    values ('vote_proof', v_proof_id, v_profile);

  return query select v_vote_id, v_proof_id, 'pending'::text, null::text;
end;
$$;

grant execute on function bc_cast_vote(uuid, text, uuid) to authenticated;
```

### 8.2 `bc_delete_vote`

```sql
create or replace function bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid := auth.uid();
begin
  if v_profile is null then
    raise exception 'unauthenticated';
  end if;
  delete from bc_votes
    where submission_id = p_submission_id and profile_id = v_profile;
  -- bc_vote_proofs cascade-deletes via FK on vote_id
end;
$$;
```

A separate scheduled worker purges Storage bytes for media assets whose `bc_vote_proofs` row was deleted.

### 8.3 Moderation reconciliation

When `moderate_vote_proof` Edge Function approves a proof:

```sql
update bc_vote_proofs set status='approved', reviewed_at=now() where id = $1;
update bc_votes        set status='active'   where id = (select vote_id from bc_vote_proofs where id = $1);
```

When it rejects:

```sql
update bc_vote_proofs set status='rejected', rejection_reason=$2, reviewed_at=now() where id = $1;
update bc_votes        set status='proof_rejected' where id = (select vote_id from bc_vote_proofs where id = $1);
```

## 9. Client (`apps/bestchef`) Surface

### 9.1 New screens / components

- `app/(root)/submission/[id]/vote.tsx` — full-screen CookProof Capture flow (camera → preview → tier → submit).
- `components/CookProofCapture.tsx` — capture step (camera + library picker + retake).
- `components/CookProofGallery.tsx` — horizontal strip on submission detail showing approved proofs.
- `app/(root)/(tabs)/profile.tsx` — extend with "My Cooks" section listing all of the user's approved proofs as a grid.

### 9.2 Module additions (`@mylife/bestchef`)

- `modules/bestchef/src/social/vote-proof.ts` — pure functions: `prepareProof(uri) → { compressedUri, contentHash }`, `castVoteWithProof(input)`.
- `modules/bestchef/src/cloud/vote-proof.ts` — Supabase wrappers (upload, RPC, local-draft drain).
- Local DB v18 migration files in `modules/bestchef/src/db/`.

### 9.3 Capture flow contract

```
[Submission detail]
     |
     | Vote tap
     v
[Tier select sheet] --(cancel)--> back
     |
     | tier locked
     v
[CookProofCapture]
     |  - request camera permission (or fall back to library)
     |  - capture or pick image
     |  - compress + hash locally
     |  - show preview with "Submit" or "Retake"
     |
     | Submit
     v
[Upload + RPC]
     |  - insert rc_local_vote_proofs row (state='uploading')
     |  - upload bytes to bc-media bucket via signed URL
     |  - on uploaded: call bc_cast_vote(...) (state='committing')
     |  - on success: state='committed', clear local draft after 24h
     |  - on duplicate/proof_duplicate: prompt retake
     |
     v
[Submission detail re-fetched]
     - Vote button replaced by "Voted · Gold" pill with proof thumbnail
     - "Pending review" badge until moderation approves
```

### 9.4 Empty / error states

- Camera denied: show explainer + "Choose from Library" fallback.
- Upload failure: keep local draft, show retry banner; auto-retry on next foreground if network ok.
- `vote_already_exists`: navigate to existing proof, no retry.
- `cannot_vote_on_own`: explainer + dismiss.
- `proof_duplicate`: red banner + force retake.
- Moderation rejected: profile + submission show "Vote needs new proof" with one-tap retake.

### 9.5 Accessibility

- Capture preview includes alt-text input ("Describe your dish, optional, helps moderation"). Stored on `bc_vote_proofs` as a future column (out of MVP, but reserve `caption` text column in migration for forward-compat).
- VoiceOver labels for tier pills, retake, submit.
- Reduced-motion: skip the gallery auto-scroll animation on submission detail.

## 10. Edge Cases

- **Voter is the submission author:** blocked at RPC layer (`cannot_vote_on_own`). Client hides the Vote button on own submissions.
- **Photo of an empty plate / off-topic image:** caught by the food-likeness classifier; proof rejected, vote disabled.
- **User changes tier after capture:** allowed in the flow until Submit. After Submit, the only path is delete-and-revote.
- **Same plated dish, two different submissions of the same recipe:** allowed — each submission has its own uniqueness scope.
- **User reuses a photo across submissions of *different* recipes:** technically allowed by the schema (uniqueness is per-submission); discouraged via UI copy. We accept this risk in MVP because cross-submission de-dupe is moderation work, not schema work.
- **User deletes media bytes from device after upload:** server-side asset is canonical; client should not depend on the local file post-upload.
- **Moderation outage:** proofs sit at `pending`. Vote score does not update. Existing leaderboards stay stable. We do **not** auto-approve.
- **Network failure mid-upload:** local draft remains; voter sees "Upload paused, will retry".

## 11. Privacy & Security

- Proof images are public on approval. The CookProof Capture screen surfaces this clearly: "Your photo will be public on this recipe and your profile." No dark patterns.
- Faces detected in proof images are auto-blurred where confidence is high. We do not attempt full face recognition or identity matching.
- EXIF location metadata is **stripped** client-side before upload.
- The `content_hash` is the SHA-256 of the compressed bytes the server actually receives — it is not a stable hash across re-encodings. This is intentional: it discourages but does not perfectly prevent a determined re-encode-to-bypass attack. Moderation handles the residual risk.
- `bc_vote_proofs` is excluded from the BestChef mesh sync policy (sync caps strip it before it can leave the device).

## 12. Public Data Policy Updates

Update `docs/runbooks/bestchef-public-data-policy-runbook.md` with a new "Vote Proofs" section:

- What's public: approved proof image, voter handle, voter avatar, submission, tier, captured_at.
- What's never public: rejected proof images, pending proof images (voter-only until approved), media bytes after vote deletion.
- Deletion rules: account deletion purges proofs + bytes. Vote deletion purges proofs + bytes. Submission deletion cascades to votes and proofs.

## 13. Mission-Control Phases

Add to `bestchef-server-launch-mission-control.md` under "Public Social Launch Blockers":

| Phase | Title | Scope | Definition of Done |
|-------|-------|-------|--------------------|
| BCVOTE-P0 | Schema + RPC | New migration `20260427000008`, RPC `bc_cast_vote` v2, RLS on `bc_vote_proofs`, schema mirror in `modules/bestchef/src/cloud/schema.sql`, focused SQL tests. | Migration applies cleanly on staging. Vote without proof errors. Vote with someone-else's media errors. Duplicate photo errors. Two votes by same user error. Self-vote errors. |
| BCVOTE-P1 | Local schema + draft store | SQLite schema v18 with `rc_local_vote_proofs`, prepare/upload/drain helpers, hash + compression utilities, focused module tests. | Drafts persist across app restart. Drain succeeds online; queues offline. Hash matches what the server sees. |
| BCVOTE-P2 | Capture UX | `vote.tsx` route, `CookProofCapture`, `CookProofGallery`, tier sheet, error states, accessibility, UIUX contract test. | All five UIUX states covered (loading/empty/error/success/partial). Voiced flow passes screen-reader pass. Reduced-motion respected. |
| BCVOTE-P3 | Moderation function | `moderate_vote_proof` Edge Function, NSFW + food-likeness providers, decision recording, score reconciliation. | Approval flips proof + vote status and rebuilds leaderboard snapshot on next cron tick. Rejection soft-disables the vote. Outage leaves proofs pending without auto-approve. |
| BCVOTE-P4 | Profile + submission integration | "My Cooks" on profile tab, gallery on submission detail, deletion flows, account-deletion cascade verification. | A user's account deletion purges all their proofs + bytes within the worker's TTL. Gallery shows up to 12 with View All. |
| BCVOTE-P5 | Launch verification | End-to-end staging walkthrough on iOS + Android + web (web shows view-only — capture is mobile-only at MVP), telemetry, runbook updates. | Manual QA matrix in `docs/runbooks/bestchef-public-data-policy-runbook.md` is green. Launch readiness updated. |

## 14. Test Plan

### 14.1 SQL / RPC

- `bc_cast_vote` rejects: `unauthenticated`, missing submission, invalid tier, asset not owned, asset wrong kind, asset wrong owner_kind, asset still pending, self-vote, duplicate vote, duplicate proof.
- `bc_cast_vote` success: inserts vote with `status='proof_pending'`, inserts proof with `status='pending'`, enqueues moderation.
- Approval RPC flips both rows; rejection soft-disables vote.
- `bc_delete_vote` cascades proof and queues media-byte purge.
- Account deletion job removes all linked rows and queues media purge.

### 14.2 Module-level (`@mylife/bestchef`)

- `prepareProof(uri)`: compresses, hashes, returns deterministic hash for the same input bytes.
- `castVoteWithProof(input)`: happy path, offline path, RPC error mapping.
- Drain helper: respects 7-day expiry, stops at first failure with backoff.

### 14.3 Client UIUX

- Vote button disabled until tier + photo present.
- Cancel from preview returns to submission with no DB writes.
- Network kill mid-upload preserves draft; foreground resumes.
- Pending proof shows badge to voter only.
- Approved proof appears in gallery and "My Cooks".

### 14.4 Function gate

- `pnpm gate:function:changed` after each phase that changes function logic.
- Add focused fuzz on `prepareProof` (random bytes, ensure no crash, ensure stable hash).

### 14.5 Parity

- `pnpm check:parity --quiet` after each phase.
- `pnpm check:passthrough-parity` if the recipes module surface changes.

## 15. Risks

| Risk | Mitigation |
|------|------------|
| Bad-actor uploads of irrelevant images flood moderation queue | Rate-limit `bc_cast_vote` to 20 votes/24h/user; reject below food-likeness threshold automatically. |
| Photo-reuse attack (re-encode same dish to dodge content_hash) | Accepted residual risk in MVP. Moderation reviewers may flag duplicates manually. Future: perceptual hashing. |
| Storage cost spike at launch | Compression cap 2 MB; aggressive deletion on account/vote/submission delete; lifecycle rule on `bc-media` to move >180-day proofs to cold storage. |
| Privacy concerns about default-public proofs | Capture screen explicitly states "Your photo will be public." Provide a one-tap delete on the proof. Document in privacy policy. |
| Moderation provider outage blocks voting end-to-end | Pending proofs do not block capture or upload — only score contribution. Voter sees "pending review" and can come back later. |
| Mobile-only capture excludes web users | Acceptable at MVP. Web users see read-only galleries. |

## 16. Out of Scope (post-MVP)

- Video proof.
- Multi-photo proofs (front + side + plated table).
- AI photo quality scoring or "best plate" leaderboards.
- Cross-submission perceptual de-dupe.
- Comments-with-proof (commenting still requires no proof).
- BYO recipe variations linked from your proof.

## 17. Definition of Done (full feature)

- Migration `20260427000008_bc_vote_proofs.sql` applied to staging and production.
- RPC, RLS, and moderation pipeline live and exercised by automated tests + a manual end-to-end pass on iOS + Android.
- Capture flow + gallery + profile "My Cooks" shipped behind no flag (it is the new default vote behavior).
- Account-deletion worker verified to purge proofs + bytes.
- Mission-control updated with all BCVOTE phases marked done.
- Public data policy runbook updated.
- `memory.md` and a `docs/sessions/2026-XX-XX-bestchef-vote-proof-of-cook-*.md` log written.
- `pnpm gate:function:changed`, `pnpm check:parity`, BestChef typechecks/tests/UIUX all green.

---

**References**
- Parent: `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
- Public data policy: `docs/runbooks/bestchef-public-data-policy-runbook.md`
- Account lifecycle: `docs/runbooks/bestchef-account-lifecycle-runbook.md`
- Existing core hub schema: `supabase/migrations/20260424000005_add_bestchef_core_hub.sql`
- Existing votes/comments wiring: `modules/bestchef/src/social/`, `apps/bestchef/app/(root)/data/cloud-submissions.ts`

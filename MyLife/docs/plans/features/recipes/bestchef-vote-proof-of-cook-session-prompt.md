# BestChef Vote Proof-of-Cook — Session Prompt

Use this prompt to start a fresh Claude Code session that builds the proof-of-cook voting feature end-to-end.

```text
We are working in /Users/trey/Desktop/Apps/MyLife/apps/bestchef.

Goal of this session: implement the BestChef Vote Proof-of-Cook feature (BCVOTE-PROOF). To cast any vote on a recipe submission, the voter must upload a photo of their own completed, plated dish before they eat it. No photo, no vote, for every tier including 'like'. This is a public-launch blocker on the public social path.

Locked product decisions (do not relitigate):
1. One vote per (user, submission). No re-vote, no override.
2. Each proof photo must be unique per submission (UNIQUE on submission_id + content_hash).
3. Proof is required for every tier: gold, silver, bronze, and like. No exceptions.
4. Public by default. Approved proofs publish to a CookProof gallery on the submission and to the voter's profile feed. No private toggle in MVP.

Critical launch posture (do not violate):
- BestChef public launch is server-backed. Use Supabase Auth, Postgres/RLS, Storage, Edge Functions, and server-side workers.
- Local SQLite stays as an offline draft/cache layer only. The mesh sync substrate must NOT carry public vote-proof data.
- The new bc_vote_proofs table is excluded from the BestChef sync policy caps.
- Service-role secrets stay server-only. The Expo bundle must not contain them.

Before editing anything, read in this order:
1. /Users/trey/Desktop/Apps/MyLife/AGENTS.md
2. /Users/trey/Desktop/Apps/MyLife/CLAUDE.md
3. /Users/trey/Desktop/Apps/MyLife/.claude/settings.local.json
4. /Users/trey/Desktop/Apps/MyLife/.claude/skills-available.md
5. /Users/trey/Desktop/Apps/MyLife/.claude/plugins.md
6. /Users/trey/Desktop/Apps/MyLife/memory.md (latest BestChef state)
7. /Users/trey/Desktop/Apps/MyLife/docs/plans/features/recipes/bestchef-vote-proof-of-cook.md  (THIS FEATURE'S SPEC — primary source of truth)
8. /Users/trey/Desktop/Apps/MyLife/docs/plans/features/recipes/bestchef-server-launch-mission-control.md
9. /Users/trey/Desktop/Apps/MyLife/docs/runbooks/bestchef-public-data-policy-runbook.md
10. /Users/trey/Desktop/Apps/MyLife/docs/runbooks/bestchef-account-lifecycle-runbook.md
11. /Users/trey/Desktop/Apps/MyLife/supabase/migrations/20260424000005_add_bestchef_core_hub.sql  (existing votes/comments/media schema)
12. /Users/trey/Desktop/Apps/MyLife/supabase/migrations/20260426000007_bestchef_account_lifecycle.sql
13. /Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/cloud/schema.sql  (the schema mirror that must stay in sync with the migrations)
14. /Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/social/  (existing follower-updates patterns)
15. /Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/cloud/submission-alias.ts  (demo/cloud submission id mapping — votes have to work through this layer for beta builds too)
16. /Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/data/cloud-submissions.ts
17. /Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/providers/BestChefCloudProvider.tsx
18. /Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/(tabs)/profile.tsx
19. /Users/trey/Desktop/Apps/MyLife/apps/bestchef/app/(root)/recipe/  (existing submission detail screens)
20. /Users/trey/Desktop/Apps/MyLife/modules/bestchef/src/db/schema.ts  (current local SQLite schema — bump to v18)

Then check git status. The worktree may already be dirty. Do not revert unrelated changes.

Run on session start:
- claude mcp list                        # confirm Open Brain, Context7, Perplexity reachable
- pnpm install                           # only if lockfile delta exists
- pnpm --filter @mylife/bestchef-app typecheck   # baseline before edits
- pnpm --filter @mylife/bestchef typecheck

Implementation order — strict. Each phase must be green before moving on.

Phase BCVOTE-P0: Server schema + RPC
- Create supabase/migrations/20260427000008_bc_vote_proofs.sql with:
  - bc_vote_proofs table (see spec section 7.1).
  - bc_votes UNIQUE(profile_id, submission_id) and new status column (active|proof_pending|proof_rejected|deleted).
  - bc_media_assets owner_kind CHECK update to include 'vote_proof'.
  - bc_moderation_queue insert path for kind='vote_proof' (extend existing CHECK if needed).
  - All required indexes from the spec.
- Replace bc_cast_vote with the v2 signature: bc_cast_vote(p_submission_id uuid, p_tier text, p_media_asset_id uuid). Implement every error path from spec section 8.1.
- Add bc_delete_vote(p_submission_id uuid).
- Add a moderation-decision pair of RPCs (or a single function with a 'decision' arg) used by the Edge Function: bc_apply_vote_proof_decision(proof_id, decision, reason).
- RLS per spec section 7.2: voter sees own pending proofs; public sees only approved; moderator/admin sees all.
- Mirror schema in modules/bestchef/src/cloud/schema.sql.
- Write SQL/RPC tests in supabase/tests (or wherever existing migration tests live) covering every reject path AND the happy path. If a fast disposable Postgres is not available, document the manual psql verification commands in the session log.

Phase BCVOTE-P1: Local schema + draft store + helpers (@mylife/bestchef)
- Bump local schema to v18; add rc_local_vote_proofs (see spec section 7.3).
- Add modules/bestchef/src/social/vote-proof.ts:
  - prepareProof(uri): client-side compress to <=2MB JPEG, strip EXIF location, compute SHA-256 of compressed bytes, return { compressedUri, contentHash, byteSize }.
  - castVoteWithProof({ submissionId, tier, contentHash, mediaAssetId }): wraps the RPC, maps error codes to typed results.
  - drainPendingProofs(): finds rc_local_vote_proofs with state in (draft|uploading|committing), retries respecting 7-day TTL, transitions states.
- Add modules/bestchef/src/cloud/vote-proof.ts:
  - createVoteProofMediaAsset(): inserts a bc_media_assets row with owner_kind='vote_proof', returns signed upload URL.
  - completeUpload(): flips upload_status to 'uploaded' after the bytes finish.
- Unit tests for prepareProof determinism (same bytes -> same hash), draft-store state machine, and RPC error mapping.

Phase BCVOTE-P2: Capture UX (apps/bestchef)
- Route: app/(root)/submission/[id]/vote.tsx (full-screen flow).
- Components:
  - components/CookProofCapture.tsx (tier sheet, camera/library, preview, submit).
  - components/CookProofGallery.tsx (horizontal strip on submission detail).
- Wire submission detail: replace direct Vote action with navigation to /submission/{id}/vote.
- Profile tab: add "My Cooks" section listing approved proofs.
- States to ship (all five from /browse contract):
  - loading (uploading)
  - empty (no candidate photo)
  - error (vote_already_exists, proof_duplicate, cannot_vote_on_own, network)
  - success (vote committed, pending review)
  - partial (offline draft queued)
- Accessibility: VoiceOver labels on every interactive element, reduced-motion path on the gallery, alt-text reservation in a future schema column (do not add the column in this phase, only document it).
- Write a UIUX interaction-contract test in apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts covering the new vote flow.

Phase BCVOTE-P3: Moderation Edge Function
- supabase/functions/moderate_vote_proof/index.ts: deno-runtime function consumed from bc_moderation_queue.
- Steps: NSFW classifier, food-likeness classifier, optional face-blur via image-transform.
- Calls bc_apply_vote_proof_decision RPC.
- For local development without paid providers, stub providers behind a clear interface and document the live-credentials TODO in the session log.
- Reconciliation: ensure leaderboards recompute on the next nightly cron tick; if existing cron is not present, add a TODO and a manual recompute helper.

Phase BCVOTE-P4: Profile + submission integration + deletion
- Profile "My Cooks" grid: 3-up, tap to open the submission with the voter's proof scrolled into view.
- Submission detail gallery: 12 most recent approved + "View all (N)".
- Deletion: bc_delete_vote on a swipe action; confirms; purges media via worker.
- Verify account-deletion cascade: write a migration test that calling the existing account-deletion path (bc_account_deletion_jobs) removes proofs + queues bytes for storage purge.

Phase BCVOTE-P5: Verification + docs
- Manual QA matrix on iOS simulator (and Android if available).
- Update docs/plans/features/recipes/bestchef-server-launch-mission-control.md with BCVOTE-P0..P5 done evidence.
- Update docs/runbooks/bestchef-public-data-policy-runbook.md with the new "Vote Proofs" public/private rules.
- Update memory.md and write docs/sessions/YYYY-MM-DD-bestchef-vote-proof-of-cook-*.md.
- Run all gates listed below; record results in the session log.

Implementation constraints (apply throughout):
- TypeScript-first. New runtime code is .ts/.tsx; no implicit any.
- Durable business logic belongs in modules/bestchef. Expo Router screens/providers stay in apps/bestchef.
- Supabase migrations go in supabase/migrations and must be mirrored in modules/bestchef/src/cloud/schema.sql.
- RLS strict. INSERT into bc_vote_proofs is RPC-only. Public read is approved-only.
- Service-role operations never run in the Expo bundle.
- Public launch builds must not contain file:// media URIs in any bc_* row.
- BC vote-proof rows are not mesh-synced. Confirm the BestChef sync policy already caps below shared_workspace for these rows; if not, add the cap.
- Strip EXIF GPS client-side before upload. Always.
- The capture screen must surface "Your photo will be public on this recipe and your profile" before the user can submit.
- No em dashes in human-facing copy.
- Keep AGENTS.md and CLAUDE.md synchronized if any persistent rule changes. (None expected for this feature.)

Files you will likely create:
- supabase/migrations/20260427000008_bc_vote_proofs.sql
- supabase/functions/moderate_vote_proof/index.ts
- modules/bestchef/src/social/vote-proof.ts
- modules/bestchef/src/cloud/vote-proof.ts
- modules/bestchef/src/db/migrations/v18_vote_proofs.ts (or wherever the existing v17 migration lives)
- apps/bestchef/app/(root)/submission/[id]/vote.tsx
- apps/bestchef/app/(root)/components/CookProofCapture.tsx
- apps/bestchef/app/(root)/components/CookProofGallery.tsx
- modules/bestchef/src/__tests__/vote-proof.test.ts
- apps/bestchef/app/(root)/__tests__/cook-proof-capture.test.tsx
- docs/sessions/YYYY-MM-DD-bestchef-vote-proof-of-cook-pN.md

Files you will likely edit:
- modules/bestchef/src/cloud/schema.sql
- modules/bestchef/src/db/schema.ts
- modules/bestchef/src/social/index.ts (re-export)
- apps/bestchef/app/(root)/data/cloud-submissions.ts (route the vote action through the new flow)
- apps/bestchef/app/(root)/recipe/<submission detail file>.tsx
- apps/bestchef/app/(root)/(tabs)/profile.tsx
- apps/bestchef/app/(root)/__tests__/uiux-interaction-contract.test.ts
- docs/plans/features/recipes/bestchef-server-launch-mission-control.md
- docs/runbooks/bestchef-public-data-policy-runbook.md
- memory.md

Verification gates (run at the end of each phase that touches function logic):
- pnpm --filter @mylife/bestchef-app typecheck
- pnpm --filter @mylife/bestchef-app test
- pnpm --filter @mylife/bestchef-app test:uiux
- pnpm --filter @mylife/bestchef typecheck
- pnpm --filter @mylife/bestchef test
- pnpm gate:function:changed
- pnpm check:parity --quiet
- pnpm check:generated-artifacts (note the known investor PDF blocker if it still fails — do not misattribute)

Open Brain capture rule:
- Use context "personal, mylife" for every capture.
- Capture after each phase: what shipped, key decisions, any deviations from the spec, and any new launch blockers surfaced.
- If a phase reveals a product decision that is not in the spec, ASK before deciding. Do not silently extend scope.

Definition of done for this session:
- At least BCVOTE-P0 (schema + RPC) is shipped, mirrored, tested, and documented. Beyond that, prefer ending a phase cleanly to leaving two phases half-done.
- Mission-control file reflects exactly what landed.
- memory.md and a session log are updated with verification output.
- Remaining work is enumerated as the next phase to start, not as TODOs in code.
- No silent backwards-compat shims. No mocked production credentials. No private mesh path leaking public proof data.

Start by reading the files listed above. Confirm Open Brain is connected, summarize the latest BestChef state, then propose the BCVOTE-P0 implementation slice (schema + RPC + tests) before writing any code.
```

## Notes

- Spec lives at `docs/plans/features/recipes/bestchef-vote-proof-of-cook.md`. That file is the source of truth — update it if any decision changes mid-build.
- This is additive on top of the existing `bestchef-server-launch-mission-control.md`. Vote proof-of-cook becomes a new public-social launch blocker phase set (BCVOTE-P0..P5) inside that mission control.
- After P0 lands, future sessions can each take a single later phase using the same prompt as a starting point.

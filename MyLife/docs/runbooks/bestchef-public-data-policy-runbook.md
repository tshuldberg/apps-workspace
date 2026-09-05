# BestChef Public Data Policy Runbook

Date: 2026-04-27

## Launch Rule

Public BestChef social surfaces must not present unlabeled fake users, fake submissions, fake votes, fake comments, fake challenges, or fake activity as real community activity.

Internal beta builds may use demo content for navigation and smoke testing. Public launch builds must disable demo cloud alias writes and demo social rendering unless an approved editorial seed revision has product and legal signoff.

## Demo Cloud Alias Guard

The standalone app uses `apps/bestchef/app/(root)/data/public-data-policy.ts` to decide whether demo submissions can be bridged into hosted `bc_submissions` rows.

Default behavior:

- Development and test builds allow demo aliases for internal beta workflows.
- `NODE_ENV=production` blocks demo aliases by default.
- `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` blocks demo aliases even outside production mode.
- `EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES=1` explicitly allows approved editorial demo aliases only when seed approval is also configured.
- `EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES=0` explicitly blocks demo aliases in every build mode.

Use the explicit allow flag only after product and legal approve seed records, source rights, attribution, moderation state, rollback, and release evidence.

Required approval flags for any public seed/demo override:

- `EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS=approved`
- `EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION=<dated approval artifact or revision>`
- `EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_ROLLBACK_MARKER` must be unset.

If public launch mode is enabled and the approval revision is missing or rolled back, the app must block both demo cloud alias writes and demo social rendering.

## Public Render Guard

The standalone app uses `apps/bestchef/app/(root)/data/public-render-policy.ts` to suppress demo social content in production/public launch.

Guarded public social surfaces include:

- Home trending/video feed entry points.
- Leaderboard rows.
- Profile badges.
- Recipe detail comments and demo submissions.
- Comment threads.
- Chef profiles.
- Challenges.
- Dish social proof and video feed.
- CookProof vote route demo submission lookup.

`apps/bestchef/app/(root)/data/__tests__/public-social-routes.test.ts` statically scans these routes so future `DEMO_` imports must be paired with the render policy.

## Seed Content Requirements

Every public seed record needs:

- Provenance: `demo`, `editorial_seed`, `partner_seed`, or `user_content`.
- Approval status and approval revision.
- Source and rights owner.
- License or written approval.
- Chef attribution and display name policy.
- Moderation state and review timestamp.
- Media rights and storage object provenance.
- Rollback plan.
- Product/legal approval artifact.

`modules/bestchef/src/cloud/public-data-policy.ts` contains the durable helper contract:

- `getBestChefSeedContentApproval` validates the app/env approval state.
- `getBestChefSeedContentRenderDecision` suppresses unapproved seed content, labels approved editorial seed content, and suppresses rolled-back seed content.
- `normalizePublicMediaUrl` accepts HTTPS URLs only and rejects `file://`, `content://`, HTTP, and malformed media values.

## Public Media URL Rule

Public `bc_*` rows must never persist local device media URIs.

- `modules/bestchef/src/cloud/submission-alias.ts` normalizes submission alias photo URLs before inserting `bc_submissions`.
- `supabase/migrations/20260427000010_bestchef_public_data_policy.sql` enforces HTTPS-only `photo_url` values for `bc_dishes`, `bc_submissions`, and `bc_comments`.
- `modules/bestchef/src/cloud/schema.sql` mirrors those constraints for local schema review.

## Vote Proofs

Public launch voting requires Proof-of-Cook for every tier: `gold`, `silver`, `bronze`, and `like`. A vote cannot become active until the voter uploads an image proof asset and moderation approves the proof.

Public:

- Approved proof image.
- Voter handle and avatar.
- Linked submission.
- Vote tier.
- `captured_at`.

Never public:

- Rejected proof image.
- Pending proof image except voter-only visibility.
- Deleted proof media bytes.

Data rules:

- `bc_vote_proofs` is the server source of truth for public vote proofs. Local SQLite proof rows are draft/cache only and must not be mesh-synced as public social data.
- Client inserts into `bc_vote_proofs` are blocked by RLS. Votes must be created through `bc_cast_vote(p_submission_id, p_tier, p_media_asset_id)`.
- The proof media asset must be an uploaded image owned by the voter, have `owner_kind = 'vote_proof'`, and include a content hash.
- Each proof image is unique per submission by `(submission_id, content_hash)`.
- Public readers can only see approved proofs. Voters can see their own pending proofs. Moderator/admin roles can see all proof states.
- Approved proof media is public by default and is intended for the submission CookProof gallery and the voter's profile feed.
- Rejected proofs remain non-public. Their votes stay inactive and do not count toward scoring.
- `bc_votes.status = 'active'` is the only vote status that contributes to scoring and public leaderboard calculations.
- Vote deletion must use the authenticated `bc_delete_vote(p_submission_id uuid)` RPC, confirm before deleting, hard-delete the linked vote/proof rows, and mark proof media private/deleted for server-side Storage purge. The Expo bundle must not contain service-role behavior.
- Account deletion must cascade proof rows and linked votes and include owned proof media bytes in the server-side deletion worker's Storage inventory.
- Public cloud rows must never contain `file://` proof media URIs. Signed upload/finalize or equivalent server-owned Storage paths are required.
- Current local caveat: the account-deletion worker purges owned media, but there is no dedicated hosted vote-deletion Storage purge worker in this repo yet. `bc_delete_vote` preserves Storage refs and marks `metadata.storage_purge = 'pending_server_worker'` so a server worker can remove bytes without involving the Expo client.

Accessibility note:

- Alt text/caption reservation is documented for future proof gallery accessibility, but P0 intentionally does not add a schema column. Add the column only in a later approved schema phase.

## Reports And Moderation State

Public social reporting must use the server path:

- `bc_report_content` creates `bc_flags` and queues targets in `bc_moderation_queue`.
- `bc_apply_moderation_decision` writes `bc_moderation_decisions` with actor, target, reason, timestamp, previous state, and new state.
- Reported `bc_submissions` and `bc_comments` can be moved to `moderation_status = 'hidden'`, which removes them from public RLS-visible surfaces.
- Vote-proof moderation decisions use the same audit table shape through `bc_apply_vote_proof_decision`.
- The Expo app may keep local report rows only as internal/offline cache. Public-launch builds must not treat local report rows as authoritative moderation state.

Operational procedure lives in `docs/runbooks/bestchef-moderation-ops-runbook.md`.

## Verification

Before public beta:

- Run the public data policy tests.
- Run a static scan for `DEMO_` imports in public social routes.
- Set `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` and verify demo submissions do not create hosted aliases.
- Confirm public seed content has rights, attribution, moderation, and rollback evidence.
- Confirm no demo votes, comments, badges, challenges, or chef metrics appear as real user activity unless clearly labeled as editorial content.
- Confirm `bc_cast_vote` rejects votes without an uploaded `vote_proof` media asset and that public reads expose only approved proofs.
- Confirm `bc_delete_vote` removes the linked vote/proof rows, hides proof media immediately, and leaves Storage purge to the server worker path.

## Current Status

P0-02/BCSERVER-P0-06 is locally complete for a no-public-seed launch path as of 2026-04-27. Public launch mode suppresses demo social content and blocks demo cloud alias writes unless an approved seed revision is configured. If Product chooses editorial or partner seed content, the seed import job, source/rights packet, moderation evidence, rollback evidence, and Product/Legal signoff remain launch blockers.

BCVOTE-P0 through BCVOTE-P5 are complete locally as of 2026-04-27. Public voting remains blocked until migrations/functions/workers are deployed to staging and production, Storage buckets and worker secrets are configured server-side, moderation provider credentials are live, and iOS/Android/web walkthrough evidence is captured.

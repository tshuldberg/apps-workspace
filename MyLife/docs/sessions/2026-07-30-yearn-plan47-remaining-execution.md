# Yearn Plan 47 Remaining Phases: Full Execution, 2026-07-30

Branch `feature/yearn-plan47-remaining`, commits `2c5b4db4..9de97441` (+ this bookkeeping commit), squash-merged to `main`. Executed in an isolated worktree (`.claude/worktrees/yearn-plan47`) after a concurrent session in the primary checkout switched branches mid-work (see Concurrency note).

## What shipped (all codeable scope of plan 47 Phases 3-5)

1. **Stage 0, ground truth:** resolved the conflicting memory.md rows against source; per-phase status table in `docs/sessions/2026-07-30-yearn-plan47-ground-truth.md` (+ HTML twin). Merge `c7b5b856` ("phases 2-5") had contained only the Phase 3 moderation migration.
2. **Stage 1, Phase 3 completion (`e5232bbb`):** `yearn-moderation` edge function (bearer admin secret, timing-safe, fail-closed; can never write `transmitted`), migration `20260730000001` (3+ distinct reporters/24h auto-hide + list/get/advance service-role ops RPCs), mandated-reporting runbook `docs/guides/yearn-mandated-reporting-runbook.md`.
3. **Stage 2, push (`49df536a`):** migration `20260730000002` (`push_outbox`, definer enqueue triggers on likes/matches/messages with mutual-pair suppression and intro-message exclusion, `job_config`, pg_cron worker); `yearn-push-fanout` (worker secret, Expo transport, DeviceNotRegistered pruning, kind-only payloads: chat is E2EE, pushes reveal nothing); client `src/lib/push.ts` (honest `not_provisioned`/`permission_denied` states, per-device unregister) + You-tab master toggle + root foreground handler.
4. **Stage 3, realtime + geo + filters (`45f3bdb9`):** migration `20260730000003` (PostGIS `profiles.location` + gist index, definer `update_my_location` with range checks and null-clear, `discovery_prefs` with own-row RLS, `discover_profiles` redefined preserving every moderation/block/pause exclusion and adding server-side pref filters + `distance_miles`/`distance_bucket` + boost-distance-recency ranking, realtime publication for `messages_ciphertext`/`likes`/`matches`); client coarse-only location capture behind explicit user action (no tracking, no watch), DiscoverFilters panel, realtime refresh subscriptions for likes and matches (RLS-scoped, silent fallback).
5. **Stage 4, monetization (`1443729d`):** `verify.ts` refactor exporting `verifyAppleSignedJws` + `expectedType`/`expiresDate`; `yearn-boost-activate` now REQUIRES `appAccountToken`; new `yearn-membership-activate`; new `yearn-appstore-notifications` webhook (dual chain-verified JWS envelope + transaction, renewal/expiry/refund/revoke to entitlement status, 200-acknowledge vs 5xx-retry semantics); migration `20260730000004` (owner lookup by original transaction id); client expo-iap StoreKit 2 wrapper binding `appAccountToken` (lowercased UUID) and sending the JWS server-side BEFORE `finishTransaction`; MembershipSection (join/restore, server-truth status, store-localized prices only) + real BoostButton.
6. **Stage 5, verification (`9de97441`):** migration `20260730000005` (`verification_submissions`, definer `submit_verification` path-pinned to the caller's private folder, service-role `review_verification` with strict transitions + audit ledger, `list_verification_submissions`, and a profiles trigger making `is_verified=true` impossible without an approved submission); `yearn-moderation` gains `list_verifications`/`review_verification`; camera-only live selfie capture + private upload + You-tab status surface; deck badge gate flipped live honestly; liveness vendor slot fail-closed.

## Verification

- Yearn suite: 318/318 (21 base files grew to 30; +114 tests this session), tsc clean throughout.
- Mutation checks: 11 deliberate defects injected across stages; every one caught (2 required strengthening a weak test first: an all-digit UUID that masked a lowercasing bypass, and an injected-runtime path that bypassed the camera-vs-library mapping). No behavioural test shipped unchecked.
- `pnpm check:parity` green; `pnpm --filter @mylife/yearn-app build` (expo export ios+android) green; husky `gate:function:changed` ran on every commit.
- Boost regression: all 54 pre-existing boost function tests stayed green through the verifier refactor.

## Decisions

- Moderation ops surface is an edge-function workflow (mirrors mynews/bestchef worker-secret pattern), not a separate console app.
- Non-underage auto-hide requires 3 distinct reporters in 24h (dogpile-resistant); underage keeps the immediate path.
- Raw StoreKit 2 (expo-iap), not RevenueCat: plan 47's winning model requires the signed transaction JWS, which RevenueCat does not expose. `appAccountToken` is now REQUIRED server-side (no legacy clients exist).
- Verification is a human-review pipeline made structurally trustworthy by the DB guard; liveness vendors strengthen, never gate.
- Y2 multi-device E2EE stays open by design (founder-scoped protocol change, per the 2026-07-12 delta).

## Concurrency note

A concurrent session in the primary MyLife checkout created `feature/mynews-plan48-wave2` off this session's branch tip mid-work; the Stage 1 commit briefly landed there (shared history, harmless: identical commit on both branches). This session moved to worktree `.claude/worktrees/yearn-plan47` for isolation. The mynews branch also carries `f7068a34` (errors_log billing row) and the yearn Stage 0/1 commits as shared ancestry; merges will dedupe.

## Remaining (founder-ops only, never faked; full ledger in the plan file)

Hosted migration applies (`20260712*`, `20260730000001..5`), five edge-function deploys with secrets, `job_config` seeding, ASC (18+ rating, IAP products, ASSN V2 URL, EAS projectId, APNs), legal hosting, NCMEC ESP registration + counsel, liveness/NSFW vendors, on-device two-account QA.

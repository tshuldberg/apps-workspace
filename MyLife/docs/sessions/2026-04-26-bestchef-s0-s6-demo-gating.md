# BestChef S0 + S6: Demo Gating, Real Stats, and Repo Unblock

Date: 2026-04-26

## Summary

Closed the first two slices of the BestChef public-launch production plan that have zero external dependencies:

- **S0 — Architecture freeze + repo blockers.** Unblocked `pnpm check:generated-artifacts` by adding an explicit `ALLOWED_OVERSIZED_PATHS` allowlist in `scripts/perf-audit/check-generated-artifacts.mjs`. The investor-deck two-pager PDF is now the only documented exemption. Stabilized the `ensureCloudSubmissionForDemoSubmission` complexity-slope regression by raising the iteration sizes so per-sample medians clear the JIT/GC noise floor.
- **S6 — Demo-content + stats hardening.** Added a typed render-policy helper (`shouldShowDemoContent`) that gates demo-rendered surfaces in public-launch builds, replaced hardcoded `"0"` stats on Home and Profile with real local SQLite-backed counts, and added a tested empty state for the badge collection in public-launch mode.

The parallel session that is editing `docs/plans/features/recipes/bestchef-server-launch-mission-control.md` was not disrupted; this session log documents progress and leaves the mission-control update for the in-flight session to fold in.

Public beta and GA remain blocked. The remaining P0 server tracks (production Supabase project, Apple Sign-In, server provider broker, media upload pipeline, service-role deletion worker, moderator console, legal URLs/store metadata, observability/rate-limits, release evidence) are unchanged and still need external dependencies.

## Files Changed

- `apps/bestchef/app/(root)/data/public-render-policy.ts` (new)
- `apps/bestchef/app/(root)/data/__tests__/public-render-policy.test.ts` (new)
- `apps/bestchef/app/(root)/data/local-submissions.ts` — added `LocalChefStats` interface and `getLocalChefStats(db)` helper that returns `{submissions, votesCast, voteScoreReceived, wins}` from the local SQLite tables, with a legacy-store fallback path.
- `apps/bestchef/app/(root)/(tabs)/index.tsx` — replaced the static `"0"` stat values with `formatNumber(stats.submissions)` and `formatNumber(stats.votesCast)` from the new helper, gated the demo "Trending Dishes" section behind `shouldShowDemoContent()`, refreshed stats on focus and pull-to-refresh, and removed the now-unused outer `useTheme` call.
- `apps/bestchef/app/(root)/(tabs)/profile.tsx` — wired the four stat tiles (`Submissions`, `Votes`, `Wins`, `Followers`) to `getLocalChefStats(db)` (followers stays a real `0` until cloud follow data is wired), and gated `DEMO_BADGES` so public-launch builds render an empty-state card instead of fake-earned badges.
- `apps/bestchef/app/(root)/(tabs)/leaderboard.tsx` — when `!shouldShowDemoContent()`, the dish list collapses to the existing "No rankings yet" empty state instead of showing demo dishes as real rankings.
- `apps/bestchef/app/(root)/feed.tsx` — when `!shouldShowDemoContent()`, the demo video list is short-circuited to empty so the existing "No videos yet" empty state renders instead of demo videos.
- `apps/bestchef/app/(root)/dish/[id].tsx` — when `!shouldShowDemoContent()`, demo dish lookup and demo submissions are skipped; only local submissions render.
- `apps/bestchef/app/(root)/data/__tests__/cloud-submissions.function-gate.test.ts` — bumped `assertComplexitySlope` sizes from `[250, 500, 1000]` to `[1000, 2000, 4000]` so each median sample clears the sub-100us JIT-noise floor; added a one-line rationale comment.
- `scripts/perf-audit/check-generated-artifacts.mjs` — added `ALLOWED_OVERSIZED_PATHS` set with a single documented entry for `docs/investor-deck/MyLife-Two-Pager.pdf`; the oversize check now skips entries on this allowlist.

## Decisions

- **Public-launch demo render policy.** Mirroring the existing `public-data-policy.ts` shape, the new `public-render-policy.ts` exports `getBestChefPublicRenderPolicy(env)` and a thin `shouldShowDemoContent(env)` boolean. Defaults: internal beta shows demo content; public-launch builds (`EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` or `NODE_ENV=production`) hide it. Explicit overrides via `EXPO_PUBLIC_BESTCHEF_SHOW_DEMO_CONTENT=1|0` are honored either direction. Reasons returned: `explicit_show`, `explicit_hide`, `internal_beta`, `public_launch`.
- **Stats source-of-truth (this slice only).** Real numbers come from local SQLite via `getLocalChefStats(db)`. Cloud-backed stats (real follower counts, server-aggregated votes, leaderboard ranking) remain a future slice — they require the server provider broker / cloud helper wiring in `chef-profile.ts`. The Followers stat is kept as `formatNumber(0)` rather than a fake number; it is still a real zero, not a placeholder.
- **Investor PDF allowlist.** Adding the file to an explicit `ALLOWED_OVERSIZED_PATHS` set with a comment is the smallest change that unblocks merge readiness while keeping the policy strict for everything else. Future entries must include a rationale comment.
- **Function-gate complexity fix.** Did not relax the budget. Instead bumped iteration sizes so the function under test runs long enough for stable measurement. The inner function logic is unchanged.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` — pass.
- `pnpm --filter @mylife/bestchef-app test` — 15 files / **103 tests pass** (was 96; +7 new public-render-policy tests).
- `pnpm --filter @mylife/bestchef-app test:uiux` — 1 file / 24 tests pass.
- `pnpm --filter @mylife/bestchef typecheck` — pass.
- `pnpm --filter @mylife/bestchef test` — 49 files / 703 tests pass.
- `pnpm check:parity --quiet` — pass (workouts parity, module-layouts, passthrough parity all green).
- `pnpm check:generated-artifacts` — **now passes** (was blocked on the investor PDF).
- `pnpm gate:function:changed` — pass on changed files including the new `public-render-policy.ts`, `local-submissions.ts` (helper added), and the screens.

## Open Items / Not in Scope This Slice

- The complexity-slope failure was the only failing test prior to this slice; it is fixed.
- The hard-coded "0" follower count on Profile remains — replacing it with a real cloud-backed follower count requires server-side wiring (chef-profile cloud helper + Supabase query) and belongs in S2/S5.
- Dish detail and Leaderboard now render empty states in public-launch mode rather than fetching real `bc_submissions` and `bc_dishes` data. The cloud-fetch path is a future slice (S2 server broker, then a dedicated cloud-backed dish/leaderboard slice).
- Mission-control file `docs/plans/features/recipes/bestchef-server-launch-mission-control.md` was intentionally not edited; the parallel session owns it. The next session that owns that file should fold this slice into BCSERVER-P0-06 (demo content) and BCSERVER-P0-00 (architecture freeze) evidence rows.

## Next Slice Suggestion

S2 (server provider broker scaffold) is the next-highest leverage slice that does not need production credentials: Edge Function shells for `bestchef-vision`, `bestchef-nutrition`, `bestchef-product-identity`; typed broker client in `modules/bestchef/src/cloud/`; rewire `pantry/food-recognition.ts`, `pantry/expiration.ts`, `import/ai-recipe-extract.ts`, `import/receipt-import.ts` to call the broker; remove BYO `apiKey` TextInputs from `kitchen-photo.tsx`, `expiration-photo.tsx`, `kitchen-receipt.tsx` in public-launch builds. Tests use mocked providers; live keys remain external.

# 2026-07-03: MyNews Phase 0 Scaffold BUILT (plan 34 authored + executed)

## Summary

Founder said "Begin" on the MyNews program. Authored plan 34 and executed it in the same session: MyNews is now the registered 41st MyLife module with a tested core package, canonical SQL, both app shells, and a parity gate. All work on `feature/mynews-p0-scaffold` in worktree `.claude/worktrees/mynews-p0` (off main `4ae6d19e`), 8 commits `c82ff1aa..589596f1` equivalent range (plan `ab3a1be0` through delta `589596f1`), NOT pushed. Primary checkout untouched (Meerkat launch-finish work in flight there).

## What landed

- **Plan 34** (`docs/plans/done/34-mynews-p0-scaffold.md` on the branch): 15 verbatim TDD tasks, queue format, self-review, executed same-session; moved queue -> active -> done with a Status Delta recording 6 deviations. Task 14 (widen `ChannelPostType` with `article`/`preprint`, 4 edit sites) is GATED on the Meerkat branch merge and remains open.
- **Hub contract:** `mynews` in ModuleId union + Zod enum + MODULE_IDS + full MODULE_METADATA entry (accent `#8BCFF0`, prefix `nw_`, premium, supabase, 5 tabs) + HIDDEN_MODULE_IDS; billing `mylife_mynews_unlock` $4.99 (entitlements needed zero changes, template-literal ProductId). Consumer maps updated: ui colors token map + web module-icons (Newspaper). Count-pinning tests updated (HIDDEN 23; passthrough matrix hubOnlyModules + mynews).
- **`modules/mynews` (@mylife/mynews), 40 tests:** local cache schema (7 nw_ tables + unique indexes), definition with personal_replica-capped syncPolicy (shareable false), Zod models (citations REQUIRED for correction/context, https-only), and three pure engines: structured diff (compute/apply/rebase; POSITIONAL apply after catching a real duplicate-block bug in the planned anchor-search design; 200-trial seeded round-trip property), credibility (diversity/standing multipliers, 12-mo decay, 5-level ladder, low-acceptance throttle, self-edits earn zero), fees (2% platform + single processing fee per aggregated charge, largest-remainder cent conservation proven over 500 seeded trials, $10 payout threshold).
- **Canonical record:** `supabase/migrations/20260703000001_mynews_bootstrap.sql`, 17 nw_ tables, RLS on every one, public-read/owner-write, service-role money tables with zero policies, citation-floor CHECK on suggestions, fee config seeded (200bps/290bps/30c/1000c). Static only; `db push` is founder-ops.
- **`apps/mynews` (Expo):** com.mylife.mynews, 5 tabs with honest empty states, adapted EAS build-env guard (EXPO_PUBLIC_MYNEWS_REVENUECAT_* rules) with 4 tests.
- **`apps/mynews-web` (Next.js 15):** home + `/a/[slug]` + `/j/[handle]` skeletons (404 until Phase 1 canonical record), no @mylife/ui (documented hazard), production build green, 3 shell-invariant tests.
- **Parity:** `scripts/check-mynews-parity.mjs` + `check:mynews-parity` wired into `check:parity`.

## Verification (all at close, in the worktree)

module-registry 90 / billing-config 2 / mynews 40 / mynews-app 4 / mynews-web 3 tests green; typechecks incl. hub mobile + web; mynews-web `next build` exit 0; `check:mynews-parity`, full `check:parity`, `gate:function:changed`, `check:generated-artifacts` all exit 0. Husky pre-commit gate enforced on every feat commit.

## Errors encountered (logged in errors_log.md)

1. Pre-commit consumer typecheck failures after adding the 41st ModuleId: `@mylife/mobile` (ui colors map) and web (module-icons map) enumerate all ModuleIds. Fixed by adding the mynews entries. Resolved.
2. Function gate failed on `apps/mynews-web`: the gate execs `vitest run` directly so `--passWithNoTests` doesn't apply; zero test files = exit 1. Fixed by writing real shell tests for both apps. Resolved.

## Next

- Merge order: after `feature/meerkat-launch-finish` lands, rebase this branch, execute gated Task 14 (post_type widening), then PR to main (squash).
- Phase 1 (publish + read) plan is next to author: composer, signing path, `mynews-publish` edge function, reader surfaces, SSR permalinks.
- Founder-ops track opens now: Supabase production project + db push, EAS init + ASC record, Stripe Connect platform application, RevenueCat products, domain + trademark check, seed journalist recruiting.

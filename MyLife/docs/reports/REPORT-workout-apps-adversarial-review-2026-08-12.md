# Workout Apps Adversarial Review and Completion Verdict

Date: 2026-08-12
Method: 4 parallel adversarial agents (DoWork review, hub module review, git archaeology, MacroFactor research), every load-bearing claim spot-verified against source by the lead session.
Companion plan: `docs/plans/queue/55-dowork-completion-and-macrofactor-gap.md`

## Verdict

**DoWork (`apps/dowork/`) is the most complete workout app and is the one to finish. Score 87/100.**

| Surface | Score | One-line verdict |
|---|---|---|
| **DoWork standalone** | **87** | 56 real screens, 6 edge functions, 14 migrations, 677 real tests, zero stubs found. Missing proof, not features: never built for device, zero UI tests, prod schema 2 migrations behind. |
| Hub module, mobile | 62 | Real training core (599 tests) but fake social fixtures shipped ungated, watch is a shell, voice engine dead in hub, sync policy inert. |
| Hub module, web | ~45 | 21 real pages vs 37 mobile screens. A 2026-03-18 "mobile QA" commit deleted 9 working web pages; the parity gate now requires the "coming soon" placeholder to exist. |
| MyWorkouts standalone (archived) | n/a | Superseded, but recoverable at `.git/modules/MyWorkouts` (HEAD `10d4beb9`). Still the only implementation ever built of templates + clone, followers, and a web coach portal. |

DoWork wins on every axis that matters: it is the only surface with a real server (Supabase `dw_*` schema, RLS, entitlements, RevenueCat, push), the only one with honest demo gating (`public-render-policy.ts`, production can never render fixtures), the only one with a trainer product, and it contains a superset of the hub's consumer screens (it was copy-forked from the hub mobile tree on 2026-04-28 and has since pulled ahead on GPS, voice, social, and session).

## Lineage (why there are four surfaces)

1. **2026-02-24:** MyWorkouts standalone added as a git submodule; hub wiring begins as a passthrough.
2. **2026-03-08 (`d9f78651`):** standalone archived; engine, calculators, and 464+ tests ported into `modules/workouts` in the same commit. The coach portal, templates, and multi-user social were NOT ported.
3. **2026-03-18 (`77423c0e`):** commit labeled "workouts mobile QA" deletes 9 working web pages; `[...slug]` placeholder installed; parity script amended to require the placeholder.
4. **2026-04-28 (`720036f5`):** DoWork created by copy-forking the hub mobile route tree (41 identically named files) and rebuilding the trainer capability from scratch as a mobile marketplace. Plans 36 and 46 then took it through a trainer platform build and a production-readiness audit.
5. Since then the twin trees have drifted up to ~1000 diff lines per screen with no gate noticing.

## Confirmed adversarial findings

### DoWork (all spot-verified by lead)

- **LG-4 half-fixed, the one real honesty defect:** `dowork-redeem-invite/index.ts:304` still auto-sets `is_verified: true` on invite redemption and `trainer/[handle].tsx:603` renders an unlabeled verified badge. Plan 46 lists LG-4 closed; only the legal copy was scrubbed.
- **Phantom UI test script:** `test:uiux` points at a file that does not exist and passes via `--passWithNoTests`. Zero render/interaction tests over ~26k lines of screen code.
- **Never built:** no EAS build has ever been attempted for DoWork. No icon or splash assets exist (App Store auto-reject). `eas.json` has `REPLACE_WITH_ASC_APP_ID`.
- **Prod schema skew:** migrations `..12` (push device scope) and `..13` (moderation hardening) are not deployed; `push.ts:200` writes `device_id`, so push registration fails against prod today.
- **Unfiled BK-2 sibling:** `dowork-rc-webhook/index.ts:149` compares its secret with plain `!==` and has no rate limit; `dowork-notify` got `timingSafeEqual` + limiter, the webhook did not.
- **Router pollution:** `phase2-kit.tsx`, `phase3-kit.tsx`, `social-kit.tsx` lack the `_` prefix and default exports; Expo Router registers junk routes (same defect exists in the hub tree).
- **SDK 55 time bomb:** six files import `expo-file-system/legacy`, removed in SDK 55.
- **Bookkeeping rot:** 3 errors_log rows marked Unresolved are actually fixed (46, 54, 82); plan 46 contradicts `Tickets/launch-plan.md` on F1 (launch-plan is right: F1 deployed 2026-07-04).
- 14 of 16 sampled plan-46 fix claims fully verified in source; LG-2 delivered via `app.json` privacy manifests instead of the documented plugin.

### Hub module (all spot-verified by lead)

- **Fabricated social users shipped ungated on mobile:** `apps/mobile/lib/workouts/social.ts:111` defines four fake humans with invented follower counts rendered into the feed with no `__DEV__`/env gate. Web ships honest zeros for the same feature.
- **Watch sync is a capability shell:** protocol types only; the only watchOS target in the repo is MyFast's. The stub screen admits it; `modules/workouts/CLAUDE.md` does not.
- **Voice engine (751 LOC, 66 passing tests) has zero hub consumers**; it was built for DoWork.
- **Sync rollout is metadata:** `HUB_SYNC_ENABLED_MODULES = []`; the "counter CRDTs" claim in `7848cb0c` is false (all 19 entity rules are LWW).
- **Parity theater:** `check:workouts-parity` is existsSync + substring greps, mandates the continued export of dead code (`parseVoiceCommand`), and fails if the web placeholder is replaced with real pages. `check:dowork-parity` has real security assertions but never diffs the twin trees.
- **Stale docs:** root CLAUDE.md still calls MyWorkouts a Supabase cloud module (definition says `sqlite`, offline); `modules/workouts/CLAUDE.md` still calls the standalone "active" 5 months after archive; registry tagline disagrees with definition.

### Lost in the 2026-03 consolidation (recoverable from `.git/modules/MyWorkouts`)

1. Coach portal (web) - rebuilt only in DoWork, mobile-only.
2. Workout templates + clone API - gone from every surface.
3. Multi-user social with followers - hub kept pure functions only.
4. Web form-recordings pages - deleted 2026-03-18, CRUD still exported.
5. Workout calendar (WO-025) - spec'd, never built anywhere.

## MacroFactor Workouts: competitive picture

Separate paid app by Stronger By Science, launched 2026-01-12, $11.99/mo (or $89.99/yr bundled with Nutrition), no free tier, 250k+ downloads. Full inventory with citations in the plan appendix.

**Their moat (expensive to match):** Jeff Nippard 600+ video demo library (3 camera angles); equipment modeling depth (per-gym plate inventories, per-machine weight stacks with AI photo scanning, micro-plate types, bodyweight-contribution percentages); auditable rule-based Smart Progression (rep-range midpoint + RIR expectation formula, in-session wand suggestions, change log); three rep-range strength curves (e1RM, e3RM, e10RM); periodization with deloads; iOS Live Activity.

**Their confirmed weaknesses (where DoWork already wins or can):**

| MacroFactor weakness | DoWork position |
|---|---|
| Not offline-first; cold start needs network | Offline-first SQLite core, offline queues, offline downloads |
| No Apple Watch app 8 months post-launch | Also absent; both start from zero |
| No social layer, no marketplace, no coach features at all | Full trainer marketplace + coaching loop + social feed, server-backed |
| Nutrition and training deliberately uncoupled | Hub's cross-module intelligence exists (stripped from DoWork by design; revisit) |
| No GPS, no cardio programming, no HR | DoWork has a real 943-line GPS tracker |
| Static program skeletons; no auto next block | DoWork overload engine adapts; parity roughly even |
| $11.99/mo, no free tier | Pricing freedom |

**DoWork gaps vs MacroFactor (exact status to be locked with the founder's UI screenshots):** per-set RIR/RPE, set types (warmup/drop/myo/failure flags), smart warm-up schemes as percent-of-working-set, per-machine weight stacks, bodyweight contribution split, multi-rep-range strength curves, program periodization with deloads, Live Activity, previous-performance column in the set table, exercise demo media, .xlsx import/export, Apple Health write.

## What finishing DoWork means

Plan 55 (`docs/plans/queue/55-dowork-completion-and-macrofactor-gap.md`) sequences it: truth fixes, first device build + prod schema deploy, UI test floor, absorption of the features other surfaces have (CSV export, templates + clone, followers, calendar), the MacroFactor screenshot-locked gap build, and drift-proofing the twin trees. Founder-ops ledger (ASC, RevenueCat, icon art, legal, APNs) unchanged from plan 46.

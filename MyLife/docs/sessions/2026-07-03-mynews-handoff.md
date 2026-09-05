# MyNews HANDOFF (updated 2026-07-04): pick up from Phases 0+1+2 complete

For a fresh session continuing the MyNews open-journalism platform. Read this plus `memory.md` first; everything else is discoverable from here. (v1 of this handoff covered Phases 0+1; Phase 2 was authored and executed 2026-07-03/04, and main landed part of the branch mid-session. This version reflects the post-landing state.)

## 1. What this is

MyNews: journalists publish under portable signed bylines, volunteer editors improve articles via author-controlled typed suggestions and earn auditable credibility, readers support journalists directly (2% all-in platform fee, zero ads). 41st MyLife module, standalone-first (Manhattan/BestChef pattern), server-canonical per the BestChef public-launch exception.

Document trail (read on demand, not upfront):
- Full build plan (16 sections): `docs/reports/REPORT-mynews-open-journalism-plan-2026-07-01.html` (untracked, primary checkout)
- Approved screens: `docs/reports/REPORT-mynews-product-review-2026-07-03.html` (untracked, primary checkout)
- Concept research (179 sources): `docs/reports/mynews-news-platform-research-2026-06-29.html` (untracked, primary checkout)
- Executed plans WITH Status Deltas (all deviations recorded there): `docs/plans/done/34-mynews-p0-scaffold.md`, `35-mynews-p1-publish-read.md`, `36-mynews-p2-editing-desk.md` (34/35 on main; 36 on the branch)
- Session logs: `2026-07-03-mynews-p0-scaffold-build.md`, `2026-07-03-mynews-p1-publish-read-build.md`, `2026-07-04-mynews-p2-editing-desk-build.md`

## 2. Where the work lives

- Worktree: `/Users/trey/Desktop/Apps/MyLife/.claude/worktrees/mynews-p0` (enter it; the primary checkout carries in-flight Meerkat work on `feature/meerkat-launch-finish`)
- Branch: `feature/mynews-p0-scaffold`, HEAD `515f8794`. **Main already merged this branch through Phase 2 Task 8** (`6309c915`, pushed to origin) and the branch has since been reconciled with main (`515f8794`). The branch is now only **9 commits ahead of main**: Tasks 9-12 (desk UI, newsrooms, web surfaces, parity), the final-review fix, the plan-36 Status Delta, and the reconciliation merge.
- Dependencies are installed (re-run `pnpm install --frozen-lockfile` if main moves again and adds packages: main's `apps/bestchef-console` needed exactly that mid-session); every commit passed the husky staged function gate.

## 3. What is built and green

Phase 0+1 (plans 34/35, ON MAIN): registry entry + $4.99 unlock, module engines (positional diff, credibility, fees), 17-table nw_ bootstrap + RPCs, signing contract with golden fixture, drafts CRUD + pure-fetch cloud adapter, publish/suggest orchestrators, 3 edge functions (verify-then-insert, author-only acceptance), Expo reader/composer, SSR web reader + RSS + sitemap.

Phase 2 (plan 36, Tasks 1-8 ON MAIN, 9-12 branch-only): combineDiffs + near-dupe engines, 17 new port methods on both adapters, author review orchestrators (accept/counter-edit partial/batch/reject, headlineDoc convention), editing-desk migration `20260703000003` (newsrooms, dupes, aggregates v2, batch RPC, trust hardening incl. draft-leak seals), server twins (levels/scoring/dupes) + store v2, suggest v2 (near-dupe collapse, draft gate), review v2 (batch accept, changelog credit validation, self-edit zero awards, reject notes) + publish v2 (newsroom drafts, membership gate on head fallback), anonymous-first auth (`@mylife/auth/client`, no auto-session; magic-link with visible failures) + registration + real Me tab + credibility screens, the full desk UI (suggest composer, review queue, suggestion threads, batch copyedit, Discover search + getLatest), newsrooms (membership, embargo set/labels, draft-to-publish), web editing surfaces (`/a/[slug]/suggestions`, `/e/[handle]`, `/about/editing`, improved-by cards, `@mylife/mynews/engines` RSC subpath).

Test state: module 302, Expo app 158 + typecheck, web 45 + typecheck + prod build. `check:mynews-parity` (+21 Phase 2 checks), full `check:parity`, `gate:function:changed`, `check:generated-artifacts` all exit 0, re-verified post-merge. Baseline block:

```bash
pnpm --filter @mylife/mynews test && pnpm --filter @mylife/mynews-app test && pnpm --filter mynews-web test && pnpm --filter mynews-web build && pnpm check:mynews-parity
```

## 4. Invariants that must not break (enforced by tests; understand before editing)

1. **Author-only acceptance:** the server never composes or selects article text; accept/partial/batch in `mynews-review` require a NEW author-signed revision, and changelog credits are validated against the accepted set (type + editorKey vs registered pubkey). Product, culture, AND the Section 230 posture.
2. **Canonical bytes + golden fixture:** untouched through Phase 2 (batch accept rides v1 multi-entry changelogs). Any payload change needs a NEW version-suffixed domain string and fixture regen, never an in-place edit.
3. **Honesty boundary:** unconfigured/unreachable/signed-out/no-profile = honest states everywhere; `no-profile` routes to the real registration flow; no fabricated counts; editor levels come from the real public ledger.
4. **RSC-safe subpaths:** web server code imports ONLY `@mylife/mynews/cloud-fetch` and `@mylife/mynews/engines` (guarded by shell tests + the prod build).
5. **Sync scope caps:** every `nw_` cache table stays `personal_replica` or below.
6. **No supabase-js in modules/mynews or apps/mynews-web (Expo app gets sessions only via `@mylife/auth/client`); no `@mylife/ui` in mynews-web; no em dashes.**
7. **Twin discipline:** three parity-tested twin pairs (signing, cred incl. `ledgerWeightedScore`/`levelFor`, dupes). Never edit one side without the other; the shared vectors/grids pin them.

## 5. Traps this work already hit (do not rediscover)

All v1 traps stand (vitest-direct gate, ModuleId consumer maps + count-pinning tests, unreliable worktree LSP for the Expo app, URLSearchParams paren-encoding, no parallel installs). New from Phase 2:
- The in-memory adapter can mask fetch-adapter bugs (the draft-mapper Critical): when adding port methods, test BOTH adapters against the same contract.
- `getFeed` with empty follows returns `[]` by contract (Today depends on it); browse-all reads use `getLatest`.
- Draft articles open via `article/[slug]?articleId=` (slug reads exclude drafts; the param fires the session-bearer `getDraftArticle` fallback).
- `nw_is_newsroom_member` answers only for `auth.uid()`; it returns false under service-role JWTs (server code must read the membership table directly).
- Main can land parts of this branch mid-session (it did): before big pushes, check `git log main..HEAD` and reconcile with a merge, then `pnpm install --frozen-lockfile` if main added packages.
- The plan-36 Status Delta records 18 approved contract deviations; read it before trusting the plan body's C-contracts verbatim.

## 6. Open items, in order

1. **Land the remaining 9 commits** (`ada04e60..6fb89e65`: desk UI, newsrooms, web surfaces, parity close-out, final fix, Status Delta, merge) when the founder says so. Main already has everything through Task 8, so this is a small, low-conflict landing.
2. **GATED Task 14 (plan 34):** widen `ChannelPostType` with `'article' | 'preprint'` at exactly 4 sites in the two Meerkat data files. Execute ONLY after `feature/meerkat-launch-finish` merges to main (still unmerged as of 2026-07-04); reconcile with main first.
3. **Founder-ops to go live (not code):** Supabase project; `supabase db push` (all 3 nw_ migrations); deploy the 3 mynews functions; **enable anonymous sign-in** in Supabase Auth and allowlist `mynews://auth-callback`; set app env (`EXPO_PUBLIC_MYNEWS_SUPABASE_URL/_ANON_KEY/_FUNCTIONS_URL`) + web env (`MYNEWS_SUPABASE_URL`, `MYNEWS_SUPABASE_ANON_KEY`, `MYNEWS_PUBLIC_ORIGIN`); live e2e (register on device, publish, suggest, review, read on web, RSS); device QA of the magic-link deep link and the new screens. Longer list in plan 34's founder-ops track (Stripe Connect, EAS/ASC, RevenueCat, DMCA agent, bias-data licensing, 501c3, domain).
4. **Phase 3 (next code): the trust spine.** Author plan 37 first (check `docs/plans/queue/` numbering). Scope from the build plan Section 6 + Phase 3: verification center (domain email, ORCID OAuth, byline claim, manual queue for at-risk reporters), accuracy-based author standing (replaces the 0.5/0.75 tier interim), corrections flow, track-record materialization, Trusted Editor endorsements + `section_editor` reachability, portable export bundles. Server seams already in place: `nw_journalist_verifications` table, `authorStandingForTier` override point, `EditorStats.identityVerified/endorsements/topicScore` zeros.
5. **Recorded follow-ups worth folding into Phase 3:** app/web credibility builders are an unpinned fourth twin (add a shared vector); server cap-side ledger truncates at 500 newest awards; shell-article INSERT cleanup; `mynews-store.ts` three-way split when next touched.

## 7. Session-start ritual for the new session

1. Standard CLAUDE.md session start (MCP check, memory.md, Open Brain briefing).
2. Read this handoff + the plan-36 Status Delta (`docs/plans/done/36-mynews-p2-editing-desk.md` on the branch).
3. Enter the worktree, check `git log --oneline main..HEAD` (9 commits expected; if main moved, reconcile first), run the Section 3 baseline block.
4. Check whether `feature/meerkat-launch-finish` has merged (unlocks Task 14); check `docs/plans/queue/` numbering before authoring plan 37.

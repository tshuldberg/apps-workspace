# MyNews Phase 2: The Open Editing Desk (plan 36 authored + executed)

Date: 2026-07-03 evening -> 2026-07-04. Branch `feature/mynews-p0-scaffold` (worktree `.claude/worktrees/mynews-p0`), 23 commits this session (`d05036fe..515f8794`), NOT pushed.

## What was done

Session start per the 2026-07-03 handoff: baseline re-verified green (module 92 / app 37 / web 24 + prod build + parity), Meerkat `feature/meerkat-launch-finish` confirmed unmerged (plan-34 Task 14 stays gated), queue number 36 confirmed.

Authored plan 36 (`docs/plans/done/36-mynews-p2-editing-desk.md`) from three research fans (build-plan Sections 4-5 + product-review Part 1 extraction; full code map; auth-pattern comparison). Scope = the build plan's full Phase 2, no cuts: suggest mode (6 typed suggestions + citations), suggestion threads, near-dupe collapse, journalist review queue (side-by-side diff, batch copyedit accept, partial apply with counter-edit), credibility ledger live (multipliers, decay, throttle, levels, editor profiles), newsrooms with RLS membership + embargo review, PLUS the auth-session layer (anonymous-first via `@mylife/auth/client`, zero new deps), `nw_profiles` registration (closes the P1 `no-profile` gap), web SSR editing surfaces, and Discover search (P1 leftover).

Executed all 12 tasks by subagent-driven development: fresh implementer per task, then spec review, then quality review, fixes looped until approved, then a final whole-implementation cross-task review. Every task produced at least one real finding before dependent work built on it. Highlights: T2 Critical (article mapper silently dropped drafts, masked by the in-memory adapter); T3 two silent-data-loss traps at the signing boundary; T4 adversarial SQL review found a HIGH draft-thread leak via the P0 events policy plus a verify-then-insert bypass via direct INSERT (all five findings sealed); T7 omission-bypassable newsroom membership gate on draft publishing; T9 dead Latest list (new `getLatest` port method). Server integrity added beyond the plan text: self-edit awards zero points, changelog credit validation (exact set + type + editorKey vs registered pubkey), envelope-shaped 500s. Full deviation ledger (18 items) in the plan's Status Delta.

Mid-session, a parallel session landed main: `6309c915` merged this branch THROUGH Task 8 into main (now pushed to origin), `edd6b2e3` fixed two cross-branch gaps (41-module sync census; `apps/mynews/app.json` was silently gitignored and is now force-tracked). Reconciled by merging main back into the branch (`515f8794`; one union conflict in errors_log.md; ran `pnpm install` to provision main's new `apps/bestchef-console` package whose missing deps crashed the pre-commit gate). Task 10's first implementer hit a session limit mid-task; a fresh agent verified and completed its partial work (one typecheck break found and logged in errors_log.md, Resolved).

## Verification at close

Module 302 / app 158 / web 45 tests; all typechecks; web prod build (routes `/a/[slug]/suggestions` + `/e/[handle]` dynamic, `/about/editing` static); `check:mynews-parity` extended (+21 checks) green; full `check:parity`, `gate:function:changed`, `check:generated-artifacts` exit 0; signing golden fixture byte-identical; post-merge baseline re-verified green. Final review verdict: ready, after its one Important finding (publish-surface `no-profile` -> registration routing) was fixed in `0564e2f2`.

## Remaining

- Branch is 8 commits ahead of main (`ada04e60..515f8794`: Tasks 9-12, final fix, Status Delta, reconciliation merge). Land them when the founder says so; the hard part (P0-T8) is already on main.
- Plan-34 Task 14 (`ChannelPostType` widening) still gated on the Meerkat `feature/meerkat-launch-finish` merge.
- Founder-ops to go live: Supabase project, `db push` (3 nw_ migrations), deploy 3 functions, ENABLE ANONYMOUS SIGN-IN + allowlist `mynews://auth-callback`, app/web env vars, seed a profile row or use the registration flow, live e2e, device QA (magic-link deep link + new screens).
- Phase 3 next (trust spine): verification center, accuracy-based author standing, corrections flow, Trusted Editor endorsements (section_editor reachability), portable export bundles.
- Recorded follow-ups (Status Delta): app/web credibility builders are an unpinned fourth twin; server cap-side ledger truncates at 500 newest (conservative); shell-article INSERT cleanup (security-neutral); `mynews-store.ts` three-way split when next touched; Phase 3 must not call `nw_is_newsroom_member` under service role.

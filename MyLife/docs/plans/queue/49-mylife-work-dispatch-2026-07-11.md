# Plan 49: MyLife Work Dispatch Board (2026-07-11)

- **Status:** queue (dispatch board; each item is independently dispatchable)
- **Created:** 2026-07-11, from the integration review ([report](../../reports/REPORT-mylife-integration-review-2026-07-11.md))
- **Protocol:** every prompt below is written for a fresh **Fable session as orchestrator**. Fable authors or reviews all plans and scopes itself, dispatches **non-fable agents only** (opus for review/taste work, sonnet, or sonnet wrappers running `codex exec` for gpt-5.5 bulk implementation per the global model policy), verifies agent output against primary evidence, and does the consequential resolutions itself. No fable-model subagents.
- **Standing rules that apply to every item:** branch off `main`, Conventional Commits, gates before commit (`pnpm gate:function:changed`, relevant suites, `pnpm check:parity`), update `memory.md` + `errors_log.md` + Open Brain (context `personal, mylife`) as you go, `.md` report deliverables get `.html` twins opened in the browser, push only when the founder asks.

## A. Ready to dispatch (codeable now)

### W1. Yearn boost monetization integrity (revenue, small-medium)

Source: rev-yearn P2 + errors_log Unresolved row. `activate_boost(text)` grants any signed-in user a 7-day boost with no receipt validation and no transaction-id uniqueness (`supabase/migrations/20260525000012_yearn_boost.sql:104`).

```text
You are the Fable orchestrator for MyLife (repo /Users/trey/Desktop/Apps/MyLife). Fix the Yearn
boost self-grant revenue leak. Read docs/plans/done/47-yearn-production-readiness-remediation.md
(monetization phase), supabase/migrations/20260525000012_yearn_boost.sql, and the errors_log.md row
dated 2026-07-11 about activate_boost. Author the implementation plan yourself before any agent
runs: server-side App Store Server API receipt validation behind an edge function or service-role
path (never client-trusted), a unique constraint on original_transaction_id, replay/duplicate
tests, honest failure copy in the app, and boost staying fully disabled until validation is live.
Dispatch non-fable agents (sonnet/codex for mechanical implementation, opus for the adversarial
review) with scopes you write; review their output against the actual SQL and StoreKit flow
yourself. New migration numbers must not collide with 20260525* or 20260711*. Gates + yearn suite
green, branch feature/yearn-boost-integrity, ledgers + Open Brain updated.
```

### W2. Yearn plan 47 phases 2-5 (large)

Source: plan 47 (queue), yearn audit report. Phase 1 merged; phases 2-5 are schema consolidation, moderation + legal + CSAM pathway, push/realtime/geo, monetization/verification.

```text
You are the Fable orchestrator for MyLife. Execute Yearn remediation plan 47 phases 2-5
(docs/plans/done/47-yearn-production-readiness-remediation.md). First re-verify the plan's phase
scoping against merged main (Phase 1 landed in merge 14df25e6; the audit report is
docs/reports/REPORT-yearn-adversarial-production-audit-2026-07-11.md). Update the plan doc with a
Status Delta section you write yourself. Then run phase-by-phase: you author each phase's work
packets and acceptance criteria, non-fable agents implement (codex/sonnet bulk, opus review), you
adversarially verify each phase against code before moving on, dual-review any security or
CSAM-pathway code with two independent non-fable reviewers. W1 (boost integrity) may land first;
rebase over it. Founder-ops items (legal hosting at yearn.app, vendor onboarding, store ops) get
listed, not faked: fail closed. Gates green per phase, branch feature/yearn-plan47-phases-2-5.
```

### W3. MyNews plan 48 execution (large)

Source: plan 48 (queue), mynews adversarial readiness report.

```text
You are the Fable orchestrator for MyLife. Execute MyNews remediation plan 48
(docs/plans/queue/48-mynews-production-readiness-remediation.md, renumbered from 42; report
docs/reports/REPORT-mynews-adversarial-production-readiness-2026-07-11.md). Re-verify plan
assumptions against merged main first (the review suspension/terms gates already landed in merge
6e0b17b0). You author the workstream scopes and sequencing; non-fable agents implement and review
(codex/sonnet build, opus adversarial passes); you verify every fail-closed claim by reading the
edge-function code paths yourself. Keep the EDGE_CURRENT_TERMS_VERSION mirror
(supabase/functions/_shared/mynews-terms.ts) in sync if terms bump. Vendor/deploy/legal-ops stay
founder-ops, fail-closed. Gates + the modules/mynews and app suites green, branch
feature/mynews-plan48.
```

### W4. Meerkat Plan 42 wrap: review, close gaps, merge (medium; WAIT for the active session)

Source: this integration merged the Plan 42 branch mid-flight at `56df52a9`/`ea3c2fe8`; an active session continues on `feature/meerkat-production-readiness-2026-07-09`. Known open: `rotateToken` locates registrations via an O(n) `listRegistrations` page walk (needs `getRegistration(registrationIdHash)` on `PushRegistrationStore` + the Postgres impl).

```text
You are the Fable orchestrator for MyLife. Precondition: confirm the Plan 42 session on
feature/meerkat-production-readiness-2026-07-09 is idle (no worktree file mtimes in the last hour
at .claude/worktrees/meerkat-production-readiness-2026-07-09, no new commits in the last 2 hours).
Then: (1) review every commit on the branch since ea3c2fe8 yourself plus one opus adversarial
reviewer against docs/plans/queue/42-meerkat-native-transport-push-background.md acceptance
criteria; (2) close the known gap: add getRegistration(registrationIdHash) to PushRegistrationStore
(packages/meerkat-relay/src/push-store.ts) and the Postgres store, rewire
push-gateway.ts loadRegistration off the O(n) page walk, with store tests; (3) surface the
state-import shape-filtered record exclusion counts (state-import/importers.ts `continue` paths) in
the import summary (small observability item from rev-meerkat); (4) verify the push HTTP surface
and provider adapters have hermetic fake-provider tests; (5) merge the branch to main with gates
green and update the plan's Status Delta. You resolve all merge conflicts yourself. Non-fable
agents only.
```

### W5. Meerkat moderation un-hide fix (small-medium)

Source: July 4 comprehensive audit P3, recovered into errors_log during this review; needs re-verification against merged main.

```text
You are the Fable orchestrator for MyLife. Re-verify then fix the Meerkat moderation un-hide
defect: reported content hides only while its cm_safety_actions row is status='active', and the
only resolution path (markSafetyActionReviewed) sets a non-active status which un-hides the
content; there is no review-and-uphold option. Files: apps/meerkat-web/src/lib/community-safety.ts
(~lines 244-281 historically) and the mobile twin apps/meerkat/app/(root)/data/community-safety.ts.
First confirm the defect still exists on main (it may have moved). You design the state model
yourself: split the overloaded status into hide-state vs review-lifecycle, add an uphold action,
byte-twin parity across web and mobile with parity-script coverage, migration for existing rows if
the table schema changes. Non-fable agents implement + review to your spec; you verify the
hide/unhide/uphold matrix against tests you specify. Gates + meerkat parity green, branch
fix/meerkat-moderation-uphold.
```

### W6. Meerkat remaining codeable plans (dispatch one at a time, in this order)

Source: memory.md Known Tech Debt; plans in queue. Each is its own session; same protocol as W4.

1. **Plan 43** managed archive seeding safety (`docs/plans/queue/43-meerkat-managed-archive-seeding-safety.md`)
2. **Plan 41** storage destinations (`docs/plans/queue/41-meerkat-storage-destinations.md`)
3. **Plan 40 residuals**: Share Inbox DM routing, exported placeholder removal or implementation, stale-truth reconciliation (`docs/plans/queue/40-meerkat-final-launch-plan.md`)
4. **Plan 25** calls and rooms (`docs/plans/queue/25-meerkat-calls-and-rooms.md`) - largest

```text
You are the Fable orchestrator for MyLife. Execute Meerkat Plan <N> (<queue path>). Read the plan,
its Status Delta, and re-verify every "current state" claim against merged main before writing your
own execution scopes (the 2026-07-11 integration merge and the Plan 42/44 branches changed relay,
sync, and app internals; re-grep all cited line numbers). You author work packets; non-fable agents
(codex/sonnet implement, opus review) execute them; you adversarially verify each packet, with
transport-honesty invariants test-enforced (DEFAULT_RELAY_URL stays '', no fabricated status, no
simulated capability). Byte-twin web/mobile parity plus guards in the same commit. Gates green per
packet; branch feature/meerkat-plan<N>; plan Status Delta + ledgers + Open Brain updated.
```

### W7. DoWork hub calculator parity follow-up (small)

Source: rev-dowork P2. The standalone app retired `calculator.tsx` (Toolbox points to Plate Loader / One-RM); the hub still ships `apps/mobile/app/(workouts)/calculator.tsx` registered as a Stack.Screen with no runtime path to it (pre-existing on main).

```text
You are the Fable orchestrator for MyLife. Close the DoWork/hub calculator parity gap: the
standalone retired apps/dowork calculator.tsx (see commit f8ade694 and the parity manifest) while
the hub still registers apps/mobile/app/(workouts)/calculator.tsx as an orphan screen. Decide the
product direction yourself per the parity rule (standalone is canonical): retire the hub screen the
same way (remove screen + registration, repoint any hub Toolbox equivalents, update the workouts
parity manifest/scripts). One non-fable agent implements to your spec; you verify with
pnpm check:workouts-parity, check:module-parity, and the mobile typecheck. Small, single-commit
scope on branch fix/workouts-hub-calculator-parity.
```

### W8. Repo hygiene sprint (small-medium, batchable)

Source: this session's observations + ledger rules.

```text
You are the Fable orchestrator for MyLife. Run a repo hygiene pass; you decide each disposition and
non-fable agents do the mechanical work. Items: (1) errors_log.md is past the ~150-row archive
threshold (347 rows): archive old Resolved rows and stale auto-stubs to
docs/archives/errors-log-archive-2026-07-11.md per the CLAUDE.md Error Log rules (NEVER archive an
Unresolved manual row); (2) the Stop-hook memory breadcrumb spams duplicate stub rows (150+
collapsed twice this week): improve .claude/hooks (the Stop hook script) to skip appending when the
last stub row has the same commit hash, and test it; (3) stale worktrees for merged branches
(.claude/worktrees/{bestchef-production-readiness-2026-07-09, dowork-trainer-launch, track-c-consumer,
track-d2, main-merge if idle} and the tmp yearn worktree): verify each is clean AND its branch tip
is merged into origin/main, then git worktree remove them; ask the founder before deleting any
branch refs; (4) investigate the "@types/react out of sync with Expo expectations" debt row and the
mobile vitest memory-heavy route exclusions: produce a short findings note with a fix or an honest
wontfix rationale into the debt row. Update ledgers; branch chore/repo-hygiene-2026-07-11.
```

Status 2026-07-11: EXECUTED on `chore/repo-hygiene-2026-07-11`. Items 1-4 done (188 rows archived, hook dedup + 8 tests, 6 worktrees removed, findings in debt rows). Founder decisions open: delete merged branch refs, merge the chore branch, approve the react-native `~0.81.5` peer-pin follow-up. [log](../../sessions/2026-07-11-repo-hygiene-w8.md)

## B. Blocked on founder (no agent prompts; operator checklists exist)

| App | Blockers | Where the checklist lives |
|---|---|---|
| BestChef | F1 staging migrations 20260711000001..11, F2 legal hosting + operator identity, F3 classifier/child-safety vendors + NCMEC registration, F4-F6, APNs/Sentry provisioning, store ops | docs/plans/active/45-remediation-progress.md + status report 2026-07-11 |
| DoWork | Icon (LG-1), ASC id (LG-3), RevenueCat products, legal hosting, live Supabase deploy, TestFlight | apps/dowork/Tickets/launch-plan.md, plan 46 (done/) |
| Meerkat | Evidence ladder: signed pipeline run, provider backups + weekly restore smoke, staging/canary/rollback drills, 48h soak, 10x load; relay/node deploys; store ops | docs/sessions/2026-07-11-meerkat-plan44-phase7-complete.md + founder-ops runbook |
| Yearn | Legal pages deployed to yearn.app (apps/yearn/legal/README.md), store submission prerequisites | plan 47 + audit report |
| MyNews | Database/functions deploy, vendors, legal review, live moderation ops | plan 48 |

## C. Dispatch etiquette

- One orchestrator session per item; do not run two items that touch the same app concurrently.
- W4 must wait for the active Plan 42 session to go idle. W1 before or inside W2. W8 is safe anytime.
- Every session re-verifies its plan's claims against current `main` before building (plans age fast here).

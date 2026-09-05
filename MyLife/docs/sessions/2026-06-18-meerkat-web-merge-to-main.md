# Meerkat web client merged to main (rich UI + feed reconciliation) + CI triage

Date: 2026-06-18
Branch work: `feature/meerkat-web-client` -> `main` (PR #16, squash `0822062d`)

## What landed on main

PR #16 squash-merged. The single merge carried:
- The rich "Open Burrow" web client (Phase 1C: shell, communities, chat, files, settings).
- Friendly-identity feature (plan #16): vanity friend code + auto random suffix, friendly name
  as the hero with the fingerprint demoted to a "safety code", and an `IdentityInfoModal`
  explainer on web + mobile. (`@mylife/sync` friend-code primitive + web/mobile UI.)
- The sql.js `1.13.0` boot-crash fix (the 1.14 `browser` export had no `default`).
- Reconciliation with main's community feed (PR #17) and relay deploy onboarding (PR #18).
- The Meerkat tester guide (`docs/reports/meerkat-tester-guide.html`) and the easy-path
  design spec (`docs/superpowers/specs/2026-06-17-meerkat-easy-path-design.md`).

## The reconciliation (why it was not a plain merge)

`feature/meerkat-web-client` diverged before the community feed (#17), so the branch had the
rich UI with no feed, while main had the minimal UI + feed. Merging produced 7 conflicts:
2 trivial docs (`memory.md`, `errors_log.md` -> took main's current + grafted this branch's
rows), 1 test helper, and 4 semantic ones in the hot files (`App.tsx`, `MeerkatProvider.tsx`,
`meerkat-data.ts`, mobile `SyncProvider.tsx`).

Resolution rule: **rich UI structure wins, all of main's feed code is preserved (union),
nothing deleted.** `App.tsx` took the rich (thin AppShell) version; the 4 code files were
union-merged via a parallel resolver workflow (one agent per file), grafting main's feed
functions/methods (`refreshCommunityFeed`, `getAutoUpdate`/`setAutoUpdate`/`getLastPulledAt`,
snapshot/cursor machinery, P0-P6 join-request parking) alongside the friendly-identity API.
The community feed's `@mylife/sync` files came in clean (add-only). Then the feed pull was
wired into the rich `ChannelView` (pull-on-open, fail-safe, + a 60s auto-update poll), so
#17's feed is reachable in the rich UI, not dead code.

Verified before merge (local, on the merged tree): typecheck web/mobile/sync clean; tests
green (web 54, sync 1165, mobile 150); web build OK; `check:parity` OK; `--frozen-lockfile`
install OK. Confirmed on main HEAD after squash: `sql.js 1.13.0`, `IdentityInfoModal` and
`AppShell` present, feed wired, meerkat-web typechecks clean (recurring editor "missing
export" diagnostics were stale TS-server cache; `tsc` is authoritative and passes).

## P7 and network branches

- **P7 (owner-side invite->join key handoff):** found to be **already on main** (it came in
  via #17). A cherry-pick of `78d4c7b4` was a near no-op (its changes are a strict subset of
  what main has; `commitMemberAdd`/`applyJoinGrant`/`processJoinRequest` are exported and the
  provider wiring is present). No PR needed. The only thing not on main is its 577-line
  `join-handoff-e2e.test.ts` (optional follow-up coverage).
- **network:** content already on main via #13; left untouched (full-merge would be redundant
  squash-divergence).

## Pre-existing main CI red (triaged, NOT caused by this work)

The prior main commit already failed the same jobs. Root causes (fixes identified, not applied):
- `typecheck`: `@mylife/realtime` tsconfig lacks DOM/`@types/node` (timer globals); masked
  locally by root hoisting, exposed by CI frozen isolated install.
- `test`: `@mylife/module-registry` `dashboard.ts` uses `console` without DOM/`@types/node`.
- `coverage`: `apps/mobile` is on `vitest ^4.1.8` while the repo + `@vitest/coverage-v8` are
  `^3.2.6`; the v3 coverage provider crashes against vitest 4 internals.
- `audit`: real `osv-scanner` advisories (turbo, shell-quote, axios, next, form-data, ws...) +
  a mislabeled osv-scanner action pin (comment says v2.2.3, pulls v1.9.0).
- `parity`: failed at the CI `pnpm/action-setup` step (infra flake); `check:parity` passes locally.

## Cleanup

Deleted the redundant `fix/meerkat-web-sqljs-pin` (its fix rode in via #16) and the throwaway
`feature/meerkat-community-feed-p7` branch.

## Remaining / next

- Optional: fix the pre-existing monorepo CI red (the four concrete fixes above).
- Easy-path build (Phase 1+) per the spec: wire web feed PUSH + the join-bundle one-link join.
- Founder ops: deploy the hosted zero-knowledge relay + community node so the easy path is live.
- The old non-Meerkat PRs (#11 bestchef, #10 gstack, #9 budget) remain open and out of scope.

# Meerkat full review with Fable 5.1, 2026-09-01

## What

Founder asked for a full review of Meerkat (history, code, goals, quality, security) using Fable 5.1, then to begin fixes. A seven-agent parallel fleet (goals, sync crypto, relay, mobile, web, process, sync data) was dispatched and every agent died at spawn on the account session limit (resets 11:50pm America/New_York). The review continued inline: gate baseline, invariant re-verification, targeted adversarial reads, a relay proof-of-concept, and structural measurements. Report: `docs/reports/REPORT-meerkat-fable-review-2026-09-01.md` (+ HTML twin). Fleet re-dispatch kit: `apps/meerkat/docs/prompts/REVIEW-FLEET-2026-09-01.md`.

## Findings (see report for evidence)

R1 HIGH challenge spray leaves files forever and eventually fails the whole private-state authority closed (PoC). R2 HIGH join-queue file growth to ~1 GiB with full re-parse per op. R3 MED derivable-token ack deletes others' handshakes (design-accepted, follow-up). R4 MED no process rejection guards in 15 service bins. A1 MED unhandled engine.initialize rejection on mobile (the web instance was refuted: the adapter never rejects). P1 MED ~40 shared cores drift between twins with no lock. P2 MED four god files over 2,400 lines. P3 LOW 52 stale auto-logged error stubs. P4 LOW AGENTS.md tab-bar sentence stale. S1 LOW barrel export split undocumented.

## Fixes (branch `fix/meerkat-fable-review-2026-09-01`)

- `packages/meerkat-relay/src/community-node-http.ts`: `safeCommunityId` (96-char bound) on all community routes; challenge route through `admitPublicRequest`.
- `packages/meerkat-relay/src/community-private-state-store-file.ts`: `isEmptyState` + unlink in `withCommunity`.
- `packages/meerkat-relay/src/community-join-queue.ts`: `maxBytesPerCommunity`, `byteCount` on both stores, throttled `maybeSweep`, exact `list`.
- `packages/meerkat-relay/bin/*.mjs` (15 service bins): `unhandledRejection` / `uncaughtException` guards.
- `apps/meerkat/app/(root)/providers/SyncProvider.tsx` + `sync.tsx`: `initError`.
- `apps/meerkat-web/src/lib/MeerkatProvider.tsx`: unconditional refresh after mailbox apply (defensive).
- `apps/meerkat/AGENTS.md`: tab-bar sentence. `errors_log.md`: 52 stubs closed, 4 rows added.
- Tests: `community-node-challenge-spray.test.ts` (new), two cases in `community-join-queue-e2e.test.ts`.

## Verification

All run on the fix branch after the changes:

| Gate | Result |
|---|---|
| typecheck relay / app / web | clean |
| lint relay / app | clean |
| relay tests | 211 files passed, 35 skipped; 1,626 passed (4 new), 189 skipped |
| app tests | 165 files, 1,815 passed |
| web tests | 151 files, 1,230 passed |
| `check-meerkat-parity`, `check:esm-require`, `gate:function:changed` | passed |
| R1 PoC re-run | 2 files at the unclaimed cap, 0 after sweep (was 6 and 6) |

## Concurrency note

A second session committed `02227fc8` (launch evaluation, plan 59) onto this checkout while this branch was checked out, sweeping this session's untracked report files into its commit. The fix work here was committed separately as soon as gates passed. Stray hook artifacts `apps/meerkat/errors_log.md` and `apps/meerkat/.claude/memory/` were created by hooks this session (deletion was denied) and are left untracked.

## Remaining

R3 signed ack; P1 shared-core package extraction; P2 domain split of the four god files; S1 barrel intersection lock; `pnpm audit` per package (timed out tonight); re-run the seven-agent fleet after the limit resets.

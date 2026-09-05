# Meerkat Launch Orchestration (Master)

> SUPERSEDED 2026-07-04: the build order and plan inventory below are stale (Plans 21,
> 28, 30, 31, 32 landed; 19 FF3 closed; 27 P0-P2 built). Current sequencing lives in
> `docs/plans/done/37-meerkat-launch-completion-mission-control.md`. The launch
> definition and execution rules below still stand; read Plan 37 for what to build.

Last updated: 2026-07-01. This is the single entry point for orchestrating the remaining
Meerkat launch work WITHOUT the Fable model. Every plan below was audited against the
code on 2026-07-01 and carries a "Status Delta (2026-07-01, read first)" section; agents
MUST read a plan's Status Delta before executing anything in it, because several plans
were partially landed by other plans ahead of schedule.

## Launch definition (founder-locked)

$4.99 one-time app. Free anonymous viewing of public content. Freemium server space.
EVERYTHING gates the single launch (founder decision 2026-07-01): DMs, calls/rooms,
open public posting, humanity verification, proximity communities, real member removal,
seamless auto-connect, billing, launch readiness. No deferrals, no MVP slices
(MyLife CLAUDE.md Scope And Completeness rule).

## Plan inventory (all in docs/plans/queue/)

| Plan | Name | Status 2026-07-01 | Remaining |
|------|------|-------------------|-----------|
| 18 | Theme system | DONE (in done/) | none |
| 19 | Public social layer + archive | Code-complete P0-P9 + FF1-6 | FF3 owner-side auto-approve (5-item spec in its Status Delta) |
| 20 | Connectivity + self-hosting | CODE-COMPLETE Ph 0-12 | founder-ops only; optional web QR scan |
| 21 | Full direct messages | P0-P1 shipped | Phases 2-10 (see API-shape corrections in Status Delta) |
| 22 | Monetization + billing + storage | Stage-0 slice landed early | Phases 0, 2-5, rest of 6 (re-derive BY FEATURE per Status Delta) |
| 23 | Launch readiness | Nothing built | All workstreams A-E + new D.7; D.6 pulled EARLY (see below) |
| 24 | Humanity verification | NEW plan, not started | all |
| 25 | Calls + rooms | Not started | all (grounding corrected in Status Delta) |
| 26 | Open public participation | NEW plan, not started | all |
| 27 | Community transport policies + proximity | NEW plan, not started | all |
| 28 | Real member removal + epoch rotation | NEW plan, not started | all |
| 29 | Seamless auto-connect | NEW plan, not started | all |
| 30 | Chat experience rebuild (kit + reactions + live feel) | NEW plan (2026-07-01 UX set), not started | all |
| 31 | Navigation IA + frictionless join (5 tabs, tap-to-join) | NEW plan (2026-07-01 UX set), not started | all |
| 32 | Content-first feed + media identity (cards, avatars, link previews) | NEW plan (2026-07-01 UX set), not started | all |

Plans 30-32 are the consumer UX-parity set sourced from the 2026-07-01 benchmark evaluation,
whose findings are incorporated into those completed plans. The generated benchmark artifact
was removed on 2026-07-09. Founder decisions locked 2026-07-01: 5 tabs (Friends merges into
Messages), segmented Chat | Posts channel views, Reddit/X content-card feed, reactions =
quick set of 6 + full picker over the existing v2 `intent: 'react'` events.

Founder-ops (deploys, stores, signing, device QA): `docs/guides/meerkat-founder-ops-runbook.md`.

## Reconciliation Status (2026-07-07)

This orchestration doc is historical for build ordering. The active Meerkat queue is
now Plan 25 plus Plan 40. Plans 21 and 23 are closed in `docs/plans/done/`; their
remaining launch items moved to `docs/plans/queue/40-meerkat-final-launch-plan.md`.

## Build order (dependency-driven tracks; tracks run in parallel)

```
FIRST, alone (conflict window):  Plan 23 D.6 Noise upgrade
    (touches sync-session.ts before Plan 21 Phase 2 does; lowest-friction moment is now)

Track A (engine/moderation):     19-FF3 close-out -> 28 -> 27
Track B (messaging):             21 Phases 2-10 (after D.6)
Track C (anti-bot + public):     24 -> 26 (26 also needs 19-FF3 + 28 from Track A)
Track D (polish, anytime):       23 workstreams A (recovery restore), B1/B2 (assets,
                                 delete-my-data), D1-D5, D7, E (parallel-safe by design)
Track E (consumer UX, 2026-07-01): 30 -> 31 -> 32
    (32 Phase 0 may start once 30 Phase 0 lands; 31 is file-disjoint from 30 and may
    overlap it; both precede 32's UI phases)
Then:                            29 (needs 27 P0 seam)  ||  22 (needs 21 surfaces)
Then:                            25 (needs 21 Phase 5 DM thread + 20 WebRTC layer)
LAST:                            23 Phase 4 + B.3 (device QA, store submission, listing
                                 copy covering ALL features) - the final gate
```

Cross-plan shared primitive: `descriptor-gossip.ts` is specified identically in Plans 27
and 28; whichever executes first builds it, the other consumes it.

Track E coordination rules (binding):
- Plan 21 Phase 5 (DM thread UI) MUST consume Plan 30's chat kit (`components/chat/`)
  and Plan 31's Messages shell; sequence 30 Phases 0-2 and 31 Phase 0 BEFORE 21 Phase 5.
  If 21 reaches Phase 5 first, it builds standalone and 31 Phase 0 becomes a merge task.
- Plan 30's focused drain loop and Plan 29's `autoConnectRound()` wrap the SAME
  `runForegroundDrain`; whichever lands second adopts the other's seam (30 T3.3).
- Plan 23 D.4 (mobile Feed states) is satisfied by Plan 32 Phase 1 if 32 lands first;
  record the supersession in 23's Status Delta either way.
- Plan 23 D.1/D.2 and Plan 31 Phase 2 both touch the communities admin JSX: land
  D.1/D.2 first, or Plan 31 relocates current JSX and 23's Status Delta redirects
  D.1/D.2 to `community/[communityId]/settings.tsx` in the same session. Never edit
  `communities.tsx` admin JSX from both plans concurrently.
- Plan 32 needs a `pnpm install` (expo-image-picker, expo-image-manipulator): founder-ops.
- Push enablement stays founder-ops (runbook); no Track E plan claims it.

## Execution rules for the orchestrator (non-Fable)

1. Read the target plan's Status Delta, then its grounding table. Line numbers may have
   drifted; re-grep symbols rather than trusting cited lines.
2. Honesty invariants are non-negotiable and test-enforced: `DEFAULT_RELAY_URL` stays
   `''` until founder-ops flips it; staged != sent; no simulated backend shown live; no
   fabricated status/peer counts/receipts; `cm_publications` sole `published_blob`;
   omitted cm_ tables fail closed to `device_local`.
3. Gates per change: `pnpm gate:function:changed`, `pnpm typecheck` (sync/relay/
   mobile/web as touched), `node scripts/check-meerkat-parity.mjs`, `/review`. CI is
   down (GitHub billing); local green is the trust gate, matching the prior six waves.
4. Twin discipline: every mobile data-layer file with a web twin stays byte-parity where
   the parity script locks it; UI copy strings that the parity script locks must be
   updated on both surfaces plus the guard in the SAME commit.
5. Conventional Commits on `feature/` branches off main; never commit to main directly;
   push only when the founder asks.
6. Update `memory.md` + `errors_log.md` per repo rules; capture milestones to Open Brain
   with context "personal, mylife".
7. No em dashes in any authored doc or copy.
8. When a plan's DoD includes founder-ops, finish the codeable scope, verify local-green,
   leave the plan in queue/ with its delta updated, and list the ops handoff explicitly
   (pattern set by the 2026-07-01 session log).

## What launch looks like when every track lands

A person installs Meerkat, verifies they are human once (silently on a real device),
and can: chat 1:1 and in groups with Signal-grade encryption and honest receipts; call
and screen-share; create a community in two taps or a proximity community that only
updates in person; publish it read-only, approval-gated, or open-posting; browse a free
public feed anonymously; sync all their own devices automatically; host everything on
Meerkat's servers for a fair freemium price or one-tap self-host from their own
computer. Nothing in the UI claims a byte moved that did not move.

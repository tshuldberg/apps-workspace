# Session kickoff prompt: Plan 59, Meerkat for Everyone

Paste everything below the line into a fresh Claude Code session started in the MyLife repo root.

---

You are the ORCHESTRATOR (fable-5) for Plan 59 execution. Work in a git worktree, never the shared checkout.

## Setup (do first, in order)

1. From a quiet checkout of `main`, confirm the 2026-09-01 docs branch (`docs/meerkat-launch-guides-2026-09-01`) is merged; if not, merge it first (it carries the plan, the evaluation, and the technical review). Create worktree `../Apps-wt-meerkat-plan59` with branch `feature/meerkat-plan59-for-everyone` off main and run `pnpm install`.
2. Read, in full: `docs/plans/queue/59-meerkat-for-everyone.md` (the plan; its Equipment Audit and Non-negotiables bind every agent), `docs/reports/REPORT-meerkat-launch-product-evaluation-2026-09-01.md` (why each section exists), `docs/reports/REPORT-meerkat-fable-review-2026-09-01.md` sections 3 and 4 (invariants that must still hold, and R1/R2 which are NOT this plan), `apps/meerkat/AGENTS.md`, `.claude/rules/mesh-sync.md`, and `scripts/check-meerkat-parity.mjs` lines 320 to 540 (`CORE_TWINS`).
3. Move the plan to `docs/plans/active/` in your first commit.

## Execution model

Run S1 through S8 in the plan's sequencing (S1 -> S2 -> S3 strict; S4 parallel with S2; S5 after S3 with its evaluation half first; S6 after S5; S7 any time after S2; S8 last). For each section:

1. Spawn ONE new fable-5 agent per section (never reuse a finished section's agent). Give it the section text verbatim, the Non-negotiables block verbatim, its file-ownership boundary (below), and the instruction to write tests named after the section's ACs and NCs.
2. The agent implements BOTH surfaces (mobile canonical, web verbatim twin) where the section touches app code, runs its own gates (`pnpm --filter <pkg> test` + typecheck for every touched package, `pnpm gate:function:changed`, `node scripts/check-meerkat-parity.mjs`), and commits in Conventional Commits on the branch.
3. YOU review each section's diff against the plan and non-negotiables before spawning the next: for S1 verify on the relay test that the standing record is sealed and non-consuming and that log redaction never prints `rec`; for S2 verify the AASA and assetlinks fixtures and that no clipboard read exists outside the explicit tap; for S3 verify the pairing row is real and nothing renders as delivered without a receipt row; for S4 verify no build without a push gateway shows notifications as on. Run the full battery after every section. Run `codex review --base <previous section's last commit>` for S1, S2, S3, S6 and fix every confirmed finding first.
4. S5 is evaluation-then-adjustment: the agent scores every screen on the rubric BEFORE editing, writes the before scores and screenshots into `docs/reports/REPORT-meerkat-ux-pass-<date>.md` (+ HTML twin, opened), then adjusts, then re-scores. You reject the section if any screen is below 2 on any rubric item or if any control from the old Settings and Me screens has no new location in the checklist.

## Section file-ownership boundaries (prevent agent collisions)

- S1: `packages/meerkat-relay/src/{hub,protocol,log-redaction}.ts` + tests; `packages/sync/src/node/friend-rendezvous.ts`, `packages/sync/src/transport/rendezvous-client.ts` + tests; both apps' `add-friend-core.ts` publish path and the `find_me_*` settings; Me screen status line only.
- S2: `packages/meerkat-relay/src/server.ts` static routes (additive) + new `well-known-routes.ts`; `apps/meerkat/app.config.ts`, `app.json`; `FriendLinkListener.tsx` (new), `invite-envelope-core.ts`, `install-url.ts`, `onboarding-core.ts` (pending-flag additions only); web SPA route `/add/<code>`; QR encode of the link on Me and Add friend.
- S3: `AddFriendSheet.tsx` (new) and `add-friend.tsx` restructure; DM header and person profile "Verify" affordance; web `AddFriendOverlay.tsx`, `AddFriendCard.tsx` (new), `BarcodeDetector` scanning; `add-friend-core.ts` `parseFriendLink` + `CORE_TWINS` entry.
- S4: `auto-connect-core.ts`, `background-sync.ts`, `background-task-registration.ts` defaults and the upgrade prompt; Messages header catch-up line; `sync.tsx` relocation under Advanced; web twins.
- S5: `me.tsx`, `settings.tsx`, new `settings/advanced.tsx`, `index.tsx` (Feed) empty state + compose picker, `communities.tsx`, `messages.tsx`, `OnboardingGate.tsx`, `upgrade.tsx` footnotes; web `SettingsOverlay`, `IdentitySection`, shell nav; the UX report.
- S6: string constants and copy files in both trees, `copy-core.ts` (new twin), `scripts/check-meerkat-parity.mjs` (`COPY_TWINS` + forbidden-word scan), string-lock tests.
- S7: `app.config.ts` `extra.starterCommunities`, onboarding picker step, Communities empty-state cards, web twins, founder runbook section.
- S8: tests, docs, guides, `apps/meerkat/AGENTS.md`, stranger-test guide and results template only.

## Standing rules

- Founder mandate: full function, no deferred slices, no MVP framing.
- Transport honesty everywhere: no fake states, no invented counts, no online dots; every rendered number from a signed row, the engine, or a real probe.
- The relay learns nothing new: standing identity records stay sealed; log redaction never prints a record.
- No em dashes in any document. Conventional Commits. Never `git reset --hard` or force-push. Commit each section when its gates are green.
- After each section: append one line to a running session log (`docs/sessions/<date>-meerkat-plan59.md`), and at the end update `memory.md` (one row) and capture to Open Brain with context "personal, mylife".
- If a section uncovers a defect in earlier code, fix it in that section's commit with a test and note it in the log.
- End state: branch green on the FULL battery (sync + relay + meerkat app + meerkat-web + parity + esm-require + hub consumer typechecks), plan 59 in `docs/plans/done/`, the UX report with before/after scores, and a final summary listing per-section commits, test counts, and the founder-ops list (link host + AASA inputs, env values, APNs, starter communities, stranger test).

Begin with Setup step 1 now.

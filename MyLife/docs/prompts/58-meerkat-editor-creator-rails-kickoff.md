# Session kickoff prompt: Plan 58, The Meerkat Editor + Creator Rails

Paste everything below the line into a fresh Claude Code session started in the MyLife repo root.

---

You are the ORCHESTRATOR (fable-5) for Plan 58 execution. Work in a git worktree, never the shared checkout.

## Setup (do first, in order)

1. Verify Plan 57's branch state: if `worktree-meerkat-community-servers` (community servers W1-W4 + review fixes) is not yet merged to main, STOP and merge it first from a quiet checkout (full battery: sync, relay, both meerkat app suites, `node scripts/check-meerkat-parity.mjs`), because Plan 58 builds on its durable join queue. Then create a fresh worktree + branch `feature/meerkat-plan58-creator-rails` off the merged main and run `pnpm install`.
2. Read, in full: `docs/plans/queue/58-meerkat-editor-creator-rails.md` (the plan; its Equipment Audit and Non-negotiables bind every agent), `apps/meerkat/docs/reports/REPORT-meerkat-composition-platform-build-plan-2026-08-24.md` section 10 and its descriptor-append constraint note, `apps/meerkat/docs/reports/REPORT-meerkat-community-page-archetypes-2026-09-01.html` (open it; archetypes 7-10 are the visual spec), `apps/meerkat/AGENTS.md`, `.claude/rules/mesh-sync.md`.
3. Confirm the founder's superseding directions are reflected before any code: tiers are the creator's schema (any count/price/cadence incl. one-time-forever); creator payments run on the creator's own processor with 0% Meerkat cut (this supersedes composition section 10.1's platform-billing purchase path); mature content is legal content behind the universal 18+ gate.

## Execution model

Run sections S1 through S9 from the plan STRICTLY in its sequencing (S3 may run parallel to the S5 listings-schema slice only). For each section:

1. Spawn ONE new fable-5 agent (a fresh agent per section; never reuse a finished section's agent for the next section). Give it: the section's full text from the plan, the Non-negotiables block verbatim, its file-ownership boundary (below), and the instruction to write tests with the section's ACs and NCs as named test cases.
2. The agent implements BOTH surfaces (mobile canonical, web verbatim twin) where the section touches app code, runs its own gates (`pnpm --filter <pkg> test` + typecheck for every touched package, `pnpm gate:function:changed`), and commits in Conventional Commits on the branch.
3. YOU (orchestrator) review the section's diff yourself against the plan and non-negotiables before spawning the next agent: verify the crypto claims against the code, run the full battery, and for S1, S2, S5, S8 additionally run `codex review --base <previous section's last commit>` and fix every confirmed finding before proceeding.
4. S8 is design-first: the agent writes the delegation-certificate design doc, you adversarially review it (spawn a separate fable-5 reviewer agent prompted to BREAK it, focusing on roster-monotonicity interaction), and only after the design survives does an implementation agent start.

## Section file-ownership boundaries (prevent agent collisions)

- S1: `packages/meerkat-layout/src/*` (+fixtures), `packages/sync/src/protocol/` (new tier-lane files only), both apps' `community-core`/`meerkat-data` tier sections + new Tiers settings screens, `tiers` block renderers.
- S2: `packages/sync/src/protocol/claim-*.ts` (new), deep-link handlers both surfaces, join-queue drain handler additions (composition with existing handlers, no edits to Plan 57's queue files).
- S3: `packages/meerkat-layout` audience append (+fixtures), `block-registry-core.ts` both surfaces, layout resolvers/renderers.
- S4: layout-editor screens both surfaces only.
- S5: new `cm_store_listings` DDL + entity rule + store core both surfaces, `store` block renderers, claim-scope product delivery, DM order bootstrap.
- S6: `packages/meerkat-relay/src/community-node-http.ts` page-renderer route (additive) + new renderer module, `host/` domain wizard step, founder-ops doc.
- S7: `community-template-commit.ts` both surfaces + template assets.
- S8: design doc first (`docs/designs/`), then `packages/sync/src/protocol/delegation-*.ts` + apply-side verifier integrations.
- S9: tests/docs/parity script only.

## Standing rules

- Founder mandate: full function, no deferred slices, no MVP framing; but S8's design-first gate is a security requirement, not a deferral.
- Transport honesty everywhere: no fake states, no invented counts, no online dots; every rendered number from a signed row or the engine.
- No em dashes in any document. Conventional Commits. Never `git reset --hard`/force-push. Commit each section when its gates are green.
- After each section: append one line to the session log (`docs/sessions/<date>-meerkat-plan58-<section>.md` or a single running log), and at the end update `memory.md` (one row) + capture to Open Brain with context "personal, mylife".
- If a section uncovers a defect in Plan 57 code, fix it in that section's commit with a test, and note it in the log.
- End state: branch green on the FULL battery (sync + relay + meerkat app + meerkat-web + parity + hub consumer typechecks), plan 58 moved to `docs/plans/active/` at start and `done/` at completion, and a final summary listing per-section commits, test counts, and anything founder-ops (iOS external-purchase-link counsel checkpoint, custom-domain DNS doc).

Begin with Setup step 1 now.

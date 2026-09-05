# Plan 39 Execution Handoff (2026-07-07)

Orchestration handoff for Meerkat Plan 39 (Public Base Feed + Verified Public Social). Read this with `docs/plans/queue/39-meerkat-public-base-feed.md` (the plan) and `docs/reports/REPORT-meerkat-public-feed-plan-2026-07-06.html` (design spec: 14 mobile + 2 web mockups).

## Branch state

Working branch: `feature/meerkat-public-base-feed` (off `feature/meerkat-launch-completion`, NOT off main; never pushed; do not push without founder ask).

Commit map (oldest first):

| Commit | Phase | Content |
|---|---|---|
| 90481f4f | P0 | NC-2 reversal ratified in plans 19/26, copy inventory (71 strings) at docs/designs/meerkat-public-tier-copy-inventory.md |
| 5a1fac96 | P1 | Public persona protocol (packages/sync protocol/public-persona.ts, meerkat-persona-v1, NC-P2 leakage tests) |
| b14e882c | P2 | Alias registry + persona-session service + GDPR delete/export (packages/meerkat-relay persona-registry.ts, persona-session.ts, persona-service-http.ts) |
| f7a24bc6 | P3 | Verify-to-alias onboarding UI both surfaces, 12 parity-locked strings |
| eaa8d3c0 | merge | Track B P4-P7 merged (postPolicy, public-post dual-signature protocol, gated submit route, humanity-route-guard) |
| 667e8b8e | A-B integration | Humanity-gated session issuance (one single-use token per session mint), client x-mk-humanity on issuance, SESSION_VERIFY_URL path fix, bin/meerkat-persona-service.mjs, full-chain e2e plan39-public-write-e2e.test.ts |
| 588e30b7 | P8/P9 backend | The Commons provisioning (one-time offline, operator key custody, FATAL on unloadable provision file) + verify-to-view publicRead gate on manifest/page/piece |
| 593ae916 | P9 app-side | Session-bearer wallet (ensurePersonaSession, 30s expiry margin), verifyToViewState machine, S1/S14 honest copy, parity locks |
| 5944a942 + session-log commits | docs | Session logs + memory rows per wave |

Suite counts at last green: relay 472, mobile app 1030, web 692, sync 1788+, entitlements 77; parity + all typechecks green at every commit.

## In flight right now (two agents)

1. **track-a (main checkout, this repo dir): P10 + P11.** Mobile Public tab / Commons feed / post cards / composer with $4.99 unlock sheet / thread + replies / public profiles + follows (cm_public_follows, device_local scope rule) / topic channels / Discover re-skin / report sheet, per mockups S4-S12; then P11 web parity (mechanical port routed through codex exec, then taste-reviewed) + parity locks for every new string. One reviewed commit per phase. Its working tree is dirty with this work; do not commit unrelated files around it.
2. **track-d2 (worktree `.claude/worktrees/track-d2`, branch `track-d2`): P13 + P14** on top of the P12 operator console (commits 758e04cf/217cc20d) and a reconciliation merge (0910fd11 + codex fold b6b7ecc1) that unified the duplicate persona-service bins and env names. P13 = CSAM hash-scan fail-closed at submit boundary, NCMEC queue (vendor seam), DMCA intake + console lane, GDPR delete e2e including releasing the app-unlock persona binding. P14 = red-team suite (forged persona/receipt, session fixation/replay, humanity double-spend race, entitlement spoof, flood bypass, alias squat/homoglyph, console auth).

If either agent dies, re-dispatch a fresh subagent with the corresponding scope section from the plan plus the constraints block below; all seams are documented in the session logs under docs/sessions/2026-07-06/07-plan39-*.

## Remaining orchestration steps (in order)

1. Wait for track-a's P10 + P11 commits; verify parity lock coverage and mockup fidelity (spot-check against the report HTML).
2. Wait for track-d2's P13 + P14 commits on branch `track-d2`.
3. Merge `track-d2` into `feature/meerkat-public-base-feed`. Expected conflicts: relay barrel (union), community-node-http.ts (P9 publicRead gate vs D2 edits; keep both), bins, memory.md/errors_log.md (union, keep both sides' rows). Check `git merge-base track-d2 feature/meerkat-public-base-feed` first: D2's reconciliation merge may predate P8/P9, in which case the final merge also reconciles the Commons/publicRead code. After resolving, the P12 console suites, plan39-public-write-e2e, plan39-gdpr-delete-e2e, and the red-team suite must ALL pass on the merged tree. If console suspend and P9 read-gating interact, wire the console's isRevoked into the read verifier the same way submit does.
4. Final verify on the merged tree: `pnpm gate:function:changed`, full suites (`pnpm --filter @mylife/sync test`, `--filter @mylife/meerkat-relay test`, `--filter @mylife/entitlements test`, meerkat app + web suites), 4 typechecks, `pnpm check:parity`, `pnpm check:generated-artifacts`.
5. AC sweep: walk AC-1..AC-6 in the plan against tests/e2e evidence; AC-1/AC-2/AC-3/AC-5 have direct e2e coverage already; AC-4 covered by the P12 console e2e; AC-6 is the final gate chain.
6. Hygiene: update memory.md Project State + one Sessions row (keep under 80 lines; archive if needed), reconcile errors_log.md stubs (Track D auto-stubs were resolved in-branch), final session log docs/sessions/2026-07-07-plan39-close.md, Open Brain capture with context "personal, mylife" (incremental captures exist for P0, Track A, Track B+merge, integration, P8/P9, P12).
7. Cleanup: `git worktree remove` for `.claude/worktrees/track-d2` and the two agent worktrees (`agent-ad3e6e23ee76353a2`, `agent-a6eda8f0bdc81e10e`) AFTER their branches are merged; do not delete unmerged branches.
8. Do NOT move Plan 39 to done/: it gates on P15 founder-ops. Add a Status Delta section to the plan noting codeable completion.

## P15 founder-ops accumulated so far (list only, never fake)

- Deploy persona service (`bin/meerkat-persona-service.mjs`, port 8894) beside relay/community node; set SESSION_VERIFY_URL (persona service BASE url) and PERSONA_ADMIN_URL on the node.
- Mint + custody secrets: persona session secret, operator console secret, persona admin secret, MEERKAT_APP_UNLOCK_TOKEN_SECRET (shared hosted-service + node), MEERKAT_OPERATOR_AUTHORITY_SEED (this IS the network kill authority; custody like the humanity key).
- The Commons: run provisioning once offline, custody the operator descriptor key, deploy COMMONS_PROVISION_FILE (runbook: docs/guides/the-commons-provisioning-runbook.md).
- Humanity service: Turnstile keys, App Attest / Play Integrity configs (Plan 24 P15 carryover).
- Operator console: keep ADMIN port loopback/VPN/TLS-edge only.
- Legal: NCMEC vendor onboarding (queue + export exist), DMCA registered-agent registration (copy placeholder must be filled), CSAM scanner hash-DB provisioning.
- Store: UGC/17+ flags, store copy for the verify-to-view change; comms = release notes + in-app notice (pre-authorized default).

## Founder flags (non-blocking, conservative defaults shipped)

1. One persona = one alias (Track A).
2. Purchase binds one persona; GDPR delete releases the binding (Track D2 P13 ships the release); no user-facing rebind flow beyond that.
3. Unlock-proof mint sends the persona PUBLIC key to the billing tier (device key never co-present; NC-P2 held).
4. Approval-mode public posting requires the owner to roster the persona key into the descriptor.
5. Multi-gated-host publishes limited to one host per humanity token.
6. Session issuance spends a humanity token (plan P7 text; resolved, noted for UX tuning).

## Binding constraints (verbatim from the run directive)

- Exactly two prices: $4.99 one-time meerkat_app_unlock (gates ALL public writes incl. replies) + $4.99/mo hosted. Never invent others (NC-P5).
- NC-P1 private mesh never requires account/verification/purchase; NC-P2 device/persona keys never linkable; NC-P3 all three write gates server-side fail-closed; NC-P4 policy honesty, DEFAULT_RELAY_URL stays ''; NC-P6 verifiable ranking signals only.
- Mobile+web parity with string locks for every new user-facing string; full-function mandate (no MVP slices); no em dashes in docs; Conventional Commits; never push without founder ask.

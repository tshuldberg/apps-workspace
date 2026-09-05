# 2026-07-07 — Plan 39 Execution Close (Meerkat Public Base Feed + Verified Public Social)

Plan 39 is codeable-complete and landed on `feature/meerkat-public-base-feed`. All four tracks (P0-P14) shipped; only P15 founder-ops remains (deploys, keys, vendors, store). Not pushed.

## What shipped

Founder direction (2026-07-06): Meerkat services a public feed in the Reddit/X class with a first-party base feed ("The Commons"), a new public persona/alias per user, verify-to-view (account + humanity verification to view), and $4.99 one-time to post. This reverses NC-2 for the public tier only; the private mesh tier is untouched (no account/verification/purchase).

### Track A — Identity + Accounts (P0-P3)
- P0 `90481f4f`: NC-2 reversal ratified in plans 19/26 with founder citation; public-tier copy inventory (71 strings) at `docs/designs/meerkat-public-tier-copy-inventory.md`.
- P1 `5a1fac96`: `packages/sync/src/protocol/public-persona.ts` — fresh Ed25519 persona keypair, never the device key (NC-P2), domain `meerkat-persona-v1`, leakage tests both directions.
- P2 `b14e882c`: persona registry + accounts service (`persona-registry.ts`, `persona-session.ts`, `persona-service-http.ts`) — humanity-gated reserve-then-redeem register, atomic one-alias-per-persona, HMAC session bearers, GDPR delete/export + 30-day cooldown.
- P3 `f7a24bc6`: verify -> alias -> account onboarding UI both surfaces + identity separation + persona settings/GDPR, parity-locked.

### Track B — Participation (P4-P7)
- P4/P5/P6/P7 (merge `eaa8d3c0`): `postPolicy` + `postNodeKeyHex` conditional-append descriptor fields (fail-closed to `view_only`); `protocol/public-post.ts` persona-signed `PublicPostEvent` + node countersign receipt + `verifyPublicPost` dual-signature; `POST /public/{pub}/{channel}/submit` with three server-side gates (session -> humanity single-use -> persona-bound app-unlock proof) -> policy -> caps -> countersign + page merge; humanity route guard on register + session issuance.
- A-B integration `667e8b8e`: humanity-gated session issuance (a session mint spends one single-use token, P7), client `x-mk-humanity` on issuance, `SESSION_VERIFY_URL` bin path fix, deployable `bin/meerkat-persona-service.mjs` (port 8894), full-chain e2e `plan39-public-write-e2e.test.ts` (humanity -> register -> session -> unlock proof -> submit -> dual-verified read; GDPR-revoke + persona_mismatch negatives).
- Key design: one $4.99 purchase binds exactly one persona via sticky single-use link codes, so the device key and persona key never co-appear in a server request (NC-P2/NC-P5).

### Track C — Base Feed + Consumer Surface (P8-P11)
- P8/P9 `588e30b7` + `593ae916`: The Commons provisioning (operator-signed, node-key-pinned open publications per topic channel; one-time offline provisioning, node loads `COMMONS_PROVISION_FILE`, fatal on bad file; runbook `docs/guides/the-commons-provisioning-runbook.md`); verify-to-view `publicRead` gate on first-party read routes (session-only, fail-closed; unconfigured nodes serve open and say so honestly, NC-P4); app-side session-bearer wallet + `verifyToViewState` + S1/S14 honest copy.
- P10/P11 consumer UI, both surfaces, 6 commits: Public tab + Commons reader `dc3fc91a`; composer + $4.99 unlock gate + real 3-gate submit chain + batch humanity wallet `a02d095b` (sent state only off a locally dual-verified acceptance receipt, NC-3); thread + replies `7a5c3d23`; pubkey->alias reverse-resolve batch endpoint + @alias-on-cards with short-id fallback `6fb663bf`; public profile `ac9ce143`; topic channel `ff89d317`; Explore (Discover re-homed) `b4e0ad15`. Follows (`14e094bf`, `cm_public_follows` device_local) and persona-signed report flow (`0a00fbc5`) landed via merge `35850692`. Web parity by construction (native + web each increment) with parity locks for every new string.

### Track D — Trust + Safety (P12-P14)
- P12 `758e04cf`: operator moderation console (report triage, tombstone/suspend/freeze/kill, append-only JSONL audit, bearer-auth admin HTTP loopback-default, honest states); suspend writes the same revocation flag GDPR uses, killing live sessions.
- P13 `f367c8de`: CSAM hash-scan at the submit boundary (fail-closed on scanner outage for public posts, honest scanner state), NCMEC queue + export (vendor seam), DMCA intake route + console lane, GDPR delete end-to-end (alias release + session revoke + post tombstones + server purge + app-unlock persona-binding release, closing the Track B rebind flag).
- P14 `a6a87f3c`: adversarial red-team suite — forged persona/receipt/dual-signature, session fixation/replay, humanity double-spend race, entitlement spoof, flood/rate-cap bypass, alias squat/homoglyph, console auth. All fail closed.

### Landing
- Track D merged into the branch as `aa9d8412` (only memory.md conflicted; code auto-merged — persona-service-http carries both the session-issuance humanity guard and the persona admin routes).

## Verification (merged tree, HEAD `aa9d8412`)
- Suites: sync 1802, meerkat-relay 574, entitlements 77, meerkat-app 1075, meerkat-web 712 — all pass.
- Typechecks: sync, meerkat-relay, entitlements, meerkat-app, meerkat-web — 0 errors.
- `pnpm check:parity` (incl. Meerkat section + Explore checks) exit 0; `pnpm check:generated-artifacts` exit 0.

## Acceptance criteria
- AC-1 (verify gate on public surfaces, 401 on ungated first-party reads): verify-to-view `publicRead` gate + app locked-feed state. Covered.
- AC-2 (view-all/post-nothing -> $4.99 unlock -> post -> dual-verified on a second client): composer gate + `plan39-public-write-e2e` full chain. Covered.
- AC-3 (persona/device separation, server never sees device pubkey): NC-P2 leakage tests + sticky one-persona binding. Covered.
- AC-4 (operator remove/suspend/kill visible within one fetch): P12 console e2e. Covered.
- AC-5 (GDPR delete: alias release + session revoke + tombstones + purge + 30-day block): P13 GDPR e2e. Covered.
- AC-6 (full parity chain + suites + gate green): verified above. Covered.

## Orchestration notes (for future sessions)
- This checkout's tsserver/LSP emits massive FALSE-POSITIVE diagnostics (phantom "cannot find module @mylife/*", "no exported member", Map-iteration on committed-green files). Trust ONLY real `tsc`/gate runs, never inline diagnostics. This caused a mis-stash of a green composer increment mid-session (recovered from `git stash push -u`, re-committed green as `a02d095b`).
- Do not run two agents in one working tree, and do not spawn a replacement for an idle-but-alive agent — both cause file clobbering. Use one worktree per agent, or one sequential owner. This session paid real churn to that lesson.
- codex CLI was unreliable this session (hung 16+ min, reviewed an emptied tree during the mis-stash). Per-increment reviews used rigorous adversarial self-passes; a consolidated adversarial review of the consumer client path was run at close.

## Remaining: P15 founder-ops only (not fake-able in code)
- Deploy `bin/meerkat-persona-service.mjs` (port 8894) beside relay + community node; set `SESSION_VERIFY_URL` (persona service base URL) and `PERSONA_ADMIN_URL` on the node.
- Mint + custody secrets: persona session secret, operator console secret, persona admin secret, `MEERKAT_APP_UNLOCK_TOKEN_SECRET` (shared hosted-service + node), operator authority seed (this IS the network kill authority; custody like the humanity key).
- The Commons: run provisioning once offline, custody the operator descriptor key, deploy `COMMONS_PROVISION_FILE` (runbook in repo).
- Humanity service: Turnstile keys, App Attest / Play Integrity configs.
- Operator console: keep the admin port loopback / VPN / TLS-edge only.
- Legal: NCMEC vendor onboarding (queue + export exist), DMCA registered-agent registration (fill the placeholder), CSAM scanner hash-DB provisioning.
- Store: UGC / 17+ flags and store copy for the verify-to-view change; comms = release notes + in-app notice.

## Founder flags (non-blocking, conservative defaults shipped)
1. One persona = one alias.
2. Purchase binds one persona; GDPR delete releases the binding (shipped in P13). No separate user-facing rebind flow.
3. Unlock-proof mint sends the persona PUBLIC key to the billing tier (device key never co-present; NC-P2 held).
4. Approval-mode public posting requires the owner to roster the persona key into the descriptor.
5. Multi-gated-host publishes limited to one host per humanity token.
6. Session issuance spends a humanity token (plan P7; resolved, noted for UX tuning).

## Post-landing review fixes (2026-07-07)

A consolidated adversarial review (opus subagent) of the consumer submit-client + readers ran at close. Result: 7 of 8 invariants clean (NC-3 dual-verified receipts, NC-P3 three server-side gates, verify-to-view read-gate, NC-P6 no fabricated counts, NC-P2 non-linkage, honest states, non-spoofable @alias). Two real gaps were found and fixed:

1. NC-P5 (`03d81df0`): `VERIFY_TO_VIEW_PRICE_LINE` hardcoded `$4.99` while the composer sourced it from billing-config. Both twins now interpolate the billing-config price (imported directly from `@mylife/billing-config`, not via `app-unlock`, to keep react-native out of the vitest transform graph). Parity lock split to the two static halves.

2. S12 report sheet (`69742ea5`): the persona-signed report client (`public-report.ts`, NC-P2: signs with the persona key, never the device key) existed on mobile only and was not wired into any UI; web had no client twin; the only wired report path was the Plan-19 reader's device-signed `createPublicAbuseReport`. Added the web client twin + test, and wired a persona-signed Report affordance + reason-picker sheet into the public thread (post + reply, non-own only) on both surfaces, with parity locks. This keeps public-tier abuse reports off the device key.

Both were flagged either by the review or by a sibling agent (track-a correctly identified the report web-parity gap). The lesson recorded: verify a peer's concrete claim against live git before dismissing it.

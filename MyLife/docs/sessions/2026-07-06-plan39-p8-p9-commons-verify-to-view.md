# 2026-07-06 — Plan 39 P8/P9: The Commons provisioning + verify-to-view

Branch `feature/meerkat-public-base-feed`. Task 4 (P8 The Commons provisioning; P9 verify-to-view
enforcement). Two commits.

## Commits
- `588e30b7` backend: P9 read gate + P8 provisioning + bin + runbook
- `593ae916` app-side: P9 session wallet + verify-to-view state + honest copy

## P9 — verify-to-view enforcement (relay)
`community-node-http` gains a `publicRead` gate on the OPEN read routes
(manifest/page/piece): a publication the node FLAGS gated requires a valid `x-mk-session`
persona session. Fail-closed: gated + no verifier -> 500, missing session -> 401, verifier throw
-> 503. Non-gated pubs and a node that leaves `publicRead` unset serve OPEN (NC-P4 honesty
boundary). Same `PublicPostSessionVerifier` seam as the submit route. 5 tests.

## P8 — The Commons provisioning (relay)
`commons-provisioning.ts`: `buildCommonsProvisioning` mints one open-post, operator-signed,
node-key-pinned publication per topic channel under the `the-commons` community.
`serialize/parseCommonsProvisioning` persist + fail-closed-load the set (the snapshot seal uses
random AEAD nonces, so provisioning is NOT reproducible from a seed -> the operator provisions
ONCE and the node loads the persisted file). `commonsGatePredicate` feeds the P9 gate. 3 tests.

Bin: the community node loads `COMMONS_PROVISION_FILE`, registers each Commons publication, and
flags them gated. A file that will not load is FATAL (a prior boot may have durably registered
the Commons pubs; booting open would bypass verify-to-view). `parseCommonsProvisioning`
shape-validates the manifest + every base64 piece so a malformed file fails closed instead of
crash-looping. (codex P1/P2, folded.)

Runbook: `docs/guides/the-commons-provisioning-runbook.md` (operator key custody, provision-once,
boot, honesty boundary).

## P9 — app-side (both surfaces)
- persona-core session-bearer wallet: `getStoredSession` / `ensurePersonaSession` caches the
  short-lived bearer, acquiring (spending a humanity token) only when missing or within 30s of
  expiry; `readSessionHeaders` attaches `x-mk-session` with the same 30s margin. The cached
  session is cleared when the persona is deleted/wiped.
- `verify-to-view.ts`: the honest state (`not_configured` / `locked` / `needs_session` /
  `verified`) -- `verified` requires a persona AND a valid session, so the surface never treats
  the feed as open without a real session (codex). Verbatim locked-feed copy (S1) + self-hosted
  boundary notice (S14, NC-P4). Parity-locked.

The locked-feed SCREEN that renders these is P10's Public tab (a separate task). This delivers
the honest state + copy + session-attach helpers P10 consumes.

## Codex (3 rounds, all mine folded; the DoWork HTML-twin flag is another agent's file)
- Backend: fatal-boot on rejected Commons (no open serving of persisted pubs); shape-validate
  provision rows (no crash loop).
- App-side: `verified` requires a session (no unauthenticated reads); `readSessionHeaders` uses
  the 30s margin.

## Verification
relay 472, mobile app 1030, web 692 -- all pass. `pnpm check:parity` green (new verify-to-view
section). Persona/Commons OFF by default (no `COMMONS_PROVISION_FILE`, no persona service) so the
public feed is honestly off until founder-ops provisions + deploys (P15).

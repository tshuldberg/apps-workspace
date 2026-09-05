# 2026-07-06 - Meerkat Plan 39 Track B (P4-P7): Participation Layer

Worktree agent session on branch `worktree-agent-ad3e6e23ee76353a2` (base `feature/meerkat-public-base-feed` @ `90481f4f`). Track A (persona protocol, alias registry, persona-session, onboarding UI) runs in parallel in the main checkout; this track built ONLY P4-P7.

## Commits

| Commit | Phase | Subject |
|--------|-------|---------|
| `45980862` | P4 | postPolicy + pinned node receipt key on PublicationDescriptor (tagged conditional-append, fail-closed effectivePostPolicy) |
| `c632964f` | P5 | public post protocol: persona-signed PublicPostEvent, node acceptance receipts, dual-signature verify, tombstones, posting freeze |
| `eda01fa8` | P6 | gated submit route (session + humanity + app-unlock stacked gates), countersign + page merge, persona-bound unlock proofs, durable stores, bins |
| `eafc1b1c` | P7 | humanity-route-guard for session issuance (Track A consumes), client x-mk-humanity at register, postPolicy persistence in cm_publications |

## Key decisions

- postPolicy widened to string at rest: unrecognized values verify but degrade to view_only (forward compatible, fail-closed), non-strings invalidate the descriptor.
- Node receipt key pinned in the descriptor (`postNodeKeyHex`); the node REFUSES to countersign when unpinned/mismatched (never mints receipts readers would drop, NC-P4).
- App-unlock proof (NC-P5, existing $4.99 SKU): HMAC token minted by the hosted API from a REAL purchase row, PERSONA-BOUND with proof-of-possession, one-purchase-one-persona sticky binding, delivered via single-use link codes so device and persona credentials never co-appear in one request (NC-P2).
- Approval-mode public posting = owner rosters the PERSONA key as a community member (communityRole over the node-held descriptor); no descriptor -> fail closed.
- Replay dedup is idempotent (content-derived postId returns the stored receipt); per-publication write lock kills the double-append race.

## Session verifier injection seam (Track A merge wiring)

- Type: `PublicPostSessionVerifier` in `packages/meerkat-relay/src/community-node-http.ts` (`(sessionToken) => Promise<{ok:true; personaPubkey} | {ok:false; reason?}>`).
- Config key: `StartCommunityNodeHttpOptions.publicSubmit.sessionVerifier`; header `x-mk-session`.
- Bin env: `SESSION_VERIFY_URL` (POST `{token}` -> `{ok, personaPubkey}` at `/session/verify`) in `bin/meerkat-community-node.mjs`.
- Unwired = every submit rejected 500 `session_not_configured` (fail-closed, tested).

## Verification

- sync 1788, relay 431, entitlements 77, app 1011, web 676 tests green; typechecks green; `check-meerkat-parity` + full parity suite green; function gate green on every commit; community-node bin smoke-booted with honest publicSubmit status log.
- Codex review before every commit; 10 real findings folded (receipt-HLC-behind-cursor, transferable unlock proof, bin wiring x2, AM9 token shield, reverse-binding repair, tied-HLC cursor loss, reader publicPosts consumption, postPolicy persistence, dead-token clear). errors_log.md rows added.

## Remaining wiring (Track A/C)

- Track A merge: wire the real `verifySessionToken` into `publicSubmit.sessionVerifier` (+ optionally expose `/session/verify` matching the bin env shape) and mount `createHumanityRouteGuard` on session ISSUANCE.
- Track C: PublishSheet policy picker feeding the new `postPolicy`/`postNodeKeyHex` inputs; feed rendering of `publicPosts` (readers already dual-verify + advance cursors via `pagePublicReader.pinnedNodeKeyHex`); The Commons provisioning pins the first-party node receipt key.

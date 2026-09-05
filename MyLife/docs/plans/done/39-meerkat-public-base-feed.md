# Plan 39: Meerkat Public Base Feed + Verified Public Social

**Status:** Done for codeable scope
**Created:** 2026-07-06
**Owner:** Founder-directed (2026-07-06 direction)
**Depends on:** Plan 19 (DONE, code-complete), Plan 24 (P0-P2 + gate seam DONE; P3 route enforcement folded into this plan), Plan 26 (specced, superseded-and-absorbed by this plan as Track B), Plan 22 Phase 0 (DONE, app-unlock SKU landed), Plan 28 (DONE, real bans)
**Canonical source:** this Markdown plan. The completed July 6 visual planning artifact was removed on 2026-07-09 and remains available in git history.

## Reconciliation Status (2026-07-07)

Status: Done for codeable repository scope. Moved from `docs/plans/queue/` to
`docs/plans/done/` after verification against local `main` (`3807c60b` before this
docs-only reconciliation). P0-P14 are merged into local `main`; P15 remains founder-ops
only. Do not execute this plan as active queue work unless a new founder decision
reopens public-tier scope.

## Founder Direction (2026-07-06, binding)

1. Meerkat must service public feeds in the same product class as Reddit/X.
2. There must be a first-party BASE FEED that we host and anyone can post to.
3. Users get a NEW public alias for their public persona (the privacy architecture changes for the public tier).
4. Public social is allowed.
5. Viewing public content requires an account WITH human verification.
6. Posting requires the $4.99 one-time purchase.

## Binding Policy Reversal (NC-2 inversion)

Plans 19/26 encoded NC-2: "never require an account or verification to view." The founder direction of 2026-07-06 **explicitly reverses NC-2 for the public tier**. This plan records that reversal as a founder decision, not a drift. Consequences handled inside this plan:

- All in-app public surfaces (base feed, Discover, public communities, public profiles) require a verified session to view.
- First-party hosted read routes gain server-side session enforcement (real gate, not client-only).
- Self-hosted community nodes: new node versions default to gated reads; older/self-hosted nodes may still serve openly. The app states this boundary honestly (transport-honesty rule applies; never claim a gate that a third-party node does not enforce).
- All in-app trust copy promising "free anonymous viewing" is rewritten in the same phases that flip each surface.
- The private mesh tier is UNTOUCHED: device-key identity, pairing, LAN sync, private communities, and DMs never require an account, verification, or purchase.

## Pricing (founder-locked, exactly two prices)

- Post/reply/create-public-community gate = existing `meerkat_app_unlock` **$4.99 one-time** (`packages/entitlements/src/meerkat-app.ts`). No new SKU.
- Hosted subscription remains **$4.99/mo with storage included**. Not required for public posting.
- Never invent other prices. Over-cap handling stays a product limit, never a price point.

## Architecture Decision (from 2026-07-06 code-as-is review)

Additive public tier; do not mutate mesh invariants:

1. **Public persona layer (net-new):** persona = fresh Ed25519 keypair, never the device key. Created under a humanity token. Alias registered in hosted registry `pf_personas` (alias -> personaPubkey, uniqueness-enforced, case-folded). Device identity and private communities never learn the alias; the persona never signs private-tier events. Public posts are persona-signed.
2. **Account/session layer (net-new):** persona + humanity verification = account. Short-lived session tokens (extend the `createDeviceSignedAuthorizer` pattern into `persona-session.ts`); session required on first-party public read AND write routes. GDPR deletion + export exist because accounts now exist.
3. **Participation = Plan 26 as specced:** `postPolicy` on `PublicationDescriptor`, `protocol/public-post.ts` (PublicPostEvent, author-sign + node acceptance receipt, dual-signature verify), `POST /public/{pub}/{channel}/submit` with three stacked gates: session (new) + `x-mk-humanity` single-use token (built) + app-unlock entitlement (built).
4. **Base feed = system-owned open-mode publication** ("The Commons", working name) operated by the first-party node: topic channels, follows (`cm_public_follows`), unified feed, infinite scroll via existing page cursor.
5. **Operator moderation console (net-new):** first-party T&S at scale on top of existing report queue/kill/tombstone primitives + CSAM hash pipeline at the public-post boundary (the `published_blob` hash-scan rail already fires there; extend it), DMCA intake, GDPR deletion.

## Phases

### Track A: Identity + Accounts
- **P0 Policy ratification + copy inventory** (0.5d): strike NC-2 from plans 19/26 with founder-decision citation; inventory every "free anonymous viewing" string on both surfaces + parity script; add new NC set (below).
- **P1 Public persona protocol** (2d): `packages/sync/src/protocol/public-persona.ts` — persona keypair create/store (SecretStore, distinct namespace), `PersonaClaim` (alias, personaPubkey, humanity-token-bound issuance), sign/verify, domain `meerkat-persona-v1`. Leakage tests: persona never signs private-domain payloads; device key never appears in persona flows.
- **P2 Alias registry + accounts service** (3d): `packages/meerkat-relay/src/persona-registry.ts` + HTTP surface — register (humanity-gated, atomic uniqueness, reserved-word list), resolve, release; `persona-session.ts` short-lived session tokens (HMAC, fail-closed, mirrors `requireHostedEntitlement` shape); GDPR delete + export endpoints; durable store.
- **P3 Verified account onboarding UI** (2d mobile + 1d web): Verify sheet (reuse `VerifySheet.tsx` wallet) -> alias picker -> account created. Identity screen gains a "Public persona" section with explicit separation copy.

### Track B: Participation (Plan 26 absorbed)
- **P4 postPolicy protocol** (1d): `postPolicy: 'view_only'|'approval'|'open'` on `PublicationDescriptor`, conditional-append, signature-covered, fail-closed to `view_only` when absent.
- **P5 Public post protocol** (2d): `protocol/public-post.ts` — `PublicPostEvent` (persona-signed), node acceptance receipt (node keypair, countersign), `verifyPublicPost` dual-signature fail-closed, tombstone support. NC-1 honesty framing locked in copy: who-may-post is node-enforced (like Reddit/X), authorship/integrity end-to-end.
- **P6 Submit route** (2d): `POST /public/{pub}/{channel}/submit` on community-node-http — gates in order: session -> humanity token (single-use redeem) -> app-unlock entitlement -> roster/policy -> rate/size caps -> countersign + warm-tail append. Per-persona flood caps + kill-switch to flip any publication to `view_only` in one action.
- **P7 Plan 24 P3 completion** (1d): humanity middleware on public-join park + registerPublication call sites (the remaining route enforcement), now also on session issuance.

### Track C: Base Feed + Consumer Surface
- **P8 The Commons** (2d): system-owned open-mode publication provisioning (first-party node boots it), topic channels, operator descriptor key custody runbook.
- **P9 Verify-to-view enforcement** (2d): session check on first-party public read routes (manifest/page/blob for gated publications + directory browse); app-side locked-feed state for unverified users; honest boundary copy for self-hosted nodes.
- **P10 Feed consumer UI mobile** (4d): Public tab (base feed), post cards (text/media/link), composer with unlock gate, post thread + replies, public profiles (alias, follow), follows feed, topic channels, Discover re-skin, report sheet.
- **P11 Web parity** (3d): all P10 surfaces on `apps/meerkat-web` + parity-script locks for every new user-facing string.

### Track D: Trust + Safety + Launch
- **P12 Operator moderation console** (3d): web console on the first-party node — report queue triage, tombstone/remove, persona suspend (session revoke + submit deny), publication kill, audit log.
- **P13 Legal pipelines** (2d code + founder-ops): CSAM hash-scan extension at submit boundary (fail-closed on scanner outage for public posts), NCMEC report queue stub with vendor seam, DMCA intake route + registered-agent copy, GDPR delete e2e (alias release + post tombstones + server purge).
- **P14 Hardening + red-team** (2d): forged persona/receipt/dual-signature attacks, session fixation/replay, humanity-token double-spend race, entitlement spoof, flood/rate-cap bypass, alias squat/homoglyph tests.
- **P15 Launch ops (founder-ops):** deploy persona-registry/session service alongside relay + community node + directory + humanity service; Turnstile keys; App Attest/Play Integrity configs; NCMEC vendor; DMCA agent registration; UGC policy for App Store review (17+/UGC flags); store copy.

## New Negative Criteria (replace NC-2 for the public tier)

- **NC-P1:** The private mesh tier never requires an account, humanity verification, or purchase. Fail-closed guard tests.
- **NC-P2:** The device key and the persona key never co-sign, cross-reference, or appear in the same server request. Leakage tests both directions.
- **NC-P3:** No public write path without ALL THREE gates (session, humanity single-use, app-unlock entitlement) verified server-side.
- **NC-P4:** Never claim view-gating on nodes that do not enforce it (transport honesty extended to policy honesty).
- **NC-P5:** No third price. Post gate is `meerkat_app_unlock`; hosted sub unchanged.
- **NC-P6:** Trending/ranking on the base feed uses only verifiable signals (real posts, real announcing hosts, recency); no fabricated counts.

## Acceptance Criteria

- AC-1: Unverified app user opening any public surface sees the verify gate; verification -> alias -> feed in under 2 minutes; server rejects ungated reads on first-party routes (401).
- AC-2: Verified, un-purchased user can view everything, can post nothing; composer shows the $4.99 unlock sheet; purchase -> restore -> post succeeds e2e (dual-signature verified on a second client).
- AC-3: Persona/device separation proven by leakage tests + a live capture showing the server never receives the device pubkey on public-tier calls.
- AC-4: Operator can remove a post, suspend a persona, and kill a publication from the console; effects visible on both surfaces within one page fetch.
- AC-5: GDPR delete removes alias, revokes sessions, tombstones posts, purges server rows; re-registration of the alias is blocked for 30 days.
- AC-6: Full parity chain green including new public-tier parity section; all suites green; function gate green.

## Estimate

~32 dev-days codeable across 4 tracks (parallelizable to ~2.5-3 weeks with 2-3 agents), plus founder-ops (deploys, vendor, legal). Reuses: humanity service, IAP rails, read/pagination layer, DoS limiter, report/kill/tombstone primitives, Discover/Reader UIs (~60-70% substrate).

## Open Founder Decisions (flagged, non-blocking defaults chosen)

1. Scope of verify-to-view for SELF-HOSTED community nodes (default: new node versions gated, honest copy about old nodes).
2. Whether public REPLIES require the unlock (default: yes — every public write is gated).
3. Base feed name (working name "The Commons").
4. Comms for removing the "free anonymous viewing" promise (default: release-notes + in-app notice).

## Status Delta (2026-07-07): CODEABLE-COMPLETE

All codeable scope (P0-P14, four tracks) is implemented and landed on `feature/meerkat-public-base-feed` (merge tip `aa9d8412`, unpushed). Verified GREEN on the merged tree: sync 1802, meerkat-relay 574, entitlements 77, meerkat-app 1075, meerkat-web 712; 5 typechecks clean; `pnpm check:parity` (incl. Meerkat + Explore) and `pnpm check:generated-artifacts` exit 0. AC-1..AC-6 covered (see `docs/sessions/2026-07-07-plan39-execution-close.md`). NC-2 reversed for the public tier per founder direction; NC-P1..NC-P6 hold. Exactly two prices held.

Plan REMAINS in queue: gated only on P15 founder-ops (deploys, secrets/keys incl. the network-kill authority seed, The Commons provisioning, Turnstile / App Attest / Play Integrity, NCMEC vendor, DMCA registered-agent, CSAM scanner hash-DB, store UGC/17+ flags and verify-to-view comms). None faked in code; every unconfigured surface fails closed and reports its state honestly.

Six non-blocking founder flags recorded in the close log (one persona = one alias; purchase->persona binding released on GDPR delete; unlock mint sends persona public key to billing; approval-mode posting needs persona rostered into descriptor; one host per humanity token; session issuance spends a humanity token).

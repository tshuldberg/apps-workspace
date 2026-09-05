# Meerkat Consumer Front Door - Decomposition

Date: 2026-06-22
Status: decomposition / sequencing map (pre-spec). Awaiting founder approval before any sub-project is spec'd or built.
Provenance: produced by a grounded 15-agent mapping pass (7 subsystem readers over the real Meerkat + `@mylife/sync` code, 5 reference-architecture dossiers, synthesis, adversarial critique, integration). Claims about what exists were verified against the codebase, not memory.

Locked vision decisions this map serves:
- Audience: adult mainstream, global. "8-year-old can use it" is a simplicity benchmark, not literal child users. Discord mental model.
- Transport: hybrid. Hosted always-on relay/node as the zero-setup default, mesh/LAN as fallback, active path shown honestly.
- Identity: layered + optional. Local sovereign E2E identity private by default; optional hosted account that never reads content, unlocking roaming, recovery, payments, and human verification.
- Feed: user-controlled, three progressive layers (source toggles, saved custom feeds, agent-driven), aggregating communities, group chats, DMs, friends, and public content.
- Social: friends graph + 1:1 DMs + group DMs are first-class and feed sources.
- Moderation: lightweight (block/report/mute), not a COPPA/child-safety gate.
- Platform: iOS + Android (Expo) first, web kept in lockstep.
- OS share-sheet intake as a first-class entry point.
- Non-negotiable: the transport-honesty boundary survives, shifting from "no automatic delivery" to "honest about hosted delivery."

## Framing

Meerkat today is a thin, honest UI over the `@mylife/sync` node layer: real on-device crypto, manual relay + LAN sync, live communities + signed `cm_messages`, a Posts schema (MK-P01) landed, and a hard transport-honesty boundary. The founder now wants a mainstream, Apple-tier consumer front door with a Discord mental model. The good news, verified against the codebase, is that most of the heavy machinery already exists (the relay fleet, RelaySelector, TransportManager, hosted-api subject model, signed invites, abuse-rails, group-key epoch rotation, recovery-key seal, the persistent-WebSocket relay, and a real `meerkat-web` twin with a parity test). The default relay URL is genuinely empty by design, member removal genuinely does not exist yet, and `onlineDeviceCount` is a genuine stub. So the plan is mostly turning built infrastructure into honest consumer behavior, scheduling the one XL refactor (multi-identity / E0) late, and closing a set of honesty, privacy, parity, and store-compliance gaps that would otherwise bite mid-phase.

The honesty boundary survives but SHIFTS: from "no automatic delivery at all" to "honest about hosted delivery." Every label and number still traces to the engine or the `sync_`/`cm_` tables. Two landmines are pulled forward and defused in Phase 0: the `onlineDeviceCount` stub (guarded to "unknown" the same phase it becomes visible) and unbounded free-tier relay egress (caps + rate limits enforced before billing exists).

## Sub-projects by layer (exists vs new)

### Foundation (hosted spine, identity, parity, ops)
| ID | Name | Exists vs New | Depends on | Size |
|----|------|---------------|------------|------|
| SP01 | Hosted relay deploy + selection + free-tier caps | Relay fleet, RelaySelector, hosted-node all EXIST. NEW: cloud ops, non-empty DEFAULT_RELAY_URL (both clients), live-dial wiring, caps + rate limits, metadata-disclosure doc | - | L |
| SP03 | Hybrid active-path UI + onlineDeviceCount guard | TransportManager, SyncStatusStore EXIST; onlineDeviceCount is a verified stub. NEW: live path badge, 3-state delivery, "unknown" guard + test | SP01 | M |
| SP05 | Tier-0 sovereign identity floor + recovery RESTORE | mk_identity, recovery-key seal EXIST. NEW: restore-from-key flow + honest copy | - | S |
| SP-WEB-PARITY | Web twin lockstep track (parity gate) | meerkat-web twin + post-schema-v2-parity.test.ts EXIST. NEW: making web a lockstep deliverable, not "web later" | - | M |
| SP-RELAY-OPS | Relay observability + incident runbook | server.ts heartbeat EXISTS. NEW: metrics, log-retention policy, runbook | SP01 | S |
| SP-OFFLINE-MIGRATION | Offline to hosted reconciliation + dedupe | HLC + mailbox drain EXIST. NEW: migrate existing mesh-only data, dual-path dedupe tests | SP01, SP03 | M |
| SP06 | E0 / multi-identity refactor (XL, descriptor v2 additive) | Single-identity everywhere. NEW: multi-identity store, per-identity refs, headless factory, additive descriptor bump + live migration | SP05 | XL |
| SP07 | Optional hosted account anchor (content-blind) | hosted-api subject (no content keys, verified) EXISTS. NEW: account binding, opaque secret-storage verb, device vouching + adversarial tests | SP06, SP01 | L |
| SP08 | Multi-device roaming + unlock ladder | recovery-key, revocation EXIST. NEW: roaming, PIN guess-limit, passkey/PRF, honest PIN copy | SP07, SP05 | L |

### Social (communities, posts, friends, DMs, share-sheet)
| ID | Name | Exists vs New | Depends on | Size |
|----|------|---------------|------------|------|
| SP12 | Discord-simple onboarding (link/QR + 30s first message) | Signed invites, communities/channel screens EXIST. NEW: QR gen/scan, deep-link Join, focused composer, honest delivery copy, reserve v2 fields | SP01, SP03, SP-WEB-PARITY | M |
| SP14 | Posts primitive build-out (MK-P02..P06) | MK-P01 schema + parity test EXIST. NEW: composer, post-card feed, thread view, bumping in merge path, edit/delete/reactions/mentions | SP12, SP-WEB-PARITY | L |
| SP15 | Friends graph + 1:1 DMs + group DMs + scope guard | Workspaces ('group'), signed messages, SAS, TOFU EXIST. NEW: friends graph, DM creation, conversation UI, exactly-2 scope guard + test | SP12, SP-WEB-PARITY | L |
| SP19 | OS share-sheet intake | seal/pin + send paths + Manhattan precedent EXIST. NEW: expo-share-intent integration, intake target picker | SP12 | M |

### Feed (user-controlled, three layers)
| ID | Name | Exists vs New | Depends on | Size |
|----|------|---------------|------------|------|
| SP16 | Feed engine layers 1-2 (toggles + saved feeds) | cm_post_activity, read-state attention columns EXIST. NEW: evaluateFeed engine, source toggles, saved feeds, explainable local ranker, attention inbox, feed tab | SP14, SP15, SP13b, SP-WEB-PARITY | L |
| SP17 | Feed layer 3 (agent NL feeds) | FeedSpec engine (from SP16) EXISTS. NEW: NL->FeedSpec compiler, agent identity, LLM dep | SP16, SP06 | L |
| SP18 | Agent-native posts (agents as members) | v2 event carries authorKind + intent already. NEW: agent custody, @mention dispatch, task board | SP06, SP14 | L |

### Trust + Safety (moderation, account-deletion, MITM, verification, payments)
| ID | Name | Exists vs New | Depends on | Size |
|----|------|---------------|------------|------|
| SP13a | removeMember + key-rotation primitive | VERIFIED: removeMember does NOT exist; epoch rotation + descriptor revision DO. NEW: removal orchestration glue + post-removal-denial tests | - | M |
| SP13b | Moderation client (block/mute/hide/report + owner inbox) | abuse-rails, roles EXIST. NEW: local block table, report->owner inbox, owner UI, shared attention-state module | SP12, SP13a, SP-WEB-PARITY | M |
| SP-ACCOUNT-DELETION | Account deletion + retention + GDPR (launch gate) | hosted-api, TTL machinery, BestChef deletion precedent EXIST. NEW: in-app deletion UX, cross-store erasure, retention policy, DSR | SP07, SP01 | M |
| SP-KEY-TRANSPARENCY | Key-substitution / MITM defense surfaced | TOFU pins + SAS EXIST. NEW: non-dismissable safety-number warning on the primary surface, key-transparency-log decision | SP01 | M |
| SP-STORE-SUBMISSION | Submission compliance bundle (single owner) | Features exist across SPs. NEW: privacy labels, encryption-export, background-mode justification, human 24h report process | SP13b, SP02, SP-ACCOUNT-DELETION | S |
| SP11 | Human-verification (web-of-trust first) | TOFU + friend vouches + attestations EXIST. NEW: vouch attestation type, per-community badge gate, external IDV later | SP07, SP15 | M |
| SP10 | User-to-user payments (regulated, fast-follow) | MyPay module EXISTS. NEW: bind to hosted account, P2P UX, store-compliant separation | SP07, SP09 | L |

### Always-on feel + Polish (push, presence, billing, reskin)
| ID | Name | Exists vs New | Depends on | Size |
|----|------|---------------|------------|------|
| SP02 | Content-free push wake + drain cadence + notif privacy | runBackgroundSyncOnce, applied>0 gate, push stub EXIST. NEW: real APNs/FCM, token routing, scheduler, lock-screen content policy, 2-device timing | SP01 | L |
| SP04 | Honest presence (live-socket-only, metadata-blind) | SyncStatusStore, relay heartbeat EXIST. NEW: per-channel presence WITHOUT channel-id disclosure, TTL to "unknown", presence UI | SP01, SP03 | M |
| SP09 | Meerkat Plus subscription + entitlement gating | SKU, entitlement token, PaymentService EXIST. NEW: paywall UI + entitlement-to-dial wiring (caps moved to SP01) | SP07, SP01 | M |
| SP20 | Apple-tier reskin + progressive disclosure | Palettes, kit, tabs EXIST. NEW: consumer IA, friendly copy, hard rule that honest surfaces are never buried | SP03, SP12, SP-KEY-TRANSPARENCY | L |

## Phased build order

**Phase 0 - Hosted spine + honest path (the consumer wedge).** SP01, SP03, SP05, SP-WEB-PARITY, SP-RELAY-OPS, SP-OFFLINE-MIGRATION, SP13a. Deploy the built relay, flip DEFAULT_RELAY_URL on both clients, enforce free-tier caps + rate limits up front, show the active path honestly, guard `onlineDeviceCount` to "unknown" the same phase it becomes visible, finish recovery-key restore, stand up the web-parity gate + relay observability, reconcile existing mesh-only data, and START the removeMember primitive in parallel so the launch-gate crypto is never serialized behind UI. No XL refactor. All reuse-heavy.

**Phase 1 - Always-on feel + Discord-simple launch (store-ready).** SP02, SP04, SP12, SP13b, SP-STORE-SUBMISSION. Real content-free push (honest notification content) + honest live-socket presence make hosted delivery feel always-on; link/QR join + 30s first message (real-time copy gated on SP02 two-device validation, else "queued, delivers when reachable"); moderation client wired to the Phase-0 primitive + the store-submission bundle close the App Store/Play gate. SP12 reserves the descriptor v2 fields so the Phase-3 bump is additive. Minimum public-launchable front door, no multi-identity.

**Phase 2 - Reskin, social, posts, share-sheet (parallelizable).** SP20, SP-KEY-TRANSPARENCY, SP14, SP15, SP19. Apple-tier reskin with the hard rule that the active-path badge, presence "unknown", and the safety-number warning are never buried in "advanced"; Posts UX over MK-P01; first-class friends/DM/group-DM (with the exactly-2 scope guard); share-sheet intake. Largely independent surfaces, all keeping the web twin in lockstep.

**Phase 3 - Hosted account, roaming, billing, account-deletion, feed 1-2.** SP06, SP07, SP08, SP09, SP-ACCOUNT-DELETION, SP16. Land the XL multi-identity refactor as an additive descriptor v2 bump over the v1 communities reserved-for in Phase 1, then the content-blind account anchor (hard adversarial vouch tests), roaming + unlock ladder (PIN honesty in shipped copy), the Plus paywall, the account-deletion/GDPR gate, and feed layers 1-2 over the now-built posts/social sources and the shared moderation mute model.

**Phase 4 - Agent-native + advanced trust/payments (fast-follow, multi-identity-gated).** SP17, SP18, SP11, SP10. Agent NL feeds, agent-native posts, optional human-verification (web-of-trust first), and the regulated payments layer. All additive on the account/agent foundation, never launch gates.

## Open decisions

1. Free-tier limits: exact caps on blob size, mailbox-retention days, community count/size, and number of roaming devices before Plus is required (enforced in SP01/Phase 0, so the numbers must be decided before deploy).
2. Plus pricing shape: one flat ~$4.99/mo tier, or split Basic vs Pro (Discord Nitro) for power users / large communities? Solve cost-plus on NET revenue after the 15-30% IAP tax.
3. External-payment links: adopt the US-only external-payment discount, or keep RevenueCat IAP as the single global path?
4. Real provider-invoice unit costs to replace illustrative hosted-pricing.ts numbers and lock the cost+25% markup before publishing any dollar figure.
5. Recovery scope for v1: Matrix-style encrypted per-room Key Backup (history survives), or identity-only recovery + peer re-sync?
6. Account-to-key binding default: hosted account tied to the local device key, or a separate handle vouched by the device key (recommended default)?
7. PIN unlock honesty posture: ship rate-limit-based guess-limiting WITHOUT an SGX enclave, with explicit user-visible copy that a full server compromise + weak PIN could expose the encrypted blob.
8. Passkey/WebAuthn-PRF behind a dev-build flag (uneven OS coverage) with the printable recovery key as the floor - confirm acceptable for v1.
9. DM schema choice: reuse cm_ tables under a DM workspace_id, or add parallel dm_ tables? A Phase-2 blocker because SP16 feed sourcing depends on it.
10. Presence privacy-vs-honesty (SP04): can per-channel presence be derived without disclosing channel ids to the relay? If not, default to "unknown".
11. Key-transparency for v1: ship a verifiable log, or rely on TOFU pins + a non-dismissable safety-number-changed warning with residual risk stated?
12. Human-verification v1 scope: ship only the web-of-trust badge (TOFU + friend vouches) and defer external IDV to per-community pluggable credentials?
13. Optional hosted short-code invite resolver + join-approval gate in v1.1 (built on the self-contained signed link), and whether approval defaults OFF to protect the 30-second flow.
14. Operational 24h report-action process: who staffs the owner/T&S report inbox and the published contact.
15. Notification lock-screen content (SP02): confirm generic "New message in <community>" resolved on-device after drain (never carried in the push) + per-community settings respecting mute.

## Recommended first slice

Lead with **SP01 + SP03 (with SP-WEB-PARITY riding along)** as the thinnest end-to-end slice: deploy the relay to one region with `/healthz` + per-token rate limits + a mailbox-retention TTL, set a non-empty DEFAULT_RELAY_URL in BOTH `sync-core.ts` and `apps/meerkat-web/src/lib/relay.ts` in the same change, wire RelaySelector into the live dial, replace the static "Encrypted relay: Live (manual)" text with a live engine-derived active-path badge (Hosted / On this network (LAN) / Offline-parked) plus three-state delivery semantics, and render `onlineDeviceCount` as "unknown" with a test that fails if any UI binds a peer count without a live-session source.

Why this slice: it converts the most already-built infrastructure into working consumer behavior with the least new code and zero dependence on the XL refactor, gives an immediate demoable "two phones, hosted relay, real-time message, honest path label" moment, and de-risks the highest-uncertainty downstream piece (SP02 push timing) by establishing the persistent session first. It also closes the most urgent honesty landmine: `onlineDeviceCount` is a verified stub that would otherwise display a fabricated peer count the instant hosted delivery ships, a full phase before SP04. Defer SP06 to Phase 3 and reserve the descriptor v2 fields in Phase 1 so the entire launchable front door (Phases 0-2) ships without blocking on the riskiest refactor.

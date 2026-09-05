# Plan 19 — Meerkat Public Social Layer — COMPLETE (2026-06-29)

Branch: `feature/meerkat-public-social` (worktree `.claude/worktrees/plan19-public-social`, off `main` `4c8018cb`). HEAD `0e528b5d`. 14 commits. Not yet pushed/merged (push on founder ask).

## What this is
Built the entire public social layer for Meerkat: free-to-view public communities/channels/forums, browse/search/trending discovery, a real serving + directory infrastructure, the publish flow with an honest paid boundary, and moderation-at-scale. The Feed "Public" control and Discover stay honestly hidden/empty until a real public-directory source is configured and responds; production deployment remains a founder-ops (Tier D) boundary, never faked.

## Execution model
Subagent-driven, phase-by-phase. Each phase: a fresh implementer subagent (opus) against a precise context pack from a read-only mapping agent, then spec-compliance review, then code-quality review (combined into one reviewer from P4 onward), then fix loops until the reviewer returned "ready to merge: yes", then independent orchestrator gate verification. Reviews caught and fixed real issues before they shipped (see "Issues caught" below).

## Phases (commit, summary)
- **P0** `81fdc2c9` — `PublicationDescriptor` engine (`@mylife/sync`) + public-scope sync policy. Reconciled `cp_`->`cm_` table prefix (`c753fdb0`) because `ChangeTracker.resolveModule` maps a table to its module by a single owned prefix. `cm_publications` is the sole community-family table that may reach `published_blob`; `cm_messages` stays `shared_workspace`.
- **P1** `c6d9a238` — public snapshot build/import via an injectable NON-secret seal key (epoch path proven byte-for-byte unchanged). `importPublicSnapshot` fail-closed, binds `expectedAuthor`+`expectedContentId`.
- **P2** `57f2dbc2` — public directory browse/search client (unsealed twin of host-registry); verify-before-trust on every entry; anti-spam bucket-placement filtering on the signed category/terms.
- **P3a** `f93799c1` — community-node OPEN public serving routes (`/public/{id}/manifest|/{infoHash}/{index}|/{channelId}/page` + owner `register`) + a per-IP DoS limiter (swept + capped) + NC-2 piece scoping + durable publication/kill stores.
- **P3b** `1e1541d2` — deployable `public-directory-node` service (WS verbs, durable, capped, kill-aware). Trending ranks by real announcing-host count + owner-signed recency only (no eventCount — inflatable). TTL trend cache, egress byte-limiter.
- **P4** `5c9ebc57` — cross-client REAL-bytes Tier-C e2e (live relay + directory + serving node, 2 devices) + the reusable RN-safe `fetchPublicSnapshot` client helper.
- **P5a** `8a897e07` — feed public un-gate (TC-5, computed from a real probe) + the 4 `cm_public*` SQLite tables + the directory probe service (mobile + web).
- **P5b** `9a736932` — mobile Discover tab + Public Reader stack + 5-state coverage (verbatim copy).
- **P6** `55f9e962` — web Discover pane + dedicated Public Reader (renders the verified `fetchPublicSnapshot`, not live channel data) + nav wiring + parity.
- **P7a** `92816396` — publish orchestrator (`publishChannelPublicly`: build->sign->register->announce) + hosted-boundaries state transition + live e2e. Self-host real; hosted honestly deferred (price from billing-config).
- **P7b** `30eb0f36` — publish sheet UI (mobile + web): AudienceSelector wired, real host probe, 5-state + copyable link.
- **P8a** `2eb7e52c` — host abuse-intake (unsealed signed report, no owner DH key) + owner report fetch (owner-signed) + directory `recordUnpublish` (chain-verified removal) + byte-cap DoS hardening + live e2e.
- **P8b** `0e528b5d` — moderation UI: report delivery to the host intake (honest sent/saved-local) + owner "Public reports" queue + `unpublishPublicly` (re-register unpublished revision with persisted pieces -> serving 404; re-announce -> directory drop).

## Verification (final, at `0e528b5d`)
- `@mylife/sync` 1242/1242 · `@mylife/meerkat-relay` 173/173 · `@mylife/meerkat-app` 233 functional + 1 pre-existing flaky complexity-slope perf gate on the UNTOUCHED `community-files` file (passes 4/4 on re-run) · `@mylife/meerkat-web` 127/127.
- All 4 typechecks clean; `check-meerkat-parity` pass; `check-generated-artifacts` pass.

## Issues caught by review (fixed before shipping)
- P0: the `published_blob` escalation was inert (`cp_` prefix didn't resolve to the community module); `verifyPublication` had a fail-open unchained-revision path and a forgeable `killed` bit. Fixed.
- P1: `importPublicSnapshot` lacked the owner-binding; added `expectedAuthor`/`expectedContentId` fail-closed.
- P2: unauthenticated bucket placement let a real pub be spammed into any category/search bucket; added signed-category/term filtering. Capped announce fan-out; corrected an overstated privacy comment.
- P3a (Critical): the per-IP limiter Maps were unbounded + never swept (throttle bypass + memory exhaustion). Added sweep + hard cap. Restart durability (replay-resurrection + takedown-bypass), boot-window kill race. Fixed.
- P3b: ack-before-durable-write, uncached full-set trend sort, unwired egress limiter. Fixed.
- P8a: open report route was byte-unbounded. Added field caps + 4 KB report ceiling + 16 KB body cap.

## Honesty boundary (founder-ops, gated behind honest copy, never faked)
- Feed Public control + Discover hidden/empty until a real public-directory source is configured AND responds with verified entries (TC-5).
- Self-host publish is fully real; hosted (paid managed serving) endpoint + entitlement are honestly deferred ("Connect hosted serving (coming)", price from billing-config).
- Report-to-owner uses the unsealed host abuse-intake (no owner DH key); the sealed mailbox-to-owner path stays honestly unavailable (the `PublicationDescriptor` carries no owner X25519 key).
- Production: `DEFAULT_RELAY_URL` is still `''`; a deployed relay + directory + always-on serving host + the edge per-IP limiter + App/Play UGC-moderation review remain Tier-D founder ops (plan §12).

## Known limitations / recommended fast-follows
- Directory `recordUnpublish` is genesis->revision-2 only (revision>=3 unpublish falls back to TTL; serving 404s immediately regardless).
- Reader warm-tail §5.6 paging client + `cm_public_feed_cursor` not yet consumed by the app reader.
- Public-join (§7.2.1) ships the affordance + honest "not connected" copy; no app-UI hook into the invite/join rail yet.
- Tokenizer strips non-ASCII (non-Latin titles search-unindexed) — needs Unicode-aware tokenization for the global audience.
- Add a `public-publish` twin-equality check to `scripts/check-meerkat-parity.mjs` (the twins are byte-identical by hand).
- Mobile `tsconfig` excludes `__tests__` from `tsc` (a gate blind-spot; a separate test tsconfig would close it).

## Note
A concurrent session worked Plan 18/20 in the MAIN repo checkout (`/Users/trey/Desktop/Apps/MyLife` on `feature/mylife-improvements-sprints`, advanced to `61bd3246` "Plan 18 theme system complete") — independent of this worktree. It caused one transient reviewer environment artifact (mobile vitest briefly resolving `@mylife/sync` against the main tree). The plan-19 worktree stayed intact at `0e528b5d` and all authoritative runs are green.

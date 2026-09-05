# Meerkat UX-parity execution (Fable orchestrating Opus workers) - 2026-07-03

Branch `feature/meerkat-launch-finish` (NOT pushed). CI down (GH billing); local-green is the trust gate.
Fable orchestrator dispatched Opus implementers + per-phase Opus spec-review and adversarial-review agents;
orchestrator personally re-verified gates and committed each phase.

## Commits landed this session (9 Meerkat)

| Commit | Plan / Phase | What |
|--------|--------------|------|
| `52fde4fe` | 31 P0 | 5-tab IA (Friends -> Messages), Messages shell (honest Chats empty + People person sheet), add-friend flow (zero visible transport, effectiveRelayUrl choke point only) |
| `d9e4297a` | 30 P0 | Reactions protocol (Hermes-safe emoji grammar, fail-closed react verify, byte-identical reaction read models both surfaces, idempotent send/total un-react) + **security fix**: author+intent-bound supersedes at resolveChannelMessages seam |
| `f8a6d2ad` | 30 P1 | Shared chat kit (props-only, TC-4 no-provider guard, single-Modal actions/picker, send latch, token-boundary signed mentions) |
| `4e0e7121` | 32 P0 | Feed enrichment (media/replyCount/reactions on post items; ranking snapshot locked; feed-core twin byte-guard) |
| `74720072` | 30 P2 | Channel + post screens on the kit (segmented Chat|Posts, one header audience line, actions sheet) + **security fix**: history-import replicates only merge-inserted events (was defeating the Plan 28 membership cut) |
| `aa8163bd` | 31 P1-2 | One join pipeline / four doors (tap-link/QR/paste/onboarding, preview sheet, never auto-joins) + Communities list/detail/settings restructure |
| `840956ee` | 30 P3 | Focused live loop (honest polling, relay-gated, Plan 29 tickImpl seam) + new-messages divider (cursor advances only at-bottom) + cm_read_state last_read_author HLC tiebreak + buildVisibleAliasMap author-bind |
| `e9e6aa7c` | 21 P5 | Mobile DM thread UI on the kit; delivery from verified receipts only; block/report/shred/attachments; flips DM_MESSAGES_SURFACE_AVAILABLE=true (mobile); receipt-to-blocked-peer leak fixed |
| `010f7ced` | 31 P3-4 | Onboarding v2 (one-question-per-screen, browse path) + first-run deep-link fix (no double modal, join completes onboarding) + capability-status "What works today" honesty page (statuses derive from real flags) |
| `0e4e1197` | 28 P4 | Owner-only Remove member UI (mobile): honest count-to-phrase copy, epoch-boundary confirm, global single-flight guard (concurrent-removal fabricated-success fix), 16 tests. Web half deferred to the web wave |
| `840956ee`+ | 30 P3 | (listed above) focused live loop + new-messages divider + cm_read_state last_read_author tiebreak + buildVisibleAliasMap author-bind |
| `d1dcddac` | 32 P1 | Content-first Feed rebuild (cards, inline hash-verified media, engagement row from real reactions, i why-sheet + filter sheet, pull-to-refresh, 5 states) |
| (avatars) | 32 P2 | Signed image avatars: community-profile v2 conditional canonical (v1 bytes byte-identical), 32KB caps fail-closed both ends, persisted version+avatar_image fixing the hardcoded-v1 read bug, shared Avatar, lazy expo-image-picker/-manipulator |
| `7a6a8075` | 32 P3 | Link previews (Signal model): sender fetches, receiver never does; 64KB cap encode+parse, JPEG-magic gate, SSRF host block (loopback/private/link-local/ULA/metadata + manual per-hop redirect), NC-2 no-fetch guard hardened |

**MILESTONE: the entire MOBILE UX-parity set is complete and committed** (Plans 30 P0-P3, 31 P0-P4, 21 P5, 28 P4, 32 P0-P3). Plus web: 30 P4 web channel parity, and 31 P5 web + 28 P4 web-half.

| `e2541e28` | 31 P5 web + 28 web | Web nav (5 sections, Friends folds into Messages), community list/detail/settings split, join doors (paste + preview, never auto-joins), onboarding v2 twin, capability page; owner-only web Remove control in the relocated settings (global single-flight, honest counts); dead web channel files + FriendsView deleted. Combined review verified owner-gating / honest copy / no-auto-join / no XSS. **Plan 28 moved queue/ -> done/** (engine + mobile + web all shipped). |

15 reviewed feat(meerkat) commits total this session (52fde4fe..e2541e28). Suites: sync 1553, app 673, web 349, typechecks, parity green.

## Security holes found + fixed by the review protocol (both pre-existing)

1. **Cross-author supersede forgery** (30 P0 review): `resolveChannelMessages` applied any signed tombstone/edit without comparing authors, so any member could delete/edit any other member's messages, posts, and reactions network-wide. Fixed fail-closed at the resolve seam (author + normalized-intent bind); adversarially re-verified with repro scripts. `errors_log.md` Resolved.
2. **History-import membership-cut bypass** (31 P1-2 review): `importHistory` replicated `importedEvents` including events the merge dropped as removed-member (Plan 28 `droppedRemoved`), and peers applied them raw, re-injecting a removed member's post-removal messages community-wide. Fixed: merge returns `insertedEvents`; a shared `replicateImportedHistoryEvents` helper replicates only those at both call sites. `errors_log.md` Resolved.
3. **DM receipt-to-blocked-peer leak** (21 P5 review): opening a thread after blocking parked a "read" receipt to the blocked peer. Fixed with a per-message `isBlocked` predicate in `computeDmReceiptsToEmit`.
4. **First-run onboarding break** (31 P3/4 review): a cold-start invite deep link stacked two modals and a deep-link join never completed onboarding (user stranded behind the gate). Fixed via an onboarding-completion signal + invite-pending suppression.
5. **Link-preview sender-side SSRF/LAN-leak** (32 P3 review): `buildLinkPreview` fetched pasted loopback/private/link-local/metadata hosts and replicated the internal page's og-data to the community. Fixed with an `isFetchableUrl` host block (all private ranges across hex/decimal/short IPv4 + IPv4-mapped IPv6) + manual per-hop redirect re-checking. `errors_log.md` Resolved.
6. **Plan 28 P4 concurrent-removal fabricated success** (28 P4 review): a per-member disable let two removals run concurrently; the monotonic descriptor upsert silently dropped the second while the UI claimed success + double-rotated the epoch. Fixed with a global single-flight guard (parity-locked).

## Web wave (remaining) + hardening

- Coordinated web wave (all share ui/community, ChannelSidebar, ui/navigation, ui/feed, meerkat-data twin): Plan 30 P4 web channel parity (grouped bubbles/reactions/reply/mentions/segmented, web live loop via visibilitychange, web new-messages divider + web mark-read author-passing so the m3 tiebreak goes live on web), Plan 31 P5 web (nav 5-section, community list/detail/settings split, join doors, onboarding v2 twin), Plan 28 P4 web half (ChannelSidebar Remove control + retire the web placeholder + flip its parity guard present->absent, then move Plan 28 queue->done), Plan 32 P4 web (feed cards/why/filter/avatars-render/link-card render; SVG via img src). Run SEQUENTIALLY or carefully partitioned to avoid ChannelSidebar/meerkat-data collisions.
- Plan 21 Phases 9-10: web DM parity + hardening incl. resolveDmMessages author/intent bind (same pattern, logged), delivered-on-drain, DM Retry, receipt engine defense-in-depth, group Read-by-N self-device exclusion.
- Plan 32 Phase 5 hardening: scope/debounce the per-reaction full evaluateLocalFeed re-eval; feed render-window + avatar data-URI memo perf; wire shared Avatar into chat-kit bubble + Messages People; FeedItem.linkPreview twin field for feed-card link render.
- Close: /design-review batch across 30+31+32.

## Suites at HEAD (010f7ced)

meerkat app 569, meerkat-web 199, both typechecks, `check-meerkat-parity.mjs`, all green. (sync/relay untouched this wave.)

## Still in this window

- Plan 28 P4 (owner-only Remove member UI): mobile in flight; web half joins the coordinated web wave. Plan 28 moves queue/ -> done/ when the web half ships.
- Coordinated WEB WAVE (deferred, all touch ui/community + ChannelSidebar): Plan 30 Phase 4 (web channel parity + web divider + web mark-read author-passing so the m3 tiebreak is live on web), Plan 31 Phase 5 (web nav/community/onboarding twins), Plan 28 P4 web half.
- Plan 32 Phases 1-5 (feed rebuild, avatars, link previews). Carry-ins: SVG-as-inline-media must render via <img src>/exclude (XSS); reaction-scan perf note.
- Plan 21 Phases 9-10 (web DM parity + hardening). MUST include author/intent-bind in resolveDmMessages (same pattern, logged), delivered-on-drain, DM Retry, receipt engine defense-in-depth, group Read-by-N self-device exclusion.
- Close: /design-review batch across 30+31+32.

## Worker protocol used

One Opus implementer per phase (TDD, no commits) -> Opus spec-review + Opus adversarial-review (read-only, report to main) -> orchestrator consolidates findings back to the implementer -> re-verify (targeted re-review for security/schema-sensitive fixes) -> orchestrator runs gates + commits the slice. Honesty invariants held throughout (DEFAULT_RELAY_URL '', staged != sent, no simulated-as-live, no fabricated status/receipts, omitted cm_ tables fail closed). No em dashes.

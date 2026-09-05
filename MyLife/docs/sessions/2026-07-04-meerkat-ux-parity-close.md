# Meerkat UX-parity execution close (Fable orchestrating Opus workers) - 2026-07-04

Continuation of the 2026-07-03 UX-parity execution. Branch `feature/meerkat-launch-finish` (NOT pushed). CI down (GH billing); local-green is the trust gate. Fable orchestrator dispatched fresh Opus implementers + per-slice Opus spec-review and adversarial-review agents; the orchestrator personally re-verified gates and committed each slice per file-slice.

## What this session finished

The 2026-07-03 handoff (`docs/reports/REPORT-meerkat-ux-parity-handoff-2026-07-03.html`) left four remaining items: Plan 32 Phase 4 web, Plan 21 Phases 9-10, Plan 32 Phase 5, and the design-review close. All four code items are now built, reviewed, and committed.

## Commits landed this session (5)

| Commit | Plan / Phase | What |
|--------|--------------|------|
| `ec2912e9` | 21 P10 | DM hardening (engine + mobile): author/intent bind in `resolveDmMessages` (security), delivered-on-drain via one shared handler, own-mirrored-message receipts blocked at the EMIT layer, `summarizeDmDelivery` made fail-closed (requires `ownDeviceIds`), revoked-recipient filter, DM Retry double-submit guard |
| `988a5b90` | 32 P4 | Web content-first feed parity (cards, why-popover, filter panel, header refresh, photo-avatar editor) + mobile feed photo avatar (AC-6 parity) + a real on-device native-barrel crash fix + `previewDataUri` mime allow-list clamp |
| `df0df7a0` | (hardening) | `@mylife/sync` barrel-parity guard test (index.ts vs index.native.ts value exports), proven to catch the avatar drift |
| `b0ca9330` | 21 P9 | Web DM parity: byte-twin dm cores (inherit the P10 hardening), MessagesView rebuild (thread/new/group panes), MeerkatProvider DM methods + drain, flag flip, real live-relay 1:1 e2e, parity-gate DM section |
| `d5cb8ba8` | 32 P5 | Feed link-preview cards + mobile chat/People photo avatars + feed perf (memo/render-window/throttle) + a pre-existing Files-leak fix |

## Defects the review protocol caught pre-commit

1. **`resolveDmMessages` supersede forgery** (pre-existing, logged 2026-07-03). A DM participant could forge a tombstone/edit of another participant's message. Fixed fail-closed (`ec2912e9`), byte-identical to the channel fix; the Phase 10 adversarial reviewer refuted the forgery 8/8 with repro scripts. `errors_log.md` Resolved.
2. **Own-mirrored-message receipt emitted** (Phase 10 adversarial). `planDrainDeliveredReceipts` skipped only `self.publicKey`, so a message authored by the user's OTHER linked device emitted a real signed delivered receipt to the user's own phone; honesty held only by the display filter, and `summarizeDmDelivery` fail-opened (empty `ownDeviceIds` default), a live landmine for the imminent web DM surface. Fixed at the EMIT layer in both drain and thread-open paths + made `summarizeDmDelivery` fail-closed. Two spec reviewers missed it; the adversarial repro pass caught it.
3. **DM Retry double-send** (Phase 10 adversarial). Retry had no in-flight guard and `queueDmMessage` mints a fresh id, so two fast taps parked two messages. Fixed with a synchronous ref guard + disabled state.
4. **On-device avatar crash** (surfaced by the Phase 4 web worker). `index.native.ts` was missing `COMMUNITY_AVATAR_MAX_BYTES` + `isValidCommunityAvatarImage` that `index.ts` exports; the mobile avatar picker would throw at runtime (typecheck resolves index.ts, hiding it). Fixed + a barrel-parity guard test added (`988a5b90` + `df0df7a0`).
5. **Files-leak** (surfaced by the Phase 5 TC-2 test). Link-preview attachments were appearing as bogus files in the community Files index + feed Files source since Phase 3. Excluded by the exact mime constant on both surfaces (`d5cb8ba8`).

Web adversarial review of the DM surface (`b0ca9330`) produced ZERO confirmed findings across seven objectives (fabricated Delivered/Read, dm_ leak, receipt to blocked/own, FF3 dead token, fake-green e2e, flag-flip fake surface, no-relay honesty) - the byte-twin inheritance of the hardened mobile cores held, and every web caller passes the real `listDmOwnDevices` set.

## Verification at close

All local-green across the combined tree, re-run by the orchestrator: `@mylife/sync` 1559 + barrel guard, meerkat-app 698, meerkat-web 465 (incl. 85 web DM tests + a real live-relay 1:1 e2e), meerkat-relay 325, all four typechecks, `check-meerkat-parity.mjs` (now with the DM section, ~391 checks).

## DoD status

- Plan 21 Phase 5 + 9 shipped; `DM_MESSAGES_SURFACE_AVAILABLE`/`_ENABLED` true on both surfaces; honest receipts only. DONE.
- Plan 32 Phases 0-5 shipped on both surfaces. DONE.
- Parity gate extended with the DM section + green. DONE.
- Plan 28 P4 shipped (prior session).

## Remaining (close cleanup + docs, in progress)

- AC-9 web Messages People-row avatars (was blocked by the MessagesView collision, now unblocked); mobile post-thread RootPost avatar; retire the unreachable `DIRECT_MESSAGE_UNAVAILABLE_REASON` repo-wide + promote the parity grep to repo-wide (TC-10 honesty intent); stale `ShareInbox`/`share-route` comments; a direct `aggregateCommunityFiles` exclusion test.
- Plan Status Delta updates (21, 23 D.1/D.2/D.4, 24/26 route refs) + move Plans 30/31/32 to `done/`.
- A single `/design-review` batch across Plans 30 + 31 + 32.

## Founder-ops boundary (unchanged)

`DEFAULT_RELAY_URL` stays `''`; two-physical-device delivery latency, iOS background-execution receipt timing, and out-of-box delivery still gate on a deployed relay + dev builds + 2 devices (runbook: `docs/guides/meerkat-founder-ops-runbook.md`). Web has no background drain, so a Sent DM converges to Delivered when the recipient next opens Meerkat (copy is honest: Sent != Delivered). Nothing pushed.

## Worker protocol

One fresh Opus implementer per phase (TDD, no commits). Two read-only Opus reviewers per phase: spec-compliance + adversarial (the adversarial reviewer runs repro scripts). Orchestrator consolidated findings into one fix list per slice, sent it back to the implementer, personally re-ran the gates, and committed each file-slice. Honesty invariants held throughout; no em dashes.

# Feature Spec: Full Direct Messages (1:1 + Group)

> Meerkat launch plan 21 of 6-plan launch set. Replaces today's honest "Direct messages unavailable" dead-end with complete, end-to-end-encrypted 1:1 AND group DMs, delivered over the real paired-device + zero-knowledge mailbox + relay paths, with an honest signed-proof receipt model. Mobile (`apps/meerkat`) and web (`apps/meerkat-web`) at full parity. All cryptography is an extension of `@mylife/sync`; the app reimplements none.

## Metadata

- **Surfaces:** `apps/meerkat` (Expo Router), `apps/meerkat-web` (Vite React SPA), `packages/sync` (`@mylife/sync`), `packages/meerkat-relay` (mailbox TTL host), `packages/ui` (Open Burrow tokens — consumed, not changed)
- **Priority Score:** 46 / 50 (A-Tier) when proposed. Market 5x3 + Switching 5x3 + Complexity 1x2 (very high) + CrossModule 2x1 + PaidUser 3x1 = 46. The original production-review artifact and its pre-build gap statement are retained in git history. The 2026-07-04 status delta below records the completed DM implementation; current launch truth is cataloged in `docs/reports/README.md`.
- **Estimated CC Time:** 9-12 focused sessions (large/complex; phased build below).
- **Depends On:**
  - SHIPPED substrate (plan 14, `docs/plans/active/14-meerkat-network-v2-mission-control.md`): pair-private mailbox + drain, group/epoch keys, entity-keys, signed channel-message model, SAS trust, signed revocations. This plan EXTENDS those; it adds no new crypto scheme.
  - Launch plan **connectivity + self-hosting** (bundled default relay / hosted TTL mailbox). DMs function over any `ws://`/`wss://` relay today, but mainstream out-of-box delivery needs that plan's hosted default + easy self-host, because `DEFAULT_RELAY_URL = ''` today (`apps/meerkat/app/(root)/data/sync-core.ts:103`) and DMs honestly park-fail with no relay.
- **Blocks / feeds into:**
  - Launch plan **monetization + billing** (hosted TTL-mailbox capacity and max group size are real paid levers; this plan exposes the honest counters they bill against).
  - Launch plan **public social layer** (the per-conversation "feed source on opt-in" flag defined here is the seam that plan reads; this plan ships the flag + a guarded read API and auto-includes NOTHING).
  - Launch plan **theme system** (DM screens consume Open Burrow tokens; soft dependency — they ship correctly on the current `MK_PALETTES`).
- **Build order:** after connectivity (default relay) + theme (tokens are stable either way); parallel-safe with public social; independent of billing. Within the 6-plan set this is plan **#4**.

---

## Status Delta (2026-07-07, final reconciliation): CLOSED, RESIDUAL MOVED TO PLAN 40

- This plan is closed for codeable DM scope. DMs are live on both surfaces: 1:1,
  group, signed receipts, threads, share-inbox routing, mobile/web byte-twin cores,
  and parity locks are present in code.
- The only residual from this plan is AC-13: a normal user-facing same-account
  "link this second device" flow on both surfaces, plus real device QA proving
  own-device convergence. That work moved to
  `docs/plans/queue/40-meerkat-final-launch-plan.md`.
- Founder-ops also moved to Plan 40 and the founder-ops runbook: deployed relay,
  dev/EAS builds, two real devices, and live-relay DM/device-convergence QA.
- Historical sections below remain for implementation record only. Do not reopen
  this plan for AC-13; use Plan 40.

## Status Delta (2026-07-07, reconciliation): CORE DM COMPLETE, QUEUE RETAINED

- DMs are live on both surfaces: 1:1, group, signed receipts, threads, share-inbox
  routing, mobile/web byte-twin cores, and parity locks are present in code.
- The own-device mirror core exists (`dm_own_devices`, `linkOwnDeviceCore`,
  provider-level `linkOwnDevice`, fan-out tests, and receipt exclusion tests), but a
  complete user-facing same-account "link this second device" flow on BOTH surfaces
  was not verified. Search found provider/core hooks and tests, not a surfaced link
  flow a normal user can run end to end.
- Keep this file in `docs/plans/queue/` until AC-13 is either built as visible UI
  or explicitly moved into a new active plan. Everything else in this plan is
  code-complete or founder-ops.
- Founder-ops still apply: deployed relay, dev/EAS builds, two real devices, and
  live-relay DM/device-convergence QA.

## Status Delta (2026-07-04, read first): PLAN CODE-COMPLETE

- **All phases 0-10 are now SHIPPED** on `feature/meerkat-launch-finish` (unpushed). Phases 0-8 landed 2026-07-01/02; Phase 5 (mobile DM UI) + the flag flip landed 2026-07-03 (`e9e6aa7c`); Phase 10 hardening landed 2026-07-04 (`ec2912e9`); Phase 9 (web DM parity + parity-gate extension) landed 2026-07-04 (`b0ca9330`).
- DMs are LIVE on both surfaces: 1:1 + group, honest signed-proof receipts (`DM_MESSAGES_SURFACE_AVAILABLE`/`_ENABLED` true on mobile+web). The web dm-core/dm-provider-core/dm-view-core are byte-twins of the hardened mobile cores (parity byte-locked), so the Phase 10 hardening (resolveDmMessages author/intent bind, emit-layer own-device receipt skip, fail-closed `summarizeDmDelivery`) is inherited verbatim. A real live-relay 1:1 e2e proves real bytes + receipt convergence.
- **Remaining is founder-ops / later-phase, NOT code-blocking**: (a) out-of-box delivery gates on a deployed relay + dev builds + 2 devices (`DEFAULT_RELAY_URL` stays `''`); (b) AC-13 cross-device convergence needs a link-device UI on BOTH surfaces (the own-device mirror is built + tested, but no user path to link a second device yet); (c) TC-11 DM-kind-labeled relay-TTL test (relay is kind-agnostic, so generic mailbox-TTL tests cover DM envelopes implicitly); (d) web group/own-device/attachment lack a dedicated live-relay e2e (covered by unit + byte-twin + the @mylife/sync package e2e); (e) mobile web has no background drain (Sent converges to Delivered on next open; copy is honest). This plan stays in queue on (a)+(b) until the founder deploys a relay and prioritizes the link-device flow.
- Full detail: `docs/sessions/2026-07-04-meerkat-ux-parity-close.md`.

## Status Delta (2026-07-01, read first)

- **Phases 0 and 1 are SHIPPED** (commit `fc65972a`, 2026-07-01): `packages/sync/src/protocol/dm-message.ts` (190 lines, signing domain `meerkat-dm-message-v1`, 10 tests), `dm-mailbox.ts` (284 lines, 13 tests incl. TC-13 fan-out, TC-9 blocks, TC-4 fail-closed), `dm-receipt.ts` (199 lines, 10 tests incl. NC-7). Exported from `index.ts` and `index.native.ts`. Cross-domain isolation triple-verified. Phases 2-10 have ZERO code landed.
- **Authoritative API shapes** (the plan's inline type sketches in Technical Context are illustrative and now WRONG; build Phase 2/4 against these real shapes):
  1. `sealDmDirect` returns `SealDmDirectResult`, a discriminated union: `{ ok: true; payload; sealed: SealedDmDirectEnvelope[]; eventCount } | { ok: false; reason }`. Each `sealed` element is `{ recipientDeviceId; token; envelope }`. The plan's sketch (`{ perRecipient: { deviceId; token; envelope }[]; eventCount }`) is superseded: the array is named `sealed`, and the field is `recipientDeviceId`.
  2. `openDmMailbox` returns `OpenDmMailboxResult`: `{ ok: true; senderDeviceId; createdAt; payload; events; blocks: BlobDataPayload[] } | failure`. `conversationId` and `mode` live INSIDE `payload` (not flattened); `blocks` is always an array (never optional); `createdAt` is additive.
- **New required tasks the plan omitted** (fold into Phase 5 and Phase 10):
  1. `apps/meerkat/app/(root)/data/share-route.ts:42` defines `DM_MESSAGES_SURFACE_AVAILABLE = false`; its header comment mandates flipping it to `true` in the same change that lands the real DM send path plus an `isShareIntakeSent` DM branch. Phase 5 must flip the flag, wire the `'dm'` `ShareDestinationKind` into `availableShareDestinations()`, and add the `isShareIntakeSent` branch that checks real `dm_messages` rows (`COUNT(*)`), mirroring the `cm_messages` pattern.
  2. Web twin: `apps/meerkat-web/src/ui/inbox/ShareInbox.tsx:39` has `DM_MESSAGES_SURFACE_ENABLED = false`; Phase 9 must flip it along with the web DM surface.
  3. Fix the stale comment in `share-route.ts` that says "there is no cm_dm table" (the correct prefix for this plan is `dm_`).
- **Scheduling constraint:** Plan 23 workstream D.6 (Noise forward-secrecy upgrade) edits `packages/sync/src/encryption/noise-handshake.ts` AND `sync-session.ts` (removing the silent static-key fallback at `:925-927` and `:1291-1292`). Plan 21 Phase 2 also touches the session/dispatch layer. Land D.6 BEFORE Plan 21 Phase 2 to avoid a conflict window; as of 2026-07-01, Phase 2 has not started, so this ordering is still free.
- **Line drift:** `SyncProvider.tsx` `resolvePairedSecret` is now at `:561` (cited `:546`), `buildDrainHandlers` is now at `:905` (cited `:886-909`). Function names are unchanged; re-grep rather than trust line numbers.
- **2026-07-01 founder decision:** DMs remain launch-gating (no change to this plan's scope).
- **2026-07-01 UX-set coordination (binding, see `docs/plans/meerkat-launch-orchestration.md` Track E):** Phase 5 (DM thread UI) MUST consume Plan 30's shared chat kit (`apps/meerkat/app/(root)/components/chat/`: MessageList, MessageBubble, MessageActionsSheet, ChatComposer) and slot the conversation list into Plan 31's Messages shell (`messages.tsx` Chats section above People). Sequence Plan 30 Phases 0-2 and Plan 31 Phase 0 before starting Phase 5; if this plan reaches Phase 5 first, build standalone and expect a merge task from Plan 31. Founder decision 2026-07-01: 5 tabs, Friends merged into Messages.
- **2026-07-03 Plan 31 Phases 0-2 LANDED (binding target changes):** the Messages shell now exists in `apps/meerkat/app/(root)/(tabs)/messages.tsx` with a "Chats" section (honest empty state) above a "People" section; each person row opens a person action sheet (SAS compare, block, and a Message button that is DISABLED behind `DM_MESSAGES_SURFACE_AVAILABLE`). `friends.tsx` is now ONLY `<Redirect href="/messages" />`; `add-friend.tsx` owns pairing. So every friends.tsx edit target below is STALE:
  - The Phase 5/9 "friends.tsx `Message` opens the real thread" work (lines ~94, 99, 129, 445, 549, 668-669) MOVES to the Messages **People person sheet** in `messages.tsx` (and the web People panel in `MessagesView.tsx`): flip its disabled Message button to open `dm/[conversationId]` when Phase 5 flips `DM_MESSAGES_SURFACE_AVAILABLE`. Do NOT edit `friends.tsx` (it is a redirect).
  - `data/friends-core.ts` (`canMessage:false`, `messageLabel`, `DIRECT_MESSAGE_UNAVAILABLE_REASON`) and its web twin STILL EXIST and remain valid edit targets; the Messages person-sheet model (`data/messages-core.ts` `buildPersonSheetModel`) reads `DM_MESSAGES_SURFACE_AVAILABLE` for the Message-enabled decision, so flipping the flag auto-enables the button.
  - Plan 31 Phase 4 added `data/capability-status.ts` (+ web twin) whose DM entry derives from `DM_MESSAGES_SURFACE_AVAILABLE`; flipping the flag in Phase 5 auto-updates the "What works today" page to show DMs live. No extra edit needed there.

---

## Business Context

### Why This Feature Exists

Meerkat's Messages tab is a primary navigation destination whose entire job — private 1:1 and group conversations — is currently an honest dead-end: every "Message" button opens an informational Alert and no thread screen, DM store, or send path exists (`/tmp/meerkat-map/m-messages-friends.md` §"Honest DM verdict"; `apps/meerkat/app/(root)/data/friends-core.ts:13` hard-codes `canMessage: false`). A paid social app cannot ship a non-functional primary tab. The pairing, SAS trust, sealed mailbox, group-epoch-key, and signed-message machinery that DMs need is already real and tested in `@mylife/sync`; the gap is purely that no DM surface was built on top of it. This plan closes that gap completely — 1:1 and group — without faking a single byte of delivery.

### Competitor Landscape — whose users this wins

This wins **Signal users frustrated by phone-number identity and no real self-host**, and **WhatsApp / Telegram leavers who distrust a central operator**. Meerkat's wedge: Signal-grade E2EE DMs with **no phone number, no central account server, optional self-hosting, and honest delivery state** (never a faked "Delivered"/online dot). Briar/Session users get the decentralization they want in a mainstream-usable, cross-device app.

| Competitor | Has 1:1 + Group E2EE DM? | Identity model | Self-host? | Honest delivery state? | Meerkat's edge |
|-----------|--------------------------|----------------|-----------|------------------------|----------------|
| Signal | Yes (free) | Phone number, central servers | No | Receipts on, but central metadata | No phone number; friend-code + SAS; self-hostable mailbox |
| WhatsApp (Meta) | Yes (free) | Phone number, Meta servers | No | Read receipts; heavy metadata | No Meta; ciphertext-only relay sees no identities |
| Telegram | Group not E2EE; 1:1 opt-in only | Phone number, cloud | No | Cloud-stored | E2EE by default for all DMs; nothing cloud-stored in clear |
| iMessage | Yes | Apple ID, Apple servers | No | Read receipts | Cross-platform, Apple-free, self-host |
| Session | Yes (decentralized) | Random ID | Partial (Oxen) | No receipts | Cross-device sync, SAS, usable mainstream UX |
| Briar | Yes (P2P) | Local | Inherent | No receipts | Relay TTL mailbox for offline catch-up, web client |

### Target User

A privacy-motivated person (10-40, global) who already pairs a friend in Meerkat and taps "Message" expecting a conversation. Migration path: they keep WhatsApp/Signal for now, pair one friend in Meerkat over a friend code, and find a real E2EE thread that honestly says "Sent" until a signed receipt proves "Delivered" — the honesty itself is the differentiator. Group DMs win small trust-circles (families, activist cells, founders) who want a group chat no operator can read or enumerate.

---

## Current-State Grounding (what exists vs net-new, with file:line)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| Pair-private mailbox seal/open (v2, identities inside the box, pair-private token) | `packages/sync/src/protocol/mailbox.ts:48-199` |
| Mailbox drain job (honest counts, fail-closed, never reports undelivered) | `packages/sync/src/protocol/mailbox-drain.ts:185-353` |
| ONE kind-dispatcher (open+verify once, route by inner kind, unknown→rejected) | `packages/sync/src/protocol/mailbox-dispatch.ts:145-177` |
| Channel-message-over-mailbox SEND pattern (sibling for DM delivery) | `packages/sync/src/protocol/channel-mailbox.ts:94-135` |
| Signed, HLC-ordered, edit/delete-via-supersedes message events | `packages/sync/src/protocol/channel-message.ts:38-249` |
| File request/grant over mailbox (verify-then-pin attachment re-send) | `packages/sync/src/protocol/file-request-mailbox.ts:204-549` |
| Group/epoch keys: commit mints secret, wraps per member, removal = no wrap | `packages/sync/src/protocol/group-keys.ts:190-417` |
| Per-entity crypto-shredding (disappearing/sensitive rows) | `packages/sync/src/protocol/entity-keys.ts:40-131` |
| Owner→joiner key-handoff over mailbox (sibling for DM-group commit handoff) | `packages/sync/src/protocol/join-handoff-mailbox.ts:84-90` |
| SAS 5-emoji trust + engine-enforced gate | `packages/sync/src/protocol/sas.ts:25-78`; `inbound-policy.ts:140-146` |
| Signed revocation (block) | `SyncProvider.tsx:1178-1191` |
| Send-side park pattern (write a row ONLY on real `queued>0`) | `apps/meerkat/.../SyncProvider.tsx:466-532` |
| Shared drain-handler builder (foreground + background cannot drift) | `apps/meerkat/.../SyncProvider.tsx:886-909` |
| AttachmentCard (live presence, View/Save/Remove/Report, request-again) | `apps/meerkat/app/(root)/components/AttachmentCard.tsx` |

### Net-new (this plan builds)

- 5 new PURE protocol files in `packages/sync/src/protocol/`: `dm-message.ts`, `dm-mailbox.ts`, `dm-receipt.ts`, `dm-group.ts`, `dm-group-handoff-mailbox.ts`.
- Extensions to `mailbox-dispatch.ts` (3 new handler slots: `dmMessage`/`dmReceipt`/`dmGroupCommit`; +1 optional `dmShred` slot in Phase 8) and `mailbox-drain.ts` (matching counters). `sealDmDirect` is multi-recipient (fan-out per peer device + per own-device link); no new wire field (NC-8).
- New RN-safe exports from `packages/sync/src/index.ts` + `index.native.ts`.
- New local-only `dm_` schema + core in `apps/meerkat/app/(root)/data/dm-core.ts` and `apps/meerkat-web/src/lib/dm-core.ts` (parity), including `dm_own_devices` (own-device mirror targets) and per-device `dm_participants`.
- SyncProvider (mobile) + MeerkatProvider (web): `queueDmMessage`, `queueDmReceipt`, `createDmGroup`, `dmGroupAddMember`, `dmGroupRemoveMember`, `linkOwnDevice` + the own-device mirror fan-out (re-seal message/verified-receipt to own devices), and the new drain handlers wired into the SHARED `buildDrainHandlers` (so background drain gets DMs + own-device convergence too).
- `(root)/_layout.tsx`: 3 explicit `Stack.Screen` entries for the new dm routes (the (root) Stack registers every detail route).
- Mobile screens: conversation list (Messages tab rebuild), thread `dm/[conversationId].tsx`, new-DM / new-group composer, group-info.
- Web views: conversation list + thread pane (replace `MessagesView.tsx` dead-end), composer, group-info — full parity.
- The dead-end copy/affordances are REMOVED: `friends-core.ts:13,23-24,42-44` (`canMessage:false` etc.) and the "Message unavailable" Alerts in `messages.tsx`, `friends.tsx`, `MessagesView.tsx`.

### Current dead-end being replaced (delete on landing)

- `apps/meerkat/app/(root)/(tabs)/messages.tsx:28-90` (hero "not built", status rows "Unavailable"/"Not built", `explainUnavailable` Alert, honest footer).
- `apps/meerkat/app/(root)/(tabs)/friends.tsx:115-120,279-282,325` (Message Alert + footer notice).
- `apps/meerkat/app/(root)/data/friends-core.ts:13-14,23-24,42-44` (`canMessage:false`, `messageLabel`, reason).
- `apps/meerkat-web/src/ui/messages/MessagesView.tsx:34-100` (explainDm + "Not built yet").
- `apps/meerkat-web/src/lib/friends-core.ts` (web `DIRECT_MESSAGE_UNAVAILABLE_REASON` + `canMessage:false`).

---

## Technical Context

### Where this lives

```
packages/sync/src/protocol/
  dm-message.ts              -- NET-NEW: signed DM event (conversationId), order, resolve, edit/delete
  dm-mailbox.ts              -- NET-NEW: DM_MESSAGE kind; 1:1 direct + group epoch-sealed; attachment blocks
  dm-receipt.ts              -- NET-NEW: signed delivered/read receipt event + DM_RECEIPT mailbox kind
  dm-group.ts                -- NET-NEW: SignedDmGroupDescriptor (members/admins/epoch), sign/verify, membership commits over group-keys
  dm-group-handoff-mailbox.ts-- NET-NEW: DM_GROUP_COMMIT kind; per-member descriptor + key-wrap handoff (sibling of join-handoff)
  mailbox-dispatch.ts        -- EXTEND: dmMessage / dmReceipt / dmGroupCommit handler slots + routing
  mailbox-drain.ts           -- EXTEND: dmMessages / dmReceipts / dmGroupCommits counters
packages/sync/src/index.ts, index.native.ts -- EXPORT new pure symbols (RN-safe; no node:crypto/net at import)

apps/meerkat/app/(root)/
  data/dm-core.ts            -- NET-NEW: dm_ DDL (incl. dm_own_devices) + local CRUD + merge + receipt ledger + own-device fan-out targets (LOCAL-ONLY, never in a sync policy)
  providers/SyncProvider.tsx -- EXTEND: queueDmMessage/queueDmReceipt/createDmGroup/dmGroup{Add,Remove}Member + linkOwnDevice + own-device mirror fan-out + 4 drain handlers (dmMessage/dmReceipt/dmGroupCommit/dmShred)
  data/background-sync.ts    -- EXTEND: include DM handlers so offline catch-up delivers DMs
  _layout.tsx                -- EDIT: register the new dm/* detail routes as explicit Stack.Screen entries (the (root) Stack registers every detail route; see below)
  (tabs)/messages.tsx        -- REBUILD: conversation list (real threads), unread, new-DM/new-group entry
  dm/[conversationId].tsx    -- NET-NEW (hidden route): thread screen (compose/send/edit/delete/attach/receipts)
  dm/new.tsx, dm/[conversationId]/info.tsx-- NET-NEW: new conversation composer, group info/members
  (tabs)/friends.tsx, data/friends-core.ts -- EDIT: "Message" opens the real thread; remove dead-end copy

apps/meerkat-web/src/
  lib/dm-core.ts             -- NET-NEW: parity of dm-core (better-sqlite3 / same row shapes)
  lib/MeerkatProvider.tsx    -- EXTEND: same queue/drain methods (parity)
  ui/messages/MessagesView.tsx -- REBUILD: conversation list + thread pane + composer + group info
  lib/friends-core.ts        -- EDIT: remove dead-end; wire Message → open thread
```

### Route registration (`apps/meerkat/app/(root)/_layout.tsx`) — REQUIRED

The `(root)` layout is a `Stack` that explicitly registers EVERY detail route (today: `(tabs)`, `pinned/[id]`, `sync` — verified at `_layout.tsx:21-23`). Expo Router will not surface the new dm routes unless they are added here. Add three `Stack.Screen` entries inside `AppStack`:

```tsx
<Stack.Screen name="dm/[conversationId]" />
<Stack.Screen name="dm/new" options={{ presentation: 'modal' }} />
<Stack.Screen name="dm/[conversationId]/info" />
```

(The dm files live under `(root)/dm/`, siblings to `(tabs)`, matching the existing `pinned/` and `sync.tsx` placement.)

### Parity gate extension (`scripts/check-meerkat-parity.mjs`) — REQUIRED for TC-10

The current parity script (`scripts/check-meerkat-parity.mjs`) checks a FIXED file list — the five tab screens + `pinned/[id]` + config/providers — and asserts NOTHING about DMs, so "parity passes" today proves nothing about this feature. This plan EXTENDS it (Phase 9) with:

1. `ensureFile` for: `apps/meerkat/app/(root)/data/dm-core.ts`, `apps/meerkat/app/(root)/dm/[conversationId].tsx`, `apps/meerkat/app/(root)/dm/new.tsx`, `apps/meerkat/app/(root)/dm/[conversationId]/info.tsx`, `apps/meerkat-web/src/lib/dm-core.ts`.
2. `ensureContains` for the registered routes: `(root)/_layout.tsx` contains `name="dm/[conversationId]"`.
3. `ensureContains` for the rebuilt surfaces: `messages.tsx` no longer contains `explainUnavailable`; `MessagesView.tsx` no longer contains `"Not built yet"`; `friends-core.ts` (both) no longer contains `canMessage: false`.
4. A repo-wide zero-hit assertion for `DIRECT_MESSAGE_UNAVAILABLE_REASON` (the honesty grep gate from Risk #2).
5. **Route-vs-pane parity definition:** mobile is Expo stack-routed (`dm/[conversationId]` is a pushed screen); web is a single-pane SPA where the thread is a `MessagesView` pane, not a URL route. Parity here means **feature/state parity, not URL parity**: for each mobile dm route there is a named web pane that renders the same 5 states and calls the same `@mylife/sync` functions + the same `dm-core` row shapes. The `route-parity-validator` skill is run with this mapping (`dm/[conversationId]` ↔ thread pane, `dm/new` ↔ new-message sheet, `dm/[conversationId]/info` ↔ group-info pane); it asserts the mapping exists, not that the SPA grew Expo routes.

### Wireframe position

```
Messages tab
  └── Conversation list (1:1 + groups, unread badges, "Sent/Delivered/Read" honest state)
       ├── New message  → pick a paired friend → 1:1 thread
       ├── New group    → pick 2-7 paired friends → group thread          ← YOU ARE HERE
       └── [conversation row] → Thread screen
                                 ├── compose / send / edit / delete / attach
                                 ├── per-message honest receipt line
                                 └── group: members, add/remove, rotate keys, block/report
Friends tab → friend card "Message" → opens/creates the 1:1 thread (same destination)
```

### Data Model — local-only `dm_` tables (prefix `dm_`)

**Security boundary (Critical):** `dm_` is **deliberately absent** from `MEERKAT_SYNC_PREFIXES` (`apps/meerkat/app/(root)/data/sync-core.ts:51-55`) and from every `ModuleSyncPolicy` in `MEERKAT_SYNC_POLICIES` (`sync-core.ts:57-70`). Therefore `applyReceivedDocumentChanges` (MK-002) resolves any inbound `dm_` row to scope `device_local` and **rejects it fail-closed** (`packages/sync/src/protocol/inbound-policy.ts:126-127`, `reason: 'scope_device_local'`). This is the same pattern that keeps `cm_file_requests` local-only (`community-core.ts:56-61`). The consequence is the entire DM honesty boundary: **DM rows can NEVER enter via a community/workspace replication session, and can NEVER leak into a community feed.** The ONLY ingress is the verified DM mailbox handlers below.

```sql
-- A conversation. 1:1 id is deterministic from both IDENTITY ANCHORS (so all of
-- either party's devices share one id); group id is minted.
CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,                       -- 1:1: dmConversationId(anchorA, anchorB); group: random 32-hex
  kind TEXT NOT NULL CHECK (kind IN ('direct','group')),
  title TEXT,                                -- group title; null for 1:1 (UI derives from peer name)
  group_workspace_id TEXT,                   -- group: backing sync_workspaces row for epoch keys; null for 1:1
  admin_device_id TEXT,                      -- group: descriptor author/admin; null for 1:1
  current_epoch INTEGER NOT NULL DEFAULT 0,  -- group: mirrors sync_workspaces.current_key_version; 0 for 1:1
  descriptor_json TEXT,                      -- group: the latest SignedDmGroupDescriptor (verified before store)
  feed_opt_in INTEGER NOT NULL DEFAULT 0,    -- per-conversation "feed source" opt-in (read by public-social plan; nothing auto-includes)
  archived INTEGER NOT NULL DEFAULT 0,
  muted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Membership, tracked PER DEVICE (multi-device addressing). 1:1 = 2+ rows (one per
-- known device of each party); group = N+ rows. removed_at set on removal.
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  identity_anchor TEXT NOT NULL,             -- the party's stable identity-bundle key; groups this party's devices
  is_self INTEGER NOT NULL DEFAULT 0,        -- 1 = one of THIS user's own linked devices (own-device mirror target)
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  dh_public_key TEXT NOT NULL,               -- pinned from the participant's signed identity bundle
  joined_at TEXT NOT NULL,
  removed_at TEXT,
  PRIMARY KEY (conversation_id, device_id)
);

-- This user's OWN linked devices (own-device DM mirror targets). Populated when the
-- user links a second device they own (a normal Meerkat pairing flagged self); the
-- pair secret already exists, so resolvePairedSecret(device_id) seals to it. LOCAL-ONLY.
CREATE TABLE IF NOT EXISTS dm_own_devices (
  device_id TEXT PRIMARY KEY,
  identity_anchor TEXT NOT NULL,             -- this user's own anchor (all own devices share it)
  dh_public_key TEXT NOT NULL,
  linked_at TEXT NOT NULL
);

-- Signed, immutable message events (edits/deletes are new events via supersedes_id).
CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,                        -- content hash of the signed canonical form (dmMessageId)
  conversation_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  hlc_wall TEXT NOT NULL,
  hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT,
  supersedes_deleted INTEGER,
  intent TEXT,                               -- 'message' | 'react' (reserved; same shape as channel intents)
  signature TEXT NOT NULL,                   -- Ed25519 over canonical 'meerkat-dm-message-v1' form
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS dm_messages_conv
  ON dm_messages (conversation_id, hlc_wall, hlc_counter, author_device_id);

-- Attachment metadata (bytes live in ExpoBlobStore / web blob store, keyed by blob_hash).
CREATE TABLE IF NOT EXISTS dm_message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  blob_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

-- THE ONLY source of receipt UI. One row per (message, recipient). Updated ONLY on a
-- real park (parked) or a real signed receipt (delivered/read) or a real failure (failed).
CREATE TABLE IF NOT EXISTS dm_delivery (
  message_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','parked','delivered','read','failed')),
  state_at TEXT NOT NULL,
  receipt_sig TEXT,                          -- the recipient's signature backing 'delivered'/'read' (auditable proof)
  PRIMARY KEY (message_id, peer_device_id)
);

-- Local unread tracking + read-receipt trigger point (this device's own last-read HLC).
CREATE TABLE IF NOT EXISTS dm_read_state (
  conversation_id TEXT PRIMARY KEY,
  last_read_hlc_wall TEXT NOT NULL DEFAULT '',
  last_read_hlc_counter INTEGER NOT NULL DEFAULT 0,
  read_receipts_enabled INTEGER NOT NULL DEFAULT 1  -- per-conversation; global default in mk_settings
);

-- Local-only report ledger (block reuses sync_device_revocations; report is local + group-admin review).
CREATE TABLE IF NOT EXISTS dm_reports (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  reported_device_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
```

**Sensitive/disappearing path (corrected — no entity-key policy reuse).** `entityRequiresContentKey(policy, table)` returns **`false` whenever `policy` is `undefined`** (`entity-keys.ts:44`), and `dm_` is **deliberately absent from every `ModuleSyncPolicy`** (no `dm` entry in `MEERKAT_SYNC_POLICIES`, `sync-core.ts:57-70`). So that API can NEVER recognize a `dm_` table, and `entity-keys.ts` crypto-shredding (which is keyed by `{moduleId, tableName, rowId}` and only fires for `isSensitive`/disappearing *policy* tables that actually replicate) does NOT apply to DMs. Do not claim it does. Because DMs never replicate via a session, DM confidentiality is achieved entirely by the **mailbox seal in flight** (1:1 = pair-private seal; group = epoch content key under the mailbox seal) **+ platform secure store at rest** (the same `expo-secure-store` / SQLCipher-class store Meerkat already uses for device keys). The optional disappearing-message TTL is therefore NOT an `entity-keys.ts` shred; it is a **DM-specific signed shred event** — a new `DM_SHRED` mailbox kind (sibling of `DM_RECEIPT`, signed by the author over a `meerkat-dm-shred-v1` canonical form) that instructs each recipient to delete the local `dm_messages` row + any cached blob and overwrite-then-delete the row. It is honest about its boundary: until a peer drains the shred it can still read its locally-stored copy (same local-first caveat documented in `entity-keys.ts:14-21`), and the relay's mailbox TTL purge is the only guarantee for never-drained copies. This shred path is the Phase 8 disappearing-message extension; it reuses no entity-key policy hook.

### Dependencies

- **Internal:** `@mylife/sync` (all DM crypto/protocol), `@mylife/db` (`DatabaseAdapter`), `@mylife/ui` (Open Burrow tokens via `MK_PALETTES`), the existing blob store (`ExpoBlobStore` mobile / web blob store) for attachments.
- **External:** none new. Same `tweetnacl` primitives the package already vendors. No new native module.
- **Cross-surface:** mobile + web call the SAME pure `@mylife/sync` functions, guaranteeing identical canonical forms, signatures, and conversation ids, which is what lets a phone and a browser converse.

---

## Protocol / Engine Changes (`@mylife/sync`) + Security Analysis

All new files are PURE (`protocol/`): no IO, no platform deps, injected backends only — so they export cleanly from `index.native.ts` (the package CLAUDE.md RN-safe rule).

### 1. `protocol/dm-message.ts` (pure)

Mirrors `channel-message.ts` but conversation-scoped, with its OWN domain-separation string.

```ts
export interface DmMessageAttachment { id; blobHash; name; mimeType; size; }   // identical shape to ChannelMessageAttachment
export interface DmMessageEvent {
  version: 1; id; conversationId; authorDeviceId; body;
  attachments?: DmMessageAttachment[]; hlc: Hlc;
  supersedes?: { id; deleted };           // edit/delete
  intent?: 'message' | 'react';
  signature;                               // Ed25519 over canonical 'meerkat-dm-message-v1' form
}
export function dmConversationId(identityAnchorA: string, identityAnchorB: string): string; // sha512(sort([a,b])).slice(0,32) over IDENTITY ANCHORS (the pinned identity-bundle key behind each friend code), NOT device keys — so every device of either party computes the SAME id (multi-device convergence). Single-device users: anchor === device key, reducing to today's behavior with zero change.
export function createDmMessage(author: DeviceIdentity, input): DmMessageEvent;
export function verifyDmMessage(e: DmMessageEvent): boolean;
export function compareDmMessages(a, b): number;     // (wall, counter, author, id) — deterministic total order
export function resolveDmMessages(events): DmMessageEvent[]; // edits keep slot; deletes remove slot
// nextHlc is REUSED from channel-message.ts (exported) — no duplication.
```

**Security analysis.** The canonical signing prefix is `meerkat-dm-message-v1`, distinct from `meerkat-channel-message-v1/2` (`channel-message.ts:91`). A DM event's signature therefore CANNOT validate as a channel event and vice versa — cross-surface confusion (a DM rendered as a community post, or a community post injected as a DM) is **cryptographically impossible**, not merely a UI convention. `id` = hash of signed canonical form + signature, so the row id is self-certifying (tamper → id mismatch → rejected, mirroring `channelMessageId`). HLC ordering is identical to the proven channel path.

### 2. `protocol/dm-mailbox.ts` (pure) — DM delivery

Sibling of `channel-mailbox.ts`. One kind, two variants:

```ts
export const DM_MESSAGE_MAILBOX_KIND = 'meerkat.dm-message-v1';

// 1:1 variant — events sealed straight to the peer (mailbox seal IS the content seal).
export interface DmDirectMailboxPayload { kind; version:1; conversationId; mode:'direct'; events: DmMessageEvent[]; blocks?: BlobDataPayload[]; }

// group variant — events + attachment blocks sealed under the epoch content key first,
// then the SealedEntityPayload is fanned out to each member's pair-private mailbox.
export interface DmGroupMailboxPayload { kind; version:1; conversationId; mode:'group'; epoch:number; sealed: SealedEntityPayload; }

// 1:1 fans out to EVERY known device of the peer anchor (multi-device addressing) — one sealed envelope per device.
export function sealDmDirect(input /* recipients: { deviceId, dhPublicKey, pairSecret }[] */): { perRecipient: { deviceId; token; envelope }[]; eventCount } | { ok:false; reason };
export function sealDmGroup(input /* + epochContentKey, memberDevices[] */): { perMember: { deviceId; token; envelope }[]; eventCount };
export function openDmMailbox(recipient, envelope): { ok:true; senderDeviceId; conversationId; mode; events; blocks? } | { ok:false; reason };
```

- 1:1: `sealMailboxDelta` to EACH `{deviceId, dhPublicKey}` device of the peer anchor (one envelope per device, token `deriveMailboxToken(pairSecret, recipient.deviceId)`) — VERBATIM the channel pattern, fanned. A peer running phone+web receives on both; `dm_delivery` carries one row per recipient device (honest per-device state).
- group: events + blocks → `sealEntityPayload(deriveEpochContentKey(secret, workspaceId, epoch), {events, blocks})` (entity-keys.ts:109), then fan-out one `sealMailboxDelta` envelope per current member addressed by each member's pair-private mailbox token. **Double-sealed:** mailbox seal (transport metadata privacy) over epoch seal (membership-gated, crypto-shreddable). A removed member, lacking epoch N+1's wrap, cannot read messages sent under epoch N+1 even if it receives the ciphertext — **forward secrecy by exclusion**, reusing `group-keys.ts` exactly.
- Attachment bytes ride as `BlobDataPayload[]` (`splitBlobForTransfer`, `blob-transfer.ts`), verify-then-pin on receipt (`blobContentHash(bytes) === event.attachment.blobHash`), reusing `assembleGrantBlocks` from `file-request-mailbox.ts:425`. Over the per-blob cap → the message sends with metadata only and the recipient pulls bytes via a DM file-request (below).

**Security analysis.** Group content confidentiality is gated by the epoch key, not the channel — security lives in the payload (mesh-sync invariant). The mailbox host still sees only a 64-hex token and a ciphertext size per member (`mailbox.ts:1-22`). The sender's identity and the conversationId live INSIDE the sealed box, so the relay cannot enumerate a group or attribute traffic. Fan-out is O(members) wraps — fine at the relay's 8-peer cap (`group-keys.ts:20-27`); the honest ceiling (max group size) is surfaced in UI and is the billing lever for the monetization plan.

### 3. `protocol/dm-receipt.ts` (pure) — the HONEST receipt proof

```ts
export const DM_RECEIPT_MAILBOX_KIND = 'meerkat.dm-receipt-v1';
export interface DmReceiptEvent {
  version:1; conversationId; messageId; recipientDeviceId;
  state: 'delivered' | 'read'; at; signature;   // Ed25519 over 'meerkat-dm-receipt-v1' canonical form
}
export function createDmReceipt(recipient: DeviceIdentity, input): DmReceiptEvent;
export function verifyDmReceipt(e): boolean;
export function sealDmReceipt(...): { token; envelope };  // sealed back to the SENDER's pair-private mailbox
export function openDmReceiptMailbox(recipient, envelope): { ok; senderDeviceId; payload } | { ok:false; reason };
```

**The receipt model (Critical honesty rule).** A `delivered` receipt is emitted by the recipient's device ONLY after `openDmMailbox` verified and `mergeDmEvents` actually inserted the message into `dm_messages` — i.e. the bytes truly landed. A `read` receipt is emitted ONLY when the user opens the thread and the message is rendered, AND only if `read_receipts_enabled` for that conversation. Each receipt is an Ed25519-signed event sealed back to the sender's pair-private mailbox; the sender's NEXT drain verifies the signature (`verifyDmReceipt`) and only then writes `dm_delivery.state = 'delivered'|'read'` with `receipt_sig` stored as auditable proof. **Until a real signed receipt arrives, the sender UI shows "Sent" (real park) or "Sending…"/"Not sent" — never "Delivered" or "Read".** This is exactly the IdentityInfoModal promise: *"it will not say a message was delivered or read unless the real proof arrived"* (`IdentityInfoModal.tsx:49`).

**Security analysis.** A receipt is unforgeable: the signature is over the recipient's own device key, so a relay or a third member cannot fabricate a "delivered". A malicious recipient could WITHHOLD a receipt (sender stays "Sent") but cannot forge an earlier/false one — withholding degrades to the honest lower state, never an overclaim. Read-receipt suppression is honored at the EMIT side (below the UI), so disabling read receipts is a real privacy guarantee, not a UI hide.

### 3b. Multi-device addressing + own-device DM mirror (the REAL cross-device path)

**Problem (honest framing).** `dm_` is `device_local` (absent from every `ModuleSyncPolicy`, `sync-core.ts:57-70`) and Meerkat app data has **no personal-replica multi-device egress** — `sync-core.ts:50` states *"mk_ tables stay device-local by omission"* and `mp_pad` is the ONLY table replicated at `personal_replica` scope (`sync-core.ts:61`). The mailbox drain is single-consumer: a message drained on the phone does NOT also land on web. So AC-13 is NOT free — it must be **built**, and it must be built WITHOUT a community/workspace session (which would violate NC-1). This plan designs the real path; it does not hand-wave to a non-existent "personal-replica DM sync."

**Design — two honest mechanisms, both over the EXISTING verified mailbox (no new session, no policy, `dm_` stays `device_local`):**

1. **Recipient multi-device addressing.** A friend's identity anchor may have several paired devices (distinct device keys advertised in their signed identity bundle / pinned on pairing). `sealDmDirect` fans out one sealed envelope per known peer device; the group path fans per member-device. `dm_participants` (PK `(conversation_id, device_id)`, plus a new `identity_anchor` column) holds one row per known device per party, so the per-device fan-out and per-device `dm_delivery` rows are real, not assumed.

2. **Own-device DM mirror (own paired devices converge).** The user explicitly **links their own second device** — a normal Meerkat pairing flagged self, recorded in the new local `dm_own_devices` table (device key + dh key; the pair secret already exists from that pairing, so `resolvePairedSecret(ownDeviceId)` seals to it exactly like a friend). The egress then fans a sealed copy to every own-device link for THREE events:
   - every outbound `DmMessageEvent` (so the web tab sees what the phone sent),
   - every inbound message AFTER `mergeDmEvents` (so a message drained on the phone also reaches the web — closing the single-consumer gap), and
   - every **verified** inbound `DmReceiptEvent` — the SIGNED receipt is re-sealed to own devices; each own device independently re-runs `verifyDmReceipt` and writes the identical `dm_delivery` row with the same `receipt_sig`. **The proof travels; no device ever invents a state.** Own devices reach "Delivered"/"Read" only by re-verifying the same signature the originating device verified.

   All three ride the EXISTING `DM_MESSAGE` / `DM_RECEIPT` mailbox kinds. There is **no new session, no new policy, and no new wire field** — `dm_` never enters via a replication session, so the ONLY ingress remains the verified DM mailbox handlers and **NC-1 holds (and is reinforced): even own-device convergence does not relax the fail-closed `device_local` reject.**

**Honesty + leak analysis.** Own-device convergence is per-real-row: a mirrored message is a real signed `DmMessageEvent` re-verified on arrival; a mirrored receipt is a real signed `DmReceiptEvent` re-verified on arrival. Idempotency on `dm_messages.id` / `(message_id, peer_device_id)` means re-mirrors insert 0. The relay still sees only token + ciphertext size per envelope, so own-device fan-out leaks no more than friend delivery (NC-4). If the user has NOT linked a second device, `dm_own_devices` is empty and the mirror is a genuine no-op — the UI then states per-device honesty ("This conversation is on this device") rather than implying convergence that is not configured.

### 4. `protocol/dm-group.ts` (pure) — group membership over epoch keys

```ts
export interface SignedDmGroupDescriptor {
  version:1; conversationId; title; adminDeviceId; epoch;
  members: { deviceId; dhPublicKey; role }[];
  createdAt; signature;                 // Ed25519 by adminDeviceId over canonical form
}
export function createDmGroupDescriptor(admin, input): SignedDmGroupDescriptor;
export function verifyDmGroupDescriptor(d): boolean;          // admin signature + binding
export function dmGroupAdd(db, { admin, descriptor, added }): { descriptor; commit: GroupCommitResult };
export function dmGroupRemove(db, { admin, descriptor, removedDeviceId }): { descriptor; commit: GroupCommitResult };
// NOTE: these helpers DELIBERATELY take NO `recordChange` param. They call createGroupCommit/
// commitMemberAdd/commitMemberRemoval with recordChange = undefined, so a dm_group commit writes
// ZERO change-tracker rows and its sync_workspace_keys wraps NEVER enter outbound sync (NC-9).
```

A group DM is backed by a `sync_workspaces` row with **`workspace_type = 'dm_group'`** (the real column is `workspace_type`, values like `'community'`; `createWorkspace`/`addWorkspaceMember`/`addWorkspaceKey` are DB query helpers in `packages/sync/src/db/queries.ts:643/703`, NOT `protocol/` functions — do not conflate `sync_workspaces.workspace_type` with the plan's own local `dm_conversations.kind` column) + `sync_workspace_members` + `sync_workspace_keys`, so membership add/remove are **real epoch commits** via `commitMemberAdd` / `commitMemberRemoval` (`group-keys.ts:348-417`) — VERBATIM. Removal mints a new epoch wrapped for everyone except the removed device; `historyScope: 'join_point'` is the DEFAULT for DM groups (a newcomer reads from join forward only — no back-wrap of prior history, the privacy-preserving default). The admin can opt a newcomer into `'full'` history explicitly.

**Security analysis (incl. the `sync_workspace_keys` metadata-leak path — Critical).** Key rotation on remove is genuine, not an integer bump: post-removal traffic under epoch N+1 has no wrap for the removed device (`group-keys.ts:401-417` acceptance). The descriptor is admin-signed; a member cannot rewrite membership.

The subtle leak: outbound sync is change-log-driven — `changeTracker.getUnsyncedByModule(moduleId)` (`crdt/change-tracker.ts:177`) filtered by `canSendTableAtScope` (`protocol/sync-session.ts:1692-1693`), and `sync_workspace_keys` **IS a synced table at `shared_workspace` scope** under module `communitykeys` / `KEYS_SYNC_POLICY` (`sync-core.ts:42-48,57-70`). So if a `dm_group` commit ever records a change for its key-wrap rows, those wraps — and thus the dm_group's existence + member device IDs — would replicate to a user's COMMUNITY co-members over an unrelated shared session. Mitigation (enforced, not aspirational): the DM group helpers pass **no `recordChange`** (above), so `commitMemberAdd`/`commitMemberRemoval`/`createGroupCommit` write zero change-tracker rows; the `dm_group` workspace is NEVER joined to a community session; and its wraps are distributed ONLY via the explicit per-member `DM_GROUP_COMMIT` handoff (next). This is asserted by **NC-9 + a negative test** (a `dm_group` commit followed by `getUnsyncedByModule('communitykeys')` returns the SAME count as before the commit — zero new syncable rows).

### 5. `protocol/dm-group-handoff-mailbox.ts` (pure) — commit distribution

Sibling of `join-handoff-mailbox.ts`. `DM_GROUP_COMMIT_KIND = 'meerkat.dm-group-commit-v1'` carries, sealed per recipient member: the new `SignedDmGroupDescriptor` + the recipient's `keyWrapToSyncedRow` rows (`group-keys.ts:71`) + the admin's signed identity bundle. The recipient re-verifies the descriptor signature, pins the admin, and stores its wrap via `storeReceivedKeyWrap(db, wrap, recipient)` (`group-keys.ts:303-323`) — which already defends against epoch fast-forward and self-wrap poisoning. Token derivation mirrors `deriveCommunityJoinToken` but scoped `meerkat-dm-group-v1:<conversationId>:<recipientDeviceId>`.

### 6. `mailbox-dispatch.ts` (extend)

Add three handler slots and routes (`mailbox-dispatch.ts:75-177`), following the existing fail-closed pattern (kind read only AFTER `openMailboxDelta` verifies; unknown → `{kind:'rejected'}`):

```ts
dmMessage?: (senderDeviceId, payload: DmMailboxPayload, createdAt) => Promise<boolean> | boolean;     // → 'dm-message'  (friend delivery + own-device mirror, same kind)
dmReceipt?: (senderDeviceId, payload: DmReceiptEvent, createdAt) => Promise<boolean> | boolean;        // → 'dm-receipt'  (verified receipt; mirrored to own devices re-verified)
dmGroupCommit?: (senderDeviceId, payload, createdAt) => Promise<boolean> | boolean;                    // → 'dm-group-commit'
dmShred?: (senderDeviceId, payload: DmShredEvent, createdAt) => Promise<boolean> | boolean;            // → 'dm-shred'  (OPTIONAL, Phase 8 disappearing extension; author-signed delete)
```

### 7. `mailbox-drain.ts` (extend)

Add `dmMessages`, `dmReceipts`, `dmGroupCommits` counters (plus `dmShreds` when the Phase-8 disappearing extension lands) to `MailboxDrainPeerResult` + `MailboxDrainJobResult` + `foldInto` + the `switch` (`mailbox-drain.ts:99-353`). No new transport, no new wire field — the drain still sees only tokens + ciphertext sizes. The own-device mirror uses the SAME `DM_MESSAGE`/`DM_RECEIPT` kinds (no extra kind), so own-device convergence adds no new drain surface.

### 8. Exports

`src/index.ts` + `src/index.native.ts`: export every new pure symbol. Verify the native barrel has no `node:*` import at module load (package CLAUDE.md gotcha).

---

## Functional Requirements

### User Stories

1. As a paired user, I tap "Message" on a friend and get a real 1:1 thread where I can type, send, and see my message land, so I can have a private conversation.
2. As a sender, I see "Sent" when my message really parked, and "Delivered"/"Read" ONLY when a signed proof arrived, so I trust the status.
3. As a recipient who was offline, I open Meerkat and my friend's messages are there (drained from the mailbox), so a sleeping phone catches up.
4. As a group creator, I pick 2-7 paired friends, name the group, and everyone gets a real E2EE group thread.
5. As a group admin, I add/remove members and the keys rotate so a removed member cannot read anything sent after removal.
6. As a sender, I edit or delete my own message and recipients see the edit/tombstone.
7. As a user, I attach a photo/file to a DM and the recipient receives and verifies the bytes.
8. As a user, I block or report someone from a DM and the block is a real local revocation.
9. As a privacy-minded user, I turn off read receipts for a conversation and my reads truly stop emitting proofs.
10. As a user, my DMs never appear in any public feed unless I explicitly opt that conversation in.

### Behavior Specification (1:1 send, the spine)

1. User taps "Message" on a friend card (`friends.tsx`) or "New message" in Messages. App computes `dmConversationId(selfAnchor, peerAnchor)` (identity anchors), upserts a `dm_conversations` (kind `direct`) + one `dm_participants` row per known device of each party (`identity_anchor` set; `is_self=1` on own devices), opens `dm/[conversationId]`.
2. User types and taps Send. App: `createDmMessage(identity, {conversationId, body, attachments, hlc: nextHlc(seen, now)})`, inserts the local `dm_messages` row immediately, renders it with state **"Sending…"** (a `dm_delivery` row `queued` per recipient device).
3. App resolves each target device's pair secret (`resolvePairedSecret`, `SyncProvider.tsx:546`) — every known peer device PLUS every `dm_own_devices` link (own-device mirror) — and the relay URL. If revoked/not paired/no relay → message stays local, state flips to **"Not sent"** with the honest reason; a Retry affordance re-parks.
4. `sealDmDirect` fans one envelope per target device → `WebSocketRelayBackend.connect(relayUrl, token)` → `session.send(encodeMailboxEnvelope(envelope))`. On real `queued>0` for a device, that device's `dm_delivery.state = 'parked'`; UI shows **"Sent"** once at least one real park lands. On park failure → `failed`; UI **"Not sent — couldn't reach a connection server."** (No row claims sent without a real park — the `SyncProvider.tsx:513-527` discipline.)
5. Recipient drains (foreground open / background): `openDmMailbox` verifies + `mergeDmEvents` inserts → the message appears in the recipient thread. The recipient device emits `createDmReceipt(state:'delivered')`, seals it to the sender's mailbox. The sender's other own devices receive the mirrored copy the same way and converge.
6. Sender's next drain verifies the receipt → `dm_delivery.state = 'delivered'`, `receipt_sig` stored; UI shows **"Delivered HH:MM"**.
7. When the recipient opens the thread and the message renders (and read receipts enabled), a `read` receipt is emitted; sender drain → **"Read HH:MM"**.

### Behavior Specification (group)

1. New group: user picks 2-7 paired friends, names it. App: `createWorkspace` (`workspace_type: 'dm_group'`, `queries.ts:643`), `addWorkspaceMember` per member (`queries.ts:703`), `createGroupCommit` mints epoch 1 (`group-keys.ts:190`, **no `recordChange` passed** — see Security Analysis §4 / NC-9), `createDmGroupDescriptor`, then `DM_GROUP_COMMIT` handoff parked per member. Until a member drains the commit, that member's row shows **"Inviting…"** (real pending state).
2. Send in group: `createDmMessage` (conversationId = groupId) → `sealDmGroup` under `deriveEpochContentKey(getCurrentEpochKey(...).secret, workspaceId, epoch)` → fan-out park per current member. `dm_delivery` has one row per member; the thread shows an aggregate honest line (e.g. **"Sent to 4 · Delivered to 2"**, every number from `dm_delivery`).
3. Add member (admin): `dmGroupAdd` → new epoch commit + `DM_GROUP_COMMIT` to all members incl. newcomer. Newcomer reads from this epoch forward (join_point default).
4. Remove member (admin): `dmGroupRemove` → new epoch wrapped for everyone except the removed device + `DM_GROUP_COMMIT` to remaining members. The removed device gets no wrap; subsequent messages are unreadable to it.

### Edge Cases

- **No relay configured** (`DEFAULT_RELAY_URL=''`): send is a genuine no-op → "Not sent — set a connection server" (mirrors `attachment-card-state.ts:87`). Nothing is faked. Resolves when the connectivity plan ships a default relay.
- **Empty body, no attachment:** Send disabled.
- **Body over a sane cap (e.g. 100 KB):** blocked with "Message too long."
- **Attachment over per-blob cap:** message sends metadata-only; recipient pulls via DM file-request; UI says "Attachment is large — the recipient will fetch it."
- **Peer revoked mid-conversation:** send disabled with "You blocked this person." Drain skips revoked peers entirely (`mailbox-drain.ts:325`).
- **Recipient never drains:** sender stays "Sent" forever — honest; no timeout invents "Delivered."
- **Duplicate delivery (mailbox re-drain):** `mergeDmEvents` is idempotent on `id` (INSERT OR IGNORE); a re-drained message counts rejected (no double insert), so no double receipt.
- **Clock skew:** HLC `nextHlc` handles non-monotonic walls; ordering stays deterministic.
- **Edit/delete of a message never delivered:** the supersede event parks alongside; recipient resolves edits on merge.
- **Group at max size (epoch fan-out cap):** "New" disables additional members past the honest ceiling; copy states the limit.
- **Removed member tries to send under old epoch:** other members' `getCurrentEpochKey` is N+1; an N-epoch sealed payload fails `openEntityPayload` (wrong key) → rejected. No silent accept.
- **Web tab + phone same identity:** both compute identical `dmConversationId` (derived from identity anchors) and verify the same signatures. Convergence is REAL and built here via the **own-device DM mirror** (§3b): the user links the two devices, and every message/receipt is fanned to each own-device link over the existing `DM_MESSAGE`/`DM_RECEIPT` mailbox, re-verified on arrival. If the user has NOT linked a second device, each device honestly shows only its own copy ("This conversation is on this device") — never a faked convergence.
- **Read receipts disabled:** no `read` receipt is ever emitted (suppressed below UI); sender sees "Delivered" but never "Read."
- **Module/app backgrounded mid-send:** the park either completed (row `parked`) or did not (`queued`/`failed`); on next foreground a retry re-parks queued/failed rows.

---

## UI Specification (Open Burrow tokens; full mobile + web parity)

Tokens from `apps/meerkat/.../theme/tokens.ts` (`MK_PALETTES`) mobile and the mirrored web CSS vars. Accent sea-green `#0E7C66` / dark `#58C5A5`. Meerkat owns its `Button` (`components/kit.tsx`); web uses `ui/shell/Button`.

### Conversation list (Messages tab — both surfaces)

- Header: **"Messages"** / sub **"Private, end-to-end encrypted."** "New" action (sheet: **New message** / **New group**).
- Each row: avatar/initial, name (1:1 = peer name; group = title + member count), last message preview, unread badge (real count from `dm_read_state`), and a trailing honest state chip on the LAST outgoing message only: `Sending… | Sent | Delivered | Read | Not sent`.

### Thread screen (`dm/[conversationId]` mobile / thread pane web)

- Message bubbles (mine right, theirs left), edited tag, deleted tombstone ("Message deleted"), attachment cards (reuse `AttachmentCard`).
- Per-message footer on MY messages: the honest receipt line.
- Composer: text input placeholder **"Message"**, attach (Paperclip), send. Editing a message disables attach (mirrors `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx:209`, the two-segment nested channel route — `if (editingEvent) return;` short-circuits the attach handler).
- Group header → group info (members, add/remove, rotate, leave).

### Exact copy honoring the honesty rule

| State | Copy |
|------|------|
| Outgoing not yet parked | "Sending…" |
| Outgoing parked | "Sent" |
| Delivered (signed proof) | "Delivered 14:32" |
| Read (signed proof) | "Read 14:35" |
| Park failed | "Not sent. Couldn't reach a connection server. Retry." |
| No relay | "Not sent. Set a connection server in Sync to send messages." |
| Group aggregate | "Sent to 5 · Delivered to 3 · Read by 1" (all from `dm_delivery`) |
| Receipts off (this convo) | "Read receipts are off for this chat." |
| Feed opt-in off (default) | "This conversation is private and not in any feed." |

### State coverage (all 5, both surfaces)

| State | What the user sees | Trigger |
|-------|--------------------|---------|
| Loading | Skeleton conversation rows / thread shimmer | Initial `listConversations` / `listMessages` |
| Empty (list) | "No conversations yet. Tap New to message a paired friend. Meerkat never creates fake chats." | No `dm_conversations` |
| Empty (thread) | "No messages yet. Say hello — it's end-to-end encrypted." | New conversation |
| Error | "Couldn't load this conversation." + Retry; send errors inline as "Not sent" | DB read throw / park throw |
| Partial | Group: "Sent to 5 · Delivered to 2" while receipts trickle in; attachment "Receiving… 2 of 4 blocks" | Mixed `dm_delivery` states / incomplete blocks |
| Success | Full thread, honest receipts, attachments present | Normal |

---

## Phased BUILD Plan (test-FIRST / TDD)

Each phase: write the failing test(s) first, implement to green, run `pnpm --filter @mylife/sync test` / `pnpm gate:function:changed`, then `/review`. UI phases add `/browse`.

### Phase 0 — DM message protocol (pure, engine)
- TDD: `dm-message.test.ts` — sign/verify round-trip; tamper → reject; `dmConversationId` order-independence; `compareDmMessages` total order; `resolveDmMessages` edit/delete; **cross-domain rejection** (a `createChannelMessage` event fails `verifyDmMessage` and vice versa).
- Build `protocol/dm-message.ts`; export.

### Phase 1 — DM mailbox (1:1) + receipts (pure, engine)
- TDD: `dm-mailbox.test.ts` (seal/open 1:1, **multi-recipient fan-out** — sealing to a peer anchor with two device rows yields two envelopes, TC-13; wrong-recipient/tamper fail-closed, attachment blocks reassemble + hash-verify); `dm-receipt.test.ts` (signed delivered/read, forgery rejected, withhold → no overclaim).
- Build `protocol/dm-mailbox.ts` (direct mode `sealDmDirect` with per-recipient fan-out + blocks) + `protocol/dm-receipt.ts`; export.

### Phase 2 — Dispatcher + drain wiring (engine)
- TDD: extend `mailbox-dispatch.test.ts` + `mailbox-drain.test.ts` — dmMessage/dmReceipt routed; unknown kind still rejected; counters fold; cross-client `dm-1to1-e2e.test.ts` over a LIVE relay (two real engines) proving real bytes (package CLAUDE.md: prove with cross-client e2e).
- Build the 3 handler slots + 3 counters.

### Phase 3 — Local DM store (mobile)
- TDD: `dm-core.test.ts` — DDL idempotent (incl. `dm_own_devices` + `dm_participants.identity_anchor`/`is_self`); `mergeDmEvents` idempotent on id; per-device `dm_delivery` transitions only on real inputs; unread math; own-device fan-out target list derives from `dm_own_devices` + peer device rows; LOCAL-ONLY assertion (a `dm_` row is rejected by `applyReceivedDocumentChanges`).
- Build `apps/meerkat/.../data/dm-core.ts`.

### Phase 4 — Provider send/drain + own-device mirror (mobile)
- TDD: provider-level tests — `queueDmMessage` writes `parked` only on real park; `queueDmReceipt`; drain handlers apply+receipt; honest no-relay no-op; **recipient multi-device fan-out** (a peer with two device rows gets two parks, `dm_delivery` row per device); **own-device mirror** — with a `dm_own_devices` link, an outbound message AND a verified inbound receipt are re-sealed to the own device, and the own device converges by re-verifying (in-process two-engine-one-identity test, the TC-12 spine); with NO own-device link the mirror is a genuine no-op.
- Build SyncProvider methods (`queueDmMessage`, `queueDmReceipt`, `linkOwnDevice`, own-device fan-out helper) + wire DM handlers into the SHARED `buildDrainHandlers` (`SyncProvider.tsx:890`) AND `background-sync.ts` (so offline catch-up + own-device convergence run in foreground and background without drift).
- Cross-client `dm-owndevice-e2e.test.ts` over a LIVE relay (TC-12): two engines under one identity anchor + one friend; prove a message/receipt lands on BOTH own devices via the mailbox, each row re-verified, never invented.

### Phase 5 — Mobile UI (1:1)
- TDD: `friends-core.test.ts` updated (no more `canMessage:false`); render tests for the thread + list states.
- Build: rebuild `messages.tsx` (list), `dm/[conversationId].tsx` (thread + composer + receipts), wire `friends.tsx` "Message". Remove dead-end copy. `/browse` all 5 states.

### Phase 6 — Group epoch backing + handoff (engine)
- TDD: `dm-group.test.ts` (descriptor sign/verify, add/remove commits real epoch, removed device cannot unwrap N+1; **NC-9 no-leak negative test** — a create/add/remove commit does NOT change `getUnsyncedByModule('communitykeys')` count, proving zero syncable `sync_workspace_keys` rows because the DM helpers pass no `recordChange`), `dm-group-handoff-mailbox.test.ts` (per-member handoff, poison/fast-forward defenses), group e2e `dm-group-e2e.test.ts` (3 engines, remove member, prove unreadable-after-removal).
- Build `protocol/dm-group.ts` (helpers pass NO `recordChange`) + `protocol/dm-group-handoff-mailbox.ts` + `sealDmGroup`/group open path; dispatcher `dmGroupCommit` slot.

### Phase 7 — Group provider + mobile UI
- TDD: provider group tests (create/add/remove → handoff parked; fan-out delivery; aggregate counters).
- Build `createDmGroup`/`dmGroupAddMember`/`dmGroupRemoveMember`; group thread + `dm/[conversationId]/info.tsx` (members, add/remove, rotate, leave). `/browse`.

### Phase 8 — Attachments, block/report, disappearing, feed opt-in (mobile)
- TDD: DM attachment send + verify-then-pin; DM file re-request (generalize file-request to DM authors); block = revocation; report writes `dm_reports`; optional disappearing TTL via the signed `DM_SHRED` mailbox kind (NOT `entity-keys.ts` — see Data Model "Sensitive/disappearing path"): assert a shred signed by a non-author is rejected, and a verified shred deletes the local row + cached blob; `feed_opt_in` flag + the guarded read API contract locked with plan 19 (below) — auto-includes nothing.
- Build the above.
- **`feed_opt_in` guarded read-API contract (locked with plan 19 / public social):** the ONLY surface plan 19 may consume is `listFeedOptInConversations(db): { conversationId, kind, title, optedInAt }[]` + `getFeedSourceMessages(db, conversationId, sinceHlc): DmMessageEvent[]`, both of which **hard-filter `WHERE feed_opt_in = 1`** and throw if asked for a conversation with `feed_opt_in = 0`. Plan 19 NEVER reads `dm_messages`/`dm_conversations` directly. Default `feed_opt_in = 0` ⇒ the guarded API returns an empty set ⇒ nothing auto-includes (NC-6). This signature is the frozen seam; any change is a coordinated edit to both plans.

### Phase 9 — Web parity (all of 3-8 on web) + parity-gate extension
- TDD: web `dm-core` + provider parity tests (incl. web own-device mirror + multi-device fan-out); route-vs-pane parity check per the "Parity gate extension" mapping.
- Build `apps/meerkat-web/src/lib/dm-core.ts`, `MeerkatProvider` methods, rebuild `MessagesView.tsx` (list + thread pane + composer + group info), wire web `friends-core`.
- **Extend `scripts/check-meerkat-parity.mjs`** with the DM-surface assertions (new `ensureFile`s for the dm screens + web `dm-core`, `ensureContains` for the registered `dm/[conversationId]` route in `(root)/_layout.tsx`, dead-end-removed assertions, and the `DIRECT_MESSAGE_UNAVAILABLE_REASON` zero-hit grep) so TC-10 proves DM parity, not just the legacy file list. Run `node scripts/check-meerkat-parity.mjs` + the `route-parity-validator` with the dm route↔pane mapping. `/browse` web.

### Phase 10 — Hardening + docs
- `/qa` Messages on both surfaces; `/design-review`; update `apps/meerkat/CLAUDE.md` + `apps/meerkat-web` docs + `memory.md`; verify no honesty-landmine copy remains; relay TTL test for DM kinds (`pnpm --filter @mylife/meerkat-relay test`).

---

## Acceptance Criteria

### User Experience (AC)
- **AC-1:** Tapping "Message" on a friend opens a real 1:1 thread (no Alert).
- **AC-2:** Typing + Send inserts a bubble that reads "Sending…" then "Sent" once a real park succeeds.
- **AC-3:** With no relay configured, Send shows "Not sent. Set a connection server…" and never "Sent."
- **AC-4:** A recipient who was offline sees the message after opening the app (mailbox drain).
- **AC-5:** Sender sees "Delivered HH:MM" only after the recipient's signed receipt arrives; "Read HH:MM" only after a read receipt.
- **AC-6:** Creating a group with N paired friends opens a group thread; messages reach all current members.
- **AC-7:** Removing a member rotates keys; messages sent afterward are unreadable to the removed member (verified by e2e).
- **AC-8:** Edit shows an "edited" tag for all parties; delete shows a tombstone.
- **AC-9:** Attaching a file delivers verified bytes; an over-cap attachment is fetched on demand.
- **AC-10:** Block from a DM disables sending and records a real revocation; report writes a local report row.
- **AC-11:** Turning off read receipts for a conversation stops "Read" from ever appearing on the other side.
- **AC-12:** No DM appears in any community/public feed; a conversation is a feed source only after explicit opt-in.
- **AC-13:** For a user who has linked a second device (own-device link), mobile and web converge on the same conversations and ordering, and each device shows the same per-real-row receipt state (every "Delivered"/"Read" backed by the same re-verified signed receipt — never an invented state). With no second device linked, each device honestly shows only its own copy. Convergence is delivered by the own-device DM mirror (§3b) over the existing mailbox, NOT by a personal-replica session.
- **AC-14:** Unread badges reflect real unread counts from `dm_read_state`.

### Technical (TC)
- **TC-1:** `verifyDmMessage` rejects any tampered field; `id` mismatch rejects.
- **TC-2:** A `createChannelMessage` event fails `verifyDmMessage` and a DM event fails `verifyChannelMessage` (cross-domain isolation).
- **TC-3:** `dm_delivery.state` only advances on a real park (`queued>0`) or a verified signed receipt; never on a timer.
- **TC-4:** `openDmMailbox` fails closed on wrong-recipient / bad signature / decrypt failure.
- **TC-5:** Group message sealed under epoch N is undecryptable by a device holding only epoch ≠ N.
- **TC-6:** `mergeDmEvents` is idempotent (re-drain inserts 0, counts rejected, emits no second receipt).
- **TC-7:** Cross-client e2e (1:1 and group) over a LIVE relay moves real bytes and produces real receipt rows.
- **TC-8:** Background drain delivers DMs + receipts using the SAME handlers as foreground (no drift).
- **TC-9:** Attachment bytes verify-then-pin: `blobContentHash(received) === event.attachment.blobHash` or no write.
- **TC-10:** `scripts/check-meerkat-parity.mjs` passes with the NEW DM-surface assertions added by this plan (see "Parity gate extension" below): it asserts the mobile DM files (`dm/[conversationId].tsx`, `dm/new.tsx`, `dm/[conversationId]/info.tsx`, `data/dm-core.ts`), the rebuilt `messages.tsx`, the web `lib/dm-core.ts` + rebuilt `MessagesView.tsx`, the registered `Stack.Screen` dm routes in `(root)/_layout.tsx`, AND a zero-hit grep for `DIRECT_MESSAGE_UNAVAILABLE_REASON` / `canMessage: false`. Route-vs-pane parity is defined explicitly (mobile Expo route ↔ web SPA pane), not byte-equal.
- **TC-11:** Relay TTL test covers the new DM kinds (park, buffer, drain-on-join, TTL purge), including `DM_GROUP_COMMIT` and `DM_SHRED`.
- **TC-12:** Own-device convergence e2e (§3b): two engines under ONE identity anchor (a linked own-device pair) + one friend engine; a message/receipt fanned to the own-device link lands on BOTH own devices via the mailbox, each row re-verified, never invented (proves AC-13 honestly).
- **TC-13:** Multi-device addressing: `sealDmDirect` to a peer anchor with two device rows produces two envelopes (one per device); a peer running two devices receives on both; `dm_delivery` carries a row per recipient device.

### Negative (NC)
- **NC-1:** No DM artifact enters via a replication session. (a) A `dm_` row offered over a community/workspace session is REJECTED by `applyReceivedDocumentChanges` (device_local) and never written. (b) A `dm_group`'s `sync_workspace_keys` wraps never replicate to community co-members — even the own-device mirror uses only the verified mailbox, so the `device_local` fail-closed reject is never relaxed.
- **NC-2:** The UI never shows "Delivered"/"Read"/online/peer-count without a backing `dm_delivery` row.
- **NC-3:** A removed group member cannot read post-removal messages (no epoch wrap).
- **NC-4:** A relay/host cannot learn conversationId, membership, sender, or recipient from a parked envelope (only token + size).
- **NC-5:** Disabling read receipts suppresses emission at the source, not just the sender's display.
- **NC-6:** No DM is ever included in a public feed without `feed_opt_in = 1` for that conversation.
- **NC-7:** A withheld receipt degrades to the honest lower state; no fabricated "Delivered."
- **NC-8:** No new wire field is added to the mailbox frame; the relay contract is unchanged.
- **NC-9:** A `dm_group` membership commit (create / add / remove) creates ZERO syncable change-tracker rows: `getUnsyncedByModule('communitykeys')` count is unchanged across the commit, so the group's existence + member device IDs never leak to community co-members via `sync_workspace_keys` replication.
- **NC-10:** The own-device DM mirror writes a converged row on a peer's OWN device only from a re-verified signed `DmMessageEvent`/`DmReceiptEvent`; a device with no linked own-device shows only its local copy and never implies convergence. No own-device state is invented.

---

## Test Plan + Verification Tiers

- **Unit (Tier A — pure logic):** `dm-message`, `dm-mailbox`, `dm-receipt`, `dm-group`, `dm-group-handoff`, `dm-core` merge/idempotency, cross-domain rejection, fail-closed open paths. Deterministic, fully automated.
- **Integration (Tier B — in-process two-identity):** dispatcher routing + drain counters; provider `queueDmMessage`/`queueDmReceipt` against an in-memory relay; honest-no-relay no-op; block/revocation gating.
- **E2E (Tier C — two/three real engines over a LIVE relay + relay TTL):** `dm-1to1-e2e`, `dm-group-e2e` (incl. remove-then-unreadable), receipt round-trip, attachment verify-then-pin, background-drain delivery. This is the anti-"dead transport" proof the package CLAUDE.md mandates (v1 shipped zero real bytes by trusting in-memory-only proofs).
- **UI (Tier C/D):** `/browse` all 5 states on mobile + web; `/qa` Messages; `/design-review`.
- **Reaches Tier C automatically** (cross-client real-byte e2e + relay TTL). **Remains manual/ops (Tier D):** real two-physical-device delivery latency, iOS background-execution timing of receipt emission, and out-of-box delivery once a hosted default relay exists (owned by the connectivity plan). These are explicitly NOT faked — they gate on that plan.

---

## Risks + Honesty Landmines

1. **Receipt overclaim (highest):** the temptation to flip "Delivered" on park or on a timer. Mitigation: `dm_delivery` advances to delivered/read ONLY on a verified signed receipt with `receipt_sig` stored; AC/NC/TC enforce it; e2e proves it.
2. **Stale dead-end copy left behind:** like the Files-index stale "coming in a later update" string that contradicted the live request flow (`/tmp/meerkat-map/m-files.md` §"Notable issues"). Mitigation: Phase 5/9 explicitly deletes `friends-core.ts:13-44`, `messages.tsx:28-90`, `MessagesView.tsx:34-100`; a grep gate for `DIRECT_MESSAGE_UNAVAILABLE_REASON` must return zero hits.
3. **No deployed relay yet (`DEFAULT_RELAY_URL=''`):** DMs honestly park-fail out of box. Mitigation: depend on the connectivity plan's hosted default + self-host; until then, the manual relay URL path works and the UI says so honestly. Do NOT bundle a fake default.
4. **Group fan-out scale / metadata:** O(members) parks; relay 8-peer cap. Mitigation: enforce the honest max-group ceiling in UI, surface it as the monetization lever, document the not-TreeKEM boundary (`group-keys.ts:20-27`).
5. **Read-receipt privacy theater:** hiding "Read" in UI while still emitting it. Mitigation: suppression at the EMIT side; NC-5 + a test that asserts no receipt envelope is parked when disabled.
6. **DM-into-feed leak:** any path that surfaces a DM into the community/public feed. Mitigation: `dm_` absent from all sync policies (NC-1), feed opt-in defaults off and auto-includes nothing (NC-6); the public-social plan must read the guarded API, not the raw table.
7. **Simplified-Noise / pairwise-fan-out boundary:** group keys are pairwise fan-out, not MLS/TreeKEM. Mitigation: keep `dm-group.ts` call sites swap-local so OpenMLS adoption stays a local change (per `group-keys.ts:22-27`); never market formal-MLS guarantees.
8. **`sync_workspace_keys` group-existence leak (high):** outbound sync is change-log-driven and `sync_workspace_keys` is a synced table at `shared_workspace` scope (`communitykeys`/`KEYS_SYNC_POLICY`); if a `dm_group` commit ever records a change, the group's existence + member device IDs would replicate to community co-members. Mitigation: DM group helpers pass NO `recordChange`; `dm_group` workspaces never join a community session; NC-9 + a negative test assert zero new `getUnsyncedByModule('communitykeys')` rows per commit.
9. **Faked cross-device convergence (high honesty landmine):** showing convergent threads/receipts across devices the substrate cannot actually converge. Mitigation: AC-13 is delivered by the REAL own-device mirror (§3b) over the verified mailbox, per-real-row only; an unlinked device honestly shows only its local copy (NC-10) and never implies convergence. Do NOT claim convergence from the `mp_pad` personal-replica path — it does not carry `dm_`.

---

## Sequencing / Dependency Note (relative to the 6-plan launch set)

- **Theme system:** soft dep — DM screens consume `MK_PALETTES`; ship correctly today, restyle free when theme lands.
- **Public social layer:** parallel-safe — this plan ships the `feed_opt_in` flag + guarded read API; that plan reads it. No DM auto-inclusion.
- **Connectivity + self-hosting:** hard dep for mainstream out-of-box delivery (hosted default relay / TTL mailbox + easy self-host). DMs function over any manual `ws://` relay before it lands.
- **Full DMs (THIS plan, #21 / #4 of 6):** the headline functional gap; unblocks a real Messages tab.
- **Monetization + billing:** consumes this plan's honest counters (hosted-mailbox capacity, max group size) as paid levers. Independent build.
- **Launch readiness:** gates on this plan's `/qa` + e2e green on both surfaces.

**Build order within the set:** connectivity → (theme ∥ this plan ∥ public social) → billing → launch readiness. This plan can start immediately on the SHIPPED `@mylife/sync` substrate and only needs the connectivity plan's relay for the final out-of-box delivery polish.

---

## Handoff State

### Before
Messages tab is an honest dead-end: no DM store, no thread, no send path; every "Message" opens an Alert (`/tmp/meerkat-map/m-messages-friends.md`). Pairing, SAS, mailbox, group keys, signed messages all real in `@mylife/sync`.

### After
Complete E2EE 1:1 + group DMs on mobile and web: real threads, honest signed-proof receipts, attachments, edit/delete, block/report, group membership with real key rotation, opt-in feed source, all delivered over the real paired-device + mailbox + relay paths. No faked delivery anywhere.

### Files Changed (summary)
- `packages/sync/src/protocol/`: +5 new pure files (`dm-message`, `dm-mailbox`, `dm-receipt`, `dm-group`, `dm-group-handoff-mailbox`); `mailbox-dispatch.ts` + `mailbox-drain.ts` extended; `index.ts`/`index.native.ts` exports.
- `apps/meerkat/app/(root)/`: +`data/dm-core.ts`, +`dm/[conversationId].tsx`, +`dm/new.tsx`, +`dm/[conversationId]/info.tsx`; `_layout.tsx` (register dm routes), `providers/SyncProvider.tsx` (+`linkOwnDevice`/own-device mirror), `data/background-sync.ts`, `(tabs)/messages.tsx`, `(tabs)/friends.tsx`, `data/friends-core.ts` edited.
- `apps/meerkat-web/src/`: +`lib/dm-core.ts`; `lib/MeerkatProvider.tsx`, `ui/messages/MessagesView.tsx`, `lib/friends-core.ts` edited.
- `scripts/check-meerkat-parity.mjs` extended with DM-surface assertions (TC-10).
- Tests: ~13 new suites (units + 3 cross-client e2e: 1:1, group, own-device convergence) per the phase plan; relay TTL test extended.

### Known Limitations (NOT scope drops — honest boundaries)
- Out-of-box delivery needs the connectivity plan's hosted default relay; until then, a manual relay URL is required (UI says so).
- Group size capped at the honest epoch fan-out ceiling (relay 8-peer); larger groups await an OpenMLS swap (call sites kept swap-local).
- Cross-device convergence (same identity on phone + web seeing the same DM) is built by THIS plan via the own-device DM mirror (§3b: mailbox fan-out to the user's explicitly linked own devices + re-verified receipt mirror). It is NOT the `mp_pad` personal-replica session (which Meerkat does not extend to `dm_`); `dm_` stays `device_local` and NC-1 is never relaxed. It requires the user to link a second device; an unlinked device honestly shows only its local copy.

### Context for Next Agent
The mailbox dispatcher (`mailbox-dispatch.ts`) is the ONE seam — add kinds there and counters in `mailbox-drain.ts`, never a parallel drain. Always write `dm_delivery` only on a real park or a verified receipt. Keep `dm_` out of every sync policy. Cross-device convergence is the own-device mirror (mailbox fan-out to linked own devices), NOT a personal-replica session; never relax NC-1 to get it. DM group commits MUST pass no `recordChange` (NC-9) or the `sync_workspace_keys` wraps leak the group to community co-members. Prove every transport claim — including own-device convergence — with a cross-client e2e over a live relay before believing it.

## Status Delta (2026-07-04)

- Code-complete Phases 0-10 on BOTH surfaces (mobile + web DMs live, live-relay e2e), verified in the 2026-07-04 production audit.
- DM surface flags are true on both surfaces: `DM_MESSAGES_SURFACE_AVAILABLE = true` (mobile `share-route.ts`) and `DM_MESSAGES_SURFACE_ENABLED = true` (web `dm-surface.ts`). 1:1 + group DMs are live, merged to main 2026-07-04.
- Open code items: AC-13 link-device UI missing on both surfaces; minor web e2e coverage gaps.
- Out-of-box delivery is gated on the founder-ops relay deploy (runbook section 2).

# Feature Spec: Chat Experience Rebuild (Shared Chat Kit + Reactions + Live Feel)

> **STATUS (2026-07-04): SHIPPED + REVIEWED.** All phases (mobile P0-P3, web P4) landed on `feature/meerkat-launch-finish` (2026-07-03/04), every commit through spec + adversarial review. Shared chat kit, reactions v2 (fail-closed author-bound supersede), segmented channel/post screens, focused live loop, web parity. Suites green (app 699/web 468/sync 1559/relay 325 + parity). No founder-ops Tier-D blocker. Full detail: `docs/sessions/2026-07-03-meerkat-ux-parity-execution.md` + `2026-07-04-meerkat-ux-parity-close.md`.

> Meerkat UX-parity plan 30 (first of the 3-plan consumer UX set 30/31/32, sourced from the 2026-07-01 UI benchmark evaluation, `docs/reports/REPORT-meerkat-ui-benchmark-eval-2026-07-01.html`). Rebuilds channel chat to production chat-app standard (Discord / Slack / Signal interaction grammar) on top of the UNCHANGED honest engine: inverted virtualized message list, grouped bubbles with own-messages right-aligned, long-press actions, reactions (quick set + full picker), reply-to, @mention autocomplete, segmented Chat | Posts views, and a focused-screen polling drain that removes the manual Refresh button. Ships a shared chat kit that Plan 21 Phase 5 DM threads consume.

## Metadata

- **Surfaces:** `apps/meerkat` (Expo Router), `apps/meerkat-web` (web twin), `packages/sync` (`@mylife/sync`, validation only, no new crypto scheme)
- **Priority Score:** 44 / 50 (A-Tier). Market 5x3 + Switching 4x3 + Complexity 3x2 (medium: mostly presentational over existing signed events) + CrossModule 2x1 + PaidUser 3x1. The channel screen is the product's core loop; the benchmark eval scored it 4.5/10 vs Discord/Slack and identified it as the highest-leverage fix.
- **Estimated CC Time:** 5-7 focused sessions.
- **Status (2026-07-01):** NEW plan, nothing built. Founder decisions locked 2026-07-01: segmented Chat | Posts views per channel (no descriptor schema change); reactions = quick set of 6 + full emoji picker, protocol carries any single emoji.
- **Depends On:**
  - MK-P01 v2 channel-message contract (SHIPPED, on main): `packages/sync/src/protocol/channel-message.ts` already defines `intent: 'react'` in the `ChannelMessageIntent` union (`channel-message.ts:31-34`), signed `mentions?: string[]`, `postId`/`parentId`/`branchId`, and `supersedes` tombstones. This plan adds ZERO new event types and ZERO new crypto.
  - Plan 23 D.6 Noise upgrade ordering rule: this plan does NOT touch `sync-session.ts` or `noise-handshake.ts`, so it is parallel-safe with D.6.
- **Blocks / feeds into:**
  - **Plan 21 Phases 2-10 (DMs):** Phase 5 (DM thread UI) MUST consume this plan's chat kit (`components/chat/`) instead of building its own bubbles/composer. Sequence the kit phases (0-2 below) before Plan 21 Phase 5 starts.
  - **Plan 32 (content-first feed):** consumes this plan's reaction read models and quick-react send path for feed-card engagement rows.
  - **Plan 29 (auto-connect):** the focused drain loop built here (Phase 3) is a seam Plan 29's `autoConnectRound()` replaces/absorbs; both wrap the SAME `runForegroundDrain`, so they cannot drift.
- **Build order within the UX set:** 30 first, then 31 and 32 (both consume pieces of 30).

---

## Business Context

### Why this feature exists

The 2026-07-01 benchmark eval found four structural deviations from every production chat app: the message list is a non-inverted ScrollView that opens at the oldest message with no virtualization; new messages require a manual Refresh button; every message renders ~4x the benchmark metadata (author + timestamp + Saved/Edited + audience badge + always-visible edit/delete/report buttons); and two composers share one screen (Posts panel stacked above the chat stream). Each one independently reads as "broken" or "confusing" to a mainstream user. The founder bar is a 9-10/10 experience a boomer or a 7-year-old picks up with zero instruction. Every fix in this plan is presentational or read-model work over events and drain paths that already exist and are already honest.

### Which competitor's users this wins

Discord and Slack users who want the same muscle-memory interaction grammar (grouped messages, long-press/hover actions, reactions, replies, mentions) with Meerkat's encryption and honesty. Signal users who expect bubbles-right-for-me, bubbles-left-for-them. Nobody switches TO an app whose chat needs a refresh button.

### Target user

Anyone in a community channel. The 7-year-old test: send a message (bottom composer, one field, one button), react to a message (hold it, tap a heart), see new messages arrive without touching anything.

---

## Current-State Grounding (verified 2026-07-01)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| v2 signed channel message with `intent: 'react'` reserved, `mentions`, `postId`, `parentId`, `supersedes` | `packages/sync/src/protocol/channel-message.ts:31-67` |
| `createChannelMessageV2` (version-dispatched canonical, v1 bytes untouched) | `packages/sync/src/protocol/channel-message.ts:159` |
| Channel chat screen (rebuild target) | `apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx` (1398 lines) |
| Post thread screen (adopts kit, not rebuilt) | `apps/meerkat/app/(root)/(tabs)/post/[communityId]/[channelId]/[postId].tsx` |
| `useChannel` hook: `messages`, `send(body, attachments)`, `post(body)`, `edit`, `delete`, `refresh`, `importHistory`, `busy`, `loading`, `partialHistory` | `apps/meerkat/app/(root)/providers/ChatProvider.tsx:394-455` |
| Honest foreground drain (returns `{ appliedMessages, fileGrants }`; no-op without relay) | `SyncProvider.tsx` `runForegroundDrain` (`:225-227`, `:1081-1124`; `buildDrainHandlers` near `:948`) |
| Relay resolution choke point (health-gated default) | `apps/meerkat/app/(root)/data/effective-relay.ts` `effectiveRelayUrl(db)` |
| Peer display names from trusted local sources | `community-core.ts` `buildCommunityPeerNameMap` |
| Post cards read model | `community-core.ts` `listChannelPostCards` |
| Community sync policy (explicit rules per cm_ table, omitted = device_local fail-closed) | `apps/meerkat/app/(root)/data/community-core.ts:89` `COMMUNITY_SYNC_POLICY` |
| Attachment render with image preview + verify-then-request flow | `apps/meerkat/app/(root)/components/AttachmentCard.tsx` |
| Safety filters (blocked person, report-hidden) | `apps/meerkat/app/(root)/data/community-safety.ts` |
| Mention detection in feed (reads signed `event.mentions`) | `apps/meerkat/app/(root)/data/feed-core.ts:268-281` |
| Web channel twin | `apps/meerkat-web/src/ui/channel/` |
| Parity guard | `scripts/check-meerkat-parity.mjs` (repo root) |

### Genuinely net-new (this plan builds)

1. Reaction shape validation for `intent: 'react'` events (verify-side + read-model filter).
2. Reaction read models (aggregate counts + my-reaction lookup) on both surfaces.
3. Shared chat kit: `MessageList` (inverted FlatList), `MessageBubble`, `MessageActionsSheet` (long-press), `EmojiPickerSheet`, `ChatComposer` (reply banner, edit banner, @mention autocomplete), `ChannelSegmentedTabs`.
4. Channel screen rebuild consuming the kit; Posts becomes a segmented view; per-message audience badges collapse into ONE always-visible header label (honesty preserved, repetition removed).
5. Focused-screen polling drain loop (`useChannelLiveLoop`) that retires the manual Refresh button.
6. Web parity for all of the above (hover/context-menu replaces long-press).

---

## Technical Context

### Design decisions (locked)

1. **Reactions are v2 channel messages, not a new event type.** A reaction event: `createChannelMessageV2` with `intent: 'react'`, `parentId` = target event id, `postId` = target's postId when the target belongs to a post thread, `body` = exactly one emoji grapheme, no attachments. Un-react = a supersedes tombstone of your own reaction event (`supersedes: { id: myReactionEventId, deleted: true }`). This inherits signing, sync replication, mailbox delivery, safety filtering, and edit/tombstone semantics for free; the read-model exclusions in T0.3 are the mandatory other half (a react must never render as a chat bubble, count as unread, or count as a reply). One user may hold multiple distinct emoji on one target (Discord semantics); tapping an emoji you already hold removes it (toggle). DISPOSITION: the pre-existing `cm_reactions` table (`community-core.ts:306-313`, prewired or_set policy rule at `:110-114`) stays UNUSED; do not write to it. Where the 2026-06-18 posts spec doc directs reactions into `cm_reactions`, THIS plan supersedes that direction.
2. **Quick set is pure UI.** The 6 quick reactions are `['❤️', '👍', '😂', '😮', '😢', '🎉']` (heart, thumbs up, laugh, wow, sad, party) defined ONCE in `components/chat/emoji-data.ts` and mirrored on web. The protocol accepts any single grapheme, so tuning the quick set later is a copy change.
3. **Segmented Chat | Posts, no schema change** (founder decision 2026-07-01). Every channel renders a two-segment control under the header. Chat view = message list + composer. Posts view = post cards + post composer. Deep links into a post keep working via the existing post route.
4. **Audience honesty moves to the header, not deleted.** The channel header gains a permanent one-line audience label (from the existing `AudienceRuleSummary` copy, e.g. "Everyone in this community"). Per-message `AudienceBadge` chips are removed from bubbles. The label is ALWAYS visible (not behind a tap), so the Prompt 03 audience-visibility guarantee is preserved with 1 label instead of N.
5. **Live feel is honest polling, not fake push.** `useChannelLiveLoop` runs the SAME `runForegroundDrain` the manual button ran: while the channel screen is focused AND AppState is active AND `effectiveRelayUrl(db)` resolves to a URL, poll with adaptive cadence: an immediate tick on focus, 5s cadence for 60s after focus, any send, or any applied>0 (the hot window), then a 10s steady cadence while the screen stays focused, +-20% jitter, single-flight. On blur/background it stops entirely. No connection status is displayed from the loop itself; only applied events change the UI. Copy never says "connected" or "live"; the header keeps showing recorded state only.
6. **Mention autocomplete is trusted-local only.** Typing `@` filters `buildCommunityPeerNameMap` names; selecting inserts the display name into the body AND appends the deviceId to the signed `mentions` array (already a v2 field). Render pass highlights body substrings matching mentioned members' display names; a mention is display sugar, never an identity proof.
7. **The kit is provider-agnostic.** `components/chat/*` receives plain props (items, callbacks, capability flags like `canEdit`, `canReact`); it imports NOTHING from ChatProvider or SyncProvider. Plan 21's DM thread passes DM-shaped items into the same components.
8. **History import leaves the chat surface.** The JSON paste panel moves behind a header overflow menu item "Channel options > Import history" (same component, relocated). Plan 31 later re-homes it into community settings; this plan only removes it from first-tap reach.

### Data model / read models (no new tables)

Reactions live in existing `cm_messages` rows (they ARE messages with `intent='react'`). Net-new read models only:

```ts
// community-core.ts (mobile) + the web twin
export interface MessageReactionGroup {
  emoji: string;
  count: number;           // distinct non-tombstoned reaction authors holding this emoji
  mine: boolean;
  myEventId: string | null; // needed to build the un-react tombstone
}
export function listChannelReactions(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): Map<string /* parentId */, MessageReactionGroup[]>;
```

Aggregation rule: group verified, non-superseded `intent='react'` rows by `(parent_id, body)`; a later reaction by the same author on the same target+emoji supersedes silently (idempotent); safety-hidden and blocked authors are excluded via the existing `community-safety.ts` filters.

---

## Phases

### Phase 0: reaction protocol plumbing + read-model hygiene (engine + data layer, test-first)

- T0.1 `packages/sync/src/protocol/channel-message.ts`: ONE deterministic, pure-JS emoji-sequence validator `isSingleEmojiGrapheme(body: string): boolean`, exported and used by BOTH the pre-flight check (before signing) and verification. NO `Intl.Segmenter`, NO environment branches: this check is consensus-adjacent and must agree byte-for-byte on Hermes (mobile has no `Intl.Segmenter`), V8 (web), and Node (tests). Implement an explicit emoji-sequence grammar: base emoji code point, optional VS16 (U+FE0F), optional skin-tone modifiers, ZWJ-joined sequences, regional-indicator flag pairs, keycap sequences, plus a hard UTF-8 byte cap (28 bytes). REQUIRED test matrix: `👍`, `❤️` (VS16, in the locked quick set, MUST pass), `👍🏽` (skin tone), `👨‍👩‍👧‍👦` (ZWJ family), `🇺🇸` (flag pair), `1️⃣` (keycap), two-emoji string rejected, plain letter rejected, empty rejected, oversized rejected.
- T0.2 Extend `verifyChannelMessage` (`channel-message.ts:166`): `intent === 'react'` REQUIRES `parentId` present, `isSingleEmojiGrapheme(body)` true, `attachments` absent or empty; a react tombstone (`supersedes.deleted === true`) may only target the author's own prior event. Invalid react events fail verification (fail-closed). Tests: valid react, invalid body rejected, missing parentId rejected, attachment-bearing rejected, tombstone valid.
- T0.3 READ-MODEL HYGIENE (both surfaces; reactions must NOT leak into existing consumers): exclude `intent === 'react'` events from the chat stream (`listChannelMessages` consumers, `community-core.ts:1149-1155`), from unread counting (`countUnreadChannelMessages`, `community-core.ts:1362-1371`; reactions must not inflate channel or community badges), from post reply counts / `lastActivity` / `lastAuthorDeviceId` (`listChannelPostCards`, `community-core.ts:1442-1453`), and from thread reply nodes (`listChannelPostThread`, `community-core.ts:1477-1479`); `isChannelPostEvent` (`community-core.ts:833-845`) must not classify a react carrying `postId`/`parentId` as a post event. Tests: a react on a chat message renders no bubble and bumps no unread; a react on a thread reply changes no replyCount, no card order, no thread node. Web twin lockstep.
- T0.4 `apps/meerkat/app/(root)/data/community-core.ts`: `listChannelReactions` per the shape above + unit tests (aggregate, toggle, tombstone removes, blocked author excluded). Mirror in the web twin; if `check-meerkat-parity.mjs` locks the twin file, keep the function byte-identical.
- T0.5 v2 SEND PATH (net-new; NOTHING today can emit v2 fields): `ChatProvider.sendMessage` accepts only `(communityId, channelId, body, attachments?)` and hardcodes the v1 builder (`ChatProvider.tsx:125-163`); the v1 builder strips v2 fields and `verifyChannelMessage` rejects v1 events carrying them (`channel-message.ts:136-180`). Extend `sendMessage` with optional `opts?: { mentions?: string[]; parentId?: string; postId?: string; branchId?: string }`: when any v2 field is present, build via `createChannelMessageV2`; otherwise the v1 path stays byte-identical (regression test). This task is a hard prerequisite for mentions (T1.6), replies (T2.2), and reactions.
- T0.6 `sendReaction(communityId, channelId, target: { eventId, postId? }, emoji)` and `removeReaction(communityId, channelId, myEventId)` live in `ChatProvider` (NOT SyncProvider): they must ride the same compose/reconcile reducer + `state.revision` bump as `sendMessage` (`ChatProvider.tsx:102-163`) so the open channel re-renders, and the same mailbox park path so offline reactions deliver like offline messages. Provider-level tests beside the existing send tests.
- Gate: `pnpm --filter @mylife/sync test`, `pnpm gate:function:changed`, parity script.

### Phase 1: the shared chat kit (`apps/meerkat/app/(root)/components/chat/`)

- T1.1 `emoji-data.ts`: `QUICK_REACTIONS` (the locked 6) + `EMOJI_CATALOG` (curated static list, ~300 common emoji grouped by category, plain data, no native dependency).
- T1.2 `MessageBubble.tsx`: props `{ item, isMine, isGroupStart, isGroupEnd, authorName, avatarInitial, reactions, onLongPress, onPressReaction, onPressReply }`. Own messages right-aligned, accent background, `onAccent` text; others left-aligned surface bubbles with hairline border; grouped corner radii (16 outer, 5 between grouped); author name + avatar rendered ONLY at `isGroupStart` for non-mine; a muted time label ONLY at `isGroupEnd`; "Edited" suffix when `supersedes` and not deleted; pending/failed states keep the current accent-border / danger treatments; reaction chips row under the bubble (emoji + count, mine = accent border), tap toggles; reply context (quoted snippet, author, tap scrolls to target) when `parentId` resolves.
- T1.3 `MessageList.tsx`: inverted `FlatList` over pre-grouped items; grouping function `groupMessages(items)` (same author + < 5 min gap + no divider between = one group) as a PURE exported function with unit tests; day dividers; a "new messages" divider at the first unread; scroll-to-bottom pill appears after scrolling up 300px and shows a count of newly arrived while detached; `maintainVisibleContentPosition` so incoming messages do not yank the viewport.
- T1.4 `MessageActionsSheet.tsx`: bottom sheet on long-press. Row 1: the 6 quick reactions + a `+` opening `EmojiPickerSheet`. Rows: Reply, Copy text; then role-aware: Edit / Delete (mine only), Report (others only, wraps the existing `reportCommunityContent` confirm flow). All rows have accessibility labels.
- T1.5 `EmojiPickerSheet.tsx`: category-grouped grid over `EMOJI_CATALOG` with a search field (match by name keyword).
- T1.6 `ChatComposer.tsx`: attach button (hidden when `allowAttachments` false), multiline input, send button; reply banner (target author + snippet, X to cancel); edit banner (existing pattern); @mention autocomplete: on `@` + prefix, overlay lists matches from a `mentionCandidates: { deviceId, name }[]` prop, selection inserts the name and reports `mentions` up through `onSend(body, attachments, mentions)`.
- T1.7 `ChannelSegmentedTabs.tsx`: two-segment control (Chat | Posts), accent underline, accessibility `tablist` semantics.
- Every kit component: props-only, zero provider imports, StyleSheet from `useMkStyles`, both palettes.
- Gate: component unit tests (grouping, autocomplete filter, reaction toggle callbacks), typecheck, `/review`.

### Phase 2: channel screen rebuild

- T2.1 Rebuild `channel/[communityId]/[channelId].tsx`: header (back, #name, community, ONE audience line, overflow menu: Files / Import history / Community details), `ChannelSegmentedTabs`, Chat view = `MessageList` + incoming file-request card (existing) + `ChatComposer`; Posts view = post composer + `listChannelPostCards` cards (existing PostCard, now with reaction chips via the read model). Per-message `AudienceBadge` chips removed; `AudienceRuleSummary` removed from above the composer (header line covers it). The manual Refresh header icon is REMOVED (replaced by Phase 3's loop; until Phase 3 lands in the same PR, keep them in one branch so no intermediate state ships without either).
- T2.2 Wire long-press → `MessageActionsSheet` → existing `channel.edit` / `channel.delete` confirm / report / copy / reply (reply sets composer reply state; send passes `parentId` + inherited `postId`/`branchId` when replying inside a post context) and `sendReaction`/`removeReaction`.
- T2.3 Adopt the kit in the post thread screen (`post/.../[postId].tsx`): replies render as grouped bubbles with reactions; the reply composer becomes `ChatComposer` (no attachments if that screen does not support them today; match current capability, change nothing else about thread semantics).
- T2.4 Update `apps/meerkat/CLAUDE.md` + `AGENTS.md` (chat section: kit, reactions, segmented views, header audience label) in the same session.
- Gate: mobile tests, typecheck, parity script, `/review`; `/browse`-equivalent manual pass on Expo web if runnable, else state so.

### Phase 3: live feel (focused polling drain)

- T3.1 `apps/meerkat/app/(root)/data/live-loop-core.ts`: pure cadence engine `nextDelayMs(state)` implementing immediate-on-focus / 5s hot (60s after focus, send, or applied>0) / 10s steady-while-focused / +-20% jitter / single-flight; unit tests (pure, no timers) including the worst-case latency bound (steady tick + jitter stays under 15s).
- T3.2 `useChannelLiveLoop(communityId, channelId)` hook in the channel screen: composes `useFocusEffect` + `AppState` + `effectiveRelayUrl(db)` gate; each tick runs `runForegroundDrain()`; on `appliedMessages > 0 || fileGrants > 0` refresh channel + reactions + incoming requests (the exact refresh set the old manual button covered). No relay resolved = loop stays dormant (zero network). Never writes any status row; never renders any "connected" copy.
- T3.3 Seam note as code comment + plan cross-reference: Plan 29's `autoConnectRound()` replaces the tick body 1:1 when it lands (both wrap `runForegroundDrain`); the hook exposes `tickImpl` injection for that handoff.
- T3.4 Copy sweep: any UI string implying manual-only sync on the channel screen is updated; if a string is locked by `check-meerkat-parity.mjs`, update both surfaces + the guard in the SAME commit.
- Gate: hook tests with fake timers, honesty review against invariant list, parity.

### Phase 4: web parity (`apps/meerkat-web/src/ui/channel/`)

- T4.1 Mirror the kit as web components (hover toolbar + right-click context menu replace long-press; same quick set, picker, grouping function COPIED with byte-parity if the guard locks it, else kept structurally identical with a lockstep test).
- T4.2 ChannelView adopts: grouped bubbles, right-aligned own messages, reactions, reply, mention autocomplete, segmented Chat | Posts, header audience line, overflow for import history.
- T4.3 Web live loop: `visibilitychange` visible + focus-interval polling with the same cadence core (share `live-loop-core` logic as a twin file).
- T4.4 Parity guard entries for every locked string touched; both surfaces in the same commits.
- Gate: `pnpm --filter meerkat-web test`, typecheck, parity script.

### Phase 5: hardening + ship

- T5.1 Perf: FlatList tuning (`windowSize`, `initialNumToRender=25`, `getItemLayout` where measurable), assert no full-list re-render on single message arrival (memoized bubble; test with why-did-you-render style assertion or a render-count probe in tests).
- T5.2 Full sweeps: `pnpm gate:function:changed`, all 4 typechecks, sync/mobile/web/relay test suites, `node scripts/check-meerkat-parity.mjs`, `pnpm check:generated-artifacts`, `/review` on the diff; fix AUTO-FIX items.
- T5.3 Session log + memory.md + errors_log.md per repo rules; Open Brain capture (context "personal, mylife").

---

## Acceptance Criteria

### User-facing (AC)
- AC-1 Opening a channel lands at the NEWEST message; scrolling up reveals history; new arrivals do not yank the viewport; a scroll-to-bottom pill appears when detached.
- AC-2 My messages render right-aligned in accent; others left-aligned; consecutive same-author messages group with one name and one timestamp.
- AC-3 Holding any message opens the actions sheet: 6 quick reactions, +, Reply, Copy, and Edit/Delete (mine) or Report (others). No always-visible edit/delete/report buttons remain on bubbles.
- AC-4 Reacting shows the chip immediately (local echo), replicates to the other device over the existing session/mailbox paths, and toggles off on second tap.
- AC-5 With both devices on a configured relay and device A's channel screen focused, a message sent from device B appears on device A within 15 seconds with NO user action (worst case = 10s steady tick + 20% jitter + drain time), and within ~6 seconds during A's hot window.
- AC-6 The channel shows exactly ONE audience label (header), always visible.
- AC-7 Chat | Posts are two clean segmented views; the post composer no longer sits above chat.
- AC-8 Typing `@` in the composer suggests community member names; selecting one produces a signed mention that lands in the recipient's Feed mention row (existing feed-core path).
- AC-9 Web offers every capability above with hover/context-menu instead of long-press.

### Technical (TC)
- TC-1 A react event failing shape validation (multi-grapheme, missing parentId, has attachments) is rejected at verify and never renders.
- TC-2 `groupMessages` and `nextDelayMs` are pure functions with direct unit tests.
- TC-3 The live loop is single-flight, jittered, stops on blur/background, and issues ZERO network calls when `effectiveRelayUrl(db)` resolves empty.
- TC-4 Kit components import no providers (enforced by a lint-style test greping `components/chat/` for provider imports).
- TC-5 All existing channel tests still pass; edit/delete/report flows behave identically through the new sheet.

### Negative (NC): never do
- NC-1 No fabricated delivery/read/typing/online state; polling adds NO status claims anywhere.
- NC-2 No reaction renders from an unverified or safety-hidden event.
- NC-3 No new crypto, no new event type, no descriptor schema change.
- NC-4 The audience label never disappears from the channel surface entirely.
- NC-5 Do not touch `sync-session.ts` / `noise-handshake.ts` (Plan 23 D.6 owns them).

## Test Plan

- Unit: react validation matrix (sync), reaction aggregation/toggle/tombstone (community-core + twin), grouping, cadence, autocomplete filter, mention array construction.
- Integration: provider-level sendReaction over the existing two-node channel test harness (reaction authored on A applies + aggregates on B); reply parentId inheritance inside a post context.
- UI: channel screen renders 5 states (loading, empty, error, populated, pending-send); actions sheet role matrix (mine vs other vs owner).
- Parity: guard passes; locked strings updated on both surfaces in-commit.
- Manual (Tier-D, founder-ops if 2 devices unavailable): AC-5 live two-device latency check on a real relay; list it as an ops handoff if not runnable locally.

## Founder-Ops Boundary

None beyond the standing set: the live loop needs a configured/deployed relay to demonstrate AC-5 end-to-end; without one it stays honestly dormant. No new native modules, no store changes.

## gstack Quality Gates

`/function-gate-runner` + `/review` per change batch; `/qa` on the web channel view after Phase 4; `/design-review` batch at Phase 5. Complexity routing: Large (2) → plan-eng-review already folded into this spec's review cycle.

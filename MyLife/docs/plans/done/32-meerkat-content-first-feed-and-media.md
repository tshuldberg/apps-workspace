# Feature Spec: Content-First Feed + Media Identity (Cards, Avatars, Link Previews)

> **STATUS (2026-07-04): SHIPPED + REVIEWED.** All phases (0-5, mobile + web) landed on `feature/meerkat-launch-finish` (2026-07-03/04), spec + adversarial reviewed. Content-first feed cards, why-sheet, filter sheet, signed image avatars everywhere (feed, chat bubbles, member + People rows), sender-generated link-preview cards (receiver never fetches), feed perf. AC-9 web People avatars + repo-wide TC-10 landed in the close cleanup (`b15c5e77`). Suites + parity green. Tier-D founder-ops remaining (non-blocking): a device build refresh for expo-image-picker/-manipulator (lazy-required, degrades to initials without it). Detail: `docs/sessions/2026-07-04-meerkat-ux-parity-close.md`.

> Meerkat UX-parity plan 32 (third of the 3-plan consumer UX set 30/31/32, sourced from the 2026-07-01 UI benchmark evaluation, `docs/reports/REPORT-meerkat-ui-benchmark-eval-2026-07-01.html`). Turns the Feed from a transparency dashboard into a Reddit/X-grade content surface (founder-locked form: content cards with inline media, engagement row, one muted context line, explainability behind an info tap), and gives the network a face: real image avatars on the signed community profile, and sender-generated link preview cards. Explainability and honesty are preserved as first-class, just relocated to where production apps put them.

## Metadata

- **Surfaces:** `apps/meerkat`, `apps/meerkat-web`, `packages/sync` (community-profile v2 conditional canonical only, no new crypto scheme)
- **Priority Score:** 42 / 50 (A-Tier). Market 5x3 + Switching 4x3 + Complexity 3x2 + CrossModule 2x1 + PaidUser 1x1. The feed is the first tab a new install sees; the eval scored it 3/10 vs Reddit/X and 1/10 vs TikTok, with media identity (initial-only avatars, text-only cards) flagged as the gap that most hurts the young end of the audience.
- **Estimated CC Time:** 5-7 focused sessions.
- **Status (2026-07-01):** NEW plan, nothing built. Founder decision locked 2026-07-01: content cards, Reddit/X style; full-bleed media pager explicitly NOT this plan (possible later view toggle).
- **Depends On:**
  - **Plan 30 (REQUIRED before Phases 1+):** reaction read models (`listChannelReactions`) and `sendReaction` power the feed engagement row; the chat kit's bubble avatar slot receives Phase 2's image avatars.
  - **Plan 31 (soft):** feed empty-state actions deep-link into 31's join flows; ship against whichever join entry points exist at build time.
  - Plan 20 substrate (SHIPPED): `effectiveRelayUrl(db)`; pull-to-refresh triggers the real drain and stays dormant with no relay.
- **Blocks / feeds into:** Plan 26 (open public participation) renders its public engagement on these cards; Plan 22 (billing) is untouched.
- **Build order within the UX set:** last (30 -> 31 -> 32); Phase 0 (feed data) may start once Plan 30 Phase 0 lands.
- **New dependencies (founder-ops note):** `expo-image-picker`, `expo-image-manipulator` (both Expo Go-compatible SDK modules; a `pnpm install` is required; lazy-require with null-fallback anyway per the `lan-backend.ts` pattern so absence degrades to initials, never a crash).

---

## Business Context

### Why this feature exists

The benchmark eval measured the Feed at ~40% content, 60% controls and explanations: a hero explainer, five always-visible source toggles, a kind pill + audience badge + reason sentence + action pill on EVERY card, a standing honesty paragraph, and an excluded-sources panel. Reddit, X, Instagram are the inverse. Meanwhile nothing in the app renders a human face: avatars are single initials, feed cards show no images even when a post carries an image attachment, and pasted URLs render as raw text. For the founder's mainstream bar, the feed must lead with people and content; the transparency that differentiates Meerkat moves behind the `i` affordance production apps use for "Why am I seeing this?".

### Which competitor's users this wins

Reddit users get community-scoped cards with reply counts. X users get a fast mixed feed with an honest, deterministic ranking they can actually inspect (tap the `i`: the REAL reason string feed-core already computes). Instagram-adjacent users finally see faces and photos. Nobody else offers "why am I seeing this" backed by a local deterministic engine instead of a PR answer.

### Target user

A new member whose community has 30 posts. Today they see toggle pills and explainer prose before content. Target: open Feed, see faces, photos, and posts; pull down to fetch; heart something; tap a card to reply.

---

## Current-State Grounding (verified 2026-07-01)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| Deterministic local feed engine (items, controls, reasons, exclusions) | `apps/meerkat/app/(root)/data/feed-core.ts` `evaluateLocalFeed` (386 lines; kind weights at `:140`) |
| Feed screen (rebuild target; ScrollView, hero, toggles, gap panel) | `apps/meerkat/app/(root)/(tabs)/index.tsx` |
| Public directory probe gating the Public source (TC-5) | `data/public-directory-client.ts` `probePublicDirectory`; wiring at `index.tsx:72-89` |
| Post cards with reply counts | `community-core.ts` `listChannelPostCards` |
| Reaction read models + send path | Plan 30 Phase 0 (`listChannelReactions`, `sendReaction`) |
| Blob presence check + image preview data-URI pattern | `components/AttachmentCard.tsx:81-140,382-383` |
| Blob store (hash-verified local bytes) | `data/expo-blob-store.ts` `ExpoBlobStore` |
| Signed community profile event (version-fielded, v1 canonical) | `packages/sync/src/protocol/community-profile.ts:44-90` (`canonicalCommunityProfile`, `createCommunityProfileEvent`, `verifyCommunityProfileEvent`) |
| `cm_profiles` schema + OR-set apply + name/initial resolvers | DDL `community-core.ts:317-325` (no version column yet, see T2.2); row mapping `:1169-1180`; `resolveCommunityDisplayName` `:1259`, `resolveCommunityAvatarInitial` `:1282` |
| Column-add migration pattern (generic ensureColumn ALTER, MK-P01) | `community-core.ts` (re-grep `ensureColumn`) |
| Conditional canonical append precedent (v2 fields signed only when version bumps; v1 bytes byte-identical) | `channel-message.ts:91` dispatch; P9.3b rights block |
| Sync policy with explicit per-table rules + rule-less-table guard test | `community-core.ts:89` `COMMUNITY_SYNC_POLICY`; cm_profiles rule at `:116-120` |
| Attachment pipeline with per-module size caps | `ensureBlobPolicy` usage at `channel/[communityId]/[channelId].tsx:223-260` |
| Profile editor UI (extend, do not rebuild) | `communities.tsx` `CommunityProfileCard` (relocates to community settings in Plan 31; build against wherever it lives at execution time) |
| Honest drain for pull-to-refresh | `SyncProvider.tsx` `runForegroundDrain` |
| Web twins | `apps/meerkat-web/src/ui/feed/`, `.../community/` |
| Parity guard | `scripts/check-meerkat-parity.mjs` |

### Genuinely net-new (this plan builds)

1. Feed item enrichment: first-image attachment surfacing, reply counts, reaction summaries on post-kind items.
2. Feed screen rebuild: FlatList cards (founder-approved form), pull-to-refresh running the REAL drain, `i` why-sheet, filter sheet (sources + excluded list relocated), media rendering, engagement row.
3. Community profile v2: signed `avatarImage` (downscaled, hard-capped) with conditional canonical append; `resolveCommunityAvatarImage`; avatar rendering across feed, chat kit, member rows, People list; picker + downscale flow in the profile editor.
4. Sender-generated link previews encoded as a typed attachment riding the EXISTING attachment/blob pipeline; receiver never fetches; link cards in bubbles and feed; settings toggle.

---

## Technical Context

### Design decisions (locked)

1. **Card anatomy (founder-approved 2026-07-01):** avatar + author name + one muted context line (`Community · time · i`) on row 1; inline media (first image attachment, tap -> existing attachment/post view) when present; body text (numberOfLines 5, tap -> post/channel); engagement row `[💬 replyCount] [❤ quick-react + count] [↗ Share, PUBLIC items only]`. Kind pills, audience badges, reason sentences, and action pills LEAVE the card. Audience/scope facts render inside the why-sheet.
2. **The `i` why-sheet is the explainability home.** Tapping `i` presents: the item's REAL `reason` string (already computed by feed-core), its kind, its audience rule line, the exact source toggle controlling it, and a link to the filter sheet. Nothing about the ranking becomes less inspectable; it becomes one tap deep, matching X/Instagram grammar.
3. **Filter sheet replaces inline toggles.** A header filter icon opens a sheet containing the existing source toggles (`getVisibleFeedControls` unchanged, including the TC-5 public gating) plus the relocated "Not in this feed yet" excluded-sources list. Default feed = current defaults; zero configuration required before content shows.
4. **Pull-to-refresh is a real fetch.** `RefreshControl` runs `runForegroundDrain()` + `probePublicDirectory(db)` + re-evaluate. With no relay resolvable it completes quickly having done only the local re-evaluate; the empty state then says content updates arrive when a connection server is configured (honest, links to the capability-status page from Plan 31).
5. **Share is public-only.** `↗` renders ONLY on `kind === 'public'` items and shares the public link. Private community content gets no external share affordance (privacy-by-structure; copying text manually remains possible in the channel).
6. **Avatar = signed profile field, hard-capped.** `cm_profiles` gains `avatar_image TEXT` (ensureColumn ALTER). `CommunityProfileEvent` version 2: canonical = v1 array with `avatarImage` appended ONLY when `version === 2` (byte-identical v1; the exact MK-P01/P9.3b precedent). `avatarImage` = base64 JPEG, downscaled client-side to 128x128 via `expo-image-manipulator`, hard cap 32 KB decoded (43,690 base64 chars) enforced at create AND verify (oversized v2 events fail verification, fail-closed). Picker: `expo-image-picker` with square crop; both modules lazy-required with null fallback -> editor shows "Photo avatars need an app update on this device" and keeps the initial flow. Rendering precedence everywhere: image -> initial -> `?`. The avatar replicates as a normal `cm_profiles` OR-set row (existing policy rule; the rule-less-table guard already covers the table).
7. **Link previews are sender-generated, receiver-passive (Signal model).** On send, if the body contains a URL and the "Generate link previews" setting (`mk_settings` key `link_previews_enabled`, default on, honest description: "Meerkat fetches the page you are sharing to build the preview. People who receive it never fetch anything.") is on: sender fetches the URL (8s timeout, 512 KB read cap), extracts og:title / og:description / og:image (first 2), downscales og:image to max 320px JPEG via image-manipulator, and encodes `{ url, title, description?, imageBase64? }` as an attachment with `mimeType: 'application/x-meerkat-link-preview+json'`, `name: 'link-preview'`, riding the EXISTING attachment + blob pipeline (size caps, hash verify, blob replication all free). Receivers render a link card (image, title, domain; tap -> confirm-open-browser sheet showing the full URL) and NEVER auto-fetch. Fetch failure or toggle-off = plain text URL, no preview, no retry loop. Preview JSON hard cap 64 KB; a malformed preview attachment renders as a plain file chip (never crashes, never fetches).
8. **Feed stays deterministic and local.** No new ranking inputs; enrichment (media, counts) decorates existing items. `evaluateLocalFeed`'s contract is extended, not forked; web twin stays lockstep.

---

## Phases

### Phase 0: feed data enrichment (pure, test-first)

- T0.1 `feed-core.ts`: extend `FeedItem` with `media?: { blobHash: string; mimeType: string } | null`, `replyCount?: number`, `reactions?: MessageReactionGroup[]` (type from Plan 30). Populate: post items surface the root event's first image attachment + reply count (`listChannelPostCards` computes it, and Plan 30 T0.3 is the HARD dependency that excludes `intent='react'` events from that count, from `lastActivity`, and from unread; verify 30 T0.3 landed before trusting these numbers) + reaction groups; file items keep current shape. Ranking weights UNCHANGED. Unit tests: enrichment presence matrix, no ranking drift (snapshot the order of a fixed fixture before/after), and a react-event fixture asserting reactions do not create feed items or inflate counts.
- T0.2 Web twin `feed-core` lockstep (byte-parity where the guard locks it).
- Gate: `pnpm gate:function:changed`, sync/mobile/web tests, parity.

### Phase 1: feed screen rebuild

- T1.1 Rebuild `(tabs)/index.tsx`: `FlatList` (virtualized; `onEndReached` grows a render window over the evaluated list), card per design decision 1 (avatar via Phase 2 resolver with initial fallback so Phase order is safe), media via the AttachmentCard data-URI pattern against `ExpoBlobStore`, engagement row wiring `sendReaction`/`removeReaction` (Plan 30) on post roots and navigation to post/channel/files exactly as today's `openItem`.
- T1.2 `components/feed/WhySheet.tsx` per design decision 2; `components/feed/FeedFilterSheet.tsx` per decision 3 (toggles + excluded list relocated; hero panel and standing HonestNotice REMOVED from the scroll, their honest content redistributed into the why-sheet + capability-status page; locked strings updated with the guard in the same commit).
- T1.3 Pull-to-refresh per decision 4. Empty states: no communities -> two big actions (Join with an invite / Create a community, deep-linked into Plan 31 flows when present, else current routes); has communities but no items -> "Quiet right now" + pull hint.
- T1.4 Loading/error/partial states for the public probe (satisfies Plan 23 D.4 for the NEW screen; note the supersession in 23's Status Delta at ship).
- Gate: mobile tests (5 states), typecheck, parity, `/review`.

### Phase 2: image avatars (engine + everywhere)

- T2.1 `community-profile.ts` v2: `avatarImage?: string` on the event; conditional canonical append when `version === 2`; `createCommunityProfileEvent` accepts `avatarImage` (validates cap, sets version 2 only when present); `verifyCommunityProfileEvent` accepts versions 1 and 2, enforces the 32 KB decoded cap and data-shape (base64 JPEG magic) on v2, rejects otherwise. Tests: v1 bytes byte-identical (regression fixture), v2 sign/verify roundtrip, oversized rejected, tampered image fails signature.
- T2.2 `community-core.ts`: add BOTH `avatar_image` AND `version` columns via ensureColumn ALTER (the current row mapping hardcodes `version: 1` at `communityProfileEventFromRow`, `community-core.ts:1169-1180`; without a persisted version, a stored v2 event reconstructs as v1 with different canonical bytes, fails `verifyCommunityProfileEvent` on read, and is dropped fail-closed, so avatars would never render after reload). Extend `communityProfileRowFromEvent` / `communityProfileEventFromRow` (+ web twin) to persist and restore `version` + `avatar_image`; `resolveCommunityAvatarImage(db, communityId, deviceId): string | null` (+ web twin); `SyncProvider.setCommunityProfile` passes it through. REQUIRED test: a v2 event survives a row round-trip (store -> reconstruct -> verify passes); a v1 row round-trips unchanged.
- T2.3 Profile editor (wherever `CommunityProfileCard` lives at execution time): "Choose photo" via lazy `expo-image-picker` (square, quality 0.7) -> lazy `expo-image-manipulator` resize 128x128 JPEG -> cap check -> save; remove-photo action; unavailable-module fallback copy per decision 6.
- T2.4 Render precedence image -> initial -> `?` in: feed cards (T1.1 slot), Plan 30 chat-kit bubble avatar slot, community member rows, Messages People rows (Plan 31 surface), post thread. One shared `components/Avatar.tsx` (+ web twin) so precedence lives once.
- Gate: sync + mobile + web tests, parity, `/review`.

### Phase 3: link previews

- T3.1 `data/link-preview.ts` (+ web twin): `extractFirstUrl(body)`, `buildLinkPreview(url, fetchImpl)` (timeout/read-cap/og-parse/downscale, returns typed result or null, NEVER throws), `encodeLinkPreviewAttachment(preview)` / `parseLinkPreviewAttachment(bytes)` (64 KB cap, fail-to-null). Pure parts unit-tested with fixture HTML (og present, missing, malformed, oversized, non-HTML).
- T3.2 Send integration: `ChatComposer` send path (Plan 30 kit) builds the preview attachment when the toggle is on; settings toggle row (`mk_settings.link_previews_enabled`, default on, honest description verbatim from decision 7).
- T3.3 Render: `components/LinkPreviewCard.tsx` (+ web twin) in bubbles and feed cards; unknown/malformed preview attachments degrade to the plain file chip; tapping shows the confirm-open sheet with the full URL before leaving the app.
- Gate: tests (fixtures, degrade paths), parity, `/review`.

### Phase 4: web parity

- T4.1 Feed twin: cards, why-popover, filter panel, refresh button (web has no pull gesture; a refresh control in the header runs the same real path), avatars, link cards.
- T4.2 Profile editor twin: file input + canvas downscale to the SAME 128x128/32 KB contract (no native modules on web); lockstep tests on the cap.
- Gate: web tests, typecheck, parity.

### Phase 5: hardening + ship

- T5.1 Perf: feed FlatList render-window test; avatar/data-URI memoization (no per-scroll re-decode).
- T5.2 Full sweeps: `pnpm gate:function:changed`, 4 typechecks, all suites, parity, `check:generated-artifacts`, `/review`; fix AUTO-FIX items.
- T5.3 Update `apps/meerkat/CLAUDE.md` + `AGENTS.md` (feed form, avatars, link-preview privacy model); Plan 23 D.4 supersession note; session log + memory.md + errors_log.md; Open Brain capture ("personal, mylife").

---

## Acceptance Criteria

### User-facing (AC)
- AC-1 The default Feed shows content cards only: no hero panel, no inline toggle row, no per-card kind/audience pills, no standing notice paragraph.
- AC-2 A post with an image attachment shows the image inline; tapping media or body navigates exactly where today's quick actions went.
- AC-3 Tapping `i` on any card shows its real reason, kind, audience, and controlling source toggle.
- AC-4 Pull-to-refresh performs a real drain + directory probe and new applied items appear; with no relay it completes honestly with local re-evaluate only.
- AC-5 Hearting a post from the feed creates a real signed reaction visible in the channel (and vice versa); tapping again removes it.
- AC-6 A member who sets a photo avatar appears with that photo in feed, chat, member rows, and People on OTHER members' devices after a real sync; devices without the image modules still see initials and can still edit names.
- AC-7 Sending a message containing a URL (toggle on) delivers a link card with title/image to the recipient; the recipient's device performs zero fetches to render it; tapping shows the full URL before opening.
- AC-8 Share appears only on public items.
- AC-9 Web mirrors AC-1/2/3/5/6/7 with its refresh control.

### Technical (TC)
- TC-1 v1 profile events remain byte-identical (fixture regression) and verify; v2 with a tampered or oversized avatar fails verification.
- TC-2 Feed ranking order for a fixed fixture is unchanged by enrichment (snapshot test).
- TC-3 `buildLinkPreview` respects timeout and read cap; `parseLinkPreviewAttachment` returns null on anything malformed; no render path can trigger a network fetch on the receiving side (grep-style test: link render components import no fetch).
- TC-4 The public source toggle remains gated by the real probe (TC-5 of Plan 19 preserved).
- TC-5 All caps (32 KB avatar, 64 KB preview, 320px image) enforced at both create and verify/parse.

### Negative (NC): never do
- NC-1 No fabricated engagement: every count renders from verified local rows; no seeded/like-bait numbers.
- NC-2 No receiver-side URL fetching, ever (the Signal rule).
- NC-3 No external share affordance on private community content.
- NC-4 Explainability never disappears: every card's reason remains one tap away; the source toggles remain user-controllable.
- NC-5 No new ranking signals, no server-side ranking, no engagement-optimizing reorder.
- NC-6 Avatars and previews never bypass signature verification or the sync policy (profile rows and attachments only).

## Test Plan

- Unit: enrichment matrix, ranking snapshot, profile v1/v2 canonical + caps, og-parse fixtures, preview encode/parse degrade, URL extraction, avatar resolver precedence.
- Integration: reaction-from-feed roundtrip over the two-node harness; profile-with-avatar replication applies and renders on node B; preview attachment rides the existing blob pipeline and verifies.
- UI: feed 5 states + filter/why sheets; editor with/without native modules (mock null).
- Parity: guard green; twins lockstep.
- Manual/Tier-D: real-device photo pick + crop; a live URL preview against a real site (founder-ops if no device/network in session; list explicitly).

## Founder-Ops Boundary

`pnpm install` for the two Expo modules; a dev/EAS build refresh afterward for devices. Everything else is code-side. Link-preview outbound fetches are sender-device only and controlled by the default-on toggle; no server component.

## gstack Quality Gates

`/function-gate-runner` + `/review` per phase; `/qa` on the web feed after Phase 4; `/design-review` batch at the UX-set close (30+31+32 together). Complexity routing: Large (2).

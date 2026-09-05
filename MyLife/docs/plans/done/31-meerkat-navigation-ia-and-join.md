# Feature Spec: Navigation IA + Frictionless Join (5 Tabs, Tap-to-Join, Honest Simplicity)

> **STATUS (2026-07-04): SHIPPED + REVIEWED.** All phases (mobile P0-P4, web P5, ship) landed on `feature/meerkat-launch-finish` (2026-07-03/04), spec + adversarial reviewed. 5-tab IA (Friends folded into Messages), one join pipeline / four doors (never auto-joins), Communities list/detail/settings restructure, onboarding v2, capability-status page. Suites + parity green. Tier-D founder-ops remaining (non-blocking, code degrades gracefully): cold-start invite deep-link + camera QR scan need a dev build + 2 devices (runbook `docs/guides/meerkat-founder-ops-runbook.md`). Detail: `docs/sessions/2026-07-04-meerkat-ux-parity-close.md`.

> Meerkat UX-parity plan 31 (second of the 3-plan consumer UX set 30/31/32, sourced from the 2026-07-01 UI benchmark evaluation, `docs/reports/REPORT-meerkat-ui-benchmark-eval-2026-07-01.html`). Restructures navigation to the Discord/Signal grammar a mainstream user already knows: 5 tabs (Friends merges into Messages), Communities becomes a real navigation surface (list -> community screen -> settings) instead of an admin console, joining becomes tap-a-link or scan-a-QR with a preview sheet instead of pasting `meerkat://` text, onboarding asks one question at a time and offers a zero-commitment browse path, and the per-screen HonestNotice paragraphs consolidate into inline states plus one "What works today" page. No engine changes; this is IA, routing, and copy over existing verified flows.

## Metadata

- **Surfaces:** `apps/meerkat` (Expo Router), `apps/meerkat-web` (navigation/community/onboarding twins). `packages/sync` untouched except read-only reuse.
- **Priority Score:** 45 / 50 (A-Tier). Market 5x3 + Switching 5x3 + Complexity 3x2 (medium: routing + decomposition of existing screens) + CrossModule 1x1 + PaidUser 3x1. Join friction is the single biggest onboarding blocker found by the benchmark eval; the Communities admin-console IA is the biggest comprehension blocker.
- **Estimated CC Time:** 6-8 focused sessions.
- **Status (2026-07-01):** NEW plan, nothing built. Founder decision locked 2026-07-01: merge Friends into Messages, 5 tabs total.
- **Depends On:**
  - Plan 30 Phases 0-2 SHOULD land first (this plan relocates the history-import overflow entry Plan 30 creates, and the community screen links into the rebuilt channel screen), but nothing here breaks if 30 is mid-flight; file ownership is disjoint (30 owns `channel/`, `post/`, `components/chat/`; 31 owns tabs layout, `communities`, `community/`, `messages`, `friends` removal, onboarding, `me`).
  - Plan 20 (SHIPPED substrate): `effectiveRelayUrl(db)` health-gated choke point (synchronous, returns a string; do not `await` it); `DEFAULT_RELAY_URL` stays `''` until founder-ops deploys the free relay. The add-friend flow built here uses the choke point EXCLUSIVELY and keeps working (honestly failing) with no default configured.
  - **Plan 23 D.1/D.2 ordering (binding):** Plan 23's pending workstream D.1/D.2 edits the owner-review UI inside `communities.tsx`, the exact JSX Phase 2 relocates. Either land 23 D.1/D.2 BEFORE Plan 31 Phase 2, or Plan 31 relocates whatever is current and Plan 23's Status Delta is updated in the same session to redirect D.1/D.2 targets to `community/[communityId]/settings.tsx`. Never let both edit `communities.tsx` admin JSX concurrently.
- **Blocks / feeds into:**
  - **Plan 21 Phase 5 (DM thread UI):** MUST slot its conversation list into the Messages screen shell this plan builds (`messages.tsx` sections: Chats above People). Sequence Plan 31 Phase 0 BEFORE Plan 21 Phase 5, or if 21 reaches Phase 5 first, 21 builds the list standalone and this plan's Phase 0 becomes a merge task. Coordinate via the master orchestration doc.
  - **Plan 32 (feed):** feed empty-state deep-links into the join flows built here.
  - **Plan 26 (open public participation)** and **Plan 24 (humanity verification):** both present sheets from surfaces this plan restructures; they consume the new route names (map in Phase 6 notes).
- **Build order within the UX set:** after 30 (or overlapped with disjoint files), before 32 polish lands.

---

## Business Context

### Why this feature exists

The benchmark eval scored Communities 4/10 vs Discord and identified two systemic blockers. First, comprehension: the Communities tab permanently leads with a Create form and a paste-a-link Join form, then renders every community as an inline admin card (profile editor, member list with block buttons, owner review queue, public reports, publish controls, invite + leave). Discord's equivalent surface is a list; ALL administration lives behind a gear. Second, friction: joining anything requires pasting `meerkat://community/join#...` into a mono textarea, and adding a friend requires first typing a `ws://` server URL (`friends.tsx:188-242`), which is the starkest anti-mainstream moment in the app. QR components exist (`QrScanner.tsx` with lazy `expo-camera` + `isQrScannerAvailable()`, `QrCode.tsx`) but are only used for theme sharing. The app scheme `meerkat` is registered (`apps/meerkat/app.json:7`) but no route receives invite links.

### Which competitor's users this wins

Discord users get the server-list -> channel-list -> chat spatial model they navigate on muscle memory. Signal users get add-by-code with no server talk. WhatsApp users get tap-an-invite-link-and-you-are-in. The boomer test: every screen has one obvious job. The 7-year-old test: join a community by pointing the camera at a QR code on a friend's phone.

### Target user

A brand-new install whose friend says "join my community". Today that requires: receive a text blob, copy it, find the Communities tab, find the paste box under the create form, paste, tap Join. Target: tap the link (or scan the code), see "Weekend Hikers, 4 members, invited by an admin", tap Join.

---

## Current-State Grounding (verified 2026-07-01)

### Already real (reuse verbatim, do NOT reimplement)

| Capability | Anchor |
|-----------|--------|
| Tab registry (6 visible tabs + hidden technical routes) | `apps/meerkat/app/(root)/(tabs)/_layout.tsx:61-163` |
| Invite parse WITHOUT joining (preview-safe) | `packages/sync/src/protocol/community.ts:453` `parseCommunityInviteLink` |
| Invite verification (owner/admin signature, expiry) | `community.ts:473` `verifyCommunityInvite` |
| Join from link (idempotent, reason-coded failures) | `community.ts:605` `joinCommunityFromLink` |
| Post-join owner-approval request + drain | `communities.tsx:103-141` `onJoin` (extract, do not rewrite semantics) |
| Invite creation (expiring, signed) | `community.ts:422` `createCommunityInvite` |
| QR render + lazy camera scanner with availability gate | `app/(root)/components/QrCode.tsx`, `QrScanner.tsx` |
| App scheme registered | `apps/meerkat/app.json:7` (`"scheme": "meerkat"`) |
| Friend pairing over a relay (publish + resolve by code) | `SyncProvider.tsx` `publishFriendCode`, `pairWithFriendCode` (called at `friends.tsx:73-113`) |
| Relay choke point (NEVER read the setting directly) | `data/effective-relay.ts` `effectiveRelayUrl(db)` |
| Friend rows + trust states + SAS | `data/friends-core.ts` `buildFriendRows`; `friends.tsx:255-306` |
| Per-community profile editor, members, owner review, public reports, publish, invite, leave (relocation source) | `communities.tsx:257-463` |
| Unread counts per channel | `community-core.ts` `listCommunityChannelUnreadCounts` |
| Onboarding 3-step gate | `app/(root)/components/OnboardingGate.tsx` (`ONBOARDING_COMPLETE_KEY`) |
| Me hub rows (Advanced connection, Settings, Appearance) | `me.tsx:95-141` |
| Web twins for navigation/community/onboarding/friends/messages | `apps/meerkat-web/src/ui/{navigation,community,onboarding,friends,messages}/` |
| Parity guard | `scripts/check-meerkat-parity.mjs` |

### Genuinely net-new (this plan builds)

1. 5-tab layout; Messages screen shell (Chats section + People section + Add flow); Friends tab retired (route redirects).
2. `data/join-flow.ts`: extracted, shared join orchestration (parse -> verify -> preview model -> join -> queue approval) used by every entry point.
3. `InvitePreviewSheet` (both surfaces) + deep-link intake for `meerkat://community/join#...` + QR scan entry points + native share sheet for invites.
4. Communities list screen; `community/[communityId]` screen (channel list); `community/[communityId]/settings` screen (all relocated admin).
5. Add-friend flow with zero visible server configuration (choke-point resolution + honest no-server state).
6. Onboarding v2: one question per step + "Just look around" browse path.
7. `data/capability-status.ts` + "What works today" page; HonestNotice consolidation pass.

---

## Technical Context

### Design decisions (locked)

1. **5 tabs: Feed, Communities, Discover, Messages, Me** (founder decision 2026-07-01). `friends` and its route leave the tab bar; `app/(root)/(tabs)/friends.tsx` becomes a redirect to `/messages` so old links/state never 404. All hidden technical routes stay hidden as today.
2. **Messages = people + conversations.** Sections top-down: "Chats" (Plan 21 fills with real conversations; until then it renders the honest empty state "No private chats yet. Private messages are not available in this version; your community chats are live." with NO fake rows and NO schedule promise), then "People" (friend rows with trust pill + SAS state, tap -> person sheet: safety code compare, block/unblock, and Message which stays honestly disabled until Plan 21 flips `DM_MESSAGES_SURFACE_AVAILABLE`). Header "+" opens Add friend.
3. **Add friend shows zero transport.** The flow: your code (big, copyable, QR-rendered) + "Scan their code" (camera when available) + a code input. Resolution calls `publishFriendCode` / `pairWithFriendCode` with `effectiveRelayUrl(db)` (synchronous). If no relay resolves, the flow embeds the EXISTING `ConnectionStatusCard` (`components/ConnectionStatusCard.tsx`), whose five parity-locked probe states already distinguish no-server-configured vs default-unreachable vs opted-out; author NO new status copy and NO roadmap promise (a "free default is coming" line is forbidden: it turns false on opt-out, on probe failure, and if founder-ops never deploys). One short static line above the card: "Adding a friend needs a connection server." The `ws://` input LEAVES this surface entirely; `sync.tsx` (Advanced connection, reachable from Me) keeps full manual control.
4. **One join pipeline, four doors.** `data/join-flow.ts` exposes `previewInvite(link)` (parse + verify -> `{ name, memberCount, channelCount, expiresAt, inviterRole }` or a reason-coded failure using the EXISTING reason texts from `communities.tsx:107-112`) and `executeJoin(db, identity, link, deps)` (wraps the current `onJoin` semantics verbatim: join, queueJoinRequest, drain, honest notices). Doors: (a) OS deep link `meerkat://community/join#...`, (b) QR scan, (c) paste (fallback, kept), (d) onboarding. Every door renders the SAME `InvitePreviewSheet` before any join executes; the sheet's Join button is the only join trigger.
5. **Deep-link intake** lives in `(root)/_layout.tsx` via `Linking.useURL()`: any URL whose parse succeeds as a community invite presents the preview sheet over whatever screen is active (a malformed or failed-verification link shows the existing reason text and NOTHING else; never auto-joins). Cold-start URLs (`getInitialURL`) route the same way after providers are ready. ROUTE COLLISION GUARD (mandatory): the wire prefix is fixed at `meerkat://community/join#...` (`community.ts:407`, cannot change: existing invites + `packages/sync` read-only), and its path segment `community/join` would otherwise match this plan's new dynamic route as `communityId = 'join'`. Register an explicit STATIC route `(tabs)/community/join.tsx` as the intake screen (static segments win over dynamic in expo-router); it reads the fragment, presents the preview sheet, and renders nothing else. Additionally `community/[communityId].tsx` treats the reserved id `join` as not-found (defense in depth). Test both.
6. **Communities is a list; admin is a gear.** Tab screen: community cards (avatar initial, name, role chip, total unread badge, muted state) + ONE header "+" opening a two-option sheet (Create / Join). `community/[communityId]` screen: channel rows (existing unread + mute affordances), Files row, member count row -> settings. `community/[communityId]/settings`: relocated VERBATIM logic from `communities.tsx:257-463` (profile-in-community editor, members + block, owner review queue, OwnerPublicReports, Make public, invite creation now presented as a share sheet with QR + native share + copy, mute, leave, and the history-import panel re-homed from Plan 30's overflow). Relocation means moving JSX + handlers, not rewriting verified flows.
7. **Onboarding v2 asks one thing per screen.** Step 1 name (unchanged, with a one-tap suggested name). Step 2 ONE list, four rows: "Create a community", "Join with an invite" (opens scanner/paste -> preview sheet), "Add a friend" (the new flow), "Just look around" (marks `ONBOARDING_COMPLETE_KEY` and lands on Discover). Step 3 first-message (unchanged). No panel-stack of three forms.
8. **Honesty consolidation, not deletion.** New `data/capability-status.ts`: one typed list of capabilities with `live | partial | pending` status and the honest one-liner each (single source, web twin). New `me.tsx` row "What works today" -> `about-status.tsx` page rendering that list. Standing `HonestNotice` paragraphs on Feed/Messages/Communities/Friends surfaces are then replaced by: inline disabled/empty states where the notice explained a control, or a single short line linking to the status page. Contextual confirms (delete, block, report) and transport-honesty strings LOCKED by the parity guard stay; every removal that touches a locked string updates both surfaces + the guard in the SAME commit. The transport honesty boundary in `apps/meerkat/CLAUDE.md` is not weakened: nothing implied-connected appears anywhere.

### Route map after this plan

```
(tabs)/index          Feed
(tabs)/communities    Community list (+ create/join sheet)
(tabs)/discover       Discover (unchanged)
(tabs)/messages       Chats + People + Add friend entry
(tabs)/me             Me (+ What works today row)
(tabs)/community/join                     STATIC invite-intake route (beats the dynamic
                                          segment; reserved id guarded in the dynamic route)
(tabs)/community/[communityId]            channel list (hidden from tab bar)
(tabs)/community/[communityId]/settings   admin surface (hidden)
(tabs)/friends        redirect -> /messages (kept one release for state safety)
join intake           (root)/_layout.tsx URL listener + community/join static route,
                      both presenting the same InvitePreviewSheet
```

---

## Phases

### Phase 0: Messages shell + tab merge

- T0.1 `_layout.tsx`: remove the `friends` visible entry; final order Feed, Communities, Discover, Messages, Me; `friends` becomes `href: null`.
- T0.2 `friends.tsx` -> `<Redirect href="/messages" />` (expo-router Redirect), preserving nothing else.
- T0.3 Rebuild `messages.tsx` per design decision 2: Chats section (honest empty state exactly as specced; when Plan 21 has landed first instead, adopt its list into this shell as a merge task), People section from `buildFriendRows` with trust pills, person action sheet (safety code + SAS emoji compare + mark-checked via `confirmPeerSas`, Block via `revokePeer`, honestly disabled Message). Header "+" -> Add friend screen.
- T0.4 New `add-friend.tsx` (hidden route) per design decision 3, including the QR render of your own friend code (`QrCode`) and `QrScanner` gated by `isQrScannerAvailable()`; paste/type input kept. All resolution through `effectiveRelayUrl(db)` (synchronous); the no-resolution state embeds `ConnectionStatusCard` per decision 3 (no new status copy); NO ws:// input on this surface.
- T0.5 Tests: friend-row rendering states, add-friend no-relay state, redirect. Update `CLAUDE.md`/`AGENTS.md` IA section same session.
- Gate: mobile tests + typecheck + parity + `/review`.

### Phase 1: one join pipeline, four doors

- T1.1 `data/join-flow.ts`: `previewInvite` + `executeJoin` extracted from `communities.tsx:103-141` with unit tests covering every reason code (malformed, expired, invalid, not_authorized) and the approval-queue notice matrix (ok / already_member / no_relay / park-fail retry).
- T1.2 `components/InvitePreviewSheet.tsx`: community name, member + channel counts, expiry countdown, inviter role line, one primary Join button, cancel; failure states render ONLY the existing reason texts. On join success: navigate to the community's first channel.
- T1.3 Deep-link intake per design decision 5: the static `(tabs)/community/join.tsx` intake route + the `(root)/_layout.tsx` listener (`Linking.useURL` + cold-start `getInitialURL`), both presenting the same sheet; the reserved-id guard in `community/[communityId].tsx`; tests for static-beats-dynamic resolution and the guard.
- T1.4 Scan entry points: the communities "+" sheet Join option and onboarding both offer Scan (camera-gated) + Paste.
- T1.5 Invite SHARE side: in community settings (Phase 2) the invite presents as a share sheet: native `Share.share` with the link, QR render, Copy. Until Phase 2 lands, wire the same share sheet into the current invite button location so the capability ships with this phase. QR SIZE BOUNDARY (mandatory honesty): invite links embed the FULL signed descriptor including every member (`community.ts:443`, member entries at `community.ts:126-127`), and the in-repo QR encoder ceilings out near 2.3 KB (`packages/meerkat-theme/src/qr.ts:188-195`; `QrCode.tsx:21` returns null above it), which a community of roughly 10-15 members exceeds. When `QrCode` cannot encode, the share sheet MUST render the copy/native-share options with the honest line "This community is too large for a QR code. Share the invite link instead." and NO broken/blank QR. A compact rendezvous-style invite (short code resolving the descriptor over a relay) is a named follow-up for Plan 27/29 territory, NOT this plan.
- Gate: join-flow unit tests, sheet state tests, typecheck, parity, `/review`.

### Phase 2: Communities restructure

- T2.1 `communities.tsx` -> community LIST per design decision 6 (cards: name, role chip, unread total from `listCommunityChannelUnreadCounts` summed, muted dimming; existing create/join logic moves behind the "+" sheet, create keeps `DEFAULT_CHANNELS` and `storeOwnedCommunity` verbatim).
- T2.2 New `community/[communityId].tsx`: channel rows (open, unread badge, mute toggle preserved), Files row (existing route), members preview row, gear -> settings. Empty/loading/missing-community states.
- T2.3 New `community/[communityId]/settings.tsx`: relocate `communities.tsx:257-463` blocks verbatim (CommunityProfileCard, members + block, owner review + `markSafetyActionReviewed`, `OwnerPublicReports`, Make public -> `PublishSheet`, invite share sheet, mute community, leave with confirm) + the history-import panel re-homed from the Plan 30 channel overflow (move the component, keep behavior).
- T2.4 Register the new hidden routes in `_layout.tsx`; update every `router.push('/communities')`-adjacent navigation (feed empty state, onboarding) to the right depth.
- T2.5 Tests: list unread aggregation, settings relocation smoke (owner vs member role gating unchanged), route registration.
- Gate: full mobile suite + typecheck + parity + `/review`.

### Phase 3: onboarding v2

- T3.1 Rework `OnboardingGate.tsx` step 2 into the single four-row choice list (design decision 7); Create and first-message steps keep their existing handlers (`createFirstCommunity`, `sendFirstMessage`, invite copy chip); Join row opens the Phase 1 preview sheet; "Just look around" completes onboarding -> Discover.
- T3.2 Name step: pre-filled suggestion + "Use this name" one-tap (suggestion = current `displayName` default; no network).
- T3.3 Tests: each path completes onboarding exactly once; browse path never creates identity-adjacent side effects beyond the existing gate completion.
- Gate: mobile tests + `/review`.

### Phase 4: honesty consolidation

- T4.1 `data/capability-status.ts` (+ web twin): typed entries for community chat, posts, reactions (post-30), file sharing, public viewing, DMs (pending until 21), calls (pending, 25), background sync, self-host, default server; each `status` + one honest line. A unit test asserts no entry claims live for a capability whose flag/substrate is absent (wire to real flags where they exist, e.g. `DM_MESSAGES_SURFACE_AVAILABLE`).
- T4.2 `about-status.tsx` page + Me row.
- T4.3 Notice sweep per design decision 8 across `index.tsx` (feed), `messages.tsx`, `communities` surfaces, `add-friend`; every locked-string touch updates both surfaces + `check-meerkat-parity.mjs` in the SAME commit.
- Gate: parity + honesty review against the invariant list + `/review`.

### Phase 5: web parity

- T5.1 Navigation twin -> 5 sections; friends nav entry folds into Messages (People panel), redirect preserved.
- T5.2 Community list / community detail / settings split in `apps/meerkat-web/src/ui/community/`; invite share (copy + QR render; no native share on web).
- T5.3 Join doors on web: paste + preview sheet (no camera requirement; add `getUserMedia` QR scan ONLY if a maintained dependency-free approach exists in-repo, else paste+preview only and say so in the status page).
- T5.4 Onboarding v2 twin; capability-status twin; parity guard entries.
- Gate: web tests + typecheck + parity.

### Phase 6: hardening + ship

- T6.1 Full sweeps: `pnpm gate:function:changed`, 4 typechecks, mobile/web/sync suites, parity, `check:generated-artifacts`, `/review`; fix AUTO-FIX items.
- T6.2 Cross-plan notes: update Plan 21's Status Delta (Messages shell exists; Phase 5 slots into it; person sheet Message button flips with `DM_MESSAGES_SURFACE_AVAILABLE`; AND rewrite Plan 21's `friends.tsx` edit targets, e.g. its Phase 5/9 "Message opens thread" + line-cited deletions, to the Messages People person sheet, since `friends.tsx` is now a redirect), Plan 23's Status Delta if Phase 2 relocated the D.1/D.2 target JSX (per the Depends On rule), and Plans 24/26 route references if their sheets target renamed surfaces.
- T6.3 Session log + memory.md + errors_log.md; Open Brain capture ("personal, mylife").

---

## Acceptance Criteria

### User-facing (AC)
- AC-1 Tab bar shows exactly Feed, Communities, Discover, Messages, Me.
- AC-2 Tapping a `meerkat://community/join#...` link from another app opens Meerkat directly to a preview (name, members, channels, expiry) with one Join button; joining lands in the first channel.
- AC-3 The same preview appears for QR scan, paste, and onboarding joins; an invalid/expired link shows the existing reason text and never joins.
- AC-4 Adding a friend never shows a server URL field; with no relay resolvable the flow renders the real ConnectionStatusCard probe state (no roadmap promises) and Advanced remains reachable via Me.
- AC-5 Communities tab is a scannable list; every community opens to its channel list; ALL admin lives behind the gear; create/join live behind "+".
- AC-6 Onboarding asks one question per screen and offers "Just look around" into Discover without creating or joining anything.
- AC-7 Me contains "What works today" listing live vs pending capabilities with honest one-liners.
- AC-8 Web mirrors AC-1/3/5/6/7 (join doors per T5.3).

### Technical (TC)
- TC-1 `previewInvite` never mutates state; join executes ONLY from the sheet's Join button.
- TC-2 No file except `effective-relay.ts` reads the relay setting; the add-friend flow greps clean of `RELAY_URL_SETTING_KEY`.
- TC-3 `friends` route redirects; zero dead links (grep for `'/friends'` push targets updated).
- TC-4 Relocated settings logic keeps role gating identical (owner-only rows never render for members; test matrix).
- TC-5 Every locked parity string touched is updated on both surfaces + guard in the same commit; guard passes.

### Negative (NC): never do
- NC-1 Never auto-join from a deep link, QR, or pasted text without the preview sheet's explicit Join tap.
- NC-2 No fake chats, presence, delivery, or "friends online" anywhere in Messages.
- NC-3 The no-server state never implies a default server exists while `DEFAULT_RELAY_URL` is `''` and unproven by the health gate.
- NC-4 Do not weaken any honesty copy the parity guard locks without updating guard + both surfaces together.
- NC-5 No engine/protocol changes; `packages/sync` is read-only for this plan.

## Test Plan

- Unit: join-flow reason matrix, preview model, capability-status honesty assertions, unread aggregation, redirect.
- Integration: deep-link URL -> sheet -> join -> approval-queue notice path over the existing join test harness; add-friend resolution through a stubbed choke point (resolves / empty).
- UI: 5-state coverage for Messages, community list, community screen, settings, add-friend, onboarding steps.
- Parity: guard green; web twins lockstep where locked.
- Manual/Tier-D (founder-ops if needed): cold-start deep link on a real device build; camera QR scan on a dev build (Expo Go lacks the camera module path by design; the availability gate covers it).

## Founder-Ops Boundary

Deep links work with the installed dev/EAS build (scheme already registered). Universal https links (tap-to-join from web browsers without the app) need domain association files + a hosted domain: OUT of this plan, listed for Plan 23 B.3 store bundle consideration. The free default relay deploy (Plan 20 ops) is what makes AC-4's happy path real out of the box; the flow is built and honest either way.

## gstack Quality Gates

`/function-gate-runner` + `/review` per phase; `/qa` on web navigation + join after Phase 5; `/design-review` batch with Plan 30's at the UX-set close. Complexity routing: Large (2).

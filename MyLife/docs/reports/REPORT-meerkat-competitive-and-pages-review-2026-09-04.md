# Meerkat: competitive claims and the custom pages feature, reviewed

**Date:** 2026-09-04. **Reviewed tree:** `7a40639d` plus the uncommitted working tree on `fix/meerkat-orphan-watchdog`. **Reviewer:** Fable 5.1, with four fresh web-research passes (Opus) whose highest-impact claims were re-fetched from primary sources by the reviewer.

**Scope:** the launch materials written 2026-09-01 and 2026-09-02 (`docs/reports/meerkat-investor-pitch-2026-09-01.md`, `docs/guides/meerkat-launch-marketing-guide-2026-09-01.md`, `docs/guides/meerkat-complete-user-guide-2026-09-01.md`), the production-readiness decision of 2026-09-04, Plans 56, 58 and 59, the creation-layer code on both surfaces, its tests, and the git history from the mesh foundation to today. Every code claim below was checked against source on this tree; every competitor claim was checked against a page fetched today, or is flagged where the page blocked automated reads.

This report is a dated review, not a release approval. Current code and fresh evidence outrank it.

---

## 1. The short version

1. **The creation layer is real, signed, capped, parity-locked and tested at the data layer. The user-facing half is a prototype.** Sixteen block types exist in the registry, but only seven have renderers on either surface. The member page editor has no drag, pinch, rotate handle, undo, multi-select, snapping or zoom on either surface; every edit is a tap-to-add plus 16-pixel stepper buttons. The Plaza pixel board has a data layer and no screen. Collaborative drawing renders strokes but nothing can draw them. All of this landed in a single day (2026-08-29) and the pitch was written three days later.
2. **The launch materials overclaim the creation layer in ways a demo will expose.** "Sixteen canvas node types" is fifteen. "Nine channel kinds" is followed by a list of ten. "A video channel, an events board, a shop front" and "the pixel board" are listed as demonstrable; each renders a pending or unavailable card. These are honesty failures by the product's own standard.
3. **The competitor section fails an adversarial read on five load-bearing sentences.** "No encrypted messenger has shipped this" is falsified by Delta Chat webxdc (member-authored apps inside end-to-end encrypted chats, audited, shipped across six clients). "Discord and Slack fix the product shape and offer accent colors" is false: Discord ships nine channel types, a Server Guide page builder, a Server Shop and a cosmetics economy. "Signal, SimpleX, Session and Briar offer no presentation layer" is false for Signal (wallpapers, chat colors, user sticker packs) and stale for Briar, which entered maintenance mode on 2026-07-09. "The products with privacy have nothing to decorate" is contradicted by the pitch's own flagship example: SpaceHey advertises no tracking and no ads. "SpaceHey reached roughly 1.9 million" is now "over 2 million", and SpaceHey went invite-only in March 2026.
4. **The real white space survives the correction, and is stronger stated honestly.** No mainstream community platform lets members build freeform pages inside a community. Nobody combines member page-building with device-held keys, encrypted community content and signed authorship. The defensible sentence is narrower than the one in the deck, and it is true.
5. **Marketing plan verdict:** the operating discipline (claim matrix, go/no-go gate, zero-analytics measurement, honesty rules) is excellent and should be kept verbatim. The competitive frame, the "safe to demonstrate" list and the creation-layer proof language need the corrections in section 9 before any external use. The 2026-09-04 readiness decision already softens the headline ("A private home for your community"); the marketing guide still leads with a differentiator the code cannot yet demonstrate.
6. **Pages readiness verdict:** ready for a supervised pilot as a decoration and pages novelty behind the "Pages" row; not ready to be "the second thing you say". Section 8 lays out what production-level looks like and in what order.

---

## 2. Creation layer: docs versus code

| Claim in the launch materials | Code on this tree | Verdict |
|---|---|---|
| "Sixteen block types are in the registry today" | `KNOWN_BLOCK_TYPES` has 16 entries (`apps/meerkat/app/(root)/data/block-registry-core.ts:97-114`) | Correct. Plan 58's "15 block types" is stale. |
| One community "becomes a forum, a photo wall, a video channel, an events board, a reading room, or a shop front" | `BLOCK_RENDERERS` ships 7 of 16 on both surfaces: hero, chat, posts, gallery, files, members, page (`components/blocks/registry.tsx:218-226`, web `ui/blocks/registry.tsx:171-177`). timeline, video_gallery, video_player, live_stage, shortform_pager, store, tiers, embed and events render `This block arrives in a later update of this build.` | Forum (posts), photo wall (gallery) and reading room (library channel) are real. Video channel, events board and shop front render pending cards. Overclaim. |
| "Nine channel kinds ... chat, forum, timeline, gallery, video, live, short video, storefront, events, and page" | `BLOCK_CHANNEL_KINDS` = 9 (video, live, shortform, forum, timeline, gallery, store, events, page) plus the pre-existing chat, library and the C1 canvas kind | The number is right for the block-backed kinds, the list has ten items, and only forum, gallery and page resolve to a shipped renderer. Six of nine kinds render a pending card. |
| "Sixteen canvas node types (text, image, sticker, shape, frame, link card, guestbook, poll, counter, divider, 88x31 button, badge case, top friends, milestone, and embedded block)" | `CANVAS_NODE_TYPES` = 15 (`canvas-node-registry-core.ts:23-39`). The pitch's own list has 15 items. HTML twin says "16 canvas node types". | Wrong. Fifteen. |
| "across six surfaces: the community commons, a channel topper, a post, a pixel board, a per-community profile page, and a full page" | `MkCanvasKind` has 7: commons, channel_topper, profile, post, pixel_board, page, thread_overlay. Commons renders on a `canvas`-kind channel; topper, post, profile, page and thread overlay all have host screens on both surfaces. **pixel_board has no screen on either surface** (zero `plaza`/`pixel` references in any route or component; only `canvas-core.ts` data functions). | Five of the six named surfaces are real; the pixel board is data only. The seventh shipped surface (sticker layer over threads) goes unmentioned. |
| Marketing "Safe to demonstrate: ... the nine channel kinds; member canvases on ... the pixel board" | As above | Not safe. Six kinds and the pixel board show placeholders. |
| Pitch "Implemented and demonstrable today: ... the pixel board" | As above | Wrong. |
| Plan 56 editor UX: "drag to place, pinch/rotate, long-press for the node sheet" | Mobile `CanvasHost.tsx`: tap-to-add at a computed offset, then `StepperRow` buttons Move ±16 px, Size ±16, Turn ±15°, Stack ±1. `CanvasSurface.tsx` imports no gesture handler, no PanResponder, no Reanimated. Web `CanvasHost.tsx:608-615` uses identical stepper buttons and no pointer events. | Not delivered. No drag, pinch, rotation handle, undo/redo, multi-select, snapping, alignment guides, z-order list, or canvas zoom on either surface. |
| User guide: "Use `Move`, `Size`, `Turn`, `Stack`, `Front`, `Back`, and `Remove`" | Matches the code exactly | The user guide is the one document that describes the editor honestly. |
| Plan 56 C3 "collaborative drawing", "the Plaza" | Stroke substrate, SVG rendering and erase authority exist; no drawing input. Plaza validators, rate limit and resolver exist; no UI. Plan 56 is still in `docs/plans/active/`. | C1 and C2 shipped. C3 shipped data only. C4 and C5 unbuilt. |
| "Templates" | Five host presets (shrine, wiki page, link hub, zine, gallery wall) plus copy/paste template codes, both surfaces | Correct. |
| Owner layout editor: palette, preview, publish, capabilities, template code | `layout-editor.tsx` (mobile, 603 lines) and web `LayoutEditorSection.tsx` do all of this; one signed `cm_layout` revision per publish | Correct. No audience picker or tier manager yet (Plan 58 S3/S4). |
| Caps and safety | `packages/meerkat-canvas/src/caps.ts`: 2,000/200/500/800/100 nodes by kind, 20 pages per member, 12 promoted tabs, 8 KB props, 120 events per member per hour; no-URL schemas; anti-spoof glyph gate; chrome-leakage tests | Correct and well built. Note the 120-events-per-hour cap interacts badly with any future drag editor that publishes per action (section 8). |

**Test evidence, run today:** `canvas-core.test.ts` 33 passed (mobile) and 33 passed (web), `canvas-chrome-leakage.test.ts` 14 passed, `block-data-scope.test.ts` 5 passed, `@mylife/meerkat-canvas` 7 passed. Parity locks cover `block-registry-core`, `community-layout-core`, `canvas-node-registry-core`, `canvas-core` and `canvas-assets`. There are no UI-level tests of either editor on either surface.

**Uncommitted working-tree changes to canvas files:** web `CanvasHost.tsx`, `CanvasRenderDialsSection.tsx`, `PagesView.tsx` change `void m.db.flush()` to `void m.db.flush().catch(() => undefined)`. That is the F2 storage remediation reaching the canvas surface; it does not change behavior otherwise.

---

## 3. Competitor claims, adversarially re-checked

Sources were fetched on 2026-09-04. Where a vendor page blocked automated reads (Signal support, Discord support, Patreon help center), the verdict rests on search-engine extracts of that same official page and is marked.

### Private messengers

| Pitch claim | Verdict | What the source says |
|---|---|---|
| Signal: E2EE messaging and calls, nonprofit, groups up to 1,000 | Confirmed with a caveat | Groups reach 1,000; group calls cap at 75. Do not let "messaging and calls up to 1,000" read as one number. (support.signal.org group chats and group calling articles, extract) |
| WhatsApp: familiarity, Communities, E2EE personal messages and calls | Misleading by omission | Communities are E2EE. Channels are not: "channels are not end-to-end encrypted by default" (blog.whatsapp.com, 2023-06-08, fetched). Split them. |
| Briar: offline and peer transport strength | Outdated, damaging | Briar entered maintenance mode on 2026-07-09: "We're only making essential security updates and bugfixes for now," citing battery drain and unreliable Android background operation (briarproject.org/news/2026-maintenance-mode, fetched). Either drop Briar or cite this as evidence that pure peer transport struggles on phones. |
| Session: decentralized relay and onion routing | Outdated | Session moved to its own Session Network funded by a staking token on Arbitrum, and its Communities are explicitly not end-to-end encrypted (transit encryption only, self-hosted SOGS servers). The second fact is a competitive opening the pitch misses. |
| SimpleX | Understated | Public groups and channels with user-held keys; $1.3M pre-seed led by Jack Dorsey; a 2026 crowdfunding round at a $45M valuation. Not a hobby project. |
| Matrix and Element: open protocol, federation, self-host, encryption | Confirmed, but no price is quotable | element.io/pricing lists Community (free, self-host, up to 100 users), Enterprise ("priced per seat/month", 100+), Sovereign ("priced per deployment"). No dollar figure, no consumer plan (fetched). Matrix also ships Spaces and widgets, so "no grouping or extension layer" would be wrong. |
| "Signal, SimpleX, Session, and Briar offer no presentation layer at all" | Wrong as written | Signal ships chat colors, wallpapers, themes and user-made sticker packs. The salvageable narrower claim: in every one of these apps the customization is device-local, "only you can see the colors and wallpaper," so it never becomes shared community identity. |
| "No encrypted messenger has shipped [member-authored design] before" | Wrong | Delta Chat webxdc: "zip your HTML, CSS and JavaScript into a .xdc file and share it in a chat," end-to-end encrypted, no internet access from the app, independently audited, supported by Delta Chat, ArcaneChat, Delta Touch, Cheogram and others (webxdc.org; delta.chat). Telegram mini apps and themes, Matrix custom widgets and Nostr clients with custom themes also undercut it. |

### Community and work platforms

| Pitch claim | Verdict | What the source says |
|---|---|---|
| Discord privacy policy covers messages, uploads, usage, device, sponsored content | Confirmed | discord.com/privacy, effective 2025-09-29, quotes every category. It also states "We don't sell your personal information"; attack scope and ad-funded formats (Quests), never sale. |
| "Discord and Slack fix the product shape and offer accent colors" | Wrong, and the most attackable line in the deck | Discord ships nine guild channel types (text, voice, category, announcement, stage, directory, forum, media, plus threads); a Server Guide with Welcome Sign, New Member To Do's and "Resources: turn read-only channels into fancy resource pages"; a Server Shop selling downloadables and premium roles (US, desktop and web only); Server Subscriptions with tier templates; Nitro at $9.99 with per-server profiles, 20+ app themes, custom stickers, soundboards, entrance sounds; server tags; embedded Activities. (support.discord.com Server Guide FAQ and Server Shop articles via extract; discord.com/developers channel docs and discord.com/nitro fetched) |
| Slack: free plan 90 days, paid per active user | Confirmed on the 90 days; "per active user" is not on the pricing page | Pro $8.75 monthly or $7.25 annual per user; Business+ $18 or $15 (slack.com/pricing, fetched; a 50%-off promotion was showing). |
| Circle: Professional $89/month, Business $199/month, fees by tier | Confirmed with an asterisk | $89, $199, Circle Plus custom; fees 2%, 1%, 0.5%. The asterisk is undefined on the page and is likely annual billing; confirm the monthly-billed rate before printing $89 (circle.so/pricing, fetched). |
| "Circle and Patreon offer templates the vendor owns" | Misleading for Circle | Professional includes a Website Builder and custom domain; custom CSS/JavaScript snippets and color themes appear in the feature matrix (two reads today disagreed on whether they sit on Professional or Business; verify). Circle Plus white-labels. Circle's real gap is that Circle hosts the data and holds the keys. |

### Creator platforms and page builders

| Pitch claim | Verdict | What the source says |
|---|---|---|
| Patreon: new creators pay 10% before processing and other fees | Confirmed, incomplete | "10% of the income you earn on Patreon" plus processing, currency conversion, payout fees and taxes (patreon.com/pricing, fetched). Omitted: Apple's 30% on iOS in-app purchases (15% after year one) and Patreon's roughly 43% iOS list-price markup; the same wall applies to Meerkat's own $4.99 purchases unless sold on the web. On 2026-08-20 Patreon launched Fan Profiles, Niches topic communities, Clips and Live Q&A. |
| "SpaceHey reached roughly 1.9 million registered users offering little except the freedom to design your own page" | Outdated and wrong | Homepage: "Join over 2 million others already on SpaceHey" (fetched). It lists Bulletins, Blogs, Forums, Groups, Music, messaging, and leads with "No algorithms, no tracking, no personalized Ads". Signup is invite-only since 2026-03-15 (waitlist visible today). |
| "mmm.page, straw.page, and Hotglue sustain a commercial market" | Misleading | straw.page is commercial ($49/year). Hotglue is GPL3 open source with no paid plan. mmm.page's last first-party number is 17,000 users in December 2021. One paid indie tool is not a demonstrated market; cite Neocities (1.74 million sites) and SpaceHey instead. |
| "This is the dimension on which Meerkat has no direct comparison" | Wrong as written | Discord Nitro per-server profiles inside private servers; Patreon fan profiles and communities as of last month; Kinopio (private-by-default collaborative freeform canvas); Mighty Networks branded communities; Ghost custom themes with private paid posts. |
| "the products people decorate have no privacy, and the products with privacy have nothing to decorate" | Wrong in both directions | SpaceHey and Kinopio decorate with a privacy stance; Discord, Mighty Networks and Patreon are private communities with decoration. |
| Planned "0% creator platform fees" | True as a price, not as a structure | Ghost 0%, Ko-fi Gold 0% at $6/month, Fourthwall 0% on self-sourced and Pro digital products, Whop no base fee. Meerkat's $4.99/month would be the cheapest flat-rate 0% offer, which is the sentence to use. |

### What survives, stated precisely

- No mainstream community platform (Discord, Slack, Circle, Mighty Networks, Skool, Geneva, Heylo, Discourse, Reddit, Facebook Groups) lets members build freeform pages inside a community. The ceiling everywhere is a structured or cosmetic profile.
- No product combines member page-building with device-held keys, end-to-end encrypted community content and signature-verified authorship. Delta Chat webxdc is the nearest neighbor and it ships sandboxed mini-apps, not durable signed pages bound to community identity.
- Meerkat's allowlisted-style, no-URL, sealed-asset model is stricter than SpaceHey (full HTML and CSS) and matches the standing security recommendation for user-customizable pages.
- The Session Communities and Telegram groups facts (not end-to-end encrypted) are the cleanest one-line illustrations of the gap Meerkat fills, and the deck does not use them.

---

## 4. Competitors the materials omit

| Name | Why an investor will name it | Price and posture |
|---|---|---|
| Discord (as the incumbent, not just a privacy foil) | Free private community with pages, roles, shop and cosmetics; the product every organizer is leaving | Free; Nitro $2.99 / $9.99 |
| Telegram | Owns customization and creator monetization at billion-user scale; groups and channels are not E2EE | Free; Stars |
| Matrix / Element | E2EE by default, self-hostable, air-gappable, free Community tier: structurally the same "self-host or pay us" offer | Free / per seat |
| Delta Chat and webxdc | Member-authored apps inside E2EE chat, audited, free, cross-client | Free, open source |
| Mighty Networks | Owner landing pages, branded apps, Spaces | $79 to $354/month, 2% to 0.5% fees |
| Skool | The price anchor against $4.99/month | $9/month Hobby (10% fee), $99 Pro (2.9%) |
| Kinopio | Private-by-default freeform canvas with real-time collaboration and a native iOS app | Subscription |
| Neocities | 1.74 million hand-built sites, no server-side scripting on any tier | Free / supporter |
| Keet (Holepunch) | Fully peer-to-peer, no servers; attacks the hosted-service half of the pitch | Free |
| Bluesky | Portable identity, custom feeds, self-host a PDS; Germ DM added MLS-based E2EE in Feb 2026 | Free |
| Ghost, Ko-fi, Fourthwall, Whop | Already at 0% platform fee | $0 to $29/month |
| Guilded | Do not cite: shut down 2025-12-19 | n/a |

---

## 5. The marketing plan and docs, reviewed

**Keep as written.** The claim discipline in the marketing guide is the best part of the launch materials: the three-tier "safe / prerequisites / never claim" structure, the proof-language list, the zero-analytics measurement plan, the go/no-go gate, the launch roles, the founder-versus-agent split, and the rule that a failed gate means fix the capability or remove the claim. The user guide's six-step instruction format is exact and matches the screens; it is the one document that describes the page editor as it actually is.

**Fix before any external use.**

1. **The "safe to demonstrate" list is not safe.** Move "the nine channel kinds" and "the pixel board" to "demonstrate only with visible prerequisites", and say which kinds render content (forum, gallery, page, chat, library, canvas) and which render "arrives in a later update" (timeline, video, live, short video, storefront, events).
2. **The competitive frame needs section 3's corrections.** Replace "accent colors", delete "no presentation layer", drop or relabel Briar, split WhatsApp Channels from Communities, correct SpaceHey to "over 2 million, invite-only since March 2026", requalify mmm.page and Hotglue, remove any Element per-user price, add Discord, Telegram, Matrix, Skool and Kinopio.
3. **The proof language line "Sixteen building blocks, nine kinds of channel" is technically true and practically misleading** while nine blocks and six kinds render placeholders. Use it only after the renderers ship, or rewrite as "Seven building blocks today, sixteen designed".
4. **Screenshot caption 7, "Every page is signed by whoever made it," is honest.** Caption 6 should be captured with a layout that uses only shipped blocks so no pending card is visible in store art.
5. **Headline order.** The readiness decision of 2026-09-04 proposes "A private home for your community" with the creation layer as a supporting benefit. The marketing guide still says the creation layer is "the second thing you say". Given section 2, make it the third: home, private by construction, then "a place you build" once the editor in section 8 exists.
6. **The launch sequence is sound but its T-30 "evidence lock" must include the creation layer.** Add: a real device recording of a member building a page with the shipped editor, and a check that no placed block in any demo layout renders a pending line.
7. **Investor pitch section 4 and section 6** need the numeric fixes (15 node types, 7 shipped renderers, pixel board not implemented, sticker-over-thread layer is a seventh surface) and the competitor rewrites. Section 7's execution numbers (1,876 files, 490,395 lines, 239 commits) do not reconcile with the readiness report's (1,769 files, 476,165 lines, 429 commits) because the directory sets differ; pick one basis and state it.
8. **Pricing risk the pitch omits:** Apple's in-app purchase commission applies to the $4.99 unlock and the $4.99/month hosted plan exactly as it applies to Patreon. Say how the hosted plan will be sold on iOS.

---

## 6. What the git history says

- The named mesh foundation landed 2026-04-22; the standalone app 2026-06-14; direct messages, posts, libraries and the public boundary through July; production hardening, storage providers and the verification-account wall in late July.
- The entire creation layer shipped on **one day, 2026-08-29**: C0 composition spine (`b9716c9b`), C1 canvas core (`37f22a17`), six C2 commits (asset packs, badges and personas, canvas posts, milestones and templates, per-channel theme overrides, sticker layer over threads), the C3 Plaza data layer (`53991c07`), and two hardening fixes the same day after an adversarial review found a Plaza rate-limit bypass, an asset-pack hijack via backdated timestamps, and an outrunnable curator tombstone (all fixed).
- 2026-08-30 was a hardening sweep across every surface; 2026-09-01 merged community servers (Plan 57) and wrote the launch and investor docs; 2026-09-02 rewrote the launch docs "for a person, not an engineer" and applied audit performance fixes (`a3152851`, including feed batching and canvas-core cleanups); 2026-09-04 fixed the two browser data-loss defects and the release guard.
- The readiness reviewer's line holds: "Differentiation expanded faster than the evidence for ordinary joining and delivery. Preserve it, but stop adding launch dependencies." The creation layer has not had a second day of UX work since it landed.

---

## 7. The custom pages feature today

**What a member gets, on both surfaces:** a Pages row on the community home (mobile) or sidebar (web); a directory listing every member page with author and piece count; "New page" creates a signed `page` canvas; "Build" opens a palette of 15 node types filtered by the layer the member may place on; each tap adds a node at a staggered offset; selecting a node opens a sheet with text editing, stepper nudges for position, size, rotation and stack order, top-friends and milestone fields, and Remove; five starter templates and copy/paste template codes; a receiver-preview toggle that shows the page under conservative dials; owners can promote a page to a tab (12 cap) and demote it. Guestbooks, polls and counters record real signed marks. Per-community profile pages and copy-forward work. Posts can be canvases and show up in Feed as a canvas kind.

**What is production-grade:** the data model (independently signed node rows, tombstones, curator removal, fail-closed parsing, forward-compatible unknown types), the caps, the no-URL and anti-spoof guards, the receiver dials, the chrome-leakage tests, the parity locks, the honest copy.

**What is prototype-grade:** the editing experience. A person cannot drag a sticker. They tap "Move →" sixteen pixels at a time. There is no undo. There is no zoom on a phone, and a free-layout page is a fixed-coordinate field at least 360 wide. Nodes can be placed under other nodes with no z-order list to find them. Nothing prompts for alt text. Nothing checks contrast. The Commons canvas exists only if the owner creates a `canvas`-kind channel from the channel manager, which no onboarding mentions.

**Verdict:** the feature is a correct, safe substrate with a placeholder editor. It should stay in the product, behind the Pages row, as a pilot novelty. It is not ready to headline, and the block layer beneath the owner editor is less than half rendered.

---

## 8. What the feature should be at production level

The research bar (fourteen builders surveyed, WCAG, r/place, wplace.live, OpenStreetMap's revert model) and Meerkat's own constraints point to one design.

### 8.1 Principles

1. **Author freeform, publish responsive.** Members never manage breakpoints. Pages are authored on a 360-unit-wide artboard and scaled to fit the reader's width; flow mode stays as the accessible fallback and the narrow-screen default. This is what mmm.page does and what Figma refuses to attempt on phones.
2. **Draft, then publish.** Today every nudge is a signed event, and the apply-time cap is 120 events per member per hour. A drag editor that publishes per action would exhaust that cap in one session and flood peers with intermediate geometry. Editing must run against `mk_canvas_drafts` (already present) and publish one coalesced signed event per node on "Done building". This is also what makes undo free.
3. **Append-only plus revert.** Keep the signed-event substrate; add the revert half. A curator (and the author) needs "undo this member's last burst" and a time scrub over the event log, which Plan 56 already names as the time machine. The mature model is OpenStreetMap: every change kept, dedicated revert tooling, and a suspicious-change surface.
4. **Accessibility is Level A, not polish.** A programmatic reading order independent of position (WCAG 1.3.2), alt text prompted at insert for every image, sticker, badge and 88x31 button (1.1.1), OS reduced-motion honored without member action (2.3.3), and contrast computed at authoring time against the active palette. The readiness report's item 6 ("canvas content has a reading-order/list alternative") is the same requirement.
5. **Ship what is drawn.** No block or channel kind appears in a palette until its renderer exists on both surfaces.

### 8.2 The editor, in build order

| Order | Capability | Notes and bar-setter |
|---|---|---|
| 1 | Direct manipulation: drag to move, pinch to resize, two-finger rotate, tap-hold to select | `react-native-gesture-handler` and Reanimated are already in the tree (root layout wraps `GestureHandlerRootView`). Web: pointer events with `setPointerCapture`. Bar: tldraw, Canva mobile. |
| 2 | Fit-to-width artboard with pinch zoom and pan; coarse 8-unit grid snap that scales with zoom, off by default, plus edge and center alignment guides | Bar: tldraw's zoom-aware 8 px threshold. |
| 3 | Draft session with undo/redo; one signed event per touched node on publish; "Discard changes" | Uses the existing `mk_canvas_drafts` table and codec. Makes the 120-per-hour cap a non-issue. |
| 4 | Selection handles, z-order list ("Layers" sheet), bring to front/send to back, multi-select and move-together, frames as groups | Bar: Figma, Hotglue. Frames already exist in the model. |
| 5 | Insert-time alt-text prompt; reading-order list auto-derived top-to-bottom then left-to-right with author override; contrast warning on text nodes; a screen-reader "list view" of any page | WCAG 1.3.2, 1.1.1, 2.3.3. |
| 6 | Property inspector generated from each node's schema (colors, sizes, alignment, behaviors) instead of type-specific sheets | Plan 56 section 8 already specifies this; the layout editor already does it for blocks. |
| 7 | Revert and history: curator "revert this member's last N changes", author "restore my page to yesterday", time scrub | Plan 56 feature 17. Bar: OpenStreetMap. |
| 8 | Templates as the on-ramp: a gallery on page creation, "remix this page" from any page in the directory with lineage shown, community-shared snapshot templates | SpaceHey's layout templates are its growth engine. Feature 16 and 52. |
| 9 | Drawing tool over the existing stroke substrate; Plaza screen over the existing pixel data layer with timelapse | C3. Both substrates are already built and hardened. |
| 10 | Performance: virtualize or rasterize free-layout canvases above a few hundred nodes; measure on a mid-range Android device | A 2,000-node Commons as absolutely positioned Views will not scroll. |
| 11 | UI tests: Playwright flows on web for create, build, publish, promote; Maestro or Detox on device for the same | There are none today. |

### 8.3 The owner side and the blocks

- Ship the nine missing renderers in the order the archetypes need them: timeline, events (requires an events data model that does not exist yet; the readiness report lists events and polls as the next club-facing gap), video gallery and player (Plan 38 players exist), embed (consent-gated), live stage, short-video pager, store and tiers (Plan 58 S1 to S5, real commerce only).
- Add the archetype-10 editor: per-block audience (Public, Members, Tier), "Preview as visitor / as tier", tier manager, apply-a-template to an existing community. This is Plan 58 S3, S4 and S7 and is correctly sequenced there.
- Make the Commons discoverable: create a `canvas` channel in every starting template, or offer "Add a Commons" from the Pages screen, so a new community does not have to know the channel manager exists.
- Open-web renderer of public blocks (Plan 58 S6) is what turns "a page you built" into "a website you own", and it is the strongest answer to Circle, Ghost and Patreon in one feature.

### 8.4 What it becomes

A community whose members, on their phones, drag stickers and photos onto a shared wall, sign each other's guestbooks, build a fan shrine from a template and remix a friend's, while the owner arranges the home from blocks that all render, sells access through their own checkout, and publishes the public half as a real web page at their own domain. Every piece carries its maker's signature, nothing can load from the internet, anything can be undone, and a reader who wants quiet gets quiet. That product does not exist anywhere. The current tree has the hard half (the substrate) and is missing the visible half (the editor and the renderers). Roughly: order 1 to 5 in section 8.2 is the difference between a demo that embarrasses and a demo that sells.

---

## 9. Corrections required, by file

| File | Change |
|---|---|
| `docs/reports/meerkat-investor-pitch-2026-09-01.md` and `.html` | Section 4: "Sixteen canvas node types" to fifteen; "six surfaces" to the five shipped plus the thread sticker layer, and state that the pixel board is data only; state that seven of sixteen block renderers ship and name which channel kinds render content. Section 6: remove "the pixel board" from implemented; add the pending renderers to service-or-build dependent. Section 8: rewrite per section 3 of this report (Discord, Signal presentation layer, Briar, Session, WhatsApp Channels, Element pricing, SpaceHey, mmm.page and Hotglue, "no direct comparison", "nothing to decorate"); add Telegram, Matrix, Delta Chat webxdc, Mighty Networks, Skool, Kinopio, Neocities; delete "no encrypted messenger has shipped this before" and replace with the precise sentence in section 3. Section 10: name the Apple commission. Section 7: reconcile the file and commit counts with the readiness report or state the basis. |
| `docs/guides/meerkat-launch-marketing-guide-2026-09-01.md` and `.html` | "Safe to demonstrate": move channel kinds and the pixel board to prerequisites with the kind-by-kind list. Competitive Frame: same rewrite as the pitch. Proof language: qualify "Sixteen building blocks, nine kinds of channel". Add a creation-layer item to the T-30 evidence lock. Consider the readiness report's headline order. |
| `docs/guides/meerkat-complete-user-guide-2026-09-01.md` | Accurate as written. Add one sentence to "Compose the community home" listing which blocks render content in this version. |
| `docs/plans/queue/58-meerkat-editor-creator-rails.md` | "Block registry with 15 block types" to sixteen. |
| `docs/plans/active/56-meerkat-canvas-freeform-creation-layer.md` | Add a status block: C1 and C2 shipped 2026-08-29; C3 data only; C4, C5 unbuilt; editor v1 shipped as steppers, direct manipulation outstanding. |
| `apps/meerkat/AGENTS.md` | The "Current launch verdict" line already points at the 2026-09-04 readiness report; add this report to `docs/reports/README.md`. |

---

## 10. Evidence basis

**Code read on this tree:** `block-registry-core.ts`, `community-layout-core.ts`, `canvas-node-registry-core.ts`, `canvas-core.ts` (1,381 lines), `packages/meerkat-canvas/src/{types,caps,codec,schema}.ts`, mobile `components/canvas/{CanvasHost,CanvasSurface}.tsx`, `components/blocks/{registry,BlockStack}.tsx`, routes `community/[communityId]/{pages,layout-editor}.tsx`, `page/[canvasId].tsx`, `channel/[communityId]/[channelId].tsx`; web `ui/canvas/{CanvasHost,CanvasSurface,PagesView,CanvasRenderDialsSection}.tsx`, `ui/blocks/registry.tsx`, `ui/community/LayoutEditorSection.tsx`; `scripts/check-meerkat-parity.mjs` canvas locks. Tests run: the five suites in section 2.

**Docs read:** the investor pitch, marketing guide, complete user guide, the 2026-09-04 production-readiness report, Plans 56, 58, 59, the composition platform build plan (2026-08-24), the community page archetypes report (2026-09-01), and the session logs for Plan 56 C0, C1, C2, the C2/C3 adversarial review, and the Set 8 creation matrix.

**Git:** `git log` over the four product directories and the creation-layer files, 2026-04 to 2026-09-04.

**Web, fetched today by the reviewer:** briarproject.org maintenance-mode post; spacehey.com; blog.whatsapp.com channels announcement; circle.so/pricing; element.io/pricing; patreon.com/pricing. **Fetched or extracted by the research agents today:** discord.com/privacy, discord.com/nitro, Discord developer channel docs, Discord Server Guide and Server Shop support articles (extract), slack.com/pricing, getsession.org and docs.getsession.org, wefunder.com/simplex.chat, matrix.org Spaces and widgets posts, webxdc.org and delta.chat, straw.page, hotglue.me, fyi.mmm.page, ghost.org/pricing, fourthwall.com/pricing, skool.com/pricing, mightynetworks.com/pricing, kinopio.club, neocities.org, gumroad.com/pricing, techcrunch.com Patreon 2026-08-20, en.wikipedia.org SpaceHey and r/place, wiki.openstreetmap.org revert pages, tldraw.dev snapping docs, help.figma.com mobile app guide, w3.org WCAG 1.3.2 and 2.3.3. Signal support pages, Discord creator-support and Patreon help-center fee articles blocked automated reads; those verdicts rest on search-engine extracts of the same official pages and should be re-read in a browser before a slide quotes them.

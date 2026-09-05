# Meerkat: creation layer and public layer added to the launch materials

Date: 2026-09-02
Branch: `fix/meerkat-orphan-watchdog`
Files: `docs/reports/meerkat-investor-pitch-2026-09-01.{md,html}`, `docs/guides/meerkat-launch-marketing-guide-2026-09-01.{md,html}`, `docs/guides/meerkat-complete-user-guide-2026-09-01.{md,html}`

## Why

The 2026-09-01 launch suite (investor pitch, launch marketing guide, complete user guide) listed "pages" and "themes" as feature nouns inside bulleted lists and never sold the customization story as a value. The public layer appeared only as a caveat under "demonstrate with prerequisites". Founder direction: the freedom to shape a community into anything (webstore, Pinterest board, Reddit, Twitter, private or public) is the differentiator, on the game-modding precedent (Skyrim, GTA, Super Mario Maker), and the baseline public layer is a product surface, not a footnote.

## Shipped vs planned, verified against code before writing any copy

Shipped (Plan 56 C0/C1/C2 plus the Plaza and pixel board, both surfaces):
- Owner composition spine: owner-signed `cm_layout`, `packages/meerkat-layout` codec, 16 block types in `block-registry-core.ts` (`KNOWN_BLOCK_TYPES`), 9 block-backed channel kinds (`BLOCK_CHANNEL_KINDS`), layout editors on mobile (`community/[communityId]/layout-editor.tsx`) and web (`LayoutEditorSection.tsx`), copyable layout template codes.
- Member creation layer: `packages/meerkat-canvas`, 16 node types in `canvas-node-registry-core.ts` (`CANVAS_NODE_TYPES`), 6 canvas kinds in `canvas-core.ts` (commons, channel_topper, profile, post, pixel_board, page), free and flow layout modes, Pages directory with owner promote/demote, per-community profile design with copy-forward, asset packs, badges, personas, milestones, polls, guestbooks, receiver render dials.
- Theme editor with generate-from-a-color and shareable theme codes/QR; 6 community starting templates in `community-templates.ts` (Family Space, Media Library, Club, Course Hub, Newsroom, Blank).
- Public layer (Plans 19/26/39 done): signed publications, anonymous reading with warm-tail paging, owner-signed open join grants, blind-signed anonymous credential, owner report review. Service-dependent.

Not shipped, so marketed as planned only (Plan 58, queue):
- Tier key lanes, claim codes, storefront listings and sealed-grant delivery, per-block audiences, upgraded editor with audience picker, open-web page renderer with custom domains, template gallery of the 10 archetypes, delegated agent.
- The `store` and `tiers` blocks CAN be placed today and render `CAPABILITY_UNAVAILABLE_COPY` (e.g. "The storefront is enabled here, but this build has no billing service configured."). Copy in all three docs now states this explicitly so nobody demos a placed block as a working shop.

## Changes

Investor pitch: new section 4 "The Creation Layer" (sections 4-14 renumbered 5-15) covering owner composition, member building, the three safety properties, the private/public duality, and the not-shipped line. New "Creation and customization" subsection in the competitive landscape. New rows in the differences table (Presentation, Public face). Creation-layer bullets added to sections 3 and 6, an investment-case bullet, and honesty lines in the service-dependent list. HTML deck: new slide `s4`, slides `s4`-`s14` renumbered `s5`-`s15`.

Launch marketing guide: new section "The Creation Layer and the Public Face" (why it sells, four defensibility properties, how to say it, the public face, how to answer the commerce question). Fourth message pillar. New tertiary audience "builders and customizers". Creation-layer items added to Safe to demonstrate; three new Never claim lines (no plugins/scripts/code, no placed-block shop demo, no custom-domain website). Four new proof lines, two new screenshot captions, revised positioning statement and App Store promotional text. HTML: new section `04 · Creation layer`, sections 04-10 renumbered 05-11, pillar stack widened to four, fourth audience card.

Complete user guide: chapter 4 retitled "Build the Community: Channels, Posts, Pages, and Canvas" with five new step-by-step workflows (compose the home with the layout editor, share/import a layout template, build a page and promote it to a tab, design a per-community profile, change the community theme), all written from literal on-screen strings read out of the source. Community creation step now names the six templates. Chapter 11 opens with the two-doors framing of the public layer. HTML: chapter 4 extended with three new mockups and four new workflow cards plus a "Declared is not available" note; chapter 11 lead rewritten.

## Verification

- Every label quoted in the user guide was read from source (`layout-editor.tsx`, `pages.tsx`, `member/[deviceId].tsx`, `CanvasHost.tsx`, `settings.tsx`, `[communityId].tsx`, `theme-editor.tsx`, `LayoutEditorSection.tsx`, `CommunityTemplatePicker.tsx`).
- All three HTML twins parse cleanly and have balanced `div` and `section` tags; opened in the browser.
- No code changed, so no function gate was applicable.

## Remaining

- Plan 58 (creator rails) and Plan 59 (Meerkat for Everyone) are both queued and development-ready. When 58 lands, the "planned" language in all three documents must move to "shipped" in the same session.
- The archetype gallery (`apps/meerkat/docs/reports/REPORT-meerkat-community-page-archetypes-2026-09-01.html`) is not yet linked from the marketing guide's asset list; it is the natural visual companion to the new section.

---

## Follow-up, same day: plain-language pass

Founder flagged one line in the user guide HTML as the symptom: "Meerkat creates a local cryptographic identity. It does not silently turn that identity into a social account, upload plaintext content, or claim delivery without a real recorded event." Direction: sweep all three documents for that register. Target reader is an average 15-year-old.

### Rule applied

Change the register, never the truth value. Every rewrite says the same thing the original said, including every honesty hedge. Where a phrase quoted a literal on-screen string, the string was left exactly as it appears in the app, because the guide's whole value is that its quotes match the screen.

### The glossary used

| Was | Now |
|---|---|
| local cryptographic identity / device identity | your phone makes a key and keeps it; that key is who you are |
| signed event, signed row, owner-signed | stamped by whoever made it, in a way nobody can fake |
| verify / signature-verified | checked / Meerkat checks it is genuine |
| seal, sealed, encrypted blocks, plaintext | lock, locked, locked pieces, readable |
| pin / pinned locally | kept on this phone |
| manifest, descriptor, identity bundle | (described in place; the noun dropped) |
| relay, rendezvous, peer | connection server, meeting point, the other device |
| replication scope, maxScope | how far it is allowed to travel |
| optimistic reaction | a reaction that was never actually saved |
| blind-signed credential | a pass that proves you are allowed to post without saying who you are |
| entitlement | the record that you paid |
| persona | your public name |
| Expo Go / native module | the cut-down preview version of the app / part of the full app |
| health probe, /healthz | Meerkat actually contacts the server to see if it answers |
| TLS certificate | the server's security certificate |
| GPS metadata | the hidden location tag in photos |
| chrome, trust indicators | the app's own safety markers |
| Capability Legend | What the Labels in This Guide Mean |
| Build-dependent / Service-dependent / Available now | Needs the full app / Needs a server / Works now |
| primitives, substrate, surface, architecture (consumer-facing) | the pieces, how it works |

### Coverage

- **User guide (md + html):** full pass. Opening, pricing, the label legend, all twelve chapters, both reference tables, and the evidence note. Average sentence length is now 14.2 words (roughly a grade 8 reading level). The literal app strings inside the mockups were deliberately left alone.
- **Marketing guide (md + html):** every public-facing copy line rewritten (proof lines, four pillars, positioning statement, subhead, screenshot captions, App Store promotional text, category line), plus the creation-layer and public-layer prose. Internal operator vocabulary (beachhead, positioning, press kit) was kept, since a marketer is the reader.
- **Investor pitch (md + html):** the architecture section, the differences table, the four competitive difference lines, the compounding-layer section, and the cover. Sentences are still longer here (23.5 average) because the lists of capabilities are structural, but the jargon is gone.

### Verification

- All three HTML twins parse and have balanced tags; opened in the browser.
- Spelling normalized to US English after the rewrite.
- No code changed.

### Remaining

The app's own strings are the next target and are out of scope for a docs pass. The user-guide mockups still faithfully show `Scope`, `Personal replica`, `Seal and save`, `Pin classes and local cache`, and `Advanced connection`, because those are what the screens actually say. Plan 59 S6 is exactly this work: a vocabulary glossary applied to both surfaces and locked by `check-meerkat-parity.mjs`. The glossary table above should seed it.

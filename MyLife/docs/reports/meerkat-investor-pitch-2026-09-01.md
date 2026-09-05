# Meerkat Investor Pitch

Verified against MyLife commit `493b2549` and official competitor sources on 2026-09-01. This is a point-in-time investor narrative, not a launch sign-off. It contains no invented users, revenue, retention, market size, or fundraising terms.

## 1. Private Social, Controlled by You

Meerkat is one private app a group runs its whole life in: group spaces, channels, posts, pages, files, libraries, private messages, and protected sharing. Two things underneath make it different. Your phone makes its own key and keeps it, so you are not an account on somebody's server. And the group picks who runs the servers that carry it.

## 2. The Problem

Small communities choose between two incomplete operating models:

- consumer chat products are easy, but identity, availability, policy, and product direction remain platform-controlled;
- self-hosted and decentralized systems offer control, but often ask ordinary people to assemble protocols, servers, storage, identity, and user experience themselves.

The result is a patchwork of chat, shared drives, documents, membership tools, public feeds, and moderation workflows. The organizer carries the integration cost and the community carries the platform risk.

## 3. The Product

Meerkat gives one community:

- channels, messages, posts, replies, reactions, and mentions;
- signed membership, roles, audience rules, themes, pages, and organization;
- an owner-composed layout of sixteen block types and nine channel kinds, so one community can take the shape of a forum, a gallery, a video channel, an events board, or a shop front;
- a member creation layer: freeform and flowing canvases across the commons, channel toppers, posts, pixel boards, per-community profile pages, and member-built pages the owner can promote into tabs;
- end-to-end encrypted direct messages and group chats;
- sealed files and personal or community libraries;
- a photo timeline, map boundary, readers, and media playback paths;
- real relay and development-build LAN synchronization;
- owner-attached community servers for durable availability;
- a separate public-reading and anonymous-verification boundary;
- one key on your own phone that never has to become an account with a company.

## 4. The Creation Layer

Every other community product ships one shape and asks every group to fit it. Meerkat ships the builder instead.

**The owner composes the product.** A community's home and any of its channels are rendered from an owner-signed layout document. Sixteen block types are in the registry today: hero, chat, posts, timeline, gallery, video gallery, video player, live stage, short-video pager, files, store, membership tiers, embed, events, page, and members. Nine channel kinds change what a channel *is*: chat, forum, timeline, gallery, video, live, short video, storefront, events, and page. One community becomes a forum, a photo wall, a video channel, an events board, a reading room, or a shop front, with no second app, no plugin market, and no server administration.

**Members build on the community itself.** Sixteen canvas node types (text, image, sticker, shape, frame, link card, guestbook, poll, counter, divider, 88x31 button, badge case, top friends, milestone, and embedded block) place freely or flow as a page, across six surfaces: the community commons, a channel topper, a post, a pixel board, a per-community profile page, and a full page a member builds that the owner can promote into a community tab. Themes are owner-signed with a member override, and both are shareable as codes.

**Three properties make member-authored design safe**, which is why no encrypted messenger has shipped this before:

1. Everything carries its maker's name in a way nobody can fake. Decoration you can trace to a person becomes something people compete over rather than anonymous wallpaper, and forgeries are rejected before they are even saved.
2. Nothing a member makes can point at an address on the internet. People choose colors and shapes from a set list rather than typing in code, and every picture is a locked file on the device rather than something loaded from elsewhere. There is simply nowhere to put a web address, which removes the whole class of attacks that killed every earlier attempt at this: no phoning home with your data, no invisible tracking pixel, no swapping the image after a moderator approved it.
3. Nothing is ever overwritten, only added to, so wrecking someone's page is something you undo rather than fight about. And every reader controls what their own device will show.

**The same builder serves both audiences.** A group can stay entirely private, or put up a public front that anyone can read with no account and no profile. The two sides are separated by how the app is built, not by a setting someone can get wrong.

The commercial argument is the one the modding economy already proved: Skyrim, Grand Theft Auto, and Super Mario Maker each outlived their own content because the creation layer let players build what the publisher never would. The reference case in this category is SpaceHey, which reached roughly 1.9 million registered users offering little except the freedom to design your own page. Meerkat is the first system to offer that freedom on top of signed identity and encrypted content rather than instead of them.

Not yet shipped, and never marketed as shipped: the storefront and membership-tier blocks can be placed and render an honest unavailable line until a billing service is configured; creator checkout, entitlement delivery, and the open-web page renderer are documented plans (Plan 58), not current capability.

## 5. Why the Architecture Matters

Meerkat's defensibility is the product and protocol boundary together:

1. Each phone makes and guards its own key. Meerkat has no user table to breach and no account to lock you out of.
2. Everything anyone posts is stamped by them, and every device checks the stamp before it will show it. A forged post is thrown away before it is stored, not flagged afterwards.
3. Files are chunked, encrypted at rest, author-signed, and opened only after verification.
4. The servers in the middle are never trusted with anything readable. They can see how big a message is and when it went, and nothing else: not who sent it, not what kind of message it is, not the contents.
5. Every kind of data has a written-down limit on how far it is allowed to travel. Something meant to stay on your phone cannot quietly start syncing to other people.
6. The sign-in for public posting lives on a separate service, and when you post you carry a pass that proves you are allowed to without saying who you are. The private side of the app is physically unable to call that service, and a test fails the build if anyone changes that.
7. Availability is selectable: peer availability, the optional hosted service, or a compatible owner-controlled host.

This is not a privacy skin over a normal social database. The app, the syncing, the servers, the storage, the wall around the sign-in, and the way groups work were designed together as one thing.

## 6. What Exists Now

The current branch is a pre-general-availability product with a live TestFlight track and real purchase and relay configuration in the testflight build profile.

Implemented and demonstrable today:

- five mobile destinations: Feed, Communities, Public, Messages, and Me;
- complete private community, message, post, page, file, library, theme, role, and direct-message surfaces;
- the creation layer: the owner layout editor with block palette, preview, and shareable layout templates; member canvases on six surfaces; asset packs, badges, personas, per-community profile pages, milestones, polls, guestbooks, and the pixel board; the custom theme editor with shareable theme codes; and six community starting templates (Family Space, Media Library, Club, Course Hub, Newsroom, and Blank);
- the public layer: a group can publish out of its private space, anyone can read that without an account, the owner can hand out an open invitation, and the owner reviews what gets reported, all kept behind the wall that separates the sign-in from the key;
- friend-code exchange and five-emoji human verification;
- real manual relay sessions and real development-build LAN sessions;
- protected sharing, OS share intake, personal libraries, encrypted backup destinations, and restore flows;
- one-time private unlock through RevenueCat and the App Store;
- owner flow to verify, attach, and remove a healthy community server;
- web counterparts for the core workflows, with relay-only transport.

Service or build dependent:

- the servers behind the public area, which have to be running before the public side will show anything real;
- the storefront and membership-tier blocks, which an owner can place today and which render an honest unavailable line until a billing service is configured;
- native calls and rooms;
- scheduled background and push wake;
- native LAN, Nearby, WebRTC, Bluetooth wake, playback, maps, and provider-specific storage;
- live hosted community-node operations and full production evidence.

The product does not claim these paths are live when their dependency is absent.

## 7. Execution Evidence

At commit `493b2549`, the reviewed Meerkat product roots contained approximately:

- 1,876 source files;
- 490,395 lines across mobile, web, sync, relay, layout, theme, canvas, billing, and native-support packages;
- 239 app-touching commits from 2026-06-14 through 2026-09-01;
- 165 mobile test files with 1,815 passing tests;
- 207 sync test files with 2,624 passing and 3 skipped tests;
- 245 relay test files with 1,622 passing and 189 environment-dependent skipped tests;
- additional passing web, layout, theme, and canvas suites.

These numbers show implementation breadth and pace. They are not customers, retention, revenue, or market traction.

Development sequence:

- June: local node, sealed sharing, relay, community files, Feed, and web foundation.
- Early July: direct messages, groups, posts, reactions, libraries, readers, media, transport composition, public boundary, and calls.
- Late July: production hardening, storage providers, verification-account wall, person-level identity, and in-person trust ceremony.
- August: live wake, TestFlight and billing, security hardening, Canvas, pages, theme composition, and community-server client flows.
- September 1: community-server writers, host lifecycle, and durable join queue merged.

## 8. Competitive Landscape

Meerkat sits between private messengers, community platforms, open protocols, and creator platforms.

### Private messengers

- Signal: high-trust end-to-end encrypted messaging and calls, nonprofit model, groups up to 1,000 members.
- WhatsApp: global familiarity, Communities, and end-to-end encrypted personal messages and calls.
- SimpleX, Session, and Briar: identifier minimization, decentralized relay or onion models, and offline or peer transport strengths.

Meerkat difference: a fuller home for a group, with posts, pages, libraries, protected content, a look the group chooses, and a choice of who runs the servers, while keeping the key on the device and the messages locked.

### Community and work platforms

- Discord: rich communities, voice, integrations, discovery, and network scale. Its privacy policy covers messages, uploaded content, usage, device, and sponsored-content interactions.
- Slack: mature collaboration and integrations. Its free plan limits searchable history to 90 days; paid plans are per active user.
- Circle: polished courses, events, community, and monetization. Professional starts at `$89/month` and Business at `$199/month`, with transaction fees listed by tier.

Meerkat difference: no advertising, no tracking of what people do in the app, one payment instead of a subscription, private content locked on the device, and control over the servers without paying per person.

### Open protocols

- Matrix and Element: open decentralized APIs, federation, self-hosting, encryption, and a broad ecosystem.

Meerkat difference: one product an ordinary person can use, covering the key on the device, how a group is structured, locked libraries, storage, how the pages look, and telling the truth about what is connected. Matrix remains stronger as an open ecosystem.

### Creator platforms

- Patreon: established membership and payment operations. New creators are on a standard 10% platform plan before processing and other fees.
- Circle: integrated paid communities and courses with subscription and transaction pricing.

Meerkat difference today: private community ownership and lower fixed entry pricing. Planned creator rails target external checkout, entitlement delivery, storefronts, and 0% creator platform fees, but none of that is current revenue or a shipped capability.

### Creation and customization

This is the dimension on which Meerkat has no direct comparison. Discord and Slack fix the product shape and offer accent colors. Circle and Patreon offer templates the vendor owns. Signal, SimpleX, Session, and Briar offer no presentation layer at all, because a message list is the whole product. The living reference for the demand is the customization genre itself: SpaceHey reached roughly 1.9 million registered users on the promise of a page you design yourself, and mmm.page, straw.page, and Hotglue sustain a commercial market for freeform pages.

Meerkat difference: the building tools and the private group are the same system, not two things bolted together. The stamp that proves who wrote a message is the same stamp that says who placed a sticker, and the pipeline that keeps a file locked is the one that carries a decoration. That is why the products people decorate have no privacy, and the products with privacy have nothing to decorate.

Official references: [Signal](https://signal.org/), [Signal groups](https://support.signal.org/hc/en-us/articles/360007319331-Group-chats), [WhatsApp Communities](https://faq.whatsapp.com/495856382464992), [Discord privacy](https://discord.com/privacy), [Discord Nitro](https://support.discord.com/hc/en-us/articles/115000435108-What-are-Nitro-Nitro-Basic), [Slack pricing](https://slack.com/pricing), [Element pricing](https://element.io/en/pricing), [Matrix specification](https://spec.matrix.org/latest/), [SimpleX](https://simplex.chat/docs/guide/readme.html), [Session](https://getsession.org/), [Briar](https://briarproject.org/how-it-works/), [Circle pricing](https://circle.so/pricing), and [Patreon pricing](https://support.patreon.com/hc/en-us/articles/16733504643597-Pricing-FAQ).

## 9. Why Meerkat Is Different

| Dimension | Common platform model | Meerkat model |
|---|---|---|
| Who you are | An account, an email, or a phone number owned by the platform. | A key your own phone made and keeps. The sign-in for public posting is walled off from it. |
| Your private content | Stored on the company's servers, under the company's rules. | Locked on your device and stamped by you. The servers in the middle never see anything readable. |
| Community product | Chat or feed, often paired with separate file and document tools. | Chat, posts, pages, files, libraries, themes, roles, and direct messages in one system. |
| Presentation | Fixed by the vendor; customization is a theme picker or a paid template. | Composed by the owner from a signed block layout, and built on by members through signed canvases. The group decides what the product is. |
| Public face | A separate product, a separate account, and a separate audience. | The same community, published through signed descriptors and read anonymously, with the private side behind a hard identity wall. |
| Availability | Platform-hosted only, or self-host assembly. | Peer path, optional hosted service, or compatible owner-controlled server. |
| State claims | Product often abstracts infrastructure state. | Reachability, session counts, delivery, publication, and backup are shown only from real evidence. |
| Monetization | Ads, per-seat subscriptions, high creator subscription fees, or data-driven engagement. | `$4.99` one-time private unlock plus optional `$4.99/month` hosted service. No advertising or product analytics. |

## 10. Business Model and Pricing

Current founder-locked product configuration:

- **Free:** public reading, when public services are configured.
- **`$4.99` one time:** complete private Meerkat unlock.
- **`$4.99` per month:** optional hosted relay, community node, and hosted storage.
- **Self-host option:** a user can provide a compatible connection or community server instead of buying the hosted service.

The model separates software ownership from convenience infrastructure:

- one-time unlock revenue grows with new private users;
- recurring hosted revenue grows with users or owners who prefer managed availability and storage;
- self-hosting strengthens trust and reach without forcing every customer onto recurring billing.

Revenue math must be presented as a formula until measured:

- gross unlock receipts = paid private unlocks × `$4.99`;
- gross annual hosted receipts = active hosted subscriptions × `$59.88`;
- net revenue = gross receipts less store or payment fees, taxes, refunds, infrastructure, support, and other costs.

Planned creator rails may add payment-adjacent distribution and entitlement value while charging 0% of creator revenue. That plan is not included in current pricing, forecasts, or launch capability.

## 11. Go-to-Market

Beachhead: small private organizers already coordinating across Discord, WhatsApp, Slack, shared drives, and documents.

Launch motion:

1. Recruit five to ten real organizers with named communities and use cases.
2. Prove unaided creation or joining, person verification, messaging, sharing, sync, and recovery.
3. Publish the user guide, threat model, data-flow boundary, exact pricing, and current availability matrix.
4. Launch through the App Store, Product Hunt, Hacker News, privacy and self-hosting reviewers, and organizer case studies.
5. Measure with aggregate App Store, RevenueCat, service-health, support, and consent-based interview data, never private in-product analytics.
6. Convert organizers who want managed availability to the optional hosted service while keeping self-hosting credible.

The wedge is not “privacy for everyone.” It is one organizer successfully moving one real community into a complete private home.

## 12. Launch Risks and Controls

| Risk | Current control | Required proof before broad claims |
|---|---|---|
| A configured interface is mistaken for a live service. | Fail-closed copy and capability states. | Signed-build checks against every marketed service. |
| Peer availability causes delivery confusion. | Real session ledger and verified receipts only. | Two-device relay, LAN, mailbox, and reconnect evidence. |
| Privacy claim exceeds metadata reality. | Pairwise encrypted relay frames and documented transport leakage boundary. | Independent review and published threat model. |
| User-generated content creates safety and store risk. | Report, block, filtering, safety paths, and public-layer controls in code. | Live moderation operations, contact coverage, and store review evidence. |
| Backup creates false confidence. | Encrypted destinations and verification states. | Provider-by-provider backup and restore drills. |
| Native or hosted capabilities vary by build. | Lazy modules and honest unavailable states. | Release-manifest matrix and physical-device evidence. |
| Low one-time price constrains support economics. | Optional hosted recurring revenue. | Measured activation, support cost, host conversion, churn, and infrastructure cost. |

## 13. The Next Compounding Layer

The pieces that make the next layer worth building are already here: an identity nobody can forge, membership and roles, locked files, pages, libraries, storage, a way to publish, group-owned servers, a walled-off record of who paid, and both a phone app and a web app.

The written plan for creators turns those pieces into paid memberships the creator sets themselves, a shop, checkout through the creator's own payment provider, and delivering a locked file straight to a buyer, with Meerkat taking 0% of what the creator earns. That is the direction and a real engineering plan, not something that has shipped.

## 14. The Investment Case

- The problem is structural: communities trade usability for control, or control for usability.
- Meerkat's product is the integration of both sides, not a privacy skin on a conventional hosted feed.
- The architecture creates compounding product leverage across identity, content, transport, storage, public participation, and owner infrastructure.
- The creation layer converts a fixed product into a surface other people extend, which is the retention pattern the modding and user-generated-content economies have repeatedly demonstrated, and it is defensible here because signed authorship and sealed assets make member-authored design safe rather than dangerous.
- The current price opens a low-friction member path; optional hosting creates recurring revenue without making control paywalled.
- The team has demonstrated high implementation velocity across a large, tested system in less than three months.
- The remaining proof is commercial and operational: organizer activation, store conversion, hosted-service conversion, reliability, support cost, retention, and live security evidence.

## 15. Capital Use and Missing Investor Inputs

A financing plan should allocate capital to:

- reliability, deployment, observability, backup, and incident response for hosted services;
- physical-device and cross-platform quality assurance;
- independent security review and privacy assurance;
- community safety, moderation operations, legal, and store compliance;
- organizer-led distribution, support, documentation, and trust content;
- measured creator-rail execution only after the launch product is operationally proven.

Raise size, valuation, runway, hiring plan, current revenue, user counts, retention, and market sizing are deliberately absent. The founder must supply and verify them before this becomes a fundraising deck.

## Evidence Basis

This pitch was produced from complete Meerkat mobile route and test review; its web, sync, relay, layout, theme, canvas, billing, and native-support packages; app-touching Git history; current billing configuration; and official competitor sources. Current code, signed builds, and observed commercial data outrank this dated pitch.

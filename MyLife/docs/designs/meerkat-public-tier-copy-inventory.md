# Meerkat Public Tier Copy Inventory

Purpose: inventory strings that currently promise free, anonymous, or no-account viewing of public Meerkat content and must be rewritten when Plan 39 verify-to-view lands. Founder citation: 2026-07-06 founder decision in `docs/plans/done/39-meerkat-public-base-feed.md`. Style rule respected: this document uses no em dashes.

Scope searched: `apps/meerkat/`, `apps/meerkat-web/`, `packages/sync/`, `packages/meerkat-relay/`, `scripts/check-meerkat-parity.mjs`, `docs/plans/done/19-meerkat-public-social-layer.md`, and `docs/guides/meerkat-founder-ops-runbook.md`. The founder ops runbook had no matching public-viewing rows.

The exact string column quotes the matching sentence or exact phrase to rewrite when a source line contains multiple claims.

## 1. Strings to rewrite (public tier)

| File:Line | Surface | Exact string | Owning Plan 39 phase |
|---|---|---|---|
| `docs/plans/done/19-meerkat-public-social-layer.md:1` | docs | `(free-to-view channels / communities / forums + discovery)` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:48` | docs | `Public, free-to-view communities/channels/forums are the acquisition surface: a new user can browse and read before they ever create an identity or pay` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:48` | docs | `viewing is free` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:56` | docs | `their members can read without an account` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:68` | docs | `Yes (free to view)` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:68` | docs | `Hosting-at-scale paid or self-host; viewing always free` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:94` | docs | `Viewing is free; durable hosting at scale consumes real server space` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:224` | docs | `read is always anonymous` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:280` | docs | `Entitlement gate stays OFF for viewing. Per existing default ("self-host relays remain open"), public viewing requires no entitlement. The entitlement gate applies only to PAID managed HOSTING, never to readers.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:351` | docs | `Reading stays fully anonymous (no identity required).` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:367` | docs | `Always-on managed serving is a paid service ({price}/mo). Viewing stays free for everyone; you pay for the server space your public content uses.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:383` | docs | `Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:411` | docs | `Viewing the public archive is FREE` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:493` | docs | `viewing requires no auth/entitlement` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:514` | docs | `Viewing stays free for everyone. Durable hosting uses server space: host it yourself for free while your device is online, or pay for always-on managed hosting.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:523` | docs | `Published to the public archive. Viewing is free; it stays online while a host serves it.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:590` | docs | `A user with NO identity can open Discover, browse categories, search, and READ a public community/channel/forum/post without creating an account or paying.` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:597` | docs | `viewing is never gated` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:602` | docs | `viewing is always free` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:676` | docs | `viewing is free` | P0 (annotated now, done) |
| `docs/plans/done/19-meerkat-public-social-layer.md:682` | docs | `viewing the archive is always free` | P0 (annotated now, done) |
| `apps/meerkat/AGENTS.md:306` | docs | `Reading stays anonymous; nothing fabricates a sent/joined state.` | P9 |
| `apps/meerkat/CLAUDE.md:306` | docs | `Reading stays anonymous; nothing fabricates a sent/joined state.` | P9 |
| `apps/meerkat/app.config.ts:173` | mobile | `public browsing still works` | P9 |
| `apps/meerkat/app/(root)/data/app-unlock.ts:14` | mobile | `Public browsing still works.` | P9 |
| `apps/meerkat/app/(root)/upgrade.tsx:185` | mobile | `Meerkat is free to browse public channels, communities, and forums.` | P10 |
| `apps/meerkat/app/(root)/upgrade.tsx:204` | mobile | `Store not available here. Meerkat needs the App Store or Google Play to sell the unlock. Public browsing still works.` | P10 |
| `apps/meerkat-web/src/ui/settings/AppUnlockSection.tsx:119` | web | `Meerkat is free to browse public channels, communities, and forums.` | P11 |
| `apps/meerkat/app/(root)/(tabs)/settings.tsx:595` | mobile | `Public viewing is free and needs no account. Paste a public directory host to browse and read public content in Discover.` | P9 |
| `apps/meerkat/app/(root)/data/hosted-boundaries.ts:47` | mobile | `Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.` | P9 |
| `apps/meerkat-web/src/lib/hosted-boundaries.ts:47` | web | `Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.` | P9 |
| `apps/meerkat/app/(root)/components/VerifySheet.tsx:88` | mobile | `This check is anonymous. It proves you are a person to keep out bulk spam accounts; it never proves who you are and is never shown to anyone. Reading and private, on-device features never require it.` | P9 |
| `apps/meerkat-web/src/ui/discover/VerifySheet.tsx:83` | web | `This check is anonymous. It proves you are a person to keep out bulk spam accounts; it never proves who you are and is never shown to anyone. Reading and private, on-device features never require it.` | P9 |
| `apps/meerkat/app/(root)/data/public-publish.ts:104` | mobile | `Reading stays anonymous and free for everyone. This only controls who can join the underlying community.` | P10 |
| `apps/meerkat/app/(root)/data/public-publish.ts:121` | mobile | `Viewing stays free; the price is the always-on hosting capacity.` | P10 |
| `apps/meerkat/app/(root)/data/public-publish.ts:124` | mobile | `Always-on managed serving is a paid service (${formatHostedPrice(price)}/mo). Viewing stays free for everyone; you pay for the server space your public content uses.` | P10 |
| `apps/meerkat/app/(root)/data/public-publish.ts:146` | mobile | `Self-hosted: it stays online while your host serves it. Viewing is free for everyone.` | P10 |
| `apps/meerkat/app/(root)/data/public-publish.ts:158` | mobile | `Viewing stays free for everyone. Durable hosting uses server space: host it yourself for free while your device is online, or pay for always-on managed hosting.` | P10 |
| `apps/meerkat/app/(root)/data/public-publish.ts:168` | mobile | `Published to the public archive. Viewing is free; it stays online while a host serves it.` | P10 |
| `apps/meerkat-web/src/lib/public-publish.ts:104` | web | `Reading stays anonymous and free for everyone. This only controls who can join the underlying community.` | P11 |
| `apps/meerkat-web/src/lib/public-publish.ts:121` | web | `Viewing stays free; the price is the always-on hosting capacity.` | P11 |
| `apps/meerkat-web/src/lib/public-publish.ts:124` | web | `Always-on managed serving is a paid service (${formatHostedPrice(price)}/mo). Viewing stays free for everyone; you pay for the server space your public content uses.` | P11 |
| `apps/meerkat-web/src/lib/public-publish.ts:146` | web | `Self-hosted: it stays online while your host serves it. Viewing is free for everyone.` | P11 |
| `apps/meerkat-web/src/lib/public-publish.ts:158` | web | `Viewing stays free for everyone. Durable hosting uses server space: host it yourself for free while your device is online, or pay for always-on managed hosting.` | P11 |
| `apps/meerkat-web/src/lib/public-publish.ts:168` | web | `Published to the public archive. Viewing is free; it stays online while a host serves it.` | P11 |
| `apps/meerkat/app/(root)/components/PublicReader.tsx:280` | mobile | `Request sent. The owner approves it over a connection server before you get community access. Reading stays free and anonymous.` | P9 |
| `apps/meerkat/app/(root)/components/PublicReader.tsx:283` | mobile | `This community is not accepting join requests right now. Reading stays free and anonymous.` | P9 |
| `apps/meerkat/app/(root)/components/PublicReader.tsx:290` | mobile | `Reading is anonymous; joining is an EXPLICIT action that uses this device's identity.` | P9 |
| `apps/meerkat/app/(root)/components/PublicReader.tsx:304` | mobile | `Saved on this device. You will get community access once a connection server delivers the key. Reading stays free and anonymous.` | P9 |
| `apps/meerkat-web/src/ui/discover/PublicReaderView.tsx:246` | web | `Request sent. The owner approves it over a connection server before you get community access. Reading stays free and anonymous.` | P9 |
| `apps/meerkat-web/src/ui/discover/PublicReaderView.tsx:249` | web | `This community is not accepting join requests right now. Reading stays free and anonymous.` | P9 |
| `apps/meerkat-web/src/ui/discover/PublicReaderView.tsx:255` | web | `Reading is anonymous; joining is an EXPLICIT action that uses this device's identity.` | P9 |
| `apps/meerkat-web/src/ui/discover/PublicReaderView.tsx:267` | web | `Saved on this device. You will get community access once a connection server delivers the key. Reading stays free and anonymous.` | P9 |
| `apps/meerkat/app/__tests__/hosted-boundaries.test.ts:106` | mobile | `Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.` | P9 |
| `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts:297` | parity | `Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.` | P9 |
| `apps/meerkat/app/__tests__/public-publish.test.ts:219` | mobile | `has no "forever"/"permanent" substring and keeps viewing free` | P10 |
| `apps/meerkat/app/__tests__/public-publish.test.ts:223` | mobile | `viewing is free` | P10 |
| `apps/meerkat-web/src/lib/__tests__/public-publish.test.ts:211` | web | `has no "forever"/"permanent" substring and keeps viewing free` | P11 |
| `apps/meerkat-web/src/lib/__tests__/public-publish.test.ts:215` | web | `viewing is free` | P11 |
| `packages/sync/src/protocol/publication.ts:8` | engine | `anyone can read the public snapshot anonymously` | P9 |
| `packages/sync/src/protocol/publication.ts:107` | engine | `The PUBLISHED read key (hex), carried in the clear: read is anonymous.` | P9 |
| `packages/sync/src/protocol/publication.ts:115` | engine | `request -> joining the underlying community needs approval; open -> anyone. Read is always anonymous.` | P9 |
| `packages/sync/src/node/public-snapshot-client.ts:10` | engine | `fetches the OPEN manifest (no auth -- reading is anonymous)` | P9 |
| `packages/sync/src/__tests__/publication.test.ts:5` | engine | `anyone can read a public snapshot anonymously` | P9 |
| `packages/meerkat-relay/src/community-node.ts:423` | relay | `Owner-only register / public-read verdict (no member role; reads are anonymous).` | P9 |
| `packages/meerkat-relay/src/community-node.ts:1062` | relay | `OPEN public publications (Plan 19 P3a). Owner-signed register; anonymous read.` | P9 |
| `packages/meerkat-relay/src/__tests__/community-node-dos-hardening.test.ts:82` | relay | `Nothing was registered: the anonymous manifest read 404s.` | P9 |
| `packages/meerkat-relay/src/__tests__/community-node-public-e2e.test.ts:14` | relay | `ANONYMOUS GET /public/{id}/manifest returns it` | P9 |
| `packages/meerkat-relay/src/__tests__/community-node-public-e2e.test.ts:16` | relay | `ANONYMOUS GET /public/{id}/{contentId}/{index} serves the public snapshot` | P9 |
| `packages/meerkat-relay/src/__tests__/community-node-public-e2e.test.ts:189` | relay | `registers a publication and serves the manifest anonymously (no auth headers)` | P9 |
| `packages/meerkat-relay/src/__tests__/community-node-public-e2e.test.ts:206` | relay | `serves public snapshot pieces anonymously; the reader imports + verifies them` | P9 |

## 2. Confirmed out of scope (NC-P1, private tier stays account-free)

| File:Line | Surface | Exact string |
|---|---|---|
| `apps/meerkat/app/(root)/upgrade.tsx:186` | mobile | `full private use forever: create and seal your own content, direct messages, your own communities, device-to-device sync over Wi-Fi or a connection server, and self-hosting. No subscription. No account required.` |
| `apps/meerkat/app/(root)/upgrade.tsx:221` | mobile | `because Meerkat needs no account: to use one purchase on both, enter a link code below (needs a connection server).` |
| `apps/meerkat-web/src/ui/settings/AppUnlockSection.tsx:120` | web | `full private use forever: create and seal your own content, direct messages, your own communities, device-to-device sync, and self-hosting. No subscription. No account required.` |
| `apps/meerkat/docs/reports/meerkat-posts-agent-native-chat-spec-2026-06-18.md:450` | docs | `no account, no central registry; the key is the identity.` |
| `apps/meerkat/docs/reports/meerkat-posts-agent-native-chat-spec-2026-06-18-appendix.md:495` | docs | `Self-sovereign identity: every device mints its own keypair offline; no account, no server, no central registry. Identity is the key.` |

## 3. Counts summary

| Section | Row count |
|---|---:|
| Strings to rewrite (public tier) | 71 |
| Confirmed out of scope (NC-P1, private tier stays account-free) | 5 |

Not counted: humanity-token anonymity copy that does not promise public reading, private DM read-receipt test names, `no signing key` variable/comment hits, `public_viewing` identifiers, non-Meerkat competitor rows, and public-browsing operational copy that only says a directory host is needed. `scripts/check-meerkat-parity.mjs` had two matching hits, both excluded: one connection-card comment about anonymous reading, and one humanity verification string that does not promise public reading.

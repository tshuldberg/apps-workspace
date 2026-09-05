# Plan 58: The Meerkat Editor + Creator Rails

- **Project:** Meerkat (`apps/meerkat/`, `apps/meerkat-web/`, `packages/sync/`, `packages/meerkat-layout/`, `packages/meerkat-relay/`)
- **Created:** 2026-09-01 (rewritten same day to development-ready after a code + git-history equipment audit)
- **Source designs:** `apps/meerkat/docs/reports/REPORT-meerkat-community-page-archetypes-2026-09-01.html` (archetypes 1-10), the 2026-08-31 community-server report, and `apps/meerkat/docs/reports/REPORT-meerkat-composition-platform-build-plan-2026-08-24.md` section 10 (the reviewed monetization design this plan executes and partially supersedes).
- **Depends on:** Plan 57 branch (`worktree-meerkat-community-servers`) merged: community servers, writers, durable join queue.
- **Status:** queue, READY FOR DEVELOPMENT. Kickoff prompt: `docs/prompts/58-meerkat-editor-creator-rails-kickoff.md`.
- **Founder mandate applies:** full production-grade function. Founder directions 2026-09-01: (a) Meerkat must replace Patreon/OnlyFans-class platforms (any legal content, mature creators behind the universal 18+ gate), personal websites, and webstores; (b) tiers are the CREATOR'S schema: any count (one is fine), any price, any cadence (monthly, annual, custom interval, one-time-forever).

## Equipment audit: what exists today vs what this plan builds (verified 2026-09-01)

**EQUIPPED TODAY (verified in code):**
- Composition spine: `cm_layout` owner-signed event + `packages/meerkat-layout` codec (`codec.ts`, `schema.ts`, 32KB cap, fixture-locked canonical bytes). `MkLayoutDocument` ALREADY carries `tiers: MkTierDef[]` ("empty until monetization phases") and `capabilities` (`types.ts:20-56`).
- Block registry with 15 block types incl. `tiers` and `store` (`apps/meerkat/app/(root)/data/block-registry-core.ts:97-112` + web twin), Zod config schemas, NO-URL rule on every config field (`:117` "Bounded, network-incapable config primitives. NO field may carry a URL."), honest placeholder fallback. Layout editors exist on both surfaces (`community/[communityId]/layout-editor.tsx`, web `LayoutEditorSection`).
- Content platform: channels/posts/reactions/DMs/files, sealed libraries + on-device decrypting players (Plan 38), publications with anonymous public read (Plan 19), themes/badges/Canvas/Pages/Plaza (Plan 56), age gate (universal floor), community templates at creation (`community-template-commit.ts` both surfaces).
- Plan 57 (on branch): community servers with client writers, host lifecycle, durable join queue (park/box/ack with roster-gated tokens + authenticated grant lane), honest hosting probe.
- Key machinery for tiers: workspaces + epoch chains + `commitMemberAdd`/removal + rotation + `historyScope`; per-entity keys/crypto-shredding (`destroyChannelMessageKeys` -> `destroyEntityKey`).
- Money substrate that stays UNUSED for creator revenue: hosted Stripe billing service + entitlements are for Meerkat hosting only.

**MISSING (this plan builds):**
1. Tier KEY LANES: `MkTierDef` is data-only; no child workspace per tier, no tier grant/lapse flow, `tiers` block renders from the layout doc without any enforcement lane. (Composition §10.1 designed it; zero code exists.)
2. Creator-defined tier commerce fields: `MkTierDef` has `priceRef` with the OLD founder-locked-platform-pricing assumption (`meerkat-layout/src/types.ts:31-45`). Superseded: creators set display price, cadence (monthly/annual/custom/one-time), and their own `checkoutUrl`.
3. Purchase handshake: nothing exists. §10.1's billing-service-minted blind vouchers are superseded by CREATOR-minted claim codes (simpler, processor-agnostic, and the anonymity-set concern §10.1 managed does not arise: a creator already knows their own subscribers).
4. Storefront: the `store` block references `cm_store_listings` (`block-registry-core.ts:237`) but no such table, writer, or fulfillment path exists anywhere.
5. Per-block audiences: `MkBlockNode = { type, config }` has no audience field; everything in a layout renders for every member.
6. Open-web renderer: the community node serves JSON APIs only; no HTML page route, no custom-domain path.
7. Editor completeness: current editors reorder/insert registry blocks; no audience picker, no tier manager, no template-apply-to-existing-community.
8. Delegated agent: no owner-countersigned delegation primitive (blocks automated lapse handling, claim granting while the owner sleeps, AND admin join grants; flagged in Plan 57 Phase 4).
9. Links on personal pages: the composition NO-URL rule (anti-phishing) currently forbids a Links block; the sanctioned consent-gated open flow is composition Phase 9 (`embed` block, unbuilt).

## Non-negotiable positions (bind every section)

1. **Membership IS the read capability.** A tier is a key lane (child workspace `communityId:tier:<tierId>`, per composition §10.1); no server-side allow check ever gates reads. The editor cannot express a state the crypto does not enforce.
2. **Meerkat never touches creator payments.** Join/buy buttons link out to the creator's own processor; platform cut is 0%; prices/cadences/discounts are creator content (display strings). This supersedes §10.1's platform-billing purchase path for creator revenue. (Meerkat's own $4.99 unlock + hosted $4.99/mo are untouched.)
3. **Mature content = legal content behind the universal 18+ gate**, private by default; public-tier safety rails (abuse scan, NCMEC, DMCA) apply unchanged wherever content becomes public. iOS external-purchase-link policy is a founder-ops/counsel checkpoint, not a code assumption.
4. **Delivered digital goods are irrevocable** (sealed grants on the buyer's device). Honest counts only (stock, members) from signed rows; "hidden" allowed, invented never.
5. Plan 51/57 walls hold: no account identifier beside a device identifier; nodes hold no epoch/tier keys; `/healthz` untouched; two-identity wall import-graph allowlists change only by reviewed one-line diffs.
6. Descriptor signature discipline: any verifier-visible field (per-channel `tierId`, if ever needed) uses NESTED conditional append inside the organization slot per the composition plan's constraint note; layout-blob changes use the same fixture-locked conditional canonical append as every prior extension.

## Work sections (one fable5 agent per section; S-numbers are the execution order)

### S1: Tier key lanes + creator tier schema
- Extend `MkTierDef` (conditional canonical append, fixtures): `{ id, name, perks, channelIds }` + NEW `{ priceDisplay, cadence: 'monthly'|'annual'|'one_time'|{intervalDays}, yearlyPriceDisplay?, checkoutUrl?, neverExpires?: boolean, mature?: boolean }`; `priceRef` retained for legacy decode, ignored.
- Tier workspace lane in `@mylife/sync`: create/commit child workspace `communityId:tier:<tierId>` on tier creation (owner device), tier grant = `commitMemberAdd` + wraps in a TIER_GRANT join-queue envelope (reuses Plan 57 queue verbatim, new sealed kind), lapse/leave = removal + rotation; one-time tiers set a signed `neverExpires` the UI renders and the owner tooling refuses to rotate-away.
- Channel-to-tier mapping stays in the layout doc (v1); entity rules route tier-gated channels' `cm_messages` under the tier workspace key (design detail: tier-gated channel content seals with the tier workspace epoch content key; the send path picks the key by channel mapping).
- App cores + settings "Tiers" manager (owner CRUD over the schema, both surfaces, twin tests). `tiers` block renders the REAL schema incl. cadence toggle + one-time cards (archetype 7 is the visual spec).
- AC: two-device e2e: member with tier key reads tier channel; listed community member WITHOUT tier key gets nothing (not even ciphertext via node pull for that channel); lapse rotates and stops new content while old content persists locally. NC: a forged tier schema (non-owner signature) renders nothing.

### S2: Claim codes (checkout handshake)
- `@mylife/sync` protocol: owner-minted signed single-use claim codes `{ communityId, scope: {tierId}|{productId}, nonce, expiresAt }`; mint-in-bulk export (CSV/text for any processor's post-purchase delivery); spent-set device-local, replicated across the owner's own devices (personal_replica).
- Redemption: `meerkat://claim#<code>` deep link (+ web twin route) -> sealed CLAIM envelope parked on the community node's durable join queue -> owner drain verifies (signature, unspent, unexpired) -> tier grant (S1) or product delivery (S5) -> honest sealed refusal otherwise.
- AC: relay e2e mint -> processor-style code handoff -> park -> drain -> grant -> pull succeeds across a node restart; a replayed code is refused `spent`; an expired code `expired`. NC: a claim for community A never grants in community B (scope binding).

### S3: Per-block audiences
- `MkBlockNode` gains `audience?: 'public' | 'members' | { tierId }` via conditional canonical append (absent = members, today's behavior; fixtures lock legacy bytes). `locked_preview` becomes an explicit block type whose owner-authored public teaser is the ONLY cross-audience leakage.
- Resolvers/renderers on both surfaces skip key-less blocks entirely; block registry entries declare which audiences they may carry (e.g. `chat` never `public`).
- AC: fixture-locked codec; renderer tests prove a tier block is absent (not erroring, not teasing) without keys. NC: a `public` audience on a members-only data source fails validation at resolve, renders placeholder.

### S4: The editor (palette + inspector + audiences + tiers)
- Upgrade both layout editors to the archetype-10 shape: block palette from the registry, per-block inspector (config via each block's Zod schema), audience segment control (Public/Members/Tier picker fed from S1), page theme quick controls (existing theme seam), one signed revision per save (existing rule), "Preview as visitor / as tier X".
- AC: editor cannot save an audience the schema forbids; a save produces exactly one `cm_layout` revision; preview-as renders through the same resolver as real readers.

### S5: Storefront (listings + sealed-grant delivery)
- New owner-signed `cm_store_listings` (the table the store block already names): `{ productId, name, priceDisplay, kind: 'digital'|'physical'|'either'|'custom', checkoutUrl, stock?: {count, visible}, sealedItemIds[] }`; entity rule added explicitly (fail-closed default reminder); stock updates are owner-signed rows ("Real or Hidden, never invented" is the editor copy, per archetype 10).
- `store` block renders listings live; purchase = S2 claim with `productId` scope; digital delivery = per-object DEK wraps for `sealedItemIds` (library grant, irrevocable); physical/custom = claim opens a DM thread with the shop (order reference = code id).
- AC: buy-digital e2e ends with the item decrypting from the buyer's library and remaining after the shop revokes nothing/everything; stock 41-of-50 renders only from the signed row. NC: a second redemption of a digital claim is refused; a listing signed by a non-owner renders nothing.

### S6: Open-web renderer (personal sites + public pages)
- Community node route `GET /page/{communityId}[/{pageId}]`: server-side static HTML of PUBLIC-audience blocks only (theme tokens inlined, no client JS required, honest footer); public read limiter + report/DMCA routes apply; members/tier blocks and locked-preview internals never serialize.
- Host panel + Caddy template: custom-domain mapping step (founder-ops doc per the Instruction Writing standard).
- Links: on the open-web render, owner-authored `links` block URLs are permitted (it is the creator's own website); IN-APP the links block renders the composition-sanctioned way: label + copyable URL with the consent-gated open flow (mini scope pulled forward from composition Phase 9, design-reviewed in-section; no auto-open, no preview fetch).
- AC: curl of the page route returns the public blocks and nothing else (grep-proof: no tier content bytes); a members-only page 404s. NC: renderer output for a community with zero public blocks is an honest empty page, not an error.

### S7: Template gallery (absorbs Plan 57 W6)
- Ship the ten archetypes as creation templates + apply-to-existing (extends `community-template-commit.ts` to write layout + tiers + listings skeletons); rules-screening and first-task-guide blocks included as template content (the two Discord-lesson features from the 2026-08-31 report).
- AC: creating from each template yields a working page on both surfaces with placeholder-free honest states; applying a template to an existing community is one signed revision and never touches content tables.

### S8: Delegated agent (design-first)
- Owner-countersigned delegation certificate: `{ delegateDeviceId, scopes: ['tier_grant','claim_verify','lapse_remove','join_grant'], communityId, expiresAt, revocable }` signed by owner; verified at APPLY everywhere a grant/removal lands; enables the creator's own server (or spare device) to run S2 drains and S1 lapses while the owner sleeps, and unlocks Plan 57's deferred admin join grants.
- Written design + adversarial review BEFORE code (roster-monotonicity interaction is the known hazard, per Plan 57's Phase 4 note). Then implement + e2e (delegate grants; revoked delegate cannot; delegate can never mint outside scopes).

### S9: Battery, parity, adversarial review, docs
- Full twin suites, `check-meerkat-parity.mjs` locks for every new user-facing string set (tier cadence copy, store honesty copy, renderer footer), relay e2e green, codex + opus adversarial passes on S1/S2/S5/S8 (money-adjacent), session log + memory + release notes.

## Sequencing + agent protocol

S1 -> S2 -> (S3 ∥ S5-listings-schema) -> S4 -> S5-delivery -> S6 -> S7 -> S8 -> S9. One fable5 agent per section, spawned AFTER the previous section's gates are green; the orchestrator (fable5) reviews each section's diff against this plan and the non-negotiables before spawning the next. File-ownership boundaries per section are listed in the kickoff prompt.

## Scope

`packages/meerkat-layout/src/*` (schema/codec extensions, fixtures), `packages/sync/src/protocol/` (tier lanes, claims, delegation), `packages/meerkat-relay/src/community-node*` (page renderer; claim queue is reused not modified), both app cores + editors + settings + store/tiers blocks, `scripts/check-meerkat-parity.mjs`, template assets, `docs/`.

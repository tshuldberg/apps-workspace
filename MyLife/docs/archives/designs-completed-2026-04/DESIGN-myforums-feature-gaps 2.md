# MyForums - Feature Gap Design Doc
**Source:** Social Module Design Sprint (2026-03-10), CEO Review GP-17-8a (2026-03-24)
**Status:** CEO Review Complete, Eng Review Pending (GP-17-8b)

## Current State

MyForums is a privacy-first community discussion module for the MyLife hub. Core vision: "human-verified free communication without the junk." Binary human verification (passkey/fingerprint/Face ID) ensures every poster is a real person. No ads, no tracking, no AI training on user content.

The module has 23+ Zod schemas, 17 cache CRUD functions, 22 cloud client functions, and a trust engine with verification checks, community health calculation, and module community templates.

No standalone app exists. MyForums is designed as a hub-native module from the start.

## CEO Review Decisions (GP-17-8a)

### Scope Expansions Accepted
1. **Cross-module content cards** - Inline previews of books, recipes, workouts in forum posts
2. **Community health dashboard** - % verified humans, response time, mod frequency, signal-to-noise score
3. **Transparent mod log as first-class UI** - Browsable public tab in every community
4. **"Humans Only" community mode** - Requires device attestation (passkey/fingerprint/Face ID) to participate
5. **Community templates** - Auto-seed module communities with rules, tags, and welcome posts

### Scope Cuts
- **Voice channels** - Discord's moat; not our fight. Files retained for future.
- **ActivityPub federation** - Lemmy's ideology; not our wedge. Files retained for future.
- **E2EE messaging** - Deferred to post-Beta. Server-encrypted for Beta.
- **Multi-dimensional voting** - Single up/down for Beta. Add quality/relevance axes post-Beta.
- **Progressive trust tiers** - Simplified to binary verified/unverified. No karma aristocracy.

### Key Design Decision: Binary Human Verification
Instead of Receeps-style progressive trust tiers (4 levels with weighted voting), the CEO review simplified to binary:
- **Unverified:** Can read everything. Cannot post or vote in "Humans Only" communities.
- **Verified Human:** Proved humanity via passkey, fingerprint, or Face ID. Full posting/voting rights. Equal to all other verified humans.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| Reddit | Free (ads) | General forums | Massive community, subreddit model, mature moderation |
| Discourse | Free (self-hosted) / $100+/mo (hosted) | Forum software | Trust levels, excellent moderation, long-form discussion |
| Lemmy | Free (open source) | Federated forums | Decentralized, no corporate control, ActivityPub |
| Hacker News | Free | Tech forums | Clean UI, quality discussion culture, karma system |
| Discord | Free / $10/mo | Chat + forums | Real-time, voice, screen sharing, community building |

## MyForums Differentiators (vs All Competitors)

| Differentiator | What It Means | Who Can't Copy It |
|----------------|---------------|-------------------|
| Binary human verification | Every poster proved they're human via device attestation | Reddit (bots drive ad revenue), Discord (engagement metrics depend on volume) |
| "Humans Only" mode | Community toggle that guarantees bot-free discussion | Any ad-funded platform (bots generate clicks) |
| Subscription-funded | Incentives aligned with users, not advertisers | Reddit, Discord, Twitter (all ad-dependent) |
| Cross-module integration | Forum posts link to your book library, recipe collection, workout log | Every standalone forum (no module ecosystem) |
| Community health dashboard | Trust metrics replace engagement metrics | Platforms optimizing for time-on-site |
| Transparent mod log | Public, browsable moderation record | Platforms with opaque content moderation |

## Feature Gaps vs Competitors (Post-Beta)

| Feature | Priority | Competitors That Have It | Difficulty | Notes |
|---------|----------|--------------------------|------------|-------|
| @mention autocomplete | P1 | Discord, Discourse | Low | Query profiles by handle prefix. Pure client-side. |
| Markdown preview (split pane) | P1 | Discourse | Low | Live preview while composing. Mobile: toggle tabs. Web: split pane. |
| Crossposting | P2 | Reddit | Low | Share a thread to multiple communities. Join table addition. |
| Sticky megathreads | P2 | Reddit | Low | Auto-recurring sticky threads (weekly, monthly). |
| Content filtering/AutoMod | P2 | Reddit, Discourse | High | Keyword/regex filters. No ML (privacy-first). |
| Award/badge system | P2 | Reddit (awards) | Medium | Milestone badges, community flair. |
| Image galleries | P2 | Reddit, Discord | Medium | Multi-image posts with lightbox. Supabase Storage. |
| E2EE messaging | P2 | Signal | High | Upgrade from server-encrypted to end-to-end. Post-Beta. |
| Multi-dimensional voting | P3 | None | Medium | Quality + relevance axes beyond up/down. |
| Wiki/knowledge base | P3 | Discourse, Reddit | Medium | Community-managed reference pages. |
| Post scheduling | P3 | Reddit (mod tools) | Low | Schedule posts for future publication. |
| Email notifications | P2 | Discourse, Reddit | Medium | Email digests for replies and mentions. |

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyBooks** | Linked `books` community (auto-seeded). Inline content cards for book references. "Discuss this book" action. |
| **MyRecipes** | Linked `recipes` community (auto-seeded). Inline recipe cards (thumbnail + cook time). |
| **MyWorkouts** | Linked `workouts` community (auto-seeded). Inline workout cards (exercise list). |
| **MySurf** | Linked `surf` community (auto-seeded). Inline surf condition cards. |
| **MyBudget** | Linked `budget` community (auto-seeded). No entity linking (financial data is privacy-sensitive). |
| **MyTrails** | Linked `trails` community (auto-seeded). Inline trail cards (distance, elevation). |

## Privacy Competitive Advantage

Every major forum platform monetizes user data:
- **Reddit** serves targeted ads based on subreddit subscriptions. User data sold for AI training ($60M/year to Google).
- **Discord** collects message content, voice data, and behavioral patterns.
- **Facebook Groups** feeds the Meta advertising ecosystem.

MyForums keeps all discussion data in the user's Supabase instance with no data sharing, no ad targeting, and no AI training on user content. Moderation is transparent and community-driven, not algorithmic. Human verification ensures every participant is a real person.

The value proposition: "The forum where every poster is a verified human, and your data stays yours."

## Technical Debt / Risks

1. **Karma recalculation** - Trigger-based karma recalculates from UNION of all votes. At scale (100K+ votes per user), consider incremental updates (+1/-1).

2. **Nested RLS queries** - Several policies use nested subqueries. Test under load. Consider helper SQL functions.

3. **Anonymous posting audit** - Anonymous posts store real `author_id` for moderation. Privacy tension with mod visibility. Document in community rules.

4. **Supabase Storage for media** - Image attachments require Supabase Storage configuration. Shared with MySurf; standardize across modules.

5. **Device attestation cross-platform** - Apple DeviceCheck (iOS), Google Play Integrity (Android), WebAuthn passkeys (Web). Each platform has different verification flows.

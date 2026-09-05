# MyForums — Module Audit

**ID:** forums | **Prefix:** fr_ | **Tier:** free | **Storage:** supabase (SQLite cache)
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.4.0 (schema v4)
**One-line promise:** Human-verified community, bot-free by design

## User Value
- Reddit-style discussions with the bots removed via device-attested human verification.
- "Humans Only" community mode: only verified humans can post.
- Transparent mod log visible to everyone, not a private mod backroom.
- Community health dashboard replaces vanity engagement metrics.
- Direct messages with presence/typing indicators and server-side encryption.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Threaded discussions + voting | modules/forums/src/models/, db/schema.ts | shipped |
| Community creation (public/restricted/private) | modules/forums/src/models/, cloud/ | shipped |
| Moderation (actions/reports/blocks/rules/tags) | modules/forums/src/trust/, ui/ | shipped |
| Binary human verification (passkey/biometric) | modules/forums/src/trust/ | shipped |
| "Humans Only" community mode | modules/forums/src/trust/ | shipped |
| Community health dashboard | modules/forums/src/activity/, ui/ | shipped |
| Transparent mod log | modules/forums/src/trust/, ui/ | shipped |
| Profiles + badges | modules/forums/src/profile/ | shipped |
| Direct messaging (convos, encrypted server-side) | modules/forums/src/messaging/, db (fr_conversations_cache, fr_messages_cache) | shipped |
| Media attachments + link previews | modules/forums/src/media/ | shipped |
| Realtime (typing, presence, channels) | modules/forums/src/realtime/ | shipped |
| Community templates (auto-seed module communities) | modules/forums/src/cloud/ | shipped |
| Cross-module content cards | modules/forums/src/ui/ | shipped |
| Activity feed (cached) | modules/forums/src/activity/, db (fr_activity_cache) | shipped |
| Full-text search (tsvector on server) | modules/forums/src/cloud/ | shipped |
| Federation scaffold | modules/forums/src/federation/ | scaffolded |
| Voice scaffolding | modules/forums/src/voice/ | scaffolded |

## Data Model
- Supabase (server, not audited here): communities, threads, replies, votes, profiles, mod actions, messages.
- Local SQLite cache (v4): fr_communities_cache, fr_community_members_cache, fr_threads_cache, fr_replies_cache, fr_profiles_cache, fr_messages_cache, fr_conversations_cache, fr_tags_cache, fr_bookmarks_cache, fr_activity_cache, fr_votes_local.

## Screens / User Flows
- Mobile: apps/mobile/app/(forums)/ -- (tabs), index, activity-feed, community-detail, community-health, community-settings, create-community, create-thread, thread-detail, user-profile, edit-profile, conversation, messages, new-message, mod-log.
- Web: apps/web/app/forums/ -- page, communities/, community/, community-health/, community-settings/, create-community/, create-thread/, thread/, profile/, edit-profile/, activity/, messages/, mod-log/, search/, saved/, head.tsx.

## Distinctive / Moat-worthy
- Binary human verification at post time (device attestation), not a captcha -- Reddit and Discord do not offer this.
- Transparent mod log as a public tab in every community.
- Community health dashboard (% verified, response time, signal-to-noise) instead of engagement/ad metrics.
- Cross-module content cards (book/recipe/workout previews) that only a suite can produce.
- Subscription-funded: incentives aligned with users, not advertisers.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- [ ] @mention autocomplete (P1)
- [ ] Markdown preview split pane (P1)
- [ ] Email notification digests (P2)
- [ ] Crossposting to multiple communities (P2)
- [ ] Sticky megathreads with auto-rotation (P2)
- [ ] Content filtering/AutoMod (P2)
- [ ] Image galleries with lightbox (P2)

Intentionally not built: voice channels, ActivityPub federation, E2EE messaging (deferred post-Beta).

## Investor-facing hook
MyForums is the only community platform where "no bots" is a technical guarantee, making it the natural home for health, finance, and cycle discussion that Reddit cannot credibly host.

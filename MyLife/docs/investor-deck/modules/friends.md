# MyFriends — Module Audit

**ID:** friends | **Prefix:** fn_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v2)
**One-line promise:** Remember who matters to you

## User Value
- A relationship CRM for real life: people, circles, hangouts, memories, gifts, life events.
- Frequency + social-energy engines nudge you when a friendship is drifting.
- Birthday and life-event reminders without handing your contacts to a growth-hack SaaS.
- Private journal entries tied to specific people.
- Insights on hangout quality and friendship health.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| People + circles | modules/friends/src/db/schema.ts (fn_people, fn_circles) | shipped |
| Hangouts log | modules/friends/src/db/schema.ts (fn_hangouts) | shipped |
| Memories + photos | modules/friends/src/db/schema.ts (fn_memories, fn_photos) | shipped |
| Gifts + gift ideas | modules/friends/src/db/schema.ts (fn_gifts, fn_gift_ideas) | shipped |
| Life events | modules/friends/src/db/schema.ts (fn_life_events) | shipped |
| Birthdays engine | modules/friends/src/engine/birthdays.ts | shipped |
| Frequency engine | modules/friends/src/engine/frequency.ts | shipped |
| Circles/groups engine | modules/friends/src/engine/groups.ts | shipped |
| Life chapters engine | modules/friends/src/engine/life-chapters.ts | shipped |
| Nudges engine | modules/friends/src/engine/nudges.ts, db (fn_nudges) | shipped |
| Quality analysis (hangout quality) | modules/friends/src/engine/quality-analysis.ts | shipped |
| Social energy engine | modules/friends/src/engine/social-energy.ts | shipped |
| Timeline engine | modules/friends/src/engine/timeline.ts | shipped |
| Cross-module integrations | modules/friends/src/integrations/ | shipped |
| Security module (local privacy guard) | modules/friends/src/security/ | shipped |

## Data Model
- fn_people, fn_circles, fn_hangouts, fn_memories, fn_photos, fn_gifts, fn_gift_ideas, fn_life_events, fn_nudges, fn_settings.

## Screens / User Flows
- Mobile: apps/mobile/app/(friends)/ -- index, add-person, edit-person, log-hangout, hangout-detail, hangouts, memories, memory-detail, add-memory, gift-tracker, add-gift, add-gift-idea, life-events, add-life-event, circles-list, add-circle, circle-detail, people-by-city, birthdays, journal, add-journal, insights, insights-quality, health.
- Web: apps/web/app/friends/ -- page, [id], add, hangouts/, memories/, circles/, birthdays/, cities/, insights/, health/, settings/, actions.ts.

## Distinctive / Moat-worthy
- Social-energy + quality-analysis engines -- no competitor scores friendships this way without feeding ads.
- Nudges system is local-only, not a SaaS reminder spam engine (unlike Clay or Monaru).
- Free tier: relationship data is too sensitive to paywall; builds trust for the broader suite.
- Cross-module integrations (hangouts reference restaurants, books, recipes) create lock-in a single-purpose CRM cannot.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- Not present in COMPETITIVE-MATRIX.md. Peers: Clay, Monaru, Dex, UpHabit. Add a row in next matrix refresh.

## Investor-facing hook
MyFriends is the only personal CRM that refuses to upload your contact list, and it uses on-device engines to tell you which relationship needs attention this week.

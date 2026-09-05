# Module Proposal: MyFriends

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `friends`
**Table prefix:** `fn_`
**Tier:** Free (acquisition hook) or Pro
**Target module number:** #34
**Date:** 2026-04-20
**Demographic pull:** Ages 12-25 (strongest), universal appeal

---

## Executive Summary

No app exists that serves as a private CRM for your personal relationships. Social media tracks your "social graph" for advertisers. MyFriends tracks your actual friendships for YOU. Who you spent time with, when, doing what. Birthday reminders, gift ideas, shared memories, inside jokes, relationship health awareness. Not social media -- a private journal of your social life.

**Positioning sentence:** *Instagram knows who follows you. MyFriends remembers who matters to you.*

---

## Why This Module

1. **The anti-social-media.** Research shows teens are moving toward private, closed-loop sharing. 80M Locket downloads prove demand for ambient friend presence without broadcast.
2. **Relationship management is universal but unserved.** Adults use CRM software for work contacts. No equivalent exists for personal relationships.
3. **Teens' #1 stressor is social relationships.** A private space to process friendships without broadcasting to the world fills a genuine emotional need.
4. **Cross-module gravity.** Every other module produces social data (who you dined with, who you worked out with, who you went to concerts with). This module gives that data a home.
5. **Strongest "hub" module possible.** Unlike single-vertical modules, this CONNECTS all other modules by being the "who" layer across all activities.
6. **Zero business flywheel needed.** This is a pure consumer moat module. Its value is making every other module stickier.

---

## Full Feature Set

### Core: People Manager

- **Add people:** Name, photo, how you met, when you met, where you met
- **Relationship type:** Close friend, friend, acquaintance, family, partner, ex, colleague, mentor, neighbor
- **Circles/groups:** "College friends," "Work crew," "Basketball team," "Book club"
- **Contact info:** Phone, email, social handles, address (all optional, all private)
- **Quick facts:** Allergies, dietary restrictions, birthday, anniversary, favorite things
- **Interests/hobbies:** What they're into (for gift ideas and conversation starters)
- **Communication preference:** Text, call, in-person, social DM
- **How they make you feel:** Private tag (energizing, draining, neutral, complicated)
- **Relationship start date:** When did this friendship begin?
- **Photo:** Profile photo or memory photo for recognition

### Core: Hangout Logger

- **Log a hangout:** Who, when, where, what you did, how long
- **Quick log:** "Coffee with Alex, 1hr" -- minimal friction
- **Auto-suggest from other modules:** If you logged a dining visit with companions, auto-suggest logging here too
- **Group hangouts:** Multiple people at once
- **Activity tags:** Coffee, dinner, hike, movie, gaming, party, study, work, random
- **Quality rating:** How was this time? Great / Good / Fine / Meh / Bad
- **Notes:** What you talked about, funny moments, things to remember
- **Photos:** Attach photos from the hangout
- **Location:** Where you were (optional, links to places in Trails)
- **Frequency tracking:** How often do you see each person?

### Core: Birthday & Anniversary Tracker

- **All birthdays in one place:** Never forget again
- **Anniversary tracking:** Friendship anniversaries, relationship milestones
- **Reminders:** 1 week before, 1 day before, day-of (configurable)
- **Gift ideas per person:** Running list of "things they'd love"
- **Past gifts log:** What you gave them before (avoid repeats)
- **Card/message drafts:** Notes for what to write
- **Birthday history:** What you did for their birthday each year
- **Calendar sync:** All birthdays on your phone calendar

### Core: Relationship Health

- **Last seen indicator:** Days since you last hung out with each person
- **"Haven't connected" nudges:** Gentle reminder when it's been 30/60/90 days (configurable per person)
- **Frequency goals:** "See Alex at least once a month" -- track against goal
- **Drift detection:** "You used to see Sam every week. It's been 45 days." (non-judgmental)
- **Effort balance:** Are you always initiating, or is it mutual? Private awareness only.
- **Season of life notes:** "Sarah just had a baby, expect less availability" -- context for reduced contact
- **Gratitude log:** Things you appreciate about this person (private)
- **Conflict notes:** Private processing space when friendships are hard

### Core: Gift Tracker

- **Gift ideas per person:** Running list, price estimates, links
- **Past gifts given:** What, when, how much, their reaction
- **Past gifts received:** What they gave you (helps reciprocate)
- **Occasion tracking:** Birthday, holiday, just-because, thank-you
- **Budget per person/occasion:** Stay in range
- **Wishlist awareness:** If they've shared a wishlist (link)
- **Group gift coordination:** Split cost tracking for group gifts
- **"Perfect for them" capture:** Quick-add when you see something they'd love (while shopping, browsing, etc.)

### Advanced: Shared Memories

- **Memory collections:** Per-person or per-group photo/moment collections
- **Inside jokes log:** The context for your inside jokes so you never forget the origin
- **Shared experiences timeline:** Every hangout, trip, meal, concert you've done together
- **"Remember when..." prompts:** Surface old memories on anniversaries
- **Voice memo attachments:** Record a funny moment (links to Voice module)
- **Milestone tracking:** "First time we hung out," "First trip together," "10-year friendiversary"

### Advanced: Group Dynamics

- **Friend groups:** Define groups, see group activity
- **Group compatibility:** Which friends do you combine most?
- **Group events:** Track group gatherings over time
- **New introductions:** "Introduced Alex to Sam on [date]" -- track your connector role
- **Group chat references:** Which platforms do you use with which groups? (just notes, no integration)
- **Group traditions:** "Annual camping trip," "Sunday brunch crew" -- recurring events

### Advanced: Life Chapter Awareness

- **Moving:** Track when friends move cities
- **Life transitions:** Engaged, married, baby, divorce, new job, graduation, retirement
- **Appropriate responses:** Suggested acknowledgments for major life events
- **Distance management:** Friends in different cities -- when did you last connect?
- **"When I'm in [city]" lists:** People to reach out to when traveling
- **Reconnection attempts:** Track when you reached out after long gaps

### Advanced: Self-Awareness

- **Social energy tracking:** How much social time did you have this week? Too much? Too little?
- **Introvert/extrovert patterns:** See your natural social rhythms
- **Quality over quantity:** Your closest 5 vs your broader 20 -- where does your time actually go?
- **Relationship ROI:** Private reflection on which friendships bring joy vs which feel obligatory
- **Growth notes:** How has this friendship evolved over years?
- **Letting go:** Graceful tracking when friendships naturally end (archive, don't delete)

### Settings & Privacy

- **Most private module in the suite.** This data NEVER leaves the device under any circumstance.
- **No sync, no backup, no cloud.** Unless user explicitly exports.
- **No social features.** This is a JOURNAL about friends, not a friend network.
- **Biometric lock option:** Additional Face ID/fingerprint to open this module specifically
- **Export:** JSON/CSV, but with explicit "are you sure?" confirmation
- **No contact book integration by default.** User manually adds people (prevents accidental exposure)
- **Delete person:** Full wipe of all associated data, irreversible, with confirmation

---

## Data Model

```
fn_people
  id, display_name, photo_local_uri, relationship_type,
  how_met, where_met, when_met, birthday, anniversary,
  city, contact_info (json encrypted), quick_facts (json),
  interests (json), communication_preference,
  energy_tag (energizing|neutral|draining|complicated),
  frequency_goal_days, is_archived, notes_md,
  created_at, updated_at

fn_circles
  id, name, description, icon, color, member_ids (json),
  created_at, updated_at

fn_hangouts
  id, people_ids (json), happened_at, duration_minutes,
  location_name, location_lat, location_lng,
  activity_tags (json), quality_rating,
  notes_md, photo_ids (json), group_id,
  linked_dining_visit_id, linked_concert_id, linked_trail_id,
  created_at

fn_gifts
  id, person_id, direction (given|received), description,
  occasion, amount_cents, date, reaction_notes,
  photo_id, link_url, created_at

fn_gift_ideas
  id, person_id, description, estimated_price_cents,
  priority, source_note, link_url, is_purchased,
  created_at, updated_at

fn_memories
  id, person_ids (json), circle_id, title, description_md,
  happened_at, photo_ids (json), voice_memo_id,
  tags (json), is_inside_joke, created_at

fn_life_events
  id, person_id, type (move|job|baby|engaged|married|graduated|other),
  description, happened_at, acknowledged, notes_md, created_at

fn_nudges
  id, person_id, type (havent_seen|birthday_coming|anniversary),
  triggered_at, dismissed, snoozed_until, acted_on, created_at

fn_photos
  id, hangout_id, memory_id, person_id,
  local_uri, caption, taken_at, created_at

fn_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | People manager: add, circles, quick facts, relationship types | 2-3 |
| P2 | Hangout logger: log, notes, photos, frequency tracking | 2 |
| P3 | Birthday + gift tracking: reminders, ideas, past gifts | 1-2 |
| P4 | Relationship health: last-seen, nudges, frequency goals, drift | 2 |
| P5 | Shared memories: collections, inside jokes, timeline | 1-2 |
| P6 | Self-awareness: social energy, patterns, quality metrics | 1-2 |
| P7 | Cross-module integration (dining, music, trails, RSVP, mood, journal) | 2-3 |
| P8 | Life chapters: transitions, distance, reconnection | 1-2 |
| **Total P0-P8** | | **~14-18 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Dining** | Companions from dining visits auto-populate hangout suggestions |
| **Music** | Concert companions linked here; "Who introduced me to this artist?" |
| **RSVP** | Event attendees linked to people; group event planning |
| **Mood** | Social correlation: mood on days you saw friends vs alone |
| **Budget** | Gift spending tracked per person; social spending category |
| **Trails** | Hiking/travel companions; "People I've traveled with" |
| **Journal** | "Write about this friendship" one-tap from person profile |
| **Calendar** | Birthdays, planned hangouts, anniversary reminders |
| **Gaming** | Gaming buddies, co-op sessions tracked per friend |
| **Workouts** | Gym buddies, running partners, sports teammates |

---

## Business Flywheel

**None needed.** This module's value is as a hub-gravity module that makes every other module stickier. It's the connective tissue. Users who track who they do things WITH are dramatically more likely to keep using all the modules those activities belong to.

If a business angle ever emerges, it would be: wedding planning SaaS (guest management, seating, RSVPs) which naturally extends from the people + events + gift tracking data model. But this is speculative Year 4+ at earliest.

---

## Competitor Analysis

| "Competitor" | What It Does | What It Misses |
|-------------|-------------|----------------|
| Phone contacts | Store phone numbers | No relationship tracking, no context, no memories |
| Facebook | Social graph | Public, ad-driven, dying with youth, no private reflection |
| Instagram Close Friends | Restricted posting | Still broadcast; no tracking, no memories |
| Dex (personal CRM) | Contact management | $6/mo, professional-feeling, no emotional/memory layer |
| Monica CRM (open source) | Personal CRM | Self-hosted, complex, no mobile, no emotional layer |
| Locket | Photo sharing to home screen | One feature only; no tracking, no CRM, no memories |
| Covve | Contact management | Professional-focused, networking-oriented |

**None of these are:** a private emotional journal about your relationships + activity tracker + memory keeper + gift planner + birthday manager in one module.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Users feel weird "tracking" friends | High | Frame as "remembering" not "tracking." Emphasis on memories and never-forget, not metrics. |
| Data is extremely sensitive if leaked | Catastrophic | Device-only storage, optional biometric lock, strongest encryption in the suite |
| "Just use my calendar/contacts" objection | Medium | Calendar has no context, no memories, no feelings, no gifts, no inside jokes |
| Low engagement if user has few friends | Medium | Module works with even 3-5 people. Quality of depth, not breadth. |
| Ethically complex (energy tags, quality ratings) | Medium | Optional fields, never prompted aggressively, explicitly framed as self-awareness not judgment |

---

## Open Questions (Founder Input Needed)

1. **Free or Pro?** Strong argument for FREE as teen acquisition hook. A 14-year-old who downloads for free MyFriends and discovers 30+ other modules is the growth loop. Counter-argument: this is a premium emotional feature that people would pay for.
2. **Module accent color?** Suggestions: Warm pink #EC4899 (relationships), soft violet #A78BFA (personal/intimate), coral #F97316 (warm/friendly)
3. **Contact book integration?** Option A: Never touch the contact book (maximum privacy). Option B: Optional one-time import of names + birthdays only. Recommend A.
4. **"Energy tag" ethical framing?** Include it (powerful self-awareness) or exclude it (could feel judgmental)? Recommend include but make it deeply optional and hidden by default.
5. **Biometric lock at module level?** This is uniquely sensitive. Should this module have an extra authentication layer beyond the app? Recommend yes.
6. **Partner/dating sub-feature?** Include dating/relationship tracking (date log, anniversary, love languages) or keep that for a separate module? Recommend include as a "relationship type" with special fields.

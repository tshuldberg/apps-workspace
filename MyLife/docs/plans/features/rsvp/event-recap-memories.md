# Feature Spec: RSVP Event Recap/Memories

## Metadata
- **Module:** rsvp
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Photo albums (built, rv_photos), RSVP system (built), event analytics (built)
- **Blocks:** none

## Business Context

### Why This Feature Exists
After an event ends, the magic fades quickly. Photos scatter across group chats, attendee lists are forgotten, and the fun moments dissolve into memory. Partiful is the only event platform that generates post-event recap pages, and it is their most beloved retention feature -- users return to the app weeks later to revisit event memories. By generating a recap with photos, stats, and highlights, MyRSVP creates a reason to keep the app installed and builds emotional attachment.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | Auto-generated recap page with photo grid, attendee count, poll results, fun stats |
| Evite | No | N/A | Event history exists but no generated recap |
| RSVPify | No | N/A | Event reports for analytics, not a guest-facing recap |
| Apple Photos | Yes (Memories) | Free | AI-generated slideshows from photo library (different context) |

### Target User
Hosts and guests who want to look back on events they attended. The host benefits from seeing engagement stats (who came, response rate, popular poll answers). Guests benefit from a shared photo gallery and a warm "remember this?" moment. Particularly valuable for milestone events (birthdays, weddings, graduations).

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engines/recap.ts               -- Pure functions: recap generation, stat calculation
modules/rsvp/src/types.ts                       -- EventRecap, RecapStat, RecapHighlight types
modules/rsvp/src/db/crud.ts                     -- getEventRecap() query helper
modules/rsvp/src/index.ts                       -- Re-export recap API
modules/rsvp/src/__tests__/recap.test.ts        -- Recap generation tests
apps/mobile/app/(rsvp)/recap.tsx                -- Mobile recap screen
apps/web/app/rsvp/[eventId]/recap/page.tsx      -- Web recap page
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Past Events list
                 └── Event Detail
                      └── "View Recap" button ← YOU ARE HERE
```

### Data Model

No new tables or migrations. The recap is generated on-the-fly from existing data: rv_events, rv_rsvps, rv_photos, rv_polls, rv_poll_votes, rv_comments, rv_expenses. No storage needed -- the recap engine reads and computes.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (recap card components, Cool Obsidian tokens)
- **External:** None (all data is local)
- **Cross-Module:** MyJournal -- when both modules enabled, offer "Save to Journal" button that creates a journal entry from the recap. Uses `@mylife/module-registry` to check if journal module is enabled.

## Functional Requirements

### User Stories
1. As a host, I want to see a recap page for past events showing photos, stats, and highlights.
2. As a guest, I want to view the event recap to see shared photos and remember the event.
3. As a host, I want to share the recap as a summary image or link.

### Behavior Specification

**Recap generation:**
1. Event's start_at is in the past
2. "View Recap" button appears on event detail page (replaces "RSVP" section for past events)
3. User taps "View Recap"
4. System generates the recap by querying:
   - Attendee stats from rv_rsvps (going count, maybe count, plus-ones, check-ins)
   - Photos from rv_photos (ordered by created_at)
   - Top poll results from rv_polls + rv_poll_votes (winning option + vote count)
   - Comment count from rv_comments
   - Expense total from rv_expenses (if expense splitting was used)
5. Recap page displays sections in order:

**Recap sections:**
1. **Hero section:** Event title, date, location, duration (end - start), design theme (if set)
2. **Attendees:** "X attended (Y plus-ones)" with a horizontal scroll of guest avatars (initials)
3. **Photo gallery:** Grid of event photos (max 20 in gallery, "View all" link). First 4 photos in a 2x2 featured grid.
4. **Highlights:** Auto-generated stat cards:
   - "Most popular poll answer: [option] ([N] votes)" -- if polls exist
   - "First to RSVP: [name]" -- earliest responded_at
   - "Total cost: $[X] ($[Y]/person)" -- if expenses exist
   - "Check-in rate: [X]%" -- if check-ins used
   - "[N] comments in the feed" -- if comments exist
5. **Fun stats:** Engagement metrics:
   - Response rate: "[X]% of invited guests responded"
   - Average response time: "[N] hours after invite"
6. **Footer:** "Created with MyRSVP" + share button

**Share recap:**
1. User taps share icon on recap
2. System generates a summary card image (Open Graph-style): event title, date, attendee count, 1 photo
3. On mobile: native share sheet with the image
4. On web: copy link to recap page

### Edge Cases
- **Event with no photos:** Photo gallery section hidden. Recap still shows stats.
- **Event with no RSVPs:** Show "No one responded yet" in attendee section. Minimal recap.
- **Event with no polls, no expenses, no comments:** Only show hero + attendees + response rate. Skip all "highlights" cards that have no data.
- **Future event:** "View Recap" button not shown. Only appears after event start_at passes.
- **Event in progress (between start and end):** Show "Event in progress" badge. Partial recap available.
- **Event with 100+ photos:** Gallery shows first 20, "View all [N] photos" link expands to full album.
- **No check-ins used:** Skip check-in rate stat.
- **Module disabled after event:** Recap data is preserved. Re-enabling module restores recaps.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "View Recap" button appears on past event detail pages
- [ ] **AC-2:** Recap shows hero section with event title, date, location, and duration
- [ ] **AC-3:** Attendee section shows going count + plus-ones with guest initial avatars
- [ ] **AC-4:** Photo gallery displays up to 20 photos in a grid with 2x2 featured layout
- [ ] **AC-5:** Highlights section shows auto-generated stat cards for available data
- [ ] **AC-6:** "First to RSVP" shows the earliest responder's name
- [ ] **AC-7:** Share button generates a summary card image
- [ ] **AC-8:** Recap sections are hidden when their data source is empty
- [ ] **AC-9:** "View all photos" link expands to full album

### Technical Criteria
- [ ] **TC-1:** Recap generation queries complete in <100ms for events with 50 guests
- [ ] **TC-2:** `generateRecap()` returns all sections with correct data from database
- [ ] **TC-3:** Duration calculated correctly from start_at and end_at (handles null end_at)
- [ ] **TC-4:** Response rate calculation handles zero invited guests (returns 0, not NaN)
- [ ] **TC-5:** No new database tables or migrations required

### Negative Criteria
- [ ] **NC-1:** Recap must NOT appear for future events
- [ ] **NC-2:** Recap must NOT store any computed data (regenerated each view)
- [ ] **NC-3:** Share image must NOT include guest contact information
- [ ] **NC-4:** Recap must NOT require network access (all data is local)

## UI Specification

### Mobile (Expo)
- **Background:** `#0A0A0F` with event design theme applied (if set)
- **Hero:** Full-width with event cover image/design, title in `heading` typography, date + location in `caption`
- **Attendee row:** Horizontal scroll of 40px circle avatars (initials, `#FB7185` background), overflow shows "+N more"
- **Photo grid:** 2x2 featured (first 4), then 3-column grid, glass card borders
- **Stat cards:** Glass cards with large stat number in `stat` typography, label in `caption`
- **Share button:** FAB at bottom-right with share icon

### Web (Next.js)
- Accessible at `/rsvp/[eventId]/recap`
- Wider layout: hero + 2-column below (photos left, stats right)
- Share generates Open Graph meta tags for link previews

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton recap sections | Initial data fetch |
| Full Recap | All sections with data | Past event with photos, RSVPs, etc. |
| Minimal Recap | Hero + attendees + response rate only | Past event with minimal engagement |
| No RSVPs | Hero + "No responses" message | Past event with zero RSVPs |
| In Progress | Partial recap with "Event in progress" badge | Event between start and end |
| Future Event | No "View Recap" button shown | Event hasn't started yet |

## Test Requirements

### Unit Tests (engines/recap.ts)
- [ ] `generateRecap`: returns hero section with correct title, date, location
- [ ] `generateRecap`: calculates duration from start_at and end_at
- [ ] `generateRecap`: defaults duration to 2 hours when end_at is null
- [ ] `generateRecap`: counts attendees correctly (going + checked-in)
- [ ] `generateRecap`: finds "First to RSVP" by earliest responded_at
- [ ] `generateRecap`: calculates response rate as percentage
- [ ] `generateRecap`: handles zero invites without NaN
- [ ] `generateRecap`: includes poll winner with correct vote count
- [ ] `generateRecap`: includes expense total in cents and per-person average
- [ ] `generateRecap`: omits sections with no data
- [ ] `isRecapAvailable`: returns true for past events
- [ ] `isRecapAvailable`: returns false for future events

### Integration Tests
- [ ] Full flow: create event with RSVPs + photos + polls -> generate recap -> verify all sections
- [ ] Minimal event: create event with only 1 RSVP -> verify minimal recap
- [ ] Empty event: create event with no RSVPs -> verify appropriate empty state

### QA Verification Script

1. Open MyRSVP, find a past event (or create one with a past date)
2. **Verify:** "View Recap" button visible on event detail -- AC-1
3. Add 3 RSVPs (going), 2 photos, 1 poll with votes, 1 expense
4. Tap "View Recap"
5. **Verify:** Hero shows event title, date, location -- AC-2
6. **Verify:** Attendees section shows "3 attended" with initial avatars -- AC-3
7. **Verify:** Photo gallery shows the 2 photos -- AC-4
8. **Verify:** Highlights show poll winner and expense total -- AC-5
9. **Verify:** "First to RSVP" shows correct guest name -- AC-6
10. Tap share button
11. **Verify:** Share sheet appears with summary card -- AC-7
12. Create a past event with no photos or polls
13. Tap "View Recap"
14. **Verify:** Only hero + attendees + response rate shown (no photo or highlights sections) -- AC-8
15. Check a future event
16. **Verify:** No "View Recap" button visible -- NC-1

## gstack Quality Gates

Based on Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate to recap page, verify all sections display correctly

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Past events show the same detail page as future events (RSVP button still visible)
- No recap generation, no post-event summary
- Photo albums exist but are not aggregated into a recap view
- Analytics exist but are host-only numbers, not a guest-facing recap

### After This Work
- Pure engine: `generateRecap()`, `isRecapAvailable()`, `getRecapStats()`, `getFirstResponder()`
- Recap screen on mobile and web with hero, attendees, photos, highlights, fun stats
- Share functionality generating summary card images
- Optional MyJournal cross-module "Save to Journal" button
- 12+ unit tests, 3+ integration tests

### Files Changed
- `modules/rsvp/src/engines/recap.ts` -- Recap generation and stat calculation
- `modules/rsvp/src/types.ts` -- EventRecap, RecapStat, RecapHighlight types
- `modules/rsvp/src/db/crud.ts` -- getEventRecap() query helper
- `modules/rsvp/src/index.ts` -- Re-export recap API
- `modules/rsvp/src/__tests__/recap.test.ts` -- Recap generation tests
- `apps/mobile/app/(rsvp)/recap.tsx` -- Mobile recap screen
- `apps/web/app/rsvp/[eventId]/recap/page.tsx` -- Web recap page

### Known Limitations
- Recap is generated on-the-fly (not cached). For events with 100+ photos, gallery loads progressively.
- No AI-generated narrative summary (future: "You hosted 3 hours of fun with 12 friends at...")
- No animated slideshow or video recap (just static page with sections)
- No "On This Day" notification for past events (future feature)
- Share card is a static image, not an interactive link (recipients see an image, not a live recap)

### Context for Next Agent
- No new migration needed. All data comes from existing tables.
- The `generateRecap()` function takes a `DatabaseAdapter` and `eventId`, queries all relevant tables, and returns an `EventRecap` object with sections. Each section is an optional field (null if no data).
- Duration calculation: `end_at ? (end_at - start_at) : 2 hours default`. Format as "Xh Ym".
- "First to RSVP" queries `rv_rsvps WHERE event_id = ? AND response IN ('going', 'maybe') ORDER BY responded_at ASC LIMIT 1`.
- Poll winner: for each poll, count votes per option, take the max. If tie, show all tied options.
- Expense total: `SUM(amount_cents) FROM rv_expenses WHERE event_id = ?`. Per-person: total / going_count.
- The share image should be 1200x630px (Open Graph standard) with the event title, date, attendee count, and one photo thumbnail. Generate using Canvas API on web or a simple View-to-image on mobile.

# Feature Spec: RSVP Calendar Sync (iCal Export)

## Metadata
- **Module:** rsvp
- **Priority Score:** 37 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 5 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (rv_events already has title, start_at, end_at, timezone, location_name, location_address, description)
- **Blocks:** Recurring events (needs RRULE support in .ics generation)
- **Prior Art:** Sprint 1 spec exists at `docs/plans/features/sprint-1/rsvp-calendar-sync.md`

## Business Context

### Why This Feature Exists
Calendar sync is the #1 P0 gap in the RSVP module and the highest-scoring RSVP feature (37/50). Without it, users must manually copy event details into their phone calendar. Events get missed, times get wrong, and users stop trusting MyRSVP as their primary event tool. Every competitor (Partiful, Evite, RSVPify) offers this. Switching scored 5/5 because adoption of MyRSVP is blocked without calendar integration.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | "Add to Calendar" button on event page, Google Calendar deep link, .ics download |
| Evite | Yes | Free | .ics download, Google/Outlook/Apple Calendar links, auto-sync for premium |
| RSVPify | Yes | Free | .ics export, Google Calendar API integration, Outlook add-in |
| Invyt | No | N/A | No calendar sync |

### Target User
Social hosts (25-40, 4-10 events/year) and their guests who rely on phone calendars for scheduling. Partiful users (free tier) and Evite users ($14.99/event premium) who expect one-tap calendar integration. Without this, guests who RSVP "going" still miss the event because it never made it to their calendar.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engine/ical.ts          -- Pure .ics generation (RFC 5545)
modules/rsvp/src/engine/calendar.ts      -- Device calendar sync via expo-calendar
modules/rsvp/src/types.ts                -- CalendarExportFormat, ICalEvent types
modules/rsvp/src/db/crud.ts              -- Add calendar_event_id tracking to rv_events (V2)
modules/rsvp/src/db/schema.ts            -- V2 migration: calendar_event_id column
modules/rsvp/src/definition.ts           -- Add RSVP_MIGRATION_V2
modules/rsvp/src/index.ts                -- Re-export calendar/ical API
modules/rsvp/src/__tests__/ical.test.ts  -- .ics generation tests
apps/mobile/app/(rsvp)/components/AddToCalendarButton.tsx  -- Mobile button
apps/web/app/rsvp/[eventId]/components/AddToCalendarButton.tsx  -- Web button
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── "Add to Calendar" button ← YOU ARE HERE
```

### Data Model

```sql
-- V2 Migration: Add calendar sync tracking
ALTER TABLE rv_events ADD COLUMN calendar_event_id TEXT;
```

No new tables. The `calendar_event_id` column stores the device calendar event identifier for detecting and updating existing synced events. The .ics file is generated on-the-fly and not stored.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (button components, Cool Obsidian tokens)
- **External:** `expo-calendar` (device calendar read/write on mobile), no external APIs
- **Cross-Module:** None directly. Future: could sync with MyHabits for recurring social commitments.

## Functional Requirements

### User Stories
1. As an event host, I want a one-tap "Add to Calendar" button that creates a device calendar event with all event details pre-filled.
2. As a guest, I want to download a .ics file from the event detail so I can import it into any calendar app.
3. As a host who updates event details, I want the calendar event to update automatically if I already synced it.
4. As a web user, I want "Add to Google Calendar" and "Download .ics" links since web cannot write to device calendars directly.

### Behavior Specification

**Mobile "Add to Calendar":**
1. User views an event detail screen
2. User taps "Add to Calendar" button
3. System requests calendar permission if not granted (expo-calendar)
4. System generates an iCal-compatible event object: title, start/end, timezone, location (name + address), description, organizer
5. System checks if `calendar_event_id` exists for this event
6. If no existing sync: creates a new device calendar event, stores the returned ID in `calendar_event_id`
7. If existing sync: updates the device calendar event with current details
8. Toast: "Event added to your calendar" (or "Calendar updated")
9. Button changes to "Update Calendar" state with a checkmark

**Web "Add to Calendar":**
1. User views event detail on web
2. User sees two options: "Add to Google Calendar" (deep link) and "Download .ics"
3. "Add to Google Calendar" opens a pre-filled Google Calendar URL in a new tab
4. "Download .ics" generates and downloads a .ics file

**.ics File Generation (RFC 5545):**
1. Generate VCALENDAR with VEVENT
2. Include: DTSTART, DTEND (with TZID), SUMMARY, DESCRIPTION, LOCATION, UID (event ID), DTSTAMP, ORGANIZER
3. If no end_at on event, default to start_at + 2 hours
4. Escape special characters per RFC 5545 (commas, semicolons, backslashes, newlines)
5. Line folding at 75 octets per spec

**Google Calendar URL Generation:**
1. Build URL: `https://calendar.google.com/calendar/r/eventedit?text={title}&dates={start}/{end}&location={location}&details={description}`
2. Start/end in UTC format: `YYYYMMDDTHHMMSSZ`
3. URL-encode all parameters

### Edge Cases
- **No end_at set:** Default duration to 2 hours after start_at
- **Calendar permission denied (mobile):** Show toast "Calendar access required. Enable in Settings." with a deep link to app settings
- **Event already synced, then deleted from device calendar:** Re-create the event (calendar_event_id may be stale). Clear stored ID and create fresh
- **Timezone edge cases:** Always include TZID in .ics. For Google Calendar URL, convert to UTC
- **Very long description (>2000 chars):** Truncate to 2000 chars with "..." for Google Calendar URL (URL length limits). Full description in .ics
- **Special characters in title/location:** Escape per RFC 5545 for .ics; URL-encode for Google Calendar
- **Past events:** Still allow calendar export (some users add past events for record-keeping)
- **Event with no location:** Omit LOCATION field from .ics; omit location param from Google URL
- **Module disabled after sync:** Device calendar event remains. Re-enabling does not auto-delete or re-sync

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Add to Calendar" button appears on event detail screen (mobile and web)
- [ ] **AC-2:** Tapping the button on mobile creates a device calendar event with correct title, time, timezone, location, and description
- [ ] **AC-3:** Subsequent taps update the existing calendar event rather than creating a duplicate
- [ ] **AC-4:** Web shows "Add to Google Calendar" link that opens pre-filled Google Calendar in new tab
- [ ] **AC-5:** Web shows "Download .ics" that downloads a valid RFC 5545 .ics file
- [ ] **AC-6:** Downloaded .ics file imports correctly into Apple Calendar, Google Calendar, and Outlook
- [ ] **AC-7:** Button shows checkmark/"Update Calendar" state after first sync
- [ ] **AC-8:** Toast confirms "Event added to your calendar" on success

### Technical Criteria
- [ ] **TC-1:** .ics output conforms to RFC 5545 (VCALENDAR, VEVENT, proper line folding at 75 octets)
- [ ] **TC-2:** .ics includes DTSTART/DTEND with TZID, SUMMARY, DESCRIPTION, LOCATION, UID, DTSTAMP
- [ ] **TC-3:** Special characters (commas, semicolons, backslashes, newlines) are escaped in .ics
- [ ] **TC-4:** Google Calendar URL correctly encodes all parameters and uses UTC date format
- [ ] **TC-5:** V2 migration adds `calendar_event_id` column to `rv_events`
- [ ] **TC-6:** calendar_event_id is populated after first sync and used for updates on subsequent syncs
- [ ] **TC-7:** Events without end_at default to start_at + 2 hours in both .ics and Google Calendar URL

### Negative Criteria
- [ ] **NC-1:** Calendar sync must NOT create duplicate device events on repeated taps
- [ ] **NC-2:** Calendar permission denial must NOT crash the app or block other features
- [ ] **NC-3:** .ics generation must NOT include any data beyond the single event (no guest lists, no RSVP data)
- [ ] **NC-4:** Calendar sync must NOT send any data to external servers (local device calendar only)

## UI Specification

### Mobile (Expo)
- **Button:** Glass card style with calendar icon (Feather: `calendar-plus`), module accent `#FB7185`
- **Synced state:** Green checkmark icon, label changes to "Update Calendar", border `#30D158`
- **Permission prompt:** System dialog from expo-calendar, then toast if denied
- **Position:** Below event description, above RSVP section

### Web (Next.js)
- **Two buttons side by side:** "Add to Google Calendar" (Google icon) and "Download .ics" (download icon)
- **Glass card background:** `rgba(255,255,255,0.04)` with `rgba(255,255,255,0.10)` border
- **Buttons use module accent `#FB7185` for hover state

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Default | "Add to Calendar" button with calendar icon | Event not yet synced |
| Synced | "Update Calendar" with green checkmark | calendar_event_id exists |
| Loading | Button disabled with spinner | Sync in progress |
| Error | Toast with error message, button remains in default state | Calendar write fails |
| Permission Denied | Toast with "Enable in Settings" link | User denies calendar permission |

## Test Requirements

### Unit Tests (engine/ical.ts)
- [ ] Generates valid VCALENDAR wrapper with VERSION:2.0 and PRODID
- [ ] Generates VEVENT with correct DTSTART/DTEND and TZID
- [ ] Defaults to 2-hour duration when end_at is null
- [ ] Escapes commas, semicolons, backslashes in SUMMARY and DESCRIPTION
- [ ] Escapes newlines as `\n` in DESCRIPTION
- [ ] Folds lines at 75 octets per RFC 5545
- [ ] Includes UID matching event ID
- [ ] Omits LOCATION when location is null
- [ ] Generates correct Google Calendar URL with UTC dates
- [ ] URL-encodes special characters in Google Calendar URL
- [ ] Truncates description to 2000 chars for Google Calendar URL
- [ ] Handles empty description gracefully

### Integration Tests
- [ ] Full flow: create event -> generate .ics -> parse with ical library -> verify fields match
- [ ] V2 migration runs cleanly on existing V1 database
- [ ] calendar_event_id persists after sync and is used for update

### QA Verification Script

1. Open MyRSVP on mobile
2. Navigate to an existing event (or create one: "Birthday Dinner", 7 PM - 10 PM, timezone PST, location "123 Main St")
3. **Verify:** "Add to Calendar" button visible below event details -- AC-1
4. Tap "Add to Calendar"
5. Grant calendar permission if prompted
6. **Verify:** Toast "Event added to your calendar" appears -- AC-8
7. **Verify:** Button shows checkmark and says "Update Calendar" -- AC-7
8. Open device Calendar app
9. **Verify:** Event appears with correct title, time, timezone, and location -- AC-2
10. Return to MyRSVP, edit event title to "Birthday Dinner (Updated)"
11. Tap "Update Calendar"
12. **Verify:** Device calendar shows updated title, no duplicate event -- AC-3, NC-1
13. Open MyRSVP on web
14. Navigate to the same event
15. **Verify:** "Add to Google Calendar" and "Download .ics" buttons visible -- AC-1, AC-4, AC-5
16. Click "Add to Google Calendar"
17. **Verify:** Google Calendar opens in new tab with pre-filled event details -- AC-4
18. Click "Download .ics"
19. **Verify:** File downloads with .ics extension -- AC-5
20. Import .ics file into Apple Calendar
21. **Verify:** Event imports with correct details -- AC-6
22. Create an event with no end time and no location
23. Export as .ics
24. **Verify:** Duration defaults to 2 hours, no LOCATION field in .ics -- TC-7

## gstack Quality Gates

Based on Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to event detail, click "Add to Calendar", verify all states

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- rv_events table has title, start_at, end_at, timezone, location_name, location_address, description
- No calendar sync capability, no .ics generation, no Google Calendar links
- No calendar_event_id tracking
- QuestionTypeSchema already includes 'dietary' but no calendar types

### After This Work
- V2 migration adds `calendar_event_id` to rv_events
- Pure engine functions: `generateICalString()`, `generateGoogleCalendarUrl()`, `parseICalString()` (for import)
- Mobile: expo-calendar integration with permission handling and event create/update
- Web: Google Calendar deep link and .ics download
- 12+ tests covering RFC 5545 compliance and edge cases

### Files Changed
- `modules/rsvp/src/engine/ical.ts` -- .ics generation and Google Calendar URL builder
- `modules/rsvp/src/engine/calendar.ts` -- Device calendar sync (expo-calendar wrapper)
- `modules/rsvp/src/types.ts` -- CalendarExportFormat type, ICalEvent interface
- `modules/rsvp/src/db/schema.ts` -- V2 migration DDL
- `modules/rsvp/src/db/crud.ts` -- calendar_event_id read/write
- `modules/rsvp/src/definition.ts` -- Add RSVP_MIGRATION_V2
- `modules/rsvp/src/index.ts` -- Re-export calendar/ical API
- `modules/rsvp/src/__tests__/ical.test.ts` -- RFC 5545 compliance tests
- `apps/mobile/app/(rsvp)/components/AddToCalendarButton.tsx` -- Mobile button
- `apps/web/app/rsvp/[eventId]/components/AddToCalendarButton.tsx` -- Web button

### Known Limitations
- No Outlook Calendar deep link (only Google Calendar and .ics download on web)
- No automatic sync when event details change (user must tap "Update Calendar" manually)
- No RRULE support for recurring events (future feature dependency)
- .ics import (parsing inbound .ics files) is not in scope for this feature
- No push notification to remind guests to add to calendar

### Context for Next Agent
- The existing `rv_events.timezone` defaults to `'UTC'`. The .ics generator must handle both Olson timezone IDs (e.g., `America/Los_Angeles`) and the UTC default. Use TZID in DTSTART/DTEND for non-UTC timezones.
- Google Calendar URL requires UTC format (`YYYYMMDDTHHMMSSZ`). Convert from the event's timezone before building the URL.
- `expo-calendar` requires the `CALENDAR` permission on iOS and `READ_CALENDAR`/`WRITE_CALENDAR` on Android. Request at tap time, not at app launch.
- Line folding in RFC 5545: fold at 75 octets (not characters) using CRLF + space continuation. Be careful with multi-byte UTF-8 characters.

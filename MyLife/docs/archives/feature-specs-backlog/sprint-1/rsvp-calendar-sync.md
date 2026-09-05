# Feature Spec: RSVP Calendar Sync (iCal Export/Import)

## Metadata
- **Module:** rsvp
- **Priority Score:** 37 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 5 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 1
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (rv_events table already has all required fields: title, start_at, end_at, timezone, location_name, location_address, description)
- **Blocks:** recurring events (A-tier, needs RRULE support in .ics generation)

## Business Context

### Why This Feature Exists
Calendar sync is the #1 P0 gap in the RSVP module and the single highest-scoring RSVP feature in the backlog (37/50). Event platforms without calendar integration force users to manually copy event details into their phone calendar, which means events get missed, times get wrong, and users stop trusting the app as their source of truth. Every serious competitor offers this, and Switching scored 5/5 because users literally cannot adopt MyRSVP as their primary event tool without it.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Partiful | Yes | Free | "Add to Calendar" button on event page, generates .ics download + Google Calendar deep link |
| Evite | Yes | Free | .ics download + Apple Calendar / Google Calendar / Outlook links |
| RSVPify | Yes | Free tier | Full iCal feed URL per event, .ics export, Google Calendar integration |
| Invyt | Yes | Free | Basic .ics download on event detail page |

### Target User
Event organizers who currently use Partiful (500K MAU, free) or Evite for social gatherings and want a privacy-first alternative. Calendar sync is table stakes: without it, guests must screenshot event details or manually type them into their phone calendar, which is the #1 friction point that causes no-shows.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/calendar/           -- iCal generation and parsing
  ics-generator.ts                   -- RFC 5545 .ics file builder
  ics-parser.ts                      -- Parse .ics files into event data
  index.ts                           -- Barrel export
modules/rsvp/src/calendar/__tests__/ -- Unit tests
  ics-generator.test.ts
  ics-parser.test.ts
modules/rsvp/src/db/crud.ts         -- Add getCalendarSyncStatus, markCalendarSynced
modules/rsvp/src/types.ts           -- Add CalendarExport, IcsEvent types
modules/rsvp/src/index.ts           -- Export new functions
apps/mobile/app/(rsvp)/components/AddToCalendarSheet.tsx  -- Bottom sheet with calendar options
apps/web/app/rsvp/actions.ts        -- Add exportEventIcs, importEventIcs actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail screen
                 └── "Add to Calendar" button ← YOU ARE HERE
                 └── Share sheet includes .ics attachment
```

The "Add to Calendar" button appears on the event detail screen, below the event date/time and location. On mobile, it opens a bottom sheet with options: "Add to Device Calendar", "Download .ics", "Copy Google Calendar Link". On web, it offers .ics download and a Google Calendar link.

### Data Model

No new tables needed. The `rv_events` table already contains all fields required for iCal generation: `title`, `description`, `start_at`, `end_at`, `timezone`, `location_name`, `location_address`.

One new column tracks whether an event has been synced to the device calendar:

```sql
-- V2 migration: add calendar sync tracking
ALTER TABLE rv_events ADD COLUMN calendar_event_id TEXT DEFAULT NULL;
ALTER TABLE rv_events ADD COLUMN calendar_synced_at TEXT DEFAULT NULL;
```

`calendar_event_id` stores the native calendar event ID returned by `expo-calendar` so the app can update or remove the event later. `calendar_synced_at` records when the sync happened.

### Dependencies
- **Internal:** `@mylife/rsvp` (event CRUD, types), `@mylife/ui` (Cool Obsidian tokens)
- **External:**
  - `expo-calendar` (mobile: read/write device calendar events)
  - `expo-sharing` (mobile: share .ics file via system share sheet)
  - `expo-file-system` (mobile: write .ics temp file for sharing)
  - No external libraries for .ics generation (RFC 5545 is simple enough to implement inline)
- **Cross-Module:** Future integration with Health module's wellness timeline (events as calendar context for mood/stress patterns). Calendar sync also enables the habits module to schedule reminders around event times.

## Functional Requirements

### User Stories
1. As an event organizer, I want to export an event as an .ics file so that I can share it with guests who use any calendar app.
2. As an event guest, I want to tap "Add to Calendar" so that the event appears in my phone's calendar app with the correct date, time, and location.
3. As an event organizer, I want to import a .ics file to create an RSVP event so that I can manage RSVPs for events originally created in other tools.
4. As an event guest, I want the calendar event to update automatically if the organizer changes the event details so that my calendar always reflects the latest info.
5. As a web user, I want to download an .ics file so that I can open it in any desktop calendar application.

### Behavior Specification

**Export: .ics file generation**
1. User opens an event detail screen
2. User taps "Add to Calendar" button (calendar icon)
3. Bottom sheet appears with three options:
   a. "Add to Device Calendar" (mobile only)
   b. "Download .ics File"
   c. "Copy Google Calendar Link"
4. For option (a): system requests calendar permission if not granted, then creates a calendar event using `expo-calendar` with title, startDate, endDate, timeZone, location, notes. Stores returned event ID in `rv_events.calendar_event_id`
5. For option (b): generates RFC 5545 .ics content, writes to temp file, opens system share sheet (mobile) or triggers browser download (web)
6. For option (c): constructs a Google Calendar URL with pre-filled parameters, copies to clipboard with toast confirmation

**Import: .ics file parsing**
1. User taps "Import from Calendar" on the events list screen
2. System presents file picker (DocumentPicker on mobile, `<input type="file">` on web)
3. User selects a .ics file
4. System parses the file, extracts VEVENT components
5. For each VEVENT, pre-fills the event creation form with: title (SUMMARY), description (DESCRIPTION), start (DTSTART), end (DTEND), timezone (TZID), location (LOCATION)
6. User reviews and confirms to create the event
7. If multiple VEVENTs exist in the file, each is shown as a separate card for individual import

**Sync: update existing calendar event**
1. When an event organizer edits event details (title, date, time, location)
2. If `calendar_event_id` is set for this event, the system updates the device calendar event
3. The update happens silently in the background after the event save
4. `calendar_synced_at` is updated to the current timestamp

**Google Calendar link format:**
```
https://calendar.google.com/calendar/event?action=TEMPLATE
  &text={title}
  &dates={startISO}/{endISO}        (YYYYMMDDTHHmmssZ format)
  &details={description}
  &location={location_name, location_address}
```

### Edge Cases

- **No calendar permission (mobile):** Show system permission dialog. If denied, show a message: "Calendar access is needed to add events. You can grant permission in Settings." with a link to app settings.
- **Event has no end time:** Default to start_at + 1 hour for .ics DTEND and calendar event.
- **Event has no timezone:** Default to device timezone, include in .ics as VTIMEZONE.
- **Location missing:** Omit LOCATION field from .ics (valid per RFC 5545). Calendar event still creates without location.
- **Very long description:** Truncate to 2000 characters in .ics DESCRIPTION with "..." suffix. Full description available in the app.
- **Import file with no VEVENTs:** Show error: "No events found in this file."
- **Import file with invalid format:** Show error: "Could not read this file. Make sure it's a valid .ics calendar file."
- **Import file with unsupported RRULE (recurring):** Import the first occurrence only with a note: "Recurring events are not yet supported. The first occurrence was imported."
- **Calendar event already synced (duplicate add):** Detect via `calendar_event_id`, update the existing event instead of creating a duplicate.
- **Event deleted after calendar sync:** The device calendar event persists (user can delete it manually). The app does not reach into the calendar to delete events.
- **Module disabled after sync:** Calendar events persist independently. Re-enabling the module does not re-sync.
- **Offline:** .ics generation works offline (no network needed). Google Calendar link requires paste into browser. Device calendar sync works offline.
- **Special characters in title/description:** Escape per RFC 5545 (backslash-escape commas, semicolons, newlines).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "Add to Calendar" on an event detail screen opens a bottom sheet with calendar options
- [ ] **AC-2:** "Add to Device Calendar" creates a calendar event with correct title, start time, end time, timezone, location, and description
- [ ] **AC-3:** After adding to device calendar, a success toast shows "Added to calendar"
- [ ] **AC-4:** "Download .ics File" generates a valid RFC 5545 file that opens correctly in Apple Calendar, Google Calendar, and Outlook
- [ ] **AC-5:** "Copy Google Calendar Link" copies a pre-filled URL to clipboard with toast confirmation
- [ ] **AC-6:** Importing a .ics file pre-fills the event creation form with extracted data
- [ ] **AC-7:** When an event's date/time/location is edited and a calendar_event_id exists, the device calendar event is updated automatically
- [ ] **AC-8:** If calendar permission is denied, the user sees a clear message with a link to Settings
- [ ] **AC-9:** Events without an end time export with a 1-hour default duration
- [ ] **AC-10:** On web, "Download .ics" triggers a browser file download with filename "{event-title}.ics"
- [ ] **AC-11:** Importing a file with multiple VEVENTs shows each as a separate importable card

### Technical Criteria
- [ ] **TC-1:** Generated .ics files are valid RFC 5545 with VCALENDAR, VEVENT, PRODID, VERSION, UID, DTSTAMP, DTSTART, DTEND, SUMMARY fields
- [ ] **TC-2:** .ics DTSTART/DTEND use the event's timezone (TZID parameter) or UTC if none
- [ ] **TC-3:** Special characters (commas, semicolons, newlines, backslashes) are escaped per RFC 5545 section 3.3.11
- [ ] **TC-4:** calendar_event_id persists in rv_events and survives app restart
- [ ] **TC-5:** V2 migration adds calendar_event_id and calendar_synced_at columns without data loss
- [ ] **TC-6:** .ics parser handles CRLF and LF line endings
- [ ] **TC-7:** .ics parser handles folded lines (continuation lines starting with space/tab per RFC 5545 section 3.1)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Calendar sync must NOT create duplicate events when tapped multiple times (must upsert via calendar_event_id)
- [ ] **NC-2:** Deleting an event in MyRSVP must NOT delete the device calendar event (they are independent after creation)
- [ ] **NC-3:** .ics export must NOT include guest contact information (privacy: only event details, not attendee emails/phones)
- [ ] **NC-4:** Calendar permission request must NOT block the .ics download or Google Calendar link options
- [ ] **NC-5:** Import must NOT auto-create events without user confirmation (always show preview first)
- [ ] **NC-6:** .ics files must NOT contain MyLife telemetry, tracking pixels, or analytics URLs

## UI Specification

### Mobile (Expo)

**"Add to Calendar" button (event detail screen):**
- Position: below date/time section, above attendee list
- Style: outlined button, `borderRadius: 12`, border `1px solid rgba(251,113,133,0.3)`, icon `calendar-plus`
- Text: "Add to Calendar", color `#FB7185` (rsvp accent)

**AddToCalendarSheet (bottom sheet, slides up):**
- Background: `rgba(18, 18, 26, 0.95)` with `backdrop-filter: blur(20px)`
- Header: "Add to Calendar" with close X button
- Three option rows, each with icon + label + chevron:
  1. Calendar icon + "Add to Device Calendar" + description "Creates an event in your phone's calendar"
  2. Download icon + "Download .ics File" + description "Share with any calendar app"
  3. Link icon + "Copy Google Calendar Link" + description "Open in Google Calendar"
- Each row: `padding: 16`, `borderRadius: 12`, `backgroundColor: rgba(255,255,255,0.04)`, tap highlight

**Import button (events list screen):**
- Secondary button in header: "Import" with file-plus icon
- Opens system document picker filtered to `.ics` files

**Import preview (after file selected):**
- Card per VEVENT showing: title, date/time, location
- "Import" button per card, or "Import All" if multiple events
- Each card: `backgroundColor: #12121A`, `border: 1px solid rgba(255,255,255,0.06)`, `borderRadius: 16`

### Web (Next.js)

- "Add to Calendar" button on event detail page, same outlined style
- Click opens a dropdown (not bottom sheet) with two options: "Download .ics" and "Google Calendar"
- .ics download: creates Blob, triggers `URL.createObjectURL` + anchor click download
- Import: `<input type="file" accept=".ics,.ical">` with drag-and-drop zone
- Route: integrated into existing `/rsvp` event detail view (no separate page)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Calendar permission being checked (mobile) | User taps "Add to Device Calendar" |
| Empty | No events to export (disabled button) | Event list is empty |
| Error | "Calendar access denied" message with Settings link | Permission denied |
| Success | Toast: "Added to calendar" with checkmark | Calendar event created/updated |
| Partial | Import preview showing parseable events + warning for skipped items | .ics file with some invalid VEVENTs |

## Test Requirements

### Unit Tests
- [ ] `generateIcs(event)`: produces valid VCALENDAR with VEVENT block
- [ ] `generateIcs(event)`: includes PRODID, VERSION 2.0, UID, DTSTAMP
- [ ] `generateIcs(event)`: correctly formats DTSTART/DTEND with TZID
- [ ] `generateIcs(event)`: escapes commas, semicolons, newlines in SUMMARY and DESCRIPTION
- [ ] `generateIcs(event)`: defaults DTEND to DTSTART + 1 hour when end_at is null
- [ ] `generateIcs(event)`: omits LOCATION when location_name is null
- [ ] `generateIcs(event)`: includes LOCATION as "name, address" when both present
- [ ] `generateIcs(event)`: truncates DESCRIPTION at 2000 characters
- [ ] `parseIcs(content)`: extracts VEVENT fields into structured object
- [ ] `parseIcs(content)`: handles CRLF and LF line endings
- [ ] `parseIcs(content)`: unfolds continuation lines (leading space/tab)
- [ ] `parseIcs(content)`: returns empty array for file with no VEVENTs
- [ ] `parseIcs(content)`: returns empty array for invalid/non-ics content
- [ ] `parseIcs(content)`: handles multiple VEVENTs in one file
- [ ] `parseIcs(content)`: parses both UTC (Z suffix) and TZID date formats
- [ ] `buildGoogleCalendarUrl(event)`: produces valid URL with encoded parameters
- [ ] `buildGoogleCalendarUrl(event)`: formats dates as YYYYMMDDTHHmmssZ
- [ ] V2 migration: calendar_event_id and calendar_synced_at columns added successfully
- [ ] V2 migration: existing event data unaffected

### Integration Tests
- [ ] Full export flow: create event -> generate .ics -> parse the generated .ics -> verify round-trip fidelity
- [ ] Full import flow: parse .ics file -> pre-fill event data -> create event -> verify persisted fields match
- [ ] Sync update flow: add to calendar -> update event title -> verify calendar_synced_at updated

### QA Verification Script

1. Open the app on iOS simulator or device
2. Navigate to MyRSVP via hub dashboard
3. Create an event with title "Birthday Bash", start date tomorrow at 7 PM, end date tomorrow at 11 PM, location "Central Park, New York", description "Bring your own cake!"
4. Open the event detail screen
5. Tap "Add to Calendar"
6. **Verify:** Bottom sheet appears with three options (AC-1)
7. Tap "Add to Device Calendar"
8. **Verify:** Calendar permission dialog appears (if first time)
9. Grant permission
10. **Verify:** Toast shows "Added to calendar" (AC-3)
11. Open the device Calendar app
12. **Verify:** "Birthday Bash" event exists on tomorrow's date at 7-11 PM with location "Central Park, New York" (AC-2)
13. Return to MyRSVP, tap "Add to Calendar" again
14. Tap "Download .ics File"
15. **Verify:** Share sheet or file save dialog appears with a .ics file
16. Save/share the file, open it in a calendar app
17. **Verify:** Event details are correct: title, date, time, location, description (AC-4)
18. Open the .ics file in a text editor
19. **Verify:** File contains BEGIN:VCALENDAR, VERSION:2.0, BEGIN:VEVENT, SUMMARY, DTSTART, DTEND, END:VEVENT, END:VCALENDAR (TC-1)
20. **Verify:** No guest contact info in the file (NC-3)
21. Return to MyRSVP, tap "Add to Calendar" again
22. Tap "Copy Google Calendar Link"
23. **Verify:** Toast shows "Link copied" (AC-5)
24. Paste the link in a browser
25. **Verify:** Google Calendar opens with pre-filled event details
26. Edit the event in MyRSVP: change title to "Birthday Bash 2026"
27. **Verify:** Device calendar event is updated with new title (AC-7)
28. Create a new event with no end time
29. Export as .ics
30. **Verify:** .ics file has DTEND set to start + 1 hour (AC-9)
31. Open web at /rsvp, navigate to the event detail
32. Click "Download .ics"
33. **Verify:** Browser downloads a file named "birthday-bash-2026.ics" (AC-10)
34. On the events list, tap "Import"
35. Select a .ics file containing 2 events
36. **Verify:** Two preview cards shown, each with import button (AC-6, AC-11)
37. Import one event
38. **Verify:** Event appears in the events list with correct details
39. Try importing a file with invalid content
40. **Verify:** Error message shown: "Could not read this file" (edge case)
41. Revoke calendar permission in device Settings
42. Tap "Add to Device Calendar"
43. **Verify:** Message shown with link to Settings (AC-8)
44. **Verify:** .ics download and Google Calendar link still work (NC-4)

## gstack Quality Gates

Based on this feature's complexity score (4 -- Small), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The RSVP module has a complete event management system with 13 tables, 46 CRUD functions, invites, RSVPs, polls, announcements, comments, photos, and CSV export. Events store title, start_at, end_at, timezone, location_name, location_address, and description. There is no calendar integration -- events exist only within MyRSVP. The schema is at V1.

### After This Work
- Events can be exported as RFC 5545 .ics files for any calendar app
- Events can be added directly to the device calendar via expo-calendar
- Events can be shared as Google Calendar links
- .ics files can be imported to create new RSVP events
- Editing a synced event auto-updates the device calendar entry
- V2 migration adds calendar_event_id and calendar_synced_at to rv_events
- Pure iCal generator/parser with no external dependencies

### Files Changed
- `modules/rsvp/src/calendar/ics-generator.ts` -- New: RFC 5545 .ics file generation
- `modules/rsvp/src/calendar/ics-parser.ts` -- New: .ics file parsing
- `modules/rsvp/src/calendar/index.ts` -- New: barrel export
- `modules/rsvp/src/calendar/__tests__/ics-generator.test.ts` -- New: generation tests
- `modules/rsvp/src/calendar/__tests__/ics-parser.test.ts` -- New: parsing tests
- `modules/rsvp/src/db/crud.ts` -- Add calendar sync tracking functions
- `modules/rsvp/src/types.ts` -- Add CalendarExport, IcsEvent types
- `modules/rsvp/src/definition.ts` -- Add RSVP_MIGRATION_V2
- `modules/rsvp/src/index.ts` -- Export new calendar functions
- `apps/mobile/app/(rsvp)/components/AddToCalendarSheet.tsx` -- New: bottom sheet with calendar options
- `apps/web/app/rsvp/actions.ts` -- Add exportEventIcs, importEventIcs server actions

### Known Limitations
- V1 does not support RRULE (recurring events). Importing a .ics with RRULE imports only the first occurrence.
- Calendar sync is one-directional: MyRSVP pushes to the device calendar, but changes in the device calendar are not pulled back.
- No Outlook deep link (only Google Calendar link). Outlook users can use the .ics download.
- No CalDAV server (no live calendar feed URL). Each export is a point-in-time snapshot.
- No attendee (ATTENDEE property) in .ics export -- by design for privacy (NC-3).

### Context for Next Agent
- The `rv_events` table has all fields needed for .ics generation. No JOIN is required -- it's a single-table read.
- The `calendar_event_id` column stores the string ID returned by `expo-calendar`'s `createEventAsync()`. Use `updateEventAsync()` for updates, keyed on this ID.
- RFC 5545 line folding: lines must not exceed 75 octets. Fold by inserting CRLF + single space. The generator must implement this.
- The parser must handle both `DTSTART;TZID=America/New_York:20260315T190000` and `DTSTART:20260315T190000Z` (UTC) formats.
- Google Calendar URL dates must be in `YYYYMMDDTHHmmssZ` format (UTC), not local time with TZID. Convert before building the URL.
- The .ics UID should be `{event_id}@mylife.app` to ensure global uniqueness and enable future CalDAV support.

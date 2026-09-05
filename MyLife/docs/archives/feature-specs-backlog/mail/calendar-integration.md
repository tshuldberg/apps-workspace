# Feature Spec: Calendar Integration

## Metadata
- **Module:** mail
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [3] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Attachments (calendar invites arrive as .ics attachments)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Email and calendar are deeply intertwined. Meeting invitations, RSVPs, flight confirmations, appointment reminders -- all arrive via email with calendar data embedded. Gmail and Outlook automatically detect calendar events in emails and offer one-click "Add to Calendar." Without this, MyMail users must manually copy event details from emails to their calendar, which is a significant UX regression from any modern mail client.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Auto-detects events in emails, adds to Google Calendar, shows event cards inline, RSVP buttons for invites |
| Outlook | Yes | No | Deep Outlook Calendar integration, meeting RSVP, availability overlay, scheduling assistant |
| Superhuman | Yes | Yes ($30/mo) | Calendar sidebar, event detection, one-click RSVP, meeting links extracted |
| Spark | Yes | No | Calendar integration via system calendar, event detection in emails |

### Target User
Business users and professionals who receive meeting invitations and event emails. Users of Gmail or Outlook who rely on automatic calendar integration. Anyone who schedules via email.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: CalendarEvent, CalendarInvite, RSVPStatus
  engine/calendar.ts                  -- NEW: .ics parser, event detection in email body, RSVP handler
  db/schema.ts                        -- V2 migration: ml_calendar_events table (local cache of detected events)
  db/crud.ts                          -- New CRUD: create/get/list calendar events linked to messages

apps/mobile/app/(mail)/
  components/CalendarEventCard.tsx     -- NEW: inline event card in message detail
  components/RSVPButtons.tsx           -- NEW: Accept/Decline/Maybe buttons for invites

apps/web/app/mail/
  components/CalendarEventCard.tsx     -- NEW: inline event card
  components/RSVPButtons.tsx           -- NEW: RSVP buttons
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Message Detail
            └── Calendar Event Card (above message body) ← YOU ARE HERE
                 └── [Accept] [Decline] [Maybe] buttons
                 └── "Add to Calendar" button
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_calendar_events (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES ml_messages(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  organizer TEXT,
  attendees TEXT DEFAULT '[]',
  ics_uid TEXT,
  rsvp_status TEXT DEFAULT 'pending' CHECK(rsvp_status IN ('pending', 'accepted', 'declined', 'tentative')),
  is_all_day INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ml_calendar_events_message_idx ON ml_calendar_events(message_id);
CREATE INDEX IF NOT EXISTS ml_calendar_events_account_idx ON ml_calendar_events(account_id);
CREATE INDEX IF NOT EXISTS ml_calendar_events_start_idx ON ml_calendar_events(start_time);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/mail` attachments (for .ics file access)
- **External:** `expo-calendar` (device calendar API on mobile), `ical.js` or custom parser (RFC 5545 .ics parsing)
- **Cross-Module:** `@mylife/rsvp` (RSVP module has calendar sync -- share calendar patterns), device calendar (native integration)

## Functional Requirements

### User Stories
1. As a mail user, I want emails with calendar invitations to show an event card so that I can see event details at a glance.
2. As a mail user, I want to RSVP to meeting invitations directly from the email so that I don't have to open a separate calendar app.
3. As a mail user, I want a one-click "Add to Calendar" button so that I can save events to my device calendar instantly.
4. As a mail user, I want the system to detect event-like content in plain emails (dates, times, locations) so that even non-ICS emails surface calendar data.

### Behavior Specification

1. When a message is opened, the calendar engine scans for:
   a. .ics attachments (VCALENDAR/VEVENT format) -- high confidence
   b. Content-Type: text/calendar inline body parts -- high confidence
   c. Date/time patterns in email body with location keywords -- low confidence (best-effort)
2. If an .ics attachment or inline calendar is found:
   a. Parse VEVENT: extract SUMMARY, DTSTART, DTEND, LOCATION, DESCRIPTION, ORGANIZER, ATTENDEE
   b. Create ml_calendar_events row linked to the message
   c. Show CalendarEventCard above the message body with:
      - Event title, date/time, location, organizer
      - RSVP buttons if the user is an attendee: Accept, Decline, Maybe
      - "Add to Calendar" button
3. If body contains date/time patterns (low confidence):
   a. Show a subtle "Possible event detected" banner with extracted date and "Add to Calendar"
4. RSVP flow:
   a. User taps Accept/Decline/Maybe
   b. System updates rsvp_status in ml_calendar_events
   c. System composes an iCalendar REPLY and sends via IMAP to the organizer
   d. Optionally adds event to device calendar via expo-calendar
5. "Add to Calendar" flow:
   a. Request calendar permission (expo-calendar)
   b. Create event in default device calendar
   c. Show confirmation toast "Event added to calendar"
   d. Button changes to "Added to Calendar" (disabled state)

### Edge Cases

- .ics file has multiple VEVENTs: create one card per event, show as expandable list
- Event has no end time: set end_time = start_time + 1 hour (default duration)
- Event is all-day: set is_all_day=1, display date only (no time)
- Event time zone differs from user's: convert to local time, show "(originally in EST)" note
- RSVP to an event from a non-primary account: send reply from the account that received the invite
- Calendar permission denied: "Add to Calendar" shows "Enable calendar access in Settings" deep link
- Duplicate event detection: if an ml_calendar_events row with the same ics_uid exists, update rather than create
- Cancelled event (METHOD:CANCEL): show "Event Cancelled" badge on the card, offer to remove from calendar
- Recurring events: show the next occurrence only, with "Recurring" badge. Full recurrence expansion is out of scope.
- Email forwarded with .ics: detect event but suppress RSVP buttons (user is not an attendee)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Messages with .ics attachments show a CalendarEventCard above the body
- [ ] **AC-2:** Event card displays title, date/time, location, and organizer
- [ ] **AC-3:** RSVP buttons (Accept/Decline/Maybe) appear for meeting invitations
- [ ] **AC-4:** Tapping RSVP updates status and sends iCalendar REPLY
- [ ] **AC-5:** "Add to Calendar" creates event in device calendar
- [ ] **AC-6:** "Add to Calendar" button changes to "Added" after success
- [ ] **AC-7:** Plain emails with date/time patterns show "Possible event" banner
- [ ] **AC-8:** All-day events display date only (no time)
- [ ] **AC-9:** Cancelled events show "Event Cancelled" badge

### Technical Criteria
- [ ] **TC-1:** ml_calendar_events table created with correct schema
- [ ] **TC-2:** .ics parser extracts VEVENT fields correctly (SUMMARY, DTSTART, DTEND, LOCATION, etc.)
- [ ] **TC-3:** iCalendar REPLY generated with correct METHOD:REPLY and ATTENDEE PARTSTAT
- [ ] **TC-4:** Duplicate events (same ics_uid) update rather than create new rows
- [ ] **TC-5:** Time zone conversion handles common zones correctly
- [ ] **TC-6:** expo-calendar integration creates event with correct start/end/title/location

### Negative Criteria
- [ ] **NC-1:** Low-confidence date detection must NOT auto-create calendar events (only banner)
- [ ] **NC-2:** RSVP buttons must NOT appear if user's email is not in the ATTENDEE list
- [ ] **NC-3:** Calendar permission must NOT be requested until user taps "Add to Calendar"
- [ ] **NC-4:** Recurring event expansion must NOT create hundreds of event rows (show next occurrence only)

## UI Specification

### Mobile (Expo)
- CalendarEventCard: `rgba(255,255,255,0.04)` glass background, `rgba(255,255,255,0.10)` border, rounded 12px
  - Title: `#F0F0F5` primary text, 16px semibold
  - Date/time: `#3B82F6` accent, calendar icon left
  - Location: `rgba(240,240,245,0.65)` secondary, map-pin icon left
  - Organizer: `rgba(240,240,245,0.65)` secondary, user icon left
- RSVP buttons: horizontal row, Accept=`#30D158` green, Decline=`#FF453A` red, Maybe=`rgba(255,255,255,0.08)` neutral
- "Add to Calendar" button: outline style, `#3B82F6` border and text, calendar-plus icon

### Web (Next.js)
- Same card layout via CSS variables
- RSVP buttons styled as button group
- "Add to Calendar" generates .ics download (no native calendar API on web)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card while .ics parses | Opening message with attachment |
| Empty | No calendar card (message has no events) | Normal message |
| Error | "Could not parse event" toast | Malformed .ics |
| Success | Event card with details + action buttons | Valid .ics parsed |
| Partial | Event card with "Possible event" banner (low confidence) | Date pattern in body |

## Test Requirements

### Unit Tests
- [ ] .ics parser: extracts SUMMARY from simple VEVENT
- [ ] .ics parser: extracts DTSTART, DTEND with timezone
- [ ] .ics parser: extracts LOCATION, DESCRIPTION, ORGANIZER
- [ ] .ics parser: handles all-day events (DATE vs DATE-TIME)
- [ ] .ics parser: handles multiple VEVENTs in one file
- [ ] .ics parser: handles CANCELLED method
- [ ] Date detection: finds "March 15, 2026 at 3pm" in email body
- [ ] Date detection: finds "2026-03-15T15:00" ISO format
- [ ] Date detection: returns empty for emails without date patterns
- [ ] RSVP: generates correct METHOD:REPLY with ACCEPTED
- [ ] RSVP: generates correct METHOD:REPLY with DECLINED
- [ ] Event CRUD: create event linked to message
- [ ] Event CRUD: duplicate ics_uid updates existing row
- [ ] Event CRUD: cascade delete with message

### Integration Tests
- [ ] Full flow: receive message with .ics -> card renders -> tap Accept -> RSVP sent
- [ ] Add to calendar: receive message -> tap "Add to Calendar" -> event created in device calendar

### QA Verification Script

1. Open MyMail on mobile
2. Send a test email with a .ics calendar invitation to the configured account
3. Open the received message
4. Verify: CalendarEventCard appears above message body -- corresponds to AC-1
5. Verify: card shows event title, date/time, location -- corresponds to AC-2
6. Verify: RSVP buttons visible (Accept/Decline/Maybe) -- corresponds to AC-3
7. Tap "Accept"
8. Verify: button highlights, RSVP reply sent -- corresponds to AC-4
9. Tap "Add to Calendar"
10. Grant calendar permission if prompted
11. Verify: event appears in device calendar app -- corresponds to AC-5
12. Verify: button changes to "Added to Calendar" -- corresponds to AC-6
13. Open a plain email containing "Meeting on March 15 at 3pm at Coffee Shop"
14. Verify: subtle "Possible event detected" banner -- corresponds to AC-7
15. Send a test email with an all-day .ics event
16. Verify: card shows date only, no time -- corresponds to AC-8
17. Send a test email with METHOD:CANCEL .ics
18. Verify: "Event Cancelled" badge on card -- corresponds to AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to message with .ics, verify event card and RSVP flow
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
No calendar awareness. Messages with .ics attachments display as generic file attachments. No event detection, no RSVP, no calendar sync.

### After This Work
Full calendar integration: .ics parsing, inline event cards, RSVP with iCalendar REPLY, device calendar sync, low-confidence date detection in plain emails.

### Files Changed
- `modules/mail/src/types.ts` -- Added CalendarEvent, CalendarInvite, RSVPStatus types
- `modules/mail/src/db/schema.ts` -- Added ml_calendar_events table + indexes
- `modules/mail/src/db/crud.ts` -- Added calendar event CRUD
- `modules/mail/src/engine/calendar.ts` -- NEW: .ics parser, date detection, RSVP generator
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/components/CalendarEventCard.tsx` -- NEW
- `apps/mobile/app/(mail)/components/RSVPButtons.tsx` -- NEW
- `apps/web/app/mail/components/CalendarEventCard.tsx` -- NEW
- `apps/web/app/mail/components/RSVPButtons.tsx` -- NEW

### Known Limitations
- No recurring event expansion (shows next occurrence only).
- No availability overlay (cannot see free/busy from email).
- Low-confidence date detection is best-effort (may miss non-standard date formats).
- Web: "Add to Calendar" downloads .ics file (no native calendar API).

### Context for Next Agent
The .ics parser should be a pure function that takes a string (file contents) and returns a CalendarEvent[]. The RSVP generator takes an event + status and returns an .ics string for METHOD:REPLY. Both are testable without platform dependencies. The `@mylife/rsvp` module has similar calendar patterns -- reference its implementation for expo-calendar usage. On web, generate a downloadable .ics file instead of using expo-calendar.

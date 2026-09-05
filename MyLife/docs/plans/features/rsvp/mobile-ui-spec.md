# Feature Spec: RSVP Full Mobile UI

## Metadata
- **Module:** rsvp
- **Task ID:** M11-2
- **Priority:** P0 (foundation for all RSVP mobile work)
- **Estimated CC Time:** 8-12 hours
- **Depends On:** All V1/V2/V3 CRUD and engines already implemented
- **Blocks:** All RSVP mobile features (calendar sync UI, expense splitting UI, etc.)

## Business Context

### Why This Spec Exists
MyRSVP has 100+ exported functions across 3 schema versions, 8 engines (iCal, settlement, templates, dietary, recurrence, location, designs, recap, seating), and 20+ database tables. The mobile UI is a single 880-line placeholder screen (`apps/mobile/app/(rsvp)/index.tsx`) that crams every feature into one ScrollView with raw TextInput forms. No real user can navigate this. This spec designs the full 10-screen mobile experience that surfaces all module capabilities through an intuitive, event-centric navigation flow.

### Competitor Landscape (Mobile UX)

| Competitor | Screen Count | Navigation Pattern | Standout UX |
|-----------|-------------|-------------------|-------------|
| Partiful | ~8 | Event-centric stack, bottom sheet creation | Beautiful event cards with cover photos, quick RSVP from list |
| Evite | ~12 | Tab bar (Events, Create, Inbox, Settings) | Template gallery with live preview, invitation design system |
| Luma | ~6 | Minimal stack, event detail as hub | Clean event detail with section pills, map integration |
| IRL | ~10 | Tab bar (Home, Discover, Calendar, Profile) | Group-centric, calendar view, social feed |

### MyRSVP Differentiators
- **Privacy-first:** All data local SQLite, no accounts required, no cloud dependency
- **Suite integration:** Events can reference MyBudget expenses, MyRecipes meal plans, MyBooks book club picks
- **Full event lifecycle:** Templates -> invites -> RSVPs -> day-of check-in -> post-event recap
- **20 invitation designs** with customization (no competitor offers this offline)

### User Model (from /plan-eng-review)

MyRSVP is a **host-side planning tool**. The sole user is the event organizer. There is no guest app, no guest login, no cloud sync. When the spec says "guest claims a gift" or "guest votes on a poll," the HOST is entering that data on behalf of guests.

"Host only" annotations in screen specs are informational labels, not access control gates. All screens render for the single local user.

Future: a shareable event link (V4) could enable guest self-service, but that is out of scope for this spec.

## Screen Architecture

### Navigation Structure

```
(rsvp)/
  _layout.tsx          -- Tabs navigator (3 visible tabs + hidden stack screens)
  index.tsx            -- Tab 1: Events List
  create.tsx           -- Tab 2: Create Event (dedicated create tab, accent color)
  settings.tsx         -- Tab 3: Settings
  event/[id].tsx       -- Stack: Event Detail (workspace hub for one event)
  guests/[eventId].tsx -- Stack: Guest Manager (dense utility rows)
  polls/[eventId].tsx  -- Stack: Polls & Questions (dense utility rows)
  feed/[eventId].tsx   -- Stack: Event Feed (comments, photos, messages)
  registry/[eventId].tsx  -- Stack: Gift Registry (dense utility rows)
  seating/[eventId].tsx   -- Stack: Seating Chart (dense utility rows)
  expenses/[eventId].tsx  -- Stack: Expense Splitter (dense utility rows)
```

### Tab Bar Configuration

| Tab | Label | Icon | Screen |
|-----|-------|------|--------|
| 1 | Events | `calendar` | `index.tsx` |
| 2 | Create | `plus-circle` (accent color, prominent) | `create.tsx` |
| 3 | Settings | `settings` | `settings.tsx` |

Stack screens are hidden from the tab bar via `href: null` (same pattern as recipes module).

**Activity feed is NOT a tab.** Cross-event activity is accessible via a bell icon in the Events header with a badge count. This prioritizes the two highest-frequency actions (browse events, create events) over ambient notifications.

### Design Principles (from /plan-design-review)

1. **Workspace, not dashboard:** Event Detail is a workspace hub with dense section rows, not a card mosaic.
2. **Dense rows for utility screens:** Guest Manager, Polls, Registry, Seating, Expenses use compact list rows with inline actions. Cards only where the card IS the interaction (Events List, design previews).
3. **Subtraction default:** Cards don't earn their pixels on operational screens. Information density matters for power users with 50+ guests or 10+ expenses.

### Layout Pattern

Follow the recipes module layout pattern (`apps/mobile/app/(recipes)/_layout.tsx`):
- `Tabs` navigator from `expo-router`
- `ModuleErrorBoundary` wrapper with `moduleName="MyRSVP"`
- `BackToHubButton` in `headerLeft`
- Accent color: `colors.modules.rsvp` (`#FB7185`)
- Cool Obsidian theme tokens throughout

---

## Screen Specifications

### Screen 1: Events List (`index.tsx`)

**Purpose:** Primary landing screen. Shows all events organized by time. Entry point for creating new events.

**Layout:**
```
┌─────────────────────────────────┐
│ ← MyRSVP                    +  │  Header with create button
├─────────────────────────────────┤
│ [Upcoming] [Past] [Recurring]   │  Segment control (3 filters)
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 📸 Cover Image / Gradient   │ │  Event card (glass morphism)
│ │ Birthday Bash               │ │  Title
│ │ Mar 28 · 7 PM · Jake's Apt │ │  Date + location
│ │ 12 going · 3 maybe          │ │  RSVP summary badges
│ │ [Going ✓] [Maybe] [Decline] │ │  Quick RSVP chips (own events)
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Game Night                  │ │  Minimal card (no cover)
│ │ Apr 2 · 8 PM · Online      │ │  Virtual badge for online events
│ │ 8 going · 2 polls open      │ │  Activity indicator
│ └─────────────────────────────┘ │
│                                 │
│           Empty State:          │
│     "No events yet. Tap + to    │
│      plan your first event."    │
│                                 │
│                          [+ ●]  │  FAB: Create Event
└─────────────────────────────────┘
```

**Data Sources:**
- `getEvents(db, { includePast })` for event list
- `getRsvpSummary(db, eventId)` for badge counts on each card
- `isVirtualLocation(event.locationName)` for virtual badge

**Interactions:**
- Tap event card -> push `event/[id]`
- Tap FAB (+) -> push `create`
- Segment toggle filters upcoming (default), past, recurring
- Pull-to-refresh reloads event list
- Swipe left on event card reveals delete action (with confirmation)

**States:** Empty (no events, illustration + CTA), Loading (skeleton cards), Populated (event cards), Error (retry button)

**First-Time Experience (one-time only):**
When the user enables MyRSVP and has zero events, show a hero onboarding card instead of generic empty state:
```
┌─────────────────────────────────┐
│  Plan something special         │  Heading (heroTitle variant)
│                                 │
│  [Birthday] [Dinner] [Game Night]  Template preview chips
│  [Happy Hour] [More...]        │
│                                 │
│  Every detail. Every guest.     │  Tagline (body, textSecondary)
│  All on your device.            │  Privacy promise
└─────────────────────────────────┘
```
Tapping a template chip navigates directly to Create Event with that template pre-selected. Dismissed permanently after the first event is created. Uses `getSetting(db, 'onboarding_dismissed')` to track.

---

### Screen 2: Event Detail (`event/[id].tsx`)

**Purpose:** The hub screen for a single event. Shows event info, RSVP status at a glance, and links to all sub-features (guests, polls, feed, registry, seating, expenses).

**Layout (workspace pattern -- NOT a dashboard mosaic):**
```
┌─────────────────────────────────┐
│ ← Birthday Bash            ⋮   │  Sticky header (title + overflow)
│ Sat, Mar 28 · 7-10 PM          │  Date/time
│ Jake's Apartment                │  Location (tappable -> maps)
├─────────────────────────────────┤
│ 12 going · 3 maybe · 84%       │  RSVP summary (single line)
│ ┌ Donut: ●going ●maybe ●dec ┐  │  Compact donut chart (Apple Health)
│ │  success / textSec / danger│  │  3 segments, 60px diameter
│ └────────────────────────────┘  │
├─────────────────────────────────┤
│ [Add to Calendar] [Directions]  │  Action button row
├─────────────────────────────────┤
│ Guests         16  2 pending  > │  Dense section rows
│ Polls           2  1 active   > │  Each row: icon + label + count
│ Feed           24  3 new      > │  + status indicator + chevron
│ Registry        8  3 claimed  > │  Tap row -> push stack screen
│ Seating      4 tbl  4 open   > │
│ Expenses    $127  2 unsettled > │
├─────────────────────────────────┤
│ Co-hosts: Sarah + Jake          │  (hidden if 0 co-hosts)
├─────────────────────────────────┤
│ ── Event Recap ──               │  (past events only)
│ 3h duration · 15 attended       │  Recap highlights as dense text
│ First RSVP: Alex · 12 photos   │
│ $127 total expenses             │
└─────────────────────────────────┘
```

**Data Sources:**
- `getEventById(db, id)` for event details
- `getEventCohosts(db, eventId)` for co-host names
- `getRsvpSummary(db, eventId)` for RSVP donut
- `getEventAnalytics(db, eventId)` for response rate + counts
- `getEventDesign(db, eventId)` for design background
- `getEventCoordinates(db, eventId)` for map link
- `generateRecap(db, eventId)` for past-event recap section
- `isRecapAvailable(event.startAt)` to show/hide recap section
- `buildDirectionsUrl(platform, lat, lng, address)` for directions button
- `isVirtualLocation(event.locationName)` for virtual event indicator

**Interactions:**
- Tap location -> open maps (Apple Maps on iOS via `buildAppleMapsUrl`, Google Maps fallback)
- Tap "Add to Calendar" -> bottom sheet (device calendar via expo-calendar, .ics download, Google Calendar link)
- Tap any quick action grid item -> push to corresponding stack screen
- Overflow menu (three dots): Edit Event, Share Event, Delete Event, Export Attendance CSV
- Recap section only visible for past events (`isRecapAvailable`)

**Conditional Sections:**
- Co-hosts row: only if `getEventCohosts` returns items
- Directions button: only if location exists and `!isVirtualLocation`
- Virtual badge: shown if `isVirtualLocation` returns true
- Gift Registry tile: only if event has `allowChipIn` enabled
- Seating tile: only shown for events with capacity > 0
- Expense tile: always shown (useful for any event type)
- Recap section: only for past events

---

### Screen 3: Create Event (`create.tsx`)

**Purpose:** Multi-step event creation flow. Starts with template selection, then fills in details. Templates pre-populate settings and suggested questions.

**Layout - Step 1: Template Picker (large format cards, NOT emoji grid)**
```
┌─────────────────────────────────┐
│ ← Create Event          Skip → │  Skip goes to blank form
├─────────────────────────────────┤
│ What are you planning?          │  Section header (heading variant)
│                                 │
│ ┌─────────────────────────────┐ │  Large template card (glass.card)
│ │ Dinner Party                │ │  Name (subheading)
│ │ Intimate dinner with great  │ │  Description (body, textSecondary)
│ │ company                     │ │
│ │ ~3h · up to 12 guests       │ │  Duration + capacity (caption)
│ │ Asks: dietary restrictions  │ │  Suggested questions preview
│ │ Checklist: menu, groceries  │ │  Host checklist preview
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Game Night                  │ │
│ │ Board games, card games,    │ │
│ │ and fun                     │ │
│ │ ~4h · open capacity         │ │
│ │ Asks: what games to play?   │ │
│ │ Checklist: games, snacks    │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Birthday Party              │ │
│ │ Celebrate with friends      │ │
│ │ ~3h · open capacity         │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ (Scroll vertically for all 12)  │
│ [Start from scratch]            │  Ghost button at bottom
└─────────────────────────────────┘
```

**Layout - Step 2: Event Details Form**
```
┌─────────────────────────────────┐
│ ← Back              Next →     │  Step indicator (2 of 3)
├─────────────────────────────────┤
│ Event Name                      │
│ ┌─────────────────────────────┐ │
│ │ Sarah's Birthday Bash       │ │  Pre-filled from template name
│ └─────────────────────────────┘ │
│                                 │
│ Description                     │
│ ┌─────────────────────────────┐ │
│ │ Come celebrate! Gifts       │ │  Pre-filled from template
│ │ welcome but not required.   │ │
│ └─────────────────────────────┘ │
│                                 │
│ Date & Time                     │
│ ┌────────────┐ ┌──────────────┐ │
│ │ Mar 28     │ │ 7:00 PM     │ │  Date picker + time picker
│ └────────────┘ └──────────────┘ │
│ ┌────────────┐ ┌──────────────┐ │
│ │ (End date) │ │ 10:00 PM    │ │  Optional end time
│ └────────────┘ └──────────────┘ │
│                                 │
│ Location                        │
│ ┌─────────────────────────────┐ │
│ │ 📍 Jake's Apartment         │ │  Text input with map icon
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 123 Mission St, SF          │ │  Optional address line
│ └─────────────────────────────┘ │
│                                 │
│ Cover Image                     │
│ ┌─────────────────────────────┐ │
│ │   [Choose from photos]      │ │  Image picker or camera
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Layout - Step 3: Settings & Design**
```
┌─────────────────────────────────┐
│ ← Back             Create →    │  Step indicator (3 of 3)
├─────────────────────────────────┤
│ Event Settings                  │
│                                 │
│ Visibility     [Private ▼]      │  Picker: public/unlisted/private
│ Require RSVP approval   [ON]   │  Toggle (from template default)
│ Allow plus-ones         [ON]   │  Toggle
│ Max guests         [unlimited]  │  Number input or unlimited
│ Enable waitlist         [ON]   │  Toggle
│ Allow photo album       [ON]   │  Toggle
│ Allow comments          [ON]   │  Toggle
│ Allow polls             [ON]   │  Toggle
│ Enable chip-in / gifts  [OFF]  │  Toggle
│                                 │
│ ── Recurring ──                 │
│ Repeat            [None ▼]     │  Picker: none/daily/weekly/etc.
│                                 │
│ ── Invitation Design ──         │
│ ┌──────┐ ┌──────┐ ┌──────┐     │  Horizontal scroll of designs
│ │Confet│ │Marble│ │Neon  │     │  5 categories: celebration,
│ │  ti  │ │      │ │      │     │  elegant, casual, seasonal,
│ └──────┘ └──────┘ └──────┘     │  minimal (20 total designs)
│ Selected: Confetti              │
│                                 │
│ ── Host Checklist ──            │  From template
│ ☐ Book venue or set up space   │
│ ☐ Order cake                   │
│ ☐ Send invites 2 weeks ahead   │
│ ☐ Plan activities or games     │
│ ☐ Arrange decorations          │
│                                 │
│ [        Create Event        ]  │  Primary button
└─────────────────────────────────┘
```

**Data Sources:**
- `getTemplates()` for template grid (12 templates)
- `applyTemplate(templateId)` to pre-populate form
- `getDesigns()` for invitation design picker
- `getDesignsByCategory(category)` for filtered design view
- `createEvent(db, id, ...)` on form submit
- `setEventDesign(db, eventId, designId, customJson)` for design selection
- `createRecurrenceRule(db, ...)` if recurring is enabled
- `createQuestion(db, ...)` for suggested questions from template

**Interactions:**
- Tap template -> pre-fills form fields and transitions to step 2
- "Skip" bypasses template and opens blank form at step 2
- Date/time inputs use native pickers (`@react-native-community/datetimepicker`)
- Design picker is a horizontal FlatList; tap to select, long-press for full preview
- "Create Event" validates required fields (title, startAt), creates event, navigates to event detail

---

### Screen 4: Guest Manager (`guests/[eventId].tsx`)

**Purpose:** Full invite and RSVP management for a single event. Add guests, track responses, manage approval queue, run check-in, view dietary summary.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Guests           Check-In →  │  Toggle to check-in mode
├─────────────────────────────────┤
│ [All] [Going] [Maybe] [Pending] │  Filter chips
├─────────────────────────────────┤
│ ── Needs Approval (2) ──        │  Section (if requiresApproval)
│ ┌─────────────────────────────┐ │
│ │ 👤 Chris P.        requested│ │  Guest row
│ │    chris@email.com   +1     │ │  Contact + plus-one limit
│ │    [Approve] [Waitlist]     │ │  Action buttons
│ └─────────────────────────────┘ │
│                                 │
│ ── Going (12) ──                │  Section header with count
│ ┌─────────────────────────────┐ │
│ │ 👤 Alex K.    going · +2    │ │
│ │    Dietary: vegetarian      │ │  From question responses
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 👤 Sam W.     going · +0   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Maybe (3) ──                 │
│ ...                             │
│                                 │
│ ── Dietary Summary ──           │  Collapsible section
│ 🥦 Vegetarian: 3               │
│ 🌾 Gluten-free: 2              │
│ 🥜 Nut allergy: 1              │
│                                 │
│ ── Co-hosts ──                  │  Collapsible section
│ Sarah (Organizer) · Jake (Host) │
│ [+ Add co-host]                 │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  + Add Guest                │ │  Bottom input bar
│ │  Name: [          ]         │ │
│ │  Contact: [        ] [Add]  │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Check-In Mode (toggled via header button):**
```
┌─────────────────────────────────┐
│ ← Exit Check-In    12/16 ✓     │  Progress counter
├─────────────────────────────────┤
│ 🔍 [Search guest name...]       │  Quick search filter
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ ✓ Alex K.      checked in  │ │  Green check, greyed row
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ○ Sam W.       [Check In]  │ │  Tap to check in
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ ○ Chris P. +1  [Check In]  │ │  Shows plus-ones count
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Sources:**
- `getInvitesByEvent(db, eventId)` for invite list
- `getRsvpsByEvent(db, eventId)` for RSVP statuses
- `getRsvpSummary(db, eventId)` for section counts
- `getEventCohosts(db, eventId)` for co-host list
- `getDietaryResponses(db, eventId)` for dietary summary
- `aggregateDietaryResponses(responses)` for dietary counts
- `createInvite(db, ...)`, `approveInviteRequest(db, ...)`, `moveInviteToWaitlist(db, ...)` for actions
- `checkInRsvp(db, rsvpId)` for check-in mode
- `addEventCohost(db, ...)` for adding co-hosts

**Interactions:**
- Filter chips toggle between All/Going/Maybe/Pending/Waitlisted/Declined
- Tap guest row -> expand to show full details (contact, notes, question responses, plus-ones)
- Check-In toggle switches the entire list to check-in mode (large tap targets, search bar)
- Bottom input bar sticky at bottom for quick guest adding
- Swipe left on guest row to remove invite (with confirmation)
- Dietary summary collapses/expands on header tap

---

### Screen 5: Polls & Questions (`polls/[eventId].tsx`)

**Purpose:** Create and manage polls for group decisions. Manage custom RSVP questions. View vote results with visual bars.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Polls & Questions    [+ New] │
├─────────────────────────────────┤
│ [Polls] [Questions]             │  Tab toggle
├─────────────────────────────────┤
│ ── Active Polls ──              │
│ ┌─────────────────────────────┐ │
│ │ What should we eat?         │ │  Poll card
│ │                             │ │
│ │ 🍕 Pizza     ████████░ 8   │ │  Option with vote bar
│ │ 🍔 Burgers   ████░░░░░ 4   │ │  Vote count
│ │ 🥗 Salad     ██░░░░░░░ 2   │ │
│ │                             │ │
│ │ 14 votes · [Vote] [Close]  │ │  Actions
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ When should we meet?        │ │  Second poll
│ │ Friday      ██████░░░░ 6   │ │
│ │ Saturday    ████████░░ 8   │ │
│ │ 14 votes · [Vote]          │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Closed Polls ──              │  Greyed out section
│ ┌─────────────────────────────┐ │
│ │ Movie pick  [Closed]        │ │
│ │ Winner: The Matrix (9 votes)│ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Questions Tab ──             │
│ (when "Questions" tab active)   │
│ ┌─────────────────────────────┐ │
│ │ Q1: Dietary restrictions?   │ │  Question card
│ │ Type: dietary · Required    │ │
│ │ 8 responses                 │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Q2: Song request?           │ │
│ │ Type: text · Optional       │ │
│ │ 5 responses                 │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Create Poll Bottom Sheet:**
```
┌─────────────────────────────────┐
│ New Poll                        │
│                                 │
│ Question: [                   ] │
│ Option 1: [                   ] │
│ Option 2: [                   ] │
│ [+ Add option]                  │
│                                 │
│ Allow multiple votes    [OFF]   │
│                                 │
│ [       Create Poll          ]  │
└─────────────────────────────────┘
```

**Data Sources:**
- `getPollsByEvent(db, eventId)` for poll list
- `getPollVotes(db, pollId)` for vote counts per option
- `getQuestionsByEvent(db, eventId)` for custom questions
- `getQuestionResponsesByRsvp(db, rsvpId)` for response counts
- `createPoll(db, ...)`, `votePollOption(db, ...)`, `closePoll(db, ...)` for actions
- `createQuestion(db, ...)`, `deleteQuestion(db, ...)` for question management

**Interactions:**
- Tap option bar to cast vote (single or multi depending on poll settings)
- "Close" button finalizes a poll (host only)
- "+" button opens bottom sheet for new poll creation
- Tab toggle switches between Polls view and Questions view
- Swipe left on poll/question to delete (with confirmation)
- Vote bars animate on data change

---

### Screen 6: Event Feed (`feed/[eventId].tsx`)

**Purpose:** Unified activity stream for an event. Combines announcements (pinned at top), guest messages (chat-style), comments, and photos in a single chronological feed.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Event Feed           [📷 +]  │  Photo add shortcut
├─────────────────────────────────┤
│ ── Pinned ──                    │  Pinned announcements
│ ┌─────────────────────────────┐ │
│ │ 📌 Parking update: use the  │ │  Announcement card (accent bg)
│ │    garage on 2nd St.        │ │
│ │    Host · 2h ago            │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Feed ──                      │  Chronological mixed feed
│                                 │
│ 💬 Alex K.              3h ago │  Comment
│    Can't wait! Bringing wine.  │
│                                 │
│ 📸 Sam W.               2h ago │  Photo (thumbnail)
│    ┌──────────────┐            │
│    │  [photo]     │            │
│    └──────────────┘            │
│    "Setting up decorations"    │  Caption
│                                 │
│ 🔔 Host                 1h ago │  Announcement (inline)
│    Dinner starts at 7:30!      │
│                                 │
│ 💬 Jake R.              45m ago│  Message (chat bubble style)
│    Running 10 min late         │
│                                 │
│ 📸 Photo Album (12 photos)     │  Photo grid section
│ ┌────┐┌────┐┌────┐┌────┐      │
│ │    ││    ││    ││    │      │
│ └────┘└────┘└────┘└────┘      │
│ [View All Photos]              │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │  Bottom input bar
│ │ [Message...        ] [Send] │ │
│ │ [📷] [📢]                   │ │  Photo + Announcement shortcuts
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Sources:**
- `getMessagesByEvent(db, eventId)` for guest messages
- `getPinnedMessages(db, eventId)` for pinned section
- `getCommentsByEvent(db, eventId)` for legacy comments
- `getPhotosByEvent(db, eventId)` for photo entries
- `getAnnouncementsByEvent(db, eventId)` for announcements
- `getMessageCount(db, eventId)` for unread indicator on Event Detail
- `createMessage(db, ...)`, `pinMessage(db, ...)`, `unpinMessage(db, ...)` for message actions
- `createComment(db, ...)`, `addPhoto(db, ...)` for legacy feed items
- `createAnnouncement(db, ...)` for host announcements
- `deleteMessage(db, ...)`, `deletePhoto(db, ...)` for removal

**Interactions:**
- Bottom input bar: type message and send, or tap camera icon for photo picker, or tap megaphone for announcement (host only)
- Long-press a message to pin/unpin (host only), reply, or delete
- Tap photo thumbnail to open full-screen gallery
- "View All Photos" opens full photo grid view
- Pull-to-refresh reloads feed
- Feed items sorted by `createdAt` descending (newest first), with pinned announcements always at top

---

### Screen 7: Gift Registry (`registry/[eventId].tsx`)

**Purpose:** Manage a wish list for event gifts. Guests can claim items. Host can add/edit/remove items.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Gift Registry         [+ Add]│
├─────────────────────────────────┤
│ Progress: 5 of 12 claimed       │
│ ████████████████░░░░░░░░  42%  │  Progress bar
├─────────────────────────────────┤
│ [All] [Kitchen] [Home] [Other] │  Category filter chips
│       [Experiences] [Baby]     │  (from RegistryCategory type)
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 🍳 Cast Iron Skillet        │ │  Item card
│ │ Kitchen · $45               │ │  Category + price
│ │ ✓ Claimed by Alex           │ │  Claim status (green)
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📚 Cookbook Collection       │ │
│ │ Books · $30                 │ │
│ │ Available · Qty: 2 left     │ │  Unclaimed
│ │ [Claim This]                │ │  Claim button
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🎫 Cooking Class Voucher    │ │
│ │ Experiences · $80           │ │
│ │ Available                   │ │
│ │ 🔗 View Online              │ │  External link (if url set)
│ │ [Claim This]                │ │
│ └─────────────────────────────┘ │
│                                 │
│          Empty State:           │
│  "No registry items yet. Tap + │
│   to add wishes for your event."│
└─────────────────────────────────┘
```

**Add Item Bottom Sheet:**
```
┌─────────────────────────────────┐
│ Add Registry Item               │
│                                 │
│ Name: [                       ] │
│ Category: [Kitchen ▼]          │
│ Price: $ [       ] (optional)  │
│ URL: [              ] (optional)│
│ Quantity: [1]                   │
│ Description: [                ] │
│                                 │
│ [      Add to Registry       ]  │
└─────────────────────────────────┘
```

**Data Sources:**
- `getRegistryItemsByEvent(db, eventId)` for item list
- `createRegistryItem(db, ...)`, `updateRegistryItem(db, ...)`, `deleteRegistryItem(db, ...)` for host management
- `claimRegistryItem(db, itemId, claimerName)`, `unclaimRegistryItem(db, itemId)` for guest claims

**Interactions:**
- Category filter chips filter the list
- "Claim This" button prompts for name, then calls `claimRegistryItem`
- Host can tap claimed items to unclaim (`unclaimRegistryItem`)
- Host sees "+" button to add items; guests see read-only list with claim actions
- Tap external link icon opens URL in system browser
- Swipe left on item (host only) to delete
- Progress bar updates as items are claimed

---

### Screen 8: Seating Chart (`seating/[eventId].tsx`)

**Purpose:** Manage table assignments for events with capacity. Add tables, assign guests manually or auto-assign, export seating text.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Seating Chart    [Auto-Assign]│
├─────────────────────────────────┤
│ 12 seated · 4 unassigned        │  Summary bar
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ ○ Table 1 (Round · 8 seats) │ │  Table card
│ │ ████████░░ 6/8 filled       │ │  Capacity bar
│ │                             │ │
│ │ Alex K. · Sam W. · Chris P.│ │  Assigned guests (chips)
│ │ Jake R. · Maria L. · Jay T.│ │
│ │                             │ │
│ │ [+ Assign Guest]            │ │  Add guest to this table
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ □ Table 2 (Rect · 6 seats)  │ │  Rectangle icon
│ │ ██████████ 6/6 filled       │ │  Full (different color)
│ │                             │ │
│ │ Bob S. · Ann T. · Eve L.   │ │
│ │ Dan M. · Lily K. · Owen R. │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Unassigned Guests (4) ──     │  Section for unassigned
│ Pat G. · Robin H. · Lee J.    │
│ Jordan M.                      │
│                                 │
│ [+ Add Table]                   │  Add new table
│                                 │
│ [Export Seating Text]           │  Share/copy seating arrangement
└─────────────────────────────────┘
```

**Add Table Bottom Sheet:**
```
┌─────────────────────────────────┐
│ Add Table                       │
│                                 │
│ Label: [Table 3             ]   │
│ Shape: [Round ▼]  (round/rect/long)
│ Capacity: [8]                   │
│                                 │
│ [       Add Table            ]  │
└─────────────────────────────────┘
```

**Data Sources:**
- `getTablesByEvent(db, eventId)` for table list
- `getAssignmentsByTable(db, tableId)` for per-table guests
- `getAssignmentsByEvent(db, eventId)` for all assignments
- `getUnassignedGuests(goingGuests, assignedGuests)` for unassigned section
- `calculateRemainingCapacity(capacity, currentCount)` for capacity bar
- `autoAssign(tables, assignedCounts, unassignedGuests)` for auto-assign action
- `validateAssignment(capacity, current, name, all)` before manual assignment
- `createSeatingTable(db, ...)`, `deleteSeatingTable(db, ...)` for table management
- `assignSeat(db, ...)`, `removeSeatAssignment(db, ...)` for guest placement
- `generateSeatingText(tables)` for text export

**Interactions:**
- "Auto-Assign" fills all unassigned going guests into tables by sort order
- "+ Assign Guest" on a table opens a picker of unassigned guests
- Tap a guest chip on a table to remove assignment (with confirmation)
- Tap unassigned guest chip to pick which table to assign to
- "Export Seating Text" calls `generateSeatingText` and opens share sheet
- Swipe left on table card to delete table (moves guests to unassigned)
- Table shape icon changes based on `shape` field (circle, rectangle, long bar)

---

### Screen 9: Expense Splitter (`expenses/[eventId].tsx`)

**Purpose:** Track shared expenses for an event and calculate who owes whom. Supports equal, custom, and itemized splits.

**Layout:**
```
┌─────────────────────────────────┐
│ ← Expenses             [+ Add] │
├─────────────────────────────────┤
│ Total: $127.50                  │  Total expenses summary
│ 3 expenses · 5 participants     │
├─────────────────────────────────┤
│ ── Expenses ──                  │
│ ┌─────────────────────────────┐ │
│ │ 🍕 Pizza delivery           │ │  Expense card
│ │ $45.00 · Paid by Alex       │ │
│ │ Split: Equal (5 people)     │ │  Split type badge
│ │ $9.00 / person              │ │
│ │ 3 of 4 settled              │ │  Settlement progress
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🍺 Drinks                   │ │
│ │ $62.50 · Paid by Sam        │ │
│ │ Split: Equal (5 people)     │ │
│ │ $12.50 / person             │ │
│ │ 1 of 4 settled              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🎂 Cake                     │ │
│ │ $20.00 · Paid by Jake       │ │
│ │ Split: Equal (5 people)     │ │
│ └─────────────────────────────┘ │
│                                 │
│ ── Who Owes Whom ──             │  Settlement summary
│ ┌─────────────────────────────┐ │
│ │ Chris → Alex      $9.00    │ │  Settlement card
│ │ Chris → Sam      $12.50    │ │
│ │ Jake  → Sam       $8.50    │ │
│ │                    [Settle] │ │  Mark as settled
│ └─────────────────────────────┘ │
│                                 │
│          Empty State:           │
│  "No expenses tracked yet.      │
│   Tap + to add a shared cost."  │
└─────────────────────────────────┘
```

**Add Expense Bottom Sheet:**
```
┌─────────────────────────────────┐
│ Add Expense                     │
│                                 │
│ Description: [Pizza delivery  ] │
│ Amount: $ [45.00              ] │
│ Paid by: [Alex ▼]              │  Picker from going guests
│ Split type: [Equal ▼]          │  equal / custom / itemized
│                                 │
│ Split between:                  │
│ ☑ Alex    ☑ Sam    ☑ Chris     │  Guest checkboxes
│ ☑ Jake    ☑ Maria              │
│                                 │
│ [      Add Expense           ]  │
└─────────────────────────────────┘
```

**Data Sources:**
- `getExpensesByEvent(db, eventId)` for expense list
- `getExpenseById(db, expenseId)` for detail view
- `getExpenseSplitsByExpense(db, expenseId)` for split details
- `calculateEqualSplit(totalCents, participants)` for equal split preview
- `calculateSettlements(expenses)` for "who owes whom" section
- `validateCustomSplit(totalCents, splits)` for custom split validation
- `createExpense(db, ...)`, `updateExpense(db, ...)`, `deleteExpense(db, ...)` for expense CRUD
- `createExpenseSplit(db, ...)`, `markSplitSettled(db, ...)`, `markSplitUnsettled(db, ...)` for split management

**Interactions:**
- "+" opens add expense bottom sheet
- Tap expense card to expand and see per-person split amounts
- "Settle" button on a settlement row calls `markSplitSettled`
- Tap settled row to un-settle (`markSplitUnsettled`)
- Swipe left on expense to delete (recalculates settlements)
- Split type picker changes the form: "equal" auto-calculates, "custom" shows per-person amount inputs, "itemized" shows line-item entry
- Settlement section updates reactively when expenses change

---

### Screen 10: Activity Feed (`activity.tsx`)

**Purpose:** Cross-event activity stream showing recent happenings across all events. Helps the user stay on top of RSVPs, messages, and updates without checking each event individually.

**Layout:**
```
┌─────────────────────────────────┐
│ ← MyRSVP                       │
│   Activity                      │
├─────────────────────────────────┤
│ ── Today ──                     │
│                                 │
│ 🎉 Birthday Bash                │  Event context header
│   ✓ Alex K. RSVP'd going       │  RSVP activity
│   💬 "Can't wait!" - Alex       │  Comment
│   📸 Sam added 3 photos         │  Photo activity
│                                 │
│ 🎲 Game Night                   │
│   ✓ Maria RSVP'd maybe         │
│   📊 Poll "Snacks?" has 8 votes│  Poll activity
│                                 │
│ ── Yesterday ──                 │
│                                 │
│ 🎉 Birthday Bash                │
│   📢 Host: "Parking update"     │  Announcement
│   ✓ 3 new RSVPs                 │  Batched RSVPs
│                                 │
│ ── This Week ──                 │
│ ...                             │
│                                 │
│          Empty State:           │
│  "No activity yet. Create an    │
│   event to get started!"        │
└─────────────────────────────────┘
```

**Data Sources:**
- `getEvents(db, { includePast: false })` for active events
- For each event: `getRsvpsByEvent`, `getCommentsByEvent`, `getPhotosByEvent`, `getAnnouncementsByEvent`, `getMessagesByEvent`
- Aggregate and sort by timestamp, group by day

**Interactions:**
- Tap any activity row -> navigate to the parent event detail
- Pull-to-refresh reloads activity
- Activity items are grouped by day (Today, Yesterday, This Week, Earlier)

---

## Settings Screen (`settings.tsx`)

**Purpose:** Module-level preferences. Minimal for V1.

**Options:**
- Default event visibility (public/unlisted/private)
- Default timezone
- Preferred invitation design
- Export all data (JSON)
- Clear all data (with confirmation)

**Data Sources:**
- `getSetting(db, key)`, `setSetting(db, key, value)` for preferences

---

## Design System Notes

### Module Accent
- Primary accent: `#FB7185` (rose pink, from `colors.modules.rsvp`)
- Used for: active tabs, buttons, selected chips, progress bars, section headers

### Glass Morphism Cards
- Event cards on list: `expo-blur` BlurView with `glass` fill
- Stat cards on event detail: `glassStrong` fill with `glassBorder`
- Feed items: transparent background, subtle `border` separator

### Typography Hierarchy
- Event title: `variant="heading"` (Inter 600)
- Section headers: `variant="subheading"` (Inter 500)
- Body text: `variant="body"` (Inter 400)
- Captions/metadata: `variant="caption"` (Inter 400, `textSecondary`)

### Empty States
Every screen must handle the empty state with:
- Subtle illustration or emoji
- 1-2 line description
- CTA button directing to the creation action

### Skeleton Loading
Event list and event detail should show skeleton placeholders while data loads (glass cards with animated shimmer).

---

## Implementation Notes

### File Changes Required

**New files (10 screens + updated layout + 10 test files):**
```
apps/mobile/app/(rsvp)/
  _layout.tsx           -- REPLACE: Stack -> Tabs (3 tabs + hidden screens)
  index.tsx             -- REPLACE: 880-line placeholder -> Events List
  create.tsx            -- NEW: Create Event (Tab 2, template + multi-step form)
  settings.tsx          -- NEW: Module settings (Tab 3)
  event/[id].tsx        -- NEW: Event Detail workspace hub
  guests/[eventId].tsx  -- NEW: Guest Manager + Check-in (dense rows, FlatList)
  polls/[eventId].tsx   -- NEW: Polls & Questions (dense rows)
  feed/[eventId].tsx    -- NEW: Event Feed (FlatList, paginated)
  registry/[eventId].tsx -- NEW: Gift Registry (dense rows, FlatList)
  seating/[eventId].tsx -- NEW: Seating Chart (dense rows)
  expenses/[eventId].tsx -- NEW: Expense Splitter (dense rows, FlatList)

apps/mobile/app/(rsvp)/__tests__/
  events-list.test.tsx     -- Load events, segment filter, onboarding, empty state
  event-detail.test.tsx    -- Load event, section rows, recap, conditional sections
  create-event.test.tsx    -- Template picker, useReducer, step nav, validation, submit
  guest-manager.test.tsx   -- Guest list, filter chips, check-in toggle, approve/waitlist
  polls.test.tsx           -- Poll rendering, vote action, create poll, close poll
  event-feed.test.tsx      -- Message list, send, pin/unpin, photo add
  registry.test.tsx        -- Item list, claim/unclaim, add item, category filter
  seating.test.tsx         -- Table list, assign, auto-assign, export text
  expenses.test.tsx        -- Expense list, add, split calc, settle aggregate
  settings.test.tsx        -- Load defaults, save preferences
```

Test pattern: `vi.mock('@mylife/rsvp')` + `vi.mock('useDatabase')` + render + assert mock calls. Reference: `apps/mobile/app/(recipes)/__tests__/index.test.tsx`.

**Module definition update:**
```
modules/rsvp/src/definition.ts
  -- Update navigation.tabs to match new 3-tab structure
  -- Update navigation.screens to list all 7 stack screens
```

### Function Coverage Map

All 100+ exported functions are mapped to screens:

| Function Group | Screen(s) |
|---------------|-----------|
| `createEvent`, `getEvents`, `updateEvent`, `deleteEvent` | Events List, Event Detail, Create Event |
| `addEventCohost`, `getEventCohosts`, `removeEventCohost` | Guest Manager (co-hosts section) |
| `createInvite`, `getInvitesByEvent`, `updateInviteStatus`, `approveInviteRequest`, `moveInviteToWaitlist` | Guest Manager |
| `recordRsvp`, `getRsvpsByEvent`, `updateRsvp`, `checkInRsvp` | Guest Manager (check-in mode) |
| `createQuestion`, `getQuestionsByEvent`, `deleteQuestion`, `saveQuestionResponse`, `getQuestionResponsesByRsvp` | Polls & Questions |
| `createPoll`, `getPollsByEvent`, `votePollOption`, `getPollVotes`, `closePoll` | Polls & Questions |
| `createAnnouncement`, `markAnnouncementSent`, `getAnnouncementsByEvent` | Event Feed |
| `createComment`, `getCommentsByEvent` | Event Feed |
| `addPhoto`, `getPhotosByEvent`, `deletePhoto` | Event Feed |
| `setEventLink`, `getEventLinksByEvent`, `deleteEventLink` | Event Detail (overflow menu) |
| `getRsvpSummary`, `getEventAnalytics`, `exportAttendanceCsv` | Event Detail, Guest Manager |
| `getSetting`, `setSetting` | Settings |
| `getCalendarEventId`, `setCalendarEventId` | Event Detail (Add to Calendar) |
| `createExpense`, `getExpensesByEvent`, `updateExpense`, `deleteExpense` | Expense Splitter |
| `createExpenseSplit`, `getExpenseSplitsByExpense`, `markSplitSettled`, `markSplitUnsettled` | Expense Splitter |
| `getDietaryResponses` | Guest Manager (dietary summary) |
| `generateICalString`, `generateGoogleCalendarUrl`, `eventToICalEvent` | Event Detail (calendar sync) |
| `calculateEqualSplit`, `calculateSettlements`, `validateCustomSplit` | Expense Splitter |
| `getTemplates`, `getTemplateById`, `applyTemplate` | Create Event (step 1) |
| `DIETARY_OPTIONS`, `parseDietaryAnswer`, `formatDietaryAnswer`, `aggregateDietaryResponses` | Guest Manager (dietary) |
| `calculateNextOccurrence`, `generateOccurrences`, `shouldGenerateMore` | Create Event (recurring settings) |
| `createRecurrenceRule`, `getRecurrenceRule`, `deleteRecurrenceRule` | Create Event, Event Detail |
| `createSeriesEntry`, `getSeriesByParent`, `cancelOccurrence`, `markOccurrenceModified` | Events List (recurring badge), Event Detail |
| `setEventCoordinates`, `getEventCoordinates` | Create Event (location), Event Detail |
| `buildAppleMapsUrl`, `buildGoogleMapsUrl`, `buildMapsSearchUrl`, `isVirtualLocation`, `buildDirectionsUrl` | Event Detail (directions) |
| `setEventDesign`, `getEventDesign` | Create Event (step 3), Event Detail (hero bg) |
| `INVITATION_DESIGNS`, `getDesigns`, `getDesignById`, `getDesignsByCategory`, `applyDesignOverrides`, `autoContrastTextColor` | Create Event (design picker) |
| `isRecapAvailable`, `calculateDurationMinutes`, `formatDuration`, `generateRecap` | Event Detail (recap section) |
| `createMessage`, `getMessagesByEvent`, `getPinnedMessages`, `pinMessage`, `unpinMessage`, `deleteMessage`, `getMessageCount` | Event Feed |
| `createRegistryItem`, `getRegistryItemsByEvent`, `updateRegistryItem`, `deleteRegistryItem`, `claimRegistryItem`, `unclaimRegistryItem` | Gift Registry |
| `createSeatingTable`, `getTablesByEvent`, `updateSeatingTable`, `deleteSeatingTable` | Seating Chart |
| `assignSeat`, `getAssignmentsByTable`, `getAssignmentsByEvent`, `removeSeatAssignment` | Seating Chart |
| `validateAssignment`, `calculateRemainingCapacity`, `autoAssign`, `getUnassignedGuests`, `generateSeatingText` | Seating Chart |

### External Dependencies (Mobile)
- `@react-native-community/datetimepicker` -- date/time pickers for Create Event
- `expo-calendar` -- device calendar sync (already in calendar sync spec)
- `expo-sharing` -- share .ics files and seating text
- `expo-image-picker` -- photo uploads for feed and cover images
- `expo-blur` -- glass morphism BlurView for event cards

### Engineering Requirements (from /plan-eng-review)

**Batch query:** Events List must NOT call `getRsvpSummary` per event card (N+1). Add `getEventsSummary(db, eventIds: string[]): Map<string, RsvpSummary>` to `modules/rsvp/src/db/crud.ts` that does one aggregate query with `WHERE event_id IN (...)`.

**Create Event form state:** Use `useReducer` with typed actions (SET_FIELD, APPLY_TEMPLATE, NEXT_STEP, PREV_STEP) instead of 30+ individual `useState` calls. Extract to `useCreateEventForm()` custom hook.

**List virtualization:** Screens with variable-length data exceeding 30 items must use `FlatList` (virtualized), not `ScrollView`:
- Guest Manager (guests can be 200+)
- Event Feed (messages can be 100+)
- Expense Splitter (expenses can be 20+)
- Gift Registry (items can be 50+)

Screens OK with `ScrollView`: Events List (<30 events typically), Polls (<10), Seating (<10 tables), Event Detail (fixed section count).

**Expense settlement mapping:** Settling an aggregate "Chris -> Alex $9" row requires a helper function `settleAggregate(db, eventId, from, to)` that:
1. Finds all expenses where `paidByName = to`
2. For each, finds splits where `participantName = from` AND `isSettled = false`
3. Calls `markSplitSettled(splitId)` on each

**Double-tap prevention:** All action buttons that trigger state transitions (Approve, Waitlist, Check In, Settle, Claim) must disable immediately on press (optimistic UI) and re-enable on data refresh. Prevents duplicate state transitions.

### Priority Order for Implementation
1. Events List + Event Detail (foundation -- all other screens link from here)
2. Create Event with template picker (core creation flow)
3. Guest Manager with check-in mode (most-used feature)
4. Event Feed (comments, photos, messages)
5. Polls & Questions (group decision making)
6. Expense Splitter (post-event settlements)
7. Gift Registry (event-specific feature)
8. Seating Chart (large events only)
9. Settings (minimal configuration)

---

## Interaction State Matrix

Every screen must handle all 5 states. DESIGN.md defines the patterns (skeletons at 60% opacity, glass card errors with retry, warm empty states with CTA).

| Screen | Loading | Empty | Error | Success | Partial |
|--------|---------|-------|-------|---------|---------|
| Events List | 3 skeleton event cards, glass bg, 60% pulse | "Plan something special" onboarding card (first-time) or "Your events are waiting" + Create CTA (returning) | "Couldn't load events" glass card + [Retry] | Event cards visible | Some events load, others fail: show loaded + inline retry |
| Event Detail | Skeleton header (3 lines) + 6 skeleton section rows | N/A (event must exist to reach this screen) | "Event not found" glass card + [Back to events] | Full workspace visible | Section rows show counts as "--" while loading |
| Create Event | Template cards pulse while loading template data | N/A (creation form always renders) | Toast: "Failed to create event. Try again." | Navigate to new event detail | N/A |
| Guest Manager | 5 skeleton rows, alternating height | "No guests yet. Start inviting!" + [Add Guest] CTA | "Failed to load guest list" + [Retry] | Guest rows visible with status badges | Some guests load, show loaded + spinner at bottom |
| Polls | 2 skeleton poll cards | "Start a conversation. Create a poll!" + [New Poll] CTA | "Failed to load polls" + inline retry | Poll cards with vote bars | N/A |
| Event Feed | 3 skeleton message rows | "No messages yet. Be the first to share!" + focus input bar | "Failed to load feed" + [Retry] | Chronological feed visible | First 20 items load, [Load more] at bottom |
| Gift Registry | 3 skeleton item rows | "No registry items yet. Add wishes for your event." + [Add Item] CTA | "Failed to load registry" + [Retry] | Item rows with claim status | N/A |
| Seating Chart | 2 skeleton table cards | "No tables yet. Set up your seating." + [Add Table] CTA | "Failed to load seating" + [Retry] | Table rows with capacity bars | N/A |
| Expense Splitter | 3 skeleton expense rows | "No expenses tracked. Add a shared cost." + [Add Expense] CTA | "Failed to load expenses" + [Retry] | Expense rows + settlement summary | N/A |
| Settings | Form fields render instantly (local data) | N/A (settings always has defaults) | Toast on save failure | Toast: "Settings saved" | N/A |

**Loading pattern:** Skeleton shapes match content layout. Glass card shapes, pulsing at 60% opacity, 1s ease-in-out infinite. NOT spinners (DESIGN.md anti-pattern).

**Error pattern:** Full-screen errors use glass card with `danger` color text + [Retry] button. Inline errors use `danger` color text below affected element. Network errors: "You're offline. Your data is safe -- it's all on your device."

**Empty state pattern:** Module-specific warm headline (not "No items found"), 1 sentence about what this section does, primary CTA button in module accent color.

---

## Accessibility Requirements

All specifications follow DESIGN.md accessibility requirements (line 152-158).

### Touch Targets
- All buttons, chips, interactive rows: minimum 44x44px
- Check-in buttons: 48x48px (large tap targets for day-of usage in crowds)
- Filter chips: 44px height, `sm` (8px) gap between chips
- Swipe-to-delete reveal area: 60px wide minimum

### VoiceOver Labels (per screen)
- Event card: "[Title], [Date], [Location], [N] going"
- Event Detail section row: "[Section name], [count], [status]. Double tap to open."
- Guest row: "[Name], [RSVP status], plus [N]"
- Poll option: "[Label], [N] votes, [percent]. Double tap to vote."
- Expense row: "[Description], [amount], paid by [name], [N] of [M] settled"
- Registry item: "[Name], [category], [price], [claimed/available]"
- Seating table: "[Label], [shape], [N] of [capacity] seated"

### Reduced Motion
When `prefers-reduced-motion` is enabled:
- Skeleton pulse: replace with static 60% opacity (no animation)
- Card stagger: instant appearance (no 50ms delay)
- Vote bar animation: instant fill (no transition)
- Page transitions: instant (no 300ms slide)
- Bottom sheet: instant appear/dismiss (no slide animation)

### Contrast Validation
- Rose accent (`#FB7185`) on `background` (`#0A0A0F`): 5.2:1 ratio (AA pass)
- Rose accent on `surface` (`#12121A`): 4.6:1 ratio (AA pass)
- `text` on `background`: 18.3:1 ratio (AAA pass)
- `textSecondary` on `surface`: verify 4.5:1 minimum (AA requirement)
- `textTertiary` on `surface`: used only for placeholder text, not required to pass AA

---

## Component Patterns

### Standard Bottom Sheet
Used by: Add Guest, Create Poll, Add Expense, Add Registry Item, Add Table, Overflow Menu.

```
┌─────────────────────────────────┐
│        ────────                  │  Drag handle: 4px height, 40px wide, 60% opacity
│ Title                    [X]   │  Close button (optional, for complex sheets)
├─────────────────────────────────┤
│                                 │
│ [Scrollable form content]       │  Content area
│                                 │
├─────────────────────────────────┤
│ [     Primary Action          ] │  Sticky CTA (accent color)
└─────────────────────────────────┘
```

- **Background:** `glass.strong` + `blur(60px)`
- **Max height:** 70% of screen. If content exceeds, content area scrolls.
- **Dismiss:** Swipe down on drag handle OR tap outside the sheet.
- **Keyboard:** Content scrolls up when keyboard appears. CTA stays visible above keyboard.
- **Animation:** 300ms ease-out slide from bottom. Reduced motion: instant.
- **Border radius:** `xxl` (24px) on top corners only.

### Confirmation Dialog
Used by: Delete Event, Delete Guest, Remove Assignment, Clear Data.

```
┌──────────────────────────────┐
│ [Title]                      │  subheading variant
│                              │
│ [Warm description of what    │  body variant, textSecondary
│  will happen. Not scary.]    │
│                              │
│ [Cancel]          [Action]   │  Cancel=ghost, Action=danger
└──────────────────────────────┘
```

- **Background:** `glass.strong` centered modal with backdrop overlay (rgba(0,0,0,0.5))
- **Cancel button:** Ghost style (transparent bg, textSecondary)
- **Destructive button:** `danger` background, white text
- **Border radius:** `xl` (16px)
- **Animation:** 200ms fade-in. Reduced motion: instant.

### Gesture Library
Standardized gesture patterns across all screens:

| Gesture | Behavior | Animation |
|---------|----------|-----------|
| Swipe left on row | Reveals red destructive button (e.g., [Delete]). Swipe back to hide. Tapping button triggers confirmation dialog. | 200ms ease-out slide |
| Long-press on item | Opens context menu (glass.strong bg, centered on item) with 2-4 action options | 150ms scale(0.97) on press, menu fades in 200ms |
| Pull-to-refresh | 45-degree pull from top reveals refresh indicator. Release to refresh. Completes with "updated 2s ago" timestamp. | Native iOS/Android refresh control |
| Tap | Immediate action: navigate, toggle, select. No delay. | N/A |

### Scroll Zone Definitions

| Screen | Sticky Elements | Scrollable Content |
|--------|----------------|-------------------|
| Events List | Header (MyRSVP + bell icon), segment control | Event cards list |
| Event Detail | Header (title + overflow menu) | RSVP summary, action row, section rows, recap |
| Create Event Step 3 | Header (Back/Create), [Create Event] button at bottom | Settings toggles, design picker, checklist |
| Guest Manager | Header + filter chips (top), add guest input bar (bottom) | Guest rows |
| Polls | Header + tab toggle (Polls/Questions) | Poll/question list |
| Event Feed | Header, bottom input bar | Feed items |
| Gift Registry | Header + progress bar + category chips | Item rows |
| Seating Chart | Header + summary bar | Table rows + unassigned section |
| Expense Splitter | Header + total summary | Expense rows + settlement section |

### Token Reference (consistent usage)

Never hardcode hex values. Always reference DESIGN.md tokens:

| UI Element | Background | Text | Border | Radius |
|-----------|-----------|------|--------|--------|
| Event card | `glass.card` | `text` / `textSecondary` | `border` | `xl` (16px) |
| Section row (Event Detail) | transparent | `text` + `textSecondary` | `border` (bottom only) | none |
| Guest/expense/registry row | transparent | `text` + `textSecondary` | `border` (bottom only) | none |
| Filter chip (inactive) | `surface` | `textSecondary` | `border` | `pill` (999px) |
| Filter chip (active) | `colors.modules.rsvp` | `background` | none | `pill` (999px) |
| Primary button | `colors.modules.rsvp` | white | none | `md` (8px) |
| Secondary button | `glass.strong` | `text` | `border` | `md` (8px) |
| Bottom sheet | `glass.strong` + blur | `text` | `glassBorder` | `xxl` top only |
| Input field | `surfaceElevated` | `text` | `border` | `md` (8px) |
| Skeleton placeholder | `glass.card` at 60% | -- | none | matches content shape |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (stale) | 3 critical gaps, scope expansion mode |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | ISSUES | 7 findings, 2 accepted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 issues, 1 critical gap, 0 unresolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | 9/10 | score: 6/10 -> 8/10, 7 decisions |

**DESIGN REVIEW:** Codex hard-rejected stacked-cards layout (resolved: dense rows). Claude subagent found 18+ issues (resolved: state matrix, a11y, tokens).
**ENG REVIEW:** N+1 batch query, useReducer for create form, FlatList for large lists, 10 test files, user model clarification, expense settlement mapping.
**CODEX OUTSIDE VOICE:** User model gap (accepted), settlement data mismatch (accepted), overbuilt scope (rejected -- spec scope is appropriate, implementation should be phased).
**UNRESOLVED:** 0 decisions deferred.
**VERDICT:** DESIGN + ENG CLEARED. Ready to implement.

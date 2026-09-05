# MyRSVP - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyRSVP
- **Tagline:** "Events, invites, and RSVP tracking"
- **Module ID:** `rsvp`
- **Feature ID Prefix:** RS (e.g., `RS-001`, `RS-002`)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Social Host (Sarah) | 25-40, hosts 4-10 events/year (dinners, game nights, birthdays), comfortable with apps | Create events quickly, track who is coming, collect dietary preferences, share photos afterward |
| Event Planner (Priya) | 30-50, organizes formal events (weddings, showers, galas), detail-oriented | Manage large guest lists with seating, track RSVPs with plus-ones, coordinate co-hosts, handle waitlists |
| Casual Organizer (Jake) | 20-35, organizes recurring hangouts (weekly game night, monthly potluck), low-friction preference | Set up recurring events once and forget, send quick polls, split costs afterward |
| Guest (Any) | Any age, receives invitations and needs to respond | RSVP quickly, see event details, find directions, upload photos, coordinate with other guests |

### 1.3 Core Value Proposition

MyRSVP is a privacy-first event planning and guest management app that replaces ad-supported platforms like Evite and venture-funded alternatives like Partiful. It covers the full event lifecycle: creation, invitation, RSVP collection with plus-ones, polls, announcements, photo albums, check-in at the door, waitlist management, and co-host coordination. All guest lists, event history, and social connections stay on the host's device, never shared with ad networks or third parties.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Evite | Established brand, custom invitation designs, gift registry integration, large template library | Heavy ads on free tier, $14.99-$19.99/event for premium, collects guest email addresses for marketing, dated UI | Zero ads, privacy-first (guest data never leaves device), included in MyLife subscription, modern UI |
| Partiful | Modern design, free tier, popular with younger demographics, good mobile experience | Venture-funded (monetization model uncertain), requires cloud accounts, limited offline support, no recurring events | No account required, works offline, recurring events, expense splitting, dietary collection, cross-module integrations |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates a share action

**Product-specific privacy notes:**
- Guest contact information (names, phone numbers, emails) is stored only on the host's device and never transmitted to any server
- When sharing invitations, the system generates a shareable link or image; no guest data is included in the shared content
- Photo albums are stored locally; guests add photos by sending them to the host through the share sheet, not through a cloud service
- Event history and social graph (who attended which events) remain strictly on-device, unlike Evite which mines this data for advertising

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| RS-001 | Event Creation | P0 | Core | None | Implemented |
| RS-002 | Event Types | P0 | Core | RS-001 | Implemented |
| RS-003 | Guest Invite Management | P0 | Core | RS-001 | Implemented |
| RS-004 | RSVP System | P0 | Core | RS-001, RS-003 | Implemented |
| RS-005 | Polls | P0 | Core | RS-001 | Implemented |
| RS-006 | Announcements | P0 | Core | RS-001 | Implemented |
| RS-007 | Photo Albums | P1 | Social | RS-001 | Implemented |
| RS-008 | Check-in System | P0 | Core | RS-001, RS-004 | Implemented |
| RS-009 | Waitlist Management | P0 | Core | RS-001, RS-004 | Implemented |
| RS-010 | Co-host Management | P1 | Core | RS-001 | Implemented |
| RS-011 | Event History | P1 | Data Management | RS-001 | Implemented |
| RS-012 | Calendar Sync / iCal Export | P0 | Import/Export | RS-001 | Not Started |
| RS-013 | Event Templates | P1 | Onboarding | RS-001, RS-002 | Not Started |
| RS-014 | Custom Invitation Designs | P1 | Social | RS-001 | Not Started |
| RS-015 | Gift Registry / Wishlist | P2 | Social | RS-001 | Not Started |
| RS-016 | Expense Splitting | P1 | Core | RS-001, RS-004 | Not Started |
| RS-017 | Event Recap / Memories | P2 | Analytics | RS-001, RS-007 | Not Started |
| RS-018 | Recurring Events | P1 | Core | RS-001, RS-003 | Not Started |
| RS-019 | Map / Directions Integration | P1 | Core | RS-001 | Not Started |
| RS-020 | Dietary Preference Collection | P1 | Core | RS-001, RS-004 | Not Started |
| RS-021 | Seating Arrangement Tool | P3 | Core | RS-001, RS-004 | Not Started |
| RS-022 | Guest Messaging / Event Chat | P2 | Social | RS-001, RS-004 | Not Started |
| RS-023 | Event Budget Tracker | P2 | Analytics | RS-001 | Not Started |
| RS-024 | QR Code Check-in | P1 | Core | RS-001, RS-008 | Not Started |
| RS-025 | Event Countdown Widget | P2 | Settings | RS-001 | Not Started |
| RS-026 | Guest Tags / Groups | P1 | Data Management | RS-001, RS-003 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (import from competitors, export user data)
- **Social** - Sharing, community, collaborative features
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data

---

## 3. Feature Specifications

### RS-001: Event Creation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-001 |
| **Feature Name** | Event Creation |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to create an event with a title, date, time, location, and description, so that I can organize a gathering and invite people.

**Secondary:**
> As an Event Planner, I want to configure event settings like capacity limits, plus-one policies, and visibility, so that I can control how the event is managed.

#### 3.3 Detailed Description

Event creation is the foundational feature of MyRSVP. The host fills out a form with event details including title, description, date/time with timezone, location (name and/or address), and an optional cover image. Advanced settings allow the host to control visibility (public, unlisted, private), set a maximum guest capacity, enable or disable plus-ones, toggle a waitlist, require approval for RSVPs, and set a password for private events.

The creation form is designed for speed: only title and start date/time are required. All other fields are optional and default to sensible values (private visibility, plus-ones allowed, no capacity limit, waitlist enabled). The host can also toggle feature flags for the event: photo albums, comments, polls, co-hosts, and chip-in/expense collection.

Events are stored locally in SQLite with the `rv_` table prefix. Each event gets a unique UUID. The event stores both a location name (e.g., "Jake's House") and a location address (e.g., "123 Main St, San Francisco, CA") separately, so the map integration (RS-019) can geocode the address while showing the friendly name.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the root feature)

**External Dependencies:**
- Local storage for SQLite database
- Image picker for cover image selection (uses device photo library)

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- UUID generation is available

#### 3.5 User Interface Requirements

##### Screen: Create Event Form

**Layout:**
- The screen is a scrollable form with a top navigation bar showing "New Event" as the title and a "Save" button on the right (disabled until required fields are filled)
- At the top is a cover image area: a large tappable rectangle (16:9 aspect ratio) showing either a placeholder illustration or the selected image. Tapping opens the image picker
- Below the cover image is the required fields section: Title (text input, large font) and Start Date/Time (date-time picker with timezone selector)
- Below required fields is an optional fields section: Description (multiline text area), End Date/Time (date-time picker), Location Name (text input), Location Address (text input with map icon)
- Below optional fields is a "Settings" collapsible section containing toggle switches: Visibility (segmented control: Public/Unlisted/Private), Password (text input, shown only when Private is selected), Max Guests (number input with stepper), Allow Plus-Ones (toggle), Waitlist Enabled (toggle), Require Approval (toggle)
- Below settings is a "Features" collapsible section with toggles: Photo Album, Comments, Polls, Co-hosts, Chip-In/Expenses
- A "Create Event" button at the bottom of the form

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Form just opened | All fields empty, cover image shows placeholder, Save button disabled |
| Partial | Some fields filled | Save button remains disabled until title and start date are provided |
| Valid | Title and start date filled | Save button enabled, accent color highlight |
| Saving | User tapped Save | Brief loading spinner on Save button, form inputs disabled |
| Error | Save failed | Toast notification at top: "Could not save event. Please try again." |

**Interactions:**
- Tap cover image area: Opens device image picker (photo library)
- Tap "Start Date/Time": Opens native date-time picker with timezone selector
- Tap "End Date/Time": Opens native date-time picker; defaults to 2 hours after start time
- Toggle "Private" visibility: Shows password field below the segmented control
- Tap "Create Event": Validates form, saves to database, navigates to event detail screen

**Transitions/Animations:**
- Settings and Features sections expand/collapse with a 200ms slide animation
- Cover image fades in when selected, 150ms duration
- Form scrolls to first error field if validation fails

##### Modal: Image Picker

**Layout:**
- Standard OS image picker (photo library access)
- After selection, image is cropped to 16:9 aspect ratio
- Image is stored as a local file URI in the database

#### 3.6 Data Requirements

##### Entity: Event

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique event identifier |
| title | string | Required, max 200 chars | None | Event name displayed on cards and detail |
| description | string | Optional, max 5000 chars | null | Detailed event description with rich text support |
| start_at | datetime | Required, ISO 8601 | None | Event start date and time |
| end_at | datetime | Optional, ISO 8601 | null | Event end date and time |
| timezone | string | Required, IANA timezone identifier | 'UTC' | Event timezone (e.g., 'America/Los_Angeles') |
| location_name | string | Optional, max 255 chars | null | Friendly venue name (e.g., "Jake's House") |
| location_address | string | Optional, max 500 chars | null | Street address for geocoding and directions |
| cover_image_url | string | Optional, local file URI | null | Path to cover image on device |
| visibility | enum | One of: public, unlisted, private | 'private' | Who can discover this event |
| password | string | Optional, max 100 chars | null | Password for private events |
| requires_approval | boolean | - | false | Whether RSVPs need host approval |
| allow_plus_ones | boolean | - | true | Whether guests can bring plus-ones |
| max_guests | integer | Optional, min: 1, max: 10000 | null | Maximum number of guests (null = unlimited) |
| waitlist_enabled | boolean | - | true | Whether to auto-waitlist when capacity is full |
| allow_photo_album | boolean | - | true | Whether the photo album feature is active |
| allow_comments | boolean | - | true | Whether the comments/chat feature is active |
| allow_polls | boolean | - | true | Whether polls can be created |
| allow_cohosts | boolean | - | true | Whether co-hosts can be added |
| allow_chip_in | boolean | - | true | Whether expense tracking/splitting is active |
| chip_in_url | string | Optional, URL | null | External payment link (Venmo, PayPal, etc.) |
| created_by | string | Optional | null | Host identifier |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Validation Rules:**
- title: Must not be empty string after trimming whitespace; max 200 characters
- start_at: Must be a valid ISO 8601 datetime string
- end_at: If provided, must be after start_at
- max_guests: If provided, must be a positive integer between 1 and 10000
- password: Required if visibility is 'private' and the host wants password protection; otherwise optional
- timezone: Must be a valid IANA timezone identifier

**Example Data:**

```json
{
  "id": "e1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "title": "Sarah's 30th Birthday",
  "description": "Join us for an evening of food, drinks, and celebration!",
  "startAt": "2026-04-15T19:00:00-07:00",
  "endAt": "2026-04-15T23:00:00-07:00",
  "timezone": "America/Los_Angeles",
  "locationName": "The Rooftop Lounge",
  "locationAddress": "456 Market St, San Francisco, CA 94105",
  "coverImageUrl": "file:///var/mobile/.../cover-birthday.jpg",
  "visibility": "private",
  "password": null,
  "requiresApproval": false,
  "allowPlusOnes": true,
  "maxGuests": 50,
  "waitlistEnabled": true,
  "allowPhotoAlbum": true,
  "allowComments": true,
  "allowPolls": true,
  "allowCohosts": true,
  "allowChipIn": true,
  "chipInUrl": null,
  "createdBy": "host",
  "createdAt": "2026-03-01T10:30:00Z",
  "updatedAt": "2026-03-01T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Event Creation Defaults

**Purpose:** Apply sensible defaults for optional fields to minimize required user input.

**Logic:**

```
1. Generate UUID for event ID
2. SET timezone = device timezone if not specified
3. SET end_at = start_at + 2 hours if not specified
4. SET visibility = 'private'
5. SET all feature toggles (photo_album, comments, polls, cohosts, chip_in) = true
6. SET allow_plus_ones = true
7. SET waitlist_enabled = true
8. SET requires_approval = false
9. SET max_guests = null (unlimited)
10. INSERT event into rv_events
11. RETURN event ID
```

**Edge Cases:**
- start_at in the past: Allow creation (user may be logging a past event), but display a warning banner "This event date is in the past"
- title is whitespace only: Reject with validation error "Title is required"
- end_at before start_at: Reject with validation error "End time must be after start time"
- max_guests set to 0: Reject with validation error "Capacity must be at least 1"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails | Toast: "Could not save event. Please try again." | User taps retry or navigates back and tries again |
| Title left blank | Inline validation below title field: "Title is required" | User fills in title, error clears immediately |
| End time before start time | Inline validation: "End time must be after start time" | User corrects the time, error clears on change |
| Image picker fails | Toast: "Could not load image. Try a different photo." | User selects a different image or skips cover image |
| Invalid timezone | Silently fall back to 'UTC' | No user action needed |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Title validation runs on blur and on submit
- Date cross-validation (end > start) runs when either date field changes

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Events tab with no events,
   **When** the user taps "Create Event" and fills in title "Game Night" and start date "2026-04-10 7:00 PM",
   **Then** the Save button becomes enabled and tapping it creates the event and navigates to the event detail screen.

2. **Given** the user is creating an event,
   **When** the user sets max guests to 20, enables waitlist, and sets visibility to private,
   **Then** the event is created with those settings and the detail screen reflects them.

3. **Given** the user is creating an event,
   **When** the user taps the cover image area and selects a photo,
   **Then** the selected photo appears in the cover image area at 16:9 aspect ratio.

**Edge Cases:**

4. **Given** the user sets start date to a date in the past,
   **When** the user saves the event,
   **Then** the event is created successfully but a warning banner appears: "This event date is in the past."

5. **Given** the user sets max_guests to 1,
   **When** the user saves the event,
   **Then** the event is created with capacity 1 and the waitlist becomes active after the first RSVP.

**Negative Tests:**

6. **Given** the title field is empty,
   **When** the user taps Save,
   **Then** the system shows inline validation "Title is required" and does not create the event.

7. **Given** end_at is set to 1 hour before start_at,
   **When** the user taps Save,
   **Then** the system shows inline validation "End time must be after start time" and does not create the event.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates event with required fields only | title: "Test", startAt: "2026-04-10T19:00:00Z" | Event record with defaults applied |
| applies default timezone | title: "Test", startAt: valid, timezone: undefined | timezone = 'UTC' |
| rejects empty title | title: "" | Validation error |
| rejects end_at before start_at | startAt: "2026-04-10T20:00:00Z", endAt: "2026-04-10T18:00:00Z" | Validation error |
| stores all optional fields | Full input with all fields | All fields persisted correctly |
| rejects max_guests of 0 | maxGuests: 0 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create event and verify listing | 1. Create event, 2. Query events list | New event appears in list sorted by start date |
| Create event and verify detail | 1. Create event with all fields, 2. Load event by ID | All fields match input values |
| Create event with cover image | 1. Select image, 2. Create event | Event has cover_image_url pointing to local file |

---

### RS-002: Event Types

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-002 |
| **Feature Name** | Event Types |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to categorize my event by type (birthday, dinner party, game night), so that the app can suggest relevant defaults and the event card displays an appropriate visual theme.

#### 3.3 Detailed Description

Events have a type classification that determines visual styling (icon, color accent), suggested default settings, and template availability (RS-013). The type is selected during event creation via a grid of icons. Available types are: Birthday, Dinner Party, Game Night, Wedding, Baby Shower, Holiday, Brunch, Happy Hour, Potluck, Movie Night, Outdoor/BBQ, Sports Watch Party, Graduation, Anniversary, Housewarming, Fundraiser, and Custom.

Each type has a default icon emoji, a suggested event duration, and suggested toggle defaults (e.g., Birthday defaults to allow_chip_in=true for gifts, Wedding defaults to requires_approval=true). The Custom type allows the user to pick any emoji as the icon.

The event type does not add a new database column. Instead, it is stored as a JSON property in the event description metadata or as a settings key-value pair in rv_settings scoped to the event. For simplicity, a new column `event_type` is added to rv_events.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Type is selected during event creation

**External Dependencies:**
- None

**Assumed Capabilities:**
- Event creation form is functional

#### 3.5 User Interface Requirements

##### Screen: Event Type Selector (within Create Event Form)

**Layout:**
- Positioned at the top of the Create Event form, below the cover image and above the title field
- A horizontal scrollable row of event type chips, each showing an emoji icon and the type label
- The selected type has a highlighted border in the module accent color (#FB7185)
- Tapping a type selects it and updates the form defaults
- "Custom" type shows an additional emoji picker when selected

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No selection | Form just opened | No type selected, defaults apply |
| Type selected | User tapped a type chip | Selected chip highlighted, form defaults updated |
| Custom selected | User tapped Custom | Emoji picker appears below the type row |

**Interactions:**
- Tap type chip: Selects that type, highlights it, and applies suggested defaults (does not overwrite fields the user already changed)
- Tap Custom: Shows emoji picker inline
- Tap selected chip again: Deselects it, reverts to no-type state

#### 3.6 Data Requirements

##### Event Type Definitions (Static Configuration)

| Type | Icon | Default Duration | Suggested Defaults |
|------|------|-----------------|-------------------|
| Birthday | :birthday: | 3 hours | allow_chip_in=true |
| Dinner Party | :fork_and_knife: | 3 hours | max_guests=12 |
| Game Night | :game_die: | 4 hours | allow_polls=true |
| Wedding | :ring: | 6 hours | requires_approval=true, max_guests=200 |
| Baby Shower | :baby: | 3 hours | allow_chip_in=true |
| Holiday | :christmas_tree: | 4 hours | allow_plus_ones=true |
| Brunch | :pancakes: | 2 hours | max_guests=10 |
| Happy Hour | :cocktail_glass: | 2 hours | allow_plus_ones=true |
| Potluck | :green_salad: | 3 hours | allow_polls=true (for dish coordination) |
| Movie Night | :popcorn: | 3 hours | allow_polls=true (for movie selection) |
| Outdoor/BBQ | :fire: | 5 hours | allow_plus_ones=true |
| Sports Watch Party | :football: | 4 hours | allow_comments=true |
| Graduation | :mortar_board: | 3 hours | allow_photo_album=true |
| Anniversary | :sparkling_heart: | 3 hours | allow_chip_in=true |
| Housewarming | :house: | 4 hours | allow_plus_ones=true |
| Fundraiser | :money_with_wings: | 3 hours | allow_chip_in=true |
| Custom | User-selected emoji | 3 hours | No overrides |

##### Field Addition to Event Entity

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| event_type | string | Optional, max 50 chars | null | Event type identifier (e.g., 'birthday', 'dinner_party', 'custom') |
| event_type_emoji | string | Optional, single emoji | null | Custom emoji for Custom type events |

#### 3.7 Business Logic Rules

##### Type Default Application

**Purpose:** Apply type-specific defaults without overwriting user-modified fields.

**Logic:**

```
1. User selects event type
2. FOR each suggested default for that type:
   a. IF the user has NOT manually changed that field:
      APPLY the suggested default value
   b. ELSE:
      KEEP the user's value
3. SET event_type field on the event record
4. IF type is Custom:
   SET event_type_emoji to the user-selected emoji
```

**Edge Cases:**
- User selects a type, modifies defaults, then changes type: Only apply new type defaults to fields the user has not manually changed since form load
- User deselects type: Do not revert any field values; only clear event_type

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Emoji picker fails to load | Show a text input fallback labeled "Enter emoji" | User types or pastes an emoji character |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Create Event form,
   **When** the user taps "Birthday",
   **Then** the Birthday chip is highlighted and allow_chip_in defaults to true.

2. **Given** the user selects "Wedding",
   **When** the event is created,
   **Then** the event record has event_type='wedding' and requires_approval=true.

3. **Given** the user selects "Custom",
   **When** the user picks the rocket emoji,
   **Then** the event record has event_type='custom' and event_type_emoji is the rocket emoji.

**Edge Cases:**

4. **Given** the user manually sets max_guests to 50, then selects "Dinner Party" (which suggests max_guests=12),
   **When** the form updates,
   **Then** max_guests remains 50 (user override is preserved).

**Negative Tests:**

5. **Given** no event type is selected,
   **When** the user creates the event,
   **Then** the event is created successfully with event_type=null.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| applies birthday defaults | type: 'birthday' | allow_chip_in=true |
| applies wedding defaults | type: 'wedding' | requires_approval=true, max_guests=200 |
| preserves user overrides | user set max_guests=50, then type='dinner_party' | max_guests=50 (not 12) |
| stores custom emoji | type: 'custom', emoji: rocket | event_type_emoji = rocket emoji |
| handles null type | type: undefined | event_type=null, no defaults applied |

---

### RS-003: Guest Invite Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-003 |
| **Feature Name** | Guest Invite Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to add guests to my event by name and optionally by contact info, so that I can track who has been invited and who has not yet responded.

**Secondary:**
> As an Event Planner, I want to send invitations via the device share sheet (iMessage, email, WhatsApp), so that guests receive a link or image with event details.

#### 3.3 Detailed Description

The invite management system allows the host to build a guest list for each event. Guests are added by name with optional contact information (phone number or email). Each invite tracks its status through a lifecycle: invited, requested (for public/unlisted events where guests request to join), approved, declined, or waitlisted.

The host can send invitations through the device's native share sheet, which generates either a shareable link (for events with a web view) or a formatted text/image with event details. The invite type tracks how the invitation was sent: 'link' (share sheet), 'direct' (manual add), or 'import' (from contacts).

Each invite can have a plus-one limit, controlling how many additional guests the invitee can bring. A limit of 0 means no plus-ones; a limit of 3 means the invitee can bring up to 3 additional guests.

The guest list view shows all invites grouped by status with counts per group. The host can search and filter the list by name, status, or response.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Invites belong to an event

**External Dependencies:**
- Device share sheet for sending invitations
- Device contacts API (optional, for importing guest names)

**Assumed Capabilities:**
- Event detail screen is accessible

#### 3.5 User Interface Requirements

##### Screen: Guest List (within Event Detail)

**Layout:**
- A tab or section within the event detail screen showing the full guest list
- At the top: a summary bar showing total invited count, going count, pending count, declined count
- Below the summary: a search bar for filtering by guest name
- Below the search: a segmented filter (All / Going / Maybe / Declined / Pending / Waitlisted)
- The main content is a scrollable list of invite cards, each showing: guest name, contact info (if available), invite status badge, plus-one info (e.g., "+2"), and response timestamp
- A floating action button (FAB) labeled "Add Guest" in the bottom-right
- Each invite card has a swipe-right action for quick status change and swipe-left to delete

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No guests invited | Illustration with message "No guests yet" and "Add your first guest" CTA button |
| Populated | Guests exist | Scrollable list grouped by status |
| Search Active | User typed in search bar | Filtered list; "No matches" if no results |
| Filtered | Segment selected | List filtered to selected status |

**Interactions:**
- Tap "Add Guest" FAB: Opens Add Guest modal
- Tap invite card: Opens invite detail/edit modal
- Swipe right on card: Quick-change status (e.g., approve a request)
- Swipe left on card: Delete invite with confirmation
- Tap share icon on invite: Opens share sheet with invitation content
- Pull to refresh: Re-queries the database

##### Modal: Add Guest

**Layout:**
- A bottom sheet modal with fields: Name (required text input), Contact (optional, phone/email), Plus-One Limit (number stepper, default 0), Notes (optional multiline text)
- An "Import from Contacts" button that opens the device contacts picker
- A "Save & Add Another" button and a "Save & Close" button at the bottom

**Interactions:**
- Tap "Import from Contacts": Opens device contacts picker; selected contact fills Name and Contact fields
- Tap "Save & Add Another": Saves invite, clears form, keeps modal open for batch adding
- Tap "Save & Close": Saves invite, closes modal, returns to guest list

#### 3.6 Data Requirements

##### Entity: Invite

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique invite identifier |
| event_id | string | FK to rv_events.id, required, ON DELETE CASCADE | None | Parent event |
| invitee_name | string | Required, max 200 chars | None | Guest's display name |
| invitee_contact | string | Optional, max 200 chars | null | Phone number or email |
| invitee_type | string | One of: link, direct, import | 'link' | How the invitation was created |
| status | enum | One of: invited, requested, approved, declined, waitlisted | 'invited' | Current invite lifecycle status |
| plus_one_limit | integer | Min: 0, Max: 10 | 0 | Maximum additional guests this invitee can bring |
| notes | string | Optional, max 1000 chars | null | Host's private notes about this guest |
| created_at | datetime | Auto-set | Current timestamp | When the invite was created |
| updated_at | datetime | Auto-set | Current timestamp | Last status change |

**Indexes:**
- event_id: Frequently queried for listing all invites for an event
- status: Frequently queried for filtering by invite status

**Validation Rules:**
- invitee_name: Must not be empty after trimming whitespace
- plus_one_limit: Must be between 0 and 10 inclusive
- status transitions are governed by the Invite Status State Machine (see RS-004)

#### 3.7 Business Logic Rules

##### Invite Status State Machine

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| invited | Guest RSVPs | approved | Create RSVP record, update invite updated_at |
| invited | Host removes invite | (deleted) | Delete invite record |
| requested | Host approves | approved | Update invite updated_at |
| requested | Host declines | declined | Update invite updated_at |
| requested | Capacity full | waitlisted | Update invite updated_at |
| approved | Guest cancels | declined | Update RSVP response to 'declined' |
| approved | Host moves to waitlist | waitlisted | Update RSVP response to 'waitlisted' |
| waitlisted | Capacity opens | approved | Auto-promote, notify guest |
| waitlisted | Host manually approves | approved | Update invite updated_at |
| declined | Guest re-RSVPs | approved (if capacity) or waitlisted | Create new RSVP record |

##### Batch Import from Contacts

**Purpose:** Allow quick addition of multiple guests from device contacts.

**Logic:**

```
1. User opens contacts picker (multi-select mode)
2. FOR each selected contact:
   a. Extract name and primary phone/email
   b. Check for duplicate (same name + same contact for this event)
   c. IF duplicate: skip and add to "skipped" list
   d. ELSE: create invite with invitee_type='import'
3. Show summary: "Added X guests, skipped Y duplicates"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate guest name for same event | Warning toast: "A guest named [name] already exists for this event" | User modifies name or cancels |
| Contacts permission denied | Message: "Contacts access is needed to import guests. Enable in Settings." | Link to device settings |
| Database write fails on invite creation | Toast: "Could not add guest. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an event exists with no guests,
   **When** the host adds a guest named "Alice" with plus-one limit 1,
   **Then** Alice appears in the guest list with status "invited" and "+1" badge.

2. **Given** an event has 5 invited guests,
   **When** the host taps "Share" on Alice's invite,
   **Then** the share sheet opens with event details formatted for sharing.

3. **Given** the host taps "Import from Contacts",
   **When** the host selects 3 contacts,
   **Then** 3 new invites are created with type "import" and the summary shows "Added 3 guests".

**Edge Cases:**

4. **Given** a guest named "Alice" already exists for this event,
   **When** the host tries to add another "Alice",
   **Then** a warning appears and the host can modify the name or cancel.

**Negative Tests:**

5. **Given** the Name field is empty,
   **When** the host taps Save,
   **Then** inline validation shows "Name is required" and the invite is not created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates invite with defaults | name: "Alice", eventId: valid | Invite with status='invited', plus_one_limit=0, type='link' |
| rejects empty name | name: "" | Validation error |
| enforces plus-one limit range | plusOneLimit: 15 | Validation error (max 10) |
| detects duplicate by name+event | existing "Alice" for event, add "Alice" again | Duplicate warning |
| batch import creates multiple | 3 contacts selected | 3 invite records created |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add guest and verify list | 1. Add guest "Bob", 2. Open guest list | Bob appears with status "invited" |
| Delete invite cascades | 1. Add guest, 2. Delete invite | Invite removed, RSVP records also removed |
| Filter by status | 1. Add 3 guests with different statuses, 2. Filter by "Going" | Only going guests shown |

---

### RS-004: RSVP System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-004 |
| **Feature Name** | RSVP System |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Guest, I want to respond to an event invitation with "Going", "Maybe", or "Decline", and optionally indicate how many plus-ones I am bringing, so that the host knows my attendance plans.

**Secondary:**
> As a Social Host, I want to see a real-time summary of RSVPs (going, maybe, declined counts) and manage responses, so that I can plan accordingly.

#### 3.3 Detailed Description

The RSVP system is the core interaction loop of MyRSVP. When a guest receives an invitation (via share sheet link, direct message, or in-app), they respond with one of four statuses: Going, Maybe, Declined, or Waitlisted (system-assigned when capacity is full).

Each RSVP records the guest's name, optional contact, response, plus-ones count, optional notes, response timestamp, and the source of the response (app, link, manual). The plus-ones count is validated against the invite's plus_one_limit.

The host sees a dashboard summary showing counts for each response category plus total expected headcount (going + going's plus-ones). The host can manually override any RSVP response, move guests to the waitlist, or mark guests as checked in (RS-008).

The RSVP lifecycle follows a state machine with these states: invited (no response yet), viewed (guest opened the invitation but has not responded), responded (going/maybe/declined), waitlisted (capacity full), checked_in (arrived at event), and cancelled (host or guest cancelled after responding).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - RSVPs belong to an event
- RS-003: Guest Invite Management - RSVPs are linked to invites

**External Dependencies:**
- None

**Assumed Capabilities:**
- Event detail screen is accessible
- Invite records exist

#### 3.5 User Interface Requirements

##### Screen: RSVP Dashboard (within Event Detail)

**Layout:**
- A section at the top of the event detail screen showing RSVP summary cards in a horizontal row: Going (green), Maybe (yellow), Declined (red), Waitlisted (gray), with counts and plus-ones shown
- Below the summary: a "Total Expected" count showing going + their plus-ones
- Below the total: a progress bar showing capacity usage (if max_guests is set)
- Below the progress bar: the full response list sorted by response date (most recent first)
- Each response card shows: guest name, response badge, plus-ones count, response timestamp, and a check-in button (if event day)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Responses | Event has invites but no RSVPs | Summary cards all show 0, message: "Waiting for responses..." |
| Partial | Some guests responded | Summary cards show counts, list shows responses |
| Full | All invited guests responded | Summary cards show final counts, response rate percentage displayed |
| Over Capacity | Going + plus-ones exceeds max_guests | Capacity bar turns red, "Over capacity by X" warning |
| Event Day | Current date matches event date | Check-in buttons appear on each response card |

**Interactions:**
- Tap summary card: Filters response list to that category
- Tap response card: Opens response detail with edit options
- Tap check-in button: Marks guest as checked in (see RS-008)
- Long press response card: Shows context menu (Change Response, Move to Waitlist, Remove)

##### Modal: Record RSVP (Host-side manual entry)

**Layout:**
- Bottom sheet with: Guest Name (text, auto-suggest from invite list), Response (segmented control: Going/Maybe/Declined), Plus-Ones (number stepper, max = invite's plus_one_limit), Notes (optional text area), Source (segmented: App/Link/Manual)
- "Save" button at bottom

#### 3.6 Data Requirements

##### Entity: RSVP

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique RSVP identifier |
| event_id | string | FK to rv_events.id, required, ON DELETE CASCADE | None | Parent event |
| invite_id | string | FK to rv_invites.id, optional, ON DELETE SET NULL | null | Linked invite (null for walk-in RSVPs) |
| guest_name | string | Required, max 200 chars | None | Respondent's name |
| guest_contact | string | Optional, max 200 chars | null | Phone or email |
| response | enum | One of: going, maybe, declined, waitlisted | 'maybe' | Current RSVP response |
| plus_ones_count | integer | Min: 0, Max: invite.plus_one_limit or 10 | 0 | Number of additional guests |
| notes | string | Optional, max 1000 chars | null | Guest's message to host |
| responded_at | datetime | Required, ISO 8601 | Current timestamp | When the response was recorded |
| checked_in_at | datetime | Optional, ISO 8601 | null | When the guest was checked in (see RS-008) |
| source | string | One of: app, link, manual | 'app' | How the RSVP was submitted |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Indexes:**
- event_id: Frequently queried for listing all RSVPs for an event
- response: Frequently queried for filtering and counting by response type
- checked_in_at: Queried for check-in filtering

**Validation Rules:**
- guest_name: Must not be empty after trimming
- plus_ones_count: Must not exceed the linked invite's plus_one_limit; if no linked invite, max is 10
- response: Must be one of the valid enum values
- If response is 'going' and event has max_guests, check capacity before accepting

#### 3.7 Business Logic Rules

##### RSVP State Machine

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| (none) | Guest responds "Going" | going | Create RSVP record, set responded_at, update invite status to 'approved', check capacity |
| (none) | Guest responds "Maybe" | maybe | Create RSVP record, set responded_at |
| (none) | Guest responds "Decline" | declined | Create RSVP record, set responded_at, update invite status to 'declined' |
| (none) | Guest responds "Going" but capacity full | waitlisted | Create RSVP with response='waitlisted', update invite status to 'waitlisted' |
| going | Guest changes to "Maybe" | maybe | Update RSVP response, update responded_at, recalculate capacity (may trigger waitlist promotion) |
| going | Guest changes to "Declined" | declined | Update RSVP response, update responded_at, trigger waitlist promotion check |
| going | Host checks guest in | going (checked_in_at set) | Set checked_in_at timestamp |
| maybe | Guest changes to "Going" | going (if capacity) or waitlisted | Update RSVP response, check capacity |
| maybe | Guest changes to "Declined" | declined | Update RSVP response |
| declined | Guest re-RSVPs "Going" | going (if capacity) or waitlisted | Update RSVP response, check capacity |
| waitlisted | Capacity opens | going | Auto-promote (oldest waitlisted first), update responded_at, notify |
| waitlisted | Host manually promotes | going | Update RSVP response to 'going' |
| any | Host removes RSVP | (deleted) | Delete RSVP record, if was 'going', trigger waitlist promotion |

##### Capacity Check Algorithm

**Purpose:** Determine whether a new "Going" RSVP can be accepted or must be waitlisted.

**Inputs:**
- event.max_guests: integer or null
- current_going_count: number of RSVPs with response='going'
- current_plus_ones: sum of plus_ones_count for RSVPs with response='going'
- new_plus_ones: plus_ones_count for the incoming RSVP

**Logic:**

```
1. IF event.max_guests IS NULL:
     RETURN 'accept' (no capacity limit)
2. SET total_expected = current_going_count + current_plus_ones
3. SET new_total = total_expected + 1 + new_plus_ones
4. IF new_total <= event.max_guests:
     RETURN 'accept'
5. ELSE IF event.waitlist_enabled:
     RETURN 'waitlist'
6. ELSE:
     RETURN 'reject' (capacity full, no waitlist)
```

**Edge Cases:**
- max_guests is null: Always accept (unlimited capacity)
- max_guests is 1 and someone RSVPs with 0 plus-ones: Accept, capacity is now full
- Guest changes from "Going" with 2 plus-ones to "Going" with 0 plus-ones: Frees 2 spots, check waitlist for promotions
- Guest changes from "Going" to "Declined": Frees 1 + plus_ones spots, trigger waitlist promotion

##### Waitlist Promotion Algorithm

**Purpose:** Auto-promote waitlisted guests when capacity opens.

**Logic:**

```
1. Calculate available_spots = event.max_guests - (going_count + going_plus_ones)
2. IF available_spots <= 0: RETURN (no spots)
3. GET waitlisted RSVPs ordered by responded_at ASC (first waitlisted = first promoted)
4. FOR each waitlisted RSVP:
   a. SET needed_spots = 1 + rsvp.plus_ones_count
   b. IF needed_spots <= available_spots:
      PROMOTE rsvp to 'going'
      SET available_spots = available_spots - needed_spots
   c. ELSE:
      SKIP this RSVP (they need more spots than available)
      CONTINUE to next (a smaller party might fit)
5. RETURN list of promoted RSVPs (for notification)
```

**Edge Cases:**
- Waitlisted guest with 3 plus-ones, but only 2 spots open: Skip them, try next waitlisted guest
- Multiple waitlisted guests can be promoted in one pass if enough capacity opens
- If no waitlisted guests fit the available spots, spots remain open

##### RSVP Summary Calculation

**Purpose:** Aggregate RSVP data for the dashboard display.

**Formulas:**
- `total_invited` = count of all invites for event
- `total_going` = count of RSVPs with response='going'
- `total_maybe` = count of RSVPs with response='maybe'
- `total_declined` = count of RSVPs with response='declined'
- `total_waitlisted` = count of RSVPs with response='waitlisted'
- `total_plus_ones` = sum of plus_ones_count for RSVPs with response='going'
- `total_expected` = total_going + total_plus_ones
- `total_checked_in` = count of RSVPs where checked_in_at is not null
- `response_rate` = (total_going + total_maybe + total_declined) / total_invited (if total_invited > 0, else 0)
- `capacity_usage` = total_expected / event.max_guests (if max_guests > 0, else null)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Capacity full, no waitlist | Message: "This event is at capacity." | Guest cannot RSVP "Going"; can RSVP "Maybe" or "Declined" |
| Capacity full, waitlist enabled | Message: "This event is full. You have been added to the waitlist." | Guest is waitlisted; notified if spot opens |
| Plus-ones exceed limit | Inline validation: "You can bring up to [N] guests" | User adjusts plus-ones count |
| Database write fails | Toast: "Could not save RSVP. Please try again." | User retries |
| Duplicate RSVP (same guest, same event) | Update existing RSVP instead of creating duplicate | Transparent to user |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an event with 50 max guests and 10 currently going,
   **When** a guest RSVPs "Going" with 2 plus-ones,
   **Then** the RSVP is accepted, total expected becomes 13 + previous plus-ones, and the dashboard updates.

2. **Given** a guest previously RSVPed "Maybe",
   **When** the guest changes to "Going",
   **Then** the RSVP response is updated, total_going increases by 1, total_maybe decreases by 1.

3. **Given** a guest RSVPed "Going" with 3 plus-ones,
   **When** the guest changes to "Declined",
   **Then** 4 spots open up and the waitlist promotion algorithm runs.

**Edge Cases:**

4. **Given** an event at max capacity with 3 waitlisted guests (1 needs 4 spots, 1 needs 1 spot, 1 needs 2 spots) and 2 spots just opened,
   **When** the waitlist promotion runs,
   **Then** the guest needing 1 spot is promoted first (FIFO), then the guest needing 2 spots is checked but cannot fit, and 1 spot remains open.

5. **Given** an event with no max_guests limit,
   **When** 500 guests RSVP "Going",
   **Then** all are accepted (no waitlisting).

**Negative Tests:**

6. **Given** an event at max capacity with waitlist disabled,
   **When** a guest tries to RSVP "Going",
   **Then** the system shows "This event is at capacity" and the RSVP is not created.

7. **Given** an invite with plus_one_limit=1,
   **When** the guest tries to RSVP with plus_ones_count=3,
   **Then** the system shows "You can bring up to 1 guest" and the RSVP is not created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| accepts RSVP under capacity | max_guests=50, going=10, new_plus_ones=0 | response='going' |
| waitlists when at capacity | max_guests=10, going=10, new_plus_ones=0 | response='waitlisted' |
| rejects when at capacity no waitlist | max_guests=10, going=10, waitlist=false | rejection error |
| enforces plus-one limit | invite.plus_one_limit=1, plus_ones_count=3 | validation error |
| promotes from waitlist FIFO | 2 spots open, 3 waitlisted (ordered by time) | first fitting guest promoted |
| calculates response rate | 10 invited, 7 responded | rate=0.7 |
| returns zero rate for zero invites | 0 invited | rate=0 |
| handles capacity with plus-ones | max=10, 5 going with 1 plus-one each = 10 total | capacity full |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full RSVP lifecycle | 1. Create event, 2. Add invite, 3. Record RSVP "Going", 4. Change to "Declined" | RSVP updated, summary reflects changes |
| Waitlist promotion | 1. Fill event to capacity, 2. Add waitlisted guest, 3. Remove a going guest | Waitlisted guest promoted to going |
| Summary accuracy | 1. Add 10 invites, 2. Record 5 going, 2 maybe, 1 declined | Summary shows 5/2/1, rate=0.8 |

---

### RS-005: Polls

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-005 |
| **Feature Name** | Polls |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to create polls within my event (e.g., "What movie should we watch?" or "Which date works best?"), so that I can make group decisions democratically.

**Secondary:**
> As a Guest, I want to vote on event polls and see the results, so that I can participate in planning decisions.

#### 3.3 Detailed Description

Polls allow the host (and co-hosts) to create multiple-choice questions within an event for group decision-making. Common use cases include picking a date/time, choosing an activity, selecting food options, or voting on a theme. Each poll has a question, 2-20 options, and a flag for whether multiple selections are allowed.

Polls can be open (accepting votes) or closed (results finalized). The host can close a poll at any time. Votes are anonymous by default but can optionally show voter names. Each guest can vote once per poll (or once per option if multiple-choice is enabled).

The Polls tab shows all polls for the current event, with open polls at the top and closed polls below. Each poll displays a bar chart of results with vote counts and percentages. The winning option (most votes) is highlighted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Polls belong to an event

**External Dependencies:**
- None

**Assumed Capabilities:**
- Event detail screen with Polls tab is accessible

#### 3.5 User Interface Requirements

##### Screen: Polls Tab

**Layout:**
- The Polls tab shows a scrollable list of poll cards
- Open polls appear at the top with a green "Open" badge; closed polls below with a gray "Closed" badge
- Each poll card shows: the question text, a list of options with vote bar charts, total vote count, and the host's close/reopen button
- A FAB labeled "New Poll" in the bottom-right corner
- Each option bar shows: option label, vote count, percentage, and a filled bar proportional to votes

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No polls created | Illustration with "No polls yet" and "Create your first poll" CTA |
| Has Polls | Polls exist | List of poll cards, open polls first |
| Voting | Guest taps an option | Option highlights, vote count increments, bar chart animates |
| Closed | Poll is closed | Options are not tappable, results are final, "Closed" badge shown |

**Interactions:**
- Tap option (open poll): Casts vote, animates bar chart update
- Tap option (closed poll): No action (read-only)
- Tap "New Poll" FAB: Opens Create Poll modal
- Tap "Close Poll" button (host only): Closes poll with confirmation dialog
- Long press poll card (host): Shows context menu (Close, Delete, Edit)

##### Modal: Create Poll

**Layout:**
- Bottom sheet with: Question (text input, required), Options (dynamic list of text inputs, minimum 2, maximum 20), "Add Option" button below the last option input, "Allow Multiple Selections" toggle, "Save" button
- Each option input has a delete button (X) on the right, disabled if only 2 options remain

#### 3.6 Data Requirements

##### Entity: Poll

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique poll identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| question | string | Required, max 500 chars | None | The poll question |
| options_json | string | JSON array of PollOption objects, min 2, max 20 | '[]' | Available choices |
| multiple_choice | boolean | - | false | Whether voters can select multiple options |
| is_open | boolean | - | true | Whether the poll is accepting votes |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: PollVote

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique vote identifier |
| poll_id | string | FK to rv_polls.id, ON DELETE CASCADE | None | Parent poll |
| rsvp_id | string | FK to rv_rsvps.id, ON DELETE SET NULL | null | Voter's RSVP (null for anonymous) |
| guest_name | string | Optional, max 200 chars | null | Voter's display name |
| option_id | string | Required | None | The selected option's ID |
| created_at | datetime | Auto-set | Current timestamp | When the vote was cast |

**Indexes:**
- poll_id: Queried for listing all votes for a poll
- event_id on polls: Queried for listing all polls for an event

#### 3.7 Business Logic Rules

##### Vote Casting

**Purpose:** Record a vote and enforce single-vote-per-person rules.

**Logic:**

```
1. IF poll.is_open is false:
     RETURN error "This poll is closed"
2. IF poll.multiple_choice is false:
     DELETE existing votes by this voter for this poll
3. IF poll.multiple_choice is true:
     CHECK if voter already voted for this specific option
     IF yes: RETURN error "Already voted for this option"
4. INSERT vote record
5. RETURN updated vote counts
```

**Edge Cases:**
- Single-choice poll: Voting for a new option removes the previous vote (change vote, not add)
- Multiple-choice poll: Each option can be voted once; tapping a voted option removes that vote (toggle behavior)
- Guest without RSVP votes: Allowed; guest_name is captured instead of rsvp_id

##### Poll Results Calculation

**Formulas:**
- `total_votes` = count of all votes for this poll
- `option_votes` = count of votes for a specific option
- `option_percentage` = (option_votes / total_votes) * 100, rounded to 1 decimal
- `winning_option` = option with highest vote count (if tie, all tied options are highlighted)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Voting on closed poll | Toast: "This poll is closed" | No action needed |
| Poll with fewer than 2 options | Inline validation: "Polls need at least 2 options" | User adds more options |
| Question left blank | Inline validation: "Question is required" | User fills in question |
| Database write fails | Toast: "Could not save vote. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an event with an open poll "What should we eat?" with options "Pizza", "Sushi", "Tacos",
   **When** a guest taps "Pizza",
   **Then** the vote count for Pizza increments by 1 and the bar chart updates.

2. **Given** a single-choice poll where a guest previously voted "Pizza",
   **When** the guest taps "Sushi",
   **Then** the Pizza vote decreases by 1, Sushi increases by 1 (vote changed, not added).

3. **Given** a multiple-choice poll,
   **When** a guest taps "Pizza" and then "Tacos",
   **Then** both options show the guest's vote (2 total votes from this guest).

**Edge Cases:**

4. **Given** a poll with 3 options all tied at 5 votes,
   **When** viewing results,
   **Then** all 3 options are highlighted as tied winners.

**Negative Tests:**

5. **Given** a closed poll,
   **When** a guest taps an option,
   **Then** nothing happens and a toast says "This poll is closed."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates poll with valid options | question: "Pick one", 3 options | Poll created with is_open=true |
| rejects poll with 1 option | question: "Pick one", 1 option | Validation error |
| single-choice replaces previous vote | existing vote for option A, new vote for option B | Only option B vote remains |
| multiple-choice allows multiple votes | vote for A, then vote for B | Both votes exist |
| closes poll | poll.is_open=true, close action | poll.is_open=false |
| calculates percentages | 10 total votes, option A has 3 | option A = 30.0% |

---

### RS-006: Announcements

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-006 |
| **Feature Name** | Announcements |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to post announcements to all event guests (e.g., "Parking is available on the street" or "Event moved to next Saturday"), so that everyone gets important updates.

#### 3.3 Detailed Description

Announcements are one-way messages from the host (or co-hosts) to all event guests. They appear in the event feed and can optionally be scheduled for future delivery. Each announcement has a message body, a send channel (all, email, sms, push), and timestamps for creation and delivery.

Announcements are displayed in reverse chronological order in the event's Feed tab. The host can create, but not edit, announcements (they are immutable once sent to maintain trust). Unsent scheduled announcements can be cancelled.

Since MyRSVP is privacy-first and local-only, "sending" an announcement means making it visible in the event feed. External delivery (email, SMS, push) would require network access and is deferred to Phase 3+ when auth is available. For MVP, the send_channel field is stored but all delivery is via the in-app feed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Announcements belong to an event

**External Dependencies:**
- None for MVP (in-app feed only)
- Future: push notification service, email/SMS gateway

#### 3.5 User Interface Requirements

##### Screen: Announcements (within Feed tab)

**Layout:**
- Announcements appear as distinct cards in the Feed tab, styled differently from comments (larger font, announcement icon, accent border)
- Each announcement card shows: host name with "Host" badge, message text, timestamp, send channel indicator
- A "New Announcement" button at the top of the Feed tab (visible only to host/co-hosts)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Announcements | No announcements posted | Feed shows only comments (if any) or empty state |
| Has Announcements | Announcements exist | Announcement cards interspersed with comments by timestamp |
| Scheduled | Announcement has future scheduled_for | Card shows "Scheduled for [date]" with a clock icon and cancel button |

**Interactions:**
- Tap "New Announcement": Opens compose modal
- Tap scheduled announcement: Shows option to cancel or reschedule
- Announcements are not editable or deletable once sent

##### Modal: Compose Announcement

**Layout:**
- Bottom sheet with: Message (multiline text area, required, max 2000 chars), Schedule toggle (if enabled, shows date-time picker for scheduled_for), "Post Now" button

#### 3.6 Data Requirements

##### Entity: Announcement

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique announcement identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| message | string | Required, max 2000 chars | None | Announcement body text |
| send_channel | enum | One of: all, email, sms, push | 'all' | Delivery channel (MVP: all = in-app only) |
| scheduled_for | datetime | Optional, ISO 8601, must be in future | null | When to publish (null = immediate) |
| sent_at | datetime | Optional, ISO 8601 | null | When actually published |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Announcement Publishing

**Logic:**

```
1. IF scheduled_for IS NULL:
     SET sent_at = now()
     Announcement is immediately visible in feed
2. IF scheduled_for IS in the future:
     Announcement is stored but not visible until scheduled_for
     A local timer or check on feed load publishes it at the scheduled time
3. IF scheduled_for IS in the past:
     SET sent_at = now() (treat as immediate)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty message | Inline validation: "Message is required" | User fills in message |
| Database write fails | Toast: "Could not post announcement." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the host is on the Feed tab,
   **When** the host posts an announcement "Parking is on the street",
   **Then** the announcement appears at the top of the feed with the current timestamp and host badge.

2. **Given** the host creates a scheduled announcement for tomorrow at 9 AM,
   **When** viewing the feed today,
   **Then** the announcement shows as "Scheduled for [tomorrow 9 AM]" with a clock icon.

3. **Given** a scheduled announcement exists,
   **When** the host cancels it,
   **Then** the announcement is removed from the feed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates immediate announcement | message: "Hello", scheduled_for: null | sent_at = now |
| creates scheduled announcement | message: "Reminder", scheduled_for: future date | sent_at = null |
| rejects empty message | message: "" | Validation error |
| marks announcement sent | announcement.id | sent_at updated |

---

### RS-007: Photo Albums

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-007 |
| **Feature Name** | Photo Albums |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Guest, I want to upload photos to the event's shared album, so that everyone can see and enjoy the memories.

**Secondary:**
> As a Social Host, I want to view all event photos in a grid gallery and optionally delete inappropriate ones, so that the album stays curated.

#### 3.3 Detailed Description

Each event has an optional shared photo album (controlled by the allow_photo_album toggle). Guests (with RSVPs) and the host can add photos from their device. Each photo records who uploaded it, an optional caption, and a timestamp.

Photos are stored as local file URIs. When a guest "adds" a photo, they select it from their device's photo library and it is copied to the app's local storage directory. Photos are displayed in a grid gallery (3 columns) sorted by upload time (newest first).

The host can delete any photo. Guests can only delete their own photos. There is no limit on the number of photos per event, but a per-photo file size limit of 20 MB is enforced.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Albums belong to an event

**External Dependencies:**
- Device photo library access
- Local file storage for photo copies

#### 3.5 User Interface Requirements

##### Screen: Photo Album (within Event Detail)

**Layout:**
- Accessible via a "Photos" button on the event detail screen or the photo icon in the event header
- Top bar: event title, photo count, "Add Photo" button
- Main content: 3-column photo grid with square thumbnails
- Tapping a photo opens it in a full-screen viewer with caption, uploader name, and timestamp
- In full-screen view: swipe left/right to navigate, share button, delete button (for host or uploader)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No photos uploaded | Centered illustration with "No photos yet" and "Add the first photo" button |
| Populated | Photos exist | 3-column grid of square thumbnails |
| Full-screen | Photo tapped | Full-screen image with caption overlay, navigation arrows |
| Album Disabled | allow_photo_album = false | "Photos" button hidden on event detail |

**Interactions:**
- Tap "Add Photo": Opens device image picker (multi-select)
- Tap photo thumbnail: Opens full-screen viewer
- Swipe left/right in full-screen: Navigate between photos
- Tap delete (full-screen): Confirmation dialog, then removes photo
- Tap share (full-screen): Opens share sheet with the photo

#### 3.6 Data Requirements

##### Entity: EventPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique photo identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| rsvp_id | string | FK to rv_rsvps.id, ON DELETE SET NULL | null | Uploader's RSVP (null if host uploaded) |
| guest_name | string | Required | None | Uploader's display name |
| photo_url | string | Required, local file URI | None | Path to photo file on device |
| caption | string | Optional, max 500 chars | null | Photo caption |
| created_at | datetime | Auto-set | Current timestamp | Upload time |

**Indexes:**
- event_id: Queried for listing all photos for an event

#### 3.7 Business Logic Rules

##### Photo Upload

**Logic:**

```
1. User selects photos from device picker (up to 20 at once)
2. FOR each selected photo:
   a. Validate file size <= 20 MB
   b. Copy to app's local storage directory
   c. Generate UUID for photo ID
   d. INSERT record into rv_photos with local file path
3. Refresh gallery grid
```

**Edge Cases:**
- Photo file exceeds 20 MB: Skip with toast "Photo too large (max 20 MB)"
- Photo file is corrupt: Skip with toast "Could not load photo"
- Batch upload: Process all valid photos, report count of skipped

##### Photo Deletion

**Logic:**

```
1. IF user is host OR user is photo uploader:
     Show confirmation dialog
     IF confirmed: DELETE from rv_photos AND delete local file copy
2. ELSE:
     Button not visible (enforced in UI)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Photo library permission denied | "Photos access is needed. Enable in Settings." | Link to device settings |
| File too large | Toast: "Photo too large (max 20 MB). Choose a smaller photo." | User selects different photo |
| File copy fails | Toast: "Could not save photo. Please try again." | User retries |
| Local file missing (deleted externally) | Thumbnail shows broken image placeholder | Host can delete the record |

#### 3.9 Acceptance Criteria

1. **Given** an event with photo album enabled,
   **When** a guest uploads a photo with caption "Great party!",
   **Then** the photo appears in the gallery grid with the caption visible in full-screen view.

2. **Given** an album with 10 photos,
   **When** the host deletes photo #3,
   **Then** the gallery shows 9 photos and the local file is removed.

3. **Given** a guest's photo in the album,
   **When** a different guest views it,
   **Then** the delete button is not visible (only uploader and host can delete).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates photo record | valid photo_url, guest_name | Photo record created |
| rejects file over 20 MB | 25 MB file | Validation error |
| host can delete any photo | host deletes guest's photo | Photo deleted |
| guest can only delete own photo | guest A tries to delete guest B's photo | Permission denied |

---

### RS-008: Check-in System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-008 |
| **Feature Name** | Check-in System |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to mark guests as "arrived" when they show up at the event, so that I have an accurate record of actual attendance versus RSVPs.

#### 3.3 Detailed Description

The check-in system allows the host (and co-hosts) to mark RSVP'd guests as arrived. Check-in sets a `checked_in_at` timestamp on the RSVP record. The check-in screen shows a scrollable list of expected guests (those who RSVPed "Going") with a check-in toggle for each. Checked-in guests move to a "Checked In" section at the bottom of the list.

The check-in screen also shows a live counter: "X of Y checked in" where Y is the total expected headcount (going + plus-ones). The host can undo a check-in by tapping the toggle again (clears checked_in_at).

For larger events, a search bar at the top allows the host to quickly find a guest by name. The QR Code Check-in feature (RS-024) extends this system with automated scanning.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Check-in is per event
- RS-004: RSVP System - Only RSVP'd guests can be checked in

#### 3.5 User Interface Requirements

##### Screen: Check-in

**Layout:**
- Top bar: "Check-in" title, live counter "X / Y checked in"
- Below: search bar for filtering by guest name
- Main content: two sections - "Not Checked In" (sorted alphabetically) and "Checked In" (sorted by check-in time, most recent first)
- Each row: guest name, plus-ones indicator, check-in toggle (checkbox or switch)
- Tapping the toggle checks in or un-checks-in the guest

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Going RSVPs | No one RSVPed Going | Message: "No confirmed guests yet" |
| Pre-event | Before event start time | Full list with all toggles unchecked |
| During Event | After event start time | Same list, check-in counter prominent |
| All Checked In | X = Y | Green banner: "Everyone is here!" |

**Interactions:**
- Tap toggle: Check in (sets checked_in_at) or undo check-in (clears checked_in_at)
- Search: Filters visible list by guest name
- Guest with plus-ones: Shows "+N" badge; checking in the primary guest counts them and their plus-ones

#### 3.6 Data Requirements

No new entities. Check-in uses the existing `checked_in_at` field on the RSVP entity (RS-004).

#### 3.7 Business Logic Rules

##### Check-in Logic

```
1. IF rsvp.response != 'going':
     Do not show check-in toggle (only going guests can be checked in)
2. Tap toggle ON:
     SET rsvp.checked_in_at = now()
3. Tap toggle OFF:
     SET rsvp.checked_in_at = null
4. Counter calculation:
     checked_in = count of RSVPs where checked_in_at IS NOT NULL
     total_expected = count of going RSVPs + sum of their plus_ones_count
```

**Edge Cases:**
- Guest RSVPed with plus-ones: Checking in the primary guest counts as 1 + plus_ones toward the counter
- Guest changes RSVP to "Declined" after being checked in: Clear checked_in_at
- Co-host checks in guests simultaneously: No conflict since each toggle operates on a different RSVP row

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on check-in | Toast: "Could not check in. Try again." | User retries toggle |

#### 3.9 Acceptance Criteria

1. **Given** an event with 10 going guests and 0 checked in,
   **When** the host checks in guest "Alice",
   **Then** the counter shows "1 / 10 checked in" and Alice moves to the "Checked In" section.

2. **Given** Alice is checked in,
   **When** the host taps her toggle again,
   **Then** Alice moves back to "Not Checked In" and the counter decreases by 1.

3. **Given** a guest with 3 plus-ones is checked in,
   **When** viewing the counter,
   **Then** the counter reflects 4 additional people (1 guest + 3 plus-ones).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| check in sets timestamp | rsvp.id | checked_in_at = current time |
| undo check-in clears timestamp | rsvp.id (already checked in) | checked_in_at = null |
| counter includes plus-ones | 3 going, 5 total plus-ones, 2 checked in | "2 / 8 checked in" |
| only going guests shown | 5 going, 3 maybe, 2 declined | 5 rows in check-in list |

---

### RS-009: Waitlist Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-009 |
| **Feature Name** | Waitlist Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want the system to automatically manage a waitlist when my event reaches capacity, so that I do not have to manually track overflow guests and can auto-promote them when spots open.

#### 3.3 Detailed Description

When an event has a max_guests capacity and that capacity is reached, new "Going" RSVPs are automatically placed on the waitlist (response='waitlisted'). When a spot opens (a going guest cancels or reduces plus-ones), the system automatically promotes the longest-waiting guest from the waitlist using the FIFO algorithm specified in RS-004.

The host can also manually manage the waitlist: promote a specific guest out of order, remove a guest from the waitlist, or override the auto-promotion to skip a particular guest. The waitlist view shows position numbers (1st in line, 2nd in line, etc.) so guests know their place.

The waitlist is only active when max_guests is set and waitlist_enabled is true. If the host increases max_guests, the system immediately checks if any waitlisted guests can be promoted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Waitlist is per event
- RS-004: RSVP System - Waitlist uses the RSVP response field

#### 3.5 User Interface Requirements

##### Screen: Waitlist (within Guest List)

**Layout:**
- A filter tab within the Guest List showing only waitlisted RSVPs
- Each card shows: position number (#1, #2, ...), guest name, plus-ones count, waitlisted timestamp
- Host actions per card: "Promote" button (moves to going), "Remove" button (removes from waitlist)
- Top banner: "X guests on waitlist" with capacity status "Y / Z spots filled"

**Interactions:**
- Tap "Promote": Immediately promotes the guest to "going" (bypasses FIFO order)
- Tap "Remove": Removes from waitlist with confirmation
- When a spot opens: Auto-promotion happens silently; a toast confirms "Alice has been promoted from the waitlist"

#### 3.6 Data Requirements

No new entities. Waitlist uses existing RSVP (response='waitlisted') and Invite (status='waitlisted') from RS-003 and RS-004.

#### 3.7 Business Logic Rules

##### Waitlist Position Calculation

```
1. GET all RSVPs where event_id = target AND response = 'waitlisted'
2. ORDER BY responded_at ASC (first waitlisted = position #1)
3. RETURN numbered list
```

##### Capacity Change Handling

```
1. Host increases max_guests from 20 to 25
2. Calculate new available spots: 25 - current_expected
3. IF available spots > 0:
     Run waitlist promotion algorithm (RS-004) with available_spots
```

**Edge Cases:**
- Host decreases max_guests below current going count: Do not remove going guests; display warning "Currently over capacity by X"
- Host disables waitlist while guests are waitlisted: Waitlisted guests remain with response='waitlisted' but no new guests are waitlisted (they are rejected instead)
- Guest on waitlist cancels: Remove from waitlist, no promotion triggered

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Manual promote when already at capacity | Warning: "Event is at capacity. Promoting will exceed the limit. Continue?" | Host confirms or cancels |
| Database error on promotion | Toast: "Could not promote guest. Try again." | Retry |

#### 3.9 Acceptance Criteria

1. **Given** an event with max_guests=10 and 10 going guests,
   **When** guest #11 tries to RSVP "Going",
   **Then** they are placed on the waitlist at position #1.

2. **Given** a waitlist with 3 guests and a going guest cancels,
   **When** 1 spot opens,
   **Then** the #1 position guest is auto-promoted to "going".

3. **Given** a waitlist with 3 guests,
   **When** the host manually promotes guest #3,
   **Then** guest #3 becomes "going" and guests #1 and #2 remain waitlisted (positions update to #1 and #2).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| assigns correct positions | 3 waitlisted RSVPs by time | Positions 1, 2, 3 in responded_at order |
| auto-promotes on cancellation | going guest cancels, 2 waitlisted | First waitlisted promoted |
| manual promote skips FIFO | host promotes #3 of 3 | #3 promoted, #1 and #2 remain |
| capacity increase triggers promotion | max_guests 10->12, 10 going, 3 waitlisted | 2 promoted |
| no promotion if waitlist disabled | waitlist_enabled=false, spot opens | No promotion, spot remains open |

---

### RS-010: Co-host Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-010 |
| **Feature Name** | Co-host Management |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to invite co-hosts who can help manage the event (edit details, manage guests, post announcements), so that I can share organizational responsibilities.

#### 3.3 Detailed Description

Co-hosts are collaborators who share management permissions for an event. The host can add co-hosts by name with an optional role label (e.g., "DJ", "Food coordinator", "Decorations lead"). Co-hosts can perform most host actions: edit event details, manage the guest list, post announcements, create polls, manage the photo album, and check in guests.

Co-hosts cannot delete the event, remove other co-hosts, or change event visibility/password settings. Only the original event creator (the primary host) has full administrative control.

Co-hosts are tracked in the `rv_event_cohosts` table, separate from the guest list. Adding someone as a co-host does not automatically add them as a guest; the host should separately invite them if they want them in the RSVP list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Co-hosts belong to an event

#### 3.5 User Interface Requirements

##### Screen: Co-hosts (within Event Settings)

**Layout:**
- A section in Event Settings showing a list of co-host cards
- Each card: co-host name, role label (if set), "Remove" button
- "Add Co-host" button at the bottom of the list

**Interactions:**
- Tap "Add Co-host": Opens a modal with Name (required) and Role (optional) fields
- Tap "Remove": Confirmation dialog, then removes co-host

#### 3.6 Data Requirements

##### Entity: EventCohost

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique co-host record ID |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| name | string | Required, max 200 chars | None | Co-host's display name |
| role | string | Optional, max 100 chars | null | Role label (e.g., "DJ") |
| created_at | datetime | Auto-set | Current timestamp | When added |

#### 3.7 Business Logic Rules

##### Co-host Permissions

| Action | Primary Host | Co-host |
|--------|-------------|---------|
| Edit event details | Yes | Yes |
| Manage guest list | Yes | Yes |
| Post announcements | Yes | Yes |
| Create/close polls | Yes | Yes |
| Manage photo album | Yes | Yes |
| Check in guests | Yes | Yes |
| Delete event | Yes | No |
| Add/remove co-hosts | Yes | No |
| Change visibility/password | Yes | No |
| Change max_guests | Yes | No |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate co-host name | Warning: "A co-host named [name] already exists" | User changes name |
| Database error | Toast: "Could not add co-host." | Retry |

#### 3.9 Acceptance Criteria

1. **Given** an event with no co-hosts,
   **When** the host adds co-host "Jake" with role "DJ",
   **Then** Jake appears in the co-hosts list with role "DJ" and has management permissions.

2. **Given** Jake is a co-host,
   **When** Jake tries to delete the event,
   **Then** the delete option is not available to Jake.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| adds co-host | name: "Jake", role: "DJ" | Co-host record created |
| removes co-host | cohost.id | Record deleted |
| host permissions include all | host role check | All permissions true |
| co-host lacks admin permissions | co-host role check | delete_event=false, manage_cohosts=false |

---

### RS-011: Event History

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-011 |
| **Feature Name** | Event History |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to view a history of my past events with their attendance data, photos, and details, so that I can reflect on previous gatherings and reference them for future planning.

#### 3.3 Detailed Description

The Events tab defaults to showing upcoming events. A "Past Events" section or toggle at the bottom shows events whose start_at is before the current time. Past events are read-only by default (no new RSVPs, but photos can still be added for post-event sharing).

Past events display the same detail view as active events but with a "Past Event" banner. The RSVP dashboard shows final counts. The host can still view analytics, export attendance CSV, and browse the photo album.

Events are never automatically deleted. The host can manually delete past events, which cascades to all related data (invites, RSVPs, polls, photos, etc.).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - History is a filtered view of events

#### 3.5 User Interface Requirements

##### Screen: Events Tab with History

**Layout:**
- The Events tab has two sections: "Upcoming" (default, sorted by start_at ascending) and "Past" (sorted by start_at descending, most recent first)
- A segmented control or toggle at the top: "Upcoming" / "Past"
- Past event cards show a muted color scheme with the event date prominently displayed
- Each past event card shows: title, date, final going count, photo count

**Interactions:**
- Toggle to "Past": Shows past events
- Tap past event card: Opens event detail in read-only mode (with "Past Event" banner)

#### 3.6 Data Requirements

No new entities. History uses existing Event data with a query filter: `start_at < now()`.

#### 3.7 Business Logic Rules

##### Past Event Detection

```
1. An event is "past" if start_at < current datetime
2. If end_at is set: event is "past" if end_at < current datetime
3. Past events: RSVPs are read-only, check-in is disabled, polls are auto-closed
4. Past events: Photo album and comments remain open (post-event sharing)
```

**Edge Cases:**
- Event currently in progress (start_at < now < end_at): Shown in "Upcoming" section, all features active
- Event with no end_at that started 24 hours ago: Treated as past
- Timezone handling: Compare using event's timezone, not device timezone

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No past events | "Past" section shows "No past events" | No action needed |

#### 3.9 Acceptance Criteria

1. **Given** an event whose start_at was yesterday,
   **When** the user views the Events tab,
   **Then** the event appears under "Past" section, not "Upcoming."

2. **Given** a past event,
   **When** the host opens its detail,
   **Then** RSVP buttons are disabled and a "Past Event" banner is shown.

3. **Given** a past event with photos,
   **When** a guest adds a new photo,
   **Then** the photo is accepted (post-event sharing is allowed).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies future event as upcoming | start_at = tomorrow | Section: upcoming |
| classifies past event correctly | start_at = yesterday, no end_at | Section: past |
| in-progress event is upcoming | start_at = 1 hour ago, end_at = 1 hour from now | Section: upcoming |
| past events sorted descending | 3 past events | Most recent first |

---

### RS-012: Calendar Sync / iCal Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-012 |
| **Feature Name** | Calendar Sync / iCal Export |
| **Priority** | P0 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Guest, I want to add an event to my phone's calendar with one tap, so that I get reminders and see it alongside my other commitments.

**Secondary:**
> As a Social Host, I want to export my event as an .ics file that I can share with guests, so that anyone can add it to their preferred calendar app.

#### 3.3 Detailed Description

Calendar sync provides two-way integration between MyRSVP events and the device's native calendar. The primary flow is export: when a guest RSVPs "Going" or "Maybe," they see an "Add to Calendar" button that creates a native calendar event using the device's calendar API. Alternatively, the host can generate an .ics file (RFC 5545 VEVENT) that can be shared via the share sheet.

On mobile, the app uses the native calendar API (EventKit on iOS, CalendarContract on Android) to create events directly. On web, the app generates a downloadable .ics file. When event details change (date, time, location), the host can push an update to the .ics file. Guests who added the event via .ics can re-download to get updates (iCal subscriptions are not supported in MVP due to requiring a server).

The .ics export follows RFC 5545 strictly, including DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, GEO (if coordinates available), ORGANIZER, and a UID derived from the event's UUID for update tracking.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Calendar export uses event data

**External Dependencies:**
- Device calendar API (EventKit on iOS, CalendarContract on Android)
- File system for .ics file generation

**Assumed Capabilities:**
- Calendar permission granted by user
- Event detail screen is accessible

#### 3.5 User Interface Requirements

##### Screen: Add to Calendar (within Event Detail)

**Layout:**
- An "Add to Calendar" button in the event detail header area, below the date/time display
- Tapping opens a bottom sheet with options: "Add to Phone Calendar" (native) and "Download .ics File" (for sharing)
- On web: only the .ics download option is shown
- If already added to calendar: button changes to "Update Calendar Event" and shows a green checkmark

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not Added | Event not in device calendar | "Add to Calendar" button with calendar icon |
| Added | Event exists in device calendar | "Added to Calendar" with green checkmark, "Update" option |
| Permission Denied | Calendar access not granted | "Add to Calendar" button; tapping shows permission prompt |

**Interactions:**
- Tap "Add to Phone Calendar": Creates native calendar event with event details pre-filled; opens native calendar confirmation
- Tap "Download .ics File": Generates .ics file and opens share sheet
- Tap "Update Calendar Event": Updates the existing native calendar event with current details

#### 3.6 Data Requirements

##### iCal VEVENT Properties (RFC 5545)

| Property | Source | Required | Description |
|----------|--------|----------|-------------|
| UID | `event.id + "@myrsvp.local"` | Yes | Unique identifier for update tracking |
| DTSTART | event.start_at | Yes | Event start with timezone (TZID parameter) |
| DTEND | event.end_at or start_at + 2h | Yes | Event end time |
| SUMMARY | event.title | Yes | Event title |
| DESCRIPTION | event.description | No | Event description (plain text) |
| LOCATION | event.location_name + ", " + event.location_address | No | Venue info |
| GEO | Geocoded from location_address | No | Latitude;Longitude |
| ORGANIZER | event.created_by or "Host" | No | Event organizer name |
| STATUS | CONFIRMED | Yes | Event status |
| SEQUENCE | Incrementing integer | Yes | Update sequence number (starts at 0, increments on each update) |
| DTSTAMP | Current UTC time | Yes | Timestamp of .ics generation |
| VALARM | 1 hour before DTSTART | No | Default reminder |

**Example .ics Output:**

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MyRSVP//MyLife//EN
METHOD:PUBLISH
BEGIN:VEVENT
UID:e1a2b3c4-d5e6-7890-abcd-ef1234567890@myrsvp.local
DTSTART;TZID=America/Los_Angeles:20260415T190000
DTEND;TZID=America/Los_Angeles:20260415T230000
SUMMARY:Sarah's 30th Birthday
DESCRIPTION:Join us for an evening of food, drinks, and celebration!
LOCATION:The Rooftop Lounge, 456 Market St, San Francisco, CA 94105
STATUS:CONFIRMED
SEQUENCE:0
DTSTAMP:20260306T120000Z
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Reminder: Sarah's 30th Birthday in 1 hour
END:VALARM
END:VEVENT
END:VCALENDAR
```

#### 3.7 Business Logic Rules

##### .ics Generation

**Logic:**

```
1. GET event by ID
2. BUILD VCALENDAR wrapper with PRODID and METHOD:PUBLISH
3. BUILD VEVENT:
   a. UID = event.id + "@myrsvp.local"
   b. DTSTART with TZID parameter from event.timezone
   c. DTEND = event.end_at OR event.start_at + 2 hours
   d. SUMMARY = event.title (escape special characters: commas, semicolons, backslashes)
   e. DESCRIPTION = event.description (escape newlines as \n)
   f. LOCATION = event.location_name + ", " + event.location_address (skip if both null)
   g. SEQUENCE = number of times event has been updated
   h. Add VALARM with 1-hour trigger
4. RETURN .ics file content as string
```

**Edge Cases:**
- Event has no end_at: Set DTEND to DTSTART + 2 hours
- Event has no location: Omit LOCATION property entirely
- Description contains special characters: Escape per RFC 5545 (commas -> \, semicolons -> \; newlines -> \n)
- Title exceeds 75 characters: Fold lines per RFC 5545 (CRLF + space)

##### Native Calendar Event Creation

**Logic:**

```
1. Request calendar permission (if not already granted)
2. IF denied: show permission prompt and return
3. Create calendar event via platform API:
   - Title = event.title
   - Start = event.start_at (converted to device timezone)
   - End = event.end_at or start_at + 2h
   - Location = event.location_address or event.location_name
   - Notes = event.description
   - Reminder = 1 hour before
4. Store the native calendar event ID in rv_settings keyed by event.id for update tracking
5. Show confirmation toast: "Added to calendar"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Calendar permission denied | "Calendar access is needed to add events. Enable in Settings." | Link to device settings |
| .ics generation fails | Toast: "Could not generate calendar file." | Retry |
| Native event creation fails | Toast: "Could not add to calendar. Try downloading the .ics file instead." | Offer .ics download fallback |
| Event already in calendar | Show "Update" option instead of "Add" | User can update or ignore |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an event with title, date, time, and location,
   **When** the guest taps "Add to Phone Calendar",
   **Then** a native calendar event is created with matching details and a 1-hour reminder.

2. **Given** an event exists,
   **When** the host taps "Download .ics File",
   **Then** a valid RFC 5545 .ics file is generated and the share sheet opens.

3. **Given** a guest previously added an event to their calendar and the host changes the location,
   **When** the guest taps "Update Calendar Event",
   **Then** the native calendar event is updated with the new location.

**Edge Cases:**

4. **Given** an event with no end time,
   **When** generating the .ics file,
   **Then** DTEND is set to DTSTART + 2 hours.

5. **Given** an event title with special characters (commas, semicolons),
   **When** generating the .ics file,
   **Then** characters are properly escaped per RFC 5545.

**Negative Tests:**

6. **Given** calendar permission is denied,
   **When** the user taps "Add to Phone Calendar",
   **Then** a permission prompt is shown with a link to device settings.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid .ics | event with all fields | Valid RFC 5545 VCALENDAR string |
| handles missing end_at | event with no end_at | DTEND = DTSTART + 2 hours |
| escapes special chars in title | title: "Sarah's B-day, 2026" | SUMMARY:Sarah's B-day\, 2026 |
| omits location if null | no location_name or location_address | No LOCATION property |
| includes VALARM | any event | VALARM with -PT1H trigger |
| folds long lines | title > 75 chars | Line folded with CRLF + space |
| increments SEQUENCE | event updated 3 times | SEQUENCE:3 |

---

### RS-013: Event Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-013 |
| **Feature Name** | Event Templates |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to use pre-built templates for common events (birthday party, dinner party, game night), so that I can create well-structured events quickly without configuring everything from scratch.

#### 3.3 Detailed Description

Event templates are pre-configured event setups that populate the creation form with suggested values for description, duration, settings, poll suggestions, custom RSVP questions, and a checklist of tasks. Templates go beyond event types (RS-002) by providing rich content, not just default toggles.

Each template includes: a suggested description (editable), recommended duration, pre-built RSVP questions (e.g., "Any dietary restrictions?" for dinner party), suggested poll questions (e.g., "What game should we play?" for game night), a host checklist (e.g., "Book venue", "Order cake", "Send reminders"), and visual theme suggestions.

Templates are read-only and ship with the app. Users cannot create custom templates in MVP, but they can save a past event as a template in a future version.

There are 12 built-in templates covering the most common event types.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Templates populate the creation form
- RS-002: Event Types - Templates are associated with event types

**External Dependencies:**
- None (templates are bundled with the app)

#### 3.5 User Interface Requirements

##### Screen: Template Picker (within Create Event flow)

**Layout:**
- Shown as an optional first step in the Create Event flow: "Start from a template?" with a grid of template cards below
- Each template card shows: icon, template name, a 1-line description, and a "Use" button
- A "Skip" link at the bottom for creating from scratch
- Tapping "Use" populates the Create Event form with template values (user can modify anything)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Template Grid | User opened Create Event | 12 template cards in a 2-column grid |
| Template Preview | User long-pressed a card | Modal showing full template details (description, questions, checklist) |
| Applied | User tapped "Use" | Form populated with template values, "Template: [name]" badge on form |

**Interactions:**
- Tap template card: Applies template and navigates to Create Event form
- Long press template card: Shows preview modal with full template contents
- Tap "Skip": Opens blank Create Event form

#### 3.6 Data Requirements

##### Entity: EventTemplate (Static, bundled with app)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Template identifier (e.g., 'birthday', 'dinner_party') |
| name | string | Display name (e.g., "Birthday Party") |
| icon | string | Emoji icon |
| event_type | string | Associated event type from RS-002 |
| suggested_description | string | Pre-written event description (editable by user) |
| suggested_duration_hours | number | Default event duration |
| suggested_settings | object | Default toggle values (max_guests, allow_plus_ones, etc.) |
| suggested_questions | array | Pre-built RSVP questions (label, type, options) |
| suggested_polls | array | Pre-built poll suggestions (question, options) |
| host_checklist | array | Task list for the host (strings) |

##### Built-in Templates

| Template | Icon | Duration | Key Features |
|----------|------|----------|-------------|
| Birthday Party | :birthday: | 3h | Gift registry prompt, "Surprise?" toggle, dietary Q |
| Dinner Party | :fork_and_knife: | 3h | Dietary preference Q, seating note, max_guests=12 |
| Game Night | :game_die: | 4h | "What game?" poll, BYOB note |
| Wedding | :ring: | 8h | Seating arrangement, gift registry, requires_approval |
| Baby Shower | :baby: | 3h | Gift registry, dietary Q, "Is it a surprise?" toggle |
| Holiday Gathering | :christmas_tree: | 5h | Potluck sign-up poll, dietary Q, plus-ones allowed |
| Brunch | :pancakes: | 2h | Dietary Q, max_guests=10 |
| Happy Hour | :cocktail_glass: | 2h | Plus-ones encouraged, casual tone |
| Potluck | :green_salad: | 3h | "What are you bringing?" poll, dietary Q |
| Movie Night | :popcorn: | 3h | "What should we watch?" poll |
| BBQ/Cookout | :fire: | 5h | Dietary Q, "Bring your own" poll |
| Book Club | :books: | 2h | "Next book?" poll, recurring event suggestion |

#### 3.7 Business Logic Rules

##### Template Application

**Logic:**

```
1. User selects a template
2. Populate Create Event form:
   a. event_type = template.event_type
   b. description = template.suggested_description
   c. end_at = start_at + template.suggested_duration_hours
   d. Apply template.suggested_settings as form defaults
3. After event creation:
   a. FOR each template.suggested_questions:
      Create rv_questions record for the new event
   b. Store template.host_checklist in rv_settings as JSON for this event
4. Suggested polls are shown as prompts ("Would you like to create a poll: [question]?") not auto-created
```

**Edge Cases:**
- User modifies template values before saving: User's modifications take precedence
- Template references a question type not yet implemented: Skip that question silently

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Template data corrupt | Skip template, show blank form with toast "Template unavailable" | User creates event from scratch |

#### 3.9 Acceptance Criteria

1. **Given** the user opens Create Event,
   **When** the user selects the "Birthday Party" template,
   **Then** the form is populated with birthday-specific description, 3-hour duration, and allow_chip_in=true.

2. **Given** the user selected a template with suggested RSVP questions,
   **When** the event is created,
   **Then** the RSVP questions are automatically created for that event.

3. **Given** the user selects a template and then modifies the description,
   **When** the event is saved,
   **Then** the user's modified description is stored (not the template default).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| applies template settings | template: 'dinner_party' | max_guests=12 |
| creates questions from template | template with 2 questions | 2 rv_questions records |
| user override preserved | template description + user edit | user edit stored |
| all 12 templates are valid | iterate all templates | No validation errors |

---

### RS-014: Custom Invitation Designs

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-014 |
| **Feature Name** | Custom Invitation Designs |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to create a visually appealing invitation card with custom colors, fonts, and background images, so that I can share a beautiful invite that reflects my event's theme.

#### 3.3 Detailed Description

Custom invitation designs let the host create a visual invitation card that can be exported as an image and shared via the share sheet (iMessage, WhatsApp, email, social media). The card builder provides preset themes per event type plus customization options for background image/color, accent color, font selection, and layout.

The invitation card displays the event title, date/time, location, and an optional custom message. The card is rendered as a static image (PNG, 1080x1920 pixels for story format or 1080x1080 for square format) suitable for sharing on social platforms.

There are 8 preset visual themes (elegant, playful, minimal, retro, neon, floral, rustic, modern) each with a coordinated color palette, font pairing, and layout. The host can start from a preset and customize, or build from scratch using a blank canvas.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Invitation uses event details

**External Dependencies:**
- Image rendering capability (Canvas API on web, native image rendering on mobile)
- Device share sheet for exporting

#### 3.5 User Interface Requirements

##### Screen: Invitation Designer

**Layout:**
- Full-screen card preview occupying the top 60% of the screen
- Below: a tabbed customization panel with tabs: Theme, Background, Colors, Text, Layout
- Theme tab: horizontal scroll of preset theme cards
- Background tab: solid color picker, gradient picker, or image upload button
- Colors tab: accent color picker (event title color, border color)
- Text tab: font family selector (8 fonts), custom message text area
- Layout tab: format selector (Portrait 9:16, Square 1:1), element visibility toggles (show date, show location, show custom message)
- "Export" button at the bottom: generates the image and opens share sheet

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Form opened, no customization | First preset theme applied with event details |
| Customizing | User modifying options | Live preview updates as user makes changes |
| Exporting | User tapped Export | Brief rendering spinner, then share sheet opens |

**Interactions:**
- Tap preset theme: Applies theme to preview (colors, font, layout change)
- Tap color swatch: Opens color picker
- Tap font option: Changes preview font
- Tap "Export": Renders image and opens share sheet
- Pinch/zoom on preview: Not supported (fixed layout)

#### 3.6 Data Requirements

##### Entity: InvitationDesign

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique design identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| theme_id | string | Optional | 'modern' | Preset theme identifier |
| background_type | enum | One of: solid, gradient, image | 'solid' | Background style |
| background_value | string | Color hex, gradient spec, or image URI | '#1a1a2e' | Background data |
| accent_color | string | Hex color | '#FB7185' | Primary accent color |
| font_family | string | One of 8 available fonts | 'Inter' | Text font family |
| custom_message | string | Optional, max 500 chars | null | Additional text on the card |
| format | enum | One of: portrait, square | 'portrait' | Output image aspect ratio |
| show_date | boolean | - | true | Whether to display date/time |
| show_location | boolean | - | true | Whether to display location |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification |

##### Available Fonts

| Font ID | Font Name | Style |
|---------|-----------|-------|
| inter | Inter | Clean, modern sans-serif |
| playfair | Playfair Display | Elegant serif |
| poppins | Poppins | Friendly rounded sans-serif |
| dancing | Dancing Script | Cursive/script |
| roboto-mono | Roboto Mono | Monospace/technical |
| lora | Lora | Classic book serif |
| bebas | Bebas Neue | Bold condensed display |
| caveat | Caveat | Handwritten casual |

##### Preset Themes

| Theme ID | Name | Background | Accent | Font | Best For |
|----------|------|-----------|--------|------|---------|
| elegant | Elegant | Dark navy gradient | Gold (#D4AF37) | Playfair | Weddings, galas |
| playful | Playful | Bright coral solid | White (#FFFFFF) | Poppins | Birthdays, kids |
| minimal | Minimal | White solid | Black (#000000) | Inter | Professional |
| retro | Retro | Warm beige (#F5E6D3) | Burnt orange (#CC5500) | Bebas | Themed parties |
| neon | Neon | Dark (#0D0D0D) | Hot pink (#FF1493) | Roboto Mono | Night events |
| floral | Floral | Soft green (#E8F5E9) | Rose (#E91E63) | Lora | Showers, garden |
| rustic | Rustic | Kraft paper texture | Dark brown (#5D4037) | Caveat | Outdoor, BBQ |
| modern | Modern | Charcoal (#1a1a2e) | Module pink (#FB7185) | Inter | General purpose |

#### 3.7 Business Logic Rules

##### Image Rendering

**Logic:**

```
1. Load event details (title, date, time, location)
2. Apply theme/customization settings
3. Compose card layout:
   a. Background layer (solid, gradient, or image)
   b. Title text (largest, accent color, selected font)
   c. Date/time text (medium, if show_date=true)
   d. Location text (medium, if show_location=true)
   e. Custom message text (smaller, if not null)
   f. Decorative elements from theme (borders, patterns)
4. Render to image:
   a. Portrait: 1080 x 1920 pixels (9:16)
   b. Square: 1080 x 1080 pixels (1:1)
5. Save to temporary file
6. Open share sheet with image
```

**Edge Cases:**
- Very long title: Truncate with ellipsis after 3 lines, reduce font size
- No location set: Hide location line, redistribute vertical spacing
- Background image fails to load: Fall back to solid color background

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image render fails | Toast: "Could not create invitation image." | Retry or change settings |
| Background image too large | Toast: "Image too large. Choose a smaller image." | User picks smaller image |
| Share sheet fails | Toast: "Could not share. Image saved to Photos." | Image saved locally as fallback |

#### 3.9 Acceptance Criteria

1. **Given** an event with title, date, and location,
   **When** the host opens the Invitation Designer and selects the "Elegant" theme,
   **Then** a preview shows the event details styled with dark navy background, gold text, and Playfair font.

2. **Given** the host customizes the accent color to red and changes the font to Poppins,
   **When** the preview updates,
   **Then** the title text is red in Poppins font.

3. **Given** the host taps "Export",
   **When** the image is rendered,
   **Then** a 1080x1920 PNG is generated and the share sheet opens.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| applies theme defaults | theme: 'elegant' | background=navy, accent=gold, font=Playfair |
| renders portrait dimensions | format: 'portrait' | 1080x1920 output |
| renders square dimensions | format: 'square' | 1080x1080 output |
| truncates long title | 200-char title | Title truncated with ellipsis at 3 lines |
| hides location if null | no location on event | Location line absent from card |
| all 8 themes render | iterate themes | No render errors |

---

### RS-015: Gift Registry / Wishlist

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-015 |
| **Feature Name** | Gift Registry / Wishlist |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host for a birthday or baby shower, I want to create a wishlist of gift ideas or link to an external registry, so that guests know what to get and avoid duplicates.

**Secondary:**
> As a Guest, I want to claim an item from the wishlist so that no one else buys the same thing.

#### 3.3 Detailed Description

The gift registry feature supports two modes: an in-app wishlist where the host adds items with names, optional descriptions, optional prices, and optional links; and external registry links where the host pastes URLs to Amazon, Target, or other registry platforms.

For the in-app wishlist, guests can "claim" items to indicate they plan to buy them. Claimed items show who claimed them (visible to host) or just "Claimed" (visible to other guests, to avoid spoiling surprises). The host can unclaim items on behalf of guests.

Each event can have at most one wishlist and up to 10 external registry links. The wishlist is accessible from the event detail screen via a "Gift Ideas" or "Registry" button, shown only for events where allow_chip_in is true or the event type is associated with gift-giving (birthday, baby shower, wedding, holiday).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Wishlist belongs to an event

**External Dependencies:**
- None (external registry links are just URLs opened in the browser)

#### 3.5 User Interface Requirements

##### Screen: Gift Registry

**Layout:**
- Accessible from event detail via "Gifts" button
- Two sections: "Wishlist" (in-app items) and "Registries" (external links)
- Wishlist: scrollable list of item cards, each showing: item name, description, price (if set), link (if set), claim status (Available / Claimed / Claimed by You)
- Each item card has a "Claim" button (for guests) or "Unclaim" button (if already claimed by this user)
- "Add Item" button at the bottom (host only)
- Registries: list of external link cards with name and URL, "Open" button to launch browser

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items or links | "No gift ideas yet" with "Add Item" CTA (host) or "Check back later" (guest) |
| Has Items | Items exist | Scrollable list with claim buttons |
| All Claimed | Every item claimed | All items show "Claimed" status |

**Interactions:**
- Tap "Claim": Marks item as claimed by this guest; button changes to "Unclaim"
- Tap "Unclaim": Releases the claim
- Tap item link: Opens URL in browser
- Tap "Open" on registry link: Opens URL in browser
- Tap "Add Item" (host): Opens add item form

##### Modal: Add Wishlist Item

**Layout:**
- Bottom sheet with: Item Name (required), Description (optional), Estimated Price (optional, currency input), Link/URL (optional), "Save" button

#### 3.6 Data Requirements

##### Entity: WishlistItem (New table: rv_wishlist_items)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique item identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| name | string | Required, max 200 chars | None | Item name |
| description | string | Optional, max 500 chars | null | Item description |
| price | float | Optional, min: 0 | null | Estimated price in user's currency |
| url | string | Optional, valid URL | null | Link to product page |
| claimed_by_name | string | Optional | null | Name of the guest who claimed it |
| claimed_at | datetime | Optional | null | When it was claimed |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

**Indexes:**
- event_id: Queried for listing all items for an event

**Validation Rules:**
- name: Must not be empty after trimming
- price: If provided, must be >= 0
- url: If provided, must be a valid URL format

#### 3.7 Business Logic Rules

##### Claim Logic

```
1. IF item.claimed_by_name IS NOT NULL:
     RETURN error "This item has already been claimed"
2. SET item.claimed_by_name = guest name
3. SET item.claimed_at = now()
```

##### Unclaim Logic

```
1. IF requester is the claimer OR requester is the host:
     SET item.claimed_by_name = null
     SET item.claimed_at = null
2. ELSE:
     RETURN error "Only the claimer or host can unclaim"
```

##### Visibility Rules

- Host sees: all items with full claim details (who claimed, when)
- Guest sees: all items; claimed items show "Claimed" (not by whom, to preserve surprise)
- Claimer sees: their own claimed items show "Claimed by You" with unclaim option

**Edge Cases:**
- Two guests claim the same item simultaneously: First write wins; second sees "Already claimed" error
- Host deletes a claimed item: Item is removed; no notification to claimer
- Event deleted: All wishlist items cascade-deleted

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Item already claimed | Toast: "This item has already been claimed" | User picks a different item |
| Invalid URL format | Inline validation: "Please enter a valid URL" | User corrects URL |
| Database write fails | Toast: "Could not save. Try again." | Retry |

#### 3.9 Acceptance Criteria

1. **Given** an event with a wishlist containing "Board Game" and "Gift Card",
   **When** a guest claims "Board Game",
   **Then** "Board Game" shows "Claimed" to other guests and "Claimed by [name]" to the host.

2. **Given** a guest claimed "Board Game",
   **When** the same guest taps "Unclaim",
   **Then** "Board Game" returns to "Available" status.

3. **Given** the host added an external registry link,
   **When** a guest taps "Open",
   **Then** the registry URL opens in the device browser.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates wishlist item | name: "Board Game" | Item created with claimed_by_name=null |
| claims item | item.id, guest: "Alice" | claimed_by_name="Alice", claimed_at set |
| rejects double claim | already claimed item | Error: "Already claimed" |
| host can unclaim | host unclaims Alice's item | claimed_by_name=null |
| non-claimer cannot unclaim | Bob tries to unclaim Alice's item | Permission error |

---

### RS-016: Expense Splitting

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-016 |
| **Feature Name** | Expense Splitting |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to track event expenses and split them among attendees, so that everyone pays their fair share.

**Secondary:**
> As a Guest, I want to see what I owe for the event and who to pay, so that I can settle up quickly.

#### 3.3 Detailed Description

Expense splitting lets the host (or any attendee) log expenses for an event and split them among participants. The system supports three split modes: equal split (total divided evenly), custom amounts (host assigns specific amounts per person), and itemized split (each expense is assigned to specific people).

Each expense has a description, amount, who paid it, and a split configuration. The settlement engine calculates the minimum number of transactions needed to settle all debts. For example, if Alice paid $100 and Bob paid $50 for a 2-person event, the engine calculates that Bob owes Alice $25 (not two separate transactions).

The expense summary shows: total event cost, per-person breakdown, who owes whom, and settlement status (settled/unsettled). The host can mark debts as settled manually.

This feature integrates with MyBudget (cross-module) to automatically log event expenses as budget transactions when both modules are enabled.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Expenses belong to an event
- RS-004: RSVP System - Split participants are derived from going RSVPs

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Expenses (within Event Detail)

**Layout:**
- Accessible via "Expenses" button on event detail
- Top section: total event cost, per-person average, and a summary (e.g., "You owe $25 to Alice")
- Below: scrollable list of expense cards, each showing: description, amount, who paid, split type icon
- "Add Expense" FAB at bottom-right
- Below expenses: "Settlements" section showing who owes whom with amounts and "Mark as Settled" buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No expenses | "No expenses yet" with "Add Expense" CTA |
| Has Expenses | Expenses logged | Expense list with running total and settlements |
| All Settled | All debts marked settled | Green banner: "All settled!" |

**Interactions:**
- Tap "Add Expense": Opens Add Expense modal
- Tap expense card: Opens detail/edit view
- Tap "Mark as Settled": Marks a specific debt as paid
- Swipe left on expense: Delete with confirmation

##### Modal: Add Expense

**Layout:**
- Bottom sheet with: Description (required), Amount (required, currency input), Paid By (dropdown of attendees), Split Type (segmented: Equal / Custom / Itemized)
- Equal: Amount divided by number of participants (shows per-person amount)
- Custom: List of participants with editable amount fields (must sum to total)
- Itemized: Assign this expense to specific people (checkboxes)
- "Split Among" selector: defaults to all going RSVPs, can be filtered
- "Save" button

#### 3.6 Data Requirements

##### Entity: EventExpense (New table: rv_expenses)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique expense identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| description | string | Required, max 200 chars | None | What the expense is for |
| amount | float | Required, min: 0.01, max: 999999.99 | None | Total amount in user's currency |
| paid_by_name | string | Required | None | Name of person who paid |
| split_type | enum | One of: equal, custom, itemized | 'equal' | How to split the cost |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification |

##### Entity: ExpenseSplit (New table: rv_expense_splits)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique split identifier |
| expense_id | string | FK to rv_expenses.id, ON DELETE CASCADE | None | Parent expense |
| participant_name | string | Required | None | Who owes this portion |
| amount | float | Required, min: 0 | None | Amount owed by this participant |
| is_settled | boolean | - | false | Whether this portion has been paid |
| settled_at | datetime | Optional | null | When marked as settled |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

**Indexes:**
- expense_id on rv_expense_splits: Queried for listing splits per expense
- event_id on rv_expenses: Queried for listing all expenses per event

#### 3.7 Business Logic Rules

##### Equal Split Calculation

**Inputs:**
- total_amount: float
- participants: string[] (names of people splitting)

**Logic:**

```
1. per_person = total_amount / participants.length
2. Round per_person to 2 decimal places
3. Remainder = total_amount - (per_person * participants.length)
4. IF remainder != 0:
     Add remainder to the first participant's share (penny rounding)
5. CREATE ExpenseSplit for each participant with calculated amount
```

**Example:**
- $100 split among 3 people: $33.34, $33.33, $33.33

##### Settlement Minimization Algorithm

**Purpose:** Calculate the minimum number of transactions to settle all debts for an event.

**Inputs:**
- expenses: list of all event expenses with splits

**Logic:**

```
1. FOR each participant, calculate net balance:
   net[participant] = total_paid - total_owed
   (positive = is owed money, negative = owes money)
2. Separate into creditors (net > 0) and debtors (net < 0)
3. Sort creditors descending by amount, debtors ascending by amount (most negative first)
4. WHILE debtors exist:
   a. Take the largest debtor and largest creditor
   b. settlement_amount = min(abs(debtor.net), creditor.net)
   c. Record transaction: debtor pays creditor settlement_amount
   d. Update both balances
   e. Remove anyone with balance = 0
5. RETURN list of settlement transactions
```

**Example:**
- Alice paid $120, Bob paid $60, Carol paid $0 for event total $180 split 3 ways ($60 each)
- Net balances: Alice = +$60, Bob = $0, Carol = -$60
- Settlement: Carol pays Alice $60 (1 transaction)

**Edge Cases:**
- All participants paid equally: No settlements needed
- One person paid everything: Everyone else pays that person their share
- Fractional cents: Round to nearest cent, apply remainder to largest transaction
- Division by zero (0 participants): Return empty settlement list
- Negative expense amount: Reject with validation error

##### Custom Split Validation

```
1. SUM of all custom amounts must equal the expense total
2. IF sum != total:
     Show validation error: "Custom amounts must add up to [total]"
3. Each individual amount must be >= 0
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Custom amounts do not sum to total | Inline: "Amounts must add up to $[total]. Currently $[sum]." | User adjusts amounts |
| No going RSVPs to split among | Message: "No confirmed guests to split with" | User adds guests first |
| Amount is zero or negative | Inline: "Amount must be greater than 0" | User enters valid amount |
| Description empty | Inline: "Description is required" | User fills in description |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an event with 4 going guests,
   **When** the host adds expense "Pizza" for $80 with equal split,
   **Then** each guest's share is $20 and the settlements section updates.

2. **Given** Alice paid $100 and Bob paid $50 for a 3-person event ($150 total, $50/person),
   **When** viewing settlements,
   **Then** Carol owes Alice $50 (minimum transactions).

3. **Given** a settlement "Carol owes Alice $50",
   **When** the host taps "Mark as Settled",
   **Then** the debt is marked settled with a timestamp.

**Edge Cases:**

4. **Given** $100 split among 3 people,
   **When** calculating equal split,
   **Then** shares are $33.34, $33.33, $33.33 (penny rounding to first participant).

5. **Given** everyone paid their exact share,
   **When** viewing settlements,
   **Then** "All settled!" message is shown (no transactions needed).

**Negative Tests:**

6. **Given** custom split amounts that sum to $90 for a $100 expense,
   **When** the user tries to save,
   **Then** validation error: "Amounts must add up to $100. Currently $90."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| equal split 3 ways | $100, 3 participants | $33.34, $33.33, $33.33 |
| equal split 2 ways | $100, 2 participants | $50.00, $50.00 |
| equal split 1 person | $100, 1 participant | $100.00 |
| settlement minimization | Alice paid $120, Bob $60, Carol $0; $60 each | Carol pays Alice $60 |
| no settlements needed | All paid equally | Empty settlement list |
| custom split validation | amounts sum to $90 for $100 expense | Validation error |
| rejects zero amount | amount: 0 | Validation error |
| marks settlement | settlement.id | is_settled=true, settled_at set |

---

### RS-017: Event Recap / Memories

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-017 |
| **Feature Name** | Event Recap / Memories |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to see an auto-generated event recap with photos, attendance stats, and highlights after the event ends, so that I can relive the memories and share a summary with guests.

#### 3.3 Detailed Description

After an event ends (start_at + duration has passed, or end_at has passed), the system generates a recap card summarizing the event. The recap includes: the event title and date, final headcount (going, checked in, plus-ones), response rate, top photos from the album (up to 6, selected by most recent or random), poll results (winning options), number of announcements and comments, and a "thanks for coming" message.

The recap is displayed as a scrollable card in the event detail view (replacing the RSVP dashboard for past events) and can be exported as an image for sharing via the share sheet. The recap is auto-generated from event data and requires no manual input from the host.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Recap uses event data
- RS-007: Photo Albums - Recap features photos

**External Dependencies:**
- Image rendering for export (same as RS-014)

#### 3.5 User Interface Requirements

##### Screen: Event Recap (replaces RSVP dashboard on past events)

**Layout:**
- A scrollable card with sections:
  1. Header: event title, date, cover image
  2. Attendance Stats: "X attended" (checked in), "Y RSVPed Going", "Z total headcount (with plus-ones)"
  3. Response Rate: percentage with a progress ring
  4. Photo Highlights: 2x3 grid of top photos (tappable to open album)
  5. Poll Results: winning option for each poll (if polls existed)
  6. Activity Summary: "X announcements, Y comments, Z photos shared"
  7. Footer: "Thanks for coming!" or custom message
- "Share Recap" button at the bottom exports the recap as an image

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Recap Available | Event is past | Full recap card displayed |
| No Data | Past event with no RSVPs or photos | Minimal recap with just title, date, and "No attendance data" |

#### 3.6 Data Requirements

No new tables. The recap is computed on-the-fly from existing event, RSVP, poll, photo, announcement, and comment data using the `getEventAnalytics()` function.

##### Recap Data Model (Computed, not stored)

| Field | Source | Description |
|-------|--------|-------------|
| eventTitle | rv_events.title | Event name |
| eventDate | rv_events.start_at | Event date |
| coverImage | rv_events.cover_image_url | Cover photo |
| totalGoing | rv_rsvps (response='going') count | RSVPs going |
| totalCheckedIn | rv_rsvps (checked_in_at != null) count | Actually attended |
| totalPlusOnes | rv_rsvps sum(plus_ones_count) for going | Additional guests |
| totalHeadcount | totalGoing + totalPlusOnes | Total expected |
| responseRate | EventAnalytics.responseRate | Fraction who responded |
| topPhotos | rv_photos (limit 6, most recent) | Photo highlights |
| pollResults | rv_polls + rv_poll_votes (winning option per poll) | Poll outcomes |
| announcementCount | rv_announcements count | Total announcements |
| commentCount | rv_comments count | Total comments |
| photoCount | rv_photos count | Total photos |

#### 3.7 Business Logic Rules

##### Recap Generation

**Logic:**

```
1. IF event is not past: do not generate recap
2. LOAD EventAnalytics for this event
3. LOAD top 6 photos (ORDER BY created_at DESC LIMIT 6)
4. FOR each closed poll:
   COUNT votes per option
   SELECT option with most votes as winner
   IF tie: select first option alphabetically
5. COMPOSE recap data object
6. RETURN recap for rendering
```

##### Recap Image Export

**Logic:**

```
1. Render recap card as an image (1080x1920)
2. Layout: cover image at top, stats in middle, photo grid at bottom
3. Export via share sheet
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No photos for highlight grid | Show placeholder: "No photos shared" | Grid section hidden |
| Export fails | Toast: "Could not create recap image." | Retry |

#### 3.9 Acceptance Criteria

1. **Given** a past event with 20 going guests, 15 checked in, and 8 photos,
   **When** viewing the event detail,
   **Then** the recap shows "15 attended", "20 RSVPed Going", 6 photo thumbnails, and activity counts.

2. **Given** a past event with a poll "What movie?" where "Inception" won with 8 votes,
   **When** viewing the recap,
   **Then** the poll results section shows "What movie? - Inception (8 votes)."

3. **Given** a past event recap,
   **When** the host taps "Share Recap",
   **Then** a recap image is generated and the share sheet opens.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates recap for past event | past event with data | Recap object with all fields |
| selects top 6 photos | 10 photos | 6 most recent |
| finds poll winner | poll with 3 options, votes: 5, 8, 3 | Winner = option with 8 votes |
| handles tie in poll | 2 options tied at 5 | First alphabetically selected |
| returns empty recap | past event with no data | Minimal recap with zeros |

---

### RS-018: Recurring Events

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-018 |
| **Feature Name** | Recurring Events |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Casual Organizer, I want to set up a recurring event (weekly game night, monthly book club) that automatically creates future instances with the same guest list, so that I do not have to recreate the event every time.

#### 3.3 Detailed Description

Recurring events allow the host to define a recurrence pattern (weekly, biweekly, monthly, annually) for an event. When a recurring event is created, the system generates future event instances based on the pattern. Each instance is a separate event record with its own RSVPs, polls, and photos, but shares the recurrence configuration.

The host can modify a single instance (exception) or all future instances (series edit). Modifying the series changes the template for future auto-generated instances but does not retroactively change past instances. The host can cancel (skip) individual instances without ending the recurrence.

The guest list from the most recent past instance is carried forward to the next instance. Guests who declined the previous instance are still invited to the next one (they may want to come next time). New guests added to one instance are automatically added to the recurrence going forward.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Recurring events are extended events
- RS-003: Guest Invite Management - Guest list inheritance

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Recurrence Settings (within Create/Edit Event)

**Layout:**
- A "Repeat" section in the Create Event form (collapsed by default)
- Expanding reveals: Frequency (segmented: Weekly / Biweekly / Monthly / Annually), Day of Week selector (for weekly/biweekly), Day of Month selector (for monthly), End Condition (segmented: Never / After X occurrences / On date)
- Below: preview text showing the pattern (e.g., "Every Tuesday, starting Apr 10, 2026")

**Interactions:**
- Toggle "Repeat" on: Shows recurrence options
- Select frequency: Updates preview text
- Set end condition: Limits how many instances are created

##### Modal: Edit Recurring Event

**Layout:**
- When editing a recurring event instance, a dialog asks: "Edit this event only" or "Edit all future events"
- "This event only": Opens edit form for this instance (creates an exception)
- "All future events": Opens edit form; changes apply to the recurrence template and all future instances

##### Modal: Cancel Instance

**Layout:**
- When deleting a recurring event instance: "Cancel this event only" or "Cancel all future events"
- "This event only": Marks this instance as cancelled (skipped) but does not end the recurrence
- "All future events": Ends the recurrence from this point forward

#### 3.6 Data Requirements

##### Entity: RecurrenceRule (New table: rv_recurrence_rules)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique recurrence rule ID |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | The "template" event (first instance) |
| frequency | enum | One of: weekly, biweekly, monthly, annually | None | How often the event repeats |
| day_of_week | integer | 0-6 (Sunday-Saturday), required for weekly/biweekly | null | Which day of the week |
| day_of_month | integer | 1-31, required for monthly | null | Which day of the month |
| end_type | enum | One of: never, count, date | 'never' | How the recurrence ends |
| end_count | integer | Min: 1, max: 52 | null | Number of occurrences (if end_type='count') |
| end_date | datetime | ISO 8601 | null | End date (if end_type='date') |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

##### Entity: RecurrenceInstance (New table: rv_recurrence_instances)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique instance tracking ID |
| recurrence_id | string | FK to rv_recurrence_rules.id, ON DELETE CASCADE | None | Parent recurrence rule |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | The generated event for this occurrence |
| occurrence_number | integer | Min: 1 | None | Which occurrence this is (1st, 2nd, 3rd...) |
| is_exception | boolean | - | false | Whether this instance has been individually modified |
| is_cancelled | boolean | - | false | Whether this instance has been skipped |
| original_start_at | datetime | ISO 8601 | None | The originally computed start date (before any exception edits) |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

**Indexes:**
- recurrence_id on rv_recurrence_instances: Queried for listing all instances
- event_id on rv_recurrence_rules: Queried for finding recurrence from event

#### 3.7 Business Logic Rules

##### Next Occurrence Calculation

**Inputs:**
- current_start: datetime (the current instance's start)
- frequency: 'weekly' | 'biweekly' | 'monthly' | 'annually'
- day_of_week: integer (0-6)
- day_of_month: integer (1-31)

**Logic:**

```
1. SWITCH frequency:
   CASE 'weekly':
     next_start = current_start + 7 days
   CASE 'biweekly':
     next_start = current_start + 14 days
   CASE 'monthly':
     next_start = current_start + 1 month
     IF day_of_month > days_in_next_month:
       next_start = last day of next month (clamp)
   CASE 'annually':
     next_start = current_start + 1 year
     IF original date is Feb 29 and next year is not leap:
       next_start = Feb 28 of next year
2. Preserve time-of-day from current_start
3. RETURN next_start
```

**Edge Cases:**
- Monthly on the 31st: Months with fewer days clamp to last day (Jan 31 -> Feb 28/29 -> Mar 31)
- Annual on Feb 29: Non-leap years use Feb 28
- DST transition: Preserve wall-clock time (if event is at 7 PM, it stays at 7 PM regardless of DST)

##### Instance Generation

**Purpose:** Create the next event instance when the current one passes.

**Logic:**

```
1. AFTER an event ends (past event detection):
   a. CHECK if event has a recurrence_rule
   b. IF yes:
      i. CHECK end condition:
         - end_type='never': always generate
         - end_type='count': generate if occurrence_number < end_count
         - end_type='date': generate if next_start < end_date
      ii. Calculate next_start using Next Occurrence Calculation
      iii. CREATE new event record with same details (title, description, location, settings)
      iv. COPY invite list from current instance to new instance (all invites, status reset to 'invited')
      v. CREATE rv_recurrence_instances record linking new event to recurrence
      vi. DO NOT copy: RSVPs, polls, announcements, photos, comments (each instance starts fresh)
```

##### Series Edit vs Single Edit

```
1. "This event only":
   a. SET is_exception = true on this instance
   b. Apply edits to this event record only
   c. Future instances use the original template

2. "All future events":
   a. Update the template event (first instance) with new values
   b. UPDATE all future unmodified instances (is_exception=false, start_at > now) with new values
   c. DO NOT modify past instances or exceptions
```

##### Guest List Inheritance

```
1. When generating a new instance:
   a. GET all invites from the most recent past instance
   b. FOR each invite:
      CREATE new invite in new instance with:
        - Same invitee_name, invitee_contact, plus_one_limit
        - Status reset to 'invited' (not carried forward)
        - invitee_type = 'recurring'
   c. NEW guests added to a future instance:
      Add to the recurrence's guest list template for all subsequent instances
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| End count reached | No new instances generated; host sees "Recurrence ended" | Host can extend by editing recurrence |
| End date passed | No new instances generated | Host can update end date |
| Monthly date clamp | Toast: "February doesn't have 31 days. Scheduled for Feb 28." | Informational only |
| Instance generation fails | Toast: "Could not create next event." | Retry on next app open |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the host creates a "Weekly Game Night" recurring every Tuesday,
   **When** the first Tuesday's event ends,
   **Then** a new event for the following Tuesday is automatically created with the same guest list.

2. **Given** a recurring event with 5 guests,
   **When** the host adds guest #6 to instance #3,
   **Then** guest #6 is also invited to instance #4 and beyond.

3. **Given** a recurring event,
   **When** the host edits instance #3 to change the location (this event only),
   **Then** instance #3 has the new location, but instance #4 uses the original location.

4. **Given** a recurring event,
   **When** the host edits "all future events" to change the time to 8 PM,
   **Then** all future non-exception instances update to 8 PM, but past instances remain unchanged.

**Edge Cases:**

5. **Given** a monthly event on the 31st,
   **When** the February instance is generated,
   **Then** it is scheduled for February 28 (or 29 in a leap year).

6. **Given** a recurring event with end_count=4,
   **When** the 4th instance ends,
   **Then** no 5th instance is generated and the host sees "Recurrence ended."

**Negative Tests:**

7. **Given** a recurring event,
   **When** the host cancels instance #3 ("this event only"),
   **Then** instance #3 is marked cancelled, but instance #4 is still generated normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| weekly next occurrence | start: Tue Apr 7, freq: weekly | next: Tue Apr 14 |
| biweekly next occurrence | start: Mon Apr 6, freq: biweekly | next: Mon Apr 20 |
| monthly clamps to last day | start: Jan 31, freq: monthly | next: Feb 28 |
| annual leap year handling | start: Feb 29 2024, freq: annually | next: Feb 28 2025 |
| respects end_count | count=3, occurrence=3 | No next instance |
| respects end_date | end_date: May 1, next would be May 5 | No next instance |
| copies guest list | 5 invites in current instance | 5 invites in next, all status='invited' |
| exception not propagated | instance #3 is exception | instance #4 uses template values |
| cancel single instance | cancel #3 | #3 is_cancelled=true, #4 still generated |

---

### RS-019: Map / Directions Integration

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-019 |
| **Feature Name** | Map / Directions Integration |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Guest, I want to see the event venue on a map and get directions with one tap, so that I can navigate to the event easily.

#### 3.3 Detailed Description

When an event has a location_address, the event detail screen shows an embedded static map preview with a pin at the venue location. Tapping the map opens the device's native maps app (Apple Maps on iOS, Google Maps on Android) with the venue address pre-filled for navigation.

The map preview also displays a "Get Directions" button that opens the native maps app in navigation mode. Below the map, venue details show: location name, full address, and optionally parking information and transit options (provided by the host in the event description or a dedicated parking notes field).

On web, the map is rendered using an embedded map image (static API) with a link to Google Maps. No interactive map is needed for MVP.

Geocoding (address to coordinates) is done on-device using the platform's geocoding API. If geocoding fails, the map preview is hidden and only the address text and "Open in Maps" link are shown.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Location data from the event

**External Dependencies:**
- Platform geocoding API (CoreLocation on iOS, Geocoder on Android)
- Native maps app for navigation

#### 3.5 User Interface Requirements

##### Screen: Map Section (within Event Detail)

**Layout:**
- Positioned below the date/time section in the event detail
- If location_address exists: a static map image (300px height) with a pin at the venue, venue name overlay at bottom of map
- Below the map: full address text (tappable to copy), "Get Directions" button, optional parking notes
- If only location_name exists (no address): text display of the name with no map
- If no location at all: section is hidden

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Map Available | location_address geocodes successfully | Static map with pin and "Get Directions" |
| Geocoding Failed | Address could not be geocoded | Address text and "Open in Maps" link (no map preview) |
| Name Only | location_name set but no address | Location name text, no map |
| No Location | Neither name nor address | Section hidden entirely |

**Interactions:**
- Tap map preview: Opens native maps app at venue location
- Tap "Get Directions": Opens native maps app in navigation/directions mode
- Tap address text: Copies address to clipboard with toast "Address copied"
- Long press map: No action

#### 3.6 Data Requirements

No new entities. Uses existing `location_name` and `location_address` fields from the Event entity (RS-001).

Optional addition to Event for enhanced location data:

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| location_latitude | float | Optional, -90 to 90 | null | Geocoded latitude |
| location_longitude | float | Optional, -180 to 180 | null | Geocoded longitude |
| parking_notes | string | Optional, max 500 chars | null | Parking instructions |

#### 3.7 Business Logic Rules

##### Geocoding

**Logic:**

```
1. WHEN event is created or location_address is updated:
   a. Call platform geocoding API with location_address
   b. IF success: store latitude/longitude on event record
   c. IF failure: leave latitude/longitude as null (no map preview)
2. Geocoding is done once on save, not on every view
3. Cache result in event record to avoid repeated API calls
```

##### Maps Deep Link Construction

**Logic:**

```
1. iOS: "maps://?daddr=[encoded_address]" or "maps://?ll=[lat],[lon]"
2. Android: "geo:[lat],[lon]?q=[encoded_address]"
3. Web: "https://maps.google.com/maps?daddr=[encoded_address]"
4. Prefer coordinates if available; fall back to address string
```

**Edge Cases:**
- Address is ambiguous (geocoding returns multiple results): Use the first result
- Address is in a different country: Geocoding handles international addresses
- User has no maps app: Link opens in browser

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Geocoding fails | Map preview hidden; address text and "Open in Maps" link shown | User can tap link to try in maps app |
| Maps app not installed | Link opens in browser-based maps | Transparent fallback |
| Address copy fails | No toast | Silent failure, unlikely |

#### 3.9 Acceptance Criteria

1. **Given** an event with location_address "456 Market St, San Francisco, CA",
   **When** viewing the event detail,
   **Then** a static map with a pin is shown with the venue name and a "Get Directions" button.

2. **Given** the map is visible,
   **When** the guest taps "Get Directions",
   **Then** the native maps app opens with navigation to "456 Market St, San Francisco, CA."

3. **Given** an event with location_name "Jake's House" but no address,
   **When** viewing the event detail,
   **Then** only the text "Jake's House" is displayed with no map.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates iOS maps URL | address: "123 Main St" | "maps://?daddr=123%20Main%20St" |
| generates Android maps URL | lat: 37.7749, lon: -122.4194 | "geo:37.7749,-122.4194?q=..." |
| generates web maps URL | address: "123 Main St" | Google Maps URL |
| hides map when no address | location_address: null | Map section hidden |
| shows name when no address | location_name: "Jake's House" | Text only |

---

### RS-020: Dietary Preference Collection

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-020 |
| **Feature Name** | Dietary Preference Collection |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Social Host planning a dinner, I want to collect dietary restrictions and food allergies from guests as part of their RSVP, so that I can plan the menu accordingly.

**Secondary:**
> As a Guest, I want to indicate my dietary needs when RSVPing, so that the host can accommodate me.

#### 3.3 Detailed Description

Dietary preference collection adds a structured "dietary" question type to the RSVP flow. When the host enables dietary collection for an event (or uses a food-related template), a special RSVP question is added with predefined options: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut Allergy, Shellfish Allergy, Kosher, Halal, and a free-text "Other" field.

Guests select all that apply during the RSVP process. The host sees an aggregated dietary summary: "3 vegetarian, 1 vegan, 2 gluten-free, 1 other: 'No cilantro please'". This summary helps with menu planning and integrates with MyRecipes (cross-module) for recipe filtering.

The dietary question uses the existing `rv_questions` and `rv_question_responses` tables with `type='dietary'`, so no new tables are needed. The question is created automatically when the host enables dietary collection, and responses are stored as a JSON array of selected options.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Dietary collection is per event
- RS-004: RSVP System - Dietary question appears in RSVP flow

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Dietary Question (within RSVP Flow)

**Layout:**
- Appears as an additional step in the RSVP flow after the response (Going/Maybe/Declined) and plus-ones
- Title: "Any dietary restrictions?"
- A list of checkbox options: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut Allergy, Shellfish Allergy, Kosher, Halal
- Below: a text input labeled "Other (specify)" for free-text dietary notes
- "Skip" link for guests with no restrictions

##### Screen: Dietary Summary (Host view, within Event Detail)

**Layout:**
- A card in the event detail showing aggregated dietary data
- Each restriction with a count badge: "Vegetarian (3)", "Gluten-Free (2)"
- Below: a list of "Other" responses with guest names
- Expandable section showing per-guest dietary breakdown

**Interactions:**
- Tap dietary summary card: Expands to show per-guest details
- Tap guest name in expanded view: Navigates to RSVP detail

#### 3.6 Data Requirements

Uses existing `rv_questions` (type='dietary') and `rv_question_responses` (answer_json = JSON array of selected options).

##### Predefined Dietary Options (Static Configuration)

| Option ID | Label | Category |
|-----------|-------|----------|
| vegetarian | Vegetarian | Diet |
| vegan | Vegan | Diet |
| gluten_free | Gluten-Free | Allergy |
| dairy_free | Dairy-Free | Allergy |
| nut_allergy | Nut Allergy | Allergy |
| shellfish_allergy | Shellfish Allergy | Allergy |
| kosher | Kosher | Religious |
| halal | Halal | Religious |
| other | Other (specify) | Custom |

##### Answer Format

```json
{
  "selections": ["vegetarian", "nut_allergy"],
  "other": "No cilantro please"
}
```

#### 3.7 Business Logic Rules

##### Dietary Aggregation

**Logic:**

```
1. GET all question_responses WHERE question.type = 'dietary' AND event_id = target
2. FOR each response:
   Parse answer_json
   Count each selected option
   Collect "other" text entries
3. RETURN aggregated counts and "other" list with guest names
```

**Formulas:**
- `option_count[X]` = number of guests who selected option X
- `other_entries` = list of {guest_name, text} for "other" selections

**Edge Cases:**
- Guest skips dietary question: No response recorded, not counted in aggregation
- Guest selects nothing but enters "Other" text: Only "other" is counted
- Guest updates RSVP: Previous dietary response is replaced

##### MyRecipes Integration (Cross-Module)

```
1. IF MyRecipes module is enabled:
   EXPOSE dietary summary as a structured object
   MyRecipes can query: "For this event, filter recipes to exclude [allergens]"
   Scale recipe servings to match guest count
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Dietary question fails to load | RSVP continues without dietary step | No dietary data collected |

#### 3.9 Acceptance Criteria

1. **Given** an event with dietary collection enabled,
   **When** a guest RSVPs "Going" and selects "Vegetarian" and "Nut Allergy",
   **Then** their dietary preferences are saved and the host's summary shows "Vegetarian (1), Nut Allergy (1)."

2. **Given** 3 guests with vegetarian selected and 1 with "Other: No cilantro",
   **When** the host views the dietary summary,
   **Then** the summary shows "Vegetarian (3)" and the "Other" section shows the guest's name and note.

3. **Given** a guest previously selected "Vegan" and updates to "Gluten-Free",
   **When** the summary refreshes,
   **Then** Vegan decreases by 1 and Gluten-Free increases by 1.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates single option | 3 guests select "vegetarian" | vegetarian: 3 |
| aggregates multiple options | 1 guest selects vegetarian + nut_allergy | Both counted |
| handles other text | guest enters "No cilantro" | other_entries includes entry |
| update replaces previous | guest changes from vegan to gluten_free | vegan: 0, gluten_free: 1 |
| skip returns no response | guest skips | Not counted in any option |

---

### RS-021: Seating Arrangement Tool

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-021 |
| **Feature Name** | Seating Arrangement Tool |
| **Priority** | P3 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As an Event Planner organizing a wedding or formal dinner, I want to create a visual seating chart with tables and assigned seats, so that I can organize where each guest sits.

#### 3.3 Detailed Description

The seating arrangement tool provides a drag-and-drop visual editor for assigning guests to tables and seats. The host creates tables (round, rectangular, or custom shapes), sets the number of seats per table, and drags guest names from an unassigned list onto specific seats.

The tool supports constraints: "seat together" (e.g., couples), "keep apart" (e.g., exes), and table capacity limits. When the host drags a guest who has a "seat together" constraint, the paired guest is highlighted for co-placement. Violations of "keep apart" constraints show a warning.

The seating chart can be exported as an image for printing or sharing. The tool is most useful for weddings, formal dinners, and galas; casual events typically skip this feature.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Seating belongs to an event
- RS-004: RSVP System - Seats are assigned to guests with RSVPs

**External Dependencies:**
- Canvas or SVG rendering for the visual editor

#### 3.5 User Interface Requirements

##### Screen: Seating Chart Editor

**Layout:**
- Split view: left panel (40%) shows the unassigned guest list with search, right panel (60%) shows the visual seating layout
- The seating layout is a zoomable/pannable canvas with table shapes
- Tables are draggable circles (round tables) or rectangles (long tables) with numbered seats around them
- Each seat shows the guest name (or "Empty")
- Toolbar at top: Add Table (round/rectangle), Table Size (seat count), Constraints, Export

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tables created | Canvas shows "Add a table to start" with "Add Table" button |
| Tables Only | Tables exist but no guests assigned | Tables with empty seats, full guest list on left |
| Partially Assigned | Some guests placed | Assigned seats show names; unassigned list shrinks |
| Fully Assigned | All guests placed | Unassigned list empty, "All guests seated" message |
| Constraint Violation | Keep-apart pair at same table | Table border turns red, warning tooltip |

**Interactions:**
- Drag guest from list to seat: Assigns guest to that seat
- Drag guest between seats: Moves guest to new seat
- Drag guest back to list: Unassigns guest
- Tap table: Select table for editing (rename, resize, delete)
- Pinch/zoom canvas: Zoom in/out on the layout
- Pan canvas: Scroll the layout

##### Modal: Table Settings

**Layout:**
- Name (e.g., "Table 1", "Head Table"), Shape (Round/Rectangle), Seats (number stepper, 2-20), "Save" and "Delete" buttons

##### Modal: Seating Constraints

**Layout:**
- Two tabs: "Seat Together" and "Keep Apart"
- Each tab: list of guest pairs with "Add Pair" button
- Add Pair: two guest name dropdowns, "Save" button

#### 3.6 Data Requirements

##### Entity: SeatingTable (New table: rv_seating_tables)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique table identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| name | string | Required, max 100 chars | 'Table 1' | Table display name |
| shape | enum | One of: round, rectangle | 'round' | Table shape |
| seat_count | integer | Min: 2, Max: 20 | 8 | Number of seats |
| position_x | float | - | 0 | X position on canvas (percentage) |
| position_y | float | - | 0 | Y position on canvas (percentage) |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

##### Entity: SeatAssignment (New table: rv_seat_assignments)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique assignment identifier |
| table_id | string | FK to rv_seating_tables.id, ON DELETE CASCADE | None | Which table |
| seat_number | integer | Min: 1, Max: table.seat_count | None | Which seat at the table |
| rsvp_id | string | FK to rv_rsvps.id, ON DELETE SET NULL | None | Which guest |
| guest_name | string | Required | None | Guest display name (denormalized for display) |
| created_at | datetime | Auto-set | Current timestamp | Assignment time |

##### Entity: SeatingConstraint (New table: rv_seating_constraints)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique constraint identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE | None | Parent event |
| type | enum | One of: together, apart | None | Constraint type |
| guest_a_name | string | Required | None | First guest in the pair |
| guest_b_name | string | Required | None | Second guest in the pair |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

**Indexes:**
- event_id on rv_seating_tables: Queried for listing all tables
- table_id on rv_seat_assignments: Queried for listing seats per table
- event_id on rv_seating_constraints: Queried for constraint checking

#### 3.7 Business Logic Rules

##### Constraint Validation

**Logic:**

```
1. AFTER each seat assignment:
   a. GET all 'apart' constraints for this event
   b. FOR each 'apart' constraint:
      IF guest_a and guest_b are at the same table:
        Show warning: "[Guest A] and [Guest B] are at the same table (keep apart)"
   c. GET all 'together' constraints
   d. FOR each 'together' constraint:
      IF guest_a is assigned but guest_b is not at the same table:
        Show suggestion: "[Guest B] should sit with [Guest A]"
2. Constraints are warnings, not hard blocks (host can override)
```

##### Seat Count Validation

```
1. Assignments per table must not exceed table.seat_count
2. IF host tries to assign guest to a full table:
     Show error: "This table is full ([seat_count] seats)"
3. IF host reduces seat_count below current assignments:
     Show error: "Remove [N] guests before reducing seats"
```

##### Seating Chart Export

```
1. Render the canvas layout as an image (1080x1080 or A4 landscape)
2. Each table shows its name and the list of seated guests
3. Include event title, date, and "Seating Chart" header
4. Export via share sheet or save to photos
```

**Edge Cases:**
- Guest cancels RSVP after being seated: Seat becomes empty (rsvp_id set to null via ON DELETE SET NULL)
- Table deleted with guests assigned: All seat assignments cascade-deleted; guests return to unassigned list
- Guest with plus-ones: Plus-ones are not individually seated (only the primary RSVP guest has a seat)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Table full | Toast: "Table is full" | User assigns to different table |
| Constraint violation (apart) | Yellow warning on table | Host can override or move guest |
| Canvas render fails | Toast: "Could not display seating chart" | Reload screen |
| Export fails | Toast: "Could not export chart" | Retry |

#### 3.9 Acceptance Criteria

1. **Given** an event with 20 going guests,
   **When** the host creates 3 round tables (8 seats each) and drags guests to seats,
   **Then** the chart shows 3 tables with guest names and the unassigned list updates.

2. **Given** a "keep apart" constraint between Alice and Bob,
   **When** the host places both at Table 1,
   **Then** Table 1 shows a red border with warning "Alice and Bob should be kept apart."

3. **Given** a complete seating chart,
   **When** the host taps "Export",
   **Then** a printable image is generated with all tables and guest assignments.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates table with seats | shape: round, seats: 8 | Table with 8 empty seats |
| assigns guest to seat | rsvp_id, table_id, seat_number | Assignment created |
| rejects full table | table with 8/8 seats, new assignment | Error: table full |
| detects apart violation | Alice+Bob apart constraint, both at Table 1 | Warning returned |
| detects together suggestion | Alice+Bob together, Alice at Table 1, Bob unassigned | Suggestion returned |
| cascades on table delete | delete table with 3 assignments | 3 assignments deleted |
| handles RSVP cancellation | seated guest cancels | Seat emptied |

---

### RS-022: Guest Messaging / Event Chat

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-022 |
| **Feature Name** | Guest Messaging / Event Chat |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Guest, I want to post messages in the event's chat to coordinate logistics with other attendees (e.g., "I'm bringing chips" or "Running 10 minutes late"), so that we can communicate as a group.

#### 3.3 Detailed Description

Event chat is a simple message thread for event attendees. It uses the existing `rv_comments` table, which already supports per-event messaging with guest names and timestamps. This feature enhances the Feed tab to function as a true chat experience with real-time-feel updates (polling on app foreground, not WebSockets).

Messages appear in chronological order (oldest first, newest at bottom). The chat input is pinned to the bottom of the screen. Messages from the host are visually distinct (highlighted background, host badge). Messages from the current user are right-aligned (chat bubble style).

The chat is accessible only to guests who have RSVPed (any response) and the host/co-hosts. Non-RSVPed visitors cannot read or post messages. The host can delete any message; guests can only delete their own messages.

This feature reuses the existing Comments entity (RS-006) and simply enhances the UI presentation. No new tables are needed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Chat belongs to an event
- RS-004: RSVP System - Only RSVPed guests can participate

**External Dependencies:**
- None (local-only, no real-time sync)

#### 3.5 User Interface Requirements

##### Screen: Event Chat (Feed Tab enhanced)

**Layout:**
- The Feed tab now functions as a chat view with announcements interspersed
- Messages displayed as chat bubbles: left-aligned for other guests, right-aligned for current user
- Host messages have a highlighted background and "Host" badge
- Announcements appear as full-width cards (distinct from chat bubbles)
- Text input pinned to bottom of screen with "Send" button
- Auto-scroll to newest message on load

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No messages or announcements | "Be the first to say something!" with text input |
| Active | Messages exist | Chronological chat with announcements interspersed |
| Sending | User tapped Send | Message appears immediately with a sending indicator |

**Interactions:**
- Type message and tap Send: Creates comment record, message appears instantly
- Long press own message: Shows "Delete" option
- Long press others' message (host only): Shows "Delete" option
- Scroll up: Loads older messages
- New message arrives (on foreground poll): Scrolls to bottom with animation

#### 3.6 Data Requirements

No new entities. Uses existing `rv_comments` table (Entity: EventComment from RS-006 Announcements section, reused here for chat).

#### 3.7 Business Logic Rules

##### Message Access Control

```
1. READ access: user has an RSVP for this event (any response) OR user is host/co-host
2. WRITE access: same as READ
3. DELETE own: user is the message author
4. DELETE any: user is host or co-host
```

##### Chat Polling

```
1. On screen foreground: query rv_comments WHERE event_id = target AND created_at > last_known_timestamp
2. Poll interval: 10 seconds when screen is active
3. On screen background: stop polling
4. On new message found: append to list, auto-scroll if user is at bottom
```

**Edge Cases:**
- Chat disabled (allow_comments=false): Feed tab shows only announcements, text input hidden
- Very long message (>2000 chars): Truncated at 2000 chars with "..." and "Read more" link
- Rapid messages: Debounce send button to prevent duplicates (300ms cooldown)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Send fails | Message shows red error indicator with retry button | Tap retry |
| Empty message | Send button disabled | No action needed |
| Message too long | Inline: "Message too long (max 2000 characters)" | User shortens |

#### 3.9 Acceptance Criteria

1. **Given** an event chat with 5 messages,
   **When** a guest sends "I'm bringing dessert",
   **Then** the message appears as a right-aligned bubble at the bottom of the chat.

2. **Given** the host posts a message,
   **When** viewing the chat,
   **Then** the host's message has a highlighted background and "Host" badge.

3. **Given** a guest's own message,
   **When** the guest long-presses it,
   **Then** a "Delete" option appears, and tapping it removes the message.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates message | guestName: "Alice", message: "Hello" | Comment record created |
| enforces 2000 char limit | 2500-char message | Validation error |
| host can delete any message | host deletes guest's message | Message deleted |
| guest can only delete own | guest A deletes guest B's message | Permission error |
| debounces rapid sends | 2 sends within 300ms | Only first send executes |

---

### RS-023: Event Budget Tracker

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-023 |
| **Feature Name** | Event Budget Tracker |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host, I want to set a budget for my event and track expenses by category (venue, food, decorations, entertainment), so that I can stay within budget and see a breakdown of costs.

#### 3.3 Detailed Description

The event budget tracker adds budget planning on top of the expense tracking from RS-016. The host sets a total budget for the event and allocates it across categories. As expenses are logged (via RS-016), they are categorized and the budget view shows spending vs. budget per category with progress bars.

Budget categories are: Venue, Food & Drink, Decorations, Entertainment, Rentals, Transportation, Gifts/Favors, Photography, Invitations, and Other. The host can add custom categories.

The budget dashboard shows: total budget, total spent, remaining budget, and a per-category breakdown with budget vs. actual bars. If spending exceeds a category's budget, the bar turns red. If total spending exceeds the total budget, a warning banner appears.

This is tightly coupled with RS-016 (Expense Splitting). Each expense from RS-016 can optionally be assigned a budget category. The budget tracker aggregates these into the dashboard view.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Budget belongs to an event
- RS-016: Expense Splitting - Budget categories applied to expenses

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Budget Dashboard (within Event Detail)

**Layout:**
- Accessible via "Budget" button on event detail, shown only if allow_chip_in is true
- Top section: total budget (editable), total spent, remaining (color-coded: green if under, red if over)
- Below: category breakdown, each row showing: category name, budget amount, spent amount, progress bar, percentage
- "Edit Budget" button to modify category allocations
- "Add Expense" button linking to RS-016's expense form (pre-selects category)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Budget Set | Budget not configured | "Set a budget" prompt with total budget input |
| Budget Set | Budget configured | Dashboard with category breakdowns |
| Under Budget | Total spent < total budget | Green remaining amount |
| Over Budget | Total spent > total budget | Red warning banner: "Over budget by $X" |

#### 3.6 Data Requirements

##### Entity: EventBudget (New table: rv_event_budgets)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique budget identifier |
| event_id | string | FK to rv_events.id, ON DELETE CASCADE, UNIQUE | None | Parent event (one budget per event) |
| total_budget | float | Required, min: 0 | None | Total event budget |
| currency | string | 3-char ISO 4217 | 'USD' | Currency code |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification |

##### Entity: BudgetCategory (New table: rv_budget_categories)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique category identifier |
| budget_id | string | FK to rv_event_budgets.id, ON DELETE CASCADE | None | Parent budget |
| name | string | Required, max 100 chars | None | Category name |
| allocated_amount | float | Min: 0 | 0 | Budgeted amount for this category |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

##### Addition to EventExpense (RS-016)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| category_id | string | FK to rv_budget_categories.id, ON DELETE SET NULL | null | Budget category for this expense |

#### 3.7 Business Logic Rules

##### Budget Calculations

**Formulas:**
- `total_spent` = SUM(rv_expenses.amount) WHERE event_id = target
- `category_spent[cat]` = SUM(rv_expenses.amount) WHERE category_id = cat
- `remaining` = total_budget - total_spent
- `category_remaining[cat]` = category.allocated_amount - category_spent[cat]
- `category_percentage[cat]` = (category_spent / category.allocated_amount) * 100

**Edge Cases:**
- Sum of category allocations exceeds total budget: Warning "Category budgets exceed total budget by $X"
- Expense without a category: Counted in total_spent but not in any category breakdown
- Total budget set to 0: All spending shows as "over budget"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Budget is 0 | Warning: "Total budget is $0" | User sets a budget amount |
| Category allocations exceed total | Warning: "Category budgets exceed total by $X" | User adjusts allocations |

#### 3.9 Acceptance Criteria

1. **Given** an event with a $500 budget and categories Venue ($200), Food ($200), Decorations ($100),
   **When** $150 is spent on Food,
   **Then** the Food category shows $150/$200 (75%) and the total shows $150/$500.

2. **Given** total spending reaches $550 on a $500 budget,
   **When** viewing the dashboard,
   **Then** a red warning banner shows "Over budget by $50."

3. **Given** a budget with 3 categories,
   **When** the host adds a custom category "Photography" with $100 allocated,
   **Then** the new category appears in the breakdown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates remaining | budget: $500, spent: $300 | remaining: $200 |
| calculates category percentage | allocated: $200, spent: $150 | 75% |
| detects over budget | budget: $500, spent: $600 | over by $100 |
| handles zero budget | budget: $0, spent: $50 | over by $50 |
| warns on over-allocated categories | total: $500, categories sum: $600 | Warning |

---

### RS-024: QR Code Check-in

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-024 |
| **Feature Name** | QR Code Check-in |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host at a large event, I want to generate a unique QR code for each guest and scan it at the door for quick check-in, so that check-in is fast and accurate.

#### 3.3 Detailed Description

QR Code Check-in extends the manual check-in system (RS-008) with automated scanning. Each RSVP generates a unique QR code containing the RSVP ID. The host (or co-host) opens the QR scanner on their device's camera, scans a guest's QR code, and the system automatically marks them as checked in.

QR codes are generated locally using the RSVP UUID encoded in a QR code image. Guests can display their QR code from the event detail screen (shown under their RSVP confirmation). The QR code can also be included in the calendar event or invitation.

The scanner validates the QR code against the event's RSVP list. If the code is valid, the guest is checked in with a success animation. If the code is invalid (not found, already checked in, wrong event), an error is shown.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - QR codes are per event
- RS-008: Check-in System - QR extends manual check-in

**External Dependencies:**
- Camera access for scanning
- QR code generation library (on-device, no network)

#### 3.5 User Interface Requirements

##### Screen: QR Scanner (within Check-in)

**Layout:**
- Full-screen camera viewfinder with a square QR scanning frame in the center
- At the top: "Scan QR Code" title with event name
- At the bottom: manual check-in button ("Can't scan? Search by name") and a close button
- On successful scan: green overlay with guest name and checkmark animation (1 second), then ready for next scan
- On failed scan: red overlay with error message (2 seconds)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Scanning | Camera active, looking for QR | Viewfinder with scanning frame |
| Success | Valid QR scanned | Green flash, guest name, checkmark |
| Already Checked In | Guest already checked in | Yellow flash: "[Name] is already checked in" |
| Invalid | QR not found for this event | Red flash: "Invalid code" |
| Camera Denied | Camera permission not granted | Permission prompt |

##### Screen: Guest QR Code (Guest's view)

**Layout:**
- Accessible from the guest's RSVP confirmation screen
- Large QR code image centered on screen with event title above and guest name below
- "Save to Photos" button below the QR code
- High-contrast (black on white) for reliable scanning

#### 3.6 Data Requirements

No new tables. QR codes encode the RSVP UUID: `myrsvp://checkin/{event_id}/{rsvp_id}`.

The QR code payload is a simple string, not a URL. The scanner parses it to extract event_id and rsvp_id.

#### 3.7 Business Logic Rules

##### QR Code Generation

```
1. INPUT: event_id, rsvp_id
2. ENCODE string: "myrsvp://checkin/{event_id}/{rsvp_id}"
3. GENERATE QR code image (256x256 pixels, error correction level M)
4. RETURN QR code as image
```

##### QR Code Scanning

```
1. Camera detects QR code
2. PARSE payload: extract event_id and rsvp_id
3. VALIDATE:
   a. IF event_id != current event: SHOW "Wrong event"
   b. IF rsvp_id not found in rv_rsvps: SHOW "Invalid code"
   c. IF rsvp.checked_in_at is not null: SHOW "Already checked in"
   d. IF rsvp.response != 'going': SHOW "Guest did not RSVP Going"
4. IF valid:
   SET rsvp.checked_in_at = now()
   SHOW success with guest name
   Play success haptic feedback
5. After 1 second: return to scanning mode for next guest
```

**Edge Cases:**
- Non-MyRSVP QR code scanned: Show "Invalid code" (payload does not match expected format)
- Low-light scanning: Camera flash toggle available
- Rapid successive scans: 1-second cooldown between check-ins to prevent double-scanning

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | "Camera access needed for scanning. Enable in Settings." | Link to settings |
| Wrong event QR | Red flash: "This code is for a different event" | Scan another code |
| Already checked in | Yellow flash: "[Name] is already checked in" | Continue scanning |
| Non-RSVP QR code | Red flash: "Invalid code" | Scan another code |

#### 3.9 Acceptance Criteria

1. **Given** a guest who RSVPed "Going",
   **When** the host scans their QR code at the door,
   **Then** the guest is checked in with a green success animation showing their name.

2. **Given** a guest who was already checked in,
   **When** the host scans their QR code again,
   **Then** a yellow message shows "[Name] is already checked in."

3. **Given** a QR code from a different event,
   **When** scanned,
   **Then** a red error shows "This code is for a different event."

4. **Given** a guest with a QR code on their phone,
   **When** they tap "Save to Photos",
   **Then** the QR code image is saved to their device photo library.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid QR payload | event_id, rsvp_id | "myrsvp://checkin/{event_id}/{rsvp_id}" |
| parses valid QR payload | "myrsvp://checkin/e1/r1" | {event_id: "e1", rsvp_id: "r1"} |
| rejects invalid payload | "https://example.com" | Parse error |
| rejects wrong event | scan event B code at event A | "Wrong event" error |
| rejects already checked in | rsvp.checked_in_at is set | "Already checked in" |
| checks in valid scan | valid payload, rsvp exists | checked_in_at set |

---

### RS-025: Event Countdown Widget

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-025 |
| **Feature Name** | Event Countdown Widget |
| **Priority** | P2 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Guest or Host, I want a home screen widget showing a countdown to my next event, so that I can see at a glance how much time is left.

#### 3.3 Detailed Description

The event countdown widget is a home screen widget (iOS WidgetKit, Android Glance) that displays the time remaining until the user's next upcoming event. The widget shows the event title, date/time, and a countdown in days/hours/minutes format.

The widget supports three sizes: small (event title + countdown), medium (title + countdown + location), and large (title + countdown + location + RSVP summary). The widget updates every 15 minutes (or more frequently as the event approaches).

The user selects which event to display in the widget configuration, or sets it to "Next Event" (automatic, always shows the soonest upcoming event).

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Widget displays event data

**External Dependencies:**
- iOS WidgetKit or Android Glance API
- Home screen widget support on the device

#### 3.5 User Interface Requirements

##### Widget: Small (2x2)

**Layout:**
- Event title (1 line, truncated)
- Countdown: "3 days 5 hours" or "2 hours 15 min" or "Starting now!"
- Module accent color background (#FB7185)

##### Widget: Medium (4x2)

**Layout:**
- Event title (1 line)
- Date/time: "Apr 15, 7:00 PM"
- Location: "The Rooftop Lounge" (1 line, truncated)
- Countdown: "3 days, 5 hours"

##### Widget: Large (4x4)

**Layout:**
- Event title
- Date/time and location
- Countdown with days/hours/minutes
- RSVP summary: "12 going, 3 maybe"
- Cover image (if available) as background

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Countdown Active | Event is in the future | Countdown timer with event details |
| Starting Now | Within 30 minutes of start | "Starting now!" or "Started 5 min ago" |
| No Events | No upcoming events | "No upcoming events" with MyRSVP icon |
| Event Today | Event is today | "Today!" badge with time |

#### 3.6 Data Requirements

No new tables. Widget reads from rv_events (upcoming events sorted by start_at).

Widget configuration is stored via the platform's widget configuration API (UserDefaults on iOS, SharedPreferences on Android).

#### 3.7 Business Logic Rules

##### Countdown Calculation

```
1. GET selected event (or next upcoming event)
2. time_remaining = event.start_at - now()
3. IF time_remaining > 24 hours:
     Display: "X days Y hours"
4. IF time_remaining > 1 hour:
     Display: "X hours Y min"
5. IF time_remaining > 0:
     Display: "X min"
6. IF time_remaining <= 0 AND time_remaining > -30 min:
     Display: "Starting now!" or "Started X min ago"
7. IF time_remaining <= -30 min:
     Switch to next upcoming event
```

##### Widget Update Frequency

```
1. > 24 hours before event: update every 15 minutes
2. 1-24 hours before event: update every 5 minutes
3. < 1 hour before event: update every 1 minute
4. After event start: update once to show next event
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Selected event deleted | Widget switches to "Next Event" mode | Automatic |
| No upcoming events | "No upcoming events" with app icon | Tap widget to open app |
| Widget data stale | Shows last known state with age indicator | Next update cycle refreshes |

#### 3.9 Acceptance Criteria

1. **Given** an event 3 days and 5 hours away,
   **When** viewing the small widget,
   **Then** it shows the event title and "3 days 5 hours."

2. **Given** an event starting in 15 minutes,
   **When** viewing the widget,
   **Then** it shows "15 min" with high-frequency updates.

3. **Given** the selected event has passed and another event exists,
   **When** the widget updates,
   **Then** it switches to the next upcoming event.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| formats days + hours | 3 days 5 hours | "3 days 5 hours" |
| formats hours + minutes | 2 hours 30 min | "2 hours 30 min" |
| formats minutes only | 15 min | "15 min" |
| shows starting now | 0 min | "Starting now!" |
| switches to next event | current event passed | Next event displayed |
| handles no events | no upcoming events | "No upcoming events" |

---

### RS-026: Guest Tags / Groups

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | RS-026 |
| **Feature Name** | Guest Tags / Groups |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Social Host who organizes multiple events, I want to tag guests as "family", "work friends", or "college friends", so that I can quickly invite an entire group to a new event instead of adding people one by one.

#### 3.3 Detailed Description

Guest tags allow the host to organize their contacts into reusable groups. Tags are global (not per-event), so a tag like "Work Friends" can be used across all events. When creating a new event, the host can invite an entire tag group with one tap, adding all tagged contacts to the guest list.

Tags are stored in a new `rv_guest_tags` table and guest-tag associations in `rv_guest_tag_members`. Each guest contact can have multiple tags. Tags have a name and an optional color for visual distinction.

The tag management screen shows all tags with member counts. Tapping a tag shows the members. The host can create, rename, delete, and re-color tags. Members can be added via the contacts list or by tagging existing guests from any event.

When inviting by tag, all members of the selected tag(s) are added as invites to the event. Duplicates (already invited) are skipped automatically.

#### 3.4 Prerequisites

**Feature Dependencies:**
- RS-001: Event Creation - Tags are used during event creation
- RS-003: Guest Invite Management - Tags populate the invite list

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Guest Tags (within Settings or Guests tab)

**Layout:**
- A list of tag cards, each showing: tag name, color dot, member count
- "Create Tag" button at the top
- Tapping a tag opens the tag detail with member list
- Swipe left on tag card to delete (with confirmation)

**Interactions:**
- Tap "Create Tag": Opens modal with name input and color picker
- Tap tag card: Opens member list for that tag
- Long press tag: Edit name/color
- Swipe left: Delete tag (members are not deleted, just untagged)

##### Screen: Tag Members

**Layout:**
- List of members with name and contact info
- "Add Member" button (opens contacts picker or manual entry)
- Swipe left on member: Remove from tag (does not delete the contact)

##### Integration: Invite by Tag (within Create Event)

**Layout:**
- In the Add Guest flow, a "Invite by Tag" button opens a tag selection sheet
- Multi-select tags, then "Add All" creates invites for all members of selected tags
- Summary: "Adding X guests from [tag names]" with duplicate skip count

#### 3.6 Data Requirements

##### Entity: GuestTag (New table: rv_guest_tags)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique tag identifier |
| name | string | Required, max 100 chars, unique | None | Tag name (e.g., "Work Friends") |
| color | string | Hex color | '#6366F1' | Tag color for visual distinction |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification |

##### Entity: GuestTagMember (New table: rv_guest_tag_members)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique membership identifier |
| tag_id | string | FK to rv_guest_tags.id, ON DELETE CASCADE | None | Parent tag |
| guest_name | string | Required, max 200 chars | None | Guest's name |
| guest_contact | string | Optional, max 200 chars | null | Phone or email |
| created_at | datetime | Auto-set | Current timestamp | When added to tag |

**Unique Constraint:** (tag_id, guest_name, guest_contact) to prevent duplicate members in a tag.

**Indexes:**
- tag_id on rv_guest_tag_members: Queried for listing members per tag

#### 3.7 Business Logic Rules

##### Invite by Tag

**Logic:**

```
1. User selects 1 or more tags
2. COLLECT all unique members across selected tags (deduplicate by name + contact)
3. FOR each member:
   a. CHECK if already invited to this event (by name + contact match)
   b. IF already invited: skip, increment duplicate_count
   c. ELSE: create invite with invitee_type='tag'
4. SHOW summary: "Added X guests, skipped Y already invited"
```

**Edge Cases:**
- Member exists in multiple selected tags: Added only once (deduplication)
- Tag has 0 members: No invites created; toast "Tag [name] has no members"
- Tag deleted while invites exist: Invites are not affected (they are independent records)
- Guest name matches but contact differs: Treated as separate guests (not duplicated)

##### Auto-Tag from Events

```
1. After an event, the host can tag all attendees with one action:
   "Tag all guests from this event as [tag name]"
2. Creates tag if it does not exist
3. Adds all unique guests from the event to the tag
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate tag name | Inline: "A tag named [name] already exists" | User chooses different name |
| Empty tag name | Inline: "Tag name is required" | User fills in name |
| No members in selected tags | Toast: "Selected tags have no members" | User adds members first |

#### 3.9 Acceptance Criteria

1. **Given** a tag "Work Friends" with 5 members,
   **When** the host creates a new event and invites by tag "Work Friends",
   **Then** 5 invites are created with invitee_type='tag'.

2. **Given** a guest "Alice" is in both "Work Friends" and "College Friends",
   **When** the host invites both tags,
   **Then** Alice is invited only once (deduplicated).

3. **Given** 2 of 5 tag members are already invited to the event,
   **When** inviting by tag,
   **Then** 3 new invites are created and the summary shows "Added 3 guests, skipped 2 already invited."

4. **Given** a tag is deleted,
   **When** viewing events that used that tag for invites,
   **Then** the invites remain (they are not cascade-deleted with the tag).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates tag | name: "Work Friends", color: "#6366F1" | Tag created |
| rejects duplicate name | existing "Work Friends", create "Work Friends" | Unique constraint error |
| adds member to tag | tag_id, name: "Alice" | Member created |
| deduplicates across tags | Alice in 2 tags, invite both | 1 invite created |
| skips existing invites | Alice already invited, invite by tag | Alice skipped |
| tag deletion preserves invites | delete tag, check invites | Invites remain |
| auto-tag from event | event with 10 guests, tag "Party Crew" | 10 members in tag |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Event** entity. Each Event has many Invites, RSVPs, Polls, Announcements, Comments, Photos, Links, Questions, and Co-hosts. RSVPs are the primary interaction record, linking guests to events with response status, plus-ones, and check-in timestamps. Polls have many PollVotes. Questions have many QuestionResponses linked to RSVPs.

New entities for gap features extend the model: RecurrenceRules link to template Events for recurring series, with RecurrenceInstances tracking each generated occurrence. WishlistItems provide gift registry per event. Expenses and ExpenseSplits handle cost tracking and settlement. SeatingTables, SeatAssignments, and SeatingConstraints support the formal seating planner. EventBudgets and BudgetCategories layer budget tracking on top of expenses. GuestTags and GuestTagMembers provide reusable contact grouping across events. InvitationDesigns store per-event visual card configurations.

### 4.2 Complete Entity Definitions

#### Entity: Event (rv_events)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique event identifier |
| title | string | Required, max 200 | None | Event name |
| description | string | Optional, max 5000 | null | Event description |
| event_type | string | Optional, max 50 | null | Event type identifier |
| event_type_emoji | string | Optional, single emoji | null | Custom emoji for Custom type |
| start_at | datetime | Required, ISO 8601 | None | Event start |
| end_at | datetime | Optional, ISO 8601 | null | Event end |
| timezone | string | Required, IANA | 'UTC' | Event timezone |
| location_name | string | Optional, max 255 | null | Venue name |
| location_address | string | Optional, max 500 | null | Street address |
| location_latitude | float | Optional, -90 to 90 | null | Geocoded latitude |
| location_longitude | float | Optional, -180 to 180 | null | Geocoded longitude |
| parking_notes | string | Optional, max 500 | null | Parking instructions |
| cover_image_url | string | Optional, file URI | null | Cover image path |
| visibility | enum | public/unlisted/private | 'private' | Discovery setting |
| password | string | Optional, max 100 | null | Private event password |
| requires_approval | boolean | - | false | RSVP approval required |
| allow_plus_ones | boolean | - | true | Plus-ones allowed |
| max_guests | integer | Optional, 1-10000 | null | Capacity limit |
| waitlist_enabled | boolean | - | true | Auto-waitlist when full |
| allow_photo_album | boolean | - | true | Photo album active |
| allow_comments | boolean | - | true | Chat/comments active |
| allow_polls | boolean | - | true | Polls active |
| allow_cohosts | boolean | - | true | Co-hosts active |
| allow_chip_in | boolean | - | true | Expenses active |
| chip_in_url | string | Optional, URL | null | External payment link |
| created_by | string | Optional | null | Host identifier |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last modification |

#### Entity: EventCohost (rv_event_cohosts)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique co-host ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| name | string | Required, max 200 | None | Co-host name |
| role | string | Optional, max 100 | null | Role label |
| created_at | datetime | Auto-set | Now | When added |

#### Entity: Invite (rv_invites)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique invite ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| invitee_name | string | Required, max 200 | None | Guest name |
| invitee_contact | string | Optional, max 200 | null | Phone or email |
| invitee_type | string | link/direct/import/tag/recurring | 'link' | Invite source |
| status | enum | invited/requested/approved/declined/waitlisted | 'invited' | Lifecycle status |
| plus_one_limit | integer | 0-10 | 0 | Max plus-ones |
| notes | string | Optional, max 1000 | null | Host's private notes |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: RSVP (rv_rsvps)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique RSVP ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| invite_id | string | FK rv_invites, SET NULL | null | Linked invite |
| guest_name | string | Required, max 200 | None | Respondent name |
| guest_contact | string | Optional, max 200 | null | Contact info |
| response | enum | going/maybe/declined/waitlisted | 'maybe' | RSVP response |
| plus_ones_count | integer | 0 to invite.plus_one_limit | 0 | Additional guests |
| notes | string | Optional, max 1000 | null | Guest message |
| responded_at | datetime | Required | Now | Response timestamp |
| checked_in_at | datetime | Optional | null | Check-in timestamp |
| source | string | app/link/manual | 'app' | RSVP source |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: EventQuestion (rv_questions)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique question ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| label | string | Required, max 500 | None | Question text |
| type | enum | text/single/multi/number/boolean/dietary | 'text' | Input type |
| options_json | string | JSON array | '[]' | Options for single/multi/dietary |
| required | boolean | - | false | Whether response is mandatory |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: QuestionResponse (rv_question_responses)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique response ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| rsvp_id | string | FK rv_rsvps, CASCADE | None | Respondent's RSVP |
| question_id | string | FK rv_questions, CASCADE | None | Parent question |
| answer_json | string | JSON | null | Response value |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: Poll (rv_polls)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique poll ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| question | string | Required, max 500 | None | Poll question |
| options_json | string | JSON array of PollOption | '[]' | Choices (min 2, max 20) |
| multiple_choice | boolean | - | false | Multi-select allowed |
| is_open | boolean | - | true | Accepting votes |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: PollVote (rv_poll_votes)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique vote ID |
| poll_id | string | FK rv_polls, CASCADE | None | Parent poll |
| rsvp_id | string | FK rv_rsvps, SET NULL | null | Voter's RSVP |
| guest_name | string | Optional, max 200 | null | Voter name |
| option_id | string | Required | None | Selected option |
| created_at | datetime | Auto-set | Now | Vote time |

#### Entity: Announcement (rv_announcements)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique announcement ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| message | string | Required, max 2000 | None | Announcement body |
| send_channel | enum | all/email/sms/push | 'all' | Delivery channel |
| scheduled_for | datetime | Optional, future | null | Scheduled publish time |
| sent_at | datetime | Optional | null | Actual publish time |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: EventComment (rv_comments)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique comment ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| rsvp_id | string | FK rv_rsvps, SET NULL | null | Author's RSVP |
| guest_name | string | Required, max 200 | None | Author name |
| message | string | Required, max 2000 | None | Message body |
| created_at | datetime | Auto-set | Now | Post time |

#### Entity: EventPhoto (rv_photos)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique photo ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| rsvp_id | string | FK rv_rsvps, SET NULL | null | Uploader's RSVP |
| guest_name | string | Required | None | Uploader name |
| photo_url | string | Required, file URI | None | Local file path |
| caption | string | Optional, max 500 | null | Photo caption |
| created_at | datetime | Auto-set | Now | Upload time |

#### Entity: EventLink (rv_event_links)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique link ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| type | enum | chip_in/registry/playlist/other | 'other' | Link category |
| label | string | Required, max 200 | None | Display text |
| url | string | Required, URL | None | Link target |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: Settings (rv_settings)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | string | PK | None | Setting identifier |
| value | string | Required | None | Setting value |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: RecurrenceRule (rv_recurrence_rules) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique rule ID |
| event_id | string | FK rv_events, CASCADE | None | Template event |
| frequency | enum | weekly/biweekly/monthly/annually | None | Repeat frequency |
| day_of_week | integer | 0-6, for weekly/biweekly | null | Day of week |
| day_of_month | integer | 1-31, for monthly | null | Day of month |
| end_type | enum | never/count/date | 'never' | End condition |
| end_count | integer | 1-52 | null | Occurrence limit |
| end_date | datetime | ISO 8601 | null | End date |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: RecurrenceInstance (rv_recurrence_instances) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique instance ID |
| recurrence_id | string | FK rv_recurrence_rules, CASCADE | None | Parent rule |
| event_id | string | FK rv_events, CASCADE | None | Generated event |
| occurrence_number | integer | Min: 1 | None | Which occurrence |
| is_exception | boolean | - | false | Individually modified |
| is_cancelled | boolean | - | false | Skipped |
| original_start_at | datetime | ISO 8601 | None | Computed start date |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: WishlistItem (rv_wishlist_items) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique item ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| name | string | Required, max 200 | None | Item name |
| description | string | Optional, max 500 | null | Item description |
| price | float | Optional, min: 0 | null | Estimated price |
| url | string | Optional, URL | null | Product link |
| claimed_by_name | string | Optional | null | Claimer's name |
| claimed_at | datetime | Optional | null | Claim timestamp |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: EventExpense (rv_expenses) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique expense ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| description | string | Required, max 200 | None | Expense description |
| amount | float | Required, 0.01-999999.99 | None | Total amount |
| paid_by_name | string | Required | None | Who paid |
| split_type | enum | equal/custom/itemized | 'equal' | Split mode |
| category_id | string | FK rv_budget_categories, SET NULL | null | Budget category |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: ExpenseSplit (rv_expense_splits) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique split ID |
| expense_id | string | FK rv_expenses, CASCADE | None | Parent expense |
| participant_name | string | Required | None | Who owes |
| amount | float | Required, min: 0 | None | Amount owed |
| is_settled | boolean | - | false | Payment confirmed |
| settled_at | datetime | Optional | null | Settlement time |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: InvitationDesign (rv_invitation_designs) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique design ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| theme_id | string | Optional | 'modern' | Preset theme |
| background_type | enum | solid/gradient/image | 'solid' | Background style |
| background_value | string | Color/gradient/URI | '#1a1a2e' | Background data |
| accent_color | string | Hex color | '#FB7185' | Accent color |
| font_family | string | One of 8 fonts | 'Inter' | Text font |
| custom_message | string | Optional, max 500 | null | Extra card text |
| format | enum | portrait/square | 'portrait' | Image dimensions |
| show_date | boolean | - | true | Display date |
| show_location | boolean | - | true | Display location |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: SeatingTable (rv_seating_tables) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique table ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| name | string | Required, max 100 | 'Table 1' | Table name |
| shape | enum | round/rectangle | 'round' | Table shape |
| seat_count | integer | 2-20 | 8 | Number of seats |
| position_x | float | - | 0 | Canvas X position |
| position_y | float | - | 0 | Canvas Y position |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: SeatAssignment (rv_seat_assignments) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique assignment ID |
| table_id | string | FK rv_seating_tables, CASCADE | None | Parent table |
| seat_number | integer | 1 to table.seat_count | None | Seat position |
| rsvp_id | string | FK rv_rsvps, SET NULL | None | Guest's RSVP |
| guest_name | string | Required | None | Guest name |
| created_at | datetime | Auto-set | Now | Assignment time |

#### Entity: SeatingConstraint (rv_seating_constraints) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique constraint ID |
| event_id | string | FK rv_events, CASCADE | None | Parent event |
| type | enum | together/apart | None | Constraint type |
| guest_a_name | string | Required | None | First guest |
| guest_b_name | string | Required | None | Second guest |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: EventBudget (rv_event_budgets) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique budget ID |
| event_id | string | FK rv_events, CASCADE, UNIQUE | None | Parent event |
| total_budget | float | Required, min: 0 | None | Total budget |
| currency | string | 3-char ISO 4217 | 'USD' | Currency |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: BudgetCategory (rv_budget_categories) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique category ID |
| budget_id | string | FK rv_event_budgets, CASCADE | None | Parent budget |
| name | string | Required, max 100 | None | Category name |
| allocated_amount | float | Min: 0 | 0 | Budgeted amount |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set | Now | Creation time |

#### Entity: GuestTag (rv_guest_tags) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique tag ID |
| name | string | Required, max 100, unique | None | Tag name |
| color | string | Hex color | '#6366F1' | Tag color |
| created_at | datetime | Auto-set | Now | Creation time |
| updated_at | datetime | Auto-set | Now | Last change |

#### Entity: GuestTagMember (rv_guest_tag_members) - NEW

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique member ID |
| tag_id | string | FK rv_guest_tags, CASCADE | None | Parent tag |
| guest_name | string | Required, max 200 | None | Guest name |
| guest_contact | string | Optional, max 200 | null | Contact info |
| created_at | datetime | Auto-set | Now | When added |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Event -> Invite | one-to-many | An event has many invites |
| Event -> RSVP | one-to-many | An event has many RSVPs |
| Invite -> RSVP | one-to-one (optional) | An invite may have one RSVP response |
| Event -> Poll | one-to-many | An event has many polls |
| Poll -> PollVote | one-to-many | A poll has many votes |
| Event -> Announcement | one-to-many | An event has many announcements |
| Event -> EventComment | one-to-many | An event has many comments |
| Event -> EventPhoto | one-to-many | An event has many photos |
| Event -> EventLink | one-to-many | An event has many links |
| Event -> EventCohost | one-to-many | An event has many co-hosts |
| Event -> EventQuestion | one-to-many | An event has many RSVP questions |
| EventQuestion -> QuestionResponse | one-to-many | A question has many responses |
| RSVP -> QuestionResponse | one-to-many | An RSVP has many question responses |
| Event -> RecurrenceRule | one-to-one (optional) | An event may have one recurrence rule |
| RecurrenceRule -> RecurrenceInstance | one-to-many | A rule generates many instances |
| RecurrenceInstance -> Event | one-to-one | Each instance is a separate event |
| Event -> WishlistItem | one-to-many | An event has many wishlist items |
| Event -> EventExpense | one-to-many | An event has many expenses |
| EventExpense -> ExpenseSplit | one-to-many | An expense has many splits |
| Event -> InvitationDesign | one-to-one (optional) | An event may have one invitation design |
| Event -> SeatingTable | one-to-many | An event has many tables |
| SeatingTable -> SeatAssignment | one-to-many | A table has many seat assignments |
| Event -> SeatingConstraint | one-to-many | An event has many seating constraints |
| Event -> EventBudget | one-to-one (optional) | An event may have one budget |
| EventBudget -> BudgetCategory | one-to-many | A budget has many categories |
| BudgetCategory -> EventExpense | one-to-many | A category has many expenses |
| GuestTag -> GuestTagMember | one-to-many | A tag has many members |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| rv_events | rv_events_start_idx | start_at | Sort and filter by date |
| rv_invites | rv_invites_event_idx | event_id | List invites per event |
| rv_invites | rv_invites_status_idx | status | Filter by invite status |
| rv_rsvps | rv_rsvps_event_idx | event_id | List RSVPs per event |
| rv_rsvps | rv_rsvps_response_idx | response | Filter and count by response |
| rv_rsvps | rv_rsvps_checkin_idx | checked_in_at | Filter checked-in guests |
| rv_questions | rv_questions_event_idx | event_id | List questions per event |
| rv_question_responses | rv_question_responses_rsvp_idx | rsvp_id | List responses per RSVP |
| rv_polls | rv_polls_event_idx | event_id | List polls per event |
| rv_poll_votes | rv_poll_votes_poll_idx | poll_id | List votes per poll |
| rv_announcements | rv_announcements_event_idx | event_id | List announcements per event |
| rv_comments | rv_comments_event_idx | event_id | List comments per event |
| rv_photos | rv_photos_event_idx | event_id | List photos per event |
| rv_event_links | rv_event_links_event_idx | event_id | List links per event |
| rv_wishlist_items | rv_wishlist_event_idx | event_id | List items per event |
| rv_expenses | rv_expenses_event_idx | event_id | List expenses per event |
| rv_expense_splits | rv_splits_expense_idx | expense_id | List splits per expense |
| rv_recurrence_instances | rv_recurrence_inst_idx | recurrence_id | List instances per rule |
| rv_seating_tables | rv_tables_event_idx | event_id | List tables per event |
| rv_seat_assignments | rv_seats_table_idx | table_id | List seats per table |
| rv_seating_constraints | rv_constraints_event_idx | event_id | List constraints per event |
| rv_budget_categories | rv_budget_cat_idx | budget_id | List categories per budget |
| rv_guest_tag_members | rv_tag_members_idx | tag_id | List members per tag |

### 4.5 Table Prefix

**MyLife hub table prefix:** `rv_`

All table names in the SQLite database are prefixed with `rv_` to avoid collisions with other modules in the MyLife hub. Example: the `events` table becomes `rv_events`.

### 4.6 Migration Strategy

- **V1 (current):** Initial schema with 13 tables: events, event_cohosts, invites, rsvps, questions, question_responses, polls, poll_votes, announcements, comments, photos, event_links, settings
- **V2 (planned):** Add event_type and event_type_emoji columns to rv_events. Add location_latitude, location_longitude, parking_notes columns to rv_events. Add 9 new tables: rv_recurrence_rules, rv_recurrence_instances, rv_wishlist_items, rv_expenses, rv_expense_splits, rv_invitation_designs, rv_seating_tables, rv_seat_assignments, rv_seating_constraints
- **V3 (planned):** Add rv_event_budgets, rv_budget_categories tables. Add category_id column to rv_expenses. Add rv_guest_tags, rv_guest_tag_members tables.
- Tables are created on module enable. Schema version is tracked in the module_migrations table.
- Data from standalone app can be imported via the data importer.
- Destructive migrations (column removal) are deferred to major versions only.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Events | calendar | Event List | Upcoming and past events listing |
| Guests | users | Global Guest List | Cross-event guest management and tags |
| Polls | bar-chart | Active Polls | All open polls across events |
| Feed | message-circle | Activity Feed | Announcements, comments, and chat |
| Settings | settings | Module Settings | Preferences, defaults, data export |

### 5.2 Navigation Flow

```
[Tab 1: Events]
  ├── Create Event
  │     ├── Template Picker (RS-013)
  │     ├── Event Type Selector (RS-002)
  │     └── Recurrence Settings (RS-018)
  └── Event Detail
        ├── RSVP Dashboard (RS-004)
        │     └── Record RSVP Modal
        ├── Guest List (RS-003)
        │     ├── Add Guest Modal
        │     └── Invite by Tag (RS-026)
        ├── Map / Directions (RS-019)
        ├── Polls (RS-005)
        │     └── Create Poll Modal
        ├── Feed / Chat (RS-006, RS-022)
        ├── Photo Album (RS-007)
        ├── Check-in (RS-008)
        │     └── QR Scanner (RS-024)
        ├── Expenses (RS-016)
        │     ├── Add Expense Modal
        │     └── Budget Dashboard (RS-023)
        ├── Gift Registry (RS-015)
        │     └── Add Wishlist Item Modal
        ├── Invitation Designer (RS-014)
        ├── Seating Chart (RS-021)
        ├── Calendar Export (RS-012)
        ├── Co-host Management (RS-010)
        └── Event Recap (RS-017, past events)

[Tab 2: Guests]
  ├── Guest Tags (RS-026)
  │     └── Tag Members
  └── All Contacts (cross-event view)

[Tab 3: Polls]
  └── Poll Detail (results view)

[Tab 4: Feed]
  └── Event-specific chat thread

[Tab 5: Settings]
  ├── Default Settings
  ├── Data Export
  └── About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Event List | `/events` | Browse upcoming and past events | Tab 1 |
| Create Event | `/events/new` | Create a new event | FAB on Event List |
| Event Detail | `/events/:id` | View event details, RSVP dashboard | Tap event card |
| Edit Event | `/events/:id/edit` | Edit event details | Edit button on detail |
| Guest List | `/events/:id/guests` | Manage event invites | Guests section on detail |
| Check-in | `/events/:id/checkin` | Mark guests as arrived | Check-in button on detail |
| QR Scanner | `/events/:id/checkin/scan` | Scan QR codes for check-in | Scanner button on check-in |
| Photo Album | `/events/:id/photos` | Browse and upload event photos | Photos section on detail |
| Polls | `/events/:id/polls` | View and create polls | Polls tab or section |
| Feed/Chat | `/events/:id/feed` | Announcements and chat | Feed section on detail |
| Expenses | `/events/:id/expenses` | Track and split costs | Expenses section on detail |
| Budget | `/events/:id/budget` | Budget planning and tracking | Budget button on expenses |
| Gift Registry | `/events/:id/gifts` | Wishlist and registries | Gifts section on detail |
| Invitation Designer | `/events/:id/invite-design` | Create visual invitation | Share button on detail |
| Seating Chart | `/events/:id/seating` | Table and seat assignments | Seating section on detail |
| Event Recap | `/events/:id/recap` | Post-event summary | Auto-shown for past events |
| Guest Tags | `/tags` | Manage global guest tags | Tab 2 |
| Tag Members | `/tags/:id` | View and manage tag members | Tap tag card |
| Settings | `/settings` | Module preferences | Tab 5 |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://rsvp/events/:id` | Event Detail | id: UUID of the event |
| `mylife://rsvp/events/new` | Create Event | None |
| `mylife://rsvp/events/:id/checkin` | Check-in Screen | id: UUID of the event |
| `mylife://rsvp/events/:id/photos` | Photo Album | id: UUID of the event |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Dietary to Recipes | RSVP | MyRecipes | Dietary summary (aggregated restrictions) sent to recipe filter | On dietary summary request from MyRecipes |
| Expense to Budget | RSVP | MyBudget | Settled expense amounts logged as budget transactions | On expense settlement |
| Event hosting to Habits | RSVP | MyHabits | Event creation counted as "hosting" habit activity | On event creation |
| Travel to Car | RSVP | MyCar | Event venue address for distance/time calculation | On event detail view in MyCar |
| Social frequency to Health | RSVP | MyHealth | Monthly event attendance count as social wellness metric | On month-end aggregation |
| Menu planning | RSVP | MyRecipes | Guest count for recipe serving scaling | On recipe scaling request |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Event details | Local SQLite (rv_events) | At rest (OS-level) | No | Never leaves device |
| Guest list and contacts | Local SQLite (rv_invites) | At rest (OS-level) | No | Private social graph |
| RSVP responses | Local SQLite (rv_rsvps) | At rest (OS-level) | No | Response history on-device |
| Photos | Local file system | At rest (OS-level) | No | Copied to app sandbox |
| Chat messages | Local SQLite (rv_comments) | At rest (OS-level) | No | No cloud sync |
| Expense data | Local SQLite (rv_expenses) | At rest (OS-level) | No | Financial data on-device |
| Settings | Local SQLite (rv_settings) | No | No | Preferences only |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances.

Exceptions (future phases only):
- Geocoding uses on-device APIs that may make network requests for address resolution (OS-managed, not app-controlled)
- Push notifications for announcements (Phase 3+, requires auth)

### 7.3 Data That Never Leaves the Device

- Guest names, contact information, and social connections
- Event attendance history and RSVP patterns
- Dietary preferences and food allergies
- Financial data (expenses, settlements, budgets)
- Photo albums and shared media
- Chat messages and announcements
- Seating arrangements and guest preferences
- QR code data and check-in history

### 7.4 User Data Ownership

- **Export:** Users can export all event data as CSV (attendance export) and JSON (full event data)
- **Delete:** Users can delete all module data from Settings (irreversible, with confirmation dialog). Deleting an event cascades to all related data.
- **Portability:** Export format is documented and human-readable. CSV export is compatible with spreadsheet applications.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Private event password | Optional password protection for private events | Password stored in plaintext locally (local-only, no network exposure) |
| Co-host permissions | Co-hosts cannot delete events or manage other co-hosts | Enforced in business logic |
| Guest access control | Only RSVPed guests can access chat; only host/co-hosts can post announcements | Enforced in business logic |
| Photo permissions | Guests can only delete their own photos; host can delete any | Enforced in business logic |
| Expense editing | Only expense creator or host can modify expenses | Enforced in business logic |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Event | A scheduled gathering with a title, date/time, location, and guest list |
| Host | The primary creator of an event who has full administrative control |
| Co-host | A collaborator with most host permissions except event deletion and co-host management |
| Guest | A person invited to or attending an event |
| Invite | A record representing an invitation to a specific guest for a specific event |
| RSVP | A guest's response to an invitation (Going, Maybe, Declined, or Waitlisted) |
| Plus-one | An additional guest brought by an invited guest |
| Waitlist | An ordered queue of guests who want to attend but the event is at capacity |
| Check-in | The act of marking a guest as physically present at the event |
| Poll | A multiple-choice question posted within an event for group decision-making |
| Announcement | A one-way message from the host to all event guests |
| Recurrence | A repeating pattern (weekly, monthly, etc.) that auto-generates future event instances |
| Instance | A single occurrence of a recurring event |
| Exception | A recurring event instance that has been individually modified |
| Template | A pre-built event configuration for common event types |
| Settlement | A calculated payment transaction to resolve debts from expense splitting |
| Tag | A reusable label for grouping guest contacts across events |
| iCal / .ics | A standard calendar file format (RFC 5545) for sharing event data with calendar applications |
| Capacity | The maximum number of guests (including plus-ones) allowed at an event |
| Response rate | The percentage of invited guests who have provided any RSVP response |
| FIFO | First In, First Out - the waitlist promotion order (longest-waiting guest promoted first) |
| Geocoding | Converting a street address to geographic coordinates (latitude/longitude) for map display |
| Deep link | A URL pattern that opens a specific screen within the app |
| Share sheet | The native OS sharing interface for sending content to other apps |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification covering 26 features (11 existing, 15 new) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should recurring event instances share a single photo album or have separate albums? | RS-018 specifies separate albums per instance, but some users might want a cumulative album across all instances of a recurring series | Each instance has its own album (current design). A future "Series Album" view could aggregate across instances. | - |
| 2 | Should expense splitting support multiple currencies? | RS-016 currently assumes a single currency per event. International events might have expenses in different currencies. | Single currency per event for MVP. Multi-currency support deferred to future version. | - |
| 3 | Should the seating chart tool support custom table shapes beyond round and rectangle? | RS-021 supports round and rectangle. Some venues have U-shaped, L-shaped, or banquet-style tables. | Round and rectangle for MVP. Custom shapes deferred. | - |
| 4 | How should QR codes be delivered to guests in a local-only app? | RS-024 generates QR codes, but without cloud sync, guests cannot receive them in-app. They must be shared via share sheet. | QR codes are shared via share sheet (image). Guests save the image to their photos and show it at check-in. | - |
| 5 | Should event templates be user-customizable? | RS-013 ships 12 built-in templates. Users may want to create custom templates from past events. | Built-in only for MVP. "Save as Template" feature deferred to future version. | - |
| 6 | Should the chat support reactions (emoji responses to messages)? | RS-022 specifies basic text chat. Reactions are a common modern chat feature. | Text-only for MVP. Reactions deferred. | - |
| 7 | How should the countdown widget handle multiple upcoming events? | RS-025 shows one event at a time. Users with multiple events might want to see all of them. | Single event per widget (configurable). Users can add multiple widget instances for different events. | - |

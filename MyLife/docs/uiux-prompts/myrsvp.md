# MyRSVP -- UI/UX Design Prompts

**Tagline:** Events without the chaos
**Icon:** 🎉 | **Accent:** #EAB308 | **Tier:** Premium
**Bottom Tabs:** Home | Events | Feed | Settings
**Total Screens:** 19 mobile + 2 web = 21

---

## Prompt 1 of 2 -- Screens 1-12 (Mobile)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyRSVP
Tagline: Events without the chaos
Icon: 🎉
Accent color: #EAB308
Platform: iOS (mobile)
Bottom tabs: Home | Events | Feed | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home (active, #EAB308 accent), Events, Feed, Settings
- Section: "Upcoming Events" header with count badge
- Scrollable list of upcoming event cards, each showing:
  - Event title (bold, #F0F0F5)
  - Date and time (#F0F0F5 at 65% opacity)
  - Location text with map pin icon
  - RSVP status pill badge (Attending = #30D158 green, Maybe = #EAB308 yellow, Declined = #FF453A red)
- RSVP status summary row at top: three glass cards showing attending count, maybe count, declined count
- Floating action button (bottom right): "+" icon with #EAB308 background for quick event creation

2. EVENTS (events.tsx)
- Tab header: "Events"
- Segmented control: Upcoming | Past | Cancelled
- Event list with glass card rows, each showing:
  - Event title (#F0F0F5 bold)
  - Date below title (#F0F0F5 at 65% opacity)
  - Location with pin icon
  - Status badge: Upcoming (#30D158), Past (rgba(255,255,255,0.06) muted), Cancelled (#FF453A)
- Empty state for each segment with illustration and "No events" text
- Search bar at top with magnifying glass icon

3. EVENT DETAIL (event/[id].tsx)
- Back arrow navigation, event title as header
- Cover photo area at top (full width, 200pt height) or placeholder gradient
- Glass card: title (large, bold), date/time row with calendar icon, location row with map pin icon (tappable for map link)
- Description text block (#F0F0F5 at 65% opacity)
- RSVP count summary row: Attending (count), Maybe (count), Declined (count) -- each as a glass pill
- Guest list preview: 4 circular avatars in a row + "+N more" text
- RSVP action buttons row: "Going" (#30D158), "Maybe" (#EAB308), "Can't Go" (#FF453A)
- Bottom actions: Edit button, Share button

4. CREATE EVENT (event/create.tsx)
- Header: "Create Event" with Cancel (left) and Create (right, #EAB308) buttons
- Form fields in glass card sections:
  - Title text input (placeholder: "Event name")
  - Date picker row: calendar icon + date display, tappable to open date picker
  - Time picker row: clock icon + time display, tappable to open time picker
  - Location input: map pin icon + text field (placeholder: "Add location")
  - Description: multi-line text area (placeholder: "What's the event about?")
  - Capacity limit: number input with stepper (optional, toggle to enable)
  - Cover photo: dashed border upload area with camera icon, tap to select photo

5. GUESTS (guests.tsx)
- Header: "Guests" with count badge
- Filter pills: All | Attending | Maybe | Declined | Pending
- Guest list, each row showing:
  - Circular avatar (initials fallback)
  - Name (#F0F0F5 bold)
  - RSVP status badge (Yes = #30D158, No = #FF453A, Maybe = #EAB308, Pending = rgba(255,255,255,0.06))
  - Plus-one indicator: "+1" pill if applicable
  - Dietary preferences icon row (leaf for vegan, wheat-slash for gluten-free, etc.)
- "Add Guest" button at bottom (#EAB308 accent)
- Search bar at top

6. ADD GUEST (guest/add.tsx)
- Header: "Add Guest" with Cancel (left) and Save (right, #EAB308)
- Form fields in glass card:
  - Name text input (required)
  - Email text input (keyboard type: email)
  - Phone text input (keyboard type: phone)
  - Dietary preferences/restrictions: multi-select chips (Vegan, Vegetarian, Gluten-Free, Nut Allergy, Dairy-Free, Other)
  - Plus-one toggle switch with label

7. POLLS (polls.tsx)
- Header: "Polls"
- Poll list, each as a glass card:
  - Question text (bold, #F0F0F5)
  - Options list: each option shows text + vote count bar (filled proportionally with #EAB308)
  - Total votes count
  - "Vote" button if not yet voted, or checkmark on selected option
- "Create Poll" floating action button (#EAB308)
- Empty state: "No polls yet" with illustration

8. ANNOUNCEMENTS (announcements.tsx)
- Header: "Announcements"
- Announcement list, each as a glass card:
  - Message text (#F0F0F5)
  - Sent date and time (#F0F0F5 at 65% opacity)
  - Delivery count: "Sent to N guests" with checkmark icon
- "New Announcement" button at top (#EAB308)
- Compose modal: text area + send button
- Empty state: megaphone illustration with "No announcements"

9. PHOTO ALBUMS (photos.tsx)
- Header: "Photos" with count
- Grid view: 3-column photo grid with rounded corners
- Each photo: thumbnail with subtle glass border
- Tap to open full-screen viewer with swipe navigation
- Bottom toolbar in viewer: download icon, share icon
- "Upload Photos" button (camera icon, #EAB308 accent)
- Empty state: camera illustration with "No photos yet"

10. CHECK-IN (checkin.tsx)
- Header: "Check-In"
- Running count display at top: large glass card with "12 / 50 Arrived" (large number, #EAB308 accent on arrived count)
- Progress bar: filled portion in #EAB308
- Search bar: "Search guest name..."
- Guest list below: each row shows:
  - Name
  - Check-in status: unchecked (empty circle) or checked (filled circle, #30D158)
  - Tap row to toggle check-in
  - Timestamp when checked in (#F0F0F5 at 65% opacity)

11. ANALYTICS (analytics.tsx)
- Header: "Analytics"
- Top stat cards row (glass cards):
  - RSVP Rate: percentage in large #EAB308 text
  - Headcount: "42 / 50" confirmed vs capacity
- Response timeline chart: line graph showing RSVPs over time (x-axis: dates, y-axis: count, #EAB308 line)
- Dietary breakdown: horizontal bar chart or pie chart
  - Vegan (green bar), Vegetarian (light green), Gluten-Free (orange), Allergies (red)
  - Count and percentage for each
- Response status donut chart: Attending/Maybe/Declined segments

12. WAITLIST (waitlist.tsx)
- Header: "Waitlist"
- Waitlist count badge at top
- Queue list, each row showing:
  - Position number (large, #EAB308)
  - Guest name (#F0F0F5 bold)
  - Date added (#F0F0F5 at 65% opacity)
  - "Promote" button (outline, #EAB308) for manual promotion
- Auto-promote indicator: toggle at top "Auto-promote when guest declines"
- Empty state: "No one on the waitlist" with queue illustration
```

---

## Prompt 2 of 2 -- Screens 13-21 (Mobile 13-19 + Web 20-21)

```
Design system: Cool Obsidian (dark theme -- #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyRSVP
Tagline: Events without the chaos
Icon: 🎉
Accent color: #EAB308
Platform: iOS (mobile) for screens 13-19, Web (desktop) for screens 20-21
Bottom tabs (mobile): Home | Events | Feed | Settings

Design 9 screens:

13. CO-HOSTS (cohosts.tsx) -- Mobile
- Header: "Co-Hosts" with count
- Co-host list, each row in glass card:
  - Avatar (circular, initials fallback)
  - Name and email (#F0F0F5, email at 65% opacity)
  - Permission toggles (each a switch):
    - Edit Event
    - Manage Guests
    - Send Announcements
  - Remove button (trash icon, #FF453A)
- "Add Co-Host" button at bottom: email input field + invite button (#EAB308)

14. CUSTOM QUESTIONS (questions.tsx) -- Mobile
- Header: "Custom Questions"
- Question list, each as a glass card:
  - Question text (#F0F0F5 bold)
  - Type badge: Text | Single Select | Multi-Select
  - Required toggle switch
  - If select type: options list below with add/remove option buttons
  - Drag handle for reordering
- "Add Question" button (#EAB308)
- Empty state: "Add questions to your RSVP form"

15. FEED (feed.tsx) -- Mobile
- Bottom tab: Feed (active, #EAB308 accent)
- Activity feed timeline, each item as a glass card:
  - Activity icon (RSVP = checkmark, Comment = speech bubble, Photo = camera, Announcement = megaphone)
  - Activity text: "[Name] RSVP'd Yes to [Event]" or "[Name] uploaded 3 photos"
  - Timestamp (#F0F0F5 at 65% opacity)
  - Event name reference (tappable, #EAB308 underline)
- Pull-to-refresh
- Empty state: "No activity yet"

16. REGISTRY (registry.tsx) -- Mobile
- Header: "Registry"
- Item grid or list, each as a glass card:
  - Item name (#F0F0F5 bold)
  - External link icon (tappable, opens URL)
  - Price display (#EAB308)
  - Status badge: Unclaimed (outline) or Claimed (#30D158 filled with claimer initials)
  - "Claim" button for unclaimed items (#EAB308)
- "Add Item" button at top
- Add item form: name, link URL, price input
- Summary at top: "8 of 15 items claimed" with progress bar

17. SETTINGS (settings.tsx) -- Mobile
- Bottom tab: Settings (active)
- Section: "Default Event Settings" (glass card)
  - Default capacity limit toggle and number
  - Default location text
  - Auto-send reminders toggle
- Section: "Notifications" (glass card)
  - New RSVP notifications toggle
  - Event reminder notifications toggle
  - Comment notifications toggle
  - Announcement notifications toggle
- Section: "Account" (glass card)
  - Display name
  - Email

18. CSV EXPORT (export.tsx) -- Mobile
- Header: "Export Guest List"
- Preview table (horizontal scroll): columns for Name, Email, RSVP Status, Dietary, Plus-Ones
- Sample rows showing data format
- Column selection: checkboxes for which columns to include
- Event selector dropdown (if multiple events)
- "Export CSV" button (full width, #EAB308 background)
- Share sheet opens after export with file attachment
- Note text: "CSV file will include [N] guests" (#F0F0F5 at 65% opacity)

19. EVENT TEMPLATES (templates.tsx) -- Mobile
- Header: "Templates"
- Template grid (2 columns), each as a glass card:
  - Template icon/illustration (Birthday = cake, Wedding = rings, Dinner Party = utensils, Meetup = people)
  - Template name (#F0F0F5 bold)
  - Brief description (#F0F0F5 at 65% opacity)
  - "Use Template" button (#EAB308 outline)
- Templates: Birthday Party, Wedding Reception, Dinner Party, Meetup, Baby Shower, Holiday Party, Corporate Event, Custom
- Tapping "Use Template" pre-fills the Create Event form

20. WEB HUB -- LEFT PANEL (/rsvp) -- Desktop
- Left sidebar (280px width, #12121A surface):
  - MyRSVP logo + "🎉 MyRSVP" title at top
  - "Create Event" button (#EAB308, full sidebar width)
  - Event list: scrollable, each showing event title, date, attendee count
  - Active event highlighted with #EAB308 left border
  - Section dividers: Upcoming | Past
  - Bottom: Settings gear icon
- Sidebar collapses to icon-only on narrow viewports

21. WEB HUB -- RIGHT PANEL (/rsvp/[id]) -- Desktop
- Main content area (right of sidebar):
  - Top bar: event title (large), date, location, Edit button
  - Tabbed navigation: Guests | Polls | Photos | Analytics | Registry | Announcements
  - Guests tab: data table with sortable columns (Name, Email, Status, Dietary, Plus-Ones, Checked In), bulk actions toolbar
  - Polls tab: poll cards in 2-column grid
  - Photos tab: masonry photo grid with upload dropzone
  - Analytics tab: dashboard layout with stat cards + charts (2-column grid)
  - Registry tab: item cards in 3-column grid
  - Announcements tab: message list with compose area at top
- Responsive: tabs collapse to dropdown on tablet width
```

# MyRSVP - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Implemented (13 tables)

## Current State

MyRSVP is a full-featured event management module with support for event creation, invite management, RSVP tracking with plus-ones, polls for group decision-making, announcements, photo albums, check-in at the door, waitlist management, and co-host permissions. The module uses local SQLite storage and covers the core event lifecycle well. The main gaps are around visual polish (invitation designs, templates) and tighter integration with external tools (calendars, maps, expense splitting).

## Competitors Analyzed

| Competitor | Pricing | Platform | Cloud Required |
|-----------|---------|----------|---------------|
| Evite | Free with ads, Premium $14.99-$19.99/event | Web, iOS, Android | Yes |
| Partiful | Free | Web, iOS, Android | Yes |

## Feature Gaps

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Calendar sync (iCal export) | P0 | Evite, Partiful | Low | Export events to phone calendar via .ics files. Essential table-stakes feature. |
| Event templates | P1 | Evite | Low | Pre-built templates for common event types: birthday, dinner party, game night, baby shower, wedding, holiday gathering |
| Custom invitation designs | P1 | Evite | Medium | Visual invitation cards with customizable themes, colors, and background images |
| Expense splitting per event | P1 | Partiful | Low | Split event costs among attendees with per-person breakdown |
| Recurring events | P1 | None | Low | Weekly game night, monthly book club, annual holiday party with auto-invite from previous guest list |
| Map/directions integration | P1 | Evite, Partiful | Low | Embedded map with venue pin and directions link. Use platform map APIs (Apple Maps, Google Maps). |
| Dietary preference collection | P1 | None | Low | Collect food allergies and dietary preferences as part of the RSVP flow |
| Guest messaging/chat | P2 | Partiful | Medium | In-app messaging thread for event attendees to coordinate logistics |
| Gift registry integration | P2 | Evite | Medium | Link to an external registry or create a simple in-app wishlist for gift-giving events |
| Event recap/memories | P2 | None | Low | Auto-generate an event summary with photos, attendee count, and highlights after the event ends |
| Seating arrangement tool | P3 | None | Medium | Visual drag-and-drop seating planner for formal dinners and weddings |

## Recommended Features to Build

1. **Calendar sync (iCal export)** - The most critical missing feature. Generate .ics files that guests can add to any calendar app. On mobile, use the native calendar API to create events directly. This is table stakes for any event tool.

2. **Event templates** - Pre-built configurations for common event types. Each template sets default fields (duration, typical guest count range, suggested poll questions, dietary preference collection toggle). Reduces friction for first-time event creation.

3. **Recurring events** - Define a recurrence pattern (weekly, biweekly, monthly, annual) and auto-generate future event instances with the same guest list. Essential for book clubs, game nights, and standing social commitments.

4. **Map/directions integration** - When a venue address is entered, display an embedded map preview and provide a "Get Directions" link that opens the platform's native maps app. Low effort, high polish.

5. **Dietary preference collection** - Add optional dietary fields to the RSVP form (vegetarian, vegan, gluten-free, nut allergy, kosher, halal, other). Aggregate responses for the host. Pairs directly with MyRecipes for menu planning.

6. **Expense splitting per event** - Track event expenses and split them among attendees. Show who owes what. Integrates with MyBudget for automatic expense categorization.

7. **Custom invitation designs** - Visual card builder with preset themes per event type. Allow custom background image, accent color, and font selection. Export as image for sharing outside the app.

8. **Guest messaging/chat** - A simple message thread per event for coordination ("I'm bringing chips", "Running 10 minutes late"). Does not need to be a full chat platform, just functional group messaging.

9. **Event recap/memories** - After an event ends, compile a summary card with the photo album, final headcount, poll results, and a "thanks for coming" message. Optional auto-generation from event data.

10. **Gift registry integration** - For birthday parties, baby showers, and holidays. Allow the host to create a simple wishlist or link to external registries. Mark items as claimed to avoid duplicates.

11. **Seating arrangement tool** - Drag-and-drop table layout for formal events. Low priority since most casual events do not need assigned seating.

## Privacy Competitive Advantage

Evite is heavily ad-supported and collects extensive data on social connections, event attendance patterns, and guest email addresses for marketing. Partiful is currently free but venture-funded, meaning user data is the product or the monetization model will change. MyRSVP keeps all event data, guest lists, and social connections strictly on-device. Guest information never leaves the host's phone. This is a significant advantage for users who are uncomfortable sharing their social graph and event history with ad networks. The privacy angle is especially strong for sensitive events (medical celebrations, surprise parties, private gatherings) where guest lists should remain confidential.

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyRecipes** | Plan event menus based on collected dietary preferences. Link specific recipes to event meal plans. Scale recipe servings to match guest count. |
| **MyBudget** | Track event expenses as a budget category. Expense splitting results flow into budget tracking. Show cost-per-event trends over time. |
| **MyHabits** | Track social event frequency as a habit (e.g., "host one dinner party per month"). Streak tracking for recurring social commitments. |
| **MyCar** | Calculate travel distance/time to event venues. |
| **MyHealth** | Social engagement frequency as a wellness metric. |
| **MyGarden** | For garden party events, suggest seasonal produce and garden-to-table recipes. |

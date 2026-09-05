# MyRSVP Module Audit

**ID:** rsvp | **Prefix:** rv_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Events, invites, and RSVP tracking

## User Value
- Create events with invites, RSVPs, custom questions, polls, and waitlists
- Expense splitting with equal/custom splits and settlement math
- Guest messaging, gift registry, and seating assignments
- iCal/Google Calendar sync for hosts and invitees
- Recurring events, 12 event templates, 9 invitation designs

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Events + co-hosts + settings | src/db/crud.ts | shipped |
| Invites + RSVPs + check-in | src/db/crud.ts | shipped |
| Custom questions + responses | src/db/crud.ts | shipped |
| Polls + voting | src/db/crud.ts | shipped |
| Announcements + comments + photos | src/db/crud.ts | shipped |
| Analytics + CSV export | getEventAnalytics | shipped |
| iCal generation + Google Calendar URL | src/engines/ical.ts | shipped |
| Expense splitting + settlements | src/engines/settlement.ts | shipped |
| 12 event templates | src/engines/templates.ts | shipped |
| Dietary tracking + aggregation | src/engines/dietary.ts | shipped |
| Recurring events | src/engines/recurrence.ts | shipped |
| Map/directions URLs | src/engines/location.ts | shipped |
| Invitation design system | src/engines/designs.ts | shipped |
| Gift registry | rv_registry_items | shipped |
| Seating arrangements + auto-assign | src/engines/seating.ts | shipped |
| Event recap generation | src/engines/recap.ts | shipped |
| Guest messaging | rv_messages | shipped |

## Data Model
Prefix `rv_`, schema v3, 21 tables. V1: events, co-hosts, invites, rsvps, questions, polls, announcements, comments, photos, links, settings. V2: expenses, expense_splits + calendar_event_id. V3: recurrence_rules, event_series, messages, registry_items, tables, seat_assignments.

## Screens / User Flows
Mobile tabs: Events, Guests, Polls, Feed, Settings. Screens: event detail, invite management, check-in, photo album, calendar-sync, dietary, location, invitation-design, messaging, polls, recurrence, registry, seating, templates, expenses. Web has parity routes.

## Distinctive / Moat-worthy
- 9 built-in engines (iCal, settlement, templates, dietary, recurrence, location, designs, recap, seating)
- 135 passing tests
- Local-first, no Partiful-style data harvesting
- Cross-module orchestration (deep-linked from Recipes for potlucks)

## Gaps vs competitors
- No native calendar sync push (iCal export exists; two-way sync missing), Priority P0
- No custom invitation design builder (templates are fixed), P1
- No paid-ticketing or RSVPify professional seating charts

## Investor-facing hook
Partiful plus Evite plus Splitwise in one private, ad-free surface, including expense splits and seating charts that paid apps charge $19+/mo for.

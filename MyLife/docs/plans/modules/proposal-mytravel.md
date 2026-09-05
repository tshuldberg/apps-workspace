# Module Proposal: MyTravel

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `travel`
**Table prefix:** `tv_`
**Tier:** Pro (premium)
**Target module number:** #40
**Date:** 2026-04-20
**Demographic pull:** Ages 18-65 (strongest 22-40), universal aspiration

---

## Executive Summary

TripIt costs $49/yr for auto-organizing travel emails. Wanderlog is free but ad-supported and sells data to tourism boards. Google Trips was killed because Google couldn't monetize it without ads. Every travel app either charges $50+/yr, sells your itinerary data to tourism advertisers, or shuts down because there's no business model between those two options.

MyTravel is a privacy-first trip planner + travel journal: itineraries, packing lists, booking references, travel memories, passport/visa tracking, and country-counting -- all local, all private, and integrated with every other MyLife module you're already using.

**Positioning sentence:** *TripIt sells your itinerary to hotel advertisers. MyTravel remembers where you've been and helps you plan where you're going.*

---

## Why This Module

1. **Travel planning is scattered.** Bookings in email, itineraries in Google Docs, packing lists in Notes, photos in Camera Roll. No unified home.
2. **TripIt/Wanderlog sell your data.** TripIt shares itineraries with data brokers and tourism boards. Wanderlog shows ads based on your destinations.
3. **Trails module covers outdoor adventures** but not flights, hotels, city trips, or international logistics.
4. **Country/city collecting** is a massive hobby with no good privacy-first tool (Visited, been, NomadList all public).
5. **Cross-module integration is the differentiator.** Dining (restaurants on trips), budget (travel spending), friends (travel companions), journal (trip reflections), closet (packing), health (travel health), meds (timezone medication reminders).
6. **High emotional value.** Travel memories are among the most treasured things people want to preserve.

---

## Full Feature Set

### Core: Trip Planner

- **Create trips:** Destination, dates, trip type (vacation, business, family, solo, road trip, backpacking)
- **Multi-stop itineraries:** Day-by-day plan with times, locations, notes
- **Activity planning:** Restaurants, sights, museums, tours, hikes -- slotted into days
- **Booking references:** Flight confirmations, hotel bookings, car rentals, activity tickets
- **Travel companion tracking:** Who's coming? (links to Friends module)
- **Budget per trip:** Planned vs actual spending by category (links to Budget)
- **Packing list:** Reusable templates by trip type + custom items
- **Document checklist:** Passport, visa, insurance, vaccination card, tickets
- **Time zone awareness:** Show local times for all activities
- **Offline access:** Full itinerary available without internet (critical for international travel)
- **Copy/template trips:** "Repeat last year's beach trip" with modifications
- **Weather notes:** Expected weather per destination (manual entry, not live API)

### Core: Travel Journal

- **Daily travel notes:** Markdown journal per day of trip
- **Photo journal:** Attach photos to days, locations, activities
- **Best moments:** Flag standout experiences
- **Local discoveries:** Restaurants found, shops visited, hidden gems
- **Mishaps and stories:** Travel problems that became great stories
- **People met:** Interesting people encountered on the road
- **Lessons learned:** "Next time, don't fly through [airport]" notes
- **Sensory notes:** Sounds, smells, tastes, feelings -- rich memory capture
- **Voice memos:** Record thoughts on the go (links to Voice module)

### Core: Destination Tracker

- **Countries visited:** Map view showing where you've been
- **Cities visited:** City-level tracking within countries
- **States/provinces:** Track US states, European countries, etc.
- **Visit dates:** When you were there (multiple visits tracked)
- **Bucket list:** Places you want to go, sorted by priority
- **Region progress:** "X of 50 US states," "Y of EU countries"
- **Pin map:** Your personal world map of travels
- **Decade view:** Where you traveled in each decade of your life
- **First visits vs returns:** Track familiar places vs new discoveries

### Core: Logistics

- **Passport tracker:** Expiry dates, visa pages remaining, renewal reminders
- **Visa tracker:** Visas obtained, expiry dates, entry requirements per country
- **Vaccination record:** Travel vaccines with dates (links to Health module)
- **Insurance policies:** Travel insurance reference per trip
- **Frequent flyer programs:** Airline miles/points tracking with balances
- **Hotel loyalty programs:** Points balances and status levels
- **TSA/Global Entry/Nexus:** Expiry dates and renewal reminders
- **Emergency contacts:** Per-country emergency numbers, embassy locations
- **Currency converter notes:** Exchange rates obtained, where to exchange

### Core: Packing

- **Template packing lists:** Weekend trip, week abroad, beach, ski, backpacking, business
- **Custom lists per trip:** Generated from template + trip-specific additions
- **Closet integration:** "Pack the blue jacket" (links to Closet module)
- **Check-off tracking:** Mark items as packed
- **Universal items:** Things that go on EVERY list (charger, passport, meds)
- **Weather-based suggestions:** "It'll be cold -- add layers" (manual, based on your notes)
- **Weight/luggage tracking:** Optional carry-on vs checked allocation
- **Post-trip review:** "I packed X but never used it" -- improve future lists

### Advanced: Travel Stats

- **Year-in-review:** Trips taken, countries visited, total days away, distance traveled
- **Travel style analysis:** Percentage beach vs city vs nature vs cultural
- **Most-visited country/city:** Return patterns
- **Longest trip:** Your record for consecutive days traveling
- **Travel companion frequency:** Who you travel with most
- **Spending analysis:** Average cost per trip, per day, per destination
- **Flight stats:** Total flights, miles flown, airports visited
- **Accommodation stats:** Hotels vs Airbnb vs hostels vs camping

### Advanced: Travel Planning Tools

- **Trip comparison:** "Should we go to Portugal or Greece?" side-by-side notes
- **Season advisor:** Personal notes on best time to visit destinations you've been
- **Recommendation lists:** "If someone asks me about Tokyo, tell them..." per-destination advice
- **Restaurant pre-research:** Save restaurants to check out (links to Dining module wishlist)
- **Activity research:** Save activities, tours, experiences to consider
- **Travel reading:** Books to read before/during a trip (links to Books module)

### Import & Export

- **TripIt import:** Forward confirmation emails (parse on-device)
- **Google Trips export:** Import any saved data before it disappears
- **Calendar import:** Pull travel events from calendar
- **Photo import:** Auto-organize trip photos by date/location (on-device EXIF parsing)
- **CSV export:** Full trip data
- **PDF itinerary:** Generate printable trip summary

---

## Data Model

```
tv_trips
  id, name, destination_ids (json), trip_type,
  start_date, end_date, status (planning|upcoming|active|completed|cancelled),
  companion_ids (json), budget_planned_cents, budget_actual_cents,
  cover_photo_id, notes_md, rating,
  template_id (nullable, for repeat trips),
  created_at, updated_at

tv_itinerary_days
  id, trip_id, date, day_number, location,
  weather_notes, summary_md, photo_ids (json),
  created_at, updated_at

tv_activities
  id, day_id, trip_id, time, end_time,
  title, type (flight|hotel|restaurant|sight|tour|hike|transport|other),
  location, address, lat, lng,
  confirmation_code, cost_cents, notes_md,
  booking_url, photo_id, created_at

tv_destinations
  id, name, country, country_code, region,
  lat, lng, first_visited, last_visited,
  visit_count, rating, bucket_list (bool),
  priority, notes_md, best_season,
  photo_id, created_at, updated_at

tv_bookings
  id, trip_id, type (flight|hotel|car_rental|train|bus|activity|insurance),
  provider, confirmation_code, check_in, check_out,
  cost_cents, currency, status (confirmed|cancelled|completed),
  notes_md, document_uri, created_at

tv_packing_lists
  id, trip_id, template_name, items (json array of {name, category, packed, essential}),
  created_at, updated_at

tv_documents
  id, type (passport|visa|insurance|vaccination|membership|other),
  name, number, country, issue_date, expiry_date,
  renewal_reminder_days, notes_md, photo_id,
  created_at, updated_at

tv_loyalty_programs
  id, type (airline|hotel|car), provider, member_number,
  status_tier, points_balance, miles_balance,
  expiry_date, notes, created_at, updated_at

tv_journal_entries
  id, trip_id, day_id, date, content_md,
  mood, highlights (json), photo_ids (json),
  people_met, lessons_learned, created_at

tv_photos
  id, trip_id, day_id, activity_id, destination_id,
  local_uri, caption, lat, lng, taken_at, created_at

tv_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Trip planner: create, itinerary days, activities, bookings | 3-4 |
| P2 | Destination tracker: map, countries/cities, bucket list, pin map | 2 |
| P3 | Travel journal: daily notes, photos, highlights, people | 2-3 |
| P4 | Logistics: passport/visa/insurance tracking, loyalty programs | 1-2 |
| P5 | Packing: templates, custom lists, closet integration | 1-2 |
| P6 | Stats + year-in-review + flight/accommodation tracking | 2 |
| P7 | Planning tools: comparison, pre-research, recommendations | 1-2 |
| P8 | Import (TripIt, calendar, photos) + export (PDF, CSV) | 2 |
| P9 | Cross-module (dining, budget, friends, journal, closet, health, trails) | 2 |
| **Total P0-P9** | | **~18-24 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Dining** | Restaurants on trips, pre-trip research, trip dining spending |
| **Budget** | Trip budgets, travel spending category, loyalty program value |
| **Friends** | Travel companions, people met on trips |
| **Journal** | Trip reflections auto-linked |
| **Closet** | Packing from your actual wardrobe inventory |
| **Health** | Travel vaccinations, altitude/jet lag, travel health notes |
| **Meds** | Timezone medication reminders during travel |
| **Trails** | Hikes and outdoor activities during trips |
| **Books** | Travel reading lists, destination-related books |
| **Music** | Trip playlists, concert attendance while traveling |
| **Calendar** | Trip dates, booking dates synced |

---

## Trails Module vs Travel Module

Important distinction:
- **Trails** = outdoor adventures, hiking, geocaching, nature, GPS tracking, gear
- **Travel** = trips (domestic + international), flights, hotels, itineraries, logistics, memories

Overlap is minimal. A hike on a trip would be logged in Trails AND linked from a Travel itinerary day. They complement, not compete.

---

## Competitor Analysis

| App | What It Does | Why It Falls Short |
|-----|-------------|-------------------|
| TripIt | Auto-organize travel emails | $49/yr, sells itinerary data, no journal/photos |
| Wanderlog | Trip planning + map | Ad-supported, sells data to tourism boards |
| Google Trips | Was great, killed it | Dead because Google couldn't monetize without ads |
| Sygic Travel | Trip planning | Cluttered, ad-supported, mediocre UX |
| Visited (country tracker) | Pin map | Public, single-feature, no planning or journal |
| Polarsteps | Auto-track + share trips | Social-first, GPS-tracking (battery drain), public |
| Notion templates | Manual planning | Generic, no travel-specific features |
| Apple Maps guides | Save places | Extremely limited, no itinerary or journal |

**Gap:** No privacy-first tool combines trip planning + booking management + travel journal + destination tracking + packing + cross-module integration.

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Sky blue #0EA5E9, earth green #16A34A, passport navy #1E40AF, sunset orange #EA580C
2. **Overlap with Trails?** Keep them separate or merge hiking/outdoor into Travel? Recommend: separate. Trails is GPS/outdoor-focused with gear tracking. Travel is logistics/planning/memories.
3. **Booking email parser?** Parse flight/hotel confirmation emails on-device (like Dining's reservation parser)? Recommend: yes, P8. Same pattern.
4. **Offline maps?** Bundle any offline map data, or just save coordinates and link to Apple/Google Maps? Recommend: link out. Offline maps are massive (GB+) and out of scope.
5. **Free or Pro?** Destination tracker (country map) could be free as hook. Full planning = Pro. Recommend: bucket list free, everything else Pro.
6. **Photo handling:** Same as Dining/Journal (encrypted local) or lighter (travel photos are typically less sensitive)? Recommend: standard local storage, optional EXIF strip.

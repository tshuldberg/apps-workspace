# MyPets - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Stub (navigation only)

## Current State
Stub module with navigation scaffolding only. No business logic, no database tables, no screens implemented.

## Competitors Analyzed

| App | Pricing | Focus |
|-----|---------|-------|
| Dogo | $200+/yr | Dog training and exercise tracking |

The pet management space is remarkably underserved. Most apps focus narrowly on dog training (Dogo) or vet record keeping, and none offer a comprehensive pet care hub. This represents a greenfield opportunity.

## Feature Gaps (Full Build Required)

### P0 - MVP Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Pet profiles | P0 | None widespread | Low | Name, breed, birthday, weight, photo, microchip number |
| Vaccination records | P0 | None | Low | Track vaccinations with dates and next due reminders |
| Vet visit log | P0 | None | Medium | Date, vet name, reason, diagnosis, prescriptions, cost |
| Medication tracking | P0 | Medisafe pattern | Medium | Pet medications with reminders (reuse MyMeds pattern) |
| Weight tracking with chart | P0 | None | Low | Track pet weight over time with goal ranges |

### P1 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Feeding schedule/reminders | P1 | None | Low | Track meals, portions, food brand with reminders |
| Grooming log | P1 | None | Low | Baths, nail trims, haircuts with reminders |
| Exercise/walk log | P1 | Dogo | Medium | Track walks with duration, distance (could tie to MyTrails GPS) |
| Training progress | P1 | Dogo | Medium | Track commands learned, training sessions, behavior notes |
| Dog training lessons | P1 | Dogo | High | Step-by-step training guides for basic and advanced commands |
| Expense tracking | P1 | None | Medium | Total cost of pet ownership (food, vet, grooming, toys) |
| Emergency vet info | P1 | None | Low | Store emergency vet contact, nearest 24hr vet, pet poison control |

### P2 Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|---------------------------|-------|
| Pet insurance document storage | P2 | None | Low | Policy details, claim history |
| Multi-pet dashboard | P2 | None | Medium | Overview of all pets' upcoming appointments and reminders |
| Pet sitter info card | P2 | None | Medium | Shareable care instructions for pet sitter (feeding, meds, vet, habits) |
| Breed-specific health alerts | P2 | None | Medium | Common health issues for breed with screening reminders |
| Photo journal/timeline | P2 | None | Medium | Photo gallery organized by date with growth milestones |
| Lost pet poster generator | P2 | None | Medium | Quick-generate missing pet poster with photo and contact info |
| Adoption anniversary celebrations | P2 | None | Low | Celebrate "gotcha day" milestones |

## Recommended MVP Features

Minimal feature set to ship v1:
1. Pet profiles with photo, name, breed, birthday, weight, and microchip number
2. Vaccination record tracking with next-due date reminders
3. Vet visit log with date, vet name, reason, diagnosis, prescriptions, and cost
4. Medication tracking with reminders (reuse MyMeds medication engine pattern)
5. Weight tracking over time with chart and goal weight range
6. SQLite storage with `pt_` table prefix

## Full Feature Roadmap

1. **v1.0 - Core Pet Records** (P0): Pet profiles, vaccination records, vet visit log, medication tracking, weight chart
2. **v1.1 - Daily Care** (P1): Feeding schedule with reminders, grooming log with reminders, emergency vet info storage
3. **v1.2 - Activity and Training** (P1): Exercise/walk log with duration and distance, training progress tracker, dog training lesson guides
4. **v1.3 - Finances** (P1): Pet expense tracking with category breakdown, total cost of ownership dashboard
5. **v2.0 - Multi-Pet and Sharing** (P2): Multi-pet dashboard, pet sitter info card (shareable), pet insurance document storage
6. **v2.1 - Health Intelligence** (P2): Breed-specific health alerts, screening reminders based on breed and age
7. **v2.2 - Memories and Safety** (P2): Photo journal/timeline with growth milestones, lost pet poster generator, adoption anniversary celebrations

## Privacy Competitive Advantage

Dogo charges $200+/yr and collects extensive data including location tracking during walks. Most pet apps are ad-supported and monetize user data. Pet data is more personal than it appears: vet records contain home address, medication schedules reveal when owners are home, and lost pet posters broadcast location and contact information.

MyPets keeps everything local. No cloud account, no location harvesting, no ad targeting based on pet ownership. Vet records, vaccination history, and medication schedules stay on-device. The pet sitter info card can be shared selectively without syncing to a third-party server.

## Cross-Module Integration

| Module | Integration |
|--------|-------------|
| **MyMeds** | Pet medication tracking reuses the same medication engine pattern (reminders, refill tracking, dosage history) |
| **MyBudget** | Pet expenses auto-categorized into budget envelopes (vet, food, grooming, toys) |
| **MyHabits** | Pet care routines as trackable daily habits (feeding, walking, grooming) |
| **MyTrails** | Dog walking with GPS tracking, distance and route recording |
| **MyHealth** | Pet therapy/emotional support animal tracking, pet wellness as part of owner wellness |
| **MyRSVP** | Pet-friendly event planning, dog park meetups |

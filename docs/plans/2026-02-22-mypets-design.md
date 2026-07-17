# MyPets — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## 1. Overview

**MyPets** — Your pet's health records. Not their advertiser profiles.

A pet health records and care tracker for the 70% of US households that have pets. Log vet visits, track vaccinations, set medication reminders, monitor weight trends, and store vet documents — all on-device with zero data sharing. Multi-pet support for the households that have 2+ animals. Free for one pet, $4.99 for unlimited.

---

## 2. Problem Statement

Pet ownership is at an all-time high (66% of US households, ~87 million homes), yet the pet care app market is dominated by data harvesters and vet-network gatekeepers:

1. **PetDesk** — Free, but it's a vet clinic marketing platform disguised as a pet health app. Vet clinics pay PetDesk for appointment booking and push notifications. PetDesk collects extensive pet health data, links it to owner identity, and uses it for targeted marketing. You can only see records from PetDesk-connected vets.

2. **Pawprint** — Free, collects pet health data, uses it for "personalized recommendations" (i.e., targeted product advertising). Requires account creation and cloud sync. Monetizes through partnerships with pet insurance, food brands, and vet networks.

3. **11Pets** — $20/year subscription for premium features. Better than PetDesk/Pawprint on privacy, but still cloud-synced and subscription-based. Overly complex UI with feature bloat.

4. **Generic reminder apps** — Pet owners cobble together Apple Reminders, Notes, and Photos to track vet appointments, medications, and vaccination records. Works but fragmented and easy to lose track.

**The gap:** Zero privacy-first pet health apps exist. Every competitor either harvests pet owner data for advertising, locks records behind vet network partnerships, or charges ongoing subscriptions. Pet owners deserve a simple health tracker that doesn't sell their pet's (and their own) data to pet insurance companies and food brands.

**70% of US households have pets. Zero privacy-first apps serve them.**

---

## 3. Target User Persona

### Primary: "Pet Parent Paula" — Dedicated Multi-Pet Owner

- **Age:** 25-45
- **Context:** Owns 2-3 pets (dog + cat, two dogs, etc.). Takes them to independent vets. Wants to keep vaccination records current and remember when Fido's heartworm meds are due.
- **Current tools:** Notes app, vet clinic paper printouts in a drawer, text reminders to herself
- **Pain points:** Can never find vaccination records when boarding. Forgets monthly flea/tick medication. Different pets on different schedules. Vet asks "when was the last rabies shot?" and she guesses.
- **Willingness to pay:** $5 for organized pet health records? Without hesitation.
- **Where they hang out:** r/dogs (3.8M), r/cats (4.8M), r/pets (800K), r/puppy101 (500K), Instagram pet communities, TikTok pet content

### Secondary: "New Pet Nate" — First-Time Pet Owner

- **Age:** 22-35
- **Context:** Just adopted a puppy or kitten. Overwhelmed by the vaccination schedule, deworming, spay/neuter timing, and ongoing care requirements.
- **Pain points:** Doesn't know what vaccines are needed or when. Vet rattled off a schedule but he forgot. Needs reminders and guidance.
- **Willingness to pay:** $5 for peace of mind that he's not missing anything? Yes.

### Tertiary: "Rescue Rachel" — Foster/Multi-Animal Household

- **Age:** 30-55
- **Context:** Has 4+ pets, possibly fosters. Needs to track health records for each animal, some temporary. Generates adoption paperwork.
- **Use case:** Track medications across many animals, export records for adopters.

---

## 4. Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|--------------|
| **PetDesk** | Free | 10M+ | ~$50M/yr (B2B vet fees) | Heavy data collection, vet marketing | Vet-network locked, data harvesting |
| **Pawprint** | Free | 2M+ | ~$10M/yr (partnerships) | Data collection for "recommendations" | Targeted pet product advertising |
| **11Pets** | $20/yr | 1M+ | ~$10M/yr | Cloud-synced, account required | Subscription, complex UI |
| **Pet First Aid (Red Cross)** | $1 one-time | 500K+ | ~$500K total | Minimal collection | Emergency info only, no health tracking |
| **Vet clinic portals** | Free | Varies | $0 (marketing tool) | Clinic-specific, data used for upselling | Fragmented, one clinic per app |
| **MyPets** | **Free (1 pet) / $4.99 unlimited** | **0 (launch)** | **TBD** | **Local-only, zero telemetry** | **New, no vet integration** |

### Competitive Advantages

1. **Privacy:** No data harvesting. Your pet's health records aren't used to target you with pet insurance or food ads.
2. **Independence:** Works with any vet. Not locked to a vet network.
3. **Price:** Free for 1 pet, $4.99 one-time for unlimited. No subscriptions.
4. **Multi-pet:** First-class support for households with 2+ animals of any species.
5. **Reminders:** Reusable reminder engine (same architecture as MyMeds) for medications, vaccinations, and appointments.
6. **Export:** Generate PDF health records for boarding, travel, or new vets.

---

## 5. Key Features (MVP)

### 5.1 Pet Profiles
- Add pets with: name, species (dog, cat, bird, rabbit, fish, reptile, horse, other), breed, birthday/adoption date, sex, spay/neuter status, weight (current), color/markings, microchip ID (optional), photo
- Per-pet health dashboard: next vet visit, upcoming vaccines, medication schedule, weight trend
- Quick-switch between pets via horizontal scroll or tab bar
- Pet avatar with photo or species-based default icon

### 5.2 Vet Visit Log
- Log visits: date, vet clinic name, vet doctor name, visit type (wellness, sick, emergency, dental, surgery, other), weight at visit, diagnosis, treatment, cost, notes
- Attach photos to visit entries (receipts, lab results, X-rays, discharge papers)
- Chronological visit history per pet
- Visit reminders: schedule next check-up with push notification
- Sort and filter by: date, visit type, vet clinic

### 5.3 Vaccination Tracker
- Log vaccinations: vaccine name, date administered, next due date, vet who administered, lot number (optional), notes
- Pre-defined vaccine schedules by species:
  - **Dogs:** Rabies (1yr then 3yr), DHPP/DA2PP (annual or 3yr), Bordetella (annual), Leptospirosis (annual), Canine Influenza (annual), Lyme (annual)
  - **Cats:** Rabies (1yr then 3yr), FVRCP (annual or 3yr), FeLV (annual for at-risk)
  - **Other species:** Custom vaccine entries
- Color-coded status: current (green), due soon (amber, within 30 days), expired (red)
- Push notification reminders before vaccines are due
- Vaccination certificate export (PDF) for boarding, travel, grooming

### 5.4 Medication Reminders
- Add medications: name, dosage, frequency (daily, twice daily, weekly, monthly, every N days), start date, end date (or ongoing), prescribing vet, notes
- Common pet medications pre-populated for easy entry:
  - Monthly: heartworm prevention, flea/tick prevention
  - Daily: thyroid medication, insulin, pain management
  - As needed: antibiotics (course with end date), ear drops
- Push notification at scheduled times
- "Mark as given" with timestamp
- Medication adherence tracking (% doses given on time)
- Medication history log
- Snooze reminder (15min, 30min, 1hr)
- Multi-pet medication dashboard: see all pets' med schedules at a glance

### 5.5 Feeding Schedule
- Set feeding times per pet: breakfast, lunch, dinner, or custom times
- Food details: brand, type (dry, wet, raw), amount per feeding
- Dietary restrictions and allergies (free text notes)
- Feeding reminders (local push notifications)
- Track food changes over time (useful for identifying allergy triggers)

### 5.6 Weight & Health Trends
- Log weight entries with date
- Weight trend chart (line chart, last 12 months)
- Target weight range (set by user, based on vet recommendation)
- Visual indicator if weight is above/below target range
- BMI-equivalent body condition score (1-9 scale, standard vet scale)
- Growth chart for puppies/kittens (compare to breed averages)

### 5.7 Emergency Contacts
- Store emergency vet contact: clinic name, phone, address, hours
- Regular vet contact info
- Pet poison control hotline (pre-populated: ASPCA 888-426-4435)
- One-tap call from the app
- Per-pet emergency info: allergies, medical conditions, medications (quick reference card for pet sitters)

### 5.8 Document Storage
- Store vet records as photos: lab results, X-rays, prescriptions, discharge summaries
- Adoption papers, microchip registration, insurance policy
- Organized by pet and document type
- Quick-access viewer

### 5.9 Health Record Export (PDF)
- Generate comprehensive health record PDF per pet
- Includes: pet info, vaccination history, medication list, vet visit history, weight log
- Clean, professional layout suitable for boarding facilities, new vets, or travel
- Share via system share sheet

### 5.10 Settings
- Appearance: dark mode (default), light mode, system
- Weight units: lbs or kg
- Temperature units: F or C
- Notification preferences: reminder timing, sound
- Data: export (JSON backup), import backup, clear all data
- About: version, privacy policy

---

## 6. Technical Architecture

### 6.1 Stack

- **Mobile:** Expo (React Native) — iOS + Android
- **Web:** Next.js 15 — manage pet records from desktop
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **Charts:** Victory Native (mobile), Recharts (web)
- **PDF Generation:** `react-native-html-to-pdf` (mobile), `@react-pdf/renderer` (web)
- **Image Storage:** expo-file-system (photos stored in app document directory)
- **Notifications:** expo-notifications (local push only)
- **Camera:** expo-image-picker

### 6.2 Monorepo Structure

```
MyPets/
├── apps/
│   ├── mobile/                # Expo (React Native)
│   │   ├── app/               # Expo Router
│   │   │   ├── (tabs)/
│   │   │   │   ├── pets/      # Pet list + pet detail
│   │   │   │   ├── health/    # Health dashboard (meds, vaccines, weight)
│   │   │   │   ├── schedule/  # Feeding + medication schedule
│   │   │   │   ├── emergency/ # Emergency contacts + quick reference
│   │   │   │   └── settings/  # App settings
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── PetCard.tsx
│   │   │   ├── VetVisitEntry.tsx
│   │   │   ├── VaccineCard.tsx
│   │   │   ├── MedicationCard.tsx
│   │   │   ├── WeightChart.tsx
│   │   │   ├── FeedingSchedule.tsx
│   │   │   └── EmergencyCard.tsx
│   │   └── assets/
│   │       └── species-icons/  # Default avatars per species
│   └── web/                   # Next.js 15
│       ├── app/
│       │   ├── pets/
│       │   ├── health/
│       │   ├── schedule/
│       │   └── settings/
│       └── components/
├── packages/
│   ├── shared/                # Shared business logic
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrations.ts
│   │   │   │   └── queries.ts
│   │   │   ├── models/        # Zod schemas and TypeScript types
│   │   │   ├── reminders/     # Reminder engine (reusable pattern from MyMeds)
│   │   │   │   ├── scheduler.ts
│   │   │   │   ├── medication-reminders.ts
│   │   │   │   ├── vaccine-reminders.ts
│   │   │   │   └── feeding-reminders.ts
│   │   │   ├── vaccines/      # Vaccine schedule definitions
│   │   │   │   ├── dog-schedule.ts
│   │   │   │   ├── cat-schedule.ts
│   │   │   │   └── types.ts
│   │   │   ├── health/        # Health calculations
│   │   │   │   ├── weight-trends.ts
│   │   │   │   └── body-condition.ts
│   │   │   ├── export/        # PDF generation
│   │   │   │   ├── health-record-pdf.ts
│   │   │   │   └── vaccine-certificate.ts
│   │   │   └── constants/     # Species, breeds, common medications
│   │   └── package.json
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── theme.ts
│   │   │   └── ...
│   │   └── package.json
│   ├── eslint-config/
│   └── typescript-config/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── CLAUDE.md
├── timeline.md
└── README.md
```

### 6.3 Data Model (SQLite Schema)

```sql
-- Pet profiles
CREATE TABLE pets (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name            TEXT NOT NULL,
    species         TEXT NOT NULL CHECK (species IN (
        'dog', 'cat', 'bird', 'rabbit', 'fish',
        'reptile', 'horse', 'hamster', 'guinea_pig', 'other'
    )),
    breed           TEXT DEFAULT '',
    birthday        TEXT DEFAULT '',          -- YYYY-MM-DD (exact or approximate)
    adoption_date   TEXT DEFAULT '',          -- YYYY-MM-DD
    sex             TEXT DEFAULT '' CHECK (sex IN ('', 'male', 'female')),
    is_neutered     INTEGER DEFAULT 0,        -- 0=no/unknown, 1=yes
    color_markings  TEXT DEFAULT '',
    microchip_id    TEXT DEFAULT '',
    photo_path      TEXT DEFAULT '',          -- local file path
    current_weight  REAL DEFAULT NULL,        -- lbs or kg
    weight_unit     TEXT NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
    target_weight_min REAL DEFAULT NULL,
    target_weight_max REAL DEFAULT NULL,
    notes           TEXT DEFAULT '',          -- allergies, conditions, special needs
    is_active       INTEGER NOT NULL DEFAULT 1,  -- 0 for deceased/rehomed (hidden, not deleted)
    position        INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vet contacts
CREATE TABLE vet_contacts (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT REFERENCES pets(id) ON DELETE SET NULL, -- null = shared across all pets
    contact_type    TEXT NOT NULL CHECK (contact_type IN ('primary_vet', 'emergency_vet', 'specialist', 'other')),
    clinic_name     TEXT NOT NULL,
    doctor_name     TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    hours           TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vet visits
CREATE TABLE vet_visits (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    visit_type      TEXT NOT NULL CHECK (visit_type IN (
        'wellness', 'sick', 'emergency', 'dental',
        'surgery', 'vaccination', 'follow_up', 'other'
    )),
    date            TEXT NOT NULL,            -- YYYY-MM-DD
    clinic_name     TEXT DEFAULT '',
    doctor_name     TEXT DEFAULT '',
    weight_at_visit REAL DEFAULT NULL,
    diagnosis       TEXT DEFAULT '',
    treatment       TEXT DEFAULT '',
    cost            REAL DEFAULT 0.0,
    currency        TEXT NOT NULL DEFAULT 'USD',
    next_visit_date TEXT DEFAULT NULL,        -- YYYY-MM-DD for follow-up reminder
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Photos attached to vet visits
CREATE TABLE visit_photos (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    visit_id        TEXT NOT NULL REFERENCES vet_visits(id) ON DELETE CASCADE,
    local_path      TEXT NOT NULL,
    caption         TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vaccinations
CREATE TABLE vaccinations (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    vaccine_name    TEXT NOT NULL,            -- 'rabies', 'dhpp', 'fvrcp', custom
    date_given      TEXT NOT NULL,            -- YYYY-MM-DD
    next_due_date   TEXT DEFAULT NULL,        -- YYYY-MM-DD
    vet_name        TEXT DEFAULT '',
    clinic_name     TEXT DEFAULT '',
    lot_number      TEXT DEFAULT '',
    manufacturer    TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Medications (current and past)
CREATE TABLE medications (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    dosage          TEXT NOT NULL,            -- e.g., "50mg", "1 tablet", "0.5ml"
    frequency       TEXT NOT NULL,            -- 'daily', 'twice_daily', 'weekly', 'monthly', 'every_N_days'
    frequency_days  INTEGER DEFAULT NULL,     -- for 'every_N_days': the N value
    time_of_day     TEXT DEFAULT '[]',        -- JSON array of times: ["08:00", "20:00"]
    start_date      TEXT NOT NULL,            -- YYYY-MM-DD
    end_date        TEXT DEFAULT NULL,        -- null = ongoing
    prescribing_vet TEXT DEFAULT '',
    reason          TEXT DEFAULT '',          -- what it's for
    is_active       INTEGER NOT NULL DEFAULT 1,
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Medication dose log (track adherence)
CREATE TABLE medication_doses (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
    scheduled_at    TEXT NOT NULL,            -- when the dose was due
    taken_at        TEXT DEFAULT NULL,        -- when actually given (null = missed)
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed', 'skipped')),
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feeding schedule
CREATE TABLE feeding_schedule (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    meal_name       TEXT NOT NULL DEFAULT 'Meal',  -- 'Breakfast', 'Dinner', etc.
    time            TEXT NOT NULL,            -- HH:MM (24hr)
    food_brand      TEXT DEFAULT '',
    food_type       TEXT DEFAULT '' CHECK (food_type IN ('', 'dry', 'wet', 'raw', 'mixed', 'other')),
    amount          TEXT DEFAULT '',          -- e.g., "1 cup", "1/2 can"
    notes           TEXT DEFAULT '',
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Weight history
CREATE TABLE weight_log (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    weight          REAL NOT NULL,
    unit            TEXT NOT NULL DEFAULT 'lbs' CHECK (unit IN ('lbs', 'kg')),
    date            TEXT NOT NULL,            -- YYYY-MM-DD
    source          TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'vet_visit')),
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documents (vet records, adoption papers, insurance, etc.)
CREATE TABLE documents (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pet_id          TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
        'vet_record', 'lab_result', 'xray', 'prescription',
        'adoption_paper', 'microchip_cert', 'insurance',
        'license', 'receipt', 'other'
    )),
    label           TEXT DEFAULT '',
    local_path      TEXT NOT NULL,
    date            TEXT DEFAULT '',          -- YYYY-MM-DD
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value)
CREATE TABLE settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_vet_visits_pet ON vet_visits(pet_id);
CREATE INDEX idx_vet_visits_date ON vet_visits(date DESC);
CREATE INDEX idx_vaccinations_pet ON vaccinations(pet_id);
CREATE INDEX idx_vaccinations_due ON vaccinations(next_due_date);
CREATE INDEX idx_medications_pet ON medications(pet_id);
CREATE INDEX idx_medications_active ON medications(is_active);
CREATE INDEX idx_medication_doses_med ON medication_doses(medication_id);
CREATE INDEX idx_medication_doses_status ON medication_doses(status);
CREATE INDEX idx_medication_doses_scheduled ON medication_doses(scheduled_at);
CREATE INDEX idx_feeding_pet ON feeding_schedule(pet_id);
CREATE INDEX idx_weight_pet ON weight_log(pet_id);
CREATE INDEX idx_weight_date ON weight_log(date DESC);
CREATE INDEX idx_documents_pet ON documents(pet_id);
CREATE INDEX idx_vet_contacts_pet ON vet_contacts(pet_id);
```

### 6.4 Reminder Engine Architecture

The reminder engine is the heart of MyPets — reusing the pattern established in MyMeds. Three reminder subsystems feed into a unified notification scheduler:

```typescript
// Unified reminder interface
interface PetReminder {
  id: string;
  petId: string;
  petName: string;
  type: 'medication' | 'vaccination' | 'vet_visit' | 'feeding';
  title: string;           // "Give Luna her heartworm pill"
  subtitle: string;        // "Heartgard Plus - 1 chewable"
  scheduledAt: Date;
  status: 'pending' | 'completed' | 'missed' | 'snoozed';
  snoozeUntil: Date | null;
  metadata: MedicationReminder | VaccineReminder | VetReminder | FeedingReminder;
}

// Medication reminders: generated from medication schedule
interface MedicationReminder {
  medicationId: string;
  dosage: string;
  isOngoing: boolean;
}

// Vaccine reminders: generated from vaccination due dates
interface VaccineReminder {
  vaccinationId: string;
  vaccineName: string;
  dueDate: string;         // 30 days before, 7 days before, day of
}

// Vet visit reminders: user-set follow-up dates
interface VetReminder {
  visitId: string;
  visitType: string;
}

// Feeding reminders: daily recurring at set times
interface FeedingReminder {
  feedingId: string;
  mealName: string;
}
```

**Notification scheduling:**
```typescript
/**
 * Generate all pending notifications for the next 7 days.
 * Called on app launch and after any reminder data changes.
 * Uses expo-notifications scheduleNotificationAsync for local push.
 */
async function scheduleUpcomingNotifications(pets: Pet[]): Promise<void> {
  // Cancel all existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const horizon = addDays(now, 7);

  for (const pet of pets) {
    // 1. Medication doses due in the next 7 days
    const medReminders = generateMedicationReminders(pet, now, horizon);

    // 2. Vaccines due within 30 days (remind at 30d, 7d, 1d, day-of)
    const vaccineReminders = generateVaccineReminders(pet, now);

    // 3. Scheduled vet visits
    const vetReminders = generateVetVisitReminders(pet, now, horizon);

    // 4. Daily feeding times
    const feedingReminders = generateFeedingReminders(pet, now, horizon);

    const allReminders = [
      ...medReminders,
      ...vaccineReminders,
      ...vetReminders,
      ...feedingReminders,
    ];

    for (const reminder of allReminders) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${pet.name}: ${reminder.title}`,
          body: reminder.subtitle,
          data: { reminderId: reminder.id, petId: pet.id, type: reminder.type },
        },
        trigger: { date: reminder.scheduledAt },
      });
    }
  }
}
```

### 6.5 Vaccine Schedule Definitions

```typescript
interface VaccineDefinition {
  name: string;
  displayName: string;
  species: string[];
  isCore: boolean;           // core vs non-core (lifestyle) vaccine
  initialSeriesDoses: number;
  initialIntervalWeeks: number;
  boosterIntervalMonths: number;  // 12 = annual, 36 = every 3 years
  description: string;
}

const DOG_VACCINES: VaccineDefinition[] = [
  {
    name: 'rabies',
    displayName: 'Rabies',
    species: ['dog'],
    isCore: true,
    initialSeriesDoses: 1,
    initialIntervalWeeks: 0,
    boosterIntervalMonths: 12, // first booster at 1yr, then 36 months
    description: 'Required by law in most states. First dose at 12-16 weeks.',
  },
  {
    name: 'dhpp',
    displayName: 'DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)',
    species: ['dog'],
    isCore: true,
    initialSeriesDoses: 3,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 36,
    description: 'Core puppy series at 6-8, 10-12, 14-16 weeks. Booster at 1yr, then every 3 years.',
  },
  {
    name: 'bordetella',
    displayName: 'Bordetella (Kennel Cough)',
    species: ['dog'],
    isCore: false,
    initialSeriesDoses: 1,
    initialIntervalWeeks: 0,
    boosterIntervalMonths: 12,
    description: 'Recommended for dogs who board, attend daycare, or visit dog parks.',
  },
  {
    name: 'leptospirosis',
    displayName: 'Leptospirosis',
    species: ['dog'],
    isCore: false,
    initialSeriesDoses: 2,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 12,
    description: 'Recommended for dogs exposed to wildlife, standing water, or rural environments.',
  },
  {
    name: 'canine_influenza',
    displayName: 'Canine Influenza (H3N2/H3N8)',
    species: ['dog'],
    isCore: false,
    initialSeriesDoses: 2,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 12,
    description: 'Recommended for dogs who board or attend daycare.',
  },
  {
    name: 'lyme',
    displayName: 'Lyme Disease',
    species: ['dog'],
    isCore: false,
    initialSeriesDoses: 2,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 12,
    description: 'Recommended for dogs in tick-endemic areas (Northeast, Upper Midwest).',
  },
];

const CAT_VACCINES: VaccineDefinition[] = [
  {
    name: 'rabies',
    displayName: 'Rabies',
    species: ['cat'],
    isCore: true,
    initialSeriesDoses: 1,
    initialIntervalWeeks: 0,
    boosterIntervalMonths: 12, // or 36 with PureVax
    description: 'Required by law in most states. First dose at 12-16 weeks.',
  },
  {
    name: 'fvrcp',
    displayName: 'FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia)',
    species: ['cat'],
    isCore: true,
    initialSeriesDoses: 3,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 36,
    description: 'Core kitten series at 6-8, 10-12, 14-16 weeks. Booster at 1yr, then every 3 years.',
  },
  {
    name: 'felv',
    displayName: 'FeLV (Feline Leukemia Virus)',
    species: ['cat'],
    isCore: false,
    initialSeriesDoses: 2,
    initialIntervalWeeks: 3,
    boosterIntervalMonths: 12,
    description: 'Recommended for outdoor cats and cats in multi-cat households.',
  },
];
```

### 6.6 Privacy Architecture

- **Zero network requests:** No HTTP calls, no analytics, no telemetry.
- **No vet network integration:** MyCar doesn't connect to PetDesk, Pawprint, or any vet portal. Records are entered manually.
- **No species/breed data collection:** We don't aggregate breed popularity data or pet demographics.
- **Local SQLite only:** All data in the app sandbox.
- **No accounts:** No registration, no login.
- **Photo storage:** Vet records, receipts, and pet photos stored locally only.
- **Export is explicit:** PDF and JSON export triggered by user action only.
- **No background activity:** No background sync, no server pings.

---

## 7. UI/UX Direction

### 7.1 Design Language

- **Theme:** Dark mode default, warm and friendly (pets deserve warmth, not clinical coldness)
- **Typography:** Inter (humanist sans-serif), 16pt base
- **Colors:**
  - Background: `#0F0F0F` (near-black)
  - Surface: `#1A1A1A` (card backgrounds)
  - Surface elevated: `#242424` (modals, sheets)
  - Primary: `#F59E0B` (amber-500, warm gold)
  - Accent health: `#14B8A6` (teal-500, for health/weight charts)
  - Accent love: `#F472B6` (pink-400, for pet-related warmth — adoption dates, birthdays)
  - Warning: `#F97316` (orange-500, for "due soon" reminders)
  - Error/overdue: `#EF4444` (red-500)
  - Success: `#22C55E` (green-500, for "all current" vaccine status)
  - Text primary: `#F5F5F5`
  - Text secondary: `#A3A3A3`
- **Pet cards:** Rounded cards with pet photo circle avatar, species icon badge
- **Species icons:** Custom minimal line icons for each species (dog, cat, bird, rabbit, etc.) — used as default avatars when no photo is set
- **Iconography:** Lucide icons for UI, custom species icons for pets
- **Animations:** Subtle — pet card entrance animation, confetti on birthday, weight graph animation on load

### 7.2 Screen Flow

```
App Launch → Pets (default tab)
├── Pets Tab
│   ├── Pet Carousel (horizontal scroll of pet cards)
│   │   ├── Each card: photo, name, species/breed, age, next action due
│   │   └── [+ Add Pet] → Add Pet Form
│   │       ├── Photo (camera or gallery)
│   │       ├── Name, Species, Breed, Birthday, Sex
│   │       ├── Weight, Microchip ID
│   │       └── [Save]
│   ├── [Tap Pet] → Pet Detail
│   │   ├── Header: photo, name, age, weight, species/breed
│   │   ├── Quick Actions: Log Visit, Add Vaccine, Add Med, Log Weight
│   │   ├── Health Summary Cards:
│   │   │   ├── Vaccines: X current, Y due soon, Z overdue
│   │   │   ├── Medications: N active, adherence %
│   │   │   └── Weight: current, trend arrow (up/down/stable)
│   │   ├── Tabs: Visits | Vaccines | Meds | Weight | Documents
│   │   │   ├── Visits: chronological list
│   │   │   │   ├── [Tap] → Visit Detail (photos, diagnosis, treatment)
│   │   │   │   └── [+ Log Visit] → Add Visit Form
│   │   │   ├── Vaccines: card per vaccine with status badge
│   │   │   │   ├── [Tap] → Vaccine History (all doses)
│   │   │   │   └── [+ Add Vaccine] → Log Vaccine Form
│   │   │   ├── Meds: active medications with next dose time
│   │   │   │   ├── [Tap] → Medication Detail (adherence, history)
│   │   │   │   └── [+ Add Med] → Add Medication Form
│   │   │   ├── Weight: trend chart + log entries
│   │   │   │   └── [+ Log Weight] → Quick weight entry
│   │   │   └── Documents: photo grid
│   │   │       └── [+ Add Document] → Camera/Gallery + type picker
│   │   └── [Export Health Record] → PDF generation → Share sheet
│   └── Dashboard Summary (across all pets)
│       ├── Upcoming: next 5 reminders across all pets
│       └── Overdue: any missed vaccines or medications
├── Health Tab (unified schedule view)
│   ├── Today's Tasks: medications due, feeding times
│   ├── This Week: upcoming vet visits, vaccines
│   ├── Multi-pet timeline: color-coded by pet
│   └── [Mark as Done] quick actions
├── Schedule Tab
│   ├── Medication Schedule: all pets, all meds, time-sorted
│   │   ├── [Check] → Mark dose as given
│   │   └── [Snooze] → Snooze 15/30/60 min
│   ├── Feeding Schedule: all pets, time-sorted
│   └── Reminders: vaccine due dates, vet follow-ups
├── Emergency Tab
│   ├── Per-pet emergency card: allergies, conditions, current meds
│   ├── Vet contacts: one-tap call
│   ├── Emergency vet (24hr): one-tap call
│   └── ASPCA Poison Control: one-tap call (888-426-4435)
└── Settings Tab
    ├── Units (lbs/kg, F/C)
    ├── Appearance (Dark/Light/System)
    ├── Notifications (timing, sounds)
    ├── Data (Backup, Restore, Clear)
    └── About
```

### 7.3 Key Interaction Patterns

**Quick Actions:** From the pet detail screen, one-tap buttons for the 4 most common actions: Log Visit, Add Vaccine, Add Med, Log Weight. Reduces the number of taps for daily use.

**Medication Check-In:** When a medication reminder fires, the notification action buttons allow "Given" or "Snooze" directly from the notification without opening the app.

**Vaccine Status Cards:** Each vaccine is a visual card with clear status:
- Green checkmark + "Current until [date]" — vaccinated and not yet due
- Amber clock + "Due in [N] days" — approaching due date
- Red exclamation + "Overdue by [N] days" — past due date
- Gray plus + "Not recorded" — no vaccination on file

**Weight Trend:** The weight chart shows a line with target range shaded in green. If the current weight is outside the range, the latest data point pulses amber as a gentle visual cue.

**Emergency Card:** The Emergency tab shows a "pet sitter card" — a single screen per pet with name, photo, allergies, medications, conditions, and vet phone number. Designed to be handed to a pet sitter or shown to an emergency vet.

**Birthday/Adoption Anniversary:** On the pet's birthday or adoption anniversary, the pet card shows a subtle celebration indicator (warm glow, not confetti — classy, not cheesy).

---

## 8. Monetization

### 8.1 Pricing Model

- **Free for 1 pet** — full features, no limitations, no ads
- **$4.99 one-time purchase for unlimited pets** via App Store and Mac App Store
- **Direct purchase option** via Lemon Squeezy
- **No subscriptions.**
- **No ads in the free tier.** The free tier is genuinely free and fully functional. The only limitation is 1 pet.

### 8.2 Why "Free for 1 Pet"

This freemium gate is specifically designed for the pet market:
- Single-pet households (30% of pet owners) get a complete, free app — generating word-of-mouth and App Store reviews
- Multi-pet households (the majority) hit the natural upgrade point when adding their second pet
- The upgrade decision is easy: "I already use this for Max, now I want to add Luna. $5? Done."
- No feature gating means free users aren't frustrated — they're delighted and ready to upgrade when they get another pet

### 8.3 Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| Free downloads | 1,000 | 8,000/mo | 15,000/mo |
| Paid conversions | 200 | 2,000/mo | 5,000/mo |
| Revenue (gross) | $998 | $9,980/mo | $24,950/mo |
| Revenue (net, after Apple 15%) | $848 | $8,483/mo | $21,208/mo |

**Conversion rate assumption:** 20% of downloaders have 2+ pets and convert. This is conservative — 70% of multi-pet owners have 2+ animals.

### 8.4 Cost Structure

- **Hosting:** $0 (no backend)
- **App Store fees:** Apple 15%, Google 15%
- **Development:** Time investment only
- **Marketing:** Organic pet community posts + influencer partnerships

---

## 9. Marketing Angle

### 9.1 Core Messaging

**Tagline:** "Your pet's health records. Not their advertiser profiles."

**Positioning statements:**
- "70% of US households have pets. Zero privacy-first pet health apps exist. Until now."
- "Log vet visits, track vaccines, never miss a medication. $4.99 once."
- "Your vet records aren't for pet food companies."
- "Free for 1 pet. Unlimited pets for $4.99. No subscriptions. No ads. No accounts."

### 9.2 Launch Channels

| Channel | Strategy | Expected Impact |
|---------|----------|-----------------|
| **r/dogs** (3.8M) | "Built a private pet health tracker" — show vaccine tracking demo | Very High — massive, engaged audience |
| **r/cats** (4.8M) | "Cat health tracker that doesn't sell your data" | Very High — even larger audience |
| **r/pets** (800K) | General pet health tracking announcement | High |
| **r/puppy101** (500K) | "New puppy? Here's how to track all those vaccines" — onboarding angle | High — overwhelmed new owners |
| **r/AskVet** (250K) | Helpful post about keeping organized vet records | Medium — credibility audience |
| **Instagram #PetHealth** | Visual posts showing the app with real pet photos | High — pet parents love sharing pet content |
| **TikTok #PetMom #PetDad** | 30-second demo: "How I track my dog's vaccines" | Very High — pet content is top-tier on TikTok |
| **Product Hunt** | "Your pet's private health record" launch | Medium — tech early adopters with pets |
| **Pet Facebook Groups** | Targeted posts in breed-specific and local pet groups | High — active, engaged communities |

### 9.3 Content Strategy

- **Blog posts:** "What PetDesk Knows About Your Pet (and You)", "Puppy Vaccination Schedule Guide", "Why Your Pet's Data Shouldn't Be Sold to Insurance Companies"
- **Comparison pages:** MyPets vs PetDesk, MyPets vs Pawprint, MyPets vs 11Pets
- **ASO keywords:** "pet health tracker offline", "dog vaccine tracker", "cat medication reminder", "pet records private"
- **Seasonal content:** "Flea & tick season checklist", "Holiday pet safety reminders"

### 9.4 Vet Waiting Room Strategy

Pet owners spend time in vet waiting rooms. Marketing to this context:
- Encourage users to share the app with other waiting pet parents
- "Just got your dog's vaccines? Log them before you forget."
- The app is most useful when you're AT the vet — data entry is fresh and accurate

### 9.5 Multi-Pet Upgrade Funnel

The free-to-paid conversion path:
1. User downloads MyPets for their dog (free, 1 pet)
2. App delivers genuine value: vaccine tracking, medication reminders, vet visit history
3. User gets a second pet (or already has one they haven't added)
4. "Add another pet" prompts a friendly, non-pushy upgrade screen
5. "$4.99 for unlimited pets. One-time. No subscriptions."
6. User upgrades — they've already experienced the value

---

## 10. MVP Timeline

### Week 1-2: Foundation
- [ ] Initialize Turborepo monorepo with Expo + Next.js + shared packages
- [ ] Set up SQLite database layer with schema and migrations
- [ ] Pet profile CRUD (create, read, update, delete, photo)
- [ ] Tab navigation scaffold (Pets, Health, Schedule, Emergency, Settings)
- [ ] Pet card component with species-based default avatars
- [ ] Dark mode theme tokens and color system
- [ ] Vet contact CRUD

### Week 3-4: Vet Visits & Vaccinations
- [ ] Vet visit logging with all fields (type, weight, diagnosis, treatment, cost)
- [ ] Photo attachment for vet visits
- [ ] Visit history timeline per pet
- [ ] Vaccination logging with vaccine name, dates, vet
- [ ] Pre-defined vaccine schedules for dogs and cats
- [ ] Vaccine status cards (current / due soon / overdue / not recorded)
- [ ] Vaccine reminder notifications (30d, 7d, 1d before due)

### Week 5-6: Medication Reminders
- [ ] Medication CRUD (name, dosage, frequency, times)
- [ ] Reminder engine: generate dose schedule from medication definition
- [ ] Local push notifications for medication times
- [ ] "Mark as given" / "Snooze" from notification action buttons
- [ ] Medication dose log and adherence tracking
- [ ] Multi-pet medication dashboard
- [ ] Medication history and adherence percentage

### Week 7-8: Feeding, Weight & Health
- [ ] Feeding schedule CRUD (times, food details)
- [ ] Feeding reminders (local push)
- [ ] Weight logging with date
- [ ] Weight trend chart (line, 12 months)
- [ ] Target weight range with visual indicator
- [ ] Weight auto-log from vet visits (populate weight_log when vet visit includes weight)
- [ ] Pet health dashboard: summary cards for vaccines, meds, weight

### Week 9-10: Export, Documents & Polish
- [ ] Document storage (photos of vet records, adoption papers, insurance)
- [ ] PDF health record generation per pet
- [ ] Vaccination certificate PDF
- [ ] Emergency tab with pet sitter cards and one-tap calling
- [ ] Settings screen (units, appearance, notifications, data management)
- [ ] JSON backup and restore
- [ ] Full-text search across pet records
- [ ] Birthday/adoption anniversary celebration

### Week 11-12: Launch
- [ ] RevenueCat integration (free tier + one-time purchase for unlimited pets)
- [ ] Lemon Squeezy storefront for direct sales
- [ ] Next.js web app (pet management + record viewing)
- [ ] Cross-platform testing (iOS, Android, web)
- [ ] App icon, splash screen, App Store screenshots
- [ ] App Store metadata and privacy policy
- [ ] Beta testing with 15-20 pet owners from Reddit
- [ ] Launch: App Store + r/dogs + r/cats + r/pets + Product Hunt + TikTok demo

---

## 11. Acceptance Criteria

The MVP is complete when all of the following are true:

### Functional
- [ ] User can add multiple pet profiles with photo, species, breed, birthday, weight
- [ ] User can log vet visits with date, type, diagnosis, treatment, cost, and photos
- [ ] User can log vaccinations with vaccine name, date, and next due date
- [ ] Vaccine status cards correctly show current/due soon/overdue status
- [ ] User can add medications with dosage and frequency
- [ ] Medication reminders fire at scheduled times via local push notification
- [ ] User can mark medication doses as given, skipped, or missed
- [ ] Medication adherence percentage is calculated and displayed
- [ ] Feeding schedule with reminders works per pet
- [ ] Weight log and trend chart displays correctly
- [ ] Emergency tab shows pet info card with one-tap vet calling
- [ ] PDF health record exports with full history per pet
- [ ] Document storage works (photo capture, viewing, organization)
- [ ] Free tier works for 1 pet with full features
- [ ] Upgrade to unlimited pets works via in-app purchase
- [ ] App works fully offline on iOS, Android, and web

### Non-Functional
- [ ] Cold launch to pet list < 1 second
- [ ] Handles 10+ pets and 500+ records without lag
- [ ] App size < 25MB (before user photos)
- [ ] Zero network requests (verified via network inspector)
- [ ] All data stored in app sandbox / document directory
- [ ] Photos compressed to reasonable size (< 2MB each)
- [ ] Notifications fire reliably within 1 minute of scheduled time

### Business
- [ ] App Store listing live on iOS and Android
- [ ] Free tier + one-time purchase flow works via RevenueCat
- [ ] Direct purchase flow works via Lemon Squeezy
- [ ] Privacy policy published (emphasizes no data harvesting)
- [ ] Launch posts prepared for r/dogs, r/cats, r/pets, Product Hunt, TikTok

---

## 12. Future Roadmap (Post-MVP)

These are explicitly **not** in the MVP:

1. **Pet insurance integration** — Optional, user-initiated submission of health records to pet insurance providers for claims. On-demand export, not automatic sharing.
2. **Breed-specific health screening reminders** — Automatically suggest health screenings based on breed (e.g., hip X-rays for German Shepherds, cardiac screening for Cavalier King Charles).
3. **Multi-household sharing** — Share a pet's records with a partner or family member via QR code (local transfer, no cloud).
4. **Vet record OCR** — Scan a printed vet record and auto-populate vaccination/visit data. On-device ML, no cloud OCR.
5. **Apple Watch companion** — Medication reminders on the wrist, quick "dose given" confirmation.
6. **Widgets** — Home screen widget showing next medication due per pet.
7. **Pet sitter mode** — Generate a shareable "care sheet" with feeding times, medication schedule, emergency contacts, and notes. Export as PDF or display as a pinned screen.
8. **Growth charts** — Breed-specific growth curves for puppies and kittens (compare weight progression to breed averages).
9. **Expense tracking** — Per-pet cost of ownership (vet bills, food, medications, grooming). Similar to MyCar's expense feature.
10. **Lost pet mode** — Generate a "lost pet" flyer with photo, name, description, microchip ID, and contact number. Export as PDF or image for printing/social media sharing.

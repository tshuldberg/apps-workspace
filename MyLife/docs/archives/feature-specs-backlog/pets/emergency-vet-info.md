# Feature Spec: Emergency Vet Info & Contact Card

## Metadata
- **Module:** pets
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1), Emergency contacts (V2)
- **Blocks:** Pet sitter info card

## Business Context

### Why This Feature Exists
In a pet emergency, owners panic and waste critical time searching for vet phone numbers, clinic addresses, and after-hours contacts. The existing `pt_emergency_contacts` table (V2) stores basic contact records with create and list operations, but there is no update or delete, no primary vet quick-access, no formatted emergency card for sharing, and no dedicated emergency screen. This feature turns the raw contact list into a purpose-built emergency response tool with one-tap calling, a shareable emergency card, and prominent primary vet display. Competitors like PetDesk focus on vet booking but not emergency preparedness; 11pets has basic vet info but no shareable card format.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Partial | Free | Stores vet contact info per pet, no emergency card, no one-tap call UI |
| PetDesk | Yes | Free | Vet practice directory with booking, but focused on scheduled visits not emergencies |
| Pawp | Yes | Premium ($24/mo) | 24/7 vet telehealth with emergency fund, but requires paid subscription |
| FitBark | No | N/A | Activity tracker only, no vet/emergency features |

### Target User
Pet owners who want peace of mind knowing their vet's number and emergency clinic info is instantly accessible in a crisis. Also pet sitters, dog walkers, and family members who need quick access to a pet's vet info without calling the owner. Currently these users save vet contacts in their phone (mixed in with hundreds of other contacts) or on a fridge magnet. Migration path: users already storing vet visit history in MyPets get emergency contacts surfaced prominently.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/crud.ts            -- New CRUD: updateEmergencyContact, deleteEmergencyContact, getPrimaryEmergencyContact
modules/pets/src/engine/emergency.ts   -- Pure functions: formatEmergencyCard, findNearestEmergencyVet
modules/pets/src/types.ts              -- New Zod schemas: UpdateEmergencyContactInput, EmergencyCard
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/emergency.test.ts -- Engine + CRUD tests
apps/mobile/app/(pets)/emergency.tsx   -- Dedicated emergency screen
apps/mobile/app/(pets)/components/EmergencyContactCard.tsx  -- Contact card with call button
apps/web/app/pets/[petId]/emergency/page.tsx                -- Web emergency screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Emergency button (prominent, top-right)
                      └── Emergency Screen ← YOU ARE HERE
```

The emergency screen is accessible from the pet detail screen via a prominent red emergency button in the top-right corner. It is also accessible from the module-level reminders tab as a quick link.

### Data Model

No schema changes needed. The existing V2 `pt_emergency_contacts` table is sufficient:

```sql
-- Already exists in V2 (no migration needed)
CREATE TABLE IF NOT EXISTS pt_emergency_contacts (
  id TEXT PRIMARY KEY,
  pet_id TEXT REFERENCES pt_pets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  clinic_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  hours TEXT,
  notes TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Already exists in V2
CREATE INDEX IF NOT EXISTS pt_emergency_contacts_pet_idx
  ON pt_emergency_contacts(pet_id, is_primary DESC, clinic_name ASC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** `expo-linking` (one-tap phone call on mobile), `expo-sharing` (share emergency card as text), no external APIs
- **Cross-Module:** None. This is a self-contained feature within the pets module.

## Functional Requirements

### User Stories
1. As a pet owner, I want to update an existing emergency contact's details so that I can keep vet info current when my vet moves or changes hours.
2. As a pet owner, I want to delete an emergency contact that is no longer relevant so that my list stays clean.
3. As a pet owner, I want to see my primary vet prominently at the top of the emergency screen so that I can call them instantly in a crisis.
4. As a pet owner, I want a one-tap call button next to each contact so that I do not waste time copying numbers.
5. As a pet owner, I want to share a formatted emergency card (text) with my pet sitter so that they have all vet info in one message.
6. As a pet sitter, I want to see both pet-specific and global emergency contacts in one view so that I know who to call regardless of which pet needs help.

### Behavior Specification

**Viewing the emergency screen:**
1. User navigates to a pet's detail screen
2. User taps the red emergency button (top-right, always visible)
3. System loads emergency contacts for this pet (pet-specific first, then global contacts where `pet_id IS NULL`)
4. Primary vet contact displays prominently at the top in a highlighted card
5. All other contacts display below in a scrollable list
6. If no contacts exist, show "Add your vet" CTA

**One-tap calling:**
1. User taps the phone icon on any emergency contact card
2. System opens the phone dialer with the contact's number pre-filled (via `expo-linking` `tel:` scheme on mobile, `tel:` link on web)
3. User confirms the call in the native phone UI

**Updating an emergency contact:**
1. User taps the edit icon on a contact card
2. System opens Edit Contact bottom sheet (mobile) or modal (web) pre-filled with existing data
3. User modifies fields and taps Save
4. System validates (clinic_name and phone required), updates the record, refreshes the list
5. If user changes `is_primary` to true, system clears `is_primary` on the previous primary contact

**Deleting an emergency contact:**
1. User swipes left on a contact card (mobile) or taps delete icon (web)
2. System shows confirmation: "Delete [clinic name]?"
3. User confirms
4. System deletes the record and removes the card from the list

**Sharing an emergency card:**
1. User taps "Share Emergency Card" button at the bottom of the emergency screen
2. System calls `formatEmergencyCard()` to generate a formatted text block with pet name, all contacts, and key notes
3. System opens the native share sheet (mobile) or copies to clipboard (web)

**Getting the primary emergency contact:**
1. System queries `pt_emergency_contacts` for the contact with `is_primary = 1` for this pet (or globally)
2. If no primary is set, the first contact by clinic name is used as the display-top contact (but not marked primary)

### Edge Cases

- **No contacts exist:** Show empty state with vet illustration and "Add your vet" CTA button. Share button is hidden.
- **Pet-specific vs global contacts:** Contacts with `pet_id = NULL` are global (shared across all pets). Pet-specific contacts appear first, then global ones. Both are editable from any pet's emergency screen.
- **Phone number formatting:** Display phone number as-is (user-entered format). The `tel:` scheme handles various formats. Do not attempt to normalize or format phone numbers.
- **Multiple primary contacts:** Schema allows it but the UI should enforce single primary per pet scope (including global). Setting a new primary clears the old one within the same pet scope.
- **Delete primary contact:** If the primary contact is deleted, no other contact is auto-promoted. The first contact by name becomes the top-displayed contact but is not marked primary.
- **Very long clinic name (120 chars):** Truncate display with ellipsis on the card. Full name visible in edit modal.
- **No phone permission:** One-tap call opens the dialer without requiring phone permission. The OS handles the call.
- **Pet archived:** Emergency contacts remain accessible. The emergency button is still visible on archived pet detail screens.
- **Module disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Web platform calling:** `tel:` links work on desktop browsers if a telephony app is configured. On desktop without telephony, the link may not function. Show a copy-number fallback.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Primary emergency contact displays prominently at the top of the emergency screen in a highlighted card
- [ ] **AC-2:** All emergency contacts (pet-specific + global) display in a scrollable list below the primary
- [ ] **AC-3:** Each contact card shows clinic name, phone, address, hours, and a one-tap call button
- [ ] **AC-4:** Tapping the call button opens the phone dialer with the number pre-filled
- [ ] **AC-5:** User can update any emergency contact's details (label, clinic name, phone, address, hours, notes, primary flag)
- [ ] **AC-6:** User can delete an emergency contact with confirmation dialog
- [ ] **AC-7:** "Share Emergency Card" generates a formatted text block and opens the share sheet (mobile) or copies to clipboard (web)
- [ ] **AC-8:** Empty state shows vet illustration and "Add your vet" CTA when no contacts exist
- [ ] **AC-9:** Setting a new contact as primary clears the previous primary contact for the same pet scope
- [ ] **AC-10:** Emergency button is always visible on the pet detail screen (top-right, red icon)

### Technical Criteria
- [ ] **TC-1:** `updateEmergencyContact()` persists changes and clears previous primary when `is_primary` is set to true
- [ ] **TC-2:** `deleteEmergencyContact()` removes the record and CASCADE does not affect other tables
- [ ] **TC-3:** `getPrimaryEmergencyContact()` returns the `is_primary = 1` contact for a pet, falling back to global contacts
- [ ] **TC-4:** `formatEmergencyCard()` generates a clean text block with pet name, species/breed, all contacts with phone/address
- [ ] **TC-5:** `findNearestEmergencyVet()` sorts contacts by `is_primary DESC` (no location API usage)
- [ ] **TC-6:** No new database migration is needed (V2 schema is sufficient)
- [ ] **TC-7:** Sharing works on both iOS and Android via expo-sharing

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Updating a contact must NOT affect other contacts (data isolation)
- [ ] **NC-2:** Deleting a contact must NOT delete the pet or other contacts
- [ ] **NC-3:** Emergency contact data must NOT send any network requests (offline-first, local-only)
- [ ] **NC-4:** Disabling the Pets module must NOT delete emergency contacts
- [ ] **NC-5:** The emergency screen must NOT require network connectivity to display contacts

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Emergency button:** 36px circle, `#FF453A` (danger red) background, white phone icon, top-right of pet detail header
- **Primary contact card:** `rgba(255,69,58,0.08)` background, `rgba(255,69,58,0.20)` border, 12px border radius. "PRIMARY VET" label in `#FF453A` uppercase 11px bold
- **Regular contact cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius
- **Call button:** 44px circle, `#30D158` (success green) background, white phone icon, right side of each card
- **Clinic name:** `#F0F0F5` (text token), 16px semibold
- **Phone/address/hours:** `rgba(240,240,245,0.65)` (textSecondary token), 14px regular
- **Share button:** Full-width button at bottom, `rgba(255,255,255,0.04)` background, `#F59E0B` (accent) text, share icon
- **Layout:** ScrollView with sections: primary vet card (top, conditional), contact list (middle), share button (bottom)
- **Bottom sheet for Edit Contact:** Glass morphism background via expo-blur BlurView

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Emergency screen accessible via `/pets/[petId]/emergency` route
- Emergency button in pet detail header uses same red styling
- Contact cards use CSS `backdrop-filter: blur(12px)` for glass effect
- Call buttons use `<a href="tel:...">` with fallback copy-to-clipboard on desktop
- Edit Contact uses modal dialog instead of bottom sheet
- Share button copies formatted card to clipboard with toast confirmation

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 2 skeleton contact cards with pulsing animation | Initial data fetch |
| Empty | Vet illustration, "No emergency contacts yet", "Add your vet" button | No contacts for this pet (including global) |
| Single Contact | One contact card (highlighted if primary), share button | Exactly one contact exists |
| Multiple Contacts | Primary card at top (if set), list of other contacts, share button | Multiple contacts exist |
| Error | Toast: "Could not load emergency contacts." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/emergency.ts)
- [ ] `formatEmergencyCard`: generates card with pet name, species, and breed
- [ ] `formatEmergencyCard`: includes all contacts with clinic name, phone, and address
- [ ] `formatEmergencyCard`: marks primary contact with "[PRIMARY]" label
- [ ] `formatEmergencyCard`: handles empty contacts list (returns minimal card)
- [ ] `formatEmergencyCard`: handles contact with no address (omits address line)
- [ ] `formatEmergencyCard`: handles contact with no hours (omits hours line)
- [ ] `findNearestEmergencyVet`: returns primary contact first when one exists
- [ ] `findNearestEmergencyVet`: returns contacts sorted by is_primary DESC, then clinic_name ASC
- [ ] `findNearestEmergencyVet`: returns empty array when no contacts exist

### Integration Tests (CRUD)
- [ ] `updateEmergencyContact` persists updated fields
- [ ] `updateEmergencyContact` clears previous primary when setting new primary
- [ ] `updateEmergencyContact` returns null for non-existent contact
- [ ] `deleteEmergencyContact` removes the record
- [ ] `deleteEmergencyContact` is a no-op for non-existent contact
- [ ] `getPrimaryEmergencyContact` returns the is_primary=1 contact for a pet
- [ ] `getPrimaryEmergencyContact` falls back to global primary when no pet-specific primary exists
- [ ] `getPrimaryEmergencyContact` returns null when no contacts exist
- [ ] Delete pet cascades to pet-specific emergency contacts but not global ones

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one: "Luna", dog, golden retriever)
4. **Verify:** Red emergency button is visible in top-right of pet detail header -- AC-10
5. Tap the emergency button
6. **Verify empty state:** See vet illustration and "Add your vet" button -- AC-8
7. Add an emergency contact: label = "Primary Vet", clinic = "Happy Paws Vet", phone = "(415) 555-0100", address = "123 Main St", hours = "Mon-Fri 8am-6pm", primary = yes
8. **Verify:** Contact appears with "PRIMARY VET" label, highlighted card -- AC-1, AC-3
9. Add a second contact: label = "Emergency Clinic", clinic = "SF Animal ER", phone = "(415) 555-0200", hours = "24/7", primary = no
10. **Verify:** Primary vet at top, ER clinic below -- AC-1, AC-2
11. Tap the green call button on the primary vet card
12. **Verify:** Phone dialer opens with (415) 555-0100 pre-filled -- AC-4
13. Tap edit icon on the ER clinic card
14. Change hours to "24/7 including holidays", tap Save
15. **Verify:** Card updates with new hours -- AC-5
16. Swipe left on the ER clinic card, tap Delete, confirm
17. **Verify:** Only primary vet remains -- AC-6
18. Re-add the ER clinic
19. Tap "Share Emergency Card"
20. **Verify:** Share sheet opens with formatted text containing pet name, both contacts with phone numbers -- AC-7
21. Add a new contact and set it as primary
22. **Verify:** Previous primary is no longer marked primary -- AC-9
23. Create a second pet "Max"
24. Navigate to Max's emergency screen
25. **Verify:** Global contacts (pet_id IS NULL) appear here too -- AC-2

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for emergency engine (card formatter, contact sorting)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_emergency_contacts` table exists (V2) with all needed columns: id, pet_id (nullable for global), label, clinic_name, phone, address, hours, notes, is_primary, timestamps
- `createEmergencyContact()` and `listEmergencyContacts()` CRUD exist in `crud.ts`
- `createEmergencyContact()` already handles clearing previous primary when `is_primary` is set
- `EmergencyContactSchema` and `CreateEmergencyContactInputSchema` Zod schemas exist in `types.ts`
- No update or delete CRUD for emergency contacts
- No dedicated emergency screen in mobile or web
- No emergency card formatter
- No primary vet quick-access function
- `buildPetSitterCard()` includes emergency contacts but as part of a broader card, not a dedicated emergency format

### After This Work
- New CRUD: `updateEmergencyContact()`, `deleteEmergencyContact()`, `getPrimaryEmergencyContact()`
- New Zod schemas: `UpdateEmergencyContactInputSchema`, `EmergencyCardSchema`
- New engine: `engine/emergency.ts` with `formatEmergencyCard()`, `findNearestEmergencyVet()`
- Mobile screen at `apps/mobile/app/(pets)/emergency.tsx` with primary vet highlight, contact list, call buttons
- Web page at `apps/web/app/pets/[petId]/emergency/page.tsx`
- 18+ new tests covering engine logic and CRUD operations
- No schema migration needed

### Files Changed

- `modules/pets/src/db/crud.ts` -- New CRUD: updateEmergencyContact, deleteEmergencyContact, getPrimaryEmergencyContact
- `modules/pets/src/types.ts` -- New schemas: UpdateEmergencyContactInputSchema, EmergencyCardSchema
- `modules/pets/src/engine/emergency.ts` -- New engine file with formatEmergencyCard, findNearestEmergencyVet
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/emergency.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/emergency.tsx` -- Dedicated emergency screen
- `apps/mobile/app/(pets)/components/EmergencyContactCard.tsx` -- Contact card with call button
- `apps/web/app/pets/[petId]/emergency/page.tsx` -- Web emergency page

### Known Limitations
- `findNearestEmergencyVet()` does NOT use location APIs or geolocation. It sorts by `is_primary` flag only. A future enhancement could integrate with device GPS and a vet directory API to sort by actual proximity.
- Emergency card is plain text only. A future version could generate a PDF or styled HTML card.
- No push notifications for emergency preparedness (e.g., "Your vet's info is incomplete"). This is a passive reference tool.
- No integration with pet insurance or emergency fund tracking (that belongs to the insurance feature).

### Context for Next Agent
- The existing `createEmergencyContact()` in `crud.ts` already handles the `is_primary` flag by clearing previous primaries. The new `updateEmergencyContact()` must replicate this logic when `is_primary` changes to true.
- The `listEmergencyContacts()` function has two modes: no `petId` argument returns all contacts globally; a `petId` argument returns pet-specific contacts + global contacts (where `pet_id IS NULL`), sorted with pet-specific first. The emergency screen should use the `petId` variant.
- The `buildPetSitterCard()` function already generates a `PetSitterCard` that includes emergency contacts. The new `formatEmergencyCard()` is a simpler, emergency-focused format. They share the same data source but serve different purposes. Do not replace `buildPetSitterCard()`.
- Phone number validation is intentionally loose (just `min(1).max(40)` string). International numbers, extensions, and various formats are all valid. Do not add phone number normalization.
- The emergency button on the pet detail screen should use `router.push` to navigate to the emergency screen, not a modal. It needs its own back navigation for the full-screen experience.

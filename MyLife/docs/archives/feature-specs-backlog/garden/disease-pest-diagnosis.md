# Feature Spec: Disease/Pest Diagnosis

## Metadata
- **Module:** garden
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 4-5 hours
- **Depends On:** AI plant identification (shares camera/ML infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
When a plant shows symptoms (yellowing leaves, spots, wilting, pests), users need to quickly diagnose the issue and learn treatment. PlantIn and PictureThis charge $30/yr primarily for this feature -- it's the #1 reason users renew subscriptions. Currently the garden module tracks pest_treatment as a journal entry action, but provides zero diagnostic assistance. Users must Google symptoms, cross-reference multiple sources, and hope they identify correctly before the plant dies. A bundled symptom-to-diagnosis database with optional photo-based diagnosis gives users instant, private, offline answers.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| PlantIn | Yes | Pro ($29.99/yr) | AI photo diagnosis: take photo of sick plant, get disease/pest identification + treatment plan |
| PictureThis | Yes | Pro ($29.99/yr) | AI photo diagnosis with cloud processing, treatment recommendations, severity scoring |
| Planter | No | N/A | No diagnostic capability |
| Seed to Spoon | Partial | Premium | Pest identification guide (text only, not photo-based), treatment recommendations |

### Target User
Plant owners who are losing plants to unidentified diseases or pests and currently rely on Reddit/Google for diagnosis. PlantIn users paying $30/yr for disease diagnosis who would switch to a privacy-first alternative that doesn't upload sick plant photos to cloud servers.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/diagnosis.ts             -- Symptom matcher engine
modules/garden/src/engine/diagnosis-db.ts           -- Bundled disease/pest knowledge base
modules/garden/src/types.ts                        -- Diagnosis types, Symptom, Treatment
modules/garden/src/db/schema.ts                    -- gd_diagnoses table (V2 migration)
modules/garden/src/db/crud.ts                      -- Diagnosis CRUD, history queries
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/diagnose.tsx              -- Diagnosis flow screen
apps/mobile/app/(garden)/diagnosis-detail.tsx       -- Diagnosis result detail
apps/mobile/app/(garden)/components/SymptomPicker.tsx  -- Symptom selection UI
apps/web/app/garden/diagnose/page.tsx              -- Web diagnosis flow
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Plant Detail
                 └── "Diagnose Problem" button ← YOU ARE HERE
       └── Tasks tab
            └── "Diagnose a Plant" action card
```

### Data Model

```sql
-- V2 migration: disease/pest diagnosis records
CREATE TABLE IF NOT EXISTS gd_diagnoses (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE CASCADE,
  diagnosed_date TEXT NOT NULL,
  type TEXT NOT NULL,
  symptoms_json TEXT NOT NULL,
  diagnosis_name TEXT,
  diagnosis_confidence REAL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  treatment_notes TEXT,
  treatment_status TEXT NOT NULL DEFAULT 'pending',
  image_uri TEXT,
  resolved_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_diagnoses_plant_idx ON gd_diagnoses(plant_id);
CREATE INDEX IF NOT EXISTS gd_diagnoses_date_idx ON gd_diagnoses(diagnosed_date DESC);
CREATE INDEX IF NOT EXISTS gd_diagnoses_status_idx ON gd_diagnoses(treatment_status);
```

**Column notes:**
- `type`: 'disease' | 'pest' | 'nutrient_deficiency' | 'environmental' | 'unknown'
- `symptoms_json`: JSON array of symptom codes selected by user (e.g., `["yellowing_leaves", "brown_spots", "wilting"]`)
- `diagnosis_confidence`: 0.0-1.0 match confidence from symptom matcher
- `severity`: 'mild' | 'moderate' | 'severe' | 'critical'
- `treatment_status`: 'pending' | 'in_treatment' | 'resolved' | 'unresolvable'
- `resolved_date`: set when status changes to 'resolved'

### Dependencies
- **Internal:** `@mylife/garden` (types, crud), `@mylife/ui`, AI plant identification (reuse camera components if available)
- **External:** `expo-camera` or `expo-image-picker` (photo capture for visual diagnosis), optional TFLite disease classification model
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant owner, I want to describe symptoms my plant is showing and get a likely diagnosis so that I can start treatment before the plant dies.
2. As a plant owner, I want to take a photo of a sick plant and get visual diagnosis suggestions so that I don't have to describe symptoms in words.
3. As a plant owner, I want treatment recommendations for each diagnosis so that I know exactly what to do.
4. As a plant owner, I want to track treatment progress (pending, in treatment, resolved) so that I can monitor recovery.
5. As a plant owner, I want a history of past diagnoses per plant so that I can identify recurring problems.

### Behavior Specification

**Symptom-based diagnosis (primary flow):**
1. User opens Plant Detail and taps "Diagnose Problem" (or accesses from Tasks tab)
2. Step 1 - Plant selection: pre-filled if from plant detail, otherwise plant picker
3. Step 2 - Symptom selection: scrollable grid of symptom chips organized by category:
   - **Leaves:** yellowing, browning, spots, curling, drooping, holes, sticky residue, discoloration, leaf drop
   - **Stems:** soft/mushy, discolored, lesions, leaning
   - **Roots:** rot, mushy, no growth, circling
   - **Soil:** mold, fungus gnats, white deposits, foul smell
   - **Overall:** stunted growth, no flowering, wilting despite watering
   - **Pests visible:** aphids, mealybugs, spider mites, scale, whiteflies, thrips, fungus gnats
4. User selects 1+ symptoms (multi-select, visually highlighted)
5. Step 3 - Optional photo: "Add a photo for better diagnosis" with camera/gallery option
6. Step 4 - Results: engine matches symptoms against bundled knowledge base, returns ranked diagnoses
7. Each result shows: diagnosis name, type badge (disease/pest/nutrient/environmental), confidence %, severity badge, brief description, treatment steps
8. User selects the matching diagnosis and taps "Start Treatment"
9. Creates gd_diagnoses record with status 'in_treatment', also optionally updates plant status to 'needs_attention'

**Treatment tracking:**
1. Active diagnoses appear on Plant Detail under "Active Issues" section
2. Each active issue shows: diagnosis name, severity, days in treatment, treatment steps checklist
3. User can mark diagnosis as "Resolved" (sets resolved_date, status='resolved') or "Unresolvable" (plant may need to be marked dead)
4. Resolving an issue with plant status 'needs_attention' prompts: "Mark plant as healthy again?"

**Diagnosis history:**
1. Plant Detail shows "Past Issues" section with resolved diagnoses
2. If same diagnosis recurs (e.g., spider mites again), show warning: "This plant has had spider mites before. Consider preventive treatment."

### Edge Cases

- **No matching diagnosis:** "No exact match found. Here are the closest possibilities..." with lower-confidence results. Also suggest: "If symptoms persist, consider consulting a local nursery."
- **Single symptom selected:** Still run diagnosis but with lower confidence. Show: "Select more symptoms for a more accurate diagnosis."
- **All symptoms selected (spam):** Max 10 symptoms per diagnosis. Beyond 10, show: "Focus on the most prominent symptoms for best results."
- **Photo-only diagnosis (no symptoms):** If photo ML model is available, run image classification. If not, prompt for symptom selection.
- **Plant with no species:** Diagnosis still works but with broader results (can't narrow by species-specific vulnerabilities).
- **Multiple concurrent diagnoses:** A plant can have multiple active diagnoses (e.g., both spider mites and root rot).
- **Diagnosis for dead plant:** Allowed (post-mortem analysis), but treatment tracking is disabled.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Diagnose Problem" button accessible from Plant Detail and Tasks tab
- [ ] **AC-2:** Symptom picker shows organized categories with multi-select chips
- [ ] **AC-3:** Results show ranked diagnoses with confidence %, type, severity, and treatment
- [ ] **AC-4:** Selecting a diagnosis creates a tracked issue on the plant
- [ ] **AC-5:** Active issues visible on Plant Detail with treatment status
- [ ] **AC-6:** Marking diagnosis as "Resolved" updates status and offers to mark plant healthy
- [ ] **AC-7:** Diagnosis history shows past resolved issues
- [ ] **AC-8:** Recurring diagnosis triggers a warning about past occurrences
- [ ] **AC-9:** Photo can be attached to a diagnosis for visual reference
- [ ] **AC-10:** Treatment steps shown as an actionable checklist

### Technical Criteria
- [ ] **TC-1:** Diagnoses persisted to gd_diagnoses with all fields
- [ ] **TC-2:** Symptom matching engine returns results in <500ms
- [ ] **TC-3:** Knowledge base covers top 50 common plant diseases and 20 common pests
- [ ] **TC-4:** CASCADE delete on plant_id removes diagnosis records
- [ ] **TC-5:** symptoms_json stores valid JSON array of symptom codes
- [ ] **TC-6:** Diagnosis confidence calculation uses weighted symptom matching
- [ ] **TC-7:** Treatment status transitions validated (pending -> in_treatment -> resolved/unresolvable)

### Negative Criteria
- [ ] **NC-1:** Diagnosis photos must NOT be uploaded to any server
- [ ] **NC-2:** Diagnosis engine must NOT require network connectivity
- [ ] **NC-3:** Diagnosis must NOT automatically change plant status (only suggest)
- [ ] **NC-4:** Marking a diagnosis as "unresolvable" must NOT automatically mark plant as dead
- [ ] **NC-5:** Diagnosis must NOT modify watering schedule or care settings

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Symptom chips: pill-shaped, default border `rgba(255,255,255,0.10)`, selected: accent border + accent background at 20% opacity
- Diagnosis result cards: glass morphism, type badge (disease=orange, pest=red, nutrient=yellow, environmental=blue), severity badge (mild=green, moderate=yellow, severe=orange, critical=red), confidence as small text below diagnosis name
- Treatment steps: numbered list with checkbox per step, completed steps have strikethrough
- "Diagnose Problem" button: accent-colored outline button with stethoscope icon

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/diagnose` (flow), `/garden/diagnose/[id]` (detail)
- Wizard-style multi-step layout: symptom picker left panel, results right panel
- Symptom categories as collapsible sections

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Analyzing symptoms..." with spinner | Diagnosis engine running |
| Empty | Symptom picker with no selections | Initial screen |
| Error | "Diagnosis engine unavailable. Try again." | Engine failure |
| Success | Ranked diagnosis results with treatment | Symptoms matched |
| No Match | "No exact match. Closest possibilities..." | Low confidence results |
| Active Treatment | Treatment card with progress checklist | Diagnosis in_treatment |

## Test Requirements

### Unit Tests
- [ ] `matchSymptoms()`: returns correct diagnosis for common symptom combinations
- [ ] `matchSymptoms()`: handles single symptom input
- [ ] `matchSymptoms()`: returns empty results for nonsensical combinations
- [ ] `matchSymptoms()`: caps at 10 symptoms
- [ ] `createDiagnosis()`: persists record with symptoms_json
- [ ] `updateDiagnosisStatus()`: validates status transitions
- [ ] `getActiveDiagnoses()`: returns only pending/in_treatment records
- [ ] `getDiagnosisHistory()`: returns resolved/unresolvable for a plant
- [ ] `checkRecurrence()`: detects same diagnosis_name in history
- [ ] Confidence calculation: weighted scoring produces 0.0-1.0 range

### Integration Tests
- [ ] Full flow: select plant -> pick symptoms -> get results -> start treatment -> resolve
- [ ] Recurrence: create same diagnosis twice -> verify warning triggered
- [ ] Delete plant: verify CASCADE removes all diagnoses

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden > any plant's detail page
3. Tap "Diagnose Problem"
4. Verify: symptom picker opens with organized categories -- AC-2
5. Select symptoms: "yellowing_leaves", "drooping", "soft stems"
6. Optionally add a photo
7. Tap "Diagnose"
8. Verify: results show ranked diagnoses with confidence, severity, type badges -- AC-3
9. Verify: treatment steps listed for top result -- AC-10
10. Tap "Start Treatment" on top result
11. Verify: returns to plant detail with active issue card -- AC-4, AC-5
12. Check off treatment steps on the active issue
13. Tap "Resolved"
14. Verify: issue moves to history, prompt to mark plant healthy -- AC-6, AC-7
15. Create the same diagnosis again
16. Verify: warning about past occurrence appears -- AC-8
17. Delete the plant
18. Verify: all diagnoses removed
19. On web: navigate to /garden/diagnose
20. Verify: wizard-style flow works with symptom picker and results panel

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for symptom matching engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Garden module has pest_treatment as a journal entry action type, but zero diagnostic capability. No symptom database, no treatment recommendations, no issue tracking.

### After This Work
- Bundled knowledge base with 50+ diseases, 20+ pests, nutrient deficiencies, environmental issues
- Symptom-based matching engine with weighted confidence scoring
- gd_diagnoses table for tracking issues through treatment lifecycle
- Multi-step diagnosis flow on mobile and web
- Treatment progress tracking with checklist UI
- Diagnosis history and recurrence warnings

### Files Changed
- `modules/garden/src/engine/diagnosis.ts` -- Symptom matcher, confidence scoring
- `modules/garden/src/engine/diagnosis-db.ts` -- Bundled disease/pest knowledge base
- `modules/garden/src/types.ts` -- Diagnosis, Symptom, Treatment, DiagnosisStatus types
- `modules/garden/src/db/schema.ts` -- gd_diagnoses table
- `modules/garden/src/db/crud.ts` -- Diagnosis CRUD, active/history queries
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/diagnose.tsx` -- Multi-step diagnosis flow
- `apps/mobile/app/(garden)/diagnosis-detail.tsx` -- Result detail + treatment tracking
- `apps/mobile/app/(garden)/components/SymptomPicker.tsx` -- Symptom selection
- `apps/web/app/garden/diagnose/page.tsx` -- Web diagnosis flow

### Known Limitations
- V1 uses symptom-text matching only. Photo-based ML diagnosis requires the AI plant identification feature to be built first (shared camera + model infrastructure).
- Knowledge base covers common houseplant and garden crop issues. Rare or region-specific diseases may not be included.
- Treatment recommendations are general guidelines, not professional advice. A disclaimer should note this.

### Context for Next Agent
- The diagnosis-db.ts knowledge base should be a TypeScript data structure (not a DB table) so it's queryable without SQL overhead and fully offline.
- Symptom matching uses weighted scoring: each disease has a list of associated symptoms with weights (primary symptoms score higher). The confidence is the sum of matched symptom weights divided by total possible weight for that disease.
- If the AI plant identification feature is built first, the camera viewfinder and photo capture components can be reused here.
- Treatment status transitions: pending -> in_treatment is the only valid forward step. in_treatment -> resolved or in_treatment -> unresolvable are the only terminal transitions. No going backwards.

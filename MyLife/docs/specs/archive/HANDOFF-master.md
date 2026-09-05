# Master Handoff Document - MyLife Spec Writing Project

**Last Updated:** 2026-03-07
**Project Goal:** Produce 22 comprehensive, stack-agnostic feature specification documents for every MyLife app module. Each spec must be detailed enough (4,000-5,500 lines) for a developer to rebuild the app from scratch in any language/framework.

---

## Quick Start (for new sessions)

```bash
# 1. Check current state
wc -l docs/specs/SPEC-*.md | sort -rn

# 2. Check which specs still need Sections 4-8
for spec in docs/specs/SPEC-*.md; do
  name=$(basename "$spec" .md | sed 's/SPEC-//'); lines=$(wc -l < "$spec" | tr -d ' ')
  sec4=$(grep -c "^## 4" "$spec"); sec8=$(grep -c "^## 8" "$spec")
  feat=$(grep -c "^### [A-Z][A-Z]-[0-9]" "$spec")
  cat_count=$(grep -c "^| [A-Z][A-Z]-[0-9]" "$spec")
  if [ "$sec4" -eq 1 ] && [ "$sec8" -eq 1 ]; then s="DONE"; else s="INCOMPLETE(${feat}/${cat_count} feats, sec4-8=$sec4)"; fi
  echo "${name}|${lines} lines|${s}"
done

# 3. Spawn agents for incomplete specs (see Section: Agent Prompts below)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/specs/TEMPLATE-spec.md` | Master template - 8 sections, 10 subsections per feature |
| `docs/designs/DESIGN-*.md` | 22 gap analysis design docs (input/reference for each spec) |
| `docs/specs/SPEC-*.md` | 22 output spec files |
| `docs/specs/HANDOFF-master.md` | This file - project state and resume instructions |
| `docs/specs/RESEARCH-additional-app-opportunities.md` | 22 additional module ideas (future project) |

---

## Completion Status (as of 2026-03-07)

### Tier 1: FULLY COMPLETE - All 8 sections present (8 specs)

These specs have Sections 1-8, all catalog features written, and are at target line count.

| # | App | Lines | Features | Prefix | Sections |
|---|-----|-------|----------|--------|----------|
| 1 | MyBudget | 5,565 | 32 (BG-001 to BG-032) | BG | 1-8 |
| 2 | MyBooks | 5,498 | 32 (BK-001 to BK-032) | BK | 1-8 |
| 3 | MyRecipes | 5,450 | 39 (RC-001 to RC-039) | RC | 1-8 |
| 4 | MyMeds | 5,232 | 30 (MD-001 to MD-030) | MD | 1-8 |
| 5 | MyRSVP | 5,039 | 26 (RS-001 to RS-026) | RS | 1-8 |
| 6 | MyHabits | 4,931 | 30 (HB-001 to HB-030) | HB | 1-8 |
| 7 | MyWorkouts | 4,618 | 30 (WO-001 to WO-030) | WO | 1-8 |
| 8 | MyFast | 4,048 | 23 (FT-001 to FT-023) | FT | 1-8 |

### Tier 1b: COMPLETE with caveat - Has Sec 4-8 but NOT all catalog features (1 spec)

| # | App | Lines | Features Written/Catalog | Missing Features | Sections |
|---|-----|-------|--------------------------|------------------|----------|
| 9 | MyCar | 5,797 | 20/32* | CR-017 to CR-020 written, but catalog has 32 entries - some may be referenced in catalog but not in Sec 2 table. All 20 written features have full Sec 3 specs + Sec 4-8 present. Review if catalog vs written count is correct. | 1-8 |

*Note: MyCar's feature catalog table shows 32 `| CR-NNN` rows but only 20 feature specifications were written (CR-001 through CR-020). This may mean some catalog entries were deferred or the catalog count includes sub-items. Verify before calling this complete.

### Tier 2: FEATURES MOSTLY DONE - Needs remaining features + Sections 4-8 (5 specs)

These are large (4,000+ lines or close), have many features written, but are missing some catalog features AND all of Sections 4-8.

| # | App | Lines | Feats Written/Catalog | Last Feature | Missing Features | Prefix |
|---|-----|-------|-----------------------|--------------|------------------|--------|
| 10 | MyMood | 6,354 | 21/24 | MM-021 | MM-022, MM-023, MM-024 | MM |
| 11 | MyJournal | 5,275 | 19/27 | JR-019 | JR-020 to JR-027 | JR |
| 12 | MyHealth | 5,207 | 24/30 | HL-024 | HL-025 to HL-030 | HL |
| 13 | MyCloset | 4,490 | 12/19 | CL-012 | CL-013 to CL-019 | CL |
| 14 | MyFlash | 4,277 | 17/27 | FL-017 | FL-018 to FL-027 | FL |

### Tier 3: PARTIAL - Has skeleton + some features, needs bulk of work (7 specs)

These have Sections 1-2 (skeleton) and a small number of Section 3 features. Need many more features + Sections 4-8.

| # | App | Lines | Feats Written/Catalog | Last Feature | Remaining Features | Prefix |
|---|-----|-------|-----------------------|--------------|--------------------|--------|
| 15 | MyBaby | 2,799 | 8/22 | BB-008 | BB-009 to BB-022 (14 features) | BB |
| 16 | MyNutrition | 2,445 | 7/31 | NU-007 | NU-008 to NU-031 (24 features) | NU |
| 17 | MyTrails | 2,426 | 7/20 | TR-007 | TR-008 to TR-020 (13 features) | TR |
| 18 | MyGarden | 1,311 | 3/25 | GD-003 | GD-004 to GD-025 (22 features) | GD |
| 19 | MyNotes | 1,300 | 3/24 | NT-003 | NT-004 to NT-024 (21 features) | NT |
| 20 | MyStars | 1,173 | 3/22 | ST-003 | ST-004 to ST-022 (19 features) | ST |
| 21 | MyPets | 1,166 | 3/18 | PT-003 | PT-004 to PT-018 (15 features) | PT |
| 22 | MyFilms | 1,096 | 3/21 | FM-003 | FM-004 to FM-021 (18 features) | FM |

### Summary

| Status | Count | Total Lines |
|--------|-------|-------------|
| Tier 1 (Complete) | 8 | 42,381 |
| Tier 1b (Complete-ish) | 1 | 5,797 |
| Tier 2 (Near complete) | 5 | 25,603 |
| Tier 3 (Partial) | 8 | 12,716 |
| **Total** | **22** | **86,497** |
| **Target** | 22 | ~100,000+ |

---

## Critical Lessons Learned

### 1. NEVER use a single Write call for large files

Agents that tried to write 4,000+ lines in one Write tool call **stalled indefinitely** (10+ minutes with no output, hitting output token limits). This was the #1 cause of agent failure.

**Required approach - Incremental APPEND:**
1. All 22 skeleton files already exist with Sections 1-2 (100-120 lines)
2. Agent reads the existing file, then uses **Edit tool to APPEND** content in chunks
3. Write Section 3 features in groups of **3-4 features per Edit call** (~250-350 lines each)
4. Append Sections 4-8 in **2-3 separate Edit calls**

### 2. Edit tool APPEND pattern

To append content to the end of a file, use the Edit tool with `old_string` set to the last few lines of the file and `new_string` set to those same last lines PLUS the new content. Example:

```
old_string: (last 3-5 lines of the current file)
new_string: (those same lines) + (new content to append)
```

### 3. Agent stall detection

An agent is stalled if:
- Log file size has not changed in 5+ minutes
- The agent's `stop_reason` is `null` (streaming) but the timestamp is 8+ minutes old
- The spec file's `wc -l` count hasn't changed across 2+ monitoring cycles

Fix: Kill the stalled agent and respawn with the same prompt. The file on disk is the checkpoint.

### 4. Batch sizing

- Run 4-6 agents concurrently (not 12 - too many can cause system pressure)
- Each agent writes to a different file, so there are no conflicts
- Monitor every 90 seconds with `wc -l` checks

---

## Feature ID Prefixes

| App | Prefix | App | Prefix |
|-----|--------|-----|--------|
| MyBooks | BK | MyJournal | JR |
| MyBudget | BG | MyFlash | FL |
| MyFast | FT | MyMood | MM |
| MyWorkouts | WO | MyTrails | TR |
| MyHabits | HB | MyCloset | CL |
| MyMeds | MD | MyNotes | NT |
| MyHealth | HL | MyPets | PT |
| MyRecipes | RC | MyStars | ST |
| MyCar | CR | MyGarden | GD |
| MyRSVP | RS | MyNutrition | NU |
| MyBaby | BB | MyFilms | FM |

---

## Template Structure Reference

Every spec follows the template at `docs/specs/TEMPLATE-spec.md`. The 8 sections are:

### Section 1: Product Overview (~50 lines)
- 1.1 Product Identity (name, tagline, module ID, feature prefix)
- 1.2 Target Users and Personas (table)
- 1.3 Core Value Proposition
- 1.4 Competitive Landscape (table)
- 1.5 Privacy Positioning

### Section 2: Feature Catalog (~40-60 lines)
- Table of all features with: Feature ID, Name, Priority (P0-P3), Category, Dependencies, Status
- Priority and Category legends

### Section 3: Feature Specifications (BULK - 3,000-4,500 lines)
For EACH feature in the catalog, include ALL 10 subsections:

| Subsection | Name | Content |
|------------|------|---------|
| 3.1 | Header | Feature ID, name, priority, category, complexity |
| 3.2 | User Stories | As a [persona], I want [action], so that [benefit] |
| 3.3 | Detailed Description | 2-5 paragraphs: what, why, how, competitive context |
| 3.4 | Prerequisites | Feature deps, external deps, assumed capabilities |
| 3.5 | User Interface Requirements | Screens with layout, states table, interactions, transitions |
| 3.6 | Data Requirements | Entity tables with field/type/constraints, relationships, indexes, validation, example data |
| 3.7 | Business Logic Rules | Algorithms in pseudocode, formulas, edge cases, state machines, sort/filter logic |
| 3.8 | Error Handling | Scenario/behavior/recovery table, validation timing |
| 3.9 | Acceptance Criteria | Given/When/Then format: happy path, edge cases, negative tests |
| 3.10 | Test Specifications | Unit tests (input/output table), integration tests, E2E tests |

### Section 4: Data Architecture (~100-150 lines)
- 4.1 Entity-Relationship Overview
- 4.2 Complete Entity Definitions (all tables consolidated)
- 4.3 Relationships table
- 4.4 Indexes table
- 4.5 Table Prefix (e.g., `bk_` for books)
- 4.6 Migration Strategy

### Section 5: Screen Map (~80-100 lines)
- 5.1 Tab Structure (5 tabs)
- 5.2 Navigation Flow (ASCII tree)
- 5.3 Screen Inventory (route table)
- 5.4 Deep Link Patterns

### Section 6: Cross-Module Integration (~30-50 lines)
- Integration points table: source module, target module, data flow, trigger

### Section 7: Privacy and Security (~50-70 lines)
- 7.1 Data Storage table
- 7.2 Network Activity table
- 7.3 Data That Never Leaves the Device
- 7.4 User Data Ownership (export, delete, portability)
- 7.5 Security Controls table

### Section 8: Glossary (~20-30 lines)
- Domain-specific terms table

---

## Key Business Logic by App

Include these formulas/algorithms in agent prompts for the relevant app:

**MyCar (CR):** VIN check digit (weights [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2]), MPG = miles/gallons, cost_per_mile = total_fuel_cost/total_miles, maintenance intervals (oil 5000mi/6mo, tires 7500mi, brakes 20000mi)

**MyJournal (JR):** AES-256-GCM encryption (PBKDF2 100k iterations, 256-bit salt, 96-bit IV), streak tracking with 1-day grace period, CBT thought records (15 cognitive distortions), FTS5 full-text search, word_count per entry

**MyMood (MM):** Plutchik's wheel (8 primary emotions x 3 intensities = 24 named emotions), Year in Pixels (365-cell grid mapped to 5-point scale colors), Pearson correlation r = sum((x-mean_x)(y-mean_y)) / sqrt(sum((x-mean_x)^2) * sum((y-mean_y)^2)) where |r| >= 0.3 is significant, breathing exercises (box 4-4-4-4, 4-7-8)

**MyHealth (HL):** BMI = weight_kg / (height_m^2), sleep quality score (0-100) based on duration + efficiency + wake events, blood pressure categories (normal <120/80, elevated 120-129/<80, stage 1 130-139/80-89, stage 2 140+/90+), HRV = RMSSD in ms

**MyFlash (FL):** FSRS spaced repetition - difficulty D = clamp(D0 + 3*(1-grade), 1, 10), stability S = S * e^(0.1 * (grade-3)), interval I = S * 9 * (desired_retention^(1/0.7) - 1), retrievability R = (1 + t/(9*S))^(-1/0.7)

**MyCloset (CL):** cost_per_wear = purchase_price / times_worn, donation_threshold = last_worn > 365 days, seasonal rotation (spring: Mar-May, summer: Jun-Aug, fall: Sep-Nov, winter: Dec-Feb), wardrobe_utilization = items_worn_30d / total_items * 100

**MyNutrition (NU):** Mifflin-St Jeor BMR: Men = 10*kg + 6.25*cm - 5*age + 5, Women = 10*kg + 6.25*cm - 5*age - 161. TDEE = BMR * activity_factor (Sedentary 1.2, Light 1.375, Moderate 1.55, Active 1.725, Very Active 1.9). Macro calories: protein 4cal/g, carbs 4cal/g, fat 9cal/g, alcohol 7cal/g. USDA FoodData Central API for food database.

**MyTrails (TR):** Haversine: a = sin^2(dlat/2) + cos(lat1)*cos(lat2)*sin^2(dlon/2), d = 2*R*atan2(sqrt(a), sqrt(1-a)), R=6371km. Elevation gain = sum of positive deltas with 3m noise filter. GPS sampling 1-5 seconds. Pace = time_seconds / distance_km. GPX XML format for import/export.

**MyNotes (NT):** Markdown AST parsing for live preview, [[backlink]] regex /\[\[([^\]]+)\]\]/g, force-directed graph layout (Fruchterman-Reingold algorithm), FTS5 full-text search with BM25 ranking, version diff (Myers diff algorithm)

**MyStars (ST):** Moon phase: phase_angle = ((julian_date - 2451550.1) mod 29.53059) / 29.53059 * 360, synodic period = 29.53059 days. Aspects: conjunction 0 deg (orb 8), sextile 60 (orb 6), square 90 (orb 7), trine 120 (orb 8), opposition 180 (orb 8). 78-card tarot: 22 Major Arcana + 56 Minor (4 suits x 14). Zodiac: 12 signs with precise degree boundaries.

**MyGarden (GD):** Smart watering: base_interval adjusted by season (summer 0.67x interval = more frequent, winter 2x interval = less frequent). USDA hardiness zones 1-13 with 5-degree-F increments. Companion planting matrix (beneficial/harmful/neutral). Growing degree days GDD = max(0, (T_max+T_min)/2 - T_base). survival_rate = alive_plants / total_plants * 100.

**MyBaby (BB):** WHO growth percentiles using Box-Cox L/M/S: Z = ((value/M)^L - 1) / (L * S) when L != 0, Z = ln(value/M) / S when L = 0. Percentile = Phi(Z) * 100. CDC milestone schedule: 2/4/6/9/12/15/18/24 months. Wake windows by age: newborn 45-60min, 3mo 75-90min, 6mo 2-3hr, 12mo 3-4hr.

**MyFilms (FM):** TMDb API (search, movie details, credits, images), half-star ratings (0.5, 1.0, ..., 5.0), Letterboxd CSV import (date, name, year, rating, review columns), total_hours = sum(runtime_minutes) / 60, average_rating = sum(ratings) / count(rated_films), genre_distribution_pct = genre_count / total * 100

**MyPets (PT):** Weight percentile curves by breed (lookup tables), vaccination schedules by species (core vs non-core), total_cost_of_ownership = sum(vet + food + grooming + meds + supplies), monthly_cost_avg = total_cost / months_owned, age_years = (today - birth_date) / 365.25

---

## Agent Prompt Templates

### Prompt A: Complete a Tier 2 spec (features mostly done, needs remaining features + Sec 4-8)

Use for: MyMood, MyJournal, MyHealth, MyCloset, MyFlash

```
CONTINUE writing the feature spec for [APP_NAME] at /Users/trey/Desktop/Apps/MyLife/docs/specs/SPEC-[lowercase_name].md.

CURRENT STATE:
- File has ~[LINE_COUNT] lines
- Sections 1-2 are complete
- Section 3 has [N_WRITTEN] of [N_TOTAL] features written (last: [LAST_FEATURE_ID])
- Sections 4-8 are MISSING

REMAINING FEATURES (from the catalog in Section 2):
[LIST EACH MISSING FEATURE ID AND NAME, e.g.:]
- [XX]-020: [Feature Name]
- [XX]-021: [Feature Name]
...

YOUR TASKS:
1. Read the ENTIRE existing file
2. Read the template at /Users/trey/Desktop/Apps/MyLife/docs/specs/TEMPLATE-spec.md
3. Read the design doc at /Users/trey/Desktop/Apps/MyLife/docs/designs/DESIGN-[name]-feature-gaps.md
4. Use Edit tool to APPEND remaining features after the last feature ([LAST_FEATURE_ID])
   - Write 3-4 features per Edit call
   - Each feature MUST have all 10 subsections: Header, User Stories, Detailed Description,
     Prerequisites, UI Requirements, Data Requirements, Business Logic, Error Handling,
     Acceptance Criteria (Given/When/Then), Test Specifications (unit/integration/E2E tables)
5. After all features, APPEND these sections in 2-3 Edit calls:
   - Section 4: Data Architecture (complete SQLite schema with ALL tables, `[xx]_` prefix, relationships, indexes, migration strategy)
   - Section 5: Screen Map (5-tab structure, navigation tree, screen inventory, deep links)
   - Section 6: Cross-Module Integration (integration points with other MyLife modules)
   - Section 7: Privacy and Security (storage, network activity, data ownership, security controls)
   - Section 8: Glossary (domain-specific terms)

KEY BUSINESS LOGIC:
[PASTE RELEVANT FORMULAS FROM THE "Key Business Logic by App" SECTION ABOVE]

CRITICAL RULES:
- Use Edit tool to APPEND content. NEVER use Write tool for the whole file.
- Write features in groups of 3-4 per Edit call (~250-350 lines each)
- No em dashes anywhere - use " - " instead
- Stack-agnostic: say "scrollable list" not "FlatList", "local database" not "SQLite"
- Acceptance criteria must be specific enough to write automated tests from
- Include concrete numbers: "max 255 characters" not "reasonable length"
- Business logic must include explicit formulas, not vague descriptions
- Target: 4,000-5,500 total lines when complete
```

### Prompt B: Complete a Tier 3 spec (skeleton + few features, needs bulk work)

Use for: MyBaby, MyNutrition, MyTrails, MyGarden, MyNotes, MyStars, MyPets, MyFilms

```
CONTINUE writing the feature spec for [APP_NAME] at /Users/trey/Desktop/Apps/MyLife/docs/specs/SPEC-[lowercase_name].md.

CURRENT STATE:
- File has ~[LINE_COUNT] lines
- Sections 1-2 are complete
- Section 3 has only [N_WRITTEN] of [N_TOTAL] features written (last: [LAST_FEATURE_ID])
- Sections 4-8 are MISSING
- This spec needs substantial work - [N_REMAINING] features still need full specifications

REMAINING FEATURES (from the catalog in Section 2):
[LIST EACH MISSING FEATURE ID AND NAME]

YOUR TASKS:
1. Read the ENTIRE existing file
2. Read the template at /Users/trey/Desktop/Apps/MyLife/docs/specs/TEMPLATE-spec.md
3. Read the design doc at /Users/trey/Desktop/Apps/MyLife/docs/designs/DESIGN-[name]-feature-gaps.md
4. Use Edit tool to APPEND features after the last written feature ([LAST_FEATURE_ID])
   - Write 3-4 features per Edit call (~250-350 lines each)
   - Each feature MUST have all 10 subsections (see template)
   - Work through ALL remaining features systematically
5. After all features, APPEND Sections 4-8 (see Prompt A above for details)

KEY BUSINESS LOGIC:
[PASTE RELEVANT FORMULAS]

CRITICAL RULES:
[SAME AS PROMPT A]
```

### Agent spawn parameters

```
Agent tool parameters:
  subagent_type: "general-purpose"
  mode: "bypassPermissions"
  run_in_background: true
```

---

## Recommended Execution Plan

### Priority 1: Finish Tier 2 specs (quick wins - 5 specs)

These are closest to done. Each needs only a few more features + Sections 4-8.

| Spec | Agent Task | Estimated Work |
|------|-----------|----------------|
| MyMood | Add MM-022 to MM-024 (3 features) + Sec 4-8 | ~800 lines |
| MyJournal | Add JR-020 to JR-027 (8 features) + Sec 4-8 | ~2,500 lines |
| MyHealth | Add HL-025 to HL-030 (6 features) + Sec 4-8 | ~2,000 lines |
| MyCloset | Add CL-013 to CL-019 (7 features) + Sec 4-8 | ~2,200 lines |
| MyFlash | Add FL-018 to FL-027 (10 features) + Sec 4-8 | ~3,000 lines |

### Priority 2: Finish Tier 3 specs (bulk work - 8 specs)

Run in 2 batches of 4:

**Batch 2A:**

| Spec | Remaining Features | Estimated Work |
|------|-------------------|----------------|
| MyNutrition | NU-008 to NU-031 (24 features) + Sec 4-8 | ~3,500 lines |
| MyBaby | BB-009 to BB-022 (14 features) + Sec 4-8 | ~3,000 lines |
| MyTrails | TR-008 to TR-020 (13 features) + Sec 4-8 | ~3,000 lines |
| MyNotes | NT-004 to NT-024 (21 features) + Sec 4-8 | ~3,500 lines |

**Batch 2B:**

| Spec | Remaining Features | Estimated Work |
|------|-------------------|----------------|
| MyStars | ST-004 to ST-022 (19 features) + Sec 4-8 | ~3,500 lines |
| MyGarden | GD-004 to GD-025 (22 features) + Sec 4-8 | ~3,500 lines |
| MyPets | PT-004 to PT-018 (15 features) + Sec 4-8 | ~3,000 lines |
| MyFilms | FM-004 to FM-021 (18 features) + Sec 4-8 | ~3,200 lines |

### Priority 3: Quality review

After all 22 specs are complete, verify each spec against this checklist:
- [ ] Has all 8 top-level sections
- [ ] Every feature in Section 2 catalog has a corresponding Section 3 specification
- [ ] Every Section 3 feature has all 10 subsections
- [ ] Acceptance criteria use Given/When/Then format
- [ ] Test specifications include unit, integration, and E2E tables
- [ ] Business logic includes explicit formulas (not vague descriptions)
- [ ] Data requirements include entity tables with types, constraints, and example data
- [ ] Section 4 consolidates ALL entities from individual features
- [ ] Section 5 has navigation tree and deep link patterns
- [ ] No em dashes anywhere in the document
- [ ] Language is stack-agnostic (no framework-specific terms)
- [ ] File is 4,000-5,500 lines

---

## Feature Catalogs for Incomplete Specs

Below are the exact feature lists from each incomplete spec's Section 2 catalog. Use these when writing agent prompts.

### MyMood (MM) - Missing: MM-022, MM-023, MM-024

| ID | Feature Name | Priority |
|----|-------------|----------|
| MM-022 | Ambient Sounds | P2 |
| MM-023 | Widgets | P2 |
| MM-024 | Settings & Preferences | P0 |

### MyJournal (JR) - Missing: JR-020 to JR-027

| ID | Feature Name | Priority |
|----|-------------|----------|
| JR-020 | Grid/Mandala Layout | P2 |
| JR-021 | Affirmations Tracker | P2 |
| JR-022 | Philosophy/Stoic Prompts | P2 |
| JR-023 | Therapy Prep Templates | P2 |
| JR-024 | Vision Board | P2 |
| JR-025 | Printed Books from Entries | P3 |
| JR-026 | Settings and Preferences | P0 |
| JR-027 | Onboarding and First-Run | P1 |

### MyHealth (HL) - Missing: HL-025 to HL-030

| ID | Feature Name | Priority |
|----|-------------|----------|
| HL-025 | SOS / Panic Button | P2 |
| HL-026 | Body Composition | P2 |
| HL-027 | Health Insights (AI Summary) | P2 |
| HL-028 | Clinical Health Records Import | P3 |
| HL-029 | Module Absorption Migration | P0 |
| HL-030 | Settings and Preferences | P0 |

### MyCloset (CL) - Missing: CL-013 to CL-019

| ID | Feature Name | Priority |
|----|-------------|----------|
| CL-013 | Shopping Wishlist | P2 |
| CL-014 | Capsule Wardrobe Builder | P2 |
| CL-015 | Color Palette Analysis | P2 |
| CL-016 | Style Board / Mood Board | P2 |
| CL-017 | Data Export (CSV/JSON) | P1 |
| CL-018 | Settings and Preferences | P0 |
| CL-019 | Onboarding and First-Run | P1 |

### MyFlash (FL) - Missing: FL-018 to FL-027

| ID | Feature Name | Priority |
|----|-------------|----------|
| FL-018 | Undo Last Review | P1 |
| FL-019 | Study Session Options | P1 |
| FL-020 | AI Card Generation from Text | P1 |
| FL-021 | Shared Deck Browser | P1 |
| FL-022 | Anki .apkg Export | P2 |
| FL-023 | AI Practice Tests | P2 |
| FL-024 | Match Game Mode | P2 |
| FL-025 | Competitive Leagues | P2 |
| FL-026 | Settings and Preferences | P0 |
| FL-027 | Onboarding and First-Run | P1 |

### MyBaby (BB) - Missing: BB-009 to BB-022

| ID | Feature Name | Priority |
|----|-------------|----------|
| BB-009 | Pumping Log and Timer | P1 |
| BB-010 | Feeding Timer (Breast/Bottle) | P1 |
| BB-011 | Nap Predictor (Wake Windows) | P1 |
| BB-012 | Caregiver Sharing | P1 |
| BB-013 | Medicine Tracking | P1 |
| BB-014 | Teething Log | P2 |
| BB-015 | First Experiences Journal | P2 |
| BB-016 | Multi-Child Support | P1 |
| BB-017 | Pediatrician Visit Log | P1 |
| BB-018 | Solid Food Introduction Tracker | P2 |
| BB-019 | Data Export | P1 |
| BB-020 | Settings and Preferences | P1 |
| BB-021 | Week-by-Week Development Info | P2 |
| BB-022 | Photo Timeline | P2 |

### MyNutrition (NU) - Missing: NU-008 to NU-031

| ID | Feature Name | Priority |
|----|-------------|----------|
| NU-008 | BMR and TDEE Calculator | P0 |
| NU-009 | Food Search | P0 |
| NU-010 | Custom Food Creation | P1 |
| NU-011 | Recipe Nutrition Calculator | P1 |
| NU-012 | Micronutrient Tracking | P1 |
| NU-013 | Water Intake Tracking | P1 |
| NU-014 | Favorite Foods and Quick Add | P1 |
| NU-015 | Copy Meals Between Days | P1 |
| NU-016 | Weekly Nutrition Reports | P1 |
| NU-017 | Streak Tracking | P1 |
| NU-018 | Calorie Deficit/Surplus Tracking | P1 |
| NU-019 | Meal Planning | P1 |
| NU-020 | Weight Goal Integration | P1 |
| NU-021 | Nutrient Reports and Charts | P1 |
| NU-022 | Food Diary Notes | P2 |
| NU-023 | CSV/JSON Export | P1 |
| NU-024 | Data Import (MFP, Cronometer, Lose It!) | P2 |
| NU-025 | Settings and Preferences | P1 |
| NU-026 | Onboarding Flow | P1 |
| NU-027 | AI Photo Food Logging | P2 |
| NU-028 | Restaurant Menu Database | P2 |
| NU-029 | Caffeine Tracking | P2 |
| NU-030 | Home Screen Widgets | P2 |
| NU-031 | Apple Watch Quick-Log | P2 |

### MyTrails (TR) - Missing: TR-008 to TR-020

| ID | Feature Name | Priority |
|----|-------------|----------|
| TR-008 | Photo Geotagging | P1 |
| TR-009 | Trip Planning | P1 |
| TR-010 | Trail Difficulty Rating | P1 |
| TR-011 | Live Location Sharing | P1 |
| TR-012 | Achievement Badges | P2 |
| TR-013 | Weather Overlay | P2 |
| TR-014 | Wrong-Turn Alerts | P2 |
| TR-015 | Waypoint Management | P1 |
| TR-016 | Activity Type Support | P0 |
| TR-017 | Privacy Zones | P1 |
| TR-018 | Packing List Generator | P2 |
| TR-019 | Segment Tracking | P2 |
| TR-020 | Trail Search and Filtering | P0 |

### MyNotes (NT) - Missing: NT-004 to NT-024

| ID | Feature Name | Priority |
|----|-------------|----------|
| NT-004 | Tag System | P0 |
| NT-005 | Note Pinning and Favorites | P0 |
| NT-006 | Wiki-Style [[Backlinks]] | P1 |
| NT-007 | Backlinks Panel | P1 |
| NT-008 | Note Templates | P1 |
| NT-009 | Task Lists and Checklists | P1 |
| NT-010 | Code Blocks with Syntax Highlighting | P1 |
| NT-011 | Rich Embeds (Images, Files) | P1 |
| NT-012 | Note Export (Markdown, PDF, JSON) | P1 |
| NT-013 | Note Import | P1 |
| NT-014 | Daily Notes | P2 |
| NT-015 | Knowledge Graph View | P2 |
| NT-016 | Table of Contents from Headers | P2 |
| NT-017 | Table Support | P2 |
| NT-018 | Version History with Diffs | P2 |
| NT-019 | Quick Capture | P1 |
| NT-020 | Note Sorting and Filtering | P1 |
| NT-021 | Settings and Preferences | P0 |
| NT-022 | Onboarding and First-Run | P1 |
| NT-023 | Word and Character Count | P1 |
| NT-024 | Focus/Zen Mode | P2 |

### MyStars (ST) - Missing: ST-004 to ST-022

| ID | Feature Name | Priority |
|----|-------------|----------|
| ST-004 | Planet Position Calculator | P0 |
| ST-005 | Daily Horoscope Generation | P0 |
| ST-006 | Birth Chart Visualization | P1 |
| ST-007 | Zodiac Compatibility (Synastry) | P1 |
| ST-008 | Planetary Transit Tracking | P1 |
| ST-009 | Moon Phase Calendar | P1 |
| ST-010 | Aspect Calculations | P1 |
| ST-011 | Personality Insights | P1 |
| ST-012 | Birth Chart Explanations | P1 |
| ST-013 | Zodiac Events Calendar | P1 |
| ST-014 | Retrograde Alerts | P2 |
| ST-015 | Tarot Card of the Day | P2 |
| ST-016 | Celestial Events Calendar | P2 |
| ST-017 | Astrology Journal | P2 |
| ST-018 | Solar Return Chart | P2 |
| ST-019 | Progressed Chart | P2 |
| ST-020 | Data Export (JSON/CSV) | P1 |
| ST-021 | Settings and Preferences | P0 |
| ST-022 | Onboarding and First-Run | P1 |

### MyGarden (GD) - Missing: GD-004 to GD-025

| ID | Feature Name | Priority |
|----|-------------|----------|
| GD-004 | Garden Bed Mapping | P0 |
| GD-005 | Planting Calendar by USDA Zone | P0 |
| GD-006 | Care Schedule | P0 |
| GD-007 | Companion Planting Matrix | P1 |
| GD-008 | Harvest Tracking | P1 |
| GD-009 | Pest and Disease Log | P1 |
| GD-010 | Fertilizer Schedule | P1 |
| GD-011 | Seed Inventory | P1 |
| GD-012 | Garden Statistics | P1 |
| GD-013 | Frost Alerts | P1 |
| GD-014 | Plant Health Scoring | P1 |
| GD-015 | Plant Wish List | P1 |
| GD-016 | Room and Zone Organization | P1 |
| GD-017 | Seasonal Care Adjustments | P1 |
| GD-018 | Plant Care Database | P0 |
| GD-019 | Search and Filtering | P0 |
| GD-020 | Propagation Tracking | P2 |
| GD-021 | Monthly Care Summary | P2 |
| GD-022 | Data Export | P1 |
| GD-023 | Data Import | P2 |
| GD-024 | Settings and Preferences | P0 |
| GD-025 | Onboarding and First-Run | P1 |

### MyPets (PT) - Missing: PT-004 to PT-018

| ID | Feature Name | Priority |
|----|-------------|----------|
| PT-004 | Medication Tracking & Reminders | P0 |
| PT-005 | Weight Tracking & Growth Charts | P0 |
| PT-006 | Feeding Schedule & Reminders | P1 |
| PT-007 | Exercise & Walk Logging | P1 |
| PT-008 | Grooming Schedule | P1 |
| PT-009 | Training Log | P1 |
| PT-010 | Expense Tracking | P1 |
| PT-011 | Emergency Vet Contacts | P1 |
| PT-012 | Multi-Pet Dashboard | P1 |
| PT-013 | Pet Health Timeline | P1 |
| PT-014 | Breed-Specific Health Alerts | P2 |
| PT-015 | Photo Gallery | P2 |
| PT-016 | Pet Sitter Info Export | P2 |
| PT-017 | Data Export | P1 |
| PT-018 | Settings & Preferences | P0 |

### MyFilms (FM) - Missing: FM-004 to FM-021

| ID | Feature Name | Priority |
|----|-------------|----------|
| FM-004 | Ratings and Reviews | P0 |
| FM-005 | Collections and Lists | P0 |
| FM-006 | Search and Filtering | P0 |
| FM-007 | Film Diary Calendar | P1 |
| FM-008 | Viewing Statistics | P1 |
| FM-009 | Year-in-Review | P1 |
| FM-010 | Ratings Histogram | P1 |
| FM-011 | Actor and Director Browsing | P1 |
| FM-012 | Tags and Categorization | P1 |
| FM-013 | Letterboxd CSV Import | P1 |
| FM-014 | Data Export (CSV/JSON) | P1 |
| FM-015 | Rewatch Tracking | P1 |
| FM-016 | Decade Browsing | P1 |
| FM-017 | Settings and Preferences | P0 |
| FM-018 | Onboarding and First-Run | P1 |
| FM-019 | IMDb CSV Import | P2 |
| FM-020 | Film Goals and Challenges | P2 |
| FM-021 | Streaming Availability | P2 |

---

## Monitoring Commands

```bash
# Quick status check - line counts
wc -l docs/specs/SPEC-*.md | sort -rn

# Check for stalled agents - compare line counts 90 seconds apart
wc -l docs/specs/SPEC-*.md | sort > /tmp/spec-check-1.txt
sleep 90
wc -l docs/specs/SPEC-*.md | sort > /tmp/spec-check-2.txt
diff /tmp/spec-check-1.txt /tmp/spec-check-2.txt

# Verify a spec has all 8 sections
grep "^## [0-9]" docs/specs/SPEC-[name].md

# Count features written vs catalog
grep -c "^### [A-Z][A-Z]-[0-9]" docs/specs/SPEC-[name].md  # written
grep -c "^| [A-Z][A-Z]-[0-9]" docs/specs/SPEC-[name].md    # catalog
```

---

## Style Rules (enforced across all specs)

1. **No em dashes** - use " - " or rephrase
2. **Stack-agnostic** - say "scrollable list" not "FlatList", "local database" not "SQLite", "persistent storage" not "AsyncStorage"
3. **Present tense** - "The system displays..." not "will display..."
4. **Concrete numbers** - "max 255 characters" not "reasonable length", "3-second timeout" not "appropriate timeout"
5. **Testable acceptance criteria** - Given/When/Then format specific enough to write automated tests
6. **Explicit formulas** - Include actual math, not "calculates the appropriate value"
7. **Example data** - Every Data Requirements section includes a JSON example

---

## Notes

- All 22 design docs exist at `docs/designs/DESIGN-*.md` and serve as domain input for each spec
- Template at `docs/specs/TEMPLATE-spec.md` (530 lines, 22,605 bytes)
- Research report (`RESEARCH-additional-app-opportunities.md`) identified 22 additional module ideas - no specs created for those (separate future project)
- Previously running agents from earlier sessions may have stopped mid-write. The file on disk is always the checkpoint - just verify with `wc -l` and resume from where the file left off
- Use `mode: bypassPermissions` when spawning agents to avoid permission prompts
- Use `run_in_background: true` for all agents to enable parallel execution

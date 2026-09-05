# [Product Name] - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** YYYY-MM-DD
> **Status:** Draft | In Review | Approved
> **Author:** [Name]
> **Reviewer:** [Name]

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** [Product Name] (e.g., MyBooks)
- **Tagline:** [One-line value prop] (e.g., "Track your reading life")
- **Module ID:** [module_id] (e.g., `books`)
- **Feature ID Prefix:** [XX] (e.g., `BK` for MyBooks, `BG` for MyBudget)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| [Persona 1] | [Age range, habits, tech comfort] | [What they want to accomplish] |
| [Persona 2] | [Age range, habits, tech comfort] | [What they want to accomplish] |

### 1.3 Core Value Proposition

[2-3 sentences describing why this product exists, what problem it solves, and what makes it different from alternatives.]

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| [Competitor 1] | [What they do well] | [Where they fall short] | [How we win] |
| [Competitor 2] | [What they do well] | [Where they fall short] | [How we win] |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

[Add any product-specific privacy notes here, e.g., "Book metadata is fetched from Open Library API but no user reading data is transmitted."]

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| XX-001 | [Feature Name] | P0 | Core | None | Not Started |
| XX-002 | [Feature Name] | P0 | Core | XX-001 | Not Started |
| XX-003 | [Feature Name] | P1 | Data Management | XX-001 | Not Started |
| XX-004 | [Feature Name] | P1 | Analytics | XX-001, XX-002 | Not Started |
| XX-005 | [Feature Name] | P2 | Import/Export | XX-001 | Not Started |
| XX-006 | [Feature Name] | P2 | Social | XX-001 | Not Started |
| XX-007 | [Feature Name] | P3 | Future | XX-001 | Not Started |

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

<!-- Repeat this entire Section 3 block for EVERY feature in the Feature Catalog. -->

### XX-001: [Feature Name]

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | XX-001 |
| **Feature Name** | [Clear, descriptive name] |
| **Priority** | P0 / P1 / P2 / P3 |
| **Category** | [Core / Data Management / Analytics / Import/Export / Social / Settings / Onboarding] |
| **Estimated Complexity** | Low / Medium / High |

#### 3.2 User Stories

**Primary:**
> As a [user persona], I want to [specific action], so that [concrete benefit].

**Secondary (if applicable):**
> As a [different persona], I want to [different action], so that [different benefit].

#### 3.3 Detailed Description

[2-5 paragraphs covering:]
- What this feature does from the user's perspective
- Why this feature matters (the problem it solves)
- How users interact with it (high-level flow)
- Context from competitive landscape if relevant (e.g., "Most reading apps limit ratings to 5 stars; this feature supports half-star ratings for more nuanced opinions")

#### 3.4 Prerequisites

**Feature Dependencies:**
- [XX-000]: [Feature Name] - [Why this dependency exists]
- [XX-000]: [Feature Name] - [Why this dependency exists]

**External Dependencies:**
- [e.g., "Camera/barcode scanning hardware for ISBN lookup"]
- [e.g., "Network access for fetching book metadata from Open Library API"]
- [e.g., "Local storage for SQLite database"]

**Assumed Capabilities:**
- [e.g., "User can navigate between screens via tab bar"]
- [e.g., "Local database is initialized and writable"]

#### 3.5 User Interface Requirements

##### Screen: [Screen Name]

**Layout:**
[Describe the screen layout in plain language. Be specific about what elements exist and where they are positioned relative to each other.]

Example format:
- The screen has a top navigation bar showing the screen title and an action button on the right
- Below the navigation bar is a search/filter bar with a text input and filter toggle buttons
- The main content area is a scrollable vertical list of items
- Each item in the list displays: [field 1], [field 2], [field 3] arranged as [layout description]
- Tapping an item navigates to the [Detail Screen]
- A floating action button in the bottom-right corner opens the [Add Item] modal

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items exist | [Describe empty state: illustration, message, call-to-action] |
| Loading | Data is being fetched/computed | [Describe loading indicator] |
| Populated | Items exist | [Describe normal populated view] |
| Error | Operation failed | [Describe error display and recovery action] |
| Search Active | User is filtering/searching | [Describe filtered view and "no results" sub-state] |

**Interactions:**
- [Tap action]: [What happens]
- [Long press action]: [What happens]
- [Swipe action]: [What happens]
- [Pull-to-refresh]: [What happens, if applicable]

**Transitions/Animations:**
- [e.g., "Items animate out when deleted with a fade + slide-left, 200ms duration"]
- [e.g., "New items animate in from the top of the list"]

##### Modal: [Modal Name] (if applicable)

[Same structure as Screen above, but for modals/dialogs/sheets]

#### 3.6 Data Requirements

##### Entity: [EntityName]

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | UUID/string | Primary key, auto-generated | Auto | Unique identifier |
| [field_name] | string | Required, max 255 chars | None | [What this field represents] |
| [field_name] | integer | Min: 0, Max: 100 | 0 | [What this field represents] |
| [field_name] | float | Min: 0.0, Max: 5.0, step: 0.5 | null | [What this field represents] |
| [field_name] | boolean | - | false | [What this field represents] |
| [field_name] | datetime | ISO 8601 | Current timestamp | [What this field represents] |
| [field_name] | enum | One of: [value1, value2, value3] | value1 | [What this field represents] |
| [foreign_key] | UUID/string | References [OtherEntity].id | None | [Relationship description] |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- [EntityName] has many [OtherEntity] (one-to-many via [foreign_key])
- [EntityName] belongs to [OtherEntity] (many-to-one via [foreign_key])
- [EntityName] has many [OtherEntity] through [JoinEntity] (many-to-many)

**Indexes:**
- [field_name] - [Reason, e.g., "frequently queried for filtering"]
- [field_name, field_name] - [Reason, e.g., "composite index for sorted listing"]

**Validation Rules:**
- [field_name]: [Rule, e.g., "Must not be empty string after trimming whitespace"]
- [field_name]: [Rule, e.g., "If status is 'completed', completed_date must not be null"]
- [Cross-field rule, e.g., "start_date must be before end_date"]

**Example Data:**

```
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "field_name": "Example value",
  "field_name": 42,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### [Rule/Algorithm Name]

**Purpose:** [What this rule accomplishes]

**Inputs:**
- [input_1]: [type] - [description]
- [input_2]: [type] - [description]

**Logic:**

```
1. [Step 1 in plain English or pseudocode]
2. [Step 2]
3. IF [condition] THEN
     [action]
   ELSE
     [alternative action]
4. RETURN [result]
```

**Formulas (if applicable):**
- [metric_name] = [formula in plain notation]
- Example: `reading_pace = total_pages_read / days_in_period`

**Edge Cases:**
- [Edge case 1]: [Expected behavior]
- [Edge case 2]: [Expected behavior]
- [Division by zero scenario]: [Expected behavior, e.g., "Display 'N/A' if denominator is 0"]

##### State Machine: [State Machine Name] (if applicable)

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| [state_1] | [event] | [state_2] | [e.g., "Set start_date to now"] |
| [state_2] | [event] | [state_3] | [e.g., "Set completed_date to now, recalculate stats"] |
| [state_2] | [event] | [state_1] | [e.g., "Clear start_date"] |

**Sort/Filter/Ranking Logic:**
- **Default sort:** [e.g., "Most recently updated first"]
- **Available sort options:** [List all sort options with tiebreaker rules]
- **Filter options:** [List all filter options with behavior when combined]
- **Search:** [What fields are searchable, matching behavior (prefix, substring, fuzzy)]

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| [e.g., "Database write fails"] | [e.g., "Toast notification: 'Could not save. Please try again.'"] | [e.g., "User taps retry or data is auto-retried on next save"] |
| [e.g., "Required field left blank"] | [e.g., "Inline validation message below the field: 'Title is required'"] | [e.g., "User fills in the field, error clears immediately"] |
| [e.g., "Import file is malformed"] | [e.g., "Error screen showing which rows failed with reasons"] | [e.g., "User fixes CSV and re-imports; partial imports are rolled back"] |
| [e.g., "Network request times out"] | [e.g., "Inline message: 'Could not connect. Check your connection.'"] | [e.g., "User taps retry button, or app retries automatically when network is restored"] |

**Validation Timing:**
- [e.g., "Field-level validation runs on blur (when the user leaves the field)"]
- [e.g., "Form-level validation runs on submit"]
- [e.g., "Cross-field validation (e.g., date range) runs on submit"]

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** [initial context/state],
   **When** [user action],
   **Then** [expected observable result].

2. **Given** [initial context/state],
   **When** [user action],
   **Then** [expected observable result].

3. **Given** [initial context/state],
   **When** [user action],
   **Then** [expected observable result].

**Edge Cases:**

4. **Given** [boundary condition],
   **When** [user action],
   **Then** [expected behavior at the boundary].

5. **Given** [unusual but valid state],
   **When** [user action],
   **Then** [expected graceful handling].

**Negative Tests:**

6. **Given** [precondition],
   **When** [invalid action or input],
   **Then** [the system rejects the input and shows: "[error message]"].
   **And** [no data is modified/corrupted].

7. **Given** [precondition],
   **When** [action that should be prevented],
   **Then** [nothing happens / action is blocked with explanation].

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| [e.g., "calculates reading pace correctly"] | pages_read: 300, days: 30 | pace: 10.0 pages/day |
| [e.g., "returns zero pace for zero days"] | pages_read: 100, days: 0 | pace: 0 (not infinity/NaN) |
| [e.g., "validates title is not empty"] | title: "  " (whitespace only) | validation error: "Title is required" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| [e.g., "Add item and verify it appears in list"] | 1. Open add form, 2. Fill fields, 3. Save, 4. Return to list | New item appears at the top of the list with correct field values |
| [e.g., "Delete item and verify stats update"] | 1. Note current stats, 2. Delete an item, 3. Check stats | Stats recalculate to reflect the removal |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| [e.g., "New user adds their first book"] | 1. Open app (empty state), 2. Tap add, 3. Search for book, 4. Select result, 5. Set status to "reading", 6. Save | Dashboard shows 1 book currently reading, library shows 1 item, empty state is gone |
| [e.g., "User imports data from competitor app"] | 1. Export CSV from competitor, 2. Open import screen, 3. Select file, 4. Review preview, 5. Confirm import | All valid rows are imported, stats reflect new data, invalid rows are reported |

---

<!--
REPEAT Section 3 for every feature in the Feature Catalog.
Copy the entire block from "### XX-001: [Feature Name]" through "#### 3.10 Test Specifications"
and fill in for each feature.
-->

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

[Describe the overall data model in plain language. How do the main entities relate to each other? What is the conceptual model?]

Example:
> The data model centers on [primary entity]. Each [primary entity] can have multiple [secondary entities]. Users organize [primary entities] into [grouping entity]. [Stats entity] aggregates data from [primary entities] by time period.

### 4.2 Complete Entity Definitions

<!-- List ALL entities for the entire product here, with full field definitions.
     This consolidates individual feature data requirements into one canonical reference. -->

#### Entity: [EntityName]

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | UUID/string | Primary key, auto-generated | Auto | Unique identifier |
| ... | ... | ... | ... | ... |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

[Repeat for each entity]

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| [Entity A] -> [Entity B] | one-to-many | [e.g., "A shelf contains many books"] |
| [Entity A] <-> [Entity C] | many-to-many | [e.g., "A book can have many tags, a tag can be on many books"] |
| [Entity A] -> [Entity D] | one-to-one | [e.g., "Each user has one settings record"] |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| [Entity] | [index_name] | [field1, field2] | [e.g., "Speed up sorted listing by date"] |

### 4.5 Table Prefix

**MyLife hub table prefix:** `[xx]_` (e.g., `bk_` for books)

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. Example: the `books` table becomes `bk_books`.

### 4.6 Migration Strategy

- [e.g., "Tables are created on module enable. Schema version is tracked in a module_migrations table."]
- [e.g., "Data from standalone app can be imported via the data importer (see feature XX-020)."]
- [e.g., "Destructive migrations (column removal) are deferred to major versions only."]

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| [Tab 1] | [Icon description] | [Screen Name] | [What this tab shows] |
| [Tab 2] | [Icon description] | [Screen Name] | [What this tab shows] |
| [Tab 3] | [Icon description] | [Screen Name] | [What this tab shows] |
| [Tab 4] | [Icon description] | [Screen Name] | [What this tab shows] |
| [Tab 5] | [Icon description] | [Screen Name] | [What this tab shows] |

### 5.2 Navigation Flow

```
[Tab 1: Home]
  └── [Detail Screen A]
        ├── [Edit Screen A]
        └── [Related List Screen]
              └── [Detail Screen B]

[Tab 2: Library]
  ├── [Filter/Sort Controls]
  └── [Detail Screen A] (same screen as Tab 1's detail)
        └── [Edit Screen A]

[Tab 3: Search]
  └── [Search Results]
        └── [Detail Screen A]

[Tab 4: Stats]
  ├── [Time Period Selector]
  └── [Detailed Stats Screen]

[Tab 5: Settings]
  ├── [Import/Export Screen]
  ├── [Appearance Screen]
  └── [About Screen]
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| [Screen Name] | [e.g., `/home`] | [What this screen does] | [How user gets here] |
| [Screen Name] | [e.g., `/library`] | [What this screen does] | [How user gets here] |
| [Screen Name] | [e.g., `/item/:id`] | [What this screen does] | [How user gets here] |
| [Screen Name] | [e.g., `/item/:id/edit`] | [What this screen does] | [How user gets here] |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| [e.g., `mylife://books/item/:id`] | [Detail Screen] | id: UUID of the item |
| [e.g., `mylife://books/add`] | [Add Screen] | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| [e.g., "Reading time to habits"] | Books | Habits | Books sends daily reading minutes | On reading session end |
| [e.g., "Budget category for subscriptions"] | Budget | Subscriptions | Budget provides spending category | On subscription creation |

[If this product has no cross-module integrations, state: "This module operates independently with no cross-module data flows in the current version."]

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| [e.g., "User library data"] | Local SQLite | At rest (OS-level) | No | Never leaves device |
| [e.g., "Book metadata cache"] | Local SQLite | No | No | Fetched from public API, cached locally |
| [e.g., "User preferences"] | Local SQLite | No | No | App settings and display preferences |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| [e.g., "Book search"] | Fetch metadata | Search query (title/ISBN) | Book metadata (title, author, cover URL) | Implicit (user initiates search) |

[If this product has zero network activity, state: "This module operates entirely offline. No network requests are made under any circumstances."]

### 7.3 Data That Never Leaves the Device

- [e.g., "Reading history and dates"]
- [e.g., "Personal ratings and reviews"]
- [e.g., "Notes and annotations"]
- [e.g., "Usage patterns and statistics"]

### 7.4 User Data Ownership

- **Export:** Users can export all their data in [formats, e.g., "CSV and JSON"]
- **Delete:** Users can delete all module data from Settings (irreversible, with confirmation dialog)
- **Portability:** Export format is documented and human-readable

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| [e.g., "App lock"] | [e.g., "Optional biometric/PIN lock for the entire app"] | [e.g., "Configurable in Settings"] |
| [e.g., "Sensitive data display"] | [e.g., "Financial data is masked by default, tap to reveal"] | [e.g., "Only for budget module"] |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| [Term] | [Clear, concise definition as used in this product] |
| [Term] | [Clear, concise definition as used in this product] |
| [Term] | [Clear, concise definition as used in this product] |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | YYYY-MM-DD | [Name] | Initial specification |

---

## Appendix B: Open Questions

<!-- Track unresolved design decisions here. Move to the relevant feature section once resolved. -->

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | [Question] | [Why this matters] | [Answer, once decided] | [Date] |

---

<!--
=============================================================================
TEMPLATE USAGE NOTES (delete this section when writing an actual spec)
=============================================================================

1. Copy this entire file and rename it: [APP-PREFIX]-spec.md (e.g., BK-spec.md)

2. Replace all bracketed placeholders [like this] with actual content.

3. Replace "XX" in feature IDs with the app's prefix (e.g., BK for MyBooks).

4. For the Feature Catalog (Section 2), list ALL features first, then write
   detailed specs (Section 3) for each one.

5. Section 3 is repeated for every feature. Copy the entire block from
   "### XX-001:" through "#### 3.10 Test Specifications" for each feature.

6. The Data Architecture (Section 4) consolidates all entities from individual
   feature specs into one canonical reference. If an entity was introduced in
   feature XX-003, it still appears in Section 4 with the full definition.

7. Keep these principles in mind:
   - STACK-AGNOSTIC: Describe behavior, not implementation. Say "a scrollable
     list" not "a FlatList". Say "persistent local storage" not "SQLite".
   - TESTABLE: Every feature has acceptance criteria specific enough to write
     automated tests from.
   - COMPLETE: A developer reading this spec should not need to ask any
     clarifying questions to build the feature.
   - CONCRETE: Use specific numbers, not vague terms. "Up to 500 items" not
     "many items". "3-second timeout" not "a reasonable timeout".

8. Style rules:
   - Write in present tense ("The system displays..." not "will display...")
   - Do not use em dashes - use " - " or rephrase
   - Define domain terms in the Glossary (Section 8)
   - Number features sequentially: XX-001, XX-002, XX-003...
   - Include concrete example data in Data Requirements sections
=============================================================================
-->

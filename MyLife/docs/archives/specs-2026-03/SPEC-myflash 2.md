# MyFlash - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-myflash agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyFlash
- **Tagline:** Master anything with spaced repetition
- **Module ID:** `flash`
- **Feature ID Prefix:** `FL`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Medical Student | Ages 20-30, studying anatomy/pharmacology, studies 2-4 hours daily with flashcards | Efficient memorization of massive card volumes, image occlusion for anatomy, reliable scheduling algorithm |
| Language Learner | Ages 18-45, self-studying a foreign language, uses flashcards for vocabulary | Audio card support, cloze deletions for grammar, daily streak motivation, import community decks |
| Anki Power User | Ages 20-40, experienced with spaced repetition, frustrated by Anki's dated mobile UI | Modern mobile-first interface, FSRS algorithm, full Anki deck import/export, custom templates |
| Casual Learner | Ages 16-35, studying for certifications or school exams, uses flashcards intermittently | Simple card creation, AI-generated cards from notes, study reminders, progress tracking |
| Privacy-Conscious Student | Any age, studying sensitive material (bar exam, medical boards, immigration prep) | Zero telemetry, all data on-device, no study behavior tracking, full data ownership |

### 1.3 Core Value Proposition

MyFlash is a privacy-first flashcard and spaced repetition app that combines the algorithmic power of Anki with a modern mobile-first experience. It uses the FSRS (Free Spaced Repetition Scheduler) algorithm, the state-of-the-art open-source scheduling system that requires 20-30% fewer reviews than Anki's legacy SM-2 to achieve the same retention. Users can import their entire Anki deck library on day one via .apkg import, create rich cards with images, audio, and cloze deletions, and study with confidence that their learning data never leaves their device. MyFlash replaces Anki ($25 iOS one-time), Quizlet ($36/yr), and the learning portions of Duolingo ($84/yr) with a single privacy-respecting app.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Anki | Gold-standard FSRS algorithm, massive shared deck library, fully open source, $0 desktop | $25 iOS app, dated mobile UI, steep learning curve, intimidating settings | Modern mobile-first UI with same FSRS algorithm, full .apkg compatibility, zero learning curve for basic use |
| Quizlet | Clean UI, AI-powered Magic Notes, large shared deck library, match game mode | $36/yr subscription, tracks study behavior for ads, no true SRS algorithm, cloud-dependent | True spaced repetition (FSRS), privacy-first, offline-first, one-time purchase |
| Duolingo | Best-in-class gamification (streaks, leagues, XP), AI conversation practice | $84/yr, limited to language learning, heavy data collection, no custom content | General-purpose (any subject), custom card creation, Duolingo-style gamification without the data harvesting |
| RemNote | Combined note-taking and flashcards, FSRS support, knowledge graph | Cloud-only, subscription model, complex interface | Simpler focused experience, offline-first, no account required |
| Mochi | Markdown-based cards, clean design, SRS scheduling | Small community, limited sharing, desktop-focused | Mobile-first, larger feature set, Anki compatibility, community decks |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (.apkg, JSON, CSV) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export or opts into shared decks
- The FSRS spaced repetition algorithm runs entirely on-device with no cloud computation
- AI card generation is opt-in and clearly labeled when it requires network access; on-device generation is preferred where hardware supports it
- Study patterns (what you study, when, how well you perform) are never transmitted. This protects users studying sensitive material: medical boards, legal exams, immigration language prep, or career pivots
- Shared deck participation is entirely opt-in with no tracking of download history or study behavior
- Community deck browsing does not require an account or transmit user identity

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| FL-001 | Flashcard Creation | P0 | Core | None | Not Started |
| FL-002 | Card Types (Basic, Reversed) | P0 | Core | FL-001 | Not Started |
| FL-003 | Deck Organization | P0 | Data Management | FL-001 | Not Started |
| FL-004 | FSRS Spaced Repetition Engine | P0 | Core | FL-001 | Not Started |
| FL-005 | Study Session with Review Queue | P0 | Core | FL-003, FL-004 | Not Started |
| FL-006 | Anki .apkg Import | P0 | Import/Export | FL-001, FL-003 | Not Started |
| FL-007 | Study Statistics | P0 | Analytics | FL-004, FL-005 | Not Started |
| FL-008 | Cloze Deletions | P1 | Core | FL-001, FL-002 | Not Started |
| FL-009 | Rich Media Cards | P1 | Core | FL-001 | Not Started |
| FL-010 | Image Occlusion | P1 | Core | FL-001, FL-009 | Not Started |
| FL-011 | Custom Card Templates | P1 | Core | FL-001, FL-002 | Not Started |
| FL-012 | Tag-Based Organization | P1 | Data Management | FL-001, FL-003 | Not Started |
| FL-013 | Card Browser | P1 | Data Management | FL-001, FL-003, FL-012 | Not Started |
| FL-014 | Streak Tracking | P1 | Analytics | FL-005, FL-007 | Not Started |
| FL-015 | Daily Review Reminders | P1 | Settings | FL-005, FL-014 | Not Started |
| FL-016 | Markdown Support in Cards | P1 | Core | FL-001 | Not Started |
| FL-017 | Suspend and Bury Cards | P1 | Core | FL-004, FL-005 | Not Started |
| FL-018 | Undo Last Review | P1 | Core | FL-005 | Not Started |
| FL-019 | Study Session Options | P1 | Core | FL-005 | Not Started |
| FL-020 | AI Card Generation from Text | P1 | Core | FL-001, FL-003 | Not Started |
| FL-021 | Shared Deck Browser | P1 | Social | FL-003, FL-006 | Not Started |
| FL-022 | Anki .apkg Export | P2 | Import/Export | FL-001, FL-003 | Not Started |
| FL-023 | AI Practice Tests | P2 | Core | FL-001, FL-003 | Not Started |
| FL-024 | Match Game Mode | P2 | Core | FL-001, FL-003 | Not Started |
| FL-025 | Competitive Leagues | P2 | Social | FL-005, FL-014 | Not Started |
| FL-026 | Settings and Preferences | P0 | Settings | None | Not Started |
| FL-027 | Onboarding and First-Run | P1 | Onboarding | FL-001, FL-003 | Not Started |

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

### FL-001: Flashcard Creation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-001 |
| **Feature Name** | Flashcard Creation |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student, I want to create flashcards with text on the front and back, so that I can study and memorize information using active recall.

**Secondary:**
> As a power user, I want to add images, audio, and formatted text to my cards, so that I can create rich, multi-sensory study materials.

#### 3.3 Detailed Description

Flashcard Creation is the foundational feature of MyFlash. It provides the ability to create, edit, and delete individual flashcards within decks. Each card has a front face (the prompt/question) and a back face (the answer/response). Both faces support plain text at minimum, with rich content (images, audio, formatted text) available when FL-009 Rich Media Cards is enabled.

Cards are always created within a deck (FL-003). If no deck exists, the user is prompted to create one first. The card creation flow is a modal or dedicated screen with two text input areas (front and back), a card type selector (Basic or Basic Reversed, with Cloze available when FL-008 is enabled), and a save button. Users can create multiple cards in sequence without leaving the creation screen by tapping "Save and Add Another."

Each card stores creation metadata including timestamps, the deck it belongs to, its card type, and an optional set of tags. Cards are assigned the "New" state upon creation and enter the FSRS scheduling system when the user begins a study session.

The card editor supports inline preview, allowing users to flip between editing and previewing the rendered card face. For cards with Markdown content (FL-016), the preview renders the formatted output.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- File system access for media attachments (images, audio)

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Card Creation

**Layout:**
- The screen has a top navigation bar with "Cancel" on the left and "Save" on the right
- Below the nav bar is a card type selector (segmented control: Basic | Reversed | Cloze)
- Below the type selector is a deck selector showing the current target deck name; tapping opens a deck picker
- The main area contains two large text input fields, labeled "Front" and "Back," each expanding vertically as content grows
- Between the two fields is a divider line with a flip icon button that swaps front and back content
- Below the back field is an optional tags input (comma-separated or chip-based)
- Below tags is a toolbar with formatting buttons (bold, italic, image, audio, Markdown toggle)
- At the bottom is a "Save" button and a "Save & Add Another" button side by side
- A preview toggle in the top-right area lets users flip between edit mode and rendered preview

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Card creation opened fresh | Both fields empty with placeholder text "Enter front side..." and "Enter back side..." |
| Editing | User has entered content in at least one field | Save buttons become active; unsaved indicator appears |
| Preview | User tapped preview toggle | Rendered card view showing front, tap to flip to back; edit button to return |
| Saving | Save in progress | Brief loading indicator on save button, fields remain visible |
| Validation Error | Front field is empty on save attempt | Red border on front field, inline message "Front side is required" |

**Interactions:**
- Tap "Save": Validates card (front must not be empty), saves to database, returns to deck view
- Tap "Save & Add Another": Validates and saves card, clears both fields, increments a "Cards created: N" counter at the top, keeps deck selection
- Tap "Cancel": If unsaved changes exist, shows confirmation dialog "Discard this card?"; otherwise navigates back
- Tap flip icon: Swaps content of front and back fields
- Tap deck selector: Opens deck picker modal (scrollable list of all decks with search)
- Tap preview toggle: Switches between edit view and rendered card preview
- Long press on text field: Standard text selection with copy/paste

**Transitions/Animations:**
- Card type selector animates segment change with 150ms slide
- Save confirmation shows a brief checkmark animation (300ms) before clearing fields on "Save & Add Another"
- Preview toggle cross-fades between edit and preview modes (200ms)

##### Modal: Deck Picker

**Layout:**
- Full-height modal with search bar at top
- Scrollable list of all decks, showing deck name and card count
- Nested decks are indented with a tree indicator
- "Create New Deck" option at the bottom of the list

**Interactions:**
- Tap deck: Selects deck, dismisses modal, updates deck selector on creation screen
- Tap "Create New Deck": Inline text field appears at bottom for new deck name; save creates deck and selects it
- Type in search: Filters deck list in real-time (substring match on deck name)

#### 3.6 Data Requirements

##### Entity: Card

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique card identifier |
| note_id | string | Foreign key to Note.id, required | None | Parent note this card belongs to |
| deck_id | string | Foreign key to Deck.id, required | None | Deck this card lives in |
| ordinal | integer | Min: 0 | 0 | Template ordinal (0 for basic, 0/1 for reversed, 0..N for cloze) |
| card_type | enum | One of: basic, reversed, cloze | basic | Determines how note fields map to front/back |
| state | enum | One of: new, learning, review, relearning | new | Current FSRS scheduling state |
| queue | enum | One of: new, learning, review, suspended, buried | new | Current queue assignment |
| due | datetime | Nullable | null | Next review due date (null for new cards not yet studied) |
| stability | float | Min: 0.0 | 0.0 | FSRS stability parameter (S) in days |
| difficulty | float | Min: 1.0, Max: 10.0 | 0.0 | FSRS difficulty parameter (D); 0 means uninitialized |
| interval_days | integer | Min: 0 | 0 | Current interval in days |
| reps | integer | Min: 0 | 0 | Total number of reviews |
| lapses | integer | Min: 0 | 0 | Number of times card went from correct to incorrect |
| last_review | datetime | Nullable | null | Timestamp of most recent review |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: Note

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique note identifier |
| model_id | string | Foreign key to NoteModel.id, required | None | Note type/model defining fields and templates |
| fields | text | JSON array of strings, required | "[]" | Field values in order defined by the model |
| tags | text | Space-separated tag strings | "" | Tags applied to this note (inherited by all cards) |
| checksum | integer | First 8 digits of SHA1 of first field | Auto-computed | Duplicate detection hash |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Note has many Cards (one-to-many via card.note_id; one card per template ordinal)
- Note belongs to NoteModel (many-to-one via note.model_id)
- Card belongs to Deck (many-to-one via card.deck_id)
- Card belongs to Note (many-to-one via card.note_id)

**Indexes:**
- Card: (deck_id, queue, due) - primary scheduling query
- Card: (note_id) - find all cards for a note
- Note: (checksum) - duplicate detection
- Note: (model_id) - find all notes of a type

**Validation Rules:**
- Note.fields: First field (sort field) must not be empty after trimming whitespace
- Card.deck_id: Must reference an existing deck
- Card.note_id: Must reference an existing note
- Card.ordinal: Must be unique within the same note_id

**Example Data:**

```json
{
  "note": {
    "id": "n-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "model_id": "m-basic-default",
    "fields": ["What is the capital of France?", "Paris"],
    "tags": "geography europe",
    "checksum": 28374651,
    "created_at": "2026-03-06T10:30:00Z",
    "updated_at": "2026-03-06T10:30:00Z"
  },
  "card": {
    "id": "c-f1e2d3c4-b5a6-0987-dcba-0987654321fe",
    "note_id": "n-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "deck_id": "d-11223344-5566-7788-99aa-bbccddeeff00",
    "ordinal": 0,
    "card_type": "basic",
    "state": "new",
    "queue": "new",
    "due": null,
    "stability": 0.0,
    "difficulty": 0.0,
    "interval_days": 0,
    "reps": 0,
    "lapses": 0,
    "last_review": null,
    "created_at": "2026-03-06T10:30:00Z",
    "updated_at": "2026-03-06T10:30:00Z"
  }
}
```

#### 3.7 Business Logic Rules

##### Card Creation from Note

**Purpose:** Generate the correct number of cards from a note based on its model and card type.

**Inputs:**
- note: Note - the newly created or edited note
- model: NoteModel - the model defining templates and card type

**Logic:**

```
1. IF model.type == "basic":
     Create 1 card with ordinal=0, card_type="basic"
2. ELSE IF model.type == "reversed":
     Create 2 cards:
       - ordinal=0, card_type="basic" (front -> back)
       - ordinal=1, card_type="reversed" (back -> front)
3. ELSE IF model.type == "cloze":
     Parse note.fields[0] for cloze markers {{c1::...}}, {{c2::...}}, etc.
     Count unique cloze numbers (N)
     Create N cards, one per cloze number, ordinal = cloze_number - 1
4. All new cards get state="new", queue="new", due=null
5. Compute note.checksum = first_8_digits(SHA1(note.fields[0]))
6. Check for duplicates: if another note in the same deck has the same checksum AND same first field, warn user but allow save
```

**Edge Cases:**
- Empty back field on basic card: Allowed (user may add content later)
- Cloze card with no cloze markers: Validation error, at least one {{c1::...}} required
- Reversed card where front equals back: Warn user but allow save
- Note with no model: Cannot occur, model is required on creation

##### Duplicate Detection

**Purpose:** Warn users when creating a card that may duplicate existing content.

**Inputs:**
- first_field: string - the content of the note's first field
- deck_id: string - the target deck

**Logic:**

```
1. Compute checksum = parseInt(SHA1(trimmed_first_field).substring(0, 8), 16)
2. Query all notes where checksum matches AND deck_id matches
3. For each match, compare first field content exactly (checksum is a fast filter, not exact)
4. IF exact match found:
     Show warning banner: "A similar card already exists in this deck"
     Display the existing card's front content
     Offer "Add Anyway" and "Go to Existing" buttons
5. ELSE:
     No warning, proceed normally
```

**Edge Cases:**
- Same content in different decks: No warning (intentional cross-deck duplication is valid)
- Whitespace-only differences: Trim and normalize whitespace before comparison

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Front field empty on save | Red border on front field, inline message "Front side is required" | User fills in front field, error clears on input |
| Database write fails | Toast: "Could not save card. Please try again." | User taps save again; if persistent, app suggests restarting |
| Deck no longer exists (deleted between open and save) | Alert: "This deck was deleted. Choose another deck." | Deck picker opens automatically |
| Media file too large (>50MB) | Inline message below media button: "File exceeds 50MB limit" | User selects a smaller file |
| Cloze card with no cloze markers | Inline message: "Cloze cards require at least one {{c1::...}} marker" | User adds cloze syntax or changes card type |

**Validation Timing:**
- Field-level validation runs on save attempt (not on blur, to avoid interrupting flow)
- Duplicate detection runs after first field loses focus (background check)
- Card type validation runs on save attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the card creation screen with a deck selected,
   **When** they enter "Capital of France?" on the front, "Paris" on the back, and tap Save,
   **Then** the card is saved to the selected deck, a success indicator appears, and the user returns to the deck view where the new card appears in the card list.

2. **Given** the user is creating a card and taps "Save & Add Another,"
   **When** the card saves successfully,
   **Then** both fields clear, the card count increments, the deck selection persists, and focus returns to the front field.

3. **Given** the user taps the flip icon between front and back fields,
   **When** front contains "Question" and back contains "Answer,"
   **Then** front now contains "Answer" and back contains "Question."

**Edge Cases:**

4. **Given** a card with only a front field filled in (back is empty),
   **When** the user taps Save,
   **Then** the card saves successfully (empty back is allowed).

5. **Given** the user creates a reversed card type,
   **When** the card saves,
   **Then** two cards are created: one front-to-back (ordinal 0) and one back-to-front (ordinal 1).

**Negative Tests:**

6. **Given** the front field is empty or whitespace-only,
   **When** the user taps Save,
   **Then** the system rejects the save and shows "Front side is required."
   **And** no data is written to the database.

7. **Given** a duplicate card exists in the same deck,
   **When** the user enters matching front content,
   **Then** a warning appears but the user can choose "Add Anyway" to proceed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates basic card with correct fields | front: "Q", back: "A", type: basic | 1 card, ordinal 0, state "new" |
| creates reversed cards (two cards) | front: "Q", back: "A", type: reversed | 2 cards, ordinals 0 and 1 |
| rejects card with empty front | front: "", back: "A" | Validation error: "Front side is required" |
| computes checksum from first field | field: "Capital of France?" | Consistent integer from SHA1 first 8 digits |
| detects duplicate by checksum and exact match | Existing card with same first field in same deck | Duplicate warning returned |
| allows duplicate across different decks | Same first field in different deck | No warning |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create card and verify in deck | 1. Open deck, 2. Tap add card, 3. Fill fields, 4. Save | Card appears in deck card list with correct content |
| Save & Add Another flow | 1. Create card, 2. Tap Save & Add Another, 3. Create second card, 4. Save | Both cards exist in deck, counter shows 2 |
| Cancel with unsaved changes | 1. Enter text in front, 2. Tap Cancel | Confirmation dialog appears; dismissing discards card |

---

### FL-002: Card Types (Basic, Reversed)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-002 |
| **Feature Name** | Card Types (Basic, Reversed) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a language learner, I want to create a card that automatically generates both a forward (English to Spanish) and reverse (Spanish to English) version, so that I can test recognition in both directions without creating two separate cards.

**Secondary:**
> As a student, I want to choose the card type when creating cards, so that I get the right study behavior for each piece of information.

#### 3.3 Detailed Description

Card Types define how a note's fields map to the front and back of presented cards during study. The two foundational types are Basic (front to back only) and Basic Reversed (automatically generates both front-to-back and back-to-front cards from the same note). This means a single note with "dog" on the front and "perro" on the back produces one card for Basic type and two cards for Reversed type.

The card type is set at note creation time via the type selector on the card creation screen. Changing a note's type after creation regenerates its cards: switching from Basic to Reversed adds the reverse card; switching from Reversed to Basic deletes the reverse card (with confirmation if it has review history).

Card types are implemented through NoteModel definitions. Each NoteModel specifies fields (what data the note stores) and templates (how fields map to card faces). The Basic model has one template: `{{Front}}` on the question side, `{{Back}}` on the answer side. The Reversed model has two templates: template 0 is identical to Basic, and template 1 swaps them: `{{Back}}` on the question side, `{{Front}}` on the answer side.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist before types can be applied

**External Dependencies:**
- None

**Assumed Capabilities:**
- Card creation UI is functional
- NoteModel system is initialized with default models

#### 3.5 User Interface Requirements

##### Screen: Card Type Selector (embedded in Card Creation)

**Layout:**
- Segmented control at the top of the card creation screen
- Three segments: "Basic" | "Reversed" | "Cloze" (Cloze grayed out until FL-008)
- Below the selector, a small help text explains the selected type:
  - Basic: "Tests front to back only"
  - Reversed: "Creates two cards: front to back AND back to front"
  - Cloze: "Fill-in-the-blank cards" (grayed out if FL-008 not enabled)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Basic Selected | Default or user selected Basic | "Basic" segment highlighted, help text shows one-direction description |
| Reversed Selected | User selected Reversed | "Reversed" segment highlighted, help text shows two-direction description, small "2 cards" badge |
| Cloze Selected | User selected Cloze (FL-008 enabled) | "Cloze" segment highlighted, front field changes to single field with cloze syntax helper |
| Cloze Disabled | FL-008 not yet implemented | "Cloze" segment grayed out, not tappable |

**Interactions:**
- Tap segment: Switches card type, updates help text and creation form layout
- Switching from Reversed to Basic while editing: No data loss (fields remain, only generation count changes)
- Switching to Cloze: Front and back fields merge into a single content field with cloze syntax toolbar

#### 3.6 Data Requirements

##### Entity: NoteModel

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto-generated | Unique model identifier |
| name | string | Required, max 100 chars | None | Display name (e.g., "Basic", "Basic (Reversed)") |
| type | enum | One of: standard, cloze | standard | Model type; cloze models use special rendering |
| fields | text | JSON array of field definitions | See defaults | Ordered list of field names and configs |
| templates | text | JSON array of template definitions | See defaults | Card templates defining front/back rendering |
| css | text | Optional | "" | Shared CSS applied to all cards of this model |
| sort_field_index | integer | Min: 0 | 0 | Which field index to use for sorting |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Default NoteModels:**

```json
[
  {
    "id": "m-basic-default",
    "name": "Basic",
    "type": "standard",
    "fields": [
      {"name": "Front", "ordinal": 0},
      {"name": "Back", "ordinal": 1}
    ],
    "templates": [
      {
        "name": "Card 1",
        "ordinal": 0,
        "front_format": "{{Front}}",
        "back_format": "{{FrontSide}}<hr id=\"answer\">{{Back}}"
      }
    ],
    "css": ".card { font-family: system-ui; font-size: 18px; text-align: center; }",
    "sort_field_index": 0
  },
  {
    "id": "m-reversed-default",
    "name": "Basic (Reversed)",
    "type": "standard",
    "fields": [
      {"name": "Front", "ordinal": 0},
      {"name": "Back", "ordinal": 1}
    ],
    "templates": [
      {
        "name": "Card 1",
        "ordinal": 0,
        "front_format": "{{Front}}",
        "back_format": "{{FrontSide}}<hr id=\"answer\">{{Back}}"
      },
      {
        "name": "Card 2",
        "ordinal": 1,
        "front_format": "{{Back}}",
        "back_format": "{{FrontSide}}<hr id=\"answer\">{{Front}}"
      }
    ],
    "css": ".card { font-family: system-ui; font-size: 18px; text-align: center; }",
    "sort_field_index": 0
  }
]
```

**Relationships:**
- NoteModel has many Notes (one-to-many via note.model_id)
- NoteModel has many Templates (embedded in JSON, not a separate table)

#### 3.7 Business Logic Rules

##### Card Generation from Model Templates

**Purpose:** Determine how many cards to create and how to render each card from a note's fields.

**Inputs:**
- note: Note - the note with field values
- model: NoteModel - the model with templates

**Logic:**

```
1. FOR EACH template in model.templates:
     a. Create a card with ordinal = template.ordinal
     b. To render the front: replace {{FieldName}} placeholders in template.front_format
        with corresponding values from note.fields
     c. To render the back: replace {{FieldName}} placeholders in template.back_format
        with corresponding values from note.fields
     d. Special placeholder {{FrontSide}} renders the entire front content
2. Cards with empty front after rendering are not created (skip template if result is blank)
3. For reversed models, both cards share the same note and same scheduling independence
   (each card has its own stability, difficulty, interval, and review history)
```

**Edge Cases:**
- Template references a field that does not exist in the note: Render as empty string
- Both cards of a reversed pair are scheduled independently (forgetting one does not affect the other)
- User deletes one card of a reversed pair: The other card persists; the note remains valid

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Model not found for note | Alert: "Card type configuration is missing. Resetting to Basic." | Reset note to Basic model, recreate cards |
| Template rendering produces empty front | Card is silently not created; if all templates produce empty, validation error on save | User adds content to the required field |
| Switching type deletes card with review history | Confirmation: "The reverse card has 47 reviews. Deleting it will lose this history. Continue?" | User confirms or cancels type change |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects "Basic" card type and fills in front and back,
   **When** they save,
   **Then** exactly 1 card is created with ordinal 0.

2. **Given** the user selects "Reversed" card type and fills in front and back,
   **When** they save,
   **Then** exactly 2 cards are created: ordinal 0 (front-to-back) and ordinal 1 (back-to-front).

3. **Given** the user studies a reversed pair,
   **When** they rate the forward card "Easy" but the reverse card "Again,"
   **Then** each card's scheduling state updates independently.

**Edge Cases:**

4. **Given** a reversed card where the back field is empty,
   **When** the note saves,
   **Then** only the forward card (ordinal 0) is created; the reverse card with empty front is skipped.

**Negative Tests:**

5. **Given** the user tries to switch a reversed note to basic,
   **When** the reverse card has review history,
   **Then** a confirmation dialog warns about losing review history before proceeding.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| basic model generates 1 card | Note with Basic model | 1 card, ordinal 0 |
| reversed model generates 2 cards | Note with Reversed model | 2 cards, ordinals 0 and 1 |
| reversed card with empty back skips reverse | Note with empty Back field, Reversed model | 1 card only (ordinal 0) |
| template rendering substitutes fields | Template "{{Front}}", field value "Hello" | Rendered text "Hello" |
| FrontSide placeholder renders full front | Back template "{{FrontSide}}<hr>{{Back}}" | Front content followed by separator and back content |

---

### FL-003: Deck Organization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-003 |
| **Feature Name** | Deck Organization |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student studying multiple subjects, I want to organize my flashcards into separate decks, so that I can study one topic at a time or combine them as needed.

**Secondary:**
> As a power user, I want to nest decks within parent decks (e.g., "Biology::Anatomy::Muscles"), so that I can create a hierarchical organization that mirrors my course structure.

#### 3.3 Detailed Description

Deck Organization provides the hierarchical container system for flashcards. Decks are the primary organizational unit, analogous to folders. Users create, rename, reorder, and delete decks. Decks can be nested to arbitrary depth using a path separator ("::"), following Anki's convention. For example, "Languages::Spanish::Vocabulary" creates a three-level hierarchy.

The Deck Browser is the main screen showing all decks in a tree view. Each deck row displays the deck name, total card count, new card count (blue), learning card count (orange), and due review count (green). Tapping a deck opens the deck detail screen showing all cards in that deck. Tapping the study button on a deck starts a study session (FL-005) for that deck.

Studying a parent deck includes all cards from all child decks. For example, studying "Languages" includes cards from "Languages::Spanish::Vocabulary" and "Languages::French::Grammar." Deck statistics aggregate across children.

Users can move cards between decks via the card browser (FL-013) or by long-pressing a card in the deck view and selecting "Move to Deck." Deleting a deck moves all its cards to a "Default" deck that always exists and cannot be deleted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist to populate decks

**External Dependencies:**
- None

**Assumed Capabilities:**
- Database is initialized with a "Default" deck

#### 3.5 User Interface Requirements

##### Screen: Deck Browser (Tab 1 - Home/Decks)

**Layout:**
- Top bar with "MyFlash" title on the left and a "+" (create deck) button on the right
- Below is a search bar for filtering decks by name
- Main content is a scrollable tree list of decks
- Each deck row shows: expand/collapse arrow (if has children), deck name, and three badge counts on the right side: new (blue), learning (orange), review (green)
- Nested decks are indented with tree lines
- At the bottom of the list is a summary bar: "Total: X new, Y learning, Z review"
- A floating "Study" button appears when any deck has due cards

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No decks except Default | Illustration of a card stack, message "Create your first deck to get started," prominent "Create Deck" button |
| Populated | Decks exist | Tree list of decks with card counts |
| All Caught Up | No cards due in any deck | All review counts show 0, celebratory message "All caught up! Come back later." |
| Search Active | User is typing in search bar | Deck list filters to matching names; "No matching decks" if none match |

**Interactions:**
- Tap deck row: Opens Deck Detail screen for that deck
- Tap expand arrow: Expands/collapses child decks with 200ms slide animation
- Tap "+": Opens Create Deck modal
- Long press deck: Shows context menu (Rename, Move, Delete, Export)
- Swipe left on deck: Reveals Delete button (red)
- Tap "Study" floating button: Starts study session for the deck with the most due cards
- Pull down: Refreshes due counts (recalculates based on current time)

**Transitions/Animations:**
- Deck expand/collapse: Child rows slide in/out with 200ms ease
- Deck deletion: Row fades out with 200ms animation after confirmation
- New deck creation: Row slides in at the correct sorted position

##### Screen: Deck Detail

**Layout:**
- Top bar with back arrow, deck name, and an overflow menu (three dots)
- Below the name is a stats summary bar: "X total cards | Y new | Z learning | W due"
- A prominent "Study Now" button (disabled if no new or due cards)
- Below is a card list showing all cards in this deck, each displaying the front text (truncated), card type badge, and state indicator (new/learning/review)
- Sorting options: by creation date, due date, alphabetical, or card state
- A "+" button to add a new card directly to this deck

**Interactions:**
- Tap "Study Now": Starts study session for this deck (FL-005)
- Tap card row: Opens card editor for that card
- Long press card: Context menu (Edit, Move to Deck, Suspend, Delete)
- Tap overflow menu: Rename Deck, Add Subdeck, Export Deck, Delete Deck
- Swipe left on card: Reveals Delete button

##### Modal: Create Deck

**Layout:**
- Compact modal with a text input for deck name
- Optional parent deck selector (dropdown, default "None / Top Level")
- "Create" and "Cancel" buttons

**Interactions:**
- Type deck name: Real-time validation (no empty names, no duplicate names at same level)
- Select parent: Creates deck as child of selected parent (name stored as "Parent::Child")
- Tap Create: Saves deck, dismisses modal, scrolls to new deck in list

#### 3.6 Data Requirements

##### Entity: Deck

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique deck identifier |
| name | string | Required, max 255 chars, unique full path | None | Full deck path (e.g., "Languages::Spanish::Vocabulary") |
| description | text | Optional, max 1000 chars | "" | User-provided deck description |
| parent_id | string | Nullable, foreign key to Deck.id | null | Parent deck for nesting (null = top-level) |
| position | integer | Min: 0 | 0 | Sort order within parent level |
| is_default | boolean | Only one deck can be true | false | Whether this is the undeletable default deck |
| collapsed | boolean | - | false | Whether children are collapsed in the tree view |
| new_cards_per_day | integer | Min: 0, Max: 9999 | 20 | Max new cards introduced per day for this deck |
| max_reviews_per_day | integer | Min: 0, Max: 9999 | 200 | Max review cards shown per day for this deck |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- Deck has many Cards (one-to-many via card.deck_id)
- Deck has many child Decks (self-referential one-to-many via deck.parent_id)
- Deck belongs to parent Deck (many-to-one via deck.parent_id, nullable)

**Indexes:**
- (parent_id, position) - sorted tree listing
- (name) - unique constraint, deck lookup by path
- (is_default) - quick lookup of default deck

**Validation Rules:**
- name: Must not be empty after trimming; must not contain only whitespace
- name: Full path must be unique (no two decks with the same full "Parent::Child" name)
- name: Individual segment must not contain "::" (the separator is reserved for nesting)
- is_default: Exactly one deck must have is_default=true at all times
- Deck cannot be its own parent (no circular references in the tree)

**Example Data:**

```json
{
  "id": "d-11223344-5566-7788-99aa-bbccddeeff00",
  "name": "Languages::Spanish::Vocabulary",
  "description": "Common Spanish vocabulary words",
  "parent_id": "d-aabbccdd-1122-3344-5566-778899001122",
  "position": 0,
  "is_default": false,
  "collapsed": false,
  "new_cards_per_day": 20,
  "max_reviews_per_day": 200,
  "created_at": "2026-03-06T09:00:00Z",
  "updated_at": "2026-03-06T09:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Deck Hierarchy Resolution

**Purpose:** Resolve the full deck tree and compute aggregate statistics for parent decks.

**Inputs:**
- deck_id: string - the deck to resolve

**Logic:**

```
1. Load the target deck
2. Recursively load all descendant decks (children, grandchildren, etc.)
3. For each deck (leaf and branch):
     a. Count cards in state="new" AND queue="new" -> new_count
     b. Count cards in state="learning" OR state="relearning" -> learning_count
     c. Count cards in state="review" AND due <= now -> review_count
4. For parent decks, aggregate: parent counts = own counts + sum(all descendant counts)
5. RETURN { new_count, learning_count, review_count, total_count }
```

**Edge Cases:**
- Deck with no cards: All counts are 0
- Deeply nested deck (10+ levels): Supported; recursion uses iterative tree traversal to avoid stack overflow
- Circular parent reference (data corruption): Detect during traversal, log error, treat as top-level

##### Deck Deletion

**Purpose:** Safely delete a deck while preserving its cards.

**Inputs:**
- deck_id: string - the deck to delete

**Logic:**

```
1. IF deck.is_default == true:
     REJECT with error "The default deck cannot be deleted"
2. Collect all cards in this deck AND all descendant decks
3. Move all collected cards to the Default deck (card.deck_id = default_deck.id)
4. Delete all descendant decks (bottom-up to respect foreign keys)
5. Delete the target deck
6. RETURN count of cards moved
```

**Edge Cases:**
- Deleting a parent deck with children: All children and their cards are processed
- Empty deck: Delete succeeds, 0 cards moved

##### Deck Name Parsing

**Purpose:** Parse deck path into segments for hierarchy display.

**Inputs:**
- name: string - full deck path (e.g., "Languages::Spanish::Vocabulary")

**Logic:**

```
1. Split name by "::" separator
2. Each segment is one level in the hierarchy
3. Creating "Languages::Spanish::Vocabulary" auto-creates parent decks
   "Languages" and "Languages::Spanish" if they do not already exist
4. Display the last segment as the deck's visible name in the tree
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate deck name at same level | Inline validation: "A deck with this name already exists" | User changes the name |
| Delete default deck attempt | Delete option is hidden/disabled for the default deck | N/A |
| Deck name contains only "::" separators | Validation error: "Deck name cannot be empty" | User enters a valid name |
| Circular parent reference detected | Alert: "Invalid deck structure detected. Resetting to top level." | Deck is moved to top level |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "+" on the deck browser,
   **When** they enter "Spanish Vocabulary" and tap Create,
   **Then** the deck appears in the deck list with 0 cards and default settings.

2. **Given** a deck named "Biology" exists,
   **When** the user creates a deck named "Biology::Anatomy,"
   **Then** "Anatomy" appears as a child of "Biology" in the tree view, and "Biology" gains an expand/collapse arrow.

3. **Given** a parent deck "Science" with children "Science::Biology" (10 cards due) and "Science::Chemistry" (5 cards due),
   **When** the user views "Science" in the deck browser,
   **Then** "Science" shows 15 review cards due (aggregated from children).

**Edge Cases:**

4. **Given** the user deletes a deck with 50 cards,
   **When** deletion completes,
   **Then** all 50 cards appear in the Default deck with their review history intact.

**Negative Tests:**

5. **Given** the user tries to delete the Default deck,
   **When** they look for a delete option,
   **Then** no delete option is available for the Default deck.

6. **Given** a deck named "Math" already exists at the top level,
   **When** the user tries to create another top-level deck named "Math,"
   **Then** inline validation shows "A deck with this name already exists."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses deck path into segments | "Languages::Spanish::Vocab" | ["Languages", "Spanish", "Vocab"] |
| aggregates child deck counts | Parent with 2 children (5 due, 3 due) | Parent shows 8 due |
| prevents default deck deletion | Delete default deck | Error: cannot delete default |
| auto-creates parent decks | Create "A::B::C" when A and A::B do not exist | 3 decks created in hierarchy |
| rejects duplicate deck name | Create "Math" when "Math" exists | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create nested deck and verify tree | 1. Create "Science::Biology", 2. Open deck browser | "Science" parent with "Biology" child displayed in tree |
| Delete deck preserves cards | 1. Add 10 cards to "Test Deck", 2. Delete "Test Deck" | All 10 cards in Default deck, review history intact |
| Study parent deck includes children | 1. Add cards to child decks, 2. Study parent | Cards from all children appear in study session |

---

### FL-004: FSRS Spaced Repetition Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-004 |
| **Feature Name** | FSRS Spaced Repetition Engine |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a student, I want the app to automatically schedule my flashcard reviews at optimal intervals, so that I retain the most information with the least amount of study time.

**Secondary:**
> As an Anki power user, I want the scheduling algorithm to use FSRS (the state-of-the-art spaced repetition scheduler), so that I get better retention with fewer reviews compared to SM-2.

#### 3.3 Detailed Description

The FSRS Spaced Repetition Engine is the core scheduling algorithm that determines when each card should be reviewed next. FSRS (Free Spaced Repetition Scheduler) is an open-source algorithm based on the DSR (Difficulty, Stability, Retrievability) memory model. It uses 19 optimizable parameters to model individual memory behavior and produces 20-30% fewer reviews than Anki's legacy SM-2 algorithm for the same retention level.

The engine tracks three memory state variables for each card:
- **Stability (S):** The number of days until retrievability drops to 90%. Higher stability means slower forgetting.
- **Difficulty (D):** A value from 1.0 to 10.0 representing how hard the card is to memorize. Higher difficulty means slower stability growth.
- **Retrievability (R):** The probability (0.0 to 1.0) that the user can recall the card right now. Decays over time according to a power-law forgetting curve.

After each review, the user rates their recall with one of four buttons:
- **Again (1):** Failed to recall. Card enters relearning.
- **Hard (2):** Recalled with significant difficulty. Stability grows slowly.
- **Good (3):** Recalled with normal effort. Standard stability growth.
- **Easy (4):** Recalled effortlessly. Stability grows rapidly.

The engine computes a new stability and difficulty based on the rating, then calculates the next review interval from the updated stability and the user's desired retention rate (default 90%).

Cards progress through four states: New (never studied), Learning (in initial learning steps), Review (graduated, on spaced intervals), and Relearning (lapsed from Review, going through learning steps again before returning to Review).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist to schedule

**External Dependencies:**
- None (algorithm runs entirely on-device)

**Assumed Capabilities:**
- Card entity has stability, difficulty, interval_days, state, and due fields
- System clock is available for scheduling calculations

#### 3.5 User Interface Requirements

The FSRS engine is primarily a background computation system. Its UI surfaces are:

##### Component: Rating Buttons (within Study Session screen, FL-005)

**Layout:**
- Four buttons displayed horizontally at the bottom of the study screen after the user reveals the answer
- Each button shows the rating label and the projected next interval:
  - "Again" (red) - shows learning step interval (e.g., "1m" or "<10m")
  - "Hard" (orange) - shows computed interval (e.g., "2d")
  - "Good" (blue) - shows computed interval (e.g., "5d")
  - "Easy" (green) - shows computed interval (e.g., "15d")
- Intervals are computed in real-time when the answer is revealed, based on the card's current state

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Hidden | Card front is showing (answer not yet revealed) | Rating buttons are not visible |
| Visible | Answer has been revealed | All four buttons displayed with projected intervals |
| Processing | User tapped a rating, scheduling in progress | Tapped button shows brief loading state (100ms), then next card appears |

**Interactions:**
- Tap any rating button: Records the review, updates card scheduling, advances to next card
- Buttons are large enough for comfortable thumb tapping (minimum 64pt height)
- No long-press or swipe interactions on rating buttons

#### 3.6 Data Requirements

##### Entity: ReviewLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique review log identifier |
| card_id | string | Foreign key to Card.id, required | None | Card that was reviewed |
| rating | integer | Min: 1, Max: 4 | None | User's rating (1=Again, 2=Hard, 3=Good, 4=Easy) |
| state_before | enum | One of: new, learning, review, relearning | None | Card state before this review |
| state_after | enum | One of: new, learning, review, relearning | None | Card state after this review |
| stability_before | float | Min: 0.0 | None | Stability before review |
| stability_after | float | Min: 0.0 | None | Stability after review |
| difficulty_before | float | Min: 1.0, Max: 10.0 | None | Difficulty before review |
| difficulty_after | float | Min: 1.0, Max: 10.0 | None | Difficulty after review |
| interval_days | integer | Min: 0 | None | Scheduled interval in days after this review |
| elapsed_days | integer | Min: 0 | None | Days since the previous review (0 for first review) |
| scheduled_days | integer | Min: 0 | None | Days that were scheduled at the previous review |
| review_duration_ms | integer | Min: 0 | None | Time in milliseconds from card shown to rating button pressed |
| reviewed_at | datetime | Auto-set | Current timestamp | When this review occurred |

**Relationships:**
- ReviewLog belongs to Card (many-to-one via review_log.card_id)

**Indexes:**
- (card_id, reviewed_at) - review history for a card in chronological order
- (reviewed_at) - daily statistics queries

##### Entity: FSRSParameters

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "fsrs-global" | Singleton or per-deck parameter set |
| desired_retention | float | Min: 0.70, Max: 0.97 | 0.90 | Target recall probability (90% default) |
| weights | text | JSON array of 19 floats | See defaults | FSRS-5 model weights w0 through w18 |
| learning_steps | text | JSON array of integers (minutes) | "[1, 10]" | Minutes between learning step reviews |
| relearning_steps | text | JSON array of integers (minutes) | "[10]" | Minutes between relearning step reviews |
| graduating_interval | integer | Min: 1 | 1 | Days for first review after graduating from learning |
| easy_interval | integer | Min: 1 | 4 | Days for first review after rating Easy on a new/learning card |
| maximum_interval | integer | Min: 1, Max: 36500 | 36500 | Maximum interval in days (100 years cap) |
| enable_fuzz | boolean | - | true | Whether to add jitter to intervals to prevent clustering |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Default FSRS-5 Weights:**

```json
[0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]
```

#### 3.7 Business Logic Rules

##### Card State Machine

**Purpose:** Define all valid card states and transitions between them.

**States:**
- **New:** Card has never been studied. Sits in the new queue awaiting its first presentation.
- **Learning:** Card is in the initial learning phase, going through learning steps (e.g., 1 minute, 10 minutes). Short intervals, reviewed within the same session.
- **Review:** Card has graduated from learning and is on a spaced repetition schedule (days/weeks/months between reviews).
- **Relearning:** Card was in Review state but the user rated "Again" (a lapse). Goes through relearning steps before returning to Review with a reduced stability.

| Current State | Rating | Next State | Side Effects |
|--------------|--------|------------|--------------|
| New | Again | Learning | Start at learning step 1; set initial S and D |
| New | Hard | Learning | Start at learning step 2 (or graduate if only 1 step); set initial S and D |
| New | Good | Learning | Graduate (move to last learning step or directly to Review if no steps); set initial S and D |
| New | Easy | Review | Skip all learning steps; interval = easy_interval; set initial S and D |
| Learning | Again | Learning | Reset to learning step 1 |
| Learning | Hard | Learning | Stay at current step (repeat it); increase step timer by 50% |
| Learning | Good | Learning/Review | Advance to next step; if was last step, graduate to Review |
| Learning | Easy | Review | Graduate immediately; interval = max(easy_interval, graduating_interval) |
| Review | Again | Relearning | Lapse: increment lapses; compute post-lapse stability; enter relearning step 1 |
| Review | Hard | Review | Compute new S with hard modifier; schedule next review |
| Review | Good | Review | Compute new S with standard growth; schedule next review |
| Review | Easy | Review | Compute new S with easy modifier; schedule next review |
| Relearning | Again | Relearning | Reset to relearning step 1 |
| Relearning | Hard | Relearning | Stay at current step |
| Relearning | Good | Relearning/Review | Advance to next step; if was last step, graduate back to Review |
| Relearning | Easy | Review | Graduate immediately back to Review |

##### FSRS-5 Algorithm: Initial Stability

**Purpose:** Set the initial stability value when a card is first reviewed.

**Inputs:**
- rating: integer (1-4) - the user's first rating

**Formula:**

```
S_0(G) = w[G-1]

Where:
  G = rating (1=Again, 2=Hard, 3=Good, 4=Easy)
  w[0] = 0.40255  (initial stability for Again)
  w[1] = 1.18385  (initial stability for Hard)
  w[2] = 3.173    (initial stability for Good)
  w[3] = 15.69105 (initial stability for Easy)

Result is stability in days.
```

##### FSRS-5 Algorithm: Initial Difficulty

**Purpose:** Set the initial difficulty value when a card is first reviewed.

**Inputs:**
- rating: integer (1-4) - the user's first rating

**Formula:**

```
D_0(G) = w[4] - exp(w[5] * (G - 1)) + 1

Where:
  w[4] = 7.1949
  w[5] = 0.5345
  G = rating (1-4)

Clamp result to range [1.0, 10.0].

Examples:
  D_0(1) = 7.1949 - exp(0.5345 * 0) + 1 = 7.1949 - 1 + 1 = 7.1949
  D_0(2) = 7.1949 - exp(0.5345 * 1) + 1 = 7.1949 - 1.7068 + 1 = 6.4881
  D_0(3) = 7.1949 - exp(0.5345 * 2) + 1 = 7.1949 - 2.9131 + 1 = 5.2818
  D_0(4) = 7.1949 - exp(0.5345 * 3) + 1 = 7.1949 - 4.9727 + 1 = 3.2222
```

##### FSRS-5 Algorithm: Retrievability (Forgetting Curve)

**Purpose:** Calculate the probability of successful recall after elapsed time.

**Inputs:**
- t: float - elapsed time in days since last review
- S: float - current stability in days

**Formula:**

```
R(t, S) = (1 + (19 * t) / (81 * S)) ^ (-0.5)

This is a power-law forgetting curve.
When t = S, R approximately equals 0.9 (90%).

Examples:
  R(1, 1) = (1 + 19/81) ^ -0.5 = (1.2346) ^ -0.5 = 0.9
  R(5, 10) = (1 + 95/810) ^ -0.5 = (1.1173) ^ -0.5 = 0.946
  R(30, 10) = (1 + 570/810) ^ -0.5 = (1.7037) ^ -0.5 = 0.766
```

##### FSRS-5 Algorithm: Difficulty Update

**Purpose:** Update card difficulty after a review, with mean reversion to prevent "difficulty hell."

**Inputs:**
- D: float - current difficulty
- G: integer (1-4) - rating

**Formula:**

```
1. Compute raw difficulty change:
   delta_D = -w[6] * (G - 3)
   Where w[6] = 1.4604

2. Apply linear damping (prevents difficulty from drifting too far):
   D_new = D + delta_D * ((10 - D) / 9)

3. Apply mean reversion toward D_0(4) (the easiest initial difficulty):
   D_final = w[7] * D_0(4) + (1 - w[7]) * D_new
   Where w[7] = 0.0046

4. Clamp D_final to [1.0, 10.0]

Mean reversion explanation: w[7] is very small (0.0046), so the effect is subtle.
It gently pulls extreme difficulties back toward the center over many reviews,
preventing cards from getting permanently stuck at difficulty 10.

Examples:
  Rating Again (G=1) on D=5.0:
    delta_D = -1.4604 * (1-3) = 2.9208
    D_new = 5.0 + 2.9208 * (5/9) = 5.0 + 1.6227 = 6.6227
    D_final = 0.0046 * 3.2222 + 0.9954 * 6.6227 = 6.607

  Rating Easy (G=4) on D=5.0:
    delta_D = -1.4604 * (4-3) = -1.4604
    D_new = 5.0 + (-1.4604) * (5/9) = 5.0 - 0.8113 = 4.1887
    D_final = 0.0046 * 3.2222 + 0.9954 * 4.1887 = 4.184
```

##### FSRS-5 Algorithm: Stability After Successful Recall

**Purpose:** Compute new stability when the user successfully recalls a card (rated Hard, Good, or Easy).

**Inputs:**
- D: float - current difficulty
- S: float - current stability
- R: float - current retrievability at time of review
- G: integer (2, 3, or 4) - rating (Hard, Good, or Easy)

**Formula:**

```
S'_r(D, S, R, G) = S * (exp(w[8]) * (11 - D) * S^(-w[9]) * (exp(w[10] * (1 - R)) - 1) * hard_modifier * easy_modifier + 1)

Where:
  w[8]  = 1.54575
  w[9]  = 0.1192
  w[10] = 1.01925
  hard_modifier = w[15] if G == 2, else 1.0    (w[15] = 0.2315)
  easy_modifier = w[16] if G == 4, else 1.0    (w[16] = 2.9898)

The inner expression (SInc - stability increase factor) is always >= 1,
ensuring stability never decreases on a successful recall.

Breakdown of factors:
  - exp(w[8]): Base growth rate (~4.69)
  - (11 - D): Higher difficulty = slower growth
  - S^(-w[9]): Longer current stability = slower growth (diminishing returns)
  - (exp(w[10]*(1-R)) - 1): Lower retrievability at review time = larger growth
    (spacing effect: longer delays between reviews reward more stability)
  - hard_modifier (0.2315): Hard rating grows stability much slower than Good
  - easy_modifier (2.9898): Easy rating grows stability about 3x faster than Good

Example (D=5.0, S=10.0, R=0.85, G=3 "Good"):
  SInc = exp(1.54575) * (11-5) * 10^(-0.1192) * (exp(1.01925*(1-0.85)) - 1) * 1 * 1
       = 4.692 * 6 * 0.760 * (exp(0.1529) - 1)
       = 4.692 * 6 * 0.760 * 0.1653
       = 3.539
  S'_r = 10.0 * (3.539 + 1) = 45.39 days
```

##### FSRS-5 Algorithm: Stability After Forgetting (Lapse)

**Purpose:** Compute new (reduced) stability when the user fails to recall a card (rated Again).

**Inputs:**
- D: float - current difficulty
- S: float - current stability before lapse
- R: float - current retrievability at time of review

**Formula:**

```
S'_f(D, S, R) = w[11] * D^(-w[12]) * ((S + 1)^w[13] - 1) * exp(w[14] * (1 - R))

Where:
  w[11] = 1.9395
  w[12] = 0.11
  w[13] = 0.29605
  w[14] = 2.2698

This gives a new (lower) stability after a lapse.

Breakdown:
  - w[11]: Base post-lapse stability scale
  - D^(-w[12]): Higher difficulty = lower post-lapse stability
  - (S+1)^w[13] - 1: Some memory of prior stability is preserved (not fully reset)
  - exp(w[14]*(1-R)): Lower retrievability at lapse = slightly higher post-lapse stability
    (overdue cards that are forgotten get slightly more credit)

Example (D=5.0, S=30.0, R=0.7):
  S'_f = 1.9395 * 5.0^(-0.11) * (31^0.29605 - 1) * exp(2.2698 * 0.3)
       = 1.9395 * 0.8395 * (2.842 - 1) * exp(0.6809)
       = 1.9395 * 0.8395 * 1.842 * 1.9757
       = 5.93 days

Post-lapse stability is always much lower than pre-lapse stability,
but not reset to zero. Prior learning is partially preserved.
```

##### FSRS-5 Algorithm: Interval Calculation

**Purpose:** Convert stability and desired retention into a concrete review interval in days.

**Inputs:**
- S: float - post-review stability
- desired_retention: float - target recall probability (default 0.9)

**Formula:**

```
I(S, r) = (S / (19/81)) * (r^(-2) - 1)
        = (81 * S / 19) * (r^(-2) - 1)

Where:
  S = stability in days
  r = desired_retention (default 0.9)

For the default desired_retention of 0.9:
  I = (81 * S / 19) * (0.9^(-2) - 1)
    = (81 * S / 19) * (1.2346 - 1)
    = (81 * S / 19) * 0.2346
    = S * 1.0

This confirms: when desired_retention = 0.9, the interval approximately equals
the stability (by design, since S is defined as the time for R to drop to 90%).

For desired_retention of 0.85 (more aggressive spacing):
  I = (81 * S / 19) * (0.85^(-2) - 1)
    = S * (81/19) * (1.3841 - 1)
    = S * 4.263 * 0.3841
    = S * 1.637

For desired_retention of 0.95 (more conservative):
  I = (81 * S / 19) * (0.95^(-2) - 1)
    = S * (81/19) * (1.1080 - 1)
    = S * 4.263 * 0.1080
    = S * 0.460

Round interval to nearest integer, minimum 1 day.
Cap at maximum_interval (default 36500 days = 100 years).
```

##### Learning Steps System

**Purpose:** Manage the sub-day learning progression for new and relearning cards.

**Configuration:**
- learning_steps: [1, 10] (default; in minutes)
- relearning_steps: [10] (default; in minutes)
- graduating_interval: 1 day
- easy_interval: 4 days

**Logic:**

```
For NEW cards entering Learning state:

1. Card starts at step_index = 0
2. After each rating:
   - Again: Reset step_index to 0, schedule review in learning_steps[0] minutes
   - Hard: Stay at current step, schedule review in learning_steps[step_index] * 1.5 minutes
   - Good: Advance step_index by 1
     - IF step_index >= learning_steps.length:
         GRADUATE: state = "review", interval = graduating_interval days
         Set initial stability S = S_0(G), initial difficulty D = D_0(G)
     - ELSE:
         Schedule review in learning_steps[step_index] minutes
   - Easy: GRADUATE immediately: state = "review", interval = easy_interval days
     Set initial stability S = S_0(4), initial difficulty D = D_0(4)

For REVIEW cards entering Relearning state (after a lapse):

1. Card starts at step_index = 0 of relearning_steps
2. After each rating:
   - Again: Reset step_index to 0, schedule review in relearning_steps[0] minutes
   - Hard: Stay at current step
   - Good: Advance step_index by 1
     - IF step_index >= relearning_steps.length:
         GRADUATE back to Review: state = "review"
         Interval computed from post-lapse stability S'_f
     - ELSE:
         Schedule review in relearning_steps[step_index] minutes
   - Easy: GRADUATE immediately back to Review
3. Card lapses count increments by 1 on entering relearning
```

##### Interval Fuzzing

**Purpose:** Add small random jitter to intervals to prevent all cards reviewed on the same day from becoming due on the same future day.

**Inputs:**
- interval: integer - computed interval in days

**Logic:**

```
1. IF enable_fuzz == false OR interval < 3:
     RETURN interval (no fuzz for very short intervals)
2. Compute fuzz range based on interval size:
   - interval 3-6: fuzz_range = max(1, round(interval * 0.25))
   - interval 7-13: fuzz_range = max(2, round(interval * 0.15))
   - interval 14-29: fuzz_range = max(3, round(interval * 0.10))
   - interval 30+: fuzz_range = max(4, round(interval * 0.05))
3. Generate random offset in range [-fuzz_range, +fuzz_range]
4. fuzzed_interval = interval + offset
5. Clamp fuzzed_interval to [1, maximum_interval]
6. RETURN fuzzed_interval
```

**Edge Cases:**
- Interval of 1 or 2 days: No fuzz applied (too short to jitter meaningfully)
- Very long intervals (1000+ days): Fuzz is capped at +/- 5% to avoid large swings

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FSRS parameters corrupted or missing | Alert: "Scheduling data reset to defaults." | Reset to default FSRS-5 weights |
| Stability becomes NaN or Infinity | Log error; set stability to S_0(Good) = 3.173 | Card is recoverable; review continues |
| Difficulty outside [1, 10] range | Silently clamp to valid range | No user-visible impact |
| Review timestamp in the future (clock skew) | Treat elapsed_days as 0 | Scheduling proceeds normally |
| Card due date is null but state is Review | Log warning; set due = now | Card appears in today's review queue |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a new card is shown for the first time and the user rates "Good,"
   **When** the rating is processed,
   **Then** the card enters Learning state, advances through learning steps, and after graduating has stability approximately equal to w[2] (3.173 days) and difficulty approximately equal to D_0(3) (5.28).

2. **Given** a Review card with stability 10.0 is due today and the user rates "Good,"
   **When** the rating is processed,
   **Then** the new stability is greater than 10.0, the interval is approximately equal to the new stability, and the card's due date is set to today + interval days.

3. **Given** a Review card and the user rates "Again,"
   **When** the rating is processed,
   **Then** the card enters Relearning state, lapses count increments by 1, a new lower stability is computed via S'_f, and the card is scheduled for the first relearning step.

4. **Given** desired retention is set to 0.85 instead of 0.9,
   **When** intervals are computed,
   **Then** intervals are approximately 1.64x longer than they would be at 0.9 retention.

**Edge Cases:**

5. **Given** a card has been overdue by 30 days (stability 10, due 30 days ago),
   **When** the user rates "Good,"
   **Then** retrievability is low (approximately 0.52), and the stability increase is larger than if the card had been reviewed on time (spacing effect reward).

6. **Given** a card in Learning with steps [1, 10] at step index 1,
   **When** the user rates "Again,"
   **Then** the card resets to step index 0 and is due in 1 minute.

**Negative Tests:**

7. **Given** desired retention is set to 0.50 (below minimum),
   **When** the setting is saved,
   **Then** the system rejects the value and shows "Desired retention must be between 70% and 97%."

8. **Given** a card with stability of 0.0 (uninitialized),
   **When** the card is presented for review,
   **Then** the system treats it as a new card and computes initial stability from the first rating.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| initial stability for each rating | Ratings 1, 2, 3, 4 | S = 0.403, 1.184, 3.173, 15.691 |
| initial difficulty for each rating | Ratings 1, 2, 3, 4 | D approximately 7.19, 6.49, 5.28, 3.22 |
| retrievability at stability boundary | t=S (e.g., t=10, S=10) | R approximately 0.9 |
| retrievability decays over time | t=2S, t=3S | R < 0.9, R << 0.9 |
| stability grows after Good recall | D=5, S=10, R=0.9, G=3 | S' > 10 |
| stability decreases after lapse | D=5, S=30, R=0.7, G=1 | S' approximately 5.93, S' < S |
| hard modifier reduces growth | Same inputs, G=2 vs G=3 | S'(Hard) < S'(Good) |
| easy modifier increases growth | Same inputs, G=4 vs G=3 | S'(Easy) > S'(Good) |
| interval equals stability at 90% retention | S=10, r=0.9 | I approximately 10 days |
| higher retention shortens interval | S=10, r=0.95 | I approximately 4.6 days |
| lower retention lengthens interval | S=10, r=0.85 | I approximately 16.4 days |
| difficulty clamped to [1, 10] | D after many Again ratings | D = 10.0 (capped) |
| mean reversion prevents difficulty hell | D=10.0, many Good ratings | D gradually decreases |
| interval fuzz adds jitter | interval=10, fuzz enabled | Result in [8, 12] range |
| no fuzz for short intervals | interval=2 | Result = 2 (unchanged) |
| learning steps advance correctly | Steps [1, 10], rate Good twice | Graduates to Review |
| relearning steps work after lapse | Lapse on Review card | Enters relearning step 1 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full card lifecycle: New to Review | 1. Create card, 2. Study and rate Good through learning steps, 3. Graduate | Card in Review state with correct S, D, and interval |
| Lapse and recovery | 1. Review card at Good, 2. Wait until due, 3. Rate Again, 4. Go through relearning, 5. Graduate | Card back in Review with lower stability, lapses = 1 |
| Review log records all transitions | 1. Study card through 5 reviews with varied ratings | 5 ReviewLog entries with correct before/after states |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user studies first card through graduation | 1. Create card, 2. Study, rate Good, 3. Wait 1 min, 4. Study again, rate Good, 5. Wait 10 min, 6. Study again, rate Good | Card in Review state, due in approximately 3 days, stability approximately 3.17 |

---

### FL-005: Study Session with Review Queue

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-005 |
| **Feature Name** | Study Session with Review Queue |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a student, I want to start a study session for a deck and review all due cards, so that I can maintain my retention schedule and keep up with my spaced repetition workload.

**Secondary:**
> As a busy learner, I want to see a session summary after studying, so that I can track how many cards I reviewed, my accuracy, and how long I studied.

#### 3.3 Detailed Description

The Study Session is the core interactive loop of MyFlash. When a user starts a study session for a deck, the system builds a review queue containing all due cards (new cards up to the daily new limit, learning cards with due steps, and review cards due today). Cards are presented one at a time: first the front (question), then - after the user taps "Show Answer" - the back (answer) with four rating buttons (Again, Hard, Good, Easy).

The review queue follows a specific ordering: learning/relearning cards with pending steps are presented first (they have short intra-session intervals), followed by a mix of new and review cards. New cards are interleaved with review cards at a ratio determined by the new-to-review ratio (default: 1 new card for every 5 review cards).

Each study session tracks metrics: total cards reviewed, time spent, accuracy (percentage of cards rated Good or Easy), and cards remaining. A progress bar at the top shows completion percentage. When the session ends (all due cards reviewed), a summary screen displays session statistics with a congratulatory message.

Sessions can be paused at any time by navigating away. The queue state persists, so the user can resume where they left off. The "Undo" button (FL-018) allows reversing the last rating within the session.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-003: Deck Organization - decks must exist to start sessions from
- FL-004: FSRS Spaced Repetition Engine - scheduling algorithm for queue building and rating processing

**External Dependencies:**
- System clock for timing review duration
- Haptic feedback engine for rating confirmation

**Assumed Capabilities:**
- Card entities have populated FSRS state fields
- Deck daily limits (new_cards_per_day, max_reviews_per_day) are configured

#### 3.5 User Interface Requirements

##### Screen: Study Session

**Layout:**
- Top bar with: back arrow (left), deck name (center), progress indicator "12/45" (right)
- Below the top bar is a thin progress bar spanning the full width (fills left to right as cards are completed)
- Below the progress bar are three small count badges: new remaining (blue), learning remaining (orange), review remaining (green)
- The main area is a card display occupying approximately 70% of the screen height
- The card shows the front face content centered vertically and horizontally within the card area
- Below the card is a "Show Answer" button spanning the full width
- After tapping "Show Answer," the card expands to show both front and back (separated by a horizontal line), and the "Show Answer" button is replaced by four rating buttons
- Each rating button shows the rating name, color, and projected next interval
- An "Undo" button (small, top-left corner below the nav bar) appears after rating a card (FL-018)
- A timer in the top-right shows elapsed session time (optional, can be hidden in settings)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Question | Card front is displayed, answer hidden | Card front visible, "Show Answer" button active, rating buttons hidden |
| Answer | User tapped "Show Answer" | Both front and back visible with separator, "Show Answer" replaced by 4 rating buttons with intervals |
| Loading Next | User tapped a rating, next card is loading | Brief card flip animation (200ms), then next card's front appears |
| Session Complete | All due cards reviewed | Summary screen with stats (see below) |
| Empty Queue | No cards due in this deck | Message: "No cards due right now. Come back later or add new cards." with buttons to "Add Cards" and "Return to Deck" |
| Paused | User navigated away mid-session | Session state persisted; returning resumes at the same position |

**Interactions:**
- Tap "Show Answer": Reveals the back of the card and shows rating buttons. Can also be triggered by tapping anywhere on the card area or pressing spacebar (keyboard shortcut)
- Tap rating button (Again/Hard/Good/Easy): Records the review, processes FSRS scheduling, advances to next card
- Tap back arrow: Pauses session, returns to deck view. Session state is saved
- Tap undo: Reverses the last rating (FL-018)
- Swipe right on card: Same as "Show Answer"
- Keyboard shortcuts (when hardware keyboard connected): Space = Show Answer, 1 = Again, 2 = Hard, 3 = Good, 4 = Easy

**Transitions/Animations:**
- Show Answer: Card area smoothly expands downward (200ms ease-out) to reveal the back content
- Card advance: Current card slides left and fades out (150ms), next card slides in from right and fades in (150ms)
- Session complete: Cards stack animation collapses into a checkmark, then summary fades in

##### Screen: Session Summary

**Layout:**
- Top section: Large checkmark icon with congratulatory message ("Session complete!" or "Great work!")
- Stats grid (2 columns, 3 rows):
  - Cards Reviewed: [number]
  - Time Spent: [HH:MM:SS or MM:SS]
  - Accuracy: [percentage] (cards rated Good or Easy / total reviews)
  - Again Count: [number] (with red dot)
  - Average Time per Card: [seconds]
  - Streak: [current streak day count] (if FL-014 enabled)
- Below stats: "Next due" indicator showing when the next card in this deck is due (e.g., "Next review in 4 hours" or "Next review tomorrow")
- Two buttons at the bottom: "Study More" (if there are new cards remaining that were not in the session) and "Done" (returns to deck view)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Standard | Session completed normally | Full stats with congratulatory message |
| Perfect | 100% accuracy (all Good or Easy) | Extra celebratory message: "Perfect session!" with star decoration |
| Struggled | Accuracy below 70% | Encouraging message: "Keep at it! Spaced repetition works best with consistency." |

#### 3.6 Data Requirements

##### Entity: StudySession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique session identifier |
| deck_id | string | Foreign key to Deck.id, required | None | Deck being studied |
| started_at | datetime | Auto-set | Current timestamp | When the session started |
| ended_at | datetime | Nullable | null | When the session ended (null if in progress) |
| cards_reviewed | integer | Min: 0 | 0 | Total cards reviewed in this session |
| cards_new | integer | Min: 0 | 0 | New cards studied in this session |
| cards_learning | integer | Min: 0 | 0 | Learning/relearning cards studied |
| cards_review | integer | Min: 0 | 0 | Review cards studied |
| again_count | integer | Min: 0 | 0 | Number of Again ratings |
| hard_count | integer | Min: 0 | 0 | Number of Hard ratings |
| good_count | integer | Min: 0 | 0 | Number of Good ratings |
| easy_count | integer | Min: 0 | 0 | Number of Easy ratings |
| total_time_ms | integer | Min: 0 | 0 | Total time spent in session in milliseconds |
| is_completed | boolean | - | false | Whether the session was completed (all due cards reviewed) |

**Relationships:**
- StudySession belongs to Deck (many-to-one via session.deck_id)
- StudySession has many ReviewLogs (one-to-many, linked by time range or session_id reference)

**Indexes:**
- (deck_id, started_at) - session history for a deck
- (started_at) - global session history

#### 3.7 Business Logic Rules

##### Review Queue Building

**Purpose:** Build an ordered queue of cards to present during a study session.

**Inputs:**
- deck_id: string - the deck (including all descendant decks) to study
- now: datetime - current timestamp

**Logic:**

```
1. Collect all cards from target deck AND all descendant decks
2. Separate cards into three pools:

   LEARNING POOL:
   - Cards where state IN ("learning", "relearning") AND due <= now
   - Sort by due date ascending (most overdue first)

   NEW POOL:
   - Cards where queue = "new"
   - Sort by card creation date ascending
   - Limit to deck.new_cards_per_day minus new cards already studied today
   - "Today" is defined as the calendar day boundary (midnight local time)

   REVIEW POOL:
   - Cards where state = "review" AND due <= now
   - Sort by due date ascending (most overdue first)
   - Limit to deck.max_reviews_per_day minus review cards already studied today

3. Build the interleaved queue:
   a. Start with all learning pool cards (they have urgent sub-day deadlines)
   b. Interleave new and review cards:
      - For every 1 new card, insert 5 review cards (configurable ratio)
      - If one pool is exhausted, add remaining from the other pool
   c. Append any learning cards that become due during the session
      (cards rated Again re-enter the learning pool with a short delay)

4. RETURN ordered list of card IDs
```

**Edge Cases:**
- No cards due: Return empty queue, show "No cards due" state
- Only new cards (new deck): Queue contains only new cards up to daily limit
- Only review cards (no new cards remaining): Queue contains only review cards
- Learning cards becoming due mid-session: Dynamically insert at front of queue
- Daily limit reached mid-session: Stop presenting new/review cards, but finish learning cards

##### Session Timer

**Purpose:** Track time spent per card and per session for statistics.

**Logic:**

```
1. When card front is displayed, start card_timer
2. When user taps a rating button, stop card_timer
3. review_duration_ms = card_timer elapsed time
4. Add review_duration_ms to session.total_time_ms
5. Store review_duration_ms in ReviewLog for that review
6. IF review_duration_ms < 300ms:
     Flag as accidental tap (too fast to read), but still process the rating
7. IF review_duration_ms > 600000ms (10 minutes):
     Cap at 60000ms (1 minute) for stats purposes
     (user likely walked away; do not inflate session time)
```

##### Daily Limit Tracking

**Purpose:** Enforce per-deck limits on new and review cards per day.

**Logic:**

```
1. Count reviews already done today for this deck:
   new_studied_today = COUNT(ReviewLog WHERE card_id IN deck_cards
                       AND state_before = "new"
                       AND reviewed_at >= today_midnight)
   reviews_studied_today = COUNT(ReviewLog WHERE card_id IN deck_cards
                           AND state_before = "review"
                           AND reviewed_at >= today_midnight)

2. Available new cards = max(0, deck.new_cards_per_day - new_studied_today)
3. Available review cards = max(0, deck.max_reviews_per_day - reviews_studied_today)
4. Apply these limits when building the queue
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails during rating | Toast: "Could not save review. Retrying..." | Auto-retry up to 3 times; if all fail, queue the write for next app open |
| Session state lost (app crash) | On reopen, detect incomplete session | Offer "Resume session?" or "Start fresh?" |
| Card data corrupted (missing front content) | Skip card, show next card in queue | Log error for debugging; card appears in card browser for manual fix |
| Clock jumps forward significantly (timezone change) | Recalculate due dates based on new time | Some cards may suddenly become due; session queue refreshes |

**Validation Timing:**
- Queue building validates card data integrity before adding to queue
- Rating processing validates FSRS outputs before writing to database

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a deck with 5 new cards, 10 review cards due, and 2 learning cards due,
   **When** the user starts a study session,
   **Then** learning cards appear first, followed by interleaved new and review cards, progress shows "0/17."

2. **Given** the user is viewing a card's front,
   **When** they tap "Show Answer,"
   **Then** the back of the card is revealed with a smooth expand animation and four rating buttons appear with projected intervals.

3. **Given** all cards in the queue have been reviewed,
   **When** the last card is rated,
   **Then** the session summary screen displays with correct stats (total reviewed, time, accuracy).

4. **Given** the user rates a new card "Again" during a session,
   **When** the learning step interval (1 minute) elapses,
   **Then** the card reappears at the front of the queue for re-review.

**Edge Cases:**

5. **Given** the daily new card limit is 20 and 15 new cards have already been studied today,
   **When** the user starts a new session,
   **Then** only 5 new cards are available in the queue.

6. **Given** a user closes the app mid-session,
   **When** they reopen the app and navigate to the deck,
   **Then** they are offered to resume the session from where they left off.

**Negative Tests:**

7. **Given** a deck with zero cards,
   **When** the user taps "Study Now,"
   **Then** the empty queue message appears: "No cards due right now."

8. **Given** all daily limits are exhausted,
   **When** the user tries to start a session,
   **Then** the message shows "Daily limit reached. Come back tomorrow or adjust limits in deck settings."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| builds queue with correct ordering | 2 learning, 3 new, 10 review | Learning cards first, then interleaved new/review |
| respects daily new card limit | limit=5, 3 already studied today | 2 new cards in queue |
| respects daily review limit | limit=50, 20 already studied today | 30 review cards in queue |
| interleaves new and review cards | 5 new, 25 review, ratio 1:5 | Pattern: 5 review, 1 new, 5 review, 1 new... |
| caps review duration at 60 seconds | Timer shows 600000ms | Stored as 60000ms |
| computes session accuracy | 3 Again, 2 Hard, 10 Good, 5 Easy | Accuracy = 75% (15/20) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete study session | 1. Start session with 5 cards, 2. Rate all Good | Session summary shows 5 cards, 100% accuracy |
| Learning card re-entry | 1. Rate card Again, 2. Continue session, 3. Card reappears after 1 min | Card re-enters queue at front after delay |
| Session resume after pause | 1. Study 3/10 cards, 2. Navigate away, 3. Return | Resume offered, continuing from card 4/10 |

---

### FL-006: Anki .apkg Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-006 |
| **Feature Name** | Anki .apkg Import |
| **Priority** | P0 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As an existing Anki user, I want to import my Anki deck (.apkg file) into MyFlash, so that I can bring my entire card library and review history to a modern app without starting over.

**Secondary:**
> As a new user, I want to download and import shared Anki decks from the community, so that I can start studying immediately without creating all cards from scratch.

#### 3.3 Detailed Description

Anki .apkg Import enables users to import Anki deck packages, the de facto standard format for shareable flashcard decks. An .apkg file is a renamed ZIP archive containing an SQLite database (collection.anki21 or collection.anki2) and a media folder with referenced images, audio, and video files.

The import process handles: deck structure (including nested decks), notes with field data, card scheduling state (stability, difficulty, interval, due date, review count, lapse count), note models (templates and CSS), tags, and media files. Users can choose to import into a new deck or merge into an existing deck.

For scheduling data, the importer converts Anki's internal scheduling state to FSRS parameters. If the source deck was using FSRS in Anki, the conversion is direct. If it was using SM-2, the importer applies a best-effort mapping from SM-2 ease factor and interval to FSRS stability and difficulty.

The import flow is: select file, preview contents (deck name, card count, media count), choose import options, run import with progress bar, display results (imported count, skipped duplicates, errors).

Import of large decks (50,000+ cards) must complete without memory issues. The importer processes cards in batches of 500 and provides progress feedback.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card entity must exist
- FL-003: Deck Organization - deck entity must exist for target placement

**External Dependencies:**
- File system access for reading .apkg files
- ZIP decompression library
- Sufficient storage space for media files

**Assumed Capabilities:**
- User can select files from device file picker
- Database supports batch insert operations

#### 3.5 User Interface Requirements

##### Screen: Import

**Layout:**
- Top bar with "Import" title and close button
- Central area with a large drop zone / file picker button: "Select .apkg File"
- Supported format note: "Supports Anki .apkg and .colpkg files"
- Below the picker, import history list showing previous imports with date, deck name, and card count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | No file selected | File picker button and import history |
| File Selected | User chose a file | Preview card showing: file name, deck name, card count, media count, file size |
| Options | User reviewing import settings | Import options panel (see below) |
| Importing | Import in progress | Progress bar with percentage, cards imported count, current step label ("Importing cards...", "Copying media...") |
| Complete | Import finished | Results summary: imported count, skipped count, error count, "View Deck" button |
| Error | Import failed | Error message with details and "Try Again" button |

##### Modal: Import Options

**Layout:**
- Destination deck selector (new deck with imported name, or merge into existing)
- "Import scheduling data" toggle (default: on) - whether to bring over review history or treat all as new
- "Import media" toggle (default: on) - whether to copy referenced images/audio
- "Skip duplicates" toggle (default: on) - skip cards whose first field matches existing cards
- "Import" and "Cancel" buttons

**Interactions:**
- Toggle switches: Enable/disable each import option
- Tap "Import": Begins import process with selected options
- Tap "Cancel": Returns to idle state

#### 3.6 Data Requirements

##### Entity: ImportRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique import record identifier |
| source_file | string | Required, max 500 chars | None | Original filename of the imported file |
| source_format | enum | One of: apkg, colpkg | apkg | Format of the imported file |
| deck_id | string | Foreign key to Deck.id | None | Target deck for the import |
| cards_imported | integer | Min: 0 | 0 | Number of cards successfully imported |
| cards_skipped | integer | Min: 0 | 0 | Number of duplicate cards skipped |
| cards_failed | integer | Min: 0 | 0 | Number of cards that failed to import |
| media_imported | integer | Min: 0 | 0 | Number of media files copied |
| media_skipped | integer | Min: 0 | 0 | Number of media files skipped (already exist) |
| imported_at | datetime | Auto-set | Current timestamp | When the import was performed |
| duration_ms | integer | Min: 0 | 0 | How long the import took in milliseconds |

**Relationships:**
- ImportRecord belongs to Deck (many-to-one via import.deck_id)

**Indexes:**
- (imported_at) - import history listing

#### 3.7 Business Logic Rules

##### .apkg File Parsing

**Purpose:** Extract deck data from an Anki package file.

**Inputs:**
- file_path: string - path to the .apkg file on device

**Logic:**

```
1. Verify file extension is .apkg or .colpkg
2. Open file as ZIP archive
3. Extract contents to a temporary directory:
   - collection.anki21 (or collection.anki2 for older format): SQLite database
   - media: JSON file mapping numeric filenames to original names
   - 0, 1, 2, ...: Media files referenced by the mapping
4. Open the SQLite database
5. Read the following tables:
   - col: Collection metadata (models, decks, config as JSON)
   - notes: Note data (id, mid=model_id, flds=fields, tags, csum=checksum)
   - cards: Card data (id, nid=note_id, did=deck_id, type, queue, due, ivl, factor, reps, lapses)
   - revlog: Review history (id, cid=card_id, usn, ease, ivl, lastIvl, factor, time, type)
6. Parse col.models JSON to extract note models (field definitions, templates, CSS)
7. Parse col.decks JSON to extract deck hierarchy
8. RETURN parsed data structure with models, decks, notes, cards, revlog, and media mapping
```

##### SM-2 to FSRS Conversion

**Purpose:** Convert Anki SM-2 scheduling parameters to FSRS equivalents when importing decks that used the legacy algorithm.

**Inputs:**
- ease_factor: integer - Anki ease factor (typically 1300-3500, representing 130%-350%)
- interval: integer - current interval in days
- reps: integer - review count
- lapses: integer - lapse count

**Logic:**

```
1. Convert ease factor to FSRS difficulty:
   - Anki ease ranges from 1300 (hardest) to 3500 (easiest)
   - FSRS difficulty ranges from 1.0 (easiest) to 10.0 (hardest)
   - D = 10.0 - ((ease_factor - 1300) / (3500 - 1300)) * 9.0
   - Clamp D to [1.0, 10.0]

2. Convert interval to FSRS stability:
   - For review cards with interval > 0:
     S = interval (in days) - stability approximates the interval
   - For learning cards with interval <= 0:
     S = 0.0 (will be initialized on first FSRS review)

3. Compute retrievability based on overdue days:
   - IF card has a due date and is overdue:
     elapsed = days since due date
     R = (1 + (19 * elapsed) / (81 * S))^(-0.5)
   - ELSE: R = 0.9 (assume on-schedule)

4. Map Anki card states:
   - type 0 (new) -> state "new"
   - type 1 (learning) -> state "learning"
   - type 2 (review) -> state "review"
   - type 3 (relearning) -> state "relearning"

5. Map Anki queue states:
   - queue -1 (suspended) -> queue "suspended"
   - queue -2 (buried) -> queue "buried"
   - queue 0 (new) -> queue "new"
   - queue 1 (learning) -> queue "learning"
   - queue 2 (review) -> queue "review"
```

##### Media File Import

**Purpose:** Copy media files from the .apkg archive to the app's media storage.

**Logic:**

```
1. Read the media JSON mapping: {"0": "image.jpg", "1": "audio.mp3", ...}
2. FOR EACH media entry:
   a. Read the numbered file from the archive
   b. Compute SHA256 hash of file contents
   c. IF a file with the same hash already exists in local storage:
        SKIP (increment media_skipped)
   d. ELSE:
        Copy file to local media directory with hash-based filename
        Store mapping: original_name -> local_filename
        Increment media_imported
3. Update card content: replace [sound:filename.mp3] and <img src="filename.jpg">
   references with local file paths
```

##### Batch Import Processing

**Purpose:** Import large decks without memory issues.

**Logic:**

```
1. Parse the .apkg file (step above)
2. Begin database transaction
3. Import note models (typically small, import all at once)
4. Import decks (create hierarchy, typically small)
5. Import notes in batches of 500:
   a. Read 500 notes from source
   b. Check for duplicates (by checksum) if skip_duplicates enabled
   c. Insert non-duplicate notes
   d. Update progress: notes_processed / total_notes
6. Import cards in batches of 500:
   a. Read 500 cards from source
   b. Convert scheduling data (SM-2 to FSRS if needed)
   c. Insert cards with correct deck_id and note_id mappings
   d. Update progress
7. Import media files (outside transaction, sequential)
8. Commit transaction
9. IF any step fails:
     Rollback transaction
     Report error with details
     Media files already copied are orphaned but cleaned up on next app launch
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not a valid ZIP | Error: "This file does not appear to be a valid Anki package." | User selects a different file |
| File is too large for available storage | Error: "Not enough storage space. Need [X]MB, [Y]MB available." | User frees storage and retries |
| Database inside .apkg is corrupted | Error: "The deck file appears to be damaged. Try re-exporting from Anki." | User re-exports from Anki |
| Partial import failure (some cards fail) | Warning: "Imported 4,500 of 5,000 cards. 500 cards had errors. View details?" | Details screen shows per-card error reasons |
| Media file missing from archive | Card imports without media; placeholder shown | Card editor shows missing media indicator |
| Import cancelled mid-progress | All changes rolled back, no partial data | User can retry when ready |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a user selects a standard Anki .apkg file with 100 cards,
   **When** they import with default settings,
   **Then** all 100 cards are imported into a new deck with correct front/back content, and the import summary shows "100 imported, 0 skipped."

2. **Given** a deck with images and audio was exported from Anki,
   **When** imported into MyFlash,
   **Then** all media files are available and render correctly in card content.

3. **Given** an Anki deck using SM-2 scheduling with varied ease factors,
   **When** imported with "Import scheduling data" enabled,
   **Then** cards have FSRS difficulty and stability values that reasonably correspond to their SM-2 parameters.

**Edge Cases:**

4. **Given** a large .apkg file with 50,000 cards,
   **When** imported,
   **Then** the import completes within 60 seconds, progress updates smoothly, and memory usage stays below 200MB.

5. **Given** the user imports a deck that duplicates 30 cards already in MyFlash,
   **When** "Skip duplicates" is enabled,
   **Then** 30 cards are skipped and the summary reports them clearly.

**Negative Tests:**

6. **Given** a file that is not a valid .apkg,
   **When** the user attempts to import it,
   **Then** the system shows "This file does not appear to be a valid Anki package."

7. **Given** insufficient storage space for the import,
   **When** import is attempted,
   **Then** the error message shows required vs available space before starting.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses valid .apkg ZIP structure | Valid .apkg with 10 cards | Parsed notes, cards, models, decks |
| rejects non-ZIP file | .txt file renamed to .apkg | Error: invalid file |
| converts SM-2 ease 2500 to FSRS difficulty | ease=2500 | D approximately 5.09 |
| converts SM-2 ease 1300 to FSRS difficulty | ease=1300 | D = 10.0 |
| converts SM-2 ease 3500 to FSRS difficulty | ease=3500 | D = 1.0 |
| maps Anki card states correctly | type=2, queue=2 | state="review", queue="review" |
| detects duplicate by checksum | Note with matching checksum in same deck | Duplicate flagged |
| media hash deduplication | Same image imported twice | Second import skipped |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full .apkg import flow | 1. Select file, 2. Preview, 3. Import | Deck created with all cards, review history intact |
| Import with duplicate skip | 1. Import deck A, 2. Import deck A again | Second import skips all cards |
| Import into existing deck | 1. Create deck, 2. Import .apkg into it | Cards added to existing deck |

---

### FL-007: Study Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-007 |
| **Feature Name** | Study Statistics |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student, I want to see my study statistics (cards due, retention rate, time spent), so that I can monitor my progress and adjust my study habits.

**Secondary:**
> As a power user, I want to see a review forecast showing how many cards will be due each day for the next month, so that I can plan my study schedule.

#### 3.3 Detailed Description

Study Statistics provides comprehensive analytics about the user's flashcard study activity. Statistics are displayed on a dedicated Stats tab with multiple visualization sections: today's summary, calendar heatmap, retention rate, review forecast, card state distribution, and review time analysis.

The stats engine queries the ReviewLog table to compute all metrics. All calculations run on-device and update in real-time as the user completes reviews. Statistics can be filtered by deck (including all descendant decks) or viewed globally across all decks.

Key metrics include:
- **Cards due today:** Broken down by new, learning, and review categories
- **Retention rate:** Percentage of reviews rated Good or Easy over a time period (7d, 30d, all-time)
- **Daily reviews:** Number of reviews completed per day, shown as a bar chart or calendar heatmap
- **Review forecast:** Predicted number of reviews due each day for the next 30 days, based on current scheduling
- **Card state distribution:** Pie or donut chart showing new/learning/review/suspended percentages
- **Time studied:** Total and average time per day, week, month
- **Card maturity:** Distribution of card intervals (young: <21 days, mature: >=21 days)
- **Lapse rate:** Percentage of mature cards that lapsed, tracked over time

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-004: FSRS Spaced Repetition Engine - ReviewLog data required
- FL-005: Study Session with Review Queue - session data required

**External Dependencies:**
- None (all data is local)

**Assumed Capabilities:**
- ReviewLog table is populated with historical review data
- System can perform aggregate queries efficiently

#### 3.5 User Interface Requirements

##### Screen: Statistics (Tab 3 - Stats)

**Layout:**
- Top bar with "Statistics" title and a deck filter dropdown (default: "All Decks")
- Time period selector: "Today" | "7 Days" | "30 Days" | "All Time"
- Scrollable content area with stat sections:

1. **Today's Summary Card** (always visible at top):
   - Three large numbers in a row: New (blue), Learning (orange), Due (green)
   - Below: "X reviews completed today" with small bar showing progress vs yesterday

2. **Calendar Heatmap:**
   - Grid of the last 90 days (or selected period)
   - Each day cell color-coded by review count: light (few) to dark (many)
   - Tapping a day shows that day's detailed stats in a tooltip

3. **Retention Rate Chart:**
   - Line chart showing daily retention rate over the selected period
   - Horizontal reference line at the desired retention (default 90%)
   - Tooltip on tap showing exact value and review count

4. **Review Forecast:**
   - Bar chart showing predicted due cards for each of the next 30 days
   - Bars color-coded: new (blue), review (green)
   - Horizontal line showing daily average

5. **Card State Distribution:**
   - Donut chart: New (blue), Learning (orange), Young (green), Mature (teal), Suspended (gray)
   - Center shows total card count
   - Legend below with exact counts and percentages

6. **Review Time Analysis:**
   - Average time per card (in seconds)
   - Total time studied (formatted as hours and minutes)
   - Daily average study time
   - Time per rating breakdown (average seconds for Again vs Hard vs Good vs Easy)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No reviews completed yet | Each section shows "Start studying to see your stats" with a ghost chart illustration |
| Loading | Computing statistics for large datasets | Skeleton loading placeholders for each section |
| Populated | Review data exists | Full charts and metrics |
| Filtered | Specific deck selected | All stats scoped to that deck and its children |

**Interactions:**
- Tap deck filter: Opens deck picker to filter stats by deck
- Tap time period: Switches all charts to the selected period
- Tap calendar day: Shows tooltip with that day's stats
- Tap chart data point: Shows tooltip with exact value
- Pull down: Refreshes all statistics

#### 3.6 Data Requirements

No new entities required. Statistics are computed from existing ReviewLog, Card, Deck, and StudySession entities.

**Computed Metrics (not stored, calculated on demand):**

| Metric | Formula | Source |
|--------|---------|--------|
| retention_rate | COUNT(rating >= 3) / COUNT(all reviews) * 100 | ReviewLog |
| daily_reviews | COUNT(reviews) GROUP BY date(reviewed_at) | ReviewLog |
| avg_time_per_card | SUM(review_duration_ms) / COUNT(reviews) | ReviewLog |
| total_time_studied | SUM(review_duration_ms) | ReviewLog |
| mature_card_count | COUNT(cards WHERE interval_days >= 21) | Card |
| young_card_count | COUNT(cards WHERE state="review" AND interval_days < 21) | Card |
| lapse_rate | COUNT(lapses in period) / COUNT(mature reviews in period) * 100 | ReviewLog |
| forecast_due_day_N | COUNT(cards WHERE due = today + N) | Card |

#### 3.7 Business Logic Rules

##### Review Forecast Calculation

**Purpose:** Predict how many cards will be due each day for the next 30 days.

**Inputs:**
- deck_id: string (optional, null for global)
- forecast_days: integer (default: 30)

**Logic:**

```
1. Load all cards in scope (by deck or global)
2. For each day D from 1 to forecast_days:
   a. target_date = today + D days
   b. review_due = COUNT(cards WHERE state="review" AND due = target_date)
   c. For new cards, estimate based on new_cards_per_day setting:
      new_estimate = min(new_cards_remaining, deck.new_cards_per_day)
      (Decrease new_cards_remaining each day)
   d. forecast[D] = { date: target_date, review: review_due, new: new_estimate }
3. RETURN forecast array
```

**Edge Cases:**
- Deck with no review cards: Forecast shows only new card estimates
- All cards suspended: Forecast shows 0 for all days
- Very large decks: Query uses indexed due field for performance

##### Retention Rate Calculation

**Purpose:** Compute the percentage of successful recalls over a time period.

**Inputs:**
- deck_id: string (optional)
- start_date: datetime
- end_date: datetime

**Logic:**

```
1. Query ReviewLog WHERE reviewed_at BETWEEN start_date AND end_date
   AND (deck filter if applicable)
   AND state_before IN ("review", "relearning")
   (Only count reviews of cards that were previously learned, not first-time new card reviews)
2. success_count = COUNT WHERE rating >= 3 (Good or Easy)
3. total_count = COUNT all matching reviews
4. IF total_count == 0: RETURN null (no data)
5. retention_rate = (success_count / total_count) * 100
6. RETURN retention_rate rounded to 1 decimal place
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Stats query takes longer than 5 seconds | Loading indicator with "Calculating stats for large deck..." | Query continues; result cached for 5 minutes |
| No review data for selected period | Section shows "No reviews in this period" | User selects a different time period |
| Deck filter references deleted deck | Filter resets to "All Decks" | Automatic recovery |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has reviewed 50 cards today,
   **When** they open the Statistics tab,
   **Then** "Today's Summary" shows correct new/learning/review counts and "50 reviews completed today."

2. **Given** the user has 30 days of review history,
   **When** they select "30 Days" period,
   **Then** the calendar heatmap shows color-coded cells for each day with reviews, and the retention rate chart shows a 30-day trend line.

3. **Given** 200 cards are due over the next 30 days,
   **When** the review forecast is displayed,
   **Then** the bar chart correctly distributes expected reviews across days based on actual card due dates.

**Edge Cases:**

4. **Given** a brand-new user with zero reviews,
   **When** they open Statistics,
   **Then** all sections show "Start studying to see your stats" placeholders.

5. **Given** the user filters stats to a specific deck,
   **When** the deck has child decks,
   **Then** stats aggregate across the parent and all descendants.

**Negative Tests:**

6. **Given** the user selects a time period with no reviews,
   **When** stats are computed,
   **Then** retention rate shows "N/A" (not 0% or an error), and charts show empty states.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| retention rate with mixed ratings | 7 Good, 3 Again in period | 70.0% |
| retention rate with no data | Empty ReviewLog | null (no data) |
| forecast counts due cards correctly | 5 cards due tomorrow, 3 due in 2 days | forecast[1]=5, forecast[2]=3 |
| mature card threshold | Cards with intervals 20, 21, 22 | 20 is young, 21 and 22 are mature |
| time formatting | 3661000ms | "1h 1m" |
| daily review count aggregation | 10 reviews on March 1, 5 on March 2 | {Mar 1: 10, Mar 2: 5} |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Stats update after study session | 1. Complete session with 10 cards, 2. Open Stats | All metrics reflect the 10 new reviews |
| Deck filter scopes all sections | 1. Study 2 decks, 2. Filter to deck A | Only deck A stats shown in all sections |

---

### FL-008: Cloze Deletions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-008 |
| **Feature Name** | Cloze Deletions |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a medical student, I want to create fill-in-the-blank cards from my notes, so that I can test myself on specific terms within full context sentences.

**Secondary:**
> As a language learner, I want to create multiple cloze deletions in a single note, so that I can test different parts of the same sentence independently.

#### 3.3 Detailed Description

Cloze Deletions allow users to create fill-in-the-blank flashcards by wrapping text in special markers. The syntax follows Anki's convention: `{{c1::answer}}` marks text to be hidden on card 1, `{{c2::answer}}` on card 2, and so on. A single note can produce multiple cards, one per unique cloze number.

For example, the note text "{{c1::Paris}} is the capital of {{c2::France}}" produces two cards:
- Card 1 (c1): "[...]" is the capital of France" (answer: Paris)
- Card 2 (c2): "Paris is the capital of [...]" (answer: France)

Cloze deletions also support optional hints: `{{c1::answer::hint}}` displays the hint text in place of the blank. For example, `{{c1::mitochondria::organelle}}` shows "[organelle]" on the front instead of "[...]".

The card creation screen provides a toolbar button that wraps selected text in cloze syntax, auto-incrementing the cloze number. Users can also type cloze syntax directly. A live preview shows how each generated card will look during study.

During study, the hidden text is replaced with a styled blank (highlighted, distinct from surrounding text). After the user reveals the answer, the blank is replaced with the correct answer highlighted in a contrasting color.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist
- FL-002: Card Types - cloze is a card type that uses the NoteModel system

**External Dependencies:**
- None

**Assumed Capabilities:**
- NoteModel system supports cloze type models
- Text selection and toolbar interactions are available in the card editor

#### 3.5 User Interface Requirements

##### Screen: Cloze Card Creation (extension of Card Creation screen)

**Layout:**
- When "Cloze" is selected in the card type segmented control:
  - The two separate "Front" and "Back" fields are replaced by a single large "Content" field
  - A cloze toolbar appears above the keyboard with buttons:
    - "[...]" button: Wraps selected text in `{{cN::...}}` with auto-incremented N
    - Number buttons (1, 2, 3...): Explicitly set the cloze number for selected text
    - Hint button: Adds `::hint` to an existing cloze marker
  - Below the content field, a "Preview Cards" section shows a horizontally scrollable list of generated card previews (one per cloze number)
  - Each preview card shows the front with the specific cloze replaced by a blank

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Content field empty | Placeholder: "Enter text and use [···] to create blanks" |
| Editing | Text entered with cloze markers | Content field with styled cloze markers (highlighted background), preview cards below |
| No Cloze Markers | Text entered but no {{c::}} markers | Warning below field: "Add at least one cloze deletion using the [···] button" |
| Multiple Clozes | Two or more unique cloze numbers | Preview section shows multiple scrollable card previews |

**Interactions:**
- Select text, tap "[...]" button: Wraps selection in `{{c1::selection}}` (or next unused number)
- Tap number button on toolbar: Changes the cloze number for the nearest cloze marker
- Tap preview card: Expands to show full card front and back
- Type `{{c` manually: Auto-complete suggestion appears to help complete the syntax

#### 3.6 Data Requirements

Cloze cards use the existing Note and Card entities. The NoteModel for cloze type differs:

##### Default Cloze NoteModel

```json
{
  "id": "m-cloze-default",
  "name": "Cloze",
  "type": "cloze",
  "fields": [
    {"name": "Text", "ordinal": 0},
    {"name": "Back Extra", "ordinal": 1}
  ],
  "templates": [
    {
      "name": "Cloze",
      "ordinal": 0,
      "front_format": "{{cloze:Text}}",
      "back_format": "{{cloze:Text}}<br>{{Back Extra}}"
    }
  ],
  "css": ".card { font-family: system-ui; font-size: 18px; text-align: center; } .cloze { font-weight: bold; color: #4A90D9; }",
  "sort_field_index": 0
}
```

**Key difference from standard models:** Instead of creating one card per template, the cloze model creates one card per unique cloze number found in the Text field. Template ordinal maps to cloze number.

#### 3.7 Business Logic Rules

##### Cloze Parsing

**Purpose:** Extract cloze markers from text and generate cards.

**Inputs:**
- text: string - the content field with cloze markers

**Logic:**

```
1. Parse all cloze markers using regex: /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g
   - Group 1: cloze number (integer)
   - Group 2: answer text
   - Group 3: hint text (optional)
2. Collect unique cloze numbers
3. FOR EACH unique cloze number N:
   a. Create card with ordinal = N - 1
   b. Front rendering: Replace {{cN::answer}} with styled blank "[...]" or "[hint]"
                        Leave all other cloze markers ({{cM::answer}} where M != N) as plain answer text
   c. Back rendering: Replace {{cN::answer}} with styled answer text (highlighted)
                       Leave all other cloze markers as plain answer text
4. IF no cloze markers found: Validation error
5. RETURN list of cards to create
```

**Edge Cases:**
- Nested cloze markers: Not supported, inner markers treated as literal text
- Cloze number gaps (c1, c3, no c2): Valid, two cards created (ordinals 0 and 2)
- Duplicate cloze numbers: All instances of the same number are hidden on the same card
- Empty answer text `{{c1::}}`: Validation error, answer must not be empty
- Very large cloze number (c999): Supported, but warn user if more than 20 cloze cards from one note

##### Cloze Rendering

**Purpose:** Render a cloze card's front and back for study display.

**Inputs:**
- text: string - the content field with cloze markers
- active_cloze: integer - the cloze number being tested on this card

**Logic:**

```
1. FOR EACH cloze marker in text:
   a. IF marker.number == active_cloze:
        Front: Replace with blank element styled as "[...]" or "[hint]" if hint exists
        Back: Replace with answer element styled with highlight color
   b. ELSE:
        Both front and back: Replace with plain answer text (no styling, no hiding)
2. RETURN { front_html, back_html }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No cloze markers on save | Inline error: "Add at least one cloze deletion" | User adds cloze syntax |
| Empty answer in cloze marker | Inline error below marker: "Cloze answer cannot be empty" | User adds text inside marker |
| Malformed cloze syntax | Treated as plain text, no card generated | Toolbar button helps fix syntax |
| More than 20 cloze numbers in one note | Warning: "This note generates 25 cards. Consider splitting into multiple notes." | User can proceed or split |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a cloze note with "{{c1::Paris}} is the capital of {{c2::France}}",
   **When** the note is saved,
   **Then** 2 cards are created: card 1 hides "Paris", card 2 hides "France."

2. **Given** a cloze card with hint "{{c1::mitochondria::organelle}}",
   **When** card 1 is shown during study,
   **Then** the front displays "[organelle]" instead of "[...]."

3. **Given** the user selects text and taps the cloze toolbar button,
   **When** no cloze markers exist yet,
   **Then** selected text is wrapped in `{{c1::selected text}}`.

**Edge Cases:**

4. **Given** cloze numbers c1 and c3 (no c2),
   **When** the note is saved,
   **Then** exactly 2 cards are created with ordinals 0 and 2.

5. **Given** two instances of `{{c1::word}}` in the same note,
   **When** card 1 is shown,
   **Then** both instances are hidden on the same card.

**Negative Tests:**

6. **Given** text with no cloze markers,
   **When** the user saves as a Cloze type,
   **Then** validation rejects the save with "Add at least one cloze deletion."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses single cloze marker | "{{c1::Paris}} is great" | 1 cloze, number=1, answer="Paris" |
| parses multiple cloze markers | "{{c1::A}} and {{c2::B}}" | 2 clozes, numbers [1, 2] |
| parses cloze with hint | "{{c1::Paris::city}}" | answer="Paris", hint="city" |
| renders front with blank | text with c1, active=1 | c1 replaced with "[...]" |
| renders front with hint | "{{c1::X::hint}}", active=1 | Shows "[hint]" |
| renders back with highlight | text with c1, active=1 | c1 replaced with highlighted answer |
| non-active clozes show plain text | c1 and c2, active=1 | c2 shows plain answer text |
| rejects empty cloze answer | "{{c1::}}" | Validation error |

---

### FL-009: Rich Media Cards

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-009 |
| **Feature Name** | Rich Media Cards |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a language learner, I want to add audio pronunciation clips to my vocabulary cards, so that I can practice listening comprehension alongside reading.

**Secondary:**
> As a medical student, I want to add anatomical images to my cards, so that I can study visual material alongside text descriptions.

#### 3.3 Detailed Description

Rich Media Cards extends the card creation system to support embedded images and audio clips within card content. Users can add media to either side of a card (front, back, or both). Images are displayed inline within card content. Audio clips are represented by a play button that triggers playback when tapped.

Supported image formats: JPEG, PNG, GIF, WebP, SVG. Maximum image size: 10MB per file. Images are resized to a maximum dimension of 2048px on the longest side to conserve storage.

Supported audio formats: MP3, M4A, WAV, OGG. Maximum audio file size: 50MB per file. Audio clips display a play/pause button with a progress bar and duration indicator.

Media files are stored in a local media directory on the device. Each file is renamed to a SHA256 hash of its contents to enable deduplication. Card content references media by a tag: `<img src="media/hash.ext">` for images and `[sound:hash.ext]` for audio (compatible with Anki's format).

Users add media via the card editor toolbar (camera icon for images, microphone icon for audio). Image sources include: device photo library, camera capture, and file picker. Audio sources include: device file picker and in-app voice recording.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card editor must exist

**External Dependencies:**
- Camera access permission (for photo capture)
- Photo library access permission (for image selection)
- Microphone access permission (for voice recording)
- File system storage for media files

**Assumed Capabilities:**
- Device has camera and microphone hardware
- Sufficient storage space for media files

#### 3.5 User Interface Requirements

##### Component: Media Toolbar (extension of Card Editor)

**Layout:**
- Toolbar row below the card content fields with buttons:
  - Image button (camera icon): Opens image source picker (Photo Library, Camera, File)
  - Audio button (microphone icon): Opens audio source picker (Files, Record)
  - Media gallery button: Shows all media attached to this card for management
- When an image is added, it appears inline in the content field as a thumbnail with a delete "X" button
- When an audio clip is added, it appears as a playback widget (play button + filename + duration)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Media | Card has no media | Toolbar icons in default state |
| Has Images | Card has 1+ images | Image thumbnails inline in content, media count badge on toolbar |
| Has Audio | Card has 1+ audio clips | Audio widgets inline in content, media count badge on toolbar |
| Recording | User is recording audio | Red recording indicator with waveform and stop button |
| Processing | Image is being resized or audio is being compressed | Small spinner on the media item |

**Interactions:**
- Tap image button: Shows source picker (Photo Library / Camera / Files)
- Tap audio button: Shows source picker (Files / Record New)
- Tap image thumbnail in content: Opens full-size image viewer
- Tap "X" on media item: Removes media from card (with confirmation if card has been studied)
- Tap play button on audio widget: Plays audio clip
- Long press media item: Shows options (Replace, Delete, View Full Size)

##### Component: Audio Recorder

**Layout:**
- Modal with large red record button (center)
- Waveform visualization during recording
- Timer showing recording duration
- "Stop" button replaces "Record" during active recording
- After recording: play button to preview, "Save" and "Discard" buttons

#### 3.6 Data Requirements

##### Entity: MediaFile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique media file identifier |
| hash | string | Required, unique, SHA256 | None | Content hash for deduplication |
| filename | string | Required, max 255 chars | None | Original filename |
| media_type | enum | One of: image, audio | None | Type of media |
| mime_type | string | Required | None | MIME type (e.g., "image/jpeg", "audio/mp3") |
| file_size_bytes | integer | Min: 0 | None | File size in bytes |
| width | integer | Nullable, Min: 1 | null | Image width in pixels (null for audio) |
| height | integer | Nullable, Min: 1 | null | Image height in pixels (null for audio) |
| duration_ms | integer | Nullable, Min: 0 | null | Audio duration in milliseconds (null for images) |
| local_path | string | Required | None | Relative path to file in local media directory |
| reference_count | integer | Min: 0 | 1 | Number of cards referencing this file |
| created_at | datetime | Auto-set | Current timestamp | When file was added |

**Relationships:**
- MediaFile is referenced by many Cards (many-to-many via content references)

**Indexes:**
- (hash) - deduplication lookup
- (media_type) - filter by type

**Validation Rules:**
- Image file size must not exceed 10MB (10,485,760 bytes)
- Audio file size must not exceed 50MB (52,428,800 bytes)
- Image dimensions are resized if longest side exceeds 2048px
- Audio files exceeding 5 minutes display a warning but are allowed

#### 3.7 Business Logic Rules

##### Media Storage and Deduplication

**Purpose:** Store media files efficiently with content-based deduplication.

**Inputs:**
- file: binary data - the media file contents
- original_name: string - original filename

**Logic:**

```
1. Compute SHA256 hash of file contents
2. IF a MediaFile with this hash already exists:
     Increment reference_count on existing file
     RETURN existing file reference (no duplicate storage)
3. ELSE:
     a. Determine media_type from MIME type
     b. IF image:
          - Validate format (JPEG, PNG, GIF, WebP, SVG)
          - IF longest side > 2048px: Resize proportionally to 2048px max
          - Re-encode as JPEG (quality 85) for raster formats, keep SVG as-is
     c. IF audio:
          - Validate format (MP3, M4A, WAV, OGG)
          - Extract duration
     d. Save file to media directory as: hash[0:2]/hash[2:4]/hash.ext
        (two-level directory for filesystem performance)
     e. Create MediaFile record
     f. RETURN new file reference
```

##### Media Cleanup

**Purpose:** Remove orphaned media files that are no longer referenced by any card.

**Logic:**

```
1. Query all MediaFile records where reference_count <= 0
2. FOR EACH orphaned file:
   a. Verify no card content contains a reference to this file (safety check)
   b. Delete the file from disk
   c. Delete the MediaFile record
3. Run on app launch and after card deletion
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image exceeds 10MB | Toast: "Image exceeds 10MB limit. Choose a smaller image." | User selects a different image |
| Unsupported format | Toast: "This format is not supported. Use JPEG, PNG, GIF, or WebP." | User selects a supported format |
| Storage full | Alert: "Not enough storage space for this file." | User frees storage |
| Camera permission denied | Alert with link to system settings | User grants permission in Settings |
| Audio recording fails | Toast: "Recording failed. Check microphone access." | User checks permissions |
| Media file missing on disk | Placeholder shown in card ("Image not found") | Media cleanup runs, user can re-add media |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the image button on the card editor,
   **When** they select a photo from their library,
   **Then** the image appears inline in the card content as a thumbnail, and is stored locally.

2. **Given** the user taps Record on the audio recorder,
   **When** they record a 5-second clip and tap Save,
   **Then** an audio widget appears in the card content with a play button and "0:05" duration.

3. **Given** the same image is added to two different cards,
   **When** the second card references the image,
   **Then** only one copy is stored on disk (deduplicated by hash).

**Edge Cases:**

4. **Given** an image with dimensions 4000x3000,
   **When** added to a card,
   **Then** it is resized to 2048x1536 before storage.

**Negative Tests:**

5. **Given** a 15MB image file,
   **When** the user tries to add it,
   **Then** the app rejects it with "Image exceeds 10MB limit."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes SHA256 hash correctly | Known file bytes | Expected hash string |
| deduplicates identical files | Same file added twice | reference_count = 2, one file on disk |
| resizes oversized image | 4000x3000 image | Resized to 2048x1536 |
| rejects file exceeding size limit | 15MB image | Validation error |
| extracts audio duration | 5-second MP3 | duration_ms = 5000 |
| cleanup removes orphaned files | File with reference_count 0 | File deleted from disk and database |

---

### FL-010: Image Occlusion

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-010 |
| **Feature Name** | Image Occlusion |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a medical student studying anatomy, I want to hide labeled parts of a diagram and test myself on identifying each part, so that I can learn anatomical structures from visual material.

**Secondary:**
> As a geography student, I want to hide countries on a map and test myself on their locations, so that I can memorize geographic relationships spatially.

#### 3.3 Detailed Description

Image Occlusion allows users to take an image and place rectangular or freeform masks over specific regions. Each mask becomes a separate flashcard: during study, one mask is opaque (hiding that region) while all other masks are semi-transparent, and the user must recall what is hidden under the opaque mask.

The creation flow is: select an image, use an interactive editor to draw masks over regions, optionally label each mask, and save. The system generates one card per mask. For example, an anatomy diagram with 12 labeled structures produces 12 cards, each hiding one structure.

Two occlusion modes are supported:
- **Hide One, Reveal Others:** One mask is opaque per card, all others show their labels (default). Best for learning individual items from a set.
- **Hide All, Reveal One:** All masks are opaque except one, which reveals the answer. Best for testing recall of a full set.

The image editor supports: rectangular masks (tap and drag), freeform polygon masks (sequential taps to define vertices), mask color selection, label text for each mask, undo/redo, zoom and pan on the image, and mask reordering.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card entity must exist
- FL-009: Rich Media Cards - image storage infrastructure required

**External Dependencies:**
- Touch/pointer input for drawing masks
- Sufficient processing power for image compositing

**Assumed Capabilities:**
- Canvas or equivalent drawing surface is available
- Image can be rendered at sufficient resolution for mask placement

#### 3.5 User Interface Requirements

##### Screen: Image Occlusion Editor

**Layout:**
- Top bar with "Cancel" (left), "Image Occlusion" title (center), "Save" (right)
- Main area: The selected image displayed with pinch-to-zoom and pan
- Overlay: Drawn masks appear as colored semi-transparent rectangles/polygons on the image
- Toolbar at bottom:
  - Rectangle tool (default): Draw rectangular masks by tapping and dragging
  - Polygon tool: Draw freeform masks by tapping vertices, double-tap to close
  - Select tool: Tap to select, move, resize, or delete existing masks
  - Undo / Redo buttons
  - Color picker for mask color
- Mode toggle: "Hide One" | "Hide All" (switches occlusion mode)
- Mask list panel (collapsible, bottom sheet): List of all masks with labels, reorderable
- Card count indicator: "12 cards will be created"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Image Loaded | Image selected, no masks | Image displayed with "Draw masks over areas to study" hint |
| Drawing | User is creating a mask | Active mask follows finger/cursor with dashed border |
| Masks Placed | One or more masks exist | Masks shown as colored semi-transparent overlays with labels |
| Preview | User previewing a card | One mask opaque, others semi-transparent, shows how card will look |
| No Image | User has not selected an image | Image picker prompt |

**Interactions:**
- Tap and drag (rectangle tool): Creates a rectangular mask
- Sequential taps (polygon tool): Places polygon vertices; double-tap closes the shape
- Tap mask (select tool): Selects mask, shows resize handles and delete button
- Double-tap mask: Opens label editor for that mask
- Pinch: Zoom in/out on image
- Two-finger pan: Scroll around zoomed image
- Tap mask in list panel: Scrolls to and highlights that mask on the image
- Drag mask in list panel: Reorders mask (changes card ordinal)
- Tap "Preview": Shows a carousel of all generated cards in study format

#### 3.6 Data Requirements

##### Entity: OcclusionMask

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique mask identifier |
| note_id | string | Foreign key to Note.id, required | None | Parent note |
| ordinal | integer | Min: 0 | Auto-assigned | Order of this mask (determines card ordinal) |
| shape_type | enum | One of: rectangle, polygon | rectangle | Type of mask shape |
| shape_data | text | JSON object | None | Shape coordinates (see below) |
| label | string | Optional, max 200 chars | "" | Text label for this mask region |
| color | string | Hex color code | "#FF4444" | Mask fill color |

**Shape Data Formats:**

```json
// Rectangle
{
  "type": "rectangle",
  "x": 0.25,
  "y": 0.10,
  "width": 0.15,
  "height": 0.08
}
// Coordinates are proportional (0.0-1.0) relative to image dimensions

// Polygon
{
  "type": "polygon",
  "points": [
    {"x": 0.25, "y": 0.10},
    {"x": 0.40, "y": 0.10},
    {"x": 0.35, "y": 0.25}
  ]
}
```

**Relationships:**
- OcclusionMask belongs to Note (many-to-one via mask.note_id)
- Each OcclusionMask corresponds to one Card (one-to-one via card ordinal matching mask ordinal)

#### 3.7 Business Logic Rules

##### Occlusion Card Rendering

**Purpose:** Render an image occlusion card for study display.

**Inputs:**
- image: binary - the base image
- masks: OcclusionMask[] - all masks for this note
- active_ordinal: integer - which mask is being tested
- mode: "hide_one" | "hide_all"

**Logic:**

```
1. Start with the base image
2. IF mode == "hide_one":
   FOR EACH mask:
     IF mask.ordinal == active_ordinal:
       FRONT: Draw mask as opaque fill (solid color, no label visible)
       BACK: Draw mask as semi-transparent fill with label visible
     ELSE:
       BOTH: Draw mask as semi-transparent fill with label visible (context)
3. ELSE IF mode == "hide_all":
   FOR EACH mask:
     IF mask.ordinal == active_ordinal:
       FRONT: Draw mask as opaque fill (solid color, no label)
       BACK: Draw mask as semi-transparent fill with label visible
     ELSE:
       FRONT: Draw mask as opaque fill (solid color, no label)
       BACK: Draw mask as semi-transparent fill with label visible
4. RETURN { front_image, back_image }
```

**Edge Cases:**
- Overlapping masks: Later masks render on top. During study, if two masks overlap and one is active, the active mask's opacity takes precedence in the overlap zone
- Very small masks (< 5% of image area): Warning during creation but allowed
- Image without any masks: Validation error on save

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No masks drawn on save | Validation: "Add at least one mask to create occlusion cards" | User draws masks |
| Image fails to load | Error: "Could not load image. Try a different file." | User selects a new image |
| Mask coordinates outside image bounds | Silently clamp to image boundaries | Automatic correction |
| Very large image (>20MP) | Warning: "Large image may be slow to edit. Continue?" | User can proceed or select a smaller image |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects an anatomy diagram and draws 5 rectangular masks over labeled structures,
   **When** they save,
   **Then** 5 cards are created, each hiding one structure during study.

2. **Given** the occlusion mode is "Hide One, Reveal Others,"
   **When** studying card 3,
   **Then** mask 3 is opaque and all other masks show their labels as context.

3. **Given** the user adds a label "Femur" to a mask,
   **When** the answer is revealed during study,
   **Then** "Femur" appears on the mask in the revealed view.

**Edge Cases:**

4. **Given** two overlapping masks,
   **When** studying the card for the bottom mask,
   **Then** the bottom mask is fully opaque, and the overlapping region of the top mask is semi-transparent.

**Negative Tests:**

5. **Given** an image with no masks drawn,
   **When** the user taps Save,
   **Then** validation rejects with "Add at least one mask."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates correct card count | 5 masks | 5 cards created |
| proportional coordinates normalize correctly | Image 1000x500, mask at pixel (250, 50, 150, 80) | Proportional (0.25, 0.10, 0.15, 0.16) |
| hide-one mode renders correctly | 3 masks, active=1 | Mask 1 opaque, masks 0 and 2 semi-transparent |
| hide-all mode renders correctly | 3 masks, active=1 | Mask 1 semi-transparent (revealed), masks 0 and 2 opaque |
| clamps out-of-bounds coordinates | Mask extends beyond image edge | Coordinates clamped to [0.0, 1.0] |

---

### FL-011: Custom Card Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-011 |
| **Feature Name** | Custom Card Templates |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a power user, I want to customize how my cards look during study by editing HTML/CSS templates, so that I can create specialized layouts for different study materials (vocabulary tables, code snippets, mathematical formulas).

**Secondary:**
> As a user importing Anki decks, I want imported card templates to render correctly, so that cards with custom formatting look as intended.

#### 3.3 Detailed Description

Custom Card Templates allows users to create and edit NoteModel templates that control the visual layout and styling of cards during study. Each NoteModel defines one or more templates with front and back formats using field placeholders (e.g., `{{Front}}`, `{{Back}}`) and optional HTML/CSS styling.

The template editor provides a split-pane or tabbed view: one pane for editing the template code (front format, back format, CSS), and another for live preview showing how a card will render with sample data. Users can create new NoteModels with custom field sets and multiple templates.

Templates support standard HTML, CSS, and field substitution syntax compatible with Anki's template system. This includes conditional display (`{{#FieldName}}...{{/FieldName}}` to show content only if the field is non-empty), special tags like `{{FrontSide}}` (renders the front on the back), and `{{hint:FieldName}}` (shows content behind a "Show Hint" link).

Built-in templates (Basic, Reversed, Cloze) cannot be deleted but can be duplicated and customized. Users can share custom templates by exporting them as JSON files.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards and notes must exist
- FL-002: Card Types - NoteModel system must be functional

**External Dependencies:**
- HTML/CSS rendering engine for card display

**Assumed Capabilities:**
- Text editor with syntax highlighting is available
- Cards can render HTML content safely (sanitized, no script execution)

#### 3.5 User Interface Requirements

##### Screen: Template Editor

**Layout:**
- Top bar: "Cancel" (left), NoteModel name (center, editable), "Save" (right)
- Tab bar below: "Fields" | "Front Template" | "Back Template" | "Styling"
- Fields tab: Ordered list of field definitions (name, ordinal), add/remove/reorder buttons
- Front/Back Template tabs: Code editor with monospace font, field insertion toolbar, live preview below
- Styling tab: CSS editor with monospace font, applies to all cards of this model
- Preview area (bottom 40% or toggled): Renders a card with sample data, tap to flip between front and back

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Editing Fields | Fields tab active | List of fields with add/remove/reorder controls |
| Editing Template | Front or Back tab active | Code editor with field toolbar, live preview |
| Editing CSS | Styling tab active | CSS code editor, preview updates in real-time |
| Preview | Preview expanded | Full-size card preview with front/back flip |
| Validation Error | Template syntax error | Error highlight in code editor, error message below |

**Interactions:**
- Tap field in toolbar: Inserts `{{FieldName}}` at cursor position in template editor
- Tap preview area: Flip between front and back preview
- Reorder fields: Drag-and-drop in fields list
- Add field: "+" button, enter field name
- Delete field: Swipe left on field row (with warning if field is used in templates)

#### 3.6 Data Requirements

NoteModel entity is already defined in FL-002. Custom Card Templates extends usage by allowing user-created models.

**Additional validation for user-created models:**
- Model name: Required, max 100 chars, unique
- Fields: Minimum 1 field, maximum 20 fields
- Templates: Minimum 1 template, maximum 10 templates
- CSS: Maximum 50,000 characters
- Template front/back format: Maximum 50,000 characters each

#### 3.7 Business Logic Rules

##### Template Rendering Engine

**Purpose:** Render card content from a template and note field values.

**Inputs:**
- template: { front_format, back_format } - the template definition
- fields: { name: string, value: string }[] - field values from the note
- css: string - shared CSS for the model

**Logic:**

```
1. Start with the template format string (front or back)
2. Substitute field placeholders:
   a. {{FieldName}} -> Replace with field value (HTML content, not escaped)
   b. {{FrontSide}} -> Replace with the fully rendered front content (back template only)
3. Process conditional sections:
   a. {{#FieldName}}...{{/FieldName}} -> Show content only if FieldName is non-empty
   b. {{^FieldName}}...{{/FieldName}} -> Show content only if FieldName is empty
4. Process special tags:
   a. {{hint:FieldName}} -> Render as a "Show Hint" link that reveals content on tap
   b. {{type:FieldName}} -> Render as a text input for typed answers (compare on reveal)
   c. {{cloze:FieldName}} -> Delegate to cloze rendering engine (FL-008)
5. Wrap result in HTML document with CSS applied
6. Sanitize: Remove <script> tags and javascript: URLs (security)
7. RETURN rendered HTML string
```

**Edge Cases:**
- Field referenced in template does not exist: Render as empty string
- Recursive {{FrontSide}} (front template references FrontSide): Detect and break recursion
- Empty template: Render an empty card (valid, user may be testing)
- CSS syntax errors: Apply what parses, ignore invalid rules

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Template references nonexistent field | Preview shows empty where field would be, warning icon | User adds the field or fixes template |
| CSS has syntax errors | Preview renders with partial CSS, error indicator in CSS editor | User fixes CSS |
| Template has unclosed conditional tag | Inline error in editor at the unclosed tag position | User closes the tag |
| Deleting a field used in templates | Warning: "This field is used in 2 templates. Remove references first or remove anyway?" | User chooses action |
| Built-in model deletion attempted | Delete option is hidden for built-in models | User can duplicate and modify instead |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a custom NoteModel with fields "Word," "Translation," "Example Sentence,"
   **When** they save a template showing Word on front and Translation + Example on back,
   **Then** new notes created with this model display correctly during study.

2. **Given** a template with conditional `{{#Example}}{{Example}}{{/Example}}`,
   **When** a note has an empty Example field,
   **Then** the conditional section is hidden on the rendered card.

3. **Given** the user edits the CSS of a model,
   **When** they change the font size to 24px,
   **Then** all cards of that model immediately render with the new font size.

**Edge Cases:**

4. **Given** a template with `{{hint:Mnemonic}}`,
   **When** the card is shown during study,
   **Then** a "Show Hint" link appears, and tapping it reveals the Mnemonic field content.

**Negative Tests:**

5. **Given** the user tries to delete a built-in model (Basic),
   **When** they look for the delete option,
   **Then** it is not available. A "Duplicate" option is offered instead.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| substitutes field placeholders | Template "{{Front}}", field "Hello" | "Hello" |
| renders FrontSide on back template | Front="Q", Back template="{{FrontSide}}<hr>{{Back}}" | "Q<hr>A" |
| conditional shows content for non-empty field | "{{#Extra}}{{Extra}}{{/Extra}}", Extra="note" | "note" |
| conditional hides content for empty field | "{{#Extra}}{{Extra}}{{/Extra}}", Extra="" | "" (empty) |
| inverted conditional shows for empty | "{{^Extra}}No extra{{/Extra}}", Extra="" | "No extra" |
| hint tag renders as link | "{{hint:Hint}}", Hint="memory aid" | Show Hint link, reveals "memory aid" on tap |
| strips script tags | Template with `<script>alert(1)</script>` | Script removed from output |
| detects recursive FrontSide | Front template contains {{FrontSide}} | Recursion broken, renders once |

---

### FL-012: Tag-Based Organization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-012 |
| **Feature Name** | Tag-Based Organization |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a student studying multiple topics, I want to tag my cards with labels like "exam-2" or "chapter-5," so that I can create filtered study sessions across deck boundaries.

**Secondary:**
> As an Anki user, I want my imported tags preserved and usable, so that my existing organization transfers seamlessly.

#### 3.3 Detailed Description

Tag-Based Organization provides a cross-deck labeling system for notes. Tags are space-separated strings stored on each note. Tags support hierarchical namespacing using `::` separator (e.g., "course::biology::exam1"). Tags are case-insensitive and normalized to lowercase on storage.

Tags serve two primary purposes: (1) organizing notes across decks for browsing and filtering in the Card Browser (FL-013), and (2) creating filtered study sessions that pull cards matching specific tag criteria (FL-019 Study Session Options).

The tag management interface includes: adding tags during card creation, bulk-tagging selected cards in the card browser, viewing all tags in a tag cloud/list view, renaming and deleting tags globally, and filtering cards by tag with AND/OR logic.

Tags imported from Anki decks are preserved as-is. The system auto-suggests existing tags as the user types, preventing typos and promoting tag reuse.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - notes must exist for tag attachment
- FL-003: Deck Organization - tags complement deck-based organization

**External Dependencies:**
- None

**Assumed Capabilities:**
- Note entity has a tags field (space-separated string)

#### 3.5 User Interface Requirements

##### Component: Tag Input (embedded in Card Creation and Card Browser)

**Layout:**
- Horizontal scrollable row of tag chips below the card content fields
- Text input at the end of the chip row for adding new tags
- Each chip shows the tag name with an "X" button to remove
- Auto-suggest dropdown appears below the input showing matching existing tags as the user types

**Interactions:**
- Type in tag input: Auto-suggest dropdown filters to matching tags
- Tap suggestion: Adds that tag as a chip
- Press Enter/Space: Adds current text as a new tag chip
- Tap "X" on chip: Removes tag from this note
- Long press chip: Shows tag options (Rename across all notes, Delete from all notes)

##### Screen: Tag Manager (accessible from Settings or Card Browser)

**Layout:**
- Top bar with "Tags" title and search bar
- Scrollable list of all tags, each row showing: tag name, usage count (number of notes with this tag)
- Tags sorted alphabetically by default, with option to sort by usage count
- Hierarchical tags (with "::") displayed in tree format with expand/collapse

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tags exist | Message: "Tags appear here as you add them to cards" |
| Populated | Tags exist | Scrollable tag list with usage counts |
| Search Active | User is searching | Filtered list matching search query |

**Interactions:**
- Tap tag: Opens Card Browser filtered to that tag
- Swipe left on tag: Reveals "Rename" and "Delete" buttons
- Tap "Delete": Confirmation dialog with count of affected notes, removes tag from all notes
- Tap "Rename": Inline edit field, renames tag across all notes on confirm

#### 3.6 Data Requirements

Tags are stored as a space-separated string on the Note entity (already defined in FL-001). No separate Tag entity is needed, but a tag index is maintained for performance.

##### Entity: TagIndex (derived/cached)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| tag | string | Primary key, lowercase | None | Normalized tag string |
| note_count | integer | Min: 0 | 0 | Number of notes with this tag |
| last_used_at | datetime | Auto-updated | Current timestamp | When this tag was last applied to a note |

**Indexes:**
- (tag) - primary lookup
- (note_count) - sort by popularity

**Validation Rules:**
- Tags are normalized to lowercase before storage
- Leading/trailing whitespace is trimmed
- Tags must not be empty strings
- Tags must not contain spaces (use hyphens or underscores for multi-word tags)
- Maximum 100 tags per note

#### 3.7 Business Logic Rules

##### Tag Normalization

**Purpose:** Ensure consistent tag storage and matching.

**Inputs:**
- raw_tag: string - user-entered tag text

**Logic:**

```
1. Trim leading and trailing whitespace
2. Convert to lowercase
3. Replace multiple consecutive spaces with single hyphen
4. Remove characters that are not alphanumeric, hyphen, underscore, or "::"
5. IF result is empty: REJECT
6. RETURN normalized tag
```

##### Tag Auto-suggestion

**Purpose:** Suggest existing tags as the user types for consistency.

**Inputs:**
- prefix: string - what the user has typed so far
- limit: integer - max suggestions (default: 10)

**Logic:**

```
1. Normalize prefix
2. Query TagIndex WHERE tag STARTS WITH prefix
3. Sort by note_count descending (most popular first)
4. Limit to top N results
5. RETURN suggestions
```

##### Bulk Tag Operations

**Purpose:** Add or remove a tag from multiple notes at once.

**Inputs:**
- note_ids: string[] - notes to modify
- tag: string - tag to add or remove
- operation: "add" | "remove"

**Logic:**

```
1. Normalize tag
2. FOR EACH note_id:
   a. Load note
   b. Parse tags string into array
   c. IF operation == "add" AND tag NOT IN array:
        Append tag to array
   d. IF operation == "remove" AND tag IN array:
        Remove tag from array
   e. Join array back to space-separated string
   f. Save note
3. Rebuild TagIndex counts
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Tag contains invalid characters | Characters silently stripped during normalization | User sees cleaned tag |
| Duplicate tag on same note | Silently ignored (idempotent) | No error |
| Renaming a tag to an existing tag name | Merge confirmation: "Tag 'new-name' already exists. Merge X notes?" | User confirms merge or picks different name |
| Deleting a tag used by many notes | Confirmation: "Remove tag from 150 notes? This cannot be undone." | User confirms or cancels |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types "biology" in the tag input during card creation,
   **When** a tag "biology" already exists on other notes,
   **Then** it appears as an auto-suggestion, and tapping it adds the tag chip.

2. **Given** a user in the Tag Manager views the tag "exam::midterm" with 45 notes,
   **When** they tap the tag,
   **Then** the Card Browser opens filtered to show those 45 notes.

3. **Given** the user renames tag "bio" to "biology" in the Tag Manager,
   **When** the rename completes,
   **Then** all notes previously tagged "bio" now have "biology" instead, and the TagIndex is updated.

**Edge Cases:**

4. **Given** the user adds the same tag twice to a note,
   **When** the note saves,
   **Then** the tag appears only once (deduplication).

5. **Given** a tag with mixed case "Biology" is entered,
   **When** stored,
   **Then** it is normalized to "biology."

**Negative Tests:**

6. **Given** the user tries to create a tag that is only whitespace,
   **When** normalized,
   **Then** it is rejected (no empty tags).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes to lowercase | "Biology" | "biology" |
| trims whitespace | "  exam  " | "exam" |
| replaces spaces with hyphens | "chapter 5" | "chapter-5" |
| rejects empty after normalization | "   " | Validation error |
| auto-suggest returns matches | prefix="bio", existing=["biology","biochem","math"] | ["biochem","biology"] |
| deduplicates tags on note | tags="a b a" | tags="a b" |
| bulk add to multiple notes | 3 notes, add "exam" | All 3 notes have "exam" tag |
| bulk remove from multiple notes | 3 notes with "exam", remove "exam" | None have "exam" tag |

---

### FL-013: Card Browser

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-013 |
| **Feature Name** | Card Browser |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a power user with thousands of cards, I want to search, filter, and manage my entire card collection in a single view, so that I can find specific cards, fix errors, and bulk-edit tags or deck assignments.

**Secondary:**
> As a student, I want to see all cards that are "leeches" (high lapse count), so that I can identify problem cards and rewrite or delete them.

#### 3.3 Detailed Description

The Card Browser is a full-featured management interface for the user's entire card collection. It presents cards in a searchable, filterable, sortable table/list view. Users can search by card content (front, back, any field), filter by deck, tag, card state, card type, or flag status, and sort by various criteria.

The browser supports multi-select for bulk operations: move to deck, add/remove tags, suspend/unsuspend, delete, reschedule, and change card type. Individual cards can be tapped to open an inline editor or navigate to the card editor screen.

Search uses full-text search (FTS) across all note fields. Filter syntax supports Anki-compatible search operators:
- `deck:Spanish` - cards in deck
- `tag:exam` - cards with tag
- `is:new` / `is:learn` / `is:review` / `is:due` / `is:suspended` / `is:buried`
- `prop:lapses>5` - property comparisons
- `flag:1` - flagged cards
- Combinations: `deck:Spanish tag:verb is:due`

The browser is accessible from the main navigation (Tab 2) and as a modal when selecting cards for filtered decks or bulk operations.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist
- FL-003: Deck Organization - deck filtering
- FL-012: Tag-Based Organization - tag filtering

**External Dependencies:**
- Full-text search capability (FTS5 or equivalent)

**Assumed Capabilities:**
- Database supports FTS indexing on note fields
- Efficient query execution for large card collections (50,000+ cards)

#### 3.5 User Interface Requirements

##### Screen: Card Browser (Tab 2 - Browse)

**Layout:**
- Top bar with "Browse" title, search icon, and multi-select toggle button
- Search bar below the top bar (expands on tap) with auto-complete for filter syntax
- Filter chip row below search: Quick filters for "Due Now," "New," "Suspended," "Leeches"
- Deck scope dropdown: "All Decks" or specific deck
- Card list: Scrollable list of cards, each row showing:
  - Card front text (truncated to 1 line, max 80 characters)
  - Deck name (small, secondary text)
  - Card state badge (New/Learning/Review/Suspended)
  - Due date (if applicable)
  - Flag indicator (colored dot if flagged)
- Sort controls: Accessible via button, options: "Created Date," "Due Date," "Interval," "Ease/Difficulty," "Lapses," "Alphabetical"
- Bottom toolbar (visible in multi-select mode): Move, Tag, Suspend, Delete buttons with selected count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | No search or filter active | All cards listed, sorted by creation date (newest first) |
| Search Active | User entered search query | Filtered list with match highlights in card text |
| Filtered | Quick filter or advanced filter applied | Filter chips highlighted, filtered list |
| Multi-Select | Multi-select mode enabled | Checkboxes on each row, bottom toolbar visible, selection count |
| Empty Results | Search/filter returns no cards | "No cards match your search" with suggestions to broaden criteria |
| Loading | Large query processing | Skeleton rows with loading animation |

**Interactions:**
- Tap card row: Opens card detail/editor inline or full-screen
- Long press card row: Enters multi-select mode with that card selected
- Tap checkbox (multi-select): Toggles selection for that card
- Tap "Select All": Selects all visible (filtered) cards
- Tap filter chip: Toggles that filter on/off
- Tap sort button: Opens sort options menu
- Swipe left on card: Reveals Suspend and Delete quick actions
- Pull down: Refreshes card list

##### Component: Search Syntax Auto-complete

**Layout:**
- Dropdown below search bar showing recognized operators as user types
- When user types "deck:", shows list of deck names
- When user types "tag:", shows list of tags
- When user types "is:", shows state options (new, learn, review, due, suspended, buried)
- When user types "prop:", shows property options (lapses, interval, difficulty, reps)

#### 3.6 Data Requirements

No new entities. The Card Browser queries existing Card, Note, Deck, and TagIndex entities.

**FTS Index:**
- Note fields are indexed in a full-text search table
- FTS index updated on note create, edit, and delete
- Search tokenization: word-level with prefix matching ("bio*" matches "biology")

**Query Performance Requirements:**
- Search across 50,000 cards: results within 200ms
- Filter by deck + state: results within 100ms
- Sort by any column: results within 300ms

#### 3.7 Business Logic Rules

##### Search Query Parsing

**Purpose:** Parse user search input into structured query parameters.

**Inputs:**
- query: string - raw search input

**Logic:**

```
1. Tokenize input by spaces (respecting quoted strings)
2. FOR EACH token:
   a. IF token matches "deck:VALUE": Add deck filter
   b. IF token matches "tag:VALUE": Add tag filter
   c. IF token matches "is:STATE": Add state filter
   d. IF token matches "prop:FIELD>N" or "prop:FIELD<N": Add property filter
   e. IF token matches "flag:N": Add flag filter
   f. IF token starts with "-": Negate the filter (exclude matching cards)
   g. ELSE: Add as full-text search term
3. Combine all filters with AND logic
4. Full-text terms are combined with AND (all must match)
5. RETURN structured query object
```

**Edge Cases:**
- Empty query: Return all cards
- Invalid operator: Treat as plain text search
- Quoted string "multi word search": Search as exact phrase
- Negation: `-tag:exam` excludes cards tagged "exam"

##### Leech Detection

**Purpose:** Identify cards with excessive lapses that may need rewriting.

**Logic:**

```
1. A card is a "leech" if card.lapses >= leech_threshold (default: 8)
2. Leech cards are flagged with a leech indicator in the browser
3. Filter "Leeches" shows all cards where lapses >= leech_threshold
4. Leech threshold is configurable in settings (FL-026)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS index corrupted | Alert: "Search index needs rebuilding" with "Rebuild" button | Rebuild FTS index from note data |
| Search query syntax error | Invalid operator highlighted in red, plain text fallback | User corrects syntax or uses plain text search |
| Bulk delete of many cards | Confirmation: "Delete 150 cards? This cannot be undone." | User confirms or cancels |
| Bulk operation fails partway | Toast: "Moved 45 of 50 cards. 5 failed." with "View Failures" link | User retries failed cards |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types "mitochondria" in the search bar,
   **When** matching cards exist,
   **Then** all cards containing "mitochondria" in any field appear in the results with the match term highlighted.

2. **Given** the user enters "deck:Biology is:due tag:exam",
   **When** the search executes,
   **Then** only cards in the Biology deck that are due today with the "exam" tag are shown.

3. **Given** the user selects 10 cards in multi-select mode and taps "Move,"
   **When** they choose a destination deck,
   **Then** all 10 cards are moved and the list updates.

**Edge Cases:**

4. **Given** a collection of 50,000 cards,
   **When** the user searches for a common term,
   **Then** results appear within 200ms.

5. **Given** the user applies the "Leeches" filter,
   **When** 15 cards have 8+ lapses,
   **Then** exactly 15 cards are shown.

**Negative Tests:**

6. **Given** a search query with invalid syntax "deck:",
   **When** executed,
   **Then** the system treats it as plain text search for "deck:" and shows a syntax hint.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses deck filter | "deck:Biology" | { deck: "Biology" } |
| parses tag filter | "tag:exam" | { tag: "exam" } |
| parses state filter | "is:due" | { state: "due" } |
| parses property comparison | "prop:lapses>5" | { property: "lapses", op: ">", value: 5 } |
| parses combined filters | "deck:Bio tag:exam is:due" | All three filters combined |
| parses negation | "-tag:ignore" | { tag: "ignore", negate: true } |
| plain text falls through | "mitochondria" | { fts: "mitochondria" } |
| leech detection threshold | card with 8 lapses, threshold 8 | Is leech = true |

---

### FL-014: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-014 |
| **Feature Name** | Streak Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a learner, I want to see how many consecutive days I have studied, so that I feel motivated to maintain my daily habit.

**Secondary:**
> As a goal-oriented student, I want to set a daily review target and see whether I have met it each day, so that I have a concrete metric to work toward.

#### 3.3 Detailed Description

Streak Tracking gamifies daily study consistency by counting consecutive days the user has completed at least one review (or met their configurable daily target). The streak counter is prominently displayed on the deck browser and study statistics screens.

A streak day is defined by completing at least N reviews in a calendar day (local time). The default threshold is 1 review, but users can set a higher minimum (e.g., 20 reviews) in settings. Streaks reset to 0 if the user misses a full calendar day without meeting the threshold.

The system tracks: current streak (consecutive days), longest streak (all-time record), total days studied, and a calendar view showing study days. A streak freeze feature allows users to protect their streak for one missed day (maximum 2 freeze days banked, earned by completing 7-day streaks).

Streak data integrates with the MyHabits module (cross-module integration) when both modules are enabled, allowing daily study to count as a habit check-in.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-005: Study Session with Review Queue - reviews must be tracked
- FL-007: Study Statistics - streak data appears in statistics

**External Dependencies:**
- System clock with local timezone awareness

**Assumed Capabilities:**
- ReviewLog is accurately recording all reviews with timestamps
- Timezone is determinable from the device

#### 3.5 User Interface Requirements

##### Component: Streak Badge (embedded in Deck Browser and Stats)

**Layout:**
- Flame icon with the current streak count displayed as a large number
- Below the number: "day streak" label (or "days" for plural)
- Small text: "Best: X days" showing longest streak
- Color coding: 0 days (gray), 1-6 days (orange), 7-29 days (bright orange), 30+ days (fire red with subtle animation)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Streak | streak = 0, no study today | Gray flame, "0 day streak", "Study today to start a streak!" |
| Active Today | streak >= 1, studied today | Colored flame, streak count, "Keep it going!" |
| At Risk | streak >= 1, have not studied today | Flame with warning pulse, "Study now to keep your X-day streak!" |
| Streak Frozen | Freeze day used | Snowflake icon overlaid on flame, "Streak freeze used" |
| New Record | Current streak > longest streak | Celebration animation, "New record!" badge |

**Interactions:**
- Tap streak badge: Opens detailed streak view with calendar
- Streak freeze auto-applies: If a day is missed and a freeze is available, it auto-applies at midnight with a notification

##### Screen: Streak Detail (modal)

**Layout:**
- Large streak count with flame animation
- Calendar grid showing last 90 days, color-coded:
  - Green: Met daily target
  - Blue: Studied but below target
  - White/empty: No study
  - Snowflake: Streak freeze used
- Stats below calendar: Current streak, Longest streak, Total days studied, Freeze days available (max 2)
- Daily target setting: "Daily goal: [N] reviews" with stepper

#### 3.6 Data Requirements

##### Entity: StreakData

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "streak-global" | Singleton record |
| current_streak | integer | Min: 0 | 0 | Current consecutive days studied |
| longest_streak | integer | Min: 0 | 0 | All-time longest streak |
| total_days_studied | integer | Min: 0 | 0 | Total unique days with reviews |
| last_study_date | string | ISO date (YYYY-MM-DD), nullable | null | Last calendar day with reviews meeting threshold |
| freeze_days_available | integer | Min: 0, Max: 2 | 0 | Streak freeze days banked |
| freeze_days_used | integer | Min: 0 | 0 | Total freeze days ever used |
| daily_target | integer | Min: 1, Max: 9999 | 1 | Minimum reviews to count as a study day |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

##### Entity: DailyStudyRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| date | string | Primary key, ISO date (YYYY-MM-DD) | None | Calendar date |
| review_count | integer | Min: 0 | 0 | Number of reviews completed |
| met_target | boolean | - | false | Whether daily_target was met |
| freeze_used | boolean | - | false | Whether a streak freeze was used for this day |
| time_studied_ms | integer | Min: 0 | 0 | Total study time for this day |

**Indexes:**
- DailyStudyRecord: (date) - primary, date lookup
- DailyStudyRecord: (met_target, date) - streak calculation

#### 3.7 Business Logic Rules

##### Streak Calculation

**Purpose:** Update the streak count based on daily review activity.

**Logic:**

```
1. This calculation runs:
   a. After every review (check if today's target is newly met)
   b. On app launch (check for missed days since last study)
   c. At midnight local time (if app is running)

2. Get today's date (local timezone, YYYY-MM-DD format)
3. Get or create today's DailyStudyRecord
4. Update today's record with current review count from ReviewLog

5. IF today.met_target == true AND last_study_date == today:
     No change needed (already counted)
6. ELSE IF today.met_target == true AND last_study_date == yesterday:
     current_streak += 1
     last_study_date = today
7. ELSE IF today.met_target == true AND last_study_date < yesterday:
     Check missed days between last_study_date and today:
     FOR EACH missed day (in order):
       IF freeze_days_available > 0:
         Use freeze: freeze_days_available -= 1, freeze_days_used += 1
         Mark that day's record: freeze_used = true
       ELSE:
         BREAK (streak is broken)
     IF all missed days were covered by freezes:
       current_streak += 1 + number_of_freeze_days_used
       last_study_date = today
     ELSE:
       current_streak = 1 (reset, today counts as day 1)
       last_study_date = today
8. Update longest_streak = max(longest_streak, current_streak)
9. Update total_days_studied (count distinct dates with met_target=true)
```

##### Streak Freeze Earning

**Purpose:** Reward consistent study with streak protection.

**Logic:**

```
1. After every 7 consecutive study days (current_streak is a multiple of 7):
   IF freeze_days_available < 2:
     freeze_days_available += 1
     Notify user: "Streak freeze earned! You now have X freeze days."
2. Maximum freeze bank is 2
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Timezone change creates duplicate day | Use the earlier timezone's midnight for day boundary | Streak calculation corrects on next launch |
| Clock set to past date | Ignore reviews with dates in the past beyond 1 day | Log warning |
| StreakData record missing | Create with defaults (0 streak) | Automatic recovery |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has studied every day for 5 days,
   **When** they study today,
   **Then** the streak shows 6, and the flame icon is orange.

2. **Given** the user misses one day but has 1 freeze available,
   **When** midnight passes,
   **Then** the freeze is auto-applied, streak is preserved, and freeze count decrements.

3. **Given** the current streak reaches 30 days (new record),
   **When** the streak updates,
   **Then** a "New record!" celebration animation plays and longest_streak updates.

**Edge Cases:**

4. **Given** the user has 0 freeze days and misses a day,
   **When** they study the next day,
   **Then** current_streak resets to 1.

5. **Given** the daily target is 20 reviews,
   **When** the user completes only 15 reviews today,
   **Then** the day is recorded but does not count toward the streak.

**Negative Tests:**

6. **Given** the user has 2 freeze days (maximum),
   **When** a 7-day streak milestone is reached,
   **Then** no additional freeze day is awarded (capped at 2).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| streak increments on consecutive day | last_study=yesterday, studied today | streak + 1 |
| streak resets on missed day (no freeze) | last_study=2 days ago, 0 freezes | streak = 1 |
| freeze covers one missed day | last_study=2 days ago, 1 freeze | streak + 2, freeze_available -= 1 |
| two missed days, one freeze | last_study=3 days ago, 1 freeze | streak = 1 (only 1 freeze, need 2) |
| longest streak updates | current=15, longest=10 | longest = 15 |
| freeze earned at 7-day milestone | current_streak=7, freezes=0 | freezes = 1 |
| freeze capped at 2 | current_streak=14, freezes=2 | freezes = 2 (no change) |
| daily target threshold | target=20, reviewed=19 | met_target = false |

---

### FL-015: Daily Review Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-015 |
| **Feature Name** | Daily Review Reminders |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a busy student, I want to receive a daily push notification reminding me to review my flashcards, so that I do not forget to study and lose my streak.

#### 3.3 Detailed Description

Daily Review Reminders sends a local push notification at a user-configured time each day if there are due cards. The notification shows the count of due cards (e.g., "You have 42 cards due for review"). If no cards are due, no notification is sent. Users configure the reminder time and can enable/disable reminders per deck.

Notifications are entirely local (no server, no push service). They are scheduled using the device's local notification API and recalculated each time the app opens or a study session completes.

The notification content includes the total due card count, a streak reminder if the user has an active streak ("Keep your 15-day streak alive!"), and a quick action to start studying directly from the notification.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-005: Study Session with Review Queue - due cards must be calculable
- FL-014: Streak Tracking - streak information in notification content

**External Dependencies:**
- Push notification permission from the user
- Local notification scheduling API

**Assumed Capabilities:**
- Device supports local notifications
- User has granted notification permission

#### 3.5 User Interface Requirements

##### Screen: Reminder Settings (within FL-026 Settings)

**Layout:**
- Toggle: "Daily Review Reminder" (default: off)
- When enabled:
  - Time picker: "Remind me at [9:00 AM]" (default: 9:00 AM local time)
  - Deck filter: "Remind for: All Decks / [specific deck list]"
  - Streak reminder toggle: "Include streak info" (default: on)
- Preview of notification: Shows a sample notification with current due count

**Interactions:**
- Toggle reminder on: Requests notification permission if not already granted
- Adjust time: Time picker opens, notification rescheduled on change
- Permission denied: Shows alert explaining why notifications are needed with link to system settings

#### 3.6 Data Requirements

##### Entity: ReminderSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "reminder-global" | Singleton record |
| enabled | boolean | - | false | Whether daily reminders are active |
| reminder_time | string | HH:MM format, 24h | "09:00" | Local time to send reminder |
| include_streak | boolean | - | true | Whether to include streak info in notification |
| deck_filter | text | JSON array of deck IDs, or "all" | "all" | Which decks to check for due cards |
| last_scheduled | datetime | Nullable | null | When the notification was last scheduled |

#### 3.7 Business Logic Rules

##### Notification Scheduling

**Purpose:** Schedule or update the daily local notification.

**Logic:**

```
1. IF reminder.enabled == false: Cancel any scheduled notification, RETURN
2. Compute due card count for the configured decks at the reminder time
3. IF due_count == 0: Cancel notification for today (nothing to review)
4. ELSE:
   a. Build notification content:
      Title: "Time to study!"
      Body: "You have {due_count} cards waiting for review."
      IF include_streak AND current_streak > 0:
        Append: "Keep your {streak}-day streak alive!"
   b. Schedule local notification for reminder_time today
      IF reminder_time has already passed today: schedule for tomorrow
   c. Set notification action: "Start Studying" deep-links to study session
5. Repeat daily: schedule next day's notification when today's fires or when app opens
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | Alert: "Notifications are disabled. Enable in Settings to receive reminders." with link | User grants in system settings |
| Notification fails to schedule | Silent failure, retry on next app open | Automatic retry |
| Due count changes after scheduling | Notification shows count from schedule time (acceptable) | Count is approximate |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** reminders are enabled for 9:00 AM and 30 cards are due,
   **When** 9:00 AM arrives,
   **Then** a notification appears: "You have 30 cards waiting for review."

2. **Given** the user has a 10-day streak and streak info is enabled,
   **When** the reminder fires,
   **Then** the notification includes "Keep your 10-day streak alive!"

3. **Given** the user taps the notification,
   **When** the app opens,
   **Then** it navigates directly to the study session for the deck with the most due cards.

**Negative Tests:**

4. **Given** no cards are due at reminder time,
   **When** 9:00 AM arrives,
   **Then** no notification is sent.

5. **Given** notification permission is denied,
   **When** the user enables reminders,
   **Then** an alert explains how to grant permission in system settings.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| builds notification with due count | 42 due cards | Body contains "42 cards" |
| includes streak in notification | streak=15, include_streak=true | Body contains "15-day streak" |
| omits streak when disabled | streak=15, include_streak=false | Body does not mention streak |
| no notification when zero due | 0 due cards | No notification scheduled |
| schedules for tomorrow if time passed | Reminder at 9AM, current time 10AM | Scheduled for 9AM tomorrow |

---

### FL-016: Markdown Support in Cards

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-016 |
| **Feature Name** | Markdown Support in Cards |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a programming student, I want to use code blocks and formatting in my cards, so that I can create well-structured cards with syntax-highlighted code snippets.

#### 3.3 Detailed Description

Markdown Support adds the ability to write card content using Markdown syntax, which is then rendered as formatted HTML during study. Users toggle a Markdown mode button in the card editor to switch between plain text and Markdown editing. When Markdown mode is active, a preview toggle shows the rendered output.

Supported Markdown features: headings (h1-h4), bold, italic, strikethrough, bullet lists, numbered lists, inline code, fenced code blocks with syntax highlighting (language-specific), blockquotes, horizontal rules, links (rendered but not navigable during study), tables, and images (via standard Markdown image syntax `![alt](url)`).

Mathematical notation is supported via LaTeX syntax: inline math with `$...$` and display math with `$$...$$`. This renders using a client-side math rendering engine (e.g., KaTeX-compatible). LaTeX support is critical for math, science, and engineering students.

Markdown rendering uses the same template engine as FL-011, converting Markdown to HTML before applying card template styling.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card editor must exist

**External Dependencies:**
- Markdown-to-HTML rendering library
- Math/LaTeX rendering library
- Syntax highlighting library for code blocks

**Assumed Capabilities:**
- Card content can render HTML

#### 3.5 User Interface Requirements

##### Component: Markdown Editor (extension of Card Editor)

**Layout:**
- Toggle button in the card editor toolbar: "Md" icon to enable/disable Markdown mode
- When Markdown mode is active:
  - Text input uses a monospace font
  - Formatting toolbar shows Markdown shortcuts: Bold (**), Italic (*), Code (`), List (-), Heading (#), Link, Math ($)
  - Preview toggle button shows rendered Markdown output

**Interactions:**
- Tap toolbar button (e.g., Bold): Wraps selected text in `**selected**` markers
- Tap code button: Wraps selected text in backticks (inline) or triple backticks (multi-line selection)
- Tap math button: Wraps selected text in `$...$` (inline) or `$$...$$` (multi-line)
- Toggle preview: Switches between raw Markdown text and rendered HTML output

#### 3.6 Data Requirements

No new entities. Card content is stored as plain text. A metadata flag on the note indicates whether Markdown rendering is enabled.

**Note entity extension:**
- Add field: `render_markdown` (boolean, default: false) - whether to render this note's content as Markdown

#### 3.7 Business Logic Rules

##### Markdown Rendering Pipeline

**Purpose:** Convert Markdown text to styled HTML for card display.

**Logic:**

```
1. IF note.render_markdown == false: RETURN raw text (no rendering)
2. Parse Markdown to AST (abstract syntax tree)
3. Process LaTeX blocks:
   a. Inline math ($...$): Render to HTML math elements
   b. Display math ($$...$$): Render to HTML block math elements
4. Process code blocks:
   a. Fenced blocks with language hint (```python): Apply syntax highlighting
   b. Inline code (`text`): Wrap in <code> tags
5. Convert AST to HTML
6. Apply card template CSS (from NoteModel)
7. Sanitize: Remove script tags and dangerous attributes
8. RETURN rendered HTML string
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid Markdown syntax | Renders as plain text (graceful degradation) | User fixes syntax |
| Invalid LaTeX expression | Shows raw LaTeX text with red border | User fixes expression |
| Unknown code language in fenced block | Code rendered without syntax highlighting | Acceptable fallback |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables Markdown mode and types `**bold** and *italic*`,
   **When** the card is displayed during study,
   **Then** "bold" is rendered in bold and "italic" in italic.

2. **Given** the user types a fenced code block with ```python,
   **When** the card is rendered,
   **Then** the code appears with Python syntax highlighting.

3. **Given** the user types `$E = mc^2$`,
   **When** the card is rendered,
   **Then** the equation is rendered as properly formatted mathematical notation.

**Negative Tests:**

4. **Given** invalid LaTeX `$\invalidcommand$`,
   **When** rendered,
   **Then** the raw text is shown with an error indicator (not a crash).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| renders bold text | "**hello**" | "<strong>hello</strong>" |
| renders inline code | "`code`" | "<code>code</code>" |
| renders fenced code block | "```python\nprint('hi')\n```" | Syntax-highlighted HTML |
| renders inline math | "$x^2$" | Math HTML element |
| renders display math | "$$\sum_{i=1}^n i$$" | Block math HTML element |
| renders table | markdown table syntax | HTML table |
| falls back on invalid markdown | unclosed **bold | Renders as plain text "**bold" |
| strips script tags | "<script>alert(1)</script>" | Script removed |

---

### FL-017: Suspend and Bury Cards

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-017 |
| **Feature Name** | Suspend and Bury Cards |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a student who encounters a card that is wrong or irrelevant, I want to suspend it so it never appears in my reviews, without deleting it permanently.

**Secondary:**
> As a learner who keeps seeing the same easy card, I want to bury it until tomorrow so I can focus on more challenging material today.

#### 3.3 Detailed Description

Suspend and Bury are two mechanisms to temporarily or permanently remove cards from the review queue without deleting them.

**Suspend** removes a card from all queues indefinitely. Suspended cards never appear in study sessions. They remain in the database with all their review history intact. Users can unsuspend cards at any time from the Card Browser (FL-013), at which point they return to their previous queue. Suspend is useful for cards with errors, outdated content, or material the user no longer needs.

**Bury** removes a card from the review queue until the next day. Buried cards automatically unbury at the start of the next calendar day (midnight local time). Bury is useful when the user encounters a card they recognize is a sibling (from the same note) or a card they want to skip temporarily without affecting scheduling.

Both actions are available during study sessions (via a menu or swipe) and in the Card Browser. Burying a card during a study session immediately advances to the next card. Suspending during study also advances immediately.

Related cards (siblings from the same note) can be buried automatically after reviewing one sibling. This prevents seeing front-to-back and back-to-front of the same note in the same session.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-004: FSRS Spaced Repetition Engine - queue system must support suspended and buried states
- FL-005: Study Session with Review Queue - actions trigger during study

**External Dependencies:**
- None

**Assumed Capabilities:**
- Card queue field supports "suspended" and "buried" values
- Midnight rollover mechanism exists for unburying

#### 3.5 User Interface Requirements

##### Component: Study Session Actions (extension of Study Session screen)

**Layout:**
- Small "..." overflow menu button in the top-right of the study screen
- Menu options: "Suspend Card," "Bury Card," "Bury Note" (bury all cards from this note), "Edit Card," "Flag Card"

**Interactions:**
- Tap "Suspend Card": Card disappears from session, confirmation toast "Card suspended"
- Tap "Bury Card": Card disappears, toast "Card buried until tomorrow"
- Tap "Bury Note": All sibling cards from the same note are buried, toast "Note buried until tomorrow"

##### Component: Card Browser Indicators

**Layout:**
- Suspended cards in the Card Browser show a yellow "Suspended" badge
- Buried cards show a gray "Buried" badge
- Filter options "is:suspended" and "is:buried" available in search

#### 3.6 Data Requirements

No new entities. Uses existing Card.queue field values "suspended" and "buried."

**State preservation:** When a card is suspended, its previous queue value is stored in a temporary field so it can be restored on unsuspend.

**Card entity extension:**
- Add field: `queue_before_suspend` (enum, nullable) - stores the queue value before suspension for restoration

#### 3.7 Business Logic Rules

##### Suspend Card

**Purpose:** Remove a card from all review queues indefinitely.

**Logic:**

```
1. Store card.queue in card.queue_before_suspend
2. Set card.queue = "suspended"
3. Card will not appear in any study session queue
4. Card retains all scheduling data (stability, difficulty, interval, due date)
5. Card is still visible in Card Browser with "Suspended" badge
```

##### Unsuspend Card

**Purpose:** Return a suspended card to its previous queue.

**Logic:**

```
1. IF card.queue != "suspended": No-op
2. IF card.queue_before_suspend is not null:
     Set card.queue = card.queue_before_suspend
     Clear card.queue_before_suspend
3. ELSE:
     Set card.queue based on card.state:
       - state "new" -> queue "new"
       - state "learning" or "relearning" -> queue "learning"
       - state "review" -> queue "review"
4. Card will appear in next applicable study session
```

##### Bury Card

**Purpose:** Remove a card from today's review queue only.

**Logic:**

```
1. Set card.queue = "buried"
2. Card will not appear in study sessions for the rest of today
3. At midnight local time (or on next app launch after midnight):
   Unbury all buried cards: set queue back based on state
4. Burying does not affect scheduling or review history
```

##### Auto-Bury Siblings

**Purpose:** Prevent seeing multiple cards from the same note in a single session.

**Logic:**

```
1. After a card is reviewed, check if auto_bury_siblings is enabled (default: true)
2. IF enabled:
   a. Find all other cards with the same note_id
   b. IF any sibling is in the current session queue:
        Bury the sibling (queue = "buried")
        Remove from current session queue
3. Siblings automatically unbury at midnight
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Suspend fails (database error) | Toast: "Could not suspend card" | User retries |
| Unbury fails at midnight | Cards remain buried until next app launch | App launch triggers unbury |
| queue_before_suspend is null on unsuspend | Infer queue from card state | Automatic fallback |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user suspends a card during a study session,
   **When** they continue studying,
   **Then** the card does not appear again in any future session until unsuspended.

2. **Given** the user buries a card during a study session,
   **When** midnight passes and they start a new session,
   **Then** the buried card is available again (automatically unburied).

3. **Given** auto-bury siblings is enabled and the user reviews a reversed card,
   **When** the front-to-back card is reviewed,
   **Then** the back-to-front sibling is automatically buried for the rest of today.

**Edge Cases:**

4. **Given** a card is unsuspended,
   **When** it returns to the review queue,
   **Then** its scheduling state (stability, difficulty, due date) is exactly as it was before suspension.

**Negative Tests:**

5. **Given** the user tries to unsuspend a card that is not suspended,
   **When** the action is attempted,
   **Then** nothing happens (no-op, no error).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| suspend sets queue to suspended | Card in "review" queue | queue="suspended", queue_before="review" |
| unsuspend restores previous queue | Suspended card, queue_before="review" | queue="review" |
| bury sets queue to buried | Card in "review" queue | queue="buried" |
| unbury restores queue from state | Buried card, state="review" | queue="review" |
| auto-bury finds siblings | Card A reviewed, Card B is sibling | Card B is buried |
| suspended card excluded from queue | Build queue with 1 suspended card | Queue does not contain suspended card |
| buried card excluded from queue | Build queue with 1 buried card | Queue does not contain buried card |

---

### FL-018: Undo Last Review

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-018 |
| **Feature Name** | Undo Last Review |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student who accidentally tapped the wrong rating button, I want to undo my last review and re-rate the card, so that my scheduling data is not corrupted by a misclick.

**Secondary:**
> As a fast reviewer, I want the ability to reverse the last action within a session, so that I can recover from errors without restarting the session.

#### 3.3 Detailed Description

Undo Last Review provides a single-level undo within an active study session. After the user rates a card, an "Undo" button appears at the top of the study screen for a limited window. Tapping Undo reverses the rating: the card's scheduling state (stability, difficulty, interval, due date, state, queue) is restored to its pre-review values, the ReviewLog entry is deleted, the session statistics are decremented, and the card is placed back at the front of the review queue so the user can re-rate it.

Only the most recent review is undoable. Rating a new card clears the undo history for the previous card. Undo is only available within the current session - once the user leaves the session, the undo option disappears. The undo button remains visible for 15 seconds after a rating or until the next card is rated, whichever comes first. A visual countdown ring around the undo icon shows the remaining time.

This feature follows Anki's undo model: single-level, session-scoped, and immediate. Multi-level undo (undoing multiple reviews in sequence) is intentionally not supported because it introduces complexity around cascading state reversions and would require a more sophisticated history stack.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-005: Study Session with Review Queue - undo operates within a study session

**External Dependencies:**
- None

**Assumed Capabilities:**
- ReviewLog entries include complete before/after state for full reversal
- Card entity supports atomic update of all scheduling fields

#### 3.5 User Interface Requirements

##### Component: Undo Button (within Study Session screen)

**Layout:**
- Small circular button positioned in the top-left area below the navigation bar
- Icon: curved arrow (undo symbol)
- Surrounded by a circular countdown ring that depletes over 15 seconds
- When visible, the button has a subtle glow animation to draw attention

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Hidden | No review has been performed yet in this session, or countdown expired | Button is not visible |
| Available | A review was just performed, countdown active | Undo button visible with depleting ring timer |
| Processing | User tapped Undo, reversal in progress | Button shows brief spinner (200ms) |
| Restored | Undo completed | Toast "Review undone" appears, card returns to question state |

**Interactions:**
- Tap Undo button: Reverses the last review, card reappears in question state
- The button disappears after 15 seconds or when the next card is rated
- Keyboard shortcut: Ctrl+Z / Cmd+Z when hardware keyboard is connected

**Transitions/Animations:**
- Button fades in (200ms) after a review is performed
- Countdown ring depletes clockwise over 15 seconds
- On undo, the current card slides back in from the left (reverse of the card advance animation, 200ms)
- Button fades out (200ms) when countdown expires

#### 3.6 Data Requirements

No new entities. Undo relies on data stored in the most recent ReviewLog entry and in-memory session state.

**In-Memory Undo State (per session, not persisted):**

| Field | Type | Description |
|-------|------|-------------|
| undoable_review_id | string, nullable | ID of the ReviewLog entry that can be undone |
| card_id | string, nullable | Card that was reviewed |
| previous_card_state | object, nullable | Snapshot of card scheduling fields before the review |
| undo_expires_at | datetime, nullable | Timestamp when the undo window closes |

**Card State Snapshot (stored in memory):**

| Field | Type | Description |
|-------|------|-------------|
| state | enum | Card state before review |
| queue | enum | Card queue before review |
| due | datetime, nullable | Due date before review |
| stability | float | Stability before review |
| difficulty | float | Difficulty before review |
| interval_days | integer | Interval before review |
| reps | integer | Reps before review |
| lapses | integer | Lapses before review |
| last_review | datetime, nullable | Last review timestamp before this review |

#### 3.7 Business Logic Rules

##### Capture Undo State

**Purpose:** Save the card's scheduling state before each review for potential reversal.

**Logic:**

```
1. BEFORE processing a rating:
   a. Capture full snapshot of card scheduling fields
   b. Store as previous_card_state in session memory
2. AFTER processing a rating:
   a. Store the new ReviewLog ID as undoable_review_id
   b. Set undo_expires_at = now + 15 seconds
   c. Show undo button
```

##### Execute Undo

**Purpose:** Reverse the last review and restore card state.

**Inputs:**
- undoable_review_id: string - the ReviewLog to delete
- card_id: string - the card to restore
- previous_card_state: object - the saved state snapshot

**Logic:**

```
1. Validate that undoable_review_id is not null and undo_expires_at > now
2. Begin transaction:
   a. Delete the ReviewLog entry with id = undoable_review_id
   b. Restore all card scheduling fields from previous_card_state:
      state, queue, due, stability, difficulty, interval_days,
      reps, lapses, last_review
   c. Update card.updated_at = now
3. Commit transaction
4. Decrement session statistics:
   - cards_reviewed -= 1
   - Decrement the appropriate rating counter (again_count, hard_count, etc.)
   - Subtract the review_duration_ms from session.total_time_ms
5. Insert card back at the front of the session queue
6. Clear undo state (set undoable_review_id = null)
7. Display the card in question state (front face showing)
```

**Edge Cases:**
- Undo after session already completed: Not possible (undo expires when session ends)
- Undo after the card was subsequently buried or suspended: Restore the card to its pre-review queue, not the post-action queue
- Double-tap on undo: Second tap is a no-op (undo state cleared after first execution)
- Undo while the next card is already showing: Card transition reverses, next card goes back to its queue position

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| ReviewLog deletion fails | Toast: "Could not undo review. Please try again." | User can retry within the countdown window |
| Card state restoration fails | Toast: "Undo failed. Review data may be inconsistent." | Card is flagged for manual review in Card Browser |
| Undo attempted after expiration | Button is already hidden; no action possible | User must accept the rating |
| Undo state lost (app crash) | Undo not available on session resume | No recovery; undo is session-scoped only |

**Validation Timing:**
- Undo availability checked on button tap (server-side validation of expiration)
- Transaction integrity validated before commit

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user rates a card "Again" by mistake during a study session,
   **When** they tap the Undo button within 15 seconds,
   **Then** the card reappears with its front face, the ReviewLog entry is deleted, the card's scheduling state is restored to pre-review values, and session stats are decremented.

2. **Given** the user rates a card "Easy" and then rates the next card,
   **When** they look for the Undo button,
   **Then** the Undo button is available only for the most recent card (the previous card's undo window has closed).

3. **Given** the user performs an undo and then re-rates the card "Good,"
   **When** the new rating is processed,
   **Then** the card's scheduling state reflects the "Good" rating and a new ReviewLog entry is created.

**Edge Cases:**

4. **Given** the undo countdown (15 seconds) expires,
   **When** the user tries to find the Undo button,
   **Then** the button is no longer visible.

5. **Given** the user rates the last card in the session,
   **When** the session summary appears and they want to undo,
   **Then** the undo button is not available on the summary screen (undo is only available before the session ends).

**Negative Tests:**

6. **Given** no review has been performed in the session,
   **When** the user looks for an Undo button,
   **Then** no Undo button is visible.

7. **Given** the user performs an undo,
   **When** they immediately tap the area where Undo was,
   **Then** nothing happens (undo state is cleared, button is gone).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| captures card state before review | Card with S=10, D=5, state="review" | Snapshot matches all fields |
| undo restores card state | Snapshot: S=10, D=5, state="review" | Card restored to exact snapshot values |
| undo deletes ReviewLog entry | ReviewLog ID "rev-123" | No record with ID "rev-123" after undo |
| undo decrements session stats | Session: 10 reviewed, 3 again | Session: 9 reviewed, 2 again (if last was Again) |
| undo expires after 15 seconds | Undo requested at T+16s | Undo rejected |
| undo clears after new rating | Rate card A, then rate card B | Undo for card A is no longer available |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Undo and re-rate flow | 1. Rate card Again, 2. Tap Undo, 3. Rate Good | Card has Good scheduling, only 1 ReviewLog for this card |
| Undo during learning steps | 1. Rate new card Good (enters learning), 2. Undo | Card returns to New state with no learning step |
| Undo after session stats update | 1. Complete 5 reviews, 2. Undo 5th | Stats show 4 reviews, accuracy recalculated |

---

### FL-019: Study Session Options

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-019 |
| **Feature Name** | Study Session Options |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student preparing for an exam, I want to study only the cards I have gotten wrong recently, so that I can focus my limited time on my weakest material.

**Secondary:**
> As a language learner, I want to create a custom study session with specific filters (e.g., only cards tagged "verbs" or only cards due within the next 3 days), so that I can target my study precisely.

#### 3.3 Detailed Description

Study Session Options extends the default study session (FL-005) with configurable study modes. While the default session follows the FSRS queue (due cards, daily limits), custom sessions allow users to study cards that would not normally appear in the standard queue.

Available study modes:

1. **Standard Review** (default): Due cards based on FSRS scheduling with daily limits.
2. **Study Ahead:** Review cards due within the next N days (default: 1 day). The cards are presented at their scheduled time but answered early. FSRS accounts for the early review by computing retrievability at the actual review time.
3. **Review Forgotten:** Re-study all cards that were rated "Again" today (or in the last N days). Cards appear in the order they were forgotten.
4. **Custom Study:** Filter by tags, card state, deck, difficulty range, or date added. Combine filters to create precise study sets. Cards in custom study sessions are presented in random order unless the user selects a sort option.
5. **Cram Mode:** Study selected cards repeatedly without affecting scheduling. Cram reviews are not recorded in ReviewLog and do not change card stability, difficulty, or due dates. This mode is for last-minute exam prep where spaced repetition is irrelevant.

Study options are accessed via a "Custom Study" button on the deck detail screen or through a menu on the study session screen. The selected mode applies only to the current session and does not change the deck's default behavior.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-005: Study Session with Review Queue - base session framework

**External Dependencies:**
- None

**Assumed Capabilities:**
- Card entities have queryable fields for filtering (tags, state, difficulty, dates)

#### 3.5 User Interface Requirements

##### Modal: Study Options

**Layout:**
- Bottom sheet modal triggered by "Custom Study" button on deck detail screen
- Title: "Study Options"
- List of study mode options, each with an icon, name, and description:
  1. Standard Review (clock icon): "Due cards based on your schedule"
  2. Study Ahead (calendar-forward icon): "Preview cards due within [N] days"
  3. Review Forgotten (retry icon): "Re-study cards rated Again recently"
  4. Custom Study (filter icon): "Build a custom study set"
  5. Cram Mode (lightning icon): "Rapid review without affecting scheduling"
- Tapping a mode either starts the session immediately (Standard, Study Ahead, Review Forgotten) or opens a filter configuration screen (Custom Study) or card selector (Cram)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Mode Selection | Modal just opened | List of 5 study modes with descriptions |
| Configuration | Custom Study or Study Ahead selected | Filter/parameter configuration panel |
| Preview | Filters applied, showing matching card count | "X cards match your criteria" with "Start" button |
| No Results | Filters match zero cards | "No cards match these criteria. Adjust your filters." |

**Interactions:**
- Tap Standard Review: Starts normal study session immediately
- Tap Study Ahead: Shows day selector (1-7 days, stepper control), then starts session
- Tap Review Forgotten: Shows day selector (1-7 days), then starts session with forgotten cards
- Tap Custom Study: Opens filter configuration screen
- Tap Cram Mode: Opens card/deck selector, then starts cram session

##### Screen: Custom Study Filter Configuration

**Layout:**
- Top bar with "Custom Study" title and "Start" button (right)
- Filter sections (each collapsible):
  - **Tags:** Multi-select tag picker showing all used tags
  - **Card State:** Checkbox group: New, Learning, Young (<21 day interval), Mature (>=21 day interval), Suspended
  - **Difficulty:** Range slider from 1.0 to 10.0
  - **Added Date:** Date range picker (from/to)
  - **Interval Range:** Min/max interval in days
  - **Lapses:** Minimum lapse count (for targeting leeches)
- Sort options: Random (default), Alphabetical, Difficulty (hardest first), Interval (shortest first), Date Added (newest first)
- Card count indicator updates in real-time as filters change: "X cards match"
- "Reset Filters" button at bottom

**Interactions:**
- Toggle/adjust any filter: Card count updates in real-time
- Tap "Start": Begins study session with filtered card set
- Tap "Reset Filters": Clears all filters, shows total card count

#### 3.6 Data Requirements

No new entities. Custom study sessions use the existing StudySession entity with an additional field to distinguish session type.

**StudySession entity extension:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| session_type | enum | One of: standard, study_ahead, review_forgotten, custom, cram | standard | Type of study session |
| session_config | text | JSON, nullable | null | Serialized filter/configuration for non-standard sessions |

**Example session_config for Custom Study:**

```json
{
  "tags": ["verbs", "irregular"],
  "states": ["learning", "review"],
  "difficulty_min": 5.0,
  "difficulty_max": 10.0,
  "added_after": "2026-01-01",
  "added_before": "2026-03-01",
  "sort": "difficulty_desc",
  "limit": 50
}
```

**Example session_config for Study Ahead:**

```json
{
  "days_ahead": 3
}
```

#### 3.7 Business Logic Rules

##### Study Ahead Queue Building

**Purpose:** Build a queue of cards that are due within the next N days.

**Inputs:**
- deck_id: string - target deck (with descendants)
- days_ahead: integer (1-7) - how many days to look ahead

**Logic:**

```
1. Compute cutoff_date = now + days_ahead days
2. Select cards WHERE state = "review"
   AND due > now AND due <= cutoff_date
   AND queue NOT IN ("suspended", "buried")
3. Sort by due date ascending (soonest first)
4. These cards are studied "early" - FSRS computes their retrievability
   at the actual review time, which will be higher than at the scheduled
   time, resulting in a slightly smaller stability increase
5. Review results ARE recorded in ReviewLog (affects scheduling)
```

##### Review Forgotten Queue Building

**Purpose:** Build a queue of recently forgotten cards for re-study.

**Inputs:**
- deck_id: string - target deck (with descendants)
- days_back: integer (1-7) - how many days to look back

**Logic:**

```
1. Compute cutoff_date = now - days_back days
2. Select DISTINCT card_id FROM ReviewLog
   WHERE rating = 1 (Again)
   AND reviewed_at >= cutoff_date
   AND card_id IN (cards from target deck)
3. Sort by most recently forgotten first
4. Build queue with these cards
5. Reviews ARE recorded in ReviewLog (affects scheduling)
```

##### Custom Study Query Building

**Purpose:** Build a card query from user-selected filters.

**Inputs:**
- filters: object - tag, state, difficulty, date, interval, lapse filters
- sort: string - sort order
- limit: integer - maximum cards (default: 100)

**Logic:**

```
1. Start with all cards in the target deck (and descendants)
2. Apply each filter as an AND condition:
   - Tags: card's note has ANY of the selected tags (OR within tag filter)
   - State: card.state IN selected states
   - Difficulty: card.difficulty BETWEEN min AND max
   - Added Date: card.created_at BETWEEN from AND to
   - Interval: card.interval_days BETWEEN min AND max
   - Lapses: card.lapses >= min_lapses
3. Apply sort order
4. Apply limit
5. Reviews ARE recorded in ReviewLog
```

##### Cram Mode

**Purpose:** Rapid review without scheduling impact.

**Logic:**

```
1. User selects cards (by deck, tag, or manual selection)
2. Cards are presented in random order
3. Rating buttons still appear but serve as self-assessment only
4. NO ReviewLog entries are created
5. NO card scheduling fields are modified (stability, difficulty, due, etc.)
6. Session statistics ARE recorded in StudySession for time tracking
7. Cards can repeat within the session (when "Loop" option is on)
```

**Edge Cases:**
- Study Ahead with no cards due ahead: "No upcoming cards in the next N days"
- Custom Study with no matching cards: "No cards match these criteria" message
- Cram with 0 cards selected: "Select at least one card or deck to cram"
- Study Ahead on an overdue card (already past due): Card appears in standard queue, not study-ahead

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Filter produces zero results | "No cards match these criteria. Adjust your filters." | User adjusts filters |
| Custom study config corrupted | Fallback to Standard Review mode | Session starts with default queue |
| Cram session exceeds memory limit (10,000+ cards selected) | Warning: "Large selection (X cards). Study may be slow." | User reduces selection or proceeds |
| Study Ahead encounters scheduling conflict | Early review processed normally with current-time retrievability | No special handling needed |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects "Study Ahead" with 3 days,
   **When** 50 cards are due in the next 3 days,
   **Then** a study session starts with those 50 cards sorted by due date, and reviews affect scheduling.

2. **Given** the user selects "Review Forgotten" for the last 1 day,
   **When** they forgot 8 cards today,
   **Then** a study session starts with those 8 cards.

3. **Given** the user builds a Custom Study with tags "anatomy" and difficulty > 7.0,
   **When** 25 cards match,
   **Then** the preview shows "25 cards match" and starting the session presents those 25 cards.

4. **Given** the user starts a Cram session with 30 cards,
   **When** they rate all 30 cards,
   **Then** no ReviewLog entries are created and no scheduling data is modified.

**Edge Cases:**

5. **Given** Study Ahead is selected but no cards are due in the next 7 days,
   **When** the mode is chosen,
   **Then** the message "No upcoming cards in the next 7 days" appears.

**Negative Tests:**

6. **Given** the user starts a Cram session,
   **When** they rate a card "Again,"
   **Then** the card's stability, difficulty, and due date remain unchanged (verified by checking card data after session).

7. **Given** the user selects Custom Study with contradictory filters (e.g., difficulty 9-10 AND state "new"),
   **When** new cards have uninitialized difficulty (0.0),
   **Then** zero cards match and the "No cards match" message appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| study ahead finds cards due within N days | 5 cards due in 2 days, 3 due in 5 days, N=3 | 5 cards in queue |
| review forgotten finds again-rated cards | 3 cards rated Again today | 3 cards in queue |
| custom study applies tag filter | Tags: ["anatomy"], 10 matching | 10 cards in queue |
| custom study applies difficulty range | Range: 7.0-10.0, 5 matching | 5 cards in queue |
| custom study combines filters with AND | Tags + difficulty filter | Only cards matching both |
| cram mode does not create ReviewLog | Rate 5 cards in cram | 0 new ReviewLog entries |
| cram mode does not modify card fields | Rate card Again in cram | Card S, D, due unchanged |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Study Ahead full flow | 1. Select Study Ahead (1 day), 2. Review 3 due-tomorrow cards, 3. Check scheduling | Cards rescheduled based on early review time |
| Custom Study with multiple filters | 1. Set tags + difficulty, 2. Verify card count, 3. Start session | Only matching cards appear |
| Cram then standard review | 1. Cram 10 cards, 2. Start standard session | Standard session unaffected by cram |

---

### FL-020: AI Card Generation from Text

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-020 |
| **Feature Name** | AI Card Generation from Text |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student with lecture notes, I want to paste my notes and have AI automatically generate flashcards from them, so that I can create study materials in seconds instead of hours.

**Secondary:**
> As a learner reading an article, I want to select text and generate cards from it, so that I can turn any reading material into flashcards without manual transcription.

#### 3.3 Detailed Description

AI Card Generation allows users to paste or type text (lecture notes, textbook excerpts, articles, outlines) and have an AI model generate flashcards automatically. The AI analyzes the input text, identifies key concepts, facts, definitions, and relationships, and produces a set of front/back card pairs. Users review the generated cards before saving, with the ability to edit, delete, or add individual cards from the generated set.

The feature supports two generation modes:

1. **On-Device Generation** (preferred): Uses a local small language model (if hardware supports it) to generate cards with zero data transmission. This is the privacy-first option. On-device generation works offline and produces simpler cards (direct fact extraction, definition cards, fill-in-the-blank).

2. **Cloud Generation** (opt-in): Uses an external AI API for higher-quality card generation. This mode produces more nuanced cards (conceptual questions, comparison cards, application questions). Cloud generation requires explicit user consent and a clear indicator that text will be transmitted. The API receives only the pasted text; no user identity, deck information, or study history is transmitted.

The feature targets the Quizlet "Magic Notes" experience but with a privacy-respecting implementation. Users can generate cards from text in any language. The generated cards are editable before saving and are clearly marked as AI-generated in the card metadata.

Input text limit: 50,000 characters (approximately 10,000 words or 20 pages of notes). For longer inputs, the user is prompted to split the text into sections. The AI generates approximately 1 card per 100-200 words of input, so a 5,000-word input produces roughly 25-50 cards.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - generated cards use the standard card creation pipeline
- FL-003: Deck Organization - generated cards are saved to a deck

**External Dependencies:**
- On-device: Local ML model runtime (CoreML on iOS, ONNX Runtime on Android/web)
- Cloud: Network access for AI API calls (opt-in only)

**Assumed Capabilities:**
- On-device model is bundled with the app or downloaded on first use (~100-500MB)
- Cloud API key is configured (app-level key, no user accounts)

#### 3.5 User Interface Requirements

##### Screen: AI Card Generator

**Layout:**
- Top bar with "Cancel" (left), "Generate Cards" title (center)
- Generation mode selector: "On-Device" (default, with lock icon for privacy) | "Cloud AI" (with cloud icon and "Text will be sent to AI service" note)
- Large text input area occupying approximately 50% of the screen: placeholder "Paste your notes, lecture text, or any content..."
- Character count in bottom-right of text area: "0 / 50,000"
- Below text area: target deck selector (same as card creation deck picker)
- Card type preference: "Auto" (default) | "Basic Only" | "Cloze Only"
- "Generate" button at the bottom (disabled until text is entered)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No text entered | Text area with placeholder, Generate button disabled |
| Text Entered | Text present, under limit | Character count updates, Generate button active |
| Over Limit | Text exceeds 50,000 characters | Character count in red, Generate button disabled, "Text too long" message |
| Generating | AI processing in progress | Progress indicator with "Generating cards..." message, pulsing animation, estimated time remaining |
| Results | Cards generated | Generated card list (see below) |
| Error | Generation failed | Error message with retry button |

##### Screen: Generated Cards Review

**Layout:**
- Top bar with "Back" (left), "X cards generated" title (center), "Save All" (right)
- Scrollable list of generated cards, each showing:
  - Front text (bold)
  - Back text (normal)
  - Card type badge (Basic, Cloze)
  - Checkbox (for batch selection)
  - Edit icon (pencil) and Delete icon (trash) on the right
- Bottom bar: "Selected: X of Y" | "Save Selected" button
- "Regenerate" button to re-run generation on the same text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| All Selected | All cards checked (default) | "Save All" button active, select-all toggle on |
| Partial Selection | Some cards unchecked | "Save Selected (X)" button shows count |
| Editing | User editing a generated card | Inline edit fields replace the card preview |
| Empty | User deleted all generated cards | "No cards to save. Go back to regenerate." |

**Interactions:**
- Tap card: Expands to show full front and back text
- Tap edit icon: Converts card to inline editable fields
- Tap delete icon: Removes card from generated list (with undo toast for 5 seconds)
- Tap checkbox: Toggles card selection for saving
- Tap "Save All" / "Save Selected": Saves selected cards to the target deck
- Tap "Regenerate": Returns to text input screen with text preserved

**Transitions/Animations:**
- Card deletion: Card row slides left and fades out (200ms)
- Save: Cards animate downward into a deck icon (300ms), then success screen appears

#### 3.6 Data Requirements

No new entities for generated cards (they become standard Card/Note records on save).

**Card entity extension:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| source | enum | One of: manual, ai_ondevice, ai_cloud, import | manual | How this card was created |

**Temporary generation state (in-memory only):**

| Field | Type | Description |
|-------|------|-------------|
| input_text | string | Original text input |
| generated_cards | array | List of {front, back, type, selected} objects |
| generation_mode | enum | on_device or cloud |
| generation_time_ms | integer | Time taken to generate |

#### 3.7 Business Logic Rules

##### Text-to-Card Generation

**Purpose:** Extract key concepts from text and produce flashcard pairs.

**Inputs:**
- text: string - input text (1 to 50,000 characters)
- mode: enum - on_device or cloud
- card_type_preference: enum - auto, basic_only, cloze_only

**Logic:**

```
1. Validate input:
   - Text must be non-empty after trimming whitespace
   - Text must not exceed 50,000 characters
2. Preprocess text:
   - Normalize whitespace (collapse multiple newlines, trim)
   - Detect language (for language-specific card patterns)
3. IF mode == on_device:
   a. Segment text into paragraphs/sections
   b. For each section, extract:
      - Definitions (term: definition patterns)
      - Key facts (subject-verb-object patterns)
      - Lists (enumerated or bulleted items)
      - Cause-effect relationships
   c. Generate card pairs:
      - Definitions -> "What is [term]?" / "[definition]"
      - Facts -> question/answer pairs
      - Lists -> "Name the [N] types of [X]" / "[list items]"
      - Cloze (if preference allows): Insert {{c1::...}} around key terms
   d. Estimated generation rate: 2-5 seconds per 1000 words
4. IF mode == cloud:
   a. Prepare API request with text and card_type_preference
   b. DO NOT include any user identity, deck info, or study data
   c. Send text to AI API with prompt instructing card generation
   d. Parse response into card pairs
   e. Validate each generated card (non-empty front and back)
   f. Estimated generation rate: 3-10 seconds for any length
5. Deduplicate generated cards (remove cards with identical fronts)
6. RETURN array of {front, back, type} objects
```

**Edge Cases:**
- Very short input (< 50 characters): Generate 1-2 cards or show "Not enough content to generate cards"
- Input in mixed languages: Generate cards in the dominant language
- Input with no extractable facts (e.g., poetry, narrative): Generate fewer cards, warn "Limited factual content detected"
- Cloud API timeout (30 seconds): Show timeout error with retry option
- Cloud API rate limit: Queue request, show estimated wait time

##### Cloud Privacy Safeguards

**Purpose:** Ensure cloud generation transmits only the minimum necessary data.

**Logic:**

```
1. Before cloud request, show consent dialog:
   "Your text will be sent to an AI service for card generation.
    No account info, study data, or device info is transmitted.
    Do you want to continue?"
   Options: "Send Text" | "Use On-Device Instead" | "Cancel"
2. The API request contains ONLY:
   - The input text
   - The card_type_preference
   - A random request ID (not linked to user)
3. The API request does NOT contain:
   - User identity or account info
   - Device ID or fingerprint
   - Deck names or existing card content
   - Study history or statistics
4. Response is processed locally and the text is not cached by the app
   after card generation completes
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Text too short (<50 chars) | Inline message: "Enter more text for better card generation" | User adds content |
| Text exceeds limit | Character count turns red, Generate button disabled | User trims text |
| On-device model not loaded | "Downloading AI model (250MB)... Use Cloud AI for faster start" | Progress bar for download |
| On-device generation fails | "Card generation failed. Try Cloud AI or create cards manually." | User switches mode or creates manually |
| Cloud API timeout | "Generation timed out. Check your connection and try again." | User retries |
| Cloud API returns invalid data | "Could not parse generated cards. Try again." | User retries; different results expected |
| Zero cards generated | "No cards could be generated from this text. Try different content." | User edits text or tries a different excerpt |

**Validation Timing:**
- Character limit validated in real-time as user types/pastes
- Content quality check (minimum length) on Generate button tap
- Generated card validation before displaying results

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user pastes 2,000 words of biology notes and selects On-Device mode,
   **When** they tap Generate,
   **Then** approximately 10-20 flashcards are generated within 10 seconds, each with a question on the front and an answer on the back.

2. **Given** the user reviews 15 generated cards and deselects 3,
   **When** they tap "Save Selected,"
   **Then** 12 cards are saved to the target deck as standard cards with source="ai_ondevice."

3. **Given** the user selects Cloud AI mode,
   **When** they tap Generate,
   **Then** a consent dialog appears before any text is transmitted.

4. **Given** generated cards are displayed,
   **When** the user taps edit on a card and modifies the back text,
   **Then** the modified version is saved when "Save" is tapped.

**Edge Cases:**

5. **Given** the user pastes 50,001 characters,
   **When** the text is entered,
   **Then** the character count is red and the Generate button is disabled.

6. **Given** the input text is a single sentence (30 characters),
   **When** the user taps Generate,
   **Then** the message "Enter more text for better card generation" appears.

**Negative Tests:**

7. **Given** the cloud API is unreachable,
   **When** the user attempts cloud generation,
   **Then** the error message appears with options to retry or switch to on-device.

8. **Given** the user cancels the cloud consent dialog,
   **When** they select "Use On-Device Instead,"
   **Then** generation proceeds locally without any network request.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| rejects empty text | text: "" | Validation error |
| rejects text over 50,000 chars | text: 50,001 chars | Validation error |
| generates cards from definition text | "Mitosis is the process of cell division" | At least 1 card with "mitosis" on front |
| generates cloze from definition | "The powerhouse of the cell is the mitochondria" with cloze_only | Card with {{c1::mitochondria}} |
| deduplicates generated cards | 2 cards with identical fronts | 1 card returned |
| sets source to ai_ondevice | On-device generation | card.source = "ai_ondevice" |
| sets source to ai_cloud | Cloud generation | card.source = "ai_cloud" |
| cloud request contains only text and preference | Inspect cloud API payload | No user ID, device info, or study data |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Generate and save cards | 1. Paste text, 2. Generate, 3. Save All | Cards appear in deck, source field set |
| Generate, edit, and save | 1. Generate, 2. Edit card front, 3. Save | Edited version saved |
| Generate and selectively save | 1. Generate 10, 2. Deselect 3, 3. Save Selected | 7 cards saved, 3 discarded |

---

### FL-021: Shared Deck Browser

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-021 |
| **Feature Name** | Shared Deck Browser |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a new user, I want to browse and download pre-made flashcard decks created by the community, so that I can start studying immediately without creating all cards myself.

**Secondary:**
> As a deck creator, I want to share my decks with the community, so that others can benefit from my work and I can contribute to a growing library.

#### 3.3 Detailed Description

Shared Deck Browser provides access to a curated library of community-contributed flashcard decks. Users can browse decks by category (language, science, history, medicine, etc.), search by keyword, and download decks directly into their local collection. Downloaded decks are fully local and offline after download - no ongoing network connection is required.

The shared deck infrastructure uses a lightweight catalog server that hosts deck metadata (name, description, card count, author alias, category, rating) and download URLs. The actual deck files are stored as .apkg packages, reusing the Anki import pipeline (FL-006) for seamless integration. The catalog server does not require user accounts, does not track download history, and does not collect usage analytics.

Deck sharing is opt-in and anonymous. Users who want to share a deck export it as an .apkg file and submit it to the catalog. The submission process strips all personal data, review history, and scheduling state from the exported deck. Only card content, note models, and deck structure are included.

The catalog is seeded with popular Anki community decks (with permission and proper attribution). Categories include: Languages, Medicine, Science, Mathematics, History, Geography, Computer Science, Law, Music, and General Knowledge. Each category has subcategories (e.g., Languages > Spanish > Vocabulary, Grammar, Conjugation).

Community ratings are anonymous and do not require accounts. A simple up/down vote system determines deck quality. Decks with consistently low ratings are flagged for review and potential removal.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-003: Deck Organization - downloaded decks are created in the local deck hierarchy
- FL-006: Anki .apkg Import - shared decks use the same import pipeline

**External Dependencies:**
- Network access for browsing and downloading shared decks
- Catalog server (hosted, lightweight REST API)
- CDN or object storage for deck file hosting

**Assumed Capabilities:**
- .apkg import pipeline handles all deck formats
- Device has sufficient storage for downloaded decks

#### 3.5 User Interface Requirements

##### Screen: Shared Deck Browser (accessible from Discover tab or deck browser action)

**Layout:**
- Top bar with "Shared Decks" title and search bar
- Below the search bar: horizontal scrolling category chips (All, Languages, Medicine, Science, etc.)
- Featured section: 3-5 staff-picked decks in a horizontal carousel with large cards
- Main content: Vertical scrolling list of deck cards, each showing:
  - Deck name (bold, max 2 lines)
  - Author alias (e.g., "by MedStudent2026")
  - Card count badge
  - Category tag
  - Star rating (1-5, aggregated from votes) and vote count
  - File size
  - "Download" button (or "Downloaded" checkmark if already imported)
- Pull to refresh for latest catalog updates
- "Share a Deck" button in the top-right overflow menu

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Fetching catalog data | Skeleton loading cards for featured + list |
| Populated | Catalog data loaded | Featured carousel + deck list |
| Empty Category | Selected category has no decks | "No decks in this category yet. Be the first to share!" |
| Search Results | User entered a search query | Filtered deck list matching the query |
| No Results | Search matches nothing | "No decks found for '[query]'. Try different keywords." |
| Offline | No network connection | Cached catalog (if available) with "Offline - showing cached results" banner |
| Download In Progress | User tapped Download on a deck | Progress bar on the deck card, download percentage |

**Interactions:**
- Tap category chip: Filters list to that category
- Tap search bar: Opens keyboard with category-scoped search
- Tap deck card: Opens deck detail view (preview cards, full description, reviews)
- Tap "Download": Begins download and import; progress bar appears on the card
- Tap "Downloaded" checkmark: Shows options "Open Deck" or "Re-download"
- Pull down: Refreshes catalog data
- Scroll to bottom: Loads next page (pagination, 20 decks per page)

##### Screen: Shared Deck Detail

**Layout:**
- Deck name (large), author alias, category tag
- Description (collapsible, up to 2000 characters)
- Stats row: card count, download count, file size, date published, last updated
- Star rating with vote count and vote buttons (up/down)
- "Preview Cards" section: Scrollable sample of 5-10 cards (front only)
- "Download" button (full width, prominent)
- "Report" option in overflow menu (for inappropriate content)

**Interactions:**
- Tap card preview: Flips to show the back
- Tap Download: Begins download, shows progress, then navigates to the imported deck
- Tap up/down vote: Registers anonymous vote (1 vote per deck per device)
- Tap Report: Opens report form (categories: spam, offensive, copyright, other)

#### 3.6 Data Requirements

##### Entity: SharedDeckCatalogEntry (fetched from server, cached locally)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key (server-assigned) | None | Unique catalog entry identifier |
| name | string | Required, max 200 chars | None | Deck name |
| description | text | Max 2000 chars | "" | Deck description |
| author_alias | string | Max 50 chars | "Anonymous" | Author display name (no real identity) |
| category | string | Required | None | Primary category |
| subcategory | string | Optional | null | Subcategory |
| card_count | integer | Min: 1 | None | Number of cards in the deck |
| file_size_bytes | integer | Min: 1 | None | Download file size |
| download_url | string | Valid URL | None | URL to the .apkg file |
| rating_up | integer | Min: 0 | 0 | Upvote count |
| rating_down | integer | Min: 0 | 0 | Downvote count |
| download_count | integer | Min: 0 | 0 | Total downloads |
| preview_cards | text | JSON array of {front, back} objects, max 10 | "[]" | Sample cards for preview |
| published_at | datetime | Required | None | When the deck was published |
| updated_at | datetime | Required | None | When the deck was last updated |

##### Entity: SharedDeckDownload (local tracking)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Local download record |
| catalog_entry_id | string | Required | None | Server catalog entry ID |
| deck_id | string | Foreign key to Deck.id | None | Local deck created from download |
| downloaded_at | datetime | Auto-set | Current timestamp | When downloaded |
| catalog_version | datetime | Required | None | updated_at from catalog at download time |

**Relationships:**
- SharedDeckDownload belongs to Deck (many-to-one via download.deck_id)

**Indexes:**
- SharedDeckDownload: (catalog_entry_id) - check if already downloaded
- SharedDeckCatalogEntry: (category, rating) - browsing queries

#### 3.7 Business Logic Rules

##### Catalog Fetching

**Purpose:** Load and cache the shared deck catalog.

**Inputs:**
- category: string, optional - filter by category
- search_query: string, optional - search text
- page: integer - pagination offset
- page_size: integer - items per page (default: 20, max: 50)

**Logic:**

```
1. Build catalog API request:
   GET /api/v1/decks?category=X&q=Y&page=Z&size=20
2. IF network available:
   a. Fetch from server
   b. Cache response locally (SQLite table) with TTL of 1 hour
   c. Display results
3. IF network unavailable:
   a. Load cached catalog if available (may be stale)
   b. Show "Offline" banner
   c. IF no cache exists: Show "Connect to the internet to browse shared decks"
4. Catalog API does NOT receive:
   - User identity
   - Device ID
   - Local deck data or study statistics
```

##### Deck Download and Import

**Purpose:** Download a shared deck and import it locally.

**Inputs:**
- catalog_entry: SharedDeckCatalogEntry - the deck to download

**Logic:**

```
1. Check if deck was previously downloaded:
   a. Look up SharedDeckDownload by catalog_entry_id
   b. IF found AND catalog_version matches: "Already downloaded" - offer re-download
   c. IF found AND catalog_version differs: "Update available" - offer update
2. Download .apkg file from download_url:
   a. Show progress bar (bytes downloaded / total bytes)
   b. Save to temporary directory
3. Import using FL-006 pipeline:
   a. Parse .apkg
   b. Create deck with the shared deck's name
   c. Import all cards with "new" state (ignore source scheduling data)
   d. Import media files
4. Create SharedDeckDownload record linking catalog entry to local deck
5. Clean up temporary .apkg file
6. Navigate to the newly created deck
```

##### Deck Submission (Sharing)

**Purpose:** Allow users to share their decks with the community.

**Logic:**

```
1. User selects a deck and taps "Share to Community"
2. Export deck as .apkg (FL-022) with these modifications:
   a. Strip all review history (ReviewLog entries)
   b. Strip all scheduling data (reset all cards to "new" state)
   c. Strip all tags that start with "_" (private tags)
   d. Preserve card content, note models, and deck structure
3. Collect submission metadata:
   a. Author alias (text input, default "Anonymous")
   b. Category (picker from predefined list)
   c. Description (text input, max 2000 chars)
4. Upload .apkg file and metadata to catalog server
5. Submission enters moderation queue (automatic content scan + optional human review)
6. User receives confirmation: "Deck submitted for review. It will appear in the catalog within 24 hours."
```

**Edge Cases:**
- Deck with 0 cards: Reject submission ("Deck must contain at least 1 card")
- Deck with sensitive media (detected by content scan): Flag for human review
- Duplicate deck name in catalog: Allowed (shown with author disambiguation)
- Download interrupted: Resume from last byte position if server supports Range headers
- Catalog server down: Cached catalog shown; downloads unavailable

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Catalog server unreachable | "Could not connect to shared decks. Check your connection." with retry | Retry button; cached results if available |
| Download fails mid-transfer | "Download failed. Tap to retry." on the deck card | Retry with resume support |
| Insufficient storage for download | "Not enough storage. Need [X]MB, [Y]MB available." | User frees space |
| Imported deck contains corrupt cards | Import succeeds with partial results; error count shown | Details screen shows which cards failed |
| Vote submission fails | Vote appears applied locally but may not persist | Re-synced on next catalog fetch |
| Deck submission rejected by moderation | Email/notification: "Your deck was not approved. Reason: [reason]" | User modifies and resubmits |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Shared Deck Browser with an internet connection,
   **When** the catalog loads,
   **Then** featured decks and a categorized list of community decks appear with name, card count, rating, and download buttons.

2. **Given** the user taps Download on a deck with 500 cards,
   **When** the download and import complete,
   **Then** the deck appears in the user's deck browser with 500 new cards, and the shared deck card shows a "Downloaded" checkmark.

3. **Given** the user searches for "Spanish vocabulary,"
   **When** matching decks exist,
   **Then** results show relevant decks sorted by rating.

4. **Given** the user shares their own deck,
   **When** they fill in the author alias, category, and description,
   **Then** the deck is submitted for review with all scheduling data stripped.

**Edge Cases:**

5. **Given** the user has no internet connection,
   **When** they open the Shared Deck Browser,
   **Then** cached catalog results are shown (if available) with an "Offline" banner.

6. **Given** a deck was previously downloaded and has been updated on the server,
   **When** the user views the deck in the browser,
   **Then** an "Update Available" indicator appears.

**Negative Tests:**

7. **Given** the user tries to download a deck but has no storage space,
   **When** the download begins,
   **Then** the error message shows required vs available space.

8. **Given** the catalog server is completely down and no cache exists,
   **When** the user opens Shared Deck Browser,
   **Then** the message "Connect to the internet to browse shared decks" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| catalog fetch returns paginated results | page=1, size=20 | 20 entries with metadata |
| category filter narrows results | category="Medicine" | Only medicine decks |
| search filters by keyword | query="anatomy" | Decks with "anatomy" in name or description |
| download tracking prevents duplicate | Already downloaded deck | "Already downloaded" state |
| deck export strips scheduling data | Deck with review history | Exported .apkg has all cards as "new" |
| deck export strips private tags | Tags: ["exam", "_personal"] | Exported deck has only "exam" tag |
| vote registers without user identity | Vote request payload | No user ID, device ID, or personal data |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Browse and download flow | 1. Open browser, 2. Browse category, 3. Download deck | Deck appears in local deck browser |
| Offline browsing | 1. Load catalog online, 2. Go offline, 3. Reopen browser | Cached results shown with offline banner |
| Share deck flow | 1. Export deck, 2. Fill metadata, 3. Submit | Confirmation shown; deck data stripped of history |

---

### FL-022: Anki .apkg Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-022 |
| **Feature Name** | Anki .apkg Export |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who also uses Anki on desktop, I want to export my MyFlash decks as .apkg files, so that I can open them in Anki and maintain my deck library across both platforms.

**Secondary:**
> As a user who wants to leave MyFlash, I want to export all my data in a standard format, so that I am not locked into this app and can move to any Anki-compatible tool.

#### 3.3 Detailed Description

Anki .apkg Export produces Anki-compatible deck packages from MyFlash decks. The exported .apkg file can be opened in Anki (desktop or mobile), AnkiDroid, or any application that supports the Anki format. This ensures full data portability and prevents vendor lock-in.

The export process creates a ZIP archive containing an SQLite database (collection.anki2 format) with notes, cards, models, deck configuration, review history, and a media folder with all referenced images and audio files. Users can choose to export a single deck (with or without child decks), or export their entire collection.

Export options include:
- **Include scheduling data:** Export stability, difficulty, interval, and review history. When disabled, all cards export as "new."
- **Include media:** Export referenced images and audio. Disabling produces a smaller file.
- **Include tags:** Export note tags.
- **FSRS to SM-2 conversion:** Convert FSRS scheduling parameters back to Anki's SM-2 format for maximum compatibility with Anki versions that do not support FSRS.

The export runs as a background process for large collections. A notification indicates completion with the export file location. Users can share the .apkg file via the system share sheet (AirDrop, email, cloud storage, etc.).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - cards must exist
- FL-003: Deck Organization - deck structure must exist

**External Dependencies:**
- File system write access for the .apkg output
- ZIP compression library
- System share sheet for file distribution

**Assumed Capabilities:**
- Sufficient storage space for the exported file
- Anki database schema is well-documented and stable

#### 3.5 User Interface Requirements

##### Modal: Export Options

**Layout:**
- Bottom sheet modal triggered from deck overflow menu "Export" or Settings > Export
- Title: "Export Deck"
- Deck selector: Which deck to export (or "Entire Collection")
- Toggle: "Include child decks" (default: on, only shown for parent decks)
- Toggle: "Include scheduling data" (default: on)
- Toggle: "Include media" (default: on)
- Toggle: "Include review history" (default: off for single deck, on for collection)
- Toggle: "Convert to SM-2 format" (default: off, tooltip: "For Anki versions without FSRS support")
- Estimated file size indicator (updates as toggles change)
- "Export" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Options | User selecting export settings | Toggle controls and file size estimate |
| Exporting | Export in progress | Progress bar with percentage and current step |
| Complete | Export finished | Success message with file size, "Share" and "Done" buttons |
| Error | Export failed | Error message with retry button |

**Interactions:**
- Toggle options: File size estimate updates in real-time
- Tap Export: Begins export process
- Tap Share (after complete): Opens system share sheet with the .apkg file
- Tap Done: Dismisses modal

#### 3.6 Data Requirements

##### Entity: ExportRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique export record |
| deck_id | string | Foreign key to Deck.id, nullable | None | Exported deck (null for full collection) |
| file_name | string | Required | None | Output file name |
| file_size_bytes | integer | Min: 0 | 0 | Size of the exported file |
| cards_exported | integer | Min: 0 | 0 | Number of cards included |
| media_exported | integer | Min: 0 | 0 | Number of media files included |
| include_scheduling | boolean | - | true | Whether scheduling data was included |
| include_media | boolean | - | true | Whether media was included |
| exported_at | datetime | Auto-set | Current timestamp | When the export occurred |
| duration_ms | integer | Min: 0 | 0 | How long the export took |

**Indexes:**
- (exported_at) - export history listing

#### 3.7 Business Logic Rules

##### .apkg File Generation

**Purpose:** Create an Anki-compatible package file from a MyFlash deck.

**Inputs:**
- deck_id: string (or null for full collection)
- options: ExportOptions - toggle selections

**Logic:**

```
1. Collect all cards from the target deck (and descendants if include_children)
2. Collect all notes referenced by those cards
3. Collect all note models referenced by those notes
4. Create a temporary directory for the export
5. Create SQLite database "collection.anki2":

   a. Create "col" table (collection metadata):
      - id: 1 (always)
      - crt: collection creation timestamp (Unix seconds)
      - mod: last modification timestamp (Unix seconds)
      - scm: schema modification timestamp
      - ver: 11 (Anki schema version)
      - dty: 0
      - usn: -1
      - ls: 0
      - conf: JSON config string
      - models: JSON object mapping model IDs to model definitions
      - decks: JSON object mapping deck IDs to deck definitions
      - dconf: JSON object mapping deck config IDs to deck configs
      - tags: JSON object of all tags

   b. Create "notes" table:
      - id: integer (Anki uses integer IDs, map from UUID)
      - guid: string (globally unique ID)
      - mid: integer (model ID)
      - mod: integer (modification timestamp, Unix seconds)
      - usn: -1
      - tags: string (space-separated tags)
      - flds: string (field values joined by \x1f separator)
      - sfld: string (sort field, first field value)
      - csum: integer (checksum of first field)
      - flags: 0
      - data: ""

   c. Create "cards" table:
      - id: integer (map from UUID)
      - nid: integer (note ID)
      - did: integer (deck ID)
      - ord: integer (ordinal)
      - mod: integer (modification timestamp)
      - usn: -1
      - type: integer (0=new, 1=learning, 2=review, 3=relearning)
      - queue: integer (-1=suspended, -2=buried, 0=new, 1=learning, 2=review)
      - due: integer (due date as days since collection creation for review,
             or learning step timestamp)
      - ivl: integer (interval in days, negative for seconds)
      - factor: integer (ease factor, converted from FSRS)
      - reps: integer
      - lapses: integer
      - left: integer (learning steps remaining)
      - odue: 0
      - odid: 0
      - flags: 0
      - data: ""

   d. IF include_scheduling AND include_review_history:
      Create "revlog" table with review history

6. IF include_media:
   a. Create "media" JSON mapping file
   b. Copy media files as numbered files (0, 1, 2, ...)
   c. Update file references in card content

7. Create ZIP archive containing:
   - collection.anki2 (the SQLite database)
   - media (the JSON mapping file)
   - 0, 1, 2, ... (media files)

8. Rename ZIP to [deck_name].apkg
9. Create ExportRecord entry
10. RETURN file path to the .apkg
```

##### FSRS to SM-2 Conversion

**Purpose:** Convert FSRS parameters back to Anki SM-2 format for compatibility.

**Inputs:**
- stability: float - FSRS stability
- difficulty: float - FSRS difficulty (1.0-10.0)
- interval_days: integer - current interval

**Logic:**

```
1. Convert FSRS difficulty to Anki ease factor:
   - FSRS difficulty 1.0 (easiest) -> ease factor 3500 (350%)
   - FSRS difficulty 10.0 (hardest) -> ease factor 1300 (130%)
   - ease_factor = round(3500 - ((difficulty - 1.0) / 9.0) * 2200)
   - Clamp to [1300, 3500]

2. Convert interval:
   - For review cards: ivl = interval_days
   - For learning cards: ivl = 0

3. Convert card type and queue:
   - MyFlash "new" -> type=0, queue=0
   - MyFlash "learning" -> type=1, queue=1
   - MyFlash "review" -> type=2, queue=2
   - MyFlash "relearning" -> type=3, queue=1
   - MyFlash queue "suspended" -> queue=-1
   - MyFlash queue "buried" -> queue=-2

4. Convert due date:
   - For review cards: due = days since collection creation
   - For new cards: due = position in new queue
   - For learning cards: due = timestamp (Unix seconds)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient storage for export | "Not enough storage. Estimated file: [X]MB, Available: [Y]MB." | User frees space |
| Media file missing | Export continues without missing file; warning in summary | Summary shows "3 media files missing" |
| Database write error during export | "Export failed. Please try again." | User retries |
| Export cancelled | Partial file deleted, no ExportRecord created | User can restart |
| Very large collection (100,000+ cards) | Progress bar with estimated time | Export runs in background |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a deck with 100 cards and 5 images,
   **When** the user exports with all options enabled,
   **Then** an .apkg file is produced that can be opened in Anki desktop with all cards, images, and review history intact.

2. **Given** the user exports with "Include scheduling data" disabled,
   **When** the .apkg is imported into Anki,
   **Then** all cards appear as "New" with no review history.

3. **Given** the user exports a parent deck with "Include child decks" enabled,
   **When** imported into Anki,
   **Then** the full deck hierarchy is preserved.

**Edge Cases:**

4. **Given** the user exports with "Convert to SM-2" enabled,
   **When** imported into an older Anki version without FSRS,
   **Then** ease factors and intervals are reasonable approximations of the FSRS scheduling state.

5. **Given** a deck with cards containing audio and images,
   **When** exported with "Include media" disabled,
   **Then** the .apkg is smaller, cards reference missing media, and Anki shows placeholder icons.

**Negative Tests:**

6. **Given** insufficient storage space,
   **When** the user taps Export,
   **Then** the error shows required vs available space before starting.

7. **Given** a deck with 0 cards,
   **When** the user tries to export it,
   **Then** the message "This deck has no cards to export" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid ZIP structure | Deck with 10 cards | ZIP contains collection.anki2 + media |
| Anki notes table has correct schema | 5 notes | 5 rows with guid, mid, flds, csum |
| FSRS difficulty 5.0 converts to ease 2283 | D=5.0 | factor=2283 |
| FSRS difficulty 1.0 converts to ease 3500 | D=1.0 | factor=3500 |
| FSRS difficulty 10.0 converts to ease 1300 | D=10.0 | factor=1300 |
| card states map correctly | MyFlash "review" | Anki type=2, queue=2 |
| suspended cards export as queue -1 | queue="suspended" | Anki queue=-1 |
| empty deck produces no export | 0 cards | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Round-trip: export then re-import | 1. Export deck, 2. Delete deck, 3. Re-import .apkg | Deck restored with all content |
| Export parent with children | 1. Create parent + 2 children, 2. Export parent | .apkg contains full hierarchy |
| Export without media | 1. Deck with 3 images, 2. Export media=off | .apkg has no media files, much smaller size |

---

### FL-023: AI Practice Tests

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-023 |
| **Feature Name** | AI Practice Tests |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student preparing for a multiple-choice exam, I want to take practice tests generated from my flashcard decks, so that I can test my knowledge in a format that matches the real exam.

**Secondary:**
> As a language learner, I want to practice with fill-in-the-blank and matching exercises generated from my vocabulary cards, so that I can reinforce learning through varied question formats.

#### 3.3 Detailed Description

AI Practice Tests generates quiz-format assessments from existing flashcard deck content. Instead of the standard one-card-at-a-time flashcard review, this feature presents cards as structured test questions: multiple choice, fill-in-the-blank, matching, and true/false. The AI analyzes card content to generate plausible distractors (wrong answers) for multiple-choice questions and appropriate blank positions for fill-in-the-blank.

Practice tests are generated on-demand from a selected deck (or tag subset). The user specifies the test format, question count, and difficulty preference. The AI generates the test locally (preferred) or via cloud API (opt-in, same privacy model as FL-020).

Test results are displayed as a score with detailed review of incorrect answers. Practice test results do NOT affect FSRS scheduling (they are separate from spaced repetition reviews). However, the feature tracks test scores over time so users can see their improvement.

Question types:
1. **Multiple Choice (4 options):** Card front as question, card back as correct answer, 3 AI-generated distractors. Distractors are plausible wrong answers from the same deck or same category.
2. **True/False:** Card front paired with either the correct back (true) or a distractor (false). 50/50 split.
3. **Fill-in-the-blank:** Card back with a key term replaced by a blank. User types the missing term.
4. **Matching:** 5-8 card fronts displayed alongside shuffled backs. User draws connections.

Test length options: 10, 20, 30, 50, or custom (up to 100 questions). Default: 20 questions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card content is the source for questions
- FL-003: Deck Organization - tests are generated per deck

**External Dependencies:**
- On-device ML model (shared with FL-020) for distractor generation
- Cloud AI API (opt-in) for higher-quality distractor generation

**Assumed Capabilities:**
- Deck has at least 4 cards (minimum for multiple choice with unique distractors)

#### 3.5 User Interface Requirements

##### Screen: Practice Test Setup

**Layout:**
- Top bar with "Practice Test" title
- Deck selector (which deck to test from)
- Question format selector (checkboxes, multiple can be selected):
  - Multiple Choice (default: on)
  - True/False (default: off)
  - Fill-in-the-Blank (default: off)
  - Matching (default: off)
- Question count selector: 10 | 20 | 30 | 50 | Custom
- Difficulty preference: "All Cards" (default) | "Hard Cards Only" (difficulty > 6.0) | "Leeches Only" (lapses >= 8)
- "Generate Test" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Setup | User configuring options | All selectors and options |
| Generating | Test being generated | Progress indicator "Creating your test..." |
| Insufficient Cards | Deck has fewer than 4 cards | Warning: "Need at least 4 cards for a practice test" |
| Ready | Test generated | Transition to test-taking screen |

##### Screen: Practice Test Taking

**Layout:**
- Top bar with question counter "3 / 20" and timer (optional)
- Progress bar below top bar
- Question area (varies by type):
  - **Multiple Choice:** Question text + 4 tappable option cards (A, B, C, D)
  - **True/False:** Statement text + "True" / "False" buttons
  - **Fill-in-the-Blank:** Text with blank + text input field
  - **Matching:** Left column of fronts + right column of shuffled backs + draw lines
- "Next" button (appears after answering)
- "Skip" button (marks as unanswered)

**States per question:**

| State | Condition | Display |
|-------|-----------|---------|
| Unanswered | Question displayed, no answer selected | All options neutral color |
| Answered Correct | User selected correct answer | Correct option highlighted green, brief confetti animation |
| Answered Incorrect | User selected wrong answer | Selected option highlighted red, correct answer highlighted green |
| Skipped | User tapped Skip | Question grayed out, marked as skipped |

**Interactions:**
- Tap option (MC): Locks in answer, shows correct/incorrect feedback
- Tap True/False: Locks in answer, shows feedback
- Submit text (Fill-in-Blank): Checks answer (case-insensitive, trimmed), shows feedback
- Draw line (Matching): Connects front to back; line turns green if correct, red if wrong
- Tap Next: Advances to next question
- Tap Skip: Marks unanswered, advances

##### Screen: Practice Test Results

**Layout:**
- Large score percentage in a circular progress indicator
- Score fraction: "16 / 20 correct"
- Grade label: A (90-100%), B (80-89%), C (70-79%), D (60-69%), F (<60%)
- Time taken
- Per-question breakdown (scrollable list):
  - Question number, question type icon, correct/incorrect indicator
  - Tapping reveals: the question, user's answer, correct answer
- "Retry Incorrect" button (creates a new test with only the wrong answers)
- "Done" button (returns to deck)
- Score history chart (if previous tests exist for this deck)

#### 3.6 Data Requirements

##### Entity: PracticeTest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique test identifier |
| deck_id | string | Foreign key to Deck.id | None | Source deck |
| question_count | integer | Min: 4, Max: 100 | 20 | Number of questions |
| correct_count | integer | Min: 0 | 0 | Questions answered correctly |
| skipped_count | integer | Min: 0 | 0 | Questions skipped |
| score_percent | float | Min: 0.0, Max: 100.0 | 0.0 | Score as percentage |
| time_taken_ms | integer | Min: 0 | 0 | Total test time |
| question_types | text | JSON array of strings | None | Types used in this test |
| questions | text | JSON array of question objects | None | Full test content with answers |
| taken_at | datetime | Auto-set | Current timestamp | When the test was taken |

**Relationships:**
- PracticeTest belongs to Deck (many-to-one via test.deck_id)

**Indexes:**
- (deck_id, taken_at) - test history for a deck

#### 3.7 Business Logic Rules

##### Distractor Generation

**Purpose:** Generate plausible wrong answers for multiple-choice questions.

**Inputs:**
- correct_answer: string - the card's back (correct answer)
- deck_cards: Card[] - all cards in the deck
- count: integer - number of distractors needed (default: 3)

**Logic:**

```
1. Priority 1 - Same-deck distractors:
   a. Collect all unique back values from other cards in the deck
   b. Remove the correct answer
   c. IF 3+ candidates available:
        Randomly select 3 from candidates
        RETURN selected distractors
2. Priority 2 - AI-generated distractors:
   a. IF on-device model available:
        Generate 3 plausible wrong answers based on:
        - The correct answer's domain (inferred from deck name/tags)
        - Similar format/length to the correct answer
        - Factually incorrect but believable
   b. IF cloud model available (opt-in):
        Send correct answer + question context to AI API
        Receive 3 distractors
3. Priority 3 - Shuffled fragments:
   a. Take words from other card backs in the deck
   b. Combine into answer-length phrases
   c. This is the lowest-quality fallback
4. Validate distractors:
   - No distractor matches the correct answer (case-insensitive)
   - No two distractors are identical
   - Distractors are similar in length to the correct answer (+/- 50%)
5. Shuffle the 4 options (correct + 3 distractors) randomly
```

##### Fill-in-the-Blank Generation

**Purpose:** Convert a card's back into a fill-in-the-blank question.

**Inputs:**
- back: string - the card's back content

**Logic:**

```
1. Tokenize the back content into words
2. Identify key terms using heuristics:
   a. Proper nouns (capitalized words not at sentence start)
   b. Numbers and dates
   c. Technical terms (words not in common word list)
   d. The longest noun phrase
3. Select one key term as the blank
4. Replace the key term with "________"
5. The question becomes the modified back text
6. The answer is the removed key term
7. Acceptance check: case-insensitive comparison with trimmed whitespace
8. If no suitable key term found: fall back to blanking the first noun
```

##### Score Calculation

**Purpose:** Compute practice test score.

**Logic:**

```
1. score_percent = (correct_count / (question_count - skipped_count)) * 100
2. IF all questions skipped: score_percent = 0
3. Grade assignment:
   - A: score_percent >= 90
   - B: score_percent >= 80
   - C: score_percent >= 70
   - D: score_percent >= 60
   - F: score_percent < 60
4. Tests do NOT affect FSRS scheduling
   (no ReviewLog entries, no card state changes)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Deck has fewer than 4 cards | "Need at least 4 cards for a practice test" | User adds more cards |
| Distractor generation fails | Fall back to shuffled-fragment distractors | Lower quality but functional |
| AI model unavailable | Use same-deck distractors only | Reduced quality but no AI dependency |
| Test interrupted (app crash) | Test state not persisted (tests are ephemeral) | User retakes the test |
| Fill-in-blank cannot find key term | Skip that card, use a different card | Transparent to user |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects a deck with 50 cards and chooses "Multiple Choice, 20 questions,"
   **When** the test generates,
   **Then** 20 multiple-choice questions appear, each with 4 options (1 correct, 3 distractors).

2. **Given** the user completes a practice test with 16/20 correct,
   **When** the results display,
   **Then** the score shows 80% with a "B" grade, time taken, and a per-question breakdown.

3. **Given** the user taps "Retry Incorrect" after getting 4 wrong,
   **When** the retry test generates,
   **Then** a new 4-question test appears using only the previously incorrect cards.

**Edge Cases:**

4. **Given** a deck with exactly 4 cards,
   **When** a multiple-choice test is generated,
   **Then** each question uses the other 3 cards' backs as distractors (no AI needed).

5. **Given** the user selects matching format with 8 cards in the deck,
   **When** the matching section generates,
   **Then** all 8 fronts and 8 backs are displayed for matching.

**Negative Tests:**

6. **Given** a deck with 2 cards,
   **When** the user tries to generate a practice test,
   **Then** the message "Need at least 4 cards for a practice test" appears.

7. **Given** a practice test is completed,
   **When** the user checks their cards' scheduling data,
   **Then** no card stability, difficulty, or due dates have changed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates 3 unique distractors | Deck with 10 cards, correct="Paris" | 3 different wrong answers, none is "Paris" |
| distractors come from same deck first | 5 cards with city names | Distractors are other city names from the deck |
| fill-in-blank finds key term | "The mitochondria is the powerhouse of the cell" | Blank: "The ________ is the powerhouse of the cell", answer: "mitochondria" |
| score calculation with skips | 15 correct, 3 wrong, 2 skipped | 83.3% (15/18) |
| grade assignment B | score=85% | Grade "B" |
| minimum 4 cards enforced | Deck with 3 cards | Validation error |
| practice test does not create ReviewLog | Complete test with 10 questions | 0 new ReviewLog entries |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full practice test flow | 1. Setup, 2. Generate, 3. Answer all, 4. View results | Score + breakdown displayed correctly |
| Retry incorrect | 1. Complete test, 2. Get 5 wrong, 3. Retry incorrect | New test with those 5 cards |
| Score history | 1. Take 3 tests on same deck | Score history chart shows 3 data points |

---

### FL-024: Match Game Mode

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-024 |
| **Feature Name** | Match Game Mode |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a student who finds standard flashcard review monotonous, I want a fast-paced matching game where I pair card fronts with backs against a timer, so that I can learn through a different modality and break up my study sessions.

**Secondary:**
> As a competitive learner, I want to beat my best time on the matching game, so that I have a fun speed challenge that reinforces my knowledge.

#### 3.3 Detailed Description

Match Game Mode is a timed study game where the user matches card fronts to their corresponding backs as quickly as possible. A grid of tiles is displayed, each showing either a front or back of a card. The user taps two tiles to form a pair - one front and one back that belong to the same card. Correct matches are removed from the board. The game ends when all pairs are matched.

The game tracks completion time and displays a star rating (1-3 stars based on speed). Personal best times are saved per deck. The game mode is entirely separate from FSRS scheduling - no ReviewLog entries are created and no scheduling data is modified.

Game board size scales with the number of available cards:
- 6 tiles (3 pairs): Quick round, for decks with 3-5 cards
- 12 tiles (6 pairs): Standard round, default for most decks
- 20 tiles (10 pairs): Extended round, for focused practice
- 30 tiles (15 pairs): Challenge round, for large decks

Cards are selected randomly from the deck (or tag subset). If a deck has fewer cards than the selected board size, the largest possible board is used. Front text and back text are each truncated to 60 characters for display on tiles.

The game has a Quizlet-style feel: clean, colorful tiles with smooth flip and match animations. Incorrect matches cause the tiles to shake briefly and flip back. A mistake counter tracks errors for the star rating calculation.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - card content provides matching pairs
- FL-003: Deck Organization - games are started from decks

**External Dependencies:**
- None

**Assumed Capabilities:**
- Deck has at least 3 cards (minimum for a 6-tile board)
- Screen can display a grid of at least 6 tiles

#### 3.5 User Interface Requirements

##### Screen: Match Game

**Layout:**
- Top bar with: back arrow (left), deck name (center), timer (right, counts up from 0:00)
- Below top bar: mistakes counter ("Mistakes: 0") and pairs remaining ("5 / 6 remaining")
- Main area: Grid of tiles arranged in rows
  - 6 tiles: 2 rows x 3 columns
  - 12 tiles: 3 rows x 4 columns
  - 20 tiles: 4 rows x 5 columns
  - 30 tiles: 5 rows x 6 columns
- Each tile is a rounded rectangle showing text content (front or back of a card)
- Tiles are color-coded: fronts use one accent color, backs use another
- Matched pairs fade out or collapse with a celebration animation

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Game loaded, tiles face up for 3-second preview | All tiles visible for memorization, countdown "3... 2... 1..." |
| Playing | Active game, tiles face down | Tiles show colored backs, tappable |
| One Selected | User tapped first tile | First tile flips to show content, stays revealed |
| Two Selected (Match) | Second tile matches first | Both tiles glow green, then shrink/fade out (300ms) |
| Two Selected (No Match) | Second tile does not match | Both tiles shake (200ms), then flip back to face-down (500ms delay for reading) |
| Complete | All pairs matched | Celebration screen with time, mistakes, and star rating |
| Paused | User tapped pause or navigated away | Timer paused, tiles hidden |

**Interactions:**
- Tap tile (first selection): Tile flips to reveal content (150ms flip animation)
- Tap tile (second selection): Second tile flips; system checks for match
- Tap already-matched area: No effect
- Tap the same tile twice: Deselects (flips back)
- Swipe down or tap back: Pauses game

**Transitions/Animations:**
- Initial preview: All tiles visible for 3 seconds, then simultaneously flip to face-down (300ms)
- Tile flip: 3D rotation animation around vertical axis (150ms)
- Match found: Both tiles pulse green, then shrink to zero (300ms), grid items collapse inward
- No match: Tiles shake horizontally 3x (200ms), pause 500ms for reading, flip back (150ms)
- Game complete: Remaining empty spaces collapse, timer stops, star rating animates in

##### Screen: Match Game Results

**Layout:**
- Large star rating (1-3 stars, animated fill)
- Time taken (large, centered)
- Mistakes count
- Personal best time (with "New Record!" badge if beaten)
- "Play Again" button (reshuffles same deck)
- "Change Deck" button
- "Done" button

**Star Rating Criteria (for a 12-tile / 6-pair game):**

| Stars | Criteria |
|-------|----------|
| 3 Stars | 0-1 mistakes AND time < 30 seconds |
| 2 Stars | 2-4 mistakes OR time < 60 seconds |
| 1 Star | 5+ mistakes OR time >= 60 seconds |

Scale proportionally for other board sizes (2x tiles = 2x time thresholds).

#### 3.6 Data Requirements

##### Entity: MatchGameResult

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique game result identifier |
| deck_id | string | Foreign key to Deck.id | None | Deck played |
| board_size | integer | One of: 6, 12, 20, 30 | 12 | Number of tiles |
| time_ms | integer | Min: 0 | 0 | Completion time in milliseconds |
| mistakes | integer | Min: 0 | 0 | Number of incorrect pairs attempted |
| stars | integer | Min: 1, Max: 3 | 1 | Star rating earned |
| card_ids | text | JSON array of card IDs | None | Which cards were used |
| played_at | datetime | Auto-set | Current timestamp | When the game was played |

##### Entity: MatchGameBest (per deck per board size)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| deck_id | string | Part of composite PK | None | Deck |
| board_size | integer | Part of composite PK | None | Board size |
| best_time_ms | integer | Min: 0 | None | Best completion time |
| best_stars | integer | Min: 1, Max: 3 | 1 | Best star rating |
| achieved_at | datetime | Required | None | When the record was set |

**Indexes:**
- MatchGameResult: (deck_id, played_at) - game history
- MatchGameBest: (deck_id, board_size) - primary key, best time lookup

#### 3.7 Business Logic Rules

##### Board Generation

**Purpose:** Create a shuffled game board from deck cards.

**Inputs:**
- deck_id: string - source deck
- board_size: integer - number of tiles (6, 12, 20, or 30)

**Logic:**

```
1. Determine pairs_needed = board_size / 2
2. Collect all cards from the deck (and descendants)
3. Filter out suspended cards
4. IF available_cards < pairs_needed:
     Use all available cards, adjust board_size = available_cards * 2
     IF available_cards < 3: Reject ("Need at least 3 cards for matching game")
5. Randomly select pairs_needed cards
6. Create tiles:
   FOR EACH selected card:
     Create front_tile with card.front content (truncated to 60 chars)
     Create back_tile with card.back content (truncated to 60 chars)
7. Shuffle all tiles randomly using Fisher-Yates algorithm
8. Assign grid positions (row, column)
9. RETURN { tiles, pairs_needed, board_dimensions }
```

##### Match Checking

**Purpose:** Determine if two selected tiles form a valid pair.

**Inputs:**
- tile_a: Tile - first selected tile
- tile_b: Tile - second selected tile

**Logic:**

```
1. IF tile_a.card_id == tile_b.card_id
   AND tile_a.side != tile_b.side (one is front, one is back):
     RETURN match = true
     Remove both tiles from the board
     Decrement pairs_remaining
     IF pairs_remaining == 0: Game complete
2. ELSE:
     RETURN match = false
     Increment mistakes counter
     After 500ms delay, flip both tiles back
```

##### Star Rating Calculation

**Purpose:** Assign a star rating based on performance.

**Inputs:**
- board_size: integer
- time_ms: integer
- mistakes: integer

**Logic:**

```
1. Compute time thresholds based on board size:
   base_time_3star = 5000 * (board_size / 2)   // 5 seconds per pair for 3 stars
   base_time_2star = 10000 * (board_size / 2)   // 10 seconds per pair for 2 stars

   Example for 12-tile board (6 pairs):
     3-star threshold: 30,000ms (30 seconds)
     2-star threshold: 60,000ms (60 seconds)

2. Compute mistake thresholds:
   mistake_3star = max(1, floor(board_size / 6))   // ~1 mistake per 6 tiles
   mistake_2star = max(3, floor(board_size / 3))    // ~1 mistake per 3 tiles

   Example for 12-tile board:
     3-star: <= 1 mistake
     2-star: <= 4 mistakes

3. Assign rating:
   IF time_ms <= base_time_3star AND mistakes <= mistake_3star: stars = 3
   ELSE IF time_ms <= base_time_2star AND mistakes <= mistake_2star: stars = 2
   ELSE: stars = 1

4. Update MatchGameBest if this is a new record for deck + board_size:
   IF stars > best_stars OR (stars == best_stars AND time_ms < best_time_ms):
     Update best record
```

**Edge Cases:**
- Board with only 3 pairs (6 tiles): Star thresholds scale down proportionally
- Tile text longer than 60 characters: Truncated with ellipsis "..."
- Cards with identical front and back text: Both tiles show the same text, still matchable
- Game paused: Timer stops, tiles are hidden; resuming re-shows the board

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Deck has fewer than 3 cards | "Need at least 3 cards for matching game" | User adds cards or selects different deck |
| Game state lost (app crash) | Game is not resumable (no state persistence) | User starts a new game |
| Timer overflow (game left open > 24 hours) | Timer caps at 99:59 display | Still records actual time |
| Card content renders incorrectly on tile | Plain text fallback (strip formatting) | Tile displays raw text |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a deck with 20 cards and the user selects a 12-tile board,
   **When** the game starts,
   **Then** 12 tiles appear (6 fronts, 6 backs) in a 3x4 grid, previewed for 3 seconds before flipping face-down.

2. **Given** the user taps two tiles that belong to the same card (one front, one back),
   **When** the match is detected,
   **Then** both tiles glow green and animate out, the pairs remaining counter decrements.

3. **Given** the user completes a 12-tile game in 25 seconds with 0 mistakes,
   **When** the results display,
   **Then** 3 stars are awarded, the time is shown, and if this is the fastest time for this deck/size, "New Record!" appears.

**Edge Cases:**

4. **Given** a deck with exactly 3 cards,
   **When** the user starts a match game,
   **Then** a 6-tile board (3 pairs) is generated.

5. **Given** a card with a 200-character back text,
   **When** it appears on a tile,
   **Then** the text is truncated to 60 characters with "..." appended.

**Negative Tests:**

6. **Given** a deck with 2 cards,
   **When** the user tries to start a match game,
   **Then** the message "Need at least 3 cards for matching game" appears.

7. **Given** the user taps two tiles from different cards,
   **When** the mismatch is detected,
   **Then** both tiles shake, the mistake counter increments, and tiles flip back after 500ms.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| board generation creates correct tile count | board_size=12, 20 cards | 12 tiles (6 front, 6 back) |
| board generation uses Fisher-Yates shuffle | 6 pairs | Tiles are randomly positioned |
| match detection correct pair | tile_a.card_id=X front, tile_b.card_id=X back | match = true |
| match detection wrong pair | tile_a.card_id=X, tile_b.card_id=Y | match = false |
| star rating 3 stars | 12 tiles, 25s, 0 mistakes | 3 stars |
| star rating 2 stars | 12 tiles, 45s, 3 mistakes | 2 stars |
| star rating 1 star | 12 tiles, 90s, 8 mistakes | 1 star |
| text truncation at 60 chars | 100-char text | First 60 chars + "..." |
| minimum 3 cards enforced | 2 cards | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete match game | 1. Start game, 2. Match all pairs, 3. View results | Score with stars, time, and mistakes |
| Personal best tracking | 1. Play game (40s), 2. Play again (25s) | Second game shows "New Record!" |
| Play again reshuffles | 1. Complete game, 2. Tap "Play Again" | New board with reshuffled tiles from same deck |

---

### FL-025: Competitive Leagues

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-025 |
| **Feature Name** | Competitive Leagues |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a competitive learner, I want to earn XP from my study sessions and compete on a weekly leaderboard, so that I feel motivated to study consistently and can see how I compare to others.

**Secondary:**
> As a social learner, I want to join a league tier and compete for promotion each week, so that I have a long-term progression system that keeps me engaged.

#### 3.3 Detailed Description

Competitive Leagues adds a Duolingo-style league and XP system to MyFlash. Users earn experience points (XP) from study activities (card reviews, completing sessions, maintaining streaks, match game scores). Each week, users compete in a league tier with approximately 30 other users. The top performers are promoted to a higher tier, middle performers stay, and the bottom performers are demoted.

This feature is entirely opt-in. Users must explicitly join the leagues system, and they can leave at any time. Joining requires a display name (not real name) and consent to share their weekly XP total with the leaderboard server. No study content, deck data, scheduling parameters, or review-level data is transmitted - only the weekly XP total and display name.

League tiers (from bottom to top): Bronze, Silver, Gold, Platinum, Diamond, Obsidian, Amethyst. Each tier has a distinct color and icon. Promotion and demotion happen at the weekly reset (Sunday midnight UTC):
- Top 5 in a league: Promoted to next tier
- Bottom 5 in a league: Demoted to previous tier
- Middle 20: Stay in current tier

XP earning rates:
- Card review: 10 XP per card reviewed
- Session completion bonus: 20 XP for completing a session (all due cards reviewed)
- Perfect session: 30 XP bonus for 100% accuracy (all Good or Easy)
- Streak milestone: 50 XP for each 7-day streak milestone
- Match game: 5 XP per correct match
- Practice test: 1 XP per correct answer

Daily XP cap: 500 XP (prevents grinding and ensures the system rewards consistent daily study over marathon sessions).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-005: Study Session with Review Queue - XP is earned from reviews
- FL-014: Streak Tracking - streak milestones earn bonus XP

**External Dependencies:**
- Network access for leaderboard synchronization
- Leaderboard server (lightweight REST API)
- Device-unique anonymous identifier for league participation

**Assumed Capabilities:**
- User has opted into leagues (explicit consent)
- Network is intermittently available (XP batches sync when connected)

#### 3.5 User Interface Requirements

##### Screen: Leagues (accessible from Stats tab or dedicated section)

**Layout:**
- Top section: Current tier badge (large icon with tier name and color)
- XP progress this week: "350 XP this week" with a bar showing progress toward top 5
- Time remaining: "2 days, 14 hours until reset"
- Leaderboard list: Scrollable list of ~30 users in the current league
  - Each row: rank number, display name, XP this week
  - Current user's row is highlighted
  - Top 5 rows have a green "Promote" zone
  - Bottom 5 rows have a red "Demote" zone
  - Middle rows have a neutral zone
- "Your Stats" section below the leaderboard:
  - Current tier
  - Weeks at current tier
  - Highest tier achieved
  - Total XP all-time

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not Joined | User has not opted into leagues | Invite screen: "Join Leagues to compete with other learners!" with "Join" button and privacy disclosure |
| Active | User is in a league | Leaderboard with current standings |
| Loading | Syncing latest standings | Skeleton leaderboard with loading indicator |
| Offline | No network | Cached standings with "Last updated: [time]" note |
| Weekly Reset | Reset in progress (Sunday midnight UTC) | "Calculating new standings..." animation |
| Promoted | User was promoted after last reset | Celebration modal: "Promoted to Silver!" with tier badge |
| Demoted | User was demoted after last reset | Encouragement modal: "Keep studying to climb back up!" |

**Interactions:**
- Tap "Join": Shows privacy disclosure and display name setup, then joins
- Pull down: Refreshes standings from server
- Tap another user: No action (no user profiles - privacy)
- Tap tier badge: Shows tier progression (all 7 tiers with requirements)
- Tap "Leave Leagues": Confirmation dialog, then removes user from leagues

##### Modal: League Join

**Layout:**
- Title: "Join MyFlash Leagues"
- Privacy disclosure box:
  "By joining, you agree to share:
  - Your display name (chosen below)
  - Your weekly XP total

  We will NOT share:
  - What you study
  - Your decks or cards
  - Your study schedule or retention data
  - Any personal information"
- Display name input (max 20 characters, profanity filter)
- "Join" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: LeagueProfile (local)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "league-profile" | Singleton |
| is_enrolled | boolean | - | false | Whether user has joined leagues |
| display_name | string | Max 20 chars, filtered | None | User's league display name |
| anonymous_id | string | UUID v4, auto-generated | Auto | Device-unique ID for server (not linked to user identity) |
| current_tier | enum | One of: bronze, silver, gold, platinum, diamond, obsidian, amethyst | bronze | Current league tier |
| highest_tier | enum | Same as current_tier | bronze | Best tier ever achieved |
| weeks_at_tier | integer | Min: 0 | 0 | Consecutive weeks at current tier |
| total_xp | integer | Min: 0 | 0 | Cumulative XP all-time |
| week_xp | integer | Min: 0 | 0 | XP earned this week (resets weekly) |
| last_sync_at | datetime | Nullable | null | Last leaderboard sync |

##### Entity: XPEvent (local log)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique event ID |
| event_type | enum | One of: review, session_complete, perfect_session, streak_milestone, match_correct, test_correct | None | What earned the XP |
| xp_amount | integer | Min: 1 | None | XP earned |
| synced | boolean | - | false | Whether this event has been synced to server |
| earned_at | datetime | Auto-set | Current timestamp | When XP was earned |

**Indexes:**
- XPEvent: (earned_at) - daily aggregation
- XPEvent: (synced) - pending sync queue

##### Entity: LeagueStanding (cached from server)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| rank | integer | Min: 1 | None | Position in the leaderboard |
| display_name | string | Max 20 chars | None | User's display name |
| week_xp | integer | Min: 0 | None | XP earned this week |
| is_self | boolean | - | false | Whether this is the current user |
| zone | enum | One of: promote, stay, demote | stay | Promotion/demotion zone |

#### 3.7 Business Logic Rules

##### XP Earning

**Purpose:** Award XP for study activities.

**Logic:**

```
1. After each card review:
   a. Compute daily_xp = SUM(XPEvent.xp_amount WHERE earned_at >= today_midnight)
   b. IF daily_xp >= 500: No more XP today (cap reached)
   c. ELSE: Create XPEvent(event_type="review", xp_amount=10)

2. After session completion:
   IF session.is_completed AND all due cards reviewed:
     Create XPEvent(event_type="session_complete", xp_amount=20)
     IF session accuracy == 100%:
       Create XPEvent(event_type="perfect_session", xp_amount=30)

3. After streak milestone:
   IF current_streak > 0 AND current_streak % 7 == 0:
     Create XPEvent(event_type="streak_milestone", xp_amount=50)

4. After match game correct match:
   Create XPEvent(event_type="match_correct", xp_amount=5)

5. After practice test correct answer:
   Create XPEvent(event_type="test_correct", xp_amount=1)

6. Update LeagueProfile:
   week_xp += xp_amount
   total_xp += xp_amount

7. All XP checks respect the daily 500 XP cap
```

##### Leaderboard Sync

**Purpose:** Sync local XP with the leaderboard server.

**Logic:**

```
1. Sync triggers:
   - On app launch (if enrolled)
   - After every study session ends
   - Every 15 minutes while app is active
   - When user opens Leagues screen

2. Sync request payload (POST /api/v1/leagues/sync):
   {
     "anonymous_id": "<device UUID>",
     "display_name": "<user chosen name>",
     "week_xp": <current week total>,
     "current_tier": "<tier name>"
   }
   NO study content, deck data, or personal info included.

3. Sync response:
   {
     "standings": [<LeagueStanding array>],
     "week_ends_at": "<ISO datetime>",
     "your_rank": <integer>,
     "your_zone": "promote|stay|demote"
   }

4. Cache response locally for offline display
5. Mark synced XPEvents as synced=true
```

##### Weekly Reset

**Purpose:** Process promotions and demotions at the end of each week.

**Logic:**

```
1. Server processes reset at Sunday 00:00 UTC
2. For each league group (~30 users):
   a. Rank by week_xp descending
   b. Ranks 1-5: Set zone="promote"
   c. Ranks 6-25: Set zone="stay"
   d. Ranks 26-30: Set zone="demote"
3. Apply tier changes:
   - Promoted users move up one tier (unless already at Amethyst)
   - Demoted users move down one tier (unless already at Bronze)
   - Staying users remain at current tier
4. Reset all week_xp to 0
5. Reassign league groups (mix promoted/demoted/staying users)
6. On next client sync:
   a. Update local LeagueProfile with new tier
   b. Show promotion/demotion modal
   c. Update highest_tier if promoted past previous best
```

**Edge Cases:**
- User offline during reset: Changes applied on next sync
- User joins mid-week: Placed in a league group immediately, starts with 0 XP
- League group has fewer than 30 users: Adjust promotion/demotion zones proportionally (top 15%, bottom 15%)
- User leaves and rejoins: Starts at Bronze tier with 0 week XP
- Daily XP cap reached: Toast "Daily XP limit reached (500). Come back tomorrow!"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Server sync fails | "Could not update standings. Showing cached data." | Auto-retry on next trigger |
| Display name rejected (profanity) | "Display name not allowed. Please choose another." | User enters a new name |
| Anonymous ID conflict | Server generates new ID and reassigns | Transparent to user |
| XP event lost (app crash before save) | Lost XP (not recoverable) | XP from the next event onward is tracked |
| League group too small (<10 users) | No promotion/demotion this week | Message: "Not enough participants this week" |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user joins leagues with display name "StudyPro,"
   **When** they earn 100 XP from card reviews,
   **Then** the leaderboard shows "StudyPro" with 100 XP at the correct rank.

2. **Given** the user is ranked 3rd at the end of the week in the Silver tier,
   **When** the weekly reset occurs,
   **Then** the user is promoted to Gold tier and a celebration modal appears.

3. **Given** the user completes a perfect study session (all Good/Easy),
   **When** XP is calculated,
   **Then** they earn 10 XP per card + 20 XP session bonus + 30 XP perfect bonus.

**Edge Cases:**

4. **Given** the user has earned 495 XP today and reviews a card,
   **When** the 10 XP would push them to 505,
   **Then** they earn only 5 XP (capped at 500), and a toast says "Daily XP limit reached."

5. **Given** the user leaves leagues and rejoins 3 weeks later,
   **When** they rejoin,
   **Then** they start at Bronze tier with 0 week XP.

**Negative Tests:**

6. **Given** the user is not enrolled in leagues,
   **When** they earn XP from reviews,
   **Then** no XP is tracked and no leaderboard data is synced.

7. **Given** the network is unavailable,
   **When** the user opens the Leagues screen,
   **Then** cached standings are shown with "Last updated: [time]" note.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| review earns 10 XP | Card review completed | XPEvent with amount=10 |
| session complete earns 20 XP | Session is_completed=true | XPEvent with amount=20 |
| perfect session earns 50 XP total | 100% accuracy session | 20 (session) + 30 (perfect) = 50 XP |
| daily XP cap at 500 | 490 current + 10 new review | week_xp increases by 10 |
| daily XP cap blocks excess | 498 current + 10 new review | Only 2 XP awarded (cap at 500) |
| streak milestone at day 7 | current_streak=7 | XPEvent streak_milestone, 50 XP |
| promotion zone is top 5 | 30-user league, rank 4 | zone = "promote" |
| demotion zone is bottom 5 | 30-user league, rank 28 | zone = "demote" |
| stay zone is middle 20 | 30-user league, rank 15 | zone = "stay" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Join and earn XP | 1. Join leagues, 2. Study 10 cards, 3. View leaderboard | 100 XP shown on leaderboard |
| Weekly promotion | 1. Earn enough XP for top 5, 2. Wait for reset, 3. Check tier | Tier promoted by one level |
| Leave and rejoin | 1. Leave leagues, 2. Rejoin | Bronze tier, 0 XP, new league group |

---

### FL-026: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-026 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure MyFlash's behavior (FSRS parameters, daily limits, appearance, notifications), so that the app works the way I prefer.

**Secondary:**
> As a power user migrating from Anki, I want to fine-tune FSRS parameters like desired retention, learning steps, and maximum interval, so that I can match my preferred study experience.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for all MyFlash behavior. Settings are organized into logical sections: General, Study, FSRS Algorithm, Notifications, Data, and About. Changes take effect immediately.

General settings control appearance (theme, font size), language, and sound/haptic feedback. Study settings control daily limits (new and review cards per day), auto-advance behavior, and auto-bury siblings. FSRS Algorithm settings expose the key parameters for power users: desired retention, learning steps, relearning steps, graduating interval, easy interval, maximum interval, and interval fuzzing. Notification settings control daily reminders (FL-015) timing and content. Data settings provide import, export, reset, and backup options.

Settings are stored locally in the SQLite database as a single serialized JSON record. Default values are hardcoded in the application; the settings record overrides defaults only for fields that have been explicitly changed.

The settings screen includes a "Reset to Defaults" button per section and a global "Reset All Settings" option. All resets require confirmation.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (settings are foundational)

**External Dependencies:**
- Notification permissions (for reminders)
- File system access (for data export/import)

**Assumed Capabilities:**
- Settings storage is available
- Notification system is accessible

#### 3.5 User Interface Requirements

##### Screen: Settings (Tab 5 - Settings)

**Layout:**
- Top bar with "Settings" title
- Scrollable list of setting sections, each collapsible:

**Section 1: General**
- Theme: Auto (system) | Dark | Light
- Font Size: Small | Medium (default) | Large
- Language: System default (auto-detected)
- Sound Effects: Toggle (default: on)
- Haptic Feedback: Toggle (default: on)

**Section 2: Study**
- New Cards Per Day: Stepper (0-9999, default: 20)
- Maximum Reviews Per Day: Stepper (0-9999, default: 200)
- New/Review Interleave Ratio: Stepper (1-20, default: 5) - "1 new card per X review cards"
- Auto-Advance After Rating: Toggle (default: on) - automatically show next card after rating
- Auto-Play Audio: Toggle (default: on) - auto-play audio on card front
- Show Timer: Toggle (default: off) - show elapsed time during sessions
- Auto-Bury Siblings: Toggle (default: on) - bury related cards after review
- Leech Threshold: Stepper (1-99, default: 8) - lapses before card is flagged as leech
- Leech Action: Suspend | Tag Only (default: Tag Only)

**Section 3: FSRS Algorithm**
- Desired Retention: Slider (70%-97%, default: 90%)
  - Help text: "Higher = more reviews but better recall. Lower = fewer reviews but more forgetting."
- Learning Steps: Text input (comma-separated minutes, default: "1, 10")
  - Help text: "Review intervals for new cards in minutes. Example: 1, 10 means review after 1 min, then 10 min."
- Relearning Steps: Text input (comma-separated minutes, default: "10")
- Graduating Interval: Stepper (1-365 days, default: 1)
- Easy Interval: Stepper (1-365 days, default: 4)
- Maximum Interval: Stepper (1-36500 days, default: 36500)
  - Help text: "Cards will never be scheduled further than this many days in the future."
- Enable Interval Fuzz: Toggle (default: on)
- "Reset FSRS to Defaults" button

**Section 4: Notifications**
- Daily Reminder: Toggle (default: off)
- Reminder Time: Time picker (default: 9:00 AM)
- Reminder Message: Text input (default: "Time to study! You have {{due}} cards waiting.")
- Streak Reminder: Toggle (default: on) - remind if streak is at risk

**Section 5: Data**
- Import: Button - opens FL-006 import screen
- Export: Button - opens FL-022 export screen
- Backup to Files: Button - exports full database to device files app
- Delete All Data: Button - confirmation dialog with destructive action
  - "This will permanently delete all cards, decks, review history, and settings. This cannot be undone."
  - Requires typing "DELETE" to confirm

**Section 6: About**
- App Version
- FSRS Algorithm Version: "FSRS-5"
- Database Size: [calculated size in MB]
- Total Cards: [count]
- Total Reviews: [count]
- Open Source Licenses
- Privacy Policy link
- "Made with care for learners everywhere"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | All settings at default values | All controls show default positions |
| Modified | User changed settings | Modified settings shown with a subtle indicator dot |
| Saving | Setting being persisted | No visible delay (writes are instant to local SQLite) |
| Confirmation | Destructive action requested | Confirmation dialog with explicit action description |

**Interactions:**
- Toggle switches: Immediately persist on tap
- Steppers: Immediately persist on value change
- Sliders: Persist on release (not during drag)
- Text inputs: Persist on blur (when field loses focus)
- "Reset to Defaults" per section: Confirmation dialog, then resets that section
- "Delete All Data": Multi-step confirmation (dialog + type "DELETE")

#### 3.6 Data Requirements

##### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "settings-global" | Singleton record |
| theme | enum | One of: auto, dark, light | auto | App theme |
| font_size | enum | One of: small, medium, large | medium | Font size preference |
| sound_enabled | boolean | - | true | Sound effects toggle |
| haptic_enabled | boolean | - | true | Haptic feedback toggle |
| new_cards_per_day | integer | Min: 0, Max: 9999 | 20 | Global default new cards per day |
| max_reviews_per_day | integer | Min: 0, Max: 9999 | 200 | Global default max reviews per day |
| interleave_ratio | integer | Min: 1, Max: 20 | 5 | New-to-review card ratio |
| auto_advance | boolean | - | true | Auto-advance after rating |
| auto_play_audio | boolean | - | true | Auto-play card audio |
| show_timer | boolean | - | false | Show session timer |
| auto_bury_siblings | boolean | - | true | Auto-bury related cards |
| leech_threshold | integer | Min: 1, Max: 99 | 8 | Lapse count for leech flagging |
| leech_action | enum | One of: suspend, tag_only | tag_only | Action when leech threshold reached |
| reminder_enabled | boolean | - | false | Daily reminder toggle |
| reminder_time | string | HH:MM format | "09:00" | Reminder time |
| reminder_message | string | Max 200 chars | "Time to study! You have {{due}} cards waiting." | Reminder text |
| streak_reminder | boolean | - | true | Streak-at-risk reminder |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Note:** FSRS algorithm parameters are stored in the FSRSParameters entity (FL-004), not in UserSettings. Settings references FSRSParameters for the algorithm section.

**Indexes:**
- None needed (singleton record accessed by primary key)

**Validation Rules:**
- new_cards_per_day: Must be >= 0 and <= 9999
- max_reviews_per_day: Must be >= 0 and <= 9999
- interleave_ratio: Must be >= 1 and <= 20
- leech_threshold: Must be >= 1 and <= 99
- reminder_time: Must be valid HH:MM format
- reminder_message: Must not exceed 200 characters
- Learning steps (in FSRSParameters): Must be comma-separated positive integers
- Desired retention (in FSRSParameters): Must be between 0.70 and 0.97

#### 3.7 Business Logic Rules

##### Settings Application

**Purpose:** Apply settings changes to app behavior.

**Logic:**

```
1. Settings are read at:
   - App launch (initialize all modules with current settings)
   - Study session start (read daily limits, FSRS params, bury behavior)
   - Notification scheduling (read reminder settings)
   - Theme rendering (read theme and font size)

2. Settings take effect immediately:
   - Theme change: Immediate UI update
   - Daily limit change: Applies to the next study session start
   - FSRS parameter change: Applies to the next card rating
   - Notification change: Reschedules or cancels notifications immediately

3. Per-deck overrides:
   - new_cards_per_day and max_reviews_per_day can also be set per deck
   - Per-deck settings override global settings for that deck
   - Global settings serve as defaults for new decks
```

##### Delete All Data

**Purpose:** Permanently erase all user data.

**Logic:**

```
1. Show confirmation dialog:
   "Delete everything? This will permanently delete:
   - All cards and decks (X cards, Y decks)
   - All review history (Z reviews)
   - All study statistics
   - All settings
   This cannot be undone."
2. User must type "DELETE" in a text field to confirm
3. IF confirmed:
   a. Drop all fl_ prefixed tables
   b. Recreate empty tables with default schema
   c. Create default deck
   d. Reset settings to defaults
   e. Reset streak data
   f. Clear media files directory
   g. Navigate to first-run experience (FL-027)
4. IF not confirmed: No action
```

##### Reminder Notification Scheduling

**Purpose:** Schedule daily study reminders.

**Logic:**

```
1. When reminder_enabled is toggled ON:
   a. Request notification permissions if not already granted
   b. Schedule a repeating local notification at reminder_time
   c. Notification content: reminder_message with {{due}} replaced
      by actual due card count (computed at notification fire time)
2. When reminder_time changes:
   a. Cancel existing scheduled notification
   b. Schedule new notification at updated time
3. When reminder_enabled is toggled OFF:
   a. Cancel all scheduled study reminders
4. Streak reminder (separate):
   a. IF streak_reminder enabled AND user has an active streak:
      Schedule notification for 2 hours before midnight local time
      Content: "Don't lose your X-day streak! Study now."
   b. Only fires if the user has NOT met their daily target today
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Settings record corrupted | Reset to defaults, toast "Settings were reset due to an error" | Automatic recovery |
| Learning steps format invalid | Inline validation: "Enter numbers separated by commas (e.g., 1, 10)" | User corrects format |
| Desired retention out of range | Slider prevents values outside 70-97% | Physical limit on slider |
| Notification permissions denied | "Reminders require notification permission. Open Settings?" | Link to device settings |
| Delete All Data fails | "Could not delete data. Please try again." | User retries |

**Validation Timing:**
- Toggle switches: No validation needed (binary)
- Numeric steppers: Validation built into stepper range
- Text inputs: Validated on blur
- Slider: Range constrained by min/max
- Learning steps: Validated on blur (must be comma-separated positive integers)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user changes the theme to Dark,
   **When** the toggle is tapped,
   **Then** the app's entire UI immediately switches to dark theme.

2. **Given** the user sets daily new card limit to 30,
   **When** they start a study session,
   **Then** up to 30 new cards are included in the queue (not the previous default of 20).

3. **Given** the user adjusts desired retention to 85%,
   **When** they review a card,
   **Then** the computed intervals are approximately 1.64x longer than at 90%.

4. **Given** the user enables daily reminders at 8:00 AM,
   **When** 8:00 AM arrives and cards are due,
   **Then** a notification appears with the configured message and the actual due card count.

**Edge Cases:**

5. **Given** the user sets new cards per day to 0,
   **When** they start a session,
   **Then** only review cards appear (no new cards introduced).

6. **Given** the user enters learning steps "1, 10, 60, 1440" (1min, 10min, 1hr, 1day),
   **When** a new card goes through all steps,
   **Then** it graduates after the 1440-minute (24-hour) step.

**Negative Tests:**

7. **Given** the user enters learning steps "abc",
   **When** the field loses focus,
   **Then** inline validation shows "Enter numbers separated by commas."

8. **Given** the user starts the Delete All Data flow,
   **When** they type "delete" (lowercase),
   **Then** the confirmation is rejected (must match "DELETE" exactly).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| default settings have correct values | Load settings with no overrides | theme=auto, new_cards=20, retention=0.9 |
| setting change persists | Set theme=dark, reload | theme=dark |
| per-deck override takes precedence | Global limit=20, deck limit=30 | Session uses 30 |
| learning steps parsing valid | "1, 10, 60" | [1, 10, 60] |
| learning steps parsing invalid | "1, abc, 10" | Validation error |
| desired retention clamped | 0.50 via direct write | Clamped to 0.70 |
| reminder message template | "{{due}} cards due" with 15 due | "15 cards due" |
| delete all data clears tables | Delete confirmed | 0 cards, 0 decks (except default), 0 reviews |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Theme change applies immediately | 1. Set theme=dark | UI switches to dark theme |
| Daily limit affects session | 1. Set new=10, 2. Start session with 20 new cards | Queue has 10 new cards |
| FSRS parameter change affects scheduling | 1. Set retention=0.85, 2. Rate a card Good | Interval is longer than at 0.9 retention |
| Delete all and verify | 1. Add 10 cards, 2. Delete all, 3. Check database | Empty database, default deck exists |

---

### FL-027: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FL-027 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user opening MyFlash for the first time, I want a brief walkthrough that shows me how to create cards and study, so that I can start using the app effectively without reading documentation.

**Secondary:**
> As a user migrating from Anki, I want the onboarding to offer an import option immediately, so that I can bring my existing decks and start studying right away.

#### 3.3 Detailed Description

Onboarding and First-Run provides a guided introduction when the user opens MyFlash for the first time. The onboarding sequence is 4 screens followed by an action choice that gets the user studying within 60 seconds of opening the app.

The onboarding screens are:
1. **Welcome:** "Welcome to MyFlash" with the app logo and tagline "Master anything with spaced repetition."
2. **How It Works:** Brief visual explanation of spaced repetition - cards you know appear less often, cards you struggle with appear more. Animated diagram showing card intervals growing over time.
3. **Privacy Promise:** "Your data stays on your device. No accounts, no tracking, no ads." With icons for each privacy commitment.
4. **Get Started:** Three action buttons:
   - "Create Your First Deck" - opens deck creation followed by card creation
   - "Import from Anki" - opens the .apkg import screen (FL-006)
   - "Browse Community Decks" - opens the Shared Deck Browser (FL-021)
   - Small "Skip" link at the bottom for users who want to explore on their own

After onboarding completes, the user arrives at the Deck Browser with either their imported deck, their new deck, or the empty state. A sample deck ("MyFlash Tutorial" with 10 cards teaching flashcard best practices) is pre-loaded for users who chose "Create Your First Deck" to give them something to study immediately.

The onboarding is shown only once. A `has_completed_onboarding` flag in settings prevents re-display. Users can replay the onboarding from Settings > About > "Replay Welcome Tour."

If the user deletes all data (FL-026), the onboarding replays on next app open.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FL-001: Flashcard Creation - "Create Your First Deck" flow uses card creation
- FL-003: Deck Organization - deck creation for the sample deck

**External Dependencies:**
- None (onboarding is entirely local)

**Assumed Capabilities:**
- App is opening for the first time (or after data deletion)

#### 3.5 User Interface Requirements

##### Screen: Onboarding Flow (4 screens, swiped or tapped through)

**Layout (all screens share):**
- Page indicator dots at the bottom (4 dots, current highlighted)
- "Next" button (right side) on screens 1-3
- "Back" button (left side) on screens 2-4
- "Skip" link at the bottom-right on all screens

**Screen 1: Welcome**
- Large MyFlash logo (centered, top third)
- App name "MyFlash" in large text
- Tagline "Master anything with spaced repetition" below
- Subtle animated background (floating card shapes)

**Screen 2: How It Works**
- Title: "Spaced Repetition Made Simple"
- Animated diagram showing 4 cards:
  - Card A: reviewed today, next in 1 day
  - Card B: reviewed today, next in 3 days
  - Card C: reviewed today, next in 10 days
  - Card D: reviewed today, next in 30 days
- Caption: "Cards you know are shown less often. Cards you struggle with come back sooner. The FSRS algorithm optimizes your review schedule automatically."
- Three bullet points:
  - "Rate cards Again, Hard, Good, or Easy"
  - "The algorithm schedules your next review"
  - "Study 20-30% more efficiently than traditional flashcards"

**Screen 3: Privacy Promise**
- Title: "Your Data, Your Device"
- Three large icons with labels:
  - Lock icon: "All data stored on your device"
  - Eye-off icon: "Zero tracking, zero analytics"
  - Shield icon: "No account required"
- Caption: "We believe your study habits are private. What you learn, when you study, and how well you perform never leaves your device."

**Screen 4: Get Started**
- Title: "Let's Get Started!"
- Three large action cards:
  1. "Create Your First Deck" (pencil icon, primary accent color)
     - Subtitle: "Start from scratch with a sample tutorial deck"
  2. "Import from Anki" (download icon, secondary color)
     - Subtitle: "Bring your existing Anki decks (.apkg files)"
  3. "Browse Community Decks" (globe icon, tertiary color)
     - Subtitle: "Download pre-made decks from other learners"
- "Skip and explore on my own" link at bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Screen 1 | First screen displayed | Welcome with logo and tagline |
| Screen 2 | User advanced | How-it-works with animation |
| Screen 3 | User advanced | Privacy commitment |
| Screen 4 | User advanced | Action selection |
| Transitioning | User swiping between screens | Smooth horizontal scroll with parallax |

**Interactions:**
- Swipe left: Advance to next screen
- Swipe right: Return to previous screen
- Tap "Next": Advance to next screen with slide animation
- Tap "Back": Return to previous screen
- Tap "Skip": Jump directly to the deck browser (mark onboarding complete)
- Tap action card (Screen 4):
  - "Create Your First Deck": Creates "MyFlash Tutorial" sample deck, opens deck browser
  - "Import from Anki": Opens import screen (FL-006)
  - "Browse Community Decks": Opens shared deck browser (FL-021)

**Transitions/Animations:**
- Screen transitions: Horizontal slide with 300ms ease, content on each screen parallax-scrolls at different rates
- Welcome logo: Subtle float animation (up/down, 3s cycle)
- How-it-works diagram: Cards animate in sequence showing increasing intervals
- Privacy icons: Fade in one at a time (200ms each, staggered)

#### 3.6 Data Requirements

**UserSettings extension:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| has_completed_onboarding | boolean | - | false | Whether onboarding has been shown |
| onboarding_action | enum | One of: create, import, browse, skip, null | null | Which action the user chose on Screen 4 |
| first_launch_at | datetime | Auto-set on first launch | Current timestamp | When the app was first opened |

**Sample Deck Data (embedded in app binary, not network-fetched):**

The "MyFlash Tutorial" deck contains 10 pre-built cards:

| Front | Back |
|-------|------|
| What is spaced repetition? | A learning technique that reviews information at increasing intervals to move it into long-term memory. |
| What do the four rating buttons mean? | Again: failed to recall. Hard: recalled with difficulty. Good: recalled normally. Easy: recalled effortlessly. |
| What is the FSRS algorithm? | Free Spaced Repetition Scheduler - an open-source algorithm that determines optimal review intervals. It requires 20-30% fewer reviews than older algorithms. |
| How does stability work? | Stability (S) measures how long until your recall probability drops to 90%. Higher stability = slower forgetting. |
| How does difficulty work? | Difficulty (D, scale 1-10) measures how hard a card is to memorize. Higher difficulty = slower stability growth. |
| What is a lapse? | When you rate a card "Again" during review. It means you forgot something you previously knew. The card enters relearning. |
| What is a leech? | A card with 8+ lapses. Leeches indicate content that may need to be rewritten or broken into smaller pieces. |
| What are cloze deletions? | Fill-in-the-blank cards created with {{c1::hidden text}} syntax. The hidden text becomes the answer. |
| What is image occlusion? | A card type where parts of an image are hidden. Used for anatomy diagrams, maps, and visual subjects. |
| How do I import Anki decks? | Go to Settings > Import, select your .apkg file. MyFlash supports all Anki deck formats and preserves review history. |

#### 3.7 Business Logic Rules

##### First Launch Detection

**Purpose:** Determine if onboarding should be shown.

**Logic:**

```
1. On app launch, check UserSettings.has_completed_onboarding
2. IF has_completed_onboarding == false:
   a. Show onboarding flow (Screen 1)
   b. Set first_launch_at = now (if not already set)
3. IF has_completed_onboarding == true:
   a. Skip onboarding, go directly to deck browser
4. After user completes onboarding (Screen 4 action or Skip):
   a. Set has_completed_onboarding = true
   b. Set onboarding_action to the chosen action
```

##### Sample Deck Creation

**Purpose:** Give new users immediate content to study.

**Logic:**

```
1. Triggered when user selects "Create Your First Deck" on Screen 4
2. Create deck: name="MyFlash Tutorial", description="Learn how to use MyFlash effectively"
3. Create notes and cards for the 10 tutorial cards:
   a. Use "Basic" note model
   b. All cards start as state="new", queue="new"
   c. No scheduling data (user will study them fresh)
4. Navigate to deck browser with the tutorial deck highlighted
5. Show tooltip: "Tap 'Study Now' to review your first cards!"
```

##### Onboarding Replay

**Purpose:** Allow users to re-watch the onboarding tour.

**Logic:**

```
1. Accessible from Settings > About > "Replay Welcome Tour"
2. Shows screens 1-3 only (informational screens)
3. Screen 4 (Get Started) is replaced with "Done" button
4. Does NOT re-create sample deck or reset any data
5. Does NOT reset has_completed_onboarding (already true)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Sample deck creation fails | Toast: "Could not create tutorial deck. You can create your own deck from the deck browser." | User creates deck manually |
| Onboarding state flag corrupted | Onboarding re-shows on next launch | User completes or skips again |
| Import from onboarding fails | Standard import error handling (FL-006) applies | User retries or creates deck manually |
| App crashes during onboarding | Onboarding restarts from Screen 1 on next launch | has_completed_onboarding is still false |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens MyFlash for the first time,
   **When** the app loads,
   **Then** the onboarding Screen 1 (Welcome) appears with the logo and tagline.

2. **Given** the user swipes through all 4 onboarding screens and taps "Create Your First Deck,"
   **When** the action completes,
   **Then** a "MyFlash Tutorial" deck with 10 cards exists, the deck browser is shown, and a tooltip suggests tapping "Study Now."

3. **Given** the user taps "Import from Anki" on Screen 4,
   **When** the import screen opens,
   **Then** the user can select and import an .apkg file, and after import completes, the deck browser shows the imported deck.

4. **Given** the user completes or skips onboarding,
   **When** they close and reopen the app,
   **Then** onboarding does not appear again (goes directly to deck browser).

**Edge Cases:**

5. **Given** the user taps "Skip" on Screen 1,
   **When** they reach the deck browser,
   **Then** no sample deck is created, the empty state message appears, and onboarding is marked complete.

6. **Given** the user deleted all data via Settings,
   **When** they reopen the app,
   **Then** onboarding replays from Screen 1.

**Negative Tests:**

7. **Given** the user has already completed onboarding,
   **When** the app launches,
   **Then** the deck browser appears immediately (no onboarding).

8. **Given** the user taps "Replay Welcome Tour" in Settings,
   **When** the tour replays,
   **Then** informational screens show but no sample deck is created and no data is reset.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| first launch shows onboarding | has_completed_onboarding=false | Onboarding flow starts |
| subsequent launch skips onboarding | has_completed_onboarding=true | Deck browser shown directly |
| sample deck has 10 cards | Create tutorial deck | Deck with 10 basic cards |
| skip marks onboarding complete | User taps Skip | has_completed_onboarding=true |
| data deletion resets onboarding | Delete all data | has_completed_onboarding=false |
| onboarding_action records choice | User taps "Import from Anki" | onboarding_action="import" |
| replay does not reset data | Replay from settings | No new deck, no data changes |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding to study | 1. Open app, 2. Swipe through, 3. Create first deck, 4. Study tutorial | 10 tutorial cards presented in study session |
| Onboarding to import | 1. Open app, 2. Swipe to Screen 4, 3. Import .apkg | Imported deck visible in deck browser |
| Delete and re-onboard | 1. Complete onboarding, 2. Delete all data, 3. Reopen app | Onboarding shows again from Screen 1 |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the Note-Card relationship, following the Anki paradigm. A **Note** stores raw content (field values), and a **NoteModel** defines how that content maps to one or more **Cards** (the actual study units). Each Card belongs to a **Deck**, which forms a hierarchical tree via parent-child relationships. The **FSRS scheduling engine** tracks each Card's memory state (stability, difficulty, retrievability) and records every review in a **ReviewLog**. **StudySessions** group reviews into timed blocks. Supporting entities include **OcclusionMask** (for image occlusion cards), **StreakData** and **DailyStudyRecord** (for streak tracking), **FSRSParameters** (algorithm configuration), **UserSettings** (preferences), **ImportRecord** and **ExportRecord** (data portability history), **SharedDeckDownload** (community deck tracking), **PracticeTest** (quiz results), **MatchGameResult** and **MatchGameBest** (game scores), **LeagueProfile** and **XPEvent** (competitive leagues), and **LeagueStanding** (cached leaderboard data).

All entities use the `fl_` table prefix in the MyLife hub SQLite database.

### 4.2 Complete Entity Definitions

#### Entity: Note

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique note identifier |
| model_id | string | Foreign key to NoteModel.id, required | None | Note type/model defining fields and templates |
| fields | text | JSON array of strings, required | "[]" | Field values in order defined by the model |
| tags | text | Space-separated tag strings | "" | Tags applied to this note (inherited by all cards) |
| checksum | integer | First 8 digits of SHA1 of first field | Auto-computed | Duplicate detection hash |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

#### Entity: NoteModel

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto-generated | Unique model identifier |
| name | string | Required, max 100 chars | None | Display name (e.g., "Basic", "Basic (Reversed)", "Cloze") |
| type | enum | One of: standard, cloze | standard | Model type; cloze models use special rendering |
| fields | text | JSON array of field definitions | See defaults | Ordered list of field names and configs |
| templates | text | JSON array of template definitions | See defaults | Card templates defining front/back rendering |
| css | text | Optional | "" | Shared CSS applied to all cards of this model |
| sort_field_index | integer | Min: 0 | 0 | Which field index to use for sorting |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

#### Entity: Card

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique card identifier |
| note_id | string | Foreign key to Note.id, required | None | Parent note this card belongs to |
| deck_id | string | Foreign key to Deck.id, required | None | Deck this card lives in |
| ordinal | integer | Min: 0 | 0 | Template ordinal (0 for basic, 0/1 for reversed, 0..N for cloze) |
| card_type | enum | One of: basic, reversed, cloze | basic | Determines how note fields map to front/back |
| state | enum | One of: new, learning, review, relearning | new | Current FSRS scheduling state |
| queue | enum | One of: new, learning, review, suspended, buried | new | Current queue assignment |
| queue_before_suspend | enum | Nullable, same values as queue | null | Stored queue value before suspension for restoration |
| due | datetime | Nullable | null | Next review due date (null for new cards not yet studied) |
| stability | float | Min: 0.0 | 0.0 | FSRS stability parameter (S) in days |
| difficulty | float | Min: 1.0, Max: 10.0 | 0.0 | FSRS difficulty parameter (D); 0 means uninitialized |
| interval_days | integer | Min: 0 | 0 | Current interval in days |
| reps | integer | Min: 0 | 0 | Total number of reviews |
| lapses | integer | Min: 0 | 0 | Number of times card went from correct to incorrect |
| last_review | datetime | Nullable | null | Timestamp of most recent review |
| source | enum | One of: manual, ai_ondevice, ai_cloud, import | manual | How this card was created |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

#### Entity: Deck

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique deck identifier |
| name | string | Required, max 255 chars, unique full path | None | Full deck path (e.g., "Languages::Spanish::Vocabulary") |
| description | text | Optional, max 1000 chars | "" | User-provided deck description |
| parent_id | string | Nullable, foreign key to Deck.id | null | Parent deck for nesting (null = top-level) |
| position | integer | Min: 0 | 0 | Sort order within parent level |
| is_default | boolean | Only one deck can be true | false | Whether this is the undeletable default deck |
| collapsed | boolean | - | false | Whether children are collapsed in the tree view |
| new_cards_per_day | integer | Min: 0, Max: 9999 | 20 | Max new cards introduced per day for this deck |
| max_reviews_per_day | integer | Min: 0, Max: 9999 | 200 | Max review cards shown per day for this deck |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

#### Entity: ReviewLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique review log identifier |
| card_id | string | Foreign key to Card.id, required | None | Card that was reviewed |
| rating | integer | Min: 1, Max: 4 | None | User's rating (1=Again, 2=Hard, 3=Good, 4=Easy) |
| state_before | enum | One of: new, learning, review, relearning | None | Card state before this review |
| state_after | enum | One of: new, learning, review, relearning | None | Card state after this review |
| stability_before | float | Min: 0.0 | None | Stability before review |
| stability_after | float | Min: 0.0 | None | Stability after review |
| difficulty_before | float | Min: 1.0, Max: 10.0 | None | Difficulty before review |
| difficulty_after | float | Min: 1.0, Max: 10.0 | None | Difficulty after review |
| interval_days | integer | Min: 0 | None | Scheduled interval in days after this review |
| elapsed_days | integer | Min: 0 | None | Days since the previous review (0 for first review) |
| scheduled_days | integer | Min: 0 | None | Days that were scheduled at the previous review |
| review_duration_ms | integer | Min: 0 | None | Time in milliseconds from card shown to rating button pressed |
| reviewed_at | datetime | Auto-set | Current timestamp | When this review occurred |

#### Entity: StudySession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique session identifier |
| deck_id | string | Foreign key to Deck.id, required | None | Deck being studied |
| session_type | enum | One of: standard, study_ahead, review_forgotten, custom, cram | standard | Type of study session |
| session_config | text | JSON, nullable | null | Serialized filter/configuration for non-standard sessions |
| started_at | datetime | Auto-set | Current timestamp | When the session started |
| ended_at | datetime | Nullable | null | When the session ended (null if in progress) |
| cards_reviewed | integer | Min: 0 | 0 | Total cards reviewed in this session |
| cards_new | integer | Min: 0 | 0 | New cards studied in this session |
| cards_learning | integer | Min: 0 | 0 | Learning/relearning cards studied |
| cards_review | integer | Min: 0 | 0 | Review cards studied |
| again_count | integer | Min: 0 | 0 | Number of Again ratings |
| hard_count | integer | Min: 0 | 0 | Number of Hard ratings |
| good_count | integer | Min: 0 | 0 | Number of Good ratings |
| easy_count | integer | Min: 0 | 0 | Number of Easy ratings |
| total_time_ms | integer | Min: 0 | 0 | Total time spent in session in milliseconds |
| is_completed | boolean | - | false | Whether the session was completed (all due cards reviewed) |

#### Entity: FSRSParameters

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "fsrs-global" | Singleton or per-deck parameter set |
| desired_retention | float | Min: 0.70, Max: 0.97 | 0.90 | Target recall probability (90% default) |
| weights | text | JSON array of 19 floats | See FSRS-5 defaults | FSRS-5 model weights w0 through w18 |
| learning_steps | text | JSON array of integers (minutes) | "[1, 10]" | Minutes between learning step reviews |
| relearning_steps | text | JSON array of integers (minutes) | "[10]" | Minutes between relearning step reviews |
| graduating_interval | integer | Min: 1 | 1 | Days for first review after graduating from learning |
| easy_interval | integer | Min: 1 | 4 | Days for first review after rating Easy on a new/learning card |
| maximum_interval | integer | Min: 1, Max: 36500 | 36500 | Maximum interval in days (100 years cap) |
| enable_fuzz | boolean | - | true | Whether to add jitter to intervals to prevent clustering |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Default FSRS-5 Weights:**

```json
[0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]
```

#### Entity: OcclusionMask

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique mask identifier |
| note_id | string | Foreign key to Note.id, required | None | Parent note |
| ordinal | integer | Min: 0 | Auto-assigned | Order of this mask (determines card ordinal) |
| shape_type | enum | One of: rectangle, polygon | rectangle | Type of mask shape |
| shape_data | text | JSON object | None | Shape coordinates (proportional 0.0-1.0 relative to image dimensions) |
| label | string | Optional, max 200 chars | "" | Text label for this mask region |
| color | string | Hex color code | "#FF4444" | Mask fill color |

#### Entity: StreakData

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "streak-global" | Singleton record |
| current_streak | integer | Min: 0 | 0 | Current consecutive days studied |
| longest_streak | integer | Min: 0 | 0 | All-time longest streak |
| total_days_studied | integer | Min: 0 | 0 | Total unique days with reviews |
| last_study_date | string | ISO date (YYYY-MM-DD), nullable | null | Last calendar day with reviews meeting threshold |
| freeze_days_available | integer | Min: 0, Max: 2 | 0 | Streak freeze days banked |
| freeze_days_used | integer | Min: 0 | 0 | Total freeze days ever used |
| daily_target | integer | Min: 1, Max: 9999 | 1 | Minimum reviews to count as a study day |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Entity: DailyStudyRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| date | string | Primary key, ISO date (YYYY-MM-DD) | None | Calendar date |
| review_count | integer | Min: 0 | 0 | Number of reviews completed |
| met_target | boolean | - | false | Whether daily_target was met |
| freeze_used | boolean | - | false | Whether a streak freeze was used for this day |
| time_studied_ms | integer | Min: 0 | 0 | Total study time for this day |

#### Entity: ImportRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique import record identifier |
| source_file | string | Required, max 500 chars | None | Original filename of the imported file |
| source_format | enum | One of: apkg, colpkg | apkg | Format of the imported file |
| deck_id | string | Foreign key to Deck.id | None | Target deck for the import |
| cards_imported | integer | Min: 0 | 0 | Number of cards successfully imported |
| cards_skipped | integer | Min: 0 | 0 | Number of duplicate cards skipped |
| cards_failed | integer | Min: 0 | 0 | Number of cards that failed to import |
| media_imported | integer | Min: 0 | 0 | Number of media files copied |
| media_skipped | integer | Min: 0 | 0 | Number of media files skipped (already exist) |
| imported_at | datetime | Auto-set | Current timestamp | When the import was performed |
| duration_ms | integer | Min: 0 | 0 | How long the import took in milliseconds |

#### Entity: ExportRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique export record |
| deck_id | string | Foreign key to Deck.id, nullable | None | Exported deck (null for full collection) |
| file_name | string | Required | None | Output file name |
| file_size_bytes | integer | Min: 0 | 0 | Size of the exported file |
| cards_exported | integer | Min: 0 | 0 | Number of cards included |
| media_exported | integer | Min: 0 | 0 | Number of media files included |
| include_scheduling | boolean | - | true | Whether scheduling data was included |
| include_media | boolean | - | true | Whether media was included |
| exported_at | datetime | Auto-set | Current timestamp | When the export occurred |
| duration_ms | integer | Min: 0 | 0 | How long the export took |

#### Entity: SharedDeckDownload

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Local download record |
| catalog_entry_id | string | Required | None | Server catalog entry ID |
| deck_id | string | Foreign key to Deck.id | None | Local deck created from download |
| downloaded_at | datetime | Auto-set | Current timestamp | When downloaded |
| catalog_version | datetime | Required | None | updated_at from catalog at download time |

#### Entity: PracticeTest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique test identifier |
| deck_id | string | Foreign key to Deck.id | None | Source deck |
| question_count | integer | Min: 4, Max: 100 | 20 | Number of questions |
| correct_count | integer | Min: 0 | 0 | Questions answered correctly |
| skipped_count | integer | Min: 0 | 0 | Questions skipped |
| score_percent | float | Min: 0.0, Max: 100.0 | 0.0 | Score as percentage |
| time_taken_ms | integer | Min: 0 | 0 | Total test time |
| question_types | text | JSON array of strings | None | Types used in this test |
| questions | text | JSON array of question objects | None | Full test content with answers |
| taken_at | datetime | Auto-set | Current timestamp | When the test was taken |

#### Entity: MatchGameResult

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique game result identifier |
| deck_id | string | Foreign key to Deck.id | None | Deck played |
| board_size | integer | One of: 6, 12, 20, 30 | 12 | Number of tiles |
| time_ms | integer | Min: 0 | 0 | Completion time in milliseconds |
| mistakes | integer | Min: 0 | 0 | Number of incorrect pairs attempted |
| stars | integer | Min: 1, Max: 3 | 1 | Star rating earned |
| card_ids | text | JSON array of card IDs | None | Which cards were used |
| played_at | datetime | Auto-set | Current timestamp | When the game was played |

#### Entity: MatchGameBest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| deck_id | string | Part of composite PK | None | Deck |
| board_size | integer | Part of composite PK | None | Board size |
| best_time_ms | integer | Min: 0 | None | Best completion time |
| best_stars | integer | Min: 1, Max: 3 | 1 | Best star rating |
| achieved_at | datetime | Required | None | When the record was set |

#### Entity: LeagueProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "league-profile" | Singleton |
| is_enrolled | boolean | - | false | Whether user has joined leagues |
| display_name | string | Max 20 chars, filtered | None | User's league display name |
| anonymous_id | string | UUID v4, auto-generated | Auto | Device-unique ID for server (not linked to user identity) |
| current_tier | enum | One of: bronze, silver, gold, platinum, diamond, obsidian, amethyst | bronze | Current league tier |
| highest_tier | enum | Same as current_tier | bronze | Best tier ever achieved |
| weeks_at_tier | integer | Min: 0 | 0 | Consecutive weeks at current tier |
| total_xp | integer | Min: 0 | 0 | Cumulative XP all-time |
| week_xp | integer | Min: 0 | 0 | XP earned this week (resets weekly) |
| last_sync_at | datetime | Nullable | null | Last leaderboard sync |

#### Entity: XPEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4 | Auto-generated | Unique event ID |
| event_type | enum | One of: review, session_complete, perfect_session, streak_milestone, match_correct, test_correct | None | What earned the XP |
| xp_amount | integer | Min: 1 | None | XP earned |
| synced | boolean | - | false | Whether this event has been synced to server |
| earned_at | datetime | Auto-set | Current timestamp | When XP was earned |

#### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "settings-global" | Singleton record |
| theme | enum | One of: auto, dark, light | auto | App theme |
| font_size | enum | One of: small, medium, large | medium | Font size preference |
| sound_enabled | boolean | - | true | Sound effects toggle |
| haptic_enabled | boolean | - | true | Haptic feedback toggle |
| new_cards_per_day | integer | Min: 0, Max: 9999 | 20 | Global default new cards per day |
| max_reviews_per_day | integer | Min: 0, Max: 9999 | 200 | Global default max reviews per day |
| interleave_ratio | integer | Min: 1, Max: 20 | 5 | New-to-review card ratio |
| auto_advance | boolean | - | true | Auto-advance after rating |
| auto_play_audio | boolean | - | true | Auto-play card audio |
| show_timer | boolean | - | false | Show session timer |
| auto_bury_siblings | boolean | - | true | Auto-bury related cards |
| leech_threshold | integer | Min: 1, Max: 99 | 8 | Lapse count for leech flagging |
| leech_action | enum | One of: suspend, tag_only | tag_only | Action when leech threshold reached |
| reminder_enabled | boolean | - | false | Daily reminder toggle |
| reminder_time | string | HH:MM format | "09:00" | Reminder time |
| reminder_message | string | Max 200 chars | "Time to study! You have {{due}} cards waiting." | Reminder text |
| streak_reminder | boolean | - | true | Streak-at-risk reminder |
| has_completed_onboarding | boolean | - | false | Whether onboarding has been shown |
| onboarding_action | enum | One of: create, import, browse, skip, null | null | Which action the user chose on Screen 4 |
| first_launch_at | datetime | Nullable | null | When the app was first opened |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| NoteModel -> Note | one-to-many | A model defines the field/template structure for many notes |
| Note -> Card | one-to-many | A note generates 1+ cards (1 for basic, 2 for reversed, N for cloze) |
| Deck -> Card | one-to-many | A deck contains many cards |
| Deck -> Deck | self-referential one-to-many | Parent decks contain child decks via parent_id |
| Card -> ReviewLog | one-to-many | A card has many review log entries |
| Deck -> StudySession | one-to-many | A deck has many study sessions |
| Note -> OcclusionMask | one-to-many | An image occlusion note has many masks |
| Deck -> ImportRecord | one-to-many | A deck can have multiple import records |
| Deck -> ExportRecord | one-to-many | A deck can have multiple export records |
| Deck -> SharedDeckDownload | one-to-many | A deck may be linked to shared deck downloads |
| Deck -> PracticeTest | one-to-many | A deck has many practice test results |
| Deck -> MatchGameResult | one-to-many | A deck has many match game results |
| Deck + board_size -> MatchGameBest | one-to-one | One best record per deck per board size |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Card | idx_card_scheduling | (deck_id, queue, due) | Primary scheduling query for building review queues |
| Card | idx_card_note | (note_id) | Find all cards belonging to a note |
| Note | idx_note_checksum | (checksum) | Duplicate detection during card creation and import |
| Note | idx_note_model | (model_id) | Find all notes of a specific model type |
| ReviewLog | idx_revlog_card_time | (card_id, reviewed_at) | Review history for a card in chronological order |
| ReviewLog | idx_revlog_time | (reviewed_at) | Daily statistics and aggregation queries |
| StudySession | idx_session_deck_time | (deck_id, started_at) | Session history for a deck |
| StudySession | idx_session_time | (started_at) | Global session history |
| Deck | idx_deck_parent_pos | (parent_id, position) | Sorted tree listing |
| Deck | idx_deck_name | (name) | Unique constraint, deck lookup by path |
| Deck | idx_deck_default | (is_default) | Quick lookup of default deck |
| DailyStudyRecord | idx_daily_target | (met_target, date) | Streak calculation queries |
| ImportRecord | idx_import_time | (imported_at) | Import history listing |
| ExportRecord | idx_export_time | (exported_at) | Export history listing |
| SharedDeckDownload | idx_shared_catalog | (catalog_entry_id) | Check if a shared deck was already downloaded |
| PracticeTest | idx_test_deck_time | (deck_id, taken_at) | Test history for a deck |
| MatchGameResult | idx_match_deck_time | (deck_id, played_at) | Game history |
| MatchGameBest | pk_match_best | (deck_id, board_size) | Primary key, best time lookup |
| XPEvent | idx_xp_time | (earned_at) | Daily XP aggregation |
| XPEvent | idx_xp_synced | (synced) | Pending sync queue for leaderboard |

### 4.5 Table Prefix

**MyLife hub table prefix:** `fl_`

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. Examples:
- `fl_notes` - Note records
- `fl_note_models` - Note model definitions
- `fl_cards` - Card records
- `fl_decks` - Deck hierarchy
- `fl_review_logs` - Review history
- `fl_study_sessions` - Study session records
- `fl_fsrs_parameters` - FSRS algorithm configuration
- `fl_occlusion_masks` - Image occlusion mask definitions
- `fl_streak_data` - Streak tracking singleton
- `fl_daily_study_records` - Daily study activity
- `fl_import_records` - Import history
- `fl_export_records` - Export history
- `fl_shared_deck_downloads` - Community deck download tracking
- `fl_practice_tests` - Practice test results
- `fl_match_game_results` - Match game results
- `fl_match_game_bests` - Match game best scores
- `fl_league_profile` - League enrollment singleton
- `fl_xp_events` - XP earning log
- `fl_user_settings` - User preferences singleton

### 4.6 Migration Strategy

- **Table creation on module enable:** All `fl_` tables are created when the MyFlash module is enabled in the MyLife hub. Schema version is tracked in the hub's `hub_module_migrations` table.
- **Standalone import:** Data from a standalone MyFlash app (if one exists) can be imported via the data migration pipeline in `packages/migration/`.
- **Anki import:** The .apkg import pipeline (FL-006) handles importing external data into the existing schema.
- **Non-destructive migrations:** Column additions and new table creation are applied automatically on app update. Column removals and type changes are deferred to major versions only.
- **Rollback safety:** Each migration is wrapped in a transaction. Failed migrations roll back completely and the module reports the failure without corrupting existing data.
- **Schema versioning:** Migrations are numbered sequentially (001_create_notes, 002_create_cards, etc.) and tracked in a migration log to prevent re-running.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Decks | Card stack icon | Deck Browser | Hierarchical deck list with due card counts, study buttons |
| Add | Plus circle icon | Card Creation | Create new cards with type selector and deck picker |
| Study | Play circle icon | Study Session | Active study session with card display and rating buttons |
| Stats | Bar chart icon | Statistics | Study analytics, retention charts, streak, review forecast |
| Settings | Gear icon | Settings | Preferences, FSRS parameters, import/export, data management |

### 5.2 Navigation Flow

```
[Tab 1: Decks]
  ├── Deck Detail
  │     ├── Study Session (standard)
  │     │     └── Session Summary
  │     ├── Custom Study Options (modal)
  │     │     └── Study Session (custom/cram/ahead/forgotten)
  │     │           └── Session Summary
  │     ├── Card Editor (edit existing card)
  │     ├── Match Game
  │     │     └── Match Game Results
  │     ├── Practice Test Setup
  │     │     ├── Practice Test Taking
  │     │     └── Practice Test Results
  │     └── Export Options (modal)
  ├── Create Deck (modal)
  ├── Card Browser (search/filter all cards)
  │     ├── Card Editor
  │     └── Bulk Actions
  └── Shared Deck Browser
        └── Shared Deck Detail
              └── Download + Import

[Tab 2: Add]
  ├── Card Creation (basic/reversed)
  │     └── Deck Picker (modal)
  ├── Cloze Card Creation
  ├── Image Occlusion Editor
  │     └── Image Picker
  └── AI Card Generator
        └── Generated Cards Review
              └── Save to Deck

[Tab 3: Study]
  ├── Quick Study (most due deck auto-selected)
  │     └── Session Summary
  └── Study Session (if active session exists, resumes)

[Tab 4: Stats]
  ├── Today's Summary
  ├── Calendar Heatmap
  ├── Retention Rate Chart
  ├── Review Forecast
  ├── Card State Distribution
  ├── Review Time Analysis
  ├── Streak Detail (modal)
  └── Leagues
        ├── Leaderboard
        └── Join Leagues (modal)

[Tab 5: Settings]
  ├── General (theme, font, sounds)
  ├── Study (daily limits, auto-bury, leech)
  ├── FSRS Algorithm (retention, steps, intervals)
  ├── Notifications (reminders)
  ├── Data
  │     ├── Import (.apkg)
  │     ├── Export (.apkg)
  │     ├── Backup
  │     └── Delete All Data (confirmation flow)
  └── About
        ├── Open Source Licenses
        ├── Privacy Policy
        └── Replay Welcome Tour
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Deck Browser | `/decks` | View all decks in tree structure with due counts | Tab 1 (home), back from deck detail |
| Deck Detail | `/decks/:id` | View cards in a deck, start study, access actions | Tap deck in browser |
| Card Creation | `/cards/new` | Create new flashcards | Tab 2, "+" in deck detail, AI generator |
| Card Editor | `/cards/:id/edit` | Edit existing card content and metadata | Tap card in browser or deck detail |
| Study Session | `/study/:deckId` | Active flashcard review with FSRS rating | Tab 3, "Study Now" in deck detail, custom study |
| Session Summary | `/study/:deckId/summary` | Post-session statistics | Session completion |
| Statistics | `/stats` | Study analytics and charts | Tab 4 |
| Settings | `/settings` | Preferences and configuration | Tab 5 |
| Card Browser | `/browser` | Search and filter all cards across decks | Decks tab action, menu |
| Shared Deck Browser | `/shared-decks` | Browse and download community decks | Decks tab action, onboarding |
| Shared Deck Detail | `/shared-decks/:id` | Preview and download a shared deck | Tap deck in shared browser |
| AI Card Generator | `/ai-generate` | Generate cards from pasted text | Add tab action, menu |
| Generated Cards Review | `/ai-generate/review` | Review and save AI-generated cards | After AI generation completes |
| Image Occlusion Editor | `/occlusion/new` | Create image occlusion cards | Add tab, card type selector |
| Custom Study Options | `/study/:deckId/options` | Configure custom study session | Deck detail "Custom Study" button |
| Match Game | `/match/:deckId` | Timed matching game | Deck detail action menu |
| Match Game Results | `/match/:deckId/results` | Game score and star rating | Match game completion |
| Practice Test Setup | `/test/:deckId/setup` | Configure practice test parameters | Deck detail action menu |
| Practice Test Taking | `/test/:deckId/take` | Active test-taking interface | After test generation |
| Practice Test Results | `/test/:deckId/results` | Test score and answer review | Test completion |
| Leagues | `/leagues` | Leaderboard and tier standing | Stats tab, leagues section |
| Import | `/settings/import` | Import .apkg files | Settings > Data, onboarding |
| Export Options | `/settings/export` | Export deck as .apkg | Settings > Data, deck action menu |
| Streak Detail | `/stats/streak` | Detailed streak calendar and stats | Tap streak badge |
| Onboarding | `/onboarding` | First-run walkthrough | First app launch, data deletion, replay from settings |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://flash/decks` | Deck Browser | None |
| `mylife://flash/decks/:id` | Deck Detail | id: UUID of the deck |
| `mylife://flash/study/:deckId` | Study Session | deckId: UUID of the deck to study |
| `mylife://flash/cards/new` | Card Creation | Optional: deckId query param for pre-selected deck |
| `mylife://flash/cards/:id/edit` | Card Editor | id: UUID of the card |
| `mylife://flash/browser` | Card Browser | Optional: query param for pre-filled search |
| `mylife://flash/stats` | Statistics | None |
| `mylife://flash/shared-decks` | Shared Deck Browser | Optional: category query param |
| `mylife://flash/import` | Import Screen | Optional: file URI for direct import |
| `mylife://flash/match/:deckId` | Match Game | deckId: UUID of the deck |
| `mylife://flash/leagues` | Leagues Screen | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Study streak as habit | Flash | Habits | Flash sends daily study completion event (date, review count, met target) | On daily target met |
| Vocabulary from reading | Books | Flash | Books sends highlighted word/phrase with context sentence for card creation | User taps "Create Flashcard" on a highlighted word in MyBooks |
| Note-to-card generation | Notes | Flash | Notes sends selected text block to Flash AI card generator (FL-020) | User taps "Generate Flashcards" on selected text in MyNotes |
| Cognitive performance tracking | Flash | Health | Flash sends weekly retention rate and average review accuracy | On weekly stats computation |
| Medical study aids | Flash | Meds | Meds module provides pre-built pharmacology and medical terminology card templates | On MyFlash module enable if MyMeds is also enabled |

**Integration details:**

- **Flash to Habits:** When `met_target` becomes true for today's `DailyStudyRecord`, Flash emits a cross-module event `flash:daily_target_met` with payload `{ date, review_count, time_studied_ms }`. MyHabits listens for this event and auto-checks the "Study" habit if configured.

- **Books to Flash:** MyBooks exposes a "Create Flashcard" action in its text selection menu. Tapping it launches the Flash card creation screen pre-filled with the selected word on the front and the dictionary definition (if available) or blank on the back. The source book title and page number are added as a tag (e.g., `book:the-great-gatsby:p42`).

- **Notes to Flash:** MyNotes exposes a "Generate Flashcards" action on selected text blocks. Tapping it passes the selected text to Flash's AI Card Generator (FL-020) with the on-device mode pre-selected. The source note title is added as a tag.

- **Flash to Health:** Flash computes a weekly cognitive performance metric from `ReviewLog` data: average retention rate and average accuracy over the last 7 days. This is emitted as `flash:weekly_cognitive_summary` for MyHealth to optionally track as a health metric.

- **Meds to Flash:** When both modules are enabled, MyMeds offers to install curated pharmacology card decks into MyFlash. These are embedded .apkg packages imported via the standard FL-006 pipeline. The decks are optional and require explicit user consent.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Cards, notes, decks | Local SQLite (`fl_` tables) | At rest (OS-level encryption) | No | Never leaves device |
| Review history | Local SQLite (`fl_review_logs`) | At rest (OS-level encryption) | No | Study patterns are highly sensitive |
| FSRS parameters | Local SQLite (`fl_fsrs_parameters`) | At rest (OS-level encryption) | No | Algorithm runs entirely on-device |
| Media files (images, audio) | Local file system | At rest (OS-level encryption) | No | Referenced by cards, stored locally |
| User settings | Local SQLite (`fl_user_settings`) | At rest (OS-level encryption) | No | Preferences stay local |
| Streak data | Local SQLite (`fl_streak_data`) | At rest (OS-level encryption) | No | Study habits are private |
| League profile | Local SQLite (`fl_league_profile`) | At rest (OS-level encryption) | Partial | Only display name and weekly XP total are synced (opt-in) |
| XP events | Local SQLite (`fl_xp_events`) | At rest (OS-level encryption) | Partial | Only aggregate XP is synced, not per-review detail |
| Shared deck catalog cache | Local SQLite (temporary) | No | Fetched | Public catalog data, TTL 1 hour |
| AI generation input | In-memory only | N/A | Optional | On-device: never transmitted. Cloud: transmitted with explicit consent, not persisted |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Shared deck catalog browse | Fetch available community decks | Search query, category filter, page number | Deck metadata (names, descriptions, ratings) | Implicit (user opens Shared Deck Browser) |
| Shared deck download | Download a community deck | Catalog entry ID | .apkg file | Implicit (user taps Download) |
| Shared deck submission | Share a deck with the community | Stripped .apkg file, author alias, category, description | Confirmation status | Explicit (user initiates sharing) |
| Leaderboard sync | Update league standings | Anonymous ID, display name, weekly XP total | League standings array | Explicit (user joined leagues) |
| Cloud AI card generation | Generate cards from user text | Input text, card type preference | Generated card pairs | Explicit (consent dialog before each transmission) |
| Community deck voting | Rate shared decks | Anonymous vote (up/down), catalog entry ID | Updated vote counts | Implicit (user taps vote button) |

### 7.3 Data That Never Leaves the Device

- What the user studies (card content, deck names, note content)
- When the user studies (review timestamps, session times)
- How well the user performs (retention rates, accuracy, difficulty ratings)
- How long the user studies (session durations, time per card)
- The user's FSRS scheduling state (stability, difficulty, retrievability per card)
- The user's streak history and daily study patterns
- The user's settings and preferences
- The user's review logs and learning history
- Practice test results and scores
- Match game results and personal bests
- Tags and organizational structure
- Media files (images, audio) attached to cards
- Any data from imported Anki decks

### 7.4 User Data Ownership

- **Export:** Users can export all their data as .apkg files (FL-022) compatible with Anki and other SRS tools. Full collection export captures every card, note, review, and media file.
- **Backup:** Users can back up the raw SQLite database to the device's file system via Settings > Data > Backup.
- **Delete:** Users can permanently delete all module data from Settings > Data > Delete All Data. This requires typing "DELETE" to confirm. All `fl_` tables are dropped and recreated empty.
- **Portability:** The .apkg export format is the industry standard for flashcard data. Users can take their data to Anki, AnkiDroid, or any Anki-compatible tool at any time.
- **No vendor lock-in:** MyFlash uses standard, documented data formats. Zero proprietary data formats are used.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| App lock | Inherits MyLife hub app lock (biometric/PIN) | Configurable in MyLife hub settings |
| Cloud AI consent | Explicit consent dialog before any text is sent to cloud AI | Dialog shows exactly what data is transmitted and what is not |
| League participation | Explicit opt-in with privacy disclosure | User must acknowledge what is shared before joining |
| Shared deck moderation | Content scanning and optional human review for submissions | Prevents malicious or inappropriate content in community decks |
| Profanity filter | League display names are filtered | Prevents offensive names on leaderboards |
| Shared deck stripping | Exported shared decks have all review history and personal tags removed | Prevents accidental sharing of study patterns |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| FSRS | Free Spaced Repetition Scheduler - an open-source, state-of-the-art spaced repetition algorithm based on the DSR (Difficulty, Stability, Retrievability) memory model. Requires 20-30% fewer reviews than SM-2 for equivalent retention. |
| SM-2 | SuperMemo algorithm version 2 - the legacy spaced repetition algorithm used by Anki for decades. Uses ease factor and interval to schedule reviews. Superseded by FSRS. |
| Stability (S) | An FSRS memory parameter measured in days. Represents the time until retrievability drops to 90%. Higher stability means slower forgetting. Updated after every review. |
| Difficulty (D) | An FSRS memory parameter on a scale from 1.0 (easiest) to 10.0 (hardest). Represents how hard a card is to memorize. Higher difficulty means slower stability growth. Includes mean reversion to prevent "difficulty hell." |
| Retrievability (R) | The probability (0.0 to 1.0) that a user can successfully recall a card at a given moment. Decays over time following a power-law forgetting curve: R = (1 + 19t / 81S)^(-0.5). |
| Interval | The number of days until a card is next scheduled for review. Computed from stability and desired retention: I = (81S/19) * (r^(-2) - 1). |
| Desired Retention | The target probability of successful recall when a card is due. Default 90%. Higher values mean more frequent reviews but better recall. Configurable between 70% and 97%. |
| Forgetting Curve | The mathematical model of how memory decays over time. FSRS uses a power-law curve rather than an exponential curve, which better matches empirical data. |
| Note | The data container for flashcard content. A note stores field values (e.g., front text, back text) and generates one or more cards based on its note model. |
| Card | The study unit presented during review. A card is generated from a note and a template. Each card has its own independent scheduling state. |
| Note Model | A template definition specifying which fields a note has and how those fields map to card faces. Examples: Basic (1 template), Basic Reversed (2 templates), Cloze. |
| Deck | A container for organizing cards into named groups. Decks can be nested using the "::" separator (e.g., "Languages::Spanish::Vocabulary"). |
| New Card | A card that has never been studied. Sits in the new queue until introduced during a study session, subject to the daily new card limit. |
| Learning Card | A card in the initial learning phase, cycling through short-interval learning steps (e.g., 1 min, 10 min). Graduates to Review after completing all steps. |
| Review Card | A card on a spaced repetition schedule with intervals measured in days. Has established stability and difficulty values. |
| Relearning Card | A previously Review card that the user rated "Again" (a lapse). Cycles through relearning steps before returning to Review with reduced stability. |
| Lapse | An event where the user fails to recall a Review card (rates "Again"). Increments the card's lapse counter and triggers relearning. |
| Leech | A card with an excessive number of lapses (default threshold: 8). Indicates content that may need to be rewritten, simplified, or broken into smaller cards. |
| Graduating | The transition from Learning state to Review state. Occurs when a card completes all learning steps. The graduating interval (default: 1 day) determines the first review date. |
| Learning Steps | Short-interval review schedule for new cards. Default: [1, 10] (minutes). Cards are reviewed after 1 minute, then 10 minutes, then graduate. |
| Relearning Steps | Short-interval review schedule for lapsed cards. Default: [10] (minutes). Cards review after 10 minutes, then return to Review. |
| Cloze Deletion | A card type where parts of the text are hidden, creating fill-in-the-blank questions. Syntax: {{c1::hidden text::optional hint}}. Multiple cloze numbers generate multiple cards. |
| Image Occlusion | A card type where regions of an image are masked with colored rectangles or polygons. Each mask generates a separate card. Used for anatomy, maps, diagrams. |
| .apkg | Anki Package - the standard file format for sharing flashcard decks. A renamed ZIP archive containing an SQLite database (collection.anki2) and media files. |
| Ease Factor | Anki's legacy SM-2 scheduling parameter (1300-3500, representing 130%-350%). Determines how quickly intervals grow. Replaced by FSRS stability and difficulty. |
| Interval Fuzz | Small random jitter added to review intervals to prevent all cards reviewed on the same day from becoming due on the same future day. Configurable, disabled for intervals < 3 days. |
| Suspend | Permanently removing a card from all review queues without deleting it. Suspended cards retain their data and can be unsuspended at any time. |
| Bury | Temporarily removing a card from the review queue until the next calendar day. Buried cards automatically return to their queue at midnight local time. |
| Sibling Cards | Multiple cards generated from the same note (e.g., the forward and reverse cards of a reversed note). Can be auto-buried to prevent seeing both in the same session. |
| XP (Experience Points) | Points earned from study activities in the competitive leagues system. Used for leaderboard ranking. 10 XP per card review, with daily cap of 500 XP. |
| League Tier | Competitive rank in the leagues system. Seven tiers from Bronze (lowest) to Amethyst (highest). Promotion and demotion occur at weekly reset based on XP ranking. |
| Streak | The count of consecutive calendar days the user has met their daily study target. Resets to 0 on a missed day (unless a streak freeze is available). |
| Streak Freeze | A protective mechanism that preserves a streak for one missed day. Maximum 2 freeze days can be banked. Earned by completing 7-day streak milestones. |
| Distractor | A plausible but incorrect answer option in a multiple-choice practice test question. Generated from other cards in the same deck or by AI analysis. |
| Cram Mode | A study session mode that presents cards repeatedly without affecting FSRS scheduling. Used for last-minute exam preparation. No ReviewLog entries are created. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-myflash agent) | Initial specification - Sections 1-2, FL-001 through FL-017 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Completed specification - FL-018 through FL-027, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should on-device AI card generation use CoreML/ONNX or a bundled GGUF model? | FL-020 requires an on-device ML model. CoreML is iOS-only, ONNX is cross-platform but may be slower. GGUF models (llama.cpp) offer another option. | Pending | - |
| 2 | What is the moderation process for shared deck submissions? | FL-021 mentions automatic content scanning + optional human review. Need to define specific rules, banned content categories, and appeal process. | Pending | - |
| 3 | Should the league leaderboard server be self-hosted or use a managed service? | FL-025 requires a lightweight server for XP sync and standings. Options: self-hosted on a VPS, managed serverless (Supabase Edge Functions), or Cloudflare Workers. | Pending | - |
| 4 | How should FSRS parameter optimization work? | Anki supports automatic FSRS parameter optimization from review history. Should MyFlash offer this? It would analyze ReviewLog data to compute personalized weights. | Pending | - |
| 5 | Should there be a web-based shared deck catalog browser? | FL-021 currently shows decks only in-app. A web catalog would let users browse and share deck links before installing MyFlash. | Pending | - |
| 6 | What is the migration path if a standalone MyFlash app is built before the hub module? | Per MyLife parity rules, both versions must stay in sync. Need to decide: standalone-first or module-first development. | Pending | - |

---

## Reconciliation Note (2026-03-07)

**Spec features:** 27 (FL-001 through FL-027)
**Catalog navigation (constants.ts):** 4 tabs (study, decks, stats, settings) + 3 screens (deck-detail, card-editor, review)

The catalog defines module-level navigation structure only, not individual features. The 27 spec features will need to map to the catalog's tab/screen structure during implementation. Notable gaps: the catalog has no screen entries for import (FL-006), AI card generation (FL-020), shared deck browser (FL-021), match game (FL-024), or league views (FL-025). These will need screen entries added to the catalog when implemented.

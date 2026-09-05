# Feature Spec: RSVP Custom Invitation Designs

## Metadata
- **Module:** rsvp
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Event creation (built), event templates (A-tier, built)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Evite's entire value proposition is beautiful invitation designs. Their free tier offers 1000+ designs, and premium users ($14.99/event) get ad-free custom designs. Currently, MyRSVP events look the same regardless of occasion -- no visual personality. This is the biggest aesthetic gap between MyRSVP and Evite/Paperless Post. Custom invitation designs transform a functional RSVP form into something guests want to share. Without this, hosts who care about presentation will stay on Evite.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Evite | Yes | Free (basic) / Premium ($14.99) | 1000+ categorized designs, custom upload, animated |
| Paperless Post | Yes | Free / Premium (coins) | Premium designer cards, foil effects, custom envelopes |
| RSVPify | Yes | Free | Professional templates, brand customization |
| Partiful | Minimal | Free | Simple cover image upload, no themed designs |

### Target User
Hosts who want their invitation to feel special -- birthday parties, weddings, holiday gatherings, baby showers. These users currently use Evite specifically for the visual designs and tolerate its ads. Paperless Post users who pay per-card want a subscription alternative. Hosts who want personalization beyond a plain text form.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engines/designs.ts              -- Design catalog, theme application
modules/rsvp/src/types.ts                        -- InvitationDesign, DesignTheme, DesignCategory types
modules/rsvp/src/db/schema.ts                    -- V3: design columns on rv_events
modules/rsvp/src/db/crud.ts                      -- Design read/write on events
modules/rsvp/src/index.ts                        -- Re-export design API
modules/rsvp/src/__tests__/designs.test.ts       -- Design catalog and theme tests
apps/mobile/app/(rsvp)/components/DesignPicker.tsx    -- Mobile design gallery
apps/mobile/app/(rsvp)/components/InvitationPreview.tsx -- Mobile preview
apps/web/app/rsvp/[eventId]/components/DesignPicker.tsx   -- Web design gallery
apps/web/app/rsvp/[eventId]/components/InvitationPreview.tsx -- Web preview
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Create Event form
                 └── "Design" step (after template, before details) ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add invitation design fields to rv_events
ALTER TABLE rv_events ADD COLUMN design_id TEXT;
ALTER TABLE rv_events ADD COLUMN design_custom_json TEXT;
```

No new tables. `design_id` references a bundled design from the catalog. `design_custom_json` stores customization overrides (text color, accent color, custom background image URL) as a JSON object.

### Dependencies
- **Internal:** `@mylife/ui` (design tokens, image components, Cool Obsidian as base)
- **External:** None. Designs are bundled SVG/CSS themes. No external image hosting needed for built-in designs.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a host, I want to choose a visual design for my invitation so it looks polished.
2. As a host, I want to preview how my invitation will look to guests before sending.
3. As a host, I want to customize colors and upload a cover image to personalize the design.
4. As a guest, I want to see a visually themed event page that matches the invitation design.

### Behavior Specification

**Design picker flow:**
1. After template selection (or skip), a "Choose a Design" step appears
2. Designs are organized in categories: Celebration, Elegant, Casual, Seasonal, Minimal
3. 20 built-in designs displayed in a scrollable grid (4 per category)
4. Each design card shows: thumbnail preview with the event title overlaid
5. "No Design" option at top (plain Cool Obsidian theme, the default)
6. User taps a design
7. System shows full-screen preview with the event's actual title, date, location overlaid
8. "Use This Design" button at bottom, "Back" at top
9. User confirms, design_id stored on the event

**Design customization:**
1. After selecting a design, a "Customize" section appears
2. Options: accent color picker (8 preset colors + custom), text color (light/dark auto-detected), cover image upload (optional, overrides design background)
3. Changes saved to design_custom_json
4. Live preview updates as user adjusts

**Guest view:**
1. Guest opens event detail (via link or app)
2. Event page renders with the selected design theme applied
3. Design affects: background pattern/color, header area, accent color, typography weight
4. RSVP form, polls, and other content sections use the design's accent color
5. If no design selected: standard Cool Obsidian theme

**Built-in Design Categories (20 total):**

| Category | Designs (4 each) |
|----------|-----------------|
| Celebration | confetti, balloons, sparkle, fireworks |
| Elegant | marble, gold-leaf, floral, calligraphy |
| Casual | kraft-paper, doodle, retro, neon |
| Seasonal | autumn-leaves, winter-snow, spring-bloom, summer-sunset |
| Minimal | clean-white, dark-glass, gradient, monochrome |

Each design defines: `backgroundColor`, `backgroundPattern` (optional CSS/SVG), `accentColor`, `textColor`, `headerFont` (from system fonts), `headerWeight`.

### Edge Cases
- **User uploads very large cover image (>5MB):** Reject with "Image must be under 5MB". Compress client-side if between 2-5MB.
- **User selects design then switches template:** Design persists. Template does not override design choice.
- **Design references asset not available:** Graceful fallback to solid background color.
- **Dark design with dark text:** Auto-detect contrast and switch text color. `textColor` is either `#F0F0F5` or `#1A1A24` based on background luminance.
- **Event shared via link to non-app user:** Web rendering must display the design correctly using CSS only (no native-only rendering).
- **User removes custom design:** Reset design_id and design_custom_json to null. Event reverts to default Cool Obsidian theme.
- **Design catalog updated in app update:** Old design IDs remain valid. New designs added to catalog. No migration needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Design picker shows 20 designs in 5 categories
- [ ] **AC-2:** "No Design" option available and selected by default
- [ ] **AC-3:** Tapping a design shows full-screen preview with real event data overlaid
- [ ] **AC-4:** "Use This Design" applies the design to the event
- [ ] **AC-5:** Accent color picker offers 8 presets + custom color
- [ ] **AC-6:** Cover image upload replaces design background
- [ ] **AC-7:** Guest event page renders with the selected design theme
- [ ] **AC-8:** Live preview updates as customization changes are made
- [ ] **AC-9:** "Remove Design" reverts to default Cool Obsidian theme

### Technical Criteria
- [ ] **TC-1:** V3 migration adds design_id and design_custom_json columns to rv_events
- [ ] **TC-2:** All 20 designs pass schema validation (required fields present)
- [ ] **TC-3:** Design themes are pure CSS/style objects (no external assets required for rendering)
- [ ] **TC-4:** Auto-contrast detection correctly switches text color for dark/light backgrounds
- [ ] **TC-5:** Cover image upload validates file type (JPEG, PNG, WebP) and size (<5MB)
- [ ] **TC-6:** design_custom_json is valid JSON when present, null when not customized

### Negative Criteria
- [ ] **NC-1:** Custom designs must NOT require network access to render (bundled assets)
- [ ] **NC-2:** Design selection must NOT affect event data (title, date, RSVPs)
- [ ] **NC-3:** Guest must NOT see design picker or customization controls
- [ ] **NC-4:** Removing a design must NOT delete the event or any RSVP data

## UI Specification

### Mobile (Expo)
- **Design picker:** Scrollable category sections, each with a horizontal row of 4 design cards
- **Design card:** 160x200px thumbnail, glass border `rgba(255,255,255,0.10)`, event title overlaid
- **Selected state:** `#FB7185` border, checkmark badge
- **Preview:** Full-screen modal with design applied, event data rendered in design's typography
- **Customization section:** Below design selection, collapsible, with color circles and image upload button

### Web (Next.js)
- **Design picker:** Grid layout, 5 columns on desktop, 3 on tablet, 2 on mobile
- **Preview:** Side panel or modal with live preview
- Accessible at `/rsvp/new/design` step in creation flow

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Picker | Grid of 20 designs + "No Design" default | "Choose a Design" step |
| Preview | Full-screen design with event data | User taps a design |
| Applied | Event form with design badge "Design: [name]" | User confirms design |
| Customizing | Color picker + image upload section | User taps "Customize" |
| Default | Standard Cool Obsidian theme | No design selected or design removed |

## Test Requirements

### Unit Tests (engines/designs.ts)
- [ ] Design catalog has exactly 20 designs across 5 categories
- [ ] Each design has required fields: id, name, category, backgroundColor, accentColor, textColor
- [ ] `getDesignById()` returns correct design for valid ID
- [ ] `getDesignById()` returns null for unknown ID
- [ ] `getDesignsByCategory()` returns 4 designs per category
- [ ] `applyDesignOverrides()` merges custom_json overrides with base design
- [ ] `autoContrastTextColor()` returns light text for dark backgrounds
- [ ] `autoContrastTextColor()` returns dark text for light backgrounds
- [ ] `validateDesignCustomJson()` accepts valid JSON with known keys
- [ ] `validateDesignCustomJson()` rejects invalid JSON

### Integration Tests
- [ ] Create event with design_id -> verify design_id stored
- [ ] Create event with custom overrides -> verify design_custom_json stored
- [ ] Update event to remove design -> verify design_id and design_custom_json null
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, tap "Create Event"
2. After template step, proceed to "Choose a Design"
3. **Verify:** 5 categories with 4 designs each visible -- AC-1
4. **Verify:** "No Design" option highlighted by default -- AC-2
5. Tap "Confetti" design
6. **Verify:** Full-screen preview shows confetti theme with event title -- AC-3
7. Tap "Use This Design"
8. **Verify:** Form shows "Design: Confetti" badge -- AC-4
9. Tap "Customize"
10. Change accent color to teal
11. **Verify:** Preview updates with teal accent -- AC-8
12. Upload a cover image
13. **Verify:** Image replaces design background -- AC-6
14. Save event, navigate to event detail
15. **Verify:** Event page renders with confetti design + teal accent + custom image -- AC-7
16. Edit event, tap "Remove Design"
17. **Verify:** Event reverts to default Cool Obsidian theme -- AC-9

## gstack Quality Gates

Based on Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate through design picker, apply design, verify guest view

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Events have no visual theming beyond Cool Obsidian defaults
- cover_image_url exists but is not used for design theming
- Event templates exist but do not include design suggestions
- No design catalog or theme engine

### After This Work
- V3 migration adds design_id and design_custom_json to rv_events
- 20 built-in designs across 5 categories as static TypeScript catalog
- Pure engine: `getDesigns()`, `getDesignById()`, `getDesignsByCategory()`, `applyDesignOverrides()`, `autoContrastTextColor()`
- Design picker component for mobile and web
- Guest-facing design rendering on event detail pages
- Cover image upload with size validation
- 10+ unit tests, 4+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 migration: design columns
- `modules/rsvp/src/definition.ts` -- Add to RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- InvitationDesign, DesignTheme, DesignCategory types
- `modules/rsvp/src/engines/designs.ts` -- Design catalog and theme application
- `modules/rsvp/src/db/crud.ts` -- Design read/write on events
- `modules/rsvp/src/index.ts` -- Re-export design API
- `modules/rsvp/src/__tests__/designs.test.ts` -- Catalog and theme tests
- `apps/mobile/app/(rsvp)/components/DesignPicker.tsx` -- Mobile gallery
- `apps/mobile/app/(rsvp)/components/InvitationPreview.tsx` -- Mobile preview
- `apps/web/app/rsvp/[eventId]/components/DesignPicker.tsx` -- Web gallery
- `apps/web/app/rsvp/[eventId]/components/InvitationPreview.tsx` -- Web preview

### Known Limitations
- Designs are CSS/style-based only (no animated designs in v1)
- No user-created custom designs from scratch (pick from catalog + customize)
- No AI-generated designs
- Cover image upload is local storage only (no cloud hosting)
- Designs do not affect .ics calendar export or push notifications
- No design sharing between events (each event stores its own design choice)

### Context for Next Agent
- V3 migration is shared with recurring events and map/directions. Coordinate which features are built first. If others are built first, append design columns to the existing V3.
- Designs are pure TypeScript objects defining style properties. No image assets are bundled -- backgrounds use CSS gradients, patterns, and colors. This keeps the app bundle size small and avoids asset loading issues.
- `autoContrastTextColor()` uses the WCAG luminance formula: `L = 0.2126*R + 0.7152*G + 0.0722*B`. If luminance > 0.5, use dark text `#1A1A24`. If <= 0.5, use light text `#F0F0F5`.
- The `design_custom_json` schema: `{ accentColor?: string, textColor?: string, backgroundImageUrl?: string }`. Only non-null fields override the base design.
- Event templates (A-tier, built) do not suggest designs. Keep these orthogonal -- templates fill form fields, designs set visual theme.

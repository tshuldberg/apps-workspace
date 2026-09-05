# Feature Spec: SOS/Panic Button

## Metadata
- **Module:** health
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 1 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
The SOS/panic feature provides immediate crisis support when a user is experiencing a panic attack, anxiety crisis, or mental health emergency. CareClinic offers this as part of their self-care toolkit. Complexity is 4 (easy build) because it's primarily UI-driven with no complex data model. It combines breathing exercises, grounding techniques, and emergency contacts into a single quick-access screen. This complements existing breathing exercises and CBT tools.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CareClinic | Yes | Yes ($9.99/mo) | SOS button with care plan and emergency contacts |
| Calm | Partial | Yes ($69.99/yr) | "Panic SOS" guided session |
| SAM (Self-help for Anxiety) | Yes | Free | Anxiety toolkit with grounding exercises |
| Bearable | No | N/A | No dedicated panic feature |

### Target User
Users prone to panic attacks or acute anxiety who need immediate access to calming tools and emergency contacts. The target is to provide a self-contained crisis toolkit that works offline without any setup required.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/sos/grounding.ts         -- Grounding technique scripts
modules/health/src/sos/types.ts             -- SOS session types
modules/health/src/sos/crud.ts              -- SOS usage logging
modules/health/src/db/schema.ts             -- New hl_sos_sessions table
modules/health/src/index.ts                 -- Export SOS functions
apps/mobile/app/(health)/sos.tsx            -- SOS screen (full-screen overlay)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Today tab
            └── SOS button (always visible, top-right) ← YOU ARE HERE
                 ├── Breathing guide (immediate start)
                 ├── 5-4-3-2-1 grounding exercise
                 ├── Emergency contacts (from ICE card)
                 └── Crisis hotline numbers
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_sos_sessions (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL DEFAULT 'manual',  -- manual | low_mood_prompt
  tools_used TEXT,                                -- JSON array: ['breathing', 'grounding', 'contacts']
  duration_seconds INTEGER,
  mood_before INTEGER,
  mood_after INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_sos_date_idx ON hl_sos_sessions(created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/db`, hl_emergency_info (ICE contacts), breathing exercises (reuse breathing engine)
- **External:** Native phone dialer for crisis hotline. No network required for core functionality.
- **Cross-Module:** Reads emergency contacts from ICE card. Uses breathing exercise engine. Mood module could trigger SOS suggestion on very low mood.

## Functional Requirements

### User Stories
1. As a user having a panic attack, I want to tap one button and immediately get calming tools without navigating multiple screens.
2. As a user in crisis, I want immediate access to my emergency contacts and crisis hotline numbers.
3. As a user, I want grounding exercises that walk me through calming techniques step by step.
4. As a user, I want SOS usage logged privately so I can discuss patterns with my therapist.

### Behavior Specification

**Activating SOS:**
1. SOS button is always visible in the top-right of the MyHealth Today tab (red circle with "SOS" text)
2. Tapping opens a full-screen overlay (no navigation required)
3. Overlay immediately starts a calming breathing animation (box breathing auto-starts)
4. Below the breathing: "You are safe. This will pass." reassurance text

**SOS tools (tabs at bottom of overlay):**
1. **Breathe** (default, auto-starts): Box breathing animation with phase labels
2. **Ground** (5-4-3-2-1 technique):
   - "Name 5 things you can see"
   - "Name 4 things you can touch"
   - "Name 3 things you can hear"
   - "Name 2 things you can smell"
   - "Name 1 thing you can taste"
   - User taps through each step
3. **Call** (emergency contacts):
   - Emergency contacts from ICE card (hl_emergency_info)
   - Crisis hotlines: 988 Suicide & Crisis Lifeline, Crisis Text Line (text HOME to 741741)
   - Tap to call/text directly
4. User dismisses SOS overlay when they feel better
5. Optional: post-crisis mood rating
6. Session logged to hl_sos_sessions

### Edge Cases

- **No ICE contacts set up:** "Call" tab shows crisis hotlines only with prompt to set up ICE contacts.
- **No network:** Calling still works (cellular). All tools work offline.
- **Accidental tap:** Confirm before logging, but do NOT add a confirmation before opening (must be instant).
- **App in background:** SOS should be accessible from a widget/notification shortcut (future enhancement).
- **Multiple SOS sessions in one day:** All logged independently.
- **User uses SOS then leaves app:** Log partial session with whatever tools were used.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** SOS button is visible on the Today tab without scrolling
- [ ] **AC-2:** Tapping SOS immediately opens full-screen overlay with breathing animation (no delays, no confirmations)
- [ ] **AC-3:** Reassurance text ("You are safe") is displayed prominently
- [ ] **AC-4:** 5-4-3-2-1 grounding exercise walks through all 5 senses
- [ ] **AC-5:** Emergency contacts from ICE card are one tap to call
- [ ] **AC-6:** Crisis hotline numbers (988, 741741) are always shown
- [ ] **AC-7:** Overlay can be dismissed with a swipe down or close button
- [ ] **AC-8:** SOS usage is logged to history (viewable in Insights)

### Technical Criteria
- [ ] **TC-1:** hl_sos_sessions table created by migration
- [ ] **TC-2:** SOS overlay opens within 200ms of tap (no loading states)
- [ ] **TC-3:** Breathing animation starts immediately without user interaction
- [ ] **TC-4:** Phone dialer opens when tapping a contact number
- [ ] **TC-5:** Session logged with tools_used JSON array

### Negative Criteria
- [ ] **NC-1:** SOS must NOT require confirmation before opening (must be instant)
- [ ] **NC-2:** SOS must NOT require network access
- [ ] **NC-3:** SOS usage history must NOT be visible outside the health module (private)
- [ ] **NC-4:** Must NOT auto-call emergency services (user must explicitly tap)

## UI Specification

### Mobile (Expo)
- **SOS button:** 40px red circle (`#FF453A`) with "SOS" text in white, top-right of Today tab. Subtle pulse animation when idle.
- **Overlay:** Full-screen, background `#0A0A0F` with slight red tint at top. Breathing circle center-screen. Reassurance text in `#F0F0F5`, 20px. Tool tabs at bottom: Breathe | Ground | Call.
- **Grounding:** Step-by-step cards, large text, one sense per screen. "Next" button below.
- **Contacts:** List with phone icon, one-tap to call. Crisis hotlines highlighted.

### Web (Next.js)
- SOS button at top-right of health dashboard. Full-page overlay.
- Phone numbers displayed (no direct dialing on web, but click-to-call links).

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Idle | SOS button pulsing on Today tab | Normal state |
| Active - Breathe | Breathing animation + reassurance | SOS tapped |
| Active - Ground | 5-4-3-2-1 prompts | Ground tab |
| Active - Call | Contact list + hotlines | Call tab |
| Dismissed | Today tab returns | User closes overlay |

## Test Requirements

### Unit Tests
- [ ] `createSosSession`: stores trigger, tools_used, duration
- [ ] `getSosSessions`: returns reverse chronological
- [ ] `getSosStats`: total sessions, avg duration, most-used tool
- [ ] `getGroundingSteps`: returns 5 steps for 5-4-3-2-1
- [ ] Grounding steps: correct sense and count for each step

### Integration Tests
- [ ] Full flow: tap SOS -> use breathing + grounding -> dismiss -> session logged
- [ ] Contact flow: tap SOS -> Call tab -> tap contact -> dialer opens

### QA Verification Script

1. Navigate to MyHealth > Today tab
2. Verify: SOS button visible at top-right -- corresponds to AC-1
3. Tap SOS
4. Verify: Full-screen overlay opens instantly with breathing animation -- corresponds to AC-2
5. Verify: "You are safe" text displayed -- corresponds to AC-3
6. Tap "Ground" tab
7. Verify: 5-4-3-2-1 exercise starts with "5 things you can see" -- corresponds to AC-4
8. Tap through all 5 steps
9. Tap "Call" tab
10. Set up ICE contact first, return to SOS
11. Verify: Emergency contact listed with call button -- corresponds to AC-5
12. Verify: 988 and 741741 hotlines shown -- corresponds to AC-6
13. Swipe down or tap close
14. Verify: Overlay dismisses -- corresponds to AC-7
15. Navigate to Insights
16. Verify: SOS session logged -- corresponds to AC-8

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has breathing exercises and ICE card but no unified crisis support tool.

### After This Work
- SOS button on Today tab with instant full-screen overlay
- Auto-starting breathing guide for immediate calming
- 5-4-3-2-1 grounding exercise
- Emergency contacts and crisis hotline quick access
- SOS session logging for pattern tracking

### Files Changed
- `modules/health/src/sos/grounding.ts` -- Grounding technique steps
- `modules/health/src/sos/types.ts` -- Types
- `modules/health/src/sos/crud.ts` -- Session logging
- `modules/health/src/db/schema.ts` -- hl_sos_sessions
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/sos.tsx` -- SOS overlay screen

### Known Limitations
- No widget/notification shortcut (requires native module)
- No Apple Watch SOS integration
- No auto-detection of panic (no biometric monitoring)
- Crisis hotlines are US-only (need i18n for other countries)

### Context for Next Agent
- The SOS overlay must open instantly (< 200ms). Do NOT add loading states, confirmation dialogs, or animations before showing tools.
- Breathing animation reuses the breathing exercise engine (box breathing pattern). Just auto-start it.
- Emergency contacts come from hl_emergency_info.emergency_contacts (JSON string with name + phone pairs).
- Crisis hotlines should be hardcoded constants: 988 (US Suicide & Crisis Lifeline), text HOME to 741741 (Crisis Text Line). For calling, use Expo Linking.openURL('tel:988').

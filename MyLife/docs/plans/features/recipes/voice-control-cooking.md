# Feature Spec: Voice Control in Cooking Mode

## Metadata
- **Module:** recipes
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [3] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (cooking mode with step timers already exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
When cooking, hands are often wet, greasy, or covered in flour. Tapping a screen to advance recipe steps is frustrating and unsanitary. Voice control lets users navigate cooking steps hands-free: "next step," "start timer," "repeat." This is a quality-of-life feature that transforms cooking mode from "acceptable" to "delightful." Cross-module score is 3 because the same voice infrastructure could be shared with the Voice module for broader hands-free app control.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AnyList | Yes | Yes ($11.99/yr) | Siri integration, "Hey Siri, next step" while in cooking mode |
| Paprika | No | N/A | No voice control |
| Recipe One | No | N/A | No voice control |
| Forkee | No | N/A | No voice control |

### Target User
Home cooks who actively follow recipes step-by-step while cooking. Especially parents, bakers, and anyone who works with dough, raw meat, or messy ingredients where touching the phone is impractical. These users currently prop up their phone on the counter, squint at the screen, and wash their hands every time they need to advance a step.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  voice/
    voice-commands.ts                -- NEW: command parser (maps speech text to actions)
    voice-commands.test.ts           -- NEW: unit tests for command matching
  types.ts                           -- ADD VoiceCommand type
  index.ts                           -- ADD exports

apps/mobile/app/(recipes)/
  cooking-mode.tsx                   -- MODIFIED: integrate voice listener, add mic toggle
  components/VoiceIndicator.tsx      -- NEW: mic active/inactive indicator + recognized text flash

apps/web/app/recipes/
  [id]/cooking/page.tsx              -- MODIFIED: integrate Web Speech API listener
  components/VoiceIndicator.tsx      -- NEW: web voice indicator
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── Recipe Detail
                 └── "Start Cooking" button
                      └── Cooking Mode ← YOU ARE HERE
                           ├── Step display (current step text, step X of Y)
                           ├── Timer (if step has timer)
                           ├── Navigation (prev/next buttons)
                           └── 🎤 Voice Indicator (top-right)
```

### Data Model

No new tables required. Voice control is a runtime UI feature that dispatches the same actions as the existing cooking mode buttons.

New type (added to types.ts):

```typescript
export type VoiceCommand =
  | 'next_step'
  | 'previous_step'
  | 'start_timer'
  | 'stop_timer'
  | 'repeat_step'
  | 'read_ingredients'
  | 'go_to_step';

export interface ParsedVoiceCommand {
  command: VoiceCommand;
  stepNumber?: number; // for 'go_to_step'
}
```

### Dependencies
- **Internal:** `@mylife/recipes` (cooking mode state, step navigation, timer logic via `detectStepTimerMinutes`)
- **External:**
  - Mobile: `expo-speech-recognition` (or `@react-native-voice/voice`) for speech-to-text
  - Web: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) -- no library needed
  - Mobile: `expo-speech` for optional text-to-speech (reading steps aloud)
- **Cross-Module:** Voice module (`modules/voice/`) may share the command parsing infrastructure in the future

## Functional Requirements

### User Stories
1. As a cook with messy hands, I want to say "next step" to advance the recipe without touching my phone.
2. As a cook following a complex recipe, I want to say "start timer" to begin the step timer hands-free.
3. As a cook who missed something, I want to say "repeat" to hear the current step read aloud.

### Behavior Specification

1. User enters cooking mode by tapping "Start Cooking" on a recipe detail screen.
2. Cooking mode opens showing step 1, with a microphone icon in the top-right corner.
3. User taps the mic icon to enable voice control. The mic icon turns green (#22C55E) and pulses subtly.
4. System begins continuous speech recognition (listening for wake-free commands).
5. When speech is detected, the recognized text flashes briefly below the mic icon (1.5s fade).
6. System passes recognized text to `parseVoiceCommand(text)` which fuzzy-matches against known commands.
7. Matched commands trigger the same actions as button taps:
   - "Next" / "next step" / "continue" -> advance to next step
   - "Back" / "previous" / "go back" -> return to previous step
   - "Start timer" / "begin timer" / "set timer" -> start the step timer (if step has one)
   - "Stop timer" / "cancel timer" / "clear timer" -> stop the running timer
   - "Repeat" / "read step" / "what does it say" -> TTS reads the current step text aloud
   - "Ingredients" / "read ingredients" -> TTS reads the ingredient list
   - "Go to step [N]" / "step [N]" -> jump to step number N
8. Unrecognized speech is silently ignored (no error, no feedback beyond the text flash).
9. User can tap the mic icon again to disable voice control. Icon returns to default (white, no pulse).
10. Voice control is disabled when the user leaves cooking mode.
11. On the first enable, a brief tooltip appears: "Try saying: next step, start timer, or repeat."

### Edge Cases

- Background noise triggers false recognition: command parser requires specific keywords, random words are ignored.
- User speaks a language other than English: recognition runs in device locale. Command keywords should work in English only for V1.
- No microphone permission: show system permission prompt. If denied, mic icon is grayed out with "Mic access required" tooltip.
- Speech recognition unavailable (older browser/device): hide the mic icon entirely. Feature degrades gracefully.
- Timer already running when "start timer" is said: no-op, timer continues.
- "Go to step 99" when recipe has 5 steps: go to last step, not error.
- Two voice commands in rapid succession (<500ms): queue and execute sequentially.
- User says "next step" while TTS is reading: stop TTS, then advance.
- App goes to background: pause speech recognition. Resume when app returns to foreground.
- Module disabled: voice listener is cleaned up on unmount.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Cooking mode shows a microphone icon in the top-right corner.
- [ ] **AC-2:** Tapping the mic icon enables voice control (icon turns green, pulses).
- [ ] **AC-3:** Saying "next step" advances to the next cooking step.
- [ ] **AC-4:** Saying "previous" returns to the previous step.
- [ ] **AC-5:** Saying "start timer" begins the step timer.
- [ ] **AC-6:** Saying "stop timer" stops the running timer.
- [ ] **AC-7:** Saying "repeat" reads the current step aloud via TTS.
- [ ] **AC-8:** Saying "go to step 3" jumps to step 3.
- [ ] **AC-9:** Recognized text flashes briefly below the mic icon.
- [ ] **AC-10:** Tapping mic again disables voice control (icon returns to white).
- [ ] **AC-11:** First enable shows a brief tooltip with example commands.
- [ ] **AC-12:** Unrecognized speech is silently ignored.

### Technical Criteria
- [ ] **TC-1:** `parseVoiceCommand(text)` correctly maps "next step" -> `next_step`.
- [ ] **TC-2:** `parseVoiceCommand` handles case-insensitive matching.
- [ ] **TC-3:** `parseVoiceCommand` extracts step number from "go to step 3" -> `{ command: 'go_to_step', stepNumber: 3 }`.
- [ ] **TC-4:** `parseVoiceCommand` returns null for unrecognized input.
- [ ] **TC-5:** Speech recognition cleanup runs on component unmount.
- [ ] **TC-6:** Voice control uses `expo-speech` for TTS on mobile and `SpeechSynthesis` API on web.
- [ ] **TC-7:** Command parser handles multiple synonyms per command (at least 3 per command type).

### Negative Criteria
- [ ] **NC-1:** Voice control must NOT be always-on. User must explicitly enable it.
- [ ] **NC-2:** Voice data must NOT be sent to any server other than the device's built-in speech recognition engine.
- [ ] **NC-3:** Voice control must NOT interfere with step timers or cooking mode state when disabled.
- [ ] **NC-4:** Unrecognized speech must NOT show error messages or toasts.

## UI Specification

### Mobile (Expo)
- Mic icon: 32x32, positioned top-right of cooking mode screen, 16px from edges.
- Inactive: white (`#F0F0F5`), no animation.
- Active: green (`#22C55E`), subtle pulse animation (scale 1.0 to 1.1, 2s loop).
- Recognized text: appears below mic icon, 12px font, textSecondary color, fades out over 1.5s.
- Tooltip on first enable: glass card (`rgba(255,255,255,0.08)`) with "Try saying: next step, start timer, or repeat" text, auto-dismisses after 4s.
- No additional UI elements beyond the mic icon and text flash.

### Web (Next.js)
- Same mic icon position and behavior.
- Uses Web Speech API (`webkitSpeechRecognition`). Feature-detect on mount; hide icon if unsupported.
- Same tooltip and text flash behavior.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Inactive | White mic icon | Default, or user tapped to disable |
| Active | Green pulsing mic icon | User tapped to enable |
| Listening | Green icon + recognized text flash | Speech detected |
| No Permission | Grayed-out mic icon with tooltip | Mic permission denied |
| Unsupported | No mic icon visible | Speech API unavailable |

## Test Requirements

### Unit Tests
- [ ] `parseVoiceCommand("next step")` returns `{ command: 'next_step' }`
- [ ] `parseVoiceCommand("Next")` returns `{ command: 'next_step' }` (case-insensitive)
- [ ] `parseVoiceCommand("continue")` returns `{ command: 'next_step' }` (synonym)
- [ ] `parseVoiceCommand("go back")` returns `{ command: 'previous_step' }`
- [ ] `parseVoiceCommand("start timer")` returns `{ command: 'start_timer' }`
- [ ] `parseVoiceCommand("stop timer")` returns `{ command: 'stop_timer' }`
- [ ] `parseVoiceCommand("repeat")` returns `{ command: 'repeat_step' }`
- [ ] `parseVoiceCommand("read ingredients")` returns `{ command: 'read_ingredients' }`
- [ ] `parseVoiceCommand("go to step 3")` returns `{ command: 'go_to_step', stepNumber: 3 }`
- [ ] `parseVoiceCommand("step 12")` returns `{ command: 'go_to_step', stepNumber: 12 }`
- [ ] `parseVoiceCommand("hello world")` returns null
- [ ] `parseVoiceCommand("")` returns null

### Integration Tests
- [ ] Voice enable/disable toggle: mic state persists correctly
- [ ] Command dispatch: voice command triggers same state change as button tap

### QA Verification Script

1. Open the app on iOS simulator (or device with microphone).
2. Navigate to MyRecipes > open a recipe with 5+ steps and timers.
3. Tap "Start Cooking" to enter cooking mode.
4. Verify: Mic icon appears in top-right corner -- corresponds to AC-1.
5. Tap the mic icon.
6. Verify: Icon turns green and pulses -- corresponds to AC-2.
7. Verify: Tooltip appears with example commands -- corresponds to AC-11.
8. Say "next step."
9. Verify: Recipe advances to step 2 -- corresponds to AC-3.
10. Verify: "next step" text flashes below mic icon -- corresponds to AC-9.
11. Say "previous."
12. Verify: Recipe returns to step 1 -- corresponds to AC-4.
13. Navigate to a step with a timer. Say "start timer."
14. Verify: Timer begins counting down -- corresponds to AC-5.
15. Say "stop timer."
16. Verify: Timer stops -- corresponds to AC-6.
17. Say "repeat."
18. Verify: Current step is read aloud via TTS -- corresponds to AC-7.
19. Say "go to step 3."
20. Verify: Recipe jumps to step 3 -- corresponds to AC-8.
21. Say "blah blah random words."
22. Verify: No action taken, text flashes and disappears -- corresponds to AC-12.
23. Tap mic icon again.
24. Verify: Icon returns to white, no longer listening -- corresponds to AC-10.
25. Open web app, navigate to same recipe's cooking mode.
26. Verify: Same voice control behavior (if browser supports Speech API).

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate cooking mode, toggle voice, verify all states

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- Cooking mode exists with step display, next/previous buttons, and step timers.
- `detectStepTimerMinutes` parses timer durations from step text.
- `CookingStepWithTimer` type provides step data with timer info.
- No voice input or TTS output exists in cooking mode.

### After This Work
- `parseVoiceCommand(text)` engine function maps speech to cooking actions.
- Mobile: continuous speech recognition via expo-speech-recognition.
- Web: Web Speech API listener with feature detection.
- TTS reads steps aloud on "repeat" command.
- Voice indicator UI on both platforms.

### Files Changed
- `modules/recipes/src/voice/voice-commands.ts` -- NEW: command parser
- `modules/recipes/src/voice/voice-commands.test.ts` -- NEW: unit tests
- `modules/recipes/src/types.ts` -- ADD VoiceCommand, ParsedVoiceCommand types
- `modules/recipes/src/index.ts` -- ADD exports
- `apps/mobile/app/(recipes)/cooking-mode.tsx` -- MODIFIED: voice listener integration
- `apps/mobile/app/(recipes)/components/VoiceIndicator.tsx` -- NEW: mic icon + text flash
- `apps/web/app/recipes/[id]/cooking/page.tsx` -- MODIFIED: Web Speech API integration
- `apps/web/app/recipes/components/VoiceIndicator.tsx` -- NEW: web voice indicator

### Known Limitations
- English commands only in V1 (no i18n for voice commands).
- No wake word (must tap to enable, then speak commands).
- Speech recognition quality depends on device microphone and ambient noise.
- Web Speech API is not supported in all browsers (Chrome/Edge yes, Firefox/Safari partial).

### Context for Next Agent
- Cooking mode state is managed locally in the component. Voice commands should dispatch the same state transitions as button taps.
- `detectStepTimerMinutes` already provides `inferred_timer_minutes` on each `CookingStepWithTimer`. Use this to determine if "start timer" is valid for the current step.
- expo-speech-recognition (or @react-native-voice/voice) needs to be added to mobile package.json.
- expo-speech is needed for TTS (reading steps aloud).
- The Voice module (`modules/voice/`) is a separate voice memo recorder. The voice command parser here is independent but could be refactored into a shared package later.

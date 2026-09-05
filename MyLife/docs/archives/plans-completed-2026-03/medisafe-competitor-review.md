# Medisafe vs MyMeds: Competitor Review Plan

**Module:** MyMeds (`modules/meds/`, `apps/mobile/app/(meds)/`)
**Competitor:** Medisafe iOS app
**Recording:** `/Users/trey/Downloads/ScreenRecording_03-29-2026 18-30-25_1.MP4`
**Date:** 2026-03-29

## Lessons from Prior Reviews

### What Worked
- Frame extraction at 0.5fps (1 frame every 2s) gives good coverage without redundancy
- Labeled screenshot directories organized by feature category enable clean reference
- Feature-by-feature comparison tables with YES/NO/PARTIAL are unambiguous
- P0/P1/P2 prioritization focuses build effort on retention-critical gaps
- Checking module exports and types BEFORE writing code prevents type errors
- Adding new screens to hamburger menu is the consistent nav pattern

### What Didn't Work
- Writing code with wrong property casing (snake_case vs camelCase) caused multi-pass fixes
- Assuming dependencies exist (AsyncStorage, expo-notifications) without checking package.json first
- Messy JSX edits on scan.tsx required multiple correction passes
- `while(true)` failed lint -- use `let checking = true; while(checking)` pattern
- Some features were "completed" as deferred -- be honest about what's deferred vs done
- Interleaving comparison doc writing with code building loses focus

### Process for This Review
1. **Phase 1: Analyze** -- Extract frames, view all screens, write comparison doc. Do NOT write code.
2. **Phase 2: Plan** -- Identify gaps, check module types/exports/deps, create task list with effort estimates.
3. **Phase 3: Build** -- Execute tasks sequentially. Typecheck after EACH file. Add to hamburger menu.
4. **Phase 4: Verify** -- Run `tsc --noEmit`, commit, push.

## Current MyMeds State (29 mobile screens)

Screens: index, add-med, medications, history, refills, interactions, mood, mood-check-in,
correlation, reports, settings, log-bp, bp-history, bp-trends, log-glucose, glucose-history,
log-insulin, insulin-history, a1c, adherence, caregivers, cgm, fodmap, measurement-trends,
pain-map, weather, wellness

Module packages: analytics, bp, caregiver, cgm, fodmap, glucose, insulin, interactions,
measurements, medication, models, mood, pain, engine, export

## Phases

### Phase 1: Video Analysis (comparison doc only, no code)
- Copy recording to /tmp/medisafe-review.mp4
- Extract frames at 0.5fps
- View all frames in batches of 8-10
- Create labeled screenshot directories
- Write `docs/competitor-analysis/medisafe-vs-mymeds.md`

### Phase 2: Gap Analysis + Task Planning
- Cross-reference comparison against existing feature gap doc
- Check `modules/meds/src/index.ts` for available exports and types
- Check `apps/mobile/package.json` for available dependencies
- Create task list with accurate effort estimates
- Mark features that need new dependencies as "deferred"

### Phase 3: Sequential Build
- Read target file BEFORE editing
- Use camelCase matching the module's type exports
- Typecheck after each new file: `npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | grep "(meds)"`
- Add each new screen to hamburger menu in index.tsx
- Follow existing styling patterns (ACCENT color, Card, spacing tokens)

### Phase 4: Verify + Ship
- Full typecheck
- Commit with conventional commit format
- Push to main
- Update comparison doc with resolution status

## Acceptance Criteria
- [ ] Comparison doc with 40+ feature points
- [ ] 15+ labeled screenshots organized by category
- [ ] All P0 gaps resolved or documented as deferred with reason
- [ ] All P1 gaps resolved or documented
- [ ] New screens accessible from hamburger menu
- [ ] Zero typecheck errors on changed files
- [ ] Single clean commit pushed to main

# Standalone Parity Universal Implementation Plan

## Objective

Make each MyLife module a thin runtime adapter over its standalone app so standalone remains the single source of truth for product UI, behavior, and settings.  
Changes made in a standalone app must flow into MyLife via direct component/route reuse, not duplicated rewrites.

## Expected Outcomes

1. Every standalone app in `.gitmodules` has an explicit integration state in tests.
2. Every integrated module has declared parity mode for web and mobile.
3. Passthrough-enabled modules use thin wrapper routes only.
4. Non-passthrough modules are explicitly marked as adapter or design-only, never ambiguous.
5. `pnpm check:parity` fails on parity regressions.

## Current Integration States

| Standalone | Module | Status | Web Mode | Mobile Mode |
|---|---|---|---|---|
| MyBooks | books | implemented | passthrough | adapter |
| MyBudget | budget | implemented | passthrough | adapter |
| MyCar | car | implemented | passthrough | adapter |
| MyFast | fast | implemented | passthrough | adapter |
| MyHomes | homes | implemented | passthrough | adapter |
| MyRecipes | recipes | implemented | passthrough | adapter |
| MySurf | surf | implemented | adapter | adapter |
| MyWords | words | implemented | passthrough | adapter |
| MyWorkouts | workouts | implemented | passthrough | adapter |

| MyHabits | habits | implemented | passthrough | adapter |
| MyMeds | meds | design_only | design_only | design_only |
| MySubs | subs | design_only | design_only | design_only |
| MyCloset/MyCycle/MyFlash/MyGarden/MyJournal/MyMood/MyNotes/MyPets/MyStars/MyTrails/MyVoice | none | standalone_only | standalone_only | standalone_only |

## Universal Per-App Plan

Use this checklist for each standalone as you migrate it to passthrough.

### Phase 0: Discovery and Lock

1. Confirm standalone route tree and data flow.
2. Confirm current MyLife route tree for the matching module.
3. List all user-visible screens, labels, controls, and settings.
4. Record any intentional hub-only differences (shell chrome only).

### Phase 1: Wiring Foundation

1. Add import aliases in MyLife host app (`apps/web` and later mobile equivalent) pointing to standalone source paths.
2. Enable external directory transpilation where required.
3. Ensure standalone styling dependencies are available in MyLife host.
4. Add base-path helper in standalone if module needs host-prefixed routes.

### Phase 2: Web Passthrough Conversion

1. Replace module web routes in `apps/web/app/<module>/**` with thin wrappers that re-export standalone routes.
2. Keep module `actions.ts` only where server-only host wiring is needed.
3. Remove duplicated hub-side module UI once wrappers are in place.

### Phase 3: Mobile Passthrough Conversion

1. Replace Expo screens in `apps/mobile/app/(<module>)/**` with thin wrappers over standalone screens or shared package exports.
2. Preserve hub navigation container only.
3. Remove duplicated hub-side mobile UI logic once wrappers are stable.

### Phase 4: Data and Behavior Parity

1. Ensure the module data contracts map 1:1 to standalone behavior.
2. Keep optional network features available in both versions with same controls and copy.
3. Validate all major create/read/update/delete flows from both host and standalone.

### Phase 5: Gate and Document

1. Add or update parity tests for the module in the matrix suite.
2. If passthrough-enabled, add strict wrapper assertions.
3. Update `AGENTS.md` and `CLAUDE.md` if long-lived parity rules changed.
4. Run full parity gate and record outcome in timeline if required.

## Test Suite Contract (Required)

Each module rollout must satisfy these test classes:

1. **Inventory tests**
   - Standalone exists in `.gitmodules`
   - Local `.git` metadata exists
   - Integration status is explicitly declared
2. **Module wiring tests**
   - `modules/<id>/package.json` and `src/definition.ts` exist
   - Web/mobile route roots exist in MyLife
   - `@mylife/<id>` dependency exists in `apps/web` and `apps/mobile`
3. **Mode declaration tests**
   - Web and mobile parity mode is explicit (`passthrough`, `adapter`, or `design_only`)
4. **Implemented runtime tests**
   - Standalone and hub route roots both include runtime screens
5. **Passthrough strictness tests**
   - Wrapper inventory matches expected file list
   - Wrapper files are exact re-export passthroughs
   - Host alias/config styling support is present
6. **Module-specific strict tests**
   - For workouts: route helper usage and host base-path support must pass

## Definition of Done Per Module

A module is done when all are true:

1. Standalone is still canonical and editable in place.
2. MyLife reflects those edits through passthrough or declared adapter mode.
3. No duplicate UI logic remains for passthrough-enabled routes.
4. Parity tests pass locally and in CI.
5. Parity mode remains explicit in the matrix.

## Execution Commands

```bash
pnpm check:standalone
pnpm check:module-parity
pnpm check:passthrough-parity
pnpm check:workouts-parity
pnpm check:parity
pnpm test:parity-matrix
```

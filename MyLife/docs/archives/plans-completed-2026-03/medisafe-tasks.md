# Medisafe Review: Task Queue

Sequential tasks for the Medisafe competitor review. Each task is a self-contained prompt.
Execute in order. Compact context at 60% fill.

## Task Registry

| ID | Phase | Task | Effort | Depends On |
|----|-------|------|--------|------------|
| MS-1 | Analyze | Extract frames and view all screens | Medium | -- |
| MS-2 | Analyze | Write comparison doc + label screenshots | Medium | MS-1 |
| MS-3 | Plan | Gap analysis + check types/deps + create build tasks | Small | MS-2 |
| MS-4 | Build | Build P0 gap screens | Large | MS-3 |
| MS-5 | Build | Build P1 gap screens | Large | MS-4 |
| MS-6 | Verify | Typecheck, wire menu, commit, push | Small | MS-5 |

## Task Prompts

### MS-1: Extract and View Frames

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md
Tasks: docs/plans/active/medisafe-tasks.md

PHASE 1a: Extract frames from the Medisafe screen recording.

Steps:
1. Copy /Users/trey/Downloads/ScreenRecording_03-29-2026\ 18-30-25_1.MP4 to /tmp/medisafe-review.mp4
2. Get video duration with ffprobe
3. Extract frames at 0.5fps: ffmpeg -i /tmp/medisafe-review.mp4 -vf "fps=0.5" -q:v 2 /tmp/medisafe-frames/frame_%03d.jpg
4. View ALL frames in batches of 8-10 using the Read tool
5. For each frame, note: timestamp, screen name, key features visible
6. Create labeled screenshot directories under docs/competitor-analysis/medisafe-screens/labeled/
7. Copy representative frames into labeled directories

Output: A comprehensive list of every Medisafe feature observed, organized by category.
Do NOT write any code. Analysis only.

When done, report findings and proceed to MS-2.
Compact context if at 60% fill before proceeding.
```

### MS-2: Write Comparison Doc

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md

PHASE 1b: Write the feature comparison doc.

Context from MS-1: [frame analysis results from previous task]

Steps:
1. Read the existing feature gap doc: docs/designs/DESIGN-mymeds-feature-gaps.md
2. Read the competitor catalog: docs/Marketing and Competition/competitor-features-meds-mood.md
3. List all mobile screens: ls apps/mobile/app/(meds)/
4. For each Medisafe feature observed in MS-1, check if MyMeds has it:
   - Grep for the feature keyword in modules/meds/src/
   - Check if a mobile screen exists for it
   - Mark YES / NO / PARTIAL
5. Write docs/competitor-analysis/medisafe-vs-mymeds.md following the template:
   - Summary paragraph
   - Feature-by-feature comparison table (40+ points)
   - "Where MyMeds EXCEEDS Medisafe" table
   - P0 / P1 / P2 gap tables with effort estimates
   - Out of Scope section
   - Screenshot reference

Do NOT write any implementation code. Comparison doc only.
When done, proceed to MS-3.
```

### MS-3: Gap Analysis + Build Task Creation

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md
Comparison: docs/competitor-analysis/medisafe-vs-mymeds.md

PHASE 2: Create the build task list.

Steps:
1. Read the comparison doc you wrote in MS-2
2. Read modules/meds/src/index.ts to understand available exports and types
3. Read apps/mobile/package.json to check available dependencies
4. Read apps/mobile/app/(meds)/index.tsx to understand the hamburger menu structure
5. For each P0 and P1 gap:
   a. Determine if it needs a new screen, a modification to an existing screen, or module-level code
   b. Check if the module already exports the needed functions/types
   c. Estimate: Small (< 50 lines), Medium (50-150 lines), Large (150+ lines)
   d. Flag if it needs a dependency not in package.json (mark as deferred)
6. Create TaskCreate entries for each buildable gap
7. Report the final task list with IDs, descriptions, and effort

Do NOT write implementation code yet. Planning only.
When done, proceed to MS-4.
```

### MS-4: Build P0 Gaps

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md
Comparison: docs/competitor-analysis/medisafe-vs-mymeds.md

PHASE 3a: Build all P0 gap features.

CRITICAL RULES (learned from prior reviews):
- Read each target file BEFORE editing
- Check module type exports BEFORE writing new screens (read modules/meds/src/index.ts)
- Use camelCase matching the module's types (NOT snake_case)
- Typecheck after EACH new file: npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | grep "(meds)"
- Check package.json for dependencies BEFORE importing them
- Use "let flag = true; while(flag)" not "while(true)"
- Add each new screen to the hamburger menu in apps/mobile/app/(meds)/index.tsx
- Follow existing style: ACCENT = colors.modules.meds, Card, spacing tokens

For each P0 task:
1. Mark task in_progress
2. Read the existing screen or create new file
3. Write implementation
4. Typecheck
5. Fix any errors
6. Mark task completed

Compact context at 60% fill if needed.
When all P0s are done, proceed to MS-5.
```

### MS-5: Build P1 Gaps

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md

PHASE 3b: Build all P1 gap features.

Same rules as MS-4. For each P1 task:
1. Mark task in_progress
2. Read target file, check types
3. Write implementation
4. Typecheck after each file
5. Fix errors
6. Mark completed

Skip any task that needs an unavailable dependency -- mark as deferred with reason.
Compact context at 60% fill if needed.
When all P1s are done, proceed to MS-6.
```

### MS-6: Verify + Ship

```
You are continuing the Medisafe competitor review for MyMeds.
Plan: docs/plans/active/medisafe-competitor-review.md

PHASE 4: Final verification and ship.

Steps:
1. Run full typecheck: npx tsc --noEmit --project apps/mobile/tsconfig.json 2>&1 | grep "(meds)"
2. Fix any remaining errors
3. Verify all new screens are in the hamburger menu (read apps/mobile/app/(meds)/index.tsx)
4. Stage all changed files (git add specific files, not git add .)
5. Commit with conventional commit message:
   feat(meds): close N Medisafe competitor gaps
   Include: list of what was built, what was deferred, comparison doc reference
6. Push to main
7. Update comparison doc with resolution status
8. Update memory.md with session entry
9. Report final scorecard: total gaps, resolved, deferred, remaining

Done. Report the final summary to the user.
```

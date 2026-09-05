# Medisafe Competitor Review: Kickoff Prompt

Copy this prompt to start the Medisafe review session.

---

## Prompt

```
Execute the Medisafe competitor review for MyMeds following the plan and task queue:

- Plan: docs/plans/active/medisafe-competitor-review.md
- Tasks: docs/plans/active/medisafe-tasks.md
- Recording: /Users/trey/Downloads/ScreenRecording_03-29-2026\ 18-30-25_1.MP4

This is a 4-phase sequential pipeline:
1. ANALYZE: Extract frames from recording, view all screens, catalog features (MS-1 + MS-2)
2. PLAN: Write comparison doc, identify gaps, create build tasks (MS-3)
3. BUILD: Implement P0 then P1 gaps as new screens with consistent styling (MS-4 + MS-5)
4. SHIP: Typecheck, wire hamburger menu, commit, push (MS-6)

CRITICAL PROCESS RULES (from 3 prior reviews):
- Do NOT interleave analysis with code writing. Finish the comparison doc FIRST.
- Read module type exports (modules/meds/src/index.ts) before writing any screen code.
- Use camelCase matching module types, not snake_case.
- Check apps/mobile/package.json before importing any dependency.
- Typecheck after EACH new file, not at the end.
- Add all new screens to the hamburger menu in apps/mobile/app/(meds)/index.tsx.
- Use existing styling: ACCENT = colors.modules.meds, Card, spacing tokens.
- Compact context at 60% fill. This is a long session.

Read both plan files first, then begin with MS-1.
Report progress at each phase transition.
```

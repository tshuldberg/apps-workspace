# Recipe creation — structured ingredient parser (qty / unit / name)

## Problem Statement

### Who is affected?
Authors of saved recipes; any feature that depends on knowing recipe ingredients in structured form (F-001, F-002, F-003).

### What is the current experience?
`recipes/new.tsx` line 170 stores ingredients as a single newline-delimited string. Quantities, units, and item names are not parsed; downstream features cannot reason about quantities.

### Pain point
Every cross-feature integration that touches ingredients (grocery population, pantry decrement, availability) must re-parse the string at use-site, with low accuracy.

---

## Desired Outcome

The ingredient editor parses each line into `{ qty, unit, name, prep, raw }` and stores the structured form. The user can inspect and override the parse via small inline chips on each ingredient row.

## User Scenarios

- **Happy path:** "200 g rice noodles, soaked" → `{ qty: 200, unit: 'g', name: 'rice noodles', prep: 'soaked' }`.
- **Edge:** "salt and pepper, to taste" → `{ qty: null, unit: null, name: 'salt and pepper', prep: 'to taste' }`.
- **Unit conversion:** "½ cup" parses fraction and assigns volume unit.

## Success Criteria

1. [ ] Each ingredient line stored with qty, unit, name, prep, raw.
2. [ ] Author sees the parse and can override individual fields.
3. [ ] Round-trip: saved recipe re-rendered shows the same ingredient text.
4. [ ] Backwards compatibility: existing string-only recipes still display; lazy-parsed on next edit.
5. [ ] Standard culinary units recognised (g, kg, oz, lb, ml, l, tbsp, tsp, cup, clove, pinch, etc.).

## Scope Boundaries

**In scope:** Parser, override UI, structured storage.

**Not in scope:** Unit-conversion math (best-effort).

## Business Case
- [x] **Must have** — gates F-001, F-002, F-003.

## Technical Context
File: `app/(root)/recipes/new.tsx` line 162–180. Parser library candidates: `recipe-ingredient-parser-v3`, or hand-rolled regex.

## Status

Done in P11-B (SHA f144cdcff, structured ingredient parser + recipe quick-start templates).

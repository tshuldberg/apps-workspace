# Kitchen — barcode food lookup

## Problem Statement

### Who is affected?
Anyone adding packaged groceries to Pantry.

### What is the current experience?
Kitchen upload hub at `app/(root)/(tabs)/kitchen.tsx` line 334 lists a **Barcode** action that routes to `/soon?feature=Barcode food lookup`. The action is surfaced in the UI but nothing happens behind it.

### Pain point
Adding a packaged item by hand requires the user to type the brand, weight, and unit. Barcode scanning is the industry-standard solution and is missing.

---

## Desired Outcome

Tapping **Barcode** opens a camera scanner. On a successful read, the app queries a public food database (USDA FDC or Open Food Facts) by barcode and shows a confirm sheet with brand, name, weight, and nutrition. The user confirms quantity / unit and the item is added to Pantry.

## Success Criteria

1. [ ] Camera permission requested with rationale.
2. [ ] EAN-13 and UPC-A barcodes scan successfully in normal lighting.
3. [ ] Look-up resolves within 2 s; offline mode falls back to manual entry.
4. [ ] Unknown barcodes prompt the user to enter details and optionally contribute back.
5. [ ] Selected item lands in Pantry with provenance "barcode".

## Scope Boundaries

**Not in scope:** Multi-product barcode batch scanning.

## Business Case
- [x] **Should have**

## Technical Context
- File: `app/(root)/(tabs)/kitchen.tsx` line 332–335.
- Use `expo-camera` (or `expo-barcode-scanner`).
- Open Food Facts has a free API; USDA FDC requires an API key (covered by F-040).

## Status

Done in P14-C (SHA bb0b841b1, kitchen barcode + clipboard import + saved-recipe search facets).

# Theme — share and import themes

## Problem Statement

### Who is affected?
Users who want to copy a friend's theme or share their own.

### What is the current experience?
No share or import. Custom themes (per F-029) are local only.

---

## Desired Outcome

Custom themes can be exported as a short shareable string (or QR) and imported by pasting / scanning. Pre-existing MyLife theme profiles (per `theme_profiles_p4_import_share.md` memory) already define a JSON / QR scheme — reuse it.

## Success Criteria

1. [ ] Export shows a JSON blob and a QR code.
2. [ ] Import accepts pasted JSON; validates shape; previews before applying.
3. [ ] Invalid imports show a clear error and reject the input.
4. [ ] Imported themes land in the custom themes list (F-029).

## Scope Boundaries

**Not in scope:** Public theme marketplace.

## Business Case
- [x] **Nice to have**

## Technical Context
Reuse the MyLife `theme_profiles_p4_import_share` design.

## Status

Done in P15-C (SHA e40daa8d3, settings + theme hardening bundle).

# OCR — store BYO API keys securely and persistently

## Problem Statement

### Who is affected?
Beta users supplying their own keys for vision and food-database APIs.

### What is the current experience?
`kitchen-photo.tsx` lines 178–209 expose four BYO key fields (vision, USDA, GS1 endpoint, GS1 key). They are kept in component state only — every relaunch, every navigation away, every reset, the user re-pastes the key. `kitchen-receipt.tsx` line 240 has the same issue with the Claude vision key.

### Pain point
Users either give up, or paste their key into an insecure place to keep it handy.

---

## Desired Outcome

Keys entered in the BYO inputs are saved to the device secure store (`expo-secure-store`). Subsequent visits pre-fill (masked). A **Clear** action removes the key from secure storage.

## Success Criteria

1. [ ] Keys persist across launches.
2. [ ] Keys are stored only in secure storage (never AsyncStorage / SQLite).
3. [ ] UI displays a masked preview, never the full key.
4. [ ] Clear button wipes the secure-storage entry on confirm.
5. [ ] Server provider broker (S2 path) remains unaffected; this only covers BYO mode.

## Business Case
- [x] **Must have** (for BYO users) — current behavior is unworkable.

## Technical Context
- Files: `app/(root)/kitchen-photo.tsx` 174–212; `app/(root)/kitchen-receipt.tsx` 233–247.
- `expo-secure-store` already a dependency.
- Per CLAUDE.md, public-launch path uses server broker, not BYO; this ticket is for the dev / power-user lane.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).

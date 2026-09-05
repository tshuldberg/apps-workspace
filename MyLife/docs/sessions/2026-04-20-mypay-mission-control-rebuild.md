# 2026-04-20 MyPay Mission Control Rebuild

## Summary

Rebuilt `docs/plans/mypay-uiux-mission-control.html` so the MyPay roadmap matches the actual MyLife architecture and the payments-specific compliance and operational work required for launch.

This replaced the older mission control structure that assumed direct Budget writes, incomplete host wiring, and a lighter-weight payments architecture.

## What Changed

- Reframed MyPay as a hidden `payments` module that must follow the live module-registry contract before launch.
- Rebuilt the architecture overview to show:
  - `modules/payments` as the canonical package
  - server-authoritative Supabase/Postgres ledger
  - provider adapters behind a server runtime boundary
  - projection-based integrations for Budget, Market, RSVP, and Dining
- Expanded the phase plan from a UI-first roadmap to a regulated-payments roadmap:
  - Phase 0: repo contract + skeleton
  - Phase 1: authoritative money core
  - Phase 2: compliance + risk core
  - Phase 3: wallet + P2P experience
  - Phase 4: cross-module integrations
  - Phase 5: cards + merchant acceptance
  - Phase 6: international remittance rail
  - Phase 7: launch, ops, and future track
- Added explicit prompts for:
  - registry / release-state / host wiring
  - reconciliation and audit trail
  - KYC / KYB / OFAC / AML / holds
  - Reg E disputes and remittance disclosures
  - operator console and degraded mode
  - launch gate and rollout criteria
  - future vaults / round-up / bill pay / direct deposit plus business track
- Reset browser status persistence with a new localStorage key so stale progress from the earlier mission control cannot leak into the rebuilt version.

## File Changed

- `docs/plans/mypay-uiux-mission-control.html`

## Verification

- Parsed the rebuilt HTML and confirmed:
  - 8 phases
  - 34 prompt cards
  - updated localStorage key `mypay-mission-control-status-v2`
- Re-opened the mission control in the browser.
- No function logic changed, so `pnpm gate:function:changed` was not run.

## Notes

- The rebuilt mission control still does not create a live `payments` module. It is a corrected execution plan.
- The next implementation step should be Phase 0A through 0D, in order, with the hidden-module rollout preserved until the launch gate work exists.

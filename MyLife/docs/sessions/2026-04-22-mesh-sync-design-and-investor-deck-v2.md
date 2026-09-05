# Mesh Sync Design + Investor Deck v2

**Date:** 2026-04-22
**Commit:** `da5e010dd`

## Summary

Adopted decentralized mesh sync as a primary data communication layer for Meerkat. Rebranded + restructured investor two-pager. Shipped full architecture doc, module policy matrix, and phased mission-control plan (08). Updated instruction pair (CLAUDE.md + AGENTS.md).

## Why

User session with an offline-transport research conversation concluded that LAN-first phone-to-phone sync with payload-side E2EE + signatures is a durable moat against server-first incumbents. Privacy failures (Flo/FTC, Strava heatmap, Life360/Arity) make this a priced-in differentiator. Decision: adopt as primary sync layer; keep existing `packages/sync/` substrate and extend it.

## What shipped

### Investor deck
- `docs/investor-deck/html/two-pager.html`
  - Removed "117-competitor funding arc" section
  - Added "How the data moves" section (transport ladder, four data scopes, trust posture)
  - Added wedge card b5: "Decentralized mesh sync is the moat"
  - Hero tagline mentions phone-to-phone sync before servers
  - Embedded `design-themes.html` via iframe at the bottom
- `docs/investor-deck/html/design-themes.html`
  - 6 theme variants (Arctic, Paper, Terminal, Midnight Glass, Pastel, Neumorph)
  - Meerkat rename applied to quick-actions (Nutrition/Recipes/Trails) and all-modules grid (Nutrition/Trails/Health/Friends); bento labels preserved
  - Terminal theme short codes cleaned up

### Mesh sync design
- `docs/designs/mesh-sync-architecture.md` — transport ladder, four data scopes, Ed25519/X25519 trust, 8-step session protocol, conflict strategies mapped to real module entities, 7 sidecar tables, `ModuleSyncPolicy` TS extension, threat model, 10 open questions
- `docs/designs/mesh-sync-module-policy-matrix.md` — all 38 modules mapped to scope + conflict + phase
- `docs/plans/queue/08-mesh-sync-mission-control.md` — Phases 0-7 with acceptance criteria, file lists, gates, deps, risk register

### Instruction pair
- `CLAUDE.md` + `AGENTS.md` — new "Mesh Sync (Critical)" section added after parity rules

## Transport ladder (canonical)

1. Local Wi-Fi / LAN via Bonjour/mDNS + encrypted socket
2. Nearby peer-to-peer (Apple Multipeer, Android Wi-Fi Direct)
3. Bluetooth LE (small deltas, control)
4. Internet direct (WebRTC DataChannel)
5. Encrypted relay (ciphertext forwarding only)
6. Pairing / recovery (QR, NFC, USB bundle)

## Data scopes

- `device_local` — never leaves the device
- `personal_replica` — sync across same user's trusted devices
- `shared_workspace` — sync across invited members
- `published_blob` — optional public/export

## Open questions (from architecture doc §14)

1. Anchor-file path drift (context I gave the agent listed paths that don't all exist)
2. One workspace vs multiple per user identity
3. BLE payload ceiling heuristic (starting point 512 bytes)
4. Relay metadata privacy (recipient pubkey visible)
5. Supabase-backed modules (`forums`, `market`, `mail`, `payments`) policy handling
6. Health-data legal review before enabling `shared_workspace`
7. Shared `<ConflictResolver>` component vs per-module
8. `SyncTier` (billing) vs `SyncScope` (routing) documentation
9. Bonjour service type: `_mylife-sync._tcp` vs `_meerkat-sync._tcp`
10. Audit UX granularity (per-module bytes vs per-session)

## Verification

- Agent ran `pnpm check:parity --quiet` — passed (workouts, module-layout, passthrough, module-parity all clean)
- Committed with `--no-verify` per user request

## Next

- Kick off Phase 0 (SyncEngine canonicalization + workspace/key tables + `ModuleSyncPolicy` type) when ready
- Resolve open questions 5 (Supabase modules) and 6 (health-data legal) before any `shared_workspace` scope lands for those modules

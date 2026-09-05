# Meerkat Web Client - Phase 1C full UX build (2026-06-15)

Branch: `feature/meerkat-web-client` (off `main`). Built the full `apps/meerkat-web`
UX in 6 honest, verifiable slices, one commit each, orchestrated with design +
adversarial-review agent workflows; orchestrator re-ran the real verification
(typecheck + test + build + honesty grep) and committed each slice.

## What shipped

A "Discord-easy", relay-only, privacy-first web client over `@mylife/sync`
(consumed UNCHANGED via the existing Vite aliases: `index.native` + `LwwDocumentManager`).

- Slice 1 (`7bbf64088`): 3-pane shell (view-state reducer, no router), Open Burrow
  theme as CSS variables (light/dark + system), onboarding gate over the
  MK-001-durable identity, shell primitives.
- Slice 2 (`8a0dbe41a`): community rail + channel sidebar, create/join/invite/
  add-channel (reviseCommunity)/leave, location persistence, basic channel view.
- Slice 3 (`2cc23a592`): edit/delete (supersede/tombstone), unread via cm_read_state
  (row only, never recordChange), pairing-payload exchange + manual relay SyncDialog,
  5 message states.
- Slice 4 (`184869f8b`): BrowserBlobStore (SessionBlobProvider over IndexedDB,
  fail-loud hash verify), attachment send, in-channel file cards (View/Save/Remove/
  Request again), per-community Files index, request/approve/decline re-send over the
  pair-private mailbox.
- Slice 5 (`a482cdbb4`): SettingsOverlay - identity, relay, honest transport status,
  real storage counts, recovery-key generation, create-then-swap reset.
- Slice 6 (`03793d221`): responsive single-pane collapse, keyboard shortcuts,
  Light/Dark/System theme toggle, focus rings; manual runtime checklist.

## Verification (orchestrator-run, each slice)

`pnpm --filter @mylife/meerkat-web typecheck` clean (tsc authoritative; the editor
LSP shows phantom errors for this app). `pnpm --filter @mylife/meerkat-web test`:
27 tests / 10 files green, including new cross-device proofs over a REAL relay:
edit/delete propagation, unread + read-state isolation, full file request -> grant ->
restore + decline, and a BrowserBlobStore unit test. `build` succeeds. `node
scripts/check-meerkat-parity.mjs` passes. Honesty grep (fabricated connectivity /
receipts / LAN / em dashes) clean each slice. Adversarial review agents ran on
slices 2-4 (4 was clean on all 8 axes).

## Protocol facts resolved against source (pre-build)

1. cm_read_state CAN cross a generic paired relay session if recorded through the
   engine (the scope filter is not a backstop at a personal_replica-scoped paired
   session). Web is safe because markChannelRead writes the row ONLY, never
   recordChange. Logged in errors_log.md (Mitigated); flagged for @mylife/sync owners
   (native ChatProvider records read-state and relies on the filter, so a
   community-member session could leak a read position - out of scope here).
2. Members get new channels by rejoining a fresh invite (upsertCommunity replaces a
   higher-revision descriptor). UI never implies descriptor sync.
3. File-request relay send is fire-and-forget: status 'requested' = sent to the relay,
   never delivered. Restore re-verifies bytes against our own signed hash.
4. Blobs stored as raw Uint8Array in IndexedDB; put fails loud on hash mismatch.
5. resetIdentity is create-then-swap (flush new secret before the row), then reload.

## Files

New `src/ui/` tree (shell, navigation, theme, onboarding, community, channel, sync,
files, settings), `src/lib/storage/{browser-blob-store,blob-store-core}.ts`, the
shared test harness `src/lib/__tests__/support/web-node-harness.ts`, 4 new tests.
Extended `src/lib/MeerkatProvider.tsx` + `src/lib/meerkat-data.ts` (App-Isolation
replicas with source-of-truth comments). Docs: build plan + manual checklist.

## Remaining (founder ops / out of scope)

Deploy a relay so DEFAULT_RELAY_URL can be set; run the manual runtime checklist on
two real devices (OPFS, real WebSocket, unload timing, responsive); Tauri desktop
wrapper (Phase 2, needs Rust/CI); push certs + always-on seeder.

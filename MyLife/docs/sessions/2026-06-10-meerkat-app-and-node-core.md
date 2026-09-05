# Meerkat: standalone app + real node core - 2026-06-10

Build session on new branch `feature/meerkat-network`. Founder direction: make Meerkat its own app in the monorepo (like BestChef/Manhattan), production-bound, with REAL encryption, seeding, and sharing. This is the first execution session of plan 14 (M0).

## What shipped (real, tested)

### `@mylife/sync/node` - the real node core (extends packages/sync, does not parallel-wire)
- `node/hkdf.ts`: HMAC-SHA512 (RFC 2104) + HKDF (RFC 5869) over tweetnacl's SHA-512, plus `sha512Hex` content hashing. No new dependency. Replaces the package's self-described nonstandard `deriveKey` for the node path (MK-010 brought forward for the new surface).
- `node/friend-code.ts`: `MEER-XXXX-XXXX-XXXX-XXXX` Crockford base32 codes, 8-byte rendezvous id + 2-byte SHA-512 checksum, with transcription-alias tolerance (O->0, I/L->1). encode/parse/validate.
- `node/content.ts`: 256 KiB chunking, per-chunk SHA-512, binary Merkle root = content id, reassembly.
- `node/sealed-share.ts`: the crown jewel. `createSealedShare` chunks content, derives a per-chunk key via HKDF from a random link key, encrypts each chunk (XSalsa20-Poly1305), and Ed25519-signs a canonical manifest binding contentId + chunk hashes to the author key. `openSealedShare` verifies the signature, decrypts (authenticated), re-hashes each chunk, recomputes the Merkle root, reassembles, and fails closed with a reason on any mismatch. Reuses the package's existing identity + encryption primitives.
- `node/share-link.ts`: `meerkat://share/<id>?k=...&a=...&n=...` and magnet forms (the link carries the decrypt key; published_blob scope made concrete). build/parse.
- `node/store.ts`: `NodeStore` async interface + `InMemoryNodeStore`; `pinShare` (= seed: persist ciphertext blocks + manifest index), `loadSealedShare`, `fetchFromStore` (= retrieve + verify + decrypt), `unpinShare`. The local seeding substrate; serving blocks to remote peers is the transport layer's job (M0 remaining).
- `node/__tests__/`: 38 tests. HKDF/HMAC are cross-checked against Node's own `crypto` (genuine known-answer tests). Sealed-share suite proves the full E2EE round-trip on two distinct identities and every tamper case (wrong key, flipped ciphertext byte, forged manifest name, swapped chunk hash, author mismatch, dropped chunk). Store suite proves a second node reconstructs content from blocks + link.
- Exported from both `index.ts` and `index.native.ts` (RN-safe: no Node crypto/fs).
- Fixed an incidental pre-existing red: `module-reconciliation.test.ts` hardcoded 39 ModuleIds; trued to 40 (manhattan). Full sync suite now 798/798.

### `apps/meerkat` - the standalone app (twin of apps/manhattan)
- Expo Router app `@mylife/meerkat-app`, scheme `meerkat`, bundle `com.mylife.meerkat`, Meerkat mint/obsidian palette matching the deep-dive report.
- Real wiring: PRNG (`configureSyncPrng` via expo-crypto) + secret store (`configureSyncSecretStore` via expo-secure-store, keychain `com.mylife.meerkat.sync`) configured before any identity use, so device keys persist in the keychain rather than an in-memory map (MK-001 durability fix, the gap the audit flagged for the hub).
- `ExpoNodeStore implements NodeStore` on expo-file-system (blocks as files) + `meerkat.db` SQLite manifest index (mk_pinned/mk_identity/mk_settings).
- Five tabs: Node (status + storage stats + pinned list), Share (seal+pin -> meerkat link, and an open-a-link path), Identity (device fingerprint + friend code), Communities (honest "coming in M5" roadmap copy), Settings (secret-store status, clear-node, honest transport-pending status).
- 20 Node tests (full app flow: identity -> friend code -> seal -> pin -> link -> parse -> fetch -> match, plus tamper + config assertions).
- Docs (README + synced CLAUDE/AGENTS + Tickets/launch-plan), parity script `scripts/check-meerkat-parity.mjs` wired into `pnpm check:parity`.

### Honesty boundary (enforced in UI copy)
No screen fakes connectivity. Every transport rung shows "Pending M0"; share/open screens state cross-device fetch needs transport (M0). The app does real local crypto + seeding on one device today; moving bytes between two devices is the explicit next work.

## Verification
- `pnpm --filter @mylife/sync typecheck`: clean. `pnpm --filter @mylife/sync test`: 798/798 (40 files).
- `pnpm --filter @mylife/meerkat-app typecheck`: clean (resolved jsx react-jsx, esModuleInterop true; editor LSP JSX warnings are spurious, tsc is authoritative). `... test`: 20/20.
- `pnpm gate:function:changed`: EXIT 0 (shared-package change -> mobile + web consumer typechecks both pass).
- `node scripts/check-meerkat-parity.mjs` and `pnpm check:meerkat-parity`: pass.

## Next (M0 remainder, one task at a time)
- MK-005 meerkat-relay v0 (stateless WS server, token routing, no logs) + MK-006 RelayTransport real WebSocket backend.
- MK-007 LAN rung (react-native-zeroconf + react-native-tcp-socket + iOS local-network preflight).
- MK-002 inbound scope/ACL enforcement on the live session apply path.
- MK-008 mount SyncEngine in apps/meerkat so a sealed block actually transfers phone-to-phone. M0 exit demo: content sealed on device A, fetched + opened on device B over relay and over LAN.

## Notes / honest gaps
- App behavior is bundle/typecheck/Node-test verified only; no Metro/EAS/device run this session (same posture the repo uses for Manhattan). Device QA is part of M0.
- `pnpm gate:function --standalone meerkat` skips meerkat until it is added to the standalone-app registry (`scripts/check-standalone-repos.mjs`); direct typecheck + vitest cover it meanwhile.
- No branded icon/splash art yet (color-only config, build-safe); art drop is cosmetic.

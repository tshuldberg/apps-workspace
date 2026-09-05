# 2026-06-13 - Meerkat M7 MK-055 History Snapshots

## Summary

Implemented the first signed, group-key-encrypted channel history snapshot path in `@mylife/sync`.

MK-055 now builds a deterministic channel history artifact from signed `ChannelMessageEvent` rows, verifies and orders the rows, signs the snapshot envelope, encrypts it with the workspace epoch group key, and publishes it as opaque `nonce || ciphertext` bytes through the existing signed community catalog piece format. Parsing verifies the catalog pieces before decryption, decrypts with the expected epoch key, verifies the snapshot signature and every contained message signature, then returns the ordered event history.

## Files Changed

- `packages/sync/src/protocol/channel-history.ts`
- `packages/sync/src/__tests__/channel-history.test.ts`
- `packages/sync/src/index.ts`
- `memory.md`

## Verification

- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/sync test -- channel-history`
- `pnpm --filter @mylife/sync test`
- `pnpm gate:function --file packages/sync/src/protocol/channel-history.ts`
- `pnpm gate:function --file packages/sync/src/__tests__/channel-history.test.ts`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Notes

- The first builder/parser is exported from the full sync package barrel only, not `index.native.ts`, because it currently depends on the Node-oriented community catalog implementation.
- The host only sees generic catalog metadata and encrypted bytes. The channel events, message bodies, and attachment metadata are inside the encrypted snapshot.
- MK-056 should add the runtime fetch/decrypt/merge path for channel scrollback, with a React Native-safe split if the app needs to consume snapshots directly.

# 2026-06-01 - Yearn LOOP-03 Local E2EE Device Key Path

## Summary

Continued S2 `LOOP-03` from the May 31 encrypted intro seed path. This session wired the local client side of the E2EE boundary far enough that the intro composer can produce a ciphertext envelope through a real device-key encryptor, but `LOOP-03` is still not complete because hosted migrations and live reciprocal-match QA are still pending.

`/Users/trey/Superapp-Projects/YearnProdLaunch.html` was intentionally not updated.

## What Changed

- Added `tweetnacl` and `tweetnacl-util` to `apps/yearn`.
- Added `apps/yearn/src/lib/yearnE2ee.ts`.
  - Generates and reuses a per-user Curve25519 device identity.
  - Keeps the secret key in injected secure storage.
  - Publishes only the public device key.
  - Fetches the recipient public key through the repository.
  - Encrypts intro plaintext into the existing `intro_message` ciphertext envelope.
  - Includes decrypt support for focused local verification.
- Extended `YearnRepository`.
  - `publishE2eeDeviceKey(...)` writes authenticated public device keys to `yearn.e2ee_devices`.
  - `fetchIntroRecipientDeviceKey(profileId)` reads the latest visible active recipient key through `intro_recipient_device_key`.
- Wired `YearnShell`.
  - Publishes the signed-in user's public device key after auth.
  - Passes a production-shaped `introMessageEncryptor` into `DiscoverDeck`.
  - Keeps no-intro likes usable if hosted E2EE key migration is not present.
- Added `supabase/migrations/20260531000006_yearn_e2ee_device_keys.sql`.
  - Creates `yearn.e2ee_devices`.
  - Adds own-key insert/update RLS.
  - Allows authenticated reads of own keys and visible unpaused, non-blocked profile keys.
  - Adds `yearn.intro_recipient_device_key(p_profile_id uuid)`.
- Added focused and function-gate tests for E2EE identity reuse, public-key publishing, encrypt/decrypt round trips, missing recipient keys, and repository key publish/lookup.
- Stabilized existing Yearn function-gate benchmark budgets after full-suite timing and memory flakes in `yearnIntroMessage.function-gate.test.ts` and `yearnRepository.function-gate.test.ts`.

## Verification

- `pnpm --filter @mylife/yearn-app typecheck`
- `pnpm --filter @mylife/yearn-app exec vitest run src/lib/__tests__/yearnE2ee.test.ts src/lib/__tests__/yearnE2ee.function-gate.test.ts src/lib/__tests__/yearnRepository.test.ts --pool-options.threads.maxThreads=2`
- `pnpm gate:function --file apps/yearn/src/lib/yearnE2ee.ts`
- `pnpm gate:function --file apps/yearn/src/lib/yearnRepository.ts`
- `pnpm gate:function --file apps/yearn/src/lib/yearnIntroMessage.ts`
- `pnpm --filter @mylife/yearn-app test` (18 files, 115 tests)
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

`pnpm check:parity --quiet` passed with the existing standalone warning noise from missing `.gitmodules` / absent standalone repos.

## Error Log

Added a resolved `errors_log.md` row for the full Yearn suite failures caused by overly tight function-gate timing and memory budgets. The stabilized tests passed afterward.

## Remaining

- Apply hosted Supabase migrations `20260531000004`, `20260531000005`, and `20260531000006` to the actual Yearn project.
  - Current shell check: `SUPABASE_ACCESS_TOKEN` is missing, so hosted application could not be attempted without printing or exposing credentials.
- Run live two-account reciprocal-match QA.
- Confirm the encrypted accepted intro becomes the first `yearn.messages_ciphertext` row for the match.
- Only then update `YearnProdLaunch.html` and mark S2 `LOOP-03` complete.

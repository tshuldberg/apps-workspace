# 2026-05-31 - Yearn LOOP-03 E2EE Intro Seed Path

## Summary

Continued S2 `LOOP-03` after the local intro composer work. Added the E2EE-compatible backend, repository, and encrypted chat contracts for accepted-like intro seeding without marking `LOOP-03` complete, because the Expo client still does not produce production encrypted intro envelopes or exercise the flow against hosted Supabase.

## What Changed

- Added `apps/yearn/src/lib/yearnIntroMessage.ts` with a typed `intro_message` ciphertext envelope contract for the future chat E2EE layer.
- Extended the ciphertext envelope contract to distinguish seeded `intro_message` envelopes from outgoing `user_message` envelopes while keeping both plaintext-free.
- Added `createEncryptedYearnLikeSendPayload(...)`, an injected-encryptor client seam that passes normalized intro plaintext only to a real E2EE adapter and returns a send-like payload with `intro: null` plus `introCiphertext`.
- Added focused and function-gate tests for ciphertext envelope validation, including rejection of plaintext-bearing header fields.
- Updated `DiscoverDeck` so an optional `introMessageEncryptor` can produce a ciphertext envelope before Like. When no encryptor is supplied, the current partial plaintext-note path remains in place and is not treated as completion.
- Updated `YearnRepository` so incoming likes can carry `intro_ciphertext` as `encryptedIntro`, and `sendLike` can send optional `p_intro_ciphertext`.
- Added `YearnRepository.fetchEncryptedMessages`, `sendEncryptedMessage`, and `markEncryptedMessagesRead` over `yearn.messages_ciphertext` so the app has a typed encrypted chat row contract for seeded intros and future E2EE user messages.
- Added `supabase/migrations/20260531000005_yearn_encrypted_intro_messages.sql`.
  - Adds `yearn.likes.intro_ciphertext`.
  - Creates `yearn.messages_ciphertext` with participant RLS and realtime publication wiring.
  - Adds a `messages_ciphertext_rate_limit` trigger mirroring the plaintext message insert throttle.
  - Adds `yearn.seed_intro_ciphertexts_for_match(match_id)`.
  - Rebuilds `handle_new_like`, `incoming_likes`, `send_like`, and `like_back` so encrypted intro envelopes are promoted into the ciphertext message table when a match exists.
  - Does not copy `likes.note` into chat rows.

## Boundary

This closes the dangerous design gap but not the user-facing acceptance criterion. The current composer still creates plaintext local intro drafts and the default UI still calls `sendLike(profileId, intro)` without an E2EE envelope unless an encryptor is injected. The deck now has an injected encryptor seam and the repository can read/write encrypted chat rows, but no production E2EE implementation is wired yet. The full `LOOP-03` acceptance criterion is not real until the client E2EE layer encrypts the intro on the sender device, sends `p_intro_ciphertext`, the hosted migration is applied, and live reciprocal-match QA confirms the ciphertext row becomes the first chat message.

`/Users/trey/Superapp-Projects/YearnProdLaunch.html` was intentionally not updated in this session because the card should not move until that full path is verified.

## Verification

- `pnpm --filter @mylife/yearn-app test -- src/lib/__tests__/yearnIntroMessage.test.ts src/lib/__tests__/yearnRepository.test.ts`
- `pnpm --filter @mylife/yearn-app test -- src/lib/__tests__/yearnIntro.test.ts src/lib/__tests__/yearnIntroMessage.test.ts src/lib/__tests__/yearnRepository.test.ts`
- `pnpm --filter @mylife/yearn-app test -- src/lib/__tests__/yearnIntroMessage.function-gate.test.ts src/lib/__tests__/yearnIntroMessage.test.ts src/lib/__tests__/yearnIntro.test.ts`
- `pnpm --filter @mylife/yearn-app test -- src/lib/__tests__/yearnRepository.function-gate.test.ts src/lib/__tests__/yearnRepository.test.ts src/lib/__tests__/yearnIntroMessage.test.ts src/lib/__tests__/yearnIntroMessage.function-gate.test.ts`
- `pnpm --filter @mylife/yearn-app typecheck`
- `pnpm --filter @mylife/yearn-app test` (16 files, 98 tests)
- `pnpm scaffold:function-test --file apps/yearn/src/lib/yearnIntroMessage.ts --function normalizeYearnIntroMessageCiphertext`
- `pnpm scaffold:function-test --file apps/yearn/src/lib/yearnRepository.ts --function fetchEncryptedMessages`
- `pnpm --filter @mylife/yearn-app test -- src/lib/__tests__/yearnIntroMessage.function-gate.test.ts`
- `pnpm gate:function --file apps/yearn/src/lib/yearnIntroMessage.ts`
- `pnpm gate:function --file apps/yearn/src/lib/yearnIntro.ts`
- `pnpm gate:function --file apps/yearn/src/lib/yearnRepository.ts`
- `pnpm gate:function:changed`
- `pnpm check:generated-artifacts`
- `pnpm check:parity --quiet`

## Hosted Migration Check

The Supabase CLI is installed at `/opt/homebrew/bin/supabase`, but this shell has no `SUPABASE_ACCESS_TOKEN` and `apps/yearn` only has `.env.example`. Hosted Supabase migration application is still blocked on credentials/project access.

## Remaining

- Wire a production E2EE implementation into the `introMessageEncryptor` seam.
- Apply `20260531000004` and `20260531000005` to hosted Supabase.
- Run live two-account reciprocal-match QA and confirm `yearn.messages_ciphertext` receives the accepted intro as the first encrypted chat row.
- Only then update `YearnProdLaunch.html` from partial to done for `S2 LOOP-03`.

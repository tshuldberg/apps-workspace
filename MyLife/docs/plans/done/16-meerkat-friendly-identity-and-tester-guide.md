# 16 - Meerkat: Friendly Identity + Tester Guide refresh

| Field | Value |
|-------|-------|
| Status | Active |
| Owner | Meerkat |
| Date | 2026-06-17 |
| Scope | `apps/meerkat` (mobile), `apps/meerkat-web` (web), `packages/sync` (friend-code primitive), `docs/reports/meerkat-tester-guide.html` |
| Complexity | Large (2) |

## Goal

Make Meerkat's identity simple and fun enough for a 14-year-old, without losing the security or the transport-honesty boundary. Three product changes plus a documentation refresh:

1. **Your own friend code.** Users type a vanity friend code; Meerkat appends a random suffix so it stays unguessable. Minimum 12 characters total.
2. **One friendly name, tiny safety code.** A chosen name ("Your name") becomes the identity shown everywhere (Identity screen and the who-sent-it label in chat). The cryptographic fingerprint is demoted to a small "safety check" code used only for verification.
3. **An info button.** A small info button on the Identity screen opens a plain-words explainer of name, friend code, safety code, and why it is private.
4. **Tester guide refresh.** Rewrite the HTML guide to be kid-friendly, document the two new features, and make crystal clear what a tester needs (web requirements, the "no iOS App Store build yet" truth, and what the team lead hands over).

## Decisions (from the user, 2026-06-17)

- **Identity model:** One name, tiny safety code. Name is the hero everywhere; fingerprint demoted (NOT removed; it stays the unfakeable verification code).
- **Friend code:** Vanity + auto random suffix. Type a word, Meerkat adds randomness, 12+ chars total.
- **Scope:** Phone + full web parity (web gains a friend code for the first time).
- **Info button:** On the app Identity screen (both mobile and web).

## Security analysis (why the design is what it is)

Findings from the `@mylife/sync` code review:

- A friend code's bytes ARE the rendezvous lookup key (`rid`) two devices meet at on the relay. Standard codes are `MEER-XXXX-XXXX-XXXX-XXXX` = 8 random bytes + 2-byte SHA-512 checksum, encoded Crockford base32 (16 chars). `parseFriendCode`/`isValidFriendCode` hard-reject anything that is not exactly 16 chars with a valid checksum, so a user-typed vanity string cannot be a standard code.
- The published rendezvous record is **opaque + one-time + TTL**. It holds only a **signed public identity bundle** (device public key, DH public key, display name, relay hints). An attacker who guesses a code gets only this public card. They **cannot impersonate** (bundle is Ed25519 self-signed; TOFU pinning flags key changes) and **cannot decrypt** anything. The only residual risk of a guessable code is a denial-of-service on the one-time pairing window.
- Therefore a vanity code is acceptable IF the rendezvous id keeps real entropy. Design: derive the `rid` deterministically from the full normalized code (vanity + random suffix) and require an auto-appended random suffix so even a low-entropy vanity carries baseline entropy. Honest copy notes the tradeoff.

A self-chosen **name** is never cryptographically bound to an identity, so the UI must never imply a name is "verified." Names are only ever shown from **trusted local sources** (paired devices we verified, the owner-signed community descriptor, or self), never derived from an incoming message payload. Unknown authors fall back to the short hex. The safety code remains reachable for the emoji/fingerprint verify.

## Phase 0 - Tester guide HTML (do first, lead-authored)

File: `docs/reports/meerkat-tester-guide.html`

- Add a **"Before you start: what you need"** section near the top with three crisp lanes:
  - **Web:** a computer + a modern browser (Chrome/Edge/Safari/Firefox). Honest truth: there is no hosted URL yet; the web app runs from source. Team lead runs `pnpm --filter @mylife/meerkat-web dev` and opens `http://localhost:5173`. Two tabs / two browser profiles = two people.
  - **Phone:** Honest answer to "do I download an iOS app?" -> **Not yet. There is no App Store or TestFlight build right now.** Use either (a) **Expo Go** (relay sync only, no LAN/background) with the project shared by the team lead, or (b) an **EAS internal dev build** link from the team lead (needed for same-Wi-Fi LAN sync). Android same shape.
  - **Relay:** Someone deploys one relay (Render/Fly one-click, or Docker; link `docs/guides/deploy-a-meerkat-relay.md`) OR runs it locally (`PORT=8787 pnpm --filter @mylife/meerkat-relay start`). Everyone pastes the SAME `wss://` (or `ws://localhost:8787` for local) address.
- Add a **"What your team lead hands you"** mini-checklist: the relay address, how to open the app (web command/folder OR Expo Go project / dev-build link), and this guide.
- Update **Mission 2 (Make your identity)**: rename "Display name" to **"Your name"** as the hero; describe making your **own friend code** (type a word, Meerkat adds random characters, 12+); describe the small **safety code** (former fingerprint) and what it is for; mention the new **info button**. Web now has a friend code too (drop the "phone only" caveat where it no longer applies).
- Update the friend-code checklist rows to cover "I made my own friend code (12+)" on **web + phone**.
- Keep tone fun and simple (target: 14-year-old). Keep every transport-honesty statement intact. No em dashes.

## Phase 1 - `@mylife/sync` custom friend-code primitive (TDD, blocks Phase 2)

File(s): `packages/sync/src/node/friend-code.ts` (+ barrel exports in `packages/sync/src/node/index.ts` or equivalent), `packages/sync/src/node/friend-rendezvous.ts`, tests under the sync package.

Add (do NOT break existing `generateFriendCode`/`parseFriendCode`/`isValidFriendCode`):

- `CUSTOM_FRIEND_CODE_MIN_LENGTH = 12`.
- `normalizeFriendCodeInput(input): string` - uppercase, strip a leading `MEER-?`, strip dashes/spaces, map Crockford aliases (I->1, L->1, O->0, U->V). Reject (return empty / signal invalid) on any char outside Crockford base32 after aliasing.
- `isValidCustomFriendCode(input): boolean` - normalized length >= 12 and pure Crockford charset.
- `makeVanityFriendCode(vanity, prng): string` - normalize the vanity portion (require a small minimum, e.g. >= 4 normalized chars), append a random Crockford suffix (target >= 8 random chars / ~40 bits) so the total normalized length is >= 12, and return a **display-formatted** code (e.g. `MEER-<VANITY>-<SUFFIX>` grouped for readability). Use the sync package's configured PRNG; never `Math.random`.
- `rendezvousIdFromCustomCode(input): Uint8Array | null` - validate, then derive a stable 8-byte rid by domain-separated hash (e.g. SHA-512 over `"meerkat/custom-friend-code/v1" || normalized`), slice to 8 bytes. Deterministic so publish and resolve agree.
- A unified resolver `friendCodeToRendezvousId(code): Uint8Array | null` that tries `parseFriendCode` (standard checksummed) first and falls back to `rendezvousIdFromCustomCode`. **Guarantee custom codes cannot be mistaken for standard ones** (construct so normalized length is never exactly 16, or otherwise reserve the standard shape) and cover it with a test.
- Wire publish + resolve: `publishIdentityToRendezvous` accepts a custom code (derive rid via `rendezvousIdFromCustomCode`) in addition to the existing `rendezvousId` path; `resolveIdentityFromRendezvous` uses `friendCodeToRendezvousId` so it transparently accepts standard AND custom codes. Backward compatible.

Tests (TDD, write first): normalize idempotence + alias mapping; min-length enforcement; vanity+suffix always >= 12 and decodes to a stable rid; publish-then-resolve round trip with a custom code returns the right bundle; standard codes still parse and resolve unchanged; a custom code is never parsed as a standard code. Run `pnpm --filter @mylife/sync test` (or repo test) green before Phase 2 starts.

## Phase 2 - App UIs (parallel, both depend on Phase 1)

### 2a. Mobile (`apps/meerkat`)

- **IdentityProvider** (`app/(root)/providers/IdentityProvider.tsx`): keep `displayName` as the single self name. Add custom-friend-code support to `regenerateFriendCode` / a new `setCustomFriendCode(vanity)` that calls `makeVanityFriendCode`, derives + stores the `rendezvous_id` consistently, and persists `friend_code` in `mk_settings`. No new schema needed beyond reusing existing keys; if a `friend_code_is_custom` flag helps the publish path, add it as an `mk_settings` key.
- **SyncProvider** (`app/(root)/providers/SyncProvider.tsx`): `publishFriendCode` must publish under the user's CURRENT stored friend code (custom or standard), deriving the rid from it, instead of generating a throwaway random code. `pairWithFriendCode` already routes through `resolveIdentityFromRendezvous`, which now accepts custom codes - verify and add input validation messaging.
- **Identity screen** (`app/(root)/(tabs)/identity.tsx`): redesign hierarchy ->
  1. Hero: **Your name** (big, editable; currently "Display name").
  2. **Your friend code**: show current code; add a "Make your own" input (vanity), live-validated (>= the vanity minimum), with a helper showing the final code preview (vanity + random suffix); keep Copy + Regenerate. Honest one-liner about the privacy tradeoff of a custom code.
  3. **Safety check code** (former "Device fingerprint"): small, secondary, with hint "Friends can compare this to be 100% sure it is really you." Keep Copy public key.
  4. A small **info button** (top-right of the screen header) that opens a modal explainer (new component, e.g. `components/IdentityInfoModal.tsx`) using `Panel`/`SectionHeader`/`Button` from `components/kit.tsx`. Plain-words sections: Your name / Your friend code / Safety code / Where this lives (your device, no company server, no password) / The honest promise.
- **Chat author name** (`app/(root)/(tabs)/channel/[communityId]/[channelId].tsx`): replace the bare `shortHex(authorDeviceId)` author label with a resolved name. Add a `resolvePeerName(deviceId)` helper (self -> "You"; paired device displayName; community descriptor member displayName; else `shortHex`). Build a memoized `Map<deviceId,name>` from paired devices + current community members so it does not query per row. Same treatment for the file-request counterparty label and the Sync screen peer/session labels where a name is known. Never invent a name from the message payload.

### 2b. Web (`apps/meerkat-web`)

First locate the current components (the shell is componentized): identity lives in `src/ui/onboarding/IdentityCard.tsx` (+ onboarding overlay), chat author in `src/ui/channel/ChannelView.tsx`, settings in the overlay host. Mirror 2a within web's stack (Vite + React 19, `MeerkatProvider`):

- Add a **friend code** to the web node for the first time: surface in `MeerkatProvider` (create/store `friend_code` + `rendezvous_id` in the web SQLite settings, mirroring mobile), and add publish/resolve via the same `@mylife/sync` rendezvous functions (web already speaks the relay protocol). If pairing-by-friend-code UI is out of reach this round, at minimum show + let the user set a custom friend code and copy it; note any deferral honestly.
- Identity UI: name as the hero, custom friend code input (vanity + suffix), demoted safety code, and an **info button/modal** matching mobile copy.
- Chat author name resolution in `ChannelView`, same trusted-source rules and short-hex fallback.

## Phase 3 - Gates + verification

- `pnpm --filter @mylife/sync test`
- `pnpm --filter @mylife/meerkat-app typecheck && pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/meerkat-web typecheck && pnpm --filter @mylife/meerkat-web test`
- `pnpm gate:function:changed` (function logic changed in sync + providers)
- `node scripts/check-meerkat-parity.mjs` (from repo root)
- Manual/`/browse` sanity on web identity once built.

## Acceptance criteria

- A user can type a vanity friend code on phone and web; the stored code is >= 12 chars, shows a random suffix, and a second device can pair/resolve using it.
- Existing auto-generated codes still work; existing sync tests pass.
- The Identity screen leads with the chosen name; the fingerprint appears only as a small safety code; an info button opens a kid-friendly explainer (phone + web).
- Chat shows a friendly name for known peers (paired / community member / self) and short hex for unknown authors; no name is ever derived from message contents, and nothing implies a name is "verified."
- The tester guide clearly states web requirements, the no-App-Store-build truth, what to hand a tester, and documents the friend code + name + info button. No transport dishonesty, no em dashes.

## Out of scope (this round)

- Recovery/restore of identity backups (still not built; guide keeps saying so).
- Remote alias OVERRIDE (renaming a peer locally) and a dedicated peer-alias table.
- Pairing-by-friend-code UI on web if it exceeds the slice (defer honestly, do not fake it).
- Automatic peer auto-dial / background scheduled sync (unchanged).

# Plan 23 — Meerkat Launch Readiness + Data Safety

> Full-function build plan for the final items that stand between Meerkat's current
> green-tested code and an actual paid launch on both surfaces. No deferral: every
> item below is built to full production function. Phasing here is BUILD ORDER, not
> scope reduction. The original June production review remains in git history. The current launch verdict is `docs/reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.html`; revalidate every unchecked item against that audit before execution.
> (v1.1, 2026-06-28), the `/tmp/meerkat-map` dossiers, and the real source.

## Metadata

- **Plan ID:** 23-meerkat-launch-readiness
- **Repo areas:** `apps/meerkat` (Expo Router mobile), `apps/meerkat-web` (Vite React SPA), `packages/sync` (`@mylife/sync` engine), `packages/meerkat-relay` (`@mylife/meerkat-relay`), `packages/ui` (`@mylife/ui` shared theme/primitives — read-only here)
- **Surfaces:** Mobile + Web at strict feature parity (mandate #4)
- **Priority:** Launch gate. This is the plan that flips "green tests" into "shippable."
- **Estimated effort:** ~22-30 engineer-days across 5 phases. Engine work (recovery restore, Noise upgrade, sealed rendezvous) is ~9-12d; UI/correctness fixes ~4-5d; store-compliance bundle ~3-4d; device-QA + relay gating ~5-7d (much is human/ops wall-clock, not coding).
- **Depends on:**
  - **Plan 20 (connectivity + self-hosting)** — HARD for Phase 4. The deployed `wss://` relay, the published public relay image, and the self-host UI are plan-20 deliverables; this plan VERIFIES and GATES on them. Shared symbol: `DEFAULT_RELAY_URL` (empty by design today in both clients).
  - **Plan 22 (monetization + billing)** — HARD for the final store *submit*. The IAP/paywall/StoreKit/RevenueCat plumbing and the "$4.99 means three things" reconciliation live in plan 22 (production-review blockers #2, #3). This plan owns the *non-billing* compliance bundle (EAS id, icon, account deletion, encryption export, privacy labels, store metadata) which is independent of billing.
  - **Plan 21 (full DMs)** — SOFT. Once DMs land, the exit-demo (Phase 4) gains a DM rung and recovery-restore must leave the device able to re-derive DM mailbox tokens after re-pair.
- **Blocks:** The actual App Store / Play submission and the public `$4.99` release. Nothing ships until Phase 4 signs off.
- **Build order:** Phases 0 → 1 → 2 → 3 can begin immediately and largely in parallel with plans 18-22. Phase 4 must run LAST (after plan 20's relay is live and after plans 21/22 land) because it is the all-up validation gate.

---

## Status Delta (2026-07-07, final reconciliation): CLOSED, SUPERSEDED BY PLAN 40

- This plan is closed as a historical launch-readiness plan. The codeable items
  completed from this plan include recovery restore on both surfaces, reviewed
  content staying hidden, canonical file report targets, sealed friend rendezvous,
  Noise forward-secrecy hardening and red-team tests, delete-everything flows, and
  real EAS project id wiring.
- The remaining items moved to `docs/plans/queue/40-meerkat-final-launch-plan.md`:
  D.7 standalone cross-community Downloads browser on both surfaces, web Playwright
  launch CI, store/legal metadata bundle, brand/icon asset finalization if founder
  assets are supplied, device QA, live soak, deploy/provider/account ops, and store
  submission.
- Historical sections below remain for implementation record only. Plan 40 is now
  the active final launch gate.

## Status Delta (2026-07-07, reconciliation): STILL ACTIVE LAUNCH GATE

- This plan's 2026-07-01 "nothing built yet" delta is stale. Verified against code:
  recovery restore now uses `openAndRestore` on both surfaces; D.2 reviewed content
  stays hidden; D.3 canonical file report targets exist; D.5 sealed friend
  rendezvous is built; D.6 Noise forward-secrecy hardening and red-team tests are
  built; delete-everything flows exist; EAS project id is no longer a placeholder.
- Keep this file in `docs/plans/queue/` because it still owns the final launch gate
  and at least one real codeable gap remains: D.7, the standalone cross-community
  Downloads browser screen, was not found. Current code has community-scoped files
  screens and bulk save, but no global Downloads browser with both-surface parity.
- Other remaining codeable/docs-gate work to verify or finish here: web Playwright CI
  for launch surfaces, final brand/icon asset wiring if the founder supplies assets,
  and current store/legal metadata docs if not handled by a separate store-submission
  artifact.
- Founder-ops still gate completion: relay/node/humanity/persona deploys, TURN,
  provider keys, App Group provisioning, prebuild/EAS builds, physical two-device
  QA, 48-hour live soak, and store submission.

## Status Delta (2026-07-01, read first)

- **Nothing in this plan is built yet** (verified 2026-07-01): the Current-State Grounding table remains accurate; every net-new item is still net-new. Spot evidence: `settings.tsx:517` still shows the stale "Restoring on a fresh install is pending" line; `files/[communityId].tsx:447,492` still say "coming in a later update"; `community-safety.ts:264` still has the `status='active'` hide bug; `app.json:77` still reads `REPLACE_WITH_EAS_PROJECT_ID` (drifted from the plan's original `:71` citation); `recovery-key.ts` still exports no restore functions; no meerkat-web Playwright CI job exists.
- **Corrections applied to this document:**
  1. T1.7 proposed a new `security-redteam.test.ts`; that exact filename already exists (`packages/sync/src/__tests__/security-redteam.test.ts`, 1078 lines, an UNRELATED mesh-sync threat suite). Use `noise-redteam.test.ts` or a new `describe` block in the existing file. Corrected below in T1.7 and the risk-matrix row.
  2. D.5 web call-site line numbers drifted: `MeerkatProvider.tsx` is now 2061 lines; `publishIdentityToRendezvous`/`resolveIdentityFromRendezvous` call sites are now at `:1108`, `:1118`, `:1610`. `FriendsView.tsx:131` is still exact. Corrected below in the D.5 section and T1.6.
  3. The Plan 19 soft dependency is now UNBLOCKED: Plan 19 is code-complete, including the P9 archive and FF3 (minus owner-side auto-approve wiring).
  4. `apps/meerkat/dist/metadata.json` is an Expo export-bundle manifest, NOT store listing metadata; do not mistake it for the B.3 artifact.
- **Scheduling opportunity:** D.6 (Noise upgrade) touches `sync-session.ts`, which Plan 21 Phase 2 will also touch. As of 2026-07-01, Plan 21 Phase 2 has not started; land D.6 FIRST, since the lowest-friction window is now.
- **New workstream item D.7** (previously unplanned, folded in per the 2026-07-01 scope review): a standalone Downloads browser screen with bulk/multi-file save (a cross-community downloads management surface; per-item save already exists). Source: `apps/meerkat/Tickets/launch-plan.md:70-71`. Both surfaces, 5-state UX, honest empty states.
- **Launch gate change (2026-07-01 founder decision):** EVERYTHING gates launch. The launch set is now Plans 19, 20, 21, 22, 25, plus new Plans 24 (humanity verification), 26 (open public participation), 27 (community transport policies + proximity communities), 28 (real member removal + epoch rotation), and 29 (seamless auto-connect). This plan's Phase 4 (device QA + live relay + store submission) runs LAST, after all of those land; store listing copy (B.3) must cover calls, open posting, proximity communities, and humanity verification.
- **D.2 target moved (2026-07-03, Plan 31 Phase 2 landed first):** the owner-review queue JSX (`listOwnerReviewItems` / `markSafetyActionReviewed`) was relocated out of the (now list-only) `communities.tsx` into `apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx`. Screen 2 ("Owner review queue with sticky hide") and the D.2 impl (T2.2) now target that settings screen on mobile, NOT `communities.tsx`. The mobile parity check for `<PublicJoinRequests` gated on `isOwner` was retargeted to the settings screen in the same change. D.1 (Files-index Request, Files screen) is unaffected. Web owner-review location is unchanged (Plan 31 Phase 5 handles the web restructure).

---

## Business Context

### Why this plan exists

The original June production review described the engineering as real and honest while identifying operational and product launch gaps. Its 1,559-of-1,560 test count and specific blocker list are historical. The July 9 Blackglass audit is the current launch verdict and must be used to reconcile this plan before further execution.

The single highest-stakes item is **recovery restore**. Today `generateRecoveryKey` / `sealRecovery` / `exportRecoverableIdentity` produce a printable key + encrypted backup, and the UI honestly says "Restoring on a fresh install is pending" (`apps/meerkat/app/(root)/(tabs)/settings.tsx:427`). For a one-time paid app whose entire value proposition is "your identity lives only on your device, no company account," shipping a *recovery key that cannot recover* is a launch-blocking integrity failure: a user who resets identity or loses the phone permanently loses their account despite holding a "recovery key." The founder decision (review §decisions #4) is explicit: build full restore, no hiding the affordance.

### Which competitor's users this wins

This plan does not win a competitor on its own; it removes the disqualifiers that would lose every competitor's users at the worst moment.

- **Signal / WhatsApp switchers** churn the instant a privacy app loses their account. Signal's own most-complained-about behavior is exactly the "lost my history when I changed phones" moment. Meerkat's recovery-restore + the sealed friend-rendezvous (no relay can read your identity) lets us credibly say "self-sovereign identity that you can actually recover" — the thing Signal's PIN/registration-lock half-solves and that local-only apps usually fail outright.
- **Discord / Slack organizers** evaluating a self-hosted alternative will not adopt a tool that can't pass store review or that silently un-hides content they moderated (the "Reviewed un-hides" bug). The moderation-correctness fix + account-deletion flow are table stakes for a community owner to trust the platform.
- **The privacy-conscious mainstream user** (review persona) is exactly who notices a fake "delivered" or an un-sealed identity bundle. Closing the friend-rendezvous metadata leak and the marketing caveats (Noise / group-keys / "no device ids") is what lets the honesty positioning survive contact with a security reviewer or a journalist.

### Target user

The launch-readiness work serves all five review personas, but the load-bearing one is **The Multi-Device Individual** ("owns a phone and a laptop … pairs their own devices … without a cloud account"). Recovery restore is the difference between "I can move to a new phone" and "I lost everything." Secondary: **The Community Organizer**, who needs moderation that stays moderated and a platform that survives store review.

---

## Current-State Grounding (exists vs net-new)

| Capability | Exists today (file:line) | Net-new in this plan |
|---|---|---|
| Recovery key gen + seal + export | `packages/sync/src/node/recovery-key.ts:88-145` (`generateRecoveryKey`, `encodeRecoveryKey`, `parseRecoveryKey`, `exportRecoverableIdentity`, `sealRecovery`) | `restoreIdentityFromRecovery()` + `openAndRestore()` + keypair-consistency validation |
| Recovery decrypt | `recovery-key.ts:151-170` (`openRecovery`, fail-closed on wrong key) | Wired into a real restore path on both surfaces |
| Identity mint on first launch | `apps/meerkat/app/(root)/providers/IdentityProvider.tsx:85-112` (mints fresh on no `mk_identity` row); reset at `:168-182` | Restore entry point in onboarding + Settings that REPLACES the minted identity before/at first run |
| Secret-store write | `storeDeviceIdentitySecrets` is DEFINED in `packages/sync/src/secrets/sync-secret-store.ts`; called at `packages/sync/src/identity/device-identity.ts:37` (and `:101`) | Reused by restore to re-home recovered private keys behind a fresh `privateKeyRef` |
| EAS project id | `apps/meerkat/app.json:71` `"REPLACE_WITH_EAS_PROJECT_ID"` | Real id via `eas init` (founder ops) |
| Android adaptive icon | `app.json:60-62` `backgroundColor:"#060B0A"` (stale neon-era) | Open Burrow paper/accent + real foreground asset |
| Privacy manifest | `app.json:30-44` (`NSPrivacyTracking:false`, empty collected types) | Matching App Store privacy labels + Play Data Safety form + encryption-export declaration |
| Account deletion | None (only `resetIdentity` `IdentityProvider.tsx:168-182` + `clearAll` storage wipe) | Consolidated "Delete everything" flow + privacy policy + web deletion-instructions URL |
| "Reviewed" un-hide bug | `apps/meerkat/app/(root)/data/community-safety.ts:244-251` (`isCommunityContentReportHidden` treats only `status='active'` as hiding) + `:270-282` (`markSafetyActionReviewed` sets `reviewed`) → un-hides | Decouple "hidden" from "review status"; reviewed STAYS hidden; explicit un-hide action |
| Attachment-report id mismatch | `AttachmentCard.tsx:82` reports `${channelId}:${attachmentId}`; `files/[communityId].tsx:223-226` reports `file.id` and filters on `file.id`/`messageId` | Single canonical `communityFileReportTarget()` used by BOTH surfaces |
| Files-index "Request" | `files/[communityId].tsx:447-453` disabled button, copy `"Request {name} (coming in a later update)"` while the in-channel request flow (`file-request-mailbox`) is LIVE | Wire the index button to the live request flow + honest copy |
| Mobile Feed states | `apps/meerkat/app/(root)/(tabs)/index.tsx` computes synchronously, no loading/error/partial UI (web has `feed-status.test.ts` 17 cases) | Mobile Feed gains loading/empty/error/partial parity with web |
| Friend-rendezvous record | `packages/sync/src/node/friend-rendezvous.ts:85-96` publishes `base64(JSON(signed bundle))` — un-sealed; `:11-16` documents the v0 metadata caveat | Sealed rendezvous record keyed by a secret half of an extended code (no relay change) |
| Noise forward secrecy | `packages/sync/src/encryption/noise-handshake.ts:1-19` "Simplified Noise NK", static-key fallback `sync-session.ts:925-927` | Vetted Noise with proper chaining-key state; FS guaranteed; no silent downgrade |
| `saveFilesBulk` perf gate | `apps/meerkat/app/(root)/data/__tests__/community-files.function-gate.test.ts` slope gate, flaky under parallel load (ratio 4.17 vs 4.00) | Deterministic / load-tolerant complexity gate |
| Multi-node e2e harness | `packages/meerkat-relay/src/__tests__/multi-node-2device-e2e.test.ts`, `multi-node-3device-e2e.test.ts` (loopback) | Real-WAN smoke test against the deployed relay; human exit-demo sign-off |
| Public relay image | `.github/workflows/publish-relay-image.yml` (manual/tag, never run) | Run it (tag `relay-v*`); verify pull + boot of the published image |

**Honesty-rule baseline (must be preserved verbatim):** the `HonestNotice` primitive (`apps/meerkat/app/(root)/components/kit.tsx:91-99`), the current parity gate (`scripts/check-meerkat-parity.mjs`), and every "no fake delivered/online/peer-count/backup" string. Nothing in this plan may introduce a fabricated number; every count shown stays traceable to `useNode().stats`, the engine status store, or the `sync_*` / `cm_*` tables.

---

## Work Streams

This plan has five work streams (matching review scope a-e). Each is a tracked, test-first build.

- **(A) Recovery restore** — engine + both surfaces. Data-safety #1.
- **(B) Store submission** — app.json, icons, account-deletion/GDPR, compliance bundle, metadata.
- **(C) Device QA** — concrete plan to clear the Tier-D gaps (exit demo, background+push, save dialogs, live-relay gating; cross-ref plan 20).
- **(D) Correctness/polish fixes** — Files-index Request copy, Reviewed un-hide, attachment-report id, mobile Feed states, friend-rendezvous seal, Noise upgrade.
- **(E) Flaky `saveFilesBulk` perf gate.**

---

## (A) Recovery Restore

### A.1 Engine changes (`packages/sync`)

Extend `packages/sync/src/node/recovery-key.ts` (do NOT add a new crypto file; reuse `tweetnacl`, the existing `hkdf`, and `storeDeviceIdentitySecrets`). Add:

```ts
/**
 * Validate that a recovered export is internally consistent: the public key
 * MUST be derivable from the signing private key, and the DH public key from
 * the DH private key. Rejects a tampered export that pairs a public identity
 * with private keys the holder does not actually own. Returns true iff consistent.
 */
export function isRecoverableIdentityConsistent(r: RecoverableIdentity): boolean;

/**
 * Restore a device identity from a verified export. Re-homes the recovered
 * private keys into the CONFIGURED secret store (so the same secret-store-first
 * boot order applies) and returns a DeviceIdentity whose publicKey/dhPublicKey
 * match the export and whose privateKeyRef points at the freshly stored secrets.
 * Throws if the export is inconsistent (see isRecoverableIdentityConsistent).
 * Pure of I/O beyond the injected secret store; RN-safe.
 */
export function restoreIdentityFromRecovery(r: RecoverableIdentity): DeviceIdentity;

/** Convenience: openRecovery(sealed,key) -> consistency check -> restore. */
export function openAndRestore(
  sealed: string,
  recoveryBytes: Uint8Array,
): { ok: true; identity: DeviceIdentity } | { ok: false; reason: 'wrong_key' | 'tampered' };
```

`restoreIdentityFromRecovery` body: derive `nacl.sign.keyPair.fromSecretKey(hexToBytes(r.signingPrivateKeyHex)).publicKey`, compare to `r.publicKey`; derive `nacl.box.keyPair.fromSecretKey(hexToBytes(r.dhPrivateKeyHex)).publicKey`, compare to `r.dhPublicKey`; on mismatch throw. Then `const privateKeyRef = storeDeviceIdentitySecrets(r.publicKey, { ed25519PrivateKeyHex: r.signingPrivateKeyHex, x25519PrivateKeyHex: r.dhPrivateKeyHex })` and return `{ publicKey: r.publicKey, privateKeyRef, dhPublicKey: r.dhPublicKey, displayName: r.displayName, createdAt: new Date().toISOString() }`.

Add all three to the named re-export list in `packages/sync/src/node/index.ts` (right next to the existing recovery-key exports at `node/index.ts:38-46`). Do NOT edit the top-level barrels directly: both `src/index.ts:869` and `src/index.native.ts:721` already surface the node layer via `export * from './node'`, so adding the names to `node/index.ts` makes them available on both barrels automatically. (The apps consume the native barrel; restore must be RN-safe — it is, using only `tweetnacl` + the injected secret store.)

**Security analysis (A.1).** The existing `openRecovery` already fails closed on a wrong key or tampered ciphertext (`recovery-key.ts:151-169`, secretbox auth). The *new* risk surface is the JSON *inside* a correctly-decrypted box being internally inconsistent. Concretely: a recovery bundle is a user-held secret; if a user is socially engineered into importing an attacker-supplied bundle, the attacker could otherwise plant a `publicKey` they do not hold the private key for, making the victim's device sign as a key the attacker can later impersonate-via-confusion. `isRecoverableIdentityConsistent` closes this by binding `publicKey↔signingPrivateKeyHex` and `dhPublicKey↔dhPrivateKeyHex`. The restore path also must run only AFTER the secret store is configured (MK-001 boot order, `apps/meerkat/app/(root)/data/meerkat-db.ts`) so the recovered keys land in the OS keychain, not the in-memory default Map. No new key material crosses the wire; restore is entirely local. The recovery key itself remains the single root of trust (no server escrow), exactly as `recovery-key.ts:14-22` documents.

### A.2 Mobile entry points (`apps/meerkat`)

Restore must be reachable BEFORE the IdentityProvider mints a fresh identity (`IdentityProvider.tsx:99`). Two entry points, both calling the same engine path:

1. **Onboarding restore (primary).** Add a low-key "Restore from a recovery key" text link on Onboarding Step 1 (the name step, `OnboardingGate.tsx`). Opens a Restore sheet: two inputs — "Recovery key" (`MKR1-…`) and "Encrypted identity backup" (the base64 blob) — plus a "Restore identity" button. On submit: `parseRecoveryKey` → if null, error; else `openAndRestore(sealed, bytes)` → on `ok`, `saveIdentityRow(db, …)` (replacing the just-minted or absent `self` row via `INSERT OR REPLACE`, `db.ts:143-152`), set display name, and regenerate a fresh friend code (friend code is a label, not identity — it is not in the export). Then complete onboarding into the Feed.
2. **Settings restore (recovery on an existing install).** Add a "Restore from recovery key" row in the Settings Recovery panel (`settings.tsx:412-435`), guarded by a strong confirm Alert because it DISCARDS the current device identity: title "Replace this device's identity?", body "This replaces the identity on this device with the one in your recovery backup. The current identity and its pairings on this device will be gone. Content stays until you clear it." Same engine path on confirm; on success, the app re-pins nothing automatically (peers re-pair).

Update `IdentityProvider` to expose `restoreIdentity(recoveryKey: string, sealed: string): { ok: true } | { ok: false; reason }` so both surfaces share one code path and the provider re-reads the row.

### A.3 Web entry points (`apps/meerkat-web`)

Mirror exactly, at parity. Web mints identity through `MeerkatProvider.tsx` over the browser secret store (`src/lib/storage/browser-secret-store.ts`). Add the same Restore affordance to the welcome modal (a "Restore from a recovery key" link) and to web Settings. Engine call is identical (`openAndRestore` is surface-agnostic; the secret-store write goes through whichever store is configured). Web has no LAN/keychain, but identity restore is pure crypto + the configured store, so it works relay-or-not.

### A.4 Honesty copy (replace the "pending" line)

Remove `settings.tsx:427`'s "Restoring on a fresh install is pending." Replace the post-generation Recovery notice with copy that states exactly what restore does and does NOT bring back:

> "Restores your identity on a new device: your name, your keys, and your safety code. It does not bring back your messages, communities, or files — those re-flow only after you re-pair and re-sync with the people and devices that have them. Anyone with the recovery key can become you; keep the key and the backup apart."

Restore sheet honest line (both surfaces):

> "This reads an encrypted backup you already have. Nothing is fetched from a server. If the key and backup do not match, nothing changes."

---

## (B) Store Submission

### B.1 `app.json` fixes (`apps/meerkat/app.json`)

- Replace `extra.eas.projectId` (`:71`) with the real id from `eas init` (founder ops; the value is committed once minted).
- Change `android.adaptiveIcon.backgroundColor` (`:62`) from `#060B0A` to the Open Burrow paper `#F6F4EF` (matches `splash.backgroundColor` at `:15`); add a real `adaptiveIcon.foregroundImage` (the burrow mark) and a top-level `icon`. Add `splash.image`.
- Confirm `ios.infoPlist.UIBackgroundModes` (`:25`) `["fetch","processing","remote-notification"]` and `BGTaskSchedulerPermittedIdentifiers:["meerkat-background-sync"]` (`:26`) are present and justified (see B.3). They are already declared; this plan VERIFIES they match the real background-sync wiring (`apps/meerkat/app/(root)/data/background-task-registration.ts`).

### B.2 Account deletion / GDPR (both surfaces)

Apple and Google both require an in-app way to delete the account and (Google) a web-accessible deletion URL, even though Meerkat has no server account. Net-new: a single **"Delete everything"** flow that composes the existing destructive primitives into one auditable action:

1. New Settings "Delete my data" section (mobile + web) with one button → strong confirm.
2. On confirm, in order: revoke any active hosted entitlement token and let any published friend-code rendezvous record expire (it is one-time + 10-min TTL, `friend-rendezvous.ts`); `store.clearAll()` (pinned blocks); wipe `mk_`, `mp_`, `cm_`, `sync_` tables; `deleteIdentityRow(db)` (`db.ts:157`); clear the secret store entry for the device; clear `mk_settings`. End state = a clean first-run install.
3. Honest copy: "Deletes everything on this device: your identity, content, communities, and settings. There is no company account to delete because Meerkat never had one. Records you already published to a connection server (like a friend code) are short-lived and expire on their own; we cannot reach into someone else's device."

Net-new docs (founder ops, referenced by store listings): a **privacy policy** page and a **data-deletion instructions** page (a static web page for Google Play's required deletion URL), both consistent with the privacy manifest (no tracking, no collected data).

### B.3 Store-compliance bundle

- **Encryption-export declaration.** Meerkat uses end-to-end encryption with standard algorithms (X25519/Ed25519/XSalsa20-Poly1305 via `tweetnacl`). `ITSAppUsesNonExemptEncryption:false` (`app.json:22`) claims the mass-market exemption. TASK: confirm the self-classification (U.S. ECCN 5D992.c, mass-market under License Exception ENC), file the App Store Connect encryption questionnaire answers, and add the annual self-classification report note. If distributing in France, add the French encryption declaration. This is a real, tracked legal/ops task, not a checkbox.
- **Privacy labels.** Build the Apple "App Privacy" nutrition label = **Data Not Collected** (matches `NSPrivacyTracking:false` + empty `NSPrivacyCollectedDataTypes`, `app.json:31-33`) and the Google Play **Data Safety** form = no data collected, no data shared, data encrypted in transit, user can request deletion (link the B.2 deletion URL).
- **Background-mode justification.** Write the App Review note explaining `fetch`/`processing`/`remote-notification` + the BGTask identifier: "best-effort drain of end-to-end-encrypted messages a paired device parked while this device was offline; no content is uploaded; the app never auto-dials peers" (true to `apps/meerkat/CLAUDE.md` transport-honesty boundary and `background-task-registration.ts`).
- **Store metadata.** App Store + Play listing: name, subtitle, description, keywords, category (Social Networking), age rating, support URL, marketing URL, screenshots. The honesty rule extends to the listing: do NOT imply the four simulated transports (WebRTC/Nearby/BLE) or the torrent swarm are live; do NOT claim "MLS" or "Noise" without the caveats (until D.6 lands; see Risks). After D.5/D.6 land, the listing CAN truthfully say "the connection server can't read your identity" and "forward secrecy."

---

## (C) Device QA — clearing the Tier-D gaps

The automated substitute already exists and is honest about its ceiling: the multi-node e2e harness proves PROTOCOL + RELAY correctness over a loopback relay but "is NOT physical sign-off" (`apps/meerkat/Tickets/device-qa-exit-demo.md:40-43`). This work stream turns each Tier-D gap into a tracked, testable task with explicit pass criteria and an honest indicator, and records results in a committed QA sign-off doc (`apps/meerkat/Tickets/exit-demo-signoff-2026-06.md`, net-new).

| C-task | What | Pass criterion (honest indicator) | Where covered automatically |
|---|---|---|---|
| C.1 | 2-device exit demo (7 rungs) | Each rung in `device-qa-exit-demo.md` passes on real hardware: new completed `sync_session` row with non-zero bytes, matching 5-emoji SAS, unread badges from real `cm_messages`, pinned-detail decrypt round-trip. MITM negative blocks. | `multi-node-2device-e2e.test.ts` (loopback) |
| C.2 | 3-device exit demo | All three converge to identical channel state; a C-authored message does NOT appear on B until a direct B↔C session runs (no silent fan-out). | `multi-node-3device-e2e.test.ts` |
| C.3 | OS background scheduler + push | Add `expo-task-manager`/`expo-background-task`/`expo-notifications` to `package.json` + an EAS dev profile; run the 7-step `launch-plan.md` "Background sync QA checklist"; a data-only push ENQUEUES a drain and the "message received" notification fires ONLY on real `applied>0`. | Pure jobs (`runBackgroundSyncCore`) Vitest-covered; OS cadence is device-only |
| C.4 | Live OS save dialogs | Run the 6-step `launch-plan.md` "Save-destination QA checklist": Android SAF pick/verify/stale-tree/cancel; iOS share sheet. "Saved" only after on-disk verify. | `file-save.test.ts` behind injected `FileSaveAdapter` |
| C.5 | Live relay gating (cross-ref plan 20) | Consume plan 20's deployed `wss://` relay: set `DEFAULT_RELAY_URL` (or hard-gate onboarding on a pasted URL); run the published relay image (`publish-relay-image.yml`, tag `relay-v*`); a NEW **real-WAN** smoke test boots a session against the live endpoint (not loopback) and an external uptime monitor is green ≥48h. | `smoke-relay.test.ts` (loopback child process); `relay-image-deps.test.ts` (image dep graph) |
| C.6 | Browser-level e2e for web | Stand up a Playwright job for `@mylife/meerkat-web` (CI today runs Playwright only against `@mylife/web`, `.github/workflows/ci.yml`): cold load, onboarding, create community, send message, restore-from-recovery, all over a real relay. | Vitest/jsdom only today |

C.5 is the one HARD cross-plan dependency: this plan does not build the relay/self-host UI (plan 20 does); it builds the **launch gate** that refuses to mark the relay capability "live" until a real `wss://` endpoint answers a real session and stays up. New artifact: `packages/meerkat-relay/src/__tests__/wan-smoke.e2e.test.ts` (env-gated by `MEERKAT_WAN_RELAY_URL`; skipped in CI, run by ops against the live fleet) that runs one real engine A→B session and asserts a recorded `sync_session` with non-zero bytes — the WAN twin of `smoke-relay.test.ts`.

---

## (D) Correctness / Polish Fixes

### D.1 Files-index "Request" stale copy → wire the live flow

`files/[communityId].tsx:447-453` disables the per-row Request button with `"Request {name} (coming in a later update)"` while the in-channel request-again flow is LIVE through the file-request mailbox (`packages/sync/src/protocol/file-request-mailbox.ts`, `apps/meerkat/app/(root)/data/file-request-core.ts`). FIX: wire the index Request button to the same `requestFile` path the in-channel card uses. The aggregated Files-index row must carry the `channelId` + host-message id the request needs (enrich the aggregation in the `aggregated` memo, `files/[communityId].tsx:103-111`). Replace the copy with the live in-channel string set ("requesting / requested / restored / declined"). Web parity: the web Files surface gets the same wiring. If a row genuinely cannot resolve a requestable target, the button is absent (not a fake-disabled "later" button).

### D.2 "Reviewed" silently un-hides reported content

Root cause: `isCommunityContentReportHidden` treats only `status='active'` as hiding (`community-safety.ts:244-251`), and `markSafetyActionReviewed` sets `status='reviewed'` (`:270-282`), so marking Reviewed un-hides and the test `community-safety.test.ts:64-67` *encodes the bug*. FIX (decouple "hidden" from "review status"):

- `isCommunityContentReportHidden` hides on `status IN ('active','reviewed')`; only `status='dismissed'` un-hides.
- `listOwnerReviewItems` lists `status IN ('active','reviewed')` so a reviewed item stays visible with a "Reviewed" badge (acknowledged, still hidden), and the owner can still act on it.
- Add an explicit owner action "Restore (un-hide)" → sets `status='dismissed'` via `markSafetyActionReviewed(db, id, 'dismissed')` (the `'dismissed'` status already exists, `community-safety.ts:5`, just unsurfaced). "Reviewed" = "I looked, keep it hidden"; "Restore" = "show it again."
- Rewrite the bug-encoding test FIRST (TDD): after `markSafetyActionReviewed`, assert `isCommunityContentReportHidden === true` and the item remains in `listOwnerReviewItems` with `status='reviewed'`; only after an explicit `'dismissed'` does it un-hide and leave the queue.
- Copy: owner-review item gains a "Reviewed — still hidden" pill; the "Restore" affordance reads "Un-hide for me." Honest line stays "It does not remove it for other members."

**Sync-policy / security note (D.2).** `cm_safety_actions` is local-only by deliberate design — excluded from `COMMUNITY_SYNC_POLICY.entityRules` (`community-core.ts:79-132`, `:266-268`). This fix changes only the local hide semantics and adds NO new replicating table; the `cm_safety_actions` table stays out of `entityRules`, so no scope cap / `ConflictStrategy` / `maxScope` change is needed and no moderation state ever leaves the device. Verify the parity check still sees `cm_safety_actions` absent from the policy.

### D.3 Attachment-report targetId ≠ Files-index file id

`AttachmentCard.tsx:82` reports under `${event.channelId}:${attachment.id}`; `files/[communityId].tsx:223-226` reports under `file.id` and filters on `file.id`/`messageId`; the Files screen never checks the composite. So reporting from chat does not hide the same row in the Files index, and vice-versa. FIX: a single canonical target-id helper in `community-safety.ts`:

```ts
/** The one canonical report target id for a community file/attachment, used by
 *  BOTH the chat AttachmentCard and the Files index, so a report from either
 *  surface hides the same row everywhere. */
export function communityFileReportTarget(input: {
  channelId: string; attachmentId: string;
}): string; // returns `${channelId}:${attachmentId}`
```

Both `AttachmentCard` and the Files screen (and the web equivalents) compute their report `targetId` AND their hidden-filter check through this helper. Migration: a one-time local reconciliation that rewrites any pre-existing `file`-kind `cm_safety_actions` rows to the canonical id on first run after the update (so already-reported files stay hidden). TDD: a test that reporting from the attachment card marks the matching Files-index row hidden, and reporting from the Files index hides the in-chat attachment card.

### D.4 Mobile Feed lacks loading/error/partial states

Web has feed status copy (`apps/meerkat-web/src/ui/__tests__/feed-status.test.ts`, 17 cases); mobile `apps/meerkat/app/(root)/(tabs)/index.tsx` computes synchronously with no loading/error/partial UI. FIX: add the five states to the mobile Feed at parity with web:

- **Loading:** a skeleton list while the DB read / first index runs ("Reading updates saved on this device…").
- **Empty:** existing empty copy retained (no fabricated activity).
- **Error:** if the local read throws (corrupt row, migration mid-flight), an error card with Retry ("Could not read your feed. Nothing was lost; try again.").
- **Success:** current ranked feed.
- **Partial:** when a source is still indexing, show the ranked items plus a quiet "Still checking {source}…" row — never a fake count.

Honest copy stays: "The Public control is hidden until a real public hosted source exists. DMs are not feed sources yet." No new numbers; states are derived from real read status, not invented progress.

### D.5 Friend-rendezvous v0 metadata caveat → sealed record

`friend-rendezvous.ts:11-16` documents that the published record is `base64(JSON(signed bundle))`, so a relay operator who base64-decodes a record learns public keys + display name. The header itself names the fix: an encrypted rendezvous record keyed by a secret half of an extended code, needing NO relay change (`rec` is already opaque). BUILD it:

- Extend the friend code to an optional **extended form** carrying a secret half: the public half derives the rendezvous id `rid` (sent to the relay, as today); the secret half derives `key = HKDF(secretHalf, 'meerkat-rendezvous-seal-v1')`.
- `publishIdentityToRendezvous` seals the signed bundle: `record = secretbox(JSON(signed), key)` instead of plain base64 (`:85-96`).
- `resolveIdentityFromRendezvous` takes the typed extended code, re-derives `key` from its secret half, and decrypts before `verifySignedIdentityBundle` (`:117-140`).
- Backward-compat: keep resolving legacy un-sealed records for a transition window (try-decrypt, fall back to plain parse); NEW publishes are always sealed. Gate the fallback behind an explicit `allowLegacyUnsealed` flag, default true for one release, then false.
- **Web parity (mandate #4 — the must-fix).** The extended-code form changes the `publishIdentityToRendezvous` / `resolveIdentityFromRendezvous` signatures, and the web app calls both. Update the THREE web call sites in `apps/meerkat-web/src/lib/MeerkatProvider.tsx` (2061 lines as of 2026-07-01) — the two `publishIdentityToRendezvous` calls now at `:1108` and `:1118` and the `resolveIdentityFromRendezvous` call now at `:1610` (drifted from the plan's original `:1071`/`:1081`/`:1573`) — to thread the extended code's secret half, or web pairing regresses the moment legacy fallback is turned off. Mirror the mobile honesty-copy change on web: the friend-code-publish notice at `apps/meerkat-web/src/ui/friends/FriendsView.tsx:131` (still exact) ("Friend codes publish only your signed public identity through the connection server.") is the web mirror of `sync.tsx:350` and moves to "publishes only an encrypted record the server cannot read." Web surfaces that present/consume the code and must stay aligned: `FriendsView.tsx`, `apps/meerkat-web/src/ui/sync/SyncDialog.tsx`, and `apps/meerkat-web/src/ui/settings/IdentitySection.tsx`.

**Security analysis (D.5).** Today: relay sees `rid` + an opaque-but-decodable record; a curious/hostile operator learns a device's Ed25519/X25519 public keys + display name (a real metadata leak, review blocker #8). After: the relay sees `rid` + a `secretbox` ciphertext; the secret half NEVER reaches the relay (only the `rid`, an HKDF of the public half, is transmitted), so an operator cannot derive the seal key and learns nothing about identity from the record. The signature verification (`verifySignedIdentityBundle`) still runs post-decrypt, preserving TOFU + self-signature trust. Threat residue: anyone who receives the full extended code (the legitimate flow) can decrypt — that is intended; the code is the capability. The 10-min TTL + one-time semantics are unchanged. This makes the honest copy fully true on BOTH surfaces: mobile `sync.tsx:350` ("publishes only your public identity and name to the server") and its web mirror `FriendsView.tsx:131` ("Friend codes publish only your signed public identity through the connection server.") both move to "publishes only an encrypted record the server cannot read."

### D.6 "Simplified Noise" forward-secrecy upgrade path

`noise-handshake.ts:1-19` self-labels "Simplified Noise NK … a production implementation would use a proper Noise library with full chaining key state." It is wired as the optional MK-011 ephemeral leg inside the already-encrypted negotiation; if either side lacks the leg, it falls back to the static-derived pairwise key (`sync-session.ts:842-928`, fallback `:925-927`), so forward secrecy is best-effort, not guaranteed (review blocker #8). BUILD the upgrade (engine-only; mandate #3 says do not reimplement crypto in the *app*, but hardening the *engine* Noise is exactly the right place):

- Replace the hand-rolled handshake with a vetted Noise construction with proper SymmetricState / chaining-key handling (Noise_NK or Noise_XK). **PREFERENCE (crypto discipline, mandate #3):** pull a vetted/reviewed Noise TS implementation into `packages/sync/src/encryption/` (driving the package's existing `tweetnacl` X25519 primitives) RATHER than hand-rolling HKDF chaining-key / SymmetricState state. Bespoke chaining-key state is exactly the category of crypto the engine exists to centralize and avoid re-inventing; only fall back to a `tweetnacl` X25519 + hand-rolled HKDF-chaining construction if no suitable vetted library can be sourced, and gate that path behind the red-team suite below. Keep the public `NoiseHandshake` surface so `sync-session.ts` callers are unchanged.
- Make forward secrecy **guaranteed for the wire** : the ephemeral leg is required by default. Today it is opt-in behind `options.supportsForwardSecrecy ?? true` (initiator gate `sync-session.ts:847`, responder gate `:1278`) and silently keeps the static-derived channel on a failed leg (initiator catch `:925-927`, responder catch `:1291-1292`). Make the ephemeral leg mandatory and remove the silent fallback OR gate it behind an explicit mutual opt-out (mirroring the required-encryption pattern at `sync-session.ts:702-706`) so a downgrade can never happen silently. A peer that withholds the ephemeral leg fails the session, exactly as a withheld negotiation reply fails today (`failNegotiation`, `sync-session.ts:777`).
- Add a `noise-redteam.test.ts` case (new file; `security-redteam.test.ts` is already the unrelated mesh-sync threat suite) proving: (1) the chaining key advances per message (a captured session key cannot decrypt a prior or future message); (2) a forced downgrade to the static key is rejected, not silently accepted.

**Security analysis (D.6).** The current construction does real X25519 DH + secretbox and derives a session key from two DH operations, but without a Noise chaining/rekey state, forward secrecy is one-shot per session and the *static fallback* means a passive adversary who later compromises the static key can decrypt sessions that fell back. The upgrade guarantees per-session ephemeral keys with proper chaining and removes the silent-downgrade path, so static-key compromise cannot retroactively decrypt traffic. This is the single most security-positioning-sensitive change; it must land before any marketing says "forward secrecy" without a caveat. It is also the heaviest item — sequenced in Phase 1 with its own red-team gate, not rushed.

---

## (E) Flaky `saveFilesBulk` Perf Gate

`apps/meerkat/app/(root)/data/__tests__/community-files.function-gate.test.ts > saveFilesBulk … stays within linear complexity slope budget` intermittently reds CI under parallel load (ratio 4.17 vs a 4.00 budget; passes 3/3 in isolation; the file's correctness/fuzz/memory gates pass). It is a wall-clock microbenchmark that CPU contention skews. FIX (make CI trustworthy before relying on a green badge for launch sign-off):

- Convert the slope assertion from wall-clock to a **deterministic complexity proxy** where possible (count the dominant operations / allocations as a function of n; assert linear growth in op-count, which CPU contention does not perturb). Keep the existing correctness, fuzz-invariant, and memory-budget gates unchanged.
- Where a wall-clock signal is still wanted, run it in a **dedicated serial CI step** (not inside the parallel `pnpm test` fan-out) with a load-tolerant budget and a small retry-best-of-N, and mark it non-blocking-but-reported. CI today runs `pnpm test` with `VITEST_SEED=run_id`, but this gate is wall-clock, not seed-driven; isolating it removes the false red.
- TDD: add a meta-test that the op-count slope gate is stable across N runs while a background load is simulated (deterministic input sizes), proving it no longer depends on wall-clock.

---

## Data Model / Schema Changes

This plan is deliberately light on new tables — the data-safety and correctness work mostly changes *semantics*, not storage. Changes:

1. **`cm_safety_actions` (no schema change, semantics change).** Table at `apps/meerkat/app/(root)/data/community-core.ts:269-286`. The `status` column (`'active' | 'reviewed' | 'dismissed'`, `community-safety.ts:5`) gains real meaning: `active`/`reviewed` = hidden; `dismissed` = un-hidden. No column added; no migration of shape. A one-time **data reconciliation** (D.3) rewrites any existing `file`-kind rows' `target_id` to the canonical `${channelId}:${attachmentId}` form. **Table prefix:** `cm_` (unchanged). **Sync policy:** stays OUT of `COMMUNITY_SYNC_POLICY.entityRules` — local-only, never replicated (`community-core.ts:79-132`). No `ConflictStrategy`, `maxScope`, or scope-cap change. **Security note:** moderation state remains device-local by design; the fix must not add it to any sync policy. Parity check (`scripts/check-meerkat-parity.mjs`) should assert its continued absence.

2. **Recovery export (no DB change).** `RecoverableIdentity` (`recovery-key.ts:116-124`) is unchanged; restore re-homes its private keys into the secret store and re-writes the existing `mk_identity` `self` row via `saveIdentityRow` (`db.ts:143-152`). No new table.

3. **`mk_settings` (existing key/value, no shape change).** Account deletion (B.2) clears all keys; background-sync QA (C.3) uses existing `background_sync_enabled` / `last_background_run_at`. No new column.

4. **Friend-rendezvous record (wire format, not DB).** D.5 changes the relay record from `base64(JSON)` to `secretbox(JSON)`; the relay stores it opaquely either way (no relay schema change — confirmed by `friend-rendezvous.ts:11-16`).

No `sync_*`, `mp_`, or `mk_` table is added. Prefix boundaries (`mk_`/`mp_`/`cm_`/`sync_`) stay intact (a launch-plan.md guardrail).

---

## Protocol / Engine Changes (`@mylife/sync`) — consolidated

| Change | File | Type | Security analysis |
|---|---|---|---|
| `restoreIdentityFromRecovery`, `openAndRestore`, `isRecoverableIdentityConsistent` (A.1) | `node/recovery-key.ts`; add to the named re-export list in `node/index.ts:38-46` | New pure fns, RN-safe | Keypair-consistency binding closes the tampered-bundle injection vector; restore is local-only; recovery key stays the sole root of trust |
| Sealed rendezvous record (D.5) | `node/friend-rendezvous.ts` (+ extended code in `node/friend-code.ts`) | Change publish/resolve to seal/open | Relay can no longer read identity from the record; secret half never transmitted; signature verify preserved post-decrypt |
| Vetted Noise + guaranteed FS, no silent downgrade (D.6) | `encryption/noise-handshake.ts`, wired at `protocol/sync-session.ts:842-928` | Replace construction, keep surface | Per-session ephemeral chaining; static-key compromise can't retro-decrypt; downgrade rejected like a withheld negotiation |

All three must be added to the `node/index.ts` named re-export list (so both `src/index.native.ts:721` — the barrel the apps consume — and `src/index.ts:869` surface them via `export * from './node'`) and proven by cross-client e2e where they cross the wire (D.5, D.6), per `packages/sync/CLAUDE.md` ("prove it with a cross-client e2e … in-memory-only proofs have historically hidden dead transports").

---

## UI Specification (both surfaces, 5 states each)

Theme: Open Burrow tokens (`apps/meerkat/app/(root)/theme/tokens.ts`; web CSS vars). Mobile owns its own `Button` (`components/kit.tsx`). All copy below is proposed and honors the honesty rule.

### Screen 1 — Restore from recovery key (A.2/A.3) · mobile Onboarding + Settings, web welcome modal + Settings

| State | What the user sees | Trigger |
|---|---|---|
| Loading | "Restoring…" on the button; inputs disabled | After tapping Restore identity |
| Empty | Two empty fields ("Recovery key" `MKR1-…`, "Encrypted identity backup"), Restore disabled until both non-empty | Default |
| Error | Inline: "That recovery key is not valid. Check for typos." (bad key) / "The key and backup do not match. Nothing was changed." (`openAndRestore` → `wrong_key`/`tampered`) | Parse/open failure |
| Success | "Identity restored. Welcome back, {name}." → onboarding completes / Settings re-reads identity | `ok:true` |
| Partial | n/a (single atomic op) — but the post-restore notice states content is NOT yet restored: "Your messages, communities, and files come back only after you re-pair and re-sync." | After success |

Honest line: "This reads an encrypted backup you already have. Nothing is fetched from a server."

### Screen 2 — Owner review queue with sticky hide (D.2) · Communities screen

| State | What the user sees | Trigger |
|---|---|---|
| Loading | (queue is a synchronous local read) skeleton rows | First render |
| Empty | "No local reports need review." | No active/reviewed reports |
| Error | "Could not read the review queue." + Retry | Local read throws |
| Success | Report rows; each with "Reviewed" and "Un-hide for me"; reviewed rows show a "Reviewed — still hidden" pill | Reports exist |
| Partial | n/a | — |

Copy: action "Reviewed" = "Mark reviewed (stays hidden)"; "Un-hide for me" sets `dismissed`. Honest notice unchanged: "Safe member removal needs a signed member-removal update plus epoch key rotation. This screen only hides local content until that owner protocol path is wired."

### Screen 3 — Files index Request (D.1) · Files screen

| State | What the user sees | Trigger |
|---|---|---|
| Loading | "Checking this device…" | Index aggregating |
| Empty | "No files yet" | No files |
| Error | "Could not read files." + Retry | Read throws |
| Success | Rows with live "on device / removed"; a removed-row "Request" button wired to the live request flow | Files present |
| Partial | A row mid-request shows "requesting / requested / restored / declined" (real statuses) | Request in flight |

No "coming in a later update" copy anywhere. If a row genuinely can't be requested, the button is absent.

### Screen 4 — Mobile Feed states (D.4)

Five states as specified in D.4. Web already has these (`feed-status.test.ts`); this brings mobile to parity. No fabricated counts; "Public" stays hidden until a real hosted source exists.

### Screen 5 — Delete my data (B.2) · Settings, both surfaces

| State | What the user sees | Trigger |
|---|---|---|
| Loading | "Deleting…" | After confirm |
| Empty | n/a | — |
| Error | "Could not finish deleting. Nothing partial was left; try again." (delete is best-effort idempotent) | A wipe step throws |
| Success | App returns to a clean first-run (onboarding) | Done |
| Partial | n/a (re-runnable to completion) | — |

Honest copy per B.2. Strong confirm before any wipe.

---

## Build Plan (phased, test-FIRST / TDD)

Each task: write the failing test first, then the implementation, then run `pnpm gate:function:changed` + `/review`. UI tasks add `/browse` over the affected route on both surfaces.

### Phase 0 — CI trust (E)
- **T0.1 (test):** meta-test that the `saveFilesBulk` complexity gate is stable across N runs under simulated load (op-count proxy).
- **T0.2 (impl):** convert the slope gate to a deterministic op-count proxy; isolate any residual wall-clock check into a serial, load-tolerant, non-blocking CI step. Verify `pnpm --filter @mylife/meerkat-app test` is green 5/5 under `-- --no-isolate` load.

### Phase 1 — Engine data-safety (A, D.5, D.6)
- **T1.1 (test):** `recovery-key.test.ts` — round-trip `generate → seal → openAndRestore → restoreIdentityFromRecovery` yields a DeviceIdentity whose pub keys match; tampered export (pub/priv mismatch) is rejected; wrong key → `wrong_key`.
- **T1.2 (impl):** `restoreIdentityFromRecovery` + `openAndRestore` + `isRecoverableIdentityConsistent`; add to the `node/index.ts` named re-export list (both barrels surface them via `export * from './node'`).
- **T1.3 (test+impl):** mobile `restoreIdentity` provider method + Onboarding restore sheet + Settings restore row; remove the "pending" copy (`settings.tsx:427`).
- **T1.4 (test+impl):** web restore in welcome modal + Settings (parity); add `identity-durability.test.ts` case for restore.
- **T1.5 (test):** `friend-rendezvous` sealed-record e2e (publish sealed → relay stores opaque ciphertext → resolve+decrypt+verify); legacy un-sealed still resolves under the flag.
- **T1.6 (impl):** extended code secret half + `secretbox` seal/open in `friend-rendezvous.ts` + `friend-code.ts`. **Both surfaces (mandate #4):** update mobile honesty copy `sync.tsx:350` AND web honesty copy `FriendsView.tsx:131`; migrate the three web call sites `MeerkatProvider.tsx:1108`/`:1118`/`:1610` (drifted from the plan's original `:1071`/`:1081`/`:1573`) to the extended-code signatures (and keep `SyncDialog.tsx` / `IdentitySection.tsx` aligned) — without this, web pairing regresses once legacy fallback is disabled.
- **T1.7 (test):** `noise-redteam.test.ts` (new file; `security-redteam.test.ts` already exists as the unrelated mesh-sync threat suite) — Noise chaining advances; captured key can't decrypt prior/future; forced downgrade rejected.
- **T1.8 (impl):** vetted Noise construction; require the ephemeral leg by default; remove/gate the silent static fallback (`sync-session.ts:925-927`); keep the public surface stable.

### Phase 2 — Correctness/polish UI (D.1-D.4)
- **T2.1 (test, rewrite the bug-encoding test):** `community-safety.test.ts` — after Reviewed, content STAYS hidden and stays in the queue; only `dismissed` un-hides.
- **T2.2 (impl):** D.2 hide-vs-review decoupling + "Un-hide for me" action + copy (both surfaces).
- **T2.3 (test+impl):** D.3 `communityFileReportTarget` helper; both surfaces report+filter through it; one-time id reconciliation; cross-surface hide test.
- **T2.4 (test+impl):** D.1 Files-index Request wired to the live request flow; enrich the aggregated row; remove stale copy (both surfaces).
- **T2.5 (test+impl):** D.4 mobile Feed loading/error/partial states at web parity.

### Phase 3 — Store submission (B)
- **T3.1:** `app.json` — real EAS id (founder ops), Android adaptive icon → Open Burrow + foreground asset, top-level icon/splash image.
- **T3.2 (test+impl):** "Delete my data" flow (compose existing wipes), both surfaces; `app-config`/deletion test asserting a clean first-run end state.
- **T3.3 (ops/docs):** encryption-export self-classification + App Store Connect answers; privacy labels (Apple) + Data Safety (Play); background-mode justification note; privacy policy + deletion-instructions web pages; store metadata + screenshots (honest, no simulated-transport claims).

### Phase 4 — Device QA + live-relay gating (C) — LAST
- **T4.1:** 2-device exit demo (7 rungs) → sign-off doc.
- **T4.2:** 3-device exit demo (convergence + no fan-out) → sign-off doc.
- **T4.3:** add background/push native deps + EAS dev profile; run the 7-step background QA checklist.
- **T4.4:** run the 6-step save-destination QA checklist (Android SAF + iOS share sheet).
- **T4.5:** consume plan 20's relay; set `DEFAULT_RELAY_URL` / hard-gate onboarding; run `publish-relay-image.yml` (tag `relay-v*`); `wan-smoke.e2e.test.ts` against the live `wss://`; uptime green ≥48h.
- **T4.6:** Playwright e2e for `@mylife/meerkat-web` in CI.

---

## Acceptance Criteria

### User-facing (AC)
- **AC-1:** On a fresh install, a user who pastes a valid recovery key + encrypted backup is restored to the SAME identity (same safety code / fingerprint) on both mobile and web.
- **AC-2:** After restore, the app honestly states content is not restored until re-pair/re-sync; it never shows fabricated message/community counts.
- **AC-3:** A bad recovery key or a mismatched backup changes nothing and shows the exact error copy.
- **AC-4:** Marking a report "Reviewed" keeps the content hidden and keeps the item in the owner queue with a "Reviewed — still hidden" pill; only "Un-hide for me" shows it again.
- **AC-5:** Reporting a file from the in-chat attachment card hides the same row in the Files index, and vice-versa.
- **AC-6:** The Files-index Request button performs a real request (statuses requesting/requested/restored/declined); no "coming in a later update" copy exists anywhere.
- **AC-7:** The mobile Feed shows distinct loading, empty, error (with Retry), success, and partial states; none invent activity.
- **AC-8:** "Delete my data" returns the app to a clean first-run on both surfaces.
- **AC-9:** Publishing a friend code shows copy that the server cannot read the published record; resolving an extended code still pairs.
- **AC-10:** The Android install/launch shows the Open Burrow brand (no `#060B0A`); the app builds and submits with a real EAS id.

### Technical (TC)
- **TC-1:** `restoreIdentityFromRecovery` re-homes private keys via `storeDeviceIdentitySecrets` and returns a `DeviceIdentity` matching the export; added to the `node/index.ts` named re-exports so it resolves on the native barrel (`index.native.ts` via `export * from './node'`).
- **TC-2:** `isRecoverableIdentityConsistent` rejects any export whose public key is not derivable from the private key (both Ed25519 and X25519).
- **TC-3:** The sealed rendezvous record on the relay is `secretbox` ciphertext; the secret half is never transmitted (only the HKDF-derived `rid`).
- **TC-4:** The Noise leg advances a chaining key per message; a forced static-key downgrade fails the session.
- **TC-5:** `isCommunityContentReportHidden` returns true for `status IN ('active','reviewed')` and false only for `'dismissed'`.
- **TC-6:** `communityFileReportTarget` is the single id source for both report surfaces; a migration reconciles legacy `file`-kind rows.
- **TC-7:** The `saveFilesBulk` complexity gate passes 5/5 under parallel load (deterministic op-count proxy).
- **TC-8:** `cm_safety_actions` remains absent from `COMMUNITY_SYNC_POLICY.entityRules` (parity check green).
- **TC-9:** `wan-smoke.e2e.test.ts` records a real `sync_session` with non-zero bytes against the live `wss://` endpoint.

### Negative (NC)
- **NC-1:** Restore must NOT pull any data over the network — it reads only the user-supplied backup.
- **NC-2:** The "Reviewed" action must NOT un-hide content.
- **NC-3:** No moderation state (`cm_safety_actions`) may ever replicate to another device or member.
- **NC-4:** The friend-rendezvous record must NOT contain readable identity material after D.5.
- **NC-5:** The Noise upgrade must NOT silently fall back to a static key.
- **NC-6:** No screen, store listing, or marketing string may imply WebRTC/Nearby/BLE/torrent are live, or claim "MLS"/"no device ids" without the caveats (until D.5/D.6 land).
- **NC-7:** Account deletion must NOT claim it can delete data already on someone else's device or an expired relay record.
- **NC-8:** No count anywhere (feed, files, queue, sessions) may be fabricated; every number traces to a real row.

---

## Test Plan (unit / integration / e2e + verification tier)

| Area | Test | Type | Tier reached | Remains manual/ops |
|---|---|---|---|---|
| Recovery restore | `recovery-key.test.ts` round-trip + tamper + wrong-key | unit | **A** | — |
| Restore UI (mobile/web) | provider + sheet render/flow; `identity-durability.test.ts` | integration | **A** | physical fresh-install restore = C.1 rung |
| Sealed rendezvous | publish-seal → relay opaque → resolve-decrypt-verify e2e | e2e (loopback) | **A** (loopback), **C** for live relay | live `wss://` = T4.5 |
| Noise FS upgrade | `noise-redteam.test.ts` chaining + downgrade-reject; engine session e2e | unit + e2e | **A** | — |
| Reviewed-stays-hidden | rewritten `community-safety.test.ts` | unit | **A** | — |
| Attachment-id unification | cross-surface hide test + migration | unit | **A** | — |
| Files-index Request | request-flow wiring test + `/browse` | integration | **A** | live owner approve over relay = C.5 |
| Mobile Feed states | feed-status parity test + `/browse` 5 states | integration | **A** | — |
| Delete my data | clean-first-run end-state test | integration | **A** | store-review verification |
| Perf gate | op-count slope meta-test under load | unit | **A** | — |
| Exit demo 2/3 device | `multi-node-2device/3device-e2e` (loopback) | e2e | **A** loopback; **D** physical | C.1/C.2 human |
| Background + push | pure jobs Vitest; OS cadence | — | **A** jobs; **D** OS | C.3 human + APNs/FCM ops |
| Save dialogs | `file-save.test.ts` behind adapter | unit | **A**; **D** live dialogs | C.4 human |
| Live relay fleet | `wan-smoke.e2e.test.ts` (env-gated) | e2e | **C→ real WAN** | C.5 ops |
| Web browser e2e | new Playwright job | e2e | **A→ Tier-up** | C.6 |

What remains genuinely manual/ops after this plan: the physical 2/3-device exit demo, OS background cadence + push delivery, live OS save dialogs, the live relay fleet uptime, and store-review approval. These are intrinsically Tier-D (human/hardware/ops) and are tracked, not faked.

---

## Edge Cases

- Restore on a device that ALREADY has an identity (Settings path): strong confirm; the old identity + its pairings on that device are discarded; content stays until cleared.
- Recovery backup from a newer `version` than the running app: `openRecovery` validates `version===1` (`recovery-key.ts:158`); a future version returns null → "This backup was made by a newer version of Meerkat."
- Friend code typed as legacy (non-extended) during the transition: resolve under `allowLegacyUnsealed`; after the window, legacy publishes are gone and only sealed resolve.
- Noise: a peer on an old build without the required ephemeral leg → session fails closed with a clear reason (not a silent plaintext/static downgrade).
- Reviewed → Un-hide → re-report the same content: idempotent via the deterministic `cm_safety_actions` id (`community-safety.ts:34-41`); status flips back to `active`.
- Attachment-id migration runs once but is re-entrant (INSERT OR REPLACE on the canonical id); double-run is harmless.
- Account deletion mid-flight interruption (app killed): re-runnable to completion; never leaves a half-identity that can sign.
- Mobile Feed error during migration: the error card must not crash the tab; Retry re-reads after the migration settles.
- EAS id committed but wrong account: build fails fast at `eas build`; not a runtime risk.
- Live relay down at launch with `DEFAULT_RELAY_URL` set: onboarding/honest copy must still say "waiting," never "connected" (preserve `OnboardingGate.tsx:388`).

---

## Risks + Honesty Landmines

- **Noise upgrade is the heaviest, highest-risk change** (D.6). Replacing a wired handshake in the security spine can regress session establishment. Mitigation: keep the public `NoiseHandshake` surface stable, land behind the full `packages/sync` suite (1,180 cases) + the new red-team gate, and do it in Phase 1 with no parallel session-protocol edits. **Specifically serialize D.6 against plan 21 (full DMs):** plan 21 also edits `packages/sync/src/protocol/sync-session.ts` (DM mailbox-token wiring) — the same security-spine file D.6 rewrites for the Noise leg. Do not run the two concurrently on `sync-session.ts`; land D.6 first and rebase plan 21 onto it (or vice-versa), never in parallel. Do NOT ship marketing that says "forward secrecy" until this lands and its gate is green.
- **Marketing/legal landmine:** until D.5 and D.6 land, the store listing and any marketing must carry the review's blocker-#8 caveats — "simplified Noise," pairwise (non-MLS) group keys, and an un-sealed rendezvous bundle. After they land, the listing can truthfully drop the rendezvous and FS caveats; the group-keys "not MLS/TreeKEM" caveat stays until a real MLS migration (out of scope here; honest-limit).
- **Recovery copy landmine:** never imply restore brings back content. The new copy (A.4) must state content re-flows only after re-pair/re-sync.
- **Account-deletion landmine:** never claim deletion reaches other devices or already-published relay records; state they expire.
- **Cross-plan timing:** Phase 4 cannot complete before plan 20 (relay) is deployed; gating on a not-yet-live relay would tempt a fake "connected" state. The honesty rule forbids it — keep `DEFAULT_RELAY_URL` empty (honest) until a real endpoint exists, then flip.
- **Flaky-gate false confidence:** until E lands, a green CI badge is not trustworthy for launch sign-off; do Phase 0 first.
- **Store rejection risk:** Apple rejects apps with account creation but no in-app deletion. Meerkat has no server account, but ship the deletion flow + the privacy-policy/deletion URLs anyway to pre-empt review friction.

---

## Sequencing / Dependency Note (vs the other 5 Meerkat launch plans)

This is plan 23 of a six-plan launch set. Cross-plan relationships:

- **Plan 18 (theme system):** SOFT. Independent of launch-readiness, but final store screenshots (B.3) should use the shipped theme set. Do screenshots after 18 lands; everything else here is theme-agnostic.
- **Plan 19 (public social layer):** UNBLOCKED as of 2026-07-01 (Plan 19 is code-complete, including the P9 archive and FF3, minus owner-side auto-approve wiring). The store listing copy ("public channels/communities/forums free to view," review §committed) can now be finalized against 19's shipped behavior; account deletion (B.2) must still account for any public content a user published.
- **Plan 20 (connectivity + self-hosting):** HARD. Owns the deployed `wss://` relay, the published public relay image, and the non-technical self-host UI. This plan's Phase 4 (C.5) VERIFIES and GATES on those deliverables (`DEFAULT_RELAY_URL`, `publish-relay-image.yml`, `wan-smoke.e2e.test.ts`). Phase 4 cannot complete before 20.
- **Plan 21 (full DMs):** SOFT for scope, but a HARD edit-conflict to serialize. Once DMs land, the exit demo gains a DM rung and recovery-restore must leave the device able to re-derive DM mailbox tokens after re-pair (verify in C.1). **Edit-conflict:** plan 21's DM-mailbox work edits `packages/sync/src/protocol/sync-session.ts` — the same file D.6 rewrites for the Noise leg. Sequence D.6 (Phase 1) and plan 21's session-protocol edits serially; do not let both touch `sync-session.ts` concurrently. Land D.6 first or rebase plan 21 on it.
- **Plan 22 (monetization + billing):** HARD for the final submit. Owns the IAP/paywall/StoreKit-RevenueCat plumbing and the "$4.99 means three things" reconciliation (review blockers #2, #3). This plan owns the *non-billing* compliance bundle (EAS id, icon, account deletion, encryption export, privacy labels, metadata), which can proceed independently; the actual store *submission* waits on 22.

**Net build order:** Phases 0-3 of this plan run immediately and in parallel with 18-22. Phase 4 is the all-up launch gate and runs LAST — after 20 (relay) is live and after 21 (DMs) and 22 (billing) land — so the exit demo, store submit, and live-relay smoke cover the final shipping feature set. Plan 23 is therefore the last plan to fully complete: it is the gate that turns 1,559 green tests into a confident `$4.99` release.

---

## gstack Quality Gates

- After every code change: `/function-gate-runner` (must pass) + `/review` (fix AUTO-FIX).
- After UI work (restore sheet, owner queue, files index, feed states, delete flow): `/browse` over the affected route on BOTH surfaces, verifying all 5 states.
- This is a Complexity-1 (Complex) plan touching the security spine: `/plan-eng-review` BEFORE building, `/office-hours` (builder) for the Noise upgrade approach, `/qa` on each surface after Phase 2, `/design-review` after Phase 2/3 UI.
- Engine work: prove D.5/D.6 with cross-client e2e (per `packages/sync/CLAUDE.md`).
- Post-merge: `/parity-check` (mobile↔web; `cm_safety_actions` policy absence), `/ship`, `/document-release`.

## Status Delta (2026-07-04)

- D.6 Noise forward secrecy DONE (commits f67886c8 + 100b297c, 2026-07-01).
- EAS projectId DONE: real id `c662e59e-1950-4b9e-ae0e-262bc3bbfdf1` in `app.json`.
- NOT built: D.1 recovery restore, brand/icon assets (none exist, no assets dir), D.7 Downloads screen, web Playwright CI, `community-safety.ts` un-hide correctness check, store/legal bundle.
- Those remaining items are codeable; store submission itself stays founder-ops.

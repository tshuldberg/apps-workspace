# Plan 53: Meerkat In-Person Tap-to-Add - Proximity Friend Ceremony over Nearby

- **Status:** active (2026-07-29: P0-P5 codeable scope COMPLETE on `feature/meerkat-plan52-person-identity`, commits 56812dec..post-P5. Remaining before done: the branch merges to main, the rc carrying plans 52+53 is cut and release-verify dispatched at that SHA, and the founder + friend TestFlight sweep supplies the live AC evidence. AC-3's native change is UNVERIFIED on device and its ledger row stays OPEN until TestFlight confirms it; the nearby browse-takeover recovery check rides the same sweep.)
- **Owner:** unassigned (execution session)
- **Created:** 2026-07-29
- **Depends on:** rc13 (defect fixes) merged. Executes in the rc14 train alongside plan 52 (person identity); rc14 carries both. Founder sequencing decision 2026-07-29.
- **Founder decision encoded here (2026-07-29):** two users in person, both tap one button in Meerkat, put their iPhones close together, and get a mutual "Confirm Adding [DisplayName]" popup; confirming on both phones establishes the friend link and DM channel. Symmetric (both tap the same button), no show-vs-scan roles, and it must work with no internet.

## Why this exists

Verified state of the code (2026-07-29):

- In-person adds exist today ONLY as the asymmetric QR flow: `add-friend.tsx` shows your friend-code QR and scans a friend's. It REQUIRES a connection server (`ADD_FRIEND_NEEDS_SERVER_LINE`, `resolveAddFriendRelay` -> `effectiveRelayUrl`); code resolution and pairing round-trip through the relay. No signal, no friend.
- The native proximity substrate is ALREADY BUILT and idle for this purpose: `packages/meerkat-native-transport` ships `MeerkatNearbyModule.swift` (MCNearbyServiceAdvertiser + MCNearbyServiceBrowser + MCSession, `advertise()`/`browse()` bridged via `loadNativeNearbyModule`) and the Android Wi-Fi Direct twin. Its only UI consumer is `transport-diagnostics.tsx`; it moves sync data between already-paired devices and is never used to CREATE a pairing.
- No mutual-confirm ceremony exists anywhere. Pairing today is copy-paste `MKPAIR1-` codes (own devices) or the relay-mediated friend-code flow.
- Platform reality: iPhones expose no app-controllable phone-to-phone NFC "tap". Multipeer Connectivity IS the correct native mechanism for "phones close together" on iOS, and it is room-scale, not touch-scale, so the mutual confirmation step is a security control, not decoration.

## Product architecture (binding)

1. **One button, symmetric.** "Add in person" in Add Friend. Both users tap it; each phone advertises AND browses simultaneously under a fixed Meerkat ceremony service type. First mutually verified peer wins; the ceremony window is short (90 seconds) and cancellable.
2. **Nothing identifying in the air.** The discovery advertisement carries ONLY an ephemeral ceremony identifier generated per tap. No device pubkey, no display name, no stable value in the advertisement, so passively scanning a room reveals nothing about who is present. Identity moves only inside the established encrypted session (MCSession `encryptionPreference: .required`; Wi-Fi Direct equivalent).
3. **Signed bundle exchange, verified before display.** Inside the session, each side sends its signed friend bundle (the existing `MKPAIR1` bundle shape: deviceId, dhPublicKey, displayName, issuedAt, signature). Signatures verify before anything renders. With plan 52 landed, the displayed name is the sender's presentation-profile name.
4. **Mutual confirm with a short authentication string.** Both phones show "Confirm Adding [DisplayName]" plus a short authentication string (SAS) derived from the ceremony transcript hash, rendered identically on both screens (emoji or digits). Users visually compare; a mismatch means someone else is in the middle, and either side cancelling aborts. NOTHING persists until BOTH sides confirm: each side sends a signed accept over the session, and the link is written only after local confirm AND the peer's verified accept.
5. **Result = the same paired state as today's flows.** On completion both devices hold the standard pairing (shared secret via the existing DH derivation), the friend appears in Friends and Messages, and a DM thread is immediately startable. No relay involvement at any step; the next relay or direct session syncs as usual.
6. **The same ceremony pairs own devices.** The Sync screen's pairing section gains "Pair in person" reusing the identical ceremony, replacing copy-paste `MKPAIR1-` codes when both devices are physically together. This directly removes the worst UX friction found in the 2026-07-24 review.
7. **Fail closed everywhere the substrate is absent.** Expo Go (native module null): the button renders honest copy ("needs the full app"). Web: no Multipeer exists in browsers; web keeps QR + relay adds and the capability page says so plainly.

## Non-goals / guardrails

- NO NFC claims. Marketing and UI copy say "phones near each other", never "tap" as a hardware mechanism.
- NO relay fallback inside the ceremony. If Nearby cannot connect, the ceremony fails honestly and points at the QR flow; it never silently completes over the internet (defeats the no-signal promise and widens the MITM surface).
- NO weakening of the discovery-privacy rule: any long-term identifier in an advertisement payload is a spec violation, enforced by test.
- The ceremony cannot create person-group membership by itself (plan 52's mutual attestation still applies for OWN devices); "Pair in person" for own devices produces the pairing, after which the plan 52 linking flow runs unchanged.


## Amendments (2026-07-29, pre-P0 context verification)

A code-verified context pass found four places where this plan's assumptions do not match the shipped native transport. Recorded BEFORE any implementation, per the rule that plans are corrected rather than silently deviated from.

- **AC-3 is NOT satisfiable without a native change (blocking).** The plan assumes the discovery advertisement can carry an ephemeral per-tap ceremony id. It cannot today. `startAdvertising` builds `MCNearbyServiceAdvertiser(peer: session.myPeerID, discoveryInfo: nil, ...)` (`packages/meerkat-native-transport/ios/MeerkatNearbyModule.swift:237-241`), so the caller-supplied `displayName` is accepted and then never used, and `discoveryInfo` is nil, so there is no TXT payload at all. Worse for AC-3, `myPeerID` is `MCPeerID(displayName: "mk-" + UUID().prefix(8))` minted ONCE per module load and cached in `localPeerId` (:217-218), so the advertised identifier is STABLE across two consecutive ceremonies in the same process, which is exactly what AC-3 forbids. Note the comment at :235-236 claims the display name is "advertised verbatim" and is simply wrong. **FOUNDER DECISION 2026-07-29: option (a), fix the native plumbing.** `advertise()` must mint a FRESH `MCPeerID` per call from the caller-supplied ephemeral id, and the Android twin must honor `serviceType` and the ephemeral id instead of hard-coding its constants. AC-3 stands exactly as written: two consecutive ceremonies from the same phone advertise different ids, so a passive observer cannot link them. The founder accepted the schedule risk explicitly: both native files are marked UNVERIFIED, have never been compiled or run on a device in this repo, and the change can only be proven on a physical build, so P1 must treat the native edit as its own work packet with its own device-evidence row in the rc ledger, left honestly OPEN until a TestFlight build confirms it. The rejected alternative (carry the ephemeral id in the first in-session frame, leaving the advertised handle stable per app process) is recorded here only so a later reader knows it was considered and why it was not taken: it needs no native work but weakens the privacy claim, and the founder chose the stronger claim.
- **Android ignores `serviceType` entirely.** `startAdvertising(serviceType, displayName)` reads neither argument and hard-codes `INSTANCE_NAME = "meerkat"` / `SERVICE_TYPE = "_presence._tcp"` (`android/.../MeerkatNearbyModule.kt:61-62, 198-210`), and `startBrowsing` filters on the same constant. A distinct "Meerkat ceremony service type" is therefore honored on iOS only; on Android the ceremony shares the sync rung's discovery namespace.
- **There is no invite/accept handshake to build on.** iOS auto-accepts every invitation unconditionally (`invitationHandler(true, session)`, ios:371-378) and sends `withContext: nil`; Android has no invitation concept. The entire mutual-confirm ceremony is an application-layer protocol over raw bytes, which is what P0 must specify.
- **Native transport state is single-slot and module-global (P1 risk).** iOS holds one `mcSession`, one `advertiser`, one `browser` (ios:119-123), and `loadNativeNearbyModule()` builds a NEW bridge over the SAME native module on every call, whose `destroy()` tears down shared state (`src/index.ts:183-189, 208-210`). A ceremony adapter that loads the module independently can clobber the sync rung's advertiser/browser and kill its sessions. The adapter must either share one bridge instance with the sync rung or never call `destroy()`.
- **Encryption is asymmetric across platforms.** iOS sets `encryptionPreference: .required` (ios:221); Android uses a raw TCP socket with length-prefix framing and NO transport encryption (kt:66-119). A ceremony that assumes a confidential channel from the substrate gets it on iOS only, so the ceremony's own sealing cannot be optional.

**AC-5 is well supported.** A completed pairing is exactly one `sync_pinned_identities` row, one `sync_paired_devices` row, and one keychain shared-secret entry, all produced by `applyTrustedBundle` from a verified `SignedIdentityBundle`. Byte-equivalence is best guaranteed by routing the ceremony's verified bundle through that same function rather than reimplementing it.

**Transport NC gate:** none of AC-3, AC-4, AC-5, AC-6, or NC-1 is statically checked today. `scripts/check-meerkat-transport-nc.mjs` never reads the native transport package, the sync protocol directory, `add-friend.tsx`, `sync.tsx`, or `capability-status.ts`. The one gate a new ceremony SCREEN can trip is NC-42.7, which fails any file under `(tabs)/` or `providers/` containing `defineTask(`.

## Amendment (2026-07-29, during P1)

- **The shared native module fans events to every bridge, and P1 had to defend against it.** `loadNativeNearbyModule()` builds a NEW bridge over the SAME native module, and the raw `sessionOpened` / `peerFound` events fan out to all of them. So the sync rung's incoming sessions surface inside the ceremony adapter. Adopting one would make it "our" session and close it at ceremony teardown, killing live sync work. The adapter therefore WATCHES an incoming session and adopts it only after it delivers a valid ceremony hello; anything else is never adopted and never closed. Buffered frames are replayed into the adopted reader so a bundle that overtakes its hello is not lost. Two tests pin this and both fail if the guard is removed.
- **The ceremony temporarily takes over the nearby discovery slot, and this is not yet resolved.** The native side keeps ONE advertiser, ONE browser, and one `serviceType`, so `browse(CEREMONY_SERVICE_TYPE)` replaces whatever the sync rung was browsing for, and the ceremony's `advertise` rebuilds the session under a fresh peer id. The rebuild is guarded (the native side refuses with `ERR_IDENTITY_BUSY` when sessions are open, and the adapter fails honestly rather than advertising a stale id), but the browse takeover is not. For the 90-second ceremony window the nearby sync rung is effectively paused. P2 must state this in the UI copy rather than hide it, and the founder device sweep should confirm the sync rung recovers after a ceremony ends. Left OPEN rather than claimed fixed.

## Phases

- **P0 Ceremony protocol (packages/sync, pure, transport-injected).** State machine: idle -> advertising+browsing -> session -> bundles exchanged/verified -> SAS displayed -> mutual accept -> committed | cancelled | expired. Ephemeral ceremony ids, transcript hash + SAS derivation, signed-accept format, timeout and cancel semantics, replay rejection. Threat model: in-room MITM, advertisement tracking, unilateral-commit races, stale-ceremony replay.
- **P1 Native ceremony adapter (mobile).** Drive `NativeNearbyModule` advertise+browse concurrently, session lifecycle, permission prompts (iOS local-network copy extended to cover in-person adds; Android NEARBY_WIFI_DEVICES already configured), teardown on complete/cancel/background.
- **P2 UI.** "Add in person" in `add-friend.tsx` -> ceremony screen (searching, found, "Confirm Adding [DisplayName]" + SAS, linked). "Pair in person" in the Sync pairing section reusing the same screen. Expo Go honest fallback; web add-friend copy updated.
- **P3 Plan 52 integration.** Confirm popup shows the presentation-profile name; on completion, exchange the community/DM-scoped person announce so the new friend renders as a person immediately; DM thread opens from the success screen.
- **P4 Honesty surfaces + parity.** Capability-status entries both platforms (mobile: live on a dev build; web: not possible in a browser, QR instead), `check:meerkat-parity` extension, tester-guide section for the in-person sweep.
- **P5 Tests + rc14.** Protocol suite (all state-machine paths, SAS vectors, forged/replayed bundles), adapter suite over a fake native module, advertisement-payload shape test, no-relay-traffic assertion, full battery, rc14 ledger notes with plan 52. Live AC evidence lands in the founder + friend device sweep on TestFlight builds.

## Acceptance criteria

- AC-1: Two phones with NO configured relay and no internet complete an in-person add; both confirm popups show the correct peer name and identical SAS; both must confirm; a DM sends successfully on the next session.
- AC-2: Either side cancelling, the 90s window expiring, or the app backgrounding mid-ceremony persists NOTHING on either device.
- AC-3: The discovery advertisement contains no long-term identifier (payload-shape test); two consecutive ceremonies from the same phone advertise different ephemeral ids.
- AC-4: A forged or unsigned bundle, a bundle whose signature does not match its deviceId, or a replayed prior-ceremony accept is rejected and surfaces an honest error.
- AC-5: "Pair in person" for own devices yields a paired state byte-equivalent to the `MKPAIR1-` copy-paste flow (same rows, same shared-secret derivation).
- AC-6: Expo Go and web fail closed with honest copy; no surface implies proximity adding where the substrate is absent.
- NC-1 (negative): zero relay dials occur during a ceremony (transport spy); the ceremony cannot complete over any transport other than the Nearby session.

## Founder-ops (outside this plan's code)

The dev/TestFlight build (already on the TestFlight track): the Nearby native module is null in Expo Go, so live AC evidence requires installed builds on two physical iPhones - which the planned founder + friend sweep provides.

# Plan 59: Meerkat for Everyone

- **Project:** Meerkat (`apps/meerkat/`, `apps/meerkat-web/`, `packages/sync/`, `packages/meerkat-relay/`, `scripts/check-meerkat-parity.mjs`)
- **Created:** 2026-09-01, development-ready after the launch and product evaluation (`docs/reports/REPORT-meerkat-launch-product-evaluation-2026-09-01.md`) and the technical review (`docs/reports/REPORT-meerkat-fable-review-2026-09-01.md`)
- **Depends on:** nothing new. Plans 16, 29, 31, 52, 53 are done and this plan changes their defaults and surfaces. The two self-host node fixes (R1, R2) from the technical review should land in the same rc train but are a separate small wave.
- **Status:** queue, READY FOR DEVELOPMENT. Kickoff prompt: `docs/prompts/59-meerkat-for-everyone-kickoff.md`.
- **Founder directions 2026-09-01 (binding):** (a) QR codes for adding and finding people the way Venmo and Signal do it, that add a friend or start the friend sync; (b) de-techify: powerful and usable by people of every age and skill level; (c) evaluate and adjust the UI/UX to be more user friendly; (d) the target is to replace TikTok scrolling, Facebook, Reddit, Reels, Slack, and Discord. This plan delivers (a), (b), (c), and the Slack/Discord/Facebook-side of (d). Clips (the TikTok and Reels side) is a separate design-first plan and is out of scope here.
- **Founder mandate applies:** full production-grade function, no deferred slices.

## Equipment audit: what exists today vs what this plan builds (verified 2026-09-01 at `ee80cd7b`)

**EQUIPPED TODAY (verified in code):**

- Friend codes: `MEER-XXXX-XXXX-XXXX-XXXX`, Crockford base32, 2-byte checksum, no key material (`packages/sync/src/node/friend-code.ts`). Extended codes append `~<secret half>` (`friend-code.ts:276-330`) and the published record is sealed with `HKDF(secretHalf, 'meerkat-rendezvous-seal-v1')` so the relay cannot read it (`friend-rendezvous.ts`, Plan 23 D.5). Resolve verifies the self-signature and pins on first use (TOFU, `identity-bundle.ts`).
- Relay rendezvous lane: `publish` stores an opaque record for at most `rendezvousTtlMs` = 10 minutes and `resolve` CONSUMES it on first read (`packages/meerkat-relay/src/hub.ts:174-208`, `protocol.ts:41`). The host registry `announce` lane is the non-consuming, multi-slot, 30-minute sibling (`hub.ts:221-277`).
- QR: pure-TS encoder in `@mylife/meerkat-theme` (`qr.ts`, `qrCanEncode`), `QrCode.tsx` (SVG, black on white), `QrScanner.tsx` (lazy `expo-camera`, `isQrScannerAvailable()`), web `QrCodeSvg.tsx` (display only).
- Add friend (`app/(root)/(tabs)/add-friend.tsx` + `data/add-friend-core.ts`, web `AddFriendOverlay.tsx` + `lib/add-friend-core.ts`): shows the bare code as a QR (`:191`), "Publish my code" (manual, TTL-bound), "Scan their code" (in-app only), "Share my contact" (plain-text envelope via `invite-envelope-core.ts` + `install-url.ts`), full `ConnectionStatusCard`, and `ADD_FRIEND_NEEDS_SERVER_LINE` when no relay answers. After add the note says "Compare the safety code before sharing sensitive spaces."
- In-person ceremony (Plan 53, `add-in-person.tsx`): symmetric Multipeer / Wi-Fi Direct, mutual "Confirm Adding [Name]" + safety emoji, no relay. Dev or TestFlight build only.
- Deep links: scheme `meerkat` (`app.json:7`); routes handled for `community/join`, `share`, `theme`, `public`. `CommunityInviteLinkListener.tsx` is the pattern (cold start via `getInitialURL`, `url` event, one preview sheet, never auto-joins, coordinates with `OnboardingGate`). NO `friend` route. NO `associatedDomains`, NO Android intent filter, NO AASA file.
- Automatic connections (Plan 29): `auto_connect_enabled` setting, default OFF (`data/auto-connect-core.ts:28`), `useAutoConnectTriggers` runs one composed round on foreground and on paired-peer appearance; `AutoConnectCard.tsx` renders the honest last-round line.
- Background + push: `background_sync_enabled` default false (`data/background-sync.ts:280`); `registerBackgroundSync` / `registerPushWake` in `background-task-registration.ts` no-op when native modules are absent; `background-notify.ts` emits a notification only after a real applied>0 count. Web twin `web-push-registration.ts`.
- Person identity (Plan 52): one name across a person's paired devices, per-community overrides, device detail one expand away.
- Onboarding (`OnboardingGate.tsx`): "Private social, controlled by you", name, then create / join (scan or paste) / restore. Age gate precedes it. Invite deep links suppress the gate.
- Public join grants (Plan 19 P9): descriptor `joinPolicy: 'open'` + owner-signed grant -> `redeemPublicJoinGrant` (roster row only, no key access) (`packages/sync/src/protocol/public-join.ts:51`, `publication.ts:310`).
- Parity: `scripts/check-meerkat-parity.mjs` (2,356 lines) with `CORE_TWINS` (declarative core-lock registry, `:435`), `JOIN_NAME_COPY` string locks (`:340`), and the connection-card state strings.
- Prior UX baseline: `docs/reports/REPORT-meerkat-ui-benchmark-eval-2026-07-01.html` (Communities scored 4/10 vs Discord before Plan 31) and the 28-mockup user guide `docs/guides/meerkat-complete-user-guide-2026-09-01.html`.

**MISSING (this plan builds):**

1. A standing, always-resolvable friend code (today: manual publish, 10-minute TTL, consumed on first resolve).
2. A friend LINK (universal + scheme) that the phone camera opens, with install-then-resume and a web landing route.
3. One-tap add that ends in a DM, with the safety check moved to where it is meaningful.
4. Defaults that remove the manual session model from normal use (auto connections, background, push).
5. A screen-by-screen UI/UX evaluation and adjustment pass with a rubric and a stranger test.
6. A vocabulary glossary applied on both surfaces and locked by the parity script.
7. Starter communities so a day-one user with no invite sees life.
8. Web QR scanning.

## Non-negotiable positions (bind every section)

1. **Transport honesty is unchanged.** No state string, dot, count, or "delivered" line may exist without an engine row or a real probe. "Automatic" means the app tries on its own and shows the real result; it never claims a peer is online.
2. **The relay learns nothing new.** The standing identity record is SEALED with the extended code's secret half exactly as today (D.5). The relay stores an opaque blob under an HKDF rendezvous id; it never sees display names, keys, or who resolved whom. Enumeration stays infeasible (8 random id bytes) and rate limits apply per client key.
3. **TOFU and the safety check survive.** Resolution verifies the self-signature; first-use pinning is unchanged; the safety check is one tap away in every DM header and on every profile. Nothing auto-trusts.
4. **No account identifier beside a device identifier** (Plan 51 wall). The friend link carries the extended friend code only. The web landing page shows the display name from the SIGNED bundle and nothing else.
5. **Both surfaces, one behavior.** Mobile is canonical; web is a verbatim twin. Every new `*-core.ts` lands with a `CORE_TWINS` entry and every new user-facing string family lands with a `COPY_TWINS` lock in the same commit.
6. **Simplify by defaults and placement, never by removing capability.** Advanced screens keep every control; they move behind one "Advanced" door with a one-line explanation. No feature is deleted to look simpler.
7. **Copy register, not copy honesty, changes.** The glossary replaces architecture words with plain words; each replacement keeps the same truth value (see S6 table).
8. **The universal 18+ age gate, the private/public wall, and the mesh-sync rules (`.claude/rules/mesh-sync.md`) are untouched.**

## Work sections (one fable-5 agent per section; S-numbers are the execution order)

### S1: Standing friend code (sync + relay + both apps)

- **Relay:** add a non-consuming `identity` lane beside `publish`/`resolve` in `hub.ts` and `protocol.ts`: frames `identity_publish {rid, rec, ttlMs}` and `identity_resolve {rid}`. Record survives resolves; republish refreshes TTL; TTL clamps to a new `identityTtlMs` limit (default 30 days, env `RELAY_IDENTITY_TTL_MS`, min 1 day, max 90 days); `maxIdentityRecords` (default 100,000) and the existing per-client rate window apply; records are opaque strings capped at `maxRendezvousChars`. A device may `identity_revoke {rid, proof}` where proof is a signature over `rid || 'revoke'` by the key inside the sealed record: the relay cannot verify that (it cannot open the record), so revoke instead requires the publisher's connection-scoped client key that published it (same rule as `announce` slot ownership, `hub.ts:243`). Log redaction: rid only, never rec.
- **Sync:** `publishStandingIdentity` / `resolveStandingIdentity` in `packages/sync/src/node/friend-rendezvous.ts` reusing `createSignedIdentityBundle` + the D.5 seal; `resolveIdentityFromRendezvous` tries the standing lane FIRST, then the one-time lane (so codes published by older builds keep working through the transition). Sealed only: no legacy plaintext path for the standing lane.
- **Apps:** a "Let friends find me" setting (`mk_settings` `find_me_enabled`, default `'1'` after onboarding completes; never on before the age gate passes). While on, republish on app foreground when the last republish is older than 24 hours or the record is within 3 days of expiry (`mk_settings` `find_me_published_at`, `find_me_expires_at`, real values only). The Me screen shows the extended code and the QR with a one-line honest status from those two settings ("Findable until Oct 1" / "Not published yet: no connection server reachable"). Turning it off calls revoke and clears the status.
- **AC-1:** device A on, device B resolves A's code twice in a row; both succeed; the relay test proves the record was not consumed. **AC-2:** TTL expiry removes the record; a foreground republish restores it. **AC-3:** a relay operator test reads the stored record and cannot recover the display name or keys. **NC-1:** an unsealed (legacy) record on the standing lane is rejected by resolve. **NC-2:** with `find_me_enabled` off, the code does not resolve after the TTL runs out and no republish fires. **NC-3:** no republish fires before the age gate passes.

### S2: Friend links, universal links, install-then-resume (both apps + relay static route)

- Link format: `https://<MEERKAT_LINK_HOST>/add/<extended code>` with `meerkat://friend/<extended code>` as the in-app fallback. `MEERKAT_LINK_HOST` is a new `app.config.ts` `extra.linkHost` (env `MEERKAT_LINK_HOST`, default `''`: when empty the QR and share card fall back to the scheme link and the plan's install-then-resume path is honestly unavailable, mirroring `installUrl`).
- `app.json`: `ios.associatedDomains: ["applinks:<host>"]` and an Android `intentFilters` entry with `autoVerify`, both driven from `app.config.ts` so an unconfigured host emits neither.
- Relay: serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from a new static route in `packages/meerkat-relay/src/server.ts` (content from env: team id, bundle id, Android cert fingerprints). Serve `/add/<code>` as a minimal HTML landing (no scripts beyond one inline script, strict CSP like the operator console page): the inviter's display name (resolved server-side? NO: the relay cannot open the record; the page instead shows "Someone wants to add you on Meerkat" and the code, then an "Open in Meerkat" button and the install link). Display name appears only inside the app after the sealed bundle verifies. State this honestly in the page.
- Mobile: `FriendLinkListener.tsx` beside `CommunityInviteLinkListener.tsx` (same cold-start + url-event pattern, same onboarding coordination via a new `setDeepLinkFriendPending`), presenting the S3 add card. Web: route `/add/<code>` in the SPA opens the same card.
- Install-then-resume: after install with no pending URL, the app checks the pasteboard ONLY when the user taps "I have a code" in onboarding (no silent clipboard reads); iOS universal links already deliver the URL on first open when the app is installed from the link.
- "Share my contact" becomes the link plus one plain sentence; the QR on Me and Add friend encodes the link (QR capacity check: link length under 120 bytes fits version 6 at level M; add a unit test on `qrCanEncode`).
- **AC-1:** cold-start `meerkat://friend/<code>` and the https form both open the add card over any screen. **AC-2:** first-run install with a pending invite lands in the add card with onboarding suppressed, then completes onboarding on confirm. **AC-3:** the AASA and assetlinks routes return the exact JSON the platforms require (fixture-locked). **NC-1:** a link with a malformed code renders the typed error inside the card, never a crash. **NC-2:** no code path reads the clipboard without the explicit tap.

### S3: One-tap add that ends in a chat (both apps)

- Add card (`AddFriendSheet.tsx`, web `AddFriendCard.tsx`): resolves the sealed bundle, verifies, and shows avatar initial, display name, "Add [Name]" and "Not now". Confirm pins + pairs (existing `pairWithFriendCode` path), writes the friend, and navigates to the DM thread. The success line is "You and [Name] are connected" (a real pairing row).
- Safety check relocation: remove the warning from the add success path; the DM header and the person profile carry "Verify it is really [Name]" (existing safety-code compare + "Mark safety code checked"). Sensitive-space gating (SAS mandatory before community sync, 2026-08-24) is untouched and now prompts inline where the gate fires.
- Add friend screen restructure: top = your QR + link + "Share my contact"; middle = "Scan a code" (camera) and "Enter a code"; bottom = "Add in person" (Plan 53). The `ConnectionStatusCard` moves to Advanced; the add screen shows a single inline line when no relay is reachable ("Meerkat's relay is not reachable right now. Try again, or add in person.").
- Web scanning: `BarcodeDetector` when present (Chromium), else paste; both surfaces share `add-friend-core.ts` link parsing (new `parseFriendLink` handles https, scheme, and bare code; `CORE_TWINS` entry).
- **AC-1:** scan -> card -> Add -> DM open with a real pairing row in `sync_paired_devices`. **AC-2:** web paste of the https link resolves the same card. **NC-1:** a bundle whose signature fails renders "This code could not be verified. Ask them to share it again." and writes nothing. **NC-2:** no online dot, no "delivered" line on the new thread until a real receipt row exists.

### S4: Defaults that remove the session model (both apps)

- `auto_connect_enabled` default becomes ON for new installs (existing installs: a one-time upgrade prompt on first foreground, "Meerkat can now catch up with your friends automatically. Turn on?"). The round counter line stays honest and visible on the Messages screen header as a subtle "Last catch-up: 2 min ago" derived from `auto_connect_last_round` (real rounds only; "No catch-up yet" when none).
- `background_sync_enabled` and push registration: default ON in builds where `pushGatewayUrl` is configured AND the native module is present; both stay OFF and honestly labeled otherwise. The notification permission prompt appears after the first friend or community, never on first launch.
- The Sync screen (`app/(root)/sync.tsx`) moves under Advanced and is renamed "Connections". Its Engine, Pairing (MKPAIR1), LAN, and Recent sessions sections remain intact; "Pair in person" (Plan 53) is the first option in Pairing.
- **AC-1:** fresh install after onboarding shows automatic connections on with a real "No catch-up yet" line. **AC-2:** after one paired peer completes a round, the line shows the real time. **NC-1:** no build without a push gateway shows notifications as on. **NC-2:** no copy on any screen claims a peer is online.

### S5: UI/UX evaluation and adjustment pass (both apps)

This section is an evaluation first, then adjustments. The agent runs the app (dev build on simulator plus the web app) and scores every visible screen on the rubric before changing anything, records the scores in `docs/reports/REPORT-meerkat-ux-pass-2026-09-XX.md` (HTML twin), then makes the adjustments, then re-scores.

**Rubric (0 to 3 per item, per screen):**

1. First glance: can a stranger say what the screen is for in five seconds?
2. Primary action: is there exactly one obvious next thing to do?
3. Vocabulary: zero architecture words (S6 glossary) above the fold.
4. Empty state: tells the user what to do, not what the system lacks.
5. Depth: nothing advanced within one tap of a primary tab unless behind a door labeled Advanced.
6. Touch and reach: primary controls in the bottom half; text at least 15 pt for body; contrast passes WCAG AA in both palettes.
7. Feedback: every tap produces a visible state change within 100 ms (spinner, disabled, or navigation).
8. Recovery: every failure line says the cause and the next move.

**Adjustments already identified (must be done; the evaluation may add more):**

- **Feed:** empty state becomes "Your feed fills up as you join communities and add friends." with two buttons; the server sentence moves to Advanced. Keep "Why am I seeing this?". Add a floating compose button that opens a "Post to..." picker of the user's communities (posts already exist per channel).
- **Communities:** keep list-first (Plan 31). Empty state gets the S7 starter picks inline. Folder editor moves under a long-press.
- **Messages:** "Chats" and "People" stay; the "Meerkat never creates fake chats" hint is removed (true, but it reads as a warning); People rows get the Plan 52 person avatar and the "Verify" affordance.
- **Me:** becomes profile-first: avatar, name, "Edit profile", the QR and link with "Share my contact", then three rows: Notifications, Appearance, Settings. The fingerprint moves to "Verify it is really me" inside Edit profile. Items / Blocks / Stored counters move to Storage. "Advanced connection", "Advanced sharing", "What works today" move under Settings > Advanced.
- **Settings split:** `settings.tsx` becomes Profile, Notifications, Appearance, Backup (recovery phrase + encrypted backup + restore), Privacy (age gate status, delete my data, delete account), Unlock Meerkat, About. New `settings/advanced.tsx` holds Secure storage, Local file storage, Storage budget, Hosted services, Connection options (with the connection status card), Public directory, Background catch-up, Saved files, Link previews, Alpha readiness + Copy diagnostics, Reset identity. First line on Advanced: "You do not need anything here for normal use."
- **Onboarding:** unchanged structure; the "Restore your identity" link becomes "Already use Meerkat on another phone?" and leads to Plan 53 "Pair in person" first, recovery phrase second.
- **Upgrade:** unchanged pricing and honesty; the four footnotes collapse into one "What this unlocks" list.
- **Channel:** unchanged kit; the header audience label stays; the overflow menu labels pass the glossary.
- **Web:** the same placements in `SettingsOverlay`, `IdentitySection`, `AddFriendOverlay`, and the shell nav.
- **Accessibility:** every new control has `accessibilityLabel` / `aria-label`; Dynamic Type verified at the largest non-accessibility size on Me, Add friend, Messages.
- **AC-1:** every screen scores at least 2 on every rubric item after the pass, recorded in the report with before/after screenshots (simulator + Playwright). **AC-2:** no capability is removed (a checklist of every control on the old Settings and Me screens maps to a new location). **NC-1:** no new string violates the glossary (S6 lock runs in the battery).

### S6: Glossary and copy pass with parity locks (both apps + parity script)

Apply this table across `app/(root)` and `apps/meerkat-web/src`, both surfaces, keeping the truth value of each string. Technical screens under Advanced may keep the precise term in parentheses on first use.

| Today | Everywhere for normal use | Note |
|---|---|---|
| device, this device | this phone / this computer / your devices | platform-aware helper `deviceNoun()` in a new `copy-core.ts` twin |
| pair, pairing | connect, connection | "Pairing code" becomes "Connection code" |
| sync, sync now, session | catch up, update now, catch-up | "Recent sessions" becomes "Recent catch-ups" under Advanced |
| connection server, relay | Meerkat's relay | one explainer sentence, used once per screen: "It passes locked boxes and cannot open them." |
| identity, device identity | your Meerkat (profile), your keys (Advanced only) | |
| recovery key | recovery phrase | format unchanged (MKR1) |
| safety code, fingerprint | safety check | the code itself is still shown when checking |
| seal, sealed | locked | "Everything stays locked on your phone until it is shared." |
| friend code | your code | the label; the MEER- string is unchanged |
| publish my code | (removed: S1 makes it automatic) | |
| manifest, block, pin | (Advanced and Storage only) | |
| persona | public name | |
| workspace, epoch, descriptor, credential, entitlement | (never user-facing) | |

- Add `COPY_TWINS` to `check-meerkat-parity.mjs`: a list of `(label, mobileFile, webFile, exportName)` for every exported copy constant family (existing `JOIN_NAME_COPY` folds in), plus a forbidden-word scan over user-visible strings in both trees (the audit script from the evaluation, ported to the parity script, with an allowlist for Advanced screens and for correct uses such as "Block this person").
- **AC-1:** the forbidden-word scan reports zero hits outside the allowlist on both surfaces. **AC-2:** every changed string keeps its test (existing string-lock tests updated in the same commit, never deleted). **NC-1:** no honesty string on the connection card, mailbox drain, join queue, or upgrade screen changes meaning (fixture diff reviewed by the orchestrator).

### S7: Starter communities (both apps + founder content)

- `app.config.ts` `extra.starterCommunities`: a JSON array of `{ name, tagline, inviteLink }` from env `MEERKAT_STARTER_COMMUNITIES` (default `[]`; empty renders nothing). Each link is a Plan 19 P9 open-join publication with an owner-signed grant whose validity window is set by the founder (the code honors whatever `expiresAt` the grant carries and hides an expired starter automatically).
- First-run step after name: "Pick a few to start with" showing the starters as cards with Join (the existing preview + join pipeline; never auto-joins). Communities empty state shows the same cards. Feed uses them as sources like any community.
- Founder-ops (documented in the plan's runbook section): create the founder-run communities on the founder's always-on node (Plan 57), publish them with `joinPolicy: 'open'`, mint the grants, put the links in the env, rebuild.
- **AC-1:** with three starters configured, a fresh install joins one from the picker and the Feed shows its posts after the first real catch-up. **NC-1:** with none configured, no picker step and no empty cards. **NC-2:** an expired grant renders nothing rather than a broken Join.

### S8: Stranger test, battery, parity, docs

- Stranger test protocol (`docs/guides/meerkat-stranger-test-2026-09.md`, stranger-readable per the instruction-writing rule): five people who have never seen Meerkat, three tasks each (add the founder as a friend from a QR on a printed card; join a starter community and post; find and turn on notifications). Success = task completed without help within 3 minutes. Record per-task time, help requests, and verbatim confusion quotes. The founder runs it; the agent prepares the cards, the script, and the results template. Plan exit requires 4 of 5 people completing all three tasks.
- Full battery: sync, relay, both apps, `check-meerkat-parity`, `check:esm-require`, hub consumer typechecks. Update `apps/meerkat/AGENTS.md` (tab list, add-friend model, defaults), the complete user guide's affected sections and mockups, and the launch marketing guide's "how to add a friend" copy.

## Sequencing and agent protocol

S1 -> S2 -> S3 are strictly sequential (each builds on the previous). S4 can run in parallel with S2. S5 starts after S3 (its Add friend adjustments depend on the new card) and runs its evaluation half first. S6 runs after S5's adjustments (so it locks final strings). S7 can run any time after S2 (it uses the deep-link pipeline). S8 last. One fable-5 agent per section, new agent per section; the orchestrator reviews each diff against the non-negotiables, runs the battery, and runs `codex review` on S1, S2, S3, and S6 before the next section starts.

## Scope

- `packages/meerkat-relay/src/{hub,protocol,server,log-redaction}.ts` (+ new static route module + tests)
- `packages/sync/src/node/{friend-rendezvous,friend-code}.ts`, `packages/sync/src/transport/rendezvous-client.ts` (+ tests)
- `apps/meerkat/app.config.ts`, `app.json`, `app/(root)/components/{FriendLinkListener,AddFriendSheet,QrCode,QrScanner}.tsx`, `app/(root)/(tabs)/{add-friend,me,settings,index,communities,messages}.tsx`, new `app/(root)/(tabs)/settings/advanced.tsx`, `app/(root)/sync.tsx`, `app/(root)/components/OnboardingGate.tsx`, `app/(root)/data/{add-friend-core,auto-connect-core,background-sync,copy-core,onboarding-core,invite-envelope-core,install-url}.ts`, tests
- `apps/meerkat-web/src/{lib,ui}` twins of the above
- `scripts/check-meerkat-parity.mjs` (`COPY_TWINS`, forbidden-word scan)
- Docs listed in S5 and S8

Out of scope: Clips / vertical video (separate plan), creator rails (Plan 58), self-host node fixes R1/R2 (separate small wave), any change to cryptographic primitives.

## Founder-ops (cannot be done by an agent)

1. Choose and register the link host (for example `meerkat.app` or a subdomain of the relay domain) and point it at the relay; provide the Apple Team ID and Android signing certificate fingerprints for the AASA and assetlinks files.
2. Set `MEERKAT_LINK_HOST`, `RELAY_IDENTITY_TTL_MS`, and `MEERKAT_STARTER_COMMUNITIES` in the EAS `testflight` and production profiles and in the relay deploy.
3. APNs key and push gateway deploy (Part 4.2 of the 2026-08-30 launch-task guide) so S4's push default can turn on.
4. Create and publish the starter communities (S7) and run the stranger test (S8).

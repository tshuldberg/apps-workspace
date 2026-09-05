# Meerkat Launch and Product Evaluation, 2026-09-01

Reviewer: Claude Fable 5.1. Tree: `ee80cd7b` on `docs/meerkat-launch-guides-2026-09-01`. Scope: the full Git history of the four Meerkat packages (`apps/meerkat`, `apps/meerkat-web`, `packages/sync`, `packages/meerkat-relay`) and the current code, read against three founder goals stated tonight:

1. Launch to the App Store and the world.
2. QR codes for adding and finding people, the way Venmo and Signal do it, that add a friend or start the friend sync.
3. De-techify: powerful, but usable by people of every age and skill level. Target: replace TikTok scrolling, Facebook, Reddit, Reels, Slack, Discord.

Companion document: the technical review from earlier tonight, `REPORT-meerkat-fable-review-2026-09-01.md`, covers security findings and code structure. This report does not repeat it; it evaluates the product against the goals.

## 1. Verdict in five sentences

The engineering is real and unusually honest: 490k lines, four packages, every gate green on HEAD, and a transport model that never claims a thing it cannot prove. The launch blockers left are almost all founder-operated (counsel, NCMEC, DMCA, Stripe, LiveKit, APNs, CI billing), plus two cheap self-host node fixes from the earlier review. QR add-friend already exists, but it is a developer's version of the feature: the code is only scannable from inside the app, only resolvable after the other person manually publishes it, and the record expires. The app is not yet de-techified; a string audit found 2,567 user-visible strings across 127 files and the single most common noun in them is "device". The Slack and Discord replacement is largely built; the Facebook replacement is half built; the Reddit replacement is built but locked behind public-tier services and legal work; the TikTok and Reels replacement does not exist in any form.

## 2. What the history says

| Measure | Value |
|---|---|
| Commits touching Meerkat packages | 422 (of 2,111 in the repo) |
| First sync foundation commit | 2026-04-22 (`880f1803`, mesh sync phases 0 to 7 in one day) |
| Standalone app landed | 2026-06-14 (`1af44fb3`) |
| Commits by month | Apr 10, Jun 76, Jul 260, Aug 65, Sep 8 |
| Authors | one (Trey) |
| Plans | 21 done, 5 active, 15 queued, 0 failed |
| Release candidates cut | rc1 through rc16 (July), rc17 and rc19 planned |
| TestFlight | build 17 is the first real-purchase build (2026-08-30); relay live at `wss://meerkat-relay-us.fly.dev` |

Three patterns stand out.

- **July was the production-hardening month.** 260 commits, most of them audits, adversarial reviews, and remediation plans (42, 43, 44, 51). The result is the honesty discipline you see in every screen, and it is the app's main differentiator against every platform it targets.
- **August was the composition month.** Plan 56 (Canvas, Pages, badges, stickers, the Plaza, asset packs) added a MySpace-class creative layer in ten days. That is a strength for communities and a distraction for launch: none of it is a blocker, and the founder's own launch-task guide already says so.
- **Every "make it easy" plan is done but not yet felt.** Plan 16 (friendly identity), 29 (seamless auto-connect), 31 (navigation and join), 52 (one person across devices), 53 (in-person tap-to-add) all shipped. The app still opens onto a manual Listen / Sync now model because automatic connections stay off by default. The plumbing for simplicity exists; the defaults do not use it.

## 3. Goal 1: launch

Nothing in code blocks a private-tier App Store launch. What blocks it is the founder-ops ledger in `docs/guides/meerkat-remaining-launch-tasks-2026-08-30.md`, still accurate tonight:

| Item | State | Blocks |
|---|---|---|
| Two phones on build 17 with a real purchase | Founder doing now | Private launch |
| Counsel engaged, DSA trader address, legal docs hosted | Open | Public launch |
| NCMEC ESP registration, DMCA agent | Open (weeks of lead) | Public launch |
| Stripe and hosted billing service deploy | Open | Web users |
| APNs push | Open | Daily use (see section 5) |
| LiveKit SFU and TURN | Open | Calls and rooms |
| GitHub Actions billing | Broken since 2026-07-30 | rc17/rc19 release-verify |
| Self-host node R1 and R2 (challenge spray, join-queue growth) | Open, from tonight's review | Offering hosted or self-host nodes |

Recommendation: launch the private tier to the App Store as soon as build 17 proves the purchase. Do not wait for the public tier. The wedge the founder's guide names, "a real end-to-end-encrypted community app on a deployed relay, honest about everything it cannot yet do," is ready. Everything in sections 4 and 5 should ride the first post-launch updates, not delay the launch.

## 4. Goal 2: QR add-friend

### What exists

- `add-friend.tsx` shows your friend code as a QR (`QrCode.tsx`, pure-TS encoder, black on white) and has a "Scan their code" button (`QrScanner.tsx`, `expo-camera`, lazy-loaded so Expo Go never crashes).
- Community invites already scan (`OnboardingGate` "Scan an invite QR"; web renders invite QRs).
- The in-person ceremony from plan 53 (`add-in-person.tsx`) is symmetric, relay-free, and ends in a mutual "Confirm Adding [Name]" with a safety emoji. It needs a dev or TestFlight build.
- Friend codes are well designed: `MEER-XXXX-XXXX-XXXX-XXXX`, Crockford base32, checksummed, no key material in the code. Resolution goes through the relay's rendezvous to a signed identity bundle, then TOFU pinning.

### Why it is not Venmo or Signal yet

| Venmo / Signal behavior | Meerkat today | Where |
|---|---|---|
| QR encodes a link; the phone's own camera app opens the app | QR encodes the bare `MEER-` string; only Meerkat's in-app scanner understands it | `add-friend.tsx:191`; no `meerkat://friend` route exists (only community, share, theme, public) |
| Scanning someone who does not have the app lands them on an install page that remembers who invited them | No universal link; `app.json` has no `associatedDomains`; "Share my contact" sends plain text with the code and an install URL | `invite-envelope-core.ts`, `install-url.ts` |
| My code is always valid | The code shown on Me is unpublished. Scanning it fails with "No identity is published for that code" until the owner taps "Publish my code", and that record is one-time and TTL-bound | `me.tsx:104`, `add-friend.tsx` publish path, `friend-rendezvous.ts:73` |
| Add needs no server the user knows about | Add needs a health-checked connection server; the screen shows the full connection card and "Adding a friend needs a connection server" when none answers | `resolveAddFriendRelay`, `ADD_FRIEND_NEEDS_SERVER_LINE` |
| After scanning, you are friends | After scanning, the note says "Compare the safety code before sharing sensitive spaces" and the DM does not start | `add-friend.tsx` add path |
| Works on the web app | Web shows the QR but cannot scan | `AddFriendOverlay.tsx:104` |

### What "done" looks like (recommended build)

1. **A standing code.** "Let friends find me" becomes a Me-screen toggle, on by default after onboarding. While on, the app republishes the rendezvous record on every foreground and before it expires, so the code on Me is always resolvable. Every republish is a real relay write, so the honesty rule holds. The relay needs a longer maximum TTL or a cheap re-publish endpoint; both are relay-side one-liners.
2. **A link, not a string.** The QR encodes `https://<meerkat domain>/add/MEER-...` with `meerkat://friend/MEER-...` as the fallback. Add `associatedDomains` (iOS) and an Android intent filter, host the apple-app-site-association file on the relay's static route, and register a `friend` deep-link listener beside the existing `CommunityInviteLinkListener`. The same link works when pasted into Messages, so "Share my contact" becomes a real card.
3. **Install-then-resume.** The web route for `/add/MEER-...` shows the inviter's display name (fetched from the signed bundle, nothing else), an install button, and re-fires the deep link on first open. This is the Signal `signal.me` pattern.
4. **One tap to friends and a chat.** After the bundle verifies, show one card: name, avatar initial, "Add [Name]". Confirming pins, pairs, and opens the DM. Move the safety code comparison to a soft prompt inside the DM header ("Verify it is really [Name]") instead of a warning on the add screen. The in-person Multipeer ceremony stays the way to add without any server.
5. **Web scanning.** Use `BarcodeDetector` where present, with paste as the fallback the web already has.

Estimate: two focused days for a fable-class agent on mobile plus web, one relay change, plus the founder-owned domain and AASA hosting. It fits in the first post-launch update.

## 5. Goal 3: de-techify

### Measured

A script pulled every JSX text node and capitalized string literal over twelve characters from `app/(root)` (screens, components, providers, data copy) and counted technical vocabulary.

| Word | Strings containing it |
|---|---|
| device | 321 |
| server | 141 |
| verif- | 113 |
| key | 83 |
| sync | 81 |
| sign- | 68 |
| identity | 67 |
| encrypt- | 59 |
| pair- | 54 |
| session | 28 |
| friend code | 28 |
| seal, persona, workspace, peer, manifest, credential, relay, decrypt, safety code | 12 to 17 each |

2,567 candidate strings, 127 files with at least one hit. Some of those uses are correct (a "Block this person?" dialog is fine), but the top of the table is the honest signal: the app talks to its users in the vocabulary of its own architecture.

### Where a non-technical person gets lost, in order of damage

1. **The manual sync model.** The Sync screen still says "tap Listen on one device, then Sync now on the other within a few minutes," shows "This device's pairing code" and "Paste the other device's pairing code," and includes a "bellwether" pad. Automatic connections (plan 29) exist but default off. For a Slack or Discord replacement, the user must never think about sessions. This is the single biggest de-techify item and it is mostly a defaults and copy change, because the machinery is built and honest.
2. **No push.** A messaging app without notifications is a website. APNs is wired behind a dev-build flag (`background_sync_enabled` default false). Until push is live, every "you have a message" moment depends on the user opening the app. This is a founder-ops item (APNs key, push gateway deploy) plus flipping the default.
3. **The Me screen leads with cryptography.** It shows the friend code in monospace, a "Privacy identity" section with the key fingerprint, and Items / Blocks / Stored counters. Venmo's equivalent screen shows a face, a name, and a QR. The fingerprint belongs one tap deeper under "Verify it is really me"; the counters belong in Storage.
4. **Settings is 1,103 lines and roughly twenty sections**, including Secure storage, Storage budget, Hosted services, Connection options, Public directory, Background sync, Alpha test readiness, Recovery key, Restore identity, Danger zone, and Delete my data. Split it: a short Settings (Profile, Notifications, Appearance, Backup, Privacy, Delete) and an Advanced screen that holds everything else with a one-line "You do not need anything here for normal use."
5. **Empty states point at infrastructure.** The Feed's first-run empty state says "New updates arrive once a connection server is configured. See connection status." A first-time user should see "Join a community or add a friend to get started" and nothing about servers.
6. **Vocabulary.** A glossary applied everywhere, both surfaces, locked by the parity script: device becomes "this phone" or "your phones"; pair becomes "connect"; sync becomes "catch up" or "update"; connection server becomes "Meerkat's relay" with a single explainer sentence ("it passes locked boxes and cannot open them"); identity becomes "your Meerkat"; recovery key becomes "recovery phrase"; safety code becomes "safety check"; seal becomes "lock". None of these weaken honesty; they change register.

What is already good and should be kept: onboarding ("Private social, controlled by you", pick a name, create or join), the five-tab bar, the chat kit, "Why am I seeing this?" on feed items, the age gate, and every honest state string on the connection card.

## 6. Goal 3, continued: replacing the platforms

Scores are 0 to 10 for "a normal person could switch today," judged from code, not aspiration.

| Target | Score | What exists | What is missing |
|---|---|---|---|
| Slack | 7 | Communities, channels, threads, mentions, reactions, files, DMs and group DMs, roles and badges, archived channels, search-free but organized | Push, always-on delivery, desktop parity for scanning, search across channels |
| Discord | 6 | All of the above plus themes, stickers, asset packs, Canvas, Pages, Plaza, rooms and calls in code | LiveKit and TURN deployed, push, easy always-on hosting (plan 57 node exists, R1/R2 open), server discovery |
| Facebook | 4 | Ranked feed across communities (mention, unread, reply, post, canvas, file), profiles, photos in libraries, link previews, one person across devices (plan 52) | Personal posts to friends outside a community, events, a friends list that feels like a social graph, notifications, birthdays and life moments |
| Reddit | 4 | Public tab with topics, personas, verified-human posts, public communities, Discover directory, join grants | Public-tier services deployed, counsel and NCMEC and DMCA, voting and sorting, a directory with more than the owner's device id as the byline |
| TikTok and Reels | 0 | `expo-video` is used only by the sealed library player; no vertical feed, no capture and compress pipeline, no recommendation | Everything |

Two honest observations.

- **The TikTok goal conflicts with the privacy architecture unless it is designed deliberately.** TikTok works because a central model sees everything. Meerkat's equivalent must be a local ranker over content the device already holds, seeded by communities and friends, with public verified-human clips as the open pool. That is a real product direction (a "Clips" channel kind over the existing sealed blob pipeline, a vertical player, and an on-device ranker that extends `rankScore` in `feed-core.ts`), but it is a multi-week plan of its own and should be written before any code.
- **Cold start is the unsolved problem for every consumer goal.** A person who installs Meerkat with no invite sees "Start your feed" with two buttons and a locked Public tab. The machinery to fix it already exists: public communities with open join grants (plan 19 P9). Ship three to five founder-run starter communities as baked-in invite links (Welcome, Meerkat News, one or two interest communities) so day-one users see life. This is a content and configuration task, not a feature.

## 7. Recommended order

1. **Now, founder:** prove the build 17 purchase, engage counsel, start NCMEC. Fix CI billing so rc19 can verify.
2. **Now, agent, one wave:** the two self-host node fixes (R1, R2) and the two provider catch blocks from the technical review. Small, and they close the only confirmed defects.
3. **First post-launch update, agent:** QR add-friend done properly (section 4), automatic connections on by default with the existing honest round counter, push default on once APNs exists, Me screen and Settings split, the glossary pass across both surfaces with parity locks, starter communities. Write this as one plan (suggested: plan 59, "Meerkat for everyone") so the copy, defaults, and QR work land together and the parity script grows with them.
4. **Second update:** Facebook-class personal posts (a friends-only channel per person is the cheapest honest model: it is a community of one owner with friends as members, which the crypto already supports).
5. **Separate plan:** Clips. Design first, including the on-device ranker and the abuse rails the public tier already has.

## 8. Method and limits

Read directly: Git log for the four packages (counts, dates, subjects), `add-friend.tsx`, `add-in-person.tsx`, `QrCode.tsx`, `QrScanner.tsx`, `friend-code.ts`, `friend-rendezvous.ts`, `invite-envelope-core.ts`, `install-url.ts`, `app.json`, `OnboardingGate.tsx`, `index.tsx` (Feed), `feed-core.ts`, `feed-view-core.ts`, `me.tsx`, `settings.tsx` section list, `public.tsx`, `discover.tsx`, the tabs layout, `package.json`, web `AddFriendOverlay.tsx` and `add-friend-core.ts`, plans 52, 53, 58, the 2026-08-30 launch-task guide, tonight's session log and technical review. The jargon audit script is in the session scratchpad and can be re-run against any tree.

Not done tonight: a device walkthrough (no build was launched), a review of the web app's screens beyond add-friend, and the plan 58 creator-rail worktree. Scores in section 6 are judgment calls anchored to files, not measurements.

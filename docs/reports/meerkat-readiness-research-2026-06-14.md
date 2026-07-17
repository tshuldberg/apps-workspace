# App Research Report: Meerkat Production Readiness

**Generated:** 2026-06-14  
**Project Path:** `/Users/trey/Desktop/Apps/MyLife/apps/meerkat`  
**Analyzed by:** Codex using `/research-app` skill

## Executive Summary

Meerkat is close to a credible private alpha, but it is not ready for broad production users yet. The cryptographic and protocol substrate is unusually strong for this stage: signed identities, friend-code rendezvous, SAS verification, manual relay/LAN sessions, encrypted channel messages, attachments, offline mailbox, and host-history protocol tests are all present. The gap is now productization: physical device QA, simpler testing flows, first-class save/download locations, deployed relay/host infrastructure, and stale docs/copy that still describe older milestones.

My readiness call: **private technical alpha after device-exit testing and relay deployment; not public beta until the file-transfer and community paths are one-tap, recoverable, and documented.**

## Project Identity

| Field | Value |
|---|---|
| Name | `@mylife/meerkat-app` |
| Description | Standalone Expo app for local encrypted node, file/message sharing, and invite-only communities |
| Primary language | TypeScript |
| Frameworks | Expo, React Native, Expo Router, Vitest |
| Status | Active, fast-moving feature branch |
| Git repository | MyLife monorepo |
| App path commits | 19 |
| First app commit | 2026-06-10 22:45:35 -0400 |
| Last committed app activity | 2026-06-13 22:23:02 -0400 |
| Current tree | Dirty before this report, including M7 community chat/read-state work |

## Current History

Recent app-relevant commits:

```text
aecd7e9af feat(meerkat): MK-057 offline channel-message delivery via mailbox
1f666b991 feat(meerkat): add channel chat history
771872822 docs(meerkat): rename collaborator explainer to MeerkatWalkthrough.html
5f8e3893a fix(sync): trust authority -- admin-only introductions, self+admin revocation, global SAS (audit P1)
0a65ec35e feat(meerkat): copy-tone polish, calm sentence-case labels
487f7d4e0 feat(meerkat): wire OS-driven dark mode (Open Burrow light + calm dark)
e99eb4836 feat(meerkat): Open Burrow reskin, light-first (look + feel only)
e50883787 fix(meerkat): mailbox identity leak, putBlock fail-loud, CLI token (audit P0 highs)
cc2d5fb33 feat(meerkat): MK-044 session security hardening (audit P0 criticals)
8a876dd3d feat(meerkat): M5 communities: signed descriptors + channels/roles
```

Important historical context:

- The 2026-06-12 audit found real P0 issues in relay/session encryption and honesty. Those findings triggered the hardening now documented in `CLAUDE.md` and the later commits.
- M7 session notes say channel chat/read state are code-complete, but native device exit-demo QA remains pending.
- The `README.md` and `Tickets/launch-plan.md` still describe a much older scaffold state with no peer transport, which conflicts with current `CLAUDE.md`.

## Codebase Metrics

| Metric | Value |
|---|---:|
| App disk size | 16 MB |
| Tracked source/config/docs files, excluding `node_modules` and `dist` | 43 |
| TypeScript source files | 13 `.ts`, 20 `.tsx` |
| Tests in app | 4 files, 42 tests |
| Estimated app TS/TSX lines | 7,160 |
| Production dependencies | 28 |
| Dev dependencies | 5 |

## What Is Built

### Local Node And Identity

- Persistent device identity uses Expo SecureStore and Expo Crypto before any identity/seal path.
- Local data is in `meerkat.db`; sealed blocks live under `documentDirectory/meerkat/blocks/`.
- The Share tab can seal/pin text, build links, and open content already pinned on this node.
- Important gap: the Share tab still does not fetch sealed share blocks from peers by link.

### Pairing And Trust

- Pairing by signed payload is present.
- Friend-code rendezvous through the relay is present.
- TOFU pinning, key-change blocking, SAS emoji verification, and local revocation are present.
- UX is still tester-hostile: relay URL, copied payloads, friend codes, and SAS all live in a technical Sync screen.

### Manual Transport

- Relay sessions are live but manual: one device listens, the other syncs with the same relay URL and phrase.
- LAN sessions are implemented for development builds with TCP socket and zeroconf adapters.
- Automatic dialing and background sync are not built.
- Push wake is not built.

### Communities

- Signed community descriptors, invite links, member lists, basic roles, and channels are present.
- The Communities tab creates and joins invite-only spaces.
- Channel rows navigate into a basic channel chat screen.
- Default channels are `general` and owner/admin-only `announcements`.

### Channel Chat And Attachments

- `cm_messages`, `cm_message_attachments`, and `cm_read_state` are defined.
- Messages are signed immutable events with HLC ordering.
- The chat UI supports send, optimistic pending state, edit, delete, attachment pick, image preview, and attachment export through the OS share sheet.
- Offline channel mailbox is wired as a best-effort relay mailbox enqueue for paired community members.
- Read state is personal replica data and is filtered out of shared community sessions.

### Host History

- The protocol library can build, encrypt, verify, and fetch channel history snapshots from a seeder node.
- The E2E test proves a fresh member can fetch a signed encrypted backlog from a lone host over HTTP.
- Product gap: the native app channel screen does not appear to call `fetchChannelHistory`. It only lists local recorded events and marks `partialHistory: true`.

## User Goal Fit

| Desired user capability | Current status | Notes |
|---|---|---|
| Transfer files between own devices | Partial | Attachment blob transfer exists in the channel-message path and tests, but physical device exit demo is pending. Generic share-link sealed-block fetch is still not wired. |
| Choose where received files save, such as iCloud, Google Drive, local device | Partial | The app exports attachments to cache and opens the OS share sheet. It does not maintain a user-selected default storage target or explicit save destination workflow. |
| Transfer files with a friend after encrypted handshake | Partial | Pairing, SAS, manual sessions, and attachments exist. Friend flow still needs a smooth happy path and real two-phone verification. |
| Always encrypted in transit | Strong but still needs device validation | Post-audit hardening says sessions default to required encryption and use pairwise frame envelopes. Automated checks pass, but production claims should wait on physical QA and a focused security regression suite. |
| Create Discord/Slack-style communities | Partial | Signed communities, channels, roles, chat, attachments, and unread badges exist. Missing: channel/category CRUD UI, richer roles, moderation, reactions, profiles, search, presence, notifications, voice/video, and reliable host-backed history in the app. |
| Server-backed community option | Protocol pieces partial | Relay server exists and seeder/hosted node code exists, but there is no production relay fleet, host provisioning flow, billing, or easy self-host app. |
| Localized no-server community option | Partial | Local-first data model and direct/manual sync exist. Without background sync, push wake, and peer discovery that works in normal app builds, it is not yet a user-friendly local Discord replacement. |
| Ping/receive update request | Partial | Offline mailbox can park sealed channel-message deltas. There is no push notification or inbox UX that says "Alice has an update, receive now." |

## Production Readiness

### Ready For

- Internal protocol validation.
- Founder-run two-device tests with engineering support.
- A private alpha for technically patient testers after a relay URL and test script are prepared.
- Demoing the core philosophy: local encrypted data, manual sync, invite-only communities, signed messages, attachment references, and honest partial-history states.

### Not Ready For

- Public production users.
- Non-technical friend/family testers without a guided setup.
- App Store/TestFlight expectations around background freshness and notifications.
- A generic "send any file to any device and save anywhere" promise.
- A Discord/Slack replacement promise.
- A production hosting claim until relay/host infrastructure is deployed and monitored.

## Testing Ease

### What Is Easy

Automated testing is good. These commands passed in this review:

```bash
pnpm --filter @mylife/meerkat-app test
pnpm --filter @mylife/meerkat-app typecheck
pnpm --filter @mylife/sync test -- channel-chat-session
pnpm --filter @mylife/sync test -- channel-history
pnpm --filter @mylife/meerkat-relay test -- mailbox-mode-e2e
pnpm --filter @mylife/meerkat-relay test -- channel-history-fetch
pnpm check:parity --quiet
```

Observed results:

- App tests: 4 files, 42 tests passed.
- Channel chat session: 3 tests passed.
- Channel history: 5 tests passed.
- Relay mailbox E2E: 3 tests passed.
- Relay history fetch E2E: 1 test passed.
- Parity passed, with existing standalone-repo warnings unrelated to Meerkat.

### What Is Hard

- Real user testing requires a development/native build for LAN.
- Relay testing requires a reachable relay URL and shared phrase.
- Pairing still asks users to handle payloads or codes, then manually verify SAS.
- No one-page tester checklist exists for "own device transfer," "friend transfer," and "community attachment."
- No in-app test mode or seed flow exists.
- No QR flow is present yet.
- No push/background loop means testers must remember to open the app and run/manual sync.
- No first-class log export or session diagnostic bundle is visible for a tester to send back.

## Design Assessment

The Open Burrow reskin is a major improvement over the earlier technical/cyber look. The palette and sentence-case copy are calmer and more globally legible.

The main design weakness is information architecture. The Sync screen is doing too much: engine state, pairing payloads, friend codes, relay URL, shared phrase, SAS, revocation, LAN IP/port, rung stats, and session history. That is acceptable for engineering QA but too operational for production testers.

Recommended product-level shape:

- **People:** paired devices, friend codes, QR pairing, SAS, revoke.
- **Transfers:** send file, receive inbox, choose save destination, progress, history.
- **Communities:** create/join, channels, members, server/host status.
- **Sync details:** hidden advanced screen with relay URL, LAN IP/port, rung stats, logs.
- **Storage:** default save target, export/open behavior, local cache size, wipe.

The app should avoid showing transport primitives as the main user journey. Users think in "send this file to my laptop" or "post this to #general," not "start a relay listener with phrase."

## Main Gaps

1. **Physical-device exit demos are still unchecked.**  
   M7's own done gate leaves the exit demo unchecked: two devices posting in channels, a third fetching host history, image attachment render, and no-host state.

2. **Generic file transfer is not done.**  
   Channel attachments exist, but Share-tab sealed-block fetch across devices is still documented as not wired.

3. **Save destination UX is only partial.**  
   Current attachment export writes to app cache and opens the OS share sheet. That may let a user send a file to iCloud/Drive manually, but it is not a first-class "save to this location" preference or receiver flow.

4. **Host history is protocol-proven but not app-integrated.**  
   `fetchChannelHistory` is Node-oriented and not exported through `index.native.ts`. The app has `mergeChannelMessageEvents`, but `ChatProvider` does not call the host-history fetch path.

5. **Community UX is still basic.**  
   Missing practical Discord/Slack expectations: channel creation, categories, permissions UI, moderation, profiles, reactions, search, presence, push notifications, and real server status.

6. **Testing is still engineer-led.**  
   The manual relay/LAN flow is honest but not self-serve.

7. **Docs and copy are stale.**  
   `README.md` and `Tickets/launch-plan.md` still describe no peer transport. `communities.tsx` also contains stale comments/copy about community content sync and host nodes being pending, despite M7 work.

8. **Production deployment is incomplete.**  
   `app.json` still has `extra.eas.projectId` as `REPLACE_WITH_EAS_PROJECT_ID`. Relay fleet, host nodes, monitoring, and release process are not productionized.

## Immediate Recommendations

1. **Choose the release target precisely.**  
   Ship target should be "private alpha for invited testers" first, not production. Define success as three working golden paths:
   - Own device: phone sends file to laptop/tablet, receiver saves to chosen location.
   - Friend: friend-code pair, verify SAS, send file, receiver saves to chosen location.
   - Community: create invite-only community, post message + attachment, offline peer receives later.

2. **Run and record the physical QA matrix.**  
   Minimum rig: two iPhones, one Android, one Mac host, one relay. Test same Wi-Fi LAN, LTE-to-Wi-Fi relay, app background/reopen, revoked peer, oversized file, missing blob, no host, and expired mailbox.

3. **Build the file-transfer receiver UX.**  
   Add a receive/download screen with explicit states: available metadata, downloading, verified, save/open, missing bytes, failed verification. Add a default storage/export setting. Keep OS share sheet fallback, but do not make it the whole product.

4. **Move testing setup out of the Sync screen.**  
   Add guided setup: "Pair a device," "Send a test file," "Receive from friend." Hide relay URL/phrase and LAN IP behind advanced options.

5. **Wire or de-scope host history in the app.**  
   Either make native app history fetch real, or change M7/product copy to say host history is protocol-ready but app fetch is pending.

6. **Update stale docs and UI copy before testers see them.**  
   README, launch plan, and Communities copy should reflect current reality.

## Short-Term Recommendations

1. Deploy a single baseline relay and document its URL for alpha testers.
2. Add QR pairing and QR invite links to reduce copy/paste friction.
3. Add a test-mode checklist screen that records pass/fail locally.
4. Add exportable diagnostics: last sessions, relay URL redacted, peer id short hashes, errors, blob stats.
5. Add a minimal self-host node setup path before promising host-backed community history.
6. Add app-store readiness checks: EAS project id, app icons/screenshots, privacy strings, encryption/export-compliance review, crash/log policy.

## Long-Term Recommendations

1. Build the full community management suite: channel/category CRUD, roles, moderation, invites, bans, audit log.
2. Add notifications and push wake for "new update available" semantics.
3. Add presence and typing only after real live-session state exists.
4. Build hosted node provisioning and self-host server UX from the existing seeder/hosted-node primitives.
5. Consider an independent security review before public beta, since the value proposition is privacy and encrypted transfer.

## Verdict

Meerkat has crossed from "concept" into "real protocol and real app shell." The next bottleneck is not crypto primitives. It is turning the current manual, developer-readable system into a tester-readable product.

The best next milestone is not "more protocol." It is a strict alpha-readiness pass:

1. Complete two-device and three-device exit demos.
2. Make file receive/save a first-class flow.
3. Simplify pairing and transfer UX.
4. Deploy one stable relay.
5. Clean docs/copy so nobody tests against stale promises.


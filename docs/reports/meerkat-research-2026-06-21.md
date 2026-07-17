# App Research Report: Meerkat

**Generated:** 2026-06-21
**Project Path:** `/Users/trey/Desktop/Apps/MyLife/apps/meerkat`
**Analyzed by:** `/research-app` skill

## Executive Summary

Meerkat is the standalone front door for a private-network product: an Expo mobile app that runs a local encrypted node, creates and verifies signed encrypted shares, pairs devices by friend code, and syncs community chat/files through zero-knowledge relay and dev-build LAN transports. The product concept is strong and technically coherent, but it is not broad-production ready today: core typechecks pass, the web client tests pass, yet the mobile app and relay test suites have red gates, physical multi-device QA is still pending, and hosted relay/seeder operations are not complete.

## Project Identity

| Field | Value |
|-------|-------|
| Name | `@mylife/meerkat-app` |
| Description | Standalone Expo app for a local encrypted Meerkat node |
| Primary Language | TypeScript, strict |
| Frameworks | Expo 54, React Native 0.81, Expo Router 6 |
| Status | Active, rapidly evolving |
| Git Repository | MyLife monorepo |
| Current-branch commits touching `apps/meerkat` | 5 |
| All-branch commits touching `apps/meerkat` | 44 |
| Current-branch first app commit | 2026-06-14 |
| All-branch first app commit | 2026-06-10 |
| Latest app-path activity seen | 2026-06-18 on all branches, 2026-06-17 on current branch |
| Worktree state | Dirty, with active changes in Meerkat web, sync, relay, entitlements, billing, and `errors_log.md` |

## Concept

Meerkat is best understood as a private social/file network where the phone or browser is a real node, not just a client. It combines:

- End-to-end encrypted content sharing: seal, sign, pin, seed, and open verified content.
- Friend-code trust: pair devices through signed identity bundles, TOFU pinning, and five-emoji SAS verification.
- Private communities: invite-only signed communities with channels, roles, message events, attachments, unread state, and file request/restore flows.
- Zero-knowledge transport: relays forward ciphertext and mailbox envelopes without learning content, device ids, communities, or message types.
- Local-first storage: SQLite plus local block storage on device, with key material in OS secure storage.

The intended positioning is not "another chat app" by itself. It is closer to a privacy-first Discord plus Dropbox plus local encrypted sync layer, with self-hosted or Meerkat-hosted infrastructure optional for people who need always-on reachability.

## Likely Users

Primary early users:

- Technical founders, testers, and privacy enthusiasts willing to run a relay or use a dev build.
- Small trusted groups that want private channels and file sharing without central-platform data mining.
- Families, friend groups, clubs, community organizers, and creator communities that need invite-only spaces and portable encrypted history.
- Self-hosters and communities that want to own their server or hosted-node boundary.

Later mainstream users:

- People who want WhatsApp/Discord-like coordination, but with stronger local ownership and a clearer "what is actually synced" model.
- Communities willing to pay for a hosted relay/node so they do not need to keep a desktop/NAS online.

This is not yet a fit for nontechnical mass-market users unless hosted relay/node setup, device onboarding, background delivery, recovery, and support flows are productized.

## Git History Read

The history shows a very compressed buildout:

- 2026-04-22: `packages/sync` landed the broader mesh-sync foundation, transport ladder, preference negotiation, hardening, and direct sharing primitives.
- 2026-06-10: Meerkat standalone node app began on real encryption/seeding core; real relay server and client transport landed.
- 2026-06-11: native sync engine mounted in the app; manual relay sync, LAN rung, friend-code rendezvous, SAS verification, revocation, recovery, group keys, blobs, community descriptors, hosted nodes, and relay selection landed across feature branches.
- 2026-06-12: major security audit remediation landed, including session encryption hardening, mailbox identity leak fixes, inbound-policy enforcement, tombstones, DoS caps, and the Open Burrow reskin.
- 2026-06-13 to 2026-06-14: channel chat, history, attachments, offline mailbox delivery, read state, files UX, remote share fetch, background mailbox drain, host discovery, and production relay image/test harness work landed.
- 2026-06-15 to 2026-06-17: web client foundation and then full web UX landed, plus relay deploy onboarding.
- 2026-06-18: posts schema and v2 channel-message contract landed on all-branch history.

The pattern is substantial engineering velocity with strong test-harness intent, but also a lot of fresh surface area. That increases production risk until the red tests, human QA, and ops gaps are closed.

## Architecture

```
apps/meerkat/
  app/
    _layout.tsx
    index.tsx
    (root)/
      (tabs)/index.tsx
      (tabs)/share.tsx
      (tabs)/identity.tsx
      (tabs)/communities.tsx
      (tabs)/settings.tsx
      (tabs)/files/[communityId].tsx
      (tabs)/channel/[communityId]/[channelId].tsx
      pinned/[id].tsx
      sync.tsx
      providers/
      data/
      components/
      theme/
    __tests__/
  Tickets/
  scripts/
  shims/
```

Key components:

| Component | Location | Purpose | Size |
|-----------|----------|---------|------|
| Mobile screens | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/(tabs)` | Node, Share, Identity, Communities, Settings, Files, Channel UI | 7 route files |
| Sync screen | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/sync.tsx` | Pairing, relay/LAN sessions, history | 557 lines |
| Community core | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/community-core.ts` | Community schema and operations | 1064 lines |
| Sync core | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/sync-core.ts` | Settings, pairing parse, rendezvous token helpers | 220 lines |
| Background sync | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/background-sync.ts` | On-demand mailbox drain wiring | 329 lines |
| Node store | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app/(root)/data/expo-node-store.ts` | NodeStore implementation over filesystem and SQLite | 210 lines |
| Relay package | `/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay` | Zero-knowledge relay, rendezvous, host registry, community node, hosted API | 30 relay test files |
| Web client | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web` | Browser twin for communities, chat, files, settings, relay sessions | 16 web test files |

## Feature Inventory

| Feature | Status |
|---------|--------|
| Persistent device identity in secure storage | Built, mobile app typechecks |
| Friend codes and relay rendezvous | Built, but relay malformed-code regression is currently failing |
| Signed identity bundles and TOFU pinning | Built |
| Five-emoji SAS verification | Built |
| Seal, pin, share link, open link | Built, tests mostly pass |
| Remote share fetch from pasted hosts or relay host registry candidates | Built, but `openRemoteShare` performance gate is failing |
| Manual encrypted relay sync | Built and heavily tested, but relay suite currently has red tests |
| Manual LAN sync | Code-complete for dev builds, physical device QA still pending |
| Community creation, invite links, channels, roles | Built |
| Signed channel messages, edit/delete, unread state | Built |
| Attachments, per-community file index, request/approve restore | Built |
| On-demand background mailbox drain | Built and app test passes |
| Scheduled background sync and push wake | Wired behind dev-build flag, not production verified |
| Automatic peer auto-dial / always-connected mesh | Not built |
| Hosted relay/community-node billing path | In active development, current typechecks pass, relay tests fail around smoke packaging |
| Full mobile production device sign-off | Not done |

## Codebase Metrics

| Metric | Value |
|--------|-------|
| App directory size | 16 MB in current checkout |
| App files under `app/` | 63 |
| TypeScript files under `app/` | 40 `.ts`, 23 `.tsx` |
| App TS/TSX lines | 16,491 |
| App test files | 19 |
| App production dependencies | 28 |
| App dev dependencies | 6 |
| Local docs in app root | `README.md`, `CLAUDE.md`, `AGENTS.md`, 2 tickets |

## Verification Run

Commands run on 2026-06-21:

| Command | Result |
|---------|--------|
| `pnpm --filter @mylife/meerkat-app typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-app test` | Fail: 17/19 files passed, 140/141 tests passed |
| `pnpm --filter @mylife/meerkat-web typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-web test` | Pass: 16/16 files, 56/56 tests |
| `pnpm --filter @mylife/meerkat-relay typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-relay test` | Fail: 27/30 files passed, 133/136 tests passed |
| `pnpm --filter @mylife/sync typecheck` | Pass |

Observed blockers:

- `apps/meerkat/app.json` is missing, causing `app/__tests__/app-config.test.ts` and known parity checks to fail.
- `openRemoteShare` function-gate complexity slope exceeded the budget: ratio 4.61 vs 2.80 at size 250 -> 500.
- `resolveIdentityFromRendezvous({ code: 'MEER-BAD' })` returns `not_found` instead of expected `bad_code`.
- Relay smoke/log-hygiene tests fail because `scripts/smoke-relay.mjs` compiles with `--moduleResolution node`, which cannot resolve `@mylife/entitlements/server` after hosted entitlement imports.

The errors were recorded in `/Users/trey/Desktop/Apps/MyLife/errors_log.md`.

## Documentation Assessment

| Document | Location | Quality |
|----------|----------|---------|
| README | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/README.md` | Good, honest about live vs missing pieces |
| CLAUDE.md | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/CLAUDE.md` | Mature, detailed architecture and safety boundaries |
| AGENTS.md | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/AGENTS.md` | Mature, synchronized with CLAUDE.md |
| Launch plan | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/Tickets/launch-plan.md` | Good, explicitly tracks pending production work |
| Device QA checklist | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/Tickets/device-qa-exit-demo.md` | Good, clear human sign-off criteria |

Documentation caveat: some older guide copy still says no web app exists, but later commits and current code include `apps/meerkat-web`. Current code and newer history should supersede that stale guide language.

## Production Readiness

Current readiness estimate:

- Controlled technical alpha: close, roughly 70 percent, assuming testers accept manual relay setup and known red tests are fixed first.
- Private beta with nontechnical invited users: not ready, roughly 45 to 55 percent.
- Broad consumer production: not ready, roughly 30 to 40 percent.

Why it is close in some ways:

- The architecture is real, not mockware.
- Core cryptography and sync live in `@mylife/sync` and are exercised through relay and multi-node harnesses.
- The mobile app has real local identity, secure storage, SQLite, content pinning, community chat, files, and manual sessions.
- The web client currently typechecks and passes its test suite.
- The docs are unusually honest about transport boundaries.

Why it is not production-ready:

- Mobile app tests and relay tests are currently red.
- The app config/parity drift around missing `app.json` blocks release confidence.
- Physical two-device and three-device exit-demo QA is explicitly still pending.
- LAN/mDNS, background scheduler, push wake, WAL concurrency, and OS behavior remain device-only unverified.
- Production relay fleet, DNS/TLS, uptime monitoring, and hosted seeder/community-node packaging are founder ops or active work.
- Recovery restore is still pending even though recovery material is generated.
- Automatic peer auto-dial and always-connected mesh are not built.

## Recommendations

Immediate:

1. Fix the red gates before calling it release-candidate: restore or regenerate `apps/meerkat/app.json`, fix `openRemoteShare` complexity gate, restore malformed friend-code validation, and update the relay smoke build module resolution.
2. Re-run `pnpm --filter @mylife/meerkat-app test`, `pnpm --filter @mylife/meerkat-relay test`, `pnpm --filter @mylife/meerkat-web test`, and `node scripts/check-meerkat-parity.mjs`.
3. Reconcile or isolate the dirty worktree before a release assessment, because current uncommitted hosted-access and relay changes affect readiness.

Short-term:

1. Run the physical two-phone and three-phone exit demo from `Tickets/device-qa-exit-demo.md`.
2. Deploy one real relay behind TLS and run a soak with log hygiene, mailbox TTL, rate limits, and uptime monitoring.
3. Refresh stale tester docs that still say the web app is not built.

Long-term:

1. Productize hosted relay/node onboarding and billing.
2. Finish production background delivery and push-wake verification.
3. Decide whether Meerkat launches first as private community chat/files, as personal encrypted sharing, or as hosted private-network infrastructure. The current code supports all three, but a production launch should pick one wedge.

## Raw Git Data

Current-branch recent app commits:

```text
0822062d 2026-06-17 feat(meerkat-web): full web client UX (Phase 1C) - communities, chat, files, settings (#16)
16d1ae3b 2026-06-16 feat(meerkat): always-on zero-knowledge encrypted community feed (P0-P6) (#17)
62943a1c 2026-06-15 feat(meerkat-web): web client foundation (universal access Phase 1) + relay start fix + tester guide (#15)
60eaa9f1 2026-06-14 feat(meerkat): Files & Sharing - in-channel files, per-community index, request/approve re-send (#14)
1af44fb3 2026-06-14 feat(meerkat): land Meerkat standalone app, mesh sync v2, and zero-knowledge relay (#13)
```

All-branch initiative commits include detailed feature work from 2026-06-10 through 2026-06-18 across `apps/meerkat`, `apps/meerkat-web`, `packages/sync`, and `packages/meerkat-relay`.

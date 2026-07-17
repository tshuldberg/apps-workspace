# App Research Report: Meerkat

**Generated:** 2026-06-22
**Project Path:** `/Users/trey/Desktop/Apps/MyLife/apps/meerkat`
**Analyzed by:** `/research-app` skill

## Executive Summary

Meerkat is a standalone Expo app and private-network front door: it runs a real local encrypted node, signs and seals content, pins local blocks, pairs devices, and moves private community chat and files through the shared `@mylife/sync` and `@mylife/meerkat-relay` stack. Compared with the 2026-06-21 review, the checkout is materially healthier: `main` is clean, `apps/meerkat/app.json` is present, parity passes, relay tests pass, web tests pass, and the mobile app test suite passes on rerun.

The product is still not broad-production ready because the remaining risk is outside pure unit and harness coverage: physical two-device and three-device QA, LAN/mDNS on real phones, OS-scheduled background behavior, push wake, production relay fleet operations, hosted seeder/community-node packaging, and recovery restore.

## Project Identity

| Field | Value |
|-------|-------|
| Name | `@mylife/meerkat-app` |
| Description | Standalone Expo app for a local encrypted Meerkat node |
| Primary language | TypeScript |
| Runtime | Expo 54, React Native 0.81, Expo Router 6 |
| Repo | MyLife monorepo |
| Current branch | `main` |
| Worktree state before report edit | Clean |
| Current-branch commits touching `apps/meerkat` | 6 |
| All-branch commits touching `apps/meerkat` | 45 |
| First app-path commit on all branches | 2026-06-10 |
| Latest current-branch app-path commit | 2026-06-18 |
| Latest all-branch Meerkat activity found | 2026-06-22 |

## Concept

Meerkat is a private social and file network where the user's device is a node, not a thin client. The app gives the user a persistent device identity, lets them create signed encrypted content, stores encrypted blocks locally, and syncs only through protocol-backed sessions. Relays are zero-knowledge transport and mailbox infrastructure, not trusted application servers.

The product direction is closer to "private community infrastructure" than a simple chat app:

- private community channels with invite links, roles, message events, edit/delete, unread state, attachments, and file request/restore;
- encrypted personal and community sync across a transport ladder;
- self-hosted or Meerkat-hosted relay/node infrastructure for always-on availability;
- honest UI that only claims delivery, connectivity, or storage when a real local row or engine session proves it.

## Likely Users

Best early users:

- technical privacy users and self-hosters;
- small trusted communities that want private channels and file sharing;
- families, friend groups, clubs, and creator communities that can tolerate invitation-based onboarding;
- testers willing to run a relay or use a dev build for LAN/background validation.

Later mainstream users:

- nontechnical private groups, once hosted relay/community-node setup is productized;
- communities that want Discord-like coordination without central-platform data ownership;
- users willing to pay for managed zero-knowledge availability rather than keeping their own machine online.

Current fit is still technical alpha or controlled beta. It is not ready for unsupported consumer onboarding.

## Git History Read

The history shows a compressed but coherent buildout:

- 2026-04-22: `packages/sync` gained the mesh-sync foundation, transport ladder, policy/scoping, and reconciliation groundwork.
- 2026-06-10: Meerkat standalone app, real relay transport, and encryption/seeding core landed.
- 2026-06-11: manual relay sync, LAN rung, friend-code rendezvous, SAS, revocation, recovery, group keys, blobs, community descriptors, hosted nodes, and relay selection work landed across branches.
- 2026-06-12: major security remediation landed: session encryption hardening, mailbox identity leak fixes, inbound policy enforcement, tombstones, DoS caps, and the Open Burrow reskin.
- 2026-06-13 to 2026-06-14: channel chat, history, attachments, offline mailbox delivery, read state, files UX, remote share fetch, background mailbox drain, host discovery, and production relay image/test harness work landed.
- 2026-06-15 to 2026-06-17: web client foundation, full web UX, and relay deploy onboarding landed.
- 2026-06-18: posts schema and v2 channel-message contract landed on current `main`.
- 2026-06-22 all-branch history: hosted access, slim relay hosted verifier boundary, rendezvous cleanup preservation, and malformed friend-code hardening landed outside the current `apps/meerkat` path history.

The read is stronger than last time: the previous app config, friend-code, and relay smoke blockers are fixed on this checkout.

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

Key boundaries:

| Component | Location | Role |
|-----------|----------|------|
| Mobile app shell | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/app` | Expo Router UI, providers, local node screens |
| Crypto and sync primitives | `/Users/trey/Desktop/Apps/MyLife/packages/sync` | Identity, sealed shares, pairing, sync engine, community protocol |
| Relay and community node | `/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay` | Zero-knowledge relay, rendezvous, host registry, seeder/community node, hosted API |
| Web client | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web` | Browser client for identity, communities, files, settings, relay sessions |
| App launch plan | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/Tickets/launch-plan.md` | Current state and production gaps |
| Device QA checklist | `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/Tickets/device-qa-exit-demo.md` | Human two-phone and three-phone sign-off |

## Feature Inventory

| Feature | Status |
|---------|--------|
| Persistent device identity in secure storage | Built |
| Friend codes and relay rendezvous | Built, relay tests pass |
| Signed identity bundles and TOFU pinning | Built |
| Five-emoji SAS verification | Built |
| Seal, pin, share link, open link | Built |
| Remote share fetch from pasted hosts or relay host registry candidates | Built, app tests pass on rerun |
| Manual encrypted relay sync | Built, relay tests pass |
| Manual LAN sync | Code-complete for dev builds, still needs physical device QA |
| Community creation, invites, channels, roles | Built |
| Signed channel messages, edit/delete, unread state | Built |
| Attachments, per-community file index, request/approve restore | Built |
| On-demand background mailbox drain | Built and tested |
| Scheduled background sync and push wake | Wired behind dev-build flag, not production verified |
| Automatic peer auto-dial | Not built |
| Hosted relay/community-node billing path | Active work, typechecks and relay tests pass in this checkout |
| Physical production sign-off | Not done |

## Codebase Metrics

| Metric | Value |
|--------|-------|
| App directory size | 17 MB |
| Files under `apps/meerkat/app` | 63 |
| TypeScript files under `app` | 40 `.ts`, 23 `.tsx` |
| App TS/TSX lines | 16,821 |
| App test files | 19 |
| App production dependencies | 28 |
| App dev dependencies | 6 |

## Verification Run

Commands run on 2026-06-22:

| Command | Result |
|---------|--------|
| `pnpm --filter @mylife/meerkat-app typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-web typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-relay typecheck` | Pass |
| `pnpm --filter @mylife/sync typecheck` | Pass |
| `pnpm --filter @mylife/meerkat-web test` | Pass, 17 files / 61 tests |
| `pnpm --filter @mylife/meerkat-relay test` | Pass, 30 files / 137 tests |
| `node scripts/check-meerkat-parity.mjs` | Pass |
| `pnpm --filter @mylife/meerkat-app test` | First run failed one `saveFilesBulk` complexity slope gate, focused rerun passed, full rerun passed 19 files / 157 tests |

The old missing `app.json`, remote-share gate, malformed friend-code, and relay smoke/log-hygiene blockers are resolved in this checkout. The remaining automation caveat is intermittent performance-gate noise in `community-files.function-gate.test.ts`, now marked mitigated in `/Users/trey/Desktop/Apps/MyLife/errors_log.md`.

## Production Readiness

Updated estimate:

- Technical alpha: 80 to 85 percent ready.
- Controlled private beta with technical users: 65 to 70 percent ready.
- Broad consumer production: 40 to 50 percent ready.

Why the estimate improved:

- Main worktree is clean.
- Focused typechecks pass across mobile app, web client, relay, and sync.
- Web and relay test suites pass fully.
- App parity passes.
- The previous hard app-config and relay packaging blockers are fixed.
- The mobile app suite passes on rerun, with only a noisy performance gate observed once.

Why it is still not broad-production ready:

- Physical two-device and three-device exit-demo QA remains explicitly pending.
- LAN/mDNS behavior, iOS local network permission, and dev-build native modules still need real hardware.
- OS-scheduled background sync, push wake, force-quit behavior, low-power behavior, and WAL concurrency are not production-verified.
- Production relay fleet work still needs cloud account, domain/DNS, TLS, region deployment, uptime monitoring, and soak.
- Always-on seeder/community-host packaging is not complete as a simple user-facing product.
- Recovery restore is still pending even though recovery material exists.
- Automatic peer auto-dial / always-connected mesh is not built.

## Recommendations

Immediate:

1. Treat Meerkat as alpha-green in code but not production-green in operations.
2. Replace or harden the flaky `saveFilesBulk` performance slope gate so full app tests do not intermittently fail.
3. Run and record the physical two-phone and three-phone exit demo from `Tickets/device-qa-exit-demo.md`.

Short term:

1. Run a real relay soak behind TLS with log hygiene, mailbox TTL, rate limits, and uptime monitoring.
2. Verify dev-build LAN/mDNS and scheduled background sync on real iOS/Android devices.
3. Refresh stale docs that still imply no web client exists, because the web client now exists and passes tests.

Long term:

1. Productize hosted relay and community-node onboarding.
2. Finish restore flows for recovery material.
3. Pick a launch wedge: private community chat/files, encrypted personal sharing, or managed private-network infrastructure. The code supports all three, but a production launch should lead with one.

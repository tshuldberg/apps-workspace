# 2026-08-01: Meerkat live-wake (messages arrive on their own)

## Founder direction

The friend-guide warning ("both people press Sync at the same time") prompted the question: why not a stable connection with real-time delivery? Ground truth showed delivery was already park-and-poll (send parks sealed envelopes at the relay per recipient device; receive polls: focused-channel live loop 5-10s, focus drains, foreground rounds). Founder decisions: build live-wake now, and it rides the launch build (rc17 cuts at the new SHA; freeze procedure itself unchanged).

## What shipped (squash commit b999dc12, branch feature/meerkat-live-wake)

- `packages/sync/src/protocol/mailbox-listen.ts`: `MailboxListenEngine`. Holds one persistent relay session per inbound mailbox token (per active non-revoked paired peer via `deriveMailboxToken(pairSecret, identity.publicKey)`, plus the drain's extra tokens). CRITICAL correctness: a connected session CONSUMES envelopes (the relay forwards instead of parking), so the listener IS the drain: every frame goes through `applyMailboxEnvelope` with the same fail-closed rejected counting; catch-up on (re)connect is the same code path. Bounded reconnect (CallSignalTransport idiom), relay URL re-resolved through the injected choke point per attempt, token-set diffing, listener cap (24, peers first), statuses from real socket events only, serialized envelope application.
- Barrel exports in `index.ts` + `index.native.ts`.
- Mobile: `SyncProvider` builds the engine from the SAME builders as `runForegroundDrain` (peers/handlers/extraTokens/ensureEffectiveRelayUrl, all via a latest-ref so no stale closures), starts foregrounded (AppState), stops backgrounded, `refreshTokens` on pairedDevices change, `onApplied -> refresh()`.
- Web: extracted `buildForegroundHandlers` + `resolveDrainPeers` to closure level (shared with `runForegroundDrain`, no drift), exposed a `liveWake` seam on the context value, engine lifecycle on `visibilitychange` with a hosted-payment gate mirroring the drain.
- Capability twins (mobile + web): `community_chat` line updated; new `live_delivery` entry ("Messages arrive while the app is open"), honest about requiring a reachable connection server.
- Friend guide (html + md): warning replaced with the park-and-arrive model; manual session reframed as first-time-setup/files/fallback; "no push yet" stays honest.
- Feature doc: `docs/plans/features/meerkat/live-wake.md`.

## Verification

- Engine unit tests 9/9 (`packages/sync/src/__tests__/mailbox-listen.test.ts`): live forward, parked catch-up, reconnect without loss, fail-closed tamper, token diffing, cap, unavailable->listening, stale-connect guard, all-duplicate = rejected. 2 mutation checks (stale-connect guard, rejected counting) each broke 4-5 tests.
- Live e2e 3/3 (`packages/meerkat-relay/src/__tests__/mailbox-listen-e2e.test.ts`): real relay server + real WebSocket; instant delivery, catch-up, reconnect through a full server restart.
- Full suites: sync 2507 passed, meerkat app 1493 passed, meerkat parity all green, function gate green.

## Concurrent-session note

A second Claude session was active in this checkout (its pitch-deck commit c3f7aef2 landed on main mid-branch; its uncommitted docs got swept into the live-wake branch commit by git add -A). Nothing was lost; all content is pushed in b999dc12. The no-shared-checkout worktree rule applies to future sessions.

## Remaining

- Live device evidence: two phones + web testbed proving arrival latency (tester sweep).
- Closed-app delivery (push gateway deploy + APNs + client registration) stays a separate founder-gated lane.
- TestFlight build blocked on the stale provisioning profile (no Push Notifications capability): founder runs `npx eas-cli build --profile testflight --platform ios` interactively once.

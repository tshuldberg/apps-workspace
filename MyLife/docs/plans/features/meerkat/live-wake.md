# Meerkat Live-Wake (persistent mailbox listeners)

Founder direction 2026-08-01: messages must arrive on their own while the app is open, and this ships in the launch build (rides the rc train as a new SHA; freeze procedure unchanged: new SHA -> new rc -> release-verify).

## Problem

Delivery today is park-and-poll. Send parks sealed envelopes at the relay per recipient device (SyncProvider.queueChannelMessageMailbox, queueDmMessage). Receive is polling: the focused channel drains every 5-10s (live loop), other screens drain on focus, everything else waits for foreground/manual sync. Worst-case latency 12s on the focused channel; DM threads only update on view.

## Design (no relay changes)

The relay already forwards frames immediately to a peer holding an open connection on a token, and parks (TTL mailbox) only for absent peers. Precedent: CallSignalTransport (WP-25G) holds long-lived per-token listeners with bounded reconnect.

New `MailboxListenEngine` in `@mylife/sync` (`protocol/mailbox-listen.ts`):

- Holds one persistent relay session per inbound mailbox token while started: per active, non-revoked paired peer `deriveMailboxToken(pairSharedSecretHex, identity.publicKey)`, plus the same extra tokens the foreground drain polls (community join/grant, dm-group-commit, public-join).
- CRITICAL correctness: a connected session CONSUMES envelopes (the relay forwards instead of parking). Therefore the listener IS the drain: every inbound frame goes through the ONE dispatcher `applyMailboxEnvelope(identity, bytes, handlers)` with the same fail-closed rejected counting. No second delivery path exists to drift.
- On (re)connect the relay drains parked envelopes into the same handler, so catch-up and live delivery are one code path.
- Bounded reconnect (1s/2s/5s/10s/30s repeating, injected timer seams), relayUrl re-resolved through the injected choke point on every attempt (app injects ensureEffectiveRelayUrl). No relay -> honest 'unavailable' status; statuses derive only from real connect/close events.
- `refreshTokens()` diffs the desired token set (new pairing, new group DM, revocation) and connects/closes only the delta. Cap `maxListeners` (default 24, peer tokens first); overflow tokens stay on the existing polling paths.
- `onApplied(outcome)` fires only for real applied outcomes (never 'rejected'); the app maps it to its existing refresh().

## App wiring (mobile)

- SyncProvider owns one engine instance built from the SAME builders as runForegroundDrain (resolveForegroundDrainPeers, buildDrainHandlers, resolveJoinExtraTokens, ensureEffectiveRelayUrl).
- Foreground-only lifecycle: AppState active -> start(); background/inactive -> stop(). Pairing/community/conversation changes -> refreshTokens().
- onApplied -> refresh() (same signal the drain uses), so Feed, Messages, DM threads, and channels update without polling. The existing live loop and focus drains stay as backstops (idempotent merges; duplicates count skipped).

## Web wiring

Same engine over the browser WebSocket backend, started while the tab is visible (visibilitychange), stopped when hidden. Uses web's existing drain handler builders.

## Honesty rules

- No fabricated connectivity: engine status comes only from real socket events; UI copy unchanged (no "connected to mesh" claims added).
- Every envelope either applies something real or is counted rejected, exactly as the drain.
- The polling paths remain; live-wake is additive delivery latency, not a new source of truth.

## Tests

- Engine unit + e2e with SimulatedRelayBackend: instant forward while listening; park-then-drain on reconnect; consumed-envelope correctness (no loss when listener applies); fail-closed rejected counting; reconnect backoff bounds; token diffing; cap enforcement; no-relay unavailable.
- Mobile: hook/provider lifecycle (foreground start, background stop, refresh on applied) via the node-only vitest idiom (pure core + thin hook, mirroring use-auto-connect-triggers tests).
- Mutation checks on the engine cadence/diff logic per repo standard.

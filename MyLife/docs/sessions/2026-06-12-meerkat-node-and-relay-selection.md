# Meerkat: Node v0 (MK-031) + relay selection (MK-036)

Date: 2026-06-12
Branch: `feature/meerkat-network`
Plan: `docs/plans/active/14-meerkat-network-v2-mission-control.md`

Two codeable items mined from the M5/M6 tail, both composed from already-shipped
pieces rather than new subsystems.

## MK-031: Meerkat Node v0 (desktop seeder) -- M5 code-complete

`@mylife/meerkat-relay` (the desktop-binary package) gains the headless seeder.
Details in `docs/sessions/2026-06-11-meerkat-m5-communities.md` (MK-031 section);
summary: `MeerkatSeederNode` composes `SeedingEngine` (caps/schedules/accounting)
+ `community-catalog` (per-piece verification); `pin` enforces the storage cap
before writing, `servePiece` gates on policy + verifies + records, `sweep`
auto-deletes non-pinned on the node's own clock, `stats` report uptime/bytes/
peers; content-agnostic. Web-seed HTTP binding (`GET /{infoHash}/{index}`) is
consumed by the existing `fetchCatalogFromWebSeed`; `bin/meerkat-node.mjs` CLI.
Tests: seeder-node (8) + e2e (2: a member fetches the full catalog from a lone
node over real HTTP, verified, with no other member online).

## MK-036: latency-based relay selection

The relay-first ladder (MK-014) decides to prefer a relay; this decides which.

- **Relay /healthz**: the WS server now runs on an `http.Server`, so plain GETs
  are answered while WebSocket upgrades pass through untouched. `GET /healthz`
  returns `{ ok, connections, tokens }` (connections is exposed so selection can
  break ties toward the less-loaded relay). No behavior change for WS clients;
  existing relay tests still pass.
- **`transport/relay-selector.ts`** (`@mylife/sync`, RN-safe):
  `selectRelay({ candidates, probe? })` probes each candidate's /healthz and
  returns the nearest HEALTHY relay (lowest latency; ties -> less-loaded ->
  candidate order), or null when the whole pool is down. `rankRelays` returns
  the full nearest-first dial order (healthy first, unhealthy as last-ditch
  fallbacks). The default probe is an HTTP GET to `${relay}/healthz`
  (ws->http, wss->https) over the global fetch; injectable for deterministic
  tests.
- **Tests**: relay-selector.test.ts (7, injected probe: nearest wins, unhealthy
  skipped, tie-break by load, null when all down, unprobed = unhealthy,
  rank order). relay-selection-e2e.test.ts (3, real relays: /healthz counts;
  a live relay chosen over a dead one AND the choice actually carries a
  session; all-down -> null -> the client falls through to the LAN/direct
  ladder).
- **Runbook**: docs/designs/meerkat-relay-fleet-runbook.md -- per-region deploy,
  /healthz monitoring, client usage, the strelaysrv-style auto-join pool, and
  failure behavior.

Selection sits above the ladder; selecting null is not a failure, it just means
"no relay reachable -- use same-network transports."

## Verification

- `@mylife/sync`: 997 tests (+7). `@mylife/meerkat-relay`: 48 (+3 e2e; the +8/+2
  seeder tests landed under MK-031). typechecks clean; `pnpm
  gate:function:changed` EXIT 0; relay server/e2e tests unaffected by the
  /healthz change.

## MK-041: Hosted Nodes service -- codeable core

`@mylife/meerkat-relay` `hosted-node.ts` `HostedNodeService` runs the SAME
seeder (`MeerkatSeederNode`) once per tenant, each with its own isolated piece
store and storage cap. All four ACs are proven in `hosted-node.test.ts` (6):

1. A rented node joins a community as host: `provision` → `pinFor` → `serveFor`
   a catalog.
2. Tenant isolation: one tenant's node cannot serve another tenant's pieces
   even when the infoHash collides (separate stores); per-tenant caps are
   independent.
3. ZERO-KNOWLEDGE against captured tenant data: a catalog whose content is
   group-key CIPHERTEXT is pinned; every served piece is captured (that is all
   the operator ever has); the capture contains no plaintext; a key-holding
   member decrypts the very same captured bytes; any wrong key fails closed.
   The operator holds no group key by construction -- the seeder is
   content-agnostic.
4. The community fires the hosted node by re-signing its descriptor without it
   (`reviseCommunity` dropping `hosts`); the node keeps only ciphertext it
   cannot read.

`deprovision` drops a tenant and its content. Remaining for the MVP: Stripe
billing, real machine provisioning, the protocol-only public deploy, and the
D13 counsel review -- all ops/legal.

## MK-042: transparent pricing engine

`@mylife/meerkat-relay` `hosted-pricing.ts` -- the D13 cost-plus ledger.
`computeTierPrice` / `pricingLedger` produce the transparent per-tier breakdown
(storage + egress + compute = infra cost; take = cost x markup; total = cost +
take) with the per-line breakdown the page renders, plus `formatCents`. The
markup policy is real and tested: `DEFAULT_MARKUP_RATIO = 0.25`, founder-set
ratios flow through. Honest inputs: the default unit costs and tiers carry
`illustrative: true` and the ledger emits a notice that the figures are
placeholders until real provider invoices replace the cost `source` (at which
point the caveat drops). hosted-pricing.test.ts (9). Remaining: real invoice
numbers + the public page (founder/web).

## MK-038 escrow -- deliberately NOT built in software (honesty)

A pure-software retry limit guarding a low-entropy PIN over a key-wrapping blob
is brute-forceable: whoever holds the blob can guess PINs offline, so the retry
counter is only meaningful when a hardware enclave (AWS Nitro) enforces it --
this is exactly Matthew Green's critique of SVR that the ticket references.
Shipping a software-only version would imply security it does not have, which
violates the project's honesty boundary. MK-038's real dependency is the
enclave (infra); the recovery crypto we CAN stand behind already shipped as
MK-020 (printable recovery key). Left for when the enclave exists, with a design
doc capturing the Green-critique mitigations.

## Where plan 14 stands

M2/M3/M5 code-complete; M4 3-of-5 (iroh tickets toolchain/device-gated). M6
codeable cores all landed this session: MK-036 relay selection, MK-041 Hosted
Nodes runtime, MK-042 pricing engine (each ◐ -- the deploy/billing/page halves
are ops). The codeable runway of plan 14 is now effectively exhausted; the
remainder is founder ops, infra, device certs, and decision memos:
- MK-036: 3-region deploy + pool registry. MK-041: Stripe + real provisioning +
  protocol-only deploy + counsel review. MK-042: real invoices + public page.
- MK-031: 24/7 Mac-mini soak + desktop UI. MK-025/026: Rust toolchain + iroh
  POC on real device pairs. MK-037: APNs/FCM certs. MK-038: Nitro enclave.
  MK-039/040: founder decision memos. Plus 2-phone device QA + relay deploy.

## MK-019 gossip transport — the deferred seam, closed (2026-06-12)

The flagged next-codeable item, now done. Signed revocations were stored
without their signature, so they could not be forwarded; now:

- `sync_revocation_records` (SYNC_TABLES 33) persists the full
  `SignedRevocation` JSON, keyed by the revoked device id;
  `applySignedRevocation` writes it on every apply (self-issued AND received),
  so a revocation becomes forwardable the moment it lands.
- `protocol/revocation-gossip.ts` `gossipRevocations(connection, db, identity,
  role)` exchanges records over a connection: each side sends every record it
  holds and applies the peer's (epidemic). Authorization is the standard
  paired-signer rule -- gossip spreads records but only applies ones signed by
  a device the recipient trusts. Self-framed JSON (independent of the
  SyncMessage codec) so it composes onto any connection without entangling the
  session state machine.

revocation-gossip.test.ts (3): a self-issued revocation is stored as a
forwardable record; **the AC** -- a revocation known to A reaches B in ONE
round over the connection-pair harness and B then rejects the device via the
existing handshake check; and an untrusted-signer record is gossiped but NOT
applied. sync suite 1000 (+3); gate green.

Remaining (a one-line integration, low risk): call `gossipRevocations` inside
`runInitiator/ResponderSession` after the module loop so every session gossips
automatically. Introduction gossip (MK-018) is the symmetric follow-up.

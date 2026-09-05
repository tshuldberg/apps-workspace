# Meerkat relay fleet runbook (MK-036)

How the relay fleet is deployed, health-checked, and selected. The client-side
selection is shipped and tested (`@mylife/sync` `selectRelay`); the multi-region
deploy and the auto-join pool registry are the ops half this runbook covers.

## What the relay is

`@mylife/meerkat-relay` is a stateless, zero-knowledge WebSocket forwarder: it
pairs clients by an opaque ephemeral token, forwards ciphertext `env` frames,
holds a short TTL mailbox for absent peers (and a long-TTL mailbox in
mailbox-mode, MK-033), and serves rendezvous records (MK-016). It never sees
device identity or plaintext. One binary, `bin/meerkat-relay.mjs`, env-config:

- `PORT` (default 8787), `HOST` (default 0.0.0.0). No other env. No secrets.
- Logs lifecycle/counts as JSON to stdout; never envelopes, tokens, or
  rendezvous records.

Two entrypoints ship in `bin/`: `meerkat-relay.mjs` (local dev, imports the
barrel) and `meerkat-relay-server.mjs` (the SLIM production entrypoint that
imports `startRelayServer` from `src/server.ts` only, so the image carries just
`ws` + `zod`). The container runs the slim one.

## Health endpoint

Every relay answers `GET /healthz` on the same host:port as the WebSocket
listener (the WS server is hosted on an HTTP server). Response:

```json
{ "ok": true, "connections": 3 }
```

`connections` is exposed so selection can break latency ties toward the
less-loaded relay. That is ALL it exposes: no token-group count, no peer
identity, no message types. Adding a field here would erode the zero-knowledge
guarantee. `/healthz` is the probe target for client selection, the container
HEALTHCHECK, and any external uptime monitor / load-balancer health check.

## Client selection (shipped, MK-036)

Clients hold a candidate pool (the region list) and call `selectRelay`:

```ts
import { selectRelay } from '@mylife/sync';

const chosen = await selectRelay({
  candidates: [
    'wss://relay-us.meerkat.app',
    'wss://relay-eu.meerkat.app',
    'wss://relay-ap.meerkat.app',
  ],
});
// chosen.url is the nearest HEALTHY relay (lowest /healthz latency),
// or null if the whole pool is down -> fall back to the LAN/direct ladder.
```

- The default probe is an HTTP GET to `${relay}/healthz` (ws->http, wss->https)
  over the global fetch, so it runs on RN, browsers, and Node.
- `rankRelays` returns the full nearest-first order (healthy first, then
  unhealthy as last-ditch fallbacks) for clients that want to retry down the
  list rather than pick one.
- Selection sits ABOVE the relay-first ladder (MK-014): the ladder decides to
  prefer a relay; `selectRelay` decides which relay.

## Build + smoke (software, runnable here)

```bash
# Build the production relay image (ws + zod only, stateless).
docker build -t meerkat-relay packages/meerkat-relay
docker run -p 8787:8787 meerkat-relay        # ws://localhost:8787, GET /healthz

# Or compose (relay only, no volume, optional caddy TLS edge).
docker compose -f packages/meerkat-relay/deploy/docker-compose.yml up --build

# Boot the real bin and prove a live engine session crosses it (CI + ops).
pnpm --filter @mylife/meerkat-relay smoke
pnpm --filter @mylife/meerkat-relay test     # includes the smoke + log-hygiene e2e
```

The smoke harness (`packages/meerkat-relay/scripts/smoke-relay.mjs`) compiles the
relay graph, boots `bin/meerkat-relay-server.mjs` as a child process exactly as
the container CMD does, asserts `/healthz` readiness, carries a real
two-client session, asserts stdout never leaks an envelope/token/rendezvous
record, and asserts a clean SIGTERM shutdown.

## Two images: relay vs seeder

- The RELAY image (`packages/meerkat-relay/Dockerfile`) is `ws`+`zod`-only and
  stateless: no volume, no env secret (only PORT/HOST), no `@mylife/sync`. It is
  built with `--ignore-workspace` / `--omit=dev` against a slim runtime manifest
  precisely because `server.ts`/`hub.ts`/`protocol.ts` import no workspace
  package. A guard test (`relay-image-deps.test.ts`) keeps that invariant.
- The SEEDER / hosted node is a SEPARATE deployable. It DOES need `@mylife/sync`
  at runtime (SeedingEngine / catalog piece verify) and a `DATA_DIR` volume with
  a `MAX_STORAGE_MB` cap (`MeerkatSeederNode.pin`). Do not merge it into the
  relay image; building the seeder production image + volume wiring is deferred
  ops, only needed when a 24/7 community node launches.

## Deploy (ops, per region)

Run one relay per region (start with us-east, eu-west, ap-southeast):

1. Container from the package Dockerfile; set `PORT`/`HOST`. Templates:
   `deploy/fly.toml` (per-region Fly), `deploy/render.yaml` (Render alt),
   `deploy/docker-compose.yml` + `deploy/Caddyfile` (self-host with a TLS edge).
2. Terminate TLS at the edge (the relay speaks ws; the edge serves wss +
   forwards /healthz and WebSocket upgrades to the relay port). The cert is the
   ONLY secret in the deployment and it lives at the edge, never on the relay.
   Put the relay behind a TRUSTED proxy so `X-Forwarded-For` gives real per-IP
   limiting (server.ts `_clientKey`) instead of a single proxy IP.
3. Point a stable DNS name per region (`relay-us`, `relay-eu`, `relay-ap`) and
   bake the region list into the client candidate pool / community `hosts`.
4. External monitor hits `GET /healthz` every 30s; page on non-200 or on a
   `connections` count that flatlines at 0 under expected load.
5. Capacity: each relay caps peers-per-token and per-connection rate
   (`RELAY_LIMITS`); set the platform connection concurrency limit BELOW
   `maxConnections` so the edge sheds load before the process hits its own cap
   (fly.toml `[http_service.concurrency]` is pre-tuned). Scale horizontally
   behind the regional DNS name. The relay is stateless across the mailbox TTL,
   so rolling restarts only drop in-flight undelivered mailbox entries (clients
   re-send).

### Capacity table (from `src/protocol.ts` RELAY_LIMITS)

| Limit | Value | Why |
|-------|-------|-----|
| maxConnections | 10000 | global memory backstop; set edge concurrency below it |
| maxConnectionsPerClient | 64 | per-IP reconnect-flood cap (needs trusted proxy) |
| maxPeersPerToken | 8 | peers sharing one ephemeral token |
| maxFrameBytes / maxEnvelopeChars | 96 KB / 90 KB | ~64 KB ciphertext per frame |
| rateMaxPerWindow / rateWindowMs | 200 / 10 s | per-connection envelope rate |
| mailboxMax / mailboxTtlMs | 64 / 5 min | undelivered envelopes per token |
| maxRendezvousRecords / rendezvousTtlMs | 10000 / 10 min | friend-code DoS cap |
| maxTokens / maxMailboxTokens | 8192 / 4096 | distinct token / mailbox groups |

## Founder ops only (needs the user's accounts + infra)

Everything software-buildable is delivered (entrypoint, Dockerfile,
docker-compose, Caddyfile, fly.toml/render.yaml, env schema, smoke + log-hygiene
e2e). The remaining work needs accounts/infra the repo cannot provide:

- A Fly.io / Render account + API token; run `fly deploy` / connect the repo.
- A registered domain + DNS for `relay-us/eu/ap.<domain>` and TLS issuance
  (auto-provisioned by the edge once DNS points at it).
- Per-region machine provisioning and a multi-region soak with live phones to
  validate latency-based `selectRelay` ranking.
- An external uptime-monitor account that pages on a non-200 `/healthz`.
- The seeder/hosted-node production image + data volume (separate deployable).

## Auto-join pool (Syncthing strelaysrv pattern -- remaining ops)

A community-run relay that wants to carry the public pool announces itself to a
pool registry; clients merge the pool list into their candidates and
`selectRelay` ranks the union. The registry (a signed announcement list, or a
small directory service) and the operator policy for admitting community relays
are an ops/product decision, not client code. The carrying-sessions half is
already done: any relay (first-party or community-run) carries sessions today,
and clients can be pointed at it directly or via the candidate pool.

## Failure behavior

- Whole pool down -> `selectRelay` returns null -> the client falls through to
  LAN / nearby / direct per the ladder; no relay is required for same-network
  sync.
- A relay up but slow -> it loses on latency to a faster region; if it is the
  only healthy one it is still chosen (correct: a slow relay beats no relay).
- A relay that 200s /healthz but fails WS -> the client's connect fails and it
  retries the next-ranked relay (`rankRelays`).

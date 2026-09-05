# Meerkat Host (desktop companion)

Plan 20, Phases 4-6. A non-technical, double-clickable control panel that turns a
user's own computer into their relay + community node ("run your own Discord from
your laptop, where even you can't read it"). It supervises the REAL `bin/*`
entrypoints; it owns no cryptography and never decrypts.

## Built + tested here (the pure/testable core)

- `host-config.ts` — Zod-validated on-disk config (`~/.meerkat-host/config.json`),
  the security-preset -> relay env mapping (`presetToRelayEnv`, reuses the Phase 2
  `RELAY_*` env so `resolveRelayLimits` clamps every value), and connection-card
  generation (`buildHostConnectionCard`, reuses the `@mylife/sync` codec). The
  preset NEVER sets a paid hosted-entitlement gate (member relays ship open). (TC-9)
- `reachability.ts` — `gateReachability`: reports "reachable" ONLY from a real
  OFF-HOST round-trip (a third-party echo/reachability service or the tunnel
  provider's status API); a self-fetch / self-vantage is rejected because NAT
  hairpinning or the tunnel edge answering locally would false-positive. (TC-10,
  AC-9, honesty L3)
- `process-supervisor.ts` — `HostSupervisor`: spawns the real bins (injectable
  spawn), reads each one's REAL bound port from its `{event:'listening',port}`
  stdout log, reports per-process liveness from each `/healthz` (counts only),
  and flips a service offline on stop. (TC-8, AC-10)
- `spawn.ts` — `makeRealSpawn()`: the production `SpawnFn` passed into
  `HostSupervisor`. A thin, faithful adapter over `node:child_process.spawn`
  (stdout piped, stderr inherited, stdin ignored, no shell) that surfaces the
  SpawnedChild shape the supervisor drives against the real `bin/*` entrypoints.
  Its test spawns a plain `node -e` fixture (never a tsx child), so the real
  spawn -> read-bound-port -> stop lifecycle is proven end to end. (Phase 4.1/4.3)
- `off-host-probe.ts` — `createOffHostProbe`: builds the injected `offHostProbe`
  that `gateReachability` consumes. It round-trips the candidate public URL
  through an EXTERNAL reachability service (injectable fetch), and is fail-closed:
  a throw / timeout / non-2xx / malformed body → `reachedFromOutside:false`, a
  same-host "service" (hairpin) or a service-reported `vantage:'self'` →
  `vantage:'self'` (the gate rejects it), and only a genuine off-host success
  yields `{ reachedFromOutside:true, vantage:'off-host' }`. It owns no crypto and
  is the ONLY thing that can feed the gate a reachable verdict. (Phase 5.3, TC-10,
  AC-9, honesty L3)
- `tunnel.ts` — `startTunnel`: spawns `cloudflared` (default provider, injectable
  spawn + parse), reads the assigned `https://*.trycloudflare.com` from its output,
  and derives the `wss://` dial URL. The derived URL is a CANDIDATE tagged
  `verified:false` (a tunnel printing a URL is NOT proof of reachability — that
  stays `off-host-probe.ts` + `gateReachability`'s job); on no-URL / child-exit /
  spawn failure it returns a typed tunnel-failed result and NEVER a fabricated
  URL. (Phase 5.2, TC-11, honesty L3)
- `lan.ts` — the same-network rung (pure/injectable). `resolveLanPort` walks to
  the next free port when the desired one is taken (injected probe, no real
  socket); `lanDialUrl` builds `ws://<lan-host>:<port>` from the REAL bound port
  (a shifted port is reflected honestly); `buildLanAdvertisePayload` produces a
  well-formed DNS-SD/Bonjour advertise record (reusing `@mylife/sync`'s
  `MDNS_SERVICE_TYPE`) with no native mDNS import. A LAN address is same-network
  ONLY: the dial URL is never `wss://` and the payload never carries a public URL.
  (Phase 5.2)
- `domain.ts` — the advanced BYO-domain path. `generateDomainConfig` fills the
  existing `deploy/Caddyfile` template with the user's domain + local relay
  upstream and returns ordered DNS/TLS setup steps. The `wss://<domain>` URL is a
  CANDIDATE only; the steps require a real OFF-HOST verification before the card
  is shared (a provisioned cert is NOT proof inbound 443 is reachable). (Phase 5.2)
- `service-specs.ts` — `buildServiceSpecs(config)`: the pure HostConfig ->
  `ServiceSpec[]` mapping the supervisor spawns. relay gets `hostRelayEnv(config)`
  (preset RELAY_* caps the relay clamps; NEVER a paid entitlement gate); the
  community node + seeder each get a WRITABLE DATA_DIR under `~/.meerkat-host/`
  (distinct subdir per service), and the community node's `NOTIFY_RELAY_URL`
  points at THIS host's own local relay when present. Fail-closed: a non-writable
  DATA_DIR returns `{ ok:false }` rather than a data-losing spec. Bind HOST
  follows exposure (loopback for tunnel/domain, 0.0.0.0 for LAN). All fs is behind
  an injectable probe. (Phase 4.3 / 5.4 / 6.1)
- `server.ts` — `createHostServer`: the 127.0.0.1-ONLY node:http control panel.
  It injects `makeRealSpawn()` + a real fetch-based `/healthz` probe into the
  supervisor and the off-host probe into `gateReachability`. Routes: `GET
  /api/status` (real statuses; counts ONLY from the real `/healthz` connections
  field — the relay publishes one, the community node/seeder report liveness so
  their count is null, never a fabricated 0), `POST /api/start` / `POST /api/stop`,
  `POST /api/config` (validates via `loadHostConfig`, persists to
  `~/.meerkat-host/config.json`), and `GET /api/card` — the MKSERVER1 card + QR
  ONLY when the relay is live AND (public exposure verified reachable from a REAL
  off-host round-trip, or a same-network LAN rung honestly labeled same-network);
  otherwise the card is WITHHELD. A tunnel/LAN/domain URL is a CANDIDATE until the
  off-host probe verifies it. Static UI assets are served from `host/ui/`. Every
  card response carries the "reachable only while this app is open and the
  computer is awake" banner. (Phase 4.1 / 5.1 / 5.3 / 6.2 / 6.4)
- `qr.ts` — `encodeConnectionCardQr`: an inline, dependency-free QR generator
  (byte mode, ISO/IEC 18004, versions 1-40) that turns a `buildHostConnectionCard()`
  MKSERVER1: string into a scannable module grid + SVG so a member can adopt the
  server by pointing a phone at the laptop. The QR carries a TRANSPORT ADDRESS ONLY
  (the same non-secret, non-authenticating `@mylife/sync` connection card); it
  refuses to encode a non-card string, and the symmetric `decodeConnectionCardQr`
  reverses the data path to prove every grid round-trips to the exact string it was
  handed. Owns no cryptography. (Phase 6.2)

All of the above are covered by `host/__tests__/*` with injected deps, so the
lifecycle is deterministic without real child processes (the relay CLAUDE.md
warns that backgrounded tsx starves socket IO in sandboxes).

## Launcher + packaging

- `bin/meerkat-host.mjs` — the double-clickable entry point: load/create
  `~/.meerkat-host/config.json`, start the 127.0.0.1-only control panel on a fixed
  loopback port, and open the default browser at that URL (best-effort; a headless
  box just prints it). `pnpm --filter @mylife/meerkat-relay start:host` runs it
  from source with tsx. (Phase 4.1 / 6.4)
- `host/build/` — the `node-sea` config (`sea-config.json`) + a build-driver STUB
  (`build.mjs`) that bundles `bin/meerkat-host.mjs` + `host/` + the real bins into
  one per-OS executable. The stub deliberately does NOT sign, notarize, or
  cross-compile; per-OS builds + code-signing/notarization are FOUNDER-OPS
  (`host/build/README.md`), and it exits non-zero if asked to cross-compile — it
  never claims cross-OS output. (Phase 4.4)

## Remaining (Phase 5-6 UI + Tier-D ops)

- The first-run wizard UI (services / exposure / security) and the running
  dashboard (Screen 4) that consume these `/api/*` routes — Open Burrow tokens.
  `host/ui/index.html` is a placeholder the static route already serves.
- Deploying the concrete external reachability endpoint the default verifier
  dials (`createOffHostProbe`'s `serviceUrl` / `HostServerDeps.reachabilityServiceUrl`).
  Until it is deployed the default verifier returns `unverified`, so the card
  stays honestly WITHHELD for public exposure.
- Wiring the LAN rung's real mDNS advertise (`buildLanAdvertisePayload` ->
  bonjour-service backend) and the BYO-domain rung's real Caddy run; the panel's
  default `startExposure` already runs the cloudflared child, derives the CANDIDATE
  `wss://`, computes the LAN dial URL, and generates the Caddyfile + steps.
- The per-OS SEA builds + code-signing / notarization / installers (founder-ops).

The honest lifecycle banner ("reachable only while this app is open and the
computer is awake") and the off-host verification are load-bearing and encoded in
the tested core above; the control panel enforces them on every `/api/card`.

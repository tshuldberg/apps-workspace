# @mylife/meerkat-relay

The stateless, zero-knowledge relay for the Meerkat network. It is the
relay-first rung of the v2 transport ladder (plan 14, MK-005) and the real
server behind `@mylife/sync`'s `RelayBackend` contract.

## What it does

Clients connect over WebSocket and announce an opaque **ephemeral token**. The
relay pairs clients that share a token and forwards **ciphertext envelopes**
between them. It holds no group keys, decodes no payloads, and persists nothing
beyond a short TTL mailbox for envelopes whose peer has not connected yet.

The privacy guarantee is structural: the relay only ever handles an opaque
`token` and a base64 `env` string it copies verbatim. It cannot read content,
and it addresses peers by rotating per-session tokens, not by device identity.

## Wire protocol

JSON frames over WebSocket.

- Client to server: `{ t: 'hello', token }`, `{ t: 'env', env }`, `{ t: 'bye' }`
- Server to client: `{ t: 'ready', peers, queued }`, `{ t: 'env', env, ts }`, `{ t: 'err', code, msg }`

Limits (see `src/protocol.ts`): 64 KB ciphertext per envelope, 8 peers per
token, 200 envelopes per 10 s per connection, 64-envelope / 5-minute mailbox.

## Run

```bash
pnpm --filter @mylife/meerkat-relay test        # hub + live-server + e2e tests
pnpm --filter @mylife/meerkat-relay smoke       # boot the real bin + carry a session
PORT=8787 pnpm --filter @mylife/meerkat-relay start   # local dev (workspace present)
# or the production image:
docker build -t meerkat-relay packages/meerkat-relay && docker run -p 8787:8787 meerkat-relay
# or docker compose (relay only, no volume, optional caddy edge):
docker compose -f packages/meerkat-relay/deploy/docker-compose.yml up --build
```

The client side is `WebSocketRelayBackend` in `@mylife/sync`, which speaks this
protocol using the platform global `WebSocket` (React Native, browser, Node).

## Two entrypoints, two images

- `bin/meerkat-relay.mjs` is the local-dev entrypoint. It imports the
  `src/index.ts` barrel, which is convenient when the full workspace is present.
- `bin/meerkat-relay-server.mjs` is the SLIM production entrypoint. It imports
  `startRelayServer` directly from `src/server.ts`, which pulls in only `ws` +
  `zod`. The barrel re-exports the seeder/hosted node, and those import
  `@mylife/sync` at runtime; importing `server.ts` alone keeps the relay image
  free of any workspace dependency. The `Dockerfile` compiles the relay graph
  (`server`/`hub`/`protocol`) to CommonJS, ships a `ws`+`zod`-only manifest, and
  runs the slim entrypoint. This is why the relay image is correct with
  `npm install --omit=dev` and a `--ignore-workspace` build.
- The seeder / hosted node is a SEPARATE image (it needs `@mylife/sync` and a
  data volume). It is intentionally not built by this Dockerfile. See the fleet
  runbook for the two-image split.

## Deploy

The relay is stateless and zero-knowledge: it reads only `PORT`/`HOST`, takes no
API keys or DB creds, persists nothing beyond in-memory TTL mailboxes, and
mounts no volume. The only secret-adjacent surface is the TLS certificate, owned
by the edge proxy (Caddy / Fly / Render), never by the relay process.

**Deploy your own (anyone can):** see the user-facing guide
[`docs/guides/deploy-a-meerkat-relay.md`](../../docs/guides/deploy-a-meerkat-relay.md).
Fastest paths that give a browser-usable `wss://` URL automatically:

- One click on Render (reads the root `render.yaml` blueprint):
  [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tshuldberg/MyLife)
- One command on Fly (run from the relay package root, the Docker build context):
  `cd packages/meerkat-relay && fly launch --copy-config --config deploy/fly.toml`
- One command on any VPS, once the "Publish relay image" workflow
  (`.github/workflows/publish-relay-image.yml`) has run:
  `docker run -p 8787:8787 ghcr.io/tshuldberg/meerkat-relay:latest` (add a TLS edge for `wss://`)

Ready-to-run templates live in `deploy/`:

- `docker-compose.yml` (relay + optional caddy TLS edge), `Caddyfile`
- `fly.toml` (per-region Fly deploy), `render.yaml` (Render alternative)
- `.env.example` (only `PORT`/`HOST`)

Cloud account, domain, DNS, TLS issuance, per-region machines, and external
uptime monitoring are founder ops. See
`docs/designs/meerkat-relay-fleet-runbook.md`.

### Hosted OAuth provider registry

The hosted storage broker loads client secrets from mounted files. Configure a
provider with `MEERKAT_OAUTH_PROVIDERS` and the matching
`MEERKAT_OAUTH_<PROVIDER>_AUTH_URL`, `TOKEN_URL`, optional `REVOKE_URL`,
`CLIENT_ID`, `CLIENT_SECRET_FILE`, and `REDIRECT_ALLOWLIST` variables. The
allowlist is a JSON array of exact callback URIs. Prefixes are
`MEERKAT_OAUTH_GOOGLE_*`, `MEERKAT_OAUTH_DROPBOX_*`,
`MEERKAT_OAUTH_ONEDRIVE_*`, and `MEERKAT_OAUTH_BOX_*`.

Provider defaults are deliberately narrow:

- Dropbox requests content read/write, metadata read, and account-info read.
  Set the Dropbox app's Content access setting to **App folder** in the Dropbox
  developer console. The broker also requests offline token access.
- OneDrive requests `Files.ReadWrite.AppFolder` and `offline_access`, and all
  adapter paths remain under Graph's `approot` special folder.
- Box has no app-folder OAuth scope. Its minimum usable application scope is
  `root_readwrite`, so the adapter creates and pins a dedicated `Meerkat` folder
  under root and refuses objects outside that folder. This folder boundary is
  an application control, not an OAuth scope boundary.

Override defaults only with `MEERKAT_OAUTH_<PROVIDER>_SCOPES`. An override
replaces the whole default list, so deployments must retain every scope needed
by the configured adapter.

## Community node (the second image)

`bin/meerkat-community-node.mjs` is the always-on COMMUNITY NODE for the community
feed (P2 + P6 ops). It persists each community's rolling snapshots + live tail as
opaque ciphertext and gates pulls with per-member signed auth. It NEVER decrypts:
it verifies pieces by hash, verifies only the outer author signature on tail
entries, and serves sealed bytes. It is a SEPARATE deployable from the slim relay
image (it needs `@mylife/sync` at runtime and a `DATA_DIR` volume).

```bash
# Run from source (workspace present):
PORT=8890 HOST=0.0.0.0 DATA_DIR=~/.meerkat/community \
  pnpm --filter @mylife/meerkat-relay start:community-node
```

`DATA_DIR` is a volume holding two subdirs the node creates:

- `pieces/` -- opaque snapshot + tail piece bytes (FileSeederPieceStore).
- `descriptors/` -- the restart-safe revision ledger (FileCommunityDescriptorStore):
  the highest accepted `(revision, descriptorHash)` per community, so an
  owner-signed OLDER roster cannot re-grant a removed member after a restart.

Per-device rate limits (publish/append/pull) and a global per-community challenge
ceiling are on by default; over-limit requests get a `429`.

Optional env:

- `NOTIFY_RELAY_URL` -- a ws(s) relay; the node parks ONE content-free notify ping
  (an env frame on the community's notify token) after a real change so polling
  subscribers wake and pull. The relay sees only an opaque token + opaque bytes.
- `ANNOUNCE_RELAY_URL` + `PUBLIC_BASE_URL` + `ANNOUNCE_COMMUNITY_IDS` (comma list)
  -- run the host-registry announce loop so browsers discover this node's url. OFF
  unless all three are set.

Building the community-node production image (a Dockerfile target over this same
package, like the seeder) is deferred ops; the run script + this note ship here.

## Direct send (desktop demo, macOS <-> Windows)

`MeerkatDirectClient` (in `@mylife/sync`) is encrypted "AirDrop for any two
devices": one side seals a message and ships it through the relay, the other
opens it with the out-of-band share link. The relay only forwards ciphertext.
It is plain Node, so the same commands run on macOS, Windows, and Linux.

```bash
# 1. Start a relay reachable by both machines (run on one of them, or a host).
#    Note its LAN IP, e.g. 192.168.1.20.
pnpm --filter @mylife/meerkat-relay start            # listens on 0.0.0.0:8787

# 2. On machine A (e.g. the Mac) -- send. The token is any shared phrase both
#    sides agree on (it is hashed to a rendezvous id; the relay never sees it).
#    send STAYS CONNECTED so B can fetch -- leave it running, Ctrl-C when done.
pnpm --filter @mylife/meerkat-relay exec \
  tsx bin/meerkat-direct.mjs send ws://192.168.1.20:8787 "our shared phrase" "hello from the Mac"
#    -> prints a meerkat://share/... link. Copy it to machine B out of band.

# 3. On machine B (e.g. the Windows PC), while A is still running -- open the link.
pnpm --filter @mylife/meerkat-relay exec \
  tsx bin/meerkat-direct.mjs open ws://192.168.1.20:8787 "our shared phrase" "meerkat://share/..."
#    -> prints the decrypted message.
```

The link key never crosses the relay; it travels only in the share link you
move out of band. For paired devices that key wrap becomes automatic with friend
codes (MK-015/016). Verified by `direct-client-e2e.test.ts` (real server, two
clients, live + store-and-forward mailbox paths) and `@mylife/sync`'s
`direct-client.test.ts`.

## Status

M0 transport, with a working, smoke-tested production relay image and deploy
templates (`deploy/`). The multi-region fleet rollout, the community relay pool
registry, and the push-wake bridge are later milestones (MK-036, MK-037) and the
remaining founder ops are the cloud account, domain/DNS, TLS issuance, and
per-region soak. This package is the single-node server plus its tested client
backend.

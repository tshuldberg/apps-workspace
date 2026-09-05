# Deploy your own Meerkat relay

A relay is the small server two Meerkat devices meet on to exchange data. You need
one reachable relay URL to use Meerkat over the internet. Anyone can run a relay,
including you.

## Why running a relay is safe

The relay is **zero-knowledge**. It only ever sees scrambled bytes addressed by
opaque one-time tokens, plus their sizes and timing. It never sees your messages,
your identity, your contacts, or which community you are in. It stores nothing
beyond a few minutes of in-memory hand-off state, mounts no disk, and takes no
API keys or passwords. So a relay you run (or one a friend runs) cannot read
anything, which is why it is fine for a community to host its own.

(The relay is just the meeting point. The durable "always-on, from anywhere" feed
is a separate, also-zero-knowledge **community node**; see the end of this guide.)

## What you need

- A relay reachable at a **`wss://` URL** (secure WebSocket). The browser app runs
  over `https`, and browsers refuse plain `ws://` from an `https` page, so for real
  use the relay must be behind TLS. The two hosted options below give you `wss://`
  automatically. A bare `docker run` gives you `ws://` for local testing only.

> Which option is for you: Options A and B **build from the Meerkat source repo**,
> so they work if you have access to that repo (or it is public, or you fork it).
> If you do **not** have repo access, use Option C with the **prebuilt image** -
> that is the path that lets anyone run a relay without the source. (Publishing a
> public image is the one founder step that turns "anyone can deploy" from true in
> principle into true in one command.)
>
> For the **simplest, no-cloud-account path**, Option D is a one-tap desktop
> companion (**Meerkat Host**) that runs a relay straight from your own computer.
> It is reachable only while that app is open and the computer is awake, so it is
> great for a get-together or a small group that is online at the same time, but
> it is not an always-on server. For a feed that answers from anywhere at any
> time, use one of the cloud options above (or the community node at the end).

## Option A - Render (one click, automatic `wss://`)

Needs access to the Meerkat repo (the button builds it). If the repo is private to
you, either keep it as your own relay, fork it, or use Option C. The button reads
`render.yaml` from the repo's default branch, so this works once the blueprint has
landed on `main`.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tshuldberg/MyLife)

1. Click the button (or in the Render dashboard: New > Blueprint, and point it at
   the repo). Render reads `render.yaml` at the repo root and builds the relay from
   `packages/meerkat-relay/Dockerfile`.
2. Wait for the first deploy to go green. Render gives the service a public URL like
   `https://meerkat-relay-xxxx.onrender.com`.
3. Your relay URL for Meerkat is that host with `wss://`:
   `wss://meerkat-relay-xxxx.onrender.com`.

Render terminates TLS at its edge and proxies the WebSocket through, so you get
`wss://` with no certificate work. The blueprint uses Render's `starter` plan (a
small paid always-on instance, about $7/mo) on purpose: a relay should stay warm,
and Render's free tier sleeps after inactivity, which would stall the first sync
until it wakes. Switch the plan in `render.yaml` if you want that trade-off.

## Option B - Fly.io (one command, multi-region, automatic `wss://`)

From a checkout of the repo (you need repo access for this path). Run flyctl from
the relay package root - that directory is the Docker build context the Dockerfile
expects, so deploying from `deploy/` instead would fail to find the source:

```bash
cd packages/meerkat-relay
fly launch --copy-config --config deploy/fly.toml   # pick an app name + region
fly deploy                                           # re-deploy after changes
```

Fly terminates `wss://` at its edge. Your relay URL is `wss://<your-app>.fly.dev`.
To add regions, copy `deploy/fly.toml`, change `app` + `primary_region`, and
`fly deploy` again. The client ranks multiple relays automatically. Fly has no
always-free tier; a single shared-cpu-1x machine is inexpensive but not free.

## Option C - Any VPS via Docker (you provide TLS)

The relay is stateless, so a container is all it is:

```bash
# Prebuilt image (once it is published - see note below), no repo needed:
docker run -p 8787:8787 ghcr.io/tshuldberg/meerkat-relay:latest

# Or build from source (needs repo access):
docker build -t meerkat-relay packages/meerkat-relay
docker run -p 8787:8787 meerkat-relay
```

That serves plain `ws://your-host:8787`, which is fine for testing on the same
machine but NOT usable from the browser app over `https`. For a real `wss://` URL,
put a TLS edge in front. The repo ships a Caddy setup that auto-provisions a
Let's Encrypt certificate:

```bash
# Set RELAY_DOMAIN in packages/meerkat-relay/deploy/.env and point its DNS here,
# then bring up the relay + the Caddy TLS edge:
docker compose -f packages/meerkat-relay/deploy/docker-compose.yml up --build
# (uncomment the `caddy` service in that file first)
```

Your relay URL is then `wss://your-domain`.

> Prebuilt-image note: `ghcr.io/tshuldberg/meerkat-relay` exists once the
> "Publish relay image" GitHub Action has run (trigger it manually, or push a
> `relay-v*` tag). Until then, use Render/Fly or build from source. Publishing the
> image is the one step that lets people with no repo access run a relay in a single
> command.

## Option D - Meerkat Host (one-tap desktop companion)

If you would rather not touch a cloud dashboard or a command line, **Meerkat
Host** runs a relay from your own computer and walks you through exposing it. It
is the double-clickable path: launch it, a browser tab opens on a local control
panel, and a short wizard gets you to a URL you can share.

```bash
# From a checkout (packaging into a per-OS executable is a separate step):
pnpm --filter @mylife/meerkat-relay start:host
```

What it does, and what it deliberately does not do:

- The launcher (`bin/meerkat-host.mjs`) starts a **`127.0.0.1`-only** control
  panel and opens your browser at that loopback URL. The panel is an **admin
  surface**; it never binds a public interface on its own, and it owns no
  cryptography (it reuses the same relay + connection-card code as everything
  else here).
- A setup **wizard** and a running **dashboard** let you start the relay (and,
  optionally, a community node) and then choose how to expose it: a **tunnel**, a
  **same-network LAN** address, or your **own domain**. Exposing anything to the
  internet is always your explicit choice inside the panel.
- The dashboard shows a **connection card + QR** for members to adopt **only
  after a real off-host reachability check confirms the public URL answers from
  outside your machine**. A URL it has not confirmed is withheld, never shown as
  reachable. That check is **current**, not a one-time boot fact: if the tunnel
  dies mid-session the card drops back to unverified at once, so a silently-dead
  URL stops surfacing a card even while the relay process keeps running.
- **A desktop host is reachable only while the app is open and the computer is
  awake.** Close the app or let the machine sleep and the server goes away. This
  is on purpose. If you need a feed that answers **from anywhere at any time**,
  run one of the cloud options above, or the always-on community node below.

## Verify it is up

```bash
curl https://your-relay-host/healthz      # -> {"ok":true,...}
```

A `wss://` relay answers `GET /healthz` over `https` at the same host.

## Use it in Meerkat

Open Meerkat, go to the relay setting, and paste your `wss://...` URL. Share that
same URL with everyone in your community; they paste it too. That is all the setup
a member does. There is no default relay baked in, on purpose: you choose who runs
the meeting point.

## The always-on feed (optional, a second step)

The relay lets people sync when two of them are online at once and briefly holds
hand-offs (a few minutes). For a feed that is readable **from anywhere at any
time**, a community also runs a **community node** (`bin/meerkat-community-node.mjs`),
which persists the community's encrypted snapshots and serves them with per-member
signed auth, while still never reading plaintext. It needs a `DATA_DIR` volume and
is a separate image from the relay. See `packages/meerkat-relay/README.md` and
`docs/guides/meerkat-founder-ops-runbook.md`.

## Tune fair-use limits (optional)

The relay ships with safe per-IP budgets out of the box; you do not need to set
anything. If you expect a small private community or, conversely, a busier server,
you can tune the caps from the environment. Every value is **clamped to a safe
range**, so a typo or a too-aggressive number cannot turn your relay into a traffic
amplifier or lock your own members out.

| Env var | Caps | Default | Range |
|---|---|---|---|
| `RELAY_MAX_CONNECTIONS` | Total simultaneous sockets | 10000 | 8 - 200000 |
| `RELAY_MAX_PER_CLIENT` | Sockets from one IP | 64 | 1 - 4096 |
| `RELAY_MAX_PEERS_PER_TOKEN` | Peers sharing one pairing token | 8 | 2 - 64 |
| `RELAY_ENV_RATE` | Envelopes per IP per window (shared across that IP's connections behind a proxy) | 200 | 10 - 5000 |
| `RELAY_RENDEZVOUS_RATE` | Friend-code ops per IP per window (shared across that IP's connections behind a proxy) | 30 | 5 - 1000 |
| `RELAY_WINDOW_MS` | Rate-limit window (ms) | 10000 | 1000 - 60000 |
| `RELAY_MAILBOX_MAX` | Hand-offs buffered per token | 64 | 8 - 4096 |
| `RELAY_MAILBOX_TTL_MS` | How long a hand-off waits (ms) | 300000 | 10000 - 86400000 |

Two starting points:

- **Private (one community):** tighter budgets sized for a known group, e.g.
  `RELAY_MAX_CONNECTIONS=200 RELAY_MAX_PER_CLIENT=8 RELAY_ENV_RATE=100`.
- **Open (many people):** keep the defaults (or raise `RELAY_MAX_CONNECTIONS`).

These are read at startup; the relay logs the resolved caps as a `limits` event so
you can confirm they applied. `/healthz` is unchanged and still exposes only
`{ ok, connections }` (no metadata). If your relay is exposed **directly** (no TLS
edge/proxy in front), do not trust `X-Forwarded-For`: per-client caps then key off
the proxy IP. The Render/Fly/Caddy paths above all sit behind a trusted edge.

## Going further

For multi-region fleets, monitoring, DNS, and certificate operations, see the fleet
runbook: `docs/designs/meerkat-relay-fleet-runbook.md`.

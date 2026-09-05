# Meerkat relay deploy onboarding (2026-06-16)

Branch `feature/meerkat-relay-onboarding` off `origin/main`. PR #18.

## Goal

Make it possible for a new Meerkat user or community to stand up their own
zero-knowledge relay in a couple of minutes, and choose a relay from inside the
web client, instead of being handed a bare URL field with no path to a working
server. This follows the readiness finding that the product is code-complete but
has no deployed relay and no self-serve deploy path.

## The latent bug this uncovered (the important part)

The relay slim Docker image **was already broken on main**. The build stage ran:

```
RUN pnpm install --prod=false --ignore-workspace
```

against a `package.json` that carries `workspace:*` `@mylife/*` deps
(`@mylife/sync` dep; `@mylife/db`, `@mylife/module-registry`,
`@mylife/typescript-config` devDeps). Under `--ignore-workspace` pnpm cannot
resolve a `workspace:*` specifier, so `docker build` failed with
`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` **before** it ever generated the `ws`+`zod`
runtime manifest. Reproduced in isolation.

Why it was never caught: the relay `smoke` test boots the compiled bin from
**source** (workspace present), and CI never built the image. So every documented
"deploy your own relay" path depended on a build that did not work.

The relay graph (`server.ts`/`hub.ts`/`protocol.ts`) imports **none** of the
`@mylife/*` packages (those are for the seeder / community-node, a separate
image). Fix: strip `workspace:*` deps from `package.json` in the build stage
before install. Verified locally: strip -> `pnpm install --ignore-workspace`
succeeds -> `tsc` compiles the relay graph to `dist/server.js`/`hub.js`/`protocol.js`.

## Changes

- `packages/meerkat-relay/Dockerfile` - strip `workspace:*` deps in the build
  stage (a `node -e` rewrite). `ws`/`zod` (real registry deps) kept; runtime
  manifest unchanged.
- `.github/workflows/ci.yml` - new `relay-image` job (gated on a `relay` paths
  filter) that `docker build`s the image with no push, so a broken Dockerfile
  fails CI instead of only at deploy time.
- `render.yaml` (repo root, new) - Render one-click blueprint for the relay
  service ONLY (relay Dockerfile + `./packages/meerkat-relay` context, `/healthz`,
  `HOST=0.0.0.0`, `autoDeploy: false`, `plan: starter` with a cost comment).
- `.github/workflows/publish-relay-image.yml` (new) - publishes
  `ghcr.io/<owner>/meerkat-relay` on `workflow_dispatch` / `relay-v*` tags so
  people with no repo access can `docker run` a relay.
- `docs/guides/deploy-a-meerkat-relay.md` (new) - zero-knowledge explainer,
  Render / Fly / Docker options, the `wss://` (TLS) requirement, `/healthz`
  verify, and the community-node note.
- `packages/meerkat-relay/README.md` - "Deploy your own (anyone can)" section.
- `packages/meerkat-relay/deploy/fly.toml` + guide + README - fixed the Fly build
  context: run `flyctl` from the relay package root (the Docker build context the
  Dockerfile's COPY paths expect), not from `deploy/`. `dockerfile = "Dockerfile"`.
- `apps/meerkat-web/src/ui/App.tsx` - `RelayBar` now offers an
  "I have a relay URL" / "Deploy my own" chooser linking the guide, keeps no
  default relay, validates `wss://`/`ws://`, and warns on insecure `ws://`.

## Honesty

- No default relay is baked in; the user chooses the meeting point.
- Dropped "free" claims (guide title, web copy): Render `starter` and Fly are
  small paid always-on plans (~$7/mo); free tiers sleep, which would stall the
  first sync. Documented the trade-off instead.
- The chooser shows only the saved relay setting; no "connected" / peer-count /
  delivery claim.

## Verification (orchestrator-run)

- Reproduced the build failure, then verified strip -> install -> compile to
  `dist/*.js`.
- `apps/meerkat-web`: typecheck clean, 40 tests pass, `build` succeeds (pre-commit
  function gate re-ran typecheck + 40 tests green).
- `@mylife/meerkat-relay`: 130 tests pass.
- Em-dash scan clean across all 8 changed files.
- Docker daemon is not available in this sandbox; the new CI `relay-image` job is
  the end-to-end build guard.

## Founder ops left (not code)

- Run `publish-relay-image` once and deploy one always-on relay so the Render/Fly
  buttons and the ghcr image are live. The Render button reads `render.yaml` from
  `main`, so it works after this PR merges.
- The community node (always-on feed) is still a separate image; its Dockerfile
  target is deferred ops.

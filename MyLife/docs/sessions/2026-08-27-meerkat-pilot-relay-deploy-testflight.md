# 2026-08-27: Meerkat pilot relay deployed + TestFlight build submitted (Steps 1-5)

Executed Steps 1-5 of `docs/guides/meerkat-pilot-testflight-deployment-2026-08-26.md`, with Step 2 (ASC IAP + RevenueCat) DEFERRED by founder decision for this testing round.

## What was done

1. **Step 1, relay deploy (Fly.io):** app `meerkat-relay-us` created (personal org, region iad), slim stateless relay image (52 MB, ws+zod only) deployed to 2 machines. Verified `https://meerkat-relay-us.fly.dev/healthz` returns `{"ok":true,"connections":0}` over TLS. Relay URL: `wss://meerkat-relay-us.fly.dev`. Fly account: tshuldberg999@gmail.com.
2. **Step 2, deferred:** no IAP, no RevenueCat key. Consequence (by design, deny-by-default gate with no dev bypass): the TestFlight build installs, creates identity, and reaches the relay on the connection card, but stays locked at the $4.99 gate beyond the free paths. Full pilot smoke needs Step 2 later (sandbox purchases are free) + one rebuild.
3. **Step 3:** `MEERKAT_DEFAULT_RELAY_URL=wss://meerkat-relay-us.fly.dev` baked into the `testflight` EAS profile env; RC key intentionally omitted. Commit `ff99454a` on main.
4. **Step 4:** EAS iOS build FINISHED on the testflight lane (build id `97085577-17a8-4427-b763-5f1238b1fca3`, version 1.0.0, build number 12); stored credentials all valid.
5. **Step 5:** `eas submit --latest` succeeded using the ASC API key already stored on EAS servers (key UGB9NWH4L8). Binary uploaded to App Store Connect, processing.

## Deploy snags found and documented (guide + template corrected)

- flyctl resolves `[build].dockerfile` in fly.toml relative to the CONFIG file's directory, not the build context; deploying with `--config deploy/fly.toml` fails looking for `deploy/Dockerfile`, and a `--dockerfile` CLI override is IGNORED in favor of the config value. Working layout: copy `deploy/fly.toml` to the package root (what `fly launch --copy-config` does) and run `fly deploy` there. Root `fly.toml` now gitignored via new `packages/meerkat-relay/.gitignore`.
- Fresh `fly auth login` wrote the token to `~/.fly/config.yml` but `flyctl auth whoami` still reported no token; workaround (used for every command): `FLY_API_TOKEN="$(awk '/^access_token:/{print $2}' ~/.fly/config.yml)"`.
- Both fixes recorded in the guide (md + html twins, Option A section).
- Note: while diagnosing auth, a Fly token fragment was echoed into the local session transcript (redaction pattern missed the fm2_ prefix). Local-only; revoke the token if that transcript is ever shared.

## Founder next actions

- App Store Connect > Meerkat > TestFlight: once processing finishes, create an Internal Testing group, add your Apple ID, enable build 1.0.0 (12), install via TestFlight.
- When ready for the full pilot: do guide Step 2 (sandbox IAP `meerkat_app_unlock` + RevenueCat `appl_` key), add the key to the testflight profile env, rebuild + resubmit.
- Optional: `MEERKAT_INSTALL_URL` once a TestFlight public link exists.

## Verification

- Relay healthz probed over TLS (200, 0.37s).
- eas.json change committed with gates green (no function logic changed; function gate reported no changed source files).

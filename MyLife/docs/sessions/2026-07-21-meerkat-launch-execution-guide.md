# 2026-07-21: Meerkat launch execution guide (click-by-click, all 18 steps)

Founder request: every runbook task must have explicit step-by-step instructions such that following them end to end results in a live production launch.

## What was done

- Authored `docs/guides/meerkat-launch-execution-guide-2026-07-21.md` (+ self-contained HTML twin, opened in browser): click-by-click founder instructions for all 18 activation runbook steps, bound to rc12 at `985a7dc7`. Every action labeled [YOU] / [CLAUDE] / [YOU+CLAUDE], with exact console paths, URLs, commands, env var names, and the values to paste back.
- Grounded in four parallel repo scouts (deploy topology, env/config surface, provider OAuth + store config, evidence/test tooling). Key facts baked in:
  - Deploy: `compose.production.yml` 15-service topology, two networks, `/run/secrets/*` file mounts, per-service fail-closed env, Caddyfile domains incl. tailnet-restricted moderation console.
  - Config: full MEERKAT_* inventory incl. DMCA six fields, account-service secrets (`MEERKAT_ACCOUNT_SESSION_SECRET`, `MEERKAT_ACCOUNT_EPOCH_KEY_SECRET`), SSO ids (`MEERKAT_APPLE_SERVICE_IDS`, `MEERKAT_GOOGLE_CLIENT_IDS`), webhooks (`/api/account/entitlements/{apple,google,stripe}`), Turnstile, NCMEC (`MEERKAT_NCMEC_FILING_ENDPOINT` + token file).
  - Billing: hardcoded product ids `meerkat_app_unlock` / `meerkat_hosted_monthly` at founder-locked $4.99 / $4.99/mo.
  - OAuth: redirect `meerkat://oauth/connect/complete`, per-provider scopes, broker env (`MEERKAT_OAUTH_<P>_*`).
  - Tooling: migrate/role-grants/backup/cutover CLIs, load-relay/load-http/soak-runner with verdict recording (`rehearsal:postgres --record`), release-images.yml (syft SBOM, Grype blocking, SLSA, cosign), device matrix guide ACs 42.1-42.7.
- Recommended infra default: single-vendor AWS (EC2 + RDS PG17 Multi-AZ + versioned S3 + Secrets Manager + CloudWatch + Tailscale for MODERATION_ALLOWED_CIDRS); Hetzner/Crunchy/B2 named as budget alternative.
- Dashboard wiring: `render-launch-dashboard.mjs` now links every step card to the guide anchor (`#step-N`), adds the guide to canonical sources and the focus banner; re-rendered `launch-dashboard.html` (18 links verified).
- docs/README.md indexed the new guide.

## Honest gaps recorded in the guide

- Plan 51 account service is not yet in compose.production.yml; adding it (plus `account.<domain>` route) is planned release-blocking work that cuts a new rc (guide Step 7).
- No scripted tracker for the Step 11 provider matrix; Claude drives it as a guided checklist with evidence into `providers/`.
- Step 9 external dependencies (NCMEC ESP registration, abuse-hash contract) have weeks of lead; guide says start immediately.

## Files changed

- `docs/guides/meerkat-launch-execution-guide-2026-07-21.md` (new) + `.html` twin (new)
- `docs/releases/meerkat/render-launch-dashboard.mjs` (guide links) + re-rendered `launch-dashboard.html`
- `docs/README.md`, `memory.md`

## Verification

- HTML twin rendered from md and opened; 18 `id="step-N"` anchors present.
- Dashboard re-rendered against the unchanged rc12 ledger (active candidate verified); 18 per-step guide links present; opened in browser.
- Docs-only change: no function logic changed, function gate not applicable (stated explicitly).

## Remaining

- Founder executes the guide: Track A (attorney, Step 2.1), Track B (NCMEC, Step 9.1), Track C (Step 4 accounts) can all start today.

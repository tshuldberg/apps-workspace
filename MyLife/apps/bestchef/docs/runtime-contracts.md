# bestchef runtime contracts

Preserved from `MyLife/apps/bestchef/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Moderator Console

Trust-and-safety operations live in `apps/bestchef-console` (plan 33 Phase
1.3), a SEPARATE internal Next.js app with its own CLAUDE.md. It holds the
Supabase service-role key server-side; never merge its surfaces into this
app or `apps/web`, and never add console strings to this app's i18n corpus.


## Cloud Layer

- **Edge functions** (7): `bestchef-*` delete-account, media-upload, media-finalize, nutrition, product-identity, vision, plus `moderate_vote_proof`. Provider-calling brokers enforce CHF-1 quotas: durable `bc_consume_provider_quota` ledger, kill switch, anonymous per-minute caps, fail-closed.
- **JWT split (OPS-04):** user-facing functions rely on gateway JWT verification (never deploy them `--no-verify-jwt`); worker functions (`bestchef-delete-account`, `moderate_vote_proof`) are worker-secret gated and MUST deploy `--no-verify-jwt`. Encoded in `scripts/deploy-functions.sh` and declaratively in `supabase/config.toml [functions.*]`.
- **Scheduled jobs:** rankings refresh + account-deletion worker via `pg_net` (`bc_job_config` rows required per environment; missing rows = silent no-op). `select bc_job_health();` (service role) reports config rows, pg_cron/pg_net, job schedules, last rankings update, and pending-deletion backlog.
- **Tables:** `bc_*` prefix with RLS. Media in Supabase Storage buckets. `bc-avatars` is the only public bucket (public profile media, size/MIME capped). `bestchef-submission-images` is private as of the 20260711 storage-privacy migration (audit C1): unapproved objects are unreachable by URL and approved images are served via short-lived signed URLs minted at render time. All other buckets are private + signed URLs.
- **i18n:** 21 locale catalogs under `app/(root)/i18n/`; keys must stay at 100 percent parity (escaped `\u` keys are invisible to naive greps; use the parity script). Parity is gate-enforced: root `pnpm check:i18n-parity` runs in the `check:parity` chain (CI + task-completion hook) and in pre-commit when staged files touch the i18n tree.


## EAS Environment Contract (production builds)

- iOS-first is official: `app.json` declares `platforms: ["ios"]`, there is no Android native project, and `eas.json` has no Android profiles.
- `eas.json` injects NO env. Production values live in the EAS dashboard only; the committed `.env.local` points at STAGING and is excluded from builds via `.easignore`.
- The production profile MUST carry: `EXPO_PUBLIC_SUPABASE_URL` (must reference prod ref `zjxabnazbdocrqpyixgo`), `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` (plus `EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL` for auth deep links).
- `scripts/assert-eas-production-env.mjs` runs via the `eas-build-pre-install` hook and FAILS a production build wired to staging or missing the URL/key, so misconfiguration surfaces at build time instead of burning a TestFlight build (see errors_log 2026-05-08/05-11).
- Env must be read as direct `process.env.EXPO_PUBLIC_*` member expressions (babel-preset-expo inlines those only; aliased `env` objects break Hermes bundles).
- Crash reporting (Sentry) is inert unless `EXPO_PUBLIC_BESTCHEF_SENTRY_DSN` is set in the production profile (no DSN = no client, zero network; see `app/(root)/observability/sentry.ts`). The `@sentry/react-native/expo` plugin ships with `disableAutoUpload: true` so credential-less builds succeed: without it, the Xcode Release source-map upload phase FAILS the build (same burn-a-build class as the assert above). To enable symbolicated stack traces, set `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` in the EAS prod env, replace the placeholder org/project in `app.json`, and flip `disableAutoUpload` to false. Runtime crash capture works either way; only symbolication depends on the upload.


## Relationship to Hub Module

- Module ID: `recipes`, implemented in `modules/bestchef` (`@mylife/bestchef`)
- Hub module owns local recipe CRUD, canonical food identity, nutrition provenance, pantry, receipt/photo/expiration import confirmation flows, meal planning, shopping lists
- Hub `(recipes)` routes still ship inside `apps/mobile/app/(recipes)/`; BestChef is additive
- Both share design tokens from `@mylife/bestchef/ui/tokens`
- `pnpm check:module-parity` enforces the pairing (`standalone_app` status)

### Hub is a scoped adapter, NOT parity-complete (honesty)

This standalone app is the canonical BestChef product. The hub `recipes` surfaces
(`apps/mobile/app/(recipes)/`, `apps/web/app/recipes/`) are a SCOPED ADAPTER over
the shared `@mylife/bestchef` package: they share the full local kitchen but do
NOT reproduce the standalone's cloud social layer in full. Do not claim hub parity
anywhere. What the hub adapter omits vs this app (audit M15,
`docs/reports/REPORT-bestchef-adversarial-production-audit-2026-07-10.md`):

- Web hub `recipes` cloud wiring is READ / VOTE only.
- Missing on web: chef-profile edit, follow, cloud comments, and the
  moderation-facing UGC flows this app ships.

Widening the hub adapter to full cloud parity is a founder decision, not an
implicit goal. The module declares `requiresNetwork: true` because its headline
competitive/social function needs a connection even though the local kitchen
subset runs offline.


## Demo Fixture Policy (F-044)

Production builds never render `DEMO_*` fixture data. The render gate is
`shouldShowDemoContent()` from `app/(root)/data/public-render-policy.ts`.
In public-launch builds (`EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH=1` or
`NODE_ENV=production`) the gate returns false unless the build carries an
explicit approved editorial seed-content provenance.

Dev-only re-enable: set `EXPO_PUBLIC_USE_DEMO_FIXTURES=true` in a
non-production build. The helper `shouldUseDemoFixturesInDev()` checks
both `__DEV__` and that env var; it is always false in production.


## Trust-and-Safety Reports (B-003)

Public-launch report submissions never get silently dropped. When the
cloud insert into `bc_flags` fails, `ReportMenu.submit()` enqueues the
payload into the local `rc_pending_reports` SQLite table plus a best-
effort cloud row in `bc_pending_reports`. The user sees a clear "Report
saved, we'll send it when you're back online." confirmation. The sweeper
`retryPendingReports()` retries with exponential backoff. Users can see
their pending reports at `/my-reports` (pull-to-refresh triggers a
manual sweep).

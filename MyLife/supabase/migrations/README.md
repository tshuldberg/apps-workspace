# Supabase migrations

This directory holds SQL migrations for THREE separate Supabase projects that
share one folder: BestChef, DoWork, and MyNews. Each migration filename is
prefixed by its owning app (`bestchef_`, `dowork_`, `mynews_`) after the
timestamp. Each project is linked and pushed independently (`supabase link
--project-ref <ref>` then `supabase db push`), so a given `db push` applies only
that project's migrations against that project's database.

## Timestamp collision constraint (audit L8)

Because three apps share this folder, several 14-digit timestamp prefixes are
reused ACROSS apps. As of 2026-07-11 the colliding prefixes are:

| Timestamp | Files sharing it (different apps) |
|---|---|
| `20260703000001` | `bestchef_job_health`, `dowork_trainer_platform_v2`, `mynews_bootstrap` |
| `20260703000002` | `bestchef_integrity_floor`, `dowork_form_check_storage`, `mynews_rpcs` |
| `20260703000003` | `bestchef_appeals`, `mynews_editing_desk` |
| `20260704000001` | `bestchef_saved_submissions`, `dowork_push_prefs` |
| `20260704000002` | `bestchef_media_purge_job`, `dowork_entitlement_hardening` |

**This is safe, and here is why.** Migration order only has to be deterministic
and correct WITHIN a single project, because migrations only ever run against
their own project's database. Verified 2026-07-11:

- No two files owned by the SAME app share a timestamp. Every `*bestchef*`,
  `*dowork*`, and `*mynews*` set has unique timestamps internally, so within any
  one project the ordering is fully determined by the timestamp alone. The
  alpha-sort tie-break on the app-name suffix is NEVER exercised inside a single
  project's run.
- The collisions above are strictly cross-app. Those files never execute against
  the same database, so their relative order is irrelevant to correctness.

The Supabase CLI applies migrations in lexicographic filename order, so even if a
future within-project collision were introduced, the app-name-then-slug suffix
would still produce a stable order. Do not rely on that as a feature.

## Convention (going forward)

- **Never rename a migration that may already be applied to staging or prod.**
  The `supabase_migrations.schema_migrations` ledger keys on the timestamp
  version; renaming an applied migration corrupts that ledger and can trigger a
  re-run or a drift error. The colliding files above are left exactly as-is.
- **Use a unique 14-digit timestamp for every NEW migration**, even across apps.
  Prefer the real UTC authoring time (`date -u +%Y%m%d%H%M%S`) rather than a
  hand-typed `...000001` placeholder, which is what produced these collisions.
- **Keep the app-name prefix** (`<timestamp>_<app>_<slug>.sql`) so ownership is
  obvious and a project's own migrations are greppable.

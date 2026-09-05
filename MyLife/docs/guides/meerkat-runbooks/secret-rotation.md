# Runbook: secret-rotation

Rotate every production secret family WITHOUT a moment where the fleet has no valid
credential. Records a `secret_rotation` rehearsal proof.

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns NO live secrets: every
> secret is injected at deploy time from `deploy/compose.production.yml`
> (`${VAR:?...}` env and `/run/secrets/*` files). The rotation itself (minting new
> credentials, provisioning the overlap, retiring the old) is founder-ops against the
> real secret store and providers. The rehearsal CLI records the outcome; it never
> holds, prints, or rotates a secret, and it never fabricates a rotation verdict.

## The two-key-overlap requirement (the whole point)

**A single-live-key turnover moment is a drill FAILURE.** During any rotation the OLD
and NEW credentials MUST BOTH be simultaneously valid for the entire cutover window:

1. Provision the NEW credential at the provider/store while the OLD one still works
   (two valid keys overlap).
2. Roll the fleet onto the NEW credential (rolling restart; each service picks up the
   new env/secret on restart).
3. Verify every service is healthy on the NEW credential.
4. ONLY THEN retire the OLD credential at the provider.

If at any point the sole valid credential is being swapped in-place (old invalidated
before new is live), a request in flight can hit a dead credential: that is the exact
gap this ordering closes. A rotation that skipped the overlap is recorded `failed` even
if the fleet happened to survive.

## Secret families (from `deploy/compose.production.yml`)

Rotate each family with the overlap discipline above. Grouped by how they are injected:

### File-mounted secrets (`/run/secrets/*`, the `secrets:` block)

| Family | Compose secret / file var | Notes |
|---|---|---|
| PostgreSQL CA bundle | `postgres_ca` <- `POSTGRES_CA_FILE` (`/run/secrets/postgres-ca.pem`) | verify-full TLS trust anchor. Overlap = trust BOTH old and new CA during the window (bundle them) so a service on either CA still validates. |
| Object-store access key id | `object_store_access_key` <- `OBJECT_STORE_ACCESS_KEY_FILE` | hosted service `/run/secrets/object-store-access-key`. Provision a second active key pair at the object store before retiring the first. |
| Object-store secret access key | `object_store_secret_key` <- `OBJECT_STORE_SECRET_KEY_FILE` | rotate together with the access key id as one key pair. |

### Database role credentials (per-service `MEERKAT_POSTGRES_URL`)

Each service connects as its OWN least-privilege role via a distinct URL var; rotate
each role's password independently:

| Family | Compose var | Role |
|---|---|---|
| humanity DB URL | `HUMANITY_DATABASE_URL` | `meerkat_humanity` |
| hosted DB URL | `HOSTED_DATABASE_URL` | `meerkat_hosted` |
| persona DB URL | `PERSONA_DATABASE_URL` | `meerkat_persona` |
| directory DB URL | `DIRECTORY_DATABASE_URL` | `meerkat_directory` |
| community DB URL | `COMMUNITY_DATABASE_URL` | `meerkat_community` |
| community moderation DB URL | `COMMUNITY_MODERATION_DATABASE_URL` | `meerkat_moderation` |

Postgres role rotation supports overlap natively: `ALTER ROLE <role> PASSWORD '<new>'`
followed by rolling the service's URL, but to keep BOTH valid during the window, add a
transient second role or use the provider's dual-password feature. If your provider
cannot hold two passwords for one role, provision a second role with identical grants
(reuse `meerkat-postgres-role-grants`), roll onto it, then retire the first.

### Application signing / shared secrets (env `${VAR:?...}`)

| Family | Compose var(s) | Overlap strategy |
|---|---|---|
| Entitlement signing | `ENTITLEMENT_SECRET` (shared: hosted, persona-adjacent, community) | verifiers must accept BOTH old and new during the window; rotate signers last. Because this is shared across services, roll it fleet-wide as one coordinated step. |
| Humanity signing | `HUMANITY_SIGNING_KEY`, `HUMANITY_SERVICE_PUBLIC_KEY` | publish the new public key to verifiers (persona) BEFORE the humanity service signs with the new private key. |
| Persona session/admin | `MEERKAT_PERSONA_SESSION_SECRET`, `MEERKAT_PERSONA_ADMIN_SECRET` | session secret rotation invalidates existing sessions unless dual-accepted; overlap by accepting both until old sessions age out. |
| App unlock token | `MEERKAT_APP_UNLOCK_TOKEN_SECRET` (hosted + community) | shared across two services: rotate both in the same window. |
| Billing | `WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `REVENUECAT_REST_API_KEY` | rotate at the provider first (provider issues the new secret), configure the new one alongside the old at the provider's rotation window, then roll the fleet. |
| Directory announce HMAC | `MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY` (shared 64-hex) | announcer and verifier share it; both must accept the new key before the announcer signs with it. |
| Turnstile | `TURNSTILE_SECRET` | rotate at Cloudflare; overlap per provider capability. |
| Operator console | `MEERKAT_OPERATOR_CONSOLE_SECRET` | rotate and roll community; no external dependency. |

## Preconditions

- A staging (then production) fleet from an approved release.
- Founder-ops access to the secret store and every provider console.
- A fresh backup proof (`backup-stale.md` exit 0) before rotating database credentials.

## Procedure (per family, FOUNDER-OPS with repo verification)

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

1. **Provision the NEW credential (founder-ops).** Both old and new now valid.
2. **Roll the fleet (founder-ops).** Update the env/secret and rolling-restart the
   affected services (same compose pull/up idiom as `release-promotion.md`, no image
   change):
   ```bash
   docker compose --env-file <env-with-new-secret> \
     -f packages/meerkat-relay/deploy/compose.production.yml up -d <service...>
   ```
3. **Verify on the NEW credential (repo tooling).** Readiness proves the new credential
   works end to end (a bad DB URL or CA makes `/readyz` fail closed):
   ```bash
   curl -fsS http://<host>:8894/readyz | jq -c '{ready, checks}'   # expect ready:true
   ```
   Run a short load pass (WP-7B) to prove real traffic succeeds on the new credential,
   not just the health probe:
   ```bash
   pnpm --filter @mylife/meerkat-relay load:relay -- --target ws://<relay-host>:8787 \
     --duration 60 --rate <baseline-rate> > /drill/rotation-<family>.ndjson
   ```
4. **Retire the OLD credential (founder-ops).** ONLY after step 3 is green for every
   service that uses the family. The overlap window closes here.

## Decision criteria

- Every affected service passed `/readyz` and the load pass on the NEW credential BEFORE
  the OLD credential was retired, for every family rotated -> **PASS**.
- The old credential was invalidated before the new one was verified live (no overlap),
  or any service failed readiness on the new credential -> **FAIL**. Record `failed`.
- A rotation you had to back out (new credential broke a service) is `aborted`: restore
  the old credential (still valid because you had not retired it) and roll back.

## Step - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind secret_rotation --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/rotation-evidence.ndjson
```

Evidence is the drill's own outputs: the readyz JSON + load verdict per family, and a
note stating the overlap was honored (old retired only after new verified). NEVER put a
secret value in the evidence file; the CLI attaches evidence IN FULL and the rows are
immutable. A `passed` verdict requires non-vacuous evidence.

## DO-NOT

- Do NOT echo a secret, connection string, or key into a shell that logs, a chat
  channel, or the evidence file. Copy the redacted signal, never the raw value.
- Do NOT retire the old credential before the new one is verified live on every service
  that uses it. That single-live-key moment is the failure this drill exists to prevent.
- Do NOT rotate a database credential while a backup proof is failing.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Mint new credential + overlap | — | provider/secret-store rotation |
| Roll the fleet onto the new secret | compose up (checklist rail) | operator runs it on real hosts |
| Verify the new credential works | `/readyz`, `load:relay` | observed on the real fleet |
| Retire the old credential | — | provider/secret-store retirement |
| Record the proof | `rehearsal:postgres --record --kind secret_rotation` | operator runs it after the real drill |

See also `release-promotion.md` (rolling-restart idiom), `backup-stale.md`.

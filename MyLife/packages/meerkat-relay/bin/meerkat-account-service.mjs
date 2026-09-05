#!/usr/bin/env node
/**
 * Meerkat VERIFICATION-ACCOUNT SERVICE (Plan 51, P1 + P5). The deployable that owns the
 * outer identity layer: Sign in with Apple / Google token verification, the minimal
 * verification account (provider subject, optional relay email, human/age/consent state,
 * entitlement state, credential-issuance quota), entitlement webhooks, blind credential
 * issuance + renewal, and account deletion. It is a SEPARATE image in the persona-service
 * lineage (it needs @mylife/sync at runtime); it is NEVER merged into the slim ws+zod relay
 * image and it touches no relay/community/moderation state.
 *
 * THE WALL. This service is the only component that both learns which store account is
 * signing in AND blind-signs anonymous credentials, yet it persists no link between the two:
 * issuance is blind (it never sees a token message, nonce, or serial), and the expiring
 * serial that transits at renewal is checked and discarded, never stored or logged. Every
 * log line is deep-redacted through redactForLog; the log-hygiene canary boots this bin and
 * asserts the session secret, epoch key secret, a provider subject, a relay email, and a
 * credential serial never reach stdout.
 *
 * FAIL-CLOSED START + HONEST BOOT LOG. It refuses to boot without a session secret; in
 * postgres mode it additionally requires the epoch key secret and a live database. It never
 * fabricates a capability: an unconfigured SSO provider or entitlement rail is honestly OFF
 * (503 not_configured), and the ready log names each capability's real state.
 *
 *   - MEERKAT_ACCOUNT_SESSION_SECRET (required): HMAC secret that signs + verifies account
 *     session bearers. Without it the service cannot mint/verify a session, so it refuses to
 *     boot (fail closed: no unverifiable bearers).
 *   - MEERKAT_ACCOUNT_EPOCH_KEY_SECRET: AES-256-GCM seal secret for epoch signing private
 *     keys. Required in postgres (first-party) mode; without it credential issuance answers
 *     503 not_configured. Compromise enables forgery for one epoch (rotated away next epoch),
 *     never deanonymization.
 *   - APPLE / GOOGLE SSO:
 *       MEERKAT_APPLE_SERVICE_IDS  (comma-separated Apple service/bundle ids for `aud`)
 *       MEERKAT_GOOGLE_CLIENT_IDS  (comma-separated Google OAuth client ids for `aud`)
 *     An unconfigured provider => sign-in for that provider is OFF (not_configured). The JWKS
 *     source is the providers' published HTTPS endpoints.
 *   - ENTITLEMENT RAILS (each independent; unconfigured => that webhook is 503 not_configured).
 *     HONESTY GATE: transport secrets alone do not turn a rail on. Mapping a verified
 *     payload to an entitlement event needs a per-rail payload resolver (founder-ops,
 *     startAccountService `resolvers`); none is wired in this bin yet, so every rail
 *     currently reports OFF and answers not_configured even with its secret set:
 *       MEERKAT_ASSN_ROOT_CA          Apple App Store Server Notifications JWS root CA (PEM,
 *                                     inline). MEERKAT_ASSN_ROOT_CA_FILE (a mounted PEM path)
 *                                     takes precedence: dotenv interpolation cannot carry a
 *                                     multiline PEM, so production mounts the file. A set but
 *                                     unreadable file path is a fatal boot error (fail closed,
 *                                     never a silently-OFF rail the operator meant to enable).
 *                                     Both absent => Apple webhook is a documented fail-closed
 *                                     not_configured (the JWS chain verifier is founder-ops).
 *       MEERKAT_PLAY_RTDN_AUDIENCE    Google Play RTDN Pub/Sub push bearer audience.
 *       MEERKAT_STRIPE_WEBHOOK_SECRET Stripe webhook signing secret (whsec_...).
 *   - MEERKAT_ALLOWED_ORIGINS: exact browser origins allowed to call this service.
 *   - MEERKAT_ACCOUNT_SESSION_TTL_MS: optional session lifetime override (clamped [60s, 24h]).
 *   - MEERKAT_DEPLOYMENT_PROFILE / MEERKAT_STORE_BACKEND: explicit durable-state authority.
 *     Self-host file mode uses DATA_DIR; first-party mode requires PostgreSQL with verify-full
 *     TLS and never falls back to filesystem state.
 *   - PORT (default 8896) / HOST (default 0.0.0.0) / DATA_DIR (default ./.meerkat-account).
 *     (8890 community, 8892 humanity, 8893 hosted, 8894 persona, 8895 push, 8896 account --
 *     all distinct, matching deploy/compose.production.yml.)
 *
 * Run from source with tsx:
 *
 *   PORT=8896 HOST=0.0.0.0 DATA_DIR=~/.meerkat/account \
 *     MEERKAT_ACCOUNT_SESSION_SECRET=<hmac-secret> \
 *     MEERKAT_APPLE_SERVICE_IDS=com.mylife.meerkat \
 *     MEERKAT_ALLOWED_ORIGINS=https://app.example \
 *     tsx bin/meerkat-account-service.mjs
 *
 * Region deploy (NAT/TLS at the edge, the always-on soak) is founder ops. Do not touch the
 * Dockerfile or the relay server graph.
 */

import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  AccountService,
  FileAccountStore,
  FileCredentialBridgeStore,
  PostgresAccountStore,
  PostgresCredentialBridgeStore,
  createSsoTokenVerifier,
  createHttpJwksSource,
  startAccountService,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  parseCorsAllowedOrigins,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  postgresReadyProbe,
  dataDirWritableProbe,
} from '../src/index.ts';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

// Every log event is deep-redacted before it reaches stdout: a denylisted key (session
// secret, epoch key secret, provider subject, relay email, serial), a connection string
// with a password, or a bearer blob is scrubbed while counts, ids, urls, and public keys
// pass through.
const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(error instanceof Error ? error.message : String(error?.message ?? error));

const port = Number(process.env.PORT ?? 8896);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-account';
const corsAllowedOrigins = parseCorsAllowedOrigins(process.env.MEERKAT_ALLOWED_ORIGINS);

// The session secret is required: without it the service can neither mint nor verify an
// account session bearer, so it would be a fake capability. Refuse to boot.
const sessionSecret = (process.env.MEERKAT_ACCOUNT_SESSION_SECRET ?? '').trim();
if (!sessionSecret) {
  out({
    event: 'fatal',
    reason: 'session_secret_missing',
    detail: 'MEERKAT_ACCOUNT_SESSION_SECRET is required; refusing to start (fail closed: no unverifiable bearers).',
  });
  process.exit(1);
}
if (corsAllowedOrigins.length === 0) {
  out({
    event: 'fatal',
    reason: 'allowed_origins_missing',
    detail: 'MEERKAT_ALLOWED_ORIGINS is required (exact browser origins allowed to call this service).',
  });
  process.exit(1);
}

const epochKeySecret = (process.env.MEERKAT_ACCOUNT_EPOCH_KEY_SECRET ?? '').trim();
// Optional HMAC key for the deletion-subject tombstone hash. When set, the subject
// marker is unforgeable without the key, so a DB reader with a candidate SSO subject
// cannot confirm a deletion. MUST be stable for the deployment's lifetime (a change
// orphans existing tombstones). Absent => unkeyed SHA-256 (dev/un-provisioned).
const subjectHashSecret = (process.env.MEERKAT_ACCOUNT_TOMBSTONE_SECRET ?? '').trim() || undefined;
const sessionTtlMs = Number(process.env.MEERKAT_ACCOUNT_SESSION_TTL_MS ?? NaN);

// SSO provider configuration. An unset provider list => that provider is honestly OFF
// (createSsoTokenVerifier returns not_configured for it).
const parseIdList = (raw) => (raw ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const appleServiceIds = parseIdList(process.env.MEERKAT_APPLE_SERVICE_IDS);
const googleClientIds = parseIdList(process.env.MEERKAT_GOOGLE_CLIENT_IDS);
const ssoConfig = {
  ...(appleServiceIds.length > 0 ? { apple: { serviceIds: appleServiceIds } } : {}),
  ...(googleClientIds.length > 0 ? { google: { clientIds: googleClientIds } } : {}),
};

// Entitlement-rail config. Each rail is independent and unconfigured rails are honestly OFF.
// The Apple ASSN root CA is a multiline PEM: a mounted file (MEERKAT_ASSN_ROOT_CA_FILE) takes
// precedence over the inline env because dotenv interpolation cannot carry newlines. A set but
// unreadable, empty, or non-certificate file is fatal: the operator intended the rail ON, so
// booting with it silently OFF would be a faked capability state.
let appleRootCa = (process.env.MEERKAT_ASSN_ROOT_CA ?? '').trim() || undefined;
const appleRootCaFile = (process.env.MEERKAT_ASSN_ROOT_CA_FILE ?? '').trim();
if (appleRootCaFile) {
  try {
    appleRootCa = readFileSync(appleRootCaFile, 'utf8').trim() || undefined;
    if (!appleRootCa) throw new Error('file is empty');
    new X509Certificate(appleRootCa); // parse or die: a wrong/truncated PEM must not boot as ON
  } catch (error) {
    out({
      event: 'fatal',
      reason: 'assn_root_ca_file_unreadable_or_invalid',
      detail: errorDetail(error),
    });
    process.exit(1);
  }
}
const googleRtdnAudience = (process.env.MEERKAT_PLAY_RTDN_AUDIENCE ?? '').trim() || undefined;
const stripeWebhookSecret = (process.env.MEERKAT_STRIPE_WEBHOOK_SECRET ?? '').trim() || undefined;

// FOUNDER-OPS SEAM (plan 51). The HTTP layer verifies rail transport authenticity
// (Apple JWS chain, Play RTDN audience, Stripe HMAC) but mapping a VERIFIED payload
// to an entitlement event requires a per-rail payload resolver
// (startAccountService's `resolvers` option), and NO resolver is wired in this bin
// yet. A rail with its secret set but no resolver could never record an entitlement:
// every authentic provider event would answer 400 while the ready log claimed the
// rail was on -- a faked capability. Fail honest instead: until its resolver is
// wired, a rail stays not_configured (503) no matter which secrets are set, and the
// ready log names the real blocker. When the founder-ops resolvers land, wire them
// through startAccountService({ resolvers }) AND flip the matching railConfig keys
// back on here in the same change.
const RAIL_RESOLVERS_WIRED = { apple: false, google: false, stripe: false };
const railConfig = {
  ...(appleRootCa && RAIL_RESOLVERS_WIRED.apple ? { appleServerNotificationRootCa: appleRootCa } : {}),
  ...(googleRtdnAudience && RAIL_RESOLVERS_WIRED.google ? { googleRtdnAudience } : {}),
  ...(stripeWebhookSecret && RAIL_RESOLVERS_WIRED.stripe ? { stripeWebhookSecret } : {}),
};
const railState = (secretPresent, wired, offHint) => {
  if (secretPresent && wired) return 'configured';
  if (secretPresent) return 'OFF (secret set but the payload resolver is not wired: founder-ops)';
  return `OFF (${offHint})`;
};

let runtimeConfig;
let storeRuntime;
let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  let failed = false;
  if (server) {
    try {
      await server.close();
    } catch {
      failed = true;
    }
  }
  if (storeRuntime) {
    try {
      await storeRuntime.close();
    } catch {
      failed = true;
    }
  }
  if (failed) {
    out({ event: 'fatal', reason: 'shutdown_failed' });
    process.exit(1);
  }
  process.exit(0);
}
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

// Process guards (audit 2026-09-01, R4). Node terminates on an unhandled
// rejection by default, so any request path that leaks one is a one-request
// restart of this service. Log a structured, id-free line and keep serving; an
// uncaught synchronous exception still exits (state may be inconsistent) so the
// supervisor restarts cleanly.
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : null;
  console.error(JSON.stringify({ event: 'unhandled_rejection', name: error?.name ?? typeof reason, message: String(error?.message ?? reason).slice(0, 200) }));
});
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({ event: 'uncaught_exception', name: error?.name ?? 'Error', message: String(error?.message ?? error).slice(0, 200) }));
  process.exit(1);
});

// Orphan watchdog (2026-09-02 memory exhaustion incident). When the process that
// spawned this service dies abnormally, leave through the SIGTERM path above
// rather than surviving forever re-parented to init. Never arms in production: a
// container PID 1, or a service adopted by systemd or an init shim, has no
// supervising parent whose death could orphan it.
installOrphanWatchdog({ log: (event) => console.error(JSON.stringify(event)) });

try {
  runtimeConfig = resolveMeerkatStoreRuntimeConfig({
    service: 'account',
    env: { ...process.env, DATA_DIR: dataDir },
  });
  storeRuntime = await createMeerkatStoreRuntime(runtimeConfig);
} catch (error) {
  out({
    event: 'fatal',
    reason: 'state_authority_unavailable',
    detail: errorDetail(error),
  });
  process.exit(1);
}

try {
  let accountStore;
  let bridgeStore;
  let backendReadyChecks;
  if (runtimeConfig.backend === 'file') {
    if (!runtimeConfig.dataDir) throw new Error('File state backend is missing DATA_DIR');
    accountStore = new FileAccountStore(runtimeConfig.dataDir, { subjectHashSecret });
    bridgeStore = new FileCredentialBridgeStore(runtimeConfig.dataDir);
    backendReadyChecks = [{ name: 'data_dir', required: true, probe: dataDirWritableProbe(runtimeConfig.dataDir) }];
  } else {
    // First-party postgres mode additionally requires the epoch key secret: without it
    // credential issuance could never seal a key, so the service would advertise a
    // capability it cannot honor. Fail closed at boot.
    if (!epochKeySecret) {
      throw new Error('MEERKAT_ACCOUNT_EPOCH_KEY_SECRET is required in postgres mode (credential issuance seals epoch keys under it).');
    }
    if (!storeRuntime.database) throw new Error('PostgreSQL state backend did not initialize');
    accountStore = new PostgresAccountStore(storeRuntime.database, subjectHashSecret);
    bridgeStore = new PostgresCredentialBridgeStore(storeRuntime.database);
    backendReadyChecks = [{ name: 'postgres', required: true, probe: postgresReadyProbe(storeRuntime.pool) }];
  }

  const ssoVerifier = createSsoTokenVerifier({
    config: ssoConfig,
    jwksSource: createHttpJwksSource(),
  });

  const service = new AccountService({
    accountStore,
    bridgeStore,
    sessionSecret,
    ssoVerifier,
    epochKeySecret,
    railConfig,
    ...(Number.isFinite(sessionTtlMs) ? { sessionTtlMs } : {}),
  });

  const healthEndpoints = createHealthEndpoints({ service: 'account', checks: backendReadyChecks });

  server = await startAccountService({
    service,
    corsAllowedOrigins,
    port,
    host,
    healthEndpoints,
    log: (event, detail) => out({ event, ...detail }),
  });
} catch (error) {
  try {
    await storeRuntime.close();
  } catch {
    out({ event: 'fatal', reason: 'state_authority_close_failed' });
  }
  out({
    event: 'fatal',
    reason: 'startup_failed',
    detail: errorDetail(error),
  });
  process.exit(1);
}

out({
  event: 'ready',
  url: server.url,
  stateBackend: storeRuntime.config.backend,
  ...(storeRuntime.config.dataDir ? { dataDir: storeRuntime.config.dataDir } : {}),
  // Honest capability report: never claim a route works when its dependency is unset.
  appleSignIn: appleServiceIds.length > 0 ? 'configured' : 'OFF (set MEERKAT_APPLE_SERVICE_IDS)',
  googleSignIn: googleClientIds.length > 0 ? 'configured' : 'OFF (set MEERKAT_GOOGLE_CLIENT_IDS)',
  credentialIssuance: epochKeySecret ? 'configured' : 'OFF (set MEERKAT_ACCOUNT_EPOCH_KEY_SECRET)',
  tombstoneHash: subjectHashSecret ? 'hmac' : 'UNKEYED (set MEERKAT_ACCOUNT_TOMBSTONE_SECRET)',
  appleWebhook: railState(Boolean(appleRootCa), RAIL_RESOLVERS_WIRED.apple, 'mount the Apple root PEM and set MEERKAT_ASSN_ROOT_CA_FILE'),
  googleWebhook: railState(Boolean(googleRtdnAudience), RAIL_RESOLVERS_WIRED.google, 'set MEERKAT_PLAY_RTDN_AUDIENCE'),
  stripeWebhook: railState(Boolean(stripeWebhookSecret), RAIL_RESOLVERS_WIRED.stripe, 'set MEERKAT_STRIPE_WEBHOOK_SECRET'),
});

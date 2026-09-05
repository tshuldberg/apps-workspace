#!/usr/bin/env node
/**
 * Meerkat COMMUNITY NODE -- the always-on community half (community feed P2 + P6
 * ops). A self-hostable box a community runs (or rents) that persists each
 * community's rolling SNAPSHOTS + live TAIL as opaque ciphertext and gates pulls
 * with per-member SIGNED AUTH. It is the SECOND deployable image over the SAME
 * codebase as the seeder (bin/meerkat-node.mjs); it needs @mylife/sync at runtime
 * and a DATA_DIR volume, so it is NOT built by the slim ws+zod-only relay image.
 *
 * Zero-knowledge: the node NEVER decrypts. It verifies snapshot pieces by HASH,
 * verifies only the OUTER author signature on tail entries, and serves opaque
 * sealed bytes. Logs are counts/paths only. (P6 item 6.)
 *
 * Run from source with tsx (the monorepo resolves the TS entry):
 *
 *   PORT=8890 HOST=0.0.0.0 DATA_DIR=~/.meerkat/community \
 *     tsx bin/meerkat-community-node.mjs
 *
 * Durability + hardening (P6):
 *  - FileSeederPieceStore(DATA_DIR/pieces)   opaque snapshot/tail pieces
 *  - FileCommunityDescriptorStore(DATA_DIR/descriptors)  restart-safe revision
 *    monotonicity so an owner-signed OLDER roster cannot re-grant a removed member
 *    after a restart.
 *  - per-device rate limits (publish/append/pull) + a global challenge ceiling.
 *
 * Optional liveness notify (P6 item 6): set NOTIFY_RELAY_URL to a ws(s) relay and
 * the node parks ONE content-FREE notify ping (an env frame on the community's
 * notify token) after a real change, so a polling subscriber wakes and pulls. The
 * relay sees only an opaque token + opaque bytes. OFF unless NOTIFY_RELAY_URL is
 * set.
 *
 * Optional announce loop: set ANNOUNCE_RELAY_URL + PUBLIC_BASE_URL +
 * ANNOUNCE_COMMUNITY_IDS (comma-separated) to advertise this node's reachable url
 * for those communities to the host registry on an interval. OFF unless all three
 * are set. Production deployment (NAT/TLS, a baked default relay, the always-on
 * soak) is founder ops.
 *
 * Optional PRIVATE history-host announce loop (Plan 43 WP-43G): reuses the same
 * three env vars above (a private twin of the public announce loop) to advertise
 * WHERE this node serves each community's sealed cold-start history snapshot, so
 * a rejoining/reinstalled member's runAutomaticHistorySync can discover it
 * zero-knowledge to the relay. Only announces a community with a CURRENT
 * descriptor and a serveable snapshot, and only over an https PUBLIC_BASE_URL.
 * HISTORY_ANNOUNCE_TTL_MS / _LEAD_MS / _MS / _MAX_PER_TICK / _JITTER_MS /
 * _MAX_OBJECT_BYTES env-tune the schedule (safe clamped defaults).
 */

import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  CommunityNode,
  FileSeederPieceStore,
  FileCommunityDescriptorStore,
  FileCommunityJoinStore,
  FilePublicationStore,
  FileKillStore,
  FileReportStore,
  FilePublicPostStore,
  FileOperatorConsoleStore,
  OperatorConsoleService,
  createPersonaAdminHttpClient,
  parseCommonsProvisioning,
  startCommunityNodeHttp,
  startOperatorConsoleHttp,
  personaSessionVerifyEndpoint,
  createHumanityRedeemClient,
  parseCorsAllowedOrigins,
  HashSetAbuseScanner,
  UnavailableAbuseScanner,
  NcmecReportQueue,
  FileNcmecReportQueueStore,
  DmcaIntakeService,
  FileDmcaIntakeStore,
  FileAdmissionGenerationStore,
  PostgresAdmissionGenerationStore,
  createCommunityRoomMembershipVerifier,
  resolveDmcaAgentConfigFromEnv,
  dmcaAgentPublicBlock,
  DmcaAgentConfigError,
  evaluateOperatorAlerts,
  evaluateDmcaDeadlines,
  createMeerkatStoreRuntime,
  resolveMeerkatStoreRuntimeConfig,
  PostgresCommunityDescriptorStore,
  PostgresCommunityPrivateStateStore,
  PostgresPublicationStore,
  PostgresKillStore,
  PostgresReportStore,
  PostgresPublicPostStore,
  PostgresOperatorConsoleStore,
  PostgresNcmecReportQueueStore,
  PostgresDmcaIntakeStore,
  FileArchiveLifecycleStore,
  PostgresArchiveLifecycleStore,
  FileObjectStore,
  FileObjectReferenceLedger,
  PostgresObjectReferenceLedger,
  FileObjectDeletionJobStore,
  PostgresObjectDeletionJobStore,
  ArchiveObjectByteService,
  HostedRequestLimiter,
  InMemoryArchiveRequestNonceStore,
  createS3ObjectStoreFromRuntimeConfig,
  shadowedStore,
  publicationStoreClassification,
  reportStoreClassification,
  publicPostStoreClassification,
  killStoreClassification,
  operatorConsoleStoreClassification,
  communityDescriptorStoreClassification,
  communityPrivateStateStoreClassification,
  ncmecReportQueueStoreClassification,
  dmcaIntakeStoreClassification,
  redactForLog,
  redactErrorDetail,
  createHealthEndpoints,
  createMetricsRegistry,
  resolveMetricsListenerConfig,
  startMetricsListener,
  postgresReadyProbe,
  dataDirWritableProbe,
  loadStorageOperatorKeyFromFile,
  StorageDescriptorService,
  buildSealedHistoryAnnouncement,
  planHistoryAnnouncements,
} from '../src/index.ts';
// FileCommunityPrivateStateStore is not re-exported by the main barrel; import it
// directly (the persona bin imports PostgresOperatorConsoleStore the same way).
import { FileCommunityPrivateStateStore } from '../src/community-private-state-store-file.ts';
import {
  WebSocketRelayBackend,
  announceHost,
  communityRole,
  publicPostNodeKeypairFromSeed,
} from '@mylife/sync';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

// Every log event is deep-redacted before it reaches stdout (Plan 44 WP-4B): a
// denylisted key, a connection string with a password (community OR moderation
// URL), or a bearer blob is scrubbed while counts, ids, urls, and public keys
// pass through. errorDetail() additionally scrubs the free-form error string on
// the fatal paths.
const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...redactForLog(obj) }) + '\n');
const errorDetail = (error) => redactErrorDetail(String(error?.message ?? error));

// The community node holds THREE least-privilege PostgreSQL contexts in first-party
// mode: `communityRuntime` (the meerkat_community role: descriptors, publications,
// kills, reports, public posts, and the private feed state) and `moderationRuntime`
// (the meerkat_moderation role: operator console audit/triage, the NCMEC queue, and
// DMCA intake). Splitting them means the community role never holds moderation
// grants and vice versa. `archiveRuntime` is the managed archive intake authority and owns only
// archive intake plus object reference/deletion verbs. In file mode all three stay null.
let communityRuntime = null;
let moderationRuntime = null;
let archiveRuntime = null;
let archiveRuntimeConfig = null;

// Close both pools (idempotent per runtime via createMeerkatStoreRuntime.close) and
// swallow individual close failures so one bad pool never masks the other. Returns
// true only when every open runtime closed cleanly.
async function closeRuntimes() {
  let ok = true;
  for (const runtime of [communityRuntime, moderationRuntime, archiveRuntime]) {
    if (!runtime) continue;
    try {
      await runtime.close();
    } catch {
      ok = false;
    }
  }
  return ok;
}

// Fail-closed exit that first releases any open pool. Used by every fatal path that
// can run AFTER the pools open, so a startup error never leaks a connection.
async function fatalExit(detail) {
  await closeRuntimes();
  out(detail);
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8890);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-community';
const piecesDir = path.join(dataDir, 'pieces');
const descriptorsDir = path.join(dataDir, 'descriptors');
// Plan 57 W4: durable join-queue boxes (restart-safe parked join handshakes).
const joinsDir = path.join(dataDir, 'joins');
const publicationsDir = path.join(dataDir, 'publications');
const killsDir = path.join(dataDir, 'kills');
const reportsDir = path.join(dataDir, 'reports');
const publicPostsDir = path.join(dataDir, 'public-posts');
// Optional Trust & Safety authority pubkey: when set, the node honors that
// authority's signed DescriptorKill takedowns (durably, via FileKillStore).
const trustedKillAuthorityDeviceId = process.env.TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID || undefined;
const announceMs = Number(process.env.ANNOUNCE_MS ?? 15 * 60 * 1000);

// Optional notify backend: park ONE content-free ping per real change so polling
// subscribers wake. Only wired when NOTIFY_RELAY_URL is set. Each park is a fresh
// connect -> single env frame on the token -> close (store-and-forward mailbox);
// best-effort, so a notify failure never breaks a committed change.
const notifyRelayUrl = process.env.NOTIFY_RELAY_URL;
let notifyBackend = null;
let parkNotify;
if (notifyRelayUrl) {
  notifyBackend = new WebSocketRelayBackend();
  parkNotify = async (token, ping) => {
    const session = await notifyBackend.connect(notifyRelayUrl, token);
    try {
      await session.send(ping);
    } finally {
      await session.close();
    }
  };
  out({ event: 'notify_enabled', relay: notifyRelayUrl });
}

// Node RECEIPT keypair for countersigning accepted public posts (Plan 39 P6 /
// Plan 26 P3): from MEERKAT_POST_RECEIPT_SEED (64 hex chars) when set, else a
// generated seed PERSISTED in DATA_DIR (mode 0600) so the pinned key survives
// restarts. Owners pin the PUBLIC half in descriptor.postNodeKeyHex.
const receiptSeedFile = path.join(dataDir, 'post-receipt.seed');
async function loadOrCreateReceiptSeed() {
  const fromEnv = (process.env.MEERKAT_POST_RECEIPT_SEED ?? '').trim();
  if (fromEnv) return fromEnv;
  try {
    const stored = (await fsp.readFile(receiptSeedFile, 'utf8')).trim();
    if (/^[0-9a-f]{64}$/i.test(stored)) return stored;
  } catch {
    // fall through to create
  }
  const seed = randomBytes(32).toString('hex');
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.writeFile(receiptSeedFile, seed, { mode: 0o600 });
  return seed;
}
const postReceipt = publicPostNodeKeypairFromSeed(await loadOrCreateReceiptSeed());

// OPERATOR AUTHORITY keypair (Plan 39 P12): from MEERKAT_OPERATOR_AUTHORITY_SEED
// (64 hex chars). Its PUBLIC half is the Trust & Safety authority the node
// honors for descriptor kills, posting freezes, and operator post tombstones.
// When TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID is also set it MUST match (a
// mismatch would make every console action verify-fail at the core, so refuse
// to start instead of running a console whose actions can never take effect).
const operatorSeed = (process.env.MEERKAT_OPERATOR_AUTHORITY_SEED ?? '').trim();
let operatorKeypair = null;
if (operatorSeed) {
  operatorKeypair = publicPostNodeKeypairFromSeed(operatorSeed);
  if (trustedKillAuthorityDeviceId
    && trustedKillAuthorityDeviceId.toLowerCase() !== operatorKeypair.publicKeyHex.toLowerCase()) {
    out({
      event: 'fatal',
      reason: 'operator_authority_mismatch',
      detail: 'MEERKAT_OPERATOR_AUTHORITY_SEED derives a different public key than TRUST_AND_SAFETY_AUTHORITY_DEVICE_ID; console actions could never verify. Fix one of them (fail closed).',
    });
    process.exit(1);
  }
}
const effectiveKillAuthority = trustedKillAuthorityDeviceId
  ?? (operatorKeypair ? operatorKeypair.publicKeyHex : undefined);

// STATE AUTHORITY (Plan 44). Self-hosters keep the exact file-backed behavior below
// (MEERKAT_STORE_BACKEND unset/file => zero change). MEERKAT_STORE_BACKEND=shadow (WP-3B) is
// the migration-window comparator: the file stores are the PRIMARY authority (serve traffic)
// and the SAME two PostgreSQL contexts below become the SHADOW mirror (deep-compared, emitting
// 'shadow_divergence' NDJSON events, never affecting behavior). Shadow requires the file dirs
// AND both PostgreSQL URLs, and is forbidden in first-party mode. First-party nodes resolve TWO
// PostgreSQL contexts from TWO distinct connection URLs so the community role and the
// moderation role are separate least-privilege credentials:
//   - `community`  (MEERKAT_POSTGRES_URL)             -> meerkat_community grants
//   - `moderation` (MEERKAT_MODERATION_POSTGRES_URL)  -> meerkat_moderation grants
// Both share the TLS/profile/production semantics of resolveMeerkatStoreRuntimeConfig
// (first-party forces postgres; production forces verify-full + a CA). A failure to
// open EITHER pool is fatal and closes whichever already opened (fail closed).
const communityConfig = (() => {
  try {
    return resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      env: { ...process.env, DATA_DIR: dataDir },
    });
  } catch (error) {
    out({ event: 'fatal', reason: 'state_authority_unavailable', detail: errorDetail(error) });
    process.exit(1);
  }
})();
const storeBackend = communityConfig.backend;
// `postgres` opens both least-privilege pools as the sole authority. `shadow` (Plan 44
// WP-3B) opens the SAME two pools as the SHADOW half; the file stores remain the PRIMARY
// authority that serves traffic. Both modes therefore require MEERKAT_MODERATION_POSTGRES_URL
// and both close their pools on shutdown/fatal paths (fail closed, no leak).
if (storeBackend === 'postgres' || storeBackend === 'shadow') {
  // The moderation context reads its own URL from MEERKAT_MODERATION_POSTGRES_URL so
  // it can be a distinct database role; everything else (profile, TLS, CA) matches.
  const moderationUrl = (process.env.MEERKAT_MODERATION_POSTGRES_URL ?? '').trim();
  if (!moderationUrl) {
    await fatalExit({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'PostgreSQL community/shadow mode requires MEERKAT_MODERATION_POSTGRES_URL (the meerkat_moderation role) distinct from the community role',
    });
  }
  let moderationConfig;
  try {
    moderationConfig = resolveMeerkatStoreRuntimeConfig({
      service: 'moderation',
      env: { ...process.env, MEERKAT_POSTGRES_URL: moderationUrl, DATA_DIR: dataDir },
    });
  } catch (error) {
    await fatalExit({ event: 'fatal', reason: 'state_authority_unavailable', detail: errorDetail(error) });
  }
  try {
    communityRuntime = await createMeerkatStoreRuntime(communityConfig);
  } catch (error) {
    await fatalExit({ event: 'fatal', reason: 'state_authority_unavailable', detail: errorDetail(error) });
  }
  try {
    moderationRuntime = await createMeerkatStoreRuntime(moderationConfig);
  } catch (error) {
    await fatalExit({ event: 'fatal', reason: 'state_authority_unavailable', detail: errorDetail(error) });
  }
  if (storeBackend === 'postgres') {
    const archiveUrl = (process.env.MEERKAT_ARCHIVE_POSTGRES_URL ?? '').trim();
    if (!archiveUrl) {
      await fatalExit({
        event: 'fatal',
        reason: 'state_authority_unavailable',
        detail: 'PostgreSQL community mode requires MEERKAT_ARCHIVE_POSTGRES_URL for the meerkat_archive_intake role',
      });
    }
    try {
      archiveRuntimeConfig = resolveMeerkatStoreRuntimeConfig({
        service: 'archive-intake',
        env: { ...process.env, MEERKAT_POSTGRES_URL: archiveUrl, DATA_DIR: dataDir },
        requireObjectStore: true,
      });
    } catch (error) {
      await fatalExit({ event: 'fatal', reason: 'archive_intake_unavailable', detail: errorDetail(error) });
    }
    try {
      archiveRuntime = await createMeerkatStoreRuntime(archiveRuntimeConfig);
    } catch (error) {
      await fatalExit({ event: 'fatal', reason: 'archive_intake_unavailable', detail: errorDetail(error) });
    }
  }
}
// In shadow mode the postgres contexts are the SHADOW half, not the serving authority; the
// file stores below are still the primary. In postgres mode they ARE the authority.
const shadowMode = storeBackend === 'shadow';
const communityDb = communityRuntime?.database;
const moderationDb = moderationRuntime?.database;
const archiveDb = archiveRuntime?.database;
if ((storeBackend === 'postgres' || shadowMode) && (!communityDb || !moderationDb)) {
  await fatalExit({ event: 'fatal', reason: 'state_authority_unavailable', detail: 'PostgreSQL state backend did not initialize both contexts' });
}
if (storeBackend === 'postgres' && !archiveDb) {
  await fatalExit({ event: 'fatal', reason: 'archive_intake_unavailable', detail: 'PostgreSQL archive intake backend did not initialize' });
}

// The single place the file/postgres/shadow decision is applied to a store pair. In postgres
// mode it returns the postgres store; in file mode the file store; in shadow mode the file
// store PRIMARY wrapped over the postgres SHADOW, emitting 'shadow_divergence' NDJSON events.
// The shadow NEVER affects behavior (divergence/fault are logged, never thrown to a caller).
// Plan 44 WP-4A observability registry. The shadow-divergence counter is keyed by
// the static store name + event kind only (never an identity or the diverging value).
const metricsRegistry = createMetricsRegistry();
const shadowDivergence = metricsRegistry.counter(
  'meerkat_shadow_events_total',
  'Shadow comparator events by store and kind (shadow mode only).',
);
const shadowSink = (event) => {
  shadowDivergence.inc({ service: 'community', store: event.store, kind: event.kind });
  out({ event: 'shadow_divergence', ...event });
};
const selectStore = (name, buildFile, buildPostgres, classification) => {
  if (storeBackend === 'file') return buildFile();
  if (storeBackend === 'postgres') return buildPostgres();
  return shadowedStore(buildFile(), buildPostgres(), { store: name, classification, sink: shadowSink });
};

// Durable stores (shared with the operator console's read paths). File mode keeps the
// exact per-directory file stores; postgres mode binds the community-role context; shadow
// mode serves from the file primary while mirroring to the postgres community-role shadow.
const publicationStore = selectStore(
  'community.publications',
  () => new FilePublicationStore(publicationsDir),
  () => new PostgresPublicationStore(communityDb),
  publicationStoreClassification,
);
const reportStore = selectStore(
  'community.reports',
  () => new FileReportStore(reportsDir),
  () => new PostgresReportStore(communityDb),
  reportStoreClassification,
);
const publicPostStore = selectStore(
  'community.public-posts',
  () => new FilePublicPostStore(publicPostsDir),
  () => new PostgresPublicPostStore(communityDb),
  publicPostStoreClassification,
);

// LEGAL PIPELINES (Plan 39 P13). All code-side; the real vendor hash DB, NCMEC vendor onboarding,
// and DMCA agent registration are founder-ops (P15).
//
// CSAM / abuse hash-scan at the PUBLIC submit boundary. Options (fail-closed by default):
//   MEERKAT_ABUSE_HASH_FILE   path to a newline-separated known-bad hash list -> HashSetAbuseScanner
//   MEERKAT_ABUSE_SCANNER=unavailable   explicit placeholder: media submits refuse 503 (honest,
//                                       until the real hash DB lands) rather than silently accept
//   (unset)                   no scanner: a post WITH attachments is refused 503 (fail closed);
//                             text-only posts pass. The node reports its scanner state honestly.
const abuseHashFile = (process.env.MEERKAT_ABUSE_HASH_FILE ?? '').trim();
let abuseScanner;
if (abuseHashFile) {
  let hashes = [];
  try {
    hashes = (await fsp.readFile(abuseHashFile, 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (err) {
    await fatalExit({ event: 'fatal', reason: 'abuse_hash_file_unreadable', detail: `MEERKAT_ABUSE_HASH_FILE set but unreadable: ${err instanceof Error ? err.message : String(err)}` });
  }
  if (hashes.length === 0 || hashes.some((hash) => !/^[a-f0-9]{64}$/iu.test(hash))) {
    await fatalExit({
      event: 'fatal',
      reason: 'abuse_hash_file_invalid',
      detail: 'MEERKAT_ABUSE_HASH_FILE must contain at least one 64-character hexadecimal SHA-256 hash.',
    });
  }
  abuseScanner = new HashSetAbuseScanner(hashes);
  out({ event: 'abuse_scanner_enabled', source: 'hash_file', knownBad: abuseScanner.size });
} else if ((process.env.MEERKAT_ABUSE_SCANNER ?? '').trim().toLowerCase() === 'unavailable') {
  abuseScanner = new UnavailableAbuseScanner();
  out({ event: 'abuse_scanner_placeholder', detail: 'MEERKAT_ABUSE_SCANNER=unavailable: media submits fail closed (503) until a real hash DB is wired' });
}

// Durable NCMEC report queue: a CSAM signal (submit scan hit or operator csam action) files an
// evidence-reference record here. No real NCMEC API call (founder-ops); the founder exports for
// manual filing until the vendor lands. Postgres mode uses the MODERATION context (meerkat_moderation
// role), NOT the community role.
const ncmecQueue = new NcmecReportQueue(selectStore(
  'moderation.ncmec-reports',
  () => new FileNcmecReportQueueStore(path.join(dataDir, 'ncmec-queue')),
  () => new PostgresNcmecReportQueueStore(moderationDb),
  ncmecReportQueueStoreClassification,
));
const onAbuseHashMatch = async (match) => {
  await ncmecQueue.enqueueScanHit({
    publicationId: match.publicationId,
    channelId: match.channelId,
    postId: match.postId,
    personaPubkey: match.personaPubkey,
    matchedBlobHashes: match.matchedBlobHashes,
  });
};

// Durable DMCA intake: the public POST /public/dmca/notice route persists notices here; the
// operator console drives takedown/counter-notice. Registered agent details are founder-ops (P15).
// Postgres mode uses the MODERATION context (meerkat_moderation role).
const dmcaIntake = new DmcaIntakeService(selectStore(
  'moderation.dmca-claims',
  () => new FileDmcaIntakeStore(path.join(dataDir, 'dmca-intake')),
  () => new PostgresDmcaIntakeStore(moderationDb),
  dmcaIntakeStoreClassification,
));

// DMCA REGISTERED-AGENT CONFIG (Plan 43 WP-43C). Validated from the environment, replacing the
// hardcoded placeholder. First-party production (MEERKAT_DEPLOYMENT_PROFILE=first_party) REFUSES to
// launch while any required agent field is a placeholder or empty (NC-43.6); self-host may run
// without a registered agent but the served block says so honestly (never a fabricated identity).
let dmcaAgentConfig;
try {
  dmcaAgentConfig = resolveDmcaAgentConfigFromEnv(process.env);
} catch (error) {
  if (error instanceof DmcaAgentConfigError) {
    await fatalExit({
      event: 'fatal',
      reason: 'dmca_agent_not_configured',
      detail: error.message,
      missingFields: error.missingFields,
    });
  }
  await fatalExit({ event: 'fatal', reason: 'dmca_agent_invalid', detail: errorDetail(error) });
}
const dmcaAgentBlock = dmcaAgentPublicBlock(dmcaAgentConfig);

// Private feed authority (challenges, rate windows, publish stages, sealed tail,
// descriptor payloads). File mode uses the crash-safe file store; postgres mode the
// community-role context. NOTE: the file store was NOT wired before Plan 44 (the node
// ran the in-memory default), so file self-hosters now gain durable private state too.
// Pulled into a named const so the Plan 25 room-token membership verifier can read the
// SAME authoritative roster the feed-auth path uses (getState -> signed descriptor).
const privateStateStore = selectStore(
  'community.private-states',
  () => new FileCommunityPrivateStateStore(path.join(dataDir, 'private-state')),
  () => new PostgresCommunityPrivateStateStore(communityDb),
  communityPrivateStateStoreClassification,
);

const node = new CommunityNode({
  // Opaque snapshot/tail ciphertext pieces stay file/volume-backed in BOTH modes:
  // there is no Postgres piece-store contract, and the volume is the durability plane.
  pieceStore: new FileSeederPieceStore(piecesDir),
  descriptorStore: selectStore(
    'community.descriptor-revisions',
    () => new FileCommunityDescriptorStore(descriptorsDir),
    () => new PostgresCommunityDescriptorStore(communityDb),
    communityDescriptorStoreClassification,
  ),
  privateStateStore,
  // OPEN public serving registry (Plan 19 P3a): durable so an unpublish/kill cannot
  // be replay-resurrected after a restart and a takedown sticks across restarts.
  publicationStore,
  killStore: selectStore(
    'community.kills',
    () => new FileKillStore(killsDir),
    () => new PostgresKillStore(communityDb),
    killStoreClassification,
  ),
  // Durable host abuse-intake (Plan 19 P8a): unsealed public reports survive a restart
  // so a publication owner can fetch them; bounded per publication.
  reportStore,
  // Durable public posts + tombstones + freeze + flood windows (Plan 39 P6): a
  // restart never resurrects a tombstoned post or resets a flood window.
  publicPostStore,
  postReceipt,
  trustedKillAuthorityDeviceId: effectiveKillAuthority,
  parkNotify,
  // CSAM / abuse hash-scan seam at the submit boundary (Plan 39 P13). Undefined => media posts
  // are refused 503 (fail closed); a scan hit refuses 451 and files NCMEC evidence.
  ...(abuseScanner ? { abuseScanner } : {}),
  onAbuseHashMatch,
});
out({ event: 'post_receipt_key', publicKey: postReceipt.publicKeyHex });
out({ event: 'abuse_scanner_state', state: node.abuseScannerState() });

// Optional anti-bot HUMANITY gate on the public register route (Plan 24 P3). OFF by
// default so self-host community nodes stay open. When MEERKAT_HUMANITY_REQUIRED is
// set, a NEW public publication (first revision) must carry a valid humanity token; the
// node VERIFIES + SPENDS it by calling the SEPARATE verification service's
// /humanity/redeem (HUMANITY_VERIFY_URL). Fail-closed: if required but no verify URL is
// configured we refuse to start, and an unreachable verifier rejects the register.
// Set MEERKAT_HUMANITY_GATE_ALL=1 to gate every register (not just the first revision).
const humanityRequired = /^(1|true|yes)$/i.test(process.env.MEERKAT_HUMANITY_REQUIRED ?? '');
// The single-use redeem client is built from HUMANITY_VERIFY_URL whenever set,
// INDEPENDENTLY of the register gate flag: the submit route needs it even when
// public registration stays open (MEERKAT_HUMANITY_REQUIRED unset).
const humanityVerifyUrl = (process.env.HUMANITY_VERIFY_URL ?? '').trim();
// Verify + spend the token against the verification service (double-spend gate, AC-2).
let humanityRedeemClient;
try {
  humanityRedeemClient = humanityVerifyUrl
    ? createHumanityRedeemClient(humanityVerifyUrl, {
      allowInsecureHttp: /^(1|true|yes)$/iu.test(
        process.env.MEERKAT_HUMANITY_ALLOW_INSECURE_HTTP ?? '',
      ),
    })
    : undefined;
} catch (error) {
  await fatalExit({
    event: 'fatal',
    reason: 'humanity_verify_url_invalid',
    detail: error instanceof Error ? error.message : 'Humanity verifier configuration is invalid',
  });
}
let humanity;
if (humanityRequired) {
  if (!humanityRedeemClient) {
    await fatalExit({
      event: 'fatal',
      reason: 'humanity_verify_url_missing',
      detail: 'MEERKAT_HUMANITY_REQUIRED is set but HUMANITY_VERIFY_URL (the verification service base url) is not; refusing to start (fail closed).',
    });
  }
  humanity = {
    required: true,
    firstRevisionOnly: !/^(1|true|yes)$/i.test(process.env.MEERKAT_HUMANITY_GATE_ALL ?? ''),
    verifyToken: humanityRedeemClient,
  };
  out({ event: 'humanity_enabled', verifyUrl: humanityVerifyUrl, gateAll: !humanity.firstRevisionOnly });
}

// Gated public submit route (Plan 39 P6, NC-P3). The route is always mounted and
// ALWAYS fail-closed. Three env-wireable gates:
//  - SESSION_VERIFY_URL: the persona-session service BASE url (Plan 39 Track A);
//    this node POSTs { token } to `${SESSION_VERIFY_URL}/persona/session/verify`
//    -> { ok, personaPubkey }. Point it at the persona service base (e.g.
//    https://accounts.example). A trailing `/persona` is tolerated (some ops docs
//    wrote `<base>/persona`): it is normalized off before the route is appended so
//    both forms resolve to `<base>/persona/session/verify`, never a fail-closed
//    doubled `/persona/persona/...`. Unset => every submit is 500 session_not_configured.
//  - HUMANITY_VERIFY_URL (shared with the register gate): single-use redeem.
//  - MEERKAT_APP_UNLOCK_TOKEN_SECRET: shared with the hosted API's mint route.
// With anything missing, every submit is rejected with a machine-readable
// not-configured code -- reads stay open per the node's read policy.
const appUnlockTokenSecret = (process.env.MEERKAT_APP_UNLOCK_TOKEN_SECRET ?? '').trim() || undefined;
const hostedEntitlementRequired = /^(1|true|yes)$/iu.test(
  process.env.MEERKAT_HOSTED_ENTITLEMENT_REQUIRED ?? '',
);
const hostedEntitlementSecret = (process.env.ENTITLEMENT_SECRET ?? '').trim();
if (hostedEntitlementRequired && !hostedEntitlementSecret) {
  await fatalExit({ event: 'fatal', reason: 'entitlement_secret_missing' });
}
// Canonical base form + the tolerated `<base>/persona` legacy form both normalize to the same
// absolute verify endpoint (fail-closed helper in persona-service-http; never a doubled path).
const sessionVerifyEndpoint = personaSessionVerifyEndpoint(process.env.SESSION_VERIFY_URL);
let sessionVerifier;
if (sessionVerifyEndpoint) {
  sessionVerifier = async (token) => {
    try {
      const res = await fetch(sessionVerifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body && body.ok === true && typeof body.personaPubkey === 'string' && body.personaPubkey) {
        return { ok: true, personaPubkey: body.personaPubkey };
      }
      return { ok: false, reason: (body && body.reason) || `status_${res.status}` };
    } catch {
      return { ok: false, reason: 'unreachable' }; // fail closed: never admit on error
    }
  };
}
const publicSubmit = {
  ...(sessionVerifier ? { sessionVerifier } : {}),
  ...(appUnlockTokenSecret ? { appUnlockSecret: appUnlockTokenSecret } : {}),
  ...(humanityRedeemClient ? { humanityVerifyToken: humanityRedeemClient } : {}),
};

// The Commons (Plan 39 P8) + verify-to-view (P9). The FIRST-PARTY node BOOTS The Commons by
// loading a PERSISTED provisioning file (the operator provisions it once, offline, with the
// custodied descriptor key; see the runbook). Each Commons publication is registered here and
// flagged GATED so its reads require a verified session. Fail-closed: a tampered/invalid file
// is refused (parseCommonsProvisioning returns null) and The Commons stays OFF rather than
// serving a rogue feed; gating with no SESSION_VERIFY_URL wired makes gated reads 500.
let publicRead;
let commonsStatus = 'off';
const commonsFile = (process.env.COMMONS_PROVISION_FILE ?? '').trim();
const corsAllowedOrigins = parseCorsAllowedOrigins(process.env.MEERKAT_ALLOWED_ORIGINS);
if (process.env.NODE_ENV === 'production' && corsAllowedOrigins.length === 0) {
  await fatalExit({ event: 'fatal', reason: 'allowed_origins_missing', detail: 'Production community nodes require exact browser origins.' });
}
const storageOperatorKeyFile = (process.env.MEERKAT_STORAGE_OPERATOR_KEY_FILE ?? '').trim();
const storagePublicEndpoint = (process.env.MEERKAT_STORAGE_PUBLIC_ENDPOINT ?? '').trim();
let storageDescriptor;
if (Boolean(storageOperatorKeyFile) !== Boolean(storagePublicEndpoint)) {
  await fatalExit({
    event: 'fatal',
    reason: 'storage_descriptor_config_incomplete',
    detail: 'MEERKAT_STORAGE_OPERATOR_KEY_FILE and MEERKAT_STORAGE_PUBLIC_ENDPOINT must be configured together.',
  });
}
if (storageOperatorKeyFile && storagePublicEndpoint) {
  try {
    const operator = await loadStorageOperatorKeyFromFile(storageOperatorKeyFile);
    storageDescriptor = new StorageDescriptorService({
      endpoint: storagePublicEndpoint,
      operatorPrivateKeyHex: operator.operatorPrivateKeyHex,
      maximumObjectBytes: Number(process.env.MEERKAT_STORAGE_MAXIMUM_OBJECT_BYTES ?? 512 * 1024 * 1024),
      quotaBytes: process.env.MEERKAT_STORAGE_QUOTA_BYTES
        ? Number(process.env.MEERKAT_STORAGE_QUOTA_BYTES)
        : null,
      retention: (process.env.MEERKAT_STORAGE_RETENTION ?? '').trim() || 'operator-managed',
      allowInsecureLocalNetwork: process.env.MEERKAT_STORAGE_ALLOW_INSECURE_LOCAL_NETWORK === '1',
      ...(process.env.MEERKAT_STORAGE_DESCRIPTOR_TTL_MS
        ? { descriptorTtlMs: Number(process.env.MEERKAT_STORAGE_DESCRIPTOR_TTL_MS) }
        : {}),
      ...(process.env.MEERKAT_STORAGE_CHALLENGE_TTL_MS
        ? { challengeTtlMs: Number(process.env.MEERKAT_STORAGE_CHALLENGE_TTL_MS) }
        : {}),
    });
  } catch (error) {
    await fatalExit({ event: 'fatal', reason: 'storage_descriptor_unavailable', detail: errorDetail(error) });
  }
}
if (commonsFile) {
  if (corsAllowedOrigins.length === 0) {
    await fatalExit({ event: 'fatal', reason: 'allowed_origins_missing', detail: 'A Commons node needs MEERKAT_ALLOWED_ORIGINS for the browser client.' });
  }
  let loaded = null;
  let loadError = null;
  try {
    loaded = parseCommonsProvisioning(await fsp.readFile(commonsFile, 'utf8'));
  } catch (error) {
    loadError = String(error?.message ?? error);
  }
  if (!loaded) {
    // FATAL, fail-closed (Plan 39 P9): a Commons file that will not load must NOT let the node
    // boot open. If this node already registered Commons publications on a prior boot, starting
    // without the read gate would serve those durable, gated publications through the OPEN read
    // routes -- a provisioning error would silently bypass verify-to-view. Refuse to start.
    await fatalExit({ event: 'fatal', reason: 'commons_provision_unreadable', detail: loadError ?? 'invalid_or_tampered_provision_file' });
  } else {
    let registered = 0;
    for (const pub of loaded) {
      const verdict = await node.registerPublication({
        descriptor: pub.descriptor,
        snapshots: [{ channelId: pub.channelId, epoch: 0, manifest: pub.manifest, pieces: pub.piecesBase64.map((b) => new Uint8Array(Buffer.from(b, 'base64'))) }],
      });
      if (verdict.ok) registered += 1;
      else out({ event: 'commons_register_reject', publicationId: pub.publicationId, reason: verdict.reason });
    }
    const gatedIds = new Set(loaded.map((p) => p.publicationId));
    publicRead = { isGated: (id) => gatedIds.has(id), ...(sessionVerifier ? { sessionVerifier } : {}) };
    // Honest: if reads are gated but no session verifier is wired, gated reads fail 500. Say so.
    commonsStatus = sessionVerifier ? `gated (${registered}/${loaded.length} registered)` : `gated-but-no-verifier (${registered}/${loaded.length})`;
  }
}

// Plan 44 WP-4A: pool depths for each least-privilege context (postgres + shadow's
// shadow half) and the bounded known-bad abuse-hash count. Static labels only.
const registerPoolMetric = (label, runtime) => {
  if (!runtime?.pool) return;
  metricsRegistry.collect(`meerkat_postgres_pool_connections_${label}`, `PostgreSQL ${label} pool connection counts.`, () => [
    { labels: { service: 'community', context: label, state: 'total' }, value: runtime.pool.totalCount ?? 0 },
    { labels: { service: 'community', context: label, state: 'idle' }, value: runtime.pool.idleCount ?? 0 },
    { labels: { service: 'community', context: label, state: 'waiting' }, value: runtime.pool.waitingCount ?? 0 },
  ]);
};
registerPoolMetric('community', communityRuntime);
registerPoolMetric('moderation', moderationRuntime);
registerPoolMetric('archive_intake', archiveRuntime);
metricsRegistry.collect('meerkat_abuse_hashset_size', 'Known-bad abuse hash count (0 when the scanner is unavailable).', () => [
  { labels: { service: 'community' }, value: typeof abuseScanner?.size === 'number' ? abuseScanner.size : 0 },
]);

// Plan 43 WP-43C operator alerts. A pure evaluator turns the safety-queue counts into typed alerts
// (NCMEC escalations + filing backlog, DMCA items unresolved past deadline). Exported as an
// identity-free gauge per alert kind: a 1 means the alert is firing, with the severity as a label.
// No identities, no evidence -- counts and kinds only (NC-42.3 discipline). The community node has
// no scanner store, so scannerBacklog is 0 here (the scanner worker exposes its own backlog).
metricsRegistry.collect('meerkat_operator_alert_active', 'Active operator safety alerts by kind + severity (1 = firing).', async () => {
  const alerts = await currentOperatorAlerts();
  return alerts.map((alert) => ({
    labels: { service: 'community', kind: alert.kind, severity: alert.severity },
    value: 1,
  }));
});

// /readyz honestly probes the serving authority. Pure postgres requires BOTH the
// community and moderation pools alive. File and shadow modes serve from the file
// tree (shadow's primary is file), so the required probe is a writable data dir; the
// shadow postgres pools are deliberately NOT required (a dead shadow never affects
// behavior, so it must not fail readiness).
const communityChecks = storeBackend === 'postgres'
  ? [
      { name: 'postgres_community', required: true, probe: postgresReadyProbe(communityRuntime.pool) },
      { name: 'postgres_moderation', required: true, probe: postgresReadyProbe(moderationRuntime.pool) },
      { name: 'postgres_archive_intake', required: true, probe: postgresReadyProbe(archiveRuntime.pool) },
    ]
  : [{ name: 'data_dir', required: true, probe: dataDirWritableProbe(dataDir) }];
const healthEndpoints = createHealthEndpoints({ service: 'community', checks: communityChecks });

// Plan 25 WP-25I: optional managed community-room token mount. It activates ONLY when
// the LiveKit API key/secret and the room-name server secret are all set; otherwise the
// /api/rooms/* routes stay 404 and no token is ever minted (honest off). The membership
// verifier reads the SAME authoritative signed roster the feed-auth path trusts
// (privateStateStore.getState -> the owner-signed descriptor): a removed member is absent
// from the roster and rejected. The zero-knowledge node holds no group-keys epoch, so it
// gates on roster membership + descriptorRevision (both bump on any membership change);
// epoch: 0 accepts any client epoch >= 0 without ever falsely rejecting a current member.
const roomLivekitApiKey = (process.env.MEERKAT_ROOM_LIVEKIT_API_KEY ?? '').trim();
const roomLivekitApiSecret = (process.env.MEERKAT_ROOM_LIVEKIT_API_SECRET ?? '').trim();
const roomNameServerSecret = (process.env.MEERKAT_ROOM_NAME_SERVER_SECRET ?? '').trim();
const roomTokenConfigured = Boolean(roomLivekitApiKey && roomLivekitApiSecret && roomNameServerSecret);
let roomTokenOption;
if (roomTokenConfigured) {
  // Brand-new operational state with no legacy file data to shadow-compare, so it binds
  // the postgres store in postgres AND shadow modes, and the file store in self-host.
  const roomAdmissionStore = storeBackend === 'file'
    ? new FileAdmissionGenerationStore(path.join(dataDir, 'room-admissions'))
    : new PostgresAdmissionGenerationStore(communityDb);
  const roomMembershipVerifier = createCommunityRoomMembershipVerifier({
    privateStateStore,
    communityRole,
  });
  // The revoke route reuses the operator-console bearer secret (same admin authority the
  // moderation surface uses); absent it, revoke is 503, never open.
  const operatorSecret = (process.env.MEERKAT_OPERATOR_CONSOLE_SECRET ?? '').trim();
  roomTokenOption = {
    admissionStore: roomAdmissionStore,
    membershipVerifier: roomMembershipVerifier,
    livekit: {
      apiKey: roomLivekitApiKey,
      apiSecret: roomLivekitApiSecret,
      serverSecretHex: roomNameServerSecret,
    },
    ...(operatorSecret ? { operatorSecret } : {}),
    log: (event, detail) => out({ event, ...detail }),
  };
}

// Plan 43 WP-43E: compose the already-proven managed archive HTTP component into the real
// community service. First-party mode is always on and fails closed unless its isolated archive
// credential, S3 byte store, entitlement verifier, quota, and stable host id are complete.
// Self-host file mode remains opt-in because it has no managed billing entitlement by default.
const archiveIntakeEnabled = storeBackend === 'postgres'
  || /^(1|true|yes)$/iu.test(process.env.MEERKAT_ARCHIVE_INTAKE_ENABLED ?? '');
let archiveIntakeOption;
if (archiveIntakeEnabled) {
  const archiveHostId = (process.env.MEERKAT_ARCHIVE_HOST_ID ?? '').trim();
  const archiveCapBytes = Number(process.env.MEERKAT_ARCHIVE_TENANT_CAP_BYTES ?? '');
  if (!hostedEntitlementSecret || !archiveHostId
    || !Number.isSafeInteger(archiveCapBytes) || archiveCapBytes <= 0) {
    await fatalExit({
      event: 'fatal',
      reason: 'archive_intake_unavailable',
      detail: 'Archive intake requires ENTITLEMENT_SECRET, MEERKAT_ARCHIVE_HOST_ID, and a positive safe-integer MEERKAT_ARCHIVE_TENANT_CAP_BYTES',
    });
  }

  const archiveRoot = path.join(dataDir, 'archive');
  const archiveStore = storeBackend === 'postgres'
    ? new PostgresArchiveLifecycleStore(archiveDb)
    : new FileArchiveLifecycleStore(archiveRoot);
  const referenceLedger = storeBackend === 'postgres'
    ? new PostgresObjectReferenceLedger(archiveDb)
    : new FileObjectReferenceLedger(archiveRoot);
  const deletionJobs = storeBackend === 'postgres'
    ? new PostgresObjectDeletionJobStore(archiveDb)
    : new FileObjectDeletionJobStore(archiveRoot);
  let archiveObjectStore;
  if (storeBackend === 'postgres') {
    if (archiveRuntimeConfig?.objectStore?.backend !== 's3') {
      await fatalExit({ event: 'fatal', reason: 'archive_intake_unavailable', detail: 'First-party archive intake requires an S3 object store' });
    }
    try {
      archiveObjectStore = await createS3ObjectStoreFromRuntimeConfig(
        archiveRuntimeConfig.objectStore,
        { productionMode: archiveRuntimeConfig.productionMode },
      );
    } catch (error) {
      await fatalExit({ event: 'fatal', reason: 'archive_intake_unavailable', detail: errorDetail(error) });
    }
  } else {
    archiveObjectStore = new FileObjectStore(path.join(archiveRoot, 'objects'));
  }
  const byteService = new ArchiveObjectByteService(archiveObjectStore, archiveStore, referenceLedger);
  const archiveRequestLimiter = new HostedRequestLimiter({
    trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
  });
  const archiveNonceStore = new InMemoryArchiveRequestNonceStore();
  const servingIndex = {
    isServing: (publicationId) => archiveStore.isServeable(publicationId, archiveHostId),
    addServing: async () => undefined,
    removeServing: async () => undefined,
    listServing: async () => ({ publicationIds: [], nextCursor: null }),
  };
  archiveIntakeOption = {
    store: archiveStore,
    byteService,
    servingIndex,
    referenceLedger,
    deletionJobs,
    probeAbsence: async (durableKey) => (await archiveObjectStore.observe(durableKey)) === null,
    entitlementSecret: hostedEntitlementSecret,
    quota: { capBytes: () => archiveCapBytes },
    resolvePublication: async (publicationId) => {
      const publication = await publicationStore.get(publicationId);
      if (!publication) return null;
      const snapshot = publication.snapshots
        .map((candidate) => {
          try {
            return JSON.parse(candidate.manifestJson);
          } catch {
            return null;
          }
        })
        .find((manifest) => manifest?.infoHash === publication.signed.descriptor.contentId);
      if (!snapshot || !Array.isArray(snapshot.pieces)
        || !Number.isSafeInteger(snapshot.pieceLength) || snapshot.pieceLength <= 0
        || !Number.isSafeInteger(snapshot.totalSize) || snapshot.totalSize < 0
        || snapshot.pieces.some((hash) => typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash))) {
        return null;
      }
      const objects = snapshot.pieces.map((hash, index) => ({
        index,
        hash,
        size: Math.min(
          snapshot.pieceLength,
          Math.max(0, snapshot.totalSize - index * snapshot.pieceLength),
        ),
      }));
      return { signed: publication.signed, objects };
    },
    nonceStore: archiveNonceStore,
    requestLimiter: archiveRequestLimiter,
    hostId: archiveHostId,
    log: (event, detail) => out({ event, ...detail }),
  };
}

// One identity-free source for both private metrics and the authenticated console.
// First-party archive counts come from the isolated archive role. File/self-host mode
// has no managed worker topology, so its managed scanner/drift measurements are zero.
const currentOperatorAlerts = async () => {
  const [ncmecCounts, dmcaClaims] = await Promise.all([
    ncmecQueue.counts(),
    dmcaIntake.listClaims({ limit: 500 }),
  ]);
  let scannerBacklog = 0;
  let seederDrift = 0;
  if (archiveDb) {
    const [backlogResult, driftResult] = await Promise.all([
      archiveDb.query("SELECT count(*)::text AS count FROM archive.jobs WHERE status IN ('quarantined', 'scanning')"),
      archiveDb.query("SELECT count(*)::text AS count FROM ops.object_deletion_audit WHERE action IN ('reconcile_drift', 'reconcile_missing') AND recorded_at >= clock_timestamp() - interval '24 hours'"),
    ]);
    scannerBacklog = Number(backlogResult.rows[0]?.count ?? 0);
    seederDrift = Number(driftResult.rows[0]?.count ?? 0);
  }
  return evaluateOperatorAlerts({
    ncmec: ncmecCounts,
    scannerBacklog,
    seederDrift,
    dmca: evaluateDmcaDeadlines(dmcaClaims, dmcaAgentConfig.deadlines, Date.now()),
  });
};

let metricsListener = null;
let server;
try {
  server = await startCommunityNodeHttp({
    node,
    port,
    host,
    log: (event, detail) => out({ event, ...detail }),
    humanity,
    publicSubmit,
    dmcaIntake,
    dmcaAgent: dmcaAgentBlock,
    corsAllowedOrigins,
    ...(storageDescriptor ? { storageDescriptor } : {}),
    healthEndpoints,
    ...(hostedEntitlementRequired
      ? { hostedEntitlement: { required: true, secret: hostedEntitlementSecret } }
      : {}),
    ...(publicRead ? { publicRead } : {}),
    ...(roomTokenOption ? { roomToken: roomTokenOption } : {}),
    ...(archiveIntakeOption ? { archiveIntake: archiveIntakeOption } : {}),
    // Plan 57 W4: restart-safe join queue under the DATA_DIR volume; TTL is
    // env-tunable and clamped inside the queue (the clamp is the property).
    joinQueue: {
      store: new FileCommunityJoinStore(joinsDir),
      ttlMs: Number(process.env.MEERKAT_JOIN_QUEUE_TTL_MS ?? NaN) || undefined,
    },
    trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
  });
} catch (error) {
  // The HTTP listener failed after the pools opened (e.g. the port is taken). Close
  // both runtimes before exiting so a startup failure never leaks a connection.
  await fatalExit({ event: 'fatal', reason: 'startup_failed', detail: errorDetail(error) });
}

// Opt-in private metrics listener (127.0.0.1 by default; NEVER the public service
// port). Absent MEERKAT_METRICS_PORT => no listener, stated in the ready log.
try {
  const metricsConfig = resolveMetricsListenerConfig(process.env);
  if (metricsConfig) {
    metricsListener = await startMetricsListener({
      registry: metricsRegistry,
      config: metricsConfig,
      health: healthEndpoints,
      log: (event, detail) => out({ event, ...detail }),
    });
  }
} catch (error) {
  try {
    await server.close();
  } catch {
    // best-effort; the runtime close in fatalExit is the important cleanup
  }
  await fatalExit({ event: 'fatal', reason: 'startup_failed', detail: errorDetail(error) });
}

out({
  event: 'ready',
  url: server.url,
  stateBackend: storeBackend,
  // file AND shadow serve from the file dirs (shadow's file half is the primary authority);
  // pure postgres exposes only the piece volume path.
  ...(storeBackend !== 'postgres'
    ? { dataDir, piecesDir, descriptorsDir, publicationsDir, killsDir, reportsDir, publicPostsDir }
    : { dataDir, piecesDir }),
  humanity: humanityRequired ? 'required' : 'open',
  publicSubmit: {
    session: sessionVerifyEndpoint ? 'configured' : 'not_configured',
    humanity: humanityRedeemClient ? 'configured' : 'not_configured',
    appUnlock: appUnlockTokenSecret ? 'configured' : 'not_configured',
  },
  commons: commonsStatus, // 'off' | 'gated (n/m registered)' | 'gated-but-no-verifier (...)' (a bad file is fatal above)
  storageDescriptor: storageDescriptor ? 'storage:v1' : 'not_configured',
  // Honest DMCA agent posture. first-party is fatal above if incomplete; self-host says configured
  // or unconfigured plainly (never a fabricated agent identity).
  dmcaAgent: dmcaAgentConfig.configured
    ? `configured (${dmcaAgentConfig.deployment})`
    : 'unconfigured (self-host; notices retained, no registered agent published)',
  // Plan 25 WP-25I room-token mount. 'off' means the /api/rooms/* routes 404 until the
  // LiveKit + room-name-secret env is supplied (no token is ever minted while off).
  roomToken: roomTokenConfigured
    ? 'configured (managed room admission live)'
    : 'off (set MEERKAT_ROOM_LIVEKIT_API_KEY/_SECRET + MEERKAT_ROOM_NAME_SERVER_SECRET to enable)',
  archiveIntake: archiveIntakeOption
    ? 'configured (entitlement, owner quota, quarantine bytes, and takedown live)'
    : 'off (self-host only; set MEERKAT_ARCHIVE_INTAKE_ENABLED and archive config to enable)',
  metrics: metricsListener
    ? `listening on ${metricsListener.host}:${metricsListener.port}`
    : 'disabled',
});

// OPERATOR MODERATION CONSOLE (Plan 39 P12). Started ONLY when
// MEERKAT_OPERATOR_CONSOLE_SECRET is set: with no secret there is NO admin
// listener at all (nothing unauthenticated is ever exposed). With the secret
// but no MEERKAT_OPERATOR_AUTHORITY_SEED, the console serves its honest
// "not configured" state and refuses every action (fail closed). Env:
//   MEERKAT_OPERATOR_CONSOLE_SECRET   bearer secret the console UI/API requires
//   MEERKAT_OPERATOR_AUTHORITY_SEED   64-hex Ed25519 seed for the T&S authority key
//   ADMIN_PORT (default 8891) / ADMIN_HOST (default 127.0.0.1 -- loopback only;
//     expose beyond loopback ONLY behind your TLS edge/VPN)
//   PERSONA_ADMIN_URL + MEERKAT_PERSONA_ADMIN_SECRET   persona service operator
//     admin routes for suspend/unsuspend (absent => those actions honestly 503)
const consoleSecret = (process.env.MEERKAT_OPERATOR_CONSOLE_SECRET ?? '').trim();
let consoleServer = null;
if (consoleSecret) {
  const adminPort = Number(process.env.ADMIN_PORT ?? 8891);
  const adminHost = process.env.ADMIN_HOST ?? '127.0.0.1';
  const consoleDir = path.join(dataDir, 'operator-console');
  const personaAdminUrl = (process.env.PERSONA_ADMIN_URL ?? '').trim().replace(/\/+$/, '');
  const personaAdminSecret = (process.env.MEERKAT_PERSONA_ADMIN_SECRET ?? '').trim();
  const personaAdmin = personaAdminUrl && personaAdminSecret
    ? createPersonaAdminHttpClient({ baseUrl: personaAdminUrl, adminSecret: personaAdminSecret })
    : undefined;
  const consoleService = operatorKeypair
    ? new OperatorConsoleService({
      node,
      publications: publicationStore,
      reports: reportStore,
      posts: publicPostStore,
      // Operator console audit + triage state lives on the MODERATION context
      // (meerkat_moderation role), NOT the community role. File mode keeps the
      // per-node file store.
      store: selectStore(
        'moderation.operator-console',
        () => new FileOperatorConsoleStore(consoleDir),
        () => new PostgresOperatorConsoleStore(moderationDb),
        operatorConsoleStoreClassification,
      ),
      operator: operatorKeypair,
      ...(personaAdmin ? { personaAdmin } : {}),
      // CSAM lane -> real NCMEC queue; DMCA lane -> real intake (Plan 39 P13).
      ncmecQueue,
      dmcaIntake,
    })
    : null;
  try {
    consoleServer = await startOperatorConsoleHttp({
      console: consoleService,
      consoleSecret,
      port: adminPort,
      host: adminHost,
      alerts: currentOperatorAlerts,
      trustedProxyHops: Number(process.env.MEERKAT_TRUST_PROXY_HOPS ?? 0),
      log: (event, detail) => out({ event: `console_${event}`, ...detail }),
    });
  } catch (error) {
    // The admin listener failed after the community server + pools opened. Close the
    // community server AND both runtimes before exiting (fail closed, no leak).
    try {
      await server.close();
    } catch {
      // best-effort: the runtime close below is the important cleanup
    }
    await fatalExit({ event: 'fatal', reason: 'startup_failed', detail: errorDetail(error) });
  }
  out({
    event: 'operator_console_ready',
    url: consoleServer.url,
    configured: consoleService !== null,
    personaAdmin: personaAdmin ? 'configured' : 'not_configured',
    ...(operatorKeypair ? { authority: operatorKeypair.publicKeyHex } : {}),
  });
} else {
  out({ event: 'operator_console_disabled', reason: 'MEERKAT_OPERATOR_CONSOLE_SECRET unset (no admin listener)' });
}

// Optional announce loop. OFF unless a relay, a publicly reachable base url, AND
// the community ids to advertise are all set, so an unreachable node never
// announces a url nothing can fetch. The relay never learns the community id (the
// rid is HKDF-derived) and stores opaque bytes.
const announceRelayUrl = process.env.ANNOUNCE_RELAY_URL;
const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const announceIds = (process.env.ANNOUNCE_COMMUNITY_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
let announceTimer = null;
if (announceRelayUrl && publicBaseUrl && announceIds.length > 0) {
  const announce = async () => {
    let ok = 0;
    for (const communityId of announceIds) {
      try {
        await node.announce({ relayUrl: announceRelayUrl, communityId, publicBaseUrl });
        ok += 1;
      } catch (err) {
        out({ event: 'announce_error', communityId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    out({ event: 'announced', relay: announceRelayUrl, ok, total: announceIds.length });
  };
  void announce();
  announceTimer = setInterval(() => { void announce(); }, announceMs);
  announceTimer.unref?.();
  out({ event: 'announce_enabled', relay: announceRelayUrl, communities: announceIds.length, announceMs });
}

// Optional PRIVATE history-host announce loop (Plan 43 WP-43G). Reuses the same
// ANNOUNCE_RELAY_URL relay client and PUBLIC_BASE_URL as the public loop above,
// keyed instead by ANNOUNCE_COMMUNITY_IDS's private-secret-derived rid (never the
// community id). OFF unless a relay + base url are set AND at least one hosted
// community has a real communitySecret (this node's descriptor genesisNonce) --
// an unreachable or half-configured node never announces a url nothing can
// fetch. TTL/lead/interval mirror the public loop's env-tunable defaults, clamped
// to a safe range so a bad env value cannot produce a zero/negative interval or a
// runaway per-tick batch.
function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
const historyAnnounceTtlMs = clampInt(process.env.HISTORY_ANNOUNCE_TTL_MS, 24 * 60 * 60 * 1000, 60_000, 30 * 24 * 60 * 60 * 1000);
const historyAnnounceLeadMs = clampInt(process.env.HISTORY_ANNOUNCE_LEAD_MS, 60 * 60 * 1000, 0, historyAnnounceTtlMs);
const historyAnnounceMs = clampInt(process.env.HISTORY_ANNOUNCE_MS, announceMs, 30_000, 24 * 60 * 60 * 1000);
const historyAnnounceMaxPerTick = clampInt(process.env.HISTORY_ANNOUNCE_MAX_PER_TICK, 100, 1, 10_000);
const historyAnnounceJitterMs = clampInt(process.env.HISTORY_ANNOUNCE_JITTER_MS, 30_000, 0, historyAnnounceTtlMs);
// The node's per-piece byte cap it enforces on served history snapshot pieces
// (the reader's transfer expectation, HistoryHostRecord.maxObjectBytes).
const historyMaxObjectBytes = clampInt(process.env.HISTORY_ANNOUNCE_MAX_OBJECT_BYTES, 8 * 1024 * 1024, 1024, 512 * 1024 * 1024);

let historyAnnounceTimer = null;
// lastHistoryAnnouncedAt tracks per-community success so planHistoryAnnouncements
// can re-announce before TTL expiry; a failed announce leaves the entry
// unchanged (retried next tick, never marked announced -- honest logs).
const lastHistoryAnnouncedAt = new Map();
if (announceRelayUrl && publicBaseUrl && announceIds.length > 0) {
  const announceHistory = async () => {
    const now = Date.now();
    // Read each hosted community's CURRENT descriptor + snapshot serveability
    // straight from the node -- never fabricated, never cached stale.
    const candidates = [];
    for (const communityId of announceIds) {
      const state = await node.getPrivateCommunityState(communityId);
      const genesisNonce = state?.descriptor?.descriptor?.genesisNonce;
      candidates.push({
        communityId,
        communitySecret: genesisNonce ?? '',
        descriptorRevision: state?.descriptor?.descriptor?.revision ?? 0,
        descriptorCurrent: typeof genesisNonce === 'string' && genesisNonce.length > 0,
        snapshotServeable: Array.isArray(state?.snapshots) && state.snapshots.length > 0,
        lastAnnouncedAt: lastHistoryAnnouncedAt.get(communityId) ?? null,
      });
    }
    const plan = planHistoryAnnouncements({
      candidates,
      ttlMs: historyAnnounceTtlMs,
      refreshLeadMs: historyAnnounceLeadMs,
      maxPerTick: historyAnnounceMaxPerTick,
      jitterWindowMs: historyAnnounceJitterMs,
      jitterSeed: publicBaseUrl,
      nowMs: now,
    });
    let ok = 0;
    for (const action of plan.actions) {
      const candidate = candidates.find((c) => c.communityId === action.communityId);
      const sealed = candidate && buildSealedHistoryAnnouncement({
        communityId: candidate.communityId,
        communitySecret: candidate.communitySecret,
        descriptorCurrent: candidate.descriptorCurrent,
        descriptorRevision: candidate.descriptorRevision,
        snapshotServeable: candidate.snapshotServeable,
        publicBaseUrl,
        maxObjectBytes: historyMaxObjectBytes,
        ttlMs: historyAnnounceTtlMs,
        nowMs: now,
      });
      if (!sealed) {
        // Never marked announced: a missing descriptor/snapshot, or a non-https
        // base url, refuses honestly and retries next tick.
        out({ event: 'history_announce_refused', communityId: action.communityId });
        continue;
      }
      try {
        // The relay client receives ONLY the opaque rid + sealed ciphertext --
        // no community id, descriptor, or member identity crosses this call.
        await announceHost({ url: announceRelayUrl, rid: sealed.rid, record: sealed.sealedRecord, ttlMs: historyAnnounceTtlMs });
        lastHistoryAnnouncedAt.set(action.communityId, new Date(now).toISOString());
        ok += 1;
      } catch (err) {
        // Announce failure: retry next tick, never mark announced (honest log).
        out({ event: 'history_announce_error', communityId: action.communityId, error: err instanceof Error ? err.message : String(err) });
      }
    }
    out({ event: 'history_announced', relay: announceRelayUrl, ok, planned: plan.actions.length, deferred: plan.deferred, skipped: plan.skippedNotAnnounceable });
  };
  void announceHistory();
  historyAnnounceTimer = setInterval(() => { void announceHistory(); }, historyAnnounceMs);
  historyAnnounceTimer.unref?.();
  out({ event: 'history_announce_enabled', relay: announceRelayUrl, communities: announceIds.length, ttlMs: historyAnnounceTtlMs, leadMs: historyAnnounceLeadMs, intervalMs: historyAnnounceMs });
} else {
  out({ event: 'history_announce_disabled', reason: 'ANNOUNCE_RELAY_URL / PUBLIC_BASE_URL / ANNOUNCE_COMMUNITY_IDS not fully set' });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  out({ event: 'shutdown', signal });
  if (announceTimer) clearInterval(announceTimer);
  if (historyAnnounceTimer) clearInterval(historyAnnounceTimer);
  if (notifyBackend) notifyBackend.destroy();
  let failed = false;
  const closes = [server.close()];
  if (consoleServer) closes.push(consoleServer.close());
  if (metricsListener) closes.push(metricsListener.close());
  const results = await Promise.allSettled(closes);
  if (results.some((result) => result.status === 'rejected')) failed = true;
  // Close BOTH PostgreSQL pools (no-op in file mode) after the listeners drain.
  if (!await closeRuntimes()) failed = true;
  process.exit(failed ? 1 : 0);
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

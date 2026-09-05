/**
 * Multi-node QA harness (Task 5: physical multi-device exit demo, software twin).
 *
 * The physical 2/3-phone exit demo cannot run in CI, but every rung it exercises
 * is real code in @mylife/sync + @mylife/meerkat-relay. This harness boots a real
 * RelayServer and drives N FULLY INDEPENDENT node instances -- each with its own
 * identity, its own DatabaseAdapter, and its own NativeSyncEngine -- through the
 * EXACT shipping app session path: NativeSyncEngine.syncWithConnection /
 * handleIncomingConnection over connectRelayPeer, mirroring
 * apps/meerkat/app/(root)/providers/SyncProvider.tsx (runRelaySession ->
 * runSyncSessionJob -> connectRelayPeer -> engine.syncWithConnection).
 *
 * Honesty discipline (see CLAUDE.md "Transport honesty boundary"):
 *  - Imports ONLY symbols that also appear in packages/sync/src/index.native.ts
 *    (the RN surface the app ships). The relay package resolves @mylife/sync via
 *    "main" (./src/index.ts), so any symbol is *reachable*, but the harness
 *    restricts itself to the native barrel so it proves the app's REAL path.
 *  - Sessions run via the engine facade (syncWithConnection /
 *    handleIncomingConnection), NEVER raw runInitiatorSession (Node-only, absent
 *    from the native barrel).
 *  - Pairing uses real X25519 DH: each side derives the same shared secret from
 *    its own DH private key + the peer's DH public key (identical to
 *    engine-relay-e2e.test.ts), then insertPairedDevice on BOTH dbs.
 *
 * What this proves: PROTOCOL + RELAY correctness. It does NOT prove the physical
 * transport/OS rungs (LAN/mDNS, BLE, OS background limits, push) -- those stay
 * UNVERIFIED until a human runs apps/meerkat/Tickets/device-qa-exit-demo.md.
 */

import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { DatabaseAdapter } from '@mylife/db';
import {
  NativeSyncEngine,
  LwwDocumentManager,
  WebSocketRelayBackend,
  connectRelayPeer,
  createSyncTables,
  createWorkspace,
  addWorkspaceMember,
  upsertCommunity,
  derivePairingSharedSecret,
  extractDhPrivateKeyHex,
  generateDeviceIdentity,
  insertPairedDevice,
  type DeviceIdentity,
  type DocumentManager,
  type PairedDevice,
  type SignedCommunityDescriptor,
  type SyncSession,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '../../server';

// ---------------------------------------------------------------------------
// Meerkat module config -- redeclared from the app so the harness proves the
// SAME prefixes/policies the app ships. The drift guard in the test files
// deep-equals these against the documented source-of-truth literal values in
// apps/meerkat/app/(root)/data/sync-core.ts + community-core.ts.
//
// NOTE on the guard's shape: a LIVE import of sync-core.ts is intentionally NOT
// used here. The relay tsconfig pins rootDir to ./src, so importing a file under
// apps/meerkat breaks `tsc --noEmit` with TS6059 (verified). sync-core.ts itself
// is Node-safe (no expo/react-native imports), so the blocker is the rootDir
// boundary, not native modules. The guard therefore asserts deep-equality
// against the documented literal config; keep these in lockstep with the app.
// ---------------------------------------------------------------------------

/** Mirrors MEERKAT_SYNC_MODULE_ID in apps/meerkat/.../data/sync-core.ts. */
export const HARNESS_MEERKAT_SYNC_MODULE_ID = 'meerkatpad';
/** Mirrors COMMUNITY_MODULE_ID in apps/meerkat/.../data/community-core.ts. */
export const HARNESS_COMMUNITY_MODULE_ID = 'community';
/** Mirrors COMMUNITY_PREFIX in apps/meerkat/.../data/community-core.ts. */
export const HARNESS_COMMUNITY_PREFIX = 'cm_';
/** Mirrors MEERKAT_KEYS_MODULE_ID in apps/meerkat/.../data/sync-core.ts (community feed P0). */
export const HARNESS_MEERKAT_KEYS_MODULE_ID = 'communitykeys';

/** Mirrors MEERKAT_SYNC_PREFIXES (sync-core.ts). */
export const HARNESS_MEERKAT_SYNC_PREFIXES = new Map<string, string>([
  [HARNESS_MEERKAT_SYNC_MODULE_ID, 'mp_'],
  [HARNESS_COMMUNITY_MODULE_ID, HARNESS_COMMUNITY_PREFIX],
  [HARNESS_MEERKAT_KEYS_MODULE_ID, 'sync_workspace_keys'],
]);

/** Mirrors KEYS_SYNC_POLICY (sync-core.ts, community feed P0). */
export const HARNESS_KEYS_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  ],
};

/** Mirrors COMMUNITY_SYNC_POLICY in community-core.ts. */
export const HARNESS_COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'cm_messages', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_message_attachments', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_reactions', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_profiles', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_posts', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_post_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_post_lifecycle', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_read_state', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    // Plan 19 (Public Social Layer) P0: cm_publications is the ONLY community-family
    // entity that may reach published_blob (it keeps the cm_ prefix so the
    // ChangeTracker resolves it to the community module). cm_messages stays
    // shared_workspace.
    { tableName: 'cm_publications', defaultScope: 'shared_workspace', maxScope: 'published_blob', conflictStrategy: 'lww' },
    { tableName: 'cm_public_reports', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_public_directory_cache', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_public_feed_cursor', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
  ],
};

/** Mirrors MEERKAT_SYNC_POLICIES (sync-core.ts lines 39-51). */
export const HARNESS_MEERKAT_SYNC_POLICIES = new Map<string, ModuleSyncPolicy>([
  [
    HARNESS_MEERKAT_SYNC_MODULE_ID,
    {
      defaultScope: 'personal_replica',
      shareable: true,
      entityRules: [
        { tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      ],
    },
  ],
  [HARNESS_COMMUNITY_MODULE_ID, HARNESS_COMMUNITY_SYNC_POLICY],
  [HARNESS_MEERKAT_KEYS_MODULE_ID, HARNESS_KEYS_SYNC_POLICY],
]);

const HARNESS_ENABLED_MODULES = [
  HARNESS_MEERKAT_SYNC_MODULE_ID,
  HARNESS_COMMUNITY_MODULE_ID,
  HARNESS_MEERKAT_KEYS_MODULE_ID,
];

// ---------------------------------------------------------------------------
// Local schema (mirrors apps/meerkat/.../data/sync-core.ts + community-core.ts)
// ---------------------------------------------------------------------------

const CREATE_MP_PAD = `CREATE TABLE IF NOT EXISTS mp_pad (
  id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL)`;

const CREATE_CM_MESSAGES = `CREATE TABLE IF NOT EXISTS cm_messages (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  author_device_id TEXT NOT NULL, body TEXT NOT NULL,
  hlc_wall TEXT NOT NULL, hlc_counter INTEGER NOT NULL,
  supersedes_id TEXT, supersedes_deleted INTEGER,
  signature TEXT NOT NULL, updated_at TEXT NOT NULL)`;

const CREATE_CM_READ_STATE = `CREATE TABLE IF NOT EXISTS cm_read_state (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL,
  last_read_wall TEXT, last_read_counter INTEGER, updated_at TEXT NOT NULL)`;

export interface MeerkatNode {
  displayName: string;
  identity: DeviceIdentity;
  testDb: InMemoryTestDatabase;
  db: DatabaseAdapter;
  engine: NativeSyncEngine;
}

/**
 * Build ONE fully independent Meerkat node: its own identity, its own database
 * (sync_ tables + the synced mp_ / cm_ tables), and its own NativeSyncEngine
 * wired with the app's real prefixes + policies.
 */
export async function buildNode(displayName: string): Promise<MeerkatNode> {
  const identity = generateDeviceIdentity(displayName);
  const testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  createSyncTables(db);
  db.execute(CREATE_MP_PAD);
  db.execute(CREATE_CM_MESSAGES);
  db.execute(CREATE_CM_READ_STATE);
  const engine = new NativeSyncEngine({
    db,
    identity,
    modulePrefixes: HARNESS_MEERKAT_SYNC_PREFIXES,
    enabledModules: HARNESS_ENABLED_MODULES,
    modulePolicies: HARNESS_MEERKAT_SYNC_POLICIES,
    // Native profile: explicit LWW document manager (what Hermes runs).
    documentManager: new LwwDocumentManager() as unknown as DocumentManager,
  });
  await engine.initialize();
  return { displayName, identity, testDb, db, engine };
}

/**
 * Real X25519 pairing between two nodes: each side derives the SAME shared
 * secret from its own DH private key + the peer's DH public key, then records
 * the paired device on BOTH databases. Returns the shared secret hex (the same
 * value both sides hold) so SAS derivation can be checked.
 */
export function pairNodes(a: MeerkatNode, b: MeerkatNode): string {
  const secretFromA = derivePairingSharedSecret(extractDhPrivateKeyHex(a.identity.privateKeyRef)!, b.identity.dhPublicKey);
  const secretFromB = derivePairingSharedSecret(extractDhPrivateKeyHex(b.identity.privateKeyRef)!, a.identity.dhPublicKey);
  if (secretFromA !== secretFromB) {
    throw new Error('DH pairing mismatch: the two sides derived different secrets');
  }
  insertPairedDevice(a.db, pairedRow(b.identity, secretFromA));
  insertPairedDevice(b.db, pairedRow(a.identity, secretFromB));
  return secretFromA;
}

function pairedRow(remote: DeviceIdentity, sharedSecretHex: string): PairedDevice {
  const now = new Date().toISOString();
  return {
    deviceId: remote.publicKey,
    displayName: remote.displayName,
    dhPublicKey: remote.dhPublicKey,
    sharedSecretRef: `local:shared:${sharedSecretHex}`,
    lastSeenAt: now,
    lastSyncAt: null,
    lastSyncModule: null,
    bytesSent: 0,
    bytesReceived: 0,
    isActive: true,
    pairedAt: now,
  };
}

export interface RelayHarness {
  server: RelayServer;
  backend: WebSocketRelayBackend;
  url: string;
}

/** Boot one real loopback relay + a real WebSocket backend the nodes dial. */
export async function startRelayHarness(): Promise<RelayHarness> {
  const server = await startRelayServer({ port: 0, host: '127.0.0.1' });
  const backend = new WebSocketRelayBackend();
  return { server, backend, url: `ws://127.0.0.1:${server.port}` };
}

export async function stopRelayHarness(harness: RelayHarness | null): Promise<void> {
  if (!harness) return;
  harness.backend.destroy();
  await harness.server.close();
}

/**
 * Run ONE real manual relay session: both nodes dial the relay on the shared
 * token, the initiator runs syncWithConnection and the responder
 * handleIncomingConnection -- the exact app path. Returns the initiator's
 * recorded SyncSession. Both ends are always present, so the session never hits
 * the ~10s no-listener real timeout.
 */
export async function runRelaySession(
  harness: RelayHarness,
  initiator: MeerkatNode,
  responder: MeerkatNode,
  token: string,
): Promise<SyncSession> {
  const connInitiator = await connectRelayPeer({
    backend: harness.backend,
    url: harness.url,
    token,
    remoteDeviceId: responder.identity.publicKey,
  });
  const connResponder = await connectRelayPeer({
    backend: harness.backend,
    url: harness.url,
    token,
    remoteDeviceId: initiator.identity.publicKey,
  });
  try {
    const [session] = await Promise.all([
      initiator.engine.syncWithConnection(connInitiator),
      responder.engine.handleIncomingConnection(connResponder),
    ]);
    return session;
  } finally {
    await connInitiator.close();
    await connResponder.close();
  }
}

/** Tear down a node: destroy its engine and close its database. */
export async function destroyNode(node: MeerkatNode | null): Promise<void> {
  if (!node) return;
  await node.engine.destroy();
  node.testDb.close();
}

/**
 * Install a signed community descriptor + its workspace + members on a node's
 * database (the membership/roles the channel-post gate reads). Mirrors how the
 * app stores a community after createCommunity / joinCommunityFromLink.
 */
export function installCommunityOnNode(
  node: MeerkatNode,
  signed: SignedCommunityDescriptor,
): void {
  createWorkspace(node.db, {
    id: signed.descriptor.communityId,
    displayName: signed.descriptor.name,
    workspaceType: 'community',
    createdByDeviceId: signed.descriptor.ownerDeviceId,
    createdAt: signed.descriptor.createdAt,
    rotatedAt: null,
    currentKeyVersion: 1,
    archivedAt: null,
  });
  for (const member of signed.descriptor.members) {
    addWorkspaceMember(node.db, {
      workspaceId: signed.descriptor.communityId,
      deviceId: member.deviceId,
      role: member.role,
      invitedByDeviceId: signed.descriptor.ownerDeviceId,
      invitedAt: signed.descriptor.createdAt,
      removedAt: null,
    });
  }
  upsertCommunity(node.db, signed, node.identity.publicKey, signed.descriptor.createdAt);
}

/**
 * Record a signed channel message into a node's cm_messages table AND its engine
 * change log, exactly as ChatProvider.recordMessageEvent does (insertMessageRow
 * + recordLocalChange). Kept as a row-shaped insert so the synced columns match
 * the app's cm_messages schema.
 */
export function recordChannelMessageOnNode(
  node: MeerkatNode,
  event: {
    id: string;
    communityId: string;
    channelId: string;
    authorDeviceId: string;
    body: string;
    hlc: { wall: string; counter: number };
    supersedes?: { id: string; deleted: boolean };
    signature: string;
  },
): void {
  const row = {
    id: event.id,
    community_id: event.communityId,
    channel_id: event.channelId,
    author_device_id: event.authorDeviceId,
    body: event.body,
    hlc_wall: event.hlc.wall,
    hlc_counter: event.hlc.counter,
    supersedes_id: event.supersedes?.id ?? null,
    supersedes_deleted: event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
    signature: event.signature,
    updated_at: event.hlc.wall,
  };
  node.db.execute(
    `INSERT OR IGNORE INTO cm_messages (
      id, community_id, channel_id, author_device_id, body,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted, signature, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.community_id, row.channel_id, row.author_device_id, row.body,
      row.hlc_wall, row.hlc_counter, row.supersedes_id, row.supersedes_deleted,
      row.signature, row.updated_at,
    ],
  );
  node.engine.recordChange('cm_messages', 'INSERT', event.id, { ...row });
}

/** Read a node's OWN cm_messages bodies for a channel, ordered by HLC. */
export function readChannelBodies(node: MeerkatNode, communityId: string, channelId: string): string[] {
  return node.db
    .query<{ body: string }>(
      `SELECT body FROM cm_messages WHERE community_id = ? AND channel_id = ?
       ORDER BY hlc_wall, hlc_counter, author_device_id, id`,
      [communityId, channelId],
    )
    .map((r) => r.body);
}

/** Read a node's OWN cm_messages ids for a channel, ordered by HLC. */
export function readChannelIds(node: MeerkatNode, communityId: string, channelId: string): string[] {
  return node.db
    .query<{ id: string }>(
      `SELECT id FROM cm_messages WHERE community_id = ? AND channel_id = ?
       ORDER BY hlc_wall, hlc_counter, author_device_id, id`,
      [communityId, channelId],
    )
    .map((r) => r.id);
}

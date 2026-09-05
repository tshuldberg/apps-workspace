// Shared two-web-node test harness, extracted from web-node-relay-e2e.test.ts so
// every cross-device flow (channel delivery, edit/delete, read-state isolation,
// file request/grant, AND the always-on community feed: pull/push, snapshots,
// group keys, auto-update) is proven the SAME way: two independent WEB nodes,
// each on the REAL browser storage adapters (sql.js DatabaseAdapter +
// WebCrypto/IndexedDB SecretStore) + a real NativeSyncEngine, talking over a REAL
// @mylife/meerkat-relay server with Node `ws` injected. Status comes only from
// real SyncSessions and real DB rows; nothing is stubbed.
//
// SECRET-STORE ISOLATION (documented decision, matches the design): @mylife/sync
// configureSyncSecretStore is a process-global singleton (one store per origin,
// the real web behavior). Two nodes in one process SHARE one BrowserSecretStore,
// keyed by their distinct device refs, so keys never collide. The proof that
// "browser storage carries a real session" rests on the per-node, fully ISOLATED
// sql.js DatabaseAdapter (the synced-row store) + the engine + the relay.

import { expect } from 'vitest';
import WebSocket from 'ws';
import {
  LwwDocumentManager,
  NativeSyncEngine,
  WebSocketRelayBackend,
  configureSyncPrng,
  configureSyncSecretStore,
  connectRelayPeer,
  derivePairingSharedSecret,
  extractDhPrivateKeyHex,
  generateDeviceIdentity,
  getPairedDevices,
  getSharedSecretHex,
  hasConfiguredSyncPrng,
  hasConfiguredSyncSecretStore,
  insertPairedDevice,
  runMailboxDrainJob,
  type DeviceIdentity,
  type MailboxDrainJobResult,
  type MailboxDrainPeer,
  type MailboxEnvelopeHandlers,
  type PairedDevice,
  type SessionBlobProvider,
  type SyncSession,
} from '@mylife/sync';
import { startRelayServer, type RelayServer } from '@mylife/meerkat-relay';
import {
  createBrowserDatabaseAdapter,
  type BrowserDatabaseAdapter,
  type DbBytesStore,
} from '../../storage/browser-database-adapter';
import { createBrowserSecretStore, type BrowserSecretStore } from '../../storage/browser-secret-store';
import { ensureMeerkatTables, ensureSyncSchema } from '../../schema';
import {
  CM_MESSAGES_TABLE,
  COMMUNITY_MODULE_ID,
  MEERKAT_KEYS_MODULE_ID,
  MEERKAT_SYNC_MODULE_ID,
  MEERKAT_SYNC_POLICIES,
  MEERKAT_SYNC_PREFIXES,
  buildRendezvousToken,
  saveIdentityRow,
  type ChannelMessageRow,
} from '../../meerkat-data';
import { nodeLocateFile } from '../../storage/__tests__/helpers';

export { CM_MESSAGES_TABLE } from '../../meerkat-data';
export type { ChannelMessageRow } from '../../meerkat-data';

const locateFile = nodeLocateFile();

export interface WebNode {
  name: string;
  db: BrowserDatabaseAdapter;
  identity: DeviceIdentity;
  engine: NativeSyncEngine;
  blobProvider?: SessionBlobProvider;
}

export interface BuildWebNodeOptions {
  blobProvider?: SessionBlobProvider;
}

/** Per-node in-memory sql.js bytes store so two nodes never clobber each other. */
export function createInMemoryDbBytesStore(): DbBytesStore {
  let bytes: Uint8Array | null = null;
  return {
    async read(): Promise<Uint8Array | null> {
      return bytes;
    },
    async write(next: Uint8Array): Promise<void> {
      bytes = new Uint8Array(next);
    },
  };
}

/** A Map-backed SessionBlobProvider for blob-transfer tests (slice 4). */
export function createMapSessionBlobProvider(): SessionBlobProvider & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    get(hash: string): Uint8Array | null {
      return store.get(hash) ?? null;
    },
    put(hash: string, bytes: Uint8Array): void {
      store.set(hash, new Uint8Array(bytes));
    },
  };
}

// ONE shared browser secret store for the whole process (see header). Genuine
// WebCrypto+IndexedDB; both nodes' device keys live under it keyed by distinct refs.
let sharedSecrets: BrowserSecretStore | null = null;

/** Configure the process-global PRNG + secret store once. Idempotent. */
export async function ensureSyncGlobals(): Promise<BrowserSecretStore> {
  if (!hasConfiguredSyncPrng()) {
    configureSyncPrng((n) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  }
  if (!sharedSecrets) {
    sharedSecrets = await createBrowserSecretStore();
  }
  if (!hasConfiguredSyncSecretStore()) {
    configureSyncSecretStore(sharedSecrets);
  }
  return sharedSecrets;
}

/** Build an isolated web node (real browser adapters + real engine). */
export async function buildWebNode(name: string, opts: BuildWebNodeOptions = {}): Promise<WebNode> {
  await ensureSyncGlobals();
  const db = await createBrowserDatabaseAdapter({
    locateFile,
    bytesStore: createInMemoryDbBytesStore(),
  });
  db.execute('PRAGMA foreign_keys=ON;');
  ensureMeerkatTables(db);
  ensureSyncSchema(db);

  const identity = generateDeviceIdentity(name);
  saveIdentityRow(db, {
    public_key: identity.publicKey,
    dh_public_key: identity.dhPublicKey,
    private_key_ref: identity.privateKeyRef,
    display_name: identity.displayName,
    created_at: identity.createdAt,
  });
  await db.flush();

  const engine = new NativeSyncEngine({
    db,
    identity,
    modulePrefixes: MEERKAT_SYNC_PREFIXES,
    enabledModules: [MEERKAT_SYNC_MODULE_ID, COMMUNITY_MODULE_ID, MEERKAT_KEYS_MODULE_ID],
    modulePolicies: MEERKAT_SYNC_POLICIES,
    // The plain-JSON LWW document manager so web nodes speak the SAME CRDT wire
    // format as native nodes (document-manager.native.ts) and each other.
    documentManager: new LwwDocumentManager() as unknown as ConstructorParameters<
      typeof NativeSyncEngine
    >[0]['documentManager'],
    ...(opts.blobProvider ? { blobProvider: opts.blobProvider } : {}),
  });
  await engine.initialize();
  return { name, db, identity, engine, blobProvider: opts.blobProvider };
}

/** Real X25519 pairing on BOTH dbs (mirror of multi-node-harness pairNodes). */
export function pairNodes(a: WebNode, b: WebNode): string {
  const secretFromA = derivePairingSharedSecret(
    extractDhPrivateKeyHex(a.identity.privateKeyRef)!,
    b.identity.dhPublicKey,
  );
  const secretFromB = derivePairingSharedSecret(
    extractDhPrivateKeyHex(b.identity.privateKeyRef)!,
    a.identity.dhPublicKey,
  );
  expect(secretFromA).toBe(secretFromB);
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

/** Default rendezvous token for a phrase both nodes agree on. */
export function harnessToken(phrase: string): string {
  return buildRendezvousToken(phrase);
}

/**
 * One real manual relay session over the live relay with Node `ws` injected.
 * Both nodes dial the relay on the shared token; the initiator runs
 * syncWithConnection and the responder handleIncomingConnection (the exact app
 * path). Returns the initiator's recorded SyncSession.
 *
 * Two call shapes are supported so both test suites keep working:
 *   - runRelaySession(url, initiator, responder, phrase?)  -- phrase-derived token
 *   - runRelaySession(url, token, initiator, responder)    -- explicit token
 * The second arg disambiguates: a WebNode means the phrase form, a string means
 * the explicit-token form.
 */
export async function runRelaySession(
  url: string,
  initiator: WebNode,
  responder: WebNode,
  phrase?: string,
): Promise<SyncSession>;
export async function runRelaySession(
  url: string,
  token: string,
  initiator: WebNode,
  responder: WebNode,
): Promise<SyncSession>;
export async function runRelaySession(
  url: string,
  initiatorOrToken: WebNode | string,
  responderOrInitiator: WebNode,
  phraseOrResponder?: string | WebNode,
): Promise<SyncSession> {
  let token: string;
  let initiator: WebNode;
  let responder: WebNode;
  if (typeof initiatorOrToken === 'string') {
    token = initiatorOrToken;
    initiator = responderOrInitiator;
    responder = phraseOrResponder as WebNode;
  } else {
    initiator = initiatorOrToken;
    responder = responderOrInitiator;
    const phrase = (phraseOrResponder as string | undefined) ?? 'a-long-enough-shared-phrase-1234';
    token = buildRendezvousToken(phrase);
  }
  const backend = new WebSocketRelayBackend({
    webSocketImpl: WebSocket as unknown as new (u: string) => WebSocket,
  });
  const connInitiator = await connectRelayPeer({
    backend,
    url,
    token,
    remoteDeviceId: responder.identity.publicKey,
  });
  const connResponder = await connectRelayPeer({
    backend,
    url,
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
    backend.destroy();
  }
}

export function readChannelRows(
  node: WebNode,
  communityId: string,
  channelId: string,
): ChannelMessageRow[] {
  return node.db.query<ChannelMessageRow>(
    'SELECT * FROM cm_messages WHERE community_id = ? AND channel_id = ?',
    [communityId, channelId],
  );
}

/** Raw key-wrap rows held by a node for a workspace + epoch (proof, not status). */
export function readKeyWrapRows(
  node: WebNode,
  workspaceId: string,
  keyVersion: number,
): Array<{ wrapped_for_device_id: string }> {
  return node.db.query<{ wrapped_for_device_id: string }>(
    'SELECT wrapped_for_device_id FROM sync_workspace_keys WHERE workspace_id = ? AND key_version = ?',
    [workspaceId, keyVersion],
  );
}

/** Start a real relay on an ephemeral port, run fn(url), always close it. */
export async function withRelay<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const server: RelayServer = await startRelayServer({ port: 0, host: '127.0.0.1' });
  try {
    return await fn(`ws://127.0.0.1:${server.port}`);
  } finally {
    await server.close();
  }
}

export async function teardownNode(node: WebNode | null): Promise<void> {
  if (!node) return;
  await node.engine.destroy();
  node.db.close();
}

/** Alias of teardownNode kept for the community-feed test suite. */
export const destroyNode = teardownNode;

export const CM_MESSAGES = CM_MESSAGES_TABLE;

// ---------------------------------------------------------------------------
// Mailbox park / drain over the REAL relay (Node ws injected).
//
// The provider builds a bare `new WebSocketRelayBackend()` (browser global ws);
// in Node the tests must inject `ws`. These two helpers do exactly the provider
// wire ops -- park a sealed envelope on a token, and drain a peer's mailbox with
// app handlers -- with the ws impl injected, so the e2e drives the SAME app code
// path (sealFileRequestMailbox / buildFileGrant / buildFileMailboxHandlers /
// runMailboxDrainJob) over a live relay.
// ---------------------------------------------------------------------------

function nodeWsBackend(): WebSocketRelayBackend {
  return new WebSocketRelayBackend({
    webSocketImpl: WebSocket as unknown as new (u: string) => WebSocket,
  });
}

/**
 * Recover a peer's pair shared secret hex from its stored ref. pairNodes (above)
 * stores the secret INLINE in the ref (`local:shared:HEX`, the multi-node-harness
 * convention) rather than in the process secret store, so a real
 * getSharedSecretHex(ref) lookup returns null here. This resolver handles that
 * inline form first, then falls back to the real secret-store lookup so the same
 * helper works regardless of how a row was created.
 */
export function resolvePairSecretHex(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith('local:shared:')) return ref.slice('local:shared:'.length);
  return getSharedSecretHex(ref);
}

/** Park one sealed mailbox envelope on a token (a send by an absent sender). */
export async function parkEnvelope(
  url: string,
  token: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const backend = nodeWsBackend();
  try {
    const session = await backend.connect(url, token);
    try {
      await session.send(bytes);
      return true;
    } finally {
      await session.close();
    }
  } catch {
    return false;
  } finally {
    backend.destroy();
  }
}

/** Drain a node's mailboxes for the given peers with app handlers, ws injected. */
export async function drainMailboxes(
  url: string,
  node: WebNode,
  handlers: MailboxEnvelopeHandlers,
): Promise<MailboxDrainJobResult> {
  const peers: MailboxDrainPeer[] = getPairedDevices(node.db)
    .filter((peer) => peer.deviceId !== node.identity.publicKey)
    .map((peer) => ({
      deviceId: peer.deviceId,
      pairSharedSecretHex: resolvePairSecretHex(peer.sharedSecretRef),
      revoked: false,
      isActive: peer.isActive,
    }));
  const backend = nodeWsBackend();
  try {
    return await runMailboxDrainJob({
      identity: node.identity,
      backend,
      relayUrl: url,
      peers,
      handlers,
    });
  } finally {
    backend.destroy();
  }
}

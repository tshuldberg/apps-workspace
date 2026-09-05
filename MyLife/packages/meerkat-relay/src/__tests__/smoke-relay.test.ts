/**
 * Production smoke: boot the REAL slim entrypoint as a child process (the exact
 * compiled artifact + plain-node CMD the container image runs) and prove it is
 * genuinely ready, not just green:
 *
 *   - readiness: GET /healthz returns { ok: true, connections: 0 }
 *   - real transport: two NativeSyncEngines complete a full sync session over
 *     the booted relay and a note authored on A lands in B's database. A 200 on
 *     /healthz is necessary but NOT sufficient; readiness means the wire carries
 *     a real engine session (mirrors relay-selection-e2e's "the choice actually
 *     carries a session").
 *   - clean shutdown: SIGTERM yields a shutdown line and exit code 0.
 *
 * This wraps scripts/smoke-relay.mjs (buildProductionArtifact + bootRelay) so CI
 * exercises the identical boot path the standalone harness and ops use.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import {
  NativeSyncEngine,
  LwwDocumentManager,
  WebSocketRelayBackend,
  connectRelayPeer,
  createSyncTables,
  generateDeviceIdentity,
  extractDhPrivateKeyHex,
  derivePairingSharedSecret,
  insertPairedDevice,
  type DeviceIdentity,
  type PairedDevice,
  type DocumentManager,
} from '@mylife/sync';
// The harness is plain JS (it boots a child process); import its helpers.
// @ts-expect-error -- .mjs harness has no type declarations; runtime shape is stable.
import { buildProductionArtifact, bootRelay } from '../../scripts/smoke-relay.mjs';

const TOKEN = 'd'.repeat(64);

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
const POLICIES = new Map([['notes', NOTES_POLICY]]);
const PREFIXES = new Map([['notes', 'nt_']]);

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

interface BootedRelay {
  url: string;
  port: number;
  captured: { value: string };
  getExitCode: () => number | null;
  stop: () => Promise<void>;
}

let relay: BootedRelay | null = null;
let backend: WebSocketRelayBackend | null = null;
let dbA: InMemoryTestDatabase | null = null;
let dbB: InMemoryTestDatabase | null = null;

afterEach(async () => {
  backend?.destroy();
  backend = null;
  dbA?.close(); dbA = null;
  dbB?.close(); dbB = null;
  if (relay) {
    await relay.stop();
    relay = null;
  }
});

describe('production relay smoke (real child process)', () => {
  it('boots the compiled slim entrypoint, is ready, carries a full engine session, and shuts down clean', async () => {
    const work = buildProductionArtifact();
    relay = (await bootRelay(work)) as BootedRelay;

    // Readiness: the production entrypoint answers /healthz with only { ok, connections }.
    const health = await (await fetch(`http://127.0.0.1:${relay.port}/healthz`)).json();
    expect(health).toEqual({ ok: true, connections: 0 });

    // Real transport over the booted relay: paired native engines sync a note.
    const idA = generateDeviceIdentity('Phone A');
    const idB = generateDeviceIdentity('Phone B');
    const secretFromA = derivePairingSharedSecret(extractDhPrivateKeyHex(idA.privateKeyRef)!, idB.dhPublicKey);
    const secretFromB = derivePairingSharedSecret(extractDhPrivateKeyHex(idB.privateKeyRef)!, idA.dhPublicKey);
    expect(secretFromA).toBe(secretFromB);

    dbA = createInMemoryTestDatabase();
    dbB = createInMemoryTestDatabase();
    for (const db of [dbA, dbB]) {
      createSyncTables(db.adapter);
      db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
    }
    insertPairedDevice(dbA.adapter, pairedRow(idB, secretFromA));
    insertPairedDevice(dbB.adapter, pairedRow(idA, secretFromB));

    const engineA = new NativeSyncEngine({
      db: dbA.adapter, identity: idA, modulePrefixes: PREFIXES,
      enabledModules: ['notes'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    const engineB = new NativeSyncEngine({
      db: dbB.adapter, identity: idB, modulePrefixes: PREFIXES,
      enabledModules: ['notes'], modulePolicies: POLICIES,
      documentManager: new LwwDocumentManager() as unknown as DocumentManager,
    });
    await engineA.initialize();
    await engineB.initialize();

    engineA.recordChange('nt_notes', 'INSERT', 'n1', {
      id: 'n1', title: 'note from phone A', updated_at: '2026-06-14T00:00:00.000Z',
    });

    backend = new WebSocketRelayBackend();
    const connA = await connectRelayPeer({ backend, url: relay.url, token: TOKEN, remoteDeviceId: idB.publicKey });
    const connB = await connectRelayPeer({ backend, url: relay.url, token: TOKEN, remoteDeviceId: idA.publicKey });

    const [session] = await Promise.all([
      engineA.syncWithConnection(connA),
      engineB.handleIncomingConnection(connB),
    ]);
    expect(session.status).toBe('completed');

    const rows = dbB.adapter.query<{ id: string; title: string }>('SELECT * FROM nt_notes WHERE id = ?', ['n1']);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('note from phone A');
    expect(dbB.adapter.query('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected'])).toHaveLength(0);

    await connA.close();
    await connB.close();
    await engineA.destroy();
    await engineB.destroy();

    // Clean shutdown of the production process.
    await relay.stop();
    expect(relay.captured.value).toContain('"event":"shutdown"');
    expect(relay.getExitCode()).toBe(0);
    relay = null;
  }, 30_000);
});

/**
 * Adopt-and-sync e2e (Plan 20, Phase 6.3 -- Tier-C real bytes). AC-8 protocol half.
 *
 * The desktop host companion turns a user's own computer into their relay. A
 * member "adopts" that host by scanning/pasting the MKSERVER1 connection card the
 * panel surfaces, then syncs through it. This proves that whole path with REAL
 * bytes, minus the phones:
 *
 *   1. Start a REAL RelayServer via the multi-node harness (a live loopback relay,
 *      exactly what `bin/meerkat-relay-server.mjs` runs -- never an in-memory stub).
 *   2. Build the copyable card the host panel would surface with the real
 *      `buildHostConnectionCard` (host/host-config.ts -> @mylife/sync codec).
 *   3. Parse it CLIENT-side with `parseConnectionCard` (the adopt UI's real path),
 *      and dial the session over the URL that came OUT of the parsed card -- so the
 *      adopted address is what actually carries the traffic.
 *   4. Run a REAL NativeSyncEngine session (Ed25519 handshake, encrypted payload,
 *      MK-002 inbound enforcement) between two fully independent nodes over the
 *      adopted relay; a row authored on A lands in B's SQLite and BOTH ends record
 *      a real `sync_sessions` row.
 *
 * Honesty (CLAUDE.md "Transport honesty boundary" + Plan 20 host rules):
 *   - Reachability is proven by a REAL round-trip, never a printed URL. The
 *     completed session (real ciphertext across the live relay) IS that proof for
 *     the up-relay case; the down-relay case runs the SAME `gateReachability` gate
 *     the host panel uses, fed by a REAL failed connection attempt, and asserts it
 *     returns 'unverified' (the card would be WITHHELD).
 *   - A closed/down relay NEVER yields a fabricated session: `connectRelayPeer`
 *     rejects before any protocol runs, so `insertSyncSession` is never reached and
 *     `getRecentSyncSessions` stays empty on both nodes. No fake peer, no fake
 *     transfer, no fabricated session row.
 *   - This is the software twin of the physical adopt demo; the off-host public-URL
 *     verification against a real internet vantage is covered by
 *     host/__tests__/off-host-probe.test.ts + server.test.ts. This file proves the
 *     PROTOCOL half over the adopted card.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  WebSocketRelayBackend,
  connectRelayPeer,
  getRecentSyncSessions,
  parseConnectionCard,
  type SyncSession,
} from '@mylife/sync';
import { buildHostConnectionCard } from '../../host/host-config';
import { gateReachability } from '../../host/reachability';
import {
  buildNode,
  destroyNode,
  pairNodes,
  startRelayHarness,
  stopRelayHarness,
  type MeerkatNode,
  type RelayHarness,
} from './support/multi-node-harness';

// A real >= 16-char ephemeral rendezvous token (what the relay enforces).
const TOKEN = 'adopt-and-sync-token-'.padEnd(64, 'f');

let harness: RelayHarness | null = null;
let nodeA: MeerkatNode | null = null;
let nodeB: MeerkatNode | null = null;

afterEach(async () => {
  await destroyNode(nodeA); nodeA = null;
  await destroyNode(nodeB); nodeB = null;
  await stopRelayHarness(harness); harness = null;
});

/**
 * Run ONE real manual session over an EXPLICIT relay URL (the address parsed out
 * of the adopted connection card), mirroring the harness's runRelaySession but
 * dialing the adopted URL rather than harness.url -- so the parsed card is what
 * carries the bytes. Returns the initiator's recorded SyncSession.
 */
async function runSessionOverUrl(
  backend: WebSocketRelayBackend,
  initiator: MeerkatNode,
  responder: MeerkatNode,
  url: string,
  token: string,
): Promise<SyncSession> {
  const connInitiator = await connectRelayPeer({
    backend, url, token, remoteDeviceId: responder.identity.publicKey,
  });
  const connResponder = await connectRelayPeer({
    backend, url, token, remoteDeviceId: initiator.identity.publicKey,
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

/**
 * A REAL reachability round-trip: open a throwaway relay connection to the
 * candidate URL and report whether it actually opened. Fail-closed on any error.
 * This is a genuine socket round-trip through the OS network stack, NOT a stub --
 * the honesty gate exists precisely because a printed URL is never proof.
 */
async function probeRelayReachable(url: string, token: string): Promise<boolean> {
  const backend = new WebSocketRelayBackend();
  try {
    const session = await backend.connect(url, token, {});
    session.close();
    return true;
  } catch {
    return false;
  } finally {
    backend.destroy();
  }
}

describe('adopt-and-sync over a real desktop-hosted relay (Plan 20 P6.3, AC-8)', () => {
  it('a member adopts the host card and completes a REAL sync through the adopted relay', async () => {
    harness = await startRelayHarness();
    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    pairNodes(nodeA, nodeB);

    // The host panel builds the copyable/QR card from its live relay URL.
    const card = buildHostConnectionCard({ relayUrl: harness.url, name: 'My Laptop' });
    expect(card.startsWith('MKSERVER1:')).toBe(true);

    // The member's adopt UI parses the pasted/scanned card client-side.
    const parsed = parseConnectionCard(card);
    expect(parsed).not.toBeNull();
    expect(parsed!.v).toBe(1);
    expect(parsed!.name).toBe('My Laptop');
    // The address that carries the traffic is the one that came OUT of the card.
    expect(parsed!.relay).toBe(harness.url);

    // A real round-trip proves the adopted relay is actually reachable (not a
    // printed URL): the completed session below is the load-bearing proof.
    expect(await probeRelayReachable(parsed!.relay, TOKEN)).toBe(true);

    // Author the bellwether pad row on A, exactly as SyncProvider.savePad does:
    // write the row, then record the change into the engine's log + document.
    const padRow = { id: 'pad1', body: 'hello from the adopted host', updated_at: '2026-07-01T00:00:00.000Z' };
    nodeA.db.execute('INSERT OR REPLACE INTO mp_pad (id, body, updated_at) VALUES (?, ?, ?)', [
      padRow.id, padRow.body, padRow.updated_at,
    ]);
    nodeA.engine.recordChange('mp_pad', 'INSERT', 'pad1', { ...padRow });

    // Real engine session over the ADOPTED card's relay URL.
    const session = await runSessionOverUrl(harness.backend, nodeA, nodeB, parsed!.relay, TOKEN);
    expect(session.status).toBe('completed');

    // The row crossed the live relay and was applied through MK-002 on B.
    const rows = nodeB.db.query<{ id: string; body: string }>(
      'SELECT id, body FROM mp_pad WHERE id = ?',
      ['pad1'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('hello from the adopted host');

    // No inbound rejection: the paired, authorized write was clean.
    expect(
      nodeB.db.query('SELECT * FROM sync_inbound_audit WHERE outcome = ?', ['rejected']),
    ).toHaveLength(0);

    // A REAL session was recorded on BOTH ends -- the honest evidence a sync ran.
    expect(getRecentSyncSessions(nodeA.db).length).toBeGreaterThanOrEqual(1);
    expect(getRecentSyncSessions(nodeB.db).length).toBeGreaterThanOrEqual(1);
    expect(nodeA.engine.getStatus().lastSyncAt).not.toBeNull();
    expect(nodeB.engine.getStatus().lastSyncAt).not.toBeNull();
  });

  it('a closed/down host relay yields NO fabricated session (unreachable + no session row)', async () => {
    // Start a real relay to claim a valid loopback address, then CLOSE it -- the
    // honest "the host closed their laptop / the server is down" scenario.
    const down = await startRelayHarness();
    const deadUrl = down.url;
    await stopRelayHarness(down);

    nodeA = await buildNode('Phone A');
    nodeB = await buildNode('Phone B');
    pairNodes(nodeA, nodeB);

    // The card still encodes/parses fine (it is only a transport address) ...
    const card = buildHostConnectionCard({ relayUrl: deadUrl, name: 'Sleeping Laptop' });
    const parsed = parseConnectionCard(card);
    expect(parsed!.relay).toBe(deadUrl);

    // ... but a REAL off-host-style round-trip fails, so the SAME gate the host
    // panel uses returns 'unverified' -- the card would be WITHHELD, not surfaced.
    const reachable = await probeRelayReachable(deadUrl, TOKEN);
    expect(reachable).toBe(false);
    const gate = await gateReachability({
      publicUrl: deadUrl,
      offHostProbe: async () => ({ reachedFromOutside: reachable, vantage: 'off-host' }),
    });
    expect(gate.state).toBe('unverified');

    // Author a row on A, then attempt the session over the dead relay.
    nodeA.engine.recordChange('mp_pad', 'INSERT', 'pad1', {
      id: 'pad1',
      body: 'should never be delivered',
      updated_at: '2026-07-01T00:00:00.000Z',
    });

    const backend = new WebSocketRelayBackend();
    try {
      await expect(
        runSessionOverUrl(backend, nodeA, nodeB, deadUrl, TOKEN),
      ).rejects.toThrow();
    } finally {
      backend.destroy();
    }

    // The dial failed before any protocol ran, so insertSyncSession was NEVER
    // reached: no fabricated session on either node, and nothing landed on B.
    expect(getRecentSyncSessions(nodeA.db)).toHaveLength(0);
    expect(getRecentSyncSessions(nodeB.db)).toHaveLength(0);
    expect(nodeB.db.query('SELECT * FROM mp_pad WHERE id = ?', ['pad1'])).toHaveLength(0);
    expect(nodeA.engine.getStatus().lastSyncAt).toBeNull();
  });
});

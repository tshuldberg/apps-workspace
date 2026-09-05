/**
 * Plan 19 P7a acceptance: the APP publish orchestrator drives a REAL publish over
 * live services, with REAL bytes over real sockets (plan §12 / TC-8). Unlike the
 * P4 e2e (which hand-built the publish fixture inline), this test imports the
 * SHIPPING app function `publishChannelPublicly` and runs it end-to-end:
 *
 *   - a LIVE relay        (startRelayServer)         -- the zero-knowledge mailbox.
 *   - a LIVE directory    (startPublicDirectoryNode)  -- ws ann/lk discovery verbs.
 *   - a LIVE community     (startCommunityNodeHttp)    -- OPEN public serving routes.
 *
 * Device A seeds real signed channel events into an in-memory db, then calls the
 * app orchestrator with the LIVE host + directory URLs, a real node fetch, the ws
 * WebSocket, and a real secure-random source injected. The orchestrator does the
 * REAL P0-P4 path: build a public snapshot, sign the owner descriptor, POST it +
 * the snapshot pieces to the community node's register route, announce it + the
 * serving host to the directory, and persist the signed descriptor locally. Device
 * B (a second, independent identity) then BROWSES the directory and PULLS + VERIFIES
 * the snapshot from the REAL serving host through the shipping client helper
 * (fetchPublicSnapshot), proving the published bytes round-trip across the network.
 *
 * The app orchestrator + community-core helpers are imported at RUNTIME (string
 * specifiers) rather than statically: a static cross-package import would pull the
 * app source under the relay's tsconfig rootDir and break `tsc` (TS6059, the same
 * boundary the multi-node guard works around). The runtime import drives the REAL
 * app function; its signature is pinned to a local structural type so the call site
 * stays type-checked.
 *
 * Acceptance proven here:
 *  - AC-3/AC-4: the app publishes a channel publicly; a SECOND device discovers it
 *    in the directory and pulls + verifies it from a REAL serving host.
 *  - Empty guard (plan §7.3): publishing a channel with no events returns the Empty
 *    state and POSTs nothing.
 *  - Error guard (plan §7.3): an unreachable host returns the honest Error state.
 *  - TC-8: every published byte crosses a live socket.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  browsePublications,
  createChannelMessage,
  fetchPublicSnapshot,
  generateDeviceIdentity,
  publicSnapshotKeyFromHex,
  type ChannelMessageEvent,
  type DeviceIdentity,
} from '@mylife/sync';
import { createInMemoryTestDatabase, type DatabaseAdapter } from '@mylife/db';
import { startRelayServer, type RelayServer } from '../server';
import {
  CommunityNode,
  PublicDirectoryNode,
  startCommunityNodeHttp,
  startPublicDirectoryNode,
  type PublicDirectoryNodeServer,
} from '../index';
import type { SeederHttpServer } from '../seeder-http';

// The sync directory/registry client uses the platform global WebSocket; inject ws.
const WS = WebSocket as unknown as new (url: string) => unknown;
const CHANNEL = 'general';
const COMMUNITY = 'cm_public_social_app';
const CATEGORY = 'technology';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = '2026-06-28T00:00:00.000Z';

const nodeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

// ---------------------------------------------------------------------------
// Runtime import of the SHIPPING app orchestrator + community-core helpers.
// `: string` annotations keep tsc from resolving the cross-rootDir app source.
// ---------------------------------------------------------------------------

interface PublishHostResult {
  url: string;
  accepted: boolean;
  status: number;
  reason?: string;
}
interface PublishResult {
  state: 'success' | 'partial' | 'error' | 'empty';
  message: string;
  detail?: string;
  publicationId: string | null;
  link: string | null;
  hosts: PublishHostResult[];
  announced: boolean;
}
interface PublishInput {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  channelId: string;
  title: string;
  description: string;
  category: string;
  hostUrls: string[];
  directoryUrl: string;
  joinPolicy?: string;
  kind?: string;
}
interface PublishOverrides {
  fetchFn?: typeof fetch;
  webSocketImpl?: unknown;
  randomBytes?: (byteCount: number) => Uint8Array;
  now?: () => string;
}
type PublishFn = (deps: PublishOverrides, input: PublishInput) => Promise<PublishResult>;

interface AppApi {
  publishChannelPublicly: PublishFn;
  ensureCommunityTables: (db: DatabaseAdapter) => void;
  insertMessageRow: (db: DatabaseAdapter, event: ChannelMessageEvent) => unknown;
}

const PUBLISH_MODULE: string = '../../../../apps/meerkat/app/(root)/data/public-publish';
const COMMUNITY_MODULE: string = '../../../../apps/meerkat/app/(root)/data/community-core';

let cachedApi: AppApi | null = null;
async function loadApp(): Promise<AppApi> {
  if (cachedApi) return cachedApi;
  const publishMod = (await import(PUBLISH_MODULE)) as { publishChannelPublicly: PublishFn };
  const communityMod = (await import(COMMUNITY_MODULE)) as {
    ensureCommunityTables: (db: DatabaseAdapter) => void;
    insertMessageRow: (db: DatabaseAdapter, event: ChannelMessageEvent) => unknown;
  };
  cachedApi = {
    publishChannelPublicly: publishMod.publishChannelPublicly,
    ensureCommunityTables: communityMod.ensureCommunityTables,
    insertMessageRow: communityMod.insertMessageRow,
  };
  return cachedApi;
}

function publishDeps(): PublishOverrides {
  return {
    fetchFn: nodeFetch,
    webSocketImpl: WS,
    randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
    now: () => NOW,
  };
}

function authorEvent(owner: DeviceIdentity, body: string, wall: string): ChannelMessageEvent {
  return createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body, hlc: { wall, counter: 0 } });
}

function seedChannel(api: AppApi, db: DatabaseAdapter, owner: DeviceIdentity): string[] {
  api.ensureCommunityTables(db);
  const events = [
    authorEvent(owner, 'welcome to the public channel', '2026-06-28T00:00:10.000Z'),
    authorEvent(owner, 'second public post', '2026-06-28T00:00:11.000Z'),
    authorEvent(owner, 'third public post', '2026-06-28T00:00:12.000Z'),
  ];
  for (const event of events) api.insertMessageRow(db, event);
  return events.map((e) => e.body);
}

// ---------------------------------------------------------------------------
// Live-service teardown
// ---------------------------------------------------------------------------

let relay: RelayServer | null = null;
let directory: PublicDirectoryNodeServer | null = null;
let community: SeederHttpServer | null = null;

afterEach(async () => {
  if (community) { await community.close(); community = null; }
  if (directory) { await directory.close(); directory = null; }
  if (relay) { await relay.close(); relay = null; }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan 19 P7a: the app publish orchestrator over a LIVE relay + directory + serving host', () => {
  it('AC-3/AC-4: A publishes via the app orchestrator; B discovers + pulls + verifies REAL bytes', async () => {
    const api = await loadApp();
    relay = await startRelayServer({ port: 0, host: '127.0.0.1', limits: { mailboxTtlMs: DAY_MS, mailboxMax: 256 } });
    const dirNode = new PublicDirectoryNode({});
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({});
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const deviceB = generateDeviceIdentity('DeviceB');
    const db = createInMemoryTestDatabase();
    const bodies = seedChannel(api, db.adapter, deviceA);

    // A publishes through the SHIPPING app orchestrator against the LIVE host + dir.
    const result = await api.publishChannelPublicly(publishDeps(), {
      db: db.adapter,
      identity: deviceA,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Public Rust Channel',
      description: 'A public, anyone-can-read rust programming channel.',
      category: CATEGORY,
      hostUrls: [community.url],
      directoryUrl: directory.url,
    });

    expect(result.state).toBe('success');
    expect(result.publicationId).toBeTruthy();
    expect(result.link).toBe(`meerkat://public/${result.publicationId}`);
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0]!.accepted).toBe(true);
    expect(result.announced).toBe(true);

    // The orchestrator persisted the signed descriptor locally (owner can unpublish).
    const rows = db.adapter.query<{ publication_id: string; content_id: string }>(
      'SELECT publication_id, content_id FROM cm_publications',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.publication_id).toBe(result.publicationId);

    // B (a different device) browses the directory and discovers the verified entry.
    const browsed = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    const entry = browsed.find((e) => e.descriptor.publicationId === result.publicationId);
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.verified).toBe(true);
    expect(entry.descriptor.ownerDeviceId).toBe(deviceA.publicKey);
    expect(entry.announcingHosts).toBeGreaterThanOrEqual(1); // a REAL serving host announced

    // B PULLS the snapshot from the REAL serving host through the shipping client.
    const pulled = await fetchPublicSnapshot({
      baseUrl: entry.descriptor.hostUrls[0]!, // a REAL serving host, not B's own device
      publicationId: entry.descriptor.publicationId,
      publicKey: publicSnapshotKeyFromHex(entry.descriptor.publicKeyHex),
      expectedContentId: entry.descriptor.contentId,
      expectedAuthor: entry.descriptor.ownerDeviceId,
      channelId: CHANNEL,
      fetchFn: nodeFetch,
    });
    expect(pulled.ok).toBe(true);
    if (!pulled.ok) return;
    expect(pulled.events.map((e) => e.body)).toEqual(bodies);
    expect(pulled.events.every((e) => e.authorDeviceId === deviceA.publicKey)).toBe(true);
    expect(deviceB.publicKey).not.toBe(deviceA.publicKey);

    db.close();
  });

  it('Empty guard: publishing a channel with no events returns Empty and POSTs nothing', async () => {
    const api = await loadApp();
    const dirNode = new PublicDirectoryNode({});
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });
    const commNode = new CommunityNode({});
    community = await startCommunityNodeHttp({ node: commNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const db = createInMemoryTestDatabase();
    api.ensureCommunityTables(db.adapter); // no events seeded

    const result = await api.publishChannelPublicly(publishDeps(), {
      db: db.adapter,
      identity: deviceA,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Empty Channel',
      description: '',
      category: CATEGORY,
      hostUrls: [community.url],
      directoryUrl: directory.url,
    });

    expect(result.state).toBe('empty');
    expect(result.message).toBe('Add at least one post before publishing.');
    expect(result.publicationId).toBeNull();
    expect(result.link).toBeNull();
    expect(db.adapter.query('SELECT publication_id FROM cm_publications')).toHaveLength(0);
    // Nothing was published to the directory.
    const browsed = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(browsed).toHaveLength(0);
    db.close();
  });

  it('Error guard: an unreachable serving host returns the honest Error state', async () => {
    const api = await loadApp();
    const dirNode = new PublicDirectoryNode({});
    directory = await startPublicDirectoryNode({ node: dirNode, host: '127.0.0.1' });

    const deviceA = generateDeviceIdentity('DeviceA');
    const db = createInMemoryTestDatabase();
    seedChannel(api, db.adapter, deviceA);

    const result = await api.publishChannelPublicly(publishDeps(), {
      db: db.adapter,
      identity: deviceA,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Public Rust Channel',
      description: 'unreachable host',
      category: CATEGORY,
      hostUrls: ['http://127.0.0.1:9/'], // discard port: connection refused
      directoryUrl: directory.url,
    });

    expect(result.state).toBe('error');
    expect(result.message).toBe('No serving host accepted the content. Check your host URL or connect hosted serving.');
    expect(result.link).toBeNull();
    expect(result.announced).toBe(false);
    // No accepting host -> nothing persisted, nothing announced.
    expect(db.adapter.query('SELECT publication_id FROM cm_publications')).toHaveLength(0);
    const browsed = await browsePublications({ url: directory.url, category: CATEGORY, webSocketImpl: WS as never });
    expect(browsed).toHaveLength(0);
    db.close();
  });
});

#!/usr/bin/env node
/**
 * Meerkat Node v0 -- headless desktop seeder (plan 14, MK-031).
 *
 * Pins community catalogs and serves their pieces over the web-seed convention
 * (GET /{infoHash}/{index}) so members fetch even when every other member's
 * phone is closed. Content-agnostic: it serves opaque, hash-verified pieces and
 * never sees plaintext. Plain Node, so it runs identically on macOS, Windows,
 * and Linux. Run from source with tsx (the monorepo resolves the TS entry):
 *
 *   PORT=8889 DATA_DIR=~/.meerkat/seed MAX_STORAGE_MB=10240 \
 *     tsx bin/meerkat-node.mjs
 *
 * Catalogs to pin are loaded from CATALOGS_FILE: a JSON array of
 * { manifest, bytesBase64 } produced by buildCommunityCatalog (the bytes are
 * the concatenated catalog source). Without it the node starts empty and can be
 * pinned programmatically; the 24/7 community soak is founder ops.
 *
 * Share-link host discovery (readiness #3) uses a SEPARATE NodeStore web seed
 * (sealed shares, GET /manifest/{contentId} + /block/{sealedId}) -- a different
 * shape from the catalog piece web seed (GET /{infoHash}/{index}). Enable it and
 * the announce loop with:
 *   SHARE_SEED_PORT     start the NodeStore web seed on this port (sealed shares)
 *   SHARES_FILE         optional JSON array of SealedShare objects to pin at start
 *   DISCOVERY_RELAY_URL the relay to announce to (ws/wss)
 *   PUBLIC_BASE_URL     this node's reachable NodeStore web-seed base url (the
 *                       SHARE_SEED endpoint, NAT/TLS resolved) -- NOT the catalog
 *                       PORT endpoint. The announce loop advertises only the
 *                       contentIds actually present in the share NodeStore.
 */

import { promises as fs } from 'node:fs';
import {
  MeerkatSeederNode,
  FileSeederPieceStore,
  startSeederHttp,
  startNodeStoreHttp,
  announceHeldShareContent,
} from '../src/index.ts';
import { InMemoryNodeStore, pinShare } from '@mylife/sync';
import { installOrphanWatchdog } from '../src/orphan-watchdog.ts';

const out = (obj) => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...obj }) + '\n');

const port = Number(process.env.PORT ?? 8889);
const host = process.env.HOST ?? '0.0.0.0';
const dataDir = process.env.DATA_DIR ?? './.meerkat-seed';
const maxStorageMB = Number(process.env.MAX_STORAGE_MB ?? 10240);
const autoDeleteDays = Number(process.env.AUTO_DELETE_DAYS ?? 30);
const sweepMs = Number(process.env.SWEEP_MS ?? 60 * 60 * 1000);
const statsMs = Number(process.env.STATS_MS ?? 5 * 60 * 1000);

const node = new MeerkatSeederNode({
  pieceStore: new FileSeederPieceStore(dataDir),
  policy: {
    enabled: true,
    maxUploadKbps: 0,
    maxSeedStorageMB: maxStorageMB,
    autoDeleteDays,
    seedOnCellular: false,
    seedWhileCharging: true,
    updatedAt: new Date().toISOString(),
  },
});

// Optionally pin catalogs from a JSON file at startup.
if (process.env.CATALOGS_FILE) {
  try {
    const raw = await fs.readFile(process.env.CATALOGS_FILE, 'utf8');
    const catalogs = JSON.parse(raw);
    for (const entry of catalogs) {
      const bytes = new Uint8Array(Buffer.from(entry.bytesBase64, 'base64'));
      const result = await node.pin({ manifest: entry.manifest, bytes }, { pinForever: true });
      out({ event: 'pin', infoHash: entry.manifest.infoHash, result: result.ok ? 'ok' : result.reason });
    }
  } catch (err) {
    out({ event: 'pin_error', error: err instanceof Error ? err.message : String(err) });
  }
}

const server = await startSeederHttp({ node, port, host, log: (event, detail) => out({ event, ...detail }) });
out({ event: 'ready', url: server.url, dataDir, maxStorageMB });

// Separate sealed-share NodeStore web seed (readiness #3). Share-link host
// discovery is about SEALED SHARES served in the NodeStore shape
// (GET /manifest/{contentId}, /block/{sealedId}) -- a DIFFERENT transport from
// the catalog piece shape above. Stand it up only when a share NodeStore web
// seed is requested, and announce ONLY the contentIds genuinely in that store.
const shareStore = new InMemoryNodeStore();
let shareServer = null;
if (process.env.SHARES_FILE) {
  // Optional: load sealed shares from a JSON file at startup. Each entry is a
  // SealedShare ({ manifest, manifestSignature, sealedChunks }) produced by
  // createSealedShare; pinShare writes the manifest + blocks into the store.
  try {
    const raw = await fs.readFile(process.env.SHARES_FILE, 'utf8');
    const shares = JSON.parse(raw);
    for (const share of shares) {
      await pinShare(shareStore, share);
      out({ event: 'share_pin', contentId: share.manifest.contentId });
    }
  } catch (err) {
    out({ event: 'share_pin_error', error: err instanceof Error ? err.message : String(err) });
  }
}
const shareSeedPort = Number(process.env.SHARE_SEED_PORT ?? 0);
if (process.env.SHARE_SEED_PORT) {
  shareServer = await startNodeStoreHttp({
    store: shareStore,
    port: shareSeedPort,
    host,
    log: (event, detail) => out({ event: `share_${event}`, ...detail }),
  });
  out({ event: 'share_seed_ready', url: shareServer.url });
}

const sweepTimer = setInterval(() => {
  void node.sweep().then((pruned) => {
    if (pruned.length > 0) out({ event: 'swept', pruned: pruned.length });
  });
}, sweepMs);
sweepTimer.unref?.();

// Optional share-link host-discovery announce loop (Task 1, readiness #3). OFF
// unless BOTH a discovery relay AND this node's PUBLICLY REACHABLE web-seed base
// url are set, so an unreachable node never announces a url nothing can fetch.
// Production deployment (NAT/TLS, a baked default relay) is ops; the helper +
// config ship here.
//
// Honesty contract: PUBLIC_BASE_URL must serve the NodeStore web-seed shape
// (GET /manifest/{contentId}, /block/{sealedId}) backed by the SAME shareStore
// announced -- i.e. the startNodeStoreHttp endpoint above (or a NAT/TLS reverse
// proxy in front of it), NOT the catalog piece endpoint (`server`/startSeederHttp,
// GET /{infoHash}/{index}). announceHeldShareContent reads the store's manifests,
// so it announces ONLY contentIds genuinely served in that shape -- never a
// catalog infoHash. The discovery resolver opens those urls with httpNodeSource
// + the unchanged verify-then-pin path.
const discoveryRelayUrl = process.env.DISCOVERY_RELAY_URL;
const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const announceMs = Number(process.env.ANNOUNCE_MS ?? 15 * 60 * 1000);
let announceTimer = null;
if (discoveryRelayUrl && publicBaseUrl) {
  const announce = async () => {
    const results = await announceHeldShareContent(
      { relayUrl: discoveryRelayUrl, publicBaseUrl },
      shareStore,
    );
    if (results.length === 0) return;
    const ok = results.filter((r) => r.ok).length;
    out({ event: 'announced', relay: discoveryRelayUrl, ok, failed: results.length - ok });
  };
  void announce();
  announceTimer = setInterval(() => { void announce(); }, announceMs);
  announceTimer.unref?.();
  out({ event: 'announce_enabled', relay: discoveryRelayUrl, publicBaseUrl, announceMs });
}

const statsTimer = setInterval(() => {
  void node.stats().then((s) => out({ event: 'stats', ...s }));
}, statsMs);
statsTimer.unref?.();

function shutdown(signal) {
  out({ event: 'shutdown', signal });
  clearInterval(sweepTimer);
  clearInterval(statsTimer);
  if (announceTimer) clearInterval(announceTimer);
  const closes = [server.close()];
  if (shareServer) closes.push(shareServer.close());
  void Promise.all(closes).then(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

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

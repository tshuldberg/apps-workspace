/**
 * HTTP web-seed bindings for the Meerkat Node (plan 14, MK-031).
 *
 * Two distinct, deliberately separate shapes:
 *  - `startSeederHttp` (catalog shape): a node's pinned community PIECES over the
 *    web-seed convention `GET /{infoHash}/{index}` -- what WebSeedClient /
 *    fetchCatalogFromWebSeed speak; a thin shell over MeerkatSeederNode.servePiece.
 *  - `startNodeStoreHttp` (NodeStore shape): a node's sealed SHARES over
 *    `GET /manifest/{contentId}` and `GET /block/{sealedId}` -- what
 *    httpNodeSource / fetchAndPinFromHosts speak. This is the shape share-link
 *    host discovery announces and resolves (readiness #3): the announce side must
 *    advertise a NodeStore-shaped base url, never the catalog shape.
 * Both are thin shells; all policy/verification lives in the cores.
 */

import http from 'node:http';
import { handleNodeStoreHttp, type NodeStore } from '@mylife/sync';
import type { MeerkatSeederNode } from './seeder-node';

export interface SeederHttpServer {
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

export interface StartSeederHttpOptions {
  node: MeerkatSeederNode;
  port?: number;
  host?: string;
  /** Counts/paths only; never piece contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

const PIECE_PATH = /^\/([0-9a-f]+)\/(\d+)$/;

/** Start the node's web-seed HTTP server. Resolves once listening. */
export function startSeederHttp(options: StartSeederHttpOptions): Promise<SeederHttpServer> {
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    const match = PIECE_PATH.exec(req.url ?? '');
    if (!match) {
      res.writeHead(404).end();
      return;
    }
    const infoHash = match[1]!;
    const index = Number(match[2]);

    void options.node
      .servePiece(infoHash, index)
      .then((bytes) => {
        if (!bytes) {
          res.writeHead(404).end();
          log('miss', { infoHash, index });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': bytes.length,
        });
        res.end(Buffer.from(bytes));
        log('served', { infoHash, index, bytes: bytes.length });
      })
      .catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      log('listening', { host, port });
      resolve({
        port,
        url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

export interface StartNodeStoreHttpOptions {
  store: NodeStore;
  port?: number;
  host?: string;
  /** Counts/paths only; never block contents. */
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

/**
 * Start a NodeStore web-seed HTTP server -- the shape `httpNodeSource` fetches:
 *   GET /manifest/{contentId} -> PinnedManifest JSON | 404
 *   GET /block/{sealedId}     -> opaque block payload | 404
 * This is the host a share-link-discovery resolver opens, and the base url the
 * announce side (announceHeldShareContent) must advertise. Pure passthrough to
 * handleNodeStoreHttp; the store is content-addressed and the relay/host learns
 * nothing about plaintext. Resolves once listening.
 */
export function startNodeStoreHttp(options: StartNodeStoreHttpOptions): Promise<SeederHttpServer> {
  const host = options.host ?? '0.0.0.0';
  const log = options.log ?? (() => {});

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    void handleNodeStoreHttp(options.store, req.url ?? '/')
      .then((r) => {
        if (!r) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(r.status, { 'Content-Type': r.contentType });
        res.end(r.body);
        log(r.status >= 200 && r.status < 300 ? 'served' : 'miss', { path: req.url, status: r.status });
      })
      .catch(() => {
        if (!res.headersSent) res.writeHead(500).end();
      });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      log('listening', { host, port });
      resolve({
        port,
        url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

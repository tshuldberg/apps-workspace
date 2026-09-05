/**
 * HTTP fallback download (web seeding).
 *
 * When P2P peers are unavailable or slow, pieces can be fetched
 * from HTTP/HTTPS endpoints listed in the manifest's webSeeds array.
 * Implements the BEP 19 (GetRight-style) web seed protocol adapted
 * for MyLife content manifests.
 */

import type { ContentManifest } from '../types';

export interface WebSeedOptions {
  manifest: ContentManifest;
  /** Timeout per HTTP request in milliseconds. */
  requestTimeoutMs?: number;
  /** Maximum concurrent HTTP downloads. */
  maxConcurrent?: number;
  /** Custom fetch function (for testing or React Native). */
  fetchFn?: typeof fetch;
}

export interface WebSeedDownload {
  pieceIndex: number;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  bytesDownloaded: number;
  error?: string;
}

/**
 * Downloads pieces from HTTP web seeds as a fallback transport.
 */
export class WebSeedClient {
  private readonly _manifest: ContentManifest;
  private readonly _webSeeds: string[];
  private readonly _requestTimeoutMs: number;
  private readonly _maxConcurrent: number;
  private readonly _fetchFn: typeof fetch;
  private _activeDownloads: Map<number, WebSeedDownload> = new Map();
  private _currentSeedIndex: number = 0;

  constructor(options: WebSeedOptions) {
    this._manifest = options.manifest;
    this._webSeeds = options.manifest.webSeeds;
    this._requestTimeoutMs = options.requestTimeoutMs ?? 30000;
    this._maxConcurrent = options.maxConcurrent ?? 4;
    this._fetchFn = options.fetchFn ?? globalThis.fetch?.bind(globalThis);
  }

  /** Whether any web seeds are available. */
  get hasWebSeeds(): boolean {
    return this._webSeeds.length > 0;
  }

  /** Number of configured web seeds. */
  get webSeedCount(): number {
    return this._webSeeds.length;
  }

  /** Number of currently active downloads. */
  get activeDownloadCount(): number {
    return Array.from(this._activeDownloads.values()).filter(
      (d) => d.status === 'downloading',
    ).length;
  }

  /**
   * Download a specific piece from a web seed.
   *
   * Calculates the byte range for the piece and issues an HTTP Range request
   * to the web seed URL.
   */
  async downloadPiece(pieceIndex: number): Promise<Uint8Array> {
    if (this._webSeeds.length === 0) {
      throw new Error('No web seeds available');
    }
    if (pieceIndex < 0 || pieceIndex >= this._manifest.pieces.length) {
      throw new Error(`Piece index ${pieceIndex} out of range`);
    }
    if (this.activeDownloadCount >= this._maxConcurrent) {
      throw new Error('Maximum concurrent downloads reached');
    }

    // Round-robin across web seeds
    const seedUrl = this._webSeeds[this._currentSeedIndex % this._webSeeds.length];
    this._currentSeedIndex++;

    const download: WebSeedDownload = {
      pieceIndex,
      url: seedUrl,
      status: 'downloading',
      bytesDownloaded: 0,
    };
    this._activeDownloads.set(pieceIndex, download);

    try {
      const data = await this._fetchPiece(seedUrl, pieceIndex);
      download.status = 'completed';
      download.bytesDownloaded = data.length;
      return data;
    } catch (err) {
      download.status = 'failed';
      download.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  /**
   * Download multiple pieces, respecting concurrency limits.
   * Returns a map of piece index to data for successfully downloaded pieces.
   */
  async downloadPieces(pieceIndices: number[]): Promise<Map<number, Uint8Array>> {
    const results = new Map<number, Uint8Array>();
    const queue = [...pieceIndices];

    while (queue.length > 0) {
      const batchSize = Math.min(this._maxConcurrent, queue.length);
      const batch = queue.splice(0, batchSize);

      const promises = batch.map(async (index) => {
        try {
          const data = await this.downloadPiece(index);
          results.set(index, data);
        } catch {
          // Skip failed pieces; P2P can retry them later
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /** Get status of all tracked downloads. */
  getDownloadStatus(): WebSeedDownload[] {
    return Array.from(this._activeDownloads.values());
  }

  /** Clear completed/failed download records. */
  clearCompleted(): void {
    for (const [index, download] of this._activeDownloads) {
      if (download.status === 'completed' || download.status === 'failed') {
        this._activeDownloads.delete(index);
      }
    }
  }

  /** Build the URL for a specific piece from a web seed base URL. */
  private _buildPieceUrl(baseUrl: string, pieceIndex: number): string {
    // Convention: {baseUrl}/{infoHash}/{pieceIndex}
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBase}/${this._manifest.infoHash}/${pieceIndex}`;
  }

  /** Fetch a piece via HTTP with Range request support. */
  private async _fetchPiece(seedUrl: string, pieceIndex: number): Promise<Uint8Array> {
    const url = this._buildPieceUrl(seedUrl, pieceIndex);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this._requestTimeoutMs);

    try {
      const response = await this._fetchFn(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Web seed HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } finally {
      clearTimeout(timeout);
    }
  }
}

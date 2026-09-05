/**
 * Piece selection and download orchestration.
 *
 * Manages the download of a torrent: connecting to peers, requesting
 * pieces using rarest-first selection, and reassembling the final content.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ContentManifest, TransportConnection } from '../types';
import { PieceManager } from './piece-manager';
import { insertDownload, updateDownloadProgress, completeDownload } from '../db/queries';

export interface DownloadOptions {
  db: DatabaseAdapter;
  manifest: ContentManifest;
  storagePath: string;
  contentKey?: string;
  accessToken?: string;
}

export type DownloadState = 'idle' | 'connecting' | 'downloading' | 'verifying' | 'completed' | 'paused' | 'error';

export interface DownloadProgress {
  state: DownloadState;
  totalPieces: number;
  completedPieces: number;
  totalBytes: number;
  downloadedBytes: number;
  progress: number;
  peers: number;
  downloadSpeedBps: number;
}

/**
 * Manages the download lifecycle for a single torrent.
 */
export class TorrentDownloader {
  private readonly _db: DatabaseAdapter;
  private readonly _manifest: ContentManifest;
  private readonly _pieceManager: PieceManager;
  private readonly _storagePath: string;
  private _state: DownloadState = 'idle';
  private _connections: TransportConnection[] = [];
  private _downloadedBytes: number = 0;
  private _startTime: number = 0;
  private _listeners: Set<(progress: DownloadProgress) => void> = new Set();

  constructor(options: DownloadOptions) {
    this._db = options.db;
    this._manifest = options.manifest;
    this._storagePath = options.storagePath;
    this._pieceManager = new PieceManager(
      options.manifest.infoHash,
      options.manifest.pieces,
    );

    // Record the download in the database
    insertDownload(
      options.db,
      options.manifest,
      options.storagePath,
      options.contentKey,
      options.accessToken,
    );
  }

  /** Get current download progress. */
  getProgress(): DownloadProgress {
    const elapsed = this._startTime > 0 ? (Date.now() - this._startTime) / 1000 : 1;
    return {
      state: this._state,
      totalPieces: this._pieceManager.totalPieces,
      completedPieces: this._pieceManager.verifiedCount,
      totalBytes: this._manifest.totalSize,
      downloadedBytes: this._downloadedBytes,
      progress: this._pieceManager.progress,
      peers: this._connections.length,
      downloadSpeedBps: elapsed > 0 ? this._downloadedBytes / elapsed : 0,
    };
  }

  /** Start downloading from available peers. */
  async start(): Promise<void> {
    if (this._state === 'downloading') return;
    this._state = 'downloading';
    this._startTime = Date.now();
    this._notifyListeners();
  }

  /** Pause the download. */
  pause(): void {
    this._state = 'paused';
    this._notifyListeners();
  }

  /** Resume a paused download. */
  resume(): void {
    if (this._state !== 'paused') return;
    this._state = 'downloading';
    this._notifyListeners();
  }

  /** Cancel the download. */
  async cancel(): Promise<void> {
    this._state = 'idle';
    for (const conn of this._connections) {
      await conn.close();
    }
    this._connections = [];
    this._notifyListeners();
  }

  /** Add a peer connection for downloading. */
  addPeer(connection: TransportConnection): void {
    this._connections.push(connection);
    this._notifyListeners();
  }

  /** Remove a peer connection. */
  removePeer(deviceId: string): void {
    this._connections = this._connections.filter((c) => c.remoteDeviceId !== deviceId);
    this._notifyListeners();
  }

  /** Process a received piece. Verifies and records it. */
  receivePiece(pieceIndex: number, data: Uint8Array): boolean {
    const verified = this._pieceManager.verifyPiece(pieceIndex, data);
    if (verified) {
      this._downloadedBytes += data.length;

      // Update database progress
      updateDownloadProgress(
        this._db,
        this._manifest.infoHash,
        this._downloadedBytes,
        this._pieceManager.verifiedCount,
      );

      // Check if download is complete
      if (this._pieceManager.isComplete) {
        this._state = 'completed';
        completeDownload(this._db, this._manifest.infoHash);
      }

      this._notifyListeners();
    }
    return verified;
  }

  /** Get indices of pieces we still need (rarest-first). */
  getWantedPieces(count: number, peerAvailability?: Map<number, number>): number[] {
    return this._pieceManager.selectPieces(count, peerAvailability);
  }

  /** Get the piece manager for direct access. */
  getPieceManager(): PieceManager {
    return this._pieceManager;
  }

  /** Check if download is complete. */
  isComplete(): boolean {
    return this._pieceManager.isComplete;
  }

  /** Subscribe to progress updates. */
  onProgress(listener: (progress: DownloadProgress) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notifyListeners(): void {
    const progress = this.getProgress();
    for (const listener of this._listeners) {
      listener(progress);
    }
  }
}

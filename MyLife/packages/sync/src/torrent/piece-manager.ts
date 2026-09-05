/**
 * Piece verification and Merkle tree validation.
 *
 * Manages the piece-level state for a torrent download: which pieces
 * we have, which are missing, and verification against expected hashes.
 */

import { createHash } from 'crypto';
import type { TorrentPieceStatus } from '../types';

export interface PieceInfo {
  index: number;
  hash: string;
  status: TorrentPieceStatus;
  verifiedAt: string | null;
}

/**
 * Manages piece state for a single torrent.
 */
export class PieceManager {
  private _pieces: PieceInfo[];
  private readonly _infoHash: string;

  constructor(infoHash: string, pieceHashes: string[]) {
    this._infoHash = infoHash;
    this._pieces = pieceHashes.map((hash, index) => ({
      index,
      hash,
      status: 'missing' as TorrentPieceStatus,
      verifiedAt: null,
    }));
  }

  /** Get the info hash for this torrent. */
  get infoHash(): string {
    return this._infoHash;
  }

  /** Get total piece count. */
  get totalPieces(): number {
    return this._pieces.length;
  }

  /** Get count of verified pieces. */
  get verifiedCount(): number {
    return this._pieces.filter((p) => p.status === 'verified').length;
  }

  /** Get count of missing pieces. */
  get missingCount(): number {
    return this._pieces.filter((p) => p.status === 'missing').length;
  }

  /** Check if all pieces are verified. */
  get isComplete(): boolean {
    return this._pieces.every((p) => p.status === 'verified');
  }

  /** Get download progress as a fraction (0 to 1). */
  get progress(): number {
    if (this._pieces.length === 0) return 1;
    return this.verifiedCount / this._pieces.length;
  }

  /** Get the status of a specific piece. */
  getPiece(index: number): PieceInfo | undefined {
    return this._pieces[index];
  }

  /** Get all pieces. */
  getAllPieces(): PieceInfo[] {
    return [...this._pieces];
  }

  /** Get indices of missing pieces. */
  getMissingIndices(): number[] {
    return this._pieces
      .filter((p) => p.status === 'missing')
      .map((p) => p.index);
  }

  /** Get indices of missing pieces using rarest-first selection (BitTorrent style). */
  selectPieces(count: number, peerAvailability?: Map<number, number>): number[] {
    const missing = this.getMissingIndices();
    if (!peerAvailability || peerAvailability.size === 0) {
      return missing.slice(0, count);
    }

    // Sort by availability (rarest first)
    const sorted = missing.sort((a, b) => {
      const availA = peerAvailability.get(a) ?? 0;
      const availB = peerAvailability.get(b) ?? 0;
      return availA - availB;
    });

    return sorted.slice(0, count);
  }

  /** Mark a piece as downloading. */
  markDownloading(index: number): void {
    const piece = this._pieces[index];
    if (piece && piece.status === 'missing') {
      piece.status = 'downloading';
    }
  }

  /** Verify a piece's data against its expected hash. */
  verifyPiece(index: number, data: Uint8Array): boolean {
    const piece = this._pieces[index];
    if (!piece) return false;

    const hash = createHash('sha256').update(data).digest('hex');
    if (hash === piece.hash) {
      piece.status = 'verified';
      piece.verifiedAt = new Date().toISOString();
      return true;
    }

    // Verification failed, reset to missing
    piece.status = 'missing';
    return false;
  }

  /** Reset a piece back to missing (e.g., on verification failure). */
  resetPiece(index: number): void {
    const piece = this._pieces[index];
    if (piece) {
      piece.status = 'missing';
      piece.verifiedAt = null;
    }
  }

  /** Generate a bitfield representing which pieces we have. */
  getBitfield(): boolean[] {
    return this._pieces.map((p) => p.status === 'verified');
  }

  /** Export piece state for persistence. */
  toJSON(): { infoHash: string; pieces: PieceInfo[] } {
    return { infoHash: this._infoHash, pieces: [...this._pieces] };
  }

  /** Restore piece state from persistence. */
  static fromJSON(data: { infoHash: string; pieces: PieceInfo[] }): PieceManager {
    const manager = new PieceManager(data.infoHash, []);
    manager._pieces = data.pieces.map((p) => ({ ...p }));
    return manager;
  }
}

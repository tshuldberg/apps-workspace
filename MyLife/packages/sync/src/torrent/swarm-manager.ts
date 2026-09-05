/**
 * Peer connection management for content swarms.
 *
 * Manages the set of peers in a torrent swarm, tracks their
 * piece availability, and coordinates piece requests across peers.
 */

import type { TransportConnection } from '../types';

export interface SwarmPeer {
  peerId: string;
  connection: TransportConnection;
  isSeeder: boolean;
  /** Bitfield of pieces this peer has. */
  bitfield: boolean[];
  bytesDownloaded: number;
  bytesUploaded: number;
  connectedAt: number;
  lastActiveAt: number;
}

/**
 * Manages the peer swarm for a single torrent.
 */
export class SwarmManager {
  private readonly _infoHash: string;
  private readonly _peers: Map<string, SwarmPeer> = new Map();
  private readonly _totalPieces: number;

  constructor(infoHash: string, totalPieces: number) {
    this._infoHash = infoHash;
    this._totalPieces = totalPieces;
  }

  /** Get the info hash. */
  get infoHash(): string {
    return this._infoHash;
  }

  /** Add a peer to the swarm. */
  addPeer(peerId: string, connection: TransportConnection, isSeeder: boolean = false): void {
    this._peers.set(peerId, {
      peerId,
      connection,
      isSeeder,
      bitfield: new Array(this._totalPieces).fill(false),
      bytesDownloaded: 0,
      bytesUploaded: 0,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  }

  /** Remove a peer from the swarm. */
  async removePeer(peerId: string): Promise<void> {
    const peer = this._peers.get(peerId);
    if (peer) {
      await peer.connection.close();
      this._peers.delete(peerId);
    }
  }

  /** Update a peer's bitfield (which pieces they have). */
  updateBitfield(peerId: string, bitfield: boolean[]): void {
    const peer = this._peers.get(peerId);
    if (peer) {
      peer.bitfield = bitfield;
      peer.lastActiveAt = Date.now();
    }
  }

  /** Mark that a peer has a specific piece. */
  markPeerHasPiece(peerId: string, pieceIndex: number): void {
    const peer = this._peers.get(peerId);
    if (peer && pieceIndex < peer.bitfield.length) {
      peer.bitfield[pieceIndex] = true;
      peer.lastActiveAt = Date.now();
    }
  }

  /** Get availability count per piece (how many peers have each piece). */
  getPieceAvailability(): Map<number, number> {
    const availability = new Map<number, number>();
    for (let i = 0; i < this._totalPieces; i++) {
      let count = 0;
      for (const peer of this._peers.values()) {
        if (peer.bitfield[i]) count++;
      }
      availability.set(i, count);
    }
    return availability;
  }

  /** Get peers that have a specific piece. */
  getPeersWithPiece(pieceIndex: number): SwarmPeer[] {
    return Array.from(this._peers.values()).filter(
      (p) => p.bitfield[pieceIndex] === true,
    );
  }

  /** Get all connected peers. */
  getPeers(): SwarmPeer[] {
    return Array.from(this._peers.values());
  }

  /** Get peer count. */
  get peerCount(): number {
    return this._peers.size;
  }

  /** Get seeder count. */
  get seederCount(): number {
    return Array.from(this._peers.values()).filter((p) => p.isSeeder).length;
  }

  /** Record bytes downloaded from a peer. */
  recordDownload(peerId: string, bytes: number): void {
    const peer = this._peers.get(peerId);
    if (peer) {
      peer.bytesDownloaded += bytes;
      peer.lastActiveAt = Date.now();
    }
  }

  /** Record bytes uploaded to a peer. */
  recordUpload(peerId: string, bytes: number): void {
    const peer = this._peers.get(peerId);
    if (peer) {
      peer.bytesUploaded += bytes;
      peer.lastActiveAt = Date.now();
    }
  }

  /** Close all peer connections. */
  async destroyAll(): Promise<void> {
    for (const peer of this._peers.values()) {
      await peer.connection.close();
    }
    this._peers.clear();
  }
}

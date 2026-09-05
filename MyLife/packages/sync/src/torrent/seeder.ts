/**
 * Seeding engine and upload management.
 *
 * Manages seeding state for content the user has downloaded or published.
 * Tracks upload stats, enforces bandwidth/storage limits, and handles
 * piece requests from peers.
 */

import type { SeedingPolicy } from '../types';

export interface SeedEntry {
  infoHash: string;
  title: string;
  totalSize: number;
  bytesUploaded: number;
  peersServed: number;
  isActive: boolean;
  isPinned: boolean;
  autoDeleteAt: string | null;
  createdAt: string;
}

/**
 * Manages seeding state and upload limits.
 */
export class SeedingEngine {
  private _entries: Map<string, SeedEntry> = new Map();
  private _policy: SeedingPolicy;
  private _totalUploadBytes: number = 0;

  constructor(policy: SeedingPolicy) {
    this._policy = policy;
  }

  /** Start seeding a piece of content. */
  startSeeding(entry: Omit<SeedEntry, 'bytesUploaded' | 'peersServed' | 'isActive'>): void {
    if (!this._policy.enabled) return;

    // Check storage limit
    const currentStorage = this._getTotalStorageMB();
    const newSizeMB = entry.totalSize / (1024 * 1024);
    if (currentStorage + newSizeMB > this._policy.maxSeedStorageMB) return;

    this._entries.set(entry.infoHash, {
      ...entry,
      bytesUploaded: 0,
      peersServed: 0,
      isActive: true,
    });
  }

  /** Stop seeding a specific torrent. */
  stopSeeding(infoHash: string): void {
    const entry = this._entries.get(infoHash);
    if (entry) {
      entry.isActive = false;
    }
  }

  /** Remove a seed entry entirely. */
  removeSeed(infoHash: string): void {
    this._entries.delete(infoHash);
  }

  /** Record bytes uploaded to a peer. */
  recordUpload(infoHash: string, bytes: number): void {
    const entry = this._entries.get(infoHash);
    if (entry) {
      entry.bytesUploaded += bytes;
      entry.peersServed += 1;
      this._totalUploadBytes += bytes;
    }
  }

  /** Check if we should serve a piece request based on current limits. */
  shouldServe(networkConditions: { isWifi: boolean; isCellular: boolean; isCharging: boolean }): boolean {
    if (!this._policy.enabled) return false;
    if (networkConditions.isCellular && !this._policy.seedOnCellular) return false;
    if (!networkConditions.isCharging && this._policy.seedWhileCharging) return false;
    return true;
  }

  /** Check upload bandwidth limit. */
  isWithinBandwidthLimit(currentUploadKbps: number): boolean {
    if (this._policy.maxUploadKbps === 0) return true; // unlimited
    return currentUploadKbps <= this._policy.maxUploadKbps;
  }

  /** Get all seed entries. */
  getEntries(): SeedEntry[] {
    return Array.from(this._entries.values());
  }

  /** Get active seed entries. */
  getActiveEntries(): SeedEntry[] {
    return Array.from(this._entries.values()).filter((e) => e.isActive);
  }

  /** Get a specific seed entry. */
  getEntry(infoHash: string): SeedEntry | undefined {
    return this._entries.get(infoHash);
  }

  /** Get total bytes uploaded across all seeds. */
  getTotalUploaded(): number {
    return this._totalUploadBytes;
  }

  /** Update the seeding policy. */
  updatePolicy(policy: SeedingPolicy): void {
    this._policy = policy;
  }

  /** Get the current policy. */
  getPolicy(): SeedingPolicy {
    return { ...this._policy };
  }

  /** Prune seeds past their auto-delete date. */
  pruneExpired(): string[] {
    const now = Date.now();
    const pruned: string[] = [];
    for (const [hash, entry] of this._entries) {
      if (entry.autoDeleteAt && new Date(entry.autoDeleteAt).getTime() < now && !entry.isPinned) {
        this._entries.delete(hash);
        pruned.push(hash);
      }
    }
    return pruned;
  }

  private _getTotalStorageMB(): number {
    let total = 0;
    for (const entry of this._entries.values()) {
      if (entry.isActive) total += entry.totalSize;
    }
    return total / (1024 * 1024);
  }
}

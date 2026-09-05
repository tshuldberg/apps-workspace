/**
 * Disk usage calculation and storage management for offline tiles.
 *
 * Tiles are stored at: <basePath>/tiles/{region_key}/{z}/{x}/{y}.pbf
 * This module provides utilities for calculating usage and cleanup.
 */

/**
 * Calculate total offline storage usage from region records.
 * This sums size_bytes from all 'ready' regions.
 */
export function totalStorageBytes(regions: Array<{ sizeBytes: number; status: string }>): number {
  return regions
    .filter((r) => r.status === 'ready' || r.status === 'stale')
    .reduce((sum, r) => sum + r.sizeBytes, 0);
}

/**
 * Build a compact storage summary for UI surfaces.
 */
export function summarizeStorageUsage(
  regions: Array<{ sizeBytes: number; status: string }>,
  totalCapacityBytes: number,
) {
  const usedBytes = totalStorageBytes(regions);
  const totalBytes = Math.max(totalCapacityBytes, usedBytes);
  const freeBytes = Math.max(totalBytes - usedBytes, 0);
  const usageRatio = totalBytes === 0 ? 0 : usedBytes / totalBytes;

  return {
    usedBytes,
    totalBytes,
    freeBytes,
    usageRatio,
    downloadedCount: regions.filter((region) => region.status === 'ready' || region.status === 'stale').length,
    activeCount: regions.filter((region) => region.status === 'pending' || region.status === 'downloading').length,
    lowStorage: isLowStorage(freeBytes),
  };
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Check if free space is below the warning threshold (500MB).
 */
export function isLowStorage(freeBytes: number): boolean {
  return freeBytes < 500 * 1024 * 1024;
}

/**
 * Build the directory path for a region's tiles.
 */
export function regionTileDir(basePath: string, regionKey: string): string {
  return `${basePath}/tiles/${regionKey}`;
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createOfflineRegion,
  getOfflineRegion,
  getOfflineRegions,
  getReadyRegions,
  getStaleRegions,
  updateRegionProgress,
  markRegionReady,
  markRegionError,
  resetRegionToPending,
  deleteOfflineRegion,
} from '../db/crud';
import {
  REGION_CATALOG,
  getCatalogByArea,
  getCatalogEntry,
} from '../offline/region-catalog';
import {
  tilesAtZoom,
  estimateRegionTileCount,
  estimateRegionSizeBytes,
  tilePathForCoordinate,
  exceedsTileLimit,
} from '../offline/tile-manager';
import {
  totalStorageBytes,
  summarizeStorageUsage,
  formatBytes,
  isLowStorage,
  regionTileDir,
} from '../offline/storage';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Offline Region CRUD ───────────────────────────────────────────────

describe('Offline Region CRUD', () => {
  it('creates a region with status=pending', () => {
    const region = createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Yosemite National Park',
      regionKey: 'yosemite-np',
      minLat: 37.495,
      maxLat: 38.185,
      minLng: -119.886,
      maxLng: -119.195,
    });

    expect(region.id).toBe('r1');
    expect(region.name).toBe('Yosemite National Park');
    expect(region.regionKey).toBe('yosemite-np');
    expect(region.status).toBe('pending');
    expect(region.progress).toBe(0.0);
    expect(region.tileCount).toBe(0);
    expect(region.sizeBytes).toBe(0);
    expect(region.downloadedAt).toBeNull();
    expect(region.errorMessage).toBeNull();
    expect(region.minZoom).toBe(1);
    expect(region.maxZoom).toBe(15);
  });

  it('retrieves a region by id', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Big Sur',
      regionKey: 'big-sur',
      minLat: 35.8,
      maxLat: 36.5,
      minLng: -121.95,
      maxLng: -121.4,
    });

    const found = getOfflineRegion(testDb.adapter, 'r1');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Big Sur');
  });

  it('returns null for nonexistent region', () => {
    expect(getOfflineRegion(testDb.adapter, 'nope')).toBeNull();
  });

  it('lists all regions', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'A', regionKey: 'a', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });
    createOfflineRegion(testDb.adapter, 'r2', {
      name: 'B', regionKey: 'b', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });

    const all = getOfflineRegions(testDb.adapter);
    expect(all).toHaveLength(2);
  });

  it('updates download progress', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Test', regionKey: 'test', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });

    updateRegionProgress(testDb.adapter, 'r1', 0.45, 2340);

    const region = getOfflineRegion(testDb.adapter, 'r1')!;
    expect(region.status).toBe('downloading');
    expect(region.progress).toBe(0.45);
    expect(region.tileCount).toBe(2340);
  });

  it('marks region as ready', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Test', regionKey: 'test', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });

    markRegionReady(testDb.adapter, 'r1', 25000000, 5000);

    const region = getOfflineRegion(testDb.adapter, 'r1')!;
    expect(region.status).toBe('ready');
    expect(region.progress).toBe(1.0);
    expect(region.sizeBytes).toBe(25000000);
    expect(region.tileCount).toBe(5000);
    expect(region.downloadedAt).not.toBeNull();
    expect(region.expiresAt).not.toBeNull();
    expect(region.errorMessage).toBeNull();
  });

  it('marks region as error', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Test', regionKey: 'test', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });

    markRegionError(testDb.adapter, 'r1', 'Not enough storage space');

    const region = getOfflineRegion(testDb.adapter, 'r1')!;
    expect(region.status).toBe('error');
    expect(region.errorMessage).toBe('Not enough storage space');
  });

  it('resets error region to pending for retry', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Test', regionKey: 'test', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });
    markRegionError(testDb.adapter, 'r1', 'Network error');

    resetRegionToPending(testDb.adapter, 'r1');

    const region = getOfflineRegion(testDb.adapter, 'r1')!;
    expect(region.status).toBe('pending');
    expect(region.progress).toBe(0.0);
    expect(region.errorMessage).toBeNull();
  });

  it('deletes a region and returns region_key', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Test', regionKey: 'test-key', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });

    const key = deleteOfflineRegion(testDb.adapter, 'r1');
    expect(key).toBe('test-key');
    expect(getOfflineRegion(testDb.adapter, 'r1')).toBeNull();
  });

  it('returns null when deleting nonexistent region', () => {
    expect(deleteOfflineRegion(testDb.adapter, 'nope')).toBeNull();
  });

  it('getReadyRegions returns only ready regions', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Ready', regionKey: 'rdy', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });
    createOfflineRegion(testDb.adapter, 'r2', {
      name: 'Pending', regionKey: 'pnd', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });
    markRegionReady(testDb.adapter, 'r1', 1000, 10);

    const ready = getReadyRegions(testDb.adapter);
    expect(ready).toHaveLength(1);
    expect(ready[0].name).toBe('Ready');
  });

  it('getStaleRegions returns regions older than 30 days', () => {
    createOfflineRegion(testDb.adapter, 'r1', {
      name: 'Old', regionKey: 'old', minLat: 0, maxLat: 1, minLng: 0, maxLng: 1,
    });
    // Manually set an old downloaded_at
    testDb.adapter.execute(
      `UPDATE tr_offline_regions SET status = 'ready', downloaded_at = datetime('now', '-31 days') WHERE id = 'r1'`,
    );

    const stale = getStaleRegions(testDb.adapter);
    expect(stale).toHaveLength(1);
    expect(stale[0].regionKey).toBe('old');
  });
});

// ── Region Catalog ────────────────────────────────────────────────────

describe('Region Catalog', () => {
  it('contains at least 10 predefined regions', () => {
    expect(REGION_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('all regions have valid bounding boxes', () => {
    for (const entry of REGION_CATALOG) {
      expect(entry.minLat).toBeLessThan(entry.maxLat);
      expect(entry.minLng).toBeLessThan(entry.maxLng);
      expect(entry.estimatedTiles).toBeGreaterThan(0);
      expect(entry.estimatedSizeMb).toBeGreaterThan(0);
    }
  });

  it('groups regions by area', () => {
    const grouped = getCatalogByArea();
    expect(grouped.size).toBeGreaterThanOrEqual(3);
    expect(grouped.has('National Parks')).toBe(true);
    expect(grouped.has('Coastal')).toBe(true);
    expect(grouped.has('Bay Area')).toBe(true);
  });

  it('looks up a specific catalog entry', () => {
    const entry = getCatalogEntry('yosemite-np');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Yosemite National Park');
  });

  it('returns undefined for unknown region key', () => {
    expect(getCatalogEntry('nonexistent')).toBeUndefined();
  });
});

describe('Offline Storage Summary', () => {
  it('summarizes used, free, and active region counts', () => {
    const summary = summarizeStorageUsage(
      [
        { sizeBytes: 120_000_000, status: 'ready' },
        { sizeBytes: 80_000_000, status: 'stale' },
        { sizeBytes: 0, status: 'downloading' },
      ],
      1_000_000_000,
    );

    expect(summary.usedBytes).toBe(200_000_000);
    expect(summary.freeBytes).toBe(800_000_000);
    expect(summary.downloadedCount).toBe(2);
    expect(summary.activeCount).toBe(1);
    expect(summary.lowStorage).toBe(false);
  });
});

// ── Tile Manager ──────────────────────────────────────────────────────

describe('Tile Manager', () => {
  it('calculates tiles at a specific zoom level', () => {
    // Small area at z10 should produce a reasonable tile count
    const count = tilesAtZoom(37.7, 37.8, -122.5, -122.4, 10);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(100);
  });

  it('estimateRegionTileCount sums across zoom levels', () => {
    const total = estimateRegionTileCount(37.7, 37.8, -122.5, -122.4, 1, 5);
    expect(total).toBeGreaterThan(0);
  });

  it('estimateRegionSizeBytes returns reasonable estimate', () => {
    const bytes = estimateRegionSizeBytes(10000);
    expect(bytes).toBe(50_000_000); // 10000 * 5000
  });

  it('tilePathForCoordinate builds correct path', () => {
    const path = tilePathForCoordinate('/data', 'yosemite-np', 12, 692, 1583);
    expect(path).toBe('/data/tiles/yosemite-np/12/692/1583.pbf');
  });

  it('exceedsTileLimit flags regions over 50k tiles', () => {
    expect(exceedsTileLimit(50001)).toBe(true);
    expect(exceedsTileLimit(50000)).toBe(false);
    expect(exceedsTileLimit(10000)).toBe(false);
  });
});

// ── Storage Utils ─────────────────────────────────────────────────────

describe('Storage Utils', () => {
  it('calculates total storage from ready regions', () => {
    const regions = [
      { sizeBytes: 100000, status: 'ready' },
      { sizeBytes: 200000, status: 'ready' },
      { sizeBytes: 50000, status: 'pending' },
    ];
    expect(totalStorageBytes(regions)).toBe(300000);
  });

  it('includes stale regions in storage total', () => {
    const regions = [
      { sizeBytes: 100000, status: 'stale' },
      { sizeBytes: 200000, status: 'ready' },
    ];
    expect(totalStorageBytes(regions)).toBe(300000);
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('detects low storage', () => {
    expect(isLowStorage(400 * 1024 * 1024)).toBe(true);
    expect(isLowStorage(600 * 1024 * 1024)).toBe(false);
  });

  it('builds region tile directory path', () => {
    expect(regionTileDir('/data', 'big-sur')).toBe('/data/tiles/big-sur');
  });
});

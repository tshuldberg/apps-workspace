/**
 * Tile download/cache management engine.
 *
 * Tile storage layout: <basePath>/tiles/{region_key}/{z}/{x}/{y}.pbf
 * Tiles are stored as files on disk (not in SQLite) for fast random access.
 */

const AVERAGE_TILE_SIZE_BYTES = 5_000; // ~5KB per vector tile on average

/**
 * Calculate the number of tiles for a bounding box at a given zoom level.
 * Uses the Slippy Map tilenames formula.
 */
export function tilesAtZoom(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  zoom: number,
): number {
  const n = Math.pow(2, zoom);

  const xMin = Math.floor(((minLng + 180) / 360) * n);
  const xMax = Math.floor(((maxLng + 180) / 360) * n);

  const yMin = Math.floor(
    ((1 - Math.log(Math.tan((maxLat * Math.PI) / 180) + 1 / Math.cos((maxLat * Math.PI) / 180)) / Math.PI) / 2) * n,
  );
  const yMax = Math.floor(
    ((1 - Math.log(Math.tan((minLat * Math.PI) / 180) + 1 / Math.cos((minLat * Math.PI) / 180)) / Math.PI) / 2) * n,
  );

  const xCount = Math.max(0, xMax - xMin + 1);
  const yCount = Math.max(0, yMax - yMin + 1);
  return xCount * yCount;
}

/**
 * Estimate the total number of tiles for a bounding box across a zoom range.
 */
export function estimateRegionTileCount(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  minZoom: number,
  maxZoom: number,
): number {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += tilesAtZoom(minLat, maxLat, minLng, maxLng, z);
  }
  return total;
}

/**
 * Estimate the download size in bytes based on tile count.
 */
export function estimateRegionSizeBytes(tileCount: number): number {
  return tileCount * AVERAGE_TILE_SIZE_BYTES;
}

/**
 * Build the file path for a tile.
 */
export function tilePathForCoordinate(
  basePath: string,
  regionKey: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${basePath}/tiles/${regionKey}/${z}/${x}/${y}.pbf`;
}

/**
 * Check whether a tile count exceeds the safety limit.
 * Returns true if the region is too large (>50,000 tiles).
 */
export function exceedsTileLimit(tileCount: number): boolean {
  return tileCount > 50_000;
}

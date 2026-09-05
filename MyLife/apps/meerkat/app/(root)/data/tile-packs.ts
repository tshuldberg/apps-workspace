// Plan 38 amendment C.6 (MOBILE ONLY): the offline map tile-pack layer. Meerkat's
// photo map renders over founder-hosted STATIC tile packs (a z0-z8 world pack,
// optional region packs to ~z12), NEVER per-location network tile queries. A pack
// is a single file downloaded ONCE with explicit consent, its bytes verified
// against a PINNED sha512 before it is trusted, and stored under
// privateStorageRoot/meerkat/tilepacks/. On a checksum mismatch the partial file is
// deleted and an honest error is thrown; a forged or corrupted pack is never
// trusted.
//
// Format choice: MBTiles. MapLibre Native (which @maplibre/maplibre-react-native
// wraps) reads an on-device MBTiles file as a local vector/raster source via an
// `mbtiles://` style source, so a single downloaded .mbtiles file is a complete
// offline basemap with no network source. The style we build points ONLY at the
// local file; it has no http(s) tile URL anywhere.
//
// The registry of packs is READ FROM app config (`extra.tilePacks`); founder-ops
// fills in real URLs + pinned hashes per build. An empty registry is the honest
// default: the UI says "No map packs are configured in this build." The native map
// module is loaded lazily and nulls out when absent (Expo Go / a build without it),
// exactly like data/lan-backend.ts, so this module is import-safe everywhere.

import { getPrivateStorageRoot } from './private-storage';
import { sha512Hex } from '@mylife/sync';
import { formatBytes } from '../theme/format';

// expo-file-system is a NATIVE module (pulls react-native), so it is lazy-required
// inside the IO seam rather than imported at module top. That keeps this module
// import-safe in a Node/Vitest environment: the pure helpers (registry parse,
// checksum verify, consent copy, local style) and the injectable-IO download path
// are all testable without the native filesystem.
interface ExpoFileSystem {
  documentDirectory: string | null;
  EncodingType: { Base64: string };
  makeDirectoryAsync(uri: string, options?: { intermediates?: boolean }): Promise<void>;
  getInfoAsync(uri: string): Promise<{ exists: boolean; isDirectory: boolean }>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
  moveAsync(options: { from: string; to: string }): Promise<void>;
  readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string>;
  createDownloadResumable(
    url: string,
    fileUri: string,
    options?: Record<string, unknown>,
    callback?: (d: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
  ): { downloadAsync(): Promise<{ uri: string } | undefined> };
}

function loadFs(): ExpoFileSystem | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-file-system/legacy') as ExpoFileSystem;
  } catch {
    return null;
  }
}

/** The document directory prefix, or '' when the native FS is absent (tests). */
function documentDir(): string {
  return loadFs() ? getPrivateStorageRoot() : '';
}

/** Canonical UI strings. Keep in lockstep with the copy the plan pins. */
export const TILE_PACK_STRINGS = {
  noPacksConfigured: 'No map packs are configured in this build.',
  mapsNeedDevBuild: 'Maps need a dev build.',
  privacyLine: 'Your location and viewing are never sent anywhere.',
  checksumFailed: 'This map pack failed its safety check and was discarded. Nothing was installed.',
} as const;

/** A tile pack descriptor as it appears in app config `extra.tilePacks`. */
export interface TilePackDescriptor {
  id: string;
  name: string;
  region: string;
  /** The one-time download URL (founder-hosted static file). */
  url: string;
  /** The PINNED sha512 hex the downloaded bytes must match exactly. */
  sha512: string;
  sizeBytes: number;
  minZoom: number;
  maxZoom: number;
}

const HEX_512 = /^[0-9a-f]{128}$/;
const MAX_PACK_BYTES = 150 * 1024 * 1024; // C.6 cap: <= 150 MB per pack.

function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

/**
 * Validate + normalize a raw registry value into descriptors. Fail-safe: any
 * malformed entry (missing fields, non-https URL, bad hash, over the 150 MB cap)
 * is DROPPED, never trusted. A non-array input yields an empty registry.
 */
export function parseTilePackRegistry(raw: unknown): TilePackDescriptor[] {
  if (!Array.isArray(raw)) return [];
  const out: TilePackDescriptor[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const region = typeof o.region === 'string' ? o.region.trim() : '';
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    const sha512 = typeof o.sha512 === 'string' ? o.sha512.trim().toLowerCase() : '';
    const sizeBytes = typeof o.sizeBytes === 'number' ? o.sizeBytes : Number.NaN;
    const minZoom = typeof o.minZoom === 'number' ? o.minZoom : Number.NaN;
    const maxZoom = typeof o.maxZoom === 'number' ? o.maxZoom : Number.NaN;
    if (!id || seen.has(id) || !name) continue;
    if (!isHttpsUrl(url)) continue;
    if (!HEX_512.test(sha512)) continue;
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_PACK_BYTES) continue;
    if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom) || minZoom < 0 || maxZoom < minZoom) continue;
    seen.add(id);
    out.push({ id, name, region: region || name, url, sha512, sizeBytes, minZoom, maxZoom });
  }
  return out;
}

/** Read the configured packs from app config `extra.tilePacks`. Never throws. */
export function readConfiguredTilePacks(): TilePackDescriptor[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const extra = (require('expo-constants').default?.expoConfig?.extra ?? {}) as {
      tilePacks?: unknown;
    };
    return parseTilePackRegistry(extra.tilePacks);
  } catch {
    return [];
  }
}

/** The one-time download consent line, with the exact pinned wording. */
export function tilePackConsentCopy(sizeBytes: number): string {
  return `Downloads the whole map pack once (${formatBytes(sizeBytes)}). ${TILE_PACK_STRINGS.privacyLine}`;
}

/**
 * Constant-time-ish equality of two sha512 hex strings. Case-insensitive; a length
 * mismatch is an immediate false. Used to gate trust on a downloaded pack.
 */
export function verifyTilePackChecksum(expected: string, actual: string): boolean {
  const e = expected.trim().toLowerCase();
  const a = actual.trim().toLowerCase();
  if (!HEX_512.test(e) || !HEX_512.test(a)) return false;
  if (e.length !== a.length) return false;
  let diff = 0;
  for (let i = 0; i < e.length; i += 1) diff |= e.charCodeAt(i) ^ a.charCodeAt(i);
  return diff === 0;
}

function tilepacksDir(): string {
  return `${documentDir()}meerkat/tilepacks/`;
}

/** The on-device path a verified pack is stored at (one file per pack id). */
export function tilePackLocalPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${tilepacksDir()}${safe}.mbtiles`;
}

/** True when a verified pack file already exists on this device. */
export async function isTilePackInstalled(id: string): Promise<boolean> {
  try {
    const fs = loadFs();
    if (!fs) return false;
    const info = await fs.getInfoAsync(tilePackLocalPath(id));
    return info.exists && !info.isDirectory;
  } catch {
    return false;
  }
}

export interface TilePackDownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  /** 0..1; 0 when the total is unknown. */
  fraction: number;
}

/**
 * The injectable IO seam so downloadTilePack is unit-testable without the native
 * filesystem. The default implementation (defaultTilePackIo) uses expo-file-system
 * + @mylife/sync sha512; a test passes fakes to drive the checksum-reject path.
 */
export interface TilePackIo {
  ensureDir(dir: string): Promise<void>;
  /** Download url -> destPath, reporting progress. Resolves when the file is on disk. */
  download(url: string, destPath: string, onProgress?: (p: TilePackDownloadProgress) => void): Promise<void>;
  /** sha512 hex of the file at path. */
  hashFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
}

function requireFs(): ExpoFileSystem {
  const fs = loadFs();
  if (!fs) throw new Error(TILE_PACK_STRINGS.mapsNeedDevBuild);
  return fs;
}

export const defaultTilePackIo: TilePackIo = {
  async ensureDir(dir) {
    await requireFs().makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  },
  async download(url, destPath, onProgress) {
    const FileSystem = requireFs();
    const resumable = FileSystem.createDownloadResumable(
      url,
      destPath,
      {},
      onProgress
        ? (d) => {
            const total = d.totalBytesExpectedToWrite;
            onProgress({
              receivedBytes: d.totalBytesWritten,
              totalBytes: total,
              fraction: total > 0 ? d.totalBytesWritten / total : 0,
            });
          }
        : undefined,
    );
    const result = await resumable.downloadAsync();
    if (!result) throw new Error('The map pack download did not complete.');
  },
  async hashFile(path) {
    // Read the file bytes and hash them. Packs are capped at 150 MB and this runs
    // only on a dev/EAS build during founder-ops device QA, so the one-time read
    // is acceptable; there is no streaming file-hash API in expo-file-system/legacy.
    const FileSystem = requireFs();
    const base64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = base64ToBytes(base64);
    return sha512Hex(bytes);
  },
  async deleteFile(path) {
    await requireFs().deleteAsync(path, { idempotent: true }).catch(() => undefined);
  },
  async moveFile(from, to) {
    await requireFs().moveAsync({ from, to });
  },
};

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob ? globalThis.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface DownloadTilePackResult {
  localPath: string;
}

/**
 * Download a tile pack ONCE, verify its bytes against the PINNED sha512, and only
 * then move it into place. Fail-CLOSED: a checksum mismatch deletes the downloaded
 * bytes and throws; nothing partially-verified is ever trusted or installed. The
 * IO seam is injectable so the reject path is unit-tested without a device.
 */
export async function downloadTilePack(
  descriptor: TilePackDescriptor,
  options: { onProgress?: (p: TilePackDownloadProgress) => void; io?: TilePackIo } = {},
): Promise<DownloadTilePackResult> {
  const io = options.io ?? defaultTilePackIo;
  const finalPath = tilePackLocalPath(descriptor.id);
  const tmpPath = `${finalPath}.part`;
  await io.ensureDir(tilepacksDir());
  await io.deleteFile(tmpPath);
  await io.download(descriptor.url, tmpPath, options.onProgress);
  const actual = await io.hashFile(tmpPath);
  if (!verifyTilePackChecksum(descriptor.sha512, actual)) {
    await io.deleteFile(tmpPath);
    throw new Error(TILE_PACK_STRINGS.checksumFailed);
  }
  await io.deleteFile(finalPath);
  await io.moveFile(tmpPath, finalPath);
  return { localPath: finalPath };
}

/**
 * A MapLibre style that renders ONLY from the local pack file. No http(s) tile URL
 * appears anywhere, so the map cannot phone home for tiles. The source is the
 * downloaded MBTiles file; the caller supplies its resolved local path.
 */
export function localTilePackStyle(localPath: string, name: string): Record<string, unknown> {
  return {
    version: 8,
    name: `Meerkat offline: ${name}`,
    sources: {
      'meerkat-offline': {
        type: 'raster',
        // Local MBTiles only. Never a remote {z}/{x}/{y} template.
        tiles: [`mbtiles://${localPath}`],
        tileSize: 256,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#e9f1ed' } },
      { id: 'meerkat-offline', type: 'raster', source: 'meerkat-offline' },
    ],
  };
}

/** The shape we consume from @maplibre/maplibre-react-native, lazily. */
export interface MapLibreModule {
  MapView: unknown;
  Camera: unknown;
  PointAnnotation?: unknown;
  ShapeSource?: unknown;
  [key: string]: unknown;
}

/**
 * Load @maplibre/maplibre-react-native, or null when the native module is absent
 * (Expo Go / a build without it). Mirrors data/lan-backend.ts: the caller shows
 * TILE_PACK_STRINGS.mapsNeedDevBuild instead of crashing.
 */
export function loadMapLibreModule(): MapLibreModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native') as MapLibreModule;
    return mod && (mod.MapView || mod.default) ? mod : null;
  } catch {
    return null;
  }
}

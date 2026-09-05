// Plan 38 amendment C.6: the offline map tile-pack layer. Registry parsing (drops
// malformed / oversized / non-https / bad-hash entries), the honest empty-registry
// default, the pinned-checksum verify + fail-closed reject-and-delete path, the
// consent copy wording, and the local-only style (never a network tile URL). The
// native map module null-out is covered by loadMapLibreModule (absent in the test
// env, so it returns null).

import { describe, expect, it, vi } from 'vitest';
import {
  TILE_PACK_STRINGS,
  type TilePackDescriptor,
  type TilePackIo,
  downloadTilePack,
  loadMapLibreModule,
  localTilePackStyle,
  parseTilePackRegistry,
  tilePackConsentCopy,
  verifyTilePackChecksum,
} from '../(root)/data/tile-packs';

const GOOD_HASH = 'a'.repeat(128);
const OTHER_HASH = 'b'.repeat(128);

function validRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'world',
    name: 'World',
    region: 'World',
    url: 'https://packs.example/world.mbtiles',
    sha512: GOOD_HASH,
    sizeBytes: 50 * 1024 * 1024,
    minZoom: 0,
    maxZoom: 8,
    ...overrides,
  };
}

describe('parseTilePackRegistry', () => {
  it('returns an empty registry for a non-array or empty input (honest default)', () => {
    expect(parseTilePackRegistry(undefined)).toEqual([]);
    expect(parseTilePackRegistry(null)).toEqual([]);
    expect(parseTilePackRegistry('nope')).toEqual([]);
    expect(parseTilePackRegistry([])).toEqual([]);
  });

  it('accepts a valid descriptor', () => {
    const packs = parseTilePackRegistry([validRaw()]);
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({ id: 'world', minZoom: 0, maxZoom: 8 });
  });

  it('drops malformed entries: non-https url, bad hash, oversized, bad zoom, dup id', () => {
    const packs = parseTilePackRegistry([
      validRaw({ id: 'a', url: 'http://insecure/x.mbtiles' }),
      validRaw({ id: 'b', sha512: 'xyz' }),
      validRaw({ id: 'c', sizeBytes: 200 * 1024 * 1024 }),
      validRaw({ id: 'd', maxZoom: -1 }),
      validRaw({ id: 'world' }),
      validRaw({ id: 'world' }), // duplicate id dropped
    ]);
    expect(packs.map((p) => p.id)).toEqual(['world']);
  });
});

describe('verifyTilePackChecksum', () => {
  it('accepts an exact case-insensitive match and rejects anything else', () => {
    expect(verifyTilePackChecksum(GOOD_HASH, GOOD_HASH.toUpperCase())).toBe(true);
    expect(verifyTilePackChecksum(GOOD_HASH, OTHER_HASH)).toBe(false);
    expect(verifyTilePackChecksum(GOOD_HASH, 'short')).toBe(false);
    expect(verifyTilePackChecksum('not-hex', GOOD_HASH)).toBe(false);
  });
});

describe('tilePackConsentCopy', () => {
  it('states the one-time whole-pack download and the privacy guarantee', () => {
    const copy = tilePackConsentCopy(50 * 1024 * 1024);
    expect(copy).toContain('Downloads the whole map pack once');
    expect(copy).toContain('50 MB');
    expect(copy).toContain(TILE_PACK_STRINGS.privacyLine);
  });
});

describe('downloadTilePack', () => {
  const descriptor: TilePackDescriptor = {
    id: 'world', name: 'World', region: 'World',
    url: 'https://packs.example/world.mbtiles', sha512: GOOD_HASH,
    sizeBytes: 1024, minZoom: 0, maxZoom: 8,
  };

  it('installs the pack when the downloaded bytes match the pinned hash', async () => {
    const moves: Array<{ from: string; to: string }> = [];
    const io: TilePackIo = {
      ensureDir: vi.fn(async () => undefined),
      download: vi.fn(async () => undefined),
      hashFile: vi.fn(async () => GOOD_HASH),
      deleteFile: vi.fn(async () => undefined),
      moveFile: vi.fn(async (from, to) => { moves.push({ from, to }); }),
    };
    const res = await downloadTilePack(descriptor, { io });
    expect(res.localPath).toContain('world.mbtiles');
    expect(moves).toHaveLength(1);
  });

  it('fails closed on a checksum mismatch: deletes the bytes, never installs', async () => {
    const deleted: string[] = [];
    const io: TilePackIo = {
      ensureDir: vi.fn(async () => undefined),
      download: vi.fn(async () => undefined),
      hashFile: vi.fn(async () => OTHER_HASH),
      deleteFile: vi.fn(async (p) => { deleted.push(p); }),
      moveFile: vi.fn(async () => { throw new Error('must not move an unverified pack'); }),
    };
    await expect(downloadTilePack(descriptor, { io })).rejects.toThrow(TILE_PACK_STRINGS.checksumFailed);
    expect(io.moveFile).not.toHaveBeenCalled();
    expect(deleted.some((p) => p.endsWith('.part'))).toBe(true);
  });
});

describe('localTilePackStyle', () => {
  it('references only the local pack file, never a network tile URL', () => {
    const style = localTilePackStyle('/docs/meerkat/tilepacks/world.mbtiles', 'World');
    const json = JSON.stringify(style);
    expect(json).toContain('mbtiles:///docs/meerkat/tilepacks/world.mbtiles');
    expect(json).not.toMatch(/https?:\/\//);
    expect(json).not.toContain('{z}');
  });
});

describe('loadMapLibreModule', () => {
  it('returns null when the native module is absent (Expo Go / no dev build)', () => {
    expect(loadMapLibreModule()).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../../definition';
import {
  createSpot,
  getSpots,
  getSpotById,
  getSpotBySlug,
  updateSpotConditions,
  updateSpotProfile,
  toggleSpotFavorite,
  deleteSpot,
  countSpots,
  countFavoriteSpots,
  getAverageWaveHeightFt,
} from '../crud';

describe('@mylife/surf - spots CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ── Helper ──

  function seedSpot(id: string, name: string, overrides?: Record<string, unknown>) {
    createSpot(adapter, id, {
      name,
      region: 'san_francisco',
      breakType: 'beach',
      ...overrides,
    });
  }

  // ── createSpot + getSpotById ──

  it('creates a spot and retrieves it by id', () => {
    seedSpot('spot-1', 'Ocean Beach');
    const spot = getSpotById(adapter, 'spot-1');
    expect(spot).not.toBeNull();
    expect(spot!.id).toBe('spot-1');
    expect(spot!.name).toBe('Ocean Beach');
    expect(spot!.region).toBe('san_francisco');
    expect(spot!.breakType).toBe('beach');
    expect(spot!.isFavorite).toBe(false);
    expect(spot!.waveHeightFt).toBe(0);
    expect(spot!.windKts).toBe(0);
    expect(spot!.tide).toBe('mid');
    expect(spot!.swellDirection).toBe('W');
  });

  it('creates a spot with all enrichment fields', () => {
    createSpot(adapter, 'spot-full', {
      name: 'Mavericks',
      region: 'san_francisco',
      breakType: 'reef',
      slug: 'mavericks',
      latitude: 37.4934,
      longitude: -122.4969,
      orientationDeg: 310,
      skillLevel: 'advanced',
      hazards: ['rocks', 'rip_currents'],
      idealSwellDirMin: 280,
      idealSwellDirMax: 330,
      idealTideLow: 2.0,
      idealTideHigh: 5.0,
      description: 'Big wave spot',
      crowdFactor: 2,
    });

    const spot = getSpotById(adapter, 'spot-full');
    expect(spot!.slug).toBe('mavericks');
    expect(spot!.latitude).toBeCloseTo(37.4934);
    expect(spot!.longitude).toBeCloseTo(-122.4969);
    expect(spot!.orientationDeg).toBe(310);
    expect(spot!.skillLevel).toBe('advanced');
    expect(spot!.hazards).toEqual(['rocks', 'rip_currents']);
    expect(spot!.idealSwellDirMin).toBe(280);
    expect(spot!.idealSwellDirMax).toBe(330);
    expect(spot!.idealTideLow).toBe(2.0);
    expect(spot!.idealTideHigh).toBe(5.0);
    expect(spot!.description).toBe('Big wave spot');
    expect(spot!.crowdFactor).toBe(2);
  });

  // ── getSpots ──

  it('returns all spots when no filter given', () => {
    seedSpot('s1', 'Ocean Beach');
    seedSpot('s2', 'Fort Point');
    const spots = getSpots(adapter);
    expect(spots).toHaveLength(2);
  });

  it('filters spots by search text (name)', () => {
    seedSpot('s1', 'Ocean Beach');
    seedSpot('s2', 'Fort Point');
    const results = getSpots(adapter, { search: 'Ocean' });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Ocean Beach');
  });

  it('filters spots by region', () => {
    seedSpot('s1', 'Ocean Beach', { region: 'san_francisco' });
    seedSpot('s2', 'Rincon', { region: 'santa_barbara' });
    const results = getSpots(adapter, { region: 'santa_barbara' });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Rincon');
  });

  it('filters favorites only', () => {
    seedSpot('s1', 'Ocean Beach', { isFavorite: true });
    seedSpot('s2', 'Fort Point');
    const results = getSpots(adapter, { favoritesOnly: true });
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Ocean Beach');
  });

  it('returns empty array when no spots match', () => {
    seedSpot('s1', 'Ocean Beach');
    const results = getSpots(adapter, { search: 'Nonexistent' });
    expect(results).toEqual([]);
  });

  // ── getSpotBySlug ──

  it('retrieves a spot by slug', () => {
    createSpot(adapter, 'spot-slug', {
      name: 'Pacifica',
      region: 'san_francisco',
      breakType: 'beach',
      slug: 'pacifica',
    });
    const spot = getSpotBySlug(adapter, 'pacifica');
    expect(spot).not.toBeNull();
    expect(spot!.name).toBe('Pacifica');
  });

  it('returns null for non-existent slug', () => {
    expect(getSpotBySlug(adapter, 'nope')).toBeNull();
  });

  // ── getSpotById returns null ──

  it('returns null for non-existent id', () => {
    expect(getSpotById(adapter, 'no-such-id')).toBeNull();
  });

  // ── updateSpotConditions ──

  it('updates wave height and wind conditions', () => {
    seedSpot('s1', 'OB');
    updateSpotConditions(adapter, 's1', { waveHeightFt: 4.5, windKts: 12 });
    const spot = getSpotById(adapter, 's1');
    expect(spot!.waveHeightFt).toBe(4.5);
    expect(spot!.windKts).toBe(12);
  });

  it('updates tide and swell direction', () => {
    seedSpot('s1', 'OB');
    updateSpotConditions(adapter, 's1', { tide: 'high', swellDirection: 'NW' });
    const spot = getSpotById(adapter, 's1');
    expect(spot!.tide).toBe('high');
    expect(spot!.swellDirection).toBe('NW');
  });

  it('does nothing when no fields provided', () => {
    seedSpot('s1', 'OB');
    const before = getSpotById(adapter, 's1');
    updateSpotConditions(adapter, 's1', {});
    const after = getSpotById(adapter, 's1');
    expect(after!.waveHeightFt).toBe(before!.waveHeightFt);
  });

  // ── updateSpotProfile ──

  it('updates enrichment profile fields', () => {
    seedSpot('s1', 'OB');
    updateSpotProfile(adapter, 's1', {
      name: 'Ocean Beach SF',
      slug: 'ocean-beach-sf',
      latitude: 37.7594,
      description: 'Famous SF beach break',
    });
    const spot = getSpotById(adapter, 's1');
    expect(spot!.name).toBe('Ocean Beach SF');
    expect(spot!.slug).toBe('ocean-beach-sf');
    expect(spot!.latitude).toBeCloseTo(37.7594);
    expect(spot!.description).toBe('Famous SF beach break');
  });

  it('updates hazards array', () => {
    seedSpot('s1', 'OB');
    updateSpotProfile(adapter, 's1', {
      hazards: ['rip_currents', 'shore_break'],
    });
    const spot = getSpotById(adapter, 's1');
    expect(spot!.hazards).toEqual(['rip_currents', 'shore_break']);
  });

  // ── toggleSpotFavorite ──

  it('toggles favorite from false to true', () => {
    seedSpot('s1', 'OB');
    expect(getSpotById(adapter, 's1')!.isFavorite).toBe(false);
    toggleSpotFavorite(adapter, 's1');
    expect(getSpotById(adapter, 's1')!.isFavorite).toBe(true);
  });

  it('toggles favorite from true to false', () => {
    seedSpot('s1', 'OB', { isFavorite: true });
    expect(getSpotById(adapter, 's1')!.isFavorite).toBe(true);
    toggleSpotFavorite(adapter, 's1');
    expect(getSpotById(adapter, 's1')!.isFavorite).toBe(false);
  });

  // ── deleteSpot ──

  it('deletes a spot by id', () => {
    seedSpot('s1', 'OB');
    expect(countSpots(adapter)).toBe(1);
    deleteSpot(adapter, 's1');
    expect(countSpots(adapter)).toBe(0);
    expect(getSpotById(adapter, 's1')).toBeNull();
  });

  // ── countSpots ──

  it('counts all spots', () => {
    expect(countSpots(adapter)).toBe(0);
    seedSpot('s1', 'A');
    seedSpot('s2', 'B');
    seedSpot('s3', 'C');
    expect(countSpots(adapter)).toBe(3);
  });

  // ── countFavoriteSpots ──

  it('counts only favorite spots', () => {
    seedSpot('s1', 'A', { isFavorite: true });
    seedSpot('s2', 'B');
    seedSpot('s3', 'C', { isFavorite: true });
    expect(countFavoriteSpots(adapter)).toBe(2);
  });

  it('returns 0 when no favorites', () => {
    seedSpot('s1', 'A');
    expect(countFavoriteSpots(adapter)).toBe(0);
  });

  // ── getAverageWaveHeightFt ──

  it('returns average wave height across all spots', () => {
    seedSpot('s1', 'A', { waveHeightFt: 4 });
    seedSpot('s2', 'B', { waveHeightFt: 6 });
    expect(getAverageWaveHeightFt(adapter)).toBe(5);
  });

  it('returns 0 when no spots exist', () => {
    expect(getAverageWaveHeightFt(adapter)).toBe(0);
  });
});

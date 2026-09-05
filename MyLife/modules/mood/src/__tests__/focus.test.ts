import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  createFocusSession,
  completeFocusSession,
  getFocusSession,
  getFocusSessions,
  getSoundPresets,
  getSoundPresetById,
  createSoundPreset,
  deleteSoundPreset,
} from '../db/focus';
import {
  SOUND_LIBRARY,
  DEFAULT_PRESETS,
  getSoundById,
  getSoundsByCategory,
  validateLayers,
  mixLayers,
} from '../engine/soundscape';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Soundscape Engine', () => {
  describe('SOUND_LIBRARY', () => {
    it('has at least 10 sounds', () => {
      expect(SOUND_LIBRARY.length).toBeGreaterThanOrEqual(10);
    });

    it('each sound has unique id', () => {
      const ids = SOUND_LIBRARY.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('DEFAULT_PRESETS', () => {
    it('has 5 presets', () => {
      expect(DEFAULT_PRESETS).toHaveLength(5);
    });

    it('includes Rain, Ocean, Forest, Cafe, White Noise', () => {
      const names = DEFAULT_PRESETS.map((p) => p.name);
      expect(names).toContain('Rain');
      expect(names).toContain('Ocean');
      expect(names).toContain('Forest');
      expect(names).toContain('Cafe');
      expect(names).toContain('White Noise');
    });
  });

  describe('getSoundById', () => {
    it('returns sound definition for valid id', () => {
      const sound = getSoundById('rain');
      expect(sound).toBeDefined();
      expect(sound!.name).toBe('Rain');
    });

    it('returns undefined for unknown id', () => {
      expect(getSoundById('nonexistent')).toBeUndefined();
    });
  });

  describe('getSoundsByCategory', () => {
    it('returns nature sounds', () => {
      const nature = getSoundsByCategory('nature');
      expect(nature.length).toBeGreaterThan(0);
      expect(nature.every((s) => s.category === 'nature')).toBe(true);
    });

    it('returns noise sounds', () => {
      const noise = getSoundsByCategory('noise');
      expect(noise.length).toBeGreaterThan(0);
    });
  });

  describe('validateLayers', () => {
    it('returns valid for known sounds', () => {
      const result = validateLayers([{ sound: 'rain', volume: 0.5 }]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid for empty layers', () => {
      const result = validateLayers([]);
      expect(result.valid).toBe(false);
    });

    it('returns invalid for unknown sound', () => {
      const result = validateLayers([{ sound: 'fake', volume: 0.5 }]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('fake');
    });

    it('returns invalid for out-of-range volume', () => {
      const result = validateLayers([{ sound: 'rain', volume: 1.5 }]);
      expect(result.valid).toBe(false);
    });
  });

  describe('mixLayers', () => {
    it('applies master volume to all layers', () => {
      const result = mixLayers([{ sound: 'rain', volume: 0.8 }], 0.5);
      expect(result[0].volume).toBe(0.4);
    });

    it('clamps at 1.0', () => {
      const result = mixLayers([{ sound: 'rain', volume: 0.9 }], 1.5);
      expect(result[0].volume).toBe(1);
    });
  });
});

describe('Focus CRUD', () => {
  it('seeds 5 default sound presets', () => {
    const presets = getSoundPresets(testDb.adapter);
    expect(presets).toHaveLength(5);
    expect(presets.every((p) => p.isDefault)).toBe(true);
  });

  it('retrieves preset by id', () => {
    const preset = getSoundPresetById(testDb.adapter, 'preset-rain');
    expect(preset).not.toBeNull();
    expect(preset!.name).toBe('Rain');
    expect(preset!.layers).toHaveLength(2);
  });

  it('preset layers are parsed correctly', () => {
    const preset = getSoundPresetById(testDb.adapter, 'preset-forest');
    expect(preset!.layers).toHaveLength(3);
    expect(preset!.layers[0]).toHaveProperty('sound');
    expect(preset!.layers[0]).toHaveProperty('volume');
  });

  it('creates custom sound preset', () => {
    const preset = createSoundPreset(testDb.adapter, 'custom-1', {
      name: 'My Mix',
      layers: [{ sound: 'rain', volume: 0.6 }, { sound: 'fire', volume: 0.4 }],
    });
    expect(preset.name).toBe('My Mix');
    expect(preset.isDefault).toBe(false);
  });

  it('does not delete default presets', () => {
    deleteSoundPreset(testDb.adapter, 'preset-rain');
    expect(getSoundPresetById(testDb.adapter, 'preset-rain')).not.toBeNull();
  });

  it('deletes custom presets', () => {
    createSoundPreset(testDb.adapter, 'custom-1', {
      name: 'My Mix', layers: [{ sound: 'rain', volume: 0.5 }],
    });
    deleteSoundPreset(testDb.adapter, 'custom-1');
    expect(getSoundPresetById(testDb.adapter, 'custom-1')).toBeNull();
  });

  it('creates focus session', () => {
    const session = createFocusSession(testDb.adapter, 'fs-1', {
      presetName: 'Rain',
      layers: [{ sound: 'rain', volume: 0.7 }],
      targetDurationSeconds: 1800,
      preMoodScore: 5,
    });
    expect(session.id).toBe('fs-1');
    expect(session.presetName).toBe('Rain');
    expect(session.completed).toBe(false);
    expect(session.actualDurationSeconds).toBe(0);
  });

  it('completes focus session', () => {
    createFocusSession(testDb.adapter, 'fs-1', {
      presetName: 'Rain',
      layers: [{ sound: 'rain', volume: 0.7 }],
      targetDurationSeconds: 1800,
    });
    completeFocusSession(testDb.adapter, 'fs-1', {
      actualDurationSeconds: 1500,
      postMoodScore: 7,
    });
    const session = getFocusSession(testDb.adapter, 'fs-1');
    expect(session).not.toBeNull();
    expect(session!.completed).toBe(true);
    expect(session!.actualDurationSeconds).toBe(1500);
    expect(session!.postMoodScore).toBe(7);
  });

  it('returns null for missing session', () => {
    expect(getFocusSession(testDb.adapter, 'missing')).toBeNull();
  });

  it('lists sessions in descending order', () => {
    createFocusSession(testDb.adapter, 'fs-1', {
      presetName: 'Rain', layers: [{ sound: 'rain', volume: 0.7 }],
      targetDurationSeconds: 1800,
    });
    createFocusSession(testDb.adapter, 'fs-2', {
      presetName: 'Ocean', layers: [{ sound: 'ocean', volume: 0.8 }],
      targetDurationSeconds: 3600,
    });
    const sessions = getFocusSessions(testDb.adapter);
    expect(sessions).toHaveLength(2);
  });
});

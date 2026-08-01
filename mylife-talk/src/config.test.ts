import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  settingsPath,
} from './config.js';

describe('settings', () => {
  it('returns defaults when the file is missing', () => {
    expect(
      loadSettings(() => {
        throw new Error('missing');
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a partial settings file over defaults', () => {
    const loaded = loadSettings(() => JSON.stringify({ voice: 'Alex', rate: 205 }));

    expect(loaded).toEqual({ ...DEFAULT_SETTINGS, voice: 'Alex', rate: 205 });
  });

  it('falls back to defaults for corrupt JSON', () => {
    expect(loadSettings(() => '{not json')).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back per key for wrong-typed and invalid values', () => {
    const loaded = loadSettings(() =>
      JSON.stringify({
        rate: 'fast',
        voice: 'Alex',
        turnTaking: 'sometimes',
        sendWords: [3],
      }),
    );

    expect(loaded.rate).toBe(DEFAULT_SETTINGS.rate);
    expect(loaded.voice).toBe('Alex');
    expect(loaded.turnTaking).toBe(DEFAULT_SETTINGS.turnTaking);
    expect(loaded.sendWords).toEqual(DEFAULT_SETTINGS.sendWords);
  });

  it('drops unknown keys', () => {
    const loaded = loadSettings(() => JSON.stringify({ mystery: true }));

    expect(loaded).not.toHaveProperty('mystery');
    expect(Object.keys(loaded)).toEqual(Object.keys(DEFAULT_SETTINGS));
  });

  it('round-trips through save and load', () => {
    let savedPath = '';
    let savedContents = '';
    const settings = { ...DEFAULT_SETTINGS, voice: 'Daniel', tmuxTarget: 'dev:1' };

    saveSettings(settings, (path, contents) => {
      savedPath = path;
      savedContents = contents;
    });

    expect(savedPath).toBe(settingsPath());
    expect(loadSettings(() => savedContents)).toEqual(settings);
  });

  it('uses XDG_CONFIG_HOME before HOME', () => {
    expect(settingsPath({ XDG_CONFIG_HOME: '/tmp/config', HOME: '/tmp/home' })).toBe(
      '/tmp/config/mylife-talk/settings.json',
    );
    expect(settingsPath({ HOME: '/tmp/home' })).toBe(
      '/tmp/home/.config/mylife-talk/settings.json',
    );
  });
});

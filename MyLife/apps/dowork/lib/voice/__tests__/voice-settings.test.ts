import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  DEFAULT_VOICE_SETTINGS,
  getVoiceSettings,
  normalizeVoiceSettings,
  setVoiceSettings,
} from '../voice-settings';

function makeDb(seed?: Record<string, string>): DatabaseAdapter {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    execute(_sql: string, params?: unknown[]): void {
      const [key, value] = (params ?? []) as [string, string];
      store.set(key, value);
    },
    query<T = Record<string, unknown>>(_sql: string, params?: unknown[]): T[] {
      const [key] = (params ?? []) as [string];
      const value = store.get(key);
      return (value !== undefined ? [{ value }] : []) as T[];
    },
    transaction(fn: () => void): void {
      fn();
    },
  };
}

describe('voice-settings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(getVoiceSettings(makeDb())).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it('round-trips a valid value', () => {
    const db = makeDb();
    setVoiceSettings(db, { enabled: false, seekSeconds: 30 });
    expect(getVoiceSettings(db)).toEqual({ enabled: false, seekSeconds: 30 });
  });

  it('falls back to defaults on corrupt JSON', () => {
    const db = makeDb({ 'voice.player.settings': '{not-json' });
    expect(getVoiceSettings(db)).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it('repairs an out-of-range seek length', () => {
    expect(normalizeVoiceSettings({ enabled: true, seekSeconds: 7 })).toEqual({
      enabled: true,
      seekSeconds: 10,
    });
  });

  it('repairs a non-boolean enabled flag', () => {
    expect(normalizeVoiceSettings({ enabled: 'yes', seekSeconds: 15 })).toEqual({
      enabled: true,
      seekSeconds: 15,
    });
  });

  it('normalizes a completely invalid value to defaults', () => {
    expect(normalizeVoiceSettings(null)).toEqual(DEFAULT_VOICE_SETTINGS);
    expect(normalizeVoiceSettings('nope')).toEqual(DEFAULT_VOICE_SETTINGS);
  });
});

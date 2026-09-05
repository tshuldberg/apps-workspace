// Plan 38 Phase 6 (MOBILE): the track-player backend null-out test. Mirrors the
// lan-backend pattern: with the native module absent (Node / Expo Go), the loader
// returns null so the music screen degrades to in-app controls, never a crash and
// never a faked OS integration.

import { describe, it, expect } from 'vitest';
import { loadTrackPlayerBackend } from './track-player-backend';

describe('loadTrackPlayerBackend', () => {
  it('returns null when react-native-track-player is not installed', () => {
    expect(loadTrackPlayerBackend()).toBeNull();
  });
});

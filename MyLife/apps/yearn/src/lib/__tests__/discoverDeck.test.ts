import { describe, expect, it } from 'vitest';
import {
  advanceYearnDeckIndex,
  clampYearnPhotoIndex,
  formatYearnDeckAction,
  getNextYearnPhotoIndex,
  getYearnActivePhoto,
  getYearnDeckPhotoCount,
  getYearnPhotoProgressSegments,
  recordYearnDeckAction,
  rewindYearnDeck,
} from '../discoverDeck';
import type { YearnDiscoverProfile } from '../yearnRepository';

const profile: YearnDiscoverProfile = {
  id: '11111111-1111-1111-1111-111111111111',
  displayName: 'Iris',
  age: 28,
  pronouns: 'she/her',
  intention: 'Long-term',
  relationshipStructure: 'Monogamous',
  photos: [
    { path: 'iris/one.jpg', symbol: 'one' },
    { path: 'iris/two.jpg', symbol: 'two' },
  ],
  prompts: [{ question: 'A letter', answer: 'A first paragraph.' }],
  interests: ['Poetry'],
  isVerified: true,
};

describe('discoverDeck', () => {
  it('clamps photo indexes and exposes active photo progress', () => {
    expect(getYearnDeckPhotoCount(profile)).toBe(2);
    expect(clampYearnPhotoIndex(profile, -2)).toBe(0);
    expect(clampYearnPhotoIndex(profile, 99)).toBe(1);
    expect(clampYearnPhotoIndex(profile, 1.7)).toBe(1);
    expect(getYearnActivePhoto(profile, 1)).toEqual(profile.photos[1]);
    expect(getYearnPhotoProgressSegments(profile, 1)).toEqual([
      { index: 0, isActive: false },
      { index: 1, isActive: true },
    ]);
  });

  it('keeps one progress slot for profiles without photos', () => {
    const withoutPhotos: YearnDiscoverProfile = {
      ...profile,
      photos: [],
    };

    expect(getYearnDeckPhotoCount(withoutPhotos)).toBe(1);
    expect(getYearnActivePhoto(withoutPhotos, 0)).toBeNull();
    expect(getYearnPhotoProgressSegments(withoutPhotos, 12)).toEqual([
      { index: 0, isActive: true },
    ]);
  });

  it('wraps photo advancement inside the current profile', () => {
    expect(getNextYearnPhotoIndex(profile, 0)).toBe(1);
    expect(getNextYearnPhotoIndex(profile, 1)).toBe(0);
  });

  it('records, advances, and rewinds local deck actions', () => {
    const history = recordYearnDeckAction([], profile, 4, 'like');
    expect(history).toEqual([
      {
        action: 'like',
        profileId: profile.id,
        profileIndex: 4,
      },
    ]);
    expect(advanceYearnDeckIndex(4, 8)).toBe(5);
    expect(advanceYearnDeckIndex(7, 8)).toBe(8);

    expect(rewindYearnDeck(history, 5)).toEqual({
      history: [],
      profileIndex: 4,
      entry: history[0],
    });
    expect(rewindYearnDeck([], 2)).toEqual({
      history: [],
      profileIndex: 2,
      entry: null,
    });
  });

  it('formats local action messages', () => {
    expect(formatYearnDeckAction('pass', 'Iris')).toBe('Passed on Iris');
    expect(formatYearnDeckAction('star', 'Iris')).toBe('Starred Iris');
    expect(formatYearnDeckAction('boost', 'Iris')).toBe("Boost isn't available yet");
    expect(formatYearnDeckAction('like', 'Iris')).toBe('Liked Iris');
    expect(formatYearnDeckAction('like', 'Iris', { hasIntro: true })).toBe(
      'Sent Iris an intro',
    );
    expect(formatYearnDeckAction('like', '   ')).toBe('Liked profile');
  });
});

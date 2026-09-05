import type { YearnDiscoverProfile, YearnPhoto } from './yearnRepository';

export type YearnDeckAction = 'pass' | 'star' | 'like' | 'boost';

export interface YearnDeckHistoryEntry {
  action: YearnDeckAction;
  profileId: string;
  profileIndex: number;
}

export interface YearnPhotoProgressSegment {
  index: number;
  isActive: boolean;
}

export function getYearnDeckPhotoCount(profile: YearnDiscoverProfile): number {
  return Math.max(1, profile.photos.length);
}

export function clampYearnPhotoIndex(
  profile: YearnDiscoverProfile,
  photoIndex: number,
): number {
  const maxIndex = getYearnDeckPhotoCount(profile) - 1;
  if (!Number.isFinite(photoIndex)) return 0;
  return Math.min(Math.max(Math.trunc(photoIndex), 0), maxIndex);
}

export function getYearnActivePhoto(
  profile: YearnDiscoverProfile,
  photoIndex: number,
): YearnPhoto | null {
  if (profile.photos.length === 0) return null;
  return profile.photos[clampYearnPhotoIndex(profile, photoIndex)] ?? null;
}

export function getYearnPhotoProgressSegments(
  profile: YearnDiscoverProfile,
  photoIndex: number,
): YearnPhotoProgressSegment[] {
  const activeIndex = clampYearnPhotoIndex(profile, photoIndex);
  return Array.from({ length: getYearnDeckPhotoCount(profile) }, (_, index) => ({
    index,
    isActive: index === activeIndex,
  }));
}

export function getNextYearnPhotoIndex(
  profile: YearnDiscoverProfile,
  currentIndex: number,
): number {
  const count = getYearnDeckPhotoCount(profile);
  return (clampYearnPhotoIndex(profile, currentIndex) + 1) % count;
}

export function advanceYearnDeckIndex(
  currentIndex: number,
  profileCount: number,
): number {
  return Math.min(Math.max(currentIndex + 1, 0), Math.max(profileCount, 0));
}

export function recordYearnDeckAction(
  history: YearnDeckHistoryEntry[],
  profile: YearnDiscoverProfile,
  profileIndex: number,
  action: YearnDeckAction,
): YearnDeckHistoryEntry[] {
  return [
    ...history,
    {
      action,
      profileId: profile.id,
      profileIndex,
    },
  ];
}

export function rewindYearnDeck(
  history: YearnDeckHistoryEntry[],
  currentIndex: number,
): {
  history: YearnDeckHistoryEntry[];
  profileIndex: number;
  entry: YearnDeckHistoryEntry | null;
} {
  const entry = history.at(-1) ?? null;
  if (!entry) {
    return {
      history,
      profileIndex: currentIndex,
      entry: null,
    };
  }

  return {
    history: history.slice(0, -1),
    profileIndex: entry.profileIndex,
    entry,
  };
}

export function formatYearnDeckAction(
  action: YearnDeckAction,
  displayName: string,
  options?: { hasIntro?: boolean },
): string {
  const name = displayName.trim() || 'profile';
  if (action === 'pass') return `Passed on ${name}`;
  if (action === 'star') return `Starred ${name}`;
  if (action === 'boost') return "Boost isn't available yet";
  if (options?.hasIntro) return `Sent ${name} an intro`;
  return `Liked ${name}`;
}

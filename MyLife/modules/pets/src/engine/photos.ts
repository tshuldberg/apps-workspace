export interface PhotoTimelineGroup {
  month: string;
  year: number;
  photos: Array<{ id: string; imageUri: string; caption: string | null; milestoneTag: string | null; takenAt: string | null; createdAt: string }>;
}

export interface PhotoStats {
  totalCount: number;
  firstPhotoDate: string | null;
  mostRecentDate: string | null;
  milestoneCounts: Record<string, number>;
}

/**
 * Group photos by month/year for timeline view.
 * Photos should be sorted by date descending (most recent first).
 */
export function getPhotoTimeline(
  photos: Array<{ id: string; imageUri: string; caption: string | null; milestoneTag: string | null; takenAt: string | null; createdAt: string }>,
): PhotoTimelineGroup[] {
  const groups = new Map<string, PhotoTimelineGroup>();

  for (const photo of photos) {
    const date = photo.takenAt ?? photo.createdAt;
    const d = new Date(date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (!groups.has(key)) {
      groups.set(key, {
        month: monthNames[d.getUTCMonth()],
        year: d.getUTCFullYear(),
        photos: [],
      });
    }
    groups.get(key)!.photos.push(photo);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const aMonth = new Date(`${a.year}-${String(new Date(`${a.month} 1`).getMonth() + 1).padStart(2, '0')}-01`).getMonth();
    const bMonth = new Date(`${b.year}-${String(new Date(`${b.month} 1`).getMonth() + 1).padStart(2, '0')}-01`).getMonth();
    return bMonth - aMonth;
  });
}

/**
 * Get photos filtered by milestone tag.
 */
export function getMilestonePhotos(
  photos: Array<{ milestoneTag: string | null }>,
  tag: string,
): Array<{ milestoneTag: string | null }> {
  return photos.filter((p) => p.milestoneTag === tag);
}

/**
 * Get photo statistics for a pet.
 */
export function getPhotoStats(
  photos: Array<{ takenAt: string | null; createdAt: string; milestoneTag: string | null }>,
): PhotoStats {
  if (photos.length === 0) {
    return { totalCount: 0, firstPhotoDate: null, mostRecentDate: null, milestoneCounts: {} };
  }

  const dates = photos.map((p) => p.takenAt ?? p.createdAt).sort();
  const milestoneCounts: Record<string, number> = {};
  for (const p of photos) {
    if (p.milestoneTag) {
      milestoneCounts[p.milestoneTag] = (milestoneCounts[p.milestoneTag] ?? 0) + 1;
    }
  }

  return {
    totalCount: photos.length,
    firstPhotoDate: dates[0],
    mostRecentDate: dates[dates.length - 1],
    milestoneCounts,
  };
}

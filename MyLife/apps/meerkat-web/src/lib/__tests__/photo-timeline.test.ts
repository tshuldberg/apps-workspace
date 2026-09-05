// Plan 38 amendment C.6 (web twin): the pure photo-timeline logic run against the
// REAL shipped web copy. The web app ships no map, but the twin's photoMapPoints
// is still exercised so the D.7 consent filter cannot drift between surfaces.

import { describe, expect, it } from 'vitest';
import type { LibraryItemEvent, ResolvedLibraryItem } from '../library-data-core';
import {
  NO_CAPTURE_DATE_KEY,
  PHOTO_TIMELINE_STRINGS,
  buildPhotoTimeline,
  parseCaptureDate,
  photoMapPoints,
} from '../photo-timeline-core';

function mkPhoto(
  id: string,
  meta: Record<string, unknown>,
  updatedAt = '2026-01-01T00:00:00.000Z',
): ResolvedLibraryItem {
  const event: LibraryItemEvent = {
    version: 1,
    id,
    communityId: 'ws',
    channelId: 'lib',
    contentCid: `cid-${id}`,
    coverCid: null,
    thumbCid: null,
    keyEpoch: 1,
    wrappedKey: 'k',
    coverWrappedKey: null,
    manifestJson: '{}',
    title: `photo ${id}`,
    sortTitle: null,
    year: null,
    durationMs: null,
    sizeBytes: null,
    mimeType: 'image/jpeg',
    metadataJson: JSON.stringify(meta),
    metadataSource: 'local',
    authorDeviceId: 'me',
    updatedAt,
    tombstone: false,
    signature: 'sig',
  };
  return { event, mediaType: 'photo', metadataUnknownType: false };
}

describe('web photo timeline grouping', () => {
  it('groups by capture date newest-first and buckets undated items honestly', () => {
    const sections = buildPhotoTimeline([
      mkPhoto('a', { capturedAt: '2024-03-05T09:00:00' }),
      mkPhoto('c', { capturedAt: '2024-06-01T12:00:00' }),
      mkPhoto('nodate', { width: 100 }, '2026-02-05T00:00:00.000Z'),
    ]);
    expect(sections.map((s) => s.key)).toEqual(['2024-06-01', '2024-03-05', NO_CAPTURE_DATE_KEY]);
    expect(sections[sections.length - 1]!.dayLabel).toBe(PHOTO_TIMELINE_STRINGS.noCaptureDate);
  });

  it('parses and rejects capture dates the same way as mobile', () => {
    expect(parseCaptureDate('2024-03-05T09:00:00')).toEqual({ year: 2024, month: 3, day: 5 });
    expect(parseCaptureDate('bogus')).toBeNull();
  });
});

describe('web photoMapPoints D.7 consent filter', () => {
  it('returns only items carrying valid coordinates', () => {
    const points = photoMapPoints([
      mkPhoto('geo', { latitude: 51.5, longitude: -0.12 }),
      mkPhoto('stripped', { capturedAt: '2024-03-05T09:00:00' }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]!.id).toBe('geo');
  });
});

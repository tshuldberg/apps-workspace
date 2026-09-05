// Plan 38 amendment C.6: the pure photo-timeline + map-points logic. Grouping by
// EXIF capture date, the honest no-capture-date bucket (never a fabricated date),
// deterministic ordering, and the D.7 GPS consent filter (map points come only
// from items that carry coordinates). A twin-drift guard asserts the web copy is
// byte-identical below its header.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LibraryItemEvent, ResolvedLibraryItem } from '../(root)/data/library-data-core';
import {
  NO_CAPTURE_DATE_KEY,
  PHOTO_TIMELINE_STRINGS,
  buildPhotoTimeline,
  formatDayLabel,
  formatMonthLabel,
  parseCaptureDate,
  photoMapPoints,
} from '../(root)/data/photo-timeline-core';

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

describe('parseCaptureDate', () => {
  it('parses a valid EXIF-derived date and rejects out-of-range / junk', () => {
    expect(parseCaptureDate('2024-03-05T11:22:33')).toEqual({ year: 2024, month: 3, day: 5 });
    expect(parseCaptureDate('2024-03-05')).toEqual({ year: 2024, month: 3, day: 5 });
    expect(parseCaptureDate('2024-13-05')).toBeNull();
    expect(parseCaptureDate('2024-03-40')).toBeNull();
    expect(parseCaptureDate('1200-01-01')).toBeNull();
    expect(parseCaptureDate('not a date')).toBeNull();
    expect(parseCaptureDate(null)).toBeNull();
    expect(parseCaptureDate(1234)).toBeNull();
  });

  it('formats locale-free labels', () => {
    expect(formatDayLabel({ year: 2024, month: 3, day: 5 })).toBe('March 5, 2024');
    expect(formatMonthLabel({ year: 2024, month: 12, day: 25 })).toBe('December 2024');
  });
});

describe('buildPhotoTimeline', () => {
  it('groups into day sections newest-first with correct labels', () => {
    const sections = buildPhotoTimeline([
      mkPhoto('a', { capturedAt: '2024-03-05T09:00:00' }),
      mkPhoto('b', { capturedAt: '2024-03-05T18:00:00' }),
      mkPhoto('c', { capturedAt: '2024-06-01T12:00:00' }),
    ]);
    expect(sections.map((s) => s.key)).toEqual(['2024-06-01', '2024-03-05']);
    expect(sections[0]!.dayLabel).toBe('June 1, 2024');
    expect(sections[0]!.monthLabel).toBe('June 2024');
    // Within a day: capturedAt desc (b at 18:00 before a at 09:00).
    expect(sections[1]!.items.map((i) => i.event.id)).toEqual(['b', 'a']);
  });

  it('puts items without a capture date in the honest bucket, ordered by updatedAt, always last', () => {
    const sections = buildPhotoTimeline([
      mkPhoto('dated', { capturedAt: '2024-03-05T09:00:00' }),
      mkPhoto('nodate1', { width: 100 }, '2026-02-01T00:00:00.000Z'),
      mkPhoto('nodate2', { width: 100 }, '2026-02-05T00:00:00.000Z'),
      mkPhoto('badstr', { capturedAt: 'garbage' }),
    ]);
    const bucket = sections[sections.length - 1]!;
    expect(bucket.key).toBe(NO_CAPTURE_DATE_KEY);
    expect(bucket.hasDate).toBe(false);
    expect(bucket.dayLabel).toBe(PHOTO_TIMELINE_STRINGS.noCaptureDate);
    expect(bucket.monthLabel).toBeNull();
    // updatedAt desc: nodate2 (later) before nodate1; badstr shares the default ts.
    expect(bucket.items.map((i) => i.event.id)).toEqual(['nodate2', 'nodate1', 'badstr']);
  });

  it('never fabricates a date from updatedAt', () => {
    const sections = buildPhotoTimeline([mkPhoto('x', {}, '2026-07-04T00:00:00.000Z')]);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.hasDate).toBe(false);
    expect(sections[0]!.year).toBeNull();
  });

  it('is deterministic for identical input', () => {
    const items = [
      mkPhoto('a', { capturedAt: '2024-03-05T09:00:00' }),
      mkPhoto('b', { capturedAt: '2024-03-05T09:00:00' }),
    ];
    expect(JSON.stringify(buildPhotoTimeline(items))).toBe(JSON.stringify(buildPhotoTimeline(items)));
  });
});

describe('photoMapPoints (D.7 consent filter)', () => {
  it('returns only items with valid consented coordinates', () => {
    const points = photoMapPoints([
      mkPhoto('geo', { capturedAt: '2024-03-05T09:00:00', latitude: 37.77, longitude: -122.41 }),
      mkPhoto('stripped', { capturedAt: '2024-03-05T09:00:00' }),
      mkPhoto('partial', { latitude: 10 }),
      mkPhoto('outofrange', { latitude: 200, longitude: 10 }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ id: 'geo', latitude: 37.77, longitude: -122.41 });
  });

  it('returns an empty list when no photo carries coordinates', () => {
    expect(photoMapPoints([mkPhoto('a', { capturedAt: '2024-03-05T09:00:00' })])).toEqual([]);
  });
});

describe('web twin drift guard', () => {
  it('web photo-timeline-core.ts is byte-identical below the header', () => {
    const bodyBelowImport = (text: string): string => {
      const idx = text.indexOf('import type { ResolvedLibraryItem }');
      expect(idx).toBeGreaterThan(-1);
      return text.slice(idx);
    };
    const mobile = readFileSync(
      join(__dirname, '..', '(root)', 'data', 'photo-timeline-core.ts'),
      'utf8',
    );
    const web = readFileSync(
      join(__dirname, '..', '..', '..', 'meerkat-web', 'src', 'lib', 'photo-timeline-core.ts'),
      'utf8',
    );
    expect(bodyBelowImport(web)).toBe(bodyBelowImport(mobile));
  });
});

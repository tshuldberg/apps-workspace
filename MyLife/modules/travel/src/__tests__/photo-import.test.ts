import { describe, it, expect } from 'vitest';
import {
  parsePhotoExifJson,
  clusterPhotosByDay,
  suggestDestinationsFromPhotos,
} from '../engine/photo-import';

describe('parsePhotoExifJson', () => {
  it('parses N/E refs as positive decimal coords and normalizes date', () => {
    const out = parsePhotoExifJson({
      DateTimeOriginal: '2026:05:05 14:30:00',
      GPSLatitude: [48, 51, 30],
      GPSLongitude: [2, 21, 3],
      GPSLatitudeRef: 'N',
      GPSLongitudeRef: 'E',
    });
    expect(out).not.toBeNull();
    expect(out?.takenAtIso).toBe('2026-05-05T14:30:00Z');
    expect(out?.lat).toBeCloseTo(48.8583, 3);
    expect(out?.lng).toBeCloseTo(2.3508, 3);
  });

  it('applies S/W refs producing negative coordinates', () => {
    const out = parsePhotoExifJson({
      DateTimeOriginal: '2026:06:01 10:00:00',
      GPSLatitude: 34.6037,
      GPSLongitude: 58.3816,
      GPSLatitudeRef: 'S',
      GPSLongitudeRef: 'W',
    });
    expect(out?.lat).toBeCloseTo(-34.6037, 3);
    expect(out?.lng).toBeCloseTo(-58.3816, 3);
  });

  it('returns null for non-object input', () => {
    expect(parsePhotoExifJson(null)).toBeNull();
    expect(parsePhotoExifJson('hello')).toBeNull();
    expect(parsePhotoExifJson(42)).toBeNull();
  });

  it('returns null when no GPS and no date are extractable', () => {
    expect(parsePhotoExifJson({})).toBeNull();
    expect(parsePhotoExifJson({ DateTimeOriginal: 'not a date', GPSLatitude: 'xyz' })).toBeNull();
  });

  it('extracts only date when GPS is missing', () => {
    const out = parsePhotoExifJson({ DateTimeOriginal: '2026:07:04 12:00:00' });
    expect(out).not.toBeNull();
    expect(out?.takenAtIso).toBe('2026-07-04T12:00:00Z');
    expect(out?.lat).toBeUndefined();
    expect(out?.lng).toBeUndefined();
  });
});

describe('clusterPhotosByDay', () => {
  it('groups photos by UTC day and counts them', () => {
    const clusters = clusterPhotosByDay([
      { takenAtIso: '2026-05-05T10:00:00Z', lat: 48.0, lng: 2.0 },
      { takenAtIso: '2026-05-05T14:00:00Z', lat: 48.2, lng: 2.2 },
      { takenAtIso: '2026-05-06T09:00:00Z', lat: 50.0, lng: 3.0 },
      { takenAtIso: '2026-05-07T09:00:00Z' },
    ]);
    expect(clusters.length).toBe(3);
    expect(clusters[0].dateIso).toBe('2026-05-05');
    expect(clusters[0].count).toBe(2);
    expect(clusters[1].dateIso).toBe('2026-05-06');
    expect(clusters[1].count).toBe(1);
    expect(clusters[2].dateIso).toBe('2026-05-07');
    expect(clusters[2].count).toBe(1);
  });

  it('averages centroid across geotagged photos', () => {
    const clusters = clusterPhotosByDay([
      { takenAtIso: '2026-05-05T10:00:00Z', lat: 10.0, lng: 20.0 },
      { takenAtIso: '2026-05-05T11:00:00Z', lat: 12.0, lng: 22.0 },
      { takenAtIso: '2026-05-05T12:00:00Z' }, // no geo, should not skew centroid
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].centroidLat).toBeCloseTo(11.0, 5);
    expect(clusters[0].centroidLng).toBeCloseTo(21.0, 5);
  });

  it('skips photos without takenAtIso', () => {
    const clusters = clusterPhotosByDay([
      { lat: 1, lng: 1 },
      { takenAtIso: '2026-05-05T10:00:00Z', lat: 1, lng: 1 },
    ]);
    expect(clusters.length).toBe(1);
    expect(clusters[0].count).toBe(1);
  });
});

describe('suggestDestinationsFromPhotos', () => {
  it('filters out clusters within 50km of an existing destination', () => {
    // Paris (~48.85, 2.35) vs London (~51.5, -0.12)
    const clusters = [
      { dateIso: '2026-05-05', count: 3, centroidLat: 48.8583, centroidLng: 2.3508 },  // Paris, close to existing
      { dateIso: '2026-05-07', count: 2, centroidLat: 51.5074, centroidLng: -0.1278 }, // London, far from Paris
    ];
    const existing = [{ lat: 48.8566, lng: 2.3522 }]; // existing: Paris
    const out = suggestDestinationsFromPhotos(clusters, existing);
    expect(out.length).toBe(1);
    expect(out[0].dateIso).toBe('2026-05-07');
  });

  it('returns all clusters when there are no existing destinations', () => {
    const clusters = [
      { dateIso: '2026-05-05', count: 3, centroidLat: 48.8583, centroidLng: 2.3508 },
      { dateIso: '2026-05-07', count: 2, centroidLat: 51.5074, centroidLng: -0.1278 },
    ];
    const out = suggestDestinationsFromPhotos(clusters, []);
    expect(out.length).toBe(2);
  });

  it('skips clusters that lack a centroid', () => {
    const clusters = [
      { dateIso: '2026-05-05', count: 3 },
      { dateIso: '2026-05-07', count: 2, centroidLat: 51.5074, centroidLng: -0.1278 },
    ];
    const out = suggestDestinationsFromPhotos(clusters, []);
    expect(out.length).toBe(1);
    expect(out[0].dateIso).toBe('2026-05-07');
  });
});

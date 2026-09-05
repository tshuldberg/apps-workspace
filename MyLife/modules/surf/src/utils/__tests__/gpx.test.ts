import { describe, it, expect } from 'vitest';
import { exportTrackToGpx, importTrackFromGpx } from '../gpx';
import type { GpxTrackPoint } from '../../types';

describe('exportTrackToGpx', () => {
  it('produces valid XML with track points', () => {
    const points: GpxTrackPoint[] = [
      { latitude: 37.75, longitude: -122.51, elevationMeters: 10, timestamp: '2026-03-08T10:00:00Z' },
      { latitude: 37.76, longitude: -122.50, elevationMeters: 20, timestamp: '2026-03-08T10:05:00Z' },
    ];
    const xml = exportTrackToGpx('Test Track', points);

    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<gpx');
    expect(xml).toContain('<trk>');
    expect(xml).toContain('<trkseg>');
    expect(xml).toContain('<trkpt');
    expect(xml).toContain('lat="37.75000000"');
    expect(xml).toContain('lon="-122.51000000"');
    expect(xml).toContain('<ele>10.00</ele>');
    expect(xml).toContain('<time>2026-03-08T10:00:00Z</time>');
    expect(xml).toContain('<name>Test Track</name>');
  });

  it('handles points without elevation', () => {
    const points: GpxTrackPoint[] = [
      { latitude: 37.75, longitude: -122.51 },
    ];
    const xml = exportTrackToGpx('No Elevation', points);
    expect(xml).not.toContain('<ele>');
    expect(xml).toContain('<trkpt');
  });

  it('handles points without timestamp', () => {
    const points: GpxTrackPoint[] = [
      { latitude: 37.75, longitude: -122.51, elevationMeters: 10 },
    ];
    const xml = exportTrackToGpx('No Time', points);
    // The metadata section always has a <time>, but the trkpt should not
    const trkptMatch = xml.match(/<trkpt[^>]*>([^]*?)<\/trkpt>/);
    expect(trkptMatch).not.toBeNull();
    expect(trkptMatch![1]).not.toContain('<time>');
    expect(xml).toContain('<trkpt');
  });

  it('handles empty points array', () => {
    const xml = exportTrackToGpx('Empty', []);
    expect(xml).toContain('<trkseg></trkseg>');
    expect(xml).not.toContain('<trkpt');
  });

  it('escapes XML special characters in name', () => {
    const xml = exportTrackToGpx('Track & <Run> "test"', []);
    expect(xml).toContain('Track &amp; &lt;Run&gt; &quot;test&quot;');
  });

  it('uses default name when empty string provided', () => {
    const xml = exportTrackToGpx('', []);
    expect(xml).toContain('<name>Recorded Track</name>');
  });

  it('includes MySurf as creator', () => {
    const xml = exportTrackToGpx('Test', []);
    expect(xml).toContain('creator="MySurf"');
  });
});

describe('importTrackFromGpx', () => {
  it('parses GPX XML back to track points', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1">
      <metadata><name>My Track</name></metadata>
      <trk>
        <name>My Track</name>
        <trkseg>
          <trkpt lat="37.75000000" lon="-122.51000000">
            <ele>10.00</ele>
            <time>2026-03-08T10:00:00Z</time>
          </trkpt>
          <trkpt lat="37.76000000" lon="-122.50000000">
            <ele>20.00</ele>
            <time>2026-03-08T10:05:00Z</time>
          </trkpt>
        </trkseg>
      </trk>
    </gpx>`;

    const result = importTrackFromGpx(xml);
    expect(result.name).toBe('My Track');
    expect(result.points).toHaveLength(2);
    expect(result.points[0]!.latitude).toBe(37.75);
    expect(result.points[0]!.longitude).toBe(-122.51);
    expect(result.points[0]!.elevationMeters).toBe(10);
    expect(result.points[0]!.timestamp).toBe('2026-03-08T10:00:00Z');
  });

  it('handles points without elevation or time', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="37.75" lon="-122.51"></trkpt>
    </trkseg></trk></gpx>`;

    const result = importTrackFromGpx(xml);
    expect(result.points).toHaveLength(1);
    expect(result.points[0]!.elevationMeters).toBeUndefined();
    expect(result.points[0]!.timestamp).toBeUndefined();
  });

  it('uses default name when none in XML', () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt lat="37.75" lon="-122.51"></trkpt>
    </trkseg></trk></gpx>`;

    const result = importTrackFromGpx(xml);
    expect(result.name).toBe('Imported Track');
  });

  it('returns empty points for XML with no trkpt', () => {
    const xml = `<gpx><trk><trkseg></trkseg></trk></gpx>`;
    const result = importTrackFromGpx(xml);
    expect(result.points).toHaveLength(0);
  });

  // ── Round-trip ──

  it('round-trip: export then import preserves coordinates', () => {
    const originalPoints: GpxTrackPoint[] = [
      { latitude: 37.75, longitude: -122.51, elevationMeters: 10, timestamp: '2026-03-08T10:00:00Z' },
      { latitude: 37.76, longitude: -122.50, elevationMeters: 20, timestamp: '2026-03-08T10:05:00Z' },
      { latitude: 37.77, longitude: -122.49, elevationMeters: 30, timestamp: '2026-03-08T10:10:00Z' },
    ];

    const xml = exportTrackToGpx('Round Trip Test', originalPoints);
    const imported = importTrackFromGpx(xml);

    expect(imported.name).toBe('Round Trip Test');
    expect(imported.points).toHaveLength(3);

    for (let i = 0; i < originalPoints.length; i++) {
      const orig = originalPoints[i]!;
      const imp = imported.points[i]!;
      expect(imp.latitude).toBeCloseTo(orig.latitude, 6);
      expect(imp.longitude).toBeCloseTo(orig.longitude, 6);
      if (orig.elevationMeters != null) {
        expect(imp.elevationMeters).toBeCloseTo(orig.elevationMeters, 1);
      }
      expect(imp.timestamp).toBe(orig.timestamp);
    }
  });

  it('round-trip preserves coordinates for points without elevation', () => {
    const originalPoints: GpxTrackPoint[] = [
      { latitude: 37.75, longitude: -122.51, timestamp: '2026-03-08T10:00:00Z' },
    ];

    const xml = exportTrackToGpx('No Elevation', originalPoints);
    const imported = importTrackFromGpx(xml);

    expect(imported.points).toHaveLength(1);
    expect(imported.points[0]!.latitude).toBeCloseTo(37.75, 6);
    expect(imported.points[0]!.longitude).toBeCloseTo(-122.51, 6);
    expect(imported.points[0]!.elevationMeters).toBeUndefined();
  });
});

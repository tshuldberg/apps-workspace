import { fetchPhotos, fetchRecordings, fetchReviewsByTrail, fetchSegmentsByTrail, fetchTrails, fetchTrips, fetchWaypoints } from '../actions';
import { ExportDownloads } from '../export-downloads';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

export default async function TrailsExportPage() {
  const [trails, recordings, photos, trips] = await Promise.all([
    fetchTrails(),
    fetchRecordings(),
    fetchPhotos(),
    fetchTrips(),
  ]);

  const waypoints = (await Promise.all(
    recordings.map((recording) => fetchWaypoints(recording.id)),
  )).flat();

  const segments = (await Promise.all(
    trails.map((trail) => fetchSegmentsByTrail(trail.id)),
  )).flat();

  const reviews = (await Promise.all(
    trails.map((trail) => fetchReviewsByTrail(trail.id)),
  )).flat();

  const bundle = {
    recordings,
    waypoints,
    photos,
    trails,
    segments,
    reviews,
    trips,
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Data Export"
        title="Select the bundle, preview the payload, and download a clean backup."
        description="Phase 9 export on web is practical instead of decorative. Choose JSON or CSV, include the modules you need, preview the payload, and download a desktop backup immediately."
        actions={
          <>
            <TrailsActionLink href="/trails/recordings" symbol="pace">
              Review Recordings
            </TrailsActionLink>
            <TrailsActionLink href="/trails/photos" symbol="photo_library" secondary>
              Photo Gallery
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <TrailsChip label={`${recordings.length} recordings`} active />
        <TrailsChip label={`${waypoints.length} waypoints`} subtle />
        <TrailsChip label={`${photos.length} photos`} subtle />
        <TrailsChip label={`${trips.length} trips`} subtle />
      </div>

      <TrailsPanel eyebrow="Export" title="Bundle Builder">
        <ExportDownloads bundle={bundle} />
      </TrailsPanel>
    </div>
  );
}

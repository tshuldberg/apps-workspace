import Link from 'next/link';
import { fetchPhotos, fetchTrails } from '../actions';
import { formatCompactDate, TEXT, TEXT_SEC, TEXT_TER, type BasicPhoto, type BasicTrail } from '../ui';
import { TrailsActionLink, TrailsChip, TrailsHero, TrailsPanel } from '../shell';

export default async function TrailsPhotosPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeView = params.view ?? 'grid';

  const [photos, trails] = await Promise.all([fetchPhotos({ limit: 24 }), fetchTrails()]);
  const allPhotos = photos as BasicPhoto[];
  const allTrails = trails as BasicTrail[];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Photo Map Gallery"
        title="Grid, map, and timeline views for trail memories."
        description="Photo parity on web keeps context attached to every image. Switch between a dense grid, a simple map-placement mode, and a timeline view for narrative browsing."
        actions={
          <>
            <TrailsActionLink href="/trails/recordings" symbol="pace">
              Recording History
            </TrailsActionLink>
            <TrailsActionLink href="/trails/export" symbol="ios_share" secondary>
              Export Bundle
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['grid', 'Grid'],
          ['map', 'Map'],
          ['timeline', 'Timeline'],
        ].map(([key, label]) => (
          <Link key={key} href={`/trails/photos?view=${key}`}>
            <TrailsChip label={label} active={activeView === key} subtle={activeView !== key} />
          </Link>
        ))}
      </div>

      <TrailsPanel eyebrow="Gallery" title="Trail Memories">
        {allPhotos.length > 0 ? renderView(activeView, allPhotos, allTrails) : (
          <p style={{ margin: 0, color: TEXT_SEC }}>
            Photo pins appear here after mobile captures attach trail memories to recordings.
          </p>
        )}
      </TrailsPanel>
    </div>
  );
}

function renderView(view: string, photos: BasicPhoto[], trails: BasicTrail[]) {
  if (view === 'map') {
    return (
      <div style={mapViewStyle}>
        {photos.slice(0, 8).map((photo, index) => (
          <div
            key={photo.id}
            style={{
              position: 'absolute',
              left: `${14 + index * 10}%`,
              top: `${22 + ((index % 3) * 18)}%`,
              display: 'grid',
              gap: 6,
              justifyItems: 'center',
            }}
          >
            <span style={pinStyle} />
            <span style={{ color: TEXT_TER, fontSize: 11 }}>
              {trails.find((trail) => trail.id === photo.trailId)?.name.split(' ')[0] ?? 'Photo'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'timeline') {
    const groups = groupPhotosByMonth(photos);
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {groups.map((group) => (
          <section key={group.label} style={{ display: 'grid', gap: 10 }}>
            <strong style={{ color: TEXT, fontSize: 16 }}>{group.label}</strong>
            <div style={{ display: 'grid', gap: 10 }}>
              {group.items.map((photo) => (
                <div key={photo.id} style={timelineRowStyle}>
                  <div style={thumbnailStyle} />
                  <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                    <strong style={{ color: TEXT }}>{photo.caption ?? 'Trail photo'}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatCompactDate(photo.takenAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
      {photos.map((photo) => (
        <div key={photo.id} style={gridCardStyle}>
          <div style={thumbnailStyle} />
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ color: TEXT, fontSize: 14 }}>{photo.caption ?? 'Trail memory'}</strong>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatCompactDate(photo.takenAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function groupPhotosByMonth(photos: BasicPhoto[]) {
  const groups = new Map<string, { label: string; items: BasicPhoto[] }>();
  for (const photo of photos) {
    const date = new Date(photo.takenAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const current = groups.get(key);
    if (current) {
      current.items.push(photo);
    } else {
      groups.set(key, { label, items: [photo] });
    }
  }
  return Array.from(groups.values());
}

const mapViewStyle = {
  position: 'relative' as const,
  minHeight: 360,
  borderRadius: 24,
  overflow: 'hidden' as const,
  background: 'linear-gradient(180deg, rgba(12,17,12,0.96), rgba(19,19,24,0.88))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
};

const pinStyle = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: '#84CC16',
  boxShadow: '0 0 0 10px rgba(132,204,22,0.14)',
};

const thumbnailStyle = {
  minHeight: 150,
  borderRadius: 18,
  background: 'linear-gradient(135deg, rgba(132,204,22,0.22), rgba(255,255,255,0.04))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.14)',
};

const gridCardStyle = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const timelineRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

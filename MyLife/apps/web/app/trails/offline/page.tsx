import { fetchOfflineCatalog, fetchOfflineRegions } from '../actions';
import { formatStorage, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

type OfflineRegion = {
  id: string;
  name: string;
  regionKey: string;
  tileCount: number;
  sizeBytes: number;
  status: string;
  progress: number;
  downloadedAt: string | null;
};

export default async function TrailsOfflinePage() {
  const [regions, catalog] = await Promise.all([fetchOfflineRegions(), fetchOfflineCatalog()]);
  const activeRegions = regions as OfflineRegion[];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Offline Maps"
        title="Downloaded regions, progress states, and the next tiles to bring offline."
        description="The desktop offline screen mirrors the mobile region library with storage context, download readiness, and a map-style region picker presentation."
        actions={
          <>
            <TrailsActionLink href="/trails/weather" symbol="partly_cloudy_day">
              Weather Overlay
            </TrailsActionLink>
            <TrailsActionLink href="/trails/routes" symbol="route" secondary>
              Route Builder
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Downloaded" title="Offline Region Grid">
          {activeRegions.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {activeRegions.map((region) => (
                <div key={region.id} style={rowStyle}>
                  <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                    <strong style={{ color: TEXT }}>{region.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                      {formatStorage(region.sizeBytes)} · {region.tileCount.toLocaleString()} tiles
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                    <TrailsChip label={region.status} active={region.status === 'ready'} subtle={region.status !== 'ready'} />
                    <span style={{ color: TEXT_TER, fontSize: 12 }}>{Math.round(region.progress * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC }}>No offline regions downloaded yet.</p>
          )}
        </TrailsPanel>

        <TrailsPanel eyebrow="Picker" title="Suggested Regions">
          <div style={{ display: 'grid', gap: 10 }}>
            {catalog.slice(0, 6).map((entry) => (
              <div key={entry.regionKey} style={rowStyle}>
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <strong style={{ color: TEXT }}>{entry.name}</strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                    {entry.area} · {Math.round(entry.estimatedSizeMb)} MB estimated
                  </span>
                </div>
                <span style={{ color: TEXT_TER, fontSize: 12 }}>{entry.estimatedTiles.toLocaleString()} tiles</span>
              </div>
            ))}
          </div>
        </TrailsPanel>
      </div>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

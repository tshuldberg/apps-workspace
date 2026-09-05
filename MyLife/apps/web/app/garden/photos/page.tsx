'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchGardenPhotos } from '../actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, formatGardenCount, formatGardenDate } from '../_lib/design';

type GardenPhoto = Awaited<ReturnType<typeof fetchGardenPhotos>>[number];

export default function GardenPhotosPage() {
  const [photos, setPhotos] = useState<GardenPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | '90d' | '30d'>('all');
  const [view, setView] = useState<'grid' | 'before-after'>('grid');
  const [selectedPhoto, setSelectedPhoto] = useState<GardenPhoto | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGardenPhotos()
      .then((rows) => setPhotos(rows))
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load photos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const zones = useMemo(() => ['all', ...Array.from(new Set(photos.map((photo) => photo.zone))).sort((left, right) => left.localeCompare(right))], [photos]);

  const filteredPhotos = useMemo(() => {
    const now = new Date();
    return photos.filter((photo) => {
      if (zoneFilter !== 'all' && photo.zone !== zoneFilter) return false;
      if (dateFilter === 'all') return true;
      const target = new Date(photo.date.includes('T') ? photo.date : `${photo.date}T12:00:00`);
      const diff = (now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
      return dateFilter === '30d' ? diff <= 30 : diff <= 90;
    });
  }, [dateFilter, photos, zoneFilter]);

  const featured = filteredPhotos[0] ?? null;

  if (loading) return <PhotosSkeleton />;
  if (error) return <PhotosError message={error} onRetry={refresh} />;

  if (!filteredPhotos.length) {
    return (
      <GardenEmptyState
        title="No photo captures yet"
        description="Plant portraits, entry media, and harvest shots all flow into this masonry view once the module has image URIs to display."
        action={<GardenActionButton onClick={refresh}>Refresh Feed</GardenActionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Garden Photos</h1>
            <GardenBadge text={`${formatGardenCount(filteredPhotos.length)} captures`} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.12)} />
          </div>
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
            Masonry archive sourced from plant portraits, journal imagery, and harvest captures.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value="all" style={selectStyle}>
            <option value="all">Plant Type</option>
          </select>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as 'all' | '90d' | '30d')} style={selectStyle}>
            <option value="all">Date Range</option>
            <option value="90d">Last 90 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} style={selectStyle}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>{zone === 'all' ? 'Growth Zone' : zone}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GardenGhostButton onClick={() => setView('grid')} style={{ color: view === 'grid' ? GARDEN_CHROME.accent : GARDEN_CHROME.textMuted }}>Grid</GardenGhostButton>
          <GardenGhostButton onClick={() => setView('before-after')} style={{ color: view === 'before-after' ? GARDEN_CHROME.accent : GARDEN_CHROME.textMuted }}>Before-After</GardenGhostButton>
        </div>
      </div>

      {featured ? (
        <GardenPanel tone="base" style={{ overflow: 'hidden' }}>
          <GardenImage
            src={featured.imageUri}
            alt={featured.title}
            title={featured.title}
            style={{ height: 340 }}
            overlay={(
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(10,10,15,0.78))' }} />
                <div style={{ position: 'absolute', inset: 0, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <GardenBadge text="Featured" color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.18)} />
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ color: 'rgba(228,225,233,0.8)', fontSize: 12 }}>{formatGardenDate(featured.date)}</div>
                    <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.4 }}>{featured.title}</div>
                    <div style={{ color: 'rgba(228,225,233,0.84)', maxWidth: 560 }}>{featured.subtitle}</div>
                  </div>
                </div>
              </>
            )}
          />
        </GardenPanel>
      ) : null}

      <div style={view === 'grid' ? masonryWrap : pairedWrap}>
        {filteredPhotos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setSelectedPhoto(photo)}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'block',
              width: '100%',
              breakInside: 'avoid',
              marginBottom: 18,
              textAlign: 'left',
              background: 'transparent',
            }}
          >
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22 }}>
              <img
                src={photo.imageUri}
                alt={photo.title}
                style={{
                  width: '100%',
                  height: view === 'before-after' ? 220 : index % 5 === 0 ? 320 : index % 3 === 0 ? 280 : 240,
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'grayscale(0.22)',
                  transition: 'transform 220ms ease, filter 220ms ease',
                }}
              />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.72))' }}>
                <div style={{ color: '#F4F1EA', fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>{formatGardenDate(photo.date)}</div>
                <div style={{ color: '#F9F7F1', fontSize: 16, fontWeight: 800 }}>{photo.title}</div>
                <div style={{ color: 'rgba(244,241,234,0.72)', fontSize: 12 }}>{photo.zone}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedPhoto ? (
        <div style={lightboxBackdrop} onClick={() => setSelectedPhoto(null)}>
          <div style={lightboxPanel} onClick={(event) => event.stopPropagation()}>
            <GardenImage src={selectedPhoto.imageUri} alt={selectedPhoto.title} title={selectedPhoto.title} style={{ height: 420, borderRadius: 24 }} />
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <GardenKicker color={GARDEN_CHROME.gold}>{selectedPhoto.zone}</GardenKicker>
                  <h2 style={{ margin: '10px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>{selectedPhoto.title}</h2>
                </div>
                <GardenGhostButton onClick={() => setSelectedPhoto(null)}>Close</GardenGhostButton>
              </div>
              <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>{selectedPhoto.subtitle}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <GardenGhostButton onClick={() => navigator.clipboard.writeText(selectedPhoto.imageUri)}>Copy URL</GardenGhostButton>
                <GardenGhostButton onClick={() => window.open(selectedPhoto.imageUri, '_blank', 'noopener,noreferrer')}>Open Asset</GardenGhostButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button type="button" style={fabButton}>
        +
      </button>
    </div>
  );
}

function PhotosSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ ...skeleton, height: 340 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
        {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} style={{ ...skeleton, minHeight: 260 }} />)}
      </div>
    </div>
  );
}

function PhotosError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Photo gallery failed to load.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const selectStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 18,
  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: GARDEN_CHROME.text,
  fontSize: 14,
  outline: 'none',
};

const masonryWrap: CSSProperties = {
  columnCount: 3,
  columnGap: 18,
};

const pairedWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
};

const lightboxBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.62)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 50,
  padding: 24,
};

const lightboxPanel: CSSProperties = {
  width: 'min(960px, 100%)',
  background: GARDEN_CHROME.surfaceBase,
  borderRadius: 28,
  padding: 24,
  display: 'grid',
  gap: 18,
};

const fabButton: CSSProperties = {
  position: 'fixed',
  right: 32,
  bottom: 32,
  width: 58,
  height: 58,
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: `linear-gradient(135deg, ${GARDEN_CHROME.accentLight}, ${GARDEN_CHROME.accent})`,
  color: '#081105',
  fontSize: 34,
  fontWeight: 700,
  boxShadow: `0 18px 34px ${alpha(GARDEN_CHROME.accent, 0.32)}`,
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};

'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchRestaurants, fetchMapTiles, type MapTile } from '../actions';

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  cuisines: string | null;
  price_tier: number | null;
  average_rating: number | null;
  is_visited: number;
  is_wishlist: number;
}

const ACCENT = '#DC2626';
const ACCENT_VISITED = '#30D158';
const ACCENT_WISHLIST = '#DC2626';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const SURFACE = 'var(--surface-elevated, #2A292F)';

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];
const TILE_SIZE = 256;
const MAP_HEIGHT = 480;

// -- Web Mercator helpers (lat/lng <-> world pixels at a given zoom) --

function lngToWorldX(lng: number, z: number): number {
  return ((lng + 180) / 360) * TILE_SIZE * Math.pow(2, z);
}

function latToWorldY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  const n = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return ((1 - n / Math.PI) / 2) * TILE_SIZE * Math.pow(2, z);
}

interface Viewport {
  centerLat: number;
  centerLng: number;
  zoom: number;
}

function computeBounds(points: Array<{ lat: number; lng: number }>): {
  centerLat: number;
  centerLng: number;
  zoom: number;
} {
  if (points.length === 0) {
    return { centerLat: 40.7128, centerLng: -74.006, zoom: 11 };
  }
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  if (points.length === 1) {
    return { centerLat, centerLng, zoom: 14 };
  }

  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const viewWidth = 720;
  let zoom = 14;
  for (let z = 18; z >= 2; z--) {
    const worldPx = TILE_SIZE * Math.pow(2, z);
    const pxW = (lngSpan / 360) * worldPx;
    const pxH = (latSpan / 180) * worldPx;
    if (pxW <= viewWidth * 0.85 && pxH <= MAP_HEIGHT * 0.85) {
      zoom = z;
      break;
    }
  }
  return { centerLat, centerLng, zoom };
}

interface InteractiveMapProps {
  points: Array<{ id: string; name: string; lat: number; lng: number; color: string }>;
}

function InteractiveMap({ points }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 720, height: MAP_HEIGHT });
  const [view, setView] = useState<Viewport>(() => computeBounds(points));
  const [tiles, setTiles] = useState<Record<string, string>>({});
  const [tilesLoading, setTilesLoading] = useState(true);
  const [activePin, setActivePin] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startCx: number; startCy: number } | null>(null);

  // Measure container width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: MAP_HEIGHT });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // World-pixel center for the current view.
  const centerWorldX = lngToWorldX(view.centerLng, view.zoom);
  const centerWorldY = latToWorldY(view.centerLat, view.zoom);

  // Which tiles cover the viewport.
  const visibleTiles = useMemo(() => {
    const z = view.zoom;
    const half = Math.pow(2, z);
    const leftWorld = centerWorldX - size.width / 2;
    const topWorld = centerWorldY - size.height / 2;
    const minTileX = Math.floor(leftWorld / TILE_SIZE);
    const minTileY = Math.floor(topWorld / TILE_SIZE);
    const maxTileX = Math.floor((leftWorld + size.width) / TILE_SIZE);
    const maxTileY = Math.floor((topWorld + size.height) / TILE_SIZE);
    const out: Array<{ z: number; x: number; y: number; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const wrappedX = ((tx % half) + half) % half;
        if (ty < 0 || ty >= half) continue;
        out.push({
          z,
          x: wrappedX,
          y: ty,
          left: tx * TILE_SIZE - leftWorld,
          top: ty * TILE_SIZE - topWorld,
        });
      }
    }
    return out;
  }, [view.zoom, centerWorldX, centerWorldY, size.width, size.height]);

  // Fetch the tiles we don't have yet (server-side, keyless).
  useEffect(() => {
    let cancelled = false;
    const needed = visibleTiles
      .map((t) => ({ z: t.z, x: t.x, y: t.y }))
      .filter((t) => !(`${t.z}/${t.x}/${t.y}` in tiles));
    if (needed.length === 0) {
      setTilesLoading(false);
      return;
    }
    setTilesLoading(true);
    void fetchMapTiles(needed).then((fetched: MapTile[]) => {
      if (cancelled) return;
      setTiles((prev) => {
        const next = { ...prev };
        for (const t of fetched) {
          if (t.dataUri) next[`${t.z}/${t.x}/${t.y}`] = t.dataUri;
        }
        return next;
      });
      setTilesLoading(false);
    });
    return () => { cancelled = true; };
  }, [visibleTiles, tiles]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCx: centerWorldX,
      startCy: centerWorldY,
    };
  }, [centerWorldX, centerWorldY]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const newWorldX = drag.startCx - dx;
    const newWorldY = drag.startCy - dy;
    const worldPx = TILE_SIZE * Math.pow(2, view.zoom);
    const newLng = (newWorldX / worldPx) * 360 - 180;
    const ny = newWorldY / worldPx;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ny)));
    const newLat = (latRad * 180) / Math.PI;
    setView((v) => ({ ...v, centerLng: newLng, centerLat: Math.max(-85, Math.min(85, newLat)) }));
  }, [view.zoom]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setView((v) => ({ ...v, zoom: Math.max(2, Math.min(18, v.zoom + delta)) }));
  }, []);

  const recenter = useCallback(() => {
    setView(computeBounds(points));
  }, [points]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: MAP_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        border: `1px solid ${BORDER}`,
        backgroundColor: '#0E0E13',
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Tiles */}
      {visibleTiles.map((t) => {
        const key = `${t.z}/${t.x}/${t.y}`;
        const uri = tiles[key];
        return (
          <div
            key={`${key}-${t.left}-${t.top}`}
            style={{
              position: 'absolute',
              left: t.left,
              top: t.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              backgroundColor: '#1B1B20',
              backgroundImage: uri ? `url(${uri})` : undefined,
              backgroundSize: 'cover',
              opacity: uri ? 1 : 0.4,
            }}
          />
        );
      })}

      {/* Pins */}
      {points.map((p) => {
        const px = lngToWorldX(p.lng, view.zoom) - (centerWorldX - size.width / 2);
        const py = latToWorldY(p.lat, view.zoom) - (centerWorldY - size.height / 2);
        if (px < -40 || py < -40 || px > size.width + 40 || py > size.height + 40) return null;
        const isActive = activePin === p.id;
        return (
          <div
            key={p.id}
            style={{ position: 'absolute', left: px, top: py, transform: 'translate(-50%, -100%)', zIndex: isActive ? 30 : 10 }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActivePin(isActive ? null : p.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={p.name}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(-45deg)',
                backgroundColor: p.color,
                border: '2px solid #FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            {isActive && (
              <Link
                href={`/dining/restaurant/${p.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  padding: '8px 12px',
                  borderRadius: 10,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}
              >
                {p.name}
              </Link>
            )}
          </div>
        );
      })}

      {/* Controls */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'grid', gap: 8, zIndex: 40 }}>
        <button type="button" onClick={() => zoomBy(1)} onPointerDown={(e) => e.stopPropagation()} style={controlBtn} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomBy(-1)} onPointerDown={(e) => e.stopPropagation()} style={controlBtn} aria-label="Zoom out">{'−'}</button>
        <button type="button" onClick={recenter} onPointerDown={(e) => e.stopPropagation()} style={controlBtn} aria-label="Fit all pins">{'⌖'}</button>
      </div>

      {/* Attribution (required by OSM tile usage policy) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          padding: '2px 6px',
          fontSize: 10,
          color: TEXT_SEC,
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderTopLeftRadius: 6,
          zIndex: 40,
        }}
      >
        {'© '}OpenStreetMap contributors
      </div>

      {tilesLoading && (
        <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 12, color: TEXT_SEC, backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8, zIndex: 40 }}>
          Loading tiles...
        </div>
      )}
    </div>
  );
}

export default function DiningMapPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchRestaurants({ limit: 500 }).then((data) => {
      if (!cancelled) {
        setRestaurants(data as Restaurant[]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const withCoords = restaurants.filter((r) => r.lat != null && r.lng != null);
  const withoutCoords = restaurants.filter((r) => r.lat == null || r.lng == null);

  const points = useMemo(
    () =>
      withCoords.map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat as number,
        lng: r.lng as number,
        color: r.is_visited ? ACCENT_VISITED : r.is_wishlist ? ACCENT_WISHLIST : '#52443A',
      })),
    [withCoords],
  );

  if (loading) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading map data...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 12 }}>
          <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
          <span style={{ opacity: 0.4 }}>&gt;</span>
          <span style={{ color: TEXT }}>Map</span>
        </nav>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>Restaurant Map</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: TEXT_SEC }}>
          {withCoords.length} of {restaurants.length} restaurants have locations
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT_SEC }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT_VISITED, display: 'inline-block' }} />
          Visited
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT_SEC }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ACCENT_WISHLIST, display: 'inline-block' }} />
          Wishlist
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: TEXT_SEC }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#52443A', display: 'inline-block' }} />
          Other
        </span>
      </div>

      {/* Map */}
      {points.length > 0 ? (
        <InteractiveMap points={points} />
      ) : (
        <div
          style={{
            padding: 48,
            borderRadius: 20,
            backgroundColor: GLASS,
            border: `1px solid ${BORDER}`,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 48, marginBottom: 8 }}>{'🗺️'}</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>No mapped restaurants yet</p>
          <p style={{ color: TEXT_SEC, marginTop: 8, lineHeight: 1.6 }}>
            Add an address when you save a restaurant and it will be geocoded and
            pinned here automatically.
          </p>
        </div>
      )}

      {/* Restaurants with locations */}
      {withCoords.length > 0 && (
        <section>
          <h2 style={sectionHeading}>
            Restaurants with Locations ({withCoords.length})
          </h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {withCoords.map((r) => {
              const dotColor = r.is_visited ? ACCENT_VISITED : r.is_wishlist ? ACCENT_WISHLIST : '#52443A';
              return (
                <Link
                  key={r.id}
                  href={`/dining/restaurant/${r.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    backgroundColor: SURFACE,
                    border: `1px solid ${BORDER}`,
                    textDecoration: 'none',
                    color: TEXT,
                  }}
                >
                  <span style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: dotColor,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
                      {[r.neighborhood, r.city].filter(Boolean).join(', ') || r.address || 'No address'}
                    </p>
                  </div>
                  {r.average_rating != null && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#FFB877' }}>
                      {'★'} {r.average_rating.toFixed(1)}
                    </span>
                  )}
                  {r.price_tier != null && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>
                      {PRICE_LABELS[r.price_tier]}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Restaurants without locations */}
      {withoutCoords.length > 0 && (
        <section>
          <h2 style={sectionHeading}>
            Without Locations ({withoutCoords.length})
          </h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {withoutCoords.slice(0, 10).map((r) => (
              <Link
                key={r.id}
                href={`/dining/restaurant/${r.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 14,
                  backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`,
                  textDecoration: 'none',
                  color: TEXT,
                }}
              >
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#35343A',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{r.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
                    {r.address || 'No address set'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const controlBtn: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  backgroundColor: SURFACE,
  color: TEXT,
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

const sectionHeading: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

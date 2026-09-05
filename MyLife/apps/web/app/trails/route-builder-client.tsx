'use client';

import { useMemo, useState, useTransition } from 'react';
import { addPlannedRoute, addRouteWaypoint } from './actions';
import { formatDistance, formatElevation, TEXT, TEXT_SEC, TEXT_TER, withAlpha, type BasicTrail } from './ui';
import { TrailsActionLink, TrailsChip, TrailsSymbol } from './shell';

type ExistingRoute = {
  id: string;
  name: string;
  distanceMeters: number;
  elevationGainMeters: number;
  estimatedMinutes: number | null;
  isLoop: boolean;
};

type RoutePoint = {
  x: number;
  y: number;
  label: string;
};

const INITIAL_POINTS: RoutePoint[] = [
  { x: 72, y: 188, label: 'TH' },
  { x: 192, y: 122, label: 'WP1' },
  { x: 348, y: 86, label: 'WP2' },
];

export function RouteBuilderClient({
  trails,
  existingRoutes,
}: {
  trails: BasicTrail[];
  existingRoutes: ExistingRoute[];
}) {
  const [points, setPoints] = useState<RoutePoint[]>(INITIAL_POINTS);
  const [loopRoute, setLoopRoute] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const totalDistanceMeters = useMemo(() => {
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += segmentLength(points[index - 1], points[index]) * 52;
    }
    if (loopRoute && points.length > 2) {
      total += segmentLength(points[points.length - 1], points[0]) * 52;
    }
    return Math.round(total);
  }, [loopRoute, points]);

  const totalElevationMeters = useMemo(
    () => Math.round(points.length * 140 + (loopRoute ? 180 : 60)),
    [loopRoute, points.length],
  );

  const estimatedMinutes = useMemo(
    () => Math.max(45, Math.round(totalDistanceMeters / 72)),
    [totalDistanceMeters],
  );

  const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
  const closingLine = loopRoute && points.length > 2
    ? `${points[points.length - 1]?.x},${points[points.length - 1]?.y} ${points[0]?.x},${points[0]?.y}`
    : null;

  const handleCanvasClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 420;
    const y = ((event.clientY - rect.top) / rect.height) * 240;

    setPoints((current) => [
      ...current,
      { x, y, label: `WP${current.length}` },
    ]);
  };

  const addTrailAnchor = (trail: BasicTrail) => {
    setPoints((current) => [
      ...current,
      {
        x: 48 + ((current.length * 62) % 300),
        y: 58 + ((current.length * 26) % 130),
        label: trail.name.slice(0, 3).toUpperCase(),
      },
    ]);
  };

  const removePoint = (label: string) => {
    setPoints((current) => current.filter((point) => point.label !== label));
  };

  const saveDraft = () => {
    startTransition(async () => {
      setStatus(null);

      try {
        const route = await addPlannedRoute({
          name: `Desktop Route ${new Date().toLocaleDateString()}`,
          distanceMeters: totalDistanceMeters,
          elevationGainMeters: totalElevationMeters,
          estimatedMinutes,
          isLoop: loopRoute,
          routeGeometry: JSON.stringify(points),
        });

        if (route) {
          await Promise.all(
            points.map((point, index) =>
              addRouteWaypoint({
                routeId: route.id,
                lat: 37 + point.y / 1000,
                lng: -122 + point.x / 1000,
                sortOrder: index,
                label: point.label,
              }),
            ),
          );
        }

        setStatus('Route saved to planned routes.');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not save route.');
      }
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gap: 14,
          padding: 18,
          borderRadius: 28,
          background: 'linear-gradient(180deg, rgba(43,43,48,0.78), rgba(19,19,24,0.98))',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ fontSize: 18, color: TEXT }}>Interactive route canvas</strong>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>
              Click anywhere on the map to add a waypoint, or use saved trails as anchors.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setLoopRoute((value) => !value)} style={toggleStyle(loopRoute)}>
              {loopRoute ? 'Loop route' : 'Point to point'}
            </button>
            <button type="button" onClick={() => setPoints(INITIAL_POINTS)} style={toggleStyle(false)}>
              Reset
            </button>
          </div>
        </div>

        <svg viewBox="0 0 420 240" style={canvasStyle} onClick={handleCanvasClick}>
          <defs>
            <pattern id="route-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="420" height="240" fill="url(#route-grid)" />
          <path
            d="M26 198 C92 128, 156 220, 228 124 S334 74, 392 116"
            fill="none"
            stroke="rgba(132,204,22,0.14)"
            strokeWidth="28"
            strokeLinecap="round"
          />
          {points.length > 1 ? (
            <polyline
              points={polyline}
              fill="none"
              stroke="#84CC16"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {closingLine ? (
            <polyline
              points={closingLine}
              fill="none"
              stroke="#65A30D"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          ) : null}
          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="8" fill="#84CC16" />
              <circle cx={point.x} cy={point.y} r="18" fill="rgba(132,204,22,0.12)" />
              <text x={point.x + 10} y={point.y - 10} fill="#D6C3B5" fontSize="11">
                {point.label}
              </text>
            </g>
          ))}
        </svg>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {trails.slice(0, 6).map((trail) => (
            <button key={trail.id} type="button" onClick={() => addTrailAnchor(trail)} style={anchorButtonStyle}>
              <TrailsSymbol name="add_location" size={18} color="#84CC16" />
              <span>{trail.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={summaryCardStyle}>
          <div style={{ display: 'grid', gap: 6 }}>
            <strong style={{ fontSize: 18, color: TEXT }}>Route stats</strong>
            <span style={{ color: TEXT_SEC, fontSize: 13 }}>Desktop draft updates as you place waypoints.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Metric label="Distance" value={formatDistance(totalDistanceMeters)} />
            <Metric label="Elevation" value={formatElevation(totalElevationMeters)} />
            <Metric label="Time" value={`${estimatedMinutes} min`} />
            <Metric label="Waypoints" value={String(points.length)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TrailsChip label={loopRoute ? 'Loop route' : 'Point to point'} active />
            <TrailsChip label={`${points.length} markers`} subtle />
          </div>
          <button type="button" onClick={saveDraft} disabled={isPending || points.length < 2} style={saveButtonStyle}>
            {isPending ? 'Saving…' : 'Save planned route'}
          </button>
          {status ? <span style={{ color: TEXT_SEC, fontSize: 13 }}>{status}</span> : null}
        </div>

        <div style={summaryCardStyle}>
          <strong style={{ fontSize: 16, color: TEXT }}>Waypoint list</strong>
          <div style={{ display: 'grid', gap: 8 }}>
            {points.map((point, index) => (
              <div key={point.label} style={waypointRowStyle}>
                <span style={{ color: TEXT, fontWeight: 700 }}>{point.label}</span>
                <span style={{ flex: 1, color: TEXT_SEC, fontSize: 13 }}>
                  Marker {index + 1} · {Math.round(point.x)}, {Math.round(point.y)}
                </span>
                <button type="button" onClick={() => removePoint(point.label)} style={removeButtonStyle}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={summaryCardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <strong style={{ fontSize: 16, color: TEXT }}>Saved planned routes</strong>
            <span style={{ color: TEXT_TER, fontSize: 12 }}>{existingRoutes.length} saved</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {existingRoutes.length > 0 ? (
              existingRoutes.slice(0, 4).map((route) => (
                <div key={route.id} style={waypointRowStyle}>
                  <span style={{ color: TEXT, fontWeight: 700 }}>{route.name}</span>
                  <span style={{ flex: 1, color: TEXT_SEC, fontSize: 13 }}>
                    {formatDistance(route.distanceMeters)} · {formatElevation(route.elevationGainMeters)}
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                No planned routes yet. Save the current draft to populate this list.
              </span>
            )}
          </div>
          <TrailsActionLink href="/trails/list" secondary symbol="terrain">
            Browse more anchors
          </TrailsActionLink>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>{label}</span>
      <strong style={{ color: TEXT, fontSize: 18 }}>{value}</strong>
    </div>
  );
}

function segmentLength(left: RoutePoint, right: RoutePoint) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const canvasStyle = {
  width: '100%',
  height: 280,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(12,17,12,0.96), rgba(19,19,24,0.88))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
  cursor: 'crosshair',
};

const summaryCardStyle = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(43,43,48,0.76), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const metricStyle = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const anchorButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 999,
  border: 'none',
  background: 'rgba(255,255,255,0.05)',
  color: TEXT_SEC,
  cursor: 'pointer',
};

const waypointRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const removeButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: TEXT_TER,
  cursor: 'pointer',
  fontSize: 12,
};

const saveButtonStyle = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #84CC16, #65A30D)',
  color: '#102108',
  cursor: 'pointer',
  fontWeight: 700,
  boxShadow: `0 18px 30px ${withAlpha('#84CC16', 0.22)}`,
};

const toggleStyle = (active: boolean) => ({
  border: 'none',
  borderRadius: 999,
  padding: '10px 14px',
  background: active ? 'linear-gradient(135deg, #84CC16, #65A30D)' : 'rgba(255,255,255,0.05)',
  color: active ? '#102108' : TEXT_SEC,
  cursor: 'pointer',
  fontWeight: 600,
});

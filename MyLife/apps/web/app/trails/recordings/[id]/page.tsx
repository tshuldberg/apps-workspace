'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchRecording, fetchWaypoints, fetchEstimatedCalories } from '../../actions';
import {
  ACCENT, TEXT_SEC, TEXT_TER, SURFACE, BORDER,
  activityIcon, formatDistance, formatElevation, formatDurationDisplay, formatPace,
} from '../../ui';

interface Recording {
  id: string; name: string; activityType: string; trailId: string | null;
  distanceMeters: number; elevationGainMeters: number; durationSeconds: number;
  startedAt: string; endedAt: string | null;
}
interface Waypoint {
  lat: number; lng: number; elevation: number | null; timestamp: string;
}

export default function RecordingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [recording, setRecording] = useState<Recording | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [calories, setCalories] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecording(id)
      .then(async (rec) => {
        if (cancelled) return;
        if (!rec) { setError('Recording not found'); setLoading(false); return; }
        setRecording(rec as Recording);
        const [wps, cal] = await Promise.all([
          fetchWaypoints(id),
          fetchEstimatedCalories(
            (rec as Recording).distanceMeters,
            (rec as Recording).elevationGainMeters,
          ),
        ]);
        if (!cancelled) {
          setWaypoints(wps as Waypoint[]);
          setCalories(cal);
        }
      })
      .catch(() => { if (!cancelled) setError('Failed to load recording'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const paceKm = useMemo(() => {
    if (!recording || recording.distanceMeters === 0) return null;
    return (recording.durationSeconds / 60) / (recording.distanceMeters / 1000);
  }, [recording]);

  const elevationPoints = useMemo(() => {
    return waypoints
      .filter((wp) => wp.elevation !== null)
      .map((wp, i) => ({ x: i, y: wp.elevation as number }));
  }, [waypoints]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ height: 60, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ height: 70, borderRadius: 12, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        </div>
        <div style={{ height: 200, borderRadius: 16, backgroundColor: SURFACE, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>{error ?? 'Recording not found'}</p>
        <Link href="/trails/recordings" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to recordings</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/trails/recordings" style={{ color: TEXT_SEC, fontSize: 13, textDecoration: 'none' }}>&larr; Back to recordings</Link>

      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{activityIcon(recording.activityType)}</span>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{recording.name}</h1>
        </div>
        <p style={{ margin: '6px 0 0', color: TEXT_SEC, fontSize: 14 }}>
          {new Date(recording.startedAt).toLocaleDateString()} · {recording.activityType}
          {recording.trailId && <> · <Link href={`/trails/${recording.trailId}`} style={{ color: ACCENT, textDecoration: 'none' }}>View trail</Link></>}
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        <MetricCard label="Distance" value={formatDistance(recording.distanceMeters)} />
        <MetricCard label="Elevation" value={formatElevation(recording.elevationGainMeters)} />
        <MetricCard label="Duration" value={formatDurationDisplay(recording.durationSeconds)} />
        <MetricCard label="Pace" value={formatPace(paceKm)} />
        {calories !== null && <MetricCard label="Calories" value={`${Math.round(calories)} kcal`} />}
      </div>

      {/* Elevation Profile */}
      {elevationPoints.length > 2 && (
        <section>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: TEXT_TER }}>
            Elevation Profile
          </p>
          <ElevationChart points={elevationPoints} />
        </section>
      )}

      {/* Waypoints count */}
      <section>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' as const, color: TEXT_TER }}>
          Waypoints ({waypoints.length} points)
        </p>
        {waypoints.length > 0 && (
          <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: TEXT_TER, backgroundColor: SURFACE, borderBottom: `1px solid ${BORDER}`, position: 'sticky', top: 0 }}>
              <span style={{ width: 40 }}>#</span>
              <span style={{ flex: 1 }}>Lat</span>
              <span style={{ flex: 1 }}>Lng</span>
              <span style={{ flex: 1 }}>Elev</span>
              <span style={{ flex: 1 }}>Time</span>
            </div>
            {waypoints.slice(0, 100).map((wp, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 12px', fontSize: 12, color: TEXT_SEC, borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ width: 40, color: TEXT_TER }}>{i + 1}</span>
                <span style={{ flex: 1 }}>{wp.lat.toFixed(5)}</span>
                <span style={{ flex: 1 }}>{wp.lng.toFixed(5)}</span>
                <span style={{ flex: 1 }}>{wp.elevation !== null ? `${Math.round(wp.elevation)}m` : '--'}</span>
                <span style={{ flex: 1 }}>{new Date(wp.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
            {waypoints.length > 100 && (
              <p style={{ padding: 8, textAlign: 'center', fontSize: 12, color: TEXT_TER }}>
                Showing 100 of {waypoints.length} waypoints
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: ACCENT }}>{value}</p>
    </div>
  );
}

function ElevationChart({ points }: { points: { x: number; y: number }[] }) {
  if (points.length < 2) return null;
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const rangeY = maxY - minY || 1;
  const w = 800;
  const h = 200;
  const padX = 0;
  const padY = 10;

  const pathPoints = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (w - 2 * padX);
    const y = h - padY - ((p.y - minY) / rangeY) * (h - 2 * padY);
    return `${x},${y}`;
  });

  const linePath = `M${pathPoints.join(' L')}`;
  const areaPath = `${linePath} L${w - padX},${h} L${padX},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
      <defs>
        <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.3" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#elevGrad)" />
      <path d={linePath} fill="none" stroke={ACCENT} strokeWidth="2" />
      <text x={10} y={20} fill={TEXT_TER} fontSize="11">{Math.round(maxY)}m</text>
      <text x={10} y={h - 8} fill={TEXT_TER} fontSize="11">{Math.round(minY)}m</text>
    </svg>
  );
}

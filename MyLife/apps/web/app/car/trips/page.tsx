'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Vehicle, Trip, TripPurpose } from '@mylife/car';
import { getTripSummaryByPurpose, estimateIrsDeduction } from '@mylife/car';
import { fetchVehicles, fetchTrips, doCreateTrip, doDeleteTrip } from '../actions';

const ACCENT = 'var(--accent-car)';

const PURPOSE_LABELS: Record<TripPurpose, string> = {
  personal: 'Personal', business: 'Business', medical: 'Medical',
  charity: 'Charity', moving: 'Moving', commute: 'Commute',
};

const PURPOSE_ICONS: Record<TripPurpose, string> = {
  personal: '\uD83C\uDFE0', business: '\uD83D\uDCBC', medical: '\uD83C\uDFE5',
  charity: '\u2764\uFE0F', moving: '\uD83D\uDCE6', commute: '\uD83D\uDE8C',
};

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function TripsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [purpose, setPurpose] = useState<TripPurpose>('personal');
  const [routeName, setRouteName] = useState('');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const vehicleId = selectedVehicleId ?? vehicles[0]?.id ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const v = await fetchVehicles();
      setVehicles(v as Vehicle[]);
      const vid = selectedVehicleId ?? v[0]?.id;
      if (vid) setTrips(await fetchTrips(vid) as Trip[]);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const summary = getTripSummaryByPurpose(trips);
  const businessMiles = summary.business?.totalMiles ?? 0;
  const irsDeduction = estimateIrsDeduction(businessMiles);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicleId) return;
    const s = parseInt(startOdo, 10);
    const end = parseInt(endOdo, 10);
    if (isNaN(s) || isNaN(end) || end <= s) return;
    try {
      await doCreateTrip(generateId(), {
        vehicleId, purpose,
        routeName: routeName.trim() || undefined,
        startOdometer: s, endOdometer: end,
        startedAt: new Date().toISOString(),
      });
      setStartOdo(''); setEndOdo(''); setRouteName('');
      await loadData();
    } catch (err) {
      console.error('Failed to add trip:', err);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await doDeleteTrip(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete trip:', err);
    }
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2';
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };
  const cardStyle: React.CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--glass)' };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Trips</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p className="text-4xl mb-3">{'\uD83D\uDCCD'}</p>
          <p className="font-medium">Ready to hit the road</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Add a vehicle in the Garage to start logging trips
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Trips</h1>

      {/* Vehicle selector */}
      {vehicles.length > 1 && (
        <div className="flex gap-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicleId(v.id)}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: vehicleId === v.id ? ACCENT : 'var(--surface-elevated)',
                color: vehicleId === v.id ? 'var(--background)' : 'var(--text-secondary)',
              }}
            >
              {v.name || `${v.year} ${v.make}`}
            </button>
          ))}
        </div>
      )}

      {/* IRS deduction card */}
      {businessMiles > 0 && (
        <div className="rounded-xl border p-4" style={cardStyle}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>IRS Deduction Estimate</p>
          <p className="text-3xl font-bold mt-1" style={{ color: 'var(--success)' }}>${(irsDeduction / 100).toFixed(2)}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{businessMiles.toLocaleString()} business miles</p>
        </div>
      )}

      {/* Log trip form */}
      <form onSubmit={handleAdd} className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Log Trip</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium border"
              style={{
                borderColor: purpose === p ? ACCENT : 'var(--border)',
                backgroundColor: purpose === p ? 'var(--surface-elevated)' : 'var(--surface)',
                color: purpose === p ? ACCENT : 'var(--text-secondary)',
              }}
            >
              <span>{PURPOSE_ICONS[p]}</span> {PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>
        <input className={inputCls} style={inputStyle} placeholder="Route name (optional)" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} style={inputStyle} placeholder="Start odometer" type="number" value={startOdo} onChange={(e) => setStartOdo(e.target.value)} required />
          <input className={inputCls} style={inputStyle} placeholder="End odometer" type="number" value={endOdo} onChange={(e) => setEndOdo(e.target.value)} required />
        </div>
        <button type="submit" className="rounded-lg px-5 py-2.5 font-semibold text-white w-full" style={{ backgroundColor: ACCENT }}>Log Trip</button>
      </form>

      {/* Purpose summary */}
      {Object.entries(summary).filter(([, s]) => s.count > 0).map(([p, s]) => (
        <div key={p} className="rounded-xl border p-3 flex items-center gap-3" style={cardStyle}>
          <span className="text-xl">{PURPOSE_ICONS[p as TripPurpose]}</span>
          <span className="font-medium flex-1">{PURPOSE_LABELS[p as TripPurpose]}</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.count} trips · {s.totalMiles.toLocaleString()} mi</span>
        </div>
      ))}

      {/* Trip list */}
      {trips.length === 0 && vehicleId && (
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p style={{ color: 'var(--text-secondary)' }}>No trips logged yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Use the form above to log your first trip</p>
        </div>
      )}

      {trips.map((t) => (
        <div key={t.id} className="rounded-xl border p-3 flex items-center gap-3" style={cardStyle}>
          <span className="font-medium flex-1">{t.routeName || PURPOSE_LABELS[t.purpose]}</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.distance.toLocaleString()} mi</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.startedAt.slice(0, 10)}</span>
          <span className="text-xs rounded-md px-2 py-0.5" style={{ color: ACCENT }}>{PURPOSE_LABELS[t.purpose]}</span>
          <button
            onClick={() => handleDelete(t.id)}
            className="rounded-lg px-2 py-1 text-xs font-medium"
            style={{ backgroundColor: confirmDeleteId === t.id ? 'var(--danger)' : 'rgba(255,69,58,0.15)', color: confirmDeleteId === t.id ? '#fff' : 'var(--danger)' }}
          >
            {confirmDeleteId === t.id ? 'Confirm' : 'Delete'}
          </button>
        </div>
      ))}
    </div>
  );
}

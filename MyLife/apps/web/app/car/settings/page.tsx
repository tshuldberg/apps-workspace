'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Vehicle } from '@mylife/car';
import {
  fetchVehicles,
  fetchVehicleCount,
  fetchMaintenance,
  fetchFuelLogs,
} from '../actions';

const ACCENT = 'var(--accent-car)';

export default function SettingsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [totalMaintenance, setTotalMaintenance] = useState(0);
  const [totalFuelLogs, setTotalFuelLogs] = useState(0);
  const [loading, setLoading] = useState(true);

  const [odometerUnit, setOdometerUnit] = useState<'miles' | 'km'>('miles');
  const [fuelUnit, setFuelUnit] = useState<'gallons' | 'liters'>('gallons');
  const [currency, setCurrency] = useState('USD');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vs, count] = await Promise.all([fetchVehicles(), fetchVehicleCount()]);
      setVehicles(vs as Vehicle[]);
      setVehicleCount(count as number);

      let mTotal = 0;
      let fTotal = 0;
      for (const v of vs) {
        const [m, f] = await Promise.all([fetchMaintenance(v.id), fetchFuelLogs(v.id)]);
        mTotal += (m as unknown[]).length;
        fTotal += (f as unknown[]).length;
      }
      setTotalMaintenance(mTotal);
      setTotalFuelLogs(fTotal);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cardStyle: React.CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--glass)' };
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Units, preferences, and data overview
        </p>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border p-4 space-y-4" style={cardStyle}>
        <h2 className="text-lg font-semibold">Preferences</h2>

        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Odometer unit</p>
          <div className="flex gap-2">
            {(['miles', 'km'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setOdometerUnit(u)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: odometerUnit === u ? ACCENT : 'var(--surface-elevated)',
                  color: odometerUnit === u ? 'var(--background)' : 'var(--text-secondary)',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Fuel unit</p>
          <div className="flex gap-2">
            {(['gallons', 'liters'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setFuelUnit(u)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: fuelUnit === u ? ACCENT : 'var(--surface-elevated)',
                  color: fuelUnit === u ? 'var(--background)' : 'var(--text-secondary)',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Currency</p>
          <input
            className="rounded-lg border px-3 py-2"
            style={inputStyle}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="USD"
          />
        </div>
      </div>

      {/* Data overview */}
      <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Data Overview</h2>
        {[
          { label: 'Vehicles', value: vehicleCount },
          { label: 'Maintenance records', value: totalMaintenance },
          { label: 'Fuel logs', value: totalFuelLogs },
        ].map((item) => (
          <div key={item.label} className="flex justify-between items-center">
            <p style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
            <p className="font-semibold" style={{ color: ACCENT }}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

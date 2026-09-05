'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Vehicle, FuelLog, Maintenance } from '@mylife/car';
import {
  fetchVehicles,
  fetchFuelLogs,
  fetchMaintenance,
  doCreateFuelLog,
  doDeleteFuelLog,
} from '../actions';

const ACCENT = 'var(--accent-car)';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const inputCls = 'w-full rounded-lg border px-3 py-2';
const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };
const cardStyle: React.CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--glass)' };

export default function ExpensesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);

  const [fuelGallons, setFuelGallons] = useState('10');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const vehicleId = selectedVehicleId ?? vehicles[0]?.id ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const vs = await fetchVehicles();
      setVehicles(vs as Vehicle[]);
      const vid = selectedVehicleId ?? vs[0]?.id;
      if (vid) {
        const [f, m] = await Promise.all([fetchFuelLogs(vid), fetchMaintenance(vid)]);
        setFuelLogs(f as FuelLog[]);
        setMaintenance(m as Maintenance[]);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const totalFuelCents = useMemo(() => fuelLogs.reduce((s, l) => s + l.costCents, 0), [fuelLogs]);
  const totalMaintCents = useMemo(() => maintenance.reduce((s, m) => s + (m.costCents ?? 0), 0), [maintenance]);

  async function handleAddFuel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicleId) return;
    try {
      await doCreateFuelLog(generateId(), vehicleId, {
        gallons: Math.max(0, Number(fuelGallons) || 0),
        costCents: Math.max(0, Math.round((Number(fuelCost) || 0) * 100)),
        odometerAt: Math.max(0, Number(fuelOdometer) || 0),
        loggedAt: new Date().toISOString(),
        isFullTank: true,
      });
      setFuelCost('');
      await loadData();
    } catch (err) {
      console.error('Failed to add fuel log:', err);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await doDeleteFuelLog(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete fuel log:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p className="text-4xl mb-3">{'\uD83D\uDCB0'}</p>
          <p className="font-medium">Track every dollar</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Add a vehicle in the Garage to start logging expenses
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expenses</h1>

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
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Cost summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Fuel Total', value: formatCurrency(totalFuelCents) },
          { label: 'Maint. Total', value: formatCurrency(totalMaintCents) },
          { label: 'Combined', value: formatCurrency(totalFuelCents + totalMaintCents) },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border p-3" style={cardStyle}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
            <p className="text-lg font-bold mt-1" style={{ color: ACCENT }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Add fuel log */}
      <form onSubmit={handleAddFuel} className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Add Fuel Log</h2>
        <div className="grid grid-cols-3 gap-3">
          <input className={inputCls} style={inputStyle} placeholder="Gallons" type="number" step="0.1" value={fuelGallons} onChange={(e) => setFuelGallons(e.target.value)} />
          <input className={inputCls} style={inputStyle} placeholder="Cost ($)" type="number" step="0.01" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
          <input className={inputCls} style={inputStyle} placeholder="Odometer" type="number" value={fuelOdometer} onChange={(e) => setFuelOdometer(e.target.value)} />
        </div>
        <button type="submit" className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ backgroundColor: ACCENT }}>Add Fuel Log</button>
      </form>

      {/* Fuel log list */}
      <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Fuel Logs</h2>
        {fuelLogs.length === 0 ? (
          <div className="py-4 text-center">
            <p style={{ color: 'var(--text-secondary)' }}>No fuel logs yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Log a fill-up to start tracking fuel costs</p>
          </div>
        ) : (
          fuelLogs.map((f) => (
            <div key={f.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{f.gallons.toFixed(1)} gal</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(f.loggedAt).toLocaleDateString()} · {formatCurrency(f.costCents)} · {f.odometerAt.toLocaleString()} mi
                </p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: confirmDeleteId === f.id ? 'var(--danger)' : 'rgba(255,69,58,0.15)', color: confirmDeleteId === f.id ? '#fff' : 'var(--danger)' }}
              >
                {confirmDeleteId === f.id ? 'Confirm' : 'Delete'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

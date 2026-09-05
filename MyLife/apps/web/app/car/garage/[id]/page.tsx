'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Vehicle, Maintenance, FuelLog } from '@mylife/car';
import {
  fetchVehicleById,
  fetchMaintenance,
  fetchFuelLogs,
  doCreateMaintenance,
  doDeleteMaintenance,
  doCreateFuelLog,
  doDeleteFuelLog,
} from '../../actions';

const ACCENT = 'var(--accent-car)';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatCurrency(cents: number | null | undefined): string {
  return `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;
}

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const vehicleId = params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceType, setServiceType] = useState('oil_change');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdometer, setServiceOdometer] = useState('');

  const [fuelGallons, setFuelGallons] = useState('10');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const [v, m, f] = await Promise.all([
        fetchVehicleById(vehicleId),
        fetchMaintenance(vehicleId),
        fetchFuelLogs(vehicleId),
      ]);
      setVehicle(v as Vehicle | null);
      setMaintenance(m as Maintenance[]);
      setFuelLogs(f as FuelLog[]);
    } catch (err) {
      console.error('Failed to load vehicle details:', err);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => { void load(); }, [load]);

  async function handleAddService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehicleId) return;
    try {
      await doCreateMaintenance(generateId(), vehicleId, {
        type: serviceType.trim() || 'oil_change',
        performedAt: new Date().toISOString(),
        costCents: Math.max(0, Math.round((Number(serviceCost) || 0) * 100)),
        odometerAt: Math.max(0, Number(serviceOdometer) || 0),
      });
      setServiceCost('');
      setServiceOdometer('');
      await load();
    } catch (err) {
      console.error('Failed to add service:', err);
    }
  }

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
      setFuelOdometer('');
      await load();
    } catch (err) {
      console.error('Failed to add fuel log:', err);
    }
  }

  async function handleDeleteItem(id: string, type: 'service' | 'fuel') {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      if (type === 'service') await doDeleteMaintenance(id);
      else await doDeleteFuelLog(id);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2';
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };
  const cardStyle: React.CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--glass)' };

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/car/garage" className="text-sm font-medium" style={{ color: ACCENT }}>&larr; Back to Garage</Link>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <Link href="/car/garage" className="text-sm font-medium" style={{ color: ACCENT }}>&larr; Back to Garage</Link>
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p style={{ color: 'var(--text-secondary)' }}>Vehicle not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/car/garage" className="text-sm font-medium no-underline" style={{ color: ACCENT }}>&larr; Back to Garage</Link>

      {/* Vehicle header */}
      <div className="rounded-xl border p-4" style={cardStyle}>
        <h1 className="text-2xl font-semibold">{vehicle.name}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {vehicle.odometer.toLocaleString()} mi
        </p>
      </div>

      {/* Service log form */}
      <form onSubmit={handleAddService} className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Add Service Log</h2>
        <select className={inputCls} style={inputStyle} value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
          <option value="oil_change">Oil Change</option>
          <option value="tire_rotation">Tire Rotation</option>
          <option value="brake_service">Brake Service</option>
          <option value="inspection">Inspection</option>
          <option value="air_filter">Air Filter</option>
          <option value="coolant">Coolant</option>
          <option value="battery">Battery</option>
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} style={inputStyle} placeholder="Cost ($)" type="number" step="0.01" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} />
          <input className={inputCls} style={inputStyle} placeholder="Odometer" type="number" value={serviceOdometer} onChange={(e) => setServiceOdometer(e.target.value)} />
        </div>
        <button type="submit" className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ backgroundColor: ACCENT }}>Add Service</button>
      </form>

      {/* Service log list */}
      <div className="rounded-xl border p-4 space-y-3" style={cardStyle}>
        <h2 className="text-lg font-semibold">Service History</h2>
        {maintenance.length === 0 ? (
          <div className="py-4 text-center">
            <p style={{ color: 'var(--text-secondary)' }}>No service logs yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add your first service record above</p>
          </div>
        ) : (
          maintenance.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{m.type}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(m.performedAt).toLocaleDateString()} · {formatCurrency(m.costCents)}
                  {m.odometerAt ? ` · ${m.odometerAt.toLocaleString()} mi` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDeleteItem(m.id, 'service')}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: confirmDeleteId === m.id ? 'var(--danger)' : 'rgba(255,69,58,0.15)', color: confirmDeleteId === m.id ? '#fff' : 'var(--danger)' }}
              >
                {confirmDeleteId === m.id ? 'Confirm' : 'Delete'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Fuel log form */}
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
        <h2 className="text-lg font-semibold">Fuel History</h2>
        {fuelLogs.length === 0 ? (
          <div className="py-4 text-center">
            <p style={{ color: 'var(--text-secondary)' }}>No fuel logs yet</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Log a fill-up to track fuel costs</p>
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
                onClick={() => handleDeleteItem(f.id, 'fuel')}
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

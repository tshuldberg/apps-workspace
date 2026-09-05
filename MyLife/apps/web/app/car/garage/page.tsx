'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Vehicle } from '@mylife/car';
import {
  fetchVehicles,
  fetchVehicleCount,
  doCreateVehicle,
  doUpdateVehicle,
  doDeleteVehicle,
} from '../actions';

const ACCENT = 'var(--accent-car)';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface VehicleFormState {
  nickname: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
}

const emptyForm: VehicleFormState = { nickname: '', make: '', model: '', year: '', odometer: '0' };

export default function GaragePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VehicleFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vs, count] = await Promise.all([fetchVehicles(), fetchVehicleCount()]);
      setVehicles(vs as Vehicle[]);
      setVehicleCount(count as number);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.make.trim() || !form.model.trim()) return;
    try {
      await doCreateVehicle(generateId(), {
        name: form.nickname.trim() || `${form.make.trim()} ${form.model.trim()}`,
        make: form.make.trim(),
        model: form.model.trim(),
        year: Math.max(1900, Number(form.year) || new Date().getFullYear()),
        odometer: Math.max(0, Number(form.odometer) || 0),
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      console.error('Failed to create vehicle:', err);
    }
  }

  function startEdit(v: Vehicle) {
    setEditingId(v.id);
    setEditForm({
      nickname: v.name,
      make: v.make,
      model: v.model,
      year: String(v.year),
      odometer: String(v.odometer),
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    try {
      await doUpdateVehicle(editingId, {
        name: editForm.nickname.trim() || `${editForm.make.trim()} ${editForm.model.trim()}`,
        make: editForm.make.trim(),
        model: editForm.model.trim(),
        year: Math.max(1900, Number(editForm.year) || new Date().getFullYear()),
        odometer: Math.max(0, Number(editForm.odometer) || 0),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      console.error('Failed to update vehicle:', err);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    try {
      await doDeleteVehicle(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Garage</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2';
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Garage</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Add vehicle form */}
      <form onSubmit={handleCreate} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}>
        <h2 className="text-lg font-semibold">Add Vehicle</h2>
        <input className={inputCls} style={inputStyle} placeholder="Nickname (optional)" value={form.nickname} onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} style={inputStyle} placeholder="Make *" value={form.make} onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))} required />
          <input className={inputCls} style={inputStyle} placeholder="Model *" value={form.model} onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={inputCls} style={inputStyle} placeholder="Year" type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} />
          <input className={inputCls} style={inputStyle} placeholder="Odometer" type="number" value={form.odometer} onChange={(e) => setForm((p) => ({ ...p, odometer: e.target.value }))} />
        </div>
        <button type="submit" className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ backgroundColor: ACCENT }}>
          Save Vehicle
        </button>
      </form>

      {/* Vehicle list */}
      {vehicles.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}>
          <p className="text-4xl mb-3">{'\uD83D\uDE97'}</p>
          <p className="font-medium">Your garage awaits</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Add your first vehicle above to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {v.year} {v.make} {v.model} · {v.odometer.toLocaleString()} mi
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/car/garage/${v.id}`}
                    className="rounded-lg px-3 py-2 text-sm font-medium no-underline"
                    style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text)' }}
                  >
                    Details
                  </Link>
                  <button
                    onClick={() => startEdit(v)}
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(v.id)}
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{ backgroundColor: confirmDelete === v.id ? 'var(--danger)' : 'rgba(255,69,58,0.15)', color: confirmDelete === v.id ? '#fff' : 'var(--danger)' }}
                  >
                    {confirmDelete === v.id ? 'Confirm' : 'Delete'}
                  </button>
                </div>
              </div>

              {editingId === v.id && (
                <form onSubmit={handleUpdate} className="mt-4 rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                  <h3 className="font-semibold">Edit Vehicle</h3>
                  <input className={inputCls} style={inputStyle} placeholder="Nickname" value={editForm.nickname} onChange={(e) => setEditForm((p) => ({ ...p, nickname: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} style={inputStyle} placeholder="Make" value={editForm.make} onChange={(e) => setEditForm((p) => ({ ...p, make: e.target.value }))} />
                    <input className={inputCls} style={inputStyle} placeholder="Model" value={editForm.model} onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input className={inputCls} style={inputStyle} placeholder="Year" type="number" value={editForm.year} onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))} />
                    <input className={inputCls} style={inputStyle} placeholder="Odometer" type="number" value={editForm.odometer} onChange={(e) => setEditForm((p) => ({ ...p, odometer: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ backgroundColor: ACCENT }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg px-5 py-2.5 font-medium" style={{ backgroundColor: 'var(--surface-elevated)', color: 'var(--text)' }}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

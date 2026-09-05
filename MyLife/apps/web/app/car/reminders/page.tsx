'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Vehicle, MaintenanceSchedule, ScheduleStatus, ScheduleServiceType } from '@mylife/car';
import {
  calculateScheduleStatus,
  serviceTypeLabel,
} from '@mylife/car';
import {
  fetchVehicles,
  fetchActiveSchedules,
  doCreateSchedule,
  doUpdateSchedule,
  doDeactivateSchedule,
  doSetupDefaultSchedules,
} from '../actions';

const ACCENT = 'var(--accent-car)';

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  overdue: 'var(--danger)',
  due_soon: 'var(--warning)',
  ok: 'var(--success)',
  unknown: 'var(--text-tertiary)',
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  ok: 'OK',
  unknown: 'Unknown',
};

function formatDueInfo(
  schedule: MaintenanceSchedule,
  status: ScheduleStatus,
  currentOdometer: number,
): string {
  const parts: string[] = [];
  if (schedule.nextDueOdometer !== null) {
    const diff = schedule.nextDueOdometer - currentOdometer;
    if (diff > 0) {
      parts.push(`${diff.toLocaleString()} mi remaining`);
    } else {
      parts.push(`${Math.abs(diff).toLocaleString()} mi overdue`);
    }
  }
  if (schedule.nextDueDate) {
    parts.push(`by ${schedule.nextDueDate}`);
  }
  if (parts.length === 0 && status === 'unknown') {
    return 'Set last service date/odometer for accurate reminders';
  }
  return parts.join(' or ');
}

export default function RemindersPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'all' | 'by_vehicle'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form
  const [addVehicleId, setAddVehicleId] = useState('');
  const [addServiceType, setAddServiceType] = useState<ScheduleServiceType>('oil_change');
  const [addCustomName, setAddCustomName] = useState('');
  const [addMiles, setAddMiles] = useState('');
  const [addMonths, setAddMonths] = useState('');
  const [addLastOdometer, setAddLastOdometer] = useState('');
  const [addLastDate, setAddLastDate] = useState('');
  const [addError, setAddError] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vs, ss] = await Promise.all([fetchVehicles(), fetchActiveSchedules()]);
      setVehicles(vs as Vehicle[]);
      setSchedules(ss as MaintenanceSchedule[]);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  const enriched = schedules.map((s) => {
    const vehicle = vehicleMap.get(s.vehicleId);
    const currentOdometer = vehicle?.odometer ?? 0;
    return {
      ...s,
      status: calculateScheduleStatus(s, currentOdometer, today) as ScheduleStatus,
      vehicleName: vehicle?.name ?? 'Unknown',
      currentOdometer,
    };
  }).sort((a, b) => {
    const priority: Record<ScheduleStatus, number> = { overdue: 3, due_soon: 2, ok: 1, unknown: 0 };
    const pDiff = priority[b.status] - priority[a.status];
    if (pDiff !== 0) return pDiff;
    return a.serviceType.localeCompare(b.serviceType);
  });

  const selected = selectedId ? enriched.find((s) => s.id === selectedId) : null;

  async function handleSetupDefaults(vehicleId: string) {
    try {
      await doSetupDefaultSchedules(vehicleId);
      await load();
    } catch (err) {
      console.error('Failed to set up defaults:', err);
    }
  }

  async function handleSnooze(schedule: MaintenanceSchedule) {
    try {
      const newSnoozeMiles = schedule.snoozeMiles + (schedule.intervalMiles !== null ? 500 : 0);
      const newSnoozeDays = schedule.snoozeDateOffsetDays + (schedule.intervalMonths !== null ? 30 : 0);
      await doUpdateSchedule(schedule.id, {
        snoozeMiles: newSnoozeMiles,
        snoozeDateOffsetDays: newSnoozeDays,
        snoozeCount: schedule.snoozeCount + 1,
      });
      await load();
    } catch (err) {
      console.error('Failed to snooze:', err);
    }
  }

  async function handleDismiss(id: string) {
    try {
      await doDeactivateSchedule(id);
      setSelectedId(null);
      await load();
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  }

  async function handleAddSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const miles = addMiles ? parseInt(addMiles, 10) : undefined;
    const months = addMonths ? parseInt(addMonths, 10) : undefined;
    if (!miles && !months) { setAddError('Set a mileage or time interval'); return; }
    try {
      await doCreateSchedule({
        vehicleId: addVehicleId,
        serviceType: addServiceType,
        serviceTypeCustom: addServiceType === 'custom' ? addCustomName : undefined,
        intervalMiles: miles,
        intervalMonths: months,
        lastServiceOdometer: addLastOdometer ? parseInt(addLastOdometer, 10) : undefined,
        lastServiceDate: addLastDate || undefined,
      });
      setShowAddForm(false);
      setAddError('');
      await load();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Invalid input');
    }
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2';
  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--surface-elevated)', borderColor: 'var(--border)', color: 'var(--text)' };
  const cardStyle: React.CSSProperties = { borderColor: 'var(--border)', backgroundColor: 'var(--glass)' };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
        ))}
      </div>
    );
  }

  // Detail panel
  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm font-medium"
          style={{ color: ACCENT }}
        >
          &larr; Back to Reminders
        </button>

        <h1 className="text-2xl font-semibold" style={{ color: ACCENT }}>
          {serviceTypeLabel(selected.serviceType, selected.serviceTypeCustom)}
        </h1>

        <div
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2"
          style={{ color: STATUS_COLORS[selected.status] }}
        >
          <span className="text-lg font-bold">
            {STATUS_LABEL[selected.status]}
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)' }}>
          {formatDueInfo(selected, selected.status, selected.currentOdometer)}
        </p>

        <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
          <h3 className="font-semibold">Schedule Details</h3>
          {selected.intervalMiles && (
            <p style={{ color: 'var(--text-secondary)' }}>Every {selected.intervalMiles.toLocaleString()} miles</p>
          )}
          {selected.intervalMonths && (
            <p style={{ color: 'var(--text-secondary)' }}>Every {selected.intervalMonths} months</p>
          )}
          <p style={{ color: 'var(--text-secondary)' }}>Vehicle: {selected.vehicleName}</p>
        </div>

        {(selected.lastServiceDate || selected.lastServiceOdometer !== null) && (
          <div className="rounded-xl border p-4 space-y-2" style={cardStyle}>
            <h3 className="font-semibold">Last Service</h3>
            {selected.lastServiceDate && <p style={{ color: 'var(--text-secondary)' }}>Date: {selected.lastServiceDate}</p>}
            {selected.lastServiceOdometer !== null && <p style={{ color: 'var(--text-secondary)' }}>Odometer: {selected.lastServiceOdometer.toLocaleString()} mi</p>}
          </div>
        )}

        {selected.snoozeCount > 0 && (
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
            Snoozed {selected.snoozeCount} time{selected.snoozeCount !== 1 ? 's' : ''}
            {selected.snoozeCount >= 3 ? ' -- consider scheduling this service soon' : ''}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleSnooze(selected)}
            className="rounded-lg px-6 py-3 font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Snooze {selected.intervalMiles !== null ? '500 mi' : ''}{selected.intervalMiles !== null && selected.intervalMonths !== null ? ' / ' : ''}{selected.intervalMonths !== null ? '1 month' : ''}
          </button>
          <button
            onClick={() => handleDismiss(selected.id)}
            className="rounded-lg px-6 py-3 font-semibold text-white"
            style={{ backgroundColor: 'var(--danger)' }}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Add form
  if (showAddForm) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => { setShowAddForm(false); setAddError(''); }}
          className="text-sm font-medium"
          style={{ color: ACCENT }}
        >
          &larr; Back to Reminders
        </button>

        <h1 className="text-2xl font-semibold" style={{ color: ACCENT }}>Add Reminder</h1>

        <form onSubmit={handleAddSchedule} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle</label>
            <select
              value={addVehicleId}
              onChange={(e) => setAddVehicleId(e.target.value)}
              className={inputCls}
              style={inputStyle}
              required
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Service Type</label>
            <select
              value={addServiceType}
              onChange={(e) => setAddServiceType(e.target.value as ScheduleServiceType)}
              className={inputCls}
              style={inputStyle}
            >
              {(['oil_change', 'tire_rotation', 'brake_inspection', 'air_filter', 'transmission_fluid', 'coolant', 'spark_plugs', 'battery', 'inspection', 'registration', 'custom'] as ScheduleServiceType[]).map((st) => (
                <option key={st} value={st}>{serviceTypeLabel(st)}</option>
              ))}
            </select>
            {addServiceType === 'custom' && (
              <input
                value={addCustomName}
                onChange={(e) => setAddCustomName(e.target.value)}
                placeholder="Custom service name"
                className={`mt-2 ${inputCls}`}
                style={inputStyle}
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Mileage Interval</label>
              <input
                value={addMiles}
                onChange={(e) => setAddMiles(e.target.value)}
                placeholder="5000"
                type="number"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Month Interval</label>
              <input
                value={addMonths}
                onChange={(e) => setAddMonths(e.target.value)}
                placeholder="6"
                type="number"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Last Service Odometer</label>
              <input
                value={addLastOdometer}
                onChange={(e) => setAddLastOdometer(e.target.value)}
                placeholder="20000"
                type="number"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Last Service Date</label>
              <input
                value={addLastDate}
                onChange={(e) => setAddLastDate(e.target.value)}
                type="date"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {addError && <p style={{ color: 'var(--danger)' }} className="text-sm">{addError}</p>}

          <button
            type="submit"
            className="rounded-lg px-6 py-3 font-semibold text-white"
            style={{ backgroundColor: ACCENT }}
          >
            Save Reminder
          </button>
        </form>
      </div>
    );
  }

  // Main list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminders</h1>
        <button
          onClick={() => {
            setAddVehicleId(vehicles[0]?.id ?? '');
            setShowAddForm(true);
          }}
          className="rounded-lg border px-4 py-2 text-sm font-semibold"
          style={{ borderColor: ACCENT, color: ACCENT, backgroundColor: 'var(--glass)' }}
        >
          + Add Reminder
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        {(['all', 'by_vehicle'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: viewMode === mode ? ACCENT : 'var(--surface-elevated)',
              color: viewMode === mode ? 'var(--background)' : 'var(--text-secondary)',
            }}
          >
            {mode === 'all' ? 'All Vehicles' : 'By Vehicle'}
          </button>
        ))}
      </div>

      {enriched.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={cardStyle}>
          <p className="text-3xl mb-2">{'\uD83D\uDD14'}</p>
          <p style={{ color: 'var(--text-secondary)' }}>No reminders set up</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {vehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSetupDefaults(v.id)}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: ACCENT, color: ACCENT }}
              >
                Set up defaults for {v.name}
              </button>
            ))}
          </div>
        </div>
      ) : viewMode === 'all' ? (
        <div className="space-y-3">
          {enriched.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="w-full text-left rounded-xl border p-4"
              style={cardStyle}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{serviceTypeLabel(s.serviceType, s.serviceTypeCustom)}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {s.vehicleName} &middot; {formatDueInfo(s, s.status, s.currentOdometer)}
                  </p>
                </div>
                <span
                  className="rounded-md px-2 py-1 text-xs font-bold"
                  style={{ color: STATUS_COLORS[s.status] }}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {vehicles.map((v) => {
            const vs = enriched.filter((s) => s.vehicleId === v.id);
            if (vs.length === 0) return null;
            return (
              <div key={v.id}>
                <h2 className="text-lg font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{v.name}</h2>
                <div className="space-y-3">
                  {vs.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="w-full text-left rounded-xl border p-4"
                      style={cardStyle}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{serviceTypeLabel(s.serviceType, s.serviceTypeCustom)}</p>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {formatDueInfo(s, s.status, s.currentOdometer)}
                          </p>
                        </div>
                        <span
                          className="rounded-md px-2 py-1 text-xs font-bold"
                          style={{ color: STATUS_COLORS[s.status] }}
                        >
                          {STATUS_LABEL[s.status]}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vehicles with no schedules */}
      {vehicles.filter((v) => !schedules.some((s) => s.vehicleId === v.id)).map((v) => (
        <div key={v.id} className="rounded-xl border p-4 flex items-center justify-between" style={cardStyle}>
          <p style={{ color: 'var(--text-secondary)' }}>{v.name}: No reminders</p>
          <button
            onClick={() => handleSetupDefaults(v.id)}
            className="rounded-lg border px-3 py-1 text-sm"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Set up defaults
          </button>
        </div>
      ))}
    </div>
  );
}

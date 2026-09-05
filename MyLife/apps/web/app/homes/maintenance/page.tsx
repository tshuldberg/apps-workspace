'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchProperties, fetchAllActiveSchedules, doCreateSchedule, doUpdateSchedule,
  doDeactivateSchedule,
} from '../actions';
import {
  calculateScheduleStatus, sortByUrgency, getTaskTypeLabel, markComplete,
} from '@mylife/homes';
import type { Property, MaintenanceSchedule, TaskType } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};

type StatusKey = 'overdue' | 'due_soon' | 'ok' | 'unknown';
const STATUS_COLORS: Record<StatusKey, string> = {
  overdue: 'var(--danger)', due_soon: ACCENT, ok: 'var(--success)', unknown: 'var(--text-tertiary)',
};
const STATUS_LABELS: Record<StatusKey, string> = {
  overdue: 'Overdue', due_soon: 'Due Soon', ok: 'OK', unknown: 'Unknown',
};

interface ScheduleRow extends MaintenanceSchedule {
  status: StatusKey;
}

const TASK_TYPES: TaskType[] = [
  'hvac_filter', 'hvac_service', 'gutter_cleaning', 'roof_inspection',
  'smoke_detector', 'water_heater_flush', 'dryer_vent', 'pest_control',
  'exterior_paint', 'lawn_mower_service', 'window_cleaning',
  'plumbing_inspection', 'appliance_service', 'chimney_sweep', 'custom',
];

export default function MaintenancePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusKey | 'all'>('all');
  const [propFilter, setPropFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('custom');
  const [customLabel, setCustomLabel] = useState('');
  const [interval, setIntervalVal] = useState('3');
  const [dueDate, setDueDate] = useState('');
  const [addPropId, setAddPropId] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const [props, scheds] = await Promise.all([
        fetchProperties(), fetchAllActiveSchedules(),
      ]);
      setProperties(props);
      setSchedules(scheds);
      if (!addPropId && props.length > 0) setAddPropId(props[0].id);
    } catch {
      setError('Failed to load maintenance tasks');
    } finally {
      setLoading(false);
    }
  }, [addPropId]);

  useEffect(() => { void load(); }, [load]);

  const rows: ScheduleRow[] = useMemo(() => {
    const withStatus = schedules.map((s) => ({
      ...s, status: calculateScheduleStatus(s.nextDueDate) as StatusKey,
    }));
    return sortByUrgency(withStatus) as ScheduleRow[];
  }, [schedules]);

  const filtered = rows.filter((s) => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (propFilter && s.propertyId !== propFilter) return false;
    return true;
  });

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? '';

  const handleComplete = async (s: ScheduleRow) => {
    try {
      const result = markComplete(s);
      await doUpdateSchedule(s.id, {
        lastCompletedDate: result.lastCompletedDate,
        nextDueDate: result.nextDueDate,
        snoozeDays: 0, snoozeCount: 0,
      });
      void load();
    } catch { /* */ }
  };

  const handleDeactivate = async (id: string) => {
    try { await doDeactivateSchedule(id); void load(); } catch { /* */ }
  };

  const handleAdd = async () => {
    if (!addPropId) return;
    try {
      await doCreateSchedule(crypto.randomUUID(), {
        propertyId: addPropId,
        taskType,
        taskTypeCustom: taskType === 'custom' ? customLabel.trim() : undefined,
        intervalMonths: parseInt(interval) || 3,
        nextDueDate: dueDate || undefined,
      });
      setShowAdd(false);
      setCustomLabel('');
      setDueDate('');
      setLoading(true);
      void load();
    } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 12 }}>
      {[1, 2, 3, 4].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 56, opacity: 0.5 }} />)}
    </div>;
  }

  if (error) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 48 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Something went wrong</p>
        <button type="button" onClick={() => { setLoading(true); void load(); }} style={{
          background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>Retry</button>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  };

  if (schedules.length === 0 && !showAdd) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>✅</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>All caught up</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          No maintenance tasks yet. Add one to start tracking.
        </p>
        <button type="button" onClick={() => setShowAdd(true)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
        }}>Add a Task</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Maintenance Tasks</h2>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>{showAdd ? 'Cancel' : '+ Add Task'}</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'overdue', 'due_soon', 'ok'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} style={{
            background: filter === f ? ACCENT : 'var(--glass-strong)',
            color: filter === f ? 'var(--background)' : 'var(--text-secondary)',
            border: 'none', borderRadius: 999, padding: '6px 14px',
            fontWeight: 600, cursor: 'pointer', fontSize: 13,
          }}>{f === 'all' ? 'All' : STATUS_LABELS[f]}</button>
        ))}
        {properties.length > 1 && (
          <>
            <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
            <button type="button" onClick={() => setPropFilter(null)} style={{
              background: !propFilter ? ACCENT : 'var(--glass-strong)',
              color: !propFilter ? 'var(--background)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 999, padding: '6px 14px',
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>All Properties</button>
            {properties.map((p) => (
              <button key={p.id} type="button" onClick={() => setPropFilter(p.id)} style={{
                background: propFilter === p.id ? ACCENT : 'var(--glass-strong)',
                color: propFilter === p.id ? 'var(--background)' : 'var(--text-secondary)',
                border: 'none', borderRadius: 999, padding: '6px 14px',
                fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>{p.name}</button>
            ))}
          </>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {properties.length > 0 && (
            <select value={addPropId} onChange={(e) => setAddPropId(e.target.value)} style={inputStyle}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} style={inputStyle}>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          {taskType === 'custom' && (
            <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Custom task name" style={inputStyle} />
          )}
          <input type="number" value={interval} onChange={(e) => setIntervalVal(e.target.value)}
            placeholder="Interval (months)" min="1" style={inputStyle} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setShowAdd(false)} style={{
              background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
            }}>Cancel</button>
            <button type="button" onClick={() => void handleAdd()} style={{
              background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 8,
              padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
          <thead>
            <tr style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Task</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Property</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Due</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Last Done</th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ background: 'var(--glass)', borderRadius: 8 }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: STATUS_COLORS[s.status],
                  }} />
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                  {getTaskTypeLabel(s.taskType, s.taskTypeCustom)}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 14 }}>
                  {propName(s.propertyId)}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 14, color: STATUS_COLORS[s.status] }}>
                  {s.nextDueDate?.slice(0, 10) ?? 'No date'}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 14, color: 'var(--text-tertiary)' }}>
                  {s.lastCompletedDate?.slice(0, 10) ?? 'Never'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => void handleComplete(s)} style={{
                      background: 'transparent', color: 'var(--success)', border: '1px solid var(--success)',
                      borderRadius: 4, padding: '3px 10px', fontWeight: 600,
                      cursor: 'pointer', fontSize: 12,
                    }}>Done</button>
                    <button type="button" onClick={() => void handleDeactivate(s.id)} style={{
                      background: 'transparent', color: 'var(--text-tertiary)',
                      border: '1px solid var(--border)', borderRadius: 4,
                      padding: '3px 10px', cursor: 'pointer', fontSize: 12,
                    }}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 32 }}>
          No tasks match this filter
        </p>
      )}
    </div>
  );
}

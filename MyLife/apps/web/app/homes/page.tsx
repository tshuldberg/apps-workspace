'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchProperties, fetchAllActiveSchedules, fetchCostEntriesForProperty,
  doUpdateSchedule,
} from './actions';
import {
  calculateScheduleStatus, sortByUrgency, getTaskTypeLabel,
  markComplete, getCostSummary,
} from '@mylife/homes';
import type { Property, MaintenanceSchedule, CostEntry } from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const ACCENT_DIM = 'var(--accent-homes-dim)';
const ACCENT_BORDER = 'var(--accent-homes-border)';

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
};

interface ScheduleWithStatus extends MaintenanceSchedule {
  status: 'overdue' | 'due_soon' | 'ok' | 'unknown';
}

function cents(amount: number): string {
  return `$${Math.round(amount / 100).toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  overdue: 'var(--danger)',
  due_soon: ACCENT,
  ok: 'var(--success)',
  unknown: 'var(--text-tertiary)',
};

const CAT_COLORS = ['var(--accent-homes)', 'var(--success)', '#3B82F6', '#A855F7', 'var(--danger)'];

export default function HomesDashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [props, scheds] = await Promise.all([
        fetchProperties(),
        fetchAllActiveSchedules(),
      ]);
      setProperties(props);
      setSchedules(scheds);
      if (props.length > 0) {
        const propId = props[0].id;
        const c = await fetchCostEntriesForProperty(propId);
        setCosts(c);
      }
    } catch {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activePropertyId = selectedId ?? properties[0]?.id ?? null;
  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? null;

  useEffect(() => {
    if (!activePropertyId) return;
    let cancelled = false;
    void fetchCostEntriesForProperty(activePropertyId).then((c) => {
      if (!cancelled) setCosts(c);
    });
    return () => { cancelled = true; };
  }, [activePropertyId]);

  const schedulesWithStatus: ScheduleWithStatus[] = useMemo(
    () => schedules
      .filter((s) => !activePropertyId || s.propertyId === activePropertyId)
      .map((s) => ({ ...s, status: calculateScheduleStatus(s.nextDueDate) })),
    [schedules, activePropertyId],
  );
  const sorted = sortByUrgency(schedulesWithStatus);
  const overdue = sorted.filter((s) => s.status === 'overdue');
  const dueSoon = sorted.filter((s) => s.status === 'due_soon');
  const alerts = [...overdue, ...dueSoon].slice(0, 3);
  const costSummary = getCostSummary(costs);

  const handleComplete = async (schedule: ScheduleWithStatus) => {
    try {
      const result = markComplete(schedule);
      await doUpdateSchedule(schedule.id, {
        lastCompletedDate: result.lastCompletedDate,
        nextDueDate: result.nextDueDate,
        snoozeDays: 0,
        snoozeCount: 0,
      });
      void load();
    } catch { /* retry on next load */ }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...GLASS_CARD, height: 120, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...GLASS_CARD, textAlign: 'center', padding: 48 }}>
        <p style={{ fontSize: 18, marginBottom: 16 }}>Something went wrong</p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{error}</p>
        <button type="button" onClick={() => { setLoading(true); void load(); }} style={{
          background: ACCENT, color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontWeight: 600, cursor: 'pointer',
        }}>
          Retry
        </button>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>🏠</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your home awaits</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          Add your first property to start tracking maintenance, costs, and more.
        </p>
        <Link href="/homes/properties" style={{
          display: 'inline-block', background: ACCENT, color: 'var(--background)', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, textDecoration: 'none',
        }}>
          Add Your First Property
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Hero */}
      <section style={{
        padding: 24, borderRadius: 24, background: ACCENT_DIM,
        border: `1px solid ${ACCENT_BORDER}`,
      }}>
        <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05 }}>
          {activeProperty?.name ?? 'Your Home'}
        </h1>
        {activeProperty?.address && (
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 15 }}>
            {activeProperty.address}
            {activeProperty.city ? `, ${activeProperty.city}` : ''}
            {activeProperty.state ? `, ${activeProperty.state}` : ''}
          </p>
        )}
        {activeProperty && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{
              background: 'var(--glass-strong)', borderRadius: 4,
              padding: '2px 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            }}>
              {activeProperty.propertyType}
            </span>
            <span style={{
              background: 'var(--glass-strong)', borderRadius: 4,
              padding: '2px 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
            }}>
              {activeProperty.ownershipType === 'own' ? 'Owner' : 'Renter'}
            </span>
          </div>
        )}
      </section>

      {/* Property switcher */}
      {properties.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {properties.map((p) => (
            <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} style={{
              background: p.id === activePropertyId ? ACCENT : 'var(--glass-strong)',
              color: p.id === activePropertyId ? 'var(--background)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 999, padding: '8px 16px',
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <section style={{ display: 'grid', gap: 8 }}>
          {alerts.map((s) => (
            <div key={s.id} style={{
              ...GLASS_CARD, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
              borderLeft: `3px solid ${s.status === 'overdue' ? 'var(--danger)' : ACCENT}`,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>
                  {getTaskTypeLabel(s.taskType, s.taskTypeCustom)}
                </p>
                <p style={{
                  margin: '2px 0 0', fontSize: 13,
                  color: s.status === 'overdue' ? 'var(--danger)' : ACCENT,
                }}>
                  {s.status === 'overdue' ? 'Overdue' : 'Due soon'}
                  {s.nextDueDate ? ` · ${s.nextDueDate.slice(0, 10)}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => void handleComplete(s)} style={{
                background: 'transparent', color: 'var(--success)', border: '1px solid var(--success)',
                borderRadius: 4, padding: '4px 12px', fontWeight: 600,
                cursor: 'pointer', fontSize: 13,
              }}>
                Done
              </button>
            </div>
          ))}
          {overdue.length + dueSoon.length > 3 && (
            <Link href="/homes/maintenance" style={{ color: ACCENT, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              View all {overdue.length + dueSoon.length} alerts
            </Link>
          )}
        </section>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Log Cost', icon: '💰', href: '/homes/costs' },
          { label: 'Add Task', icon: '🔧', href: '/homes/maintenance' },
          { label: 'Find Pro', icon: '👷', href: '/homes/contractors' },
          { label: 'Projects', icon: '🏗️', href: '/homes/projects' },
        ].map((a) => (
          <Link key={a.label} href={a.href} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--glass-strong)', borderRadius: 999,
            padding: '8px 16px', textDecoration: 'none', color: 'var(--text)',
            fontWeight: 600, fontSize: 13,
          }}>
            {a.icon} {a.label}
          </Link>
        ))}
      </div>

      {/* Cost snapshot + Coming up side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <Link href="/homes/costs" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={GLASS_CARD}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>
              Spending
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>
              {cents(costSummary.totalCents)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
              across {Object.keys(costSummary.byCategory).length} categories
            </p>
            {costSummary.totalCents > 0 && (
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 12, gap: 2 }}>
                {Object.entries(costSummary.byCategory).map(([cat, c], i) => (
                  <div key={cat} style={{
                    flex: c / Math.max(costSummary.totalCents, 1),
                    backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                    borderRadius: 3,
                  }} />
                ))}
              </div>
            )}
          </div>
        </Link>

        <div style={GLASS_CARD}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-secondary)' }}>
            Coming Up
          </p>
          {sorted.length === 0 ? (
            <p style={{ margin: '12px 0 0', color: 'var(--text-tertiary)', fontSize: 14 }}>
              No upcoming tasks
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {sorted.slice(0, 5).map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: STATUS_COLORS[s.status] ?? 'var(--text-tertiary)',
                    flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getTaskTypeLabel(s.taskType, s.taskTypeCustom)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {s.nextDueDate?.slice(0, 10) ?? 'No date'}
                  </span>
                </div>
              ))}
              <Link href="/homes/maintenance" style={{ color: ACCENT, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                View All
              </Link>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', paddingTop: 16 }}>
        <Link href="/homes/settings" style={{ color: 'var(--text-tertiary)', fontSize: 13, textDecoration: 'none' }}>
          ⚙️ Settings
        </Link>
      </div>
    </div>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchProperties, fetchProjectsForProperty,
  fetchPhasesForProject, doCreateProject, doUpdateProject, doDeleteProject,
} from '../actions';
import { getPhaseProgress, getBudgetVsActual } from '@mylife/homes';
import type {
  Property, Project, ProjectPhase, ProjectStatus, ProjectPriority,
  ProjectCategory,
} from '@mylife/homes';

const ACCENT = 'var(--accent-homes)';
const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16,
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: 'var(--text-secondary)', in_progress: ACCENT,
  completed: 'var(--success)', on_hold: 'var(--warning)', cancelled: 'var(--danger)',
};
const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  high: 'var(--danger)', medium: ACCENT, low: 'var(--success)',
};

function cents(amount: number): string {
  return `$${Math.round(amount / 100).toLocaleString()}`;
}

interface ProjectRow extends Project {
  phases: ProjectPhase[];
  propertyName: string;
}

export default function ProjectsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPropId, setAddPropId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [budgetStr, setBudgetStr] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [category, setCategory] = useState<ProjectCategory>('other');

  const load = useCallback(async () => {
    try {
      setError(null);
      const props = await fetchProperties();
      setProperties(props);
      if (!addPropId && props.length > 0) setAddPropId(props[0].id);
      const rows: ProjectRow[] = [];
      for (const p of props) {
        const projs = await fetchProjectsForProperty(p.id);
        for (const proj of projs) {
          const phases = await fetchPhasesForProject(proj.id);
          rows.push({ ...proj, phases, propertyName: p.name });
        }
      }
      setProjects(rows);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [addPropId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!addPropId || !name.trim()) return;
    try {
      await doCreateProject(crypto.randomUUID(), {
        propertyId: addPropId, name: name.trim(),
        description: description.trim() || undefined,
        budgetCents: budgetStr ? Math.round(parseFloat(budgetStr) * 100) : undefined,
        priority, category,
      });
      setName(''); setDescription(''); setBudgetStr('');
      setShowAdd(false); setLoading(true); void load();
    } catch { /* */ }
  };

  const handleStatusChange = async (id: string, status: ProjectStatus) => {
    try {
      await doUpdateProject(id, { status });
      void load();
    } catch { /* */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    try { await doDeleteProject(id); void load(); } catch { /* */ }
  };

  if (loading) {
    return <div style={{ display: 'grid', gap: 12 }}>
      {[1, 2].map((i) => <div key={i} style={{ ...GLASS_CARD, height: 140, opacity: 0.5 }} />)}
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

  if (projects.length === 0 && !showAdd) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>🏗️</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>No projects yet</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px' }}>
          Track renovations, repairs, and improvement projects with budgets and phases.
        </p>
        <button type="button" onClick={() => setShowAdd(true)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
        }}>Start a Project</button>
      </div>
    );
  }

  const inputStyle: CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, width: '100%',
  };

  const active = projects.filter((p) => p.status === 'in_progress' || p.status === 'planning');

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Projects</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            {active.length} active project{active.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)} style={{
          background: ACCENT, color: 'var(--background)', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
        }}>{showAdd ? 'Cancel' : '+ Start Project'}</button>
      </div>

      {showAdd && (
        <div style={{ ...GLASS_CARD, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {properties.length > 0 && (
            <select value={addPropId} onChange={(e) => setAddPropId(e.target.value)} style={inputStyle}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name *" style={inputStyle} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={inputStyle} />
          <input type="number" value={budgetStr} onChange={(e) => setBudgetStr(e.target.value)}
            placeholder="Budget ($)" min="0" step="0.01" style={inputStyle} />
          <select value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority)} style={inputStyle}>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as ProjectCategory)} style={inputStyle}>
            {['renovation', 'repair', 'maintenance', 'addition', 'landscaping', 'other'].map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setShowAdd(false)} style={{
              background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600,
            }}>Cancel</button>
            <button type="button" onClick={() => void handleAdd()} disabled={!name.trim()} style={{
              background: name.trim() ? ACCENT : 'var(--border)',
              color: name.trim() ? 'var(--background)' : 'var(--text-tertiary)',
              border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer',
            }}>Save</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {projects.map((p) => {
          const phaseProgress = getPhaseProgress(p.phases);
          const total = phaseProgress.pending + phaseProgress.inProgress + phaseProgress.completed + phaseProgress.skipped;
          const progressPct = total > 0 ? Math.round((phaseProgress.completed / total) * 100) : 0;
          const budget = getBudgetVsActual(p);
          const overBudget = budget.remainingCents < 0;
          return (
            <div key={p.id} style={GLASS_CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{p.name}</h3>
                    <span style={{
                      background: STATUS_COLORS[p.status], borderRadius: 4,
                      padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--background)',
                    }}>{p.status.replace('_', ' ').toUpperCase()}</span>
                    <span style={{
                      background: 'var(--glass-strong)', borderRadius: 4,
                      padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      color: PRIORITY_COLORS[p.priority],
                    }}>{p.priority}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                    {p.propertyName} · {p.category}
                  </p>
                  {p.description && (
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-tertiary)' }}>{p.description}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select
                    value={p.status}
                    onChange={(e) => void handleStatusChange(p.id, e.target.value as ProjectStatus)}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12,
                    }}
                  >
                    {['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'].map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void handleDelete(p.id)} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                    cursor: 'pointer', fontSize: 14,
                  }}>✕</button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Progress</span>
                  <span>{progressPct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: ACCENT, borderRadius: 3 }} />
                </div>
              </div>

              {/* Budget vs Actual */}
              {p.budgetCents > 0 && (
                <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Budget: </span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{cents(budget.budgetCents)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Actual: </span>
                    <span style={{
                      fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: overBudget ? 'var(--danger)' : 'var(--success)',
                    }}>{cents(budget.actualCostCents)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Remaining: </span>
                    <span style={{
                      fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                      color: overBudget ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {overBudget ? '-' : ''}{cents(Math.abs(budget.remainingCents))}
                    </span>
                  </div>
                </div>
              )}

              {/* Phases */}
              {p.phases.length > 0 && (
                <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
                  {p.phases.map((ph) => (
                    <div key={ph.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0', fontSize: 13,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                        background: ph.status === 'completed' ? 'var(--success)'
                          : ph.status === 'in_progress' ? ACCENT
                          : 'var(--text-tertiary)',
                      }} />
                      <span style={{ flex: 1 }}>{ph.name}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                        {ph.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

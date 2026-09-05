'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Propagation, PropagationStats, PropagationMethod, PropagationMedium, PropagationStage } from '@mylife/garden';
import {
  fetchActivePropagations, fetchPropagationStats, fetchPlants,
  doCreatePropagation, doAdvancePropagationStage, engineGetNextStages,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';



type PropStage = 'started' | 'callusing' | 'rooting' | 'growing' | 'ready' | 'potted' | 'failed';

const STAGE_COLORS: Record<string, string> = {
  started: TEXT_SEC,
  callusing: '#F59E0B',
  rooting: '#38BDF8',
  growing: ACCENT,
  ready: '#A3E635',
  potted: '#C084FC',
  failed: DANGER,
};

const METHODS: { value: PropagationMethod; label: string }[] = [
  { value: 'stem_cutting', label: 'Stem Cutting' },
  { value: 'leaf_cutting', label: 'Leaf Cutting' },
  { value: 'division', label: 'Division' },
  { value: 'air_layering', label: 'Air Layering' },
  { value: 'seed', label: 'Seed' },
  { value: 'water_propagation', label: 'Water Propagation' },
  { value: 'grafting', label: 'Grafting' },
  { value: 'offsets', label: 'Offsets' },
];

const MEDIA: { value: PropagationMedium; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'soil', label: 'Soil' },
  { value: 'perlite', label: 'Perlite' },
  { value: 'sphagnum_moss', label: 'Sphagnum Moss' },
  { value: 'leca', label: 'LECA' },
  { value: 'vermiculite', label: 'Vermiculite' },
  { value: 'none', label: 'None' },
];

function daysSince(dateStr: string): number {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PropagationsPage() {
  const [propagations, setPropagations] = useState<Propagation[]>([]);
  const [stats, setStats] = useState<PropagationStats | null>(null);
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Advance stage
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [nextStages, setNextStages] = useState<PropagationStage[]>([]);

  // New propagation form
  const [showForm, setShowForm] = useState(false);
  const [formParentId, setFormParentId] = useState('');
  const [formMethod, setFormMethod] = useState<PropagationMethod>('stem_cutting');
  const [formMedium, setFormMedium] = useState<PropagationMedium>('water');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const plantMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plants) m.set(p.id, p.name);
    return m;
  }, [plants]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchActivePropagations(),
      fetchPropagationStats(),
      fetchPlants(),
    ])
      .then(([props, st, pl]) => {
        if (cancelled) return;
        setPropagations(props as Propagation[]);
        setStats(st as PropagationStats);
        setPlants((pl as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name })));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load propagations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  const handleShowAdvance = useCallback(async (id: string, currentStage: string) => {
    if (advancingId === id) {
      setAdvancingId(null);
      setNextStages([]);
      return;
    }
    try {
      const stages = await engineGetNextStages(currentStage as PropStage);
      setNextStages(stages as PropagationStage[]);
      setAdvancingId(id);
    } catch {
      setNextStages([]);
    }
  }, [advancingId]);

  const handleAdvance = useCallback(async (id: string, stage: PropagationStage) => {
    try {
      await doAdvancePropagationStage(id, stage);
      setAdvancingId(null);
      setNextStages([]);
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleMarkFailed = useCallback(async (id: string) => {
    try {
      await doAdvancePropagationStage(id, 'failed');
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    setSubmitting(true);
    try {
      await doCreatePropagation({
        parentPlantId: formParentId || undefined,
        method: formMethod,
        medium: formMedium || undefined,
        notes: formNotes.trim() || undefined,
      });
      setFormParentId('');
      setFormMethod('stem_cutting');
      setFormMedium('water');
      setFormNotes('');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formParentId, formMethod, formMedium, formNotes, refresh]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const hasNoData = propagations.length === 0 && (!stats || stats.total === 0);

  if (hasNoData && !showForm) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🪴</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No propagations yet</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Track cuttings, divisions, and other propagation methods from start to pot. Watch your success rate grow as you propagate more plants.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ Start Propagation</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Propagations</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ Start Propagation</button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Active" value={stats.activeCount} />
          <StatCard label="Success" value={stats.successCount} accent={ACCENT} />
          <StatCard label="Failed" value={stats.failedCount} accent={stats.failedCount > 0 ? DANGER : undefined} />
          <StatCard label="Rate" value={`${Math.round(stats.successRate * 100)}%`} accent={ACCENT} />
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Parent Plant</label>
              <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Method</label>
              <select value={formMethod} onChange={(e) => setFormMethod(e.target.value as PropagationMethod)} style={inputStyle}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Medium</label>
              <select value={formMedium} onChange={(e) => setFormMedium(e.target.value as PropagationMedium)} style={inputStyle}>
                {MEDIA.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Notes</label>
            <input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleCreate} disabled={submitting} style={primaryBtn}>
              {submitting ? 'Starting...' : 'Start'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Active propagations */}
      <div style={{ display: 'grid', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Active ({propagations.length})
        </h3>
        {propagations.length === 0 && (
          <p style={{ color: TEXT_TER, padding: 16, textAlign: 'center' }}>No active propagations.</p>
        )}
        {propagations.map((p) => {
          const days = daysSince(p.startDate);
          const stageColor = STAGE_COLORS[p.currentStage] ?? TEXT_SEC;
          return (
            <div key={p.id} style={{ ...card, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
                  {p.parentPlantId ? (plantMap.get(p.parentPlantId) ?? 'Unknown') : 'Unknown parent'}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  backgroundColor: `${stageColor}18`, color: stageColor,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {p.currentStage}
                </span>
                <span style={{ fontSize: 12, color: TEXT_TER }}>
                  {p.method.replace('_', ' ')}
                  {p.medium ? ` in ${p.medium}` : ''}
                </span>
                <span style={{ fontSize: 12, color: TEXT_TER, marginLeft: 'auto' }}>
                  {days} day{days !== 1 ? 's' : ''}
                </span>
              </div>
              {p.notes && (
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{p.notes}</p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleShowAdvance(p.id, p.currentStage)}
                  style={smallBtn}
                >
                  Advance
                </button>
                {advancingId === p.id && nextStages.length > 0 && (
                  <>
                    {nextStages.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => handleAdvance(p.id, stage)}
                        style={{
                          ...smallBtn,
                          backgroundColor: STAGE_COLORS[stage] ?? ACCENT,
                        }}
                      >
                        {stage}
                      </button>
                    ))}
                  </>
                )}
                {p.currentStage !== 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleMarkFailed(p.id)}
                    style={{ ...smallBtn, backgroundColor: 'transparent', color: DANGER, border: `1px solid rgba(255,69,58,0.2)` }}
                  >
                    Mark Failed
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: accent || ACCENT }}>{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 160, height: 32 }} />
        <div style={{ ...skel, width: 170, height: 38 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => <div key={i} style={{ ...skel, height: 80 }} />)}
      </div>
      {[1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 100 }} />)}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: 40 }}>
      <p style={{ fontSize: 18, color: TEXT, margin: 0 }}>Something went wrong</p>
      <p style={{ fontSize: 14, color: TEXT_SEC, margin: '8px 0 0' }}>{message}</p>
      <button type="button" onClick={onRetry} style={{ ...ghostBtn, marginTop: 16 }}>Retry</button>
    </div>
  );
}

const card: CSSProperties = { padding: 20, borderRadius: 20, backgroundColor: GLASS, border: `1px solid ${BORDER}` };
const primaryBtn: CSSProperties = { borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 18px', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14 };
const smallBtn: CSSProperties = { borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', padding: '6px 14px', fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };

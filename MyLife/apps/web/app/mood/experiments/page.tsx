'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchActiveExperiment, fetchExperiments, fetchTemplates,
  addExperiment, cancelExperiment,
} from '../actions';
import type { Experiment, ExperimentTemplate } from '@mylife/mood';

const ACCENT = 'var(--accent-mood)';
const ACCENT_DIM = 'var(--accent-mood-dim, rgba(251,146,60,0.15))';
const ACCENT_BORDER = 'var(--accent-mood-border, rgba(251,146,60,0.25))';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

const CATEGORY_ICONS: Record<string, string> = {
  exercise: '\u{1F3CB}', sleep: '\u{1F634}', mindfulness: '\u{1F9D8}',
  social: '\u{1F465}', nutrition: '\u{1F34E}', digital: '\u{1F4F1}',
};

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000) + 1;
}

function expProgress(exp: Experiment): { label: string; pct: number; phase: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (exp.status === 'baseline') {
    const total = daysBetween(exp.baselineStart, exp.baselineEnd);
    const elapsed = Math.max(1, daysBetween(exp.baselineStart, today > exp.baselineEnd ? exp.baselineEnd : today));
    return { label: `Baseline Day ${elapsed}/${total}`, pct: (elapsed / total) * 100, phase: 'BASELINE' };
  }
  if (exp.status === 'intervention') {
    const total = daysBetween(exp.interventionStart, exp.interventionEnd);
    const elapsed = Math.max(1, daysBetween(exp.interventionStart, today > exp.interventionEnd ? exp.interventionEnd : today));
    return { label: `Intervention Day ${elapsed}/${total}`, pct: (elapsed / total) * 100, phase: 'INTERVENTION' };
  }
  if (exp.status === 'draft') return { label: 'Draft', pct: 0, phase: 'DRAFT' };
  return { label: exp.status === 'completed' ? 'Completed' : 'Abandoned', pct: 100, phase: exp.status.toUpperCase() };
}

function daysRemaining(exp: Experiment): number {
  const today = new Date().toISOString().slice(0, 10);
  const d = daysBetween(today, exp.interventionEnd);
  return Math.max(0, d);
}

export default function ExperimentsPage() {
  const [active, setActive] = useState<Experiment | null>(null);
  const [past, setPast] = useState<Experiment[]>([]);
  const [templates, setTemplates] = useState<ExperimentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Experiment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [hypothesis, setHypothesis] = useState('');
  const [description, setDescription] = useState('');
  const [periodDays, setPeriodDays] = useState(14);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [act, all, tmpl] = await Promise.all([fetchActiveExperiment(), fetchExperiments(), fetchTemplates()]);
      setActive(act);
      const pastExps = all.filter((e) => e.status === 'completed' || e.status === 'abandoned');
      setPast(pastExps);
      setTemplates(tmpl);
      // Auto-select active or first past experiment
      if (act) setSelected(act);
      else if (pastExps.length > 0) setSelected(pastExps[0]!);
    } catch {
      setError('Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!hypothesis.trim()) return;
    setCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addExperiment({
        hypothesis: hypothesis.trim(),
        interventionDescription: description.trim() || hypothesis.trim(),
        periodDays: periodDays as 7 | 14 | 21 | 30,
        baselineStart: today,
      });
      setShowCreate(false);
      setHypothesis('');
      setDescription('');
      void load();
    } catch {
      setError('Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  const handleAbandon = async (id: string) => {
    try {
      await cancelExperiment(id);
      setSelected(null);
      void load();
    } catch {
      setError('Failed to abandon experiment');
    }
  };

  const selectTemplate = (t: ExperimentTemplate) => {
    setHypothesis(t.hypothesis);
    setDescription(t.interventionDescription);
    setPeriodDays(t.suggestedDays);
    setShowCreate(true);
  };

  if (loading) return <ExperimentsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => void load()} />;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Obsidian Protocol Banner */}
      <div style={{
        padding: 24, borderRadius: 20, background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: 'var(--text)' }}>
              THE OBSIDIAN PROTOCOL
            </span>
            <span style={{ fontSize: 18 }}>{'\u{1F9EA}'}</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: TEXT_SEC, maxWidth: 600 }}>
            A/B testing for your life. We compare baseline periods with active interventions to isolate what actually impacts your emotional state.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none',
            background: ACCENT, color: '#0A0A0F', fontWeight: 700, fontSize: 13,
            letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0, marginLeft: 16,
          }}
        >
          + NEW EXPERIMENT
        </button>
      </div>

      {/* Two-Panel Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, minHeight: 400 }}>
        {/* Left Panel: Experiment List */}
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          {/* Active Experiment */}
          {active && (
            <>
              <p style={{
                margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase' as const, color: TEXT_SEC,
              }}>
                ACTIVE PROTOCOL
              </p>
              <ExperimentListItem
                exp={active}
                isSelected={selected?.id === active.id}
                isActive
                onClick={() => setSelected(active)}
              />
            </>
          )}

          {/* Past Experiments */}
          {past.length > 0 && (
            <>
              <p style={{
                margin: active ? '8px 0 0' : 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase' as const, color: TEXT_SEC,
              }}>
                ARCHIVED INSIGHTS
              </p>
              {past.map((exp) => (
                <ExperimentListItem
                  key={exp.id}
                  exp={exp}
                  isSelected={selected?.id === exp.id}
                  onClick={() => setSelected(exp)}
                />
              ))}
            </>
          )}

          {/* Templates */}
          {templates.length > 0 && (
            <>
              <p style={{
                margin: '8px 0 0', fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                textTransform: 'uppercase' as const, color: TEXT_SEC,
              }}>
                TEMPLATES
              </p>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  style={{
                    padding: 14, borderRadius: 14, border: `1px solid ${BORDER}`,
                    background: GLASS, cursor: 'pointer', textAlign: 'left',
                    display: 'grid', gap: 4, transition: 'border-color 150ms',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251,146,60,0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {CATEGORY_ICONS[t.category] ?? '\u{1F9EA}'} {t.name}
                  </span>
                  <span style={{
                    fontSize: 12, color: TEXT_SEC, display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                  }}>
                    {t.hypothesis}
                  </span>
                  <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>{t.suggestedDays} days</span>
                </button>
              ))}
            </>
          )}

          {/* Empty state */}
          {!active && past.length === 0 && templates.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>{'\u{1F9EA}'}</span>
              <p style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 700 }}>No experiments yet</p>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>Create your first A/B experiment above.</p>
            </div>
          )}
        </div>

        {/* Right Panel: Selected Detail */}
        <div style={{
          padding: 28, borderRadius: 20, background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column',
        }}>
          {selected ? (
            <ExperimentDetail
              exp={selected}
              onAbandon={handleAbandon}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12, color: TEXT_SEC,
            }}>
              <span style={{ fontSize: 48, opacity: 0.5 }}>{'\u{1F9EA}'}</span>
              <p style={{ margin: 0, fontSize: 15 }}>Select an experiment to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateExperimentModal
          hypothesis={hypothesis}
          description={description}
          periodDays={periodDays}
          creating={creating}
          onHypothesisChange={setHypothesis}
          onDescriptionChange={setDescription}
          onPeriodChange={setPeriodDays}
          onSubmit={() => void handleCreate()}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── List Item ───────────────────────────────────────────────────────

function ExperimentListItem({ exp, isSelected, isActive, onClick }: {
  exp: Experiment; isSelected: boolean; isActive?: boolean; onClick: () => void;
}) {
  const prog = expProgress(exp);
  const isSuccess = exp.isSignificant === true && exp.scoreDiff != null && exp.scoreDiff > 0;
  const outcomeColor = exp.status === 'abandoned' ? TEXT_SEC : isSuccess ? 'var(--success)' : TEXT_SEC;
  const outcomeLabel = exp.status === 'abandoned' ? 'ABANDONED' : exp.status === 'completed'
    ? (isSuccess ? 'SUCCESS' : 'INCONCLUSIVE') : prog.phase;

  return (
    <button
      onClick={onClick}
      style={{
        padding: 16, borderRadius: 14, textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${isSelected ? ACCENT_BORDER : BORDER}`,
        background: isSelected ? ACCENT_DIM : GLASS,
        display: 'grid', gap: 8, transition: 'all 150ms',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>
          {CATEGORY_ICONS[exp.templateId ?? ''] ?? '\u{1F9EA}'}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const,
          color: isActive ? ACCENT : outcomeColor,
        }}>
          {outcomeLabel}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
        {exp.hypothesis}
      </p>
      {isActive && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            flex: 1, height: 4, borderRadius: 2, marginRight: 10,
            background: 'var(--glass-strong, rgba(255,255,255,0.08))', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: ACCENT,
              width: `${Math.min(100, prog.pct)}%`, transition: 'width 300ms',
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_SEC }}>
            {daysRemaining(exp)}d left
          </span>
        </div>
      )}
      {exp.status === 'completed' && exp.scoreDiff != null && (
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: exp.scoreDiff >= 0 ? 'var(--success)' : 'var(--danger)',
        }}>
          {exp.scoreDiff >= 0 ? '+' : ''}{exp.scoreDiff.toFixed(1)} pts
        </span>
      )}
    </button>
  );
}

// ── Detail Panel ────────────────────────────────────────────────────

function ExperimentDetail({ exp, onAbandon }: { exp: Experiment; onAbandon: (id: string) => void }) {
  const prog = expProgress(exp);
  const isActive = exp.status === 'baseline' || exp.status === 'intervention';
  const isSuccess = exp.isSignificant === true && exp.scoreDiff != null && exp.scoreDiff > 0;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase' as const,
            background: isActive
              ? (exp.status === 'intervention' ? 'rgba(34,197,94,0.15)' : 'rgba(139,207,240,0.15)')
              : 'rgba(255,255,255,0.06)',
            color: isActive
              ? (exp.status === 'intervention' ? 'var(--success)' : '#8BCFF0')
              : TEXT_SEC,
          }}>
            {prog.phase}
          </span>
          {isActive && (
            <span style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              letterSpacing: 1, background: ACCENT_DIM, color: ACCENT,
            }}>
              {daysRemaining(exp)} DAYS LEFT
            </span>
          )}
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
          {exp.hypothesis}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
          Goal: Identify trigger threshold
        </p>
      </div>

      {/* Progress */}
      {isActive && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
              PROTOCOL PROGRESS
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC }}>
              {Math.round(prog.pct)}%
            </span>
          </div>
          <div style={{
            height: 6, borderRadius: 3,
            background: 'var(--glass-strong, rgba(255,255,255,0.08))', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3, background: ACCENT,
              width: `${Math.min(100, prog.pct)}%`, transition: 'width 300ms',
            }} />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          padding: 16, borderRadius: 14, background: GLASS,
          border: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontSize: 20 }}>{'\u{26A1}'}</span>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>ACTION</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text)' }}>{exp.interventionDescription}</p>
          </div>
        </div>
        <div style={{
          padding: 16, borderRadius: 14, background: GLASS,
          border: `1px solid ${BORDER}`, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontSize: 20 }}>{'\u{1F4CA}'}</span>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: TEXT_SEC }}>TRACKING</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text)' }}>Mood Score</p>
          </div>
        </div>
      </div>

      {/* Results (completed experiments) */}
      {exp.status === 'completed' && (
        <div style={{
          padding: 20, borderRadius: 14, background: GLASS, border: `1px solid ${BORDER}`,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: ACCENT }}>
            RESULTS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>Baseline Avg</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                {exp.baselineAvg?.toFixed(1) ?? '--'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>Intervention Avg</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                {exp.interventionAvg?.toFixed(1) ?? '--'}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>Score Change</p>
              <p style={{
                margin: '4px 0 0', fontSize: 20, fontWeight: 700,
                color: (exp.scoreDiff ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                {exp.scoreDiff != null ? `${exp.scoreDiff >= 0 ? '+' : ''}${exp.scoreDiff.toFixed(1)}` : '--'}
              </p>
            </div>
          </div>
          {exp.conclusion && (
            <p style={{ margin: '16px 0 0', fontSize: 14, color: 'var(--text)', lineHeight: 1.5, borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
              {exp.conclusion}
            </p>
          )}
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>{isSuccess ? '\u{1F4C8}' : '\u{003D}'}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const,
              color: isSuccess ? 'var(--success)' : TEXT_SEC,
            }}>
              {isSuccess ? 'POSITIVE CORRELATION' : 'NO OBSERVED EFFECT'}
            </span>
          </div>
        </div>
      )}

      {/* Abandon button for active experiments */}
      {isActive && (
        <button
          onClick={() => void onAbandon(exp.id)}
          style={{
            padding: '10px 20px', borderRadius: 10, border: `1px solid ${BORDER}`,
            background: 'transparent', color: 'var(--danger)', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', justifySelf: 'start',
          }}
        >
          Abandon Experiment
        </button>
      )}
    </div>
  );
}

// ── Create Modal ────────────────────────────────────────────────────

function CreateExperimentModal({ hypothesis, description, periodDays, creating, onHypothesisChange, onDescriptionChange, onPeriodChange, onSubmit, onClose }: {
  hypothesis: string; description: string; periodDays: number; creating: boolean;
  onHypothesisChange: (v: string) => void; onDescriptionChange: (v: string) => void;
  onPeriodChange: (v: number) => void; onSubmit: () => void; onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 480, padding: 28, borderRadius: 20, background: SURFACE_ELEVATED,
        border: `1px solid ${BORDER}`,
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>New Experiment</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC, display: 'block', marginBottom: 6 }}>
              Hypothesis
            </label>
            <input
              value={hypothesis}
              onChange={(e) => onHypothesisChange(e.target.value)}
              placeholder="e.g. Morning exercise improves my mood"
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`,
                background: 'var(--background)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC, display: 'block', marginBottom: 6 }}>
              Intervention
            </label>
            <input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What specific change will you make?"
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${BORDER}`,
                background: 'var(--background)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC, display: 'block', marginBottom: 6 }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 14, 21, 28].map((d) => (
                <button
                  key={d}
                  onClick={() => onPeriodChange(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: `1px solid ${periodDays === d ? ACCENT : BORDER}`,
                    background: periodDays === d ? ACCENT : 'transparent',
                    color: periodDays === d ? '#0A0A0F' : TEXT_SEC,
                    fontWeight: 600, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px', borderRadius: 10, border: `1px solid ${BORDER}`,
                background: 'transparent', color: TEXT_SEC, fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={creating || !hypothesis.trim()}
              style={{
                padding: '10px 24px', borderRadius: 10, border: 'none',
                background: ACCENT, color: '#0A0A0F', fontWeight: 700, fontSize: 14,
                cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? 'Creating...' : 'Start Experiment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton / Error ────────────────────────────────────────────────

function ExperimentsSkeleton() {
  const pulse = { borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' };
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...pulse, height: 100 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...pulse, height: 80 }} />
          <div style={{ ...pulse, height: 80 }} />
        </div>
        <div style={{ ...pulse, height: 400 }} />
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', gap: 16 }}>
      <span style={{ fontSize: 48 }}>{'\u{1F9EA}'}</span>
      <p style={{ margin: 0, fontSize: 15 }}>{message}</p>
      <button onClick={onRetry} style={{
        padding: '10px 24px', borderRadius: 10, border: 'none', background: ACCENT,
        color: '#0A0A0F', fontWeight: 700, cursor: 'pointer',
      }}>
        Retry
      </button>
    </div>
  );
}

'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { Diagnosis, DiagnosisType, Severity } from '@mylife/garden';
import {
  fetchActiveDiagnoses, fetchDiagnosisHistory, fetchPlants,
  doCreateDiagnosis, doUpdateDiagnosisStatus,
  engineMatchSymptoms, engineGetAllSymptoms,
} from '../actions';

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';
const DANGER = '#FF453A';

const AMBER = '#F59E0B';

const SEVERITY_COLORS: Record<string, string> = {
  low: ACCENT,
  medium: AMBER,
  high: '#FF6B35',
  critical: DANGER,
};

export default function DiagnosesPage() {
  const [activeDiagnoses, setActiveDiagnoses] = useState<Diagnosis[]>([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [allSymptoms, setAllSymptoms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Symptom matcher
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set());
  const [matchResults, setMatchResults] = useState<unknown[]>([]);
  const [matching, setMatching] = useState(false);

  // New diagnosis form
  const [showForm, setShowForm] = useState(false);
  const [formPlantId, setFormPlantId] = useState('');
  const [formType, setFormType] = useState<DiagnosisType>('pest');
  const [formSeverity, setFormSeverity] = useState<Severity>('moderate');
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
      fetchActiveDiagnoses(),
      fetchPlants(),
      engineGetAllSymptoms(),
    ])
      .then(async ([diags, p, syms]) => {
        if (cancelled) return;
        setActiveDiagnoses(diags as Diagnosis[]);
        setPlants((p as { id: string; name: string }[]).map((pl) => ({ id: pl.id, name: pl.name })));
        setAllSymptoms(syms as string[]);

        // Count resolved from first plant's history (approximate total)
        // Fetch history for all plants to get resolved count
        let resolved = 0;
        try {
          const plantList = p as { id: string }[];
          const historyPromises = plantList.map((pl) =>
            fetchDiagnosisHistory(pl.id).catch(() => [])
          );
          const histories = await Promise.all(historyPromises);
          for (const h of histories) {
            resolved += (h as unknown[]).length;
          }
        } catch {
          /* skip */
        }
        if (!cancelled) setResolvedCount(resolved);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load diagnoses');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  const handleMatch = useCallback(async () => {
    if (selectedSymptoms.size === 0) return;
    setMatching(true);
    try {
      const results = await engineMatchSymptoms(Array.from(selectedSymptoms));
      setMatchResults(results as unknown[]);
    } catch {
      setMatchResults([]);
    } finally {
      setMatching(false);
    }
  }, [selectedSymptoms]);

  const toggleSymptom = useCallback((sym: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  const handleResolve = useCallback(async (id: string) => {
    try {
      await doUpdateDiagnosisStatus(id, 'resolved');
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleStartTreatment = useCallback(async (id: string) => {
    try {
      await doUpdateDiagnosisStatus(id, 'in_treatment');
      refresh();
    } catch {
      /* silent */
    }
  }, [refresh]);

  const handleCreate = useCallback(async () => {
    setSubmitting(true);
    try {
      await doCreateDiagnosis({
        plantId: formPlantId || undefined,
        type: formType as DiagnosisType,
        symptoms: Array.from(selectedSymptoms),
        severity: formSeverity as Severity,
        treatmentNotes: formNotes.trim() || undefined,
      });
      setFormPlantId('');
      setFormType('pest');
      setFormSeverity('moderate');
      setFormNotes('');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formPlantId, formType, formSeverity, formNotes, selectedSymptoms, refresh]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (activeDiagnoses.length === 0 && resolvedCount === 0) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🔬</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No diagnoses yet</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          When your plants show signs of trouble, use the symptom matcher to identify issues and track treatments to recovery.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ New Diagnosis</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Plant Health</h2>
        <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ New Diagnosis</button>
      </div>

      {/* New diagnosis form */}
      {showForm && (
        <div style={{ ...card, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Plant</label>
              <select value={formPlantId} onChange={(e) => setFormPlantId(e.target.value)} style={inputStyle}>
                <option value="">General (no plant)</option>
                {plants.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as DiagnosisType)} style={inputStyle}>
                <option value="pest">Pest</option>
                <option value="disease">Disease</option>
                <option value="nutrient_deficiency">Nutrient Deficiency</option>
                <option value="environmental">Environmental</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
              <label style={{ fontSize: 12, color: TEXT_SEC }}>Severity</label>
              <select value={formSeverity} onChange={(e) => setFormSeverity(e.target.value as Severity)} style={inputStyle}>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Treatment Notes</label>
            <input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional treatment notes"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleCreate} disabled={submitting} style={primaryBtn}>
              {submitting ? 'Creating...' : 'Create Diagnosis'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Active diagnoses */}
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Active Diagnoses ({activeDiagnoses.length})
          </h3>
          {activeDiagnoses.length === 0 && (
            <p style={{ color: TEXT_TER, padding: 16, textAlign: 'center' }}>
              No active diagnoses. Your plants are healthy!
            </p>
          )}
          {activeDiagnoses.map((d) => (
            <div key={d.id} style={{ ...card, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
                  {d.plantId ? (plantMap.get(d.plantId) ?? 'Unknown') : 'General'}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  backgroundColor: `${SEVERITY_COLORS[d.severity] ?? TEXT_SEC}18`,
                  color: SEVERITY_COLORS[d.severity] ?? TEXT_SEC,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {d.severity}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
                  backgroundColor: `${ACCENT}10`, color: TEXT_SEC,
                }}>
                  {d.type}
                </span>
              </div>
              {d.diagnosisName && (
                <p style={{ margin: 0, fontSize: 14, color: TEXT }}>
                  {d.diagnosisName}
                  {d.diagnosisConfidence != null && (
                    <span style={{ color: TEXT_TER, fontSize: 12, marginLeft: 6 }}>
                      ({Math.round(d.diagnosisConfidence * 100)}% confidence)
                    </span>
                  )}
                </p>
              )}
              <p style={{ margin: 0, fontSize: 12, color: TEXT_TER }}>
                Status: {d.treatmentStatus} | {d.diagnosedDate}
              </p>
              {d.treatmentNotes && (
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>{d.treatmentNotes}</p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => handleResolve(d.id)} style={{ ...smallBtn, backgroundColor: ACCENT }}>
                  Resolve
                </button>
                {d.treatmentStatus !== 'in_treatment' && (
                  <button type="button" onClick={() => handleStartTreatment(d.id)} style={{ ...smallBtn, backgroundColor: AMBER }}>
                    Start Treatment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Symptom matcher */}
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Symptom Matcher
          </h3>
          <div style={{ ...card, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allSymptoms.map((sym) => (
                <label
                  key={sym}
                  style={{
                    display: 'flex', gap: 6, alignItems: 'center',
                    padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                    border: selectedSymptoms.has(sym)
                      ? `1px solid ${ACCENT}`
                      : `1px solid ${BORDER}`,
                    backgroundColor: selectedSymptoms.has(sym)
                      ? `${ACCENT}18`
                      : 'transparent',
                    fontSize: 13, color: selectedSymptoms.has(sym) ? ACCENT : TEXT_SEC,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.has(sym)}
                    onChange={() => toggleSymptom(sym)}
                    style={{ display: 'none' }}
                  />
                  {sym}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleMatch}
              disabled={selectedSymptoms.size === 0 || matching}
              style={{
                ...primaryBtn,
                opacity: selectedSymptoms.size === 0 ? 0.5 : 1,
              }}
            >
              {matching ? 'Matching...' : 'Match'}
            </button>
          </div>

          {/* Match results */}
          {matchResults.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT_TER, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Results
              </h4>
              {matchResults.map((r, i) => {
                const result = r as Record<string, unknown>;
                return (
                  <div key={i} style={{ ...card, padding: '12px 20px' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: TEXT }}>
                      {String(result.name ?? result.diagnosis ?? `Match ${i + 1}`)}
                    </p>
                    {result.confidence != null && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: ACCENT }}>
                        {Math.round(Number(result.confidence) * 100)}% match
                      </p>
                    )}
                    {result.description != null && (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>
                        {String(result.description)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* History section */}
      {resolvedCount > 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '20px 24px' }}>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
            {resolvedCount} resolved diagnosis{resolvedCount !== 1 ? 'es' : ''} in history
          </p>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ ...skel, width: 160, height: 32 }} />
        <div style={{ ...skel, width: 160, height: 38 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 120 }} />)}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...skel, height: 200 }} />
        </div>
      </div>
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
const smallBtn: CSSProperties = { borderRadius: 8, color: '#0A0A0F', padding: '6px 14px', fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 12 };
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };

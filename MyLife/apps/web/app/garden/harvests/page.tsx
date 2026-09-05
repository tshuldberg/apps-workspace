'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import type { HarvestRecord, HarvestStats, HarvestUnit } from '@mylife/garden';
import {
  fetchHarvests, fetchHarvestStats, fetchCropTypes, fetchPlants, doCreateHarvest,
} from '../actions';

const UNIT_OPTIONS: HarvestUnit[] = ['grams', 'kg', 'oz', 'lbs', 'count', 'bunches', 'cups'];

const ACCENT = '#22C55E';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';
const SURFACE = '#12121A';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.04)';


type SortCol = 'date' | 'plant' | 'cropType' | 'quantity' | 'qualityRating';
type SortDir = 'asc' | 'desc';

interface PlantLookup {
  id: string;
  name: string;
}

function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`;
  return `${grams} g`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function HarvestsPage() {
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [stats, setStats] = useState<HarvestStats | null>(null);
  const [cropTypes, setCropTypes] = useState<string[]>([]);
  const [plants, setPlants] = useState<PlantLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Year selector
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formPlantId, setFormPlantId] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formUnit, setFormUnit] = useState<HarvestUnit>('grams');
  const [formCropType, setFormCropType] = useState('');
  const [formQuality, setFormQuality] = useState('');
  const [formDate, setFormDate] = useState('');
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

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    Promise.all([
      fetchHarvests({ startDate, endDate }),
      fetchHarvestStats(selectedYear),
      fetchCropTypes(),
      fetchPlants(),
    ])
      .then(([h, s, ct, p]) => {
        if (cancelled) return;
        setHarvests(h as HarvestRecord[]);
        setStats(s as HarvestStats);
        setCropTypes(ct as string[]);
        setPlants(p as PlantLookup[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load harvests');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedYear, tick]);

  // Sorted harvests
  const sorted = useMemo(() => {
    const list = [...harvests];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortCol === 'plant') cmp = (plantMap.get(a.plantId) ?? '').localeCompare(plantMap.get(b.plantId) ?? '');
      else if (sortCol === 'cropType') cmp = (a.cropType ?? '').localeCompare(b.cropType ?? '');
      else if (sortCol === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortCol === 'qualityRating') cmp = (a.qualityRating ?? 0) - (b.qualityRating ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [harvests, sortCol, sortDir, plantMap]);

  // Crop breakdown
  const cropBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of harvests) {
      const key = h.cropType ?? 'Unknown';
      m.set(key, (m.get(key) ?? 0) + h.quantity);
    }
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    return entries;
  }, [harvests]);

  const maxCropWeight = useMemo(() => {
    if (cropBreakdown.length === 0) return 1;
    return cropBreakdown[0]?.[1] ?? 1;
  }, [cropBreakdown]);

  const toggleSort = useCallback((col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }, [sortCol]);

  const sortArrow = (col: SortCol) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const handleCreate = useCallback(async () => {
    if (!formPlantId || !formQty) return;
    setSubmitting(true);
    try {
      await doCreateHarvest({
        plantId: formPlantId,
        quantity: parseFloat(formQty) || 0,
        unit: formUnit || undefined,
        cropType: formCropType.trim() || undefined,
        qualityRating: formQuality ? parseInt(formQuality, 10) : undefined,
        notes: formNotes.trim() || undefined,
        date: formDate || undefined,
      });
      setFormPlantId('');
      setFormQty('');
      setFormUnit('grams');
      setFormCropType('');
      setFormQuality('');
      setFormDate('');
      setFormNotes('');
      setShowForm(false);
      refresh();
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [formPlantId, formQty, formUnit, formCropType, formQuality, formDate, formNotes, refresh]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (harvests.length === 0 && !showForm) {
    return (
      <div style={{ display: 'grid', gap: 24, justifyItems: 'center', padding: '80px 0', textAlign: 'center' }}>
        <span style={{ fontSize: 64 }}>🧺</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>No harvests logged</h2>
        <p style={{ margin: 0, color: TEXT_SEC, maxWidth: 400 }}>
          Record every harvest to track your yields over time. See which plants produce the most and spot trends across seasons.
        </p>
        <button type="button" onClick={() => setShowForm(true)} style={primaryBtn}>+ Log Harvest</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: TEXT }}>Harvest Log</h2>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={inputStyle}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ Log Harvest</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard
          label="Total Weight"
          value={stats ? formatWeight(stats.totalQuantity) : '0 g'}
        />
        <StatCard
          label="Total Harvests"
          value={String(stats?.totalHarvests ?? 0)}
        />
        <StatCard
          label="Top Producer"
          value={stats?.topProducer ? stats.topProducer.plantName : 'None yet'}
          sub={stats?.topProducer ? formatWeight(stats.topProducer.total) : undefined}
        />
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ ...card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Plant</label>
            <select value={formPlantId} onChange={(e) => setFormPlantId(e.target.value)} style={inputStyle}>
              <option value="">Select plant...</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 90 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Quantity</label>
            <input type="number" value={formQty} onChange={(e) => setFormQty(e.target.value)} min={0} step="any" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 100 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Unit</label>
            <select value={formUnit} onChange={(e) => setFormUnit(e.target.value as HarvestUnit)} style={inputStyle}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Crop Type</label>
            <input value={formCropType} onChange={(e) => setFormCropType(e.target.value)} placeholder="e.g. Tomato" style={inputStyle} list="crop-types" />
            <datalist id="crop-types">
              {cropTypes.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 90 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Quality</label>
            <select value={formQuality} onChange={(e) => setFormQuality(e.target.value)} style={inputStyle}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5].map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 140 }}>
            <label style={{ fontSize: 12, color: TEXT_SEC }}>Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={inputStyle} />
          </div>
          <button type="button" onClick={handleCreate} disabled={submitting || !formPlantId || !formQty} style={primaryBtn}>
            {submitting ? 'Saving...' : 'Log'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
        </div>
      )}

      {/* Data table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {([['date', 'Date'], ['plant', 'Plant'], ['cropType', 'Crop'], ['quantity', 'Qty'], ['qualityRating', 'Quality']] as [SortCol, string][]).map(([col, label]) => (
                <th
                  key={col}
                  onClick={() => toggleSort(col)}
                  style={{
                    textAlign: 'left', padding: '10px 14px', color: TEXT_SEC, fontWeight: 600,
                    fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8,
                    borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {label}{sortArrow(col)}
                </th>
              ))}
              <th style={{
                textAlign: 'left', padding: '10px 14px', color: TEXT_SEC, fontWeight: 600,
                fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: 0.8,
                borderBottom: `1px solid ${BORDER}`,
              }}>
                Unit
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '10px 14px', color: TEXT_SEC }}>{formatDate(h.date)}</td>
                <td style={{ padding: '10px 14px', color: TEXT, fontWeight: 500 }}>{plantMap.get(h.plantId) ?? 'Unknown'}</td>
                <td style={{ padding: '10px 14px', color: TEXT_SEC }}>{h.cropType ?? '-'}</td>
                <td style={{ padding: '10px 14px', color: ACCENT, fontWeight: 600 }}>{h.quantity}</td>
                <td style={{ padding: '10px 14px', color: TEXT_SEC }}>
                  {h.qualityRating != null ? <QualityStars rating={h.qualityRating} /> : '-'}
                </td>
                <td style={{ padding: '10px 14px', color: TEXT_TER, fontSize: 12 }}>{h.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Crop breakdown bar chart */}
      {cropBreakdown.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>Crop Breakdown</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {cropBreakdown.map(([crop, total]) => (
              <div key={crop} style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: TEXT }}>{crop}</span>
                  <span style={{ color: TEXT_SEC }}>{formatWeight(total)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: ACCENT,
                    width: `${Math.max((total / maxCropWeight) * 100, 2)}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QualityStars({ rating }: { rating: number }) {
  return (
    <span style={{ letterSpacing: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < rating ? '#F59E0B' : TEXT_TER, fontSize: 12 }}>
          {i < rating ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
      <p style={{ margin: 0, fontSize: 12, color: TEXT_SEC }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: ACCENT }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_TER }}>{sub}</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...skel, width: 160, height: 32 }} />
          <div style={{ ...skel, width: 80, height: 32 }} />
        </div>
        <div style={{ ...skel, width: 130, height: 38 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ ...skel, height: 90 }} />)}
      </div>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} style={{ ...skel, height: 48 }} />)}
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
const ghostBtn: CSSProperties = { borderRadius: 999, backgroundColor: 'transparent', color: TEXT_SEC, padding: '10px 18px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${BORDER}`, fontSize: 14 };
const inputStyle: CSSProperties = { borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT, padding: '8px 12px', fontSize: 14,  };
const skel: CSSProperties = { borderRadius: 20, backgroundColor: SURFACE };

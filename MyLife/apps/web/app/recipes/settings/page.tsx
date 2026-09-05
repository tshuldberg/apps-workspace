'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchDefaultServings,
  fetchMeasurementSystem,
  fetchSetting,
  saveSetting,
} from '../actions';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EQUIPMENT_OPTIONS = [
  { key: 'oven', label: 'Oven' },
  { key: 'air_fryer', label: 'Air Fryer' },
  { key: 'grill', label: 'Grill' },
  { key: 'slow_cooker', label: 'Slow Cooker' },
  { key: 'instant_pot', label: 'Instant Pot' },
  { key: 'sous_vide', label: 'Sous Vide' },
];

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = {
  page: {
    minHeight: '100vh',
    background: '#131318',
    color: '#E4E1E9',
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif",
    paddingBottom: 120,
  } as React.CSSProperties,
  topLabel: {
    padding: '28px 32px 0',
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'rgba(228,225,233,0.5)',
  } as React.CSSProperties,
  header: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '32px 32px 0',
  } as React.CSSProperties,
  title: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#E4E1E9',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 14,
    color: '#D6C3B5',
    marginTop: 8,
    lineHeight: 1.6,
  } as React.CSSProperties,
  content: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '0 32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 48,
    marginTop: 40,
  } as React.CSSProperties,
  /* Section */
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  } as React.CSSProperties,
  sectionNum: {
    fontSize: 10,
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: '#FFB877',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  sectionLine: {
    height: 1,
    flex: 1,
    background: '#35343A',
  } as React.CSSProperties,
  card: {
    background: '#1B1B20',
    borderRadius: 16,
    padding: 32,
    transition: 'background 0.3s, transform 0.3s',
  } as React.CSSProperties,
  /* Row inside card */
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  rowLabel: {
    fontWeight: 600,
    fontSize: 15,
    color: '#E4E1E9',
  } as React.CSSProperties,
  rowSub: {
    fontSize: 12,
    color: '#D6C3B5',
    marginTop: 2,
  } as React.CSSProperties,
  /* Stepper */
  stepper: {
    display: 'flex',
    alignItems: 'center',
    background: '#0E0E13',
    borderRadius: 9999,
    padding: 4,
  } as React.CSSProperties,
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    border: 'none',
    background: 'transparent',
    color: '#FFB877',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  stepperVal: {
    padding: '0 16px',
    fontWeight: 700,
    fontSize: 16,
    color: '#E4E1E9',
    minWidth: 24,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  /* Toggle group (metric/imperial) */
  toggleGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginTop: 12,
  } as React.CSSProperties,
  toggleBtn: (active: boolean): React.CSSProperties => ({
    padding: '12px 16px',
    borderRadius: 9999,
    border: active ? '1px solid rgba(255,184,119,0.4)' : 'none',
    background: active ? '#35343A' : '#0E0E13',
    color: active ? '#FFB877' : '#D6C3B5',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  }),
  toggleLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: '#D6C3B5',
  } as React.CSSProperties,
  /* Dietary tag chips */
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 12,
  } as React.CSSProperties,
  chip: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: active ? 'rgba(201,137,77,0.2)' : '#2A292F',
    color: active ? '#FFB877' : '#E4E1E9',
    transition: 'all 0.2s',
  }),
  chipX: {
    fontSize: 12,
    opacity: 0.7,
    cursor: 'pointer',
  } as React.CSSProperties,
  addChipBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    border: '1px dashed rgba(159,142,129,0.5)',
    color: '#D6C3B5',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  chipNote: {
    fontSize: 12,
    color: '#D6C3B5',
    marginBottom: 20,
  } as React.CSSProperties,
  /* Toggle switch */
  toggle: (on: boolean): React.CSSProperties => ({
    width: 48,
    height: 24,
    borderRadius: 9999,
    background: on ? '#FFB877' : '#0E0E13',
    border: on ? 'none' : '1px solid #52443A',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background 0.2s',
    flexShrink: 0,
  }),
  toggleDot: (on: boolean): React.CSSProperties => ({
    width: 16,
    height: 16,
    borderRadius: 9999,
    background: on ? '#4B2700' : '#D6C3B5',
    position: 'absolute',
    top: on ? 4 : 3,
    left: on ? 28 : 4,
    transition: 'left 0.2s, background 0.2s',
  }),
  /* Equipment grid */
  equipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginTop: 16,
  } as React.CSSProperties,
  equipCard: (active: boolean): React.CSSProperties => ({
    aspectRatio: '1',
    borderRadius: 12,
    background: active ? 'rgba(255,184,119,0.05)' : '#0E0E13',
    border: active ? '1px solid rgba(255,184,119,0.5)' : '1px solid rgba(82,68,58,0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }),
  equipLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  equipIcon: (active: boolean): React.CSSProperties => ({
    fontSize: 28,
    color: active ? '#FFB877' : 'rgba(255,184,119,0.4)',
  }),
  equipSectionLabel: {
    fontSize: 10,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
    color: '#D6C3B5',
  } as React.CSSProperties,
  /* Data management */
  dataGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  } as React.CSSProperties,
  dataCard: {
    background: '#1B1B20',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 12,
    transition: 'background 0.3s',
  } as React.CSSProperties,
  dataIconWrap: (color: string): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: 9999,
    background: `${color}15`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color,
  }),
  dataTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: '#E4E1E9',
  } as React.CSSProperties,
  dataSub: {
    fontSize: 10,
    color: '#D6C3B5',
    marginTop: 2,
  } as React.CSSProperties,
  dataBtn: {
    width: '100%',
    padding: '8px 0',
    borderRadius: 9999,
    border: 'none',
    background: '#35343A',
    color: '#E4E1E9',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    marginTop: 'auto',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  cacheRow: {
    background: '#1B1B20',
    borderRadius: 16,
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    transition: 'background 0.3s',
  } as React.CSSProperties,
  cacheLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as React.CSSProperties,
  cacheTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: '#FFB4AB',
  } as React.CSSProperties,
  cacheSub: {
    fontSize: 10,
    color: '#D6C3B5',
    marginTop: 2,
  } as React.CSSProperties,
  cacheBtn: {
    padding: '8px 24px',
    borderRadius: 9999,
    background: 'transparent',
    border: '1px solid rgba(255,180,171,0.3)',
    color: '#FFB4AB',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  /* Sticky save footer */
  saveBar: {
    position: 'sticky' as const,
    bottom: 32,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 40,
    marginTop: 32,
  } as React.CSSProperties,
  saveBarInner: {
    background: 'rgba(27,27,32,0.8)',
    backdropFilter: 'blur(20px)',
    padding: 8,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.05)',
  } as React.CSSProperties,
  saveBtn: {
    padding: '12px 32px',
    borderRadius: 9999,
    border: 'none',
    background: 'linear-gradient(135deg, #FFB877, #C9894D)',
    color: '#4B2700',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(201,137,77,0.3)',
    transition: 'transform 0.15s',
  } as React.CSSProperties,
  discardBtn: {
    padding: '12px 24px',
    borderRadius: 9999,
    border: 'none',
    background: 'transparent',
    color: '#D6C3B5',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  /* Add dietary modal */
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  } as React.CSSProperties,
  modal: {
    background: '#1F1F25',
    borderRadius: 16,
    padding: 32,
    width: 380,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  } as React.CSSProperties,
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#E4E1E9',
    margin: 0,
  } as React.CSSProperties,
  modalInput: {
    width: '100%',
    background: '#35343A',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: '#E4E1E9',
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  modalRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  modalCancel: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 9999,
    padding: '8px 20px',
    color: '#D6C3B5',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  modalSave: {
    background: 'linear-gradient(135deg, #FFB877, #C9894D)',
    border: 'none',
    borderRadius: 9999,
    padding: '8px 20px',
    color: '#4B2700',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.05)',
    margin: '24px 0',
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  // 01: Defaults
  const [servings, setServings] = useState(2);
  const [measurement, setMeasurement] = useState<'metric' | 'imperial'>('metric');

  // 02: Dietary Restrictions
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [showAddDietary, setShowAddDietary] = useState(false);
  const [newDietary, setNewDietary] = useState('');

  // 03: Cooking Preferences
  const [autoScale, setAutoScale] = useState(true);
  const [smartSubs, setSmartSubs] = useState(false);
  const [equipment, setEquipment] = useState<string[]>([]);

  // Original values for discard
  const [origServings, setOrigServings] = useState(2);
  const [origMeasurement, setOrigMeasurement] = useState<'metric' | 'imperial'>('metric');
  const [origDietaryTags, setOrigDietaryTags] = useState<string[]>([]);
  const [origAutoScale, setOrigAutoScale] = useState(true);
  const [origSmartSubs, setOrigSmartSubs] = useState(false);
  const [origEquipment, setOrigEquipment] = useState<string[]>([]);

  /* ---- load settings ---- */

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [sv, ms, dt, as_, ss, eq] = await Promise.all([
        fetchDefaultServings(),
        fetchMeasurementSystem(),
        fetchSetting('dietary_restrictions'),
        fetchSetting('auto_scale'),
        fetchSetting('smart_substitutions'),
        fetchSetting('equipment'),
      ]);

      const svVal = typeof sv === 'number' ? sv : 2;
      const msVal = (ms === 'imperial' ? 'imperial' : 'metric') as 'metric' | 'imperial';
      const dtVal: string[] = dt ? (typeof dt === 'string' ? JSON.parse(dt) : []) : [];
      const asVal = as_ !== '0' && as_ !== 'false';
      const ssVal = ss === '1' || ss === 'true';
      const eqVal: string[] = eq ? (typeof eq === 'string' ? JSON.parse(eq) : []) : [];

      setServings(svVal);
      setMeasurement(msVal);
      setDietaryTags(dtVal);
      setAutoScale(asVal);
      setSmartSubs(ssVal);
      setEquipment(eqVal);

      setOrigServings(svVal);
      setOrigMeasurement(msVal);
      setOrigDietaryTags([...dtVal]);
      setOrigAutoScale(asVal);
      setOrigSmartSubs(ssVal);
      setOrigEquipment([...eqVal]);

      setDirty(false);
    } catch {
      // use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /* ---- dirty tracking ---- */

  function markDirty() {
    setDirty(true);
  }

  /* ---- save ---- */

  async function handleSave() {
    try {
      await Promise.all([
        saveSetting('default_servings', String(servings)),
        saveSetting('measurement_system', measurement),
        saveSetting('dietary_restrictions', JSON.stringify(dietaryTags)),
        saveSetting('auto_scale', autoScale ? '1' : '0'),
        saveSetting('smart_substitutions', smartSubs ? '1' : '0'),
        saveSetting('equipment', JSON.stringify(equipment)),
      ]);
      setOrigServings(servings);
      setOrigMeasurement(measurement);
      setOrigDietaryTags([...dietaryTags]);
      setOrigAutoScale(autoScale);
      setOrigSmartSubs(smartSubs);
      setOrigEquipment([...equipment]);
      setDirty(false);
    } catch {
      // silent
    }
  }

  function handleDiscard() {
    setServings(origServings);
    setMeasurement(origMeasurement);
    setDietaryTags([...origDietaryTags]);
    setAutoScale(origAutoScale);
    setSmartSubs(origSmartSubs);
    setEquipment([...origEquipment]);
    setDirty(false);
  }

  /* ---- dietary ---- */

  function addDietaryTag() {
    const tag = newDietary.trim();
    if (!tag || dietaryTags.includes(tag)) return;
    setDietaryTags((prev) => [...prev, tag]);
    setNewDietary('');
    setShowAddDietary(false);
    markDirty();
  }

  function removeDietaryTag(tag: string) {
    setDietaryTags((prev) => prev.filter((t) => t !== tag));
    markDirty();
  }

  /* ---- equipment ---- */

  function toggleEquipment(key: string) {
    setEquipment((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
    markDirty();
  }

  /* ---- render ---- */

  if (loading) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#D6C3B5', fontSize: 14 }}>Loading settings...</span>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Top label */}
      <div style={s.topLabel}>System Preferences</div>

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Settings</h1>
        <p style={s.subtitle}>
          Configure your digital culinary sanctuary. All changes are automatically synced to your private cloud.
        </p>
      </div>

      <div style={s.content}>
        {/* 01: Defaults */}
        <section>
          <div style={s.sectionHeader}>
            <span style={s.sectionNum}>01 / Defaults</span>
            <div style={s.sectionLine} />
          </div>
          <div style={s.card}>
            <div style={s.row}>
              <div>
                <div style={s.rowLabel}>Default Servings</div>
                <div style={s.rowSub}>Standard portion size for new imports</div>
              </div>
              <div style={s.stepper}>
                <button
                  style={s.stepperBtn}
                  onClick={() => { setServings((v) => Math.max(1, v - 1)); markDirty(); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2A292F'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  -
                </button>
                <span style={s.stepperVal}>{servings}</span>
                <button
                  style={s.stepperBtn}
                  onClick={() => { setServings((v) => Math.min(20, v + 1)); markDirty(); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2A292F'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={s.divider} />

            <div>
              <div style={s.toggleLabel}>Measurement System</div>
              <div style={s.toggleGroup}>
                <button
                  style={s.toggleBtn(measurement === 'metric')}
                  onClick={() => { setMeasurement('metric'); markDirty(); }}
                >
                  Metric (kg/ml)
                </button>
                <button
                  style={s.toggleBtn(measurement === 'imperial')}
                  onClick={() => { setMeasurement('imperial'); markDirty(); }}
                >
                  Imperial (lb/oz)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 02: Dietary Restrictions */}
        <section>
          <div style={s.sectionHeader}>
            <span style={s.sectionNum}>02 / Dietary Restrictions</span>
            <div style={s.sectionLine} />
          </div>
          <div style={s.card}>
            <p style={s.chipNote}>
              The curator will highlight recipes matching these filters or flag potential allergens in your library.
            </p>
            <div style={s.chipWrap}>
              {dietaryTags.map((tag) => (
                <button
                  key={tag}
                  style={s.chip(true)}
                  onClick={() => removeDietaryTag(tag)}
                >
                  <span>{tag}</span>
                  <span style={s.chipX}>{'\u2715'}</span>
                </button>
              ))}
              <button
                style={s.addChipBtn}
                onClick={() => setShowAddDietary(true)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,184,119,0.5)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(159,142,129,0.5)'; }}
              >
                <span>+</span>
                <span>Add Filter</span>
              </button>
            </div>
          </div>
        </section>

        {/* 03: Cooking Preferences */}
        <section>
          <div style={s.sectionHeader}>
            <span style={s.sectionNum}>03 / Cooking Preferences</span>
            <div style={s.sectionLine} />
          </div>
          <div style={s.card}>
            <div style={s.row}>
              <div>
                <div style={s.rowLabel}>Auto-Scale Ingredients</div>
                <div style={s.rowSub}>Adjust quantities when serving size changes</div>
              </div>
              <div
                style={s.toggle(autoScale)}
                onClick={() => { setAutoScale((v) => !v); markDirty(); }}
              >
                <div style={s.toggleDot(autoScale)} />
              </div>
            </div>

            <div style={s.divider} />

            <div style={s.row}>
              <div>
                <div style={s.rowLabel}>Smart Substitutions</div>
                <div style={s.rowSub}>Suggest alternatives based on dietary profile</div>
              </div>
              <div
                style={s.toggle(smartSubs)}
                onClick={() => { setSmartSubs((v) => !v); markDirty(); }}
              >
                <div style={s.toggleDot(smartSubs)} />
              </div>
            </div>

            <div style={s.divider} />

            <div>
              <div style={s.equipSectionLabel}>Kitchen Equipment Profile</div>
              <div style={s.equipGrid}>
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const active = equipment.includes(eq.key);
                  return (
                    <div
                      key={eq.key}
                      style={s.equipCard(active)}
                      onClick={() => toggleEquipment(eq.key)}
                      onMouseEnter={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,184,119,0.5)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(82,68,58,0.3)';
                      }}
                    >
                      <span style={s.equipIcon(active)}>{eq.label.charAt(0)}</span>
                      <span style={s.equipLabel}>{eq.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 04: Data Management */}
        <section>
          <div style={s.sectionHeader}>
            <span style={s.sectionNum}>04 / Data Management</span>
            <div style={s.sectionLine} />
          </div>
          <div style={s.dataGrid}>
            <div
              style={s.dataCard}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2A292F'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1B1B20'; }}
            >
              <div style={s.dataIconWrap('#FFB877')}>
                <span>{'D'}</span>
              </div>
              <div>
                <div style={s.dataTitle}>Export Library</div>
                <div style={s.dataSub}>Download all recipes in JSON format</div>
              </div>
              <button
                style={s.dataBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FFB877'; e.currentTarget.style.color = '#4B2700'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#35343A'; e.currentTarget.style.color = '#E4E1E9'; }}
              >
                Start Export
              </button>
            </div>
            <div
              style={s.dataCard}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2A292F'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1B1B20'; }}
            >
              <div style={s.dataIconWrap('#E6BFA0')}>
                <span>{'U'}</span>
              </div>
              <div>
                <div style={s.dataTitle}>Bulk Import</div>
                <div style={s.dataSub}>Sync from Paprika or MyCookbook</div>
              </div>
              <button
                style={s.dataBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#E6BFA0'; e.currentTarget.style.color = '#432B15'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#35343A'; e.currentTarget.style.color = '#E4E1E9'; }}
              >
                Import Files
              </button>
            </div>
          </div>
          <div
            style={s.cacheRow}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#2A292F'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#1B1B20'; }}
          >
            <div style={s.cacheLeft}>
              <div style={s.dataIconWrap('#FFB4AB')}>
                <span>{'X'}</span>
              </div>
              <div>
                <div style={s.cacheTitle}>Purge Local Cache</div>
                <div style={s.cacheSub}>Free up recipe image storage</div>
              </div>
            </div>
            <button
              style={s.cacheBtn}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,180,171,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              Clear
            </button>
          </div>
        </section>

        {/* Save/Discard footer */}
        {dirty && (
          <div style={s.saveBar}>
            <div style={s.saveBarInner}>
              <button
                style={s.saveBtn}
                onClick={handleSave}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Save Changes
              </button>
              <button
                style={s.discardBtn}
                onClick={handleDiscard}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Dietary Modal */}
      {showAddDietary && (
        <div style={s.overlay} onClick={() => setShowAddDietary(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={s.modalTitle}>Add Dietary Filter</h3>
            <input
              style={s.modalInput}
              placeholder="e.g. Gluten-Free, Vegan, Nut-Free..."
              value={newDietary}
              onChange={(e) => setNewDietary(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDietaryTag()}
              autoFocus
            />
            <div style={s.modalRow}>
              <button style={s.modalCancel} onClick={() => setShowAddDietary(false)}>
                Cancel
              </button>
              <button style={s.modalSave} onClick={addDietaryTag}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

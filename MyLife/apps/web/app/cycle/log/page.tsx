'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  MOOD_SYMPTOMS,
  PHYSICAL_SYMPTOMS,
  type FlowLevel,
} from '@mylife/cycle';
import { fetchCycleDayBundle, saveCycleLogEntry } from '../actions';
import {
  TOKENS,
  chipStyle,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  panelStyle,
  subtitleStyle,
  textareaStyle,
  titleStyle,
} from '../ui';
import {
  FEELING_OPTIONS,
  addIsoDays,
  formatLongDate,
  formatSymptomLabel,
  isIsoDate,
} from '../utils';

type CycleDayBundle = Awaited<ReturnType<typeof fetchCycleDayBundle>>;

const FLOW_OPTIONS: Array<{
  key: FlowLevel | 'none';
  label: string;
  icon: string;
  color: string;
}> = [
  { key: 'none', label: 'None', icon: '0', color: 'rgba(255,255,255,0.35)' },
  { key: 'spotting', label: 'Spotting', icon: '•', color: '#F9A8D4' },
  { key: 'light', label: 'Light', icon: '◔', color: '#FDA4AF' },
  { key: 'medium', label: 'Medium', icon: '◕', color: '#F472B6' },
  { key: 'heavy', label: 'Heavy', icon: '⬤', color: '#EF4444' },
];

function toggleValue(values: string[], nextValue: string): string[] {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function DateNavigator({
  date,
  onChange,
}: {
  date: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(addIsoDays(date, -1))}
        style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <div style={{ textAlign: 'center' }}>
        <p style={eyebrowStyle}>Daily Log</p>
        <h1 style={{ ...titleStyle, fontSize: 34, marginTop: 10 }}>Today</h1>
        <p style={{ ...subtitleStyle, marginTop: 8 }}>{formatLongDate(date)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(addIsoDays(date, 1))}
        style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SymptomSection({
  title,
  accent,
  values,
  selected,
  onToggle,
}: {
  title: string;
  accent: string;
  values: readonly string[];
  selected: string[];
  onToggle: (symptom: string) => void;
}) {
  return (
    <section style={{ ...panelStyle('low'), padding: 22 }}>
      <h2 style={{ ...eyebrowStyle, color: accent }}>{title}</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        {values.map((symptom) => {
          const active = selected.includes(symptom);
          return (
            <button
              key={symptom}
              type="button"
              onClick={() => onToggle(symptom)}
              style={chipStyle(active, accent)}
            >
              {formatSymptomLabel(symptom)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CycleLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const initialDate = isIsoDate(dateParam) ? dateParam : new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(initialDate);
  const [bundle, setBundle] = useState<CycleDayBundle | null>(null);
  const [flowLevel, setFlowLevel] = useState<FlowLevel | null>(null);
  const [physicalSymptoms, setPhysicalSymptoms] = useState<string[]>([]);
  const [moodSymptoms, setMoodSymptoms] = useState<string[]>([]);
  const [overallFeeling, setOverallFeeling] = useState<number>(3);
  const [journal, setJournal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const nextBundle = await fetchCycleDayBundle(targetDate);
      setBundle(nextBundle);
      setFlowLevel(nextBundle.day?.flowLevel ?? null);
      setJournal(nextBundle.day?.journal ?? '');
      setOverallFeeling(nextBundle.day?.overallFeeling ?? 3);
      setPhysicalSymptoms(
        nextBundle.day?.symptoms
          .filter((symptom) => symptom.category === 'physical')
          .map((symptom) => symptom.symptom) ?? [],
      );
      setMoodSymptoms(
        nextBundle.day?.symptoms
          .filter((symptom) => symptom.category === 'mood')
          .map((symptom) => symptom.symptom) ?? [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load this day');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await saveCycleLogEntry({
        date,
        flowLevel,
        journal,
        overallFeeling,
        symptoms: [...physicalSymptoms, ...moodSymptoms],
      });
      router.push('/cycle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this log');
      setSaving(false);
    }
  }, [date, flowLevel, journal, overallFeeling, physicalSymptoms, moodSymptoms, router]);

  if (loading) {
    return (
      <div className="cy-form-grid" style={{ maxWidth: 720 }}>
        {[0, 1, 2, 3, 4].map((item) => (
          <div
            key={item}
            style={{
              ...panelStyle('low'),
              minHeight: item === 0 ? 112 : 132,
              opacity: 0.5,
              animation: 'pulse 2s infinite',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="cy-form-grid" style={{ maxWidth: 720 }}>
      <DateNavigator date={date} onChange={setDate} />

      {error ? (
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
          <button
            type="button"
            onClick={() => void load(date)}
            style={{ ...ghostButtonStyle, marginTop: 14 }}
          >
            Retry
          </button>
        </section>
      ) : null}

      <section style={{ ...panelStyle('mid'), padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={eyebrowStyle}>Signal Check-In</p>
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>
              Capture the day clearly
            </h2>
          </div>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.05)',
              color: TOKENS.textSecondary,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {bundle?.day ? 'Updating existing entry' : 'New entry'}
          </div>
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 22 }}>
        <h2 style={eyebrowStyle}>Flow Level</h2>
        <div className="cy-grid-4" style={{ marginTop: 18 }}>
          {FLOW_OPTIONS.map((option) => {
            const active =
              option.key === 'none' ? flowLevel == null : flowLevel === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setFlowLevel(option.key === 'none' ? null : option.key)}
                style={{
                  ...panelStyle(active ? 'high' : 'base'),
                  padding: 18,
                  minHeight: 108,
                  display: 'grid',
                  gap: 10,
                  justifyItems: 'center',
                  alignContent: 'center',
                  color: active ? TOKENS.text : TOKENS.textSecondary,
                  background: active ? 'rgba(255,184,119,0.14)' : undefined,
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 800, color: option.color }}>{option.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <SymptomSection
        title="Physical Symptoms"
        accent={TOKENS.accentLight}
        values={PHYSICAL_SYMPTOMS}
        selected={physicalSymptoms}
        onToggle={(symptom) =>
          setPhysicalSymptoms((current) => toggleValue(current, symptom))
        }
      />

      <SymptomSection
        title="Mood"
        accent="#F472B6"
        values={MOOD_SYMPTOMS}
        selected={moodSymptoms}
        onToggle={(symptom) => setMoodSymptoms((current) => toggleValue(current, symptom))}
      />

      <section style={{ ...panelStyle('low'), padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={eyebrowStyle}>Overall Feeling</h2>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              background: 'rgba(244,114,182,0.12)',
              color: '#F9A8D4',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {FEELING_OPTIONS.find((option) => option.value === overallFeeling)?.label}
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={overallFeeling}
          onChange={(event) => setOverallFeeling(Number(event.target.value))}
          style={{ width: '100%', marginTop: 18, accentColor: '#F472B6' }}
        />
        <div className="cy-grid-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', marginTop: 16 }}>
          {FEELING_OPTIONS.map((option) => {
            const active = overallFeeling === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setOverallFeeling(option.value)}
                style={{
                  ...panelStyle(active ? 'high' : 'base'),
                  padding: '14px 10px',
                  display: 'grid',
                  gap: 8,
                  justifyItems: 'center',
                  background: active ? 'rgba(244,114,182,0.16)' : undefined,
                }}
              >
                <span style={{ fontSize: 24 }}>{option.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? TOKENS.text : TOKENS.textSecondary }}>
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 22 }}>
        <h2 style={eyebrowStyle}>Journal Notes</h2>
        <textarea
          value={journal}
          onChange={(event) => setJournal(event.target.value)}
          placeholder="How did the day feel. Note triggers, cravings, energy, or context you want to remember."
          style={{ ...textareaStyle, marginTop: 18 }}
        />
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/cycle')}
          style={ghostButtonStyle}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          style={gradientButtonStyle}
        >
          {saving ? 'Saving…' : 'Save Log'}
        </button>
      </div>
    </div>
  );
}

export default function CycleLogPage() {
  return (
    <Suspense fallback={null}>
      <CycleLogPageContent />
    </Suspense>
  );
}

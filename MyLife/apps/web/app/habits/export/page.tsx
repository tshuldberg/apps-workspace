'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchExportAllCSV, fetchExportCompletionsCSV, fetchExportHabitsCSV, fetchHabitCount } from '../actions';
import {
  EmptyState,
  GlassPanel,
  MetricTile,
  PageIntro,
  PrimaryButton,
  SectionHeading,
  SymbolIcon,
  formatLongDate,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, HB_XP, withAlpha } from '@mylife/habits';

type ExportKind = 'habits' | 'completions' | 'full';

export default function HabitsExportPage() {
  const [habitCount, setHabitCount] = useState<number | null>(null);
  const [selectedKinds, setSelectedKinds] = useState<Record<ExportKind, boolean>>({
    habits: true,
    completions: true,
    full: false,
  });
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        setHabitCount((await fetchHabitCount()) as number);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load export counts.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const summary = useMemo(() => {
    const enabled = Object.values(selectedKinds).filter(Boolean).length;
    return enabled === 0 ? 'Choose at least one dataset' : `${enabled} datasets selected`;
  }, [selectedKinds]);

  const handleDownload = async (kind: ExportKind) => {
    const csv = kind === 'habits'
      ? await fetchExportHabitsCSV()
      : kind === 'completions'
        ? await fetchExportCompletionsCSV()
        : await fetchExportAllCSV();

    const blob = new Blob([csv as string], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = range.from && range.to ? `-${range.from}-to-${range.to}` : '';
    link.href = url;
    link.download = `myhabits-${kind}${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Export"
        title="Back up your habit system without leaving the desktop shell."
        description="Pick the datasets you want, set an optional date window for the filename, and download a clean CSV snapshot for archiving or analysis."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <MetricTile detail="tracked in the current database" label="Habits in scope" tone={HB_ACCENT_LIGHT} value={loading ? '...' : String(habitCount ?? 0)} />
        <MetricTile detail="habit definitions, completions, or the combined archive" label="Available formats" tone={HB_XP} value="3" />
        <MetricTile detail="exports are generated locally from SQLite" label="Privacy mode" tone={HB_STREAK.fire} value="Offline" />
      </div>

      {error ? (
        <EmptyState body={error} title="Export center unavailable" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
            <SectionHeading detail="Use the date range to label the file you download." title="Export setup" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>From</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>To</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
                  style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {([
                ['habits', 'Habit definitions', 'Core habit records, reminders, and metadata.'],
                ['completions', 'Completion history', 'Check-ins, measurements, and streak-driving activity.'],
                ['full', 'Everything', 'A combined export for analysis or long-term archive.'],
              ] as const).map(([key, label, detail]) => {
                const active = selectedKinds[key];
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKinds((current) => ({ ...current, [key]: !current[key] }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: 16,
                      borderRadius: 20,
                      border: 'none',
                      background: active ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                      color: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>{detail}</div>
                    </div>
                    <SymbolIcon color={active ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY} filled={active} name={active ? 'check_circle' : 'radio_button_unchecked'} />
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail={summary} title="Download" />
            <div style={{ display: 'grid', gap: 12 }}>
              {([
                ['habits', 'Download habits CSV'],
                ['completions', 'Download completions CSV'],
                ['full', 'Download full archive'],
              ] as const).map(([kind, label]) => (
                <PrimaryButton key={kind} onClick={() => void handleDownload(kind)}>
                  <SymbolIcon color="#0E0E13" filled name="download" size={18} />
                  {label}
                </PrimaryButton>
              ))}
            </div>
            <div style={{ padding: 18, borderRadius: 20, background: withAlpha('#ffffff', 0.04), color: HB_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7 }}>
              The export is generated locally from the current SQLite store. If you set a date range, it is used as a filename label so your archive stays organized even when the export itself remains whole-dataset.
            </div>
            <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
              Last reviewed: {formatLongDate(new Date())}
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

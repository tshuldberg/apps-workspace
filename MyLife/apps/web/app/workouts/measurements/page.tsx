'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  doCreateWorkoutMeasurement,
  doDeleteWorkoutMeasurement,
  fetchWorkoutMeasurementsView,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  LineChart,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../ui';

const MEASUREMENT_TYPES = [
  { key: 'weight', label: 'Weight' },
  { key: 'body_fat', label: 'Body Fat' },
  { key: 'chest', label: 'Chest' },
  { key: 'arms', label: 'Arms' },
  { key: 'waist', label: 'Waist' },
  { key: 'legs', label: 'Legs' },
  { key: 'hips', label: 'Hips' },
  { key: 'neck', label: 'Neck' },
] as const;

type MeasurementsView = Awaited<ReturnType<typeof fetchWorkoutMeasurementsView>>;

function formatDisplayDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getMeasurementUnit(
  type: string,
  settings: MeasurementsView['settings'],
): string {
  if (type === 'weight') return settings.bodyWeightUnit;
  if (type === 'body_fat') return '%';
  return settings.bodyWeightUnit === 'kg' ? 'cm' : 'in';
}

export default function WorkoutMeasurementsPage() {
  const [selectedType, setSelectedType] = useState<string>('weight');
  const [view, setView] = useState<MeasurementsView | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [draftDate, setDraftDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutMeasurementsView(selectedType);
        if (cancelled) return;
        setView(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load measurements.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedType]);

  const chartPoints = useMemo(() => {
    if (!view) return [];
    return view.entries
      .slice()
      .reverse()
      .slice(-8)
      .map((entry) => ({
        label: formatDisplayDate(entry.measuredAt),
        value: entry.value,
      }));
  }, [view]);

  const handleSave = async () => {
    if (!view) return;
    const value = Number(draftValue);
    if (!Number.isFinite(value)) {
      setError('Use a numeric value before saving.');
      return;
    }

    try {
      await doCreateWorkoutMeasurement({
        type: selectedType,
        value,
        unit: getMeasurementUnit(selectedType, view.settings),
        measuredAt: new Date(`${draftDate}T12:00:00`).toISOString(),
      });
      const refreshed = await fetchWorkoutMeasurementsView(selectedType);
      setView(refreshed);
      setDraftValue('');
      setShowComposer(false);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save measurement.');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this measurement entry?');
    if (!confirmed) return;

    try {
      await doDeleteWorkoutMeasurement(id);
      const refreshed = await fetchWorkoutMeasurementsView(selectedType);
      setView(refreshed);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete measurement.');
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading measurements...</WorkoutsSurface>;
  }

  if (!view) {
    return (
      <EmptyState
        title="Measurements unavailable"
        body={error ?? 'The measurement tracker could not be loaded.'}
        action={<ActionLink href="/workouts/progress" label="Back To Progress" icon="arrow_back" secondary />}
      />
    );
  }

  const latest = view.entries[0] ?? null;
  const first = view.entries[view.entries.length - 1] ?? null;
  const delta = latest && first ? latest.value - first.value : 0;
  const unit = getMeasurementUnit(selectedType, view.settings);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Measurements"
          title="Body metrics"
          description="Track weight, body-fat, and circumference changes on the same shared workouts data model used by mobile."
          actions={
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              style={{
                border: 'none',
                borderRadius: 999,
                background: WORKOUTS_TOKENS.accent,
                color: '#2E1600',
                padding: '14px 20px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Log Entry
            </button>
          }
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MEASUREMENT_TYPES.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => setSelectedType(type.key)}
              style={chipStyle(selectedType === type.key)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Trend"
            title={MEASUREMENT_TYPES.find((item) => item.key === selectedType)?.label ?? selectedType}
            description={latest ? `Latest: ${latest.value} ${latest.unit}` : 'Add your first entry to render the line.'}
          />
          {chartPoints.length > 0 ? (
            <LineChart points={chartPoints} accent={WORKOUTS_TOKENS.accentLight} />
          ) : (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No data yet for this measurement type.
            </p>
          )}
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Snapshot"
            title={latest ? `${latest.value} ${latest.unit}` : '--'}
            description={
              view.entries.length > 1
                ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} ${unit} versus first log`
                : 'Waiting for more than one entry.'
            }
          />
          <div style={{ display: 'grid', gap: 10 }}>
            {view.entries.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 18,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong>{entry.value} {entry.unit}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {formatDisplayDate(entry.measuredAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(entry.id)}
                  style={chipStyle(false)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>

      {showComposer ? (
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="New Entry"
            title="Log measurement"
            description="Add a new body-metrics point to the timeline."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Value ({unit})</span>
              <input
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                type="number"
                style={{
                  border: 'none',
                  outline: 'none',
                  borderRadius: 16,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                  color: WORKOUTS_TOKENS.text,
                  padding: '12px 14px',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Date</span>
              <input
                value={draftDate}
                onChange={(event) => setDraftDate(event.target.value)}
                type="date"
                style={{
                  border: 'none',
                  outline: 'none',
                  borderRadius: 16,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                  color: WORKOUTS_TOKENS.text,
                  padding: '12px 14px',
                }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => void handleSave()}
              style={{
                border: 'none',
                borderRadius: 999,
                background: WORKOUTS_TOKENS.accent,
                color: '#2E1600',
                padding: '14px 20px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Save Entry
            </button>
            <button type="button" onClick={() => setShowComposer(false)} style={chipStyle(false)}>
              Cancel
            </button>
          </div>
          {error ? <div style={{ color: WORKOUTS_TOKENS.danger }}>{error}</div> : null}
        </WorkoutsSurface>
      ) : null}
    </div>
  );
}

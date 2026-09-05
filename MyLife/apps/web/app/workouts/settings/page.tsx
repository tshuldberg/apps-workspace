'use client';

import { useEffect, useState } from 'react';
import {
  doSaveWorkoutSettings,
  fetchWorkoutSettings,
  type WorkoutEquipmentOption,
  type WorkoutWebSettings,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../ui';

const EQUIPMENT_OPTIONS: Array<{ key: WorkoutEquipmentOption; label: string }> = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'kettlebells', label: 'Kettlebells' },
  { key: 'machines', label: 'Machines' },
  { key: 'bands', label: 'Bands' },
  { key: 'bodyweight', label: 'Bodyweight' },
];

const FOCUS_OPTIONS: WorkoutWebSettings['defaultFocus'][] = [
  'strength',
  'hypertrophy',
  'cardio',
  'mobility',
  'recovery',
];

function toggleEquipment(
  current: WorkoutEquipmentOption[],
  item: WorkoutEquipmentOption,
): WorkoutEquipmentOption[] {
  if (current.includes(item)) {
    return current.filter((value) => value !== item);
  }
  return [...current, item];
}

export default function WorkoutSettingsPage() {
  const [settings, setSettings] = useState<WorkoutWebSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutSettings();
        if (cancelled) return;
        setSettings(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = <K extends keyof WorkoutWebSettings>(
    key: K,
    value: WorkoutWebSettings[K],
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const next = await doSaveWorkoutSettings(settings);
      setSettings(next);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading settings...</WorkoutsSurface>;
  }

  if (!settings) {
    return (
      <EmptyState
        title="Settings unavailable"
        body={error ?? 'The settings surface could not be loaded.'}
        action={<ActionLink href="/workouts" label="Back To Dashboard" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Settings"
          title="Training preferences"
          description="These desktop preferences mirror the same shared settings used by the mobile workouts surfaces."
          actions={
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                border: 'none',
                borderRadius: 999,
                background: WORKOUTS_TOKENS.accent,
                color: '#2E1600',
                padding: '14px 20px',
                fontWeight: 800,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          }
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Identity"
            title="Profile presentation"
            description="These labels feed the workouts shell and social surfaces."
          />
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Display name</span>
            <input
              value={settings.displayName}
              onChange={(event) => updateSettings('displayName', event.target.value)}
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
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Tier label</span>
            <input
              value={settings.tierLabel}
              onChange={(event) => updateSettings('tierLabel', event.target.value)}
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
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Training Defaults"
            title="Focus and units"
            description="Controls the explore recommendations and session defaults."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Default focus</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FOCUS_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateSettings('defaultFocus', item)}
                    style={chipStyle(settings.defaultFocus === item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Weight unit</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['lbs', 'kg'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => {
                      updateSettings('weightUnit', unit);
                      updateSettings('bodyWeightUnit', unit);
                    }}
                    style={chipStyle(settings.weightUnit === unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Distance unit</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['mi', 'km'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => updateSettings('distanceUnit', unit)}
                    style={chipStyle(settings.distanceUnit === unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Gym Kit"
            title="Available equipment"
            description="Used as the quick default for AI generation and explore recommendations."
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EQUIPMENT_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  updateSettings(
                    'availableEquipment',
                    toggleEquipment(settings.availableEquipment, item.key),
                  )
                }
                style={chipStyle(settings.availableEquipment.includes(item.key))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Timers"
            title="Rest and bar defaults"
            description="These values seed live sessions and calculators."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Default rest (seconds)</span>
              <input
                type="number"
                min={15}
                max={600}
                value={settings.defaultRestSeconds}
                onChange={(event) =>
                  updateSettings('defaultRestSeconds', Math.max(15, Number(event.target.value) || 15))
                }
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
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Default barbell weight</span>
              <input
                type="number"
                min={15}
                value={settings.defaultBarbellWeight}
                onChange={(event) =>
                  updateSettings('defaultBarbellWeight', Math.max(15, Number(event.target.value) || 15))
                }
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
        </WorkoutsSurface>
      </div>

      <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
        <SectionTitle
          eyebrow="Automation"
          title="Notifications and sync"
          description="Feature toggles shared across reminders, celebrations, and optional tracking."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            ['autoStartRestTimer', 'Auto start rest timer'],
            ['voiceCommandsEnabled', 'Voice commands'],
            ['workoutReminders', 'Workout reminders'],
            ['restTimerAlerts', 'Rest timer alerts'],
            ['prNotifications', 'PR notifications'],
            ['gpsTrackingEnabled', 'GPS tracking'],
            ['formRecordingsEnabled', 'Form recordings'],
          ].map(([key, label]) => {
            const enabled = settings[key as keyof WorkoutWebSettings] === true;

            return (
            <button
              key={key}
              type="button"
              onClick={() =>
                updateSettings(key as keyof WorkoutWebSettings, !settings[key as keyof WorkoutWebSettings] as never)
              }
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                border: 'none',
                borderRadius: 18,
                background: WORKOUTS_TOKENS.surfaceMid,
                color: WORKOUTS_TOKENS.text,
                cursor: 'pointer',
              }}
            >
              <span>{label}</span>
              <span style={chipStyle(enabled)}>
                {enabled ? 'On' : 'Off'}
              </span>
            </button>
          );
          })}
        </div>

        {error ? <div style={{ color: WORKOUTS_TOKENS.danger }}>{error}</div> : null}
      </WorkoutsSurface>
    </div>
  );
}

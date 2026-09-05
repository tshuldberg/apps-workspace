'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  OverloadRule,
  OverloadRuleType,
  OverloadTrigger,
} from '@mylife/workouts';
import {
  doDeleteWorkoutOverloadRule,
  doSaveWorkoutOverloadRule,
  fetchWorkoutOverloadView,
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

type OverloadView = Awaited<ReturnType<typeof fetchWorkoutOverloadView>>;

type DraftRule = {
  id: string | null;
  exerciseId: string | null;
  ruleType: OverloadRuleType;
  triggerCondition: OverloadTrigger;
  targetReps: string;
  incrementValue: string;
  incrementUnit: 'lbs' | 'kg' | 'reps' | 'percent';
  minSessions: string;
  isActive: boolean;
};

const RULE_TYPES: OverloadRuleType[] = [
  'weight_increment',
  'rep_increment',
  'set_increment',
  'percentage',
];

const TRIGGER_TYPES: OverloadTrigger[] = [
  'all_sets_hit',
  'any_set_hit',
  'average_reps_hit',
];

function toDraft(rule: OverloadRule): DraftRule {
  return {
    id: rule.id,
    exerciseId: rule.exerciseId,
    ruleType: rule.ruleType,
    triggerCondition: rule.triggerCondition,
    targetReps: String(rule.targetReps ?? 10),
    incrementValue: String(rule.incrementValue),
    incrementUnit: rule.incrementUnit,
    minSessions: String(rule.minSessions),
    isActive: rule.isActive,
  };
}

export default function WorkoutOverloadPage() {
  const [view, setView] = useState<OverloadView | null>(null);
  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [editingDefault, setEditingDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutOverloadView();
        if (cancelled) return;
        setView(next);
        setDraft(toDraft(next.defaultRule));
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load overload rules.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const exerciseOptions = useMemo(() => view?.exercises ?? [], [view?.exercises]);

  const refresh = async () => {
    const next = await fetchWorkoutOverloadView();
    setView(next);
    if (editingDefault) {
      setDraft(toDraft(next.defaultRule));
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      await doSaveWorkoutOverloadRule({
        id: draft.id,
        exerciseId: editingDefault ? null : draft.exerciseId,
        ruleType: draft.ruleType,
        triggerCondition: draft.triggerCondition,
        targetReps: Number(draft.targetReps) || 10,
        incrementValue: Number(draft.incrementValue) || 5,
        incrementUnit: draft.incrementUnit,
        minSessions: Number(draft.minSessions) || 1,
        isActive: draft.isActive,
      });
      await refresh();
      setError(null);
      if (!editingDefault) {
        setDraft(null);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save overload rule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this overload rule?');
    if (!confirmed) return;

    try {
      await doDeleteWorkoutOverloadRule(id);
      await refresh();
      setError(null);
      setDraft(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete overload rule.');
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading progressive overload...</WorkoutsSurface>;
  }

  if (!view || !draft) {
    return (
      <EmptyState
        title="Overload unavailable"
        body={error ?? 'The overload surface could not be loaded.'}
        action={<ActionLink href="/workouts/progress" label="Back To Progress" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Progressive Overload"
          title="Rule engine"
          description="Default rules apply across the library, while overrides let you tailor stubborn lifts and movement patterns."
          actions={<ActionLink href="/workouts/progress" label="Back To Progress" icon="arrow_back" secondary />}
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(340px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Default Rule"
            title="Global progression"
            description="This rule applies when an exercise-specific override does not exist."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RULE_TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setEditingDefault(true);
                    setDraft((current) => (current ? { ...current, ruleType: item } : current));
                  }}
                  style={chipStyle(draft.ruleType === item && editingDefault)}
                >
                  {item.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Target reps</span>
                <input
                  type="number"
                  value={draft.targetReps}
                  onChange={(event) => {
                    setEditingDefault(true);
                    setDraft((current) => (current ? { ...current, targetReps: event.target.value } : current));
                  }}
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
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Increment</span>
                <input
                  type="number"
                  value={draft.incrementValue}
                  onChange={(event) => {
                    setEditingDefault(true);
                    setDraft((current) => (current ? { ...current, incrementValue: event.target.value } : current));
                  }}
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
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Min sessions</span>
                <input
                  type="number"
                  value={draft.minSessions}
                  onChange={(event) => {
                    setEditingDefault(true);
                    setDraft((current) => (current ? { ...current, minSessions: event.target.value } : current));
                  }}
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TRIGGER_TYPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setEditingDefault(true);
                    setDraft((current) => (current ? { ...current, triggerCondition: item } : current));
                  }}
                  style={chipStyle(draft.triggerCondition === item && editingDefault)}
                >
                  {item.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

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
              {saving ? 'Saving...' : 'Save Default Rule'}
            </button>
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Override Editor"
            title="Exercise-specific rule"
            description="Start from the global logic, then specialize it for a single movement."
          />
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Exercise</span>
            <select
              value={draft.exerciseId ?? ''}
              onChange={(event) => {
                setEditingDefault(false);
                setDraft((current) =>
                  current ? { ...current, id: null, exerciseId: event.target.value || null } : current,
                );
              }}
              style={{
                border: 'none',
                outline: 'none',
                borderRadius: 16,
                background: WORKOUTS_TOKENS.surfaceHigh,
                color: WORKOUTS_TOKENS.text,
                padding: '12px 14px',
              }}
            >
              <option value="">Select an exercise</option>
              {exerciseOptions.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RULE_TYPES.map((item) => (
                <button
                  key={`override-${item}`}
                  type="button"
                  onClick={() => {
                    setEditingDefault(false);
                    setDraft((current) => (current ? { ...current, ruleType: item } : current));
                  }}
                  style={chipStyle(draft.ruleType === item && !editingDefault)}
                >
                  {item.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <input
                value={draft.targetReps}
                onChange={(event) => {
                  setEditingDefault(false);
                  setDraft((current) => (current ? { ...current, targetReps: event.target.value } : current));
                }}
                placeholder="Target reps"
                style={{
                  border: 'none',
                  outline: 'none',
                  borderRadius: 16,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                  color: WORKOUTS_TOKENS.text,
                  padding: '12px 14px',
                }}
              />
              <input
                value={draft.incrementValue}
                onChange={(event) => {
                  setEditingDefault(false);
                  setDraft((current) => (current ? { ...current, incrementValue: event.target.value } : current));
                }}
                placeholder="Increment"
                style={{
                  border: 'none',
                  outline: 'none',
                  borderRadius: 16,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                  color: WORKOUTS_TOKENS.text,
                  padding: '12px 14px',
                }}
              />
            </div>
            <button type="button" onClick={() => void handleSave()} style={chipStyle(true)}>
              Save Override
            </button>
          </div>
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(340px, 0.9fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Overrides"
            title="Exercise-specific rules"
            description="These replace the default logic for a single exercise."
          />
          {view.overrides.length === 0 ? (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No overrides yet. Use the editor to add one.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {view.overrides.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 18,
                    background: WORKOUTS_TOKENS.surfaceMid,
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>{rule.exerciseName}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                      {rule.ruleType.replace(/_/g, ' ')} · {rule.incrementValue} {rule.incrementUnit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDefault(false);
                      setDraft(toDraft(rule));
                    }}
                    style={chipStyle(false)}
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(rule.id)} style={chipStyle(false)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Suggestions"
            title="Next session nudges"
            description="Computed from the stored history and the effective rule for each exercise."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {view.suggestions.map((item) => (
              <div key={item.exercise.id} style={{ padding: 16, borderRadius: 18, background: WORKOUTS_TOKENS.surfaceHigh, display: 'grid', gap: 6 }}>
                <strong>{item.exercise.name}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  {item.suggestion.ruleApplied.replace(/_/g, ' ')} → {item.suggestion.suggestedWeight != null
                    ? `${item.suggestion.suggestedWeight} ${item.suggestion.unit}`
                    : `${item.suggestion.suggestedReps ?? 0} reps`}
                </span>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>

      {error ? <div style={{ color: WORKOUTS_TOKENS.danger }}>{error}</div> : null}
    </div>
  );
}

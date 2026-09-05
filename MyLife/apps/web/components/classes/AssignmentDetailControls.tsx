'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  AssignmentTimerSnapshot,
  AssignmentStatus,
  GroupMember,
} from '@mylife/classes';
import {
  getTimerElapsedMs,
  getActiveTimer,
  pauseAssignmentTimer,
  startAssignmentTimer,
  stopAssignmentTimer,
  type TimeTrackerStorage,
} from '@mylife/classes';
import {
  deleteAssignmentAction,
  markAssignmentSubmittedAction,
  setAssignmentGradeAction,
  updateAssignmentAction,
  updateAssignmentStatusAction,
  type AssignmentActionResult,
} from '@/app/classes/actions';

const STATUSES: Array<{ value: AssignmentStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
];

const SECTION_STYLE: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: 20,
  display: 'grid',
  gap: 14,
};

const PILL_BTN: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const PRIMARY_BTN: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 999,
  background: 'var(--accent-classes)',
  border: '1px solid var(--accent-classes)',
  color: 'var(--background)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  fontSize: 14,
  width: 100,
};

function showError(result: AssignmentActionResult): string | null {
  if (result.ok) return null;
  return result.error || 'Failed';
}

const webTimerStorage: TimeTrackerStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

function formatDurationLabel(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.round(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function AssignmentStatusControl({
  id,
  current,
}: {
  id: string;
  current: AssignmentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setStatus(next: AssignmentStatus) {
    if (next === current) return;
    setError(null);
    startTransition(async () => {
      const res = await updateAssignmentStatusAction(id, next);
      const err = showError(res);
      if (err) setError(err);
      else router.refresh();
    });
  }

  function submitNow() {
    setError(null);
    startTransition(async () => {
      const res = await markAssignmentSubmittedAction(id);
      const err = showError(res);
      if (err) setError(err);
      else router.refresh();
    });
  }

  return (
    <section style={SECTION_STYLE}>
      <h2 style={sectionTitleStyle}>Status</h2>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUSES.map((s) => {
          const active = current === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              disabled={pending}
              style={{
                ...PILL_BTN,
                background: active ? 'var(--accent-classes)' : PILL_BTN.background,
                borderColor: active ? 'var(--accent-classes)' : 'var(--border)',
                color: active ? 'var(--background)' : PILL_BTN.color,
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {current !== 'submitted' && current !== 'graded' ? (
        <button
          type="button"
          onClick={submitNow}
          disabled={pending}
          style={{
            ...PRIMARY_BTN,
            opacity: pending ? 0.6 : 1,
            cursor: pending ? 'not-allowed' : 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          {pending ? 'Saving…' : 'Mark submitted'}
        </button>
      ) : null}
      {error ? (
        <div style={errorStyle}>{error}</div>
      ) : null}
    </section>
  );
}

export function AssignmentGradeControl({
  id,
  status,
  initialGrade,
  initialMaxGrade,
}: {
  id: string;
  status: AssignmentStatus;
  initialGrade: number | null;
  initialMaxGrade: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grade, setGrade] = useState<string>(
    initialGrade !== null ? String(initialGrade) : '',
  );
  const [maxGrade, setMaxGrade] = useState<string>(
    initialMaxGrade !== null ? String(initialMaxGrade) : '100',
  );
  const [error, setError] = useState<string | null>(null);

  if (status !== 'submitted' && status !== 'graded') {
    return null;
  }

  function save() {
    const g = Number(grade);
    if (!Number.isFinite(g)) {
      setError('Grade must be numeric');
      return;
    }
    const mg = Number(maxGrade);
    setError(null);
    startTransition(async () => {
      const res = await setAssignmentGradeAction(
        id,
        g,
        Number.isFinite(mg) ? mg : undefined,
      );
      const err = showError(res);
      if (err) setError(err);
      else router.refresh();
    });
  }

  return (
    <section style={SECTION_STYLE}>
      <h2 style={sectionTitleStyle}>Grade</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={fieldLabelStyle}>Grade</span>
          <input
            type="number"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={INPUT_STYLE}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={fieldLabelStyle}>Max</span>
          <input
            type="number"
            value={maxGrade}
            onChange={(e) => setMaxGrade(e.target.value)}
            style={INPUT_STYLE}
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            ...PRIMARY_BTN,
            opacity: pending ? 0.6 : 1,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Set grade'}
        </button>
      </div>
      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  );
}

export function AssignmentTimeTracking({
  id,
  classId,
  estimated,
  actual,
}: {
  id: string;
  classId: string;
  estimated: number | null;
  actual: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<number>(actual ?? 0);
  const [activeTimer, setActiveTimer] = useState<AssignmentTimerSnapshot | null>(null);
  const [clockNow, setClockNow] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setValue(actual ?? 0);
  }, [actual]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await getActiveTimer(webTimerStorage);
      if (!cancelled) {
        setActiveTimer(next);
        setClockNow(Date.now());
      }
    }
    void load();
    if (typeof window === 'undefined') return () => {
      cancelled = true;
    };
    window.addEventListener('focus', load);
    window.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
      window.removeEventListener('visibilitychange', load);
    };
  }, []);

  useEffect(() => {
    if (!activeTimer?.is_running || activeTimer.assignment_id !== id) {
      return;
    }
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer?.assignment_id, activeTimer?.is_running, id]);

  function save(next: number) {
    if (next < 0) next = 0;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await updateAssignmentAction(id, { actual_minutes: next });
      const err = showError(res);
      if (err) setError(err);
      else router.refresh();
    });
  }

  async function start() {
    setNotice(null);
    setError(null);
    const result = await startAssignmentTimer(webTimerStorage, id);
    setActiveTimer(result.active);
    setClockNow(Date.now());
    if (result.replaced && result.replaced.assignment_id !== id) {
      setNotice('Stopped a timer running on another assignment.');
    }
  }

  async function pause() {
    setError(null);
    const next = await pauseAssignmentTimer(webTimerStorage);
    setActiveTimer(next);
    setClockNow(Date.now());
  }

  async function stopAndLog() {
    setError(null);
    setNotice(null);
    const stopped = await stopAssignmentTimer(webTimerStorage);
    setActiveTimer(null);
    setClockNow(Date.now());
    if (!stopped || stopped.assignment_id !== id) {
      setNotice('Stopped a timer running on another assignment.');
      return;
    }

    const nextActual = value + stopped.elapsed_minutes;
    setValue(nextActual);
    startTransition(async () => {
      const res = await updateAssignmentAction(id, { actual_minutes: nextActual });
      const err = showError(res);
      if (err) {
        setError(err);
        setValue(actual ?? 0);
      } else {
        setNotice(`Logged ${stopped.elapsed_minutes} min to this assignment.`);
        router.refresh();
      }
    });
  }

  const variance =
    estimated !== null && estimated > 0 ? value - estimated : null;
  const activeForThisAssignment =
    activeTimer !== null && activeTimer.assignment_id === id;
  const liveElapsedMs =
    activeTimer !== null
      ? getTimerElapsedMs(activeTimer, clockNow)
      : 0;

  return (
    <section style={SECTION_STYLE}>
      <h2 style={sectionTitleStyle}>Time tracking</h2>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Estimated: <strong style={{ color: 'var(--text)' }}>
            {estimated !== null ? `${estimated} min` : '—'}
          </strong>
        </div>
        {activeTimer ? (
          <div
            style={{
              fontSize: 13,
              color: activeForThisAssignment ? 'var(--text)' : 'var(--text-secondary)',
              fontWeight: activeForThisAssignment ? 700 : 500,
            }}
          >
            {activeForThisAssignment
              ? activeTimer.is_running
                ? `Working now · ${formatDurationLabel(liveElapsedMs)}`
                : `Paused at ${formatDurationLabel(liveElapsedMs)}`
              : `Another assignment timer is active (${formatDurationLabel(liveElapsedMs)}). Starting here will replace it.`}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!activeForThisAssignment || !activeTimer ? (
            <button
              type="button"
              onClick={start}
              disabled={pending}
              style={{
                ...PRIMARY_BTN,
                opacity: pending ? 0.6 : 1,
                cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              Start working
            </button>
          ) : activeTimer.is_running ? (
            <button
              type="button"
              onClick={pause}
              disabled={pending}
              style={PILL_BTN}
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={pending}
              style={PILL_BTN}
            >
              Resume
            </button>
          )}
          {activeForThisAssignment ? (
            <button
              type="button"
              onClick={stopAndLog}
              disabled={pending}
              style={{
                ...PILL_BTN,
                color: 'var(--text)',
              }}
            >
              Stop + log
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={fieldLabelStyle}>Actual</span>
          <button
            type="button"
            onClick={() => save(value - 15)}
            disabled={pending}
            style={PILL_BTN}
            aria-label="Decrease 15 minutes"
          >
            −15
          </button>
          <span
            style={{
              minWidth: 64,
              textAlign: 'center',
              fontWeight: 700,
              color: 'var(--text)',
              fontSize: 16,
            }}
          >
            {value} min
          </span>
          <button
            type="button"
            onClick={() => save(value + 15)}
            disabled={pending}
            style={PILL_BTN}
            aria-label="Increase 15 minutes"
          >
            +15
          </button>
        </div>
        {variance !== null ? (
          <div
            style={{
              fontSize: 12,
              color:
                variance > 0
                  ? 'var(--danger, #FFB4AB)'
                  : variance < 0
                    ? 'var(--success, #30D158)'
                    : 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            {variance === 0
              ? 'On estimate'
              : variance > 0
                ? `${variance} min over estimate`
                : `${Math.abs(variance)} min under estimate`}
          </div>
        ) : null}
      </div>
      <a
        href={`/classes/study?class_id=${encodeURIComponent(classId)}`}
        style={{
          ...PRIMARY_BTN,
          textDecoration: 'none',
          display: 'inline-block',
          alignSelf: 'flex-start',
        }}
      >
        Start study session
      </a>
      {notice ? (
        <div style={{ ...errorStyle, color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
          {notice}
        </div>
      ) : null}
      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  );
}

export function AssignmentGroupMembers({
  id,
  initial,
}: {
  id: string;
  initial: GroupMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [members, setMembers] = useState<GroupMember[]>(initial);
  const [name, setName] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMembers(initial);
  }, [initial]);

  function persist(next: GroupMember[]) {
    setMembers(next);
    setError(null);
    startTransition(async () => {
      const res = await updateAssignmentAction(id, {
        group_members: next.length > 0 ? next : null,
      });
      const err = showError(res);
      if (err) setError(err);
      else router.refresh();
    });
  }

  function toggle(idx: number) {
    persist(
      members.map((m, i) =>
        i === idx ? { ...m, complete: !m.complete } : m,
      ),
    );
  }

  function toggleMine(idx: number) {
    persist(
      members.map((m, i) =>
        i === idx ? { ...m, is_me: !m.is_me } : m,
      ),
    );
  }

  function setResponsibilitiesFor(idx: number, value: string) {
    persist(
      members.map((m, i) =>
        i === idx ? { ...m, responsibilities: value.trim() || undefined } : m,
      ),
    );
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName('');
    setResponsibilities('');
    persist([
      ...members,
      {
        name: trimmed,
        responsibilities: responsibilities.trim() || undefined,
        complete: false,
      },
    ]);
  }

  function remove(idx: number) {
    persist(members.filter((_, i) => i !== idx));
  }

  return (
    <section style={SECTION_STYLE}>
      <h2 style={sectionTitleStyle}>Group project</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {members.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            No members yet. Add one below.
          </div>
        ) : (
          members.map((m, idx) => (
            <div
              key={`${m.name}-${idx}`}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: m.is_me ? 'rgba(59,130,246,0.14)' : 'var(--surface-elevated)',
                borderColor: m.is_me ? 'var(--accent-classes)' : 'var(--border)',
              }}
            >
              <input
                type="checkbox"
                checked={!!m.complete}
                onChange={() => toggle(idx)}
                disabled={pending}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text)',
                    textDecoration: m.complete ? 'line-through' : 'none',
                  }}
                >
                  {m.name}
                </div>
                <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                  {m.is_me ? (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent-classes)',
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      My responsibilities
                    </div>
                  ) : null}
                  <input
                    defaultValue={m.responsibilities ?? ''}
                    onBlur={(e) => setResponsibilitiesFor(idx, e.target.value)}
                    placeholder="Responsibility assignment"
                    style={{ ...INPUT_STYLE, width: '100%' }}
                  />
                </div>
              </div>
              <label
                style={{
                  display: 'grid',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Mine
                <input
                  type="checkbox"
                  checked={!!m.is_me}
                  onChange={() => toggleMine(idx)}
                  disabled={pending}
                />
              </label>
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={pending}
                style={{
                  ...PILL_BTN,
                  color: 'var(--danger, #FFB4AB)',
                  borderColor: 'var(--danger, #FFB4AB)',
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add member name"
            style={{ ...INPUT_STYLE, width: '100%', flex: 1 }}
          />
          <input
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            placeholder="Responsibility"
            style={{ ...INPUT_STYLE, width: '100%', flex: 1.2 }}
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !name.trim()}
            style={{
              ...PRIMARY_BTN,
              opacity: pending || !name.trim() ? 0.6 : 1,
            }}
          >
            Add
          </button>
        </div>
      </div>
      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  );
}

export function AssignmentDangerZone({
  id,
  classId,
}: {
  id: string;
  classId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this assignment? This cannot be undone.')
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteAssignmentAction(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push('/classes/assignments');
    });
  }

  return (
    <section style={{ ...SECTION_STYLE, borderColor: 'var(--border)' }}>
      <h2 style={sectionTitleStyle}>Actions</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={`/classes/assignments/${id}/edit`}
          style={{
            ...PILL_BTN,
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Edit assignment
        </a>
        <a
          href={`/classes/class/${classId}`}
          style={{
            ...PILL_BTN,
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          Open class
        </a>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          style={{
            ...PILL_BTN,
            color: 'var(--danger, #FFB4AB)',
            borderColor: 'var(--danger, #FFB4AB)',
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--text-secondary)',
  letterSpacing: 1.6,
  textTransform: 'uppercase',
};

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--danger, #FFB4AB)',
};

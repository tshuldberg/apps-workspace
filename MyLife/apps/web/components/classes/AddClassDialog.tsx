'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ALL_DAYS,
  CLASSES_PALETTE,
  DAY_LABELS,
  type Day,
  type TeacherRow,
} from '@mylife/classes';

export interface AddClassDialogProps {
  semesterId: string;
  teachers: TeacherRow[];
  onSubmit: (formData: FormData) => Promise<void>;
}

export function AddClassDialog({
  semesterId,
  teachers,
  onSubmit,
}: AddClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<string>(CLASSES_PALETTE[0]);
  const [days, setDays] = useState<Set<Day>>(new Set(['mon', 'wed']));
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherId, setTeacherId] = useState<string>('');

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers.slice(0, 6);
    return teachers.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [teachers, teacherSearch]);

  function toggleDay(day: Day) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function close() {
    setOpen(false);
    setError(null);
    setColor(CLASSES_PALETTE[0]);
    setDays(new Set(['mon', 'wed']));
    setTeacherSearch('');
    setTeacherId('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const start = String(formData.get('startTime') ?? '');
    const end = String(formData.get('endTime') ?? '');
    if (!name) {
      setError('Class name is required');
      return;
    }
    if (start >= end) {
      setError('End time must be after start time');
      return;
    }
    if (days.size === 0) {
      setError('Select at least one day');
      return;
    }
    formData.set('semesterId', semesterId);
    formData.set('color', color);
    formData.set('teacherId', teacherId);
    formData.set(
      'days',
      Array.from(days).join(','),
    );
    startTransition(async () => {
      try {
        await onSubmit(formData);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '11px 16px',
          borderRadius: 999,
          background: 'var(--accent-classes)',
          color: 'var(--background)',
          fontWeight: 700,
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        + Add Class
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 60,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 580,
          maxHeight: '92vh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: 22,
          border: '1px solid var(--border)',
          padding: 24,
          display: 'grid',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Add Class
          </h2>
          <button
            type="button"
            onClick={close}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        <Field label="Name">
          <input
            name="name"
            placeholder="Intro to Computer Science"
            style={inputStyle}
            required
          />
        </Field>

        <Row>
          <Field label="Code" flex>
            <input name="code" placeholder="CS 101" style={inputStyle} />
          </Field>
          <Field label="Section" flex>
            <input name="section" placeholder="001" style={inputStyle} />
          </Field>
          <Field label="Credits" flex>
            <input
              name="credits"
              type="number"
              min={0}
              defaultValue={3}
              style={inputStyle}
            />
          </Field>
        </Row>

        <Field label="Days">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_DAYS.map((day) => {
              const active = days.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    border: active
                      ? '1px solid rgba(59,130,246,0.55)'
                      : '1px solid var(--border)',
                    background: active
                      ? 'rgba(59,130,246,0.18)'
                      : 'var(--surface-elevated)',
                    color: active
                      ? 'var(--accent-classes)'
                      : 'var(--text-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {DAY_LABELS[day][0]}
                </button>
              );
            })}
          </div>
        </Field>

        <Row>
          <Field label="Start (HH:MM)" flex>
            <input
              name="startTime"
              type="time"
              defaultValue="09:00"
              style={inputStyle}
              required
            />
          </Field>
          <Field label="End (HH:MM)" flex>
            <input
              name="endTime"
              type="time"
              defaultValue="10:15"
              style={inputStyle}
              required
            />
          </Field>
        </Row>

        <Row>
          <Field label="Room" flex>
            <input name="room" placeholder="210" style={inputStyle} />
          </Field>
          <Field label="Building" flex>
            <input name="building" placeholder="Hall A" style={inputStyle} />
          </Field>
        </Row>

        <Field label="Teacher">
          <input
            value={teacherSearch}
            onChange={(e) => {
              setTeacherSearch(e.target.value);
              setTeacherId('');
            }}
            placeholder="Search or quick-create"
            style={inputStyle}
          />
          <input type="hidden" name="teacherSearch" value={teacherSearch} />
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            {filteredTeachers.map((t) => {
              const active = t.id === teacherId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTeacherId(t.id);
                    setTeacherSearch(t.name);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: active
                      ? '1px solid rgba(59,130,246,0.55)'
                      : '1px solid var(--border)',
                    background: active
                      ? 'rgba(59,130,246,0.18)'
                      : 'var(--surface-elevated)',
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
            {teacherSearch.trim() &&
            !filteredTeachers.some(
              (t) =>
                t.name.toLowerCase() === teacherSearch.trim().toLowerCase(),
            ) ? (
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px dashed rgba(59,130,246,0.55)',
                  color: 'var(--text)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Will create &quot;{teacherSearch.trim()}&quot;
              </span>
            ) : null}
          </div>
        </Field>

        <Field label="Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CLASSES_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                aria-label={`Color ${hex}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: hex,
                  border:
                    color === hex
                      ? '2px solid var(--text)'
                      : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>

        <Field label="Grading categories (key:weight, comma separated)">
          <input
            name="categoryWeights"
            placeholder="exams:40,homework:30,participation:20,final:10"
            defaultValue="exams:40,homework:30,participation:20,final:10"
            style={inputStyle}
          />
        </Field>

        <Row>
          <Field label="Target grade (optional)" flex>
            <input
              name="targetGrade"
              type="number"
              placeholder="93"
              style={inputStyle}
            />
          </Field>
          <Field label="Late policy (optional)" flex>
            <input
              name="latePolicy"
              placeholder="-10% per day"
              style={inputStyle}
            />
          </Field>
        </Row>

        {error ? (
          <div
            style={{
              color: 'var(--danger, #FFB4AB)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={close}
            style={{
              padding: '11px 16px',
              borderRadius: 999,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '11px 20px',
              borderRadius: 999,
              background: 'var(--accent-classes)',
              border: 'none',
              color: 'var(--background)',
              fontWeight: 700,
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? 'Saving...' : 'Save Class'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, flex: flex ? 1 : undefined }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
};

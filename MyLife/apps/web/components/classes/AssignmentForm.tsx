'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  type AssignmentInput,
  type AssignmentPriority,
  type AssignmentRow,
  type AssignmentType,
  type ClassRow,
  type GroupMember,
  type RecurrenceFrequency,
} from '@mylife/classes';
import type { AssignmentActionResult } from '@/app/classes/actions';

const TYPES: AssignmentType[] = [
  'homework',
  'essay',
  'project',
  'quiz',
  'exam',
  'lab',
  'presentation',
  'reading',
  'other',
];

const PRIORITIES: AssignmentPriority[] = ['low', 'medium', 'high', 'critical'];
const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];

function defaultDueAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface AssignmentFormInitial {
  title: string;
  classId: string;
  type: AssignmentType;
  priority: AssignmentPriority;
  dueAtLocal: string;
  estimatedMinutes: number;
  weight: string;
  maxGrade: string;
  description: string;
  recurrenceOn: boolean;
  frequency: RecurrenceFrequency;
  interval: number;
  until: string;
  latePolicyOn: boolean;
  latePercent: string;
  lateMaxDays: string;
  groupMembers: GroupMember[];
  dependsOn: string[];
}

export interface AssignmentFormProps {
  classes: ClassRow[];
  classAssignmentsByClass: Record<string, AssignmentRow[]>;
  reminderSummary: string;
  onSubmit: (input: AssignmentInput) => Promise<AssignmentActionResult>;
  initialValues?: Partial<AssignmentFormInitial>;
  submitLabel?: string;
  redirectTo?: string;
}

export function AssignmentForm({
  classes,
  classAssignmentsByClass,
  reminderSummary,
  onSubmit,
  initialValues,
  submitLabel,
  redirectTo,
}: AssignmentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [classId, setClassId] = useState<string>(
    initialValues?.classId ?? classes[0]?.id ?? '',
  );
  const [type, setType] = useState<AssignmentType>(
    initialValues?.type ?? 'homework',
  );
  const [priority, setPriority] = useState<AssignmentPriority>(
    initialValues?.priority ?? 'medium',
  );
  const [dueAtLocal, setDueAtLocal] = useState<string>(
    initialValues?.dueAtLocal ?? defaultDueAt(),
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(
    initialValues?.estimatedMinutes ?? 60,
  );
  const [weight, setWeight] = useState<string>(initialValues?.weight ?? '');
  const [maxGrade, setMaxGrade] = useState<string>(
    initialValues?.maxGrade ?? '100',
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );

  const [recurrenceOn, setRecurrenceOn] = useState(
    initialValues?.recurrenceOn ?? false,
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    initialValues?.frequency ?? 'weekly',
  );
  const [interval, setInterval] = useState<number>(
    initialValues?.interval ?? 1,
  );
  const [until, setUntil] = useState<string>(initialValues?.until ?? '');

  const [latePolicyOn, setLatePolicyOn] = useState(
    initialValues?.latePolicyOn ?? false,
  );
  const [latePercent, setLatePercent] = useState<string>(
    initialValues?.latePercent ?? '10',
  );
  const [lateMaxDays, setLateMaxDays] = useState<string>(
    initialValues?.lateMaxDays ?? '5',
  );

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
    initialValues?.groupMembers ?? [],
  );
  const [dependsOn, setDependsOn] = useState<string[]>(
    initialValues?.dependsOn ?? [],
  );

  const dependencyCandidates = useMemo<AssignmentRow[]>(() => {
    if (!classId) return [];
    return classAssignmentsByClass[classId] ?? [];
  }, [classId, classAssignmentsByClass]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!classId) {
      setError('Pick a class');
      return;
    }

    const dueAtISO = dueAtLocal ? new Date(dueAtLocal).toISOString() : null;
    const untilISO =
      recurrenceOn && until ? new Date(`${until}T23:59`).toISOString() : undefined;

    const input: AssignmentInput = {
      class_id: classId,
      title: title.trim(),
      type,
      priority,
      due_at: dueAtISO,
      estimated_minutes:
        Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
          ? estimatedMinutes
          : null,
      weight: weight.trim() ? Number(weight) : null,
      max_grade: maxGrade.trim() ? Number(maxGrade) : 100,
      description_md: description.trim() || null,
      is_recurring: recurrenceOn,
      recurrence_rule: recurrenceOn
        ? { frequency, interval, ...(untilISO ? { until: untilISO } : {}) }
        : null,
      late_policy: latePolicyOn
        ? {
            percent_per_day: Number(latePercent) || 0,
            max_days: Number(lateMaxDays) || 0,
          }
        : null,
      group_members: groupMembers.length > 0 ? groupMembers : null,
      depends_on: dependsOn.length > 0 ? dependsOn : null,
    };

    startTransition(async () => {
      const result = await onSubmit(input);
      if (result.ok) {
        router.push(redirectTo ?? '/classes/assignments');
      } else {
        setError(result.error);
      }
    });
  }

  const updateMember = (idx: number, patch: Partial<GroupMember>) => {
    setGroupMembers((arr) =>
      arr.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  };
  const removeMember = (idx: number) => {
    setGroupMembers((arr) => arr.filter((_, i) => i !== idx));
  };
  const addMember = () => setGroupMembers((arr) => [...arr, { name: '' }]);

  const toggleDep = (id: string) => {
    setDependsOn((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    );
  };

  if (classes.length === 0) {
    return (
      <div style={panelStyle}>
        <h3 style={{ margin: 0, color: 'var(--text)' }}>Add a class first</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Assignments live inside a class. Add one to your active semester before creating assignments.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
      <Section title="Basics">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Problem set 4"
            style={inputStyle}
            required
          />
        </Field>
        <Field label="Class">
          <ChipRow>
            {classes.map((c) => {
              const accent = c.color || 'var(--accent-classes)';
              const active = classId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClassId(c.id);
                    setDependsOn([]);
                  }}
                  style={{
                    ...chipStyle(active),
                    ...(active
                      ? { background: accent, borderColor: accent, color: 'var(--background)' }
                      : {}),
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: accent,
                      marginRight: 6,
                    }}
                  />
                  {c.code || c.name}
                </button>
              );
            })}
          </ChipRow>
        </Field>
        <Row>
          <Field label="Type" flex>
            <ChipRow>
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={chipStyle(type === t)}
                >
                  {t}
                </button>
              ))}
            </ChipRow>
          </Field>
        </Row>
        <Row>
          <Field label="Priority" flex>
            <ChipRow>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  style={chipStyle(priority === p)}
                >
                  {p}
                </button>
              ))}
            </ChipRow>
          </Field>
        </Row>
      </Section>

      <Section title="Due date">
        <Field label="Due at">
          <input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Row>
          <Field label="Estimated minutes" flex>
            <input
              type="number"
              min={0}
              step={15}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Weight" flex>
            <input
              type="number"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.10"
              style={inputStyle}
            />
          </Field>
          <Field label="Max grade" flex>
            <input
              type="number"
              value={maxGrade}
              onChange={(e) => setMaxGrade(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Row>
        <Field label="Description (markdown)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
      </Section>

      <Section title="Recurrence">
        <Toggle
          label="Repeat on a schedule"
          value={recurrenceOn}
          onChange={setRecurrenceOn}
        />
        {recurrenceOn ? (
          <>
            <Field label="Frequency">
              <ChipRow>
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    style={chipStyle(frequency === f)}
                  >
                    {f}
                  </button>
                ))}
              </ChipRow>
            </Field>
            <Row>
              <Field label="Interval" flex>
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  style={inputStyle}
                />
              </Field>
              <Field label="Until (optional)" flex>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </Row>
          </>
        ) : null}
      </Section>

      <Section title="Late policy">
        <Toggle
          label="Apply late policy"
          value={latePolicyOn}
          onChange={setLatePolicyOn}
        />
        {latePolicyOn ? (
          <Row>
            <Field label="Percent / day" flex>
              <input
                type="number"
                min={0}
                value={latePercent}
                onChange={(e) => setLatePercent(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Max days" flex>
              <input
                type="number"
                min={0}
                value={lateMaxDays}
                onChange={(e) => setLateMaxDays(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </Row>
        ) : null}
      </Section>

      <Section title="Group members">
        <div style={{ display: 'grid', gap: 8 }}>
          {groupMembers.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={m.name}
                onChange={(e) => updateMember(idx, { name: e.target.value })}
                placeholder="Name"
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                value={m.responsibilities ?? ''}
                onChange={(e) =>
                  updateMember(idx, { responsibilities: e.target.value })
                }
                placeholder="Role"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeMember(idx)}
                style={{
                  ...chipStyle(false),
                  color: 'var(--danger, #FFB4AB)',
                  borderColor: 'var(--danger, #FFB4AB)',
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMember}
            style={{
              ...chipStyle(false),
              alignSelf: 'flex-start',
              color: 'var(--accent-classes)',
            }}
          >
            + Add member
          </button>
        </div>
      </Section>

      {dependencyCandidates.length > 0 ? (
        <Section title="Depends on">
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            Pick assignments in this class that must finish first.
          </p>
          <ChipRow>
            {dependencyCandidates.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleDep(a.id)}
                style={chipStyle(dependsOn.includes(a.id))}
              >
                {a.title}
              </button>
            ))}
          </ChipRow>
        </Section>
      ) : null}

      <Section title="Reminders">
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
          Reminders use your global setting: <strong>{reminderSummary}</strong>.
        </p>
        <a
          href="/classes/settings"
          style={{
            color: 'var(--accent-classes)',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Tune reminder offsets in settings →
        </a>
      </Section>

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
          onClick={() => router.back()}
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
          {pending ? 'Saving…' : (submitLabel ?? 'Save assignment')}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={panelStyle}>
      <h2
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-secondary)',
          letterSpacing: 1.6,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
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
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-elevated)',
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <span>{label}</span>
      <span
        style={{
          padding: '4px 10px',
          borderRadius: 999,
          background: value ? 'var(--accent-classes)' : 'transparent',
          border: '1px solid var(--border)',
          color: value ? 'var(--background)' : 'var(--text-secondary)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.4,
        }}
      >
        {value ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}

const panelStyle: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: 20,
  display: 'grid',
  gap: 14,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    border: active
      ? '1px solid var(--accent-classes)'
      : '1px solid var(--border)',
    background: active ? 'rgba(59,130,246,0.18)' : 'var(--surface-elevated)',
    color: active ? 'var(--accent-classes)' : 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'capitalize',
  };
}

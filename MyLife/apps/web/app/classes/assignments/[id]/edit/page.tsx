import { notFound } from 'next/navigation';
import { listAssignmentsByClass, type AssignmentRow, type GroupMember, type LatePolicy, type RecurrenceRule } from '@mylife/classes';
import { getClassesDb, loadAssignmentDetail } from '../../../data';
import { updateAssignmentAction } from '../../../actions';
import { ClassesHero } from '../../../ui';
import {
  AssignmentForm,
  type AssignmentFormInitial,
} from '@/components/classes/AssignmentForm';
import type { AssignmentInput } from '@mylife/classes';

interface PageProps {
  params: Promise<{ id: string }>;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoToDateOnly(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseRecurrence(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as RecurrenceRule) : null;
  } catch {
    return null;
  }
}

function parseLatePolicy(raw: string | null): LatePolicy | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as LatePolicy) : null;
  } catch {
    return null;
  }
}

function parseGroupMembers(raw: string | null): GroupMember[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as GroupMember[]) : [];
  } catch {
    return [];
  }
}

function parseDependsOn(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function buildInitial(row: AssignmentRow): AssignmentFormInitial {
  const recurrence = parseRecurrence(row.recurrence_rule);
  const latePolicy = parseLatePolicy(row.late_policy);
  return {
    title: row.title,
    classId: row.class_id,
    type: row.type,
    priority: row.priority,
    dueAtLocal: isoToLocalInput(row.due_at),
    estimatedMinutes: row.estimated_minutes ?? 60,
    weight: row.weight !== null ? String(row.weight) : '',
    maxGrade: row.max_grade !== null ? String(row.max_grade) : '100',
    description: row.description_md ?? '',
    recurrenceOn: row.is_recurring === 1,
    frequency: recurrence?.frequency ?? 'weekly',
    interval: recurrence?.interval ?? 1,
    until: isoToDateOnly(recurrence?.until),
    latePolicyOn: latePolicy !== null,
    latePercent: latePolicy ? String(latePolicy.percent_per_day) : '10',
    lateMaxDays: latePolicy ? String(latePolicy.max_days) : '5',
    groupMembers: parseGroupMembers(row.group_members),
    dependsOn: parseDependsOn(row.depends_on),
  };
}

export default async function AssignmentEditPage({ params }: PageProps) {
  const { id: assignmentId } = await params;
  const view = loadAssignmentDetail(assignmentId);
  if (!view) notFound();

  const db = getClassesDb();
  const classAssignmentsByClass: Record<string, AssignmentRow[]> = {};
  for (const cls of view.classes) {
    classAssignmentsByClass[cls.id] = listAssignmentsByClass(db, cls.id).filter(
      (a) => a.id !== view.assignment.id,
    );
  }

  const initial = buildInitial(view.assignment);
  const id = view.assignment.id;

  async function handleSubmit(input: AssignmentInput) {
    'use server';
    return updateAssignmentAction(id, input);
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Edit assignment"
        title={view.assignment.title}
        body="Update fields and save. Status changes are validated by the workflow guard."
        actionHref={`/classes/assignments/${id}`}
        actionLabel="Back to detail"
      />
      <AssignmentForm
        classes={view.classes}
        classAssignmentsByClass={classAssignmentsByClass}
        reminderSummary=""
        onSubmit={handleSubmit}
        initialValues={initial}
        submitLabel="Save changes"
        redirectTo={`/classes/assignments/${id}`}
      />
    </div>
  );
}

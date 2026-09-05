import Link from 'next/link';
import {
  loadAssignmentsView,
  type AssignmentDueRange,
  type AssignmentRowVM,
} from '../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesEmptyPanel,
  ClassesHero,
  ClassesSection,
  pillLinkStyle,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from '../ui';
import type { AssignmentStatus } from '@mylife/classes';

interface PageProps {
  searchParams?: Promise<{
    status?: string;
    classId?: string;
    dueRange?: string;
  }>;
}

const STATUSES: Array<{ value: AssignmentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
];

const DUE_RANGES: Array<{ value: AssignmentDueRange; label: string }> = [
  { value: 'all', label: 'All dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Next 7 days' },
  { value: '7d', label: 'Within 7d' },
];

const PRIORITY_DOT: Record<string, string> = {
  low: 'var(--text-tertiary)',
  medium: 'var(--tertiary, #8BCFF0)',
  high: 'var(--primary, #FFB877)',
  critical: 'var(--danger, #FFB4AB)',
};

function statusLabel(s: AssignmentStatus): string {
  switch (s) {
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'graded':
      return 'Graded';
  }
}

function relativeDue(due: string | null, isOverdue: boolean): string {
  if (!due) return 'No due date';
  const dueDate = new Date(due);
  const now = new Date();
  const ms = dueDate.getTime() - now.getTime();
  const days = Math.round(ms / 86400000);
  if (isOverdue) {
    const overdueDays = Math.abs(days);
    if (overdueDays === 0) return 'Overdue today';
    return `Overdue ${overdueDays}d`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days < 7) return `Due in ${days}d`;
  return dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDueAbsolute(due: string | null): string {
  if (!due) return '';
  const d = new Date(due);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseStatus(raw?: string): AssignmentStatus | 'all' {
  if (raw === 'not_started' || raw === 'in_progress' || raw === 'submitted' || raw === 'graded') {
    return raw;
  }
  return 'all';
}

function parseDueRange(raw?: string): AssignmentDueRange {
  if (raw === 'overdue' || raw === 'week' || raw === '7d') return raw;
  return 'all';
}

export default async function ClassesAssignmentsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const status = parseStatus(sp?.status);
  const classId = sp?.classId || 'all';
  const dueRange = parseDueRange(sp?.dueRange);

  const view = loadAssignmentsView({ status, classId, dueRange });

  if (!view.currentSemester) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Assignments"
          title="No active semester"
          body="Create a semester first to start tracking assignments and due dates."
        />
        <ClassesEmptyPanel
          title="Set up a semester first"
          body="Assignments belong to a class inside an active semester."
          actionHref="/classes/settings"
          actionLabel="Open settings"
        />
      </div>
    );
  }

  if (view.classes.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge={view.currentSemester.name}
          title="No classes yet"
          body="Add a class to your semester first. Assignments live inside a class."
          actionHref="/classes"
          actionLabel="Open schedule"
        />
        <ClassesEmptyPanel
          title="No classes"
          body="Create a class on the schedule to unlock assignment tracking."
          actionHref="/classes"
          actionLabel="Add class"
        />
      </div>
    );
  }

  function buildHref(patch: Partial<{ status: string; classId: string; dueRange: string }>) {
    const next = { status, classId, dueRange, ...patch };
    const params = new URLSearchParams();
    if (next.status !== 'all') params.set('status', String(next.status));
    if (next.classId !== 'all') params.set('classId', String(next.classId));
    if (next.dueRange !== 'all') params.set('dueRange', String(next.dueRange));
    const qs = params.toString();
    return qs ? `/classes/assignments?${qs}` : '/classes/assignments';
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge={view.currentSemester.name}
        title="Assignments"
        body={`Reminders use your global setting: ${view.reminderSummary}.`}
        actionHref="/classes/assignments/add"
        actionLabel="+ Add assignment"
      />

      <ClassesSection title="Filters">
        <div style={{ display: 'grid', gap: 12 }}>
          <FilterGroup label="Status">
            {STATUSES.map((s) => (
              <FilterPill
                key={s.value}
                href={buildHref({ status: s.value })}
                active={status === s.value}
                label={s.label}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Due range">
            {DUE_RANGES.map((d) => (
              <FilterPill
                key={d.value}
                href={buildHref({ dueRange: d.value })}
                active={dueRange === d.value}
                label={d.label}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Class">
            <FilterPill
              href={buildHref({ classId: 'all' })}
              active={classId === 'all'}
              label="All classes"
            />
            {view.classes.map((c) => (
              <FilterPill
                key={c.id}
                href={buildHref({ classId: c.id })}
                active={classId === c.id}
                label={c.code || c.name}
                accent={c.color || CLASSES_ACCENT}
              />
            ))}
          </FilterGroup>
        </div>
      </ClassesSection>

      {view.assignments.length === 0 ? (
        <ClassesEmptyPanel
          title="No assignments yet"
          body="No assignments yet. Add your first or import from a class syllabus."
          actionHref="/classes/assignments/add"
          actionLabel="+ Add assignment"
        />
      ) : (
        <ClassesSection title="Queue">
          <div style={{ display: 'grid', gap: 12 }}>
            {view.assignments.map((row) => (
              <AssignmentRowCard key={row.assignment.id} row={row} />
            ))}
          </div>
        </ClassesSection>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/classes" style={pillLinkStyle(false)}>
          Schedule
        </Link>
        <Link href="/classes/grades" style={pillLinkStyle(false)}>
          Grades
        </Link>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          color: TEXT_TERTIARY,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  accent,
}: {
  href: string;
  active: boolean;
  label: string;
  accent?: string;
}) {
  const a = accent || CLASSES_ACCENT;
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        background: active ? a : 'var(--surface-elevated)',
        border: active ? `1px solid ${a}` : '1px solid var(--border)',
        color: active ? 'var(--background)' : TEXT_SECONDARY,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      {accent ? (
        <span
          style={{ width: 8, height: 8, borderRadius: 4, background: a }}
        />
      ) : null}
      {label}
    </Link>
  );
}

function AssignmentRowCard({ row }: { row: AssignmentRowVM }) {
  const accent = row.cls?.color || CLASSES_ACCENT;
  const priorityColor =
    PRIORITY_DOT[row.assignment.priority] ?? 'var(--text-tertiary)';
  return (
    <Link
      href={`/classes/assignments/${row.assignment.id}`}
      style={{
        position: 'relative',
        display: 'block',
        borderRadius: 16,
        border: row.isOverdue
          ? '1px solid rgba(255,180,171,0.4)'
          : '1px solid var(--border)',
        background: row.isOverdue
          ? 'var(--errorContainer, #93000A)'
          : 'var(--surface)',
        paddingLeft: 16,
        padding: 16,
        textDecoration: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: accent,
        }}
      />
      <div style={{ display: 'grid', gap: 8, paddingLeft: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: priorityColor,
              marginTop: 6,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
              {row.assignment.title}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: 12,
            color: TEXT_SECONDARY,
          }}
        >
          {row.cls ? (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${accent}`,
                color: accent,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
              }}
            >
              {row.cls.code || row.cls.name}
            </span>
          ) : null}
          <span
            style={{
              color: row.isOverdue ? 'var(--danger, #FFB4AB)' : TEXT_SECONDARY,
              fontWeight: row.isOverdue ? 700 : 500,
            }}
          >
            {relativeDue(row.assignment.due_at, row.isOverdue)}
          </span>
          {row.assignment.due_at ? (
            <span style={{ color: TEXT_TERTIARY }}>
              · {formatDueAbsolute(row.assignment.due_at)}
            </span>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 2,
          }}
        >
          <span
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: CLASSES_ACCENT_DIM,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              color: CLASSES_ACCENT,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel(row.assignment.status)}
          </span>
          <span
            style={{
              fontSize: 11,
              color: TEXT_TERTIARY,
              textTransform: 'capitalize',
            }}
          >
            {row.assignment.type}
          </span>
        </div>
      </div>
    </Link>
  );
}

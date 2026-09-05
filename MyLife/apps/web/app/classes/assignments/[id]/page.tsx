import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AssignmentRow, GroupMember } from '@mylife/classes';
import { loadAssignmentDetail } from '../../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  pillLinkStyle,
} from '../../ui';
import {
  AssignmentDangerZone,
  AssignmentGradeControl,
  AssignmentGroupMembers,
  AssignmentStatusControl,
  AssignmentTimeTracking,
} from '@/components/classes/AssignmentDetailControls';

interface PageProps {
  params: Promise<{ id: string }>;
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'var(--text-tertiary)',
  medium: 'var(--tertiary, #8BCFF0)',
  high: 'var(--primary, #FFB877)',
  critical: 'var(--danger, #FFB4AB)',
};

function statusLabel(s: string): string {
  switch (s) {
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'graded':
      return 'Graded';
    default:
      return s;
  }
}

function relativeDue(due: string | null): { label: string; overdue: boolean; daysOverdue: number } {
  if (!due) return { label: 'No due date', overdue: false, daysOverdue: 0 };
  const dueDate = new Date(due);
  const now = new Date();
  const ms = dueDate.getTime() - now.getTime();
  const days = Math.round(ms / 86400000);
  if (ms < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: overdueDays === 0 ? 'Overdue today' : `Overdue ${overdueDays}d`,
      overdue: true,
      daysOverdue: overdueDays,
    };
  }
  if (days === 0) return { label: 'Due today', overdue: false, daysOverdue: 0 };
  if (days === 1) return { label: 'Due tomorrow', overdue: false, daysOverdue: 0 };
  if (days < 7) return { label: `Due in ${days}d`, overdue: false, daysOverdue: 0 };
  return {
    label: dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overdue: false,
    daysOverdue: 0,
  };
}

function formatDueAbsolute(due: string | null): string {
  if (!due) return '';
  const d = new Date(due);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function parseRecurrence(raw: string | null): {
  frequency: string;
  interval: number;
  until?: string;
} | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return v as { frequency: string; interval: number; until?: string };
    return null;
  } catch {
    return null;
  }
}

const SECTION_STYLE: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: 20,
  display: 'grid',
  gap: 12,
};

export default async function AssignmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const view = loadAssignmentDetail(id);
  if (!view) notFound();

  const { assignment, cls, dependencyChain, isBlocked, latePenalty } = view;
  const due = relativeDue(assignment.due_at);
  const accent = cls?.color || CLASSES_ACCENT;
  const groupMembers = parseGroupMembers(assignment.group_members);
  const recurrence = parseRecurrence(assignment.recurrence_rule);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Hero */}
      <section
        style={{
          borderRadius: 24,
          border: `1px solid ${CLASSES_ACCENT_BORDER}`,
          background: `linear-gradient(135deg, ${CLASSES_ACCENT_DIM}, rgba(19,24,36,0.82))`,
          padding: 24,
          display: 'grid',
          gap: 12,
          position: 'relative',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {cls ? (
            <Link
              href={`/classes/class/${cls.id}`}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${accent}`,
                color: accent,
                fontWeight: 700,
                fontSize: 12,
                textDecoration: 'none',
              }}
            >
              {cls.code || cls.name}
            </Link>
          ) : null}
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: CLASSES_ACCENT_DIM,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              color: CLASSES_ACCENT,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {assignment.type}
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: CLASSES_ACCENT_DIM,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              color: CLASSES_ACCENT,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {statusLabel(assignment.status)}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              color: TEXT_SECONDARY,
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background:
                  PRIORITY_DOT[assignment.priority] ?? 'var(--text-tertiary)',
              }}
            />
            {assignment.priority}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: '36px', color: TEXT }}>
          {assignment.title}
        </h1>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            color: TEXT_SECONDARY,
            fontSize: 14,
          }}
        >
          <span style={{ fontWeight: 700, color: TEXT }}>{due.label}</span>
          {assignment.due_at ? (
            <span style={{ color: TEXT_TERTIARY }}>
              · {formatDueAbsolute(assignment.due_at)}
            </span>
          ) : null}
        </div>
        {due.overdue ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(147,0,10,0.35)',
              border: '1px solid rgba(255,180,171,0.4)',
              color: 'var(--danger, #FFB4AB)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {due.daysOverdue === 0
              ? 'Overdue today'
              : `${due.daysOverdue} day${due.daysOverdue === 1 ? '' : 's'} overdue`}
          </div>
        ) : null}
        {isBlocked ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255,184,119,0.18)',
              border: '1px solid rgba(255,184,119,0.4)',
              color: 'var(--primary, #FFB877)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Blocked by an unfinished dependency.
          </div>
        ) : null}
      </section>

      <AssignmentStatusControl id={assignment.id} current={assignment.status} />

      {latePenalty && latePenalty.penalty_percent > 0 ? (
        <section style={SECTION_STYLE}>
          <h2 style={sectionTitleStyle}>Late penalty</h2>
          <div
            style={{
              fontSize: 14,
              color: 'var(--danger, #FFB4AB)',
              fontWeight: 700,
            }}
          >
            −{latePenalty.penalty_percent}% {latePenalty.capped ? '(capped)' : ''}
          </div>
        </section>
      ) : null}

      <AssignmentGradeControl
        id={assignment.id}
        status={assignment.status}
        initialGrade={assignment.grade}
        initialMaxGrade={assignment.max_grade}
      />

      <AssignmentTimeTracking
        id={assignment.id}
        classId={assignment.class_id}
        estimated={assignment.estimated_minutes}
        actual={assignment.actual_minutes}
      />

      <AssignmentGroupMembers id={assignment.id} initial={groupMembers} />

      {dependencyChain.length > 0 ? (
        <section style={SECTION_STYLE}>
          <h2 style={sectionTitleStyle}>Dependencies</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {dependencyChain.map((dep) => (
              <DependencyRow key={dep.id} dep={dep} />
            ))}
          </div>
        </section>
      ) : null}

      {assignment.description_md ? (
        <section style={SECTION_STYLE}>
          <h2 style={sectionTitleStyle}>Description</h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: '21px',
              color: TEXT_SECONDARY,
              whiteSpace: 'pre-wrap',
            }}
          >
            {assignment.description_md}
          </p>
        </section>
      ) : null}

      {assignment.submission_notes ? (
        <section style={SECTION_STYLE}>
          <h2 style={sectionTitleStyle}>Submission notes</h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: '21px',
              color: TEXT_SECONDARY,
              whiteSpace: 'pre-wrap',
            }}
          >
            {assignment.submission_notes}
          </p>
        </section>
      ) : null}

      {recurrence ? (
        <section style={SECTION_STYLE}>
          <h2 style={sectionTitleStyle}>Recurrence</h2>
          <div style={{ fontSize: 14, color: TEXT_SECONDARY }}>
            Repeats <strong style={{ color: TEXT }}>{recurrence.frequency}</strong>{' '}
            every <strong style={{ color: TEXT }}>{recurrence.interval}</strong>
            {recurrence.until
              ? `, until ${new Date(recurrence.until).toLocaleDateString()}`
              : ''}
          </div>
        </section>
      ) : null}

      <AssignmentDangerZone id={assignment.id} classId={assignment.class_id} />

      <ClassesSection title="Navigate">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/classes/assignments" style={pillLinkStyle(false)}>
            Back to assignments
          </Link>
          <Link href="/classes/grades" style={pillLinkStyle(false)}>
            Grades
          </Link>
        </div>
      </ClassesSection>
    </div>
  );
}

function DependencyRow({ dep }: { dep: AssignmentRow }) {
  const done = dep.status === 'submitted' || dep.status === 'graded';
  return (
    <Link
      href={`/classes/assignments/${dep.id}`}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-elevated)',
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 999,
          background: done
            ? 'rgba(48,209,88,0.18)'
            : 'rgba(255,180,171,0.18)',
          color: done
            ? 'var(--success, #30D158)'
            : 'var(--danger, #FFB4AB)',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {statusLabel(dep.status)}
      </span>
      <span
        style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}
      >
        {dep.title}
      </span>
      {dep.due_at ? (
        <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>
          {new Date(dep.due_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ) : null}
    </Link>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: TEXT_SECONDARY,
  letterSpacing: 1.6,
  textTransform: 'uppercase',
};

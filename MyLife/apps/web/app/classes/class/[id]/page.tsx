import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  commuteBuffer,
  detectClassConflicts,
  getClass,
  getSemester,
  getTeacher,
  listClassesBySemester,
  type CategoryWeights,
  type DayTime,
} from '@mylife/classes';
import { getClassesDb } from '../../data';
import { deleteClassAction } from '../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesSection,
  GLASS,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  pillLinkStyle,
} from '../../ui';

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function parseBlocks(raw: string | null): DayTime[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as DayTime[]) : [];
  } catch {
    return [];
  }
}

function parseWeights(raw: string | null): CategoryWeights | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as CategoryWeights) : null;
  } catch {
    return null;
  }
}

function locationOf(building: string | null, room: string | null): string {
  const parts = [room, building].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Location TBD';
}

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getClassesDb();
  const cls = getClass(db, id);
  if (!cls) notFound();
  const semester = getSemester(db, cls.semester_id);
  const teacher = cls.teacher_id ? getTeacher(db, cls.teacher_id) : null;
  const semesterClasses = listClassesBySemester(db, cls.semester_id);
  const conflicts = detectClassConflicts(db, cls.semester_id).filter(
    (c) => c.a.id === cls.id || c.b.id === cls.id,
  );
  const tightCommutes = commuteBuffer(semesterClasses, {
    travelMinutes: 15,
  }).filter(
    (g) => (g.from_class_id === cls.id || g.to_class_id === cls.id) && g.tight,
  );

  const blocks = parseBlocks(cls.day_times);
  const weights = parseWeights(cls.category_weights);
  const weightEntries = weights
    ? Object.entries(weights).sort((a, b) => b[1] - a[1])
    : [];
  const weightTotal = weightEntries.reduce((acc, [, v]) => acc + v, 0);
  const accent = cls.color || (CLASSES_ACCENT as string);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/classes" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        ← Back to schedule
      </Link>

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: 24,
          borderRadius: 24,
          border: `1px solid ${CLASSES_ACCENT_BORDER}`,
          background: `linear-gradient(135deg, ${CLASSES_ACCENT_DIM}, rgba(19,24,36,0.82))`,
          borderLeft: `6px solid ${accent}`,
        }}
      >
        {cls.code ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {cls.code}
            {cls.section ? ` · §${cls.section}` : ''}
          </div>
        ) : null}
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: '34px', color: TEXT }}>
          {cls.name}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={pillStyle(accent)}>
            {cls.credits} credit{cls.credits === 1 ? '' : 's'}
          </span>
          {semester ? <span style={chipStyle()}>{semester.name}</span> : null}
        </div>
        {(conflicts.length > 0 || tightCommutes.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {conflicts.length > 0 && (
              <span style={warnChipStyle('#FFB4AB')}>
                {conflicts.length} schedule conflict
                {conflicts.length === 1 ? '' : 's'}
              </span>
            )}
            {tightCommutes.length > 0 && (
              <span style={warnChipStyle('#FFB877')}>
                {tightCommutes.length} tight commute
                {tightCommutes.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </section>

      <ClassesSection title="Schedule">
        <div style={cardStyle()}>
          {blocks.length === 0 ? (
            <div style={{ color: TEXT_SECONDARY }}>
              No weekly meetings configured. Edit to add a time block.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {blocks.map((b, idx) => (
                <div
                  key={`${b.day}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      minWidth: 56,
                      textAlign: 'center',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(59,130,246,0.18)',
                      color: accent,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                    }}
                  >
                    {DAY_LABELS[b.day] ?? b.day}
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ color: TEXT, fontSize: 15 }}>
                      {b.start_time}–{b.end_time}
                    </div>
                    <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
                      {locationOf(cls.building, cls.room)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ClassesSection>

      <ClassesSection title="Teacher">
        <div style={cardStyle()}>
          {teacher ? (
            <Link
              href={`/classes/teacher/${teacher.id}`}
              style={{ textDecoration: 'none', color: TEXT, display: 'grid', gap: 4 }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>{teacher.name}</div>
              {teacher.title || teacher.department ? (
                <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
                  {[teacher.title, teacher.department].filter(Boolean).join(' · ')}
                </div>
              ) : null}
              {teacher.email ? (
                <a
                  href={`mailto:${teacher.email}`}
                  style={{ color: accent, fontSize: 13 }}
                >
                  {teacher.email}
                </a>
              ) : null}
              <div style={{ color: accent, fontSize: 13, fontWeight: 700 }}>
                View profile →
              </div>
            </Link>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: TEXT_SECONDARY }}>
                No teacher attached. Edit this class to assign one.
              </div>
              <Link
                href="/classes/teacher/add"
                style={{ color: accent, fontWeight: 700, fontSize: 14 }}
              >
                + Add a teacher
              </Link>
            </div>
          )}
        </div>
      </ClassesSection>

      <ClassesSection title="Grading breakdown">
        <div style={cardStyle()}>
          {weightEntries.length === 0 ? (
            <div style={{ color: TEXT_SECONDARY }}>
              No category weights set. Edit to add categories like Homework, Exams, Final.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {weightEntries.map(([category, value]) => {
                const pct = weightTotal > 0 ? (value / weightTotal) * 100 : 0;
                return (
                  <div key={category} style={{ display: 'grid', gap: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: TEXT,
                        fontSize: 14,
                      }}
                    >
                      <span>{category}</span>
                      <span style={{ fontWeight: 700 }}>{value}%</span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        background: SURFACE_ELEVATED,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: accent,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {Math.abs(weightTotal - 100) > 0.5 ? (
                <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  Categories sum to {weightTotal}% (expected 100%).
                </div>
              ) : null}
            </div>
          )}
        </div>
      </ClassesSection>

      {cls.notes_md ? (
        <ClassesSection title="Syllabus notes">
          <div style={cardStyle()}>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                color: TEXT,
                fontSize: 14,
                lineHeight: '22px',
              }}
            >
              {cls.notes_md}
            </pre>
          </div>
        </ClassesSection>
      ) : null}

      <ClassesSection title="Assignments">
        <div style={cardStyle()}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              padding: '12px 0',
            }}
          >
            {[
              { label: 'Upcoming', value: '—' },
              { label: 'In progress', value: '—' },
              { label: 'Graded', value: '—' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center', display: 'grid', gap: 4 }}>
                <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{s.label}</div>
                <div style={{ color: TEXT, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <Link
            href="/classes/assignments"
            style={{ color: accent, fontWeight: 700, fontSize: 14 }}
          >
            Open assignment queue →
          </Link>
          <div
            style={{
              color: TEXT_TERTIARY,
              fontSize: 12,
              fontStyle: 'italic',
              marginTop: 8,
            }}
          >
            Per-class assignment counts arrive with the assignment tracker.
          </div>
        </div>
      </ClassesSection>

      <ClassesSection title="Actions">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <Link
            href={`/classes/class/${cls.id}/edit`}
            style={pillLinkStyle(true)}
          >
            Edit class
          </Link>
          <a
            href={`/classes/class/${cls.id}/export`}
            style={pillLinkStyle(false)}
          >
            Export to Calendar
          </a>
          <a
            href={`/classes/class/${cls.id}/export?semester=1`}
            style={pillLinkStyle(false)}
          >
            Export semester
          </a>
          <form action={deleteClassAction}>
            <input type="hidden" name="id" value={cls.id} />
            <button type="submit" style={dangerBtnStyle()}>
              Delete class
            </button>
          </form>
        </div>
      </ClassesSection>
    </div>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 18,
    border: `1px solid ${BORDER}`,
    background: SURFACE,
    padding: 18,
    display: 'grid',
    gap: 8,
  };
}

function chipStyle(): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    background: GLASS,
    border: `1px solid ${BORDER}`,
    color: TEXT,
    fontSize: 12,
    fontWeight: 700,
  };
}

function pillStyle(accent: string): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    border: `1px solid ${accent}`,
    color: accent,
    fontSize: 12,
    fontWeight: 700,
  };
}

function warnChipStyle(color: string): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(255,180,171,0.12)',
    color,
    fontSize: 12,
    fontWeight: 700,
  };
}

function dangerBtnStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '11px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,180,171,0.4)',
    background: 'rgba(255,180,171,0.08)',
    color: '#FFB4AB',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

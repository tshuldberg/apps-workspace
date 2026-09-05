import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSemester,
  getTeacher,
  listClassesByTeacher,
  type ClassRow,
  type SemesterRow,
} from '@mylife/classes';
import { getClassesDb } from '../../data';
import { deleteTeacherAction } from '../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesSection,
  GLASS,
  SURFACE,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../../ui';

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

interface OfficeHourBlock {
  day: string;
  start_time: string;
  end_time: string;
}

function parseOfficeHours(raw: string | null): OfficeHourBlock[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as OfficeHourBlock[]) : [];
  } catch {
    return [];
  }
}

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  const filled = Math.max(0, Math.min(max, value));
  return (
    <span style={{ color: '#FFB877', letterSpacing: 2, fontSize: 18 }}>
      {'★'.repeat(filled)}
      <span style={{ color: TEXT_SECONDARY }}>{'☆'.repeat(max - filled)}</span>
    </span>
  );
}

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getClassesDb();
  const teacher = getTeacher(db, id);
  if (!teacher) notFound();

  const taughtClasses = listClassesByTeacher(db, teacher.id);
  const taught: Array<{ cls: ClassRow; semester: SemesterRow | null }> = [];
  for (const c of taughtClasses) {
    const semester = getSemester(db, c.semester_id);
    taught.push({ cls: c, semester });
  }

  const officeHours = parseOfficeHours(teacher.office_hours);
  const subtitle = [teacher.title, teacher.department].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/classes" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        ← Back to schedule
      </Link>

      <section
        style={{
          padding: 24,
          borderRadius: 24,
          border: `1px solid ${CLASSES_ACCENT_BORDER}`,
          background: `linear-gradient(135deg, ${CLASSES_ACCENT_DIM}, rgba(19,24,36,0.82))`,
          display: 'grid',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: CLASSES_ACCENT,
          }}
        >
          Teacher profile
        </div>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: '34px', color: TEXT }}>
          {teacher.name}
        </h1>
        {subtitle ? (
          <div style={{ color: TEXT_SECONDARY, fontSize: 15 }}>{subtitle}</div>
        ) : null}
        {teacher.email ? (
          <a
            href={`mailto:${teacher.email}`}
            style={{ color: CLASSES_ACCENT, fontWeight: 700, fontSize: 14 }}
          >
            {teacher.email}
          </a>
        ) : null}
      </section>

      <ClassesSection title="Office">
        <div style={cardStyle()}>
          {teacher.office_location ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ color: TEXT, fontSize: 14 }}>
                {teacher.office_location}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(teacher.office_location)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: CLASSES_ACCENT, fontSize: 13, fontWeight: 700 }}
              >
                Open in Maps →
              </a>
            </div>
          ) : (
            <div style={{ color: TEXT_SECONDARY, fontSize: 14 }}>
              No office location on file.
            </div>
          )}
          {officeHours.length > 0 ? (
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {officeHours.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: TEXT,
                    fontSize: 14,
                  }}
                >
                  <span>{DAY_LABELS[b.day] ?? b.day}</span>
                  <span style={{ color: TEXT_SECONDARY }}>
                    {b.start_time}–{b.end_time}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: TEXT_SECONDARY, fontSize: 13, marginTop: 6 }}>
              No office hours set.
            </div>
          )}
        </div>
      </ClassesSection>

      <ClassesSection title="Ratings">
        <div style={cardStyle()}>
          <div style={ratingRow()}>
            <span style={{ color: TEXT_SECONDARY }}>Recommendation potential</span>
            <Stars value={teacher.rec_potential ?? 0} />
          </div>
          <div style={ratingRow()}>
            <span style={{ color: TEXT_SECONDARY }}>Personal rating</span>
            <Stars value={teacher.rating ?? 0} />
          </div>
          <div style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}>
            Private — never shared.
          </div>
        </div>
      </ClassesSection>

      {teacher.teaching_style_notes ? (
        <ClassesSection title="Teaching style">
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
              {teacher.teaching_style_notes}
            </pre>
          </div>
        </ClassesSection>
      ) : null}

      {teacher.grading_notes ? (
        <ClassesSection title="Grading personality">
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
              {teacher.grading_notes}
            </pre>
          </div>
        </ClassesSection>
      ) : null}

      {teacher.notes_md ? (
        <ClassesSection title="Private notes">
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
              {teacher.notes_md}
            </pre>
          </div>
        </ClassesSection>
      ) : null}

      <ClassesSection title={`Classes taught (${taught.length})`}>
        {taught.length === 0 ? (
          <div style={cardStyle()}>
            <div style={{ color: TEXT_SECONDARY }}>
              No classes attached to this teacher yet.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {taught.map(({ cls, semester }) => (
              <Link
                key={cls.id}
                href={`/classes/class/${cls.id}`}
                style={{
                  ...cardStyle(),
                  textDecoration: 'none',
                  borderLeft: `4px solid ${cls.color || CLASSES_ACCENT}`,
                }}
              >
                <div style={{ color: TEXT, fontSize: 15, fontWeight: 700 }}>
                  {cls.name}
                </div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
                  {[cls.code, semester?.name].filter(Boolean).join(' · ')}
                </div>
              </Link>
            ))}
          </div>
        )}
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
            href={`/classes/teacher/${teacher.id}/edit`}
            style={pillLinkStyle(true)}
          >
            Edit teacher
          </Link>
          <form action={deleteTeacherAction}>
            <input type="hidden" name="id" value={teacher.id} />
            <button type="submit" style={dangerBtnStyle()}>
              Delete teacher
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
    gap: 6,
    color: TEXT,
  };
}

function ratingRow(): React.CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
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

// Touch unused import to keep tree-shaking happy if linter flags otherwise.
const _GLASS_REF = GLASS;
void _GLASS_REF;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadOnlineCourse } from '../../../data';
import {
  deleteOnlineCourseAction,
  updateOnlineCourseAction,
} from '../../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesFormSection,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';
import {
  COURSE_STATUS_LABEL,
  ProgressBar,
  formatDate,
} from '../../ui';

const STATUSES = ['not_started', 'in_progress', 'completed', 'abandoned'];

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let course;
  try {
    course = loadOnlineCourse(id);
  } catch {
    course = null;
  }
  if (!course) notFound();

  const tags = course.tags ? safeParseTags(course.tags) : [];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/courses"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to courses
      </Link>

      <header
        style={{
          display: 'grid',
          gap: 12,
          padding: 24,
          borderRadius: 20,
          border: `1px solid ${CLASSES_ACCENT_BORDER}`,
          background: SURFACE,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>{course.title}</h1>
            <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
              {[course.provider, course.instructor].filter(Boolean).join(' · ') ||
                'Self-directed'}
            </div>
          </div>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              color: CLASSES_ACCENT,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {COURSE_STATUS_LABEL[course.status] ?? course.status}
          </span>
        </div>
        <ProgressBar percent={course.progress_percent} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          {course.progress_percent.toFixed(0)}% complete ·{' '}
          {course.actual_hours
            ? `${course.actual_hours.toFixed(1)}h logged`
            : 'no hours logged yet'}
          {course.estimated_hours
            ? ` · ${course.estimated_hours.toFixed(1)}h estimated`
            : ''}
        </div>
        {course.url ? (
          <a
            href={course.url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: 13, color: CLASSES_ACCENT }}
          >
            Open course →
          </a>
        ) : null}
        {course.certificate_url ? (
          <a
            href={course.certificate_url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ fontSize: 13, color: CLASSES_ACCENT }}
          >
            View certificate →
          </a>
        ) : null}
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <Cell label="Started" value={formatDate(course.started_at)} />
        <Cell label="Completed" value={formatDate(course.completed_at)} />
        <Cell label="Category" value={course.category ?? '—'} />
        <Cell
          label="Rating"
          value={course.rating ? `${course.rating}/5` : '—'}
        />
      </div>

      {tags.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: SURFACE_ELEVATED,
                color: TEXT_SECONDARY,
                fontSize: 12,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      {course.notes_md ? (
        <section
          style={{
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            background: SURFACE,
            padding: 16,
            color: TEXT_SECONDARY,
            whiteSpace: 'pre-wrap',
            fontSize: 14,
            lineHeight: '20px',
          }}
        >
          {course.notes_md}
        </section>
      ) : null}

      <form action={updateOnlineCourseAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="id" value={course.id} />
        <ClassesFormSection title="Edit course" description="Update progress, status, hours, and notes.">
          <div>
            {fieldLabel('Title')}
            <input
              type="text"
              name="title"
              required
              defaultValue={course.title}
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Provider')}
              <input
                type="text"
                name="provider"
                defaultValue={course.provider ?? ''}
                placeholder="Coursera"
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Instructor')}
              <input
                type="text"
                name="instructor"
                defaultValue={course.instructor ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('URL')}
            <input
              type="url"
              name="url"
              defaultValue={course.url ?? ''}
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Status')}
              <select
                name="status"
                defaultValue={course.status}
                style={{ ...textInputStyle, appearance: 'auto' }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COURSE_STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Progress %')}
              <input
                type="number"
                name="progress_percent"
                min={0}
                max={100}
                step={1}
                defaultValue={course.progress_percent}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Started at')}
              <input
                type="date"
                name="started_at"
                defaultValue={course.started_at?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Completed at')}
              <input
                type="date"
                name="completed_at"
                defaultValue={course.completed_at?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Estimated hours')}
              <input
                type="number"
                name="estimated_hours"
                step={0.5}
                min={0}
                defaultValue={course.estimated_hours ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Actual hours')}
              <input
                type="number"
                name="actual_hours"
                step={0.5}
                min={0}
                defaultValue={course.actual_hours ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Category')}
              <input
                type="text"
                name="category"
                defaultValue={course.category ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Rating (1-5)')}
              <input
                type="number"
                name="rating"
                min={1}
                max={5}
                step={1}
                defaultValue={course.rating ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Tags (comma-separated)')}
            <input
              type="text"
              name="tags"
              defaultValue={tags.join(', ')}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Certificate URL')}
            <input
              type="url"
              name="certificate_url"
              defaultValue={course.certificate_url ?? ''}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Notes')}
            <textarea
              name="notes_md"
              rows={5}
              defaultValue={course.notes_md ?? ''}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              ...pillLinkStyle(true),
              cursor: 'pointer',
              border: `1px solid ${CLASSES_ACCENT}`,
            }}
          >
            Save changes
          </button>
          <Link href="/classes/lifelong/courses" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteOnlineCourseAction}>
        <input type="hidden" name="id" value={course.id} />
        <button
          type="submit"
          style={{
            ...pillLinkStyle(false),
            cursor: 'pointer',
            color: 'var(--danger, #FFB4AB)',
            border: '1px solid var(--danger, #FFB4AB)',
          }}
        >
          Delete course
        </button>
      </form>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        background: SURFACE_ELEVATED,
        padding: 14,
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: TEXT, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  loadGoalLinkOptions,
  loadLearningGoalDetail,
} from '../../../data';
import {
  deleteLearningGoalAction,
  updateLearningGoalAction,
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
  GOAL_STATUS_LABEL,
  ProgressBar,
  formatDate,
} from '../../ui';

const GOAL_STATUSES = ['active', 'completed', 'paused', 'abandoned'];

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail;
  try {
    detail = loadLearningGoalDetail(id);
  } catch {
    detail = null;
  }
  if (!detail) notFound();

  const { goal, progress, linked_courses, linked_certs } = detail;
  const { courses: allCourses, certs: allCerts } = loadGoalLinkOptions();
  const linkedCourseIds = new Set(linked_courses.map((c) => c.id));
  const linkedCertIds = new Set(linked_certs.map((c) => c.id));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/goals"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to goals
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
            <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>{goal.title}</h1>
            <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
              {goal.target_date ? `Target ${formatDate(goal.target_date)}` : 'No target date set'}
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
            {GOAL_STATUS_LABEL[goal.status] ?? goal.status}
          </span>
        </div>
        <ProgressBar percent={progress.percent} />
        <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
          {progress.completed_items} of {progress.total_items} items complete · {progress.percent.toFixed(0)}%
        </div>
      </header>

      {goal.description_md ? (
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
          {goal.description_md}
        </section>
      ) : null}

      <section style={{ display: 'grid', gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 12,
            color: TEXT_SECONDARY,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}
        >
          Linked courses
        </h2>
        {linked_courses.length === 0 ? (
          <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>None linked yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {linked_courses.map((c) => (
              <Link
                key={c.id}
                href={`/classes/lifelong/courses/${c.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE_ELEVATED,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      {COURSE_STATUS_LABEL[c.status] ?? c.status} · {c.progress_percent.toFixed(0)}%
                    </div>
                  </div>
                  <Checkmark complete={c.status === 'completed'} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 12,
            color: TEXT_SECONDARY,
            letterSpacing: 1.6,
            textTransform: 'uppercase',
          }}
        >
          Linked certifications
        </h2>
        {linked_certs.length === 0 ? (
          <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>None linked yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {linked_certs.map((c) => (
              <Link
                key={c.id}
                href={`/classes/lifelong/certifications/${c.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE_ELEVATED,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      {c.issued_at ? `Issued ${formatDate(c.issued_at)}` : 'Not issued'}
                    </div>
                  </div>
                  <Checkmark complete={!!c.issued_at} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <form action={updateLearningGoalAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="id" value={goal.id} />
        <ClassesFormSection title="Edit goal" description="Update title, status, target date, description, and links.">
          <div>
            {fieldLabel('Title')}
            <input
              type="text"
              name="title"
              required
              defaultValue={goal.title}
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Status')}
              <select
                name="status"
                defaultValue={goal.status}
                style={{ ...textInputStyle, appearance: 'auto' }}
              >
                {GOAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {GOAL_STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              {fieldLabel('Target date')}
              <input
                type="date"
                name="target_date"
                defaultValue={goal.target_date?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Description')}
            <textarea
              name="description_md"
              rows={4}
              defaultValue={goal.description_md ?? ''}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            {fieldLabel('Link courses')}
            <CheckboxList
              name="course_ids"
              options={allCourses.map((c) => ({ id: c.id, label: c.title }))}
              selected={linkedCourseIds}
              emptyHint="Add courses first to link them here."
            />
          </div>

          <div>
            {fieldLabel('Link certifications')}
            <CheckboxList
              name="certification_ids"
              options={allCerts.map((c) => ({ id: c.id, label: c.name }))}
              selected={linkedCertIds}
              emptyHint="Add certifications first to link them here."
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
          <Link href="/classes/lifelong/goals" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteLearningGoalAction}>
        <input type="hidden" name="id" value={goal.id} />
        <button
          type="submit"
          style={{
            ...pillLinkStyle(false),
            cursor: 'pointer',
            color: 'var(--danger, #FFB4AB)',
            border: '1px solid var(--danger, #FFB4AB)',
          }}
        >
          Delete goal
        </button>
      </form>
    </div>
  );
}

function Checkmark({ complete }: { complete: boolean }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        border: `1px solid ${complete ? 'var(--success, #30D158)' : BORDER}`,
        background: complete ? 'var(--success, #30D158)' : 'transparent',
        color: 'var(--background, #000)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {complete ? '✓' : ''}
    </span>
  );
}

function CheckboxList({
  name,
  options,
  selected,
  emptyHint,
}: {
  name: string;
  options: Array<{ id: string; label: string }>;
  selected: Set<string>;
  emptyHint: string;
}) {
  if (options.length === 0) {
    return (
      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 8 }}>
        {emptyHint}
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 8,
        display: 'grid',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: SURFACE_ELEVATED,
      }}
    >
      {options.map((opt) => (
        <label
          key={opt.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            color: TEXT,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            name={name}
            value={opt.id}
            defaultChecked={selected.has(opt.id)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

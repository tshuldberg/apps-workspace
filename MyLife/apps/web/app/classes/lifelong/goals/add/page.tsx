import Link from 'next/link';
import { loadGoalLinkOptions } from '../../../data';
import { createLearningGoalAction } from '../../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  ClassesFormSection,
  SURFACE_ELEVATED,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';
import { GOAL_STATUS_LABEL } from '../../ui';

const GOAL_STATUSES = ['active', 'completed', 'paused', 'abandoned'];

export default async function AddGoalPage() {
  const { courses, certs } = loadGoalLinkOptions();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/goals"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to goals
      </Link>
      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Set a learning goal</h1>

      <form action={createLearningGoalAction} style={{ display: 'grid', gap: 20 }}>
        <ClassesFormSection title="The goal" description="A specific outcome you can point to in 6, 12, or 24 months.">
          <div>
            {fieldLabel('Title')}
            <input
              type="text"
              name="title"
              required
              placeholder="Become conversational in Spanish"
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Status')}
              <select
                name="status"
                defaultValue="active"
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
              <input type="date" name="target_date" style={textInputStyle} />
            </div>
          </div>
          <div>
            {fieldLabel('Description')}
            <textarea
              name="description_md"
              rows={4}
              placeholder="What does success look like? Why does it matter?"
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Link the work" description="Tie courses and certifications to this goal so progress is automatic.">
          <div>
            {fieldLabel('Link courses')}
            <CheckboxList
              name="course_ids"
              options={courses.map((c) => ({ id: c.id, label: c.title }))}
              emptyHint="Add courses first to link them here."
            />
          </div>
          <div>
            {fieldLabel('Link certifications')}
            <CheckboxList
              name="certification_ids"
              options={certs.map((c) => ({ id: c.id, label: c.name }))}
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
            Set goal
          </button>
          <Link href="/classes/lifelong/goals" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function CheckboxList({
  name,
  options,
  emptyHint,
}: {
  name: string;
  options: Array<{ id: string; label: string }>;
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
          <input type="checkbox" name={name} value={opt.id} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

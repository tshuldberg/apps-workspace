import Link from 'next/link';
import { createOnlineCourseAction } from '../../../actions';
import {
  CLASSES_ACCENT,
  ClassesFormSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';
import { COURSE_STATUS_LABEL } from '../../ui';

const STATUSES = ['not_started', 'in_progress', 'completed', 'abandoned'];

export default function AddCoursePage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href="/classes/lifelong/courses"
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to courses
      </Link>
      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Add course</h1>

      <form action={createOnlineCourseAction} style={{ display: 'grid', gap: 20 }}>
        <ClassesFormSection title="What are you learning?" description="Title is the only required field. The rest can fill in over time.">
          <div>
            {fieldLabel('Title')}
            <input
              type="text"
              name="title"
              required
              placeholder="Deep Learning Specialization"
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Provider')}
              <input
                type="text"
                name="provider"
                placeholder="Coursera"
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Instructor')}
              <input
                type="text"
                name="instructor"
                placeholder="Andrew Ng"
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('URL')}
            <input
              type="url"
              name="url"
              placeholder="https://…"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Progress" description="Where you are right now. Update as you go.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Status')}
              <select
                name="status"
                defaultValue="in_progress"
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
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Started at')}
              <input type="date" name="started_at" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Estimated hours')}
              <input
                type="number"
                name="estimated_hours"
                step={0.5}
                min={0}
                style={textInputStyle}
              />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Tagging" description="Make this easy to find later.">
          <div>
            {fieldLabel('Category')}
            <input
              type="text"
              name="category"
              placeholder="ML / Spanish / Cooking…"
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Tags (comma-separated)')}
            <input
              type="text"
              name="tags"
              placeholder="python, math, evenings"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="Anything you want future-you to remember.">
          <textarea
            name="notes_md"
            rows={5}
            placeholder="Markdown supported."
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
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
            Add course
          </button>
          <Link href="/classes/lifelong/courses" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

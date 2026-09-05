import Link from 'next/link';
import type { Day } from '@mylife/classes';
import { createTeacherAction } from '../../actions';
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
} from '../../ui';

const DAY_OPTIONS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DEFAULT_OFFICE_ROW = {
  day: 'mon' as Day,
  start_time: '14:00',
  end_time: '15:00',
};

export default function AddTeacherPage() {
  const officeRows = [DEFAULT_OFFICE_ROW, DEFAULT_OFFICE_ROW];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/classes" style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
        ← Back to schedule
      </Link>
      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Add teacher</h1>

      <form action={createTeacherAction} style={{ display: 'grid', gap: 20 }}>
        <ClassesFormSection
          title="Identity"
          description="Who they are and how to reach them."
        >
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              placeholder="Dr. Adelaide Marlowe"
              style={textInputStyle}
            />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              {fieldLabel('Title')}
              <input
                type="text"
                name="title"
                placeholder="Associate Professor"
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Department')}
              <input
                type="text"
                name="department"
                placeholder="Mathematics"
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Email')}
            <input
              type="email"
              name="email"
              placeholder="marlowe@university.edu"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Office"
          description="Where to find them and when they're available."
        >
          <div>
            {fieldLabel('Office location')}
            <input
              type="text"
              name="office_location"
              placeholder="Math Hall 312"
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {fieldLabel('Office hours')}
            <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
              Add up to 2 blocks. Leave a row blank to skip.
            </div>
            {officeRows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: SURFACE_ELEVATED,
                }}
              >
                <div>
                  {fieldLabel('Day')}
                  <select
                    name="oh_day"
                    defaultValue={row.day}
                    style={{ ...textInputStyle, appearance: 'auto' }}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {DAY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {fieldLabel('Start')}
                  <input
                    type="time"
                    name="oh_start"
                    defaultValue=""
                    style={textInputStyle}
                  />
                </div>
                <div>
                  {fieldLabel('End')}
                  <input
                    type="time"
                    name="oh_end"
                    defaultValue=""
                    style={textInputStyle}
                  />
                </div>
              </div>
            ))}
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Ratings"
          description="Both ratings are private and never shared."
        >
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              {fieldLabel('Recommendation potential (0–5)')}
              <input
                type="number"
                name="rec_potential"
                min={0}
                max={5}
                step={1}
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Personal rating (0–5)')}
              <input
                type="number"
                name="rating"
                min={0}
                max={5}
                step={1}
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Notes"
          description="Free-form context. Markdown supported."
        >
          <div>
            {fieldLabel('Teaching style')}
            <textarea
              name="teaching_style_notes"
              placeholder="Lecture-heavy with weekly problem sets…"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            {fieldLabel('Grading personality')}
            <textarea
              name="grading_notes"
              placeholder="Strict on labs, generous on participation…"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            {fieldLabel('Private notes')}
            <textarea
              name="notes_md"
              placeholder="Markdown supported."
              rows={5}
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
            Save teacher
          </button>
          <Link href="/classes" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

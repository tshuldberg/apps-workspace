import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTeacher, type Day } from '@mylife/classes';
import { getClassesDb } from '../../../data';
import { updateTeacherAction } from '../../../actions';
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

interface OfficeHourBlock {
  day: Day;
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

export default async function EditTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getClassesDb();
  const teacher = getTeacher(db, id);
  if (!teacher) notFound();

  const officeHours = parseOfficeHours(teacher.office_hours);
  const officeRows: OfficeHourBlock[] =
    officeHours.length > 0
      ? officeHours
      : [
          { day: 'mon', start_time: '', end_time: '' },
          { day: 'wed', start_time: '', end_time: '' },
        ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href={`/classes/teacher/${teacher.id}`}
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to profile
      </Link>
      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>
        Edit {teacher.name}
      </h1>

      <form action={updateTeacherAction} style={{ display: 'grid', gap: 20 }}>
        <input type="hidden" name="id" value={teacher.id} />

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
              defaultValue={teacher.name}
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
                defaultValue={teacher.title ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Department')}
              <input
                type="text"
                name="department"
                defaultValue={teacher.department ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Email')}
            <input
              type="email"
              name="email"
              defaultValue={teacher.email ?? ''}
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
              defaultValue={teacher.office_location ?? ''}
              style={textInputStyle}
            />
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {fieldLabel('Office hours')}
            <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
              Add up to {Math.max(2, officeRows.length)} blocks. Leave a row
              blank to skip.
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
                    defaultValue={row.start_time}
                    style={textInputStyle}
                  />
                </div>
                <div>
                  {fieldLabel('End')}
                  <input
                    type="time"
                    name="oh_end"
                    defaultValue={row.end_time}
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
                defaultValue={teacher.rec_potential ?? 0}
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
                defaultValue={teacher.rating ?? 0}
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
              defaultValue={teacher.teaching_style_notes ?? ''}
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            {fieldLabel('Grading personality')}
            <textarea
              name="grading_notes"
              defaultValue={teacher.grading_notes ?? ''}
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
          <div>
            {fieldLabel('Private notes')}
            <textarea
              name="notes_md"
              defaultValue={teacher.notes_md ?? ''}
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
            Save changes
          </button>
          <Link
            href={`/classes/teacher/${teacher.id}`}
            style={pillLinkStyle(false)}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

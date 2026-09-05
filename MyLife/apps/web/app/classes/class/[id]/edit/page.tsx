import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CLASSES_PALETTE,
  getClass,
  listTeachers,
  type CategoryWeights,
  type Day,
  type DayTime,
} from '@mylife/classes';
import { getClassesDb } from '../../../data';
import { updateClassAction } from '../../../actions';
import {
  BORDER,
  CLASSES_ACCENT,
  ClassesFormSection,
  SURFACE,
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

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getClassesDb();
  const cls = getClass(db, id);
  if (!cls) notFound();

  const teachers = listTeachers(db);
  const blocks = parseBlocks(cls.day_times);
  const weights = parseWeights(cls.category_weights);
  const weightEntries = weights ? Object.entries(weights) : [];
  const blockRows = blocks.length > 0 ? blocks : [{ day: 'mon' as Day, start_time: '09:00', end_time: '10:15' }];
  const weightRows =
    weightEntries.length > 0
      ? weightEntries
      : [
          ['Homework', 30] as [string, number],
          ['Exams', 50] as [string, number],
          ['Final', 20] as [string, number],
        ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href={`/classes/class/${cls.id}`}
        style={{ color: TEXT_SECONDARY, fontSize: 13 }}
      >
        ← Back to class
      </Link>

      <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>
        Edit {cls.name}
      </h1>

      <form action={updateClassAction} style={{ display: 'grid', gap: 20 }}>
        <input type="hidden" name="id" value={cls.id} />

        <ClassesFormSection
          title="Basics"
          description="Course identity, credits, and where it meets."
        >
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              defaultValue={cls.name}
              style={textInputStyle}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              {fieldLabel('Code')}
              <input
                type="text"
                name="code"
                defaultValue={cls.code ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Section')}
              <input
                type="text"
                name="section"
                defaultValue={cls.section ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Credits')}
              <input
                type="number"
                name="credits"
                min={0}
                max={12}
                step={1}
                defaultValue={cls.credits}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Building')}
              <input
                type="text"
                name="building"
                defaultValue={cls.building ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Room')}
              <input
                type="text"
                name="room"
                defaultValue={cls.room ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('Color')}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {CLASSES_PALETTE.map((c) => (
                <label
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    defaultChecked={cls.color === c}
                    style={{ display: 'none' }}
                  />
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: c,
                      border:
                        cls.color === c
                          ? `2px solid ${TEXT}`
                          : `1px solid ${BORDER}`,
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Teacher"
          description="Link this class to a teacher profile."
        >
          <div>
            {fieldLabel('Teacher')}
            <select
              name="teacher_id"
              defaultValue={cls.teacher_id ?? ''}
              style={{ ...textInputStyle, appearance: 'auto' }}
            >
              <option value="">— No teacher —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.title ? ` (${t.title})` : ''}
                </option>
              ))}
            </select>
            <Link
              href="/classes/teacher/add"
              style={{
                marginTop: 8,
                color: CLASSES_ACCENT,
                fontWeight: 700,
                fontSize: 13,
                display: 'inline-block',
              }}
            >
              + Add new teacher
            </Link>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Schedule"
          description="Add one row per recurring day. Times use 24-hour HH:MM."
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {blockRows.map((b, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  padding: 10,
                  borderRadius: 12,
                  background: SURFACE_ELEVATED,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div>
                  {fieldLabel('Day')}
                  <select
                    name="block_day"
                    defaultValue={b.day}
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
                    name="block_start"
                    defaultValue={b.start_time}
                    style={textInputStyle}
                  />
                </div>
                <div>
                  {fieldLabel('End')}
                  <input
                    type="time"
                    name="block_end"
                    defaultValue={b.end_time}
                    style={textInputStyle}
                  />
                </div>
              </div>
            ))}
            <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>
              To add or remove rows, edit on mobile or update fields in place. Empty
              rows are ignored on save.
            </p>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Grading breakdown"
          description="Category weights as percentages (0–100). Categories without a name are ignored."
        >
          <div style={{ display: 'grid', gap: 10 }}>
            {weightRows.map(([cat, val], idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  name="weight_category"
                  defaultValue={cat}
                  placeholder="Category"
                  style={textInputStyle}
                />
                <input
                  type="number"
                  name="weight_value"
                  defaultValue={val}
                  min={0}
                  max={100}
                  step={1}
                  style={textInputStyle}
                />
              </div>
            ))}
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Syllabus notes"
          description="Free-form markdown for late policies, attendance, etc."
        >
          <textarea
            name="notes_md"
            defaultValue={cls.notes_md ?? ''}
            rows={6}
            style={{
              ...textInputStyle,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </ClassesFormSection>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <button
            type="submit"
            style={{
              ...pillLinkStyle(true),
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Save changes
          </button>
          <Link href={`/classes/class/${cls.id}`} style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

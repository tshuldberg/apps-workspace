import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadRequirementDetail } from '../../../../data';
import { updateRequirementAction } from '../../../../actions';
import {
  ClassesFormSection,
  ClassesHero,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../../ui';

const REQUIREMENT_CATEGORIES = [
  ['major', 'Major'],
  ['minor', 'Minor'],
  ['general_ed', 'Gen Ed'],
  ['elective', 'Elective'],
  ['capstone', 'Capstone'],
  ['other', 'Other'],
] as const;

const MIN_GRADES = ['', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];

export default async function EditRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = loadRequirementDetail(id);
  if (!view) notFound();
  const { requirement: r } = view;

  let codesString = '';
  if (r.allowed_course_codes) {
    try {
      const parsed = JSON.parse(r.allowed_course_codes) as unknown;
      if (Array.isArray(parsed)) {
        codesString = parsed.filter((s) => typeof s === 'string').join(', ');
      }
    } catch {
      codesString = '';
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Degree"
        title={`Edit ${r.name}`}
        body="Update the requirement bucket. Attached satisfactions stay in place."
      />

      <form action={updateRequirementAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="id" value={r.id} />

        <ClassesFormSection title="Requirement" description="Required: name.">
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              defaultValue={r.name}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Category')}
            <select
              name="category"
              defaultValue={r.category ?? ''}
              style={textInputStyle}
            >
              <option value="">— None —</option>
              {REQUIREMENT_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Quotas" description="Credits, course count, min grade.">
          <div>
            {fieldLabel('Credits required')}
            <input
              type="number"
              name="credits_required"
              defaultValue={r.credits_required}
              min={0}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Course count required')}
            <input
              type="number"
              name="course_count_required"
              defaultValue={r.course_count_required}
              min={0}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Minimum grade')}
            <select
              name="min_grade"
              defaultValue={r.min_grade ?? ''}
              style={textInputStyle}
            >
              {MIN_GRADES.map((g) => (
                <option key={g || 'none'} value={g}>
                  {g || '— None —'}
                </option>
              ))}
            </select>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Allowed course codes"
          description="Comma-separated. CS* matches CS101, CS210, etc."
        >
          <div>
            {fieldLabel('Codes')}
            <input
              type="text"
              name="allowed_course_codes"
              defaultValue={codesString}
              placeholder="CS101, CS*, MATH202"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="Markdown supported.">
          <div>
            {fieldLabel('Notes')}
            <textarea
              name="notes_md"
              rows={4}
              defaultValue={r.notes_md ?? ''}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" style={{ ...pillLinkStyle(true), border: 0, cursor: 'pointer' }}>
            Save changes
          </button>
          <Link href={`/classes/degree/requirement/${r.id}`} style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

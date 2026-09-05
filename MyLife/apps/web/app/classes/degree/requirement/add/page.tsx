import Link from 'next/link';
import { createRequirementAction } from '../../../actions';
import {
  ClassesEmptyPanel,
  ClassesFormSection,
  ClassesHero,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';

const REQUIREMENT_CATEGORIES = [
  ['major', 'Major'],
  ['minor', 'Minor'],
  ['general_ed', 'Gen Ed'],
  ['elective', 'Elective'],
  ['capstone', 'Capstone'],
  ['other', 'Other'],
] as const;

const MIN_GRADES = ['', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];

export default async function AddRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ program_id?: string }>;
}) {
  const { program_id: programId } = await searchParams;

  if (!programId) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Degree"
          title="Pick a program first"
          body="Open requirements from a program detail page so we know where they belong."
        />
        <ClassesEmptyPanel
          title="No program in context"
          body="Open this from a program detail page."
          actionHref="/classes/degree"
          actionLabel="Back to degree hub"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Degree"
        title="Add a requirement"
        body="A requirement is a bucket of work the program demands. Set credit / course count / grade thresholds."
      />

      <form action={createRequirementAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="program_id" value={programId} />
        <ClassesFormSection title="Requirement" description="Required: name.">
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              placeholder="Computer Science Core"
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Category')}
            <select name="category" defaultValue="" style={textInputStyle}>
              <option value="">— None —</option>
              {REQUIREMENT_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Quotas"
          description="Either credits, course count, or both. Min grade gates the satisfaction."
        >
          <div>
            {fieldLabel('Credits required')}
            <input
              type="number"
              name="credits_required"
              defaultValue={0}
              min={0}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Course count required')}
            <input
              type="number"
              name="course_count_required"
              defaultValue={0}
              min={0}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Minimum grade')}
            <select name="min_grade" defaultValue="" style={textInputStyle}>
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
          description="Comma-separated. Use CS* for prefix glob matching."
        >
          <div>
            {fieldLabel('Codes')}
            <input
              type="text"
              name="allowed_course_codes"
              placeholder="CS101, CS*, MATH202"
              style={textInputStyle}
            />
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="Optional. Anything to remember.">
          <div>
            {fieldLabel('Notes (markdown)')}
            <textarea
              name="notes_md"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" style={{ ...pillLinkStyle(true), border: 0, cursor: 'pointer' }}>
            Save requirement
          </button>
          <Link href={`/classes/degree/program/${programId}`} style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

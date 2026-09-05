import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProgramDetail } from '../../../../data';
import { updateDegreeProgramAction } from '../../../../actions';
import {
  ClassesFormSection,
  ClassesHero,
  TEXT,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../../ui';

const DEGREE_TYPES = [
  'BS',
  'BA',
  'MS',
  'MA',
  'PhD',
  'Minor',
  'Certificate',
  'Other',
];

export default async function EditDegreeProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = loadProgramDetail(id);
  if (!view) notFound();
  const p = view.program;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Degree"
        title={`Edit ${p.name}`}
        body="Update program metadata. Requirements stay attached."
      />

      <form action={updateDegreeProgramAction} style={{ display: 'grid', gap: 16 }}>
        <input type="hidden" name="id" value={p.id} />
        <ClassesFormSection title="Program" description="Required: name.">
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              defaultValue={p.name}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Institution')}
            <input
              type="text"
              name="institution"
              defaultValue={p.institution ?? ''}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Degree type')}
            <select
              name="degree_type"
              defaultValue={p.degree_type ?? ''}
              style={textInputStyle}
            >
              <option value="">— None —</option>
              {DEGREE_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Requirements" description="Total credits, GPA, dates.">
          <div>
            {fieldLabel('Total credits required')}
            <input
              type="number"
              name="total_credits_required"
              defaultValue={p.total_credits_required}
              min={0}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Minimum GPA (optional)')}
            <input
              type="number"
              name="gpa_required"
              step={0.1}
              min={0}
              max={4}
              defaultValue={p.gpa_required ?? ''}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Catalog year')}
            <input
              type="text"
              name="catalog_year"
              defaultValue={p.catalog_year ?? ''}
              style={textInputStyle}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              {fieldLabel('Start date')}
              <input
                type="date"
                name="start_date"
                defaultValue={p.start_date ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Expected completion')}
              <input
                type="date"
                name="expected_completion"
                defaultValue={p.expected_completion ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: TEXT }}>
            <input
              type="checkbox"
              name="is_primary"
              value="true"
              defaultChecked={p.is_primary === 1}
            />
            <span style={{ fontSize: 14 }}>Set as primary program</span>
          </label>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="Markdown supported.">
          <div>
            {fieldLabel('Notes')}
            <textarea
              name="notes_md"
              rows={5}
              defaultValue={p.notes_md ?? ''}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" style={{ ...pillLinkStyle(true), border: 0, cursor: 'pointer' }}>
            Save changes
          </button>
          <Link href={`/classes/degree/program/${p.id}`} style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

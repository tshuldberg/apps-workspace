import Link from 'next/link';
import { createDegreeProgramAction } from '../../../actions';
import {
  ClassesFormSection,
  ClassesHero,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';

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

export default function AddDegreeProgramPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Degree"
        title="Add a degree program"
        body="Tracks credits, GPA, requirements, and the classes that satisfy them."
      />

      <form action={createDegreeProgramAction} style={{ display: 'grid', gap: 16 }}>
        <ClassesFormSection
          title="Program"
          description="Required: name. Everything else is optional but unlocks better tracking."
        >
          <div>
            {fieldLabel('Name')}
            <input
              type="text"
              name="name"
              required
              placeholder="BS Computer Science"
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Institution')}
            <input
              type="text"
              name="institution"
              placeholder="State University"
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Degree type')}
            <select name="degree_type" defaultValue="" style={textInputStyle}>
              <option value="">— None —</option>
              {DEGREE_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Requirements"
          description="Total credits and GPA targets. Catalog year keeps requirements pinned."
        >
          <div>
            {fieldLabel('Total credits required')}
            <input
              type="number"
              name="total_credits_required"
              defaultValue={120}
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
              placeholder="e.g. 2.0"
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Catalog year')}
            <input
              type="text"
              name="catalog_year"
              placeholder="2024-2025"
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
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Expected completion')}
              <input
                type="date"
                name="expected_completion"
                style={textInputStyle}
              />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: TEXT }}>
            <input type="checkbox" name="is_primary" value="true" defaultChecked />
            <span style={{ fontSize: 14 }}>Set as primary program</span>
          </label>
        </ClassesFormSection>

        <ClassesFormSection
          title="Notes"
          description="Optional. Anything to remember about this program."
        >
          <div>
            {fieldLabel('Notes (markdown)')}
            <textarea
              name="notes_md"
              rows={5}
              style={{ ...textInputStyle, resize: 'vertical' }}
            />
          </div>
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="submit" style={{ ...pillLinkStyle(true), border: 0, cursor: 'pointer' }}>
            Save program
          </button>
          <Link href="/classes/degree" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>
          You can add requirements after the program is saved.
        </p>
      </form>
    </div>
  );
}

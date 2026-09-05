import Link from 'next/link';
import { createStandardizedTestAction } from '../../actions';
import {
  ClassesFormSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../ui';
import {
  TEST_CATEGORIES,
  TEST_CATEGORY_LABEL,
  TEST_STATUSES,
  TEST_STATUS_LABEL,
} from '../../applications/ui';

export default function AddTestPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, color: TEXT }}>Add test</h1>
        <Link href="/classes/tests" style={pillLinkStyle(false)}>
          Cancel
        </Link>
      </div>

      <form action={createStandardizedTestAction} style={{ display: 'grid', gap: 18 }}>
        <ClassesFormSection title="Basics" description="Name, category, status.">
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              {fieldLabel('Name')}
              <input
                name="name"
                required
                placeholder="SAT, GRE, AP Calc BC..."
                style={textInputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Category')}
                <select name="category" defaultValue="undergrad" style={textInputStyle}>
                  {TEST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {TEST_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Status')}
                <select name="status" defaultValue="planned" style={textInputStyle}>
                  {TEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TEST_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Schedule + score" description="Optional dates and score data.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Test date')}
              <input type="date" name="test_date" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Registration deadline')}
              <input type="date" name="registration_deadline" style={textInputStyle} />
            </div>
          </div>
          <div>
            {fieldLabel('Location')}
            <input name="location" style={textInputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Score')}
              <input type="number" step="any" name="score" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Max score')}
              <input type="number" step="any" name="max_score" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Percentile')}
              <input type="number" step="any" name="percentile" style={textInputStyle} />
            </div>
          </div>
          <label style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
            <input type="checkbox" name="superscore_eligible" /> Superscore eligible
          </label>
        </ClassesFormSection>

        <ClassesFormSection title="Notes" description="">
          <textarea
            name="notes_md"
            rows={6}
            style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" style={pillLinkStyle(true)}>
            Save test
          </button>
          <Link href="/classes/tests" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

import Link from 'next/link';
import { createApplicationAction } from '../../actions';
import { loadApplicationsAddView } from '../../data';
import {
  ClassesFormSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABEL,
} from '../ui';

export default function AddApplicationPage() {
  const { tests } = loadApplicationsAddView();

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
        <h1 style={{ margin: 0, fontSize: 26, color: TEXT }}>Add application</h1>
        <Link href="/classes/applications" style={pillLinkStyle(false)}>
          Cancel
        </Link>
      </div>

      <form action={createApplicationAction} style={{ display: 'grid', gap: 18 }}>
        <ClassesFormSection
          title="Basics"
          description="Name, institution, type, and current status."
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              {fieldLabel('Name')}
              <input name="name" required style={textInputStyle} placeholder="Stanford CS PhD" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Institution')}
                <input
                  name="institution"
                  style={textInputStyle}
                  placeholder="Stanford University"
                />
              </div>
              <div>
                {fieldLabel('Program')}
                <input
                  name="program"
                  style={textInputStyle}
                  placeholder="Computer Science PhD"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Type')}
                <select name="type" defaultValue="undergrad" style={textInputStyle}>
                  {APPLICATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {APPLICATION_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Status')}
                <select name="status" defaultValue="considering" style={textInputStyle}>
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Dates"
          description="Final deadline, optional early deadline, and decision date."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Deadline')}
              <input type="date" name="deadline" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Early deadline')}
              <input type="date" name="early_deadline" style={textInputStyle} />
            </div>
            <div>
              {fieldLabel('Decision date')}
              <input type="date" name="decision_date" style={textInputStyle} />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection
          title="Counters"
          description="Track essays, recommenders, and transcripts inline."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Essays required')}
              <input
                type="number"
                min={0}
                name="required_essays_count"
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Drafted')}
              <input
                type="number"
                min={0}
                name="essays_drafted"
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Finalized')}
              <input
                type="number"
                min={0}
                name="essays_finalized"
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Recommenders required')}
              <input
                type="number"
                min={0}
                name="recommenders_required"
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Recommenders confirmed')}
              <input
                type="number"
                min={0}
                name="recommenders_confirmed"
                defaultValue={0}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <label style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
              <input type="checkbox" name="transcripts_requested" /> Transcripts requested
            </label>
            <label style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
              <input type="checkbox" name="transcripts_sent" /> Transcripts sent
            </label>
          </div>
        </ClassesFormSection>

        {tests.length > 0 ? (
          <ClassesFormSection
            title="Required test scores"
            description="Link standardized tests this application requires."
          >
            <div style={{ display: 'grid', gap: 8 }}>
              {tests.map((t) => (
                <label
                  key={t.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT_SECONDARY, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    name="required_test_score_ids"
                    value={t.id}
                  />
                  {t.name} ({t.category})
                </label>
              ))}
            </div>
          </ClassesFormSection>
        ) : null}

        <ClassesFormSection
          title="Notes"
          description="Anything you want to remember."
        >
          <textarea
            name="notes_md"
            rows={6}
            style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Recommender list, supplementals, links to drafts..."
          />
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" style={pillLinkStyle(true)}>
            Save application
          </button>
          <Link href="/classes/applications" style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

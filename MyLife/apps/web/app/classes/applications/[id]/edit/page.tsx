import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateApplicationAction } from '../../../actions';
import { loadApplicationDetail, loadApplicationsAddView } from '../../../data';
import {
  ClassesFormSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../../ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABEL,
} from '../../ui';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function EditApplicationPage({ params }: Params) {
  const { id } = await params;
  const view = loadApplicationDetail(id);
  if (!view) notFound();

  const { application } = view;
  const { tests } = loadApplicationsAddView();
  const requiredIds = new Set<string>(
    application.required_test_score_ids
      ? (() => {
          try {
            return JSON.parse(application.required_test_score_ids) as string[];
          } catch {
            return [];
          }
        })()
      : [],
  );

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
        <h1 style={{ margin: 0, fontSize: 26, color: TEXT }}>Edit application</h1>
        <Link href={`/classes/applications/${application.id}`} style={pillLinkStyle(false)}>
          Cancel
        </Link>
      </div>

      <form action={updateApplicationAction} style={{ display: 'grid', gap: 18 }}>
        <input type="hidden" name="id" value={application.id} />

        <ClassesFormSection title="Basics" description="Name, institution, type, status.">
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              {fieldLabel('Name')}
              <input
                name="name"
                required
                defaultValue={application.name}
                style={textInputStyle}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Institution')}
                <input
                  name="institution"
                  defaultValue={application.institution ?? ''}
                  style={textInputStyle}
                />
              </div>
              <div>
                {fieldLabel('Program')}
                <input
                  name="program"
                  defaultValue={application.program ?? ''}
                  style={textInputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Type')}
                <select name="type" defaultValue={application.type} style={textInputStyle}>
                  {APPLICATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {APPLICATION_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Status')}
                <select name="status" defaultValue={application.status} style={textInputStyle}>
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

        <ClassesFormSection title="Dates" description="Deadline, early deadline, decision.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Deadline')}
              <input
                type="date"
                name="deadline"
                defaultValue={application.deadline?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Early deadline')}
              <input
                type="date"
                name="early_deadline"
                defaultValue={application.early_deadline?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Decision date')}
              <input
                type="date"
                name="decision_date"
                defaultValue={application.decision_date?.slice(0, 10) ?? ''}
                style={textInputStyle}
              />
            </div>
          </div>
        </ClassesFormSection>

        <ClassesFormSection title="Counters" description="Essays, recommenders, transcripts.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Essays required')}
              <input
                type="number"
                min={0}
                name="required_essays_count"
                defaultValue={application.required_essays_count}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Drafted')}
              <input
                type="number"
                min={0}
                name="essays_drafted"
                defaultValue={application.essays_drafted}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Finalized')}
              <input
                type="number"
                min={0}
                name="essays_finalized"
                defaultValue={application.essays_finalized}
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
                defaultValue={application.recommenders_required}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Recommenders confirmed')}
              <input
                type="number"
                min={0}
                name="recommenders_confirmed"
                defaultValue={application.recommenders_confirmed}
                style={textInputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
              <input
                type="checkbox"
                name="transcripts_requested"
                defaultChecked={Boolean(application.transcripts_requested)}
              />{' '}
              Transcripts requested
            </label>
            <label style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
              <input
                type="checkbox"
                name="transcripts_sent"
                defaultChecked={Boolean(application.transcripts_sent)}
              />{' '}
              Transcripts sent
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
                    defaultChecked={requiredIds.has(t.id)}
                  />
                  {t.name} ({t.category})
                </label>
              ))}
            </div>
          </ClassesFormSection>
        ) : null}

        <ClassesFormSection title="Notes" description="">
          <textarea
            name="notes_md"
            rows={6}
            defaultValue={application.notes_md ?? ''}
            style={{ ...textInputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </ClassesFormSection>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" style={pillLinkStyle(true)}>
            Save changes
          </button>
          <Link href={`/classes/applications/${application.id}`} style={pillLinkStyle(false)}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

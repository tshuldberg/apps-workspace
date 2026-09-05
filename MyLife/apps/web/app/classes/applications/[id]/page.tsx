import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  createApplicationTaskAction,
  deleteApplicationAction,
  deleteApplicationTaskAction,
  markTaskCompleteAction,
} from '../../actions';
import { loadApplicationDetail } from '../../data';
import {
  ClassesFormSection,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  fieldLabel,
  pillLinkStyle,
  textInputStyle,
} from '../../ui';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_TASK_KIND_LABEL,
  APPLICATION_TASK_KINDS,
  APPLICATION_TASK_STATUS_LABEL,
  APPLICATION_TYPE_LABEL,
  cardStyle,
  deadlineCountdown,
  formatDate,
  pillStyle,
  progressBar,
  urgencyColor,
  urgencyLabel,
} from '../ui';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER } from '../../ui';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({ params }: Params) {
  const { id } = await params;
  const view = loadApplicationDetail(id);
  if (!view) notFound();

  const { application, tasks, progress, urgency, requiredTests } = view;
  const meta = [
    APPLICATION_TYPE_LABEL[application.type],
    application.institution,
    application.program,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 6, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>{application.name}</h1>
          {meta ? <div style={{ color: TEXT_SECONDARY, fontSize: 14 }}>{meta}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={pillStyle()}>{APPLICATION_STATUS_LABEL[application.status]}</span>
            {urgency !== 'none' ? (
              <span style={pillStyle(urgencyColor(urgency), urgencyColor(urgency))}>
                {urgencyLabel(urgency)}
              </span>
            ) : null}
          </div>
        </div>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            border: `8px solid ${CLASSES_ACCENT_BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: CLASSES_ACCENT,
            fontWeight: 800,
            fontSize: 22,
          }}
        >
          {progress.percent_complete}%
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <InfoCard label="Deadline" value={formatDate(application.deadline)} />
        <InfoCard label="Countdown" value={deadlineCountdown(application.deadline)} />
        {application.early_deadline ? (
          <InfoCard label="Early deadline" value={formatDate(application.early_deadline)} />
        ) : null}
        {application.decision_date ? (
          <InfoCard label="Decision" value={formatDate(application.decision_date)} />
        ) : null}
      </div>

      <ClassesSection title="Counters">
        {progressBar(progress.percent_complete)}
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            marginTop: 8,
          }}
        >
          <InfoCard
            label="Essays"
            value={`${application.essays_finalized} finalized · ${application.essays_drafted} drafted / ${application.required_essays_count}`}
          />
          <InfoCard
            label="Recommenders"
            value={`${application.recommenders_confirmed} / ${application.recommenders_required}`}
          />
          <InfoCard
            label="Transcripts"
            value={`Requested ${application.transcripts_requested ? 'yes' : 'no'} · Sent ${application.transcripts_sent ? 'yes' : 'no'}`}
          />
        </div>
        {progress.blocked_by.length > 0 ? (
          <div style={{ ...cardStyle, borderColor: '#FFB4AB' }}>
            <div style={{ color: '#FFB4AB', fontSize: 13, fontWeight: 700 }}>Blocked by</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: TEXT_SECONDARY, fontSize: 13 }}>
              {progress.blocked_by.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </ClassesSection>

      <ClassesSection title={`Tasks (${tasks.length})`}>
        {tasks.length === 0 ? (
          <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>No tasks yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  ...cardStyle,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <div
                    style={{
                      color: TEXT,
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                    {APPLICATION_TASK_KIND_LABEL[t.kind]} ·{' '}
                    {APPLICATION_TASK_STATUS_LABEL[t.status]}
                    {t.due_at ? ` · due ${formatDate(t.due_at)}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {t.status !== 'done' ? (
                    <form action={markTaskCompleteAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="application_id" value={application.id} />
                      <button type="submit" style={pillLinkStyle(false)}>
                        Mark done
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteApplicationTaskAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="application_id" value={application.id} />
                    <button type="submit" style={pillLinkStyle(false)}>
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <ClassesFormSection
          title="Add task"
          description="Essays, recommendations, transcripts, fees, portal steps."
        >
          <form action={createApplicationTaskAction} style={{ display: 'grid', gap: 12 }}>
            <input type="hidden" name="application_id" value={application.id} />
            <div>
              {fieldLabel('Title')}
              <input name="title" required style={textInputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                {fieldLabel('Kind')}
                <select name="kind" defaultValue="essay" style={textInputStyle}>
                  {APPLICATION_TASK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {APPLICATION_TASK_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {fieldLabel('Due')}
                <input type="date" name="due_at" style={textInputStyle} />
              </div>
            </div>
            <button type="submit" style={pillLinkStyle(true)}>
              Add task
            </button>
          </form>
        </ClassesFormSection>
      </ClassesSection>

      {requiredTests.length > 0 ? (
        <ClassesSection title="Required test scores">
          <div style={{ display: 'grid', gap: 8 }}>
            {requiredTests.map((t) => (
              <Link
                key={t.id}
                href={`/classes/tests/${t.id}`}
                style={cardStyle}
              >
                <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  {t.score != null
                    ? `Score ${t.score}${t.max_score ? ` / ${t.max_score}` : ''}`
                    : 'No score yet'}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                </div>
              </Link>
            ))}
          </div>
        </ClassesSection>
      ) : null}

      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <Link href={`/classes/applications/${application.id}/edit`} style={pillLinkStyle(true)}>
          Edit
        </Link>
        <form action={deleteApplicationAction}>
          <input type="hidden" name="id" value={application.id} />
          <button type="submit" style={pillLinkStyle(false)}>
            Delete application
          </button>
        </form>
        <Link href="/classes/applications" style={pillLinkStyle(false)}>
          Back
        </Link>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{label}</div>
      <div style={{ color: TEXT, fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

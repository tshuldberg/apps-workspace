import Link from 'next/link';
import {
  loadApplicationsView,
  type ApplicationStatus,
} from '../data';
import {
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../ui';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPE_LABEL,
  cardStyle,
  deadlineCountdown,
  pillStyle,
  progressBar,
  urgencyColor,
  urgencyLabel,
} from './ui';

const ACTIVE_STATUSES: ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'waitlisted',
  'deferred',
  'accepted',
  'rejected',
  'withdrawn',
];

export default function ApplicationsPage() {
  const view = loadApplicationsView();

  if (view.total === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Applications"
          title="Stay on top of every deadline"
          body="Group by status, surface critical deadlines, and never lose track of an essay, recommender, or transcript."
          actionHref="/classes/applications/add"
          actionLabel="Add application"
        />
        <ClassesEmptyPanel
          title="No applications yet"
          body="Add the first one. We'll group them by status and bubble up what's due soon."
          actionHref="/classes/applications/add"
          actionLabel="Add an application"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, color: TEXT }}>Applications</h1>
        <Link href="/classes/applications/add" style={pillLinkStyle(true)}>
          + Add application
        </Link>
      </div>

      <ClassesMetricRow
        items={[
          { label: 'Total', value: String(view.total) },
          { label: 'Due soon', value: String(view.upcoming) },
          { label: 'In progress', value: String(view.groups.in_progress.length) },
        ]}
      />

      {ACTIVE_STATUSES.filter((s) => view.groups[s].length > 0).map((status) => (
        <ClassesSection
          key={status}
          title={`${APPLICATION_STATUS_LABEL[status]} (${view.groups[status].length})`}
        >
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {view.groups[status].map((vm) => {
              const meta = [
                APPLICATION_TYPE_LABEL[vm.application.type],
                vm.application.institution,
                vm.application.program,
              ]
                .filter(Boolean)
                .join(' · ');
              const u = vm.urgency;
              return (
                <Link
                  key={vm.application.id}
                  href={`/classes/applications/${vm.application.id}`}
                  style={cardStyle}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                        {vm.application.name}
                      </div>
                      {meta ? (
                        <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>{meta}</div>
                      ) : null}
                    </div>
                    {u !== 'none' ? (
                      <span style={pillStyle(urgencyColor(u), urgencyColor(u))}>
                        {urgencyLabel(u)}
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                    }}
                  >
                    <span>{deadlineCountdown(vm.application.deadline)}</span>
                    <span>{vm.progress.percent_complete}% complete</span>
                  </div>
                  {progressBar(vm.progress.percent_complete)}
                </Link>
              );
            })}
          </div>
        </ClassesSection>
      ))}
    </div>
  );
}

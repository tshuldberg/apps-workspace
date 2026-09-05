import Link from 'next/link';
import { loadDegreeHubView } from '../data';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyPanel,
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  TEXT,
  TEXT_SECONDARY,
  pillLinkStyle,
} from '../ui';

export default async function DegreeHubPage() {
  let view;
  try {
    view = loadDegreeHubView();
  } catch (err) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Degree"
          title="Degree planning"
          body="We hit a snag loading your degree hub. Try refreshing."
        />
        <ClassesEmptyPanel
          title="Hub unavailable"
          body={String(err)}
          actionHref="/classes"
          actionLabel="Back to schedule"
        />
      </div>
    );
  }

  const { programs, primary } = view;

  if (programs.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <ClassesHero
          badge="Degree"
          title="Map the path to graduation"
          body="Track requirements, credits, GPA targets, and which classes count where. Spot blockers and double-counts before they bite."
        />
        <ClassesEmptyPanel
          title="No degree programs yet"
          body="Add your first program to start tracking requirements and progress."
          actionHref="/classes/degree/program/add"
          actionLabel="Add a program"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge="Degree"
        title={primary ? primary.program.name : 'Degree planning'}
        body={
          primary?.program.institution
            ? `${primary.program.institution}${primary.program.catalog_year ? ` · ${primary.program.catalog_year}` : ''}`
            : 'Track requirements, credits, GPA, and which classes count where.'
        }
        actionHref="/classes/degree/program/add"
        actionLabel="Add program"
      />

      {primary ? (
        <>
          <ClassesMetricRow
            items={[
              {
                label: 'Complete',
                value: `${primary.progress.percent_complete.toFixed(0)}%`,
              },
              {
                label: 'Credits done',
                value: `${primary.progress.total_credits_completed} / ${primary.progress.total_credits_required}`,
              },
              {
                label: 'In progress',
                value: String(primary.progress.total_credits_in_progress),
              },
              {
                label: 'GPA status',
                value:
                  primary.progress.gpa_status === 'meets'
                    ? 'Meets target'
                    : primary.progress.gpa_status === 'below'
                      ? 'Below target'
                      : 'Unknown',
              },
            ]}
          />

          <ClassesSection title="Requirements">
            {primary.progress.requirements.length === 0 ? (
              <ClassesEmptyPanel
                title="No requirements yet"
                body="Add requirement buckets so we can track credits, course counts, and grade thresholds."
                actionHref={`/classes/degree/requirement/add?program_id=${primary.program.id}`}
                actionLabel="Add requirement"
              />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {primary.progress.requirements.map((r) => (
                  <Link
                    key={r.requirement_id}
                    href={`/classes/degree/requirement/${r.requirement_id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <article
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                        background: 'var(--surface)',
                        padding: 16,
                        display: 'grid',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                          {r.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: r.is_satisfied ? CLASSES_ACCENT : TEXT_SECONDARY,
                            fontWeight: 700,
                          }}
                        >
                          {r.is_satisfied ? 'Met' : 'In progress'}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                        {r.credits_completed} / {r.credits_required} credits ·{' '}
                        {r.courses_completed} / {r.course_count_required} courses
                      </div>
                      {r.blocking_classes.length > 0 ? (
                        <div style={{ fontSize: 12, color: '#FFB4AB' }}>
                          {r.blocking_classes.length} class(es) below min grade
                        </div>
                      ) : null}
                    </article>
                  </Link>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link
                href={`/classes/degree/program/${primary.program.id}`}
                style={pillLinkStyle(false)}
              >
                Open program
              </Link>
              <Link
                href={`/classes/degree/requirement/add?program_id=${primary.program.id}`}
                style={pillLinkStyle(false)}
              >
                Add requirement
              </Link>
            </div>
          </ClassesSection>
        </>
      ) : null}

      <ClassesSection title="All programs">
        <div style={{ display: 'grid', gap: 10 }}>
          {programs.map((p) => (
            <Link
              key={p.id}
              href={`/classes/degree/program/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <article
                style={{
                  borderRadius: 16,
                  border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                  background: 'var(--surface)',
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                    {p.degree_type ?? '—'}
                    {p.institution ? ` · ${p.institution}` : ''}
                  </div>
                </div>
                {p.is_primary === 1 ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: CLASSES_ACCENT,
                      fontWeight: 700,
                      letterSpacing: 0.4,
                    }}
                  >
                    PRIMARY
                  </div>
                ) : null}
              </article>
            </Link>
          ))}
        </div>
      </ClassesSection>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProgramDetail } from '../../../data';
import {
  deleteDegreeProgramAction,
  setPrimaryProgramAction,
} from '../../../actions';
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
} from '../../../ui';

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = loadProgramDetail(id);
  if (!view) notFound();
  const { program, progress, doubleCounts } = view;

  const gpaLabel =
    progress.gpa_status === 'meets'
      ? 'GPA meets target'
      : progress.gpa_status === 'below'
        ? 'GPA below target'
        : 'GPA unknown';

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge={program.degree_type ?? 'Degree'}
        title={program.name}
        body={
          program.institution
            ? `${program.institution}${program.catalog_year ? ` · ${program.catalog_year}` : ''}`
            : (program.catalog_year ?? 'No institution set')
        }
        actionHref={`/classes/degree/program/${program.id}/edit`}
        actionLabel="Edit"
      />

      <ClassesMetricRow
        items={[
          { label: 'Complete', value: `${progress.percent_complete.toFixed(0)}%` },
          {
            label: 'Credits done',
            value: `${progress.total_credits_completed} / ${progress.total_credits_required}`,
          },
          { label: 'In progress', value: String(progress.total_credits_in_progress) },
          { label: 'GPA status', value: gpaLabel },
        ]}
      />

      <ClassesSection title="Requirements">
        {progress.requirements.length === 0 ? (
          <ClassesEmptyPanel
            title="No requirements yet"
            body="Add requirement buckets so we can track credits and grades."
            actionHref={`/classes/degree/requirement/add?program_id=${program.id}`}
            actionLabel="Add requirement"
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {progress.requirements.map((r) => (
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
        <div>
          <Link
            href={`/classes/degree/requirement/add?program_id=${program.id}`}
            style={pillLinkStyle(false)}
          >
            Add requirement
          </Link>
        </div>
      </ClassesSection>

      {doubleCounts.length > 0 ? (
        <ClassesSection title="Double-counts">
          <div style={{ display: 'grid', gap: 10 }}>
            {doubleCounts.map((dc) => (
              <article
                key={dc.class_id}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                  background: 'var(--surface)',
                  padding: 16,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                  Class {dc.class_id.slice(0, 12)}…
                </div>
                <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                  Counts toward {dc.requirement_ids.length} requirements
                </div>
              </article>
            ))}
          </div>
        </ClassesSection>
      ) : null}

      {program.notes_md ? (
        <ClassesSection title="Notes">
          <article
            style={{
              borderRadius: 16,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              background: 'var(--surface)',
              padding: 16,
              fontSize: 14,
              color: TEXT_SECONDARY,
              whiteSpace: 'pre-wrap',
            }}
          >
            {program.notes_md}
          </article>
        </ClassesSection>
      ) : null}

      <ClassesSection title="Manage">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {program.is_primary !== 1 ? (
            <form action={setPrimaryProgramAction}>
              <input type="hidden" name="id" value={program.id} />
              <button
                type="submit"
                style={{ ...pillLinkStyle(false), border: 0, cursor: 'pointer' }}
              >
                Set as primary
              </button>
            </form>
          ) : null}
          <Link href={`/classes/degree/program/${program.id}/edit`} style={pillLinkStyle(false)}>
            Edit
          </Link>
          <form action={deleteDegreeProgramAction}>
            <input type="hidden" name="id" value={program.id} />
            <button
              type="submit"
              style={{
                ...pillLinkStyle(false),
                border: 0,
                cursor: 'pointer',
                background: 'rgba(255,180,171,0.12)',
                color: '#FFB4AB',
              }}
            >
              Delete program
            </button>
          </form>
        </div>
      </ClassesSection>
    </div>
  );
}

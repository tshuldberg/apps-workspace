import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadRequirementDetail } from '../../../data';
import {
  createSatisfactionAction,
  deleteRequirementAction,
  deleteSatisfactionAction,
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

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = loadRequirementDetail(id);
  if (!view) notFound();
  const {
    requirement,
    program,
    satisfactions,
    attachedClasses,
    unattachedClasses,
    suggestedClasses,
    progress,
  } = view;

  const blockingIds = new Set(progress.blocking_classes.map((c) => c.id));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge={requirement.category ?? 'Requirement'}
        title={requirement.name}
        body={`Part of ${program.name}${
          requirement.min_grade ? ` · min grade ${requirement.min_grade}` : ''
        }`}
        actionHref={`/classes/degree/requirement/${requirement.id}/edit`}
        actionLabel="Edit"
      />

      <ClassesMetricRow
        items={[
          {
            label: 'Credits',
            value: `${progress.credits_completed} / ${progress.credits_required}`,
          },
          {
            label: 'Courses',
            value: `${progress.courses_completed} / ${progress.course_count_required}`,
          },
          {
            label: 'In progress',
            value: `${progress.credits_in_progress} cr · ${progress.courses_in_progress} cls`,
          },
          {
            label: 'Status',
            value: progress.is_satisfied ? 'Met' : 'Open',
          },
        ]}
      />

      <ClassesSection title="Attached classes">
        {attachedClasses.length === 0 ? (
          <ClassesEmptyPanel
            title="No classes attached yet"
            body="Attach classes from the suggestions or pick manually below."
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {satisfactions.map((s) => {
              const cls = attachedClasses.find((c) => c.id === s.class_id);
              const blocking = blockingIds.has(s.class_id);
              return (
                <article
                  key={s.id}
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
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                        {cls?.code ? `${cls.code} · ` : ''}
                        {cls?.name ?? 'Unknown class'}
                      </div>
                      <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                        {s.credits_applied} cr applied · {s.status}
                        {s.approved_by ? ` · ${s.approved_by}` : ''}
                      </div>
                      {blocking ? (
                        <div style={{ fontSize: 12, color: '#FFB4AB' }}>
                          Below min grade — does not count toward completion
                        </div>
                      ) : null}
                    </div>
                    <form action={deleteSatisfactionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input
                        type="hidden"
                        name="requirement_id"
                        value={requirement.id}
                      />
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
                        Remove
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ClassesSection>

      {suggestedClasses.length > 0 ? (
        <ClassesSection title="Suggested from your catalog">
          <div style={{ display: 'grid', gap: 10 }}>
            {suggestedClasses.slice(0, 8).map((cls) => (
              <article
                key={cls.id}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${CLASSES_ACCENT_BORDER}`,
                  background: 'var(--surface)',
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                    {cls.code ? `${cls.code} · ` : ''}
                    {cls.name}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                    {cls.credits} credits
                  </div>
                </div>
                <form action={createSatisfactionAction}>
                  <input
                    type="hidden"
                    name="requirement_id"
                    value={requirement.id}
                  />
                  <input type="hidden" name="class_id" value={cls.id} />
                  <input
                    type="hidden"
                    name="credits_applied"
                    value={cls.credits}
                  />
                  <input type="hidden" name="status" value="planned" />
                  <button
                    type="submit"
                    style={{
                      ...pillLinkStyle(true),
                      border: 0,
                      cursor: 'pointer',
                    }}
                  >
                    Attach
                  </button>
                </form>
              </article>
            ))}
          </div>
        </ClassesSection>
      ) : null}

      {unattachedClasses.length > 0 ? (
        <ClassesSection title="Attach manually">
          <form
            action={createSatisfactionAction}
            style={{
              borderRadius: 16,
              border: `1px solid ${CLASSES_ACCENT_BORDER}`,
              background: 'var(--surface)',
              padding: 16,
              display: 'grid',
              gap: 10,
            }}
          >
            <input
              type="hidden"
              name="requirement_id"
              value={requirement.id}
            />
            <select name="class_id" required style={{ padding: 10, borderRadius: 10 }}>
              <option value="">— Pick a class —</option>
              {unattachedClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.code ? `${cls.code} · ` : ''}
                  {cls.name} ({cls.credits} cr)
                </option>
              ))}
            </select>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              <input
                type="number"
                name="credits_applied"
                placeholder="Credits"
                min={0}
                defaultValue={3}
                style={{ padding: 10, borderRadius: 10 }}
              />
              <select name="status" defaultValue="planned" style={{ padding: 10, borderRadius: 10 }}>
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
              <input
                type="text"
                name="approved_by"
                placeholder="Approved by (optional)"
                style={{ padding: 10, borderRadius: 10 }}
              />
            </div>
            <button
              type="submit"
              style={{ ...pillLinkStyle(true), border: 0, cursor: 'pointer' }}
            >
              Attach class
            </button>
          </form>
        </ClassesSection>
      ) : null}

      {requirement.notes_md ? (
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
            {requirement.notes_md}
          </article>
        </ClassesSection>
      ) : null}

      <ClassesSection title="Manage">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href={`/classes/degree/requirement/${requirement.id}/edit`}
            style={pillLinkStyle(false)}
          >
            Edit requirement
          </Link>
          <Link
            href={`/classes/degree/program/${program.id}`}
            style={pillLinkStyle(false)}
          >
            Back to program
          </Link>
          <form action={deleteRequirementAction}>
            <input type="hidden" name="id" value={requirement.id} />
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
              Delete requirement
            </button>
          </form>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: CLASSES_ACCENT }}>
          {progress.is_satisfied ? 'This requirement is met.' : ''}
        </p>
      </ClassesSection>
    </div>
  );
}

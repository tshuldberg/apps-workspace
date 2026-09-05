import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProgressTimeline } from '@mylife/create';
import { deleteProjectAction, updateProjectStatusAction } from '../../actions';
import { loadCreateProjectDetail } from '../../data';
import {
  CREATE_PROJECT_STATUSES,
  CreateEmptyPanel,
  CreateMetricRow,
  CreateSection,
  CreateTimelineEntryCard,
  buttonStyle,
  fieldLabel,
  formatCreateDate,
  formatCreateProjectStatus,
  formatCreateProjectType,
  getCreateNextStatus,
  statusBadgeStyle,
} from '../../ui';

export default async function CreateProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = loadCreateProjectDetail(id);
  if (!detail) notFound();

  const { project, progress, milestones, breakthroughs } = detail;
  const nextStatus = getCreateNextStatus(project.status);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/create" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        ← Back to projects
      </Link>

      <section
        style={{
          display: 'grid',
          gap: 12,
          padding: 24,
          borderRadius: 24,
          border: '1px solid rgba(217,70,239,0.28)',
          background:
            'linear-gradient(135deg, rgba(217,70,239,0.14), rgba(255,255,255,0.03))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 999,
              background: 'rgba(19,24,36,0.7)',
              color: 'var(--accent-create)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {formatCreateProjectType(project.type)}
          </span>
          <span style={statusBadgeStyle(project.status)}>
            {formatCreateProjectStatus(project.status)}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 34, color: 'var(--text)' }}>
          {project.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {project.description_md?.trim() ||
            'No description yet. Edit the project to capture the brief, constraints, and finish line.'}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/create/project/${project.id}/edit`} style={buttonStyle('primary')}>
            Edit Project
          </Link>
          <Link href={`/create/project/${project.id}/log`} style={buttonStyle('ghost')}>
            Log Progress
          </Link>
          {nextStatus ? (
            <form action={updateProjectStatusAction}>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="status" value={nextStatus} />
              <button
                type="submit"
                style={{ ...buttonStyle('ghost'), cursor: 'pointer' }}
              >
                Advance to {formatCreateProjectStatus(nextStatus)}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <CreateMetricRow
        items={[
          { label: 'Deadline', value: formatCreateDate(project.deadline) },
          {
            label: 'Hours',
            value:
              project.estimated_hours == null
                ? `${project.actual_hours} logged`
                : `${project.actual_hours} / ${project.estimated_hours}`,
          },
          { label: 'Priority', value: String(project.priority) },
          { label: 'Updated', value: formatCreateDate(project.updated_at) },
        ]}
      />

      <CreateSection title="Status Pipeline">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CREATE_PROJECT_STATUSES.map((status) => (
            <form key={status} action={updateProjectStatusAction}>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                style={{
                  ...statusBadgeStyle(status),
                  cursor: 'pointer',
                  outline:
                    project.status === status ? '2px solid rgba(255,255,255,0.2)' : 'none',
                }}
              >
                {formatCreateProjectStatus(status)}
              </button>
            </form>
          ))}
        </div>
      </CreateSection>

      <CreateSection title="Quick Actions">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {project.status !== 'complete' && project.status !== 'archived' ? (
            <form action={updateProjectStatusAction}>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="status" value="complete" />
              <button
                type="submit"
                style={{ ...buttonStyle('primary'), cursor: 'pointer' }}
              >
                Mark Complete
              </button>
            </form>
          ) : null}
          {project.status !== 'archived' ? (
            <form action={updateProjectStatusAction}>
              <input type="hidden" name="id" value={project.id} />
              <input type="hidden" name="status" value="archived" />
              <button
                type="submit"
                style={{ ...buttonStyle('ghost'), cursor: 'pointer' }}
              >
                Archive
              </button>
            </form>
          ) : null}
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              style={{
                ...buttonStyle('ghost'),
                cursor: 'pointer',
                borderColor: 'rgba(255,69,58,0.28)',
                color: '#FFB4AB',
              }}
            >
              Delete
            </button>
          </form>
        </div>
      </CreateSection>

      <CreateSection title="Project Details">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            {fieldLabel('Tools')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.tools_used.length > 0
                ? project.tools_used.join(', ')
                : 'None added'}
            </div>
          </div>
          <div>
            {fieldLabel('Collaborators')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.collaborators.length > 0
                ? project.collaborators.join(', ')
                : 'Solo'}
            </div>
          </div>
          <div>
            {fieldLabel('Published URL')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.published_url?.trim() || 'Not linked'}
            </div>
          </div>
          <div>
            {fieldLabel('Cover Photo Ref')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.cover_photo_id?.trim() || 'Not linked'}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {fieldLabel('Inspiration References')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.inspiration_refs.length > 0
                ? project.inspiration_refs.join(', ')
                : 'No references saved'}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {fieldLabel('Outcome Notes')}
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>
              {project.outcome_notes?.trim() || 'No outcome notes yet'}
            </div>
          </div>
        </div>
      </CreateSection>

      <CreateSection title="Milestones">
        {milestones.length === 0 ? (
          <CreateEmptyPanel
            title="No milestones yet"
            body="Mark any progress log as a milestone to surface the major turning points here."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {milestones.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.02)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {entry.milestone_name?.trim() || 'Milestone'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {formatCreateDate(entry.date)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CreateSection>

      <CreateSection title="Breakthroughs">
        {breakthroughs.length === 0 ? (
          <CreateEmptyPanel
            title="No breakthroughs captured"
            body="Breakthrough notes from progress logs will collect here for quick review."
          />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {breakthroughs.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.02)',
                  display: 'grid',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                  {formatCreateDate(entry.date)}
                </div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {entry.breakthrough}
                </div>
              </div>
            ))}
          </div>
        )}
      </CreateSection>

      <CreateSection title="Progress Timeline">
        <div style={{ display: 'grid', gap: 12 }}>
          <ProgressTimeline
            entries={progress}
            emptyState={
              <CreateEmptyPanel
                title="No progress logged"
                body="Capture the first work session, milestone, or breakthrough to start the project timeline."
                actionHref={`/create/project/${project.id}/log`}
                actionLabel="Log first entry"
              />
            }
            renderItem={({ item, isLast }) => (
              <CreateTimelineEntryCard item={item} isLast={isLast} />
            )}
          />
        </div>
      </CreateSection>
    </div>
  );
}

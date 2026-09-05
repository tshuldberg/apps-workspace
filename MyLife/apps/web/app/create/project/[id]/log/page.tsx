import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CREATE_PROGRESS_MOOD_OPTIONS } from '@mylife/create';
import { createProgressEntryAction } from '../../../actions';
import { loadCreateProjectDetail } from '../../../data';
import {
  CreateFormSection,
  CreateMetricRow,
  buttonStyle,
  fieldLabel,
  textInputStyle,
} from '../../../ui';

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CreateProjectLogProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = loadCreateProjectDetail(id);
  if (!detail) notFound();

  const { project, progress } = detail;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href={`/create/project/${project.id}`}
        style={{ color: 'var(--text-secondary)', fontSize: 13 }}
      >
        ← Back to project
      </Link>

      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 30, color: 'var(--text)' }}>
          Log progress for {project.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Capture what moved, what blocked, and what clicked so the project
          timeline stays useful long after this session.
        </p>
      </div>

      <CreateMetricRow
        items={[
          { label: 'Logged Hours', value: `${project.actual_hours}` },
          { label: 'Entries', value: `${progress.length}` },
          { label: 'Current Stage', value: project.status.replace('_', ' ') },
        ]}
      />

      <form
        action={createProgressEntryAction}
        encType="multipart/form-data"
        style={{ display: 'grid', gap: 20 }}
      >
        <input type="hidden" name="project_id" value={project.id} />

        <CreateFormSection
          title="Session"
          description="Date, time spent, and the concrete work that moved this project."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              {fieldLabel('Date')}
              <input
                type="date"
                name="date"
                defaultValue={todayInputValue()}
                style={textInputStyle}
              />
            </div>
            <div>
              {fieldLabel('Hours spent')}
              <input
                type="number"
                name="hours_spent"
                min={0}
                step={0.25}
                defaultValue="0.25"
                required
                style={textInputStyle}
              />
            </div>
          </div>
          <div>
            {fieldLabel('What did you work on?')}
            <textarea
              name="notes_md"
              rows={6}
              style={{ ...textInputStyle, resize: 'vertical' }}
              placeholder="Blocked the hero, tuned the render pass, and cleaned up the export."
            />
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Signal"
          description="Mood, milestones, blockers, and breakthroughs worth revisiting later."
        >
          <div>
            {fieldLabel('Mood')}
            <select
              name="mood"
              defaultValue=""
              style={{ ...textInputStyle, appearance: 'auto' }}
            >
              <option value="">Optional</option>
              {CREATE_PROGRESS_MOOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.emoji} {option.label}
                </option>
              ))}
            </select>
          </div>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <input type="checkbox" name="milestone" />
            Treat this entry as a milestone
          </label>
          <div>
            {fieldLabel('Milestone name')}
            <input
              type="text"
              name="milestone_name"
              style={textInputStyle}
              placeholder="First draft complete"
            />
          </div>
          <div>
            {fieldLabel('Roadblock')}
            <textarea
              name="roadblock"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
              placeholder="What is slowing this down?"
            />
          </div>
          <div>
            {fieldLabel('Breakthrough')}
            <textarea
              name="breakthrough"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
              placeholder="What clicked during this session?"
            />
          </div>
        </CreateFormSection>

        <CreateFormSection
          title="Photos"
          description="Upload up to 6 process shots or store manual photo refs for later review."
        >
          <div>
            {fieldLabel('Upload photos')}
            <input
              type="file"
              name="photos"
              accept="image/*"
              multiple
              style={{ ...textInputStyle, padding: 10 }}
            />
            <p
              style={{
                margin: '8px 0 0',
                color: 'var(--text-secondary)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Uploaded images are stored as local progress-photo refs. Keep each
              file under 3 MB.
            </p>
          </div>
          <div>
            {fieldLabel('Photo refs')}
            <textarea
              name="photo_refs"
              rows={4}
              style={{ ...textInputStyle, resize: 'vertical' }}
              placeholder="Optional URLs or local refs, one per line"
            />
          </div>
        </CreateFormSection>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{ ...buttonStyle('primary'), cursor: 'pointer' }}
          >
            Save progress
          </button>
          <Link href={`/create/project/${project.id}`} style={buttonStyle('ghost')}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

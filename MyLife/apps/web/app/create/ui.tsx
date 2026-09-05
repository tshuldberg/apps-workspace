import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type {
  CreateProgressTimelineItem,
  CreateProjectRecord,
  CreateProjectSortBy,
  CreateProjectStatus,
  CreateProjectType,
} from '@mylife/create';

const ACCENT = '#D946EF';
const ACCENT_DIM = 'rgba(217,70,239,0.14)';
const ACCENT_BORDER = 'rgba(217,70,239,0.28)';

const STATUS_STYLES: Record<
  CreateProjectStatus,
  { background: string; border: string; color: string }
> = {
  idea: {
    background: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.28)',
    color: '#FDE68A',
  },
  planning: {
    background: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.28)',
    color: '#BFDBFE',
  },
  in_progress: {
    background: ACCENT_DIM,
    border: ACCENT_BORDER,
    color: '#F5D0FE',
  },
  revising: {
    background: 'rgba(249,115,22,0.12)',
    border: 'rgba(249,115,22,0.28)',
    color: '#FDBA74',
  },
  complete: {
    background: 'rgba(48,209,88,0.12)',
    border: 'rgba(48,209,88,0.28)',
    color: '#86EFAC',
  },
  archived: {
    background: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.28)',
    color: '#CBD5E1',
  },
};

export const CREATE_PROJECT_TYPES: CreateProjectType[] = [
  'art',
  'music',
  'video',
  'writing',
  'code',
  'craft',
  'photo',
  'design',
  'game_dev',
  'other',
];

export const CREATE_PROJECT_STATUSES: CreateProjectStatus[] = [
  'idea',
  'planning',
  'in_progress',
  'revising',
  'complete',
  'archived',
];

export const CREATE_PROJECT_SORT_OPTIONS: Array<{
  value: CreateProjectSortBy;
  label: string;
}> = [
  { value: 'updated_at', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'title', label: 'Title' },
  { value: 'created_at', label: 'Created' },
];

export interface CreateProjectFormDefaults {
  title: string;
  type: CreateProjectType;
  status: CreateProjectStatus;
  description: string;
  priority: string;
  deadline: string;
  estimatedHours: string;
  toolsUsed: string;
  collaborators: string;
  publishedUrl: string;
  inspirationRefs: string;
  coverPhotoId: string;
  outcomeNotes: string;
}

export const DEFAULT_CREATE_PROJECT_FORM_DEFAULTS: CreateProjectFormDefaults = {
  title: '',
  type: 'art',
  status: 'planning',
  description: '',
  priority: '2',
  deadline: '',
  estimatedHours: '',
  toolsUsed: '',
  collaborators: '',
  publishedUrl: '',
  inspirationRefs: '',
  coverPhotoId: '',
  outcomeNotes: '',
};

export function toCreateProjectFormDefaults(
  project: CreateProjectRecord,
): CreateProjectFormDefaults {
  return {
    title: project.title,
    type: project.type,
    status: project.status,
    description: project.description_md ?? '',
    priority: String(project.priority),
    deadline: project.deadline ?? '',
    estimatedHours:
      project.estimated_hours == null ? '' : String(project.estimated_hours),
    toolsUsed: project.tools_used.join(', '),
    collaborators: project.collaborators.join(', '),
    publishedUrl: project.published_url ?? '',
    inspirationRefs: project.inspiration_refs.join(', '),
    coverPhotoId: project.cover_photo_id ?? '',
    outcomeNotes: project.outcome_notes ?? '',
  };
}

export function formatCreateProjectType(type: CreateProjectType): string {
  switch (type) {
    case 'game_dev':
      return 'Game Dev';
    case 'art':
      return 'Art';
    case 'music':
      return 'Music';
    case 'video':
      return 'Video';
    case 'writing':
      return 'Writing';
    case 'code':
      return 'Code';
    case 'craft':
      return 'Craft';
    case 'photo':
      return 'Photo';
    case 'design':
      return 'Design';
    case 'other':
    default:
      return 'Other';
  }
}

export function formatCreateProjectStatus(status: CreateProjectStatus): string {
  switch (status) {
    case 'idea':
      return 'Idea';
    case 'planning':
      return 'Planning';
    case 'in_progress':
      return 'In Progress';
    case 'revising':
      return 'Revising';
    case 'complete':
      return 'Complete';
    case 'archived':
    default:
      return 'Archived';
  }
}

export function formatCreateDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function formatCreateShortDate(value: string | null | undefined): string {
  if (!value) return 'No deadline';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function getCreateNextStatus(
  status: CreateProjectStatus,
): CreateProjectStatus | null {
  const index = CREATE_PROJECT_STATUSES.indexOf(status);
  if (index === -1 || index >= CREATE_PROJECT_STATUSES.length - 2) {
    return status === 'complete' ? 'archived' : null;
  }
  return CREATE_PROJECT_STATUSES[index + 1];
}

export function buttonStyle(kind: 'primary' | 'ghost' = 'primary'): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    padding: '10px 16px',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
    border:
      kind === 'primary'
        ? '1px solid transparent'
        : `1px solid ${ACCENT_BORDER}`,
    background: kind === 'primary' ? ACCENT : ACCENT_DIM,
    color: kind === 'primary' ? 'var(--background)' : 'var(--text)',
  };
}

export const textInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--glass-border)',
  background: 'rgba(19,24,36,0.68)',
  color: 'var(--text)',
  padding: '12px 14px',
  fontSize: 15,
};

export function fieldLabel(label: string) {
  return (
    <div
      style={{
        marginBottom: 8,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--text-secondary)',
      }}
    >
      {label}
    </div>
  );
}

export function statusBadgeStyle(status: CreateProjectStatus): CSSProperties {
  const tone = STATUS_STYLES[status];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: tone.color,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  };
}

export function filterPillStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    textDecoration: 'none',
    border: `1px solid ${active ? ACCENT_BORDER : 'var(--glass-border)'}`,
    background: active ? ACCENT_DIM : 'var(--glass)',
    color: 'var(--text)',
    fontSize: 12,
    fontWeight: 700,
  };
}

export function CreateHero({
  eyebrow,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        padding: 24,
        borderRadius: 24,
        border: `1px solid ${ACCENT_BORDER}`,
        background: `linear-gradient(180deg, ${ACCENT_DIM}, rgba(255,255,255,0.03))`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: ACCENT,
        }}
      >
        {eyebrow}
      </div>
      <h1 style={{ margin: 0, fontSize: 34, color: 'var(--text)' }}>{title}</h1>
      <p
        style={{
          margin: 0,
          maxWidth: 760,
          color: 'var(--text-secondary)',
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        {body}
      </p>
      {actionHref && actionLabel ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={actionHref} style={buttonStyle('primary')}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function CreateMetricRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            borderRadius: 18,
            border: '1px solid var(--glass-border)',
            background: 'var(--glass)',
            padding: 16,
            display: 'grid',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CreateSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 20,
        borderRadius: 20,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>{title}</h2>
      {children}
    </section>
  );
}

export function CreateEmptyPanel({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: '1px dashed var(--glass-border)',
        background: 'rgba(255,255,255,0.03)',
        padding: 24,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {body}
      </p>
      {actionHref && actionLabel ? (
        <div>
          <Link href={actionHref} style={buttonStyle('primary')}>
            {actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function CreateProjectCard({
  project,
}: {
  project: CreateProjectRecord;
}) {
  return (
    <Link
      href={`/create/project/${project.id}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <article
        style={{
          display: 'grid',
          gap: 12,
          padding: 20,
          borderRadius: 20,
          border: '1px solid var(--glass-border)',
          background: 'var(--glass)',
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
              color: ACCENT,
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
        <h3 style={{ margin: 0, fontSize: 22, color: 'var(--text)' }}>
          {project.title}
        </h3>
        <p
          style={{
            margin: 0,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {project.description_md?.trim() ||
            'No description yet. Open the project to set scope, tools, references, and delivery notes.'}
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          <span>Due {formatCreateShortDate(project.deadline)}</span>
          <span>
            {project.actual_hours}h logged
            {project.estimated_hours != null
              ? ` / ${project.estimated_hours}h est`
              : ''}
          </span>
          <span>Priority {project.priority}</span>
          <span>
            {project.tools_used.length} tool
            {project.tools_used.length === 1 ? '' : 's'}
          </span>
        </div>
      </article>
    </Link>
  );
}

export function CreateTimelineEntryCard({
  item,
  isLast = false,
}: {
  item: CreateProgressTimelineItem;
  isLast?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr)',
        gap: 14,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          display: 'grid',
          justifyItems: 'center',
          gridTemplateRows: '12px minmax(0, 1fr)',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: item.milestone ? ACCENT : 'rgba(217,70,239,0.18)',
            border: `2px solid ${item.milestone ? '#F5D0FE' : ACCENT_BORDER}`,
            boxShadow: item.milestone ? `0 0 18px ${ACCENT_DIM}` : 'none',
          }}
        />
        {!isLast ? (
          <div
            style={{
              width: 2,
              height: '100%',
              marginTop: 6,
              borderRadius: 999,
              background: 'var(--glass-border)',
            }}
          />
        ) : null}
      </div>
      <div
        style={{
          display: 'grid',
          gap: 10,
          padding: 18,
          borderRadius: 18,
          border: `1px solid ${item.milestone ? ACCENT_BORDER : 'var(--glass-border)'}`,
          background: item.milestone ? ACCENT_DIM : 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {item.dateLabel}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
            {item.hoursLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {item.moodLabel ? (
            <span style={filterPillStyle(false)}>
              {item.moodEmoji} {item.moodLabel}
            </span>
          ) : null}
          {item.milestoneName ? (
            <span style={filterPillStyle(true)}>✦ {item.milestoneName}</span>
          ) : null}
          {item.photoCount > 0 ? (
            <span style={filterPillStyle(false)}>
              📷 {item.photoCount} {item.photoCount === 1 ? 'photo' : 'photos'}
            </span>
          ) : null}
        </div>
        {item.notesPreview ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {item.notesPreview}
          </p>
        ) : null}
        {item.breakthrough ? (
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>
            ✦ Breakthrough: {item.breakthrough}
          </div>
        ) : null}
        {item.roadblock ? (
          <div style={{ color: 'var(--text-secondary)' }}>
            ⚠ Roadblock: {item.roadblock}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CreateFormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 20,
        borderRadius: 20,
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>{title}</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

export function CreateProjectFormFields({
  defaults,
}: {
  defaults: CreateProjectFormDefaults;
}) {
  return (
    <>
      <CreateFormSection
        title="Basics"
        description="Project identity, stage, and the core brief."
      >
        <div>
          {fieldLabel('Title')}
          <input
            type="text"
            name="title"
            required
            defaultValue={defaults.title}
            style={textInputStyle}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            {fieldLabel('Type')}
            <select
              name="type"
              defaultValue={defaults.type}
              style={{ ...textInputStyle, appearance: 'auto' }}
            >
              {CREATE_PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatCreateProjectType(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            {fieldLabel('Status')}
            <select
              name="status"
              defaultValue={defaults.status}
              style={{ ...textInputStyle, appearance: 'auto' }}
            >
              {CREATE_PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatCreateProjectStatus(status)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          {fieldLabel('Description')}
          <textarea
            name="description_md"
            defaultValue={defaults.description}
            rows={6}
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Delivery"
        description="Priority, deadline, hours, and the media reference hook."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            {fieldLabel('Priority')}
            <input
              type="number"
              name="priority"
              min={0}
              max={10}
              step={1}
              defaultValue={defaults.priority}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Deadline')}
            <input
              type="date"
              name="deadline"
              defaultValue={defaults.deadline}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Estimated hours')}
            <input
              type="number"
              name="estimated_hours"
              min={0}
              step={0.5}
              defaultValue={defaults.estimatedHours}
              style={textInputStyle}
            />
          </div>
          <div>
            {fieldLabel('Cover photo ref')}
            <input
              type="text"
              name="cover_photo_id"
              defaultValue={defaults.coverPhotoId}
              style={textInputStyle}
            />
          </div>
        </div>
        <div>
          {fieldLabel('Tools used')}
          <textarea
            name="tools_used"
            defaultValue={defaults.toolsUsed}
            rows={4}
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
        </div>
      </CreateFormSection>

      <CreateFormSection
        title="Context"
        description="Collaborators, URLs, inspiration, and postmortem notes."
      >
        <div>
          {fieldLabel('Collaborators')}
          <textarea
            name="collaborators"
            defaultValue={defaults.collaborators}
            rows={3}
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
        </div>
        <div>
          {fieldLabel('Published URL')}
          <input
            type="url"
            name="published_url"
            defaultValue={defaults.publishedUrl}
            style={textInputStyle}
          />
        </div>
        <div>
          {fieldLabel('Inspiration references')}
          <textarea
            name="inspiration_refs"
            defaultValue={defaults.inspirationRefs}
            rows={4}
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
        </div>
        <div>
          {fieldLabel('Outcome notes')}
          <textarea
            name="outcome_notes"
            defaultValue={defaults.outcomeNotes}
            rows={5}
            style={{ ...textInputStyle, resize: 'vertical' }}
          />
        </div>
      </CreateFormSection>
    </>
  );
}

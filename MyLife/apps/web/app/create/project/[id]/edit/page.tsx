import Link from 'next/link';
import { notFound } from 'next/navigation';
import { deleteProjectAction, updateProjectAction } from '../../../actions';
import { loadCreateProjectDetail } from '../../../data';
import {
  CreateProjectFormFields,
  buttonStyle,
  toCreateProjectFormDefaults,
} from '../../../ui';

export default async function EditCreateProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = loadCreateProjectDetail(id);
  if (!detail) notFound();

  const defaults = toCreateProjectFormDefaults(detail.project);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link
        href={`/create/project/${detail.project.id}`}
        style={{ color: 'var(--text-secondary)', fontSize: 13 }}
      >
        ← Back to project
      </Link>
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 30, color: 'var(--text)' }}>
          Edit {detail.project.title}
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Realign the project brief, schedule, and references with what the
          module already tracks.
        </p>
      </div>

      <form action={updateProjectAction} style={{ display: 'grid', gap: 20 }}>
        <input type="hidden" name="id" value={detail.project.id} />
        <CreateProjectFormFields defaults={defaults} />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{ ...buttonStyle('primary'), cursor: 'pointer' }}
          >
            Save changes
          </button>
          <Link href={`/create/project/${detail.project.id}`} style={buttonStyle('ghost')}>
            Cancel
          </Link>
        </div>
      </form>

      <form action={deleteProjectAction}>
        <input type="hidden" name="id" value={detail.project.id} />
        <button
          type="submit"
          style={{
            ...buttonStyle('ghost'),
            cursor: 'pointer',
            borderColor: 'rgba(255,69,58,0.28)',
            color: '#FFB4AB',
          }}
        >
          Delete project
        </button>
      </form>
    </div>
  );
}

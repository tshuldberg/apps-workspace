import Link from 'next/link';
import { createProjectAction } from '../../actions';
import {
  CreateProjectFormFields,
  DEFAULT_CREATE_PROJECT_FORM_DEFAULTS,
  buttonStyle,
} from '../../ui';

export default function AddCreateProjectPage() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Link href="/create" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        ← Back to projects
      </Link>
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 30, color: 'var(--text)' }}>
          Add project
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Capture the brief, stage, and delivery context so the detail view has
          enough shape to track progress.
        </p>
      </div>

      <form action={createProjectAction} style={{ display: 'grid', gap: 20 }}>
        <CreateProjectFormFields defaults={DEFAULT_CREATE_PROJECT_FORM_DEFAULTS} />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{ ...buttonStyle('primary'), cursor: 'pointer' }}
          >
            Save project
          </button>
          <Link href="/create" style={buttonStyle('ghost')}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

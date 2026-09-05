import Link from 'next/link';
import { searchNotes, getFolders } from '@mylife/notes';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';

function db() {
  ensureModuleMigrations('notes');
  return getAdapter();
}

export default async function NotesSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? '' : params.q ?? '';
  const trimmed = query.trim();
  const adapter = db();
  const folders = getFolders(adapter);
  const results = trimmed ? searchNotes(adapter, trimmed, 40) : [];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 24 }}>
        <h1 style={{ margin: 0, color: TEXT, fontSize: 28 }}>Search</h1>
        <p style={{ margin: '8px 0 0', color: TEXT_SEC }}>Search your library with on-device full-text indexing. Use quotes for an exact phrase.</p>
        <form action="/notes/search" style={{ marginTop: 16 }}>
          <input
            name="q"
            defaultValue={trimmed}
            placeholder="Search notes"
            style={{ width: '100%', borderRadius: 14, border: `1px solid ${BORDER}`, backgroundColor: 'var(--surface-elevated)', color: TEXT, padding: '14px 16px', fontSize: 16 }}
          />
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 16 }}>
        <aside style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 16 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Folders</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {folders.map((folder) => (
              <div key={folder.id} style={{ borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: 'var(--surface-elevated)', padding: '10px 12px', color: TEXT_SEC }}>
                {folder.name}
              </div>
            ))}
          </div>
        </aside>

        <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 16 }}>
          <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13 }}>{trimmed ? `${results.length} results` : 'Enter a query to search your notes.'}</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/notes/${result.id}`}
                style={{ display: 'grid', gap: 6, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: 'var(--surface-elevated)', padding: 16, textDecoration: 'none' }}
              >
                <span style={{ color: TEXT, fontWeight: 700 }}>{result.title || 'Untitled'}</span>
                <span style={{ color: TEXT_SEC, fontSize: 13 }}>{result.snippet.replace(/<[^>]+>/g, '')}</span>
                <span style={{ color: ACCENT, fontSize: 13 }}>Open note</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

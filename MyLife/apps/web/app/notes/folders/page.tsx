import Link from 'next/link';
import { createFolder, getFolders, getNotes } from '@mylife/notes';
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

export default async function NotesFoldersPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedFolderId = Array.isArray(params.folder) ? params.folder[0] : params.folder;
  const adapter = db();
  const folders = getFolders(adapter);
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? folders[0] ?? null;
  const notes = getNotes(adapter, { folderId: selectedFolder?.id, limit: 200 });

  async function addFolder(formData: FormData) {
    'use server';
    const name = String(formData.get('name') ?? '').trim();
    if (!name) {
      return;
    }
    createFolder(db(), crypto.randomUUID(), { name });
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Folders</h1>
        <p style={{ margin: '8px 0 0', color: TEXT_SEC }}>Browse note collections, create new folders, and review what each folder contains.</p>
        <form action={addFolder} style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <input name="name" placeholder="New folder name" style={{ flex: 1, borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: 'var(--surface-elevated)', color: TEXT, padding: '10px 12px' }} />
          <button type="submit" style={{ borderRadius: 12, border: 'none', backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Add Folder</button>
        </form>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16 }}>
        <aside style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {folders.map((folder) => {
              const count = getNotes(adapter, { folderId: folder.id, limit: 500 }).length;
              const active = folder.id === selectedFolder?.id;
              return (
                <Link
                  key={folder.id}
                  href={`/notes/folders?folder=${encodeURIComponent(folder.id)}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    backgroundColor: active ? 'var(--glass)' : 'var(--surface-elevated)',
                    color: active ? TEXT : TEXT_SEC,
                    textDecoration: 'none',
                  }}
                >
                  <span>{folder.name}</span>
                  <span>{count}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 16 }}>
          <h2 style={{ margin: 0, color: TEXT, fontSize: 20 }}>{selectedFolder?.name ?? 'All folders'}</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {notes.map((note) => (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                style={{ display: 'grid', gap: 4, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: 'var(--surface-elevated)', padding: 16, textDecoration: 'none' }}
              >
                <span style={{ color: TEXT, fontWeight: 700 }}>{note.title || 'Untitled'}</span>
                <span style={{ color: TEXT_SEC, fontSize: 13 }}>{note.body.slice(0, 140).replace(/\n/g, ' ') || 'Empty note'}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

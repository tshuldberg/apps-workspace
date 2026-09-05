import { revalidatePath } from 'next/cache';
import { exportFlashData, listDecks, listFlashExportRecords } from '@mylife/flash';
import { getAdapter } from '@/lib/db';

const panelStyle: React.CSSProperties = {
  background: 'rgba(18,18,26,0.72)',
  border: '1px solid var(--accent-flash-border)',
  borderRadius: 'var(--radius-xxl)',
  padding: '1.5rem',
};

export default async function FlashImportPage() {
  const db = getAdapter();
  const decks = listDecks(db);
  const exports = listFlashExportRecords(db).slice(0, 8);

  async function runExport(formData: FormData) {
    'use server';

    const deckIdValue = String(formData.get('deckId') ?? '');
    const mode = String(formData.get('mode') ?? 'json');

    try {
      exportFlashData(getAdapter(), {
        deckId: deckIdValue || undefined,
        includeScheduling: mode !== 'text',
        includeTags: mode !== 'text',
      });
    } catch {
      return;
    } finally {
      revalidatePath('/flash/import');
      revalidatePath('/flash/settings');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={{ ...panelStyle, background: 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(18,18,26,0.82))' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-flash)' }}>
          Import / Export
        </p>
        <h1 style={{ margin: '10px 0 0', fontSize: '2rem', lineHeight: 1.1, color: 'var(--text)' }}>
          Move decks in or archive them out without leaving the local-first workflow.
        </h1>
        <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 720 }}>
          Web export is available now. `.apkg` parsing and preview remain mobile-first in the current hub build, so this page focuses on clean exports, history, and deck-level packaging.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>Export collection</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Package a single deck or the full collection with scheduling and tags intact.
          </p>
          <form action={runExport} style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
            <label style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
              Deck
              <select
                name="deckId"
                defaultValue=""
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                <option value="">All decks</option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
              Format
              <select
                name="mode"
                defaultValue="json"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              >
                <option value="json">JSON bundle</option>
                <option value="markdown">Markdown digest</option>
                <option value="text">Plain text</option>
              </select>
            </label>
            <button
              type="submit"
              style={{
                justifySelf: 'start',
                border: 'none',
                borderRadius: 999,
                padding: '12px 22px',
                background: 'var(--accent-flash)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Export Now
            </button>
          </form>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>Import status</h2>
          <div
            style={{
              marginTop: '1rem',
              borderRadius: 'var(--radius-xl)',
              border: '1px dashed var(--accent-flash-border)',
              background: 'var(--accent-flash-dim)',
              padding: '1.5rem',
              display: 'grid',
              gap: '0.75rem',
            }}
          >
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--text)' }}>Drag-and-drop `.apkg`</p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The parser and media import flow already exist in MyFlash. The current hub surface still runs them on mobile, where local files and package extraction are available.
            </p>
            <p style={{ margin: 0, color: 'var(--accent-flash)', fontSize: 13 }}>
              Use mobile import for now, then return here for exports and history.
            </p>
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>Recent exports</h2>
        {exports.length === 0 ? (
          <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)' }}>
            No exports yet. Run one from here or from Flash settings.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {exports.map((record) => (
              <div
                key={record.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.8fr 0.7fr',
                  gap: '0.75rem',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '0.9rem 1rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>{record.fileName}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {record.deckId ?? 'All decks'} · {record.cardsExported} cards
                  </div>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  {(record.fileSizeBytes / 1024).toFixed(1)} KB
                </div>
                <div style={{ color: 'var(--accent-flash)', fontSize: 13 }}>
                  {record.exportedAt.slice(0, 10)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

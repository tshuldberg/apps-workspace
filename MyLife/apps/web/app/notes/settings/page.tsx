import { getNotesStats, getSetting, setSetting } from '@mylife/notes';
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

export default async function NotesSettingsPage() {
  const adapter = db();
  const stats = getNotesStats(adapter);
  const sortPreference = getSetting(adapter, 'home_sort') ?? 'updated';
  const previewPreference = getSetting(adapter, 'show_preview') ?? 'true';

  async function savePreference(formData: FormData) {
    'use server';
    const key = String(formData.get('key') ?? '');
    const value = String(formData.get('value') ?? '');
    if (!key) {
      return;
    }
    setSetting(db(), key, value);
  }

  return (
    <div style={{ maxWidth: 720, display: 'grid', gap: 16 }}>
      <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: TEXT }}>Settings</h1>
        <p style={{ margin: '8px 0 0', color: TEXT_SEC }}>Tune the library view, note preview defaults, and check your local note stats.</p>
      </section>

      <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: TEXT }}>Sort Order</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['updated', 'created', 'title'].map((option) => (
            <form key={option} action={savePreference}>
              <input type="hidden" name="key" value="home_sort" />
              <input type="hidden" name="value" value={option} />
              <button type="submit" style={{ borderRadius: 999, border: `1px solid ${sortPreference === option ? ACCENT : BORDER}`, backgroundColor: sortPreference === option ? ACCENT : 'var(--surface-elevated)', color: sortPreference === option ? '#0A0A0F' : TEXT_SEC, padding: '8px 12px', cursor: 'pointer' }}>{option}</button>
            </form>
          ))}
        </div>
      </section>

      <section style={{ borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: TEXT }}>Preview Mode</h2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Show previews', value: 'true' },
            { label: 'Compact list', value: 'false' },
          ].map((option) => (
            <form key={option.value} action={savePreference}>
              <input type="hidden" name="key" value="show_preview" />
              <input type="hidden" name="value" value={option.value} />
              <button type="submit" style={{ borderRadius: 999, border: `1px solid ${previewPreference === option.value ? ACCENT : BORDER}`, backgroundColor: previewPreference === option.value ? ACCENT : 'var(--surface-elevated)', color: previewPreference === option.value ? '#0A0A0F' : TEXT_SEC, padding: '8px 12px', cursor: 'pointer' }}>{option.label}</button>
            </form>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Notes" value={String(stats.totalNotes)} />
        <StatCard label="Folders" value={String(stats.totalFolders)} />
        <StatCard label="Tags" value={String(stats.totalTags)} />
        <StatCard label="Words" value={String(stats.totalWords)} />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, padding: 16 }}>
      <p style={{ margin: 0, color: TEXT_SEC, fontSize: 12 }}>{label}</p>
      <p style={{ margin: '8px 0 0', color: ACCENT, fontSize: 28, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

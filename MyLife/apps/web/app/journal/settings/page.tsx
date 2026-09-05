import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createJournalNotebook,
  exportJournalData,
  getJournalDashboard,
  getJournalSetting,
  listJournalNotebooks,
  listJournalPromptCategories,
  serializeJournalExport,
  setJournalSetting,
} from '@mylife/journal';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: '1.25rem' },
  nav: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--accent-journal)', textDecoration: 'none', fontSize: '0.9rem' },
  navLinkActive: { color: 'var(--background)', background: 'var(--accent-journal)', padding: '0.3rem 0.75rem', borderRadius: '999px', textDecoration: 'none', fontSize: '0.9rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 },
  button: { background: 'var(--accent-journal)', color: 'var(--background)', border: 'none', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.75rem' },
  input: { padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', width: '100%' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' },
  pre: { whiteSpace: 'pre-wrap' as const, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 },
};

export default async function JournalSettingsPage() {
  // Journal's layout is a client component, so each page ensures jr_ tables
  // itself (fresh-database + hermetic prod-build safety).
  ensureModuleMigrations('journal');
  const db = getAdapter();
  const notebooks = listJournalNotebooks(db);
  const dashboard = getJournalDashboard(db);
  const promptEnabled = getJournalSetting(db, 'dailyPromptEnabled') === 'true';
  const promptCategory = getJournalSetting(db, 'dailyPromptCategory') ?? 'reflection';
  const exportPreview = serializeJournalExport(exportJournalData(db), 'markdown').slice(0, 420);

  async function togglePromptPreference() {
    'use server';

    try {
      setJournalSetting(getAdapter(), 'dailyPromptEnabled', promptEnabled ? 'false' : 'true');
    } catch (error) {
      console.error('[journal] togglePromptPreference failed:', error);
      throw error;
    } finally {
      revalidatePath('/journal/settings');
      revalidatePath('/journal');
    }
  }

  async function setPromptCategory(formData: FormData) {
    'use server';

    try {
      const category = String(formData.get('category') ?? 'reflection');
      setJournalSetting(getAdapter(), 'dailyPromptCategory', category);
    } catch (error) {
      console.error('[journal] setPromptCategory failed:', error);
      throw error;
    } finally {
      revalidatePath('/journal/settings');
      revalidatePath('/journal');
    }
  }

  async function addNotebook(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    if (!name) {
      return;
    }

    try {
      createJournalNotebook(getAdapter(), crypto.randomUUID(), { name });
    } catch (error) {
      console.error('[journal] addNotebook failed:', error);
      throw error;
    } finally {
      revalidatePath('/journal/settings');
      revalidatePath('/journal');
      revalidatePath('/journal/entries');
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Journal Settings</h1>
      <p style={styles.subtitle}>Manage notebooks, writing prompts, and data export</p>

      <div style={styles.nav}>
        <Link href="/journal" style={styles.navLink}>Today</Link>
        <Link href="/journal/entries" style={styles.navLink}>Entries</Link>
        <Link href="/journal/search" style={styles.navLink}>Search</Link>
        <Link href="/journal/settings" style={styles.navLinkActive}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Snapshot</div>
        <div style={styles.line}>Entries: {dashboard.entryCount}</div>
        <div style={styles.line}>Journals: {dashboard.journalCount}</div>
        <div style={styles.line}>Current streak: {dashboard.currentStreak}</div>
        <div style={styles.line}>Longest streak: {dashboard.longestStreak}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Notebooks</div>
        {notebooks.map((journal) => (
          <div key={journal.id} style={styles.line}>
            {journal.name}{journal.isDefault ? ' · default' : ''}
          </div>
        ))}
        <form action={addNotebook}>
          <input name="name" placeholder="New notebook name" style={styles.input} />
          <button type="submit" style={styles.button}>Create notebook</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Prompt Preference</div>
        <div style={styles.line}>Stored locally: {promptEnabled ? 'enabled' : 'disabled'}.</div>
        <form action={togglePromptPreference}>
          <button type="submit" style={styles.button}>
            {promptEnabled ? 'Disable daily prompts' : 'Enable daily prompts'}
          </button>
        </form>
        <div style={styles.chipRow}>
          {listJournalPromptCategories().map((category) => (
            <form key={category} action={setPromptCategory}>
              <input type="hidden" name="category" value={category} />
              <button
                type="submit"
                style={{
                  ...styles.chip,
                  cursor: 'pointer',
                  color: category === promptCategory ? 'var(--background)' : 'var(--text-secondary)',
                  background: category === promptCategory ? 'var(--accent-journal)' : 'var(--surface)',
                  borderColor: category === promptCategory ? 'var(--accent-journal)' : 'var(--border)',
                }}
              >
                {category}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Export Preview</div>
        <pre style={styles.pre}>{exportPreview}</pre>
      </div>
    </div>
  );
}

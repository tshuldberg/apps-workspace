import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import {
  createJournalEntry,
  getDailyJournalPrompt,
  getEntriesForDate,
  getJournalDashboard,
  getJournalSetting,
  listJournalNotebooks,
} from '@mylife/journal';
import type { JournalMood } from '@mylife/journal';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

const JOURNAL_ACCENT = 'var(--accent-journal)';
const MOODS: JournalMood[] = ['low', 'okay', 'good', 'great', 'grateful'];

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 980, margin: '0 auto' },
  header: { marginBottom: '1.5rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.25rem' },
  nav: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' as const },
  navLink: { color: 'var(--accent-journal)', textDecoration: 'none', fontSize: '0.9rem' },
  navLinkActive: { color: 'var(--background)', background: 'var(--accent-journal)', padding: '0.3rem 0.75rem', borderRadius: '999px', textDecoration: 'none', fontSize: '0.9rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  statValue: { fontSize: '1.5rem', fontWeight: 700, color: JOURNAL_ACCENT },
  small: { color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  form: { display: 'grid', gap: '0.75rem' },
  row: { display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' },
  input: { padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  textarea: { minHeight: '180px', resize: 'vertical' as const },
  button: { background: JOURNAL_ACCENT, color: 'var(--background)', border: 'none', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', fontWeight: 700, cursor: 'pointer' },
  list: { display: 'grid', gap: '0.75rem' },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'var(--surface)' },
};

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default async function JournalPage() {
  // Journal's layout is a client component, so each page ensures jr_ tables
  // itself (fresh-database + hermetic prod-build safety).
  ensureModuleMigrations('journal');
  const today = new Date().toISOString().slice(0, 10);
  const db = getAdapter();
  const notebooks = listJournalNotebooks(db);
  const defaultNotebook = notebooks[0];
  const todayEntries = getEntriesForDate(db, today, defaultNotebook?.id);
  const dashboard = getJournalDashboard(db, today, defaultNotebook?.id);
  const promptEnabled = getJournalSetting(db, 'dailyPromptEnabled') === 'true';
  const promptCategory = (getJournalSetting(db, 'dailyPromptCategory') ?? 'reflection') as 'reflection' | 'gratitude' | 'therapy' | 'stoic';
  const prompt = getDailyJournalPrompt(today, promptCategory);

  async function addEntry(formData: FormData) {
    'use server';

    const body = String(formData.get('body') ?? '').trim();
    if (!body) {
      return;
    }

    try {
      const moodValue = String(formData.get('mood') ?? '').trim();
      createJournalEntry(getAdapter(), crypto.randomUUID(), {
        journalId: String(formData.get('journalId') ?? defaultNotebook?.id ?? ''),
        entryDate: today,
        title: String(formData.get('title') ?? '').trim() || null,
        body,
        tags: splitTags(String(formData.get('tags') ?? '')),
        mood: (MOODS.includes(moodValue as JournalMood) ? moodValue : null) as JournalMood | null,
      });
    } catch (error) {
      console.error('[journal] addEntry failed:', error);
      throw error;
    } finally {
      revalidatePath('/journal');
      revalidatePath('/journal/entries');
      revalidatePath('/journal/search');
      revalidatePath('/journal/settings');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>MyJournal</h1>
        <p style={styles.subtitle}>Your thoughts stay on this device. Always private, always yours.</p>
      </div>

      <div style={styles.nav}>
        <Link href="/journal" style={styles.navLinkActive}>Today</Link>
        <Link href="/journal/entries" style={styles.navLink}>Entries</Link>
        <Link href="/journal/search" style={styles.navLink}>Search</Link>
        <Link href="/journal/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Notebooks</div>
        <div style={styles.chipRow}>
          {notebooks.map((journal) => (
            <span key={journal.id} style={styles.chip}>
              {journal.name}{journal.isDefault ? ' · default' : ''}
            </span>
          ))}
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statValue}>{todayEntries.length}</div>
          <div style={styles.small}>Entries today</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.currentStreak}</div>
          <div style={styles.small}>Current streak</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.monthlyWords}</div>
          <div style={styles.small}>Words this month</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.journalCount}</div>
          <div style={styles.small}>Journals</div>
        </div>
      </div>

      {promptEnabled ? (
        <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
          <div style={styles.sectionTitle}>Daily Prompt</div>
          <div style={styles.small}>{prompt.prompt}</div>
          <div style={styles.small}>Category: {prompt.category}</div>
        </div>
      ) : null}

      <div style={{ ...styles.card, marginBottom: '1.5rem' }}>
        <div style={styles.sectionTitle}>New entry</div>
        <form action={addEntry} style={styles.form}>
          <input type="hidden" name="journalId" value={defaultNotebook?.id ?? ''} />
          <div style={styles.row}>
            <input name="title" placeholder="Title (optional)" style={styles.input} />
            <input name="tags" placeholder="Tags, comma separated" style={styles.input} />
            <select name="mood" defaultValue="" style={styles.input}>
              <option value="">No mood</option>
              {MOODS.map((mood) => (
                <option key={mood} value={mood}>{mood}</option>
              ))}
            </select>
          </div>
          <textarea
            name="body"
            placeholder="Write what happened, what mattered, or what you want to remember."
            style={{ ...styles.input, ...styles.textarea }}
          />
          <button type="submit" style={styles.button}>Save entry</button>
        </form>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Today&apos;s entries</div>
        <div style={styles.list}>
          {todayEntries.length === 0 ? (
            <div style={styles.small}>No entries yet today.</div>
          ) : todayEntries.map((entry) => (
            <div key={entry.id} style={styles.card}>
              <div style={styles.sectionTitle}>{entry.title ?? 'Untitled entry'}</div>
              <div style={styles.small}>
                {entry.wordCount} words
                {entry.mood ? ` · mood: ${entry.mood}` : ''}
                {entry.tags.length > 0 ? ` · ${entry.tags.join(', ')}` : ''}
              </div>
              <div style={styles.small}>{entry.body.slice(0, 200)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getJournalDashboard, listJournalEntries, listJournalNotebooks, listJournalTags, listOnThisDayEntries } from '@mylife/journal';
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
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 },
  chipRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' as const, marginTop: '0.75rem' },
  chip: { padding: '0.45rem 0.8rem', borderRadius: '999px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-secondary)', background: 'var(--surface)' },
};

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[]; journal?: string | string[] }>;
}) {
  // Journal's layout is a client component, so each page ensures jr_ tables
  // itself (fresh-database + hermetic prod-build safety).
  ensureModuleMigrations('journal');
  const params = await searchParams;
  const activeTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const activeJournal = Array.isArray(params.journal) ? params.journal[0] : params.journal;
  const db = getAdapter();
  const notebooks = listJournalNotebooks(db);
  const journalId = activeJournal ?? notebooks[0]?.id;
  const tags = listJournalTags(db, journalId);
  const entries = listJournalEntries(db, { journalId, tag: activeTag || undefined, limit: 50 });
  const dashboard = getJournalDashboard(db, new Date().toISOString().slice(0, 10), journalId);
  const onThisDay = listOnThisDayEntries(db, new Date().toISOString().slice(0, 10), journalId, 5);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Journal Entries</h1>
      <p style={styles.subtitle}>Browse, filter, and revisit your past entries</p>

      <div style={styles.nav}>
        <Link href="/journal" style={styles.navLink}>Today</Link>
        <Link href="/journal/entries" style={styles.navLinkActive}>Entries</Link>
        <Link href="/journal/search" style={styles.navLink}>Search</Link>
        <Link href="/journal/settings" style={styles.navLink}>Settings</Link>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Notebook filters</div>
        <div style={styles.line}>
          Total entries: {dashboard.entryCount} · Current streak: {dashboard.currentStreak} · Longest streak: {dashboard.longestStreak}
        </div>
        <div style={styles.chipRow}>
          {notebooks.map((journal) => (
            <Link
              key={journal.id}
              href={`/journal/entries?journal=${encodeURIComponent(journal.id)}`}
              style={{
                ...styles.chip,
                color: journal.id === journalId ? 'var(--background)' : 'var(--text-secondary)',
                background: journal.id === journalId ? 'var(--accent-journal)' : 'var(--surface)',
                borderColor: journal.id === journalId ? 'var(--accent-journal)' : 'var(--border)',
              }}
            >
              {journal.name}
            </Link>
          ))}
        </div>
        <div style={styles.chipRow}>
          <Link href={`/journal/entries?journal=${encodeURIComponent(journalId ?? '')}`} style={styles.chip}>All tags</Link>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              href={`/journal/entries?journal=${encodeURIComponent(journalId ?? '')}&tag=${encodeURIComponent(tag.name)}`}
              style={{
                ...styles.chip,
                color: tag.name === activeTag ? 'var(--background)' : 'var(--text-secondary)',
                background: tag.name === activeTag ? 'var(--accent-journal)' : 'var(--surface)',
                borderColor: tag.name === activeTag ? 'var(--accent-journal)' : 'var(--border)',
              }}
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>On This Day</div>
        {onThisDay.length === 0 ? (
          <div style={styles.line}>No matching past entries for this date yet.</div>
        ) : onThisDay.map((entry) => (
          <div key={entry.id} style={styles.line}>
            {entry.entryDate} · {entry.yearsAgo} year{entry.yearsAgo === 1 ? '' : 's'} ago · {entry.title ?? 'Untitled entry'}
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div style={styles.card}>No entries match this filter yet.</div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} style={styles.card}>
            <div style={styles.sectionTitle}>{entry.title ?? 'Untitled entry'}</div>
            <div style={styles.line}>
              {entry.entryDate}
              {entry.mood ? ` · ${entry.mood}` : ''}
              {entry.tags.length > 0 ? ` · ${entry.tags.join(', ')}` : ''}
            </div>
            <div style={styles.line}>{entry.body.slice(0, 200)}</div>
          </div>
        ))
      )}
    </div>
  );
}

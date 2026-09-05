import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  getJournalEntry,
  type JournalEntryRow,
  type JournalMemoryKind,
  type JournalMemoryRow,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelPanel } from '../../_ui';
import { EditMemoryForm } from './edit-form';
import { DeleteMemoryButton } from './delete-button';

export const dynamic = 'force-dynamic';

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

interface ViewData {
  memory: JournalMemoryRow;
  entry: JournalEntryRow | null;
}

function loadData(id: string): ViewData | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();
    const rows = db.query<JournalMemoryRow>(
      `SELECT * FROM tv_journal_memories WHERE id = ?`,
      [id],
    );
    const mem = rows[0] ?? null;
    if (!mem) return { error: 'Memory not found.' };
    return { memory: mem, entry: getJournalEntry(db, mem.entry_id) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load memory' };
  }
}

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = loadData(id);

  if ('error' in result) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Memory"
          title="Could not load memory"
          body={result.error}
        />
        <Link href="/travel/memories" style={styles.backLink}>
          {'\u2190'} Back to Memories
        </Link>
      </div>
    );
  }

  const { memory, entry } = result;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Link href="/travel/memories" style={styles.backLink}>
        {'\u2190'} Back to Memories
      </Link>

      <section style={styles.hero}>
        <p style={styles.eyebrow}>
          {KIND_ICONS[memory.kind]} {memory.kind}
        </p>
        <h2 style={styles.title}>
          {memory.caption || memory.media_ref || 'Untitled memory'}
        </h2>
        {entry ? (
          <p style={styles.meta}>
            from entry on {entry.entry_date}
            {entry.title ? ` \u00b7 ${entry.title}` : ''}
          </p>
        ) : null}
      </section>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Details</h3>
        <div style={styles.kv}>
          <span style={styles.kvLabel}>Kind</span>
          <span style={styles.kvValue}>{memory.kind}</span>
        </div>
        {memory.media_ref ? (
          <div style={styles.kv}>
            <span style={styles.kvLabel}>Media</span>
            <span style={styles.kvValue}>{memory.media_ref}</span>
          </div>
        ) : null}
        {memory.caption ? (
          <div style={styles.kv}>
            <span style={styles.kvLabel}>Caption</span>
            <span style={styles.kvValue}>{memory.caption}</span>
          </div>
        ) : null}
        <div style={styles.kv}>
          <span style={styles.kvLabel}>Created</span>
          <span style={styles.kvValue}>{memory.created_at.slice(0, 10)}</span>
        </div>
      </section>

      <EditMemoryForm memory={memory} />

      <DeleteMemoryButton id={memory.id} />

      {entry ? (
        <Link href={`/travel/journal/${entry.id}`} style={styles.entryLink}>
          Open parent entry {'\u2192'}
        </Link>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  backLink: {
    color: '#0EA5E9',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 700,
  },
  hero: {
    display: 'grid',
    gap: 6,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  eyebrow: {
    margin: 0,
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 22,
    lineHeight: 1.3,
  },
  meta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
  },
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: { margin: 0, color: 'var(--text)', fontSize: 16 },
  kv: { display: 'grid', gap: 4 },
  kvLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  kvValue: {
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  entryLink: {
    color: '#0EA5E9',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 700,
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    textAlign: 'center',
  },
};

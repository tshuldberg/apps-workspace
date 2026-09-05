import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { JournalMemoryKind } from '@mylife/travel';
import type { MemoryWithEntry } from '../page';

const KIND_ICONS: Record<JournalMemoryKind, string> = {
  photo: '\u{1F4F7}',
  quote: '\u{1F4AC}',
  souvenir: '\u{1F381}',
  video: '\u{1F3A5}',
  audio: '\u{1F3A7}',
  other: '\u{2728}',
};

export function MemoryCard({ memory }: { memory: MemoryWithEntry }) {
  return (
    <Link href={`/travel/memory/${memory.id}`} style={styles.card}>
      <div style={styles.header}>
        <span style={styles.kind}>
          {KIND_ICONS[memory.kind]} {memory.kind}
        </span>
        {memory.entry_date ? (
          <span style={styles.date}>{memory.entry_date}</span>
        ) : null}
      </div>
      {memory.caption ? (
        <span style={styles.caption}>{memory.caption}</span>
      ) : null}
      {memory.media_ref ? (
        <span style={styles.ref}>{memory.media_ref}</span>
      ) : null}
      {memory.entry_title ? (
        <span style={styles.entry}>from {memory.entry_title}</span>
      ) : null}
    </Link>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: 'grid',
    gap: 6,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--text)',
    textDecoration: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kind: {
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  date: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
  },
  caption: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    overflow: 'hidden',
  },
  ref: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.4,
    wordBreak: 'break-all',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
  entry: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
};

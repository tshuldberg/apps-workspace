import type { CSSProperties } from 'react';
import type { MemoryWithEntry } from '../page';
import { MemoryCard } from './memory-card';

export function MemoriesGrid({ memories }: { memories: MemoryWithEntry[] }) {
  return (
    <section style={styles.grid}>
      {memories.map((m) => (
        <MemoryCard key={m.id} memory={m} />
      ))}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 10,
  },
};

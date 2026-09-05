import type { TodayCard as TodayCardType } from '@mylife/module-registry';
import { TodayCard } from './TodayCard';

const TEXT_SECONDARY = '#D6C3B5';

export function TodaySection({
  label,
  cards,
}: {
  label: string;
  cards: TodayCardType[];
}) {
  if (cards.length === 0) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.5,
          color: TEXT_SECONDARY,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map((card) => (
          <TodayCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

import { getFlashDashboard, getFlashSetting, listDecks } from '@mylife/flash';
import { getAdapter } from '@/lib/db';

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' },
  card: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', marginBottom: '1rem' },
  statValue: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-flash)' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  line: { color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 },
};

export default function FlashStatsPage() {
  const db = getAdapter();
  const dashboard = getFlashDashboard(db);
  const decks = listDecks(db);
  const dailyTarget = getFlashSetting(db, 'dailyStudyTarget') ?? '1';

  return (
    <div>
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.deckCount}</div>
          <div style={styles.line}>Decks</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.cardCount}</div>
          <div style={styles.line}>Cards</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.reviewedToday}</div>
          <div style={styles.line}>Reviewed today</div>
        </div>
        <div style={styles.card}>
          <div style={styles.statValue}>{dashboard.longestStreak}</div>
          <div style={styles.line}>Longest streak</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Study target</div>
        <div style={styles.line}>Daily reviews needed for streak: {dailyTarget}</div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Deck summary</div>
        {decks.map((deck) => (
          <div key={deck.id} style={styles.line}>
            {deck.name}: {deck.cardCount} cards, {deck.newCount} new, {deck.dueCount} due
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { FantasyLeague } from '@mylife/sports';
import { SPORTS_ACCENT, sportsStyles } from '../_ui';
import { sportsListFantasyLeagues } from '../actions';

export const dynamic = 'force-dynamic';

function formatRecord(wins: number, losses: number, ties: number): string {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function sportLabel(sport: string): string {
  const key = sport.toLowerCase();
  if (key === 'nfl' || key === 'nba' || key === 'mlb' || key === 'nhl' || key === 'mls') {
    return key.toUpperCase();
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function groupBySport(leagues: FantasyLeague[]) {
  const buckets = new Map<string, FantasyLeague[]>();
  for (const l of leagues) {
    const key = l.sport.toLowerCase();
    const list = buckets.get(key) ?? [];
    list.push(l);
    buckets.set(key, list);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, items]) => ({ key, label: sportLabel(key), items }));
}

export default async function SportsFantasyPage() {
  const leagues = await sportsListFantasyLeagues();
  const grouped = groupBySport(leagues);

  if (leagues.length === 0) {
    return (
      <section style={sportsStyles.panel}>
        <p style={sportsStyles.eyebrow}>Fantasy</p>
        <h2 style={sportsStyles.title}>No leagues yet</h2>
        <p style={sportsStyles.body}>
          Add your fantasy leagues to track records, rosters, and transactions
          in one calm place.
        </p>
        <Link href="/sports/fantasy/add" style={sportsStyles.primaryLink}>
          Add a league
        </Link>
      </section>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <p style={sportsStyles.eyebrow}>Fantasy</p>
          <h2 style={sportsStyles.title}>Your leagues</h2>
        </div>
        <Link href="/sports/fantasy/add" style={sportsStyles.primaryLink}>
          + Add league
        </Link>
      </div>

      {grouped.map((group) => (
        <section key={group.key} style={styles.group}>
          <h3 style={styles.groupHeader}>{group.label}</h3>
          <div style={styles.rows}>
            {group.items.map((l) => (
              <Link
                key={l.id}
                href={`/sports/fantasy/${encodeURIComponent(l.id)}`}
                style={styles.row}
              >
                <div style={styles.rowHead}>
                  <span style={styles.rowLeague}>{l.league_name}</span>
                  <span style={styles.rowRecord}>
                    {formatRecord(
                      l.record_wins,
                      l.record_losses,
                      l.record_ties,
                    )}
                  </span>
                </div>
                <div style={styles.rowMeta}>
                  {l.team_name} · {l.season} · {l.platform.toUpperCase()}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 16 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  group: { display: 'grid', gap: 8 },
  groupHeader: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: '#9F8E81',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  rows: { display: 'grid', gap: 8 },
  row: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 14,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'inherit',
    textDecoration: 'none',
  },
  rowHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  rowLeague: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--text)',
  },
  rowRecord: {
    fontSize: 13,
    fontWeight: 800,
    color: SPORTS_ACCENT,
  },
  rowMeta: {
    fontSize: 12,
    color: '#D6C3B5',
  },
};

import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { sportsGetRecLeague } from '../../../actions';
import { SPORTS_ACCENT } from '../../../_ui';
import { LeagueActionsClient } from './LeagueActionsClient';
import type { ScheduleEntry } from '@mylife/sports';

export const dynamic = 'force-dynamic';

const SPORT_ICON: Record<string, string> = {
  basketball: '🏀',
  soccer: '⚽️',
  softball: '🥎',
  baseball: '⚾️',
  volleyball: '🏐',
  hockey: '🏒',
  tennis: '🎾',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type Params = Promise<{ id: string }>;

export default async function SportsRecLeagueDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const result = await sportsGetRecLeague(id);
  if (!result.ok) {
    notFound();
  }
  const { league } = result;
  const now = Date.now();

  const past: ScheduleEntry[] = [];
  const upcoming: ScheduleEntry[] = [];
  for (const entry of league.schedule) {
    if (entry.starts_at > now) upcoming.push(entry);
    else past.push(entry);
  }
  past.sort((a, b) => b.starts_at - a.starts_at);
  upcoming.sort((a, b) => a.starts_at - b.starts_at);

  return (
    <div style={styles.wrap}>
      <p style={styles.eyebrow}>
        {SPORT_ICON[league.sport] ?? '🏟️'} {league.sport}
      </p>
      <h2 style={styles.title}>{league.league_name}</h2>
      <p style={styles.subtitle}>
        {league.team_name} · {league.season}
      </p>

      <LeagueActionsClient
        id={league.id}
        wins={league.record_wins}
        losses={league.record_losses}
        ties={league.record_ties}
      />

      <section style={styles.block}>
        <p style={styles.blockLabel}>Upcoming</p>
        {upcoming.length > 0 ? (
          <div style={styles.scheduleList}>
            {upcoming.map((entry, idx) => (
              <div key={`up-${idx}`} style={styles.scheduleRow}>
                <span style={styles.scheduleOpp}>vs {entry.opponent}</span>
                <span style={styles.scheduleMeta}>
                  {formatDate(entry.starts_at)}
                  {entry.location ? ` · ${entry.location}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.muted}>No upcoming games.</p>
        )}
      </section>

      <section style={styles.block}>
        <p style={styles.blockLabel}>Past</p>
        {past.length > 0 ? (
          <div style={styles.scheduleList}>
            {past.map((entry, idx) => (
              <div key={`pa-${idx}`} style={styles.scheduleRow}>
                <span style={styles.scheduleOpp}>vs {entry.opponent}</span>
                <span style={styles.scheduleMeta}>
                  {formatDate(entry.starts_at)}
                  {entry.location ? ` · ${entry.location}` : ''}
                  {entry.result ? ` · ${entry.result}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.muted}>No past games logged.</p>
        )}
      </section>

      {league.notes_md ? (
        <section style={styles.block}>
          <p style={styles.blockLabel}>Notes</p>
          <div style={styles.notesCard}>
            <p style={styles.notesText}>{league.notes_md}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: { display: 'grid', gap: 14 },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: SPORTS_ACCENT,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 800,
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  block: { display: 'grid', gap: 10, marginTop: 4 },
  blockLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--text-secondary)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  },
  scheduleList: { display: 'grid', gap: 8 },
  scheduleRow: {
    display: 'grid',
    gap: 2,
    padding: 12,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  scheduleOpp: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
  },
  scheduleMeta: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  muted: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  notesCard: {
    padding: 14,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  notesText: {
    margin: 0,
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
};

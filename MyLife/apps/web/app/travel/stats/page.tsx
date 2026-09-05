import type { CSSProperties } from 'react';
import {
  countriesVisited,
  statesVisited,
  continentsVisited,
  regionCoverage,
  totalTripDays,
  totalDistanceKm,
  tripsByYear,
  topDestinations,
  upcomingTripsCount,
  type DestinationRow,
  type RegionCoverage,
  type RegionKey,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelBulletList, TravelPanel } from '../_ui';

export const dynamic = 'force-dynamic';

interface StatsViewData {
  countries: number;
  states: number;
  continents: string[];
  regions: Array<{ key: RegionKey; label: string; coverage: RegionCoverage }>;
  tripDays: number;
  distanceKm: number;
  upcoming: number;
  byYear: Record<string, number>;
  top: DestinationRow[];
}

const REGIONS: Array<{ key: RegionKey; label: string }> = [
  { key: 'schengen', label: 'Schengen' },
  { key: 'g7', label: 'G7' },
  { key: 'nordic', label: 'Nordic' },
  { key: 'eu_countries', label: 'EU' },
];

function loadStats(): StatsViewData | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();
    const regions = REGIONS.map(({ key, label }) => ({
      key,
      label,
      coverage: regionCoverage(db, key),
    }));
    return {
      countries: countriesVisited(db),
      states: statesVisited(db),
      continents: continentsVisited(db),
      regions,
      tripDays: totalTripDays(db),
      distanceKm: totalDistanceKm(db),
      upcoming: upcomingTripsCount(db),
      byYear: tripsByYear(db),
      top: topDestinations(db, 5),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load stats' };
  }
}

export default function TravelStatsPage() {
  const result = loadStats();

  if ('error' in result) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Stats"
          title="Could not load stats"
          body={result.error}
        >
          <TravelBulletList
            items={[
              'Try refreshing the page to retry the query.',
              'If the error persists, check that the travel module is enabled.',
            ]}
          />
        </TravelPanel>
      </div>
    );
  }

  const empty =
    result.countries === 0 &&
    result.states === 0 &&
    result.continents.length === 0 &&
    result.tripDays === 0 &&
    result.upcoming === 0 &&
    Object.keys(result.byYear).length === 0 &&
    result.top.length === 0;

  if (empty) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Stats"
          title="Your passport"
          body="Start logging trips and destinations to see your passport come to life."
        >
          <TravelBulletList
            items={[
              'Log a trip on the Trips tab.',
              'Mark destinations as visited on the Destinations tab.',
            ]}
          />
        </TravelPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Stats"
        title="Your passport"
        body="Countries, states, continents, and region progress from everywhere you have traveled."
      />

      <div style={styles.heroRow}>
        <BigNumber label="Countries" value={result.countries} highlight />
        <BigNumber label="States" value={result.states} />
        <BigNumber label="Continents" value={result.continents.length} />
      </div>

      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Region coverage</h3>
        <div style={styles.regionGrid}>
          {result.regions.map((r) => (
            <RegionBar key={r.key} label={r.label} coverage={r.coverage} />
          ))}
        </div>
      </section>

      <div style={styles.metricsRow}>
        <MetricCard label="Trip days" value={result.tripDays.toLocaleString()} />
        <MetricCard
          label="Distance km"
          value={Math.round(result.distanceKm).toLocaleString()}
        />
        <MetricCard label="Upcoming" value={result.upcoming.toLocaleString()} />
      </div>

      <TripsByYearChart byYear={result.byYear} />

      <TopDestinations rows={result.top} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function BigNumber({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.bigCard,
        ...(highlight ? styles.bigCardAccent : {}),
      }}
    >
      <span style={styles.bigValue}>{value.toLocaleString()}</span>
      <span style={styles.bigLabel}>{label}</span>
    </div>
  );
}

function RegionBar({
  label,
  coverage,
}: {
  label: string;
  coverage: RegionCoverage;
}) {
  const pct = Math.max(0, Math.min(100, coverage.pct));
  return (
    <div style={styles.regionItem}>
      <div style={styles.regionHeader}>
        <span style={styles.regionLabel}>{label}</span>
        <span style={styles.regionValue}>
          {coverage.visited}/{coverage.total} · {pct}%
        </span>
      </div>
      <div style={styles.regionTrack}>
        <div style={{ ...styles.regionFill, width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricValue}>{value}</span>
    </div>
  );
}

function TripsByYearChart({ byYear }: { byYear: Record<string, number> }) {
  const years = Object.keys(byYear).sort();
  if (years.length === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Trips by year</h3>
        <p style={styles.muted}>No dated trips yet.</p>
      </section>
    );
  }
  const max = Math.max(...years.map((y) => byYear[y] ?? 0), 1);
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Trips by year</h3>
      <div style={styles.chartRows}>
        {years.map((year) => {
          const count = byYear[year] ?? 0;
          const pct = Math.round((count / max) * 100);
          return (
            <div key={year} style={styles.chartRow}>
              <span style={styles.chartYear}>{year}</span>
              <div style={styles.chartTrack}>
                <div style={{ ...styles.chartFill, width: `${pct}%` }} />
              </div>
              <span style={styles.chartCount}>{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopDestinations({ rows }: { rows: DestinationRow[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Top destinations</h3>
      {rows.length === 0 ? (
        <p style={styles.muted}>No visited destinations yet.</p>
      ) : (
        <ul style={styles.list}>
          {rows.map((row, idx) => (
            <li key={row.id} style={styles.row}>
              <span style={styles.rank}>{idx + 1}</span>
              <div style={styles.rowMain}>
                <span style={styles.rowTitle}>{row.name}</span>
                <span style={styles.rowSub}>
                  {row.country ?? 'Unknown'}
                  {row.last_visited ? ` · last ${row.last_visited}` : ''}
                </span>
              </div>
              <span style={styles.rowValue}>
                {row.visit_count} {row.visit_count === 1 ? 'visit' : 'visits'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text)',
  },
  muted: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  heroRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  bigCard: {
    display: 'grid',
    gap: 4,
    padding: '18px 14px',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    justifyItems: 'center',
  },
  bigCardAccent: {
    background: 'rgba(14,165,233,0.12)',
    border: '1px solid rgba(14,165,233,0.32)',
  },
  bigValue: {
    color: 'var(--text)',
    fontSize: 30,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  bigLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  regionGrid: {
    display: 'grid',
    gap: 14,
  },
  regionItem: {
    display: 'grid',
    gap: 6,
  },
  regionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regionLabel: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
  },
  regionValue: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
  },
  regionTrack: {
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  regionFill: {
    height: '100%',
    background: '#0EA5E9',
    borderRadius: 999,
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  metricCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 20,
    fontWeight: 800,
  },
  chartRows: {
    display: 'grid',
    gap: 8,
  },
  chartRow: {
    display: 'grid',
    gridTemplateColumns: '46px 1fr 36px',
    alignItems: 'center',
    gap: 10,
  },
  chartYear: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  chartTrack: {
    height: 12,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    background: '#0EA5E9',
    borderRadius: 999,
  },
  chartCount: {
    textAlign: 'right',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rank: {
    width: 22,
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: 800,
  },
  rowMain: {
    flex: 1,
    display: 'grid',
    gap: 2,
  },
  rowTitle: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
  },
  rowSub: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  rowValue: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  },
};

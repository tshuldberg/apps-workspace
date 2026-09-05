import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
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
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface StatsData {
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

export default function TravelStatsScreen() {
  const db = useDatabase();
  const [status, setStatus] = useState<LoadState>('idle');
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    try {
      const regions = REGIONS.map(({ key, label }) => ({
        key,
        label,
        coverage: regionCoverage(db, key),
      }));
      setData({
        countries: countriesVisited(db),
        states: statesVisited(db),
        continents: continentsVisited(db),
        regions,
        tripDays: totalTripDays(db),
        distanceKm: totalDistanceKm(db),
        upcoming: upcomingTripsCount(db),
        byYear: tripsByYear(db),
        top: topDestinations(db, 5),
      });
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
      setStatus('error');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const empty =
    data != null &&
    data.countries === 0 &&
    data.states === 0 &&
    data.continents.length === 0 &&
    data.tripDays === 0 &&
    data.upcoming === 0 &&
    Object.keys(data.byYear).length === 0 &&
    data.top.length === 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Stats</Text>
        <Text style={styles.title}>Your passport</Text>
        <Text style={styles.subtitle}>
          Countries, states, continents, and region progress from everywhere you have traveled.
        </Text>
      </View>

      {status === 'loading' ? (
        <View style={styles.panel}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
          <Text style={styles.muted}>Loading stats...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && data && empty ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>No stats yet</Text>
          <Text style={styles.muted}>
            Start logging trips and destinations to see your passport come to life.
          </Text>
        </View>
      ) : null}

      {status === 'ready' && data && !empty ? (
        <>
          <View style={styles.heroRow}>
            <BigNumber label="Countries" value={data.countries} highlight />
            <BigNumber label="States" value={data.states} />
            <BigNumber label="Continents" value={data.continents.length} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Region coverage</Text>
            <View style={styles.regionGrid}>
              {data.regions.map((r) => (
                <RegionBar key={r.key} label={r.label} coverage={r.coverage} />
              ))}
            </View>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard label="Trip days" value={data.tripDays.toLocaleString()} />
            <MetricCard
              label="Distance km"
              value={Math.round(data.distanceKm).toLocaleString()}
            />
            <MetricCard label="Upcoming" value={data.upcoming.toLocaleString()} />
          </View>

          <TripsByYearChart byYear={data.byYear} />

          <TopDestinations rows={data.top} />
        </>
      ) : null}
    </ScrollView>
  );
}

// ── Big number card ───────────────────────────────────────────────────

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
    <View style={[styles.bigCard, highlight ? styles.bigCardAccent : null]}>
      <Text style={styles.bigValue}>{value.toLocaleString()}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

// ── Region bar ────────────────────────────────────────────────────────

function RegionBar({
  label,
  coverage,
}: {
  label: string;
  coverage: RegionCoverage;
}) {
  const pct = Math.max(0, Math.min(100, coverage.pct));
  return (
    <View style={styles.regionItem}>
      <View style={styles.regionHeader}>
        <Text style={styles.regionLabel}>{label}</Text>
        <Text style={styles.regionValue}>
          {coverage.visited}/{coverage.total} · {pct}%
        </Text>
      </View>
      <View style={styles.regionTrack}>
        <View style={[styles.regionFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

// ── Metric card ───────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// ── Trips by year ─────────────────────────────────────────────────────

function TripsByYearChart({ byYear }: { byYear: Record<string, number> }) {
  const years = Object.keys(byYear).sort();
  if (years.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Trips by year</Text>
        <Text style={styles.muted}>No dated trips yet.</Text>
      </View>
    );
  }
  const max = Math.max(...years.map((y) => byYear[y] ?? 0), 1);
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Trips by year</Text>
      <View style={styles.chartRows}>
        {years.map((year) => {
          const count = byYear[year] ?? 0;
          const pct = Math.round((count / max) * 100);
          return (
            <View key={year} style={styles.chartRow}>
              <Text style={styles.chartYear}>{year}</Text>
              <View style={styles.chartTrack}>
                <View style={[styles.chartFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.chartCount}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Top destinations ──────────────────────────────────────────────────

function TopDestinations({ rows }: { rows: DestinationRow[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Top destinations</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No visited destinations yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row, idx) => (
            <View key={row.id} style={styles.row}>
              <Text style={styles.rank}>{idx + 1}</Text>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.rowSub}>
                  {row.country ?? 'Unknown'}
                  {row.last_visited ? ` · last ${row.last_visited}` : ''}
                </Text>
              </View>
              <Text style={styles.rowValue}>
                {row.visit_count} {row.visit_count === 1 ? 'visit' : 'visits'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorPanel: {
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.12)',
  },
  errorText: {
    color: '#FFB4AB',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bigCard: {
    flex: 1,
    gap: 4,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bigCardAccent: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderColor: 'rgba(14,165,233,0.32)',
  },
  bigValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bigLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  regionGrid: {
    gap: 14,
  },
  regionItem: {
    gap: 6,
  },
  regionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  regionValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  regionTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    overflow: 'hidden',
  },
  regionFill: {
    height: '100%',
    backgroundColor: TRAVEL_ACCENT,
    borderRadius: 999,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  chartRows: {
    gap: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chartYear: {
    width: 46,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  chartTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    backgroundColor: TRAVEL_ACCENT,
    borderRadius: 999,
  },
  chartCount: {
    width: 28,
    textAlign: 'right',
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: {
    width: 22,
    color: TRAVEL_ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});

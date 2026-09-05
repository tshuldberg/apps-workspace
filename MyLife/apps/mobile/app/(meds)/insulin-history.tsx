import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import type { BodyRegionId } from '@mylife/meds/ui';
import type { InjectionSiteName, InsulinEntry } from '@mylife/meds';
import {
  calculateDailyAverage,
  calculateIOB,
  getDailyInsulinTotals,
  getInjectionSites,
  getInsulinEntries,
  getSiteRecency,
} from '@mylife/meds';
import {
  BodyDiagram,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Bolus', value: 'bolus' },
  { label: 'Basal', value: 'basal' },
  { label: 'Correction', value: 'correction' },
] as const;

const SITE_LABELS: Record<InjectionSiteName, string> = {
  abdomen_left: 'Left abdomen',
  abdomen_right: 'Right abdomen',
  thigh_left: 'Left thigh',
  thigh_right: 'Right thigh',
  arm_left: 'Left arm',
  arm_right: 'Right arm',
  buttock_left: 'Left glute',
  buttock_right: 'Right glute',
};

const SITE_REGION_MAP: Record<InjectionSiteName, { region: BodyRegionId; side: 'front' | 'back' }> = {
  abdomen_left: { region: 'abdomen', side: 'front' },
  abdomen_right: { region: 'abdomen', side: 'front' },
  thigh_left: { region: 'left_leg', side: 'front' },
  thigh_right: { region: 'right_leg', side: 'front' },
  arm_left: { region: 'left_arm', side: 'front' },
  arm_right: { region: 'right_arm', side: 'front' },
  buttock_left: { region: 'back', side: 'back' },
  buttock_right: { region: 'back', side: 'back' },
};

const RECENCY_COLOR = {
  recent: '#FF453A',
  moderate: '#FFD60A',
  available: '#30D158',
} as const;

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function groupEntriesByDate(entries: InsulinEntry[]) {
  const groups = new Map<string, InsulinEntry[]>();

  entries.forEach((entry) => {
    const key = entry.administeredAt.slice(0, 10);
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  });

  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
}

function calculateRotationScore(
  sites: Array<{ siteName: InjectionSiteName; useCount: number; lastUsedAt: string }>,
): number {
  if (!sites.length) {
    return 100;
  }

  const totalUses = sites.reduce((sum, site) => sum + site.useCount, 0);
  const coverage = sites.length / 8;
  const maxShare = totalUses > 0
    ? Math.max(...sites.map((site) => site.useCount / totalUses))
    : 1;
  const recentPenalty = sites.filter((site) => getSiteRecency(site.lastUsedAt) === 'recent').length * 6;

  const rawScore = coverage * 60 + (1 - maxShare) * 40 - recentPenalty;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

function DailyTotalsChart({
  totals,
}: {
  totals: Array<{ date: string; total: number }>;
}) {
  if (!totals.length) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Log a few doses to unlock daily totals.</Text>
      </View>
    );
  }

  const width = 320;
  const height = 152;
  const padding = 18;
  const barWidth = 18;
  const maxValue = Math.max(...totals.map((item) => item.total), 1);
  const gap = (width - padding * 2 - barWidth * totals.length) / Math.max(1, totals.length - 1);

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
      {totals.map((item, index) => {
        const barHeight = Math.max(8, (item.total / maxValue) * (height - padding * 2));
        const x = padding + index * (barWidth + gap);
        const y = height - padding - barHeight;
        return (
          <Rect
            key={item.date}
            fill={withAlpha(MD_ACCENT, 0.85)}
            height={barHeight}
            rx={9}
            width={barWidth}
            x={x}
            y={y}
          />
        );
      })}
    </Svg>
  );
}

export default function InsulinHistoryScreen() {
  const db = useDatabase();
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]['value']>('all');
  const [refreshToken, setRefreshToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((value) => value + 1);
    }, []),
  );

  const entries = useMemo(() => getInsulinEntries(db, { limit: 500 }), [db, refreshToken]);
  const siteHistory = useMemo(() => getInjectionSites(db), [db, refreshToken]);

  const filteredEntries = useMemo(() => (
    filter === 'all' ? entries : entries.filter((entry) => entry.doseCategory === filter)
  ), [entries, filter]);

  const dailyTotals = useMemo(() => getDailyInsulinTotals(entries), [entries]);
  const recentDailyTotals = useMemo(() => dailyTotals.slice(-7), [dailyTotals]);
  const sevenDayAverage = useMemo(() => calculateDailyAverage(recentDailyTotals), [recentDailyTotals]);
  const insulinOnBoard = useMemo(() => calculateIOB(entries), [entries]);
  const rotationScore = useMemo(() => calculateRotationScore(siteHistory), [siteHistory]);
  const groupedEntries = useMemo(() => groupEntriesByDate(filteredEntries), [filteredEntries]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayTotal = recentDailyTotals.find((item) => item.date === todayKey)?.total ?? 0;
  const siteReuseWarning = siteHistory.find((site) => getSiteRecency(site.lastUsedAt) === 'recent') ?? null;

  const heatmapRegions = useMemo(() => {
    const regionState = new Map<string, { id: BodyRegionId; side: 'front' | 'back'; tone: string }>();

    siteHistory.forEach((site) => {
      const mapping = SITE_REGION_MAP[site.siteName];
      const recency = getSiteRecency(site.lastUsedAt);
      const tone = recency === 'available'
        ? withAlpha(RECENCY_COLOR.available, 0.24)
        : withAlpha(RECENCY_COLOR[recency], recency === 'recent' ? 0.7 : 0.48);
      const key = `${mapping.region}-${mapping.side}`;
      const existing = regionState.get(key);

      if (!existing || recency === 'recent') {
        regionState.set(key, { id: mapping.region, side: mapping.side, tone });
      }
    });

    return Array.from(regionState.values());
  }, [siteHistory]);

  if (!entries.length) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard intensity={22} padding={22} style={styles.emptyCard}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="vaccines" size={26} />
          <Text style={styles.emptyTitle}>No insulin entries yet</Text>
          <Text style={styles.emptyBody}>Once you log doses, this screen will show daily totals, rotation patterns, and site history.</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <GlassCard intensity={26} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>Insulin History</Text>
        <View style={styles.heroTop}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>{todayTotal.toFixed(1)}u</Text>
            <Text style={styles.heroLabel}>Today</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>{sevenDayAverage.toFixed(1)}u</Text>
            <Text style={styles.heroLabel}>7-day average</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroValue}>{rotationScore}</Text>
            <Text style={styles.heroLabel}>Rotation score</Text>
          </View>
        </View>

        <View style={styles.iobStrip}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="timeline" size={18} />
          <Text style={styles.iobStripText}>Insulin on board: {insulinOnBoard.toFixed(1)} units</Text>
        </View>
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Daily Totals" />
        <GlassCard intensity={16} padding={18}>
          <DailyTotalsChart totals={recentDailyTotals} />
          <Text style={styles.chartFootnote}>Daily insulin totals across the last 7 active days.</Text>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader
          action={(
            <Pressable onPress={() => router.push('/(meds)/log-insulin' as never)}>
              <Text style={styles.headerAction}>Log rotation</Text>
            </Pressable>
          )}
          title="Injection Site Heatmap"
        />
        <GlassCard intensity={16} padding={18} style={styles.heatmapCard}>
          <BodyDiagram regions={heatmapRegions} />
          <View style={styles.siteSummaryList}>
            {siteHistory.map((site) => {
              const recency = getSiteRecency(site.lastUsedAt);
              return (
                <View key={site.siteName} style={styles.siteSummaryRow}>
                  <View style={[styles.siteDot, { backgroundColor: RECENCY_COLOR[recency] }]} />
                  <View style={styles.siteSummaryCopy}>
                    <Text style={styles.siteSummaryTitle}>{SITE_LABELS[site.siteName]}</Text>
                    <Text style={styles.siteSummaryBody}>
                      {site.useCount} uses • last {formatDateLabel(site.lastUsedAt)}
                    </Text>
                  </View>
                  <Text style={styles.siteSummaryCount}>{site.useCount}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {siteReuseWarning ? (
          <GlassCard intensity={12} padding={16} style={styles.warningCard}>
            <MaterialSymbol color="#FF453A" name="warning" size={18} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Rotation reminder</Text>
              <Text style={styles.warningBody}>
                {SITE_LABELS[siteReuseWarning.siteName]} was used recently. Consider rotating before the next injection.
              </Text>
            </View>
          </GlassCard>
        ) : null}
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Activity History" />
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const active = option.value === filter;
            return (
              <Pressable
                key={option.value}
                onPress={() => setFilter(option.value)}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
              >
                <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.groupedList}>
          {groupedEntries.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <Text style={styles.dayHeading}>{formatDateLabel(group.date)}</Text>
              {group.items.map((entry) => (
                <GlassCard key={entry.id} intensity={12} padding={16} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <View>
                      <Text style={styles.entryValue}>{entry.units.toFixed(1)} units</Text>
                      <Text style={styles.entryTime}>{formatTimeLabel(entry.administeredAt)}</Text>
                    </View>
                    <View style={styles.entryTagRow}>
                      <View style={styles.entryTag}>
                        <Text style={styles.entryTagText}>{formatLabel(entry.doseCategory)}</Text>
                      </View>
                      <View style={styles.entryTagGhost}>
                        <Text style={styles.entryTagGhostText}>{formatLabel(entry.insulinType)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.entryMetaWrap}>
                    {entry.injectionSite ? (
                      <View style={styles.entryMetaPill}>
                        <MaterialSymbol color={MD_ACCENT_LIGHT} name="favorite" size={14} />
                        <Text style={styles.entryMetaText}>{SITE_LABELS[entry.injectionSite]}</Text>
                      </View>
                    ) : null}
                    {entry.carbsCovered !== null ? (
                      <View style={styles.entryMetaPill}>
                        <MaterialSymbol color={MD_ACCENT_LIGHT} name="restaurant_menu" size={14} />
                        <Text style={styles.entryMetaText}>{entry.carbsCovered}g carbs</Text>
                      </View>
                    ) : null}
                    {entry.bloodGlucoseBefore !== null ? (
                      <View style={styles.entryMetaPill}>
                        <MaterialSymbol color={MD_ACCENT_LIGHT} name="bloodtype" size={14} />
                        <Text style={styles.entryMetaText}>{Math.round(entry.bloodGlucoseBefore)} mg/dL</Text>
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              ))}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.72),
    borderRadius: 24,
    gap: 18,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetric: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 20,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  heroValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  heroLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 4,
  },
  iobStrip: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT, 0.12),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iobStripText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
  },
  sectionWrap: {
    gap: 14,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  chartEmptyText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  chartFootnote: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    marginTop: 8,
  },
  heatmapCard: {
    gap: 16,
  },
  siteSummaryList: {
    gap: 10,
  },
  siteSummaryRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  siteDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  siteSummaryCopy: {
    flex: 1,
    gap: 2,
  },
  siteSummaryTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  siteSummaryBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  siteSummaryCount: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  warningCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  warningCopy: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  warningBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  headerAction: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPill: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterPillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
  },
  filterText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  filterTextActive: {
    color: '#041317',
  },
  groupedList: {
    gap: 16,
  },
  dayGroup: {
    gap: 10,
  },
  dayHeading: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginLeft: 2,
  },
  entryCard: {
    gap: 12,
  },
  entryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  entryValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    lineHeight: 28,
  },
  entryTime: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  entryTagRow: {
    alignItems: 'flex-end',
    gap: 8,
  },
  entryTag: {
    backgroundColor: withAlpha(MD_ACCENT, 0.18),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  entryTagText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  entryTagGhost: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  entryTagGhostText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  entryMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entryMetaPill: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  entryMetaText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    gap: 10,
    marginTop: 32,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    textAlign: 'center',
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
});

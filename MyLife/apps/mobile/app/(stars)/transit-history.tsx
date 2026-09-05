import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getBirthProfiles,
  getTransitEventsByProfile,
  classifySignificance,
  filterBySignificance,
} from '@mylife/stars';
import type { TransitSignificance } from '@mylife/stars';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.stars;

const SIGNIFICANCE_COLORS: Record<TransitSignificance, string> = {
  major: colors.danger,
  minor: colors.textTertiary,
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TransitHistoryScreen() {
  const db = useDatabase();
  const [filter, setFilter] = useState<TransitSignificance | null>(null);

  const profiles = useMemo(() => getBirthProfiles(db), [db]);
  const primaryProfile = profiles[0] ?? null;

  // Get transits for the past year and upcoming 3 months
  const now = new Date();
  const startDate = new Date(now.getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const allTransits = useMemo(
    () => (primaryProfile ? getTransitEventsByProfile(db, primaryProfile.id, startDate, endDate) : []),
    [db, primaryProfile, startDate, endDate],
  );

  const filteredTransits = useMemo(
    () => (filter ? filterBySignificance(allTransits, filter) : allTransits),
    [allTransits, filter],
  );

  const pastTransits = filteredTransits.filter((t) => t.exactDate <= today);
  const upcomingTransits = filteredTransits.filter((t) => t.exactDate > today);

  const FILTERS: Array<TransitSignificance | null> = [null, 'major', 'minor'];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!primaryProfile ? (
        <Card>
          <Text variant="body" color={colors.textSecondary}>
            Add a birth profile to see transit history.
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text variant="subheading">Transit History</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {primaryProfile.name} -- {allTransits.length} transits tracked
            </Text>
          </Card>

          {/* Filter chips */}
          <View style={styles.chipRow}>
            {FILTERS.map((f) => {
              const selected = f === filter;
              return (
                <Pressable
                  key={f ?? 'all'}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {f ? capitalize(f) : 'All'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Upcoming transits */}
          {upcomingTransits.length > 0 && (
            <Card>
              <Text variant="subheading">Upcoming</Text>
              <View style={styles.list}>
                {upcomingTransits.slice(0, 15).map((transit) => (
                  <View key={transit.id} style={styles.transitRow}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">
                        {transit.transitingBody} {transit.aspectType} {transit.natalBody}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {transit.exactDate} -- {transit.isApplying ? 'Applying' : 'Separating'} (orb: {transit.currentOrb.toFixed(1)})
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {transit.interpretationBrief}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: SIGNIFICANCE_COLORS[transit.significance] }]}>
                      <Text variant="caption" color={colors.background}>
                        {transit.significance.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Past transits */}
          <Card>
            <Text variant="subheading">Past Transits</Text>
            <View style={styles.list}>
              {pastTransits.length === 0 ? (
                <Text variant="caption" color={colors.textSecondary}>
                  No past transits recorded.
                </Text>
              ) : (
                pastTransits.slice(0, 30).map((transit) => (
                  <View key={transit.id} style={styles.transitRow}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">
                        {transit.transitingBody} {transit.aspectType} {transit.natalBody}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {transit.exactDate}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {transit.interpretationBrief}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: SIGNIFICANCE_COLORS[transit.significance] }]}>
                      <Text variant="caption" color={colors.background}>
                        {transit.significance.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </Card>

          {/* Major transits summary */}
          {(() => {
            const majorTransits = allTransits.filter((t) => t.significance === 'major');
            if (majorTransits.length === 0) return null;
            return (
              <Card>
                <Text variant="subheading">Major Transits This Year</Text>
                <View style={styles.list}>
                  {majorTransits.map((transit) => (
                    <View key={transit.id} style={styles.majorRow}>
                      <Text variant="body" color={ACCENT}>
                        {transit.transitingBody} {transit.aspectType} {transit.natalBody}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {transit.exactDate} -- {transit.interpretationBrief}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  transitRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  majorRow: { gap: 2, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: ACCENT },
});

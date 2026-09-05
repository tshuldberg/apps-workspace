import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getClosetDashboard, listDonationCandidates } from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const CLOSET_ACCENT = '#E879A8';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default function ClosetStatsScreen() {
  const db = useDatabase();
  const dashboard = useMemo(() => getClosetDashboard(db), [db]);
  const donationCandidates = useMemo(() => listDonationCandidates(db).slice(0, 8), [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Wardrobe Analytics</Text>
        <View style={styles.statsGrid}>
          <Stat label="Items Worn 30d" value={String(dashboard.itemsWorn30Days)} />
          <Stat label="Donation Candidates" value={String(dashboard.donationCandidateCount)} />
          <Stat label="Value" value={`$${(dashboard.wardrobeValueCents / 100).toFixed(0)}`} />
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Donation Candidates</Text>
        <View style={styles.list}>
          {donationCandidates.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text variant="subheading" style={{ textAlign: 'center' }}>Everything is well-loved</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                No items flagged for donation right now.
              </Text>
            </View>
          ) : (
            donationCandidates.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text variant="body">{item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Last worn {item.lastWornDate ?? 'never'} · {item.category}
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statCard: {
    minWidth: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 4,
  },
  statValue: {
    color: CLOSET_ACCENT,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 44,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    gap: 4,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
});

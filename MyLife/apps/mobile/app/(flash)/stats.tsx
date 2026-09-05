import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getFlashDashboard, getFlashSetting, listDecks } from '@mylife/flash';
import { FLASH_MODULE } from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const FLASH_ACCENT = FLASH_MODULE.accentColor;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

export default function FlashStatsScreen() {
  const db = useDatabase();
  const dashboard = useMemo(() => getFlashDashboard(db), [db]);
  const decks = useMemo(() => listDecks(db), [db]);
  const dailyTarget = useMemo(() => getFlashSetting(db, 'dailyStudyTarget') ?? '1', [db]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Study Dashboard</Text>
        <View style={styles.statsGrid}>
          <Stat label="Decks" value={String(dashboard.deckCount)} />
          <Stat label="Cards" value={String(dashboard.cardCount)} />
          <Stat label="Reviewed Today" value={String(dashboard.reviewedToday)} />
          <Stat label="Longest Streak" value={String(dashboard.longestStreak)} />
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          Daily study target: {dailyTarget} reviews to count the day toward your streak.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Deck Summary</Text>
        <View style={styles.list}>
          {decks.map((deck) => (
            <View key={deck.id} style={styles.row}>
              <Text variant="body">{deck.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {deck.cardCount} cards · {deck.newCount} new · {deck.dueCount} due
              </Text>
            </View>
          ))}
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
    marginBottom: spacing.sm,
  },
  statCard: {
    minWidth: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    color: FLASH_ACCENT,
    fontSize: 22,
    fontWeight: '700',
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

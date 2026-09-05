import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  listDecks,
  listDueFlashcards,
  getFlashDashboard,
  buildReviewForecast,
  browseFlashcards,
  type Deck,
  type FlashDashboard,
} from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#9B7DDB';

export default function ScheduleScreen() {
  const db = useDatabase();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const dashboard: FlashDashboard | null = useMemo(() => {
    try { return getFlashDashboard(db); } catch { return null; }
  }, [db]);

  const decks: Deck[] = useMemo(() => {
    try { return listDecks(db); } catch { return []; }
  }, [db]);

  const dueCards = useMemo(() => {
    try { return listDueFlashcards(db); } catch { return []; }
  }, [db]);

  // Get all cards for forecast
  const allCards = useMemo(() => {
    try { return browseFlashcards(db, {}); } catch { return []; }
  }, [db]);

  const forecast = useMemo(() => {
    try { return buildReviewForecast(allCards, today, 7); } catch { return []; }
  }, [allCards, today]);

  const overdueCount = dueCards.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Schedule</Text>

      {/* Today's summary */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Due Today</Text>
          <Text style={styles.metricValue}>{dashboard?.dueCount ?? overdueCount}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>New</Text>
          <Text style={styles.metricValue}>{dashboard?.newCount ?? 0}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Streak</Text>
          <Text style={styles.metricValue}>{dashboard?.currentStreak ?? 0}d</Text>
        </Card>
      </View>

      {/* 7-day forecast */}
      {forecast.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>7-DAY FORECAST</Text>
          <View style={styles.forecastGrid}>
            {forecast.map((day) => {
              const maxCount = Math.max(...forecast.map((d) => d.dueCount), 1);
              const barH = Math.max(4, (day.dueCount / maxCount) * 60);
              return (
                <View key={day.date} style={styles.forecastCol}>
                  <Text variant="iconCaption" color={ACCENT}>{day.dueCount}</Text>
                  <View style={[styles.forecastBar, { height: barH, backgroundColor: ACCENT }]} />
                  <Text variant="iconCaption" color={colors.textTertiary}>
                    {day.date.slice(5)}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Per-deck schedule */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>DECK SCHEDULE</Text>
        {decks.length === 0 ? (
          <Text variant="body" color={colors.textSecondary}>No decks yet.</Text>
        ) : (
          decks.map((deck) => (
            <View key={deck.id} style={styles.deckRow}>
              <View style={styles.deckInfo}>
                <Text variant="body">{deck.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {deck.cardCount} cards
                </Text>
              </View>
              <Pressable
                style={styles.studyBtn}
                onPress={() => router.push('/(flash)/study')}
              >
                <Text variant="iconCaption" color={ACCENT}>Study</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {dueCards.length === 0 && (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🎉</Text>
            <Text variant="body" color={colors.textSecondary}>
              All caught up! No cards due right now.
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  forecastGrid: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginTop: spacing.sm, height: 80,
  },
  forecastCol: { alignItems: 'center', gap: 2, flex: 1 },
  forecastBar: { width: 20, borderRadius: 4 },
  deckRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  deckInfo: { flex: 1, gap: 2 },
  studyBtn: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  emptyState: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
});

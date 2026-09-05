import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  exportFlashData,
  getFlashDashboard,
  getFlashSetting,
  listDecks,
  listFlashExportRecords,
  serializeFlashExport,
  setFlashSetting,
} from '@mylife/flash';
import { FLASH_MODULE } from '@mylife/flash';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const FLASH_ACCENT = FLASH_MODULE.accentColor;
const TARGETS = ['1', '5', '10'];
const LIMITS = ['10', '20', '50', '100', '200'];
const REMINDER_TIMES = ['07:30', '09:00', '18:00', '21:00'];
const RETENTION = ['0.85', '0.90', '0.95'];

export default function FlashSettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const refresh = () => setTick((value) => value + 1);
  const decks = useMemo(() => listDecks(db), [db, tick]);
  const dashboard = useMemo(() => getFlashDashboard(db), [db, tick]);
  const dailyTarget = useMemo(() => getFlashSetting(db, 'dailyStudyTarget') ?? '1', [db, tick]);
  const dailyNewLimit = useMemo(() => getFlashSetting(db, 'dailyNewLimit') ?? '20', [db, tick]);
  const dailyReviewLimit = useMemo(() => getFlashSetting(db, 'dailyReviewLimit') ?? '200', [db, tick]);
  const autoBurySiblings = useMemo(() => getFlashSetting(db, 'autoBurySiblings') ?? '1', [db, tick]);
  const reminderEnabled = useMemo(() => getFlashSetting(db, 'dailyReminderEnabled') ?? '0', [db, tick]);
  const reminderTime = useMemo(() => getFlashSetting(db, 'dailyReminderTime') ?? '09:00', [db, tick]);
  const desiredRetention = useMemo(() => getFlashSetting(db, 'desiredRetention') ?? '0.90', [db, tick]);
  const exportHistory = useMemo(() => listFlashExportRecords(db).slice(0, 4), [db, tick]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Study Dashboard</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{String(dashboard.deckCount)}</Text>
            <Text variant="caption" color={colors.textSecondary}>Decks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{String(dashboard.cardCount)}</Text>
            <Text variant="caption" color={colors.textSecondary}>Cards</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{String(dashboard.reviewedToday)}</Text>
            <Text variant="caption" color={colors.textSecondary}>Reviewed Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{String(dashboard.longestStreak)}</Text>
            <Text variant="caption" color={colors.textSecondary}>Longest Streak</Text>
          </View>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          Daily study target: {getFlashSetting(db, 'dailyStudyTarget') ?? '1'} reviews to count toward your streak.
        </Text>
      </Card>

      <Card>
        <Text variant="subheading">Deck Summary</Text>
        <View style={styles.list}>
          {decks.map((deck) => (
            <View key={deck.id} style={styles.deckRow}>
              <Text variant="body">{deck.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {deck.cardCount} cards · {deck.newCount} new · {deck.dueCount} due
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Daily Target</Text>
        <Text variant="caption" color={colors.textSecondary}>
          This target determines how many reviews count as a completed study day in the current hub build.
        </Text>
        <View style={styles.chipRow}>
          {TARGETS.map((target) => {
            const selected = target === dailyTarget;
            return (
              <Pressable
                key={target}
                onPress={() => {
                  setFlashSetting(db, 'dailyStudyTarget', target);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {target}/day
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Study Limits</Text>
        <Text variant="caption" color={colors.textSecondary}>
          These controls cover the current local queue limits and sibling bury behavior.
        </Text>
        <View style={styles.list}>
          <Text variant="body">New cards/day: {dailyNewLimit}</Text>
          <View style={styles.chipRow}>
            {LIMITS.slice(0, 4).map((value) => {
              const selected = value === dailyNewLimit;
              return (
                <Pressable
                  key={`new-${value}`}
                  onPress={() => {
                    setFlashSetting(db, 'dailyNewLimit', value);
                    refresh();
                  }}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="body">Reviews/day: {dailyReviewLimit}</Text>
          <View style={styles.chipRow}>
            {LIMITS.map((value) => {
              const selected = value === dailyReviewLimit;
              return (
                <Pressable
                  key={`review-${value}`}
                  onPress={() => {
                    setFlashSetting(db, 'dailyReviewLimit', value);
                    refresh();
                  }}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Behavior</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Auto-bury keeps sibling cards out of the same session. Reminder timing is stored locally for later notification wiring.
        </Text>
        <View style={styles.chipRow}>
          {[
            { label: 'Auto-bury on', value: '1' },
            { label: 'Auto-bury off', value: '0' },
          ].map((option) => {
            const selected = option.value === autoBurySiblings;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setFlashSetting(db, 'autoBurySiblings', option.value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chipRow}>
          {[
            { label: 'Reminder off', value: '0' },
            { label: 'Reminder on', value: '1' },
          ].map((option) => {
            const selected = option.value === reminderEnabled;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setFlashSetting(db, 'dailyReminderEnabled', option.value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chipRow}>
          {REMINDER_TIMES.map((value) => {
            const selected = value === reminderTime;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setFlashSetting(db, 'dailyReminderTime', value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chipRow}>
          {RETENTION.map((value) => {
            const selected = value === desiredRetention;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setFlashSetting(db, 'desiredRetention', value);
                  refresh();
                }}
                style={[styles.chip, selected ? styles.chipActive : null]}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {Number(value) * 100}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="subheading">Export & History</Text>
        <Text variant="caption" color={colors.textSecondary}>
          Current export covers local JSON, markdown, and text bundles plus export history. Full .apkg packaging is still pending.
        </Text>
        <View style={styles.chipRow}>
          <Pressable
            style={styles.chip}
            onPress={() => {
              try {
                const bundle = exportFlashData(db, { includeScheduling: true, includeTags: true });
                setPreviewLabel('JSON archive');
                setPreview(serializeFlashExport(bundle, 'json').slice(0, 420));
                refresh();
              } catch { Alert.alert('Error', 'Failed to export data.'); }
            }}
          >
            <Text variant="caption" color={colors.textSecondary}>JSON archive</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() => {
              try {
                const bundle = exportFlashData(db, { includeScheduling: true, includeTags: true });
                setPreviewLabel('Markdown handoff');
                setPreview(serializeFlashExport(bundle, 'markdown'));
                refresh();
              } catch { Alert.alert('Error', 'Failed to export data.'); }
            }}
          >
            <Text variant="caption" color={colors.textSecondary}>Markdown</Text>
          </Pressable>
          <Pressable
            style={styles.chip}
            onPress={() => {
              try {
                const bundle = exportFlashData(db, { includeScheduling: false, includeTags: false });
                setPreviewLabel('Text share');
                setPreview(serializeFlashExport(bundle, 'text'));
                refresh();
              } catch { Alert.alert('Error', 'Failed to export data.'); }
            }}
          >
            <Text variant="caption" color={colors.textSecondary}>Text</Text>
          </Pressable>
        </View>
        {preview ? (
          <Card style={styles.previewCard}>
            <Text variant="body">{previewLabel}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {preview}
            </Text>
          </Card>
        ) : null}
        <View style={styles.list}>
          {exportHistory.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No exports yet.
            </Text>
          ) : (
            exportHistory.map((record) => (
              <Text key={record.id} variant="caption" color={colors.textSecondary}>
                {record.fileName} · {record.cardsExported} cards · {record.exportedAt.slice(0, 16)}
              </Text>
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
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: FLASH_ACCENT,
    borderColor: FLASH_ACCENT,
  },
  previewCard: {
    marginTop: spacing.sm,
    gap: spacing.xs,
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
    fontSize: 28,
    fontWeight: '700',
  },
  deckRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

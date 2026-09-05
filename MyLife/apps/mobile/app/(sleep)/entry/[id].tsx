import { useCallback, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteEntry,
  formatFactorClockTime,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getEntry,
  getFactorByEntry,
  getFactorRoomLightMeta,
  getFactorRoomNoiseMeta,
  getFactorRoomTempMeta,
  getPreSleepActivityMeta,
  getSleepSupplementMeta,
  getStressLevelMeta,
  getDreamExcerpt,
  getDreamTypeMeta,
  getDreamsByEntry,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SLEEP_DREAM_TYPE_TONES,
  SLEEP_DURATION_TONES,
  readSleepTargetHours,
} from '../_ui';

export default function SleepEntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();

  const entry = useMemo(() => {
    if (!id) {
      return null;
    }
    try {
      return getEntry(db, id);
    } catch {
      return null;
    }
  }, [db, id]);

  const targetHours = useMemo(() => readSleepTargetHours(db), [db]);
  const linkedDreams = useMemo(() => {
    if (!entry) {
      return [];
    }
    try {
      return getDreamsByEntry(db, entry.id);
    } catch {
      return [];
    }
  }, [db, entry]);
  const factor = useMemo(() => {
    if (!entry) {
      return null;
    }
    try {
      return getFactorByEntry(db, entry.id);
    } catch {
      return null;
    }
  }, [db, entry]);

  const handleDelete = useCallback(() => {
    if (!entry) {
      return;
    }

    Alert.alert(
      'Delete sleep log',
      'This will also remove any linked dreams and factors for that night.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEntry(db, entry.id);
            router.replace('/(sleep)' as never);
          },
        },
      ],
    );
  }, [db, entry, router]);

  if (!entry) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>Sleep entry not found</Text>
        <Text style={styles.emptyCopy}>
          This log may have been deleted or the route was opened without an ID.
        </Text>
        <Pressable
          onPress={() => router.replace('/(sleep)' as never)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Back to Sleep Log</Text>
        </Pressable>
      </View>
    );
  }

  const durationTone = getSleepDurationTone(
    entry.duration_minutes,
    targetHours,
  );
  const durationToneStyle = SLEEP_DURATION_TONES[durationTone];
  const feeling = getSleepWakeFeelingMeta(entry.wake_feeling);
  const alarmLabel = entry.alarm_time
    ? `${formatSleepTimeLabel(entry.alarm_time)}${entry.snooze_count > 0 ? ` • ${entry.snooze_count} snoozes` : ''}`
    : entry.snooze_count > 0
      ? `${entry.snooze_count} snoozes logged`
      : 'No alarm recorded';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Sleep Entry</Text>
            <Text style={styles.heroTitle}>
              {formatSleepEntryDateLabel(entry.date)}
            </Text>
            <Text style={styles.heroSubtitle}>
              {formatSleepTimeLabel(entry.bedtime)} to {formatSleepTimeLabel(entry.wake_time)}
            </Text>
          </View>
          <View
            style={[
              styles.durationBadge,
              {
                backgroundColor: durationToneStyle.backgroundColor,
                borderColor: durationToneStyle.borderColor,
              },
            ]}
          >
            <Text
              style={[
                styles.durationBadgeText,
                { color: durationToneStyle.textColor },
              ]}
            >
              {formatDurationLabel(entry.duration_minutes)}
            </Text>
          </View>
        </View>

        <View style={styles.metricPillRow}>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>
              {renderSleepQualityStars(entry.quality_rating)}
            </Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>
              {feeling.emoji} {feeling.label}
            </Text>
          </View>
          <View style={styles.metricPill}>
            <Text style={styles.metricPillText}>
              Target {targetHours}h
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard
          label="Duration"
          value={formatDurationLabel(entry.duration_minutes)}
          detail="Computed from bedtime to wake time"
        />
        <MetricCard
          label="Quality"
          value={`${entry.quality_rating}/5`}
          detail={renderSleepQualityStars(entry.quality_rating)}
        />
        <MetricCard
          label="Wake-ups"
          value={String(entry.wake_count)}
          detail="Interrupted moments remembered"
        />
        <MetricCard
          label="Latency"
          value={
            entry.sleep_latency_minutes != null
              ? `${entry.sleep_latency_minutes}m`
              : 'Not logged'
          }
          detail="Time between bed and sleep onset"
        />
        <MetricCard
          label="Wake Feeling"
          value={`${feeling.emoji} ${feeling.label}`}
          detail="Saved in the morning check-in"
        />
        <MetricCard
          label="Alarm"
          value={alarmLabel}
          detail="Captured when an alarm was used"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <Text style={styles.cardBody}>
          {entry.notes_md?.trim() || 'No notes were saved for this night.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dreams logged this night</Text>
        {linkedDreams.length > 0 ? (
          <View style={styles.linkedList}>
            {linkedDreams.map((dream) => {
              const meta = getDreamTypeMeta(dream.type);
              const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];
              return (
                <Pressable
                  key={dream.id}
                  onPress={() =>
                    router.push(`/(sleep)/dream/${dream.id}` as never)
                  }
                  style={styles.linkedDreamCard}
                >
                  <View style={styles.linkedDreamHeader}>
                    <Text style={styles.linkedDreamDate}>
                      {formatSleepEntryDateLabel(dream.date)}
                    </Text>
                    <View
                      style={[
                        styles.inlineBadge,
                        {
                          backgroundColor: tone.backgroundColor,
                          borderColor: tone.borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.inlineBadgeText,
                          { color: tone.textColor },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardBody}>
                    {getDreamExcerpt(dream.content_md, 110)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <>
            <Text style={styles.cardBody}>
              No dreams are linked to this night yet.
            </Text>
            <Pressable
              onPress={() =>
                router.push(`/(sleep)/dream/log?entryId=${entry.id}` as never)
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Log Dream From This Night</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Factors</Text>
        {factor ? (
          <>
            <Text style={styles.cardBody}>
              This factor log is attached to the same night as the sleep entry, so the context and the morning outcome stay paired.
            </Text>
            <View style={styles.factorGrid}>
              <MetricCard
                label="Caffeine"
                value={formatFactorClockTime(factor.last_caffeine_time) ?? 'Not logged'}
                detail="Last caffeine cutoff"
              />
              <MetricCard
                label="Meal"
                value={formatFactorClockTime(factor.last_meal_time) ?? 'Not logged'}
                detail="Last meal cutoff"
              />
              <MetricCard
                label="Screens"
                value={formatFactorClockTime(factor.screen_cutoff_time) ?? 'Not logged'}
                detail="Screen cutoff"
              />
              <MetricCard
                label="Alcohol"
                value={factor.alcohol_drinks > 0 ? `${factor.alcohol_drinks} drinks` : 'None'}
                detail="Drinks before bed"
              />
              <MetricCard
                label="Exercise"
                value={
                  factor.exercise_today
                    ? formatFactorClockTime(factor.exercise_time) ?? 'Yes'
                    : 'No'
                }
                detail="Exercise that day"
              />
              <MetricCard
                label="Stress"
                value={
                  factor.stress_level
                    ? `${getStressLevelMeta(factor.stress_level)?.emoji ?? ''} ${getStressLevelMeta(factor.stress_level)?.label ?? factor.stress_level}`.trim()
                    : 'Not logged'
                }
                detail="Evening or retrospective check-in"
              />
            </View>

            <View style={styles.summaryGrid}>
              <SummaryTile
                label="Activities"
                value={
                  factor.pre_sleep_activities.length > 0
                    ? factor.pre_sleep_activities
                        .map((value) => getPreSleepActivityMeta(value).label)
                        .join(', ')
                    : 'None selected'
                }
              />
              <SummaryTile
                label="Supplements"
                value={
                  factor.supplements.length > 0
                    ? factor.supplements
                        .map((value) => getSleepSupplementMeta(value).label)
                        .join(', ')
                    : 'None selected'
                }
              />
              <SummaryTile
                label="Environment"
                value={[
                  factor.room_temp
                    ? getFactorRoomTempMeta(factor.room_temp).label
                    : null,
                  factor.room_light
                    ? getFactorRoomLightMeta(factor.room_light).label
                    : null,
                  factor.room_noise
                    ? getFactorRoomNoiseMeta(factor.room_noise).label
                    : null,
                ].filter(Boolean).join(' / ') || 'Not logged'}
              />
            </View>

            <Text style={styles.cardBody}>
              {factor.notes?.trim() || 'No disturbance note was saved for this night.'}
            </Text>
            <Pressable
              onPress={() =>
                router.push(`/(sleep)/factors/log?entryId=${entry.id}` as never)
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Edit Factors</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>
              No factor log is attached to this night yet.
            </Text>
            <Pressable
              onPress={() =>
                router.push(`/(sleep)/factors/log?entryId=${entry.id}` as never)
              }
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Log Factors For This Night</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() =>
            router.push(`/(sleep)/entry/edit/${entry.id}` as never)
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  emptyScreen: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: surfaceTiers.lowest,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  hero: {
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  durationBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  durationBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  metricPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    gap: 6,
    padding: 16,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  metricDetail: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  linkedList: {
    gap: 10,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryGrid: {
    gap: 10,
  },
  summaryTile: {
    gap: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  linkedDreamCard: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkedDreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  linkedDreamDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  inlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,69,58,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  dangerButtonText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '800',
  },
});

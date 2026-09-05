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
import type { DreamType } from '@mylife/sleep';
import {
  deleteDream,
  findRelatedDreams,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  getDream,
  getDreamExcerpt,
  getDreamTypeMeta,
  getEntry,
  getSleepDurationTone,
  getSleepWakeFeelingMeta,
  listDreams,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SleepDreamMarkdown } from '../SleepDreamMarkdown';
import {
  SLEEP_ACCENT,
  SLEEP_DREAM_TYPE_TONES,
  SLEEP_DURATION_TONES,
  readSleepTargetHours,
} from '../_ui';

const DREAM_LIMIT = 250;

export default function SleepDreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDatabase();
  const router = useRouter();

  const dream = useMemo(() => {
    if (!id) {
      return null;
    }
    try {
      return getDream(db, id);
    } catch {
      return null;
    }
  }, [db, id]);

  const linkedEntry = useMemo(() => {
    if (!dream?.sleep_entry_id) {
      return null;
    }
    try {
      return getEntry(db, dream.sleep_entry_id);
    } catch {
      return null;
    }
  }, [db, dream?.sleep_entry_id]);

  const relatedDreams = useMemo(() => {
    if (!dream) {
      return [];
    }
    try {
      return findRelatedDreams(dream, listDreams(db, { limit: DREAM_LIMIT }), 4);
    } catch {
      return [];
    }
  }, [db, dream]);

  const targetHours = useMemo(() => readSleepTargetHours(db), [db]);

  const handleDelete = useCallback(() => {
    if (!dream) {
      return;
    }

    Alert.alert(
      'Delete dream',
      'This removes the saved dream from your archive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDream(db, dream.id);
            if (dream.sleep_entry_id) {
              router.replace(`/(sleep)/entry/${dream.sleep_entry_id}` as never);
              return;
            }
            router.replace('/(sleep)/dreams' as never);
          },
        },
      ],
    );
  }, [db, dream, router]);

  if (!dream) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>Dream not found</Text>
        <Text style={styles.emptyCopy}>
          This dream may have been deleted or the route opened without an ID.
        </Text>
        <Pressable
          onPress={() => router.replace('/(sleep)/dreams' as never)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Back to Dreams</Text>
        </Pressable>
      </View>
    );
  }

  const typeMeta = getDreamTypeMeta(dream.type);
  const typeTone = SLEEP_DREAM_TYPE_TONES[typeMeta.tone];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Dream Detail</Text>
            <Text style={styles.heroTitle}>
              {formatSleepEntryDateLabel(dream.date)}
            </Text>
            <Text style={styles.heroSubtitle}>
              Saved to your local dream archive
            </Text>
          </View>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: typeTone.backgroundColor,
                borderColor: typeTone.borderColor,
              },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: typeTone.textColor }]}>
              {typeMeta.label}
            </Text>
          </View>
        </View>

        <View style={styles.metricPillRow}>
          {dream.is_lucid && (
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>Lucid</Text>
            </View>
          )}
          {dream.is_recurring && (
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>Recurring</Text>
            </View>
          )}
          {dream.emotions.slice(0, 3).map((emotion) => (
            <View key={emotion} style={styles.metricPill}>
              <Text style={styles.metricPillText}>{emotion}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dream</Text>
        <SleepDreamMarkdown content={dream.content_md} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Metadata</Text>
        <MetadataRow label="Type" value={typeMeta.label} />
        <MetadataRow
          label="Themes"
          value={dream.themes.length > 0 ? dream.themes.join(', ') : 'None'}
        />
        <MetadataRow
          label="People"
          value={dream.people.length > 0 ? dream.people.join(', ') : 'None'}
        />
        <MetadataRow
          label="Emotions"
          value={dream.emotions.length > 0 ? dream.emotions.join(', ') : 'None'}
        />
        <MetadataRow label="Lucid" value={dream.is_lucid ? 'Yes' : 'No'} />
        <MetadataRow
          label="Recurring"
          value={dream.is_recurring ? 'Yes' : 'No'}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Related dreams</Text>
        {relatedDreams.length > 0 ? (
          <View style={styles.relatedList}>
            {relatedDreams.map((related) => (
              <Pressable
                key={related.id}
                onPress={() => router.push(`/(sleep)/dream/${related.id}` as never)}
                style={styles.relatedCard}
              >
                <View style={styles.relatedHeader}>
                  <Text style={styles.relatedDate}>
                    {formatSleepEntryDateLabel(related.date)}
                  </Text>
                  <DreamTypeInlineBadge type={related.type} />
                </View>
                <Text style={styles.relatedExcerpt}>
                  {getDreamExcerpt(related.content_md, 110)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.cardBody}>
            No related dreams surfaced yet. Recurring links and shared themes will populate this section as the archive grows.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Linked sleep entry</Text>
        {linkedEntry ? (
          <Pressable
            onPress={() =>
              router.push(`/(sleep)/entry/${linkedEntry.id}` as never)
            }
            style={styles.entryCard}
          >
            <View style={styles.relatedHeader}>
              <View style={styles.entryCopy}>
                <Text style={styles.entryTitle}>
                  {formatSleepEntryDateLabel(linkedEntry.date)}
                </Text>
                <Text style={styles.entryBody}>
                  {formatSleepTimeLabel(linkedEntry.bedtime)} to {formatSleepTimeLabel(linkedEntry.wake_time)}
                </Text>
              </View>
              <SleepDurationBadge
                durationMinutes={linkedEntry.duration_minutes}
                targetHours={targetHours}
              />
            </View>
            <Text style={styles.entryBody}>
              {renderSleepQualityStars(linkedEntry.quality_rating)} • {getSleepWakeFeelingMeta(linkedEntry.wake_feeling).emoji}{' '}
              {getSleepWakeFeelingMeta(linkedEntry.wake_feeling).label}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.cardBody}>
            This dream is not linked to a saved sleep entry.
          </Text>
        )}
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() =>
            router.push(
              `/(sleep)/dream/log?dreamId=${dream.id}` as never,
            )
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

function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text style={styles.metadataValue}>{value}</Text>
    </View>
  );
}

function DreamTypeInlineBadge({ type }: { type: DreamType }) {
  const meta = getDreamTypeMeta(type);
  const tone = SLEEP_DREAM_TYPE_TONES[meta.tone];

  return (
    <View
      style={[
        styles.inlineBadge,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
        },
      ]}
    >
      <Text style={[styles.inlineBadgeText, { color: tone.textColor }]}>
        {meta.label}
      </Text>
    </View>
  );
}

function SleepDurationBadge({
  durationMinutes,
  targetHours,
}: {
  durationMinutes: number;
  targetHours: number;
}) {
  const tone = getSleepDurationTone(durationMinutes, targetHours);
  const toneStyle = SLEEP_DURATION_TONES[tone];

  return (
    <View
      style={[
        styles.inlineBadge,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <Text style={[styles.inlineBadgeText, { color: toneStyle.textColor }]}>
        {formatDurationLabel(durationMinutes)}
      </Text>
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
    borderColor: 'rgba(167,139,250,0.24)',
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
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    gap: 12,
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
  metadataRow: {
    gap: 4,
    paddingTop: 4,
  },
  metadataLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metadataValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  relatedList: {
    gap: 12,
  },
  relatedCard: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  relatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  relatedDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  relatedExcerpt: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
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
  entryCard: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryCopy: {
    flex: 1,
    gap: 4,
  },
  entryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  entryBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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

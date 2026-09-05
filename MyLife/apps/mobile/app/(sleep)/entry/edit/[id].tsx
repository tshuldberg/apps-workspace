import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  buildMorningLogEntryInputForDate,
  getEntry,
  getMorningLogDraftFromEntry,
  getMorningLogSummaryForDate,
  updateEntry,
  type MorningLogDraft,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SleepEntryWizard } from '../../SleepEntryWizard';
import { SLEEP_ACCENT } from '../../_ui';

export default function SleepEntryEditScreen() {
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

  const buildSummary = useCallback(
    (draft: MorningLogDraft) => {
      if (!entry) {
        throw new Error('Sleep entry not found');
      }
      return getMorningLogSummaryForDate(draft, entry.date);
    },
    [entry],
  );

  const handleSubmit = useCallback(
    async (draft: MorningLogDraft) => {
      if (!entry) {
        throw new Error('Sleep entry not found');
      }

      const updated = updateEntry(
        db,
        entry.id,
        buildMorningLogEntryInputForDate(draft, entry.date),
      );

      if (!updated) {
        throw new Error('Could not update this sleep log.');
      }

      router.replace(`/(sleep)/entry/${entry.id}` as never);
    },
    [db, entry, router],
  );

  if (!entry) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyTitle}>Sleep entry not found</Text>
        <Text style={styles.emptyCopy}>
          MySleep could not load this saved night for editing.
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

  return (
    <SleepEntryWizard
      eyebrow="Edit Sleep Log"
      initialDraft={getMorningLogDraftFromEntry(entry)}
      saveLabel="Save Changes"
      buildSummary={buildSummary}
      onSubmit={handleSubmit}
      onClose={() => router.replace(`/(sleep)/entry/${entry.id}` as never)}
    />
  );
}

const styles = StyleSheet.create({
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
});

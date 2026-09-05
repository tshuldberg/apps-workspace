import { useCallback, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  GlassCard,
  JournalCard,
  MaterialSymbol,
  MoonPhaseGlyph,
  type MoonPhase,
  type ZodiacSign,
  deleteJournalEntry,
  getBirthProfile,
  getJournalEntries,
  getJournalEntry,
  withAlpha,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
} from '@mylife/stars';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  deriveEntryTitle,
  findRelatedEntries,
  formatPhaseLabel,
  formatStarsLongDate,
  getPersonalTransits,
} from '../../../components/stars/phase1';

export default function JournalEntryDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const entry = useMemo(
    () => (params.id ? getJournalEntry(db, params.id) : null),
    [db, params.id],
  );
  const profile = useMemo(
    () => (entry?.profileId ? getBirthProfile(db, entry.profileId) : null),
    [db, entry?.profileId],
  );
  const transits = useMemo(
    () => (entry ? getPersonalTransits(db, profile, entry.date).slice(0, 3) : []),
    [db, entry, profile],
  );
  const relatedEntries = useMemo(() => {
    if (!entry) {
      return [];
    }
    return findRelatedEntries(getJournalEntries(db, 40), entry, 3);
  }, [db, entry]);

  const handleDelete = useCallback(() => {
    if (!entry) {
      return;
    }
    Alert.alert('Delete entry', 'This reflection will be removed permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteJournalEntry(db, entry.id);
          router.back();
        },
      },
    ]);
  }, [db, entry, router]);

  const handleShare = useCallback(async () => {
    if (!entry) {
      return;
    }
    await Share.share({
      message: `${entry.title ?? deriveEntryTitle(entry.content)}\n${formatStarsLongDate(entry.date)}\n\n${entry.content}`,
    });
  }, [entry]);

  if (!entry) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Entry not found</Text>
        <Text style={styles.emptyBody}>This journal entry may have been deleted or moved.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GlassCard variant="high" style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{formatStarsLongDate(entry.date)}</Text>
            <Text style={styles.heroTitle}>{entry.title ?? deriveEntryTitle(entry.content)}</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable style={styles.iconButton} onPress={handleShare}>
              <MaterialSymbol name="share" size={18} color={ST_ACCENT_LIGHT} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={handleDelete}>
              <MaterialSymbol name="delete" size={18} color="#FFB4AB" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.heroBody}>{entry.content.slice(0, 180)}</Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.contextHeader}>
          <MoonPhaseGlyph phase={entry.moonPhase as MoonPhase} size={72} />
          <View style={styles.contextHeaderCopy}>
            <Text style={styles.contextTitle}>{formatPhaseLabel(entry.moonPhase)}</Text>
            <Text style={styles.contextMeta}>
              Moon in {entry.moonSign ? entry.moonSign.charAt(0).toUpperCase() + entry.moonSign.slice(1) : 'Unknown'}
            </Text>
            <Text style={styles.contextMeta}>
              Sun in {entry.sunSign ? entry.sunSign.charAt(0).toUpperCase() + entry.sunSign.slice(1) : 'Unknown'}
            </Text>
          </View>
        </View>

        {entry.mood || entry.intention || entry.tarotCardName ? (
          <View style={styles.tagRow}>
            {entry.mood ? (
              <View style={styles.contextChip}>
                <Text style={styles.contextChipText}>{entry.mood}</Text>
              </View>
            ) : null}
            {entry.intention ? (
              <View style={styles.contextChip}>
                <Text style={styles.contextChipText}>{entry.intention}</Text>
              </View>
            ) : null}
            {entry.tarotCardName ? (
              <View style={styles.contextChip}>
                <Text style={styles.contextChipText}>{entry.tarotCardName}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {transits.length > 0 ? (
          <View style={styles.transitStack}>
            {transits.map((transit) => (
              <View key={transit.id} style={styles.transitNote}>
                <Text style={styles.transitNoteTitle}>
                  {transit.transitingBody} {transit.aspectType} {transit.natalBody}
                </Text>
                <Text style={styles.transitNoteBody}>{transit.interpretationBrief}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.contextFallback}>
            No stored transit context for this date yet. Your moon and sign imprint are still preserved here.
          </Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Reflection</Text>
        <View style={styles.paragraphStack}>
          {entry.content
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
            .map((paragraph) => (
              <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
        </View>
      </GlassCard>

      {entry.photoUris.length > 0 ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Attachments</Text>
          <View style={styles.photoGrid}>
            {entry.photoUris.map((uri) => (
              <View key={uri} style={styles.photoTile}>
                <Image source={uri} contentFit="cover" style={styles.photoImage} />
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {relatedEntries.length > 0 ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Related Entries</Text>
          <View style={styles.relatedList}>
            {relatedEntries.map((related) => (
              <JournalCard
                key={related.id}
                entry={{
                  id: related.id,
                  date: related.date,
                  content: related.content,
                  title: related.title ?? deriveEntryTitle(related.content),
                  mood: related.mood,
                  moonPhase: related.moonPhase as MoonPhase,
                  moonSign: related.moonSign as ZodiacSign,
                  transitTag: related.intention ?? related.tarotCardName ?? null,
                }}
                onPress={() => router.push(`/(stars)/journal-entry/${related.id}` as never)}
              />
            ))}
          </View>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: ST_SURFACES.base,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  emptyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
    textAlign: 'center',
  },
  heroCard: {
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ST_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: ST_TEXT,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.06),
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  contextHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  contextTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  contextMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.12),
  },
  contextChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_ACCENT_LIGHT,
  },
  transitStack: {
    gap: 10,
  },
  transitNote: {
    gap: 4,
    borderRadius: 16,
    padding: 12,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  transitNoteTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  transitNoteBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  contextFallback: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_TERTIARY,
  },
  sectionTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    color: ST_TEXT,
  },
  paragraphStack: {
    gap: 12,
  },
  paragraph: {
    fontFamily: ST_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: ST_TEXT_SECONDARY,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoTile: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  relatedList: {
    gap: 10,
  },
});

import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  GlassCard,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getBirthProfiles,
  getRecentCompatibilityResults,
  withAlpha,
} from '@mylife/stars';
import { MetaPill, PhaseHeading } from '../../lib/stars-phase2';

export default function CompatibilityHistoryScreen() {
  const db = useDatabase();
  const router = useRouter();

  const results = useMemo(() => getRecentCompatibilityResults(db, 50), [db]);
  const profiles = useMemo(() => getBirthProfiles(db), [db]);
  const names = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile.name])), [profiles]);

  if (results.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard variant="high" style={styles.emptyCard}>
          <PhaseHeading
            eyebrow="Past Comparisons"
            title="No saved synastry yet"
            detail="Run a compatibility reading first, then save it to build a timeline of your strongest matches."
          />
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PhaseHeading
        eyebrow="Past Comparisons"
        title="Compatibility History"
        detail="Every saved snapshot keeps the original score, pair, and timestamp, with a deep-link back into the active comparison screen."
      />

      {results.map((result) => {
        const leftName = names.get(result.profileAId) ?? 'Unknown';
        const rightName = names.get(result.profileBId) ?? 'Unknown';
        return (
          <Pressable
            key={result.id}
            style={styles.row}
            onPress={() =>
              router.push(`/(stars)/compatibility?aId=${result.profileAId}&bId=${result.profileBId}` as never)
            }
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.rowTitle}>{leftName} + {rightName}</Text>
              <Text style={styles.rowMeta}>
                {new Date(result.computedAt).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.rowCopy} numberOfLines={2}>
                {result.elementCompatibility}
              </Text>
            </View>
            <View style={styles.rowSide}>
              <MetaPill
                label={`${result.overallScore}%`}
                tone={withAlpha(ST_ACCENT, 0.16)}
                textColor={ST_ACCENT_LIGHT}
              />
              <Text style={styles.openText}>Open</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.lowest,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: ST_SURFACES.lowest,
    justifyContent: 'center',
    padding: 16,
  },
  emptyCard: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  rowTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  rowMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  rowCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  rowSide: {
    alignItems: 'flex-end',
    gap: 8,
  },
  openText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
});

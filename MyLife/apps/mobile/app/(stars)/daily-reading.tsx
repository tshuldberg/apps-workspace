import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GlassCard,
  MoonPhaseGlyph,
  SectionHeader,
  TransitRow,
  computeIllumination,
  getMoonPhase,
  withAlpha,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
} from '@mylife/stars';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildDailyReadingModel,
  formatPhaseLabel,
  getPrimaryProfile,
} from '../../components/stars/phase1';

export default function DailyReadingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const refresh = useCallback(() => setRefreshSeed((value) => value + 1), []);
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const profile = useMemo(() => getPrimaryProfile(db), [db, refreshSeed]);
  const reading = useMemo(
    () => buildDailyReadingModel(db, profile, date, refreshSeed),
    [db, profile, date, refreshSeed],
  );
  const moonPhase = useMemo(() => getMoonPhase(date), [date]);
  const illumination = useMemo(() => Math.round(computeIllumination(date)), [date]);

  const handleShare = useCallback(async () => {
    await Share.share({
      message: [
        reading.dateLabel,
        reading.celestialSummary,
        '',
        reading.overallTheme,
        '',
        `Lucky numbers: ${reading.luckyNumbers.join(', ')}`,
      ].join('\n'),
    });
  }, [reading]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refresh}
          tintColor={ST_ACCENT_LIGHT}
        />
      }
    >
      <GlassCard variant="high" style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Daily Reading</Text>
        <Text style={styles.heroDate}>{reading.dateLabel}</Text>
        <View style={styles.heroMoonRow}>
          <MoonPhaseGlyph phase={moonPhase} illumination={illumination} size={92} />
          <View style={styles.heroMoonCopy}>
            <Text style={styles.heroSummary}>{reading.celestialSummary}</Text>
            <Text style={styles.heroBody}>{reading.summaryPreview}</Text>
          </View>
        </View>
      </GlassCard>

      {!profile ? (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Set up your birth profile to see personalized readings</Text>
          <Text style={styles.emptyBody}>
            We can still show the collective sky, but your full horoscope unlocks when your chart is saved.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/(stars)/add-profile' as never)}
          >
            <Text style={styles.primaryButtonText}>Add Birth Profile</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Overall Theme" eyebrow="Today" />
        <Text style={styles.sectionBody}>{reading.overallTheme}</Text>
      </GlassCard>

      <View style={styles.splitRow}>
        <GlassCard style={[styles.sectionCard, styles.splitCard]}>
          <SectionHeader title="Love + Relationships" eyebrow="Heart" />
          <Text style={styles.sectionBody}>{reading.love}</Text>
        </GlassCard>
        <GlassCard style={[styles.sectionCard, styles.splitCard]}>
          <SectionHeader title="Career + Work" eyebrow="Focus" />
          <Text style={styles.sectionBody}>{reading.career}</Text>
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Health + Wellness" eyebrow="Body" />
        <Text style={styles.sectionBody}>{reading.health}</Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Lucky Signatures" eyebrow="Alignment" />
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Numbers</Text>
            <Text style={styles.signatureValue}>{reading.luckyNumbers.join(' · ')}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Colors</Text>
            <View style={styles.colorRow}>
              {reading.luckyColors.map((color) => (
                <View key={color.label} style={styles.colorChip}>
                  <View style={[styles.colorDot, { backgroundColor: color.tone }]} />
                  <Text style={styles.colorText}>{color.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Personal Transits" eyebrow={profile ? 'Your chart' : 'Sky'} />
        {reading.transits.length > 0 ? (
          <View style={styles.transitList}>
            {reading.transits.slice(0, 4).map((transit) => (
              <TransitRow key={transit.id} transit={transit} />
            ))}
          </View>
        ) : (
          <Text style={styles.sectionBody}>
            {profile
              ? 'Your transit timeline will fill in as your chart history builds.'
              : 'Add a profile to turn these sky movements into personal transits.'}
          </Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Journal Prompt" eyebrow={formatPhaseLabel(moonPhase)} />
        <Text style={styles.sectionBody}>{reading.journalPrompt}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push(
              `/(stars)/journal-compose?prompt=${encodeURIComponent(reading.journalPrompt)}` as never,
            )
          }
        >
          <Text style={styles.primaryButtonText}>Reflect In Journal</Text>
        </Pressable>
      </GlassCard>

      <View style={styles.footerActions}>
        <Pressable style={styles.secondaryButton} onPress={handleShare}>
          <Text style={styles.secondaryButtonText}>Share</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/(stars)/transit-timeline' as never)}
        >
          <Text style={styles.secondaryButtonText}>View Timeline</Text>
        </Pressable>
      </View>
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
  heroCard: {
    gap: 16,
  },
  heroEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ST_ACCENT_LIGHT,
  },
  heroDate: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: ST_TEXT,
  },
  heroMoonRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  heroMoonCopy: {
    flex: 1,
    gap: 8,
  },
  heroSummary: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    lineHeight: 22,
    color: ST_TEXT,
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  emptyCard: {
    gap: 12,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: ST_TEXT,
  },
  emptyBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
  },
  sectionBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCard: {
    flex: 1,
  },
  signatureRow: {
    gap: 16,
  },
  signatureBlock: {
    gap: 8,
  },
  signatureLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT_TERTIARY,
  },
  signatureValue: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: ST_TEXT,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  colorText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT,
  },
  transitList: {
    gap: 10,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ST_ACCENT_LIGHT,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#22113E',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  secondaryButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_TEXT,
  },
});

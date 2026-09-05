import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  GlassCard,
  MaterialSymbol,
  MoonPhaseGlyph,
  PlanetGlyph,
  SectionHeader,
  TransitRow,
  computeIllumination,
  computeRetrogradeStatuses,
  getActiveRetrogrades,
  getMoonPhase,
  getMoonSign,
  getZodiacElement,
  getZodiacSign,
  withAlpha,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getStarsElementColor,
} from '@mylife/stars';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  STARS_MOOD_OPTIONS,
  buildDailyReadingModel,
  buildMoonWeek,
  formatPhaseLabel,
  getMoonCycleDetails,
  getPrimaryProfile,
} from '../../../components/stars/phase1';

const MOOD_SHORTLIST = STARS_MOOD_OPTIONS.slice(0, 4);

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function StarsTodayScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const refresh = useCallback(() => setRefreshSeed((value) => value + 1), []);

  const today = new Date().toISOString().slice(0, 10);
  const primaryProfile = useMemo(() => getPrimaryProfile(db), [db, refreshSeed]);
  const reading = useMemo(
    () => buildDailyReadingModel(db, primaryProfile, today, refreshSeed),
    [db, primaryProfile, refreshSeed, today],
  );
  const moonPhase = useMemo(() => getMoonPhase(today), [today]);
  const moonSign = useMemo(() => getMoonSign(today), [today]);
  const sunSign = useMemo(() => getZodiacSign(today), [today]);
  const illumination = useMemo(() => Math.round(computeIllumination(today)), [today]);
  const moonCycle = useMemo(() => getMoonCycleDetails(today), [today]);
  const retrogrades = useMemo(
    () => getActiveRetrogrades(computeRetrogradeStatuses(today)),
    [today],
  );
  const moonWeek = useMemo(() => buildMoonWeek(today), [today]);
  const accentTone = getStarsElementColor(getZodiacElement(moonSign));

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
      <GlassCard variant="high" style={styles.heroCard} contentStyle={styles.heroContent}>
        <View style={styles.heroStars}>
          <View style={[styles.heroStar, styles.heroStarOne]} />
          <View style={[styles.heroStar, styles.heroStarTwo]} />
          <View style={[styles.heroStar, styles.heroStarThree]} />
        </View>

        <Text style={styles.heroEyebrow}>Cosmic Snapshot</Text>
        <Text style={styles.heroDate}>{reading.dateLabel}</Text>

        <View style={styles.moonHero}>
          <MoonPhaseGlyph phase={moonPhase} illumination={illumination} size={118} />
          <View style={styles.moonHeroCopy}>
            <Text style={styles.moonHeroTitle}>{formatPhaseLabel(moonPhase)}</Text>
            <Text style={styles.moonHeroMeta}>
              {illumination}% illuminated · Day {moonCycle.ageDays}
            </Text>
            <Text style={styles.moonHeroMeta}>
              Next {formatPhaseLabel(moonCycle.nextPhase)} in {moonCycle.daysUntilNext}d
            </Text>
          </View>
        </View>

        <View style={styles.signRow}>
          <SignCard label="Sun" value={titleCase(sunSign)} tone={getStarsElementColor(getZodiacElement(sunSign))} />
          <SignCard label="Moon" value={titleCase(moonSign)} tone={accentTone} />
          <SignCard
            label="Rising"
            value={primaryProfile?.risingSign ? titleCase(primaryProfile.risingSign) : 'Set chart'}
            tone={primaryProfile?.risingSign ? ST_ACCENT_LIGHT : withAlpha(ST_ACCENT_LIGHT, 0.6)}
          />
        </View>

        {retrogrades.length > 0 ? (
          <View style={styles.retrogradeRow}>
            {retrogrades.slice(0, 4).map((retrograde) => (
              <View key={retrograde.body} style={styles.retrogradeBadge}>
                <PlanetGlyph planet={retrograde.body} retrograde size={18} />
                <Text style={styles.retrogradeText}>{titleCase(retrograde.body)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>

      {!primaryProfile ? (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Set up your birth profile to unlock personalized readings</Text>
          <Text style={styles.emptyBody}>
            Your Today tab is ready for daily horoscopes, personal transits, and rising-sign context as soon as your chart is saved.
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
        <SectionHeader
          title="Today's Reading"
          eyebrow={primaryProfile ? 'Personal reading' : 'Daily forecast'}
          action={
            <Pressable onPress={() => router.push('/(stars)/daily-reading' as never)}>
              <Text style={styles.linkText}>Read More</Text>
            </Pressable>
          }
        />
        <Text style={styles.sectionBody} numberOfLines={4}>
          {reading.summaryPreview}
        </Text>
        <View style={styles.keywordRow}>
          {reading.keywords.map((keyword) => (
            <View key={keyword} style={styles.keywordChip}>
              <Text style={styles.keywordText}>{keyword}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Transits"
          eyebrow={primaryProfile ? 'Active aspects' : 'Sky aspects'}
          action={
            <Pressable onPress={() => router.push('/(stars)/transit-timeline' as never)}>
              <Text style={styles.linkText}>View All</Text>
            </Pressable>
          }
        />
        {reading.transits.length > 0 ? (
          <View style={styles.transitList}>
            {reading.transits.slice(0, 3).map((transit) => (
              <TransitRow
                key={transit.id}
                transit={transit}
                onPress={() => router.push('/(stars)/transit-timeline' as never)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.sectionBody}>
            Add your chart to see how today&apos;s sky interacts with your natal placements.
          </Text>
        )}
      </GlassCard>

      <View style={styles.splitRow}>
        <GlassCard style={[styles.splitCard, styles.tarotCard]} onPress={() => router.push('/(stars)/tarot-card' as never)}>
          <View style={styles.tarotHeader}>
            <Text style={styles.splitEyebrow}>Quick Tarot</Text>
            <MaterialSymbol name="style" size={18} color={ST_ACCENT_LIGHT} />
          </View>
          <Text style={styles.tarotTitle}>{reading.tarotCard.name}</Text>
          <Text style={styles.tarotMeta}>
            {reading.tarotCard.suit ? `${reading.tarotCard.suit} · ${reading.tarotCard.number}` : `Major Arcana · ${reading.tarotCard.number}`}
          </Text>
          <Pressable
            style={styles.inlineButton}
            onPress={() => router.push('/(stars)/tarot-card' as never)}
          >
            <Text style={styles.inlineButtonText}>Draw Today&apos;s Card</Text>
          </Pressable>
        </GlassCard>

        <GlassCard style={[styles.splitCard, styles.moodCard]}>
          <Text style={styles.splitEyebrow}>Mood Check-In</Text>
          <Text style={styles.moodPrompt}>How does the sky feel in your body right now?</Text>
          <View style={styles.moodRow}>
            {MOOD_SHORTLIST.map((mood) => (
              <Pressable
                key={mood}
                style={styles.moodChip}
                onPress={() =>
                  router.push(`/(stars)/journal-compose?mood=${encodeURIComponent(mood)}` as never)
                }
              >
                <Text style={styles.moodText}>{titleCase(mood)}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Journal Prompt" eyebrow="Reflect" />
        <Text style={styles.sectionBody}>{reading.journalPrompt}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push(
              `/(stars)/journal-compose?prompt=${encodeURIComponent(reading.journalPrompt)}` as never,
            )
          }
        >
          <Text style={styles.primaryButtonText}>Write About This</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Moon Calendar"
          eyebrow="Next seven days"
          action={
            <Pressable onPress={() => router.push('/(stars)/moon-calendar' as never)}>
              <Text style={styles.linkText}>Open</Text>
            </Pressable>
          }
        />
        <View style={styles.moonWeekRow}>
          {moonWeek.map((day) => (
            <Pressable
              key={day.date}
              onPress={() => router.push('/(stars)/moon-calendar' as never)}
              style={[styles.moonDay, day.isToday ? styles.moonDayActive : null]}
            >
              <Text style={styles.moonDayLabel}>{day.label}</Text>
              <MoonPhaseGlyph phase={day.phase} illumination={day.illumination} size={42} />
              <Text style={styles.moonDayNumber}>{day.dayOfMonth}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

function SignCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={[styles.signCard, { backgroundColor: withAlpha(tone, 0.14) }]}>
      <Text style={styles.signLabel}>{label}</Text>
      <Text style={styles.signValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ST_SURFACES.base,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 16,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroContent: {
    padding: 22,
    gap: 18,
    backgroundColor: withAlpha(ST_SURFACES.high, 0.6),
  },
  heroStars: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  heroStar: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.6),
  },
  heroStarOne: {
    right: 32,
    top: 28,
  },
  heroStarTwo: {
    right: 112,
    top: 78,
    width: 4,
    height: 4,
  },
  heroStarThree: {
    left: 48,
    top: 122,
    width: 3,
    height: 3,
  },
  heroEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: ST_ACCENT_LIGHT,
  },
  heroDate: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 36,
    color: ST_TEXT,
  },
  moonHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  moonHeroCopy: {
    flex: 1,
    gap: 6,
  },
  moonHeroTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: ST_TEXT,
  },
  moonHeroMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: ST_TEXT_SECONDARY,
  },
  signRow: {
    flexDirection: 'row',
    gap: 10,
  },
  signCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  signLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: ST_TEXT_TERTIARY,
  },
  signValue: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: ST_TEXT,
  },
  retrogradeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  retrogradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  retrogradeText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT,
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
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#22113E',
  },
  sectionCard: {
    gap: 14,
  },
  linkText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.1),
  },
  keywordText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  transitList: {
    gap: 10,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 12,
  },
  splitCard: {
    flex: 1,
    gap: 12,
  },
  tarotCard: {
    minHeight: 220,
  },
  tarotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  tarotTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: ST_TEXT,
  },
  tarotMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  inlineButton: {
    marginTop: 'auto',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: withAlpha(ST_ACCENT_LIGHT, 0.12),
  },
  inlineButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  moodCard: {
    justifyContent: 'space-between',
  },
  moodPrompt: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.06),
  },
  moodText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT,
  },
  moonWeekRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moonDay: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.03),
  },
  moonDayActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  moonDayLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  moonDayNumber: {
    fontFamily: ST_FONTS.bold,
    fontSize: 13,
    color: ST_TEXT,
  },
});

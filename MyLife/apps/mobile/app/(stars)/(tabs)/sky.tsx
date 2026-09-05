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
  getSkyPositions,
  getZodiacElement,
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
  formatPhaseLabel,
  getMoonCycleDetails,
  getPersonalTransits,
  getPlanetaryElement,
  getPrimaryProfile,
  getSkyAspects,
  getUpcomingSkyEvents,
} from '../../../components/stars/phase1';

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SkyScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const refresh = useCallback(() => setRefreshSeed((value) => value + 1), []);

  const today = new Date().toISOString().slice(0, 10);
  const primaryProfile = useMemo(() => getPrimaryProfile(db), [db, refreshSeed]);
  const moonPhase = useMemo(() => getMoonPhase(today), [today]);
  const moonSign = useMemo(() => getMoonSign(today), [today]);
  const illumination = useMemo(() => Math.round(computeIllumination(today)), [today]);
  const moonCycle = useMemo(() => getMoonCycleDetails(today), [today]);
  const retrogrades = useMemo(
    () => getActiveRetrogrades(computeRetrogradeStatuses(today)),
    [today],
  );
  const skyPositions = useMemo(() => getSkyPositions(today), [today, refreshSeed]);
  const personalTransits = useMemo(
    () => getPersonalTransits(db, primaryProfile, today),
    [db, primaryProfile, today],
  );
  const skyAspects = useMemo(() => getSkyAspects(today), [today]);
  const upcomingEvents = useMemo(() => getUpcomingSkyEvents(today), [today]);
  const moonElementTone = getStarsElementColor(getZodiacElement(moonSign));
  const selectedPlanetData = skyPositions.find((planet) => planet.body === selectedPlanet) ?? null;

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
        <Text style={styles.heroEyebrow}>The Sky</Text>
        <Text style={styles.heroTitle}>{formatPhaseLabel(moonPhase)}</Text>
        <View style={styles.heroRow}>
          <MoonPhaseGlyph phase={moonPhase} illumination={illumination} size={136} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroMeta}>{illumination}% illumination</Text>
            <Text style={styles.heroMeta}>Moon age {moonCycle.ageDays} days</Text>
            <Text style={styles.heroMeta}>
              Next {formatPhaseLabel(moonCycle.nextPhase)} in {moonCycle.daysUntilNext}d
            </Text>
            <View style={[styles.elementChip, { backgroundColor: withAlpha(moonElementTone, 0.14) }]}>
              <Text style={[styles.elementChipText, { color: moonElementTone }]}>
                {titleCase(moonSign)} · {titleCase(getZodiacElement(moonSign))}
              </Text>
            </View>
            {moonCycle.isVoidOfCourse ? (
              <View style={styles.voidChip}>
                <MaterialSymbol name="warning" size={16} color={ST_ACCENT_LIGHT} />
                <Text style={styles.voidChipText}>Void of course window</Text>
              </View>
            ) : null}
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Planetary Positions" eyebrow="Current sky" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {skyPositions.map((position) => {
            const isSelected = selectedPlanet === position.body;
            return (
              <Pressable
                key={position.body}
                style={[styles.planetCard, isSelected ? styles.planetCardActive : null]}
                onPress={() => setSelectedPlanet(position.body)}
              >
                <PlanetGlyph
                  planet={position.body}
                  sign={position.sign}
                  retrograde={retrogrades.some((retrograde) => retrograde.body === position.body)}
                  size={24}
                />
                <Text style={styles.planetName}>{titleCase(position.body)}</Text>
                <Text style={styles.planetMeta}>
                  {titleCase(position.sign)} · {position.degree.toFixed(1)}°
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {selectedPlanetData ? (
          <View style={styles.planetFocus}>
            <Text style={styles.planetFocusTitle}>{titleCase(selectedPlanetData.body)}</Text>
            <Text style={styles.sectionBody}>
              {titleCase(selectedPlanetData.sign)} at {selectedPlanetData.degree.toFixed(1)}° · {getPlanetaryElement(selectedPlanetData)} emphasis
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Active Transits"
          eyebrow={primaryProfile ? 'Personal aspects' : 'Sky aspects'}
          action={
            <Pressable onPress={() => router.push('/(stars)/transit-timeline' as never)}>
              <Text style={styles.linkText}>View All</Text>
            </Pressable>
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {(primaryProfile ? personalTransits : skyAspects).slice(0, 4).map((transit) => (
            <View key={transit.id} style={styles.transitCardWrap}>
              <TransitRow
                transit={transit}
                onPress={() => router.push('/(stars)/transit-timeline' as never)}
              />
            </View>
          ))}
        </ScrollView>
        {!primaryProfile ? (
          <Text style={styles.sectionHint}>
            Add a birth profile to turn the collective sky into a personal transit map.
          </Text>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Upcoming Sky Events"
          eyebrow="Next movements"
          action={
            <Pressable onPress={() => router.push('/(stars)/zodiac-events' as never)}>
              <Text style={styles.linkText}>Calendar</Text>
            </Pressable>
          }
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
          {upcomingEvents.map((event) => (
            <Pressable
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push('/(stars)/zodiac-events' as never)}
            >
              <Text style={styles.eventDate}>{event.eventDate}</Text>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventBody} numberOfLines={3}>
                {event.descriptionBrief}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </GlassCard>

      {retrogrades.length > 0 ? (
        <GlassCard style={styles.retroBanner} onPress={() => router.push('/(stars)/retrograde-dashboard' as never)}>
          <View style={styles.retroBannerHead}>
            <MaterialSymbol name="warning" size={20} color={ST_ACCENT_LIGHT} />
            <Text style={styles.retroBannerTitle}>Retrogrades Active</Text>
          </View>
          <Text style={styles.sectionBody}>
            {retrogrades.map((retrograde) => titleCase(retrograde.body)).join(', ')} are asking for review, rework, and slower pacing.
          </Text>
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
    paddingBottom: 140,
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
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 36,
    color: ST_TEXT,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: ST_TEXT_SECONDARY,
  },
  elementChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  elementChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
  },
  voidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  voidChipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  sectionCard: {
    gap: 14,
  },
  horizontalRow: {
    gap: 12,
  },
  planetCard: {
    width: 122,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  planetCardActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.14),
  },
  planetName: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  planetMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: ST_TEXT_SECONDARY,
  },
  planetFocus: {
    gap: 6,
    borderRadius: 18,
    padding: 14,
    backgroundColor: withAlpha(ST_ACCENT, 0.08),
  },
  planetFocusTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  sectionBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  transitCardWrap: {
    width: 286,
  },
  sectionHint: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_TERTIARY,
  },
  eventCard: {
    width: 240,
    borderRadius: 22,
    padding: 16,
    gap: 8,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  eventDate: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_ACCENT_LIGHT,
  },
  eventTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    lineHeight: 21,
    color: ST_TEXT,
  },
  eventBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  retroBanner: {
    gap: 10,
  },
  retroBannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  retroBannerTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  linkText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_ACCENT_LIGHT,
  },
});

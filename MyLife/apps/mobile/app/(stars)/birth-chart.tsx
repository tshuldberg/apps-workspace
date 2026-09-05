import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  ChartWheel,
  GlassCard,
  MaterialSymbol,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_ASPECTS,
  ST_ELEMENTS,
  ST_FONTS,
  ST_MODALITIES,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getBirthProfiles,
  getSavedChartsByProfile,
  getStarsPlanetColor,
  getZodiacElement,
  withAlpha,
  type Aspect,
  type ZodiacSign as ZodiacSignName,
} from '@mylife/stars';
import {
  AvatarOrb,
  DetailSheet,
  InlineValue,
  MetaPill,
  MetricBar,
  PhaseHeading,
  PlanetLegendRow,
  SegmentedControl,
  capitalize,
  createBirthChartData,
  formatBirthMeta,
} from '../../lib/stars-phase2';

type BirthTab = 'overview' | 'planets' | 'houses' | 'aspects';
type AspectFilter = 'all' | Aspect;

const TAB_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'planets', label: 'Planets' },
  { key: 'houses', label: 'Houses' },
  { key: 'aspects', label: 'Aspects' },
] as const;

const ASPECT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'conjunction', label: 'Conj.' },
  { key: 'trine', label: 'Trines' },
  { key: 'sextile', label: 'Sextiles' },
  { key: 'square', label: 'Squares' },
  { key: 'opposition', label: 'Opp.' },
] as const;

export default function BirthChartScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestedId = typeof params.id === 'string' ? params.id : undefined;
  const shareCardRef = useRef<View>(null);

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(requestedId ?? null);
  const [activeTab, setActiveTab] = useState<BirthTab>('overview');
  const [aspectFilter, setAspectFilter] = useState<AspectFilter>('all');
  const [showAspectLines, setShowAspectLines] = useState(true);
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; body: string } | null>(null);

  const profiles = useMemo(() => getBirthProfiles(db), [db]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }
    if (requestedId && profiles.some((profile) => profile.id === requestedId)) {
      setSelectedProfileId(requestedId);
      return;
    }
    if (!selectedProfileId || !profiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(profiles[0].id);
    }
  }, [profiles, requestedId, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );
  const chartData = useMemo(
    () => (selectedProfile ? createBirthChartData(selectedProfile) : null),
    [selectedProfile],
  );
  const savedCharts = useMemo(
    () => (selectedProfile ? getSavedChartsByProfile(db, selectedProfile.id) : []),
    [db, selectedProfile],
  );

  const filteredAspects = useMemo(() => {
    if (!chartData) {
      return [];
    }
    return chartData.aspects.filter((aspect) =>
      aspectFilter === 'all' ? true : aspect.type === aspectFilter,
    );
  }, [chartData, aspectFilter]);

  if (profiles.length === 0 || !selectedProfile || !chartData) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard variant="high" style={styles.emptyCard}>
          <PhaseHeading
            eyebrow="Natal Interpretation"
            title="Add your first birth profile"
            detail="Once your profile is saved, MyStars can render your chart wheel, houses, aspects, and long-form interpretation tabs."
          />
          <Pressable style={styles.primaryButton} onPress={() => router.push('/(stars)/add-profile')}>
            <MaterialSymbol name="add" size={18} color="#1A103D" filled />
            <Text style={styles.primaryButtonText}>Add Profile</Text>
          </Pressable>
        </GlassCard>
      </View>
    );
  }

  const profile = selectedProfile;
  const data = chartData;

  async function handleShare(): Promise<void> {
    if (!shareCardRef.current) {
      return;
    }
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Share unavailable', 'The system share sheet is not available here.');
        return;
      }
      await Sharing.shareAsync(uri, {
        dialogTitle: `${profile.name} Birth Chart`,
      });
    } catch {
      Alert.alert('Export failed', 'MyStars could not capture this chart right now.');
    }
  }

  function openWheelDetail(type: 'sign' | 'house' | 'planet', value: string | number): void {
    if (type === 'planet') {
      const planet = data.planets.find((entry) => entry.body === value);
      if (planet) {
        setDetail({
          title: `${planet.label} in ${capitalize(planet.sign)}`,
          subtitle: `House ${planet.house ?? 1} · ${planet.degreeLabel}`,
          body: planet.interpretation,
        });
      }
      return;
    }
    if (type === 'house') {
      const house = data.houses.find((entry) => entry.house === value);
      if (house) {
        setDetail({
          title: `House ${house.house}`,
          subtitle: `${capitalize(house.sign)} on the cusp · Ruled by ${house.rulingPlanet}`,
          body: house.interpretation,
        });
      }
      return;
    }
    const sign = String(value);
    const signName = sign as ZodiacSignName;
    setDetail({
      title: capitalize(sign),
      subtitle: `${capitalize(getZodiacElement(signName))} element`,
      body: `This sign appears throughout the chart as a repeated tone. When ${capitalize(sign)} is activated, the chart leans toward ${sign.toLowerCase()} qualities in thought, instinct, and timing.`,
    });
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <PhaseHeading
          eyebrow="Natal Interpretation"
          title={profile.name}
          detail={formatBirthMeta(profile)}
        />

        {profiles.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.profileRail}
          >
            {profiles.map((item) => {
              const active = item.id === profile.id;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.profileChip,
                    active ? styles.profileChipActive : null,
                  ]}
                  onPress={() => setSelectedProfileId(item.id)}
                >
                  <AvatarOrb
                    name={item.name}
                    size={34}
                    tone={active ? ST_ACCENT_LIGHT : withAlpha(ST_ACCENT_LIGHT, 0.7)}
                  />
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.profileChipName, active ? styles.profileChipNameActive : null]}>
                      {item.name}
                    </Text>
                    <Text style={styles.profileChipMeta}>
                      {capitalize(data.profile.id === item.id ? data.core.sun : (item.sunSign ?? 'aries'))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <GlassCard variant="high" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIdentity}>
              <AvatarOrb name={profile.name} />
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.summaryName}>{profile.name}</Text>
                <View style={styles.bigThreeRow}>
                  <View style={styles.bigThreeItem}>
                    <MetaPill label={`Sun · ${capitalize(data.core.sun)}`} />
                  </View>
                  <View style={styles.bigThreeItem}>
                    <MetaPill label={`Moon · ${capitalize(data.core.moon)}`} />
                  </View>
                  <View style={styles.bigThreeItem}>
                    <MetaPill label={`Rising · ${capitalize(data.core.rising)}`} />
                  </View>
                </View>
              </View>
            </View>
            <Pressable
              style={styles.inlineButton}
              onPress={() => router.push(`/(stars)/add-profile?id=${profile.id}` as never)}
            >
              <MaterialSymbol name="edit" size={16} color={ST_ACCENT_LIGHT} />
              <Text style={styles.inlineButtonText}>Edit</Text>
            </Pressable>
          </View>

          <Text style={styles.summaryCopy}>
            Dominant blend: {data.dominantBlend}. The chart reads as {capitalize(data.core.sun)} at the core, with {capitalize(data.core.moon)} instinct and a {capitalize(data.core.rising)} presentation layer.
          </Text>

          <View style={styles.metaWrap}>
            <MetaPill label={formatBirthMeta(profile)} />
            <MetaPill label={`${data.aspects.length} major aspects`} tone={withAlpha(ST_ACCENT, 0.2)} textColor={ST_ACCENT_LIGHT} />
          </View>
        </GlassCard>

        <GlassCard variant="high" style={styles.wheelCard}>
          <View style={styles.wheelHeader}>
            <View style={{ gap: 4 }}>
              <Text style={styles.sectionTitle}>Chart Wheel</Text>
              <Text style={styles.sectionMeta}>Tap any planet, house, or sign to inspect the chart.</Text>
            </View>
            <View style={styles.headerButtons}>
              <Pressable style={styles.iconButton} onPress={() => setShowAspectLines((value) => !value)}>
                <MaterialSymbol
                  name={showAspectLines ? 'auto_awesome' : 'grid_view'}
                  size={18}
                  color={showAspectLines ? ST_ACCENT_LIGHT : ST_TEXT_TERTIARY}
                />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => void handleShare()}>
                <MaterialSymbol name="share" size={18} color={ST_ACCENT_LIGHT} />
              </Pressable>
            </View>
          </View>

          <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
            <Text style={styles.shareEyebrow}>MyStars Natal Snapshot</Text>
            <Text style={styles.shareTitle}>{profile.name}</Text>
            <Text style={styles.shareSubtitle}>
              {capitalize(data.core.sun)} Sun · {capitalize(data.core.moon)} Moon · {capitalize(data.core.rising)} Rising
            </Text>
            <View style={styles.chartFrame}>
              <ChartWheel
                chart={data.chart}
                size={320}
                showAspectLines={showAspectLines}
                onSelect={openWheelDetail}
              />
            </View>
          </View>
        </GlassCard>

        <SegmentedControl
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={(next) => setActiveTab(next)}
        />

        {activeTab === 'overview' ? (
          <View style={styles.sectionStack}>
            <GlassCard style={styles.stackCard}>
              <Text style={styles.sectionTitle}>Big Three</Text>
              {[data.core.sun, data.core.moon, data.core.rising].map((sign, index) => {
                const label = index === 0 ? 'Sun' : index === 1 ? 'Moon' : 'Rising';
                return (
                  <Pressable
                    key={`${label}-${sign}`}
                    style={styles.bigThreeDetailRow}
                    onPress={() =>
                      setDetail({
                        title: `${label} in ${capitalize(sign)}`,
                        subtitle: `${capitalize(getZodiacElement(sign))} element`,
                        body: `${label} in ${capitalize(sign)} suggests ${capitalize(sign)} qualities dominate how this part of the chart behaves. ${label === 'Sun' ? 'This is the core identity signal.' : label === 'Moon' ? 'This is the emotional regulation signal.' : 'This is the social interface and pacing signal.'}`,
                      })
                    }
                  >
                    <MetaPill label={capitalize(sign)} tone={withAlpha(ST_ACCENT, 0.16)} textColor={ST_ACCENT_LIGHT} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.listTitle}>{label} in {capitalize(sign)}</Text>
                      <Text style={styles.listCopy}>
                        {label === 'Sun'
                          ? 'Core identity and vitality.'
                          : label === 'Moon'
                            ? 'Emotional reflexes and inner weather.'
                            : 'Presentation, pacing, and first impression.'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </GlassCard>

            <GlassCard style={styles.stackCard}>
              <Text style={styles.sectionTitle}>Element Balance</Text>
              {Object.entries(data.elementBalance).map(([element, count]) => (
                <MetricBar
                  key={element}
                  label={capitalize(element)}
                  value={Math.round((count / data.planets.length) * 100)}
                  tone={ST_ELEMENTS[element as keyof typeof ST_ELEMENTS]}
                  meta={`${count} placements`}
                />
              ))}
            </GlassCard>

            <GlassCard style={styles.stackCard}>
              <Text style={styles.sectionTitle}>Modality Balance</Text>
              {Object.entries(data.modalityBalance).map(([modality, count]) => (
                <MetricBar
                  key={modality}
                  label={capitalize(modality)}
                  value={Math.round((count / data.planets.length) * 100)}
                  tone={ST_MODALITIES[modality as keyof typeof ST_MODALITIES]}
                  meta={`${count} placements`}
                />
              ))}
            </GlassCard>

            <GlassCard style={styles.stackCard}>
              <Text style={styles.sectionTitle}>Dominant Planets</Text>
              {data.dominantPlanets.map((planet) => (
                <PlanetLegendRow
                  key={planet.body}
                  label={capitalize(planet.body)}
                  value="Most active"
                  copy={planet.reason}
                  tone={getStarsPlanetColor(planet.body)}
                  onPress={() =>
                    setDetail({
                      title: `${capitalize(planet.body)} focus`,
                      subtitle: 'Dominant planet',
                      body: planet.reason,
                    })
                  }
                />
              ))}
            </GlassCard>
          </View>
        ) : null}

        {activeTab === 'planets' ? (
          <View style={styles.sectionStack}>
            {data.planets.map((planet) => (
                <PlanetLegendRow
                key={planet.body}
                label={`${planet.label} in ${capitalize(planet.sign)}`}
                value={`House ${planet.house ?? 1} · ${planet.degreeLabel}`}
                copy={planet.interpretation}
                tone={getStarsPlanetColor(planet.body)}
                onPress={() =>
                  setDetail({
                    title: `${planet.label} in ${capitalize(planet.sign)}`,
                    subtitle: `House ${planet.house ?? 1} · ${planet.degreeLabel}`,
                    body: planet.interpretation,
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {activeTab === 'houses' ? (
          <View style={styles.sectionStack}>
            {data.houses.map((house) => (
              <PlanetLegendRow
                key={`house-${house.house}`}
                label={`House ${house.house}`}
                value={`${capitalize(house.sign)} · ${house.rulingPlanet}`}
                copy={house.interpretation}
                tone={ST_ELEMENTS[getZodiacElement(house.sign)]}
                icon="nightlight"
                onPress={() =>
                  setDetail({
                    title: `House ${house.house}`,
                    subtitle: `${capitalize(house.sign)} on the cusp · Ruled by ${house.rulingPlanet}`,
                    body: house.interpretation,
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {activeTab === 'aspects' ? (
          <View style={styles.sectionStack}>
            <SegmentedControl
              options={ASPECT_FILTERS}
              value={aspectFilter}
              onChange={(next) => setAspectFilter(next)}
            />
            {filteredAspects.map((aspect) => (
              <PlanetLegendRow
                key={`${aspect.fromBody}-${aspect.toBody}-${aspect.type}`}
                label={aspect.label}
                value={`${aspect.orb.toFixed(1)}° orb`}
                copy={aspect.interpretation}
                tone={ST_ASPECTS[aspect.type]}
                icon="auto_awesome"
                onPress={() =>
                  setDetail({
                    title: aspect.label,
                    subtitle: `${aspect.orb.toFixed(1)}° orb`,
                    body: aspect.interpretation,
                  })
                }
              />
            ))}
            {filteredAspects.length === 0 ? (
              <GlassCard style={styles.stackCard}>
                <Text style={styles.emptyTitle}>No aspects match this filter.</Text>
                <Text style={styles.emptyCopy}>Try a different aspect type or switch the wheel lines back on for the full view.</Text>
              </GlassCard>
            ) : null}
          </View>
        ) : null}

            <GlassCard style={styles.stackCard}>
              <Text style={styles.sectionTitle}>Saved Chart Links</Text>
              <Text style={styles.sectionMeta}>Jump straight into the next Phase 2 chart surfaces for this profile.</Text>
              <View style={styles.savedGrid}>
                <Pressable
                  style={styles.savedAction}
                  onPress={() => router.push(`/(stars)/solar-return?id=${profile.id}` as never)}
                >
                  <InlineValue label="Solar Return" value="Open yearly chart" />
                </Pressable>
                <Pressable
                  style={styles.savedAction}
                  onPress={() => router.push(`/(stars)/progressions?id=${profile.id}` as never)}
                >
                  <InlineValue label="Progressions" value="Open moving chart" />
                </Pressable>
          </View>
          {savedCharts.length > 0 ? (
            <View style={styles.savedList}>
              {savedCharts.slice(0, 4).map((chart) => (
                <MetaPill
                  key={chart.id}
                  label={`${chart.title} · ${chart.chartType.replace('_', ' ')}`}
                  tone={withAlpha(ST_ACCENT, 0.14)}
                  textColor={ST_ACCENT_LIGHT}
                />
              ))}
            </View>
          ) : null}
        </GlassCard>
      </ScrollView>

      <DetailSheet
        visible={detail !== null}
        title={detail?.title ?? ''}
        subtitle={detail?.subtitle}
        onClose={() => setDetail(null)}
      >
        <Text style={styles.sheetCopy}>{detail?.body}</Text>
      </DetailSheet>
    </>
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
    gap: 16,
  },
  emptyScreen: {
    flex: 1,
    backgroundColor: ST_SURFACES.lowest,
    justifyContent: 'center',
    padding: 16,
  },
  emptyCard: {
    gap: 20,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ST_ACCENT_LIGHT,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    color: '#1A103D',
  },
  profileRail: {
    gap: 10,
    paddingRight: 16,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  profileChipActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  profileChipName: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 13,
    color: ST_TEXT,
  },
  profileChipNameActive: {
    color: ST_ACCENT_LIGHT,
  },
  profileChipMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 11,
    color: ST_TEXT_TERTIARY,
  },
  summaryCard: {
    gap: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryIdentity: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  summaryName: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 24,
    color: ST_TEXT,
  },
  bigThreeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  bigThreeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  bigThreeLabel: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.14),
  },
  inlineButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  summaryCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wheelCard: {
    gap: 14,
  },
  wheelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 18,
    color: ST_TEXT,
  },
  sectionMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  shareCard: {
    gap: 10,
    alignItems: 'center',
  },
  shareEyebrow: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ST_ACCENT_LIGHT,
  },
  shareTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 26,
    color: ST_TEXT,
  },
  shareSubtitle: {
    fontFamily: ST_FONTS.medium,
    fontSize: 13,
    color: ST_TEXT_SECONDARY,
  },
  chartFrame: {
    width: '100%',
    alignItems: 'center',
  },
  sectionStack: {
    gap: 12,
  },
  stackCard: {
    gap: 12,
  },
  bigThreeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  listTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  listCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  emptyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  emptyCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: ST_TEXT_SECONDARY,
  },
  savedGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  savedAction: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  savedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
});

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { uuid } from '../../lib/uuid';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  ChartWheel,
  GlassCard,
  MaterialSymbol,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_ASPECTS,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  getBirthProfiles,
  getCompatibilityResult,
  getRecentCompatibilityResults,
  saveCompatibilityResult,
  withAlpha,
} from '@mylife/stars';
import {
  AvatarOrb,
  DetailSheet,
  MetaPill,
  MetricBar,
  PhaseHeading,
  PlanetLegendRow,
  ScoreRing,
  createSynastryView,
  formatBirthMeta,
} from '../../lib/stars-phase2';

type PickerTarget = 'a' | 'b' | null;

export default function CompatibilityScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ aId?: string; bId?: string }>();
  const requestedAId = typeof params.aId === 'string' ? params.aId : undefined;
  const requestedBId = typeof params.bId === 'string' ? params.bId : undefined;

  const [version, setVersion] = useState(0);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [selectedAId, setSelectedAId] = useState<string | null>(requestedAId ?? null);
  const [selectedBId, setSelectedBId] = useState<string | null>(requestedBId ?? null);
  const [detail, setDetail] = useState<{ title: string; subtitle?: string; body: string } | null>(null);

  const profiles = useMemo(() => getBirthProfiles(db), [db, version]);
  const history = useMemo(() => getRecentCompatibilityResults(db, 8), [db, version]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedAId(null);
      setSelectedBId(null);
      return;
    }

    if (requestedAId && profiles.some((profile) => profile.id === requestedAId)) {
      setSelectedAId(requestedAId);
    } else if (!selectedAId || !profiles.some((profile) => profile.id === selectedAId)) {
      setSelectedAId(profiles[0].id);
    }

    if (requestedBId && profiles.some((profile) => profile.id === requestedBId)) {
      setSelectedBId(requestedBId);
    } else if (
      (!selectedBId || !profiles.some((profile) => profile.id === selectedBId)) &&
      profiles.length > 1
    ) {
      setSelectedBId(profiles.find((profile) => profile.id !== (requestedAId ?? profiles[0].id))?.id ?? profiles[1].id);
    }
  }, [profiles, requestedAId, requestedBId, selectedAId, selectedBId]);

  const profileA = useMemo(
    () => profiles.find((profile) => profile.id === selectedAId) ?? null,
    [profiles, selectedAId],
  );
  const profileB = useMemo(
    () => profiles.find((profile) => profile.id === selectedBId) ?? null,
    [profiles, selectedBId],
  );

  const synastry = useMemo(() => {
    if (!profileA || !profileB || profileA.id === profileB.id) {
      return null;
    }
    return createSynastryView(profileA, profileB);
  }, [profileA, profileB]);

  const cachedComparison = useMemo(() => {
    if (!synastry) {
      return null;
    }
    return getCompatibilityResult(
      db,
      synastry.analysis.profileAId,
      synastry.analysis.profileBId,
    );
  }, [db, synastry]);

  const historyNameMap = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile.name]));
  }, [profiles]);

  function handleSelectProfile(profileId: string): void {
    if (pickerTarget === 'a') {
      setSelectedAId(profileId);
    }
    if (pickerTarget === 'b') {
      setSelectedBId(profileId);
    }
    setPickerTarget(null);
  }

  function handleSaveComparison(): void {
    if (!synastry) {
      return;
    }
    try {
      saveCompatibilityResult(
        db,
        cachedComparison?.id ?? uuid(),
        synastry.analysis.profileAId,
        synastry.analysis.profileBId,
        synastry.analysis.overallScore,
        synastry.overallTheme,
        synastry.analysis.analysisType,
      );
      setVersion((current) => current + 1);
      Alert.alert('Saved', 'This compatibility snapshot now appears in Past Comparisons.');
    } catch {
      Alert.alert('Save failed', 'MyStars could not store this comparison.');
    }
  }

  if (profiles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard variant="high" style={styles.emptyCard}>
          <PhaseHeading
            eyebrow="Celestial Compatibility"
            title="Add two profiles to compare"
            detail="Phase 2 compatibility is designed around your profile plus a saved friend profile, with the full synastry history kept on-device."
          />
          <View style={styles.emptyActions}>
            <Pressable style={styles.primaryButton} onPress={() => router.push('/(stars)/add-profile')}>
              <MaterialSymbol name="add" size={18} color="#1A103D" filled />
              <Text style={styles.primaryButtonText}>Add First Profile</Text>
            </Pressable>
          </View>
        </GlassCard>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <PhaseHeading
          eyebrow="Celestial Compatibility"
          title="Synastry Reading"
          detail="Compare two saved charts, inspect the strongest aspects, and save the snapshot to your private history."
        />

        <View style={styles.selectorGrid}>
          <Pressable style={styles.selectorCard} onPress={() => setPickerTarget('a')}>
            <Text style={styles.selectorLabel}>You</Text>
            {profileA ? (
              <View style={styles.selectorIdentity}>
                <AvatarOrb name={profileA.name} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.selectorName}>{profileA.name}</Text>
                  <Text style={styles.selectorMeta}>{formatBirthMeta(profileA)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>Select a profile</Text>
            )}
          </Pressable>

          <Pressable style={styles.selectorCard} onPress={() => setPickerTarget('b')}>
            <Text style={styles.selectorLabel}>Friend</Text>
            {profileB ? (
              <View style={styles.selectorIdentity}>
                <AvatarOrb name={profileB.name} tone="#FFB877" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.selectorName}>{profileB.name}</Text>
                  <Text style={styles.selectorMeta}>{formatBirthMeta(profileB)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>Pick a friend profile</Text>
            )}
          </Pressable>
        </View>

        {profiles.length < 2 ? (
          <GlassCard style={styles.infoCard}>
            <Text style={styles.emptyTitle}>One more profile unlocks Phase 2 compatibility.</Text>
            <Text style={styles.emptyCopy}>
              Add a friend or partner profile to calculate synastry, save the result, and build your comparison history.
            </Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/(stars)/add-profile?mode=friend' as never)}>
              <MaterialSymbol name="people" size={18} color={ST_ACCENT_LIGHT} />
              <Text style={styles.secondaryButtonText}>Add Friend Profile</Text>
            </Pressable>
          </GlassCard>
        ) : null}

        {synastry ? (
          <>
            <GlassCard variant="high" style={styles.heroCard}>
              <View style={styles.heroTop}>
                <ScoreRing
                  score={synastry.analysis.overallScore}
                  caption={synastry.analysis.overallScore >= 80 ? 'Soul-bonded' : synastry.analysis.overallScore >= 65 ? 'Aligned' : 'Dynamic'}
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>
                    {profileA?.name} + {profileB?.name}
                  </Text>
                  <Text style={styles.heroBody}>{synastry.overallTheme}</Text>
                  <View style={styles.metaWrap}>
                    <MetaPill label={cachedComparison ? 'Saved comparison' : 'Not saved yet'} tone={withAlpha(ST_ACCENT, 0.2)} textColor={ST_ACCENT_LIGHT} />
                    <MetaPill label={`${synastry.highlights.length} synastry highlights`} />
                  </View>
                </View>
              </View>
            </GlassCard>

            <GlassCard variant="high" style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={{ gap: 4 }}>
                  <Text style={styles.sectionTitle}>Synastry Wheel</Text>
                  <Text style={styles.sectionMeta}>Purple markers are yours. Gold markers belong to your selected friend.</Text>
                </View>
                <View style={styles.legendChips}>
                  <MetaPill label="You" tone={withAlpha(ST_ACCENT, 0.2)} textColor={ST_ACCENT_LIGHT} />
                  <MetaPill label="Friend" tone="rgba(255, 184, 119, 0.16)" textColor="#FFB877" />
                </View>
              </View>
              <View style={styles.chartWrap}>
                <GlassCard style={styles.chartShell}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={styles.chartInner}>
                      <ChartWheel chart={synastry.overlayChart} size={320} />
                    </View>
                  </View>
                </GlassCard>
              </View>
            </GlassCard>

            <GlassCard style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Score Breakdown</Text>
              {synastry.categories.map((category) => (
                <MetricBar
                  key={category.label}
                  label={category.label}
                  value={category.score}
                  tone={category.tone}
                />
              ))}
            </GlassCard>

            <GlassCard style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Aspect Highlights</Text>
              {synastry.highlights.map((aspect) => (
                <PlanetLegendRow
                  key={`${aspect.fromBody}-${aspect.toBody}`}
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
            </GlassCard>

            <GlassCard style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Interpretation</Text>
              <View style={styles.copyBlock}>
                <Text style={styles.copyLabel}>Overall Theme</Text>
                <Text style={styles.copyText}>{synastry.overallTheme}</Text>
              </View>
              <View style={styles.copyBlock}>
                <Text style={styles.copyLabel}>Strengths</Text>
                <Text style={styles.copyText}>{synastry.strengths}</Text>
              </View>
              <View style={styles.copyBlock}>
                <Text style={styles.copyLabel}>Challenges</Text>
                <Text style={styles.copyText}>{synastry.challenges}</Text>
              </View>
              <View style={styles.copyBlock}>
                <Text style={styles.copyLabel}>Tips</Text>
                <Text style={styles.copyText}>{synastry.tips}</Text>
              </View>
            </GlassCard>

            <Pressable style={styles.primaryButton} onPress={handleSaveComparison}>
              <MaterialSymbol name="favorite" size={18} color="#1A103D" filled />
              <Text style={styles.primaryButtonText}>
                {cachedComparison ? 'Update Saved Snapshot' : 'Save Comparison'}
              </Text>
            </Pressable>
          </>
        ) : null}

        <GlassCard style={styles.infoCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Past Comparisons</Text>
            <Pressable onPress={() => router.push('/(stars)/compatibility-history' as never)}>
              <Text style={styles.historyLink}>Open full history</Text>
            </Pressable>
          </View>
          {history.length === 0 ? (
            <Text style={styles.emptyCopy}>Save a comparison and it will show up here with a direct deep-link back into this screen.</Text>
          ) : (
            history.map((item) => {
              const leftName = historyNameMap.get(item.profileAId) ?? 'Unknown';
              const rightName = historyNameMap.get(item.profileBId) ?? 'Unknown';
              return (
                <Pressable
                  key={item.id}
                  style={styles.historyRow}
                  onPress={() =>
                    router.push(
                      `/(stars)/compatibility?aId=${item.profileAId}&bId=${item.profileBId}` as never,
                    )
                  }
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.historyTitle}>{leftName} + {rightName}</Text>
                    <Text style={styles.historyMeta}>
                      {new Date(item.computedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <MetaPill
                    label={`${item.overallScore}%`}
                    tone={withAlpha(ST_ACCENT, 0.16)}
                    textColor={ST_ACCENT_LIGHT}
                  />
                </Pressable>
              );
            })
          )}
        </GlassCard>
      </ScrollView>

      <DetailSheet
        visible={pickerTarget !== null}
        title={pickerTarget === 'a' ? 'Choose your profile' : 'Choose a friend profile'}
        subtitle={pickerTarget === 'a' ? 'Pick the chart that anchors the comparison.' : 'Pick the chart to overlay against your own.'}
        onClose={() => setPickerTarget(null)}
      >
        <View style={styles.pickerList}>
          {profiles.map((profile) => (
            <Pressable
              key={profile.id}
              style={styles.pickerRow}
              onPress={() => handleSelectProfile(profile.id)}
            >
              <AvatarOrb
                name={profile.name}
                tone={pickerTarget === 'a' ? ST_ACCENT_LIGHT : '#FFB877'}
                size={44}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.pickerTitle}>{profile.name}</Text>
                <Text style={styles.pickerMeta}>{formatBirthMeta(profile)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </DetailSheet>

      <DetailSheet
        visible={detail !== null}
        title={detail?.title ?? ''}
        subtitle={detail?.subtitle}
        onClose={() => setDetail(null)}
      >
        <Text style={styles.copyText}>{detail?.body}</Text>
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
    gap: 18,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorCard: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
    gap: 12,
  },
  selectorLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ST_TEXT_TERTIARY,
  },
  selectorIdentity: {
    gap: 10,
  },
  selectorName: {
    fontFamily: ST_FONTS.bold,
    fontSize: 17,
    color: ST_TEXT,
  },
  selectorMeta: {
    fontFamily: ST_FONTS.regular,
    fontSize: 12,
    color: ST_TEXT_SECONDARY,
  },
  selectorPlaceholder: {
    fontFamily: ST_FONTS.medium,
    fontSize: 14,
    color: ST_TEXT_TERTIARY,
  },
  heroCard: {
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroTitle: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 24,
    color: ST_TEXT,
  },
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
  chartCard: {
    gap: 14,
  },
  chartHeader: {
    gap: 8,
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
  legendChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartShell: {
    width: '100%',
    alignItems: 'center',
  },
  chartInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    gap: 12,
  },
  copyBlock: {
    gap: 4,
  },
  copyLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: ST_TEXT_TERTIARY,
  },
  copyText: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
  primaryButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ST_ACCENT_LIGHT,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    color: '#1A103D',
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  secondaryButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 13,
    color: ST_ACCENT_LIGHT,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyLink: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  historyTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 14,
    color: ST_TEXT,
  },
  historyMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  pickerList: {
    gap: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  pickerTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  pickerMeta: {
    fontFamily: ST_FONTS.regular,
    fontSize: 12,
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
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

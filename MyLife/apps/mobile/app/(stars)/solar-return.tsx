import { useEffect, useMemo, useState } from 'react';
import {
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
  computeSolarReturn,
  getBirthProfiles,
  getSolarReturn,
  saveSolarReturn,
  withAlpha,
} from '@mylife/stars';
import {
  MetaPill,
  PhaseHeading,
  PlanetLegendRow,
  createSolarReturnView,
} from '../../lib/stars-phase2';

export default function SolarReturnScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestedId = typeof params.id === 'string' ? params.id : undefined;

  const currentYear = new Date().getFullYear();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(requestedId ?? null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showComparison, setShowComparison] = useState(false);

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

  const profile = useMemo(
    () => profiles.find((entry) => entry.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const result = useMemo(() => {
    if (!profile) {
      return null;
    }
    const cached = getSolarReturn(db, profile.id, selectedYear);
    if (cached) {
      return cached;
    }
    return computeSolarReturn(profile.id, profile.birthDate, selectedYear);
  }, [db, profile, selectedYear]);

  const previousResult = useMemo(() => {
    if (!profile) {
      return null;
    }
    const previousYear = selectedYear - 1;
    const cached = getSolarReturn(db, profile.id, previousYear);
    if (cached) {
      return cached;
    }
    return computeSolarReturn(profile.id, profile.birthDate, previousYear);
  }, [db, profile, selectedYear]);

  useEffect(() => {
    if (!profile || !result) {
      return;
    }
    if (!getSolarReturn(db, profile.id, selectedYear)) {
      saveSolarReturn(db, uuid(), result);
    }
    if (previousResult && !getSolarReturn(db, profile.id, selectedYear - 1)) {
      saveSolarReturn(db, uuid(), previousResult);
    }
  }, [db, previousResult, profile, result, selectedYear]);

  const view = useMemo(() => {
    if (!profile || !result || !previousResult) {
      return null;
    }
    return createSolarReturnView(profile, result, previousResult);
  }, [previousResult, profile, result]);

  if (!profile || !result || !previousResult || !view) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard variant="high" style={styles.emptyCard}>
          <PhaseHeading
            eyebrow="Solar Return"
            title="Add a birth profile first"
            detail="Your yearly chart opens once a saved profile exists. MyStars keeps each return cached on-device for quick revisits."
          />
          <Pressable style={styles.primaryButton} onPress={() => router.push('/(stars)/add-profile')}>
            <MaterialSymbol name="add" size={18} color="#1A103D" filled />
            <Text style={styles.primaryButtonText}>Add Profile</Text>
          </Pressable>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PhaseHeading
        eyebrow="Solar Return"
        title={`${profile.name} · ${selectedYear}`}
        detail={result.yearTheme}
      />

      <View style={styles.yearBar}>
        <Pressable style={styles.yearButton} onPress={() => setSelectedYear((year) => year - 1)}>
          <MaterialSymbol name="chevron_left" size={18} color={ST_ACCENT_LIGHT} />
        </Pressable>
        <View style={styles.yearCenter}>
          <Text style={styles.yearLabel}>{selectedYear}</Text>
          <Text style={styles.yearMeta}>{view.yearLabel}</Text>
        </View>
        <Pressable style={styles.yearButton} onPress={() => setSelectedYear((year) => year + 1)}>
          <MaterialSymbol name="chevron_right" size={18} color={ST_ACCENT_LIGHT} />
        </Pressable>
      </View>

      {profiles.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.profileRail}
        >
          {profiles.map((entry) => {
            const active = entry.id === profile.id;
            return (
              <Pressable
                key={entry.id}
                style={[styles.profileChip, active ? styles.profileChipActive : null]}
                onPress={() => setSelectedProfileId(entry.id)}
              >
                <Text style={[styles.profileChipText, active ? styles.profileChipTextActive : null]}>
                  {entry.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <GlassCard variant="high" style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={{ gap: 4 }}>
            <Text style={styles.sectionTitle}>Annual Chart Wheel</Text>
            <Text style={styles.sectionMeta}>
              {showComparison ? `Overlaying ${selectedYear - 1}` : 'Showing this year only'}
            </Text>
          </View>
          <Pressable style={styles.inlineButton} onPress={() => setShowComparison((value) => !value)}>
            <MaterialSymbol name="grid_view" size={16} color={ST_ACCENT_LIGHT} />
            <Text style={styles.inlineButtonText}>
              {showComparison ? 'Hide Compare' : 'Compare Previous'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.chartWrap}>
          <ChartWheel
            chart={showComparison ? view.compareChart : view.chart}
            size={320}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Return Date</Text>
        <Text style={styles.dateTitle}>{view.returnMoment}</Text>
        <View style={styles.metaWrap}>
          <MetaPill label={`Sun in ${result.sunSign}`} tone={withAlpha(ST_ACCENT, 0.18)} textColor={ST_ACCENT_LIGHT} />
          <MetaPill label={`Moon in ${result.moonSign}`} />
        </View>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Year Theme</Text>
        <Text style={styles.bodyCopy}>{result.yearTheme}</Text>
        <Text style={styles.sectionMeta}>{view.comparisonCopy}</Text>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Quarter Breakdown</Text>
        {view.quarterThemes.map((quarter) => (
          <View key={quarter.label} style={styles.quarterRow}>
            <MetaPill label={quarter.label} tone={withAlpha(ST_ACCENT, 0.16)} textColor={ST_ACCENT_LIGHT} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.quarterTitle}>{quarter.title}</Text>
              <Text style={styles.bodyCopy}>{quarter.copy}</Text>
            </View>
          </View>
        ))}
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Key Transits</Text>
        {view.keyTransits.map((aspect) => (
          <PlanetLegendRow
            key={`${aspect.fromBody}-${aspect.toBody}`}
            label={aspect.label}
            value={`${aspect.orb.toFixed(1)}° orb`}
            copy={aspect.interpretation}
            tone={ST_ASPECTS[aspect.type]}
            icon="auto_awesome"
          />
        ))}
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Standout Placements</Text>
        <View style={styles.focusWrap}>
          {view.standoutFocus.map((item) => (
            <MetaPill
              key={item.label}
              label={`${item.label}: ${item.value}`}
              tone={withAlpha('#FFFFFF', 0.06)}
              textColor={ST_TEXT_SECONDARY}
            />
          ))}
        </View>
      </GlassCard>
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
  yearBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 28,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  yearButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  yearCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  yearLabel: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 26,
    color: ST_TEXT,
  },
  yearMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  profileRail: {
    gap: 8,
    paddingRight: 16,
  },
  profileChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  profileChipActive: {
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  profileChipText: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  profileChipTextActive: {
    color: ST_ACCENT_LIGHT,
  },
  chartCard: {
    gap: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.16),
  },
  inlineButtonText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
  },
  chartWrap: {
    alignItems: 'center',
  },
  infoCard: {
    gap: 12,
  },
  dateTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 17,
    color: ST_TEXT,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
  quarterRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  quarterTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 15,
    color: ST_TEXT,
  },
  focusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

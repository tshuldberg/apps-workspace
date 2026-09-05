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
  ST_ASPECTS,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
  computeProgressedChart,
  getBirthProfiles,
  getProgressedChart,
  saveProgressedChart,
  withAlpha,
} from '@mylife/stars';
import {
  MetaPill,
  PhaseHeading,
  PlanetLegendRow,
  SegmentedControl,
  TinyLineChart,
  createProgressionView,
  formatDateLabel,
  type ProgressionType,
} from '../../lib/stars-phase2';

const TYPE_OPTIONS = [
  { key: 'secondary', label: 'Secondary' },
  { key: 'solar_arc', label: 'Solar Arc' },
  { key: 'tertiary', label: 'Tertiary' },
] as const;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, delta: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

export default function ProgressionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const requestedId = typeof params.id === 'string' ? params.id : undefined;

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(requestedId ?? null);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [progressionType, setProgressionType] = useState<ProgressionType>('secondary');

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

  const rawResult = useMemo(() => {
    if (!profile) {
      return null;
    }
    if (selectedDate === todayString()) {
      const cached = getProgressedChart(db, profile.id);
      if (cached) {
        return cached;
      }
    }
    return computeProgressedChart(profile.id, profile.birthDate, selectedDate);
  }, [db, profile, selectedDate]);

  useEffect(() => {
    if (!profile || !rawResult || selectedDate !== todayString()) {
      return;
    }
    if (!getProgressedChart(db, profile.id)) {
      saveProgressedChart(db, uuid(), rawResult);
    }
  }, [db, profile, rawResult, selectedDate]);

  const view = useMemo(() => {
    if (!profile || !rawResult) {
      return null;
    }
    return createProgressionView(profile, rawResult, progressionType, selectedDate);
  }, [profile, progressionType, rawResult, selectedDate]);

  if (!profile || !rawResult || !view) {
    return (
      <View style={styles.emptyScreen}>
        <GlassCard variant="high" style={styles.emptyCard}>
          <PhaseHeading
            eyebrow="Progressions"
            title="Add a birth profile first"
            detail="Phase 2 progressions need one saved profile. MyStars caches the current-day progression chart and lets you inspect alternate dates from there."
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
        eyebrow="Progressions"
        title={`${profile.name} · ${formatDateLabel(selectedDate)}`}
        detail={view.summary}
      />

      <View style={styles.dateBar}>
        <Pressable style={styles.dateButton} onPress={() => setSelectedDate((date) => addDays(date, -30))}>
          <MaterialSymbol name="chevron_left" size={18} color={ST_ACCENT_LIGHT} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
          <Text style={styles.dateMeta}>{selectedDate === todayString() ? 'Cached today snapshot' : 'Custom date view'}</Text>
        </View>
        <Pressable style={styles.dateButton} onPress={() => setSelectedDate((date) => addDays(date, 30))}>
          <MaterialSymbol name="chevron_right" size={18} color={ST_ACCENT_LIGHT} />
        </Pressable>
      </View>

      <View style={styles.topControls}>
        <Pressable style={styles.todayChip} onPress={() => setSelectedDate(todayString())}>
          <Text style={styles.todayChipText}>Today</Text>
        </Pressable>
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
      </View>

      <SegmentedControl
        options={TYPE_OPTIONS}
        value={progressionType}
        onChange={(next) => setProgressionType(next)}
      />

      <GlassCard variant="high" style={styles.chartCard}>
        <View style={{ gap: 4 }}>
          <Text style={styles.sectionTitle}>Natal + Progressed Overlay</Text>
          <Text style={styles.sectionMeta}>Outer pale markers are natal anchors. Violet markers show the selected progression mode.</Text>
        </View>
        <View style={styles.chartWrap}>
          <ChartWheel chart={view.chart} size={320} />
        </View>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Emphasis Cards</Text>
        {view.emphasis.map((item) => (
          <View key={item.label} style={styles.emphasisRow}>
            <MetaPill
              label={item.label}
              tone={withAlpha(ST_ACCENT, 0.16)}
              textColor={ST_ACCENT_LIGHT}
            />
            <Text style={styles.emphasisValue}>{item.value}</Text>
            <Text style={styles.bodyCopy}>{item.copy}</Text>
          </View>
        ))}
        <Text style={styles.sectionMeta}>{view.nextThreshold}</Text>
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Progressed Aspects To Natal</Text>
        {view.aspects.map((aspect) => (
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
        <Text style={styles.sectionTitle}>Year At A Glance</Text>
        <Text style={styles.sectionMeta}>Approximate progressed moon movement across the next twelve monthly checkpoints.</Text>
        <TinyLineChart
          points={view.timelinePoints}
          labels={view.timelineLabels}
        />
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
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 28,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  dateButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(ST_ACCENT, 0.12),
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontFamily: ST_FONTS.extraBold,
    fontSize: 22,
    color: ST_TEXT,
  },
  dateMeta: {
    fontFamily: ST_FONTS.medium,
    fontSize: 12,
    color: ST_TEXT_TERTIARY,
  },
  topControls: {
    gap: 10,
  },
  todayChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(ST_ACCENT, 0.18),
  },
  todayChipText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
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
    gap: 12,
  },
  chartWrap: {
    alignItems: 'center',
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
  infoCard: {
    gap: 12,
  },
  emphasisRow: {
    gap: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  emphasisValue: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  bodyCopy: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: ST_TEXT_SECONDARY,
  },
});

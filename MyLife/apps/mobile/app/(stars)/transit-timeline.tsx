import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChartWheel,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TransitRow,
  withAlpha,
  ST_ACCENT,
  ST_ACCENT_LIGHT,
  ST_FONTS,
  ST_SURFACES,
  ST_TEXT,
  ST_TEXT_SECONDARY,
  ST_TEXT_TERTIARY,
} from '@mylife/stars';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildSkyChart,
  buildTimelineDates,
  formatStarsLongDate,
  formatStarsShortDate,
  getPersonalTransits,
  getPrimaryProfile,
  getSkyAspects,
} from '../../components/stars/phase1';

export default function TransitTimelineScreen() {
  const db = useDatabase();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const dates = useMemo(() => buildTimelineDates(today, 10), [today]);
  const [selectedIndex, setSelectedIndex] = useState(10);
  const [compareToNatal, setCompareToNatal] = useState(true);
  const [highlight, setHighlight] = useState<string[]>([]);

  const profile = useMemo(() => getPrimaryProfile(db), [db]);
  const selectedDate = dates[selectedIndex] ?? today;
  const transits = useMemo(
    () =>
      compareToNatal && profile
        ? getPersonalTransits(db, profile, selectedDate)
        : getSkyAspects(selectedDate),
    [compareToNatal, db, profile, selectedDate],
  );
  const chart = useMemo(
    () => buildSkyChart(selectedDate, compareToNatal && Boolean(profile), profile),
    [compareToNatal, profile, selectedDate],
  );

  const handleSwipe = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (event.nativeEvent.state !== State.END) {
        return;
      }

      if (event.nativeEvent.translationX > 24) {
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.nativeEvent.translationX < -24) {
        setSelectedIndex((index) => Math.min(index + 1, dates.length - 1));
      }
    },
    [dates.length],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GlassCard variant="high" style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Transit Timeline</Text>
        <Text style={styles.heroDate}>{formatStarsLongDate(selectedDate)}</Text>
        <Text style={styles.heroBody}>
          Swipe the date rail to watch the sky move. Toggle between the collective chart and your natal comparison at any point.
        </Text>
      </GlassCard>

      <PanGestureHandler onHandlerStateChange={handleSwipe}>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRail}>
            {dates.map((date, index) => {
              const active = index === selectedIndex;
              return (
                <Pressable
                  key={date}
                  style={[styles.datePill, active ? styles.datePillActive : null]}
                  onPress={() => setSelectedIndex(index)}
                >
                  <Text style={[styles.datePillLabel, active ? styles.datePillLabelActive : null]}>
                    {formatStarsShortDate(date)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </PanGestureHandler>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="View Mode" eyebrow="Compare" />
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              compareToNatal ? styles.toggleButtonActive : null,
            ]}
            onPress={() => setCompareToNatal(true)}
            disabled={!profile}
          >
            <MaterialSymbol name="compare_arrows" size={18} color={compareToNatal ? '#22113E' : ST_ACCENT_LIGHT} />
            <Text style={[styles.toggleText, compareToNatal ? styles.toggleTextActive : null]}>
              Compare To Natal
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              !compareToNatal ? styles.toggleButtonActive : null,
            ]}
            onPress={() => setCompareToNatal(false)}
          >
            <MaterialSymbol name="auto_graph" size={18} color={!compareToNatal ? '#22113E' : ST_ACCENT_LIGHT} />
            <Text style={[styles.toggleText, !compareToNatal ? styles.toggleTextActive : null]}>
              Sky Aspects
            </Text>
          </Pressable>
        </View>
        {!profile ? (
          <Text style={styles.helperText}>
            Add a birth profile to unlock natal comparison. Until then, the timeline shows the collective sky only.
          </Text>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.chartCard}>
        <SectionHeader title="Chart Wheel" eyebrow="Selected date" />
        <View style={styles.chartWrap}>
          <ChartWheel
            chart={chart}
            size={320}
            highlight={highlight}
            onSelect={(_type, value) => {
              if (typeof value === 'string') {
                setHighlight([value.toLowerCase()]);
              }
            }}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Transit Rows"
          eyebrow={compareToNatal && profile ? 'Personal aspects' : 'Sky aspects'}
          action={
            <Pressable onPress={() => router.push('/(stars)/transit-calendar' as never)}>
              <Text style={styles.linkText}>Calendar View</Text>
            </Pressable>
          }
        />
        {transits.length > 0 ? (
          <View style={styles.transitList}>
            {transits.slice(0, 8).map((transit) => (
              <TransitRow
                key={transit.id}
                transit={transit}
                onPress={() =>
                  setHighlight([
                    transit.transitingBody.toLowerCase(),
                    transit.natalBody.toLowerCase(),
                  ])
                }
              />
            ))}
          </View>
        ) : (
          <Text style={styles.helperText}>
            No notable aspects for this date. Try nudging the scrubber forward or backward.
          </Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Interpretations" eyebrow="Aspect notes" />
        {transits.slice(0, 3).map((transit) => (
          <View key={`${transit.id}-note`} style={styles.interpretationCard}>
            <Text style={styles.interpretationTitle}>
              {transit.transitingBody} {transit.aspectType} {transit.natalBody}
            </Text>
            <Text style={styles.interpretationBody}>{transit.interpretationBrief}</Text>
          </View>
        ))}
      </GlassCard>
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
    gap: 12,
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
  heroBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: ST_TEXT_SECONDARY,
  },
  dateRail: {
    gap: 10,
  },
  datePill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha('#FFFFFF', 0.05),
  },
  datePillActive: {
    backgroundColor: ST_ACCENT_LIGHT,
  },
  datePillLabel: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_TEXT,
  },
  datePillLabelActive: {
    color: '#22113E',
  },
  sectionCard: {
    gap: 14,
  },
  chartCard: {
    gap: 16,
  },
  chartWrap: {
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: withAlpha(ST_ACCENT, 0.08),
  },
  toggleButtonActive: {
    backgroundColor: ST_ACCENT_LIGHT,
  },
  toggleText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    color: ST_ACCENT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  toggleTextActive: {
    color: '#22113E',
  },
  helperText: {
    fontFamily: ST_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: ST_TEXT_TERTIARY,
  },
  linkText: {
    fontFamily: ST_FONTS.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: ST_ACCENT_LIGHT,
  },
  transitList: {
    gap: 10,
  },
  interpretationCard: {
    gap: 6,
    borderRadius: 18,
    padding: 14,
    backgroundColor: withAlpha('#FFFFFF', 0.04),
  },
  interpretationTitle: {
    fontFamily: ST_FONTS.bold,
    fontSize: 16,
    color: ST_TEXT,
  },
  interpretationBody: {
    fontFamily: ST_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: ST_TEXT_SECONDARY,
  },
});

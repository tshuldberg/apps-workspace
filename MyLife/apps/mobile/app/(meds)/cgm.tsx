import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import {
  calculateTrendArrow,
  calculateTIRBreakdown,
  getCGMReadings,
  getCGMStats,
  getCGMSyncState,
  getGlucoseReadings,
  getInsulinEntries,
  getSetting,
  setSetting,
  upsertCGMSyncState,
} from '@mylife/meds';
import type { CGMReading } from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_GLUCOSE_STATUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PERIOD_OPTIONS = [
  { label: '3h', hours: 3 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
] as const;

const STATUS_META = {
  very_low: { label: 'Urgent low', color: '#FF453A' },
  low: { label: 'Low', color: MD_GLUCOSE_STATUS.low },
  in_range: { label: 'In range', color: MD_GLUCOSE_STATUS.normal },
  high: { label: 'High', color: '#FF8A6B' },
  very_high: { label: 'Urgent high', color: '#FF453A' },
} as const;

const TREND_LABELS = {
  rising_fast: '↑↑',
  rising: '↑',
  rising_slow: '↗',
  flat: '→',
  falling_slow: '↘',
  falling: '↓',
  falling_fast: '↓↓',
} as const;

function getCutoff(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

function estimateSensorExpiry(deviceName: string | null, readings: CGMReading[]): string {
  if (!deviceName) {
    return 'Sensor status unavailable';
  }

  const matching = readings.filter((reading) => reading.deviceName === deviceName);
  const oldest = matching[matching.length - 1] ?? matching[0];
  if (!oldest) {
    return 'Sensor status unavailable';
  }

  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(oldest.measuredAt).getTime()) / (1000 * 60 * 60 * 24)),
  );
  const lifetime = deviceName.toLowerCase().includes('libre') ? 14 : 10;
  const remaining = Math.max(0, lifetime - ageDays);
  return `Est. ${remaining} days remaining`;
}

function getPatternInsights(readings: CGMReading[], stats: ReturnType<typeof getCGMStats>): string[] {
  if (!readings.length) {
    return ['Connect a sensor or import data to surface patterns.'];
  }

  const hourlyBuckets = new Map<number, number[]>();
  readings.forEach((reading) => {
    const hour = new Date(reading.measuredAt).getHours();
    const bucket = hourlyBuckets.get(hour) ?? [];
    bucket.push(reading.value);
    hourlyBuckets.set(hour, bucket);
  });

  const averageForHours = (hours: number[]) => {
    const values = hours.flatMap((hour) => hourlyBuckets.get(hour) ?? []);
    if (!values.length) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const morningAverage = averageForHours([5, 6, 7, 8]);
  const overnightAverage = averageForHours([0, 1, 2, 3, 4]);
  const eveningAverage = averageForHours([17, 18, 19, 20, 21]);
  const insights: string[] = [];

  if (morningAverage !== null && morningAverage > stats.averageGlucose + 18) {
    insights.push('Higher early-morning values suggest a possible dawn phenomenon pattern.');
  }
  if (overnightAverage !== null && overnightAverage < 80) {
    insights.push('Overnight readings drift low. Review your basal or evening snack pattern.');
  }
  if (eveningAverage !== null && eveningAverage > 180) {
    insights.push('Evening values run above target. Watch post-dinner spikes and correction timing.');
  }
  if (stats.cv > 36) {
    insights.push('Variability is above the preferred range. Smooth meal dosing and sensor review may help.');
  }

  return insights.length ? insights : ['No dominant pattern detected in this window.'];
}

function DonutGauge({
  inRange,
  aboveRange,
  belowRange,
}: {
  inRange: number;
  aboveRange: number;
  belowRange: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const safeInRange = Math.max(0, Math.min(100, inRange));
  const safeAbove = Math.max(0, Math.min(100 - safeInRange, aboveRange));
  const safeBelow = Math.max(0, Math.min(100 - safeInRange - safeAbove, belowRange));
  const inRangeLength = (safeInRange / 100) * circumference;
  const aboveLength = (safeAbove / 100) * circumference;
  const belowLength = (safeBelow / 100) * circumference;

  return (
    <View style={styles.donutWrap}>
      <Svg height={132} viewBox="0 0 132 132" width={132}>
        <Circle
          cx={66}
          cy={66}
          fill="transparent"
          r={radius}
          stroke={withAlpha(MD_TEXT_SECONDARY, 0.12)}
          strokeWidth={12}
        />
        <Circle
          cx={66}
          cy={66}
          fill="transparent"
          r={radius}
          rotation={-90}
          origin="66,66"
          stroke={MD_GLUCOSE_STATUS.normal}
          strokeDasharray={`${inRangeLength} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={12}
        />
        <Circle
          cx={66}
          cy={66}
          fill="transparent"
          r={radius}
          rotation={-90 + (safeInRange / 100) * 360}
          origin="66,66"
          stroke="#FF8A6B"
          strokeDasharray={`${aboveLength} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={12}
        />
        <Circle
          cx={66}
          cy={66}
          fill="transparent"
          r={radius}
          rotation={-90 + ((safeInRange + safeAbove) / 100) * 360}
          origin="66,66"
          stroke={MD_GLUCOSE_STATUS.low}
          strokeDasharray={`${belowLength} ${circumference}`}
          strokeLinecap="round"
          strokeWidth={12}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterValue}>{safeInRange}%</Text>
        <Text style={styles.donutCenterLabel}>target</Text>
      </View>
    </View>
  );
}

function CGMChart({
  events,
  readings,
}: {
  events: Array<{ timestamp: string; label: string; color: string }>;
  readings: CGMReading[];
}) {
  if (readings.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Need at least two sensor readings to draw the timeline.</Text>
      </View>
    );
  }

  const chartReadings = readings.slice().reverse();
  const width = 320;
  const height = 188;
  const padding = 18;
  const values = chartReadings.map((reading) => reading.value);
  const minValue = Math.min(50, ...values) - 10;
  const maxValue = Math.max(260, ...values) + 10;
  const start = new Date(chartReadings[0].measuredAt).getTime();
  const end = new Date(chartReadings[chartReadings.length - 1].measuredAt).getTime();
  const range = Math.max(1, end - start);
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const xFor = (timestamp: string) => padding + ((new Date(timestamp).getTime() - start) / range) * chartWidth;
  const yFor = (value: number) => height - padding - ((value - minValue) / Math.max(1, maxValue - minValue)) * chartHeight;
  const points = chartReadings.map((reading) => `${xFor(reading.measuredAt)},${yFor(reading.value)}`).join(' ');
  const rangeTop = yFor(180);
  const rangeBottom = yFor(70);

  return (
    <Svg height={height} viewBox={`0 0 ${width} ${height}`} width="100%">
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.high, 0.12)}
        height={Math.max(0, rangeTop - padding)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={padding}
      />
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.normal, 0.14)}
        height={Math.max(0, rangeBottom - rangeTop)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={rangeTop}
      />
      <Rect
        fill={withAlpha(MD_GLUCOSE_STATUS.low, 0.14)}
        height={Math.max(0, height - padding - rangeBottom)}
        rx={18}
        width={chartWidth}
        x={padding}
        y={rangeBottom}
      />

      {[70, 120, 180].map((value) => (
        <Line
          key={value}
          stroke={withAlpha(MD_TEXT_SECONDARY, 0.16)}
          strokeDasharray="4 6"
          strokeWidth={1.4}
          x1={padding}
          x2={width - padding}
          y1={yFor(value)}
          y2={yFor(value)}
        />
      ))}

      <Polyline
        fill="none"
        points={points}
        stroke={MD_ACCENT_LIGHT}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />

      {chartReadings.map((reading) => (
        <Circle
          key={reading.id}
          cx={xFor(reading.measuredAt)}
          cy={yFor(reading.value)}
          fill={STATUS_META[reading.rangeStatus].color}
          r={3.8}
        />
      ))}

      {events.slice(0, 6).map((event) => {
        const x = xFor(event.timestamp);
        const y = padding + 12;
        return (
          <Path
            key={`${event.label}-${event.timestamp}`}
            d={`M ${x - 9} ${y} h 18 a 9 9 0 0 1 9 9 v 0 a 9 9 0 0 1 -9 9 h -18 a 9 9 0 0 1 -9 -9 v 0 a 9 9 0 0 1 9 -9 z`}
            fill={withAlpha(event.color, 0.2)}
          />
        );
      })}
    </Svg>
  );
}

export default function CGMScreen() {
  const db = useDatabase();
  const [periodHours, setPeriodHours] = useState(24);
  const [refreshToken, setRefreshToken] = useState(0);
  const [lowThreshold, setLowThreshold] = useState(
    Number.parseInt(getSetting(db, 'cgmLowThreshold') ?? '70', 10),
  );
  const [highThreshold, setHighThreshold] = useState(
    Number.parseInt(getSetting(db, 'cgmHighThreshold') ?? '180', 10),
  );
  const [rapidAlertsEnabled, setRapidAlertsEnabled] = useState(
    (getSetting(db, 'cgmRapidChangeAlerts') ?? 'true') !== 'false',
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshToken((value) => value + 1);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((value) => value + 1);
    }, []),
  );

  const cutoff = useMemo(() => getCutoff(periodHours), [periodHours]);
  const allReadings = useMemo(() => getCGMReadings(db, { limit: 2000 }), [db, refreshToken]);
  const syncState = useMemo(() => getCGMSyncState(db), [db, refreshToken]);
  const periodReadings = useMemo(
    () => allReadings.filter((reading) => reading.measuredAt >= cutoff),
    [allReadings, cutoff],
  );
  const insulinEntries = useMemo(
    () => getInsulinEntries(db, { from: cutoff, limit: 200 }),
    [db, cutoff],
  );
  const glucoseEvents = useMemo(
    () => getGlucoseReadings(db, { from: cutoff, limit: 120 }),
    [db, cutoff],
  );

  const stats = useMemo(() => getCGMStats(periodReadings), [periodReadings]);
  const tir = useMemo(() => calculateTIRBreakdown(periodReadings), [periodReadings]);
  const latestReading = periodReadings[0] ?? null;
  const trend = useMemo(() => calculateTrendArrow(periodReadings.slice(0, 5)), [periodReadings]);
  const patterns = useMemo(() => getPatternInsights(periodReadings, stats), [periodReadings, stats]);

  const events = useMemo(() => {
    const insulinMarkers = insulinEntries.map((entry) => ({
      timestamp: entry.administeredAt,
      label: 'I',
      color: MD_ACCENT,
    }));
    const mealMarkers = glucoseEvents
      .filter((entry) => Boolean(entry.mealContext))
      .map((entry) => ({
        timestamp: entry.measuredAt,
        label: entry.mealContext === 'after_exercise' ? 'E' : 'M',
        color: entry.mealContext === 'after_exercise' ? '#FFD60A' : '#FFB877',
      }));

    return [...insulinMarkers, ...mealMarkers]
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }, [glucoseEvents, insulinEntries]);

  const currentStatus = latestReading ? STATUS_META[latestReading.rangeStatus] : null;

  function persistThresholds(nextLow: number, nextHigh: number, rapidChange: boolean) {
    setSetting(db, 'cgmLowThreshold', String(nextLow));
    setSetting(db, 'cgmHighThreshold', String(nextHigh));
    setSetting(db, 'cgmRapidChangeAlerts', rapidChange ? 'true' : 'false');
  }

  function adjustThreshold(kind: 'low' | 'high', delta: number) {
    const nextLow = kind === 'low' ? Math.max(55, lowThreshold + delta) : lowThreshold;
    const nextHigh = kind === 'high' ? Math.max(nextLow + 20, highThreshold + delta) : highThreshold;
    setLowThreshold(nextLow);
    setHighThreshold(nextHigh);
    persistThresholds(nextLow, nextHigh, rapidAlertsEnabled);
  }

  function toggleRapidAlerts() {
    const next = !rapidAlertsEnabled;
    setRapidAlertsEnabled(next);
    persistThresholds(lowThreshold, highThreshold, next);
  }

  function handleSyncNow() {
    try {
      upsertCGMSyncState(db, {
        lastSyncAt: new Date().toISOString(),
        readingsSynced: allReadings.length,
      });
      setRefreshToken((value) => value + 1);
    } catch (error) {
      Alert.alert(
        'Unable to refresh sync state',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  if (!allReadings.length) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard intensity={22} padding={22} style={styles.emptyCard}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="bloodtype" size={26} />
          <Text style={styles.emptyTitle}>No CGM data yet</Text>
          <Text style={styles.emptyBody}>Once sensor readings land here, you’ll get time-in-range, sync status, and pattern detection.</Text>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <GlassCard intensity={26} padding={22} style={styles.heroCard}>
        <Text style={styles.eyebrow}>CGM</Text>
        <View style={styles.currentRow}>
          <View style={styles.currentValueBlock}>
            <Text style={[styles.currentValue, { color: currentStatus?.color ?? MD_TEXT }]}>
              {Math.round(latestReading?.value ?? 0)}
            </Text>
            <Text style={styles.currentUnit}>mg/dL</Text>
          </View>
          <View style={styles.currentMeta}>
            <Text style={styles.trendGlyph}>{TREND_LABELS[trend]}</Text>
            <Text style={styles.currentMetaText}>{currentStatus?.label ?? 'Awaiting data'}</Text>
            <Text style={styles.currentMetaSub}>{latestReading ? formatRelativeTime(latestReading.measuredAt) : '--'}</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Time in Range" />
        <GlassCard intensity={16} padding={18} style={styles.tirCard}>
          <View style={styles.tirTop}>
            <DonutGauge
              aboveRange={stats.timeAboveRange}
              belowRange={stats.timeBelowRange}
              inRange={stats.timeInRange}
            />
            <View style={styles.tirSummary}>
              <View style={styles.tirSummaryRow}>
                <Text style={styles.tirSummaryLabel}>In range</Text>
                <Text style={[styles.tirSummaryValue, { color: MD_GLUCOSE_STATUS.normal }]}>{tir.inRange}%</Text>
              </View>
              <View style={styles.tirSummaryRow}>
                <Text style={styles.tirSummaryLabel}>Below range</Text>
                <Text style={[styles.tirSummaryValue, { color: MD_GLUCOSE_STATUS.low }]}>{tir.veryLow + tir.low}%</Text>
              </View>
              <View style={styles.tirSummaryRow}>
                <Text style={styles.tirSummaryLabel}>Above range</Text>
                <Text style={[styles.tirSummaryValue, { color: '#FF8A6B' }]}>{tir.high + tir.veryHigh}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Average</Text>
              <Text style={styles.metricValue}>{stats.averageGlucose.toFixed(0)}</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>GMI</Text>
              <Text style={styles.metricValue}>{stats.gmi.toFixed(1)}%</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>CV</Text>
              <Text style={styles.metricValue}>{stats.cv.toFixed(1)}%</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricLabel}>Readings</Text>
              <Text style={styles.metricValue}>{stats.readingCount}</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Period" />
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((option) => {
            const active = option.hours === periodHours;
            return (
              <Pressable
                key={option.label}
                onPress={() => setPeriodHours(option.hours)}
                style={[styles.periodPill, active ? styles.periodPillActive : null]}
              >
                <Text style={[styles.periodText, active ? styles.periodTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Ambulatory Glucose Profile" />
        <GlassCard intensity={16} padding={18}>
          <CGMChart events={events} readings={periodReadings} />
          <View style={styles.eventLegend}>
            <Text style={styles.eventLegendText}>Markers: M meal • E exercise • I insulin</Text>
          </View>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Device Sync Status" />
        <GlassCard intensity={14} padding={18} style={styles.syncCard}>
          <View style={styles.syncRow}>
            <View>
              <Text style={styles.syncTitle}>{latestReading?.deviceName ?? 'Connected sensor'}</Text>
              <Text style={styles.syncBody}>
                {estimateSensorExpiry(latestReading?.deviceName ?? null, allReadings)}
              </Text>
            </View>
            <Pressable onPress={handleSyncNow} style={styles.syncButton}>
              <Text style={styles.syncButtonText}>Sync now</Text>
            </Pressable>
          </View>
          <Text style={styles.syncMeta}>
            Last sync {syncState?.lastSyncAt ? formatRelativeTime(syncState.lastSyncAt) : 'not recorded'} • {syncState?.readingsSynced ?? allReadings.length} readings indexed
          </Text>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Alert Thresholds" />
        <GlassCard intensity={14} padding={18} style={styles.thresholdCard}>
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>Low threshold</Text>
            <View style={styles.thresholdControls}>
              <Pressable onPress={() => adjustThreshold('low', -5)} style={styles.thresholdButton}>
                <Text style={styles.thresholdButtonText}>−5</Text>
              </Pressable>
              <Text style={styles.thresholdValue}>{lowThreshold} mg/dL</Text>
              <Pressable onPress={() => adjustThreshold('low', 5)} style={styles.thresholdButton}>
                <Text style={styles.thresholdButtonText}>+5</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>High threshold</Text>
            <View style={styles.thresholdControls}>
              <Pressable onPress={() => adjustThreshold('high', -5)} style={styles.thresholdButton}>
                <Text style={styles.thresholdButtonText}>−5</Text>
              </Pressable>
              <Text style={styles.thresholdValue}>{highThreshold} mg/dL</Text>
              <Pressable onPress={() => adjustThreshold('high', 5)} style={styles.thresholdButton}>
                <Text style={styles.thresholdButtonText}>+5</Text>
              </Pressable>
            </View>
          </View>
          <Pressable onPress={toggleRapidAlerts} style={[styles.rapidToggle, rapidAlertsEnabled ? styles.rapidToggleActive : null]}>
            <MaterialSymbol color={rapidAlertsEnabled ? '#041317' : MD_ACCENT_LIGHT} filled={rapidAlertsEnabled} name="notifications" size={18} />
            <Text style={[styles.rapidToggleText, rapidAlertsEnabled ? styles.rapidToggleTextActive : null]}>
              Rapid change alerts {rapidAlertsEnabled ? 'on' : 'off'}
            </Text>
          </Pressable>
        </GlassCard>
      </View>

      <View style={styles.sectionWrap}>
        <SectionHeader title="Pattern Detection" />
        <GlassCard intensity={14} padding={18} style={styles.patternCard}>
          {patterns.map((pattern) => (
            <View key={pattern} style={styles.patternRow}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="trending_up" size={16} />
              <Text style={styles.patternText}>{pattern}</Text>
            </View>
          ))}
        </GlassCard>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: withAlpha(MD_SURFACES.lowest, 0.72),
    borderRadius: 24,
    gap: 18,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  currentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  currentValueBlock: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  currentValue: {
    fontFamily: MD_FONTS.extraBold,
    fontSize: 72,
    fontVariant: ['tabular-nums'],
    lineHeight: 78,
  },
  currentUnit: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    marginBottom: 10,
  },
  currentMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  trendGlyph: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 34,
    lineHeight: 38,
  },
  currentMetaText: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  currentMetaSub: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  sectionWrap: {
    gap: 14,
  },
  tirCard: {
    gap: 16,
  },
  tirTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  donutWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  donutCenterValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  donutCenterLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  tirSummary: {
    flex: 1,
    gap: 10,
  },
  tirSummaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tirSummaryLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  tirSummaryValue: {
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    flex: 1,
    minWidth: '45%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metricLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginBottom: 6,
  },
  metricValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  periodPill: {
    backgroundColor: withAlpha(MD_TEXT_SECONDARY, 0.08),
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  periodPillActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
  },
  periodText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
  },
  periodTextActive: {
    color: '#041317',
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  chartEmptyText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  eventLegend: {
    marginTop: 8,
  },
  eventLegendText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  syncCard: {
    gap: 10,
  },
  syncRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  syncBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 2,
  },
  syncMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  syncButton: {
    backgroundColor: withAlpha(MD_ACCENT, 0.16),
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  syncButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  thresholdCard: {
    gap: 14,
  },
  thresholdRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  thresholdLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    flex: 1,
  },
  thresholdControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  thresholdButton: {
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  thresholdButtonText: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  thresholdValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
    minWidth: 84,
    textAlign: 'center',
  },
  rapidToggle: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rapidToggleActive: {
    backgroundColor: withAlpha(MD_ACCENT, 0.92),
  },
  rapidToggleText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  rapidToggleTextActive: {
    color: '#041317',
  },
  patternCard: {
    gap: 12,
  },
  patternRow: {
    flexDirection: 'row',
    gap: 10,
  },
  patternText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 24,
    gap: 10,
    marginTop: 32,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    textAlign: 'center',
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
});

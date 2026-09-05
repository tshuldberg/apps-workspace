import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import {
  GlassCard,
  MaterialSymbol,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  getRecordingsByTrail,
  getTrail,
  getWaypointsByRecording,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  buildElevationSamples,
  createTrackSummary,
  expandBounds,
  formatDistanceLabel,
  formatElevationLabel,
  formatGradeLabel,
  getGeoBounds,
  gradeColor,
  projectCoordinate,
  projectTrackPoints,
  summarizeTerrain,
} from './phase4-utils';

const MAP_WIDTH = 320;
const MAP_HEIGHT = 220;
const CHART_HEIGHT = 280;
const CHART_PADDING = 24;

type SlopeSegment = {
  startDistanceMeters: number;
  endDistanceMeters: number;
  elevationMeters: number;
  averageGrade: number;
};

function buildSlopeSegments(
  samples: ReturnType<typeof buildElevationSamples>,
  direction: 'climb' | 'descent',
): SlopeSegment[] {
  const segments: SlopeSegment[] = [];
  let activeStart = -1;

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index];
    const isMatch = direction === 'climb'
      ? sample.gradePercent >= 4
      : sample.gradePercent <= -4;

    if (isMatch && activeStart === -1) {
      activeStart = index - 1;
    }

    const nextSample = samples[index + 1];
    const nextMatches = nextSample
      ? direction === 'climb'
        ? nextSample.gradePercent >= 4
        : nextSample.gradePercent <= -4
      : false;

    if (activeStart !== -1 && !nextMatches) {
      const slice = samples.slice(activeStart, index + 1);
      const first = slice[0];
      const last = slice.at(-1)!;
      const elevationMeters = Math.abs(last.elevationMeters - first.elevationMeters);
      const averageGrade = slice.reduce((total, entry) => total + entry.gradePercent, 0) / slice.length;
      segments.push({
        startDistanceMeters: first.cumulativeDistanceMeters,
        endDistanceMeters: last.cumulativeDistanceMeters,
        elevationMeters,
        averageGrade,
      });
      activeStart = -1;
    }
  }

  return segments
    .sort((left, right) => right.elevationMeters - left.elevationMeters)
    .slice(0, 3);
}

export default function ElevationProfileScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { trailId, recordingId } = useLocalSearchParams<{
    trailId?: string;
    recordingId?: string;
  }>();
  const [chartWidth, setChartWidth] = useState(0);
  const [cursorIndex, setCursorIndex] = useState(0);

  const activeRecordingId = useMemo(() => {
    if (recordingId) return recordingId;
    if (!trailId) return null;
    return getRecordingsByTrail(db, trailId)[0]?.id ?? null;
  }, [db, recordingId, trailId]);

  const waypoints = useMemo(
    () => (activeRecordingId ? getWaypointsByRecording(db, activeRecordingId) : []),
    [activeRecordingId, db],
  );
  const trail = useMemo(
    () => (trailId ? getTrail(db, trailId) : null),
    [db, trailId],
  );

  const samples = useMemo(() => buildElevationSamples(waypoints), [waypoints]);
  const summary = useMemo(
    () => createTrackSummary(waypoints, 0),
    [waypoints],
  );
  const terrain = useMemo(() => summarizeTerrain(samples), [samples]);
  const climbs = useMemo(() => buildSlopeSegments(samples, 'climb'), [samples]);
  const descents = useMemo(() => buildSlopeSegments(samples, 'descent'), [samples]);

  const mapBounds = useMemo(
    () => expandBounds(getGeoBounds(waypoints)),
    [waypoints],
  );
  const mapPoints = useMemo(
    () => projectTrackPoints(waypoints, MAP_WIDTH, MAP_HEIGHT, 18, mapBounds),
    [mapBounds, waypoints],
  );

  const projectedChart = useMemo(() => {
    if (samples.length === 0 || chartWidth <= 0) {
      return [];
    }

    const minElevation = Math.min(...samples.map((sample) => sample.elevationMeters));
    const maxElevation = Math.max(...samples.map((sample) => sample.elevationMeters));
    const elevationRange = Math.max(maxElevation - minElevation, 1);
    const usableWidth = Math.max(chartWidth - CHART_PADDING * 2, 1);
    const usableHeight = CHART_HEIGHT - CHART_PADDING * 2;
    const totalDistanceMeters = samples.at(-1)?.cumulativeDistanceMeters ?? 1;

    return samples.map((sample) => {
      const x = CHART_PADDING + (sample.cumulativeDistanceMeters / totalDistanceMeters) * usableWidth;
      const y = CHART_PADDING + (1 - (sample.elevationMeters - minElevation) / elevationRange) * usableHeight;
      return { ...sample, x, y };
    });
  }, [chartWidth, samples]);

  const clampedCursorIndex = Math.min(cursorIndex, Math.max(projectedChart.length - 1, 0));
  const cursorPoint = projectedChart[clampedCursorIndex] ?? null;

  const handleChartLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  const moveCursor = (locationX: number) => {
    if (projectedChart.length <= 1 || chartWidth <= 0) {
      return;
    }

    const ratio = Math.max(0, Math.min(1, locationX / chartWidth));
    const nextIndex = Math.round(ratio * (projectedChart.length - 1));
    setCursorIndex(nextIndex);
  };

  if (samples.length === 0) {
    return (
      <View style={styles.emptyState}>
        <RNText style={styles.emptyEmoji}>📈</RNText>
        <RNText style={styles.emptyTitle}>No elevation data</RNText>
        <RNText style={styles.emptyCopy}>Record a trail session with GPS samples to populate the profile view.</RNText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialSymbol name="arrow_back" size={20} color={TR_ACCENT_LIGHT} />
            <RNText style={styles.brandLabel}>MYTRAILS</RNText>
          </Pressable>
          <Pressable onPress={() => router.push('/(trails)/offline-regions')} style={styles.iconButton}>
            <MaterialSymbol name="download_for_offline" size={18} color={TR_TEXT_TERTIARY} />
          </Pressable>
        </View>

        <View style={styles.heroHeader}>
          <View>
            <RNText style={styles.heroEyebrow}>Current Session</RNText>
            <RNText style={styles.heroTitle}>{trail?.name ?? 'Elevation Profile'}</RNText>
          </View>
          <View style={styles.heroStat}>
            <RNText style={styles.heroStatValue}>{Math.round(summary.maxElevationMeters)}</RNText>
            <RNText style={styles.heroStatUnit}>m max</RNText>
          </View>
        </View>

        <View style={styles.statsRow}>
          <ProfileStat label="Start" value={formatElevationLabel(summary.startElevationMeters)} />
          <ProfileStat label="Max" value={formatElevationLabel(summary.maxElevationMeters)} />
          <ProfileStat label="End" value={formatElevationLabel(summary.endElevationMeters)} />
          <ProfileStat label="Gain" value={formatElevationLabel(summary.elevationGainMeters)} />
          <ProfileStat label="Loss" value={formatElevationLabel(summary.elevationLossMeters)} />
        </View>

        <GlassCard padding={18} style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Elevation Profile</RNText>
            <RNText style={styles.cardCaption}>Gradient %</RNText>
          </View>

          <View
            style={styles.chartTouchArea}
            onLayout={handleChartLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => moveCursor(event.nativeEvent.locationX)}
            onResponderMove={(event) => moveCursor(event.nativeEvent.locationX)}
          >
            <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${Math.max(chartWidth, 1)} ${CHART_HEIGHT}`}>
              {projectedChart.slice(1).map((sample, index) => {
                const previous = projectedChart[index];
                return (
                  <Line
                    key={`${sample.cumulativeDistanceMeters}-${sample.elevationMeters}`}
                    x1={previous.x}
                    y1={previous.y}
                    x2={sample.x}
                    y2={sample.y}
                    stroke={gradeColor(sample.gradePercent)}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                );
              })}

              {cursorPoint ? (
                <>
                  <Line
                    x1={cursorPoint.x}
                    x2={cursorPoint.x}
                    y1={0}
                    y2={CHART_HEIGHT}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="6 6"
                    strokeWidth={1}
                  />
                  <Circle cx={cursorPoint.x} cy={cursorPoint.y} r={6} fill={TR_ACCENT_LIGHT} stroke="#FFFFFF" strokeWidth={2} />
                </>
              ) : null}

              <SvgText x={10} y={20} fill={TR_TEXT_TERTIARY} fontSize={10} fontWeight="700">
                {Math.round(summary.maxElevationMeters)}m
              </SvgText>
              <SvgText x={10} y={CHART_HEIGHT - 10} fill={TR_TEXT_TERTIARY} fontSize={10} fontWeight="700">
                {Math.round(summary.startElevationMeters)}m
              </SvgText>
            </Svg>

            {cursorPoint ? (
              <GlassCard padding={12} style={[styles.cursorBadge, { left: Math.max(12, Math.min((cursorPoint.x / Math.max(chartWidth, 1)) * chartWidth - 58, Math.max(chartWidth - 126, 12))) }]}>
                <RNText style={styles.cursorBadgeLabel}>{formatDistanceLabel(cursorPoint.cumulativeDistanceMeters)}</RNText>
                <RNText style={styles.cursorBadgeValue}>{Math.round(cursorPoint.elevationMeters)} m</RNText>
                <RNText style={[styles.cursorBadgeGrade, { color: gradeColor(cursorPoint.gradePercent) }]}>
                  {formatGradeLabel(cursorPoint.gradePercent)}
                </RNText>
              </GlassCard>
            ) : null}
          </View>

          <View style={styles.axisRow}>
            <RNText style={styles.axisLabel}>0 km</RNText>
            <RNText style={styles.axisLabel}>{formatDistanceLabel((samples.at(-1)?.cumulativeDistanceMeters ?? 0) * 0.25)}</RNText>
            <RNText style={styles.axisLabel}>{formatDistanceLabel((samples.at(-1)?.cumulativeDistanceMeters ?? 0) * 0.5)}</RNText>
            <RNText style={styles.axisLabel}>{formatDistanceLabel((samples.at(-1)?.cumulativeDistanceMeters ?? 0) * 0.75)}</RNText>
            <RNText style={styles.axisLabel}>{formatDistanceLabel(samples.at(-1)?.cumulativeDistanceMeters ?? 0)}</RNText>
          </View>
        </GlassCard>

        {cursorPoint ? (
          <GlassCard padding={18} style={styles.cursorCard}>
            <View style={styles.cardHeader}>
              <RNText style={styles.cardTitle}>Cursor Detail</RNText>
            </View>
            <View style={styles.cursorGrid}>
              <CursorMetric label="Distance" value={formatDistanceLabel(cursorPoint.cumulativeDistanceMeters)} />
              <CursorMetric label="Elevation" value={formatElevationLabel(cursorPoint.elevationMeters)} />
              <CursorMetric label="Grade" value={formatGradeLabel(cursorPoint.gradePercent)} />
              <CursorMetric label="Gain So Far" value={formatElevationLabel(cursorPoint.cumulativeGainMeters)} />
            </View>
          </GlassCard>
        ) : null}

        <GlassCard padding={18} style={styles.mapCard}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Map Preview</RNText>
          </View>
          <View style={styles.mapPreview}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}>
              <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill={TR_SURFACES.low} />
              {mapPoints.length > 1 ? (
                <Polyline
                  points={mapPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={TR_ACCENT_LIGHT}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {cursorPoint ? (
                (() => {
                  const mapPoint = projectCoordinate(cursorPoint, mapBounds, MAP_WIDTH, MAP_HEIGHT, 18);
                  return (
                    <>
                      <Circle cx={mapPoint.x} cy={mapPoint.y} r={14} fill="rgba(132,204,22,0.18)" />
                      <Circle cx={mapPoint.x} cy={mapPoint.y} r={5} fill={TR_ACCENT_LIGHT} />
                    </>
                  );
                })()
              ) : null}
            </Svg>
          </View>
        </GlassCard>

        <View style={styles.terrainGrid}>
          <ProfileSummaryCard
            label="Total Gain"
            value={formatElevationLabel(summary.elevationGainMeters)}
            hint={summary.elevationGainMeters > 0 ? 'Climbing profile' : 'Flat profile'}
            accent={TR_ACCENT_LIGHT}
          />
          <ProfileSummaryCard
            label="Total Loss"
            value={formatElevationLabel(summary.elevationLossMeters)}
            hint="Descent across route"
            accent={TR_TEXT}
          />
          <ProfileSummaryCard
            label="Avg Grade"
            value={formatGradeLabel(summary.maxGradePercent > 0 ? summary.maxGradePercent / 2 : 0)}
            hint="Steepest half-segment"
            accent={TR_ACCENT}
          />
        </View>

        <GlassCard padding={18} style={styles.cardStack}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Terrain Breakdown</RNText>
          </View>
          <View style={styles.bucketStack}>
            {terrain.map((bucket) => (
              <View key={bucket.label} style={styles.bucketRow}>
                <View style={[styles.bucketIconWrap, { backgroundColor: `${bucket.color}18` }]}>
                  <MaterialSymbol name={bucket.icon} size={18} color={bucket.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <RNText style={styles.bucketTitle}>{bucket.label}</RNText>
                  <RNText style={styles.bucketHint}>{bucket.hint}</RNText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <RNText style={styles.bucketDistance}>{formatDistanceLabel(bucket.distanceMeters)}</RNText>
                  <RNText style={[styles.bucketShare, { color: bucket.color }]}>
                    {Math.round(bucket.share * 100)}% of trail
                  </RNText>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.cardStack}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Climbs</RNText>
          </View>
          <View style={styles.segmentStack}>
            {climbs.length === 0 ? (
              <RNText style={styles.emptyInlineCopy}>No sustained climbs were detected.</RNText>
            ) : climbs.map((segment, index) => (
              <SlopeRow key={`${segment.startDistanceMeters}-${segment.endDistanceMeters}`} index={index + 1} segment={segment} />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={18} style={styles.cardStack}>
          <View style={styles.cardHeader}>
            <RNText style={styles.cardTitle}>Descents</RNText>
          </View>
          <View style={styles.segmentStack}>
            {descents.length === 0 ? (
              <RNText style={styles.emptyInlineCopy}>No sustained descents were detected.</RNText>
            ) : descents.map((segment, index) => (
              <SlopeRow key={`${segment.startDistanceMeters}-${segment.endDistanceMeters}`} index={index + 1} segment={segment} />
            ))}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard padding={12} style={styles.profileStat}>
      <RNText style={styles.profileStatLabel}>{label}</RNText>
      <RNText style={styles.profileStatValue}>{value}</RNText>
    </GlassCard>
  );
}

function CursorMetric({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard padding={12} style={styles.cursorMetric}>
      <RNText style={styles.profileStatLabel}>{label}</RNText>
      <RNText style={styles.cursorMetricValue}>{value}</RNText>
    </GlassCard>
  );
}

function ProfileSummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
}) {
  return (
    <GlassCard padding={18} style={styles.summaryCard}>
      <RNText style={styles.profileStatLabel}>{label}</RNText>
      <RNText style={[styles.summaryValue, { color: accent }]}>{value}</RNText>
      <RNText style={styles.summaryHint}>{hint}</RNText>
      <View style={styles.summaryTrack}>
        <View style={[styles.summaryFill, { backgroundColor: accent }]} />
      </View>
    </GlassCard>
  );
}

function SlopeRow({ index, segment }: { index: number; segment: SlopeSegment }) {
  return (
    <View style={styles.slopeRow}>
      <View style={styles.slopeIndex}>
        <RNText style={styles.slopeIndexText}>{index}</RNText>
      </View>
      <View style={{ flex: 1 }}>
        <RNText style={styles.slopeTitle}>
          {formatDistanceLabel(segment.startDistanceMeters)} to {formatDistanceLabel(segment.endDistanceMeters)}
        </RNText>
        <RNText style={styles.slopeHint}>
          {formatElevationLabel(segment.elevationMeters)} · avg {formatGradeLabel(segment.averageGrade)}
        </RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: spacing.xxl,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: TR_ACCENT_LIGHT,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: TR_ACCENT_LIGHT,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 34,
    color: TR_TEXT,
    lineHeight: 38,
  },
  heroStat: {
    alignItems: 'flex-end',
  },
  heroStatValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 30,
    color: TR_ACCENT_LIGHT,
  },
  heroStatUnit: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: TR_TEXT_TERTIARY,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  profileStat: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  profileStatLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    color: TR_TEXT_TERTIARY,
    marginBottom: 6,
  },
  profileStatValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 16,
    color: TR_TEXT,
  },
  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: TR_FONTS.bold,
    fontSize: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: TR_TEXT_SECONDARY,
  },
  cardCaption: {
    fontFamily: TR_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: TR_TEXT_TERTIARY,
  },
  chartTouchArea: {
    height: CHART_HEIGHT,
    marginTop: 16,
  },
  cursorBadge: {
    position: 'absolute',
    top: 10,
    width: 116,
    backgroundColor: 'rgba(34,34,40,0.92)',
  },
  cursorBadgeLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: TR_TEXT_TERTIARY,
  },
  cursorBadgeValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 20,
    color: TR_TEXT,
  },
  cursorBadgeGrade: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  axisLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 10,
    color: TR_TEXT_TERTIARY,
  },
  cursorCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cursorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  cursorMetric: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  cursorMetricValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 18,
    color: TR_TEXT,
  },
  mapCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mapPreview: {
    marginTop: 14,
    height: MAP_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  terrainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 28,
  },
  summaryHint: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    color: TR_TEXT_TERTIARY,
    marginTop: 8,
  },
  summaryTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 14,
    overflow: 'hidden',
  },
  summaryFill: {
    width: '58%',
    height: '100%',
    borderRadius: 999,
  },
  cardStack: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bucketStack: {
    gap: 10,
    marginTop: 14,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bucketIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketTitle: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 15,
    color: TR_TEXT,
  },
  bucketHint: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    color: TR_TEXT_SECONDARY,
  },
  bucketDistance: {
    fontFamily: TR_FONTS.bold,
    fontSize: 14,
    color: TR_TEXT,
  },
  bucketShare: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
  },
  segmentStack: {
    gap: 10,
    marginTop: 14,
  },
  slopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  slopeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(132,204,22,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slopeIndexText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    color: TR_ACCENT_LIGHT,
  },
  slopeTitle: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 14,
    color: TR_TEXT,
  },
  slopeHint: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    color: TR_TEXT_SECONDARY,
  },
  emptyInlineCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    color: TR_TEXT_TERTIARY,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_SURFACES.lowest,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 24,
    color: TR_TEXT,
  },
  emptyCopy: {
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
});

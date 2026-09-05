import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  calculateElevationGain,
  calculatePace,
  calculateSpeed,
  calculateTotalDistance,
  completeGpsRoute,
  createGpsRoute,
  formatPace,
  getGpsPoints,
  getGpsRoutes,
  insertGpsPoints,
  type GpsActivityType,
  type GpsPoint,
  type GpsPointInput,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import { WorkoutHero, WorkoutPrimaryButton, WorkoutSecondaryButton } from './(tabs)/_screen-kit';

const ACTIVITY_TYPES: GpsActivityType[] = ['run', 'walk', 'cycle', 'hike'];

const ACTIVITY_STEP_METERS: Record<GpsActivityType, number> = {
  run: 22,
  walk: 8,
  cycle: 36,
  hike: 12,
  other: 10,
};

function metersToLat(meters: number): number {
  return meters / 111_111;
}

function metersToLon(meters: number, latitude: number): number {
  return meters / (111_111 * Math.cos((latitude * Math.PI) / 180));
}

function buildNextSimPoint(
  activityType: GpsActivityType,
  previous: GpsPointInput | null,
  stepIndex: number,
): GpsPointInput {
  const baseLatitude = previous?.latitude ?? 37.7749;
  const baseLongitude = previous?.longitude ?? -122.4194;
  const stepMeters = ACTIVITY_STEP_METERS[activityType] ?? 10;
  const angle = stepIndex * 0.42;
  const lat = baseLatitude + metersToLat(Math.cos(angle) * stepMeters);
  const lon = baseLongitude + metersToLon(Math.sin(angle) * stepMeters, baseLatitude);
  const altitude = (previous?.altitudeMeters ?? 18) + Math.sin(stepIndex / 3) * 1.6;

  return {
    latitude: lat,
    longitude: lon,
    altitudeMeters: altitude,
    speedMps: stepMeters / 5,
    accuracyMeters: 6,
    timestampMs: Date.now(),
    segment: 0,
  };
}

function buildPolylinePoints(points: GpsPoint[]): string {
  if (points.length === 0) return '160,160';

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = maxLat - minLat || 0.001;
  const lonRange = maxLon - minLon || 0.001;

  return points
    .map((point) => {
      const x = 26 + ((point.longitude - minLon) / lonRange) * 268;
      const y = 22 + (1 - (point.latitude - minLat) / latRange) * 276;
      return `${x},${y}`;
    })
    .join(' ');
}

function buildElevationPoints(points: GpsPoint[]): string {
  if (points.length === 0) return '0,110';

  const altitudes = points.map((point) => point.altitudeMeters ?? 0);
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min || 1;

  return altitudes
    .map((altitude, index) => {
      const x = points.length === 1 ? 160 : (index / (points.length - 1)) * 320;
      const y = 110 - ((altitude - min) / range) * 88;
      return `${x},${y}`;
    })
    .join(' ');
}

function buildSplits(points: GpsPoint[], distanceUnit: 'mi' | 'km'): Array<{ label: string; seconds: number }> {
  if (points.length < 2) return [];

  const segmentMeters = distanceUnit === 'mi' ? 1609.34 : 1000;
  let traveled = 0;
  let splitStart = points[0]?.timestampMs ?? 0;
  let nextThreshold = segmentMeters;
  const splits: Array<{ label: string; seconds: number }> = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const step = calculateTotalDistance([previous, current]);
    traveled += step;

    if (traveled >= nextThreshold) {
      const seconds = Math.round((current.timestampMs - splitStart) / 1000);
      splits.push({
        label: `${splits.length + 1} ${distanceUnit}`,
        seconds,
      });
      splitStart = current.timestampMs;
      nextThreshold += segmentMeters;
    }
  }

  return splits;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function GpsScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const [routes, setRoutes] = useState(() => getGpsRoutes(db, undefined, 24));
  const [activityType, setActivityType] = useState<GpsActivityType>('run');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [livePoints, setLivePoints] = useState<GpsPoint[]>([]);
  const [simulatorNoticeShown, setSimulatorNoticeShown] = useState(false);
  const stepIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointsRef.current) clearInterval(pointsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeRouteId || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointsRef.current) clearInterval(pointsRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    pointsRef.current = setInterval(() => {
      setLivePoints((current) => {
        const last = current[current.length - 1];
        const nextPoint = buildNextSimPoint(
          activityType,
          last
            ? {
                latitude: last.latitude,
                longitude: last.longitude,
                altitudeMeters: last.altitudeMeters,
                speedMps: last.speedMps,
                accuracyMeters: last.accuracyMeters,
                timestampMs: last.timestampMs,
                segment: last.segment,
              }
            : null,
          stepIndexRef.current,
        );
        stepIndexRef.current += 1;
        insertGpsPoints(db, activeRouteId, [nextPoint]);
        return getGpsPoints(db, activeRouteId);
      });
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointsRef.current) clearInterval(pointsRef.current);
    };
  }, [activeRouteId, activityType, db, paused]);

  const distanceMeters = useMemo(() => calculateTotalDistance(livePoints), [livePoints]);
  const elevation = useMemo(() => calculateElevationGain(livePoints), [livePoints]);
  const pace = useMemo(() => calculatePace(distanceMeters, elapsedSeconds), [distanceMeters, elapsedSeconds]);
  const speed = useMemo(() => calculateSpeed(distanceMeters, elapsedSeconds), [distanceMeters, elapsedSeconds]);
  const splits = useMemo(() => buildSplits(livePoints, settings.distanceUnit), [livePoints, settings.distanceUnit]);

  const handleStart = () => {
    if (!simulatorNoticeShown) {
      Alert.alert(
        'Simulator Mode',
        'This repo does not have a live location package installed, so MyWorkouts will record a local simulated route and still persist it to the workouts tables.',
      );
      setSimulatorNoticeShown(true);
    }

    const routeId = uuid();
    createGpsRoute(db, routeId, {
      activityType,
      startedAt: new Date().toISOString(),
      name: `${activityType} session`,
    });

    const firstPoint = buildNextSimPoint(activityType, null, 0);
    insertGpsPoints(db, routeId, [firstPoint]);

    stepIndexRef.current = 1;
    setActiveRouteId(routeId);
    setPaused(false);
    setElapsedSeconds(0);
    setLivePoints(getGpsPoints(db, routeId));
  };

  const handleStop = () => {
    if (!activeRouteId) return;

    completeGpsRoute(db, activeRouteId, {
      distanceMeters,
      durationSeconds: elapsedSeconds,
      elevationGainMeters: elevation.gain,
      elevationLossMeters: elevation.loss,
      avgPaceSecPerKm: pace,
      avgSpeedKmh: speed,
      maxSpeedKmh: speed,
      caloriesEstimated: Math.round((distanceMeters / 1000) * 55),
      completedAt: new Date().toISOString(),
    });

    setRoutes(getGpsRoutes(db, undefined, 24));
    setActiveRouteId(null);
    setPaused(false);
    setElapsedSeconds(0);
    setLivePoints([]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        eyebrow="GPS Surface"
        title="GPS Workout"
        subtitle="Track a route, watch pace and elevation change live, and persist every point directly into the workouts module."
        accent={WK_ACCENT_LIGHT}
        action={
          <View style={styles.simulatorBadge}>
            <MaterialSymbol name="route" size={16} color={WK_ACCENT_LIGHT} />
            <Text style={styles.simulatorText}>Simulator</Text>
          </View>
        }
      />

      <View style={styles.chipRow}>
        {ACTIVITY_TYPES.map((entry) => (
          <Chip
            key={entry}
            label={entry}
            selected={activityType === entry}
            onPress={() => setActivityType(entry)}
          />
        ))}
      </View>

      <GlassPanel style={styles.mapPanel} intensity={54}>
        <View style={styles.statsOverlay}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Time</Text>
            <Text style={styles.statPillValue}>{formatDuration(elapsedSeconds)}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Distance</Text>
            <Text style={styles.statPillValue}>
              {(distanceMeters / (settings.distanceUnit === 'mi' ? 1609.34 : 1000)).toFixed(2)} {settings.distanceUnit}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Pace</Text>
            <Text style={styles.statPillValue}>{pace ? `${formatPace(pace)} / km` : '--'}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Gain</Text>
            <Text style={styles.statPillValue}>{Math.round(elevation.gain)} m</Text>
          </View>
        </View>

        <Svg width="100%" height={340} viewBox="0 0 320 320">
          <Rect x={0} y={0} width={320} height={320} rx={26} fill="#11131B" />
          <Line x1={36} x2={284} y1={48} y2={272} stroke="rgba(255,255,255,0.04)" strokeWidth={22} />
          <Line x1={284} x2={40} y1={58} y2={262} stroke="rgba(255,255,255,0.03)" strokeWidth={18} />
          <Polyline
            points={buildPolylinePoints(livePoints)}
            fill="none"
            stroke={WK_ACCENT_LIGHT}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {livePoints.length > 0 ? (() => {
            const [x, y] = buildPolylinePoints(livePoints).split(' ').slice(-1)[0]?.split(',').map(Number) ?? [160, 160];
            return <Circle cx={x} cy={y} r={8} fill="#F4EEE8" />;
          })() : (
            <Circle cx={160} cy={160} r={8} fill="#F4EEE8" />
          )}
        </Svg>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Elevation</Text>
        <Svg width="100%" height={140} viewBox="0 0 320 120">
          <Line x1={0} x2={320} y1={110} y2={110} stroke="rgba(214, 195, 181, 0.12)" strokeWidth={1} />
          <Polyline
            points={buildElevationPoints(livePoints)}
            fill="none"
            stroke={WK_ACCENT_LIGHT}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Pace Splits</Text>
        {splits.map((split) => (
          <View key={split.label} style={styles.splitRow}>
            <Text style={styles.splitLabel}>{split.label}</Text>
            <Text style={styles.splitValue}>{formatDuration(split.seconds)}</Text>
          </View>
        ))}
        {!splits.length ? (
          <Text style={styles.emptyCopy}>
            Start a route and let it travel far enough to generate split markers.
          </Text>
        ) : null}
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Recent Routes</Text>
        {routes.map((route) => (
          <View key={route.id} style={styles.routeRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.routeTitle}>{route.name ?? route.activityType}</Text>
              <Text style={styles.routeMeta}>
                {route.startedAt.slice(0, 10)} • {(route.distanceMeters / 1000).toFixed(2)} km • {Math.round(route.durationSeconds / 60)} min
              </Text>
            </View>
            <Text style={styles.routeTag}>{route.activityType}</Text>
          </View>
        ))}
        {!routes.length ? (
          <Text style={styles.emptyCopy}>
            No saved routes yet. The first recorded simulation will appear here.
          </Text>
        ) : null}
      </GlassPanel>

      <View style={styles.controlsRow}>
        {!activeRouteId ? (
          <WorkoutPrimaryButton label="Start Route" icon="play_arrow" onPress={handleStart} />
        ) : (
          <>
            <WorkoutSecondaryButton
              label={paused ? 'Resume' : 'Pause'}
              icon={paused ? 'play_arrow' : 'pause'}
              onPress={() => setPaused((current) => !current)}
            />
            <WorkoutPrimaryButton label="End Route" icon="flag" onPress={handleStop} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  simulatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  simulatorText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
  },
  mapPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  statsOverlay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statPill: {
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 2,
  },
  statPillLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.58)',
  },
  statPillValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#FFF3E7',
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  splitLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  splitValue: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: WK_ACCENT_LIGHT,
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  routeTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#F4EEE8',
    textTransform: 'capitalize',
  },
  routeMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  routeTag: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
});

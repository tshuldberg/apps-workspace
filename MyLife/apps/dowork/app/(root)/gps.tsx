import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
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
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { getWorkoutPhaseOneSettings } from '../../lib/workouts/settings';
import {
  createLocationPositionSource,
  createSimulatedPositionSource,
  type GpsFix,
  type PositionSource,
  type PositionStartFailure,
} from '../../lib/gps/position-source';
import { METERS_PER_MILE, paceForUnit } from '../../lib/gps/pace';
import { DW_ACCENT, DW_ACCENT_LIGHT, DW_BORDER, DW_FEEDBACK, DW_TEXT } from './theme/tokens';
import { WorkoutHero, WorkoutPrimaryButton } from './(tabs)/_screen-kit';

// RN global. Bare identifier so Metro strips the simulator branches from
// production bundles; declared locally because this app's tsconfig scopes types
// to react only.
declare const __DEV__: boolean;

const KEEP_AWAKE_TAG = 'dowork-gps';

function WorkoutSecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && { opacity: 0.86 },
        disabled && { opacity: 0.4 },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const ACTIVITY_TYPES: GpsActivityType[] = ['run', 'walk', 'cycle', 'hike'];

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
  // Unknown altitude must not chart as a fake drop to 0 m: the profile is
  // drawn from altitude-known points only, and stays empty until at least two
  // real samples exist (the panel shows an honest placeholder instead).
  const altitudes = points
    .map((point) => point.altitudeMeters)
    .filter((altitude): altitude is number => altitude !== null);
  if (altitudes.length < 2) return '';

  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min || 1;

  return altitudes
    .map((altitude, index) => {
      const x = (index / (altitudes.length - 1)) * 320;
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

function errorTitle(reason: PositionStartFailure['reason']): string {
  switch (reason) {
    case 'denied':
      return 'Location access is off';
    case 'unavailable':
      return 'Location is unavailable';
    case 'error':
      return "Couldn't start GPS";
  }
}

export default function GpsScreen() {
  const db = useDatabase();
  const settings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const [routes, setRoutes] = useState(() => getGpsRoutes(db, undefined, 24));
  const [activityType, setActivityType] = useState<GpsActivityType>('run');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [backgrounded, setBackgrounded] = useState(false);
  const [wasBackgrounded, setWasBackgrounded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [livePoints, setLivePoints] = useState<GpsPoint[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [startError, setStartError] = useState<PositionStartFailure | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);
  const [useSimulator, setUseSimulator] = useState(false);

  const [liveStats, setLiveStats] = useState({ distance: 0, gain: 0, loss: 0 });

  const routeIdRef = useRef<string | null>(null);
  const pausedRef = useRef(false);
  // Rolling metric accumulator so each fix does O(1) work instead of
  // re-reading and re-summing the whole route (final full-accuracy metrics
  // are still computed from every point at stop).
  const rollingRef = useRef({
    lastPoint: null as GpsPoint | null,
    lastAltitude: null as number | null,
    maxSpeedMps: 0,
  });
  const localIdRef = useRef(-1);
  const sourceRef = useRef<PositionSource | null>(null);
  const explainedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Whether the on-simulator fake source is driving the map. Only ever true in
  // development; the __DEV__ guard strips the toggle and this branch in release.
  const showSimulated = __DEV__ && useSimulator;

  // Persist a single fix into the active route, unless paused. The recording
  // math and splits read straight from the re-queried points, unchanged.
  const handleFix = useCallback(
    (fix: GpsFix) => {
      const routeId = routeIdRef.current;
      if (!routeId || pausedRef.current) return;
      insertGpsPoints(db, routeId, [fix]);

      // Append locally instead of re-querying every persisted point per fix.
      const point: GpsPoint = { id: localIdRef.current--, routeId, ...fix };
      setLivePoints((current) => [...current, point]);

      const rolling = rollingRef.current;
      let distanceDelta = 0;
      if (rolling.lastPoint && rolling.lastPoint.segment === point.segment) {
        distanceDelta = calculateTotalDistance([rolling.lastPoint, point]);
      }
      let gainDelta = 0;
      let lossDelta = 0;
      if (point.altitudeMeters !== null) {
        if (rolling.lastAltitude !== null) {
          const diff = point.altitudeMeters - rolling.lastAltitude;
          if (diff > 0) gainDelta = diff;
          else lossDelta = -diff;
        }
        rolling.lastAltitude = point.altitudeMeters;
      }
      if (point.speedMps !== null && point.speedMps > rolling.maxSpeedMps) {
        rolling.maxSpeedMps = point.speedMps;
      }
      rolling.lastPoint = point;
      setLiveStats((current) => ({
        distance: current.distance + distanceDelta,
        gain: current.gain + gainDelta,
        loss: current.loss + lossDelta,
      }));
    },
    [db],
  );

  // Stop any live subscription and drop keep-awake when the screen unmounts.
  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      sourceRef.current = null;
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  // Track app foreground/background so the elapsed clock does not drift ahead
  // of GPS point coverage: foreground-only location tracking stops collecting
  // points while backgrounded, so the timer pauses too instead of running on.
  // Latch wasBackgrounded during an active recording so the UI can be honest
  // that this route has a gap where the app was not in the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const isBackground = nextState !== 'active';
      setBackgrounded(isBackground);
      if (isBackground && routeIdRef.current) setWasBackgrounded(true);
    });
    return () => subscription.remove();
  }, []);

  // Elapsed clock: runs only while recording, not paused, and in the foreground.
  useEffect(() => {
    if (!activeRouteId || paused || backgrounded) return;
    const timer = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [activeRouteId, backgrounded, paused]);

  // Keep the screen awake while actively recording so a foreground-only GPS run
  // is not cut short by the device auto-locking.
  useEffect(() => {
    if (!activeRouteId || paused) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [activeRouteId, paused]);

  const distanceMeters = liveStats.distance;
  const elevation = { gain: liveStats.gain, loss: liveStats.loss };
  const pace = useMemo(() => calculatePace(distanceMeters, elapsedSeconds), [distanceMeters, elapsedSeconds]);
  const speed = useMemo(() => calculateSpeed(distanceMeters, elapsedSeconds), [distanceMeters, elapsedSeconds]);
  const splits = useMemo(() => buildSplits(livePoints, settings.distanceUnit), [livePoints, settings.distanceUnit]);

  const beginRecording = useCallback(async () => {
    setStartError(null);
    setRequesting(true);

    const source = showSimulated
      ? createSimulatedPositionSource({ activityType })
      : createLocationPositionSource(Location);
    sourceRef.current = source;

    // Start the source first; only persist a route once it is actually running,
    // so a denied permission never leaves an empty route in the history.
    const result = await source.start(handleFix);
    if (!result.ok) {
      source.stop();
      sourceRef.current = null;
      setRequesting(false);
      setStartError(result);
      return;
    }

    const routeId = uuid();
    createGpsRoute(db, routeId, {
      activityType,
      startedAt: new Date().toISOString(),
      name: `${activityType} session`,
    });
    routeIdRef.current = routeId;

    setActiveRouteId(routeId);
    setPaused(false);
    setWasBackgrounded(false);
    setElapsedSeconds(0);
    setLivePoints(getGpsPoints(db, routeId));
    setLiveStats({ distance: 0, gain: 0, loss: 0 });
    rollingRef.current = { lastPoint: null, lastAltitude: null, maxSpeedMps: 0 };
    setRequesting(false);
  }, [activityType, db, handleFix, showSimulated]);

  const handleStartPress = useCallback(() => {
    // The simulator needs no OS permission; start it straight away (the
    // SIMULATED badge makes its use obvious).
    if (showSimulated) {
      void beginRecording();
      return;
    }
    // Explain why we need location once, before the OS prompt.
    if (!explainedRef.current) {
      setShowExplainer(true);
      return;
    }
    void beginRecording();
  }, [beginRecording, showSimulated]);

  const handleEnableFromSheet = useCallback(() => {
    explainedRef.current = true;
    setShowExplainer(false);
    void beginRecording();
  }, [beginRecording]);

  const handleStop = useCallback(() => {
    const routeId = routeIdRef.current;
    sourceRef.current?.stop();
    sourceRef.current = null;
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    if (!routeId) return;

    // Final metrics come from the full point history (the rolling live stats
    // are display approximations); max speed is the fastest valid GPS speed
    // sample, falling back to the average only when no samples exist.
    const finalDistance = calculateTotalDistance(livePoints);
    const finalElevation = calculateElevationGain(livePoints);
    const finalPace = calculatePace(finalDistance, elapsedSeconds);
    const finalSpeed = calculateSpeed(finalDistance, elapsedSeconds);
    const maxSpeedKmh =
      rollingRef.current.maxSpeedMps > 0
        ? Math.round(rollingRef.current.maxSpeedMps * 3.6 * 100) / 100
        : finalSpeed;

    completeGpsRoute(db, routeId, {
      distanceMeters: finalDistance,
      durationSeconds: elapsedSeconds,
      elevationGainMeters: finalElevation.gain,
      elevationLossMeters: finalElevation.loss,
      avgPaceSecPerKm: finalPace,
      avgSpeedKmh: finalSpeed,
      maxSpeedKmh,
      caloriesEstimated: Math.round((finalDistance / 1000) * 55),
      completedAt: new Date().toISOString(),
    });

    setRoutes(getGpsRoutes(db, undefined, 24));
    routeIdRef.current = null;
    setActiveRouteId(null);
    setPaused(false);
    setWasBackgrounded(false);
    setElapsedSeconds(0);
    setLivePoints([]);
    setLiveStats({ distance: 0, gain: 0, loss: 0 });
    rollingRef.current = { lastPoint: null, lastAltitude: null, maxSpeedMps: 0 };
  }, [db, elapsedSeconds, livePoints]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        title="GPS Workout"
        subtitle="Track a route, watch pace and elevation change live, and persist every point directly into the workouts module."
        trailing={
          showSimulated ? (
            <View style={styles.simulatedBadge}>
              <MaterialSymbol name="bolt" size={16} color={DW_FEEDBACK.warning} />
              <Text style={styles.simulatedText}>SIMULATED</Text>
            </View>
          ) : activeRouteId ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>REC</Text>
            </View>
          ) : (
            <View style={styles.gpsBadge}>
              <MaterialSymbol name="route" size={16} color={DW_ACCENT_LIGHT} />
              <Text style={styles.gpsText}>GPS</Text>
            </View>
          )
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
        {showSimulated ? (
          <View style={styles.simulatedBanner}>
            <MaterialSymbol name="bolt" size={16} color={DW_FEEDBACK.warning} />
            <Text style={styles.simulatedBannerText}>
              Simulated movement (dev only). These points are fabricated, not real GPS.
            </Text>
          </View>
        ) : null}

        {activeRouteId && wasBackgrounded ? (
          <View style={styles.backgroundNote}>
            <MaterialSymbol name="pause_circle" size={16} color={DW_FEEDBACK.info} />
            <Text style={styles.backgroundNoteText}>
              Paused while in background - GPS records in the foreground only.
            </Text>
          </View>
        ) : null}

        <View style={styles.statsOverlay}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Time</Text>
            <Text style={styles.statPillValue}>{formatDuration(elapsedSeconds)}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Distance</Text>
            <Text style={styles.statPillValue}>
              {(distanceMeters / (settings.distanceUnit === 'mi' ? METERS_PER_MILE : 1000)).toFixed(2)} {settings.distanceUnit}
            </Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>Pace</Text>
            <Text style={styles.statPillValue}>
              {pace
                ? `${formatPace(paceForUnit(pace, settings.distanceUnit))} / ${settings.distanceUnit}`
                : '--'}
            </Text>
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
            stroke={DW_ACCENT}
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
        {buildElevationPoints(livePoints) ? (
          <Svg width="100%" height={140} viewBox="0 0 320 120">
            <Line x1={0} x2={320} y1={110} y2={110} stroke="rgba(214, 195, 181, 0.12)" strokeWidth={1} />
            <Polyline
              points={buildElevationPoints(livePoints)}
              fill="none"
              stroke={DW_ACCENT_LIGHT}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : (
          <Text style={styles.elevationUnavailable}>
            Elevation unavailable. This device has not reported altitude yet.
          </Text>
        )}
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
            No saved routes yet. Your first recorded route will appear here.
          </Text>
        ) : null}
      </GlassPanel>

      {startError && !activeRouteId ? (
        <GlassPanel style={styles.errorPanel}>
          <Text style={styles.errorTitle}>{errorTitle(startError.reason)}</Text>
          <Text style={styles.emptyCopy}>{startError.message}</Text>
          <View style={styles.errorActions}>
            {startError.reason === 'denied' ? (
              <WorkoutSecondaryButton label="Open Settings" onPress={() => void Linking.openSettings()} />
            ) : null}
            <WorkoutSecondaryButton label="Try again" onPress={handleStartPress} disabled={requesting} />
          </View>
        </GlassPanel>
      ) : null}

      {__DEV__ ? (
        <GlassPanel style={styles.panel}>
          <View style={styles.devToggleRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.devToggleLabel}>Simulate movement</Text>
              <Text style={styles.devToggleHint}>Dev only. Fabricates a route without real GPS.</Text>
            </View>
            <Switch
              value={useSimulator}
              onValueChange={setUseSimulator}
              disabled={Boolean(activeRouteId) || requesting}
              accessibilityRole="switch"
              accessibilityLabel="Simulate movement (developer only)"
            />
          </View>
        </GlassPanel>
      ) : null}

      <View style={styles.controlsRow}>
        {!activeRouteId ? (
          <WorkoutPrimaryButton
            label={requesting ? 'Starting…' : 'Start Route'}
            onPress={handleStartPress}
            disabled={requesting}
          />
        ) : (
          <>
            <WorkoutSecondaryButton
              label={paused ? 'Resume' : 'Pause'}
              onPress={() => setPaused((current) => !current)}
            />
            <WorkoutPrimaryButton label="End Route" onPress={handleStop} />
          </>
        )}
      </View>

      <Modal visible={showExplainer} animationType="slide" transparent>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.sheetIcon}>
              <MaterialSymbol name="route" size={24} color={DW_ACCENT} />
            </View>
            <Text style={styles.sheetTitle}>Record your route</Text>
            <Text style={styles.sheetBody}>
              DoWork uses your location during a GPS workout to record your route, pace, and
              elevation. Tracking runs only while you record.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.sheetPrimary, pressed && { opacity: 0.86 }]}
              onPress={handleEnableFromSheet}
              accessibilityRole="button"
              accessibilityLabel="Enable location"
            >
              <Text style={styles.sheetPrimaryText}>Enable location</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetSecondary, pressed && { opacity: 0.7 }]}
              onPress={() => setShowExplainer(false)}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.sheetSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  elevationUnavailable: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.tertiary,
    paddingVertical: 24,
    textAlign: 'center',
  },
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
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
  },
  gpsText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: DW_ACCENT_LIGHT,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.14)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DW_FEEDBACK.danger,
  },
  liveText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: DW_FEEDBACK.danger,
  },
  simulatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 184, 119, 0.18)',
  },
  simulatedText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: DW_FEEDBACK.warning,
  },
  simulatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 119, 0.4)',
  },
  simulatedBannerText: {
    flex: 1,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: DW_FEEDBACK.warning,
  },
  backgroundNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(139, 207, 240, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139, 207, 240, 0.34)',
  },
  backgroundNoteText: {
    flex: 1,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: DW_FEEDBACK.info,
  },
  mapPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  errorPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    color: DW_FEEDBACK.danger,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    color: DW_ACCENT_LIGHT,
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
    color: DW_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  devToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  devToggleLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  devToggleHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  secondaryButtonText: {
    color: DW_TEXT.primary,
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 12,
    backgroundColor: WK_SURFACES.low,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
  },
  sheetTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: DW_TEXT.primary,
  },
  sheetBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: DW_TEXT.secondary,
  },
  sheetPrimary: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.onAccent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sheetSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetSecondaryText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.tertiary,
  },
});

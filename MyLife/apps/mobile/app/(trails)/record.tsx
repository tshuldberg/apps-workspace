import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';
import {
  DeviationStateMachine,
  GlassCard,
  MaterialSymbol,
  StatDisplay,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_LIVE_GPS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  calculateDifficulty,
  createDeviationEvent,
  createPhoto,
  createRecording,
  createWaypoint,
  deleteRecording,
  deviationDistance,
  exportRecordingAsGPX,
  getDeviationsByRecording,
  getPhotosByRecording,
  getRecordings,
  getTrails,
  getWaypointsByRecording,
  updateRecording,
  type ActivityType,
  type TrailPhoto,
  type Waypoint,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  createSyntheticRoute,
  createTrackSummary,
  expandBounds,
  formatCompactDistance,
  formatDistanceLabel,
  formatDurationClock,
  formatElevationLabel,
  formatPaceLabel,
  getGeoBounds,
  projectCoordinate,
  projectTrackPoints,
  sampleSyntheticRouteAtProgress,
} from './phase4-utils';

const MAP_WIDTH = 390;
const MAP_HEIGHT = 620;
const POINT_INTERVAL_MS = 4_500;
const TIMER_INTERVAL_MS = 1_000;
const DEVIATION_THRESHOLD_METERS = 34;
const DEVIATION_COOLDOWN_SECONDS = 40;
const ACTIVITY_TYPES: ActivityType[] = ['hike', 'run', 'bike', 'walk'];

// `expo-keep-awake` is not installed in this workspace yet.
function useKeepAwake(): void {}

function activityLabel(activity: ActivityType): string {
  return activity.charAt(0).toUpperCase() + activity.slice(1);
}

function shortDateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function batteryHintLabel(step: number): string {
  const simulatedBattery = Math.max(51, 93 - step * 2);
  return `${simulatedBattery}%`;
}

export default function TrailRecordScreen() {
  useKeepAwake();

  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const availableTrails = useMemo(() => getTrails(db, { limit: 12 }), [db]);
  const selectedTrail = availableTrails[0] ?? null;
  const plannedRoute = useMemo(
    () => createSyntheticRoute({
      lat: selectedTrail?.lat ?? 37.7694,
      lng: selectedTrail?.lng ?? -122.4862,
    }),
    [selectedTrail?.lat, selectedTrail?.lng],
  );
  const plannedSummary = useMemo(() => createTrackSummary(plannedRoute, 1), [plannedRoute]);

  const [activity, setActivity] = useState<ActivityType>('hike');
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [photos, setPhotos] = useState<TrailPhoto[]>([]);
  const [deviations, setDeviations] = useState(() => [] as ReturnType<typeof getDeviationsByRecording>);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [collapsedStats, setCollapsedStats] = useState(false);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState(6);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveName, setSaveName] = useState('Trail Session');
  const [saveNotes, setSaveNotes] = useState('');
  const [privateMode, setPrivateMode] = useState(false);
  const [activityRating, setActivityRating] = useState<number>(4);
  const [simulatorNoticeShown, setSimulatorNoticeShown] = useState(false);
  const [recordingHydrated, setRecordingHydrated] = useState(false);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);

  const elapsedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pointRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const backgroundAtRef = useRef<number | null>(null);
  const deviationMachineRef = useRef(
    new DeviationStateMachine(DEVIATION_THRESHOLD_METERS, DEVIATION_COOLDOWN_SECONDS),
  );
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffTrailRef = useRef(false);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const refreshActiveRecording = useCallback((recordingId: string) => {
    setWaypoints(getWaypointsByRecording(db, recordingId));
    setPhotos(getPhotosByRecording(db, recordingId));
    setDeviations(getDeviationsByRecording(db, recordingId));
  }, [db]);

  useEffect(() => {
    const active = getRecordings(db).find((recording) => recording.endedAt === null) ?? null;
    if (!active) {
      setRecordingHydrated(true);
      return;
    }

    setActiveRecordingId(active.id);
    setActivity(active.activityType);
    setSaveName(active.name);
    setSaveNotes(active.notes ?? '');
    setPrivateMode(active.isPrivate);
    setActivityRating(active.activityRating ?? 4);
    setElapsedSeconds(active.durationSeconds);
    refreshActiveRecording(active.id);
    setSessionBootstrapped(true);
    setRecordingHydrated(true);
  }, [db, refreshActiveRecording]);

  useEffect(() => (
    () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointRef.current) clearInterval(pointRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    }
  ), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!activeRecordingId || paused) {
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundAtRef.current = Date.now();
        return;
      }

      if (nextState === 'active' && backgroundAtRef.current) {
        const delta = Math.round((Date.now() - backgroundAtRef.current) / 1000);
        if (delta > 0) {
          setElapsedSeconds((current) => current + delta);
        }
        backgroundAtRef.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeRecordingId, paused]);

  const persistMetrics = useCallback((recordingId: string, nextWaypoints: Waypoint[], nextElapsedSeconds: number) => {
    const summary = createTrackSummary(nextWaypoints, nextElapsedSeconds);
    updateRecording(db, recordingId, {
      distanceMeters: summary.distanceMeters,
      elevationGainMeters: summary.elevationGainMeters,
      durationSeconds: nextElapsedSeconds,
    });
  }, [db]);

  const showBanner = useCallback((message: string) => {
    setBannerMessage(message);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setBannerMessage(null);
    }, 3_000);
  }, []);

  useEffect(() => {
    if (!activeRecordingId || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointRef.current) clearInterval(pointRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, TIMER_INTERVAL_MS);

    pointRef.current = setInterval(() => {
      const deviationCycle = stepRef.current % 7;
      const deviationOffset = deviationCycle === 5
        ? { east: 68, north: -38 }
        : deviationCycle === 6
          ? { east: 24, north: -12 }
          : undefined;

      const sample = sampleSyntheticRouteAtProgress(
        plannedRoute,
        stepRef.current * 0.78,
        deviationOffset,
      );
      stepRef.current += 1;
      setGpsAccuracyMeters(sample.accuracy ?? 6);

      const nextWaypoint = createWaypoint(db, uuid(), {
        recordingId: activeRecordingId,
        lat: sample.lat,
        lng: sample.lng,
        elevation: sample.elevation ?? null,
        timestamp: sample.timestamp,
        accuracy: sample.accuracy ?? null,
      });

      const routeCoordinates = plannedRoute.map((point) => ({ lat: point.lat, lng: point.lng }));
      const deviationResult = deviationDistance(
        { lat: sample.lat, lng: sample.lng },
        routeCoordinates,
      );

      if (
        deviationMachineRef.current.update(
          deviationResult.distance,
          sample.accuracy ?? gpsAccuracyMeters,
        )
      ) {
        const event = createDeviationEvent(db, uuid(), {
          recordingId: activeRecordingId,
          trailId: selectedTrail?.id ?? null,
          lat: sample.lat,
          lng: sample.lng,
          deviationMeters: deviationResult.distance,
          nearestTrailLat: deviationResult.nearestPoint.lat,
          nearestTrailLng: deviationResult.nearestPoint.lng,
        });
        setDeviations((current) => [...current, event]);
        wasOffTrailRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showBanner(`Off trail by ${Math.round(deviationResult.distance * 3.28084)} ft`);
      } else if (wasOffTrailRef.current && deviationResult.distance < 16) {
        wasOffTrailRef.current = false;
        showBanner('Back on trail');
      }

      setWaypoints((current) => {
        const nextWaypoints = [...current, nextWaypoint];
        persistMetrics(activeRecordingId, nextWaypoints, elapsedRef.current);
        return nextWaypoints;
      });
    }, POINT_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pointRef.current) clearInterval(pointRef.current);
    };
  }, [
    activeRecordingId,
    db,
    gpsAccuracyMeters,
    paused,
    persistMetrics,
    plannedRoute,
    selectedTrail?.id,
    showBanner,
  ]);

  const summary = useMemo(
    () => createTrackSummary(waypoints, elapsedSeconds),
    [elapsedSeconds, waypoints],
  );

  const difficulty = useMemo(
    () => calculateDifficulty(
      summary.distanceMeters,
      summary.elevationGainMeters,
      summary.maxGradePercent || null,
    ),
    [summary.distanceMeters, summary.elevationGainMeters, summary.maxGradePercent],
  );

  const mapBounds = useMemo(
    () => expandBounds(
      getGeoBounds([
        ...plannedRoute,
        ...waypoints,
        ...photos.map((photo) => ({ lat: photo.lat, lng: photo.lng })),
      ]),
    ),
    [photos, plannedRoute, waypoints],
  );

  const plannedMapPoints = useMemo(
    () => projectTrackPoints(plannedRoute, MAP_WIDTH, MAP_HEIGHT, 24, mapBounds),
    [mapBounds, plannedRoute],
  );
  const liveMapPoints = useMemo(
    () => projectTrackPoints(waypoints, MAP_WIDTH, MAP_HEIGHT, 24, mapBounds),
    [mapBounds, waypoints],
  );
  const plannedPolyline = plannedMapPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const livePolyline = liveMapPoints.map((point) => `${point.x},${point.y}`).join(' ');

  const progressRatio = plannedSummary.distanceMeters > 0
    ? Math.min(summary.distanceMeters / plannedSummary.distanceMeters, 1)
    : 0;
  const currentPoint = waypoints.at(-1) ?? plannedRoute[0];
  const currentMapPoint = currentPoint
    ? projectCoordinate(currentPoint, mapBounds, MAP_WIDTH, MAP_HEIGHT, 24)
    : null;
  const activeDeviation = deviations.at(-1) ?? null;

  const syncActivityDraft = useCallback((nextActivity: ActivityType) => {
    setActivity(nextActivity);
    if (activeRecordingId) {
      updateRecording(db, activeRecordingId, { activityType: nextActivity });
    }
  }, [activeRecordingId, db]);

  const handleClose = useCallback(() => {
    if (!activeRecordingId) {
      router.back();
      return;
    }

    Alert.alert(
      'Leave recording?',
      'The active recording will stay saved in progress. You can return and resume it later.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ],
    );
  }, [activeRecordingId, router]);

  const handleStart = useCallback(() => {
    if (activeRecordingId) {
      setPaused(false);
      return;
    }

    if (!simulatorNoticeShown) {
      Alert.alert(
        'Simulator Mode',
        'MyTrails Phase 4 is wired to live persistence, photo capture, and deviation alerts. This workspace does not yet include expo-location, so route updates run from a local simulator path.',
      );
      setSimulatorNoticeShown(true);
    }

    const recordingId = uuid();
    const startedAt = new Date().toISOString();
    const initialName = selectedTrail?.name
      ? `${selectedTrail.name} Session`
      : `${activityLabel(activity)} Recording`;

    createRecording(db, recordingId, {
      trailId: selectedTrail?.id ?? null,
      name: initialName,
      activityType: activity,
      startedAt,
      distanceMeters: 0,
      elevationGainMeters: 0,
      durationSeconds: 0,
    });

    const firstSample = sampleSyntheticRouteAtProgress(plannedRoute, 0);
    const firstWaypoint = createWaypoint(db, uuid(), {
      recordingId,
      lat: firstSample.lat,
      lng: firstSample.lng,
      elevation: firstSample.elevation ?? null,
      timestamp: firstSample.timestamp,
      accuracy: firstSample.accuracy ?? null,
    });

    deviationMachineRef.current.reset();
    wasOffTrailRef.current = false;
    stepRef.current = 1;
    setActiveRecordingId(recordingId);
    setElapsedSeconds(0);
    setPaused(false);
    setWaypoints([firstWaypoint]);
    setPhotos([]);
    setDeviations([]);
    setGpsAccuracyMeters(firstSample.accuracy ?? 6);
    setSaveName(initialName);
    setSaveNotes('');
    setPrivateMode(false);
    setActivityRating(4);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [
    activeRecordingId,
    activity,
    db,
    plannedRoute,
    selectedTrail?.id,
    selectedTrail?.name,
    simulatorNoticeShown,
  ]);

  useEffect(() => {
    if (!recordingHydrated || sessionBootstrapped || activeRecordingId) {
      return;
    }

    setSessionBootstrapped(true);
    handleStart();
  }, [activeRecordingId, handleStart, recordingHydrated, sessionBootstrapped]);

  const handlePauseResume = useCallback(() => {
    if (!activeRecordingId) {
      return;
    }
    setPaused((current) => !current);
    void Haptics.selectionAsync();
  }, [activeRecordingId]);

  const appendWaypointMarker = useCallback((label: string, offset: { east: number; north: number }) => {
    if (!activeRecordingId || !currentPoint) {
      return;
    }

    const nextWaypoint = createWaypoint(db, uuid(), {
      recordingId: activeRecordingId,
      lat: currentPoint.lat + offset.north / 111_111,
      lng: currentPoint.lng + offset.east / (111_111 * Math.cos((currentPoint.lat * Math.PI) / 180)),
      elevation: currentPoint.elevation ?? null,
      timestamp: new Date().toISOString(),
      accuracy: 0,
    });

    setWaypoints((current) => {
      const nextWaypoints = [...current, nextWaypoint];
      persistMetrics(activeRecordingId, nextWaypoints, elapsedRef.current);
      return nextWaypoints;
    });
    showBanner(label);
    void Haptics.selectionAsync();
  }, [activeRecordingId, currentPoint, db, persistMetrics, showBanner]);

  const handleAddWaypoint = useCallback(() => {
    appendWaypointMarker('Waypoint added', { east: -8, north: 6 });
  }, [appendWaypointMarker]);

  const handleLapMarker = useCallback(() => {
    appendWaypointMarker('Lap marker added', { east: 10, north: -4 });
  }, [appendWaypointMarker]);

  const handlePhotoCapture = useCallback(async () => {
    if (!activeRecordingId || !currentPoint) {
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Camera access required', 'Allow camera access to attach trail photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const photo = createPhoto(db, uuid(), {
        recordingId: activeRecordingId,
        trailId: selectedTrail?.id ?? null,
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        uri: result.assets[0].uri,
        takenAt: new Date().toISOString(),
      });
      setPhotos((current) => [...current, photo]);
      showBanner('Photo captured');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Camera unavailable', 'MyTrails could not capture a photo for this recording.');
    }
  }, [activeRecordingId, currentPoint, db, selectedTrail?.id, showBanner]);

  const handleOpenSaveSheet = useCallback(() => {
    if (!activeRecordingId) {
      return;
    }
    setPaused(true);
    setShowSaveSheet(true);
  }, [activeRecordingId]);

  const handleDiscardRecording = useCallback(() => {
    if (!activeRecordingId) {
      setShowSaveSheet(false);
      return;
    }

    Alert.alert(
      'Discard recording?',
      'This removes the in-progress session, including captured waypoints and photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            deleteRecording(db, activeRecordingId);
            setActiveRecordingId(null);
            setWaypoints([]);
            setPhotos([]);
            setDeviations([]);
            setElapsedSeconds(0);
            setPaused(false);
            setShowSaveSheet(false);
            stepRef.current = 0;
          },
        },
      ],
    );
  }, [activeRecordingId, db]);

  const handleSaveRecording = useCallback(() => {
    if (!activeRecordingId) {
      return;
    }

    const endedAt = new Date().toISOString();
    updateRecording(db, activeRecordingId, {
      name: saveName.trim() || 'Trail Session',
      activityType: activity,
      endedAt,
      distanceMeters: summary.distanceMeters,
      elevationGainMeters: summary.elevationGainMeters,
      durationSeconds: elapsedSeconds,
      notes: saveNotes.trim() || null,
      isPrivate: privateMode,
      activityRating,
    });

    const gpxData = exportRecordingAsGPX(db, activeRecordingId);
    if (gpxData) {
      updateRecording(db, activeRecordingId, { gpxData });
    }

    setShowSaveSheet(false);
    setActiveRecordingId(null);
    setPaused(false);
    stepRef.current = 0;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/(trails)/recording/${activeRecordingId}` as `/${string}`);
  }, [
    activeRecordingId,
    activity,
    activityRating,
    db,
    elapsedSeconds,
    privateMode,
    router,
    saveName,
    saveNotes,
    summary.distanceMeters,
    summary.elevationGainMeters,
  ]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View style={styles.mapShell}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid slice">
          <Defs>
            <SvgGradient id="routeGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={TR_ACCENT_LIGHT} stopOpacity="0.95" />
              <Stop offset="100%" stopColor={TR_ACCENT} stopOpacity="0.78" />
            </SvgGradient>
            <SvgGradient id="plannedGlow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FFB877" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#C9894D" stopOpacity="0.65" />
            </SvgGradient>
            <SvgGradient id="dangerGlow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FF9D87" stopOpacity="0.92" />
              <Stop offset="100%" stopColor="#FF6B5A" stopOpacity="0.84" />
            </SvgGradient>
          </Defs>

          <Rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#050608" />
          <Path d="M-20 110 C80 30 160 200 280 120 S450 150 470 28" stroke="rgba(255,255,255,0.06)" strokeWidth={48} strokeLinecap="round" fill="none" />
          <Path d="M-30 270 C60 220 145 320 230 260 S340 150 430 210" stroke="rgba(255,255,255,0.045)" strokeWidth={34} strokeLinecap="round" fill="none" />
          <Path d="M20 410 C110 350 150 470 255 430 S350 320 430 380" stroke="rgba(255,255,255,0.05)" strokeWidth={38} strokeLinecap="round" fill="none" />

          {plannedPolyline ? (
            <Polyline
              points={plannedPolyline}
              fill="none"
              stroke="url(#plannedGlow)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.52}
            />
          ) : null}
          {livePolyline ? (
            <Polyline
              points={livePolyline}
              fill="none"
              stroke={activeDeviation && wasOffTrailRef.current ? 'url(#dangerGlow)' : 'url(#routeGlow)'}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {waypoints.slice(-6).map((point) => {
            const projected = projectCoordinate(point, mapBounds, MAP_WIDTH, MAP_HEIGHT, 24);
            return (
              <Circle
                key={point.id}
                cx={projected.x}
                cy={projected.y}
                r={4}
                fill="rgba(255,255,255,0.88)"
              />
            );
          })}

          {photos.map((photo) => {
            const projected = projectCoordinate(photo, mapBounds, MAP_WIDTH, MAP_HEIGHT, 24);
            return (
              <Rect
                key={photo.id}
                x={projected.x - 4}
                y={projected.y - 4}
                width={8}
                height={8}
                rx={2}
                fill="#8BCFF0"
              />
            );
          })}

          {currentMapPoint ? (
            <>
              <Circle cx={currentMapPoint.x} cy={currentMapPoint.y} r={16} fill="rgba(132, 204, 22, 0.16)" />
              <Circle cx={currentMapPoint.x} cy={currentMapPoint.y} r={6} fill={TR_LIVE_GPS} />
            </>
          ) : null}
        </Svg>

        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 8 }]}>
          <Pressable onPress={handleClose} style={styles.topBarLeft}>
            <MaterialSymbol name="arrow_back" size={22} color={TR_TEXT_SECONDARY} />
            <RNText style={styles.topTitle}>MyTrails</RNText>
          </Pressable>
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <RNText style={styles.recordingLabel}>Recording</RNText>
          </View>
          <View style={styles.topBarRight}>
            <RNText style={styles.topMeta}>GPS ±{Math.round(gpsAccuracyMeters)}m</RNText>
            <RNText style={styles.topMeta}>{batteryHintLabel(stepRef.current)}</RNText>
          </View>
        </View>

        {bannerMessage ? (
          <View style={[styles.bannerWrap, { top: Math.max(insets.top, 12) + 72 }]}>
            <BlurView intensity={30} tint="dark" style={styles.bannerBlur}>
              <View style={styles.bannerContent}>
                <MaterialSymbol name="warning" size={16} color={TR_ACCENT_LIGHT} />
                <RNText style={styles.bannerText}>{bannerMessage}</RNText>
              </View>
            </BlurView>
          </View>
        ) : null}

        <View style={[styles.mapControls, { top: Math.max(insets.top, 16) + 82 }]}>
          <MapControlButton icon="menu" />
          <MapControlButton icon="location_on" />
        </View>
      </View>

      <View style={styles.bottomPanelWrap}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={styles.bottomHandle} />
        <View style={styles.bottomPanel}>
          <View style={styles.elapsedHeader}>
            <View style={styles.elapsedCopy}>
              <RNText style={styles.elapsedLabel}>Elapsed</RNText>
              <RNText style={styles.elapsedValue}>{formatDurationClock(elapsedSeconds)}</RNText>
            </View>
            <GlassCard padding={10} style={styles.difficultyChipCard}>
              <RNText style={styles.difficultyChipText}>{difficulty.toUpperCase()}</RNText>
            </GlassCard>
          </View>

          {!collapsedStats ? (
            <View style={styles.metricGrid}>
              <MetricTile label="Distance" value={formatCompactDistance(summary.distanceMeters)} unit="km" accent={TR_ACCENT_LIGHT} />
              <MetricTile label="Elev Gain" value={Math.round(summary.elevationGainMeters)} unit="m" accent={TR_TEXT} />
              <MetricTile label="Pace" value={formatPaceLabel(summary.paceMinPerKm)} unit="/km" accent={TR_TEXT} />
              <MetricTile label="Calories" value={summary.calories} unit="kcal" accent={TR_TEXT} />
            </View>
          ) : (
            <GlassCard padding={14} style={styles.minimizedCard}>
              <RNText style={styles.minimizedLabel}>Current pace</RNText>
              <RNText style={styles.minimizedValue}>{formatPaceLabel(summary.paceMinPerKm)} /km</RNText>
            </GlassCard>
          )}

          <View style={styles.progressRail}>
            <View style={[styles.progressFill, { width: `${Math.max(progressRatio * 100, 6)}%` }]} />
          </View>

          <View style={styles.controlRow}>
            <ActionCircle icon={paused ? 'play_arrow' : 'pause'} label={paused ? 'Resume' : 'Pause'} onPress={handlePauseResume} />
            <ActionCircle icon="flag" label="Waypoint" onPress={handleAddWaypoint} />
            <ActionCircle icon="photo_camera" label="Camera" onPress={() => { void handlePhotoCapture(); }} />
            <ActionCircle icon="route" label="Lap" onPress={handleLapMarker} />
          </View>

          <View style={styles.footerRow}>
            <Pressable onPress={() => setCollapsedStats((current) => !current)} style={styles.collapseButton}>
              <MaterialSymbol name={collapsedStats ? 'play_arrow' : 'pause'} size={16} color={TR_TEXT_TERTIARY} />
              <RNText style={styles.collapseLabel}>{collapsedStats ? 'Expand' : 'Compact'}</RNText>
            </Pressable>

            <Pressable
              delayLongPress={350}
              onLongPress={handleOpenSaveSheet}
              onPress={() => {
                showBanner('Long press to finish');
              }}
              style={styles.finishButton}
            >
              <LinearGradient
                colors={['rgba(140, 36, 36, 0.96)', 'rgba(85, 12, 12, 0.94)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.finishGradient}
              >
                <MaterialSymbol name="stop" size={18} color="#FFDED6" filled />
                <RNText style={styles.finishText}>Finish</RNText>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      <Modal animationType="slide" presentationStyle="pageSheet" transparent visible={showSaveSheet}>
        <View style={styles.sheetScrim}>
          <View style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHeader}>
                <View>
                  <RNText style={styles.sheetEyebrow}>Save Session</RNText>
                  <RNText style={styles.sheetTitle}>Trail recording summary</RNText>
                </View>
                <Pressable onPress={() => setShowSaveSheet(false)} style={styles.sheetIconButton}>
                  <MaterialSymbol name="arrow_back" size={18} color={TR_TEXT_TERTIARY} />
                </Pressable>
              </View>

              <View style={styles.sheetSummaryRow}>
                <SummaryPill label="Distance" value={formatDistanceLabel(summary.distanceMeters)} />
                <SummaryPill label="Elevation" value={formatElevationLabel(summary.elevationGainMeters)} />
                <SummaryPill label="Started" value={shortDateTimeLabel(new Date(Date.now() - elapsedSeconds * 1000).toISOString())} />
              </View>

              <View style={styles.fieldGroup}>
                <RNText style={styles.fieldLabel}>Recording name</RNText>
                <TextInput
                  placeholder="Evening ridge loop"
                  placeholderTextColor={TR_TEXT_TERTIARY}
                  style={styles.textInput}
                  value={saveName}
                  onChangeText={setSaveName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <RNText style={styles.fieldLabel}>Notes</RNText>
                <TextInput
                  multiline
                  placeholder="Trail conditions, highlights, weather, or gear notes"
                  placeholderTextColor={TR_TEXT_TERTIARY}
                  style={[styles.textInput, styles.notesInput]}
                  textAlignVertical="top"
                  value={saveNotes}
                  onChangeText={setSaveNotes}
                />
              </View>

              <View style={styles.fieldGroup}>
                <RNText style={styles.fieldLabel}>Activity type</RNText>
                <View style={styles.activityRow}>
                  {ACTIVITY_TYPES.map((entry) => (
                    <Pressable
                      key={entry}
                      onPress={() => syncActivityDraft(entry)}
                      style={[
                        styles.activityChip,
                        activity === entry ? styles.activityChipActive : null,
                      ]}
                    >
                      <RNText
                        style={[
                          styles.activityChipText,
                          activity === entry ? styles.activityChipTextActive : null,
                        ]}
                      >
                        {activityLabel(entry)}
                      </RNText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.privacyRow}>
                <View style={{ flex: 1 }}>
                  <RNText style={styles.fieldLabel}>Private recording</RNText>
                  <RNText style={styles.fieldHint}>Keep this session out of shared review flows.</RNText>
                </View>
                <Switch
                  value={privateMode}
                  onValueChange={setPrivateMode}
                  thumbColor={privateMode ? TR_ACCENT_LIGHT : '#D9D9DD'}
                  trackColor={{ false: 'rgba(255,255,255,0.14)', true: 'rgba(132,204,22,0.35)' }}
                />
              </View>

              <View style={styles.fieldGroup}>
                <RNText style={styles.fieldLabel}>Quick rating</RNText>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setActivityRating(value)}
                      style={[
                        styles.ratingPill,
                        activityRating === value ? styles.ratingPillActive : null,
                      ]}
                    >
                      <MaterialSymbol
                        name="star"
                        size={16}
                        color={activityRating >= value ? '#FFB877' : TR_TEXT_TERTIARY}
                        filled={activityRating >= value}
                      />
                      <RNText style={styles.ratingLabel}>{value}</RNText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {photos.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <RNText style={styles.fieldLabel}>Photos</RNText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                    {photos.map((photo) => (
                      <Image key={photo.id} source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.sheetActions}>
                <Pressable onPress={handleDiscardRecording} style={styles.discardButton}>
                  <RNText style={styles.discardText}>Discard</RNText>
                </Pressable>
                <Pressable onPress={handleSaveRecording} style={styles.saveButton}>
                  <LinearGradient
                    colors={['#84CC16', '#65A30D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveGradient}
                  >
                    <RNText style={styles.saveText}>Save Recording</RNText>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MapControlButton({ icon }: { icon: 'menu' | 'location_on' }) {
  return (
    <Pressable style={styles.mapControlButton}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
      <MaterialSymbol name={icon} size={20} color={TR_TEXT} />
    </Pressable>
  );
}

function ActionCircle({
  icon,
  label,
  onPress,
}: {
  icon: 'pause' | 'play_arrow' | 'flag' | 'photo_camera' | 'route';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionCircle}>
      <GlassCard padding={14} style={styles.actionCircleInner}>
        <MaterialSymbol name={icon} size={20} color={TR_TEXT} filled />
        <RNText style={styles.actionLabel}>{label}</RNText>
      </GlassCard>
    </Pressable>
  );
}

function MetricTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
}) {
  return (
    <GlassCard padding={14} style={styles.metricTile}>
      <StatDisplay value={value} unit={unit} label={label} color={accent} size="sm" />
    </GlassCard>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard padding={12} style={styles.summaryPill}>
      <RNText style={styles.summaryLabel}>{label}</RNText>
      <RNText style={styles.summaryValue}>{value}</RNText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  mapShell: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topTitle: {
    fontFamily: TR_FONTS.bold,
    fontSize: 20,
    color: TR_TEXT,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },
  recordingLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: TR_TEXT_SECONDARY,
  },
  topBarRight: {
    alignItems: 'flex-end',
  },
  topMeta: {
    fontFamily: TR_FONTS.medium,
    fontSize: 11,
    color: TR_TEXT_TERTIARY,
  },
  bannerWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  bannerBlur: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 24, 17, 0.82)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerText: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 13,
    color: TR_TEXT,
  },
  mapControls: {
    position: 'absolute',
    right: 20,
    gap: 12,
  },
  mapControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,36,0.68)',
  },
  bottomPanelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 26, 0.92)',
  },
  bottomHandle: {
    alignSelf: 'center',
    width: 62,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 10,
  },
  bottomPanel: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  elapsedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  elapsedCopy: {
    gap: 4,
  },
  elapsedLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: TR_TEXT_TERTIARY,
  },
  elapsedValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 34,
    color: TR_TEXT,
    fontVariant: ['tabular-nums'],
  },
  difficultyChipCard: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(132,204,22,0.16)',
  },
  difficultyChipText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.7,
    color: TR_ACCENT_LIGHT,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    width: '47.5%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  minimizedCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  minimizedLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TR_TEXT_TERTIARY,
  },
  minimizedValue: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 24,
    color: TR_ACCENT_LIGHT,
    marginTop: 4,
  },
  progressRail: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionCircle: {
    flex: 1,
  },
  actionCircleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    gap: 8,
  },
  actionLabel: {
    fontFamily: TR_FONTS.medium,
    fontSize: 11,
    color: TR_TEXT_SECONDARY,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  collapseLabel: {
    fontFamily: TR_FONTS.medium,
    fontSize: 12,
    color: TR_TEXT_TERTIARY,
  },
  finishButton: {
    flex: 1,
    minWidth: 164,
    borderRadius: 999,
    overflow: 'hidden',
  },
  finishGradient: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  finishText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 16,
    color: '#FFE6DE',
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.46)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: TR_SURFACES.base,
    paddingTop: 18,
    paddingHorizontal: 18,
  },
  sheetContent: {
    gap: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetEyebrow: {
    fontFamily: TR_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: TR_ACCENT_LIGHT,
    marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 28,
    color: TR_TEXT,
  },
  sheetIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sheetSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryPill: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TR_TEXT_TERTIARY,
    marginBottom: 6,
  },
  summaryValue: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 14,
    color: TR_TEXT,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: TR_FONTS.bold,
    fontSize: 12,
    color: TR_TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  fieldHint: {
    fontFamily: TR_FONTS.medium,
    fontSize: 13,
    color: TR_TEXT_TERTIARY,
    marginTop: 4,
  },
  textInput: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TR_TEXT,
    fontFamily: TR_FONTS.medium,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 120,
  },
  activityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  activityChipActive: {
    backgroundColor: 'rgba(132,204,22,0.22)',
  },
  activityChipText: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 13,
    color: TR_TEXT_SECONDARY,
  },
  activityChipTextActive: {
    color: TR_ACCENT_LIGHT,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ratingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ratingPillActive: {
    backgroundColor: 'rgba(255,184,119,0.12)',
  },
  ratingLabel: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 13,
    color: TR_TEXT,
  },
  photoRow: {
    gap: 10,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingBottom: spacing.lg,
  },
  discardButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  discardText: {
    fontFamily: TR_FONTS.semiBold,
    fontSize: 15,
    color: TR_TEXT_SECONDARY,
  },
  saveButton: {
    flex: 1.3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  saveGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveText: {
    fontFamily: TR_FONTS.bold,
    fontSize: 15,
    color: '#112006',
  },
});

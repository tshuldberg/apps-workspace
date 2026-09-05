import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Polyline } from 'react-native-svg';
import {
  GlassCard,
  SectionHeader,
  StatDisplay,
  DifficultyChip,
  ElevationMiniChart,
  MaterialSymbol,
  TR_ACCENT,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  withAlpha,
  buildRoute,
  calculateElevationGain,
  calculateRouteStats,
  createPlannedRoute,
  createRouteWaypoint,
  getPlannedRoutes,
  getRouteWaypoints,
  getTrails,
  haversineDistance,
  type GeoPoint,
  type RouteBuildMode,
  type RouteTravelMode,
  type Trail,
} from '@mylife/trails';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type PlannerWaypoint = {
  id: string;
  x: number;
  y: number;
};

type PlannerCanvas = {
  width: number;
  height: number;
};

type PlannerDraft = {
  displayPoints: Array<{ x: number; y: number }>;
  geoWaypoints: GeoPoint[];
  stats: ReturnType<typeof calculateRouteStats>;
  profilePoints: Array<{ distance: number; elevation: number }>;
  waypointRows: Array<{
    id: string;
    title: string;
    distanceFromPreviousMeters: number;
    elevationDeltaMeters: number;
  }>;
  routeGeometry: string;
  isLoop: boolean;
};

type RoutePrivacy = 'private' | 'shared';

const DEFAULT_CANVAS: PlannerCanvas = { width: 360, height: 420 };
const LAT_SPAN = 0.03;
const LNG_SPAN = 0.03;

export default function RouteBuilderScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const skipNextCanvasTapRef = useRef(false);

  const [tick, setTick] = useState(0);
  const [routeName, setRouteName] = useState('');
  const [waypoints, setWaypoints] = useState<PlannerWaypoint[]>([]);
  const [canvas, setCanvas] = useState<PlannerCanvas>(DEFAULT_CANVAS);
  const [routeMode, setRouteMode] = useState<RouteBuildMode>('auto');
  const [travelMode, setTravelMode] = useState<RouteTravelMode>('hike');
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [showElevation, setShowElevation] = useState(true);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [routeNotes, setRouteNotes] = useState('');
  const [routePrivacy, setRoutePrivacy] = useState<RoutePrivacy>('private');
  const [startAfterSave, setStartAfterSave] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const trails = useMemo(() => getTrails(db), [db, tick]);
  const referencePoint = useMemo(() => deriveReferencePoint(trails), [trails]);

  const recentRoutes = useMemo(() => {
    return getPlannedRoutes(db)
      .slice(0, 4)
      .map((route) => ({
        route,
        waypointCount: getRouteWaypoints(db, route.id).length,
      }));
  }, [db, tick]);

  const draft = useMemo(
    () => buildPlannerDraft(waypoints, canvas, referencePoint, routeMode, travelMode),
    [canvas, referencePoint, routeMode, travelMode, waypoints],
  );

  const draftDirty =
    waypoints.length > 0 ||
    routeName.trim().length > 0 ||
    routeNotes.trim().length > 0 ||
    routePrivacy !== 'private' ||
    startAfterSave;

  const addWaypoint = useCallback(
    (x: number, y: number) => {
      const nextId = uuid();
      setWaypoints((current) => {
        const nextWaypoint = {
          id: nextId,
          x: clamp(x, 20, canvas.width - 20),
          y: clamp(y, 26, canvas.height - 32),
        };
        return [...current, nextWaypoint];
      });
      setSelectedWaypointId(nextId);
    },
    [canvas.height, canvas.width],
  );

  const moveWaypoint = useCallback(
    (id: string, x: number, y: number) => {
      setWaypoints((current) =>
        current.map((waypoint) =>
          waypoint.id === id
            ? {
                ...waypoint,
                x: clamp(x, 20, canvas.width - 20),
                y: clamp(y, 26, canvas.height - 32),
              }
            : waypoint,
        ),
      );
    },
    [canvas.height, canvas.width],
  );

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((current) => current.filter((waypoint) => waypoint.id !== id));
    setSelectedWaypointId((current) => (current === id ? null : current));
  }, []);

  const handleCanvasRelease = useCallback(
    (event: GestureResponderEvent) => {
      if (skipNextCanvasTapRef.current) {
        return;
      }

      const { locationX, locationY } = event.nativeEvent;
      addWaypoint(locationX, locationY);
    },
    [addWaypoint],
  );

  const handleBack = useCallback(() => {
    if (!draftDirty) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard route draft?',
      'You have unsaved waypoints or notes in this planner.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ],
    );
  }, [draftDirty, router]);

  const openSaveModal = useCallback(() => {
    if (waypoints.length < 2) {
      Alert.alert('Add more waypoints', 'Drop at least two waypoints before saving a route.');
      return;
    }

    setSaveModalVisible(true);
  }, [waypoints.length]);

  const handleSave = useCallback(() => {
    if (waypoints.length < 2) {
      return;
    }

    const name = routeName.trim() || `Planned Route ${recentRoutes.length + 1}`;
    let routeGeometry = draft.routeGeometry;

    try {
      const parsed = JSON.parse(draft.routeGeometry) as {
        meta?: Record<string, unknown>;
      };
      routeGeometry = JSON.stringify({
        ...parsed,
        meta: {
          ...(parsed.meta ?? {}),
          notes: routeNotes.trim() || null,
          privacy: routePrivacy,
        },
      });
    } catch {
      routeGeometry = draft.routeGeometry;
    }

    try {
      const routeId = uuid();
      createPlannedRoute(db, routeId, {
        name,
        distanceMeters: Math.round(draft.stats.distanceMeters),
        elevationGainMeters: Math.round(draft.stats.elevationGainMeters),
        estimatedMinutes: draft.stats.estimatedMinutes,
        isLoop: draft.isLoop,
        routeGeometry,
      });

      draft.geoWaypoints.forEach((waypoint, index) => {
        createRouteWaypoint(db, uuid(), {
          routeId,
          lat: waypoint.lat,
          lng: waypoint.lng,
          sortOrder: index,
          label: `Waypoint ${index + 1}`,
        });
      });

      setSaveModalVisible(false);
      setTick((value) => value + 1);
      setRouteName('');
      setRouteNotes('');
      setRoutePrivacy('private');
      setStartAfterSave(false);
      setWaypoints([]);
      setSelectedWaypointId(null);

      if (startAfterSave) {
        router.push('/(trails)/record');
        return;
      }

      Alert.alert('Route saved', `${name} was added to your planned routes.`);
    } catch {
      Alert.alert('Unable to save route', 'The route draft could not be persisted.');
    }
  }, [
    db,
    draft.geoWaypoints,
    draft.isLoop,
    draft.stats.distanceMeters,
    draft.stats.elevationGainMeters,
    draft.stats.estimatedMinutes,
    recentRoutes.length,
    routeName,
    routeNotes,
    routePrivacy,
    router,
    startAfterSave,
    waypoints.length,
  ]);

  const renderWaypointItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<PlannerWaypoint>) => {
      const index = getIndex() ?? 0;
      const row = draft.waypointRows[index] ?? {
        id: item.id,
        title: `Waypoint ${index + 1}`,
        distanceFromPreviousMeters: 0,
        elevationDeltaMeters: 0,
      };
      const selected = item.id === selectedWaypointId;

      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            onPress={() => setSelectedWaypointId(item.id)}
            style={[
              styles.waypointRow,
              selected ? styles.waypointRowSelected : null,
              isActive ? styles.waypointRowDragging : null,
            ]}
          >
            <View style={styles.waypointOrder}>
              <RNText style={styles.waypointOrderLabel}>{index + 1}</RNText>
            </View>
            <View style={styles.waypointCopy}>
              <RNText style={styles.waypointTitle}>{row.title}</RNText>
              <RNText style={styles.waypointMeta}>
                {index === 0
                  ? 'Trailhead anchor'
                  : `${formatCompactDistance(row.distanceFromPreviousMeters)} from previous · ${formatElevationDelta(row.elevationDeltaMeters)}`}
              </RNText>
            </View>
            <View style={styles.rowActions}>
              <Pressable hitSlop={8} onPress={() => removeWaypoint(item.id)}>
                <RNText style={styles.removeText}>Remove</RNText>
              </Pressable>
              <MaterialSymbol name="more_vert" size={18} color={TR_TEXT_TERTIARY} />
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [draft.waypointRows, removeWaypoint, selectedWaypointId],
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#13200A', '#0E1010', '#090A0F']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
          },
        ]}
      >
        <Pressable hitSlop={10} onPress={handleBack} style={styles.headerIcon}>
          <MaterialSymbol name="arrow_back" size={22} color={TR_TEXT} />
        </Pressable>

        <GlassCard padding={12} style={styles.headerInputCard}>
          <RNText style={styles.headerEyebrow}>Route Draft</RNText>
          <TextInput
            value={routeName}
            onChangeText={setRouteName}
            placeholder="Name this route"
            placeholderTextColor={TR_TEXT_TERTIARY}
            style={styles.routeNameInput}
          />
        </GlassCard>

        <Pressable hitSlop={10} onPress={openSaveModal} style={styles.saveButton}>
          <RNText style={styles.saveButtonLabel}>Save</RNText>
        </Pressable>
      </View>

      <View style={styles.canvasWrap}>
        <View
          style={styles.canvasCard}
          onLayout={(event) => {
            const nextWidth = Math.max(280, Math.round(event.nativeEvent.layout.width));
            const nextHeight = Math.max(300, Math.round(event.nativeEvent.layout.height));

            if (nextWidth !== canvas.width || nextHeight !== canvas.height) {
              setCanvas({ width: nextWidth, height: nextHeight });
            }
          }}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleCanvasRelease}
        >
          <Svg width="100%" height="100%" viewBox={`0 0 ${canvas.width} ${canvas.height}`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Line
                key={`grid-${index}`}
                x1={12}
                y1={70 + (index * ((canvas.height - 120) / 4))}
                x2={canvas.width - 12}
                y2={50 + (index * ((canvas.height - 96) / 4))}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            ))}

            {draft.displayPoints.length > 1 ? (
              <>
                <Polyline
                  points={draft.displayPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                  stroke={TR_ACCENT_GLOW}
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <Polyline
                  points={draft.displayPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                  stroke={routeMode === 'auto' ? TR_ACCENT_LIGHT : withAlpha(TR_TEXT, 0.9)}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </>
            ) : null}

            {waypoints.length > 1 ? (
              <Polyline
                points={waypoints.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke="rgba(255,255,255,0.16)"
                strokeDasharray="8 8"
                strokeWidth={1.5}
                fill="none"
              />
            ) : null}
          </Svg>

          <View style={styles.canvasTopOverlay}>
            <View style={styles.overlayRow}>
              <TogglePill
                label="Auto Route"
                icon="route"
                active={routeMode === 'auto'}
                onPress={() => setRouteMode('auto')}
              />
              <TogglePill
                label="Straight"
                icon="straighten"
                active={routeMode === 'straight'}
                onPress={() => setRouteMode('straight')}
              />
            </View>
            <View style={styles.overlayRow}>
              <TogglePill
                label="Hike Mode"
                icon="hiking"
                active={travelMode === 'hike'}
                onPress={() => setTravelMode('hike')}
              />
              <TogglePill
                label="Bike Mode"
                icon="directions_walk"
                active={travelMode === 'bike'}
                onPress={() => setTravelMode('bike')}
              />
            </View>
          </View>

          <GlassCard padding={12} style={styles.mapHint}>
            <RNText style={styles.mapHintTitle}>Terrain Studio</RNText>
            <RNText style={styles.mapHintCopy}>
              Tap anywhere to drop a waypoint. Drag the numbered markers to refine the line.
            </RNText>
          </GlassCard>

          {waypoints.map((waypoint, index) => {
            const selected = waypoint.id === selectedWaypointId;
            const responder = PanResponder.create({
              onStartShouldSetPanResponder: () => true,
              onPanResponderGrant: () => {
                skipNextCanvasTapRef.current = true;
                setSelectedWaypointId(waypoint.id);
              },
              onPanResponderMove: (_event, gestureState) => {
                moveWaypoint(waypoint.id, waypoint.x + gestureState.dx, waypoint.y + gestureState.dy);
              },
              onPanResponderRelease: () => {
                requestAnimationFrame(() => {
                  skipNextCanvasTapRef.current = false;
                });
              },
              onPanResponderTerminate: () => {
                requestAnimationFrame(() => {
                  skipNextCanvasTapRef.current = false;
                });
              },
            });

            return (
              <View
                key={waypoint.id}
                {...responder.panHandlers}
                style={[
                  styles.waypointMarker,
                  {
                    left: waypoint.x - 18,
                    top: waypoint.y - 18,
                  },
                  selected ? styles.waypointMarkerSelected : null,
                ]}
              >
                <CircleMarker index={index} selected={selected} />
              </View>
            );
          })}

          <GlassCard padding={14} style={styles.statsBar}>
            <View style={styles.statsBarRow}>
              <StatDisplay
                value={Math.round(draft.stats.distanceMeters / 100) / 10}
                unit="km"
                label="Distance"
                size="sm"
                color={TR_TEXT}
              />
              <StatDisplay
                value={Math.round(draft.stats.elevationGainMeters)}
                unit="m"
                label="Gain"
                size="sm"
                color={TR_TEXT}
              />
              <StatDisplay
                value={draft.stats.estimatedMinutes}
                unit="min"
                label="ETA"
                size="sm"
                color={TR_TEXT}
              />
            </View>
            <DifficultyChip level={draft.stats.difficulty} />
          </GlassCard>
        </View>
      </View>

      <GlassCard padding={16} style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <SectionHeader
            title="Waypoint Drawer"
            action={{
              label: showElevation ? 'Hide Elevation' : 'Show Elevation',
              onPress: () => setShowElevation((value) => !value),
            }}
          />
        </View>

        {showElevation ? (
          <View style={styles.elevationPanel}>
            <ElevationMiniChart points={draft.profilePoints} height={92} />
          </View>
        ) : null}

        <View style={styles.listShell}>
          <DraggableFlatList
            data={waypoints}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => setWaypoints(data)}
            renderItem={renderWaypointItem}
            activationDistance={10}
            containerStyle={styles.listContainer}
            contentContainerStyle={waypoints.length === 0 ? styles.emptyListContent : undefined}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialSymbol name="route" size={28} color={TR_ACCENT_LIGHT} />
                <RNText style={styles.emptyTitle}>No waypoints yet</RNText>
                <RNText style={styles.emptyCopy}>
                  Build the route directly on the canvas, then reorder stops here with a long press.
                </RNText>
              </View>
            }
          />
        </View>

        {recentRoutes.length > 0 ? (
          <View style={styles.recentSection}>
            <SectionHeader title="Recent Plans" />
            <View style={styles.recentList}>
              {recentRoutes.map(({ route, waypointCount }) => (
                <View key={route.id} style={styles.recentCard}>
                  <RNText style={styles.recentTitle} numberOfLines={1}>
                    {route.name}
                  </RNText>
                  <RNText style={styles.recentMeta}>
                    {waypointCount} waypoints · {formatCompactDistance(route.distanceMeters)} · {route.estimatedMinutes ?? 0} min
                  </RNText>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </GlassCard>

      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <GlassCard padding={18} style={styles.modalCard}>
            <RNText style={styles.modalTitle}>Save Planned Route</RNText>
            <RNText style={styles.modalCopy}>
              Persist the current waypoint draft to your planned routes library.
            </RNText>

            <LabeledField label="Route name">
              <TextInput
                value={routeName}
                onChangeText={setRouteName}
                placeholder="Sunrise Ridge Loop"
                placeholderTextColor={TR_TEXT_TERTIARY}
                style={styles.modalInput}
              />
            </LabeledField>

            <LabeledField label="Notes">
              <TextInput
                value={routeNotes}
                onChangeText={setRouteNotes}
                placeholder="Water carry, sunrise start, meetup notes"
                placeholderTextColor={TR_TEXT_TERTIARY}
                style={[styles.modalInput, styles.notesInput]}
                multiline
              />
            </LabeledField>

            <LabeledField label="Privacy">
              <View style={styles.privacyRow}>
                <TogglePill
                  label="Private"
                  active={routePrivacy === 'private'}
                  onPress={() => setRoutePrivacy('private')}
                />
                <TogglePill
                  label="Shared"
                  active={routePrivacy === 'shared'}
                  onPress={() => setRoutePrivacy('shared')}
                />
              </View>
            </LabeledField>

            <Pressable
              style={styles.inlineToggle}
              onPress={() => setStartAfterSave((value) => !value)}
            >
              <MaterialSymbol
                name={startAfterSave ? 'check_box' : 'check_box_outline_blank'}
                size={20}
                color={startAfterSave ? TR_ACCENT_LIGHT : TR_TEXT_TERTIARY}
              />
              <RNText style={styles.inlineToggleLabel}>Start recording immediately after save</RNText>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setSaveModalVisible(false)} style={styles.secondaryButton}>
                <RNText style={styles.secondaryButtonLabel}>Cancel</RNText>
              </Pressable>
              <Pressable onPress={handleSave} style={styles.primaryButton}>
                <RNText style={styles.primaryButtonLabel}>Save Route</RNText>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

function buildPlannerDraft(
  waypoints: PlannerWaypoint[],
  canvas: PlannerCanvas,
  origin: GeoPoint,
  routeMode: RouteBuildMode,
  travelMode: RouteTravelMode,
): PlannerDraft {
  const geoWaypoints = waypoints.map((waypoint) => projectCanvasToGeo(waypoint, canvas, origin));
  const routePoints = buildRoute(geoWaypoints, routeMode);
  const displayPoints = routePoints.map((point) => projectGeoToCanvas(point, canvas, origin));
  const routeElevations = routePoints.map((point) => elevationFromGeo(point, canvas, origin));
  const elevationGainMeters = calculateElevationGain(routeElevations);
  const stats = calculateRouteStats(routePoints, elevationGainMeters, travelMode);

  let cumulativeDistance = 0;
  const profilePoints = routePoints.map((point, index) => {
    if (index > 0) {
      const previous = routePoints[index - 1];
      cumulativeDistance += haversineDistance(previous.lat, previous.lng, point.lat, point.lng);
    }

    return {
      distance: cumulativeDistance,
      elevation: routeElevations[index],
    };
  });

  const waypointRows = waypoints.map((waypoint, index) => {
    const currentGeo = geoWaypoints[index];
    const previousGeo = geoWaypoints[index - 1];
    const currentElevation = elevationFromCanvasY(waypoint.y, canvas);
    const previousElevation = previousGeo
      ? elevationFromGeo(previousGeo, canvas, origin)
      : currentElevation;

    return {
      id: waypoint.id,
      title: `Waypoint ${index + 1}`,
      distanceFromPreviousMeters: previousGeo
        ? haversineDistance(previousGeo.lat, previousGeo.lng, currentGeo.lat, currentGeo.lng)
        : 0,
      elevationDeltaMeters: currentElevation - previousElevation,
    };
  });

  const routeGeometry = JSON.stringify({
    type: 'LineString',
    coordinates: routePoints.map((point) => [point.lng, point.lat]),
    meta: {
      mode: routeMode,
      travelMode,
    },
  });

  const isLoop =
    geoWaypoints.length > 2 &&
    haversineDistance(
      geoWaypoints[0].lat,
      geoWaypoints[0].lng,
      geoWaypoints[geoWaypoints.length - 1].lat,
      geoWaypoints[geoWaypoints.length - 1].lng,
    ) < 150;

  return {
    displayPoints,
    geoWaypoints,
    stats,
    profilePoints:
      profilePoints.length >= 2
        ? profilePoints
        : [
            { distance: 0, elevation: 810 },
            { distance: 100, elevation: 830 },
          ],
    waypointRows,
    routeGeometry,
    isLoop,
  };
}

function deriveReferencePoint(trails: Trail[]): GeoPoint {
  if (trails.length === 0) {
    return { lat: 37.7749, lng: -122.4194 };
  }

  const total = trails.reduce(
    (accumulator, trail) => ({
      lat: accumulator.lat + trail.lat,
      lng: accumulator.lng + trail.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / trails.length,
    lng: total.lng / trails.length,
  };
}

function projectCanvasToGeo(
  waypoint: PlannerWaypoint,
  canvas: PlannerCanvas,
  origin: GeoPoint,
): GeoPoint {
  const normalizedX = canvas.width === 0 ? 0.5 : waypoint.x / canvas.width;
  const normalizedY = canvas.height === 0 ? 0.5 : waypoint.y / canvas.height;

  return {
    lat: origin.lat + ((0.5 - normalizedY) * LAT_SPAN),
    lng: origin.lng + ((normalizedX - 0.5) * LNG_SPAN),
  };
}

function projectGeoToCanvas(
  point: GeoPoint,
  canvas: PlannerCanvas,
  origin: GeoPoint,
): { x: number; y: number } {
  return {
    x: ((point.lng - origin.lng) / LNG_SPAN + 0.5) * canvas.width,
    y: (0.5 - ((point.lat - origin.lat) / LAT_SPAN)) * canvas.height,
  };
}

function elevationFromCanvasY(y: number, canvas: PlannerCanvas): number {
  const normalized = canvas.height === 0 ? 0.5 : 1 - (y / canvas.height);
  return Math.round(780 + (normalized * 720));
}

function elevationFromGeo(
  point: GeoPoint,
  canvas: PlannerCanvas,
  origin: GeoPoint,
): number {
  return elevationFromCanvasY(projectGeoToCanvas(point, canvas, origin).y, canvas);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatCompactDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatElevationDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) {
    return 'flat';
  }
  if (rounded > 0) {
    return `+${rounded} m`;
  }
  return `${rounded} m`;
}

function TogglePill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.togglePill,
        active ? styles.togglePillActive : null,
      ]}
    >
      {icon ? (
        <MaterialSymbol
          name={icon}
          size={14}
          color={active ? '#0C1605' : TR_ACCENT_LIGHT}
        />
      ) : null}
      <RNText
        style={[
          styles.togglePillLabel,
          active ? styles.togglePillLabelActive : null,
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

function CircleMarker({
  index,
  selected,
}: {
  index: number;
  selected: boolean;
}) {
  return (
    <View style={[styles.markerCore, selected ? styles.markerCoreSelected : null]}>
      <RNText style={styles.markerLabel}>{index + 1}</RNText>
    </View>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <RNText style={styles.fieldLabel}>{label}</RNText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headerInputCard: {
    flex: 1,
    gap: 2,
    backgroundColor: 'rgba(8, 12, 6, 0.72)',
  },
  headerEyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  routeNameInput: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
    paddingVertical: 0,
  },
  saveButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  saveButtonLabel: {
    fontFamily: TR_FONTS.bold,
    color: '#0B1505',
    fontSize: 13,
  },
  canvasWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  canvasCard: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#0F140D',
  },
  canvasTopOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    gap: 8,
  },
  overlayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(17, 20, 17, 0.72)',
  },
  togglePillActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  togglePillLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
  },
  togglePillLabelActive: {
    color: '#0C1605',
  },
  mapHint: {
    position: 'absolute',
    top: 94,
    right: 16,
    width: 164,
    backgroundColor: 'rgba(17, 20, 17, 0.68)',
  },
  mapHintTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
    marginBottom: 4,
  },
  mapHintCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  waypointMarker: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointMarkerSelected: {
    transform: [{ scale: 1.1 }],
  },
  markerCore: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TR_ACCENT,
    shadowColor: TR_ACCENT_GLOW,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  markerCoreSelected: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  markerLabel: {
    fontFamily: TR_FONTS.bold,
    color: '#0C1605',
    fontSize: 13,
  },
  statsBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(17, 20, 17, 0.76)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsBarRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheet: {
    marginHorizontal: 16,
    marginBottom: 16,
    minHeight: 300,
    maxHeight: 350,
    backgroundColor: 'rgba(18, 19, 24, 0.78)',
    gap: 10,
  },
  sheetHeader: {
    gap: 8,
  },
  elevationPanel: {
    marginBottom: 4,
  },
  listShell: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 30,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  emptyCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  waypointRowSelected: {
    backgroundColor: withAlpha(TR_ACCENT, 0.18),
  },
  waypointRowDragging: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  waypointOrder: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(TR_ACCENT, 0.24),
  },
  waypointOrderLabel: {
    fontFamily: TR_FONTS.bold,
    color: TR_ACCENT_LIGHT,
    fontSize: 12,
  },
  waypointCopy: {
    flex: 1,
    gap: 2,
  },
  waypointTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  waypointMeta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  removeText: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: '#FFB4AB',
  },
  recentSection: {
    gap: 10,
  },
  recentList: {
    gap: 8,
  },
  recentCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  recentTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  recentMeta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  modalCard: {
    backgroundColor: 'rgba(18, 19, 24, 0.88)',
    gap: 14,
  },
  modalTitle: {
    ...TR_TYPOGRAPHY.headlineMd,
    color: TR_TEXT,
  },
  modalCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  modalInput: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: TR_TEXT,
    fontFamily: TR_FONTS.medium,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  inlineToggleLabel: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: 4,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryButtonLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  primaryButtonLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: '#0B1505',
    fontFamily: TR_FONTS.bold,
  },
});
